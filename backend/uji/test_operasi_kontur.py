"""Uji unit untuk modul layanan dan endpoint deteksi kontur (Tahap 6)."""

import numpy as np
from starlette.testclient import TestClient

from app.layanan.operasi_kontur import cari_dan_gambar_kontur, konversi_warna_hex
from app.utama import aplikasi
from uji.test_operasi_tepi import buat_buffer_png, buat_citra_uji_kotak


def test_konversi_warna_hex():
    """Memverifikasi pemetaan kode warna hex ke tuple integer RGB."""
    assert konversi_warna_hex("#ff0000") == (255, 0, 0)
    assert konversi_warna_hex("#00ff00") == (0, 255, 0)
    assert konversi_warna_hex("#0000ff") == (0, 0, 255)
    # Fallback saat format tidak valid
    assert konversi_warna_hex("tidak_valid") == (0, 255, 0)


def test_layanan_kontur_dasar():
    """Memverifikasi deteksi kontur objek pada gambar biner kotak."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=False)
    hasil, jumlah = cari_dan_gambar_kontur(
        citra, metode="biner", ambang=128, mode_retrieval="tree", luas_minimum=5
    )

    assert hasil.shape == citra.shape
    assert jumlah >= 1


def test_layanan_kontur_preservasi_alfa():
    """Memverifikasi saluran alfa tetap terjaga pada citra hasil kontur."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=True)
    hasil, jumlah = cari_dan_gambar_kontur(citra, tampilan="latar_hitam")

    assert hasil.shape == (64, 64, 4)
    assert jumlah >= 1
    np.testing.assert_array_equal(hasil[:, :, 3], citra[:, :, 3])


def test_endpoint_kontur_sukses():
    """Memverifikasi pemanggilan endpoint POST /api/v1/kontur."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64)
    buffer_png = buat_buffer_png(citra)

    respons = client.post(
        "/api/v1/kontur",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={
            "parameter": '{"metode": "otsu", "tampilan": "overlay", "warna_garis": "#ff0000"}'
        },
    )

    assert respons.status_code == 200
    assert respons.headers["Content-Type"] == "image/png"
    assert respons.headers["X-Operasi"] == "deteksi_kontur"
    assert "X-Info-Operasi" in respons.headers
