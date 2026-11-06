"""Uji unit untuk modul layanan dan endpoint segmentasi citra (Tahap 6)."""

import numpy as np
from starlette.testclient import TestClient

from app.layanan.operasi_segmentasi import segmentasi_kmeans, segmentasi_multi_otsu
from app.utama import aplikasi
from uji.test_operasi_tepi import buat_buffer_png, buat_citra_uji_kotak


def test_layanan_segmentasi_kmeans():
    """Memverifikasi segmentasi K-Means membatasi jumlah warna unik citra."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=False)
    hasil, k_res = segmentasi_kmeans(citra, k=2)

    assert hasil.shape == citra.shape
    assert k_res == 2
    # Jumlah warna unik pada hasil segmentasi tidak boleh melebihi k
    warna_unik = np.unique(hasil.reshape(-1, 3), axis=0)
    assert len(warna_unik) <= 2


def test_layanan_segmentasi_multi_otsu():
    """Memverifikasi segmentasi multi-otsu mengembalikan ambang dan citra tersegmentasi."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=False)
    hasil, ambang = segmentasi_multi_otsu(citra, kelas=3)

    assert hasil.shape == citra.shape
    assert len(ambang) >= 1


def test_endpoint_segmentasi_kmeans_dan_otsu():
    """Memverifikasi endpoint POST /api/v1/segmentasi untuk metode kmeans dan multi_otsu."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64)
    buffer_png = buat_buffer_png(citra)

    # Uji K-Means
    respons_km = client.post(
        "/api/v1/segmentasi",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"metode": "kmeans", "k": 3}'},
    )
    assert respons_km.status_code == 200
    assert respons_km.headers["X-Operasi"] == "segmentasi_kmeans"

    # Uji Multi-Otsu
    respons_otsu = client.post(
        "/api/v1/segmentasi",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"metode": "multi_otsu", "kelas": 3}'},
    )
    assert respons_otsu.status_code == 200
    assert respons_otsu.headers["X-Operasi"] == "segmentasi_multi_otsu"
