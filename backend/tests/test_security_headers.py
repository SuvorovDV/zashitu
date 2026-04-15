"""Security-headers middleware выставляет базовый набор."""
import pytest


@pytest.mark.asyncio
async def test_core_security_headers_present(client):
    r = await client.get("/health")
    assert r.status_code == 200
    # Эти заголовки должны быть всегда (и в dev).
    assert r.headers.get("X-Content-Type-Options") == "nosniff"
    assert r.headers.get("X-Frame-Options") == "DENY"
    assert r.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "Permissions-Policy" in r.headers
