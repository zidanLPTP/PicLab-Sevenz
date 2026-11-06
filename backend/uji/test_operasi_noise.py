"""Uji unit untuk modul layanan dan endpoint reduksi noise citra (Tahap 6)."""

import numpy as np
from starlette.testclient import TestClient

from app.inti.galat import KodeGalat
from app.layanan.operasi_noise import (
    reduksi_noise_bilateral,
    reduksi_noise_median,
    reduksi_noise_nlm,
)
from app.utama import aplikasi
from uji.test_operasi_tepi import buat_buffer_png, buat_citra_uji_kotak


def hitung_psnr(asli: np.ndarray, terdistorsi: np.ndarray) -> float:
    """Menghitung Peak Signal-to-Noise Ratio (PSNR) antara dua citra uint8."""
    mse = np.mean((asli.astype(np.float64) - terdistorsi.astype(np.float64)) ** 2)
    if mse == 0:
        return float("inf")
    return float(20 * np.log10(255.0 / np.sqrt(mse)))


def test_layanan_noise_citra_datar_konstan():
    """M6 e: Pada citra datar konstan, output harus identik dengan input untuk semua metode."""
    citra_datar = np.full((32, 32, 3), 128, dtype=np.uint8)

    hasil_bi = reduksi_noise_bilateral(
        citra_datar, diameter=5, sigma_warna=50, sigma_ruang=50
    )
    np.testing.assert_array_equal(hasil_bi, citra_datar)

    hasil_nlm = reduksi_noise_nlm(citra_datar, kekuatan_filter=5, kekuatan_warna=5)
    np.testing.assert_allclose(hasil_nlm, citra_datar, atol=1)

    hasil_med = reduksi_noise_median(citra_datar, ukuran_kernel=3)
    np.testing.assert_array_equal(hasil_med, citra_datar)


def test_layanan_noise_psnr_peningkatan_kualitas():
    """M6 e: Verifikasi PSNR hasil reduksi lebih tinggi daripada citra berderau ber-seed."""
    np.random.seed(42)
    # Buat ground truth kotak kontras
    gt = np.zeros((48, 48, 3), dtype=np.uint8)
    gt[12:36, 12:36] = 200

    # Tambahkan gaussian noise terkontrol
    noise = np.random.normal(0, 15, gt.shape)
    berderau = np.clip(gt.astype(np.float64) + noise, 0, 255).astype(np.uint8)

    psnr_awal = hitung_psnr(gt, berderau)

    # 1. Bilateral Filter
    hasil_bi = reduksi_noise_bilateral(
        berderau, diameter=5, sigma_warna=50, sigma_ruang=50
    )
    psnr_bi = hitung_psnr(gt, hasil_bi)
    assert psnr_bi > psnr_awal

    # 2. NLM
    hasil_nlm = reduksi_noise_nlm(berderau, kekuatan_filter=7, kekuatan_warna=7)
    psnr_nlm = hitung_psnr(gt, hasil_nlm)
    assert psnr_nlm > psnr_awal

    # 3. Median
    hasil_med = reduksi_noise_median(berderau, ukuran_kernel=3)
    psnr_med = hitung_psnr(gt, hasil_med)
    assert psnr_med > psnr_awal


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
            "parameter": '{"metode": "bilateral", "diameter": 5, "sigma_warna": 50, "sigma_ruang": 50, "rasio": 1.0}'
        },
    )

    assert respons.status_code == 200
    assert respons.headers["Content-Type"] == "image/png"
    assert respons.headers["X-Operasi"] == "reduksi_noise_bilateral"


def test_endpoint_noise_penolakan_nlm_melebihi_4mp():
    """M6 e: Penolakan citra > 4 MP khusus NLM mengembalikan HTTP 400 PIKSEL_TERLALU_BANYAK_UNTUK_OPERASI."""
    client = TestClient(aplikasi)
    # Buat citra 2001 x 2001 = 4.004.001 piksel (> 4 MP)
    # Buat PNG seminimal mungkin (citra konstan kompresi sangat kecil)
    citra_besar = np.zeros((2001, 2001, 3), dtype=np.uint8)
    buffer_png = buat_buffer_png(citra_besar)

    respons = client.post(
        "/api/v1/noise/reduksi",
        files={"gambar": ("besar.png", buffer_png, "image/png")},
        data={"parameter": '{"metode": "nlm", "kekuatan_filter": 5}'},
    )

    assert respons.status_code == 400
    data = respons.json()
    assert data["kode"] == KodeGalat.PIKSEL_TERLALU_BANYAK_UNTUK_OPERASI


def test_endpoint_noise_parameter_tidak_valid():
    """Memverifikasi penolakan parameter metode asing menghasilkan HTTP 422."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64)
    buffer_png = buat_buffer_png(citra)

    respons = client.post(
        "/api/v1/noise/reduksi",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"metode": "metode_fiktif"}'},
    )

    assert respons.status_code == 422
    assert respons.json()["kode"] == "PARAMETER_TIDAK_VALID"
