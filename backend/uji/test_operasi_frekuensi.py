"""Uji unit untuk modul layanan dan endpoint transformasi frekuensi FFT (Tahap 6)."""

import cv2
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


def test_layanan_fft_citra_konstan_komponen_dc():
    """M6 f: Spektrum Fourier citra konstan hanya memiliki energi pada komponen DC."""
    tinggi, lebar = 64, 64
    citra_konstan = np.full((tinggi, lebar, 3), 100, dtype=np.uint8)

    # Hitung DFT 2D langsung pada kanal Y
    y_float = citra_konstan[:, :, 0].astype(np.float32)
    dft = cv2.dft(y_float, flags=cv2.DFT_COMPLEX_OUTPUT)
    dft_shift = np.fft.fftshift(dft, axes=(0, 1))
    magnitudo = cv2.magnitude(dft_shift[:, :, 0], dft_shift[:, :, 1])

    cy, cx = tinggi // 2, lebar // 2
    energi_dc = magnitudo[cy, cx]
    # Matikan komponen DC
    magnitudo_non_dc = magnitudo.copy()
    magnitudo_non_dc[cy, cx] = 0.0

    assert energi_dc > 0
    # Komponen non-DC harus mendekati nol
    assert np.allclose(magnitudo_non_dc, 0.0, atol=1e-3)


def test_layanan_fft_citra_sinusoid_puncak_frekuensi():
    """M6 f: Spektrum Fourier citra sinusoid memunculkan puncak pada frekuensi yang sesuai."""
    tinggi, lebar = 64, 64
    # Buat gelombang cosinus frekuensi 4 siklus per 64 piksel pada sumbu horizontal
    frekuensi_x = 4
    x = np.arange(lebar)
    gelombang = 128 + 100 * np.cos(2 * np.pi * frekuensi_x * x / lebar)
    citra_sinus = np.tile(gelombang, (tinggi, 1)).astype(np.uint8)
    citra_sinus_rgb = np.stack([citra_sinus] * 3, axis=-1)

    y_float = citra_sinus_rgb[:, :, 0].astype(np.float32)
    dft = cv2.dft(y_float, flags=cv2.DFT_COMPLEX_OUTPUT)
    dft_shift = np.fft.fftshift(dft, axes=(0, 1))
    magnitudo = cv2.magnitude(dft_shift[:, :, 0], dft_shift[:, :, 1])

    cy, cx = tinggi // 2, lebar // 2
    # Di samping DC di (cy, cx), harus ada 2 puncak simetris pada (cy, cx - frekuensi_x) dan (cy, cx + frekuensi_x)
    puncak_kiri = magnitudo[cy, cx - frekuensi_x]
    puncak_kanan = magnitudo[cy, cx + frekuensi_x]

    # Matikan DC dan kedua puncak tersebut
    magnitudo_sisa = magnitudo.copy()
    magnitudo_sisa[cy, cx] = 0
    magnitudo_sisa[cy, cx - frekuensi_x] = 0
    magnitudo_sisa[cy, cx + frekuensi_x] = 0

    assert puncak_kiri > 50000.0
    assert puncak_kanan > 50000.0
    # Puncak frekuensi harus jauh mendominasi spektrum sisa akibat kuantisasi diskret uint8
    assert np.max(magnitudo_sisa) < puncak_kiri * 0.05


def test_layanan_fft_lowpass_memuluskan_papan_catur():
    """M6 f: Lowpass filter ideal memuluskan pola berfrekuensi tinggi (papan catur)."""
    # Pola papan catur 32x32 dengan kotak 2x2 piksel berselang-seling hitam putih
    papan = np.indices((32, 32)).sum(axis=0) % 2 * 255
    citra_papan = np.stack([papan.astype(np.uint8)] * 3, axis=-1)

    variansi_awal = float(np.var(citra_papan[:, :, 0]))

    # Filter lowpass ketat (d0 = 5) membuang frekuensi tinggi papan catur
    hasil_lp = filter_frekuensi_fft(
        citra_papan, jenis_filter="ideal", tipe_filter="lowpass", frekuensi_cut_off=5
    )
    variansi_akhir = float(np.var(hasil_lp[:, :, 0]))

    # Pemulusan drastis: variansi intensitas turun tajam mendekati abu-abu rata-rata
    assert variansi_akhir < variansi_awal * 0.15


def test_layanan_fft_allpass_mengembalikan_citra_asli():
    """M6 f: Filter allpass (lowpass dengan cut-off sangat besar) merekonstruksi citra asli."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=False)
    # Cut-off jauh lebih besar dari dimensi citra (mis. 500)
    hasil = filter_frekuensi_fft(
        citra, jenis_filter="ideal", tipe_filter="lowpass", frekuensi_cut_off=500
    )

    # Rata-rata selisih absolut <= 1 (karena konversi YCrCb dan pembulatan uint8)
    selisih_rataan = np.mean(
        np.abs(citra.astype(np.float32) - hasil.astype(np.float32))
    )
    assert selisih_rataan <= 1.0


def test_layanan_fft_hukum_kekekalan_parseval():
    """M6 f: Verifikasi hukum Parseval sum(|x|^2) == (1 / NM) * sum(|X|^2)."""
    np.random.seed(42)
    citra_acak = np.random.randint(0, 256, (32, 32), dtype=np.uint8).astype(np.float32)
    tinggi, lebar = citra_acak.shape

    # Energi spasial
    energi_spasial = np.sum(citra_acak**2)

    # DFT 2D
    dft = cv2.dft(citra_acak, flags=cv2.DFT_COMPLEX_OUTPUT)
    # Magnitudo kuadrat = riil^2 + imajiner^2
    energi_frekuensi = np.sum(dft[:, :, 0] ** 2 + dft[:, :, 1] ** 2)

    # Menurut teorema Parseval untuk DFT OpenCV (unnormalized):
    # energi_spasial == energi_frekuensi / (tinggi * lebar)
    np.testing.assert_allclose(
        energi_spasial, energi_frekuensi / (tinggi * lebar), rtol=1e-4
    )


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
            "parameter": '{"jenis_filter": "butterworth", "tipe_filter": "lowpass", "frekuensi_cut_off": 25, "orde": 2, "rasio": 1.0}'
        },
    )

    assert respons.status_code == 200
    assert respons.headers["Content-Type"] == "image/png"
    assert "fft" in respons.headers["X-Operasi"]


def test_endpoint_fft_parameter_tidak_valid():
    """Memverifikasi penolakan tipe filter tidak valid menghasilkan HTTP 422."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64)
    buffer_png = buat_buffer_png(citra)

    respons = client.post(
        "/api/v1/frekuensi",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"tipe_filter": "tipe_asing"}'},
    )

    assert respons.status_code == 422
    assert respons.json()["kode"] == "PARAMETER_TIDAK_VALID"
