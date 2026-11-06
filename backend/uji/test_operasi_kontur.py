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


def test_layanan_kontur_dua_persegi_terpisah():
    """M6 b: Verifikasi 2 persegi panjang terpisah yang ukurannya diketahui persis."""
    # Kanvas 100x100 hitam
    citra = np.zeros((100, 100, 3), dtype=np.uint8)
    # Persegi A: 10x10 dari (10, 10) sampai (20, 20) -> luas kontur diskret ~81-100
    citra[10:20, 10:20] = 255
    # Persegi B: 20x20 dari (50, 50) sampai (70, 70) -> luas kontur diskret ~361-400
    citra[50:70, 50:70] = 255

    # Tanpa filter luas minimum
    _, jumlah_semua = cari_dan_gambar_kontur(
        citra, metode="biner", ambang=128, mode_retrieval="external", luas_minimum=5
    )
    assert jumlah_semua == 2

    # Dengan luas minimum 150 (hanya persegi B 20x20 yang lolos)
    _, jumlah_tersaring = cari_dan_gambar_kontur(
        citra, metode="biner", ambang=128, mode_retrieval="external", luas_minimum=150
    )
    assert jumlah_tersaring == 1


def test_layanan_kontur_mode_external_vs_tree():
    """M6 b: Verifikasi perbedaan mode retrieval: kotak berlubang/konsentris."""
    # Kanvas 80x80 hitam
    citra = np.zeros((80, 80, 3), dtype=np.uint8)
    # Kotak luar putih (lebar 50, tinggi 50) dari (15, 15) sampai (65, 65)
    citra[15:65, 15:65] = 255
    # Lubang dalam hitam (lebar 20, tinggi 20) dari (30, 30) sampai (50, 50)
    citra[30:50, 30:50] = 0

    # Mode external hanya mengambil batas terluar (1 kontur)
    _, jml_ext = cari_dan_gambar_kontur(
        citra, metode="biner", ambang=128, mode_retrieval="external", luas_minimum=5
    )
    assert jml_ext == 1

    # Mode tree mengambil kontur luar dan kontur lubang dalam (2 kontur)
    _, jml_tree = cari_dan_gambar_kontur(
        citra, metode="biner", ambang=128, mode_retrieval="tree", luas_minimum=5
    )
    assert jml_tree == 2


def test_layanan_kontur_skala_rasio():
    """M6 b: Verifikasi efek penskalaan parameter luas_minimum berdasarkan rasio."""
    citra = np.zeros((100, 100, 3), dtype=np.uint8)
    citra[10:20, 10:20] = 255  # Persegi 10x10

    # Dengan rasio 0.5, luas_minimum 100 disesuaikan menjadi 100 * (0.5^2) = 25
    _, jml_rasio = cari_dan_gambar_kontur(
        citra,
        metode="biner",
        ambang=128,
        mode_retrieval="external",
        luas_minimum=100,
        rasio=0.5,
    )
    # Karena ambang disesuaikan menjadi 25, kontur luas ~81 lolos
    assert jml_rasio == 1


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
            "parameter": '{"metode": "otsu", "tampilan": "overlay", "warna_garis": "#ff0000", "rasio": 1.0}'
        },
    )

    assert respons.status_code == 200
    assert respons.headers["Content-Type"] == "image/png"
    assert respons.headers["X-Operasi"] == "deteksi_kontur"
    assert "X-Info-Operasi" in respons.headers


def test_endpoint_kontur_parameter_tidak_valid():
    """Memverifikasi penolakan parameter tidak valid pada endpoint kontur menghasilkan HTTP 422."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64)
    buffer_png = buat_buffer_png(citra)

    respons = client.post(
        "/api/v1/kontur",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"mode_retrieval": "mode_tidak_dikenal"}'},
    )
    assert respons.status_code == 422
    assert respons.json()["kode"] == "PARAMETER_TIDAK_VALID"
