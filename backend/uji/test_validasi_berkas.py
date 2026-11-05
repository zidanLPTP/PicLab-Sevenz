"""Pengujian unit dan integrasi validasi berkas citra PicLab Sevenz (spec.md bagian 8 & Tahap 5).

Mencakup seluruh uji negatif OWASP (format palsu, bom dekompresi, dimensi berlebih, SVG, dll)
serta uji positif berbagai mode warna citra di memori.
"""

import io

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from PIL import Image

from app.inti.galat import KodeGalat
from app.utama import aplikasi

klien = TestClient(aplikasi)


def buat_citra_png_memori(
    lebar: int = 10, tinggi: int = 10, mode: str = "RGB", warna=(255, 0, 0)
) -> bytes:
    """Membangkitkan citra PNG murni di memori."""
    buf = io.BytesIO()
    img = Image.new(mode, (lebar, tinggi), warna)
    img.save(buf, format="PNG")
    return buf.getvalue()


def buat_citra_jpeg_memori(lebar: int = 10, tinggi: int = 10) -> bytes:
    """Membangkitkan citra JPEG murni di memori."""
    buf = io.BytesIO()
    img = Image.new("RGB", (lebar, tinggi), (0, 255, 0))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def buat_citra_webp_memori(lebar: int = 10, tinggi: int = 10) -> bytes:
    """Membangkitkan citra WebP murni di memori."""
    buf = io.BytesIO()
    img = Image.new("RGB", (lebar, tinggi), (0, 0, 255))
    img.save(buf, format="WEBP")
    return buf.getvalue()


def buat_citra_bmp_memori(lebar: int = 10, tinggi: int = 10) -> bytes:
    """Membangkitkan citra BMP murni di memori."""
    buf = io.BytesIO()
    img = Image.new("RGB", (lebar, tinggi), (128, 128, 128))
    img.save(buf, format="BMP")
    return buf.getvalue()


# ============================================================================
# 1. UJI NEGATIF OWASP: VALIDASI UKURAN, FORMAT, DAN KELAYAKAN BERKAS
# ============================================================================


def test_tolak_content_length_melebihi_batas():
    """Tolak jika header Content-Length melebihi batas sebelum membaca badan request."""
    respons = klien.post(
        "/api/uji/gema",
        headers={"content-length": str(15 * 1024 * 1024)},  # 15 MB
        files={"gambar": ("uji.png", b"isi_pendek", "image/png")},
    )
    assert respons.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    data = respons.json()
    assert data["kode"] == KodeGalat.BERKAS_TERLALU_BESAR


def test_tolak_aliran_berkas_melebihi_batas_meski_content_length_bohong():
    """Tolak jika aliran data melebihi 10 MB walaupun header Content-Length mengklaim kecil."""
    # Bangkitkan 10 MB + 64 KB data biner
    data_raksasa = b"A" * (10 * 1024 * 1024 + 65536)
    respons = klien.post(
        "/api/uji/gema",
        headers={"content-length": "100"},  # Bohong
        files={"gambar": ("uji.png", data_raksasa, "image/png")},
    )
    assert respons.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    data = respons.json()
    assert data["kode"] == KodeGalat.BERKAS_TERLALU_BESAR


def test_tolak_berkas_kosong():
    """Tolak berkas kosong 0 byte."""
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("kosong.png", b"", "image/png")},
    )
    assert respons.status_code == status.HTTP_400_BAD_REQUEST
    data = respons.json()
    assert data["kode"] == KodeGalat.BERKAS_RUSAK


def test_tolak_format_palsu_teks_dengan_content_type_png():
    """Tolak berkas teks yang dipalsukan sebagai PNG melalui Content-Type."""
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("palsu.png", b"ini bukan gambar", "image/png")},
    )
    assert respons.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    data = respons.json()
    assert data["kode"] == KodeGalat.FORMAT_TIDAK_DIDUKUNG


def test_tolak_format_svg():
    """Tolak berkas SVG berbasis XML untuk mitigasi XSS dan XXE."""
    svg_payload = b'<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>'
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("gambar.svg", svg_payload, "image/svg+xml")},
    )
    assert respons.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    data = respons.json()
    assert data["kode"] == KodeGalat.FORMAT_TIDAK_DIDUKUNG


def test_tolak_format_animasi_gif():
    """Tolak berkas GIF atau animasi multi-frame."""
    buf = io.BytesIO()
    frame1 = Image.new("RGB", (10, 10), (255, 0, 0))
    frame2 = Image.new("RGB", (10, 10), (0, 255, 0))
    frame1.save(buf, format="GIF", save_all=True, append_images=[frame2])
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("animasi.gif", buf.getvalue(), "image/gif")},
    )
    assert respons.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    data = respons.json()
    assert data["kode"] == KodeGalat.FORMAT_TIDAK_DIDUKUNG


def test_tolak_dimensi_melebihi_batas():
    """Tolak citra yang memiliki salah satu sisi > 4096 px."""
    citra_besar = buat_citra_png_memori(lebar=4097, tinggi=10)
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("besar.png", citra_besar, "image/png")},
    )
    assert respons.status_code == status.HTTP_400_BAD_REQUEST
    data = respons.json()
    assert data["kode"] == KodeGalat.DIMENSI_TERLALU_BESAR


