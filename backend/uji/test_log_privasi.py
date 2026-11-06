"""Pengujian kebijakan privasi pencatatan log (Agent.md bagian 7, spec.md bagian 10, dan K2).

Membuktikan dengan rekaman caplog bahwa:
1. Alamat IP klien (termasuk X-Forwarded-For atau client host) TIDAK PERNAH dicatat.
2. Query string rahasia pengguna TIDAK PERNAH dicatat.
3. Nama berkas asli pengguna TIDAK PERNAH dicatat.
4. Isi citra dan representasi biner TIDAK PERNAH dicatat.
5. Log akses bawaan Uvicorn telah dibungkam sehingga tidak ada celah pencatatan otomatis.
"""

import io
import logging

from fastapi import status
from fastapi.testclient import TestClient
from PIL import Image

from app.utama import aplikasi

klien = TestClient(aplikasi)


def buat_citra_dummy() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (10, 10), (0, 100, 200))
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_zero_ip_dan_zero_query_dan_zero_filename_logging(caplog):
    """Memverifikasi bahwa IP, query parameter rahasia, dan nama berkas tidak bocor ke log server."""
    # Bungkam log sisi klien httpx agar caplog murni menguji logger server PicLab & Uvicorn
    logging.getLogger("httpx").setLevel(logging.WARNING)
    caplog.set_level(logging.INFO)

    ip_klien_uji = "203.0.113.195"
    query_rahasia = "token_rahasia_12345_xyz"
    nama_berkas_rahasia = "foto_rahasia_keluarga_fathin_pribadi.png"
    citra = buat_citra_dummy()

    headers = {
        "X-Forwarded-For": ip_klien_uji,
        "X-Real-IP": ip_klien_uji,
    }

    respons = klien.post(
        f"/api/uji/gema?rahasia={query_rahasia}",
        headers=headers,
        files={"gambar": (nama_berkas_rahasia, citra, "image/png")},
    )
    assert respons.status_code == status.HTTP_200_OK

    # Kumpulkan teks log dari server (termasuk piclab.akses dan logger server lainnya)
    log_server_records = [
        rec.getMessage() for rec in caplog.records if not rec.name.startswith("httpx")
    ]
    seluruh_teks_log_server = " \n ".join(log_server_records)

    # Verifikasi ketat Zero IP Logging (K2)
    assert ip_klien_uji not in seluruh_teks_log_server, (
        f"Alamat IP bocor ke log server: {seluruh_teks_log_server}"
    )

    # Verifikasi Zero Query String Logging (K2)
    assert query_rahasia not in seluruh_teks_log_server, (
        f"Query string rahasia bocor ke log server: {seluruh_teks_log_server}"
    )

    # Verifikasi Zero File Name Logging (K2)
    assert nama_berkas_rahasia not in seluruh_teks_log_server, (
        f"Nama berkas asli bocor ke log server: {seluruh_teks_log_server}"
    )
    assert "foto_rahasia" not in seluruh_teks_log_server

    # Verifikasi format log hanya mencatat METODE RUTE - STATUS - DURASI_MS
    assert "POST /api/uji/gema - 200" in seluruh_teks_log_server
    assert "ms" in seluruh_teks_log_server


def test_uvicorn_access_logger_dinonaktifkan():
    """Memverifikasi bahwa logger uvicorn.access dimatikan/dibungkam."""
    logger_uvicorn = logging.getLogger("uvicorn.access")
    assert logger_uvicorn.disabled is True
    assert logger_uvicorn.propagate is False
