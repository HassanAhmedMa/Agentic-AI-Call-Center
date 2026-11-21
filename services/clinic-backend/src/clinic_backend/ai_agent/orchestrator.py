"""AI Chatbot Orchestrator for Shiffaa Clinics.

Connects to Antigravity Reverse Proxy via native tool calling, executes
clinical tools against backend catalog stores, and streams clean SSE responses.
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncGenerator

import httpx

from clinic_backend.ai_agent.tools import (
    execute_fetch_doctors,
    get_available_tools_schema,
)
from clinic_backend.catalog import Catalog

logger = logging.getLogger("clinic_backend.ai_agent.orchestrator")

SYSTEM_PROMPT = """You are "Shiffaa" (شفاء), the official AI conversational receptionist for Shiffaa Clinics (عيادات شفاء).

TOPIC & DOMAIN BOUNDARY (TOPIC MATTERS, NOT CASUAL IDIOMS):
1. CLINIC INQUIRIES (ALWAYS ASSIST):
   - Whenever the patient asks about doctors, specialties, appointments, booking, or clinic branches, YOU MUST ALWAYS HELP THEM AND CALL `fetch_doctors`!
   - Everyday Egyptian idioms and casual filler phrases (e.g. "علشان خاطري", "بالله عليك", "بقولك إيه", "يا باشا") are normal friendly Egyptian speech. When someone says "علشان خاطري شوفلي دكتور باطنة" or "بالله عليك احجزلي", THIS IS A VALID CLINIC INQUIRY: invoke the tool and help them warmly!
2. OUT-OF-DOMAIN TOPICS (REFUSE POLITELY):
   - ONLY refuse if the user is asking about non-clinic topics (such as computer programming, writing code/scripts, math equations, homework, recipes, or creative stories).
   - If (and only if) the topic is non-clinic, refuse politely in Egyptian Arabic:
     "بعتذر لحضرتك، أنا مخصص فقط للمساعدة في خدمات وحجوزات عيادات شفاء الطبية. أقدر أساعدك في حجز كشف أو الاستفسار عن دكاترتنا المتاحين؟"

CLINIC SPECIALTIES:
- Available departments: أمراض القلب (Cardiology), الأمراض الجلدية (Dermatology), طب الأطفال (Pediatrics), جراحة العظام (Orthopedics), الباطنة (Internal Medicine).
- Unlisted departments: We do NOT have Dentistry (طب أسنان), Ophthalmology (عيون), etc.

OPERATIONAL RULES:
1. ZERO INTERNAL MEMORY: You have NO doctor records in memory. When the patient asks about doctors, specialties, appointments, or clinic schedules, YOU MUST CALL `fetch_doctors`.
2. If `fetch_doctors` returns doctors:
   - Present them warmly in 1-2 concise sentences in natural Egyptian Arabic (or English if the user wrote in English).
   - Invite the patient to choose a doctor from the cards.
3. If `fetch_doctors` returns 0 doctors (e.g. for unlisted departments like أسنان):
   - Politely inform the patient that this specialty is NOT available at Shiffaa Clinics.
   - Mention our 5 available specialties. NEVER invent doctors!
4. MEDICAL SAFETY GUARDRAIL:
   - You are an administrative assistant, NOT a physician.
   - NEVER diagnose illnesses, recommend drugs, or suggest dosages.
   - For emergency symptoms, urge immediate hospital ER care or calling 123.
5. CONCISENESS & CLEANLINESS:
   - Maximum 2 sentences. Never output code blocks, raw JSON, or internal thinking tags.
