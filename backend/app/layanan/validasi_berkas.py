"""Modul validasi berkas citra bertahap PicLab Sevenz (spec.md bagian 8 & Agent.md bagian 7).

Menerapkan urutan validasi murah-ke-mahal, pembacaan stream berbatas keras,
pemeriksaan magic bytes biner, mitigasi decompression bomb, dan pemrosesan murni
di memori tanpa menyentuh disk (OWASP A03 / A04 / A05).
"""

import io
import warnings
from typing import Tuple

from fastapi import UploadFile, status
from PIL import Image, ImageOps

from app.inti.galat import GalatAplikasi, KodeGalat
from app.inti.konfigurasi import konfigurasi

# Konfigurasi Pillow Decompression Bomb Guard
Image.MAX_IMAGE_PIXELS = konfigurasi.TOTAL_PIKSEL_MAKS
warnings.filterwarnings("error", category=Image.DecompressionBombWarning)

CHUNK_BACA_BYTES = 64 * 1024  # 64 KB per chunk


def deteksi_magic_bytes(header: bytes) -> str | None:
    """Mendeteksi format citra berdasarkan magic bytes awal berkas biner.

    Tidak pernah mempercayai ekstensi nama berkas atau header Content-Type.
    """
    if len(header) < 2:
        return None

    # 1. JPEG: FF D8 FF
    if header.startswith(b"\xff\xd8\xff"):
        return "JPEG"

    # 2. PNG: 89 50 4E 47 0D 0A 1A 0A
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"

    # 3. WebP: RIFF....WEBP
    if len(header) >= 12 and header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return "WEBP"

    # 4. BMP: BM (42 4D)
    if header.startswith(b"BM"):
        return "BMP"

    return None


