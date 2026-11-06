"""Uji unit untuk modul layanan dan endpoint morfologi matematika citra (Tahap 6)."""

import numpy as np
from starlette.testclient import TestClient

from app.layanan.operasi_morfologi import terapkan_morfologi
from app.utama import aplikasi
from uji.test_operasi_tepi import buat_buffer_png, buat_citra_uji_kotak


def test_layanan_morfologi_erosi_dan_dilasi():
    """Memverifikasi bahwa erosi menyusutkan area putih dan dilasi memperluas area putih."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=False)
    piksel_putih_asli = np.count_nonzero(citra[:, :, 0] == 255)

    erosi = terapkan_morfologi(
        citra, operasi="erosi", bentuk_elemen="persegi", ukuran=3, iterasi=1
    )
    piksel_putih_erosi = np.count_nonzero(erosi[:, :, 0] == 255)

    dilasi = terapkan_morfologi(
        citra, operasi="dilasi", bentuk_elemen="persegi", ukuran=3, iterasi=1
    )
    piksel_putih_dilasi = np.count_nonzero(dilasi[:, :, 0] == 255)

    assert piksel_putih_erosi < piksel_putih_asli
    assert piksel_putih_dilasi > piksel_putih_asli


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
            "parameter": '{"operasi": "dilasi", "bentuk_elemen": "silang", "ukuran": 3}'
        },
    )

    assert respons.status_code == 200
    assert respons.headers["Content-Type"] == "image/png"
    assert respons.headers["X-Operasi"] == "morfologi_dilasi"
