"""Checks that model output only uses facts found in what the user gave us.

The product promise is "never invent facts". The model is told the same thing, but these checks are
what enforce it: anything that cannot be traced back to the source is removed or rejected.
"""

from __future__ import annotations

import re

_NON_WORD = re.compile(r"[^0-9a-z]+")
_NUMBER = re.compile(r"\d+(?:[.,]\d+)*")
_PLACEHOLDER = re.compile(r"\[[^\]]{0,200}\]")
_YEAR = re.compile(r"(19|20)\d\d")
# Words that may start with a capital without being a new name.
_COMMON_CAPS = {
    "i", "dear", "yours", "sincerely", "faithfully", "regards", "thank", "thanks", "kind", "best",
    "the", "a", "an", "in", "as", "at", "my", "with", "for", "and", "this", "these", "during",
    "while", "since", "led", "managed", "built", "designed", "delivered", "developed", "improved",
    "created", "reduced", "increased", "coordinated", "supported", "trained", "wrote", "prepared",
}


def norm(text: str) -> str:
    """Lowercase and keep only letters and digits, single-spaced."""
    return _NON_WORD.sub(" ", text.lower()).strip()


def tokens(text: str) -> list[str]:
    return [t for t in norm(text).split(" ") if t]


class Source:
    """The text an answer must be grounded in, prepared once."""

    def __init__(self, *texts: str) -> None:
        joined = "\n".join(t for t in texts if t)
        self.normalized = f" {norm(joined)} "
        self.words = set(tokens(joined))
        self.numbers = {n.replace(",", "") for n in _NUMBER.findall(joined)}

    def contains(self, value: str) -> bool:
        """True when the value appears in the source as a run of whole words."""
        v = norm(value)
        return not v or f" {v} " in self.normalized

    def coverage(self, text: str) -> float:
        """Share of the text's words that also appear in the source (1.0 for empty text)."""
        ws = tokens(text)
        if not ws:
            return 1.0
        return sum(1 for w in ws if w in self.words) / len(ws)

    def new_numbers(self, text: str) -> list[str]:
        """Numbers in `text` (outside [placeholders]) that do not appear in the source."""
        visible = _PLACEHOLDER.sub(" ", text)
        found = {n.replace(",", "") for n in _NUMBER.findall(visible)}
        return sorted(n for n in found if n not in self.numbers)

    def new_names(self, text: str) -> list[str]:
        """Capitalised words mid-sentence that the source never mentions: likely invented names."""
        visible = _PLACEHOLDER.sub(" ", text)
        out: list[str] = []
        for sentence in re.split(r"(?<=[.!?:])\s+|\n+", visible):
            words = re.findall(r"[A-Za-z][A-Za-z'&-]*", sentence)
            for w in words[1:]:
                low = w.lower().strip("'")
                if w[0].isupper() and low not in _COMMON_CAPS and low not in self.words:
                    out.append(w)
        return sorted(set(out))

    def date_ok(self, value: str) -> bool:
        """A date like 2019 or 2019-03 is grounded when its year appears in the source."""
        if not value:
            return True
        m = _YEAR.search(value)
        return bool(m) and m.group(0) in self.numbers


def clean_date(value: str) -> str:
    """Keep dates in the app's format: YYYY or YYYY-MM (anything else becomes empty)."""
    value = value.strip()
    if re.fullmatch(r"(19|20)\d\d(-(0[1-9]|1[0-2]))?", value):
        return value
    return ""
