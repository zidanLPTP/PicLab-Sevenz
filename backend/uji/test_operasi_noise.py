"""Uji unit untuk modul layanan dan endpoint reduksi noise citra (Tahap 6)."""

import numpy as np
from starlette.testclient import TestClient

from app.layanan.operasi_noise import (
    reduksi_noise_bilateral,
    reduksi_noise_median,
    reduksi_noise_nlm,
)
from app.utama import aplikasi
from uji.test_operasi_tepi import buat_buffer_png, buat_citra_uji_kotak


def test_layanan_noise_bilateral_dan_median():
    """Memverifikasi reduksi noise bilateral dan median menjaga bentuk dimensi citra."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=False)
    # Tambahkan noise gaussian kecil
    noise = np.random.normal(0, 10, citra.shape).astype(np.int16)
    citra_berisik = np.clip(citra.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    hasil_bi = reduksi_noise_bilateral(
        citra_berisik, diameter=5, sigma_warna=50, sigma_ruang=50
    )
    assert hasil_bi.shape == citra.shape

    hasil_med = reduksi_noise_median(citra_berisik, ukuran_kernel=3)
    assert hasil_med.shape == citra.shape


def test_layanan_noise_preservasi_alfa():
    """Memverifikasi kanal alfa dipertahankan saat proses reduksi noise."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=True)
    hasil = reduksi_noise_nlm(citra, kekuatan_filter=5, kekuatan_warna=5)

    assert hasil.shape == (64, 64, 4)
    np.testing.assert_array_equal(hasil[:, :, 3], citra[:, :, 3])


def test_endpoint_reduksi_noise_sukses():
    """Memverifikasi endpoint POST /api/v1/noise/reduksi."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64)
    buffer_png = buat_buffer_png(citra)

    respons = client.post(
        "/api/v1/noise/reduksi",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={
            "parameter": '{"metode": "bilateral", "diameter": 5, "sigma_warna": 50, "sigma_ruang": 50}'
        },
    )

    assert respons.status_code == 200
    assert respons.headers["Content-Type"] == "image/png"
    assert respons.headers["X-Operasi"] == "reduksi_noise_bilateral"
