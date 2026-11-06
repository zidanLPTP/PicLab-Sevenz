"""Uji unit untuk modul layanan dan endpoint morfologi matematika citra (Tahap 6)."""

import numpy as np
from starlette.testclient import TestClient

from app.layanan.operasi_morfologi import dapatkan_elemen_struktur, terapkan_morfologi
from app.utama import aplikasi
from uji.test_operasi_tepi import buat_buffer_png, buat_citra_uji_kotak


def test_dapatkan_elemen_struktur():
    """Memverifikasi pembuatan kernel elemen struktur (persegi, silang, elips)."""
    k_persegi = dapatkan_elemen_struktur("persegi", 3)
    assert k_persegi.shape == (3, 3)
    assert np.all(k_persegi == 1)

    k_silang = dapatkan_elemen_struktur("silang", 3)
    assert k_silang.shape == (3, 3)
    assert k_silang[1, 1] == 1
    assert k_silang[0, 0] == 0

    k_elips = dapatkan_elemen_struktur("elips", 5)
    assert k_elips.shape == (5, 5)
    assert k_elips[2, 2] == 1


def test_layanan_morfologi_hitung_tangan_5x5():
    """M6 c: Perhitungan tangan matematis citra biner 5x5 dengan kernel 3x3 persegi.

    Matriks Citra Masukan Biner (5x5):
    [[  0,   0,   0,   0,   0],
     [  0, 255, 255, 255,   0],
     [  0, 255, 255, 255,   0],
     [  0, 255, 255, 255,   0],
     [  0,   0,   0,   0,   0]]
    Kotak 3x3 di tengah bernilai 255, border bernilai 0.
    """
    citra_biner = np.zeros((5, 5, 3), dtype=np.uint8)
    citra_biner[1:4, 1:4] = 255

    # 1. Erosi 3x3 persegi:
    # Hanya titik tengah (2, 2) yang seluruh tetangga 3x3-nya bernilai 255.
    # Maka erosi hanya menyisakan 1 piksel di tengah (2, 2) bernilai 255, sisanya 0.
    hasil_erosi = terapkan_morfologi(
        citra_biner, operasi="erosi", bentuk_elemen="persegi", ukuran=3, iterasi=1
    )
    ekspektasi_erosi = np.zeros((5, 5, 3), dtype=np.uint8)
    ekspektasi_erosi[2, 2] = 255
    np.testing.assert_array_equal(hasil_erosi, ekspektasi_erosi)

    # 2. Dilasi 3x3 persegi:
    # Karena kotak 3x3 diperluas 1 piksel ke segala arah pada kanvas 5x5,
    # seluruh piksel kanvas 5x5 menjadi 255.
    hasil_dilasi = terapkan_morfologi(
        citra_biner, operasi="dilasi", bentuk_elemen="persegi", ukuran=3, iterasi=1
    )
    ekspektasi_dilasi = np.full((5, 5, 3), 255, dtype=np.uint8)
    np.testing.assert_array_equal(hasil_dilasi, ekspektasi_dilasi)

    # 3. Opening (Erosi lalu Dilasi) 3x3 persegi:
    # Erosi menghasilkan 1 titik (2, 2). Lalu dilasi pada 1 titik itu dengan kernel 3x3
    # merekonstruksi kembali kotak 3x3 di posisi tengah (1:4, 1:4).
    hasil_opening = terapkan_morfologi(
        citra_biner, operasi="opening", bentuk_elemen="persegi", ukuran=3, iterasi=1
    )
    np.testing.assert_array_equal(hasil_opening, citra_biner)

    # 4. Closing (Dilasi lalu Erosi) 3x3 persegi:
    # Dilasi menghasilkan kanvas penuh 255 (5x5). Erosi 3x3 pada kanvas penuh
    # dengan border replication OpenCV menghasilkan seluruh kanvas 255.
    hasil_closing = terapkan_morfologi(
        citra_biner, operasi="closing", bentuk_elemen="persegi", ukuran=3, iterasi=1
    )
    np.testing.assert_array_equal(hasil_closing, ekspektasi_dilasi)


