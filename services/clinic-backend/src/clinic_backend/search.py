"""Shared normalization for catalog indexing and user queries."""

import unicodedata

from sqlalchemy import SQLColumnExpression, func, literal_column
from sqlalchemy.sql.elements import ColumnElement

_SOURCE = "أإآٱىة٠١٢٣٤٥٦٧٨٩"
_TARGET = "اااايه0123456789"
_ARABIC_VARIANTS = str.maketrans(_SOURCE, _TARGET)
# Shared Unicode mark set: used by Python and the PostgreSQL expression below.
_MARKS = "".join(
    chr(i) for i in range(0x110000) if unicodedata.category(chr(i)) == "Mn"
)
_REMOVALS = frozenset(_MARKS + "ـ")


def normalize_search(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).translate(_ARABIC_VARIANTS)
    text = "".join(char for char in text if char not in _REMOVALS)
    return " ".join(text.lower().split())


def normalized_sql(column: SQLColumnExpression[str]) -> ColumnElement[str]:
    """Same normalization rules for names stored in existing contract columns."""
    normalized = func.normalize(column, literal_column("NFKC"))
    translated = func.translate(normalized, _SOURCE, _TARGET)
    stripped = func.regexp_replace(translated, "[" + _MARKS + "ـ]", "", "g")
    return func.trim(func.regexp_replace(func.lower(stripped), r"\s+", " ", "g"))