def test_tolak_bom_dekompresi_sebelum_dekode_penuh():
    """Tolak decompression bomb (citra dengan header ukuran raksasa) sebelum meledak di memori."""
    # Bangkitkan header PNG buatan dengan dimensi 50.000 x 50.000 piksel (2,5 miliar piksel)
    # Header IHDR PNG: lebar 4 byte, tinggi 4 byte
    buf = io.BytesIO()
    # Buat citra 1x1 dulu lalu ubah header IHDR untuk simulasi decompression bomb
    img = Image.new("RGB", (1, 1), (255, 255, 255))
    img.save(buf, format="PNG")
    raw = bytearray(buf.getvalue())

    # Cari chunk IHDR di byte ke-12
    # IHDR dimulai setelah 8 byte signature + 4 byte length: byte index 16..24 adalah lebar & tinggi
    idx_ihdr = raw.find(b"IHDR")
    assert idx_ihdr != -1
    # Ganti lebar dan tinggi menjadi 50000 (0x0000C350)
    raw[idx_ihdr + 4 : idx_ihdr + 8] = (50000).to_bytes(4, "big")
    raw[idx_ihdr + 8 : idx_ihdr + 12] = (50000).to_bytes(4, "big")

    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("bomb.png", bytes(raw), "image/png")},
    )
    # Harus ditolak di validasi dimensi/piksel tanpa crash memori
    assert respons.status_code == status.HTTP_400_BAD_REQUEST
    data = respons.json()
    assert data["kode"] in (
        KodeGalat.DIMENSI_TERLALU_BESAR,
        KodeGalat.PIKSEL_TERLALU_BANYAK,
        KodeGalat.BERKAS_RUSAK,
    )


def test_tolak_parameter_tidak_valid():
    """Tolak jika parameter dikirim dengan tipe data yang salah."""
    citra = buat_citra_png_memori()
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("uji.png", citra, "image/png")},
        data={"balik_horizontal": "bukan_boolean_valid_123"},
    )
    assert respons.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = respons.json()
    assert data["kode"] == KodeGalat.PARAMETER_TIDAK_VALID


# ============================================================================
# 2. UJI POSITIF: DUKUNGAN MULTI-FORMAT DAN KONSISTENSI PIKSEL
# ============================================================================


@pytest.mark.parametrize(
    "fungsi_pembuat,format_mime",
    [
        (buat_citra_png_memori, "image/png"),
        (buat_citra_jpeg_memori, "image/jpeg"),
        (buat_citra_webp_memori, "image/webp"),
        (buat_citra_bmp_memori, "image/bmp"),
    ],
)
def test_dukungan_format_resmi(fungsi_pembuat, format_mime):
    """Membuktikan endpoint menerima keempat format yang sah (PNG, JPEG, WebP, BMP)."""
    citra = fungsi_pembuat(lebar=20, tinggi=15)
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("gambar", citra, format_mime)},
        data={"balik_horizontal": "true"},
    )
    assert respons.status_code == status.HTTP_200_OK
    assert respons.headers["content-type"] == "image/png"
    assert respons.headers["x-lebar"] == "20"
    assert respons.headers["x-tinggi"] == "15"

    # Verifikasi berkas keluaran adalah citra PNG valid
    hasil_img = Image.open(io.BytesIO(respons.content))
    assert hasil_img.format == "PNG"
    assert hasil_img.size == (20, 15)


def test_verifikasi_matematis_pembalikan_horizontal():
    """Memverifikasi bahwa pembalikan horizontal benar-benar membalik kolom piksel."""
    # Buat citra 2x1: piksel kiri merah (255, 0, 0), piksel kanan biru (0, 0, 255)
    img = Image.new("RGB", (2, 1))
    img.putpixel((0, 0), (255, 0, 0))
    img.putpixel((1, 0), (0, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("uji.png", buf.getvalue(), "image/png")},
        data={"balik_horizontal": "true"},
    )
    assert respons.status_code == status.HTTP_200_OK

    hasil_img = Image.open(io.BytesIO(respons.content))
    # Setelah dibalik: piksel kiri harus biru, piksel kanan harus merah
    p_kiri = hasil_img.getpixel((0, 0))[:3]
    p_kanan = hasil_img.getpixel((1, 0))[:3]
    assert p_kiri == (0, 0, 255)
    assert p_kanan == (255, 0, 0)


def test_preservasi_kanal_alfa_rgba():
    """Memverifikasi bahwa kanal alfa (transparansi) pada citra RGBA dipertahankan."""
    img = Image.new(
        "RGBA", (10, 10), (100, 150, 200, 128)
    )  # Alfa 128 (setengah transparan)
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("alfa.png", buf.getvalue(), "image/png")},
        data={"balik_horizontal": "false"},
    )
    assert respons.status_code == status.HTTP_200_OK

    hasil_img = Image.open(io.BytesIO(respons.content))
    assert hasil_img.mode == "RGBA"
    assert hasil_img.getpixel((5, 5))[3] == 128
