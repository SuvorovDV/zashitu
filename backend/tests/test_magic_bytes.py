"""Тест что file-upload проверяет magic bytes, а не только Content-Type."""
import io
import pytest

from files.validators import detect_file_type


def test_detect_pdf_by_magic():
    assert detect_file_type(b"%PDF-1.4\n", "application/pdf") == "pdf"


def test_detect_docx_by_magic():
    assert detect_file_type(b"PK\x03\x04\x14\x00", "application/vnd.openxmlformats-officedocument.wordprocessingml.document") == "docx"


def test_reject_fake_pdf_by_content():
    # Content-Type говорит PDF, но содержимое — не PDF.
    assert detect_file_type(b"not a pdf", "application/pdf") is None


def test_reject_fake_docx_by_content():
    assert detect_file_type(b"not a zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document") is None


def test_unknown_mime():
    assert detect_file_type(b"%PDF-", "text/plain") is None


@pytest.mark.asyncio
async def test_upload_rejects_fake_mime(auth_client):
    """End-to-end: если файл с Content-Type=application/pdf, но без magic-заголовка, → 400."""
    # Создаём заказ, получаем id.
    r = await auth_client.post("/orders/", json={"topic": "test"})
    assert r.status_code == 201
    order_id = r.json()["id"]

    fake = io.BytesIO(b"this is not a pdf")
    r = await auth_client.post(
        f"/files/upload/{order_id}",
        files={"file": ("evil.pdf", fake, "application/pdf")},
    )
    assert r.status_code == 400
    assert "content" in r.json()["detail"].lower() or "match" in r.json()["detail"].lower()
