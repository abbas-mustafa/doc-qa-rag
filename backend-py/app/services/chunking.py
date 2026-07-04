"""Dynamic, structure-aware chunking.

Different element types are chunked differently:
  - table / figure : kept intact (splitting a table destroys its meaning); only
    very large tables are split on row boundaries.
  - text / ocr_text: split respecting heading -> paragraph -> sentence -> word
    boundaries, with a target size chosen dynamically from the text's shape
    (list-like vs dense prose) and overlap carried between chunks for continuity.

Sizes are measured in characters (~4 chars/token) to avoid a network tokenizer call
per chunk; the target maps to roughly 300-600 tokens.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from .parsing import Element

# Character-based bounds (~4 chars/token).
_BASE_TARGET = 1800
_MIN_TARGET = 1000
_MAX_TARGET = 2600
_HARD_MAX = 4200            # never emit a chunk larger than this
_OVERLAP_RATIO = 0.12
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")
_PARAGRAPH_RE = re.compile(r"\n\s*\n")


@dataclass
class Chunk:
    text: str
    page_number: int | None
    element_type: str
    chunk_index: int


def _dynamic_target(text: str) -> tuple[int, int]:
    """Choose (target, overlap) from the text's structure.

    List-like / sparse text (short lines) -> smaller chunks so unrelated items
    don't bleed together. Dense prose (long paragraphs) -> larger chunks to keep
    arguments whole.
    """
    paragraphs = [p for p in _PARAGRAPH_RE.split(text) if p.strip()]
    if not paragraphs:
        return _BASE_TARGET, int(_BASE_TARGET * _OVERLAP_RATIO)
    avg_len = sum(len(p) for p in paragraphs) / len(paragraphs)

    if avg_len < 120:
        target = _MIN_TARGET
    elif avg_len > 500:
        target = _MAX_TARGET
    else:
        target = _BASE_TARGET
    return target, int(target * _OVERLAP_RATIO)


def _hard_slice(text: str, target: int) -> list[str]:
    return [text[i : i + target] for i in range(0, len(text), target)]


def _atomic_segments(text: str, target: int) -> list[str]:
    """Break text into pieces no larger than target, splitting only at natural
    boundaries (paragraph -> sentence -> word -> hard slice)."""
    segments: list[str] = []
    for para in _PARAGRAPH_RE.split(text):
        para = para.strip()
        if not para:
            continue
        if len(para) <= target:
            segments.append(para)
            continue

        buf = ""
        for sentence in _SENTENCE_RE.split(para):
            sentence = sentence.strip()
            if not sentence:
                continue
            if len(sentence) > target:
                if buf:
                    segments.append(buf)
                    buf = ""
                # sentence longer than target: split on words, then hard slice
                word_buf = ""
                for word in sentence.split():
                    if len(word) > target:
                        if word_buf:
                            segments.append(word_buf)
                            word_buf = ""
                        segments.extend(_hard_slice(word, target))
                    elif len(word_buf) + len(word) + 1 <= target:
                        word_buf = f"{word_buf} {word}".strip()
                    else:
                        segments.append(word_buf)
                        word_buf = word
                if word_buf:
                    segments.append(word_buf)
            elif len(buf) + len(sentence) + 1 <= target:
                buf = f"{buf} {sentence}".strip()
            else:
                segments.append(buf)
                buf = sentence
        if buf:
            segments.append(buf)
    return segments


def _pack(segments: list[str], target: int, overlap: int) -> list[str]:
    """Greedily pack segments up to target, carrying an overlap tail for continuity."""
    chunks: list[str] = []
    current = ""
    for seg in segments:
        if current and len(current) + len(seg) + 1 > target:
            chunks.append(current)
            tail = current[-overlap:] if overlap else ""
            current = f"{tail} {seg}".strip() if tail else seg
        else:
            current = f"{current}\n{seg}".strip() if current else seg
    if current:
        chunks.append(current)
    return chunks


def _split_text(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    target, overlap = _dynamic_target(text)
    if len(text) <= target:
        return [text]
    segments = _atomic_segments(text, target)
    return _pack(segments, target, overlap)


def _split_table(md: str) -> list[str]:
    """Split an oversized markdown table on row boundaries, repeating the header."""
    lines = md.splitlines()
    if len(lines) < 2:
        return _hard_slice(md, _HARD_MAX)
    header = lines[:2]  # header row + separator
    body = lines[2:]
    chunks: list[str] = []
    current = list(header)
    size = sum(len(x) for x in header)
    for row in body:
        if size + len(row) > _HARD_MAX and len(current) > 2:
            chunks.append("\n".join(current))
            current = list(header)
            size = sum(len(x) for x in header)
        current.append(row)
        size += len(row)
    if len(current) > 2:
        chunks.append("\n".join(current))
    return chunks


def chunk_elements(elements: list[Element]) -> list[Chunk]:
    chunks: list[Chunk] = []
    index = 0
    for el in elements:
        if el.element_type in ("table", "figure"):
            pieces = [el.text] if len(el.text) <= _HARD_MAX else (
                _split_table(el.text) if el.element_type == "table" else _hard_slice(el.text, _HARD_MAX)
            )
        else:
            pieces = _split_text(el.text)

        for piece in pieces:
            piece = piece.strip()
            if not piece:
                continue
            chunks.append(
                Chunk(
                    text=piece,
                    page_number=el.page_number,
                    element_type=el.element_type,
                    chunk_index=index,
                )
            )
            index += 1
    return chunks
