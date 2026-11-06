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
    # Harus ada piksel tepi putih (255)
    assert np.any(hasil == 255)


def test_layanan_canny_preservasi_alfa():
    """Memverifikasi bahwa kanal alfa tidak diubah oleh operasi Canny."""
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=True)
    hasil = deteksi_tepi_canny(citra, ambang_bawah=50, ambang_atas=150)

    assert hasil.shape == (64, 64, 4)
    # Kanal alfa harus persis sama dengan citra asli
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
            "parameter": '{"ambang_bawah": 40, "ambang_atas": 120, "ukuran_apertur": 3}'
        },
    )

    assert respons.status_code == 200
    assert respons.headers["Content-Type"] == "image/png"
    assert respons.headers["X-Operasi"] == "tepi_canny"
    assert "X-Lebar" in respons.headers
    assert "X-Tinggi" in respons.headers
    assert "X-Waktu-Proses-Ms" in respons.headers


def test_endpoint_canny_parameter_tidak_valid():
    """Memverifikasi penolakan parameter apertur yang tidak sah (harus 3, 5, atau 7)."""
    client = TestClient(aplikasi)
    citra = buat_citra_uji_kotak(64, 64, dengan_alfa=False)
    buffer_png = buat_buffer_png(citra)

    respons = client.post(
        "/api/v1/tepi/canny",
        files={"gambar": ("uji.png", buffer_png, "image/png")},
        data={"parameter": '{"ukuran_apertur": 4}'},
    )

    assert respons.status_code == 400
    data = respons.json()
    assert data["kode"] == "PARAMETER_TIDAK_VALID"