"""


async def stream_chat_turn(
    catalog: Catalog,
    messages: list[dict[str, Any]],
    model: str = "gemini-3.5-flash-lite",
    api_url: str = "https://ai.141.253.118.80.sslip.io",
    api_key: str = "sk-41783f2a77994309a22717363289e4b9",
    language: str = "ar",
) -> AsyncGenerator[str, None]:
    """Execute a single conversational chat turn with tool support and stream SSE events."""
    base_url = api_url.rstrip("/")
    if base_url.endswith("/api-proxy"):
        base_url = base_url[:-10]
    completions_url = f"{base_url}/v1/chat/completions"

    tools = get_available_tools_schema()

    # Prepend system instruction
    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + [
        {"role": m.get("role", "user"), "content": m.get("content", "")}
        for m in messages
    ]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    payload = {
        "model": model,
        "messages": full_messages,
        "tools": tools,
        "tool_choice": "auto",
        "stream": True,
        "temperature": 0.2,
        "max_tokens": 800,
    }

    buffered_tokens: list[str] = []

    async with httpx.AsyncClient(timeout=45.0, verify=False) as client:
        try:
            async with client.stream(
                "POST", completions_url, headers=headers, json=payload
            ) as response:
                if response.status_code != 200:
                    err_body = await response.aread()
                    logger.error("LLM proxy returned %d: %s", response.status_code, err_body.decode(errors="ignore"))
                    yield format_sse("error", {"message": f"LLM Gateway Error ({response.status_code})"})
                    return

                tool_call_chunks = []
                is_tool_call = False

                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line or line.startswith(":"):
                        continue
                    if line == "data: [DONE]":
                        break
                    if line.startswith("data: "):
                        data_str = line[6:]
                        try:
                            chunk = json.loads(data_str)
                            choice = chunk.get("choices", [{}])[0]
                            delta = choice.get("delta", {})

                            # Check for tool call
                            if "tool_calls" in delta and delta["tool_calls"]:
                                is_tool_call = True
                                tool_call_chunks.append(delta["tool_calls"])

                            # Direct content stream (strictly ignore reasoning_content)
                            content = delta.get("content", "")
                            if content and not is_tool_call:
                                buffered_tokens.append(content)

                        except Exception as e:
                            logger.debug("Error parsing chunk: %s", e)

                # If it wasn't a tool call, flush all buffered tokens to the client
                if not is_tool_call and buffered_tokens:
                    for tok in buffered_tokens:
                        yield format_sse("token", {"text": tok})

        except Exception as e:
            logger.error("Failed connecting to LLM proxy: %s", e)
            yield format_sse("error", {"message": f"Connection failed: {str(e)}"})
            return

        # If a tool call was detected, parse, execute, and run second conversational pass
        if is_tool_call:
            fn_name, fn_args_str, call_id = assemble_tool_call(tool_call_chunks)
            logger.info("Assembled tool call: %s (id: %s) with args: %s", fn_name, call_id, fn_args_str)

            tool_result = {}
            widget_payload = None

            try:
                fn_args = json.loads(fn_args_str) if fn_args_str else {}
            except Exception:
                fn_args = {}

            if fn_name == "fetch_doctors":
                spec_name = fn_args.get("specialty_name", "")
                tool_result = await execute_fetch_doctors(catalog, spec_name, language=language)
                widget_payload = tool_result.get("ui_widget")

            # Emit widget event to client immediately if cards exist
            if widget_payload:
                yield format_sse("widget", widget_payload)

            # Build follow-up messages for model to summarize
            follow_up_messages = list(full_messages)
            follow_up_messages.append(
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": call_id,
                            "type": "function",
                            "function": {
                                "name": fn_name,
                                "arguments": fn_args_str,
                            },
                        }
                    ],
                }
            )
            follow_up_messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call_id,
                    "name": fn_name,
                    "content": json.dumps(tool_result.get("doctors", []), ensure_ascii=False),
                }
            )

            # Second streaming turn for final assistant speech
            second_payload = {
                "model": model,
                "messages": follow_up_messages,
                "stream": True,
                "temperature": 0.2,
                "max_tokens": 500,
            }

            try:
                async with client.stream(
                    "POST", completions_url, headers=headers, json=second_payload
                ) as resp2:
                    if resp2.status_code == 200:
                        async for line in resp2.aiter_lines():
                            line = line.strip()
                            if not line or line.startswith(":") or line == "data: [DONE]":
                                continue
                            if line.startswith("data: "):
                                try:
                                    chunk = json.loads(line[6:])
                                    choice = chunk.get("choices", [{}])[0]
                                    delta = choice.get("delta", {})
                                    content = delta.get("content", "")
                                    # Strictly skip reasoning_content
                                    if content:
                                        yield format_sse("token", {"text": content})
                                except Exception:
                                    pass
            except Exception as e:
                logger.error("Error in second turn: %s", e)

    # Completed
    yield format_sse("done", {"status": "ok"})


def assemble_tool_call(chunks: list[list[dict[str, Any]]]) -> tuple[str, str, str]:
    """Assemble tool name, arguments, and call ID from SSE delta chunks."""
    fn_name = ""
    args_parts = []
    call_id = "call_1"
    for chunk_list in chunks:
        for item in chunk_list:
            if item.get("id"):
                call_id = item["id"]
            fn = item.get("function", {})
            if "name" in fn and fn["name"]:
                fn_name = fn["name"]
            if "arguments" in fn and fn["arguments"]:
                args_parts.append(fn["arguments"])
    return fn_name, "".join(args_parts), call_id


def format_sse(event: str, data: dict[str, Any]) -> str:
    """Format an SSE message."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
