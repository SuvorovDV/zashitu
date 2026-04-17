import logging
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import User, OrderStatus
from auth.dependencies import get_current_user
from orders import service as orders_service
from files import service as files_service
from files.validators import detect_file_type

router = APIRouter(prefix="/files", tags=["files"])
log = logging.getLogger("zashitu.files")

ALLOWED_MIME_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "docx",
}
MAX_FILE_SIZE = settings.max_file_size_bytes


@router.post("/upload/{order_id}")
async def upload_file(
    order_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await orders_service.get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and DOCX files are allowed",
        )

    file_data = await file.read()
    if len(file_data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large (max {settings.MAX_FILE_SIZE_MB} MB)",
        )

    # Проверка magic bytes — Content-Type можно подделать.
    detected = detect_file_type(file_data[:8], content_type)
    if detected is None:
        log.warning(
            "file magic mismatch",
            extra={"event": "upload_bad_magic", "order_id": order_id},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content does not match declared type",
        )

    file_type = detected
    stored_filename = f"{uuid.uuid4()}.{file_type}"

    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    dest_path = os.path.join(settings.UPLOAD_DIR, stored_filename)

    # Удалить старый файл с диска если есть (без race на concurrent upload)
    existing = await files_service.get_file_by_order(db, order_id)
    if existing:
        old_path = Path(settings.UPLOAD_DIR) / existing.stored_filename
        try:
            old_path.unlink(missing_ok=True)
        except OSError as e:
            log.warning(f"failed to remove old file {old_path}: {e}")

    with open(dest_path, "wb") as f:
        f.write(file_data)

    record = await files_service.save_file_record(
        db=db,
        order_id=order_id,
        original_filename=file.filename or stored_filename,
        stored_filename=stored_filename,
        file_type=file_type,
        file_size=len(file_data),
    )

    return {
        "filename": record.original_filename,
        "size": record.file_size,
        "type": record.file_type,
    }


@router.get("/preview/{order_id}/{index}")
async def download_preview(
    order_id: str,
    index: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """PNG-превью слайда N (1-индексация, как у pdftoppm). Только владельцу заказа."""
    order = await orders_service.get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if not order.output_filename or index < 1 or index > (order.preview_count or 0):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview not found")

    stem = Path(order.output_filename).stem
    # pdftoppm создаёт `{stem}-01.png`, `{stem}-02.png`, ... с паддингом до ширины
    # максимального индекса. Перебираем возможные ширины.
    out_dir = Path(settings.OUTPUT_DIR)
    candidate = None
    for width in (1, 2, 3, 4):
        p = out_dir / f"{stem}-{index:0{width}d}.png"
        if p.exists():
            candidate = p
            break
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview file not found on disk")

    try:
        return FileResponse(path=str(candidate), media_type="image/png")
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview file not found on disk")


@router.get("/download/{order_id}")
async def download_file(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await orders_service.get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Для approval-флоу слайды можно качать только после финального approve.
    # Без speech — слайды авто-апрувятся сразу (slides_approved=True).
    if order.include_speech and not order.slides_approved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slides not yet approved")

    if order.status != "done" and not order.output_filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Presentation not ready")

    if not order.output_filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Output file not found")

    file_path = os.path.join(settings.OUTPUT_DIR, order.output_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    safe_topic = "".join(c for c in (order.topic or "presentation")[:30] if c.isalnum() or c in " _-").strip()
    if not safe_topic:
        safe_topic = "presentation"
    download_name = f"Tezis_{safe_topic}.pptx"

    try:
        return FileResponse(
            path=file_path,
            filename=download_name,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")


@router.get("/download-speech/{order_id}")
async def download_speech(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Текст выступления в Markdown с маркерами границ слайдов.

    Маркеры («=== Слайд N: title ===») вставляются на лету через Claude —
    используя titles из plan.slides. Если plan нет или Claude-запрос упал,
    отдаём речь без разметки.
    """
    import json as _json
    from fastapi.responses import Response

    from generation.tasks import mark_speech_with_slide_boundaries

    order = await orders_service.get_order(db, order_id, current_user.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if not order.include_speech or not order.speech_text:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Speech text not available for this order",
        )

    # Достаём titles слайдов из generation_prompt (сохраняется при сборке .pptx).
    slide_titles: list[str] = []
    if order.generation_prompt:
        try:
            prompt_data = _json.loads(order.generation_prompt)
            plan = prompt_data.get("slide_plan") or {}
            slide_titles = [
                s.get("title") for s in (plan.get("slides") or []) if s.get("title")
            ]
        except Exception as e:
            log.warning(f"download_speech: failed to parse generation_prompt: {e}")

    content = mark_speech_with_slide_boundaries(order.speech_text, slide_titles)

    safe_topic = "".join(c for c in (order.topic or "speech")[:30] if c.isalnum() or c in " _-").strip()
    if not safe_topic:
        safe_topic = "speech"
    download_name = f"Tezis_{safe_topic}_speech.md"
    return Response(
        content=content.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
    )
