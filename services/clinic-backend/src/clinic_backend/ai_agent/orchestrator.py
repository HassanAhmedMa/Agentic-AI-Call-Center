"""AI Chatbot Orchestrator for Shiffaa Clinics.

Connects to Antigravity Reverse Proxy via native tool calling, executes
clinical tools against backend catalog stores, and streams clean SSE responses.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import httpx

from clinic_backend.ai_agent import booking_tools, patient_tools
from clinic_backend.ai_agent.appointments import AppointmentAPI
from clinic_backend.ai_agent.tools import (
    execute_fetch_doctors,
    get_available_tools_schema,
)
from clinic_backend.catalog import Catalog

logger = logging.getLogger("clinic_backend.ai_agent.orchestrator")

SYSTEM_PROMPT = (
    'You are "Shiffaa" (شفاء), the official AI conversationa'
    "l receptionist for Shiffaa Clinics (عيادات شفاء).\n\nTOPI"
    "C & DOMAIN BOUNDARY (TOPIC MATTERS, NOT CASUAL IDIOMS):"
    "\n1. CLINIC INQUIRIES (ALWAYS ASSIST):\n   - Whenever the"
    " patient asks about doctors, specialties, appointments,"
    " booking, or clinic branches, Use fetch_doctors for doc"
    "tor search. For a selected doctor and date use get_doct"
    "or_availability. For own appointments use list_my_appoi"
    "ntments.\n   - Everyday Egyptian idioms and casual fille"
    'r phrases (e.g. "علشان خاطري", "بالله عليك", "بقولك إيه'
    '", "يا باشا") are normal friendly Egyptian speech. When'
    ' someone says "علشان خاطري شوفلي دكتور باطنة" or "بالله'
    ' عليك احجزلي", THIS IS A VALID CLINIC INQUIRY: invoke t'
    "he tool and help them warmly!\n2. OUT-OF-DOMAIN TOPICS ("
    "REFUSE POLITELY):\n   - ONLY refuse if the user is askin"
    "g about non-clinic topics (such as computer programming"
    ", writing code/scripts, math equations, homework, recip"
    "es, or creative stories).\n   - If (and only if) the top"
    "ic is non-clinic, refuse politely in Egyptian Arabic:\n "
    '    "بعتذر لحضرتك، أنا مخصص فقط للمساعدة في خدمات وحجوز'
    "ات عيادات شفاء الطبية. أقدر أساعدك في حجز كشف أو الاستف"
    'سار عن دكاترتنا المتاحين؟"\n\nCLINIC SPECIALTIES:\n- Avail'
    "able departments: أمراض القلب (Cardiology), الأمراض الج"
    "لدية (Dermatology), طب الأطفال (Pediatrics), جراحة العظ"
    "ام (Orthopedics), الباطنة (Internal Medicine).\n- Unlist"
    "ed departments: We do NOT have Dentistry (طب أسنان), Op"
    "hthalmology (عيون), etc.\n\nOPERATIONAL RULES:\n1. ZERO IN"
    "TERNAL MEMORY: You have NO doctor records in memory. Wh"
    "en the patient asks about doctors, specialties, appoint"
    "ments, or clinic schedules, Use the appropriate live to"
    "ol; do not repeat doctor search when the user selected "
    "a doctor.\n2. If `fetch_doctors` returns doctors:\n   - P"
    "resent them warmly in 1-2 concise sentences in natural "
    "Egyptian Arabic (or English if the user wrote in Englis"
    "h).\n   - Invite the patient to choose a doctor from the"
    " cards.\n3. If `fetch_doctors` returns 0 doctors (e.g. f"
    "or unlisted departments like أسنان):\n   - Politely info"
    "rm the patient that this specialty is NOT available at "
    "Shiffaa Clinics.\n   - Mention our 5 available specialti"
    "es. NEVER invent doctors!\n4. MEDICAL SAFETY GUARDRAIL:\n"
    "   - You are an administrative assistant, NOT a physici"
    "an.\n   - NEVER diagnose illnesses, recommend drugs, or "
    "suggest dosages.\n   - For emergency symptoms, urge imme"
    "diate hospital ER care or calling 123.\n5. CONCISENESS &"
    " CLEANLINESS:\n   - Maximum 2 sentences. Never output co"
    "de blocks, raw JSON, or internal thinking tags.\n"
)


async def stream_chat_turn(
    catalog: Catalog,
    messages: list[dict[str, Any]],
    model: str,
    api_url: str,
    api_key: str,
    language: str = "ar",
    patient_api: AppointmentAPI | None = None,
    patient_context: dict[str, Any] | None = None,
    booking_actions: booking_tools.BookingTools | None = None,
) -> AsyncGenerator[str, None]:
    from datetime import datetime
    from zoneinfo import ZoneInfo

    tools = get_available_tools_schema()
    if patient_api:
        tools += patient_tools.schemas()
    if booking_actions:
        tools += booking_tools.schemas()
    instructions = (
        SYSTEM_PROMPT
        + "\nCurrent Cairo time: "
        + datetime.now(ZoneInfo("Africa/Cairo")).isoformat()
    )
    instructions += (
        "\nUse conversation history to resolve 'it', 'that appoin"
        "tment' and changes of mind. First look up my appointmen"
        "ts if needed, then call propose_cancellation or propose"
        "_reschedule within this same turn. Never loop back to d"
        "octor search when changing an existing appointment. Ask"
        " only for missing details. After proposing an action as"
        "k for confirmation and stop. On a later clear confirmat"
        "ion call confirm_pending_action. Never claim saved with"
        "out a saved=true tool result. Explain errors clearly. N"
        "ever offer to override a patient calendar conflict. A c"
        "onflict is non-overridable: explain the conflicting app"
        "ointment and offer another time or separately confirmed"
        " cancellation. For best time requests, first read my ap"
        "pointments and find doctors in the requested specialty."
        " Compare live recommend_best_slot results across suitab"
        "le doctors. Prefer visits immediately before or after a"
        "n existing appointment (zero waiting gap), never a dupl"
        "icate same-doctor same-day booking. Explain the nearby "
        "appointment and waiting gap, rather than calling the fi"
        "rst opening best. Reply in the language of the latest u"
        "ser message. When the user asks for recommendations or "
        "best times, show doctor options and suggestions only; d"
        "o not call propose_booking until the user selects a spe"
        "cific doctor/date/time or explicitly requests booking t"
        "hat selection. Avoid appending unrelated appointment ca"
        "rds. Always produce a short user-facing reply after too"
        "ls."
    )
    instructions += "\nVerified patient context: " + json.dumps(
        patient_context or {}, ensure_ascii=False
    )
    instructions += "\nPending action: " + json.dumps(
        booking_actions.state.get("selection") if booking_actions else None,
        ensure_ascii=False,
    )
    latest_text = messages[-1]["content"] if messages else ""
    response_language = (
        "Arabic"
        if any("\u0600" <= char <= "\u06ff" for char in latest_text)
        else "English"
    )
    instructions += f"\nWrite the response in {response_language}."
    history = [{"role": "system", "content": instructions}] + messages
    url = api_url.rstrip("/").removesuffix("/api-proxy") + "/v1/chat/completions"
    async with httpx.AsyncClient(timeout=30) as client:
        for step in range(6):
            calls: dict[int, dict[str, Any]] = {}
            text_parts = []
            try:
                async with client.stream(
                    "POST",
                    url,
                    headers={"Authorization": "Bearer " + api_key},
                    json={
                        "model": model,
                        "messages": history,
                        "tools": tools,
                        "stream": True,
                        "temperature": 0.2,
                        "max_tokens": 4096,
                    },
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data: ") or line == "data: [DONE]":
                            continue
                        chunk = json.loads(line[6:])
                        choices = chunk.get("choices") or []
                        if not choices:
                            continue
                        delta = choices[0].get("delta", {})
                        if delta.get("content"):
                            text_parts.append(delta["content"])
                        for part in delta.get("tool_calls") or []:
                            item = calls.setdefault(
                                part.get("index", 0),
                                {
                                    "id": "",
                                    "type": "function",
                                    "function": {"name": "", "arguments": ""},
                                },
                            )
                            if part.get("id"):
                                item["id"] = part["id"]
                            fn = part.get("function", {})
                            if fn.get("name"):
                                item["function"]["name"] += fn["name"]
                            item["function"]["arguments"] += fn.get("arguments", "")
            except (httpx.HTTPError, ValueError):
                yield format_sse(
                    "error", {"message": "The assistant request failed. Please retry."}
                )
                return
            if not calls:
                if text_parts:
                    for text in text_parts:
                        yield format_sse("token", {"text": text})
                    yield format_sse("done", {"status": "ok"})
                    return
                history.append(
                    {
                        "role": "user",
                        "content": (
                            "Please provide a concise user-facing response to the cu"
                            "rrent request using the tool results already returned. "
                            "Do not repeat completed lookups."
                        ),
                    }
                )
                continue
            history.append(
                {
                    "role": "assistant",
                    "content": "".join(text_parts) or None,
                    "tool_calls": list(calls.values()),
                }
            )
            proposed = False
            for call in calls.values():
                name = call["function"]["name"]
                widget = None
                yield format_sse(
                    "status",
                    {"tool": name, "message": "Checking live clinic information"},
                )
                try:
                    arguments = json.loads(call["function"]["arguments"] or "{}")
                    if name == "fetch_doctors":
                        result = await execute_fetch_doctors(
                            catalog,
                            arguments.get("specialty_name", ""),
                            language=language,
                        )
                        widget = result.get("ui_widget")
                    elif patient_api and name in patient_tools.INPUTS:
                        result = await patient_tools.execute(
                            patient_api, name, arguments
                        )
                        if name == "list_my_appointments":
                            widget = {
                                "type": "appointment_cards",
                                "appointments": result["appointments"],
                            }
                    elif booking_actions and name in {
                        "propose_booking",
                        "propose_reschedule",
                        "propose_cancellation",
                        "confirm_pending_action",
                    }:
                        result = await booking_actions.execute(name, arguments)
                        proposed = proposed or bool(result.get("requires_confirmation"))
                        if result.get("requires_confirmation"):
                            widget = {
                                "type": "action_proposal",
                                "selection": result["selection"],
                                "confirmation_id": result["confirmation_id"],
                            }
                        if result.get("saved"):
                            widget = {
                                "type": "appointment_success",
                                "operation": result.get("operation"),
                                "appointment": result["appointment"],
                            }
                    else:
                        result = {"success": False, "error": "TOOL_NOT_AVAILABLE"}
                except Exception:
                    result = {
                        "success": False,
                        "error": "TOOL_FAILED",
                        "guidance": "Explain the failure; do not claim success.",
                    }
                if widget:
                    yield format_sse("widget", widget)
                if name == "fetch_doctors" and patient_api:
                    try:
                        schedule = await patient_tools.execute(
                            patient_api, "list_my_appointments", {}
                        )
                        days = sorted({a["date"] for a in schedule["appointments"]})
                        target = (
                            days[0]
                            if days
                            else datetime.now(ZoneInfo("Africa/Cairo"))
                            .date()
                            .isoformat()
                        )
                        if arguments.get("date"):
                            target = (
                                datetime.strptime(arguments["date"], "%Y-%m-%d")
                                .date()
                                .isoformat()
                            )
                        for doctor in result.get("doctors", []):
                            ident = doctor["doctor_id"]
                            try:
                                suggestion = await patient_tools.execute(
                                    patient_api,
                                    "recommend_best_slot",
                                    {"doctor_id": ident, "from_date": target},
                                )
                                yield format_sse(
                                    "widget",
                                    {
                                        "type": "doctor_recommendations",
                                        "doctor_id": ident,
                                        "slots": suggestion["adjacent_slots"],
                                    },
                                )
                            except Exception:
                                yield format_sse(
                                    "widget",
                                    {
                                        "type": "doctor_recommendations",
                                        "doctor_id": ident,
                                        "slots": [],
                                        "unavailable": True,
                                    },
                                )
                    except Exception:
                        if arguments.get("date"):
                            target = (
                                datetime.strptime(arguments["date"], "%Y-%m-%d")
                                .date()
                                .isoformat()
                            )
                        for doctor in result.get("doctors", []):
                            yield format_sse(
                                "widget",
                                {
                                    "type": "doctor_recommendations",
                                    "doctor_id": doctor["doctor_id"],
                                    "slots": [],
                                    "unavailable": True,
                                },
                            )
                history.append(
                    {
                        "role": "tool",
                        "tool_call_id": call["id"],
                        "name": name,
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )
            if proposed:
                tools = [
                    tool
                    for tool in tools
                    if tool["function"]["name"] != "confirm_pending_action"
                ]
        yield format_sse(
            "error",
            {
                "message": (
                    "The request needs clarification. Please specify the app"
                    "ointment or desired time."
                )
            },
        )


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
