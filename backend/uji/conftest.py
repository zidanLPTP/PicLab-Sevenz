"""Konfigurasi fixture pengujian Pytest backend PicLab Sevenz."""

import pytest

from app.inti.keamanan import pembatas_laju_global


@pytest.fixture(autouse=True)
def reset_rate_limiter_setiap_uji(request):
    """Mereset rate limiter sebelum dan setelah tiap uji kecuali uji rate limiting itu sendiri."""
    if "test_pembatasan_laju" not in request.node.name:
        pembatas_laju_global.reset_sinkron()
    yield
    if "test_pembatasan_laju" not in request.node.name:
        pembatas_laju_global.reset_sinkron()