def test_layanan_morfologi_gradient_tophat_blackhat():
    """M6 c: Perhitungan tangan untuk operasi Gradient, Top-hat, dan Black-hat.

    Citra Masukan Biner 5x5: kotak 3x3 di tengah bernilai 255, border bernilai 0.
    - Gradient = Dilasi - Erosi:
      Dilasi = matriks 5x5 penuh 255.
      Erosi = hanya titik (2, 2) bernilai 255, sisanya 0.
      Gradient = seluruh 5x5 bernilai 255 KECUALI titik pusat (2, 2) bernilai 0.
    """
    citra_biner = np.zeros((5, 5, 3), dtype=np.uint8)
    citra_biner[1:4, 1:4] = 255

    hasil_gradient = terapkan_morfologi(
        citra_biner, operasi="gradient", bentuk_elemen="persegi", ukuran=3, iterasi=1
    )
    ekspektasi_gradient = np.full((5, 5, 3), 255, dtype=np.uint8)
    ekspektasi_gradient[2, 2] = 0
    np.testing.assert_array_equal(hasil_gradient, ekspektasi_gradient)

    # Top-hat = Citra - Opening:
    # Karena opening(citra) == citra, maka tophat bernilai 0 di seluruh piksel.
    hasil_tophat = terapkan_morfologi(
        citra_biner, operasi="tophat", bentuk_elemen="persegi", ukuran=3, iterasi=1
    )
    assert np.all(hasil_tophat == 0)

    # Black-hat = Closing - Citra:
    # Closing = 5x5 penuh 255. Citra = kotak 3x3 tengah 255.
    # Selisihnya (Black-hat) bernilai 255 pada border (x=0, 4 atau y=0, 4) dan 0 di tengah.
    hasil_blackhat = terapkan_morfologi(
        citra_biner, operasi="blackhat", bentuk_elemen="persegi", ukuran=3, iterasi=1
    )
    ekspektasi_blackhat = np.full((5, 5, 3), 255, dtype=np.uint8)
    ekspektasi_blackhat[1:4, 1:4] = 0
    np.testing.assert_array_equal(hasil_blackhat, ekspektasi_blackhat)


def test_layanan_morfologi_kernel_silang_dan_elips():
    """M6 c: Verifikasi morfologi menggunakan elemen struktur silang dan elips."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=False)

    hasil_silang = terapkan_morfologi(
        citra, operasi="dilasi", bentuk_elemen="silang", ukuran=5
    )
    assert hasil_silang.shape == citra.shape
    assert np.count_nonzero(hasil_silang[:, :, 0] == 255) > np.count_nonzero(
        citra[:, :, 0] == 255
    )

    hasil_elips = terapkan_morfologi(
        citra, operasi="erosi", bentuk_elemen="elips", ukuran=5
    )
    assert hasil_elips.shape == citra.shape
    assert np.count_nonzero(hasil_elips[:, :, 0] == 255) < np.count_nonzero(
        citra[:, :, 0] == 255
    )


def test_layanan_morfologi_preservasi_alfa():
    """Memverifikasi kanal alfa tidak terdistorsi oleh operasi morfologi."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=True)
    hasil = terapkan_morfologi(
        citra, operasi="opening", bentuk_elemen="elips", ukuran=5
    )

    assert hasil.shape == (64, 64, 4)
    np.testing.assert_array_equal(hasil[:, :, 3], citra[:, :, 3])


def test_endpoint_morfologi_sukses():
    """Memverifikasi endpoint POST /api/v1/morfologi."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64)
    buffer_png = buat_buffer_png(citra)

    respons = client.post(
        "/api/v1/morfologi",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={
            "parameter": '{"operasi": "dilasi", "bentuk_elemen": "silang", "ukuran": 3, "rasio": 1.0}'
        },
    )

    assert respons.status_code == 200
    assert respons.headers["Content-Type"] == "image/png"
    assert respons.headers["X-Operasi"] == "morfologi_dilasi"


def test_endpoint_morfologi_operasi_tidak_valid():
    """Memverifikasi penolakan operasi yang tidak valid mengembalikan HTTP 422."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64)
    buffer_png = buat_buffer_png(citra)

    respons = client.post(
        "/api/v1/morfologi",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"operasi": "operasi_palsu"}'},
    )

    assert respons.status_code == 422
    assert respons.json()["kode"] == "PARAMETER_TIDAK_VALID"
