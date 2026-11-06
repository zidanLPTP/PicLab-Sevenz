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


def test_tolak_polyglot_html_dengan_header_palsu():
    """Tolak polyglot biner atau berkas HTML berekstensi PNG."""
    payload_html = b"<!DOCTYPE html><html><body><script>alert(1)</script></body></html>"
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("serangan.png", payload_html, "image/png")},
    )
    assert respons.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    data = respons.json()
    assert data["kode"] == KodeGalat.FORMAT_TIDAK_DIDUKUNG


def test_tolak_polyglot_zip_arsip():
    """Tolak arsip zip yang dikirim dengan ekstensi atau MIME PNG."""
    payload_zip = b"PK\x03\x04\x14\x00\x00\x00\x08\x00" + b"\x00" * 40
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("arsip.png", payload_zip, "image/png")},
    )
    assert respons.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    data = respons.json()
    assert data["kode"] == KodeGalat.FORMAT_TIDAK_DIDUKUNG


def test_tolak_berkas_terpotong_truncated_png():
    """Tolak citra PNG yang byte-nya terpotong di tengah stream sebelum penutup IEND."""
    # Header PNG valid tapi hanya memiliki 16 byte awal tanpa IDAT dan IEND
    png_buntung = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("buntung.png", png_buntung, "image/png")},
    )
    assert respons.status_code == status.HTTP_400_BAD_REQUEST
    data = respons.json()
    assert data["kode"] == KodeGalat.BERKAS_RUSAK


def test_tolak_multipart_tanpa_berkas():
    """Tolak permintaan multipart jika field berkas gambar tidak disertakan."""
    respons = klien.post("/api/uji/gema", data={"balik_horizontal": "true"})
    assert respons.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = respons.json()
    assert data["kode"] == KodeGalat.PARAMETER_TIDAK_VALID


def test_tolak_multipart_field_salah():
    """Tolak permintaan multipart jika nama field bukan 'gambar'."""
    citra = buat_citra_png_memori()
    respons = klien.post(
        "/api/uji/gema",
        files={"berkas_salah": ("uji.png", citra, "image/png")},
    )
    assert respons.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = respons.json()
    assert data["kode"] == KodeGalat.PARAMETER_TIDAK_VALID


def test_penanganan_aman_nama_berkas_path_traversal():
    """Pastikan nama berkas dengan path traversal (../../etc/passwd) dinetralisir dan tidak crash."""
    citra = buat_citra_png_memori()
    nama_traversal = "../../../../etc/passwd"
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": (nama_traversal, citra, "image/png")},
    )
    assert respons.status_code == status.HTTP_200_OK
    assert respons.headers["content-type"] == "image/png"


def test_penanganan_aman_nama_berkas_null_byte():
    """Pastikan nama berkas yang mengandung null byte (\x00) tidak merusak backend."""
    citra = buat_citra_png_memori()
    nama_null_byte = "gambar_uji\x00_bahaya.png"
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": (nama_null_byte, citra, "image/png")},
    )
    assert respons.status_code == status.HTTP_200_OK


def test_pembersihan_metadata_exif_dan_gps():
    """Memverifikasi bahwa metadata EXIF (termasuk tag identitas/perangkat) dibersihkan secara mutlak."""
    # Buat citra JPEG dengan tag EXIF standar
    buf = io.BytesIO()
    img = Image.new("RGB", (20, 20), (255, 100, 50))
    exif = img.getexif()
    # 0x010E = Image Description, 0x0131 = Software, 0x0132 = DateTime
    exif[0x010E] = "Informasi Rahasia Pengguna PicLab"
    exif[0x0131] = "Kamera Rahasia PicLab"
    exif[0x0132] = "2026:11:06 08:00:00"
    img.save(buf, format="JPEG", exif=exif)

    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("foto_ber_exif.jpg", buf.getvalue(), "image/jpeg")},
    )
    assert respons.status_code == status.HTTP_200_OK

    hasil_img = Image.open(io.BytesIO(respons.content))
    hasil_exif = hasil_img.getexif()
    # Hasil PNG tidak boleh memuat EXIF asli
    assert len(hasil_exif) == 0, f"Metadata EXIF masih tersisa: {dict(hasil_exif)}"
    assert "exif" not in hasil_img.info or not hasil_img.info["exif"]


def test_dukungan_mode_warna_palet_p():
    """Membuktikan mode warna palet P diproses secara aman tanpa galat."""
    img = Image.new("P", (16, 16))
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("palet.png", buf.getvalue(), "image/png")},
    )
    assert respons.status_code == status.HTTP_200_OK
    hasil_img = Image.open(io.BytesIO(respons.content))
    assert hasil_img.size == (16, 16)


def test_dukungan_mode_warna_grayscale_l():
    """Membuktikan mode grayscale L diproses secara aman."""
    img = Image.new("L", (16, 16), color=128)
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("grayscale.png", buf.getvalue(), "image/png")},
    )
    assert respons.status_code == status.HTTP_200_OK
    hasil_img = Image.open(io.BytesIO(respons.content))
    assert hasil_img.size == (16, 16)


def test_dukungan_mode_warna_16bit_i16():
    """Membuktikan mode 16-bit integer (I;16) ditangani tanpa unhandled crash."""
    # Buat raw Pillow image mode I;16 lalu simpan sebagai PNG
    img = Image.new("I;16", (16, 16), color=32768)
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("16bit.png", buf.getvalue(), "image/png")},
    )
    assert respons.status_code == status.HTTP_200_OK
    hasil_img = Image.open(io.BytesIO(respons.content))
    assert hasil_img.size == (16, 16)


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