async def baca_dan_validasi_stream(
    berkas: UploadFile, batas_maks_byte: int
) -> bytearray:
    """Membaca isi berkas secara bertahap dalam potongan berbatas keras.

    Menolak Content-Length yang melebihi batas sebelum membaca, dan
    menghentikan pembacaan seketika jika akumulator melebihi batas (mencegah DoS / memori jebol).
    """
    # 1. Tolak berdasarkan Content-Length jika dikirim oleh klien
    header_cl = berkas.headers.get("content-length")
    if header_cl:
        try:
            cl = int(header_cl)
            if cl > batas_maks_byte:
                raise GalatAplikasi(
                    kode=KodeGalat.BERKAS_TERLALU_BESAR,
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                )
        except ValueError:
            pass  # Content-Length tidak valid, lanjutkan ke pembacaan chunk bertahap

    # 2. Baca isi dalam potongan berbatas keras
    buffer = bytearray()
    total_baca = 0

    while True:
        chunk = await berkas.read(CHUNK_BACA_BYTES)
        if not chunk:
            break
        total_baca += len(chunk)
        if total_baca > batas_maks_byte:
            raise GalatAplikasi(
                kode=KodeGalat.BERKAS_TERLALU_BESAR,
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        buffer.extend(chunk)

    if len(buffer) == 0:
        raise GalatAplikasi(
            kode=KodeGalat.BERKAS_RUSAK,
            pesan="Berkas kosong (0 byte).",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    return buffer


def validasi_dan_buka_citra(buffer: bytes) -> Tuple[Image.Image, str]:
    """Memvalidasi dan membuka citra murni di memori melalui tahapan murah ke mahal.

    Urutan:
    3. Cek magic bytes biner (tolak SVG dan format non-gambar).
    4. Baca dimensi dari header SEBELUM dekode penuh (cegah decompression bomb).
    5. Dekode dengan Pillow di memori (verify/load) dengan penanganan galat ketat.
    6. Tolak animasi/multi-frame, transposisi EXIF, hapus metadata demi privasi.
    """
    # 3. Deteksi Magic Bytes
    format_terdeteksi = deteksi_magic_bytes(buffer[:16])

    # Deteksi spesifik SVG untuk pesan penolakan format yang jelas
    header_awal = buffer[:64].lower()
    if (
        b"<svg" in header_awal
        or b"<?xml" in header_awal
        or b"<!doctype svg" in header_awal
    ):
        raise GalatAplikasi(
            kode=KodeGalat.FORMAT_TIDAK_DIDUKUNG,
            pesan="Format SVG berbasis vektor tidak didukung demi keamanan sistem.",
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        )

    if not format_terdeteksi:
        raise GalatAplikasi(
            kode=KodeGalat.FORMAT_TIDAK_DIDUKUNG,
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        )

    # 4. Baca Dimensi Header Sebelum Dekode Penuh
    aliran_memori = io.BytesIO(buffer)
    try:
        citra_mentah = Image.open(aliran_memori)
    except Exception:
        raise GalatAplikasi(
            kode=KodeGalat.BERKAS_RUSAK,
            pesan="Header citra rusak atau tidak dapat diuraikan.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    lebar, tinggi = citra_mentah.size
    total_piksel = lebar * tinggi

    if lebar > konfigurasi.DIMENSI_MAKS_SISI or tinggi > konfigurasi.DIMENSI_MAKS_SISI:
        raise GalatAplikasi(
            kode=KodeGalat.DIMENSI_TERLALU_BESAR,
            pesan=f"Dimensi citra ({lebar}x{tinggi} px) melebihi batas maksimum 4096 px.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if total_piksel > konfigurasi.TOTAL_PIKSEL_MAKS:
        raise GalatAplikasi(
            kode=KodeGalat.PIKSEL_TERLALU_BANYAK,
            pesan=f"Total piksel ({total_piksel:,} piksel) melebihi batas aman pemrosesan (16 juta piksel).",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Pastikan format Pillow cocok dengan format magic bytes
    if citra_mentah.format != format_terdeteksi and not (
        citra_mentah.format == "JPEG" and format_terdeteksi == "JPEG"
    ):
        raise GalatAplikasi(
            kode=KodeGalat.FORMAT_TIDAK_DIDUKUNG,
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        )

    # 6. Tolak Citra Animasi / Multi-frame (APNG, Animated WebP, GIF)
    is_animated = getattr(citra_mentah, "is_animated", False)
    n_frames = getattr(citra_mentah, "n_frames", 1)
    if is_animated or n_frames > 1:
        raise GalatAplikasi(
            kode=KodeGalat.FORMAT_TIDAK_DIDUKUNG,
            pesan="Citra multi-frame atau animasi tidak didukung.",
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        )

    # 5. Dekode Penuh Pillow & Tangani DecompressionBomb
    try:
        citra_mentah.load()
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise GalatAplikasi(
            kode=KodeGalat.PIKSEL_TERLALU_BANYAK,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    except Exception:
        raise GalatAplikasi(
            kode=KodeGalat.BERKAS_RUSAK,
            pesan="Data piksel citra terpotong atau rusak.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Penanganan Orientasi EXIF: transposisi visual agar tegak lurus
    try:
        citra_tegak = ImageOps.exif_transpose(citra_mentah)
        if citra_tegak is not None:
            citra_mentah = citra_tegak
    except Exception:
        pass  # Jika EXIF korup, abaikan transposisi dan gunakan orientasi bawaan

    # Privasi Pengguna (OWASP A04): Buang seluruh metadata EXIF
    citra_mentah.info.pop("exif", None)

    # Normalisasi Mode Warna:
    # Mode RGBA dipertahankan untuk transparansi (alfa)
    # Mode Palet ('P') atau Grayscale ('L') atau RGB dikonversi secara tepat
    if citra_mentah.mode == "RGBA":
        citra_hasil = citra_mentah
    elif citra_mentah.mode == "P":
        # Jika palet memiliki transparansi, konversi ke RGBA; jika tidak, RGB
        if "transparency" in citra_mentah.info:
            citra_hasil = citra_mentah.convert("RGBA")
        else:
            citra_hasil = citra_mentah.convert("RGB")
    elif citra_mentah.mode in ("RGB", "L"):
        citra_hasil = citra_mentah.convert("RGB")
    else:
        citra_hasil = citra_mentah.convert("RGB")

    return citra_hasil, format_terdeteksi
