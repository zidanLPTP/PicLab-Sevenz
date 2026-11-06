"""Uji unit untuk modul layanan dan endpoint deteksi tepi Canny (Tahap 6)."""

import io

import numpy as np
from PIL import Image
from starlette.testclient import TestClient

from app.layanan.operasi_tepi import deteksi_tepi_canny
from app.utama import aplikasi


def buat_citra_uji_kotak(
    lebar: int = 64, tinggi: int = 64, dengan_alfa: bool = False
) -> np.ndarray:
    """Membuat citra sintetis kotak putih di tengah latar hitam."""
    if dengan_alfa:
        img = np.zeros((tinggi, lebar, 4), dtype=np.uint8)
        img[:, :, 3] = 200  # Nilai alfa tertentu
        img[16:48, 16:48, :3] = 255
    else:
        img = np.zeros((tinggi, lebar, 3), dtype=np.uint8)
        img[16:48, 16:48, :] = 255
    return img


def buat_buffer_png(array_np: np.ndarray) -> bytes:
    """Mengubah array NumPy menjadi byte buffer PNG."""
    pil_img = Image.fromarray(array_np)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()


def test_layanan_canny_dasar():
    """Memverifikasi bahwa deteksi Canny menghasilkan tepi pada kontras tinggi."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=False)
    hasil = deteksi_tepi_canny(citra, ambang_bawah=50, ambang_atas=150)

    assert hasil.shape == citra.shape
    assert hasil.dtype == np.uint8
    assert np.any(hasil == 255)


def test_layanan_canny_tangga_vertikal():
    """M6 a: Verifikasi piksel tepi hanya berada di kolom batas dan area datar bernilai 0."""
    tinggi, lebar = 40, 40
    citra = np.zeros((tinggi, lebar, 3), dtype=np.uint8)
    citra[:, 20:, :] = 255  # Separuh kiri hitam (0..19), separuh kanan putih (20..39)

    hasil = deteksi_tepi_canny(citra, ambang_bawah=50, ambang_atas=150)

    # Kanal R (atau grayscale tepi): area datar jauh dari batas (x < 18 atau x > 21) harus 0
    assert np.all(hasil[:, :18, 0] == 0)
    assert np.all(hasil[:, 22:, 0] == 0)

    # Kolom transisi (antara 18 dan 21) harus mengandung piksel tepi putih 255
    tepi_di_kolom_batas = hasil[:, 18:22, 0]
    assert np.any(tepi_di_kolom_batas == 255)


def test_layanan_canny_citra_1x1_dan_non_persegi():
    """M6 a: Uji ketahanan pada citra ukuran 1x1 dan non-persegi."""
    # Citra 1x1
    citra_1x1 = np.array([[[120, 120, 120]]], dtype=np.uint8)
    hasil_1x1 = deteksi_tepi_canny(citra_1x1, ambang_bawah=50, ambang_atas=150)
    assert hasil_1x1.shape == (1, 1, 3)
    assert np.all(hasil_1x1 == 0)

    # Citra non-persegi (lebar 30, tinggi 70)
    citra_panjang = np.zeros((70, 30, 3), dtype=np.uint8)
    citra_panjang[20:50, :, :] = 255  # Garis horizontal tebal
    hasil_panjang = deteksi_tepi_canny(citra_panjang, ambang_bawah=50, ambang_atas=150)
    assert hasil_panjang.shape == (70, 30, 3)
    assert np.any(hasil_panjang == 255)


def test_layanan_canny_preservasi_alfa():
    """Memverifikasi bahwa kanal alfa tidak diubah oleh operasi Canny."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=True)
    hasil = deteksi_tepi_canny(citra, ambang_bawah=50, ambang_atas=150)

    assert hasil.shape == (64, 64, 4)
    np.testing.assert_array_equal(hasil[:, :, 3], citra[:, :, 3])


def test_endpoint_canny_sukses():
    """Memverifikasi endpoint POST /api/v1/tepi/canny berjalan sukses."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=False)
    buffer_png = buat_buffer_png(citra)

    respons = client.post(
        "/api/v1/tepi/canny",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={
            "parameter": '{"ambang_bawah": 40, "ambang_atas": 120, "ukuran_apertur": 3, "rasio": 1.0}'
        },
    )

    assert respons.status_code == 200
    assert respons.headers["Content-Type"] == "image/png"
    assert respons.headers["X-Operasi"] == "tepi_canny"
    assert "X-Lebar" in respons.headers
    assert "X-Tinggi" in respons.headers
    assert "X-Waktu-Proses-Ms" in respons.headers


def test_endpoint_canny_penolakan_ambang_terbalik():
    """M6 a: Verifikasi penolakan validasi jika ambang_bawah >= ambang_atas (HTTP 422)."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=False)
    buffer_png = buat_buffer_png(citra)

    # Kasus ambang_bawah > ambang_atas
    respons = client.post(
        "/api/v1/tepi/canny",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"ambang_bawah": 150, "ambang_atas": 50}'},
    )
    assert respons.status_code == 422
    assert respons.json()["kode"] == "PARAMETER_TIDAK_VALID"

    # Kasus ambang_bawah == ambang_atas
    respons_sama = client.post(
        "/api/v1/tepi/canny",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"ambang_bawah": 100, "ambang_atas": 100}'},
    )
    assert respons_sama.status_code == 422
    assert respons_sama.json()["kode"] == "PARAMETER_TIDAK_VALID"


def test_endpoint_canny_parameter_apertur_tidak_valid():
    """Memverifikasi penolakan parameter apertur yang tidak sah (harus 3, 5, atau 7) mengembalikan HTTP 422."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=False)
    buffer_png = buat_buffer_png(citra)

    respons = client.post(
        "/api/v1/tepi/canny",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"ukuran_apertur": 4}'},
    )

    assert respons.status_code == 422
    assert respons.json()["kode"] == "PARAMETER_TIDAK_VALID"
