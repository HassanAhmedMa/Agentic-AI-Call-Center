(
    "AI Agent Tools definition and execution layer.\n\nFollows"
    " the zero-direct-DB rule: tools query backend domain st"
    "ores deterministically.\n"
)

from __future__ import annotations

import logging
from typing import Any

from clinic_schemas import catalog as dto

from clinic_backend.catalog import Catalog

logger = logging.getLogger("clinic_backend.ai_agent.tools")

FETCH_DOCTORS_TOOL = {
    "type": "function",
    "function": {
        "name": "fetch_doctors",
        "description": (
            "Fetch available clinic doctors and their working shifts"
            " by medical specialty or doctor name."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "specialty_name": {
                    "type": "string",
                    "description": (
                        "Medical specialty or query in Arabic or English, e.g. '"
                        "القلب', 'Cardiology', 'جلدية', 'باطنة', 'أطفال', 'Dr. S"
                        "arah'."
                    ),
                },
                "date": {
                    "type": "string",
                    "format": "date",
                    "description": "Requested visit date as YYYY-MM-DD, if specified.",
                },
                "language": {
                    "type": "string",
                    "enum": ["ar", "en"],
                    "description": "Language of the patient (default: 'ar').",
                },
            },
            "required": ["specialty_name"],
            "additionalProperties": False,
        },
    },
}


def get_available_tools_schema() -> list[dict[str, Any]]:
    """Return JSON schemas for tools offered to the LLM."""
    return [FETCH_DOCTORS_TOOL]


DAYS_AR = {
    "saturday": "السبت",
    "sunday": "الأحد",
    "monday": "الإثنين",
    "tuesday": "الثلاثاء",
    "wednesday": "الأربعاء",
    "thursday": "الخميس",
    "friday": "الجمعة",
}


async def execute_fetch_doctors(
    catalog: Catalog,
    specialty_name: str,
    language: str = "ar",
) -> dict[str, Any]:
    """Execute the fetch_doctors tool against the clinic catalog."""
    term = (specialty_name or "").strip()
    logger.info("Executing fetch_doctors with query: '%s' (lang: %s)", term, language)

    # Query catalog store
    query = dto.DoctorQuery(q=term, limit=6)
    result = await catalog.doctors(query)

    doctors_for_llm = []
    doctors_for_widget = []

    for d in result.doctors:
        doc_name = d.name_ar if language == "ar" else d.name_en
        doc_title = d.title_ar if language == "ar" else d.title_en
        doc_spec = d.specialty.name_ar if language == "ar" else d.specialty.name_en
        fee_str = (
            f"{d.consultation_fee.amount:.0f} {'جنيه' if language == 'ar' else 'EGP'}"
        )

        days_formatted = (
            ", ".join(DAYS_AR.get(day.lower(), day) for day in (d.working_days or []))
            if language == "ar"
            else ", ".join(d.working_days or [])
        )
        shifts_formatted = f"{d.shift_start} - {d.shift_end}"

        doctors_for_llm.append(
            {
                "doctor_id": d.id,
                "name": doc_name,
                "title": doc_title,
                "specialty": doc_spec,
                "fee": fee_str,
                "working_days": days_formatted,
                "shift_hours": shifts_formatted,
            }
        )

        doctors_for_widget.append(
            {
                "id": d.id,
                "name": doc_name,
                "title": doc_title,
                "specialty": doc_spec,
                "fee": fee_str,
                "working_days": d.working_days,
                "shift_start": d.shift_start,
                "shift_end": d.shift_end,
                "languages": d.languages,
            }
        )

    # Prepare return payload
    has_results = len(doctors_for_llm) > 0
    return {
        "success": True,
        "count": len(doctors_for_llm),
        "query": term,
        "doctors": doctors_for_llm,
        "ui_widget": (
            {
                "type": "doctor_cards",
                "specialty": term,
                "count": len(doctors_for_widget),
                "doctors": doctors_for_widget,
            }
            if has_results
            else None
        ),
    }
