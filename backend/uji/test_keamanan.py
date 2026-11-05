"""Pengujian keamanan API backend PicLab Sevenz (spec.md bagian 10 & Tahap 5).

Mencakup security headers, rate limiting, pembatasan konkurensi (semaphore),
CORS ketat, dan format galat standar tanpa kebocoran informasi internal.
"""

import asyncio
import io

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from PIL import Image

from app.inti.galat import KodeGalat
from app.inti.keamanan import pembatas_konkurensi, pembatas_laju_global
from app.inti.konfigurasi import konfigurasi
from app.utama import aplikasi

klien = TestClient(aplikasi)


def buat_citra_kecil_png() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (5, 5), (200, 100, 50))
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(autouse=True)
def bersihkan_state_keamanan():
    """Mereset rate limiter sebelum dan sesudah setiap pengujian."""
    pembatas_laju_global.reset_sinkron()
    yield
    pembatas_laju_global.reset_sinkron()


def test_header_keamanan_pada_seluruh_respons():
    """Memverifikasi kehadiran security headers standar OWASP pada respons."""
    respons = klien.get("/kesehatan")
    assert respons.status_code == status.HTTP_200_OK

    headers = respons.headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert headers["x-frame-options"] == "DENY"
    assert "default-src 'none'" in headers["content-security-policy"]
    assert "camera=()" in headers["permissions-policy"]
    assert "server" not in headers  # Tidak membocorkan identitas teknologi


def test_header_cache_control_ketat_pada_endpoint_citra():
    """Memverifikasi bahwa respons yang melibatkan data citra pengguna tidak disimpan di cache."""
    citra = buat_citra_kecil_png()
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("uji.png", citra, "image/png")},
    )
    assert respons.status_code == status.HTTP_200_OK
    assert "no-store" in respons.headers["cache-control"]


def test_pembatasan_laju_rate_limiting():
    """Memverifikasi bahwa permintaan melebihi batas (60/menit) mendapat respons 429 dan Retry-After."""
    citra = buat_citra_kecil_png()

    # Kirim sejumlah permintaan hingga mencapai batas
    for _ in range(konfigurasi.BATAS_LAJU_PER_MENIT):
        res = klien.post(
            "/api/uji/gema",
            files={"gambar": ("uji.png", citra, "image/png")},
        )
        assert res.status_code == status.HTTP_200_OK

    # Permintaan berikutnya harus ditolak dengan 429
    res_ditolak = klien.post(
        "/api/uji/gema",
        files={"gambar": ("uji.png", citra, "image/png")},
    )
    assert res_ditolak.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    data = res_ditolak.json()
    assert data["kode"] == KodeGalat.TERLALU_BANYAK_PERMINTAAN
    assert "Retry-After" in res_ditolak.headers


def test_cors_ketat_menolak_origin_tak_dikenal():
    """Memverifikasi bahwa origin yang tidak terdaftar tidak menerima header Access-Control-Allow-Origin."""
    citra = buat_citra_kecil_png()
    respons = klien.post(
        "/api/uji/gema",
        headers={"Origin": "https://situs-jahat-penyerang.com"},
        files={"gambar": ("uji.png", citra, "image/png")},
    )
    # Status tetap sukses atau preflight, tetapi header allow-origin tidak boleh mengizinkan situs asing
    allow_origin = respons.headers.get("access-control-allow-origin")
    assert allow_origin != "https://situs-jahat-penyerang.com"
    assert allow_origin != "*"


def test_format_galat_standar_rute_404():
    """Memverifikasi bahwa galat 404 berformat baku { kode, pesan } tanpa detail internal."""
    respons = klien.get("/rute-yang-pasti-tidak-ada-di-server")
    assert respons.status_code == status.HTTP_404_NOT_FOUND
    data = respons.json()
    assert data["kode"] == KodeGalat.RUTE_TIDAK_DITEMUKAN
    assert "pesan" in data


def test_format_galat_standar_metode_405():
    """Memverifikasi bahwa galat 405 Method Not Allowed berformat baku { kode, pesan }."""
    respons = klien.delete("/kesehatan")
    assert respons.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
    data = respons.json()
    assert data["kode"] == KodeGalat.METODE_TIDAK_DIIZINKAN
    assert "pesan" in data


def test_pembatasan_konkurensi_semaphore_server_sibuk():
    """Memverifikasi bahwa ketika semaphore terkunci (semua slot terisi), permintaan baru mendapat 503 SERVER_SIBUK."""
    citra = buat_citra_kecil_png()

    # Simulasikan semaphore penuh secara artifisial
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    acquired = []
    for _ in range(konfigurasi.BATAS_PERMINTAAN_SERENTAK):
        loop.run_until_complete(pembatas_konkurensi.acquire())
        acquired.append(True)

    try:
        # Permintaan baru saat semaphore penuh
        res = klien.post(
            "/api/uji/gema",
            files={"gambar": ("uji.png", citra, "image/png")},
        )
        assert res.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        data = res.json()
        assert data["kode"] == KodeGalat.SERVER_SIBUK
    finally:
        # Lepaskan semaphore kembali
        for _ in acquired:
            pembatas_konkurensi.release()
