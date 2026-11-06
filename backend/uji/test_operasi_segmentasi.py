"""Uji unit untuk modul layanan dan endpoint segmentasi citra (Tahap 6)."""

import numpy as np
from starlette.testclient import TestClient

from app.layanan.operasi_segmentasi import segmentasi_kmeans, segmentasi_multi_otsu
from app.utama import aplikasi
from uji.test_operasi_tepi import buat_buffer_png, buat_citra_uji_kotak


def test_layanan_segmentasi_kmeans_tiga_warna_deterministik():
    """M6 d: Uji K-Means pada 3 warna datar murni (merah, hijau, biru) deterministik."""
    # Kanvas 60x60: 1/3 merah (255, 0, 0), 1/3 hijau (0, 255, 0), 1/3 biru (0, 0, 255)
    citra = np.zeros((60, 60, 3), dtype=np.uint8)
    citra[:20, :, :] = [255, 0, 0]
    citra[20:40, :, :] = [0, 255, 0]
    citra[40:, :, :] = [0, 0, 255]

    hasil1, k_res1 = segmentasi_kmeans(citra, k=3, iterasi=20)
    hasil2, k_res2 = segmentasi_kmeans(citra, k=3, iterasi=20)

    assert k_res1 == 3
    assert k_res2 == 3
    # Deterministik antar-eksekusi
    np.testing.assert_array_equal(hasil1, hasil2)

    # Verifikasi warna yang dihasilkan tepat 3 warna unik
    warna_unik = np.unique(hasil1.reshape(-1, 3), axis=0)
    assert len(warna_unik) == 3

    # Selisih dengan warna asli harus mendekati 0
    np.testing.assert_array_equal(hasil1, citra)


def test_layanan_segmentasi_multi_otsu_trimodal():
    """M6 d: Uji Multi-Otsu pada citra sintetis ber-histogram trimodal."""
    # Buat citra 3 intensitas abu-abu: 40 (gelap), 128 (sedang), 220 (terang)
    citra = np.zeros((90, 90, 3), dtype=np.uint8)
    citra[:30, :, :] = 40
    citra[30:60, :, :] = 128
    citra[60:, :, :] = 220

    hasil, ambang = segmentasi_multi_otsu(citra, kelas=3)
    assert hasil.shape == citra.shape
    # Menghasilkan 2 ambang batas pemisah untuk 3 kelas
    assert len(ambang) == 2
    # Ambang batas harus berada di antara intensitas: 40 < ambang[0] < 128 < ambang[1] < 220
    assert 40 < ambang[0] < 128
    assert 128 < ambang[1] < 220


def test_layanan_segmentasi_preservasi_alfa():
    """Memverifikasi saluran alfa dipertahankan pada hasil segmentasi."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=True)
    hasil, _ = segmentasi_kmeans(citra, k=2)

    assert hasil.shape == (64, 64, 4)
    np.testing.assert_array_equal(hasil[:, :, 3], citra[:, :, 3])


def test_endpoint_segmentasi_kmeans_dan_otsu():
    """Memverifikasi endpoint POST /api/v1/segmentasi untuk metode kmeans dan multi_otsu."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64)
    buffer_png = buat_buffer_png(citra)

    # Uji K-Means
    respons_km = client.post(
        "/api/v1/segmentasi",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"metode": "kmeans", "k": 3, "rasio": 1.0}'},
    )
    assert respons_km.status_code == 200
    assert respons_km.headers["X-Operasi"] == "segmentasi_kmeans"

    # Uji Multi-Otsu
    respons_otsu = client.post(
        "/api/v1/segmentasi",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"metode": "multi_otsu", "kelas": 3, "rasio": 1.0}'},
    )
    assert respons_otsu.status_code == 200
    assert respons_otsu.headers["X-Operasi"] == "segmentasi_multi_otsu"


def test_endpoint_segmentasi_penolakan_k_di_luar_rentang():
    """M6 d: Verifikasi penolakan k di luar rentang 2..8 mengembalikan HTTP 422."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64)
    buffer_png = buat_buffer_png(citra)

    # k = 1 (kurang dari batas minimum 2)
    resp_bawah = client.post(
        "/api/v1/segmentasi",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"metode": "kmeans", "k": 1}'},
    )
    assert resp_bawah.status_code == 422
    assert resp_bawah.json()["kode"] == "PARAMETER_TIDAK_VALID"

    # k = 9 (melebihi batas maksimum 8)
    resp_atas = client.post(
        "/api/v1/segmentasi",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"metode": "kmeans", "k": 9}'},
    )
    assert resp_atas.status_code == 422
    assert resp_atas.json()["kode"] == "PARAMETER_TIDAK_VALID"
