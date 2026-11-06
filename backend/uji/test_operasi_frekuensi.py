"""Uji unit untuk modul layanan dan endpoint transformasi frekuensi FFT (Tahap 6)."""

import numpy as np
from starlette.testclient import TestClient

from app.layanan.operasi_frekuensi import buat_masker_filter, filter_frekuensi_fft
from app.utama import aplikasi
from uji.test_operasi_tepi import buat_buffer_png, buat_citra_uji_kotak


def test_buat_masker_filter_fft():
    """Memverifikasi pembuatan masker filter lowpass dan highpass."""
    bentuk = (32, 32)
    masker_lp = buat_masker_filter(
        bentuk, jenis_filter="ideal", tipe_filter="lowpass", d0=10
    )
    assert masker_lp.shape == bentuk
    # Pusat frekuensi (16, 16) harus bernilai 1.0 pada lowpass
    assert masker_lp[16, 16] == 1.0

    masker_hp = buat_masker_filter(
        bentuk, jenis_filter="ideal", tipe_filter="highpass", d0=10
    )
    assert masker_hp.shape == bentuk
    # Pusat frekuensi (16, 16) harus bernilai 0.0 pada highpass
    assert masker_hp[16, 16] == 0.0


def test_layanan_filter_fft_dan_spektrum():
    """Memverifikasi eksekusi filter FFT dan generasi spektrum magnitudo."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=False)

    terfilter = filter_frekuensi_fft(
        citra, jenis_filter="gaussian", tipe_filter="lowpass", frekuensi_cut_off=20
    )
    assert terfilter.shape == citra.shape
    assert terfilter.dtype == np.uint8

    spektrum = filter_frekuensi_fft(citra, mode_keluaran="spektrum_magnitudo")
    assert spektrum.shape == citra.shape
    assert spektrum.dtype == np.uint8


def test_layanan_fft_preservasi_alfa():
    """Memverifikasi saluran alfa tetap terjaga pada transformasi FFT."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=True)
    hasil = filter_frekuensi_fft(citra, jenis_filter="butterworth", orde=2)

    assert hasil.shape == (64, 64, 4)
    np.testing.assert_array_equal(hasil[:, :, 3], citra[:, :, 3])


def test_endpoint_fft_sukses():
    """Memverifikasi pemanggilan endpoint POST /api/v1/frekuensi."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64)
    buffer_png = buat_buffer_png(citra)

    respons = client.post(
        "/api/v1/frekuensi",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={
            "parameter": '{"jenis_filter": "butterworth", "tipe_filter": "lowpass", "frekuensi_cut_off": 25, "orde": 2}'
        },
    )

    assert respons.status_code == 200
    assert respons.headers["Content-Type"] == "image/png"
    assert "fft" in respons.headers["X-Operasi"]
