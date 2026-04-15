"""Валидация загружаемых файлов по magic bytes, а не только по Content-Type."""
from typing import Optional


# Сигнатуры форматов.
# PDF: '%PDF-' в начале файла.
# DOCX (любой OOXML): 'PK\x03\x04' (ZIP), но нужно различить от обычного ZIP —
# по наличию 'word/' внутри при желании. Для базовой проверки достаточно PK.
_PDF_MAGIC = b"%PDF-"
_ZIP_MAGIC = b"PK\x03\x04"


def detect_file_type(head: bytes, declared_mime: str) -> Optional[str]:
    """
    Возвращает 'pdf'|'docx' если заголовок соответствует,
    или None если контент не совпадает с ожидаемым форматом.
    head — первые ~8 байт файла.
    """
    if declared_mime == "application/pdf":
        return "pdf" if head.startswith(_PDF_MAGIC) else None

    if declared_mime in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        # DOCX — это ZIP-архив. Быстрая проверка: PK\x03\x04 в начале.
        return "docx" if head.startswith(_ZIP_MAGIC) else None

    return None
