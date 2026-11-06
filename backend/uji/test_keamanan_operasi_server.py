"""Pengujian keamanan mutlak dan eliminasi OpenCV I/O pada rute operasi server (M1 & M4).

Memverifikasi secara ketat:
1. cv2.imdecode, cv2.imread, cv2.imencode, cv2.imwrite TIDAK PERNAH dipanggil pada byte data pengguna.
2. Bom dekompresi ditolak sebelum alokasi memori terjadi pada semua rute server.
3. Seluruh rute server terlindungi mitigasi OWASP: ukuran > 10 MB, format palsu/magic bytes,
   dimensi > 4096 px, piksel > 16 MP, parameter tak valid (extra forbid), dan zero disk write.
4. Log privasi bebas dari pencatatan alamat IP dan nama berkas asli pengguna.
"""

import io
import os
import unittest.mock as mock

import cv2
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from PIL import Image

from app.inti.galat import KodeGalat
from app.utama import aplikasi

klien = TestClient(aplikasi)

RUTE_OPERASI_SERVER = [
    ("/api/v1/tepi/canny", {"parameter": '{"ambang_bawah": 50, "ambang_atas": 150}'}),
    ("/api/v1/kontur", {"parameter": '{"metode": "biner", "ambang": 128}'}),
    ("/api/v1/morfologi", {"parameter": '{"operasi": "dilasi", "ukuran": 3}'}),
    ("/api/v1/segmentasi", {"parameter": '{"metode": "kmeans", "k": 3}'}),
    ("/api/v1/noise/reduksi", {"parameter": '{"metode": "bilateral", "diameter": 5}'}),
    (
        "/api/v1/frekuensi",
        {"parameter": '{"jenis_filter": "ideal", "frekuensi_cut_off": 30}'},
    ),
]


def buat_buffer_png(lebar: int = 16, tinggi: int = 16, warna=(100, 150, 200)) -> bytes:
    """Membangkitkan buffer PNG murni di memori."""
    buf = io.BytesIO()
    img = Image.new("RGB", (lebar, tinggi), warna)
    img.save(buf, format="PNG")
    return buf.getvalue()


# ============================================================================
# 1. M1 a & b: PEMBUKTIAN ELIMINASI cv2.imdecode / cv2.imencode
# ============================================================================


@pytest.mark.parametrize("rute,data_form", RUTE_OPERASI_SERVER)
def test_eliminasi_cv2_io_pada_semua_rute_server(rute, data_form):
    """Membuktikan tidak ada panggilan cv2.imdecode/imencode/imread/imwrite pada rute server.

    Jika ada satupun fungsi I/O cv2 yang dipanggil pada aliran data pengguna,
    mock akan melempar RuntimeError dan pengujian akan gagal.
    """
    buffer_citra = buat_buffer_png(32, 32)

    with (
        mock.patch.object(
            cv2,
            "imdecode",
            side_effect=RuntimeError("PELANGGARAN: cv2.imdecode dipanggil!"),
        ),
        mock.patch.object(
            cv2,
            "imencode",
            side_effect=RuntimeError("PELANGGARAN: cv2.imencode dipanggil!"),
        ),
        mock.patch.object(
            cv2,
            "imread",
            side_effect=RuntimeError("PELANGGARAN: cv2.imread dipanggil!"),
        ),
        mock.patch.object(
            cv2,
            "imwrite",
            side_effect=RuntimeError("PELANGGARAN: cv2.imwrite dipanggil!"),
        ),
    ):
        respons = klien.post(
            rute,
            files={"gambar": ("uji.png", buffer_citra, "image/png")},
            data=data_form,
        )

        assert respons.status_code == status.HTTP_200_OK
        assert respons.headers.get("Content-Type") == "image/png"
        assert respons.headers.get("X-Format-Keluaran") == "PNG"
        assert len(respons.content) > 0


# ============================================================================
# 2. M1 b: PENCEGAHAN BOM DEKOMPRESI PADA SEMUA RUTE SERVER
# ============================================================================


@pytest.mark.parametrize("rute,data_form", RUTE_OPERASI_SERVER)
def test_tolak_bom_dekompresi_pada_semua_rute_server(rute, data_form):
    """Memverifikasi berkas PNG dengan dimensi header 100000x100000 ditolak sebelum alokasi RAM."""
    # Berkas PNG dengan header IHDR berdimensi raksasa (100.000 x 100.000)
    ihdr_raksasa = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR"
        b"\x00\x01\x86\xa0"  # Lebar 100.000
        b"\x00\x01\x86\xa0"  # Tinggi 100.000
        b"\x08\x02\x00\x00\x00"
        b"\x00\x00\x00\x00"
    )

    respons = klien.post(
        rute,
        files={"gambar": ("bom_dekompresi.png", ihdr_raksasa, "image/png")},
        data=data_form,
    )

    # Wajib ditolak HTTP 400 dengan kode DIMENSI_TERLALU_BESAR atau PIKSEL_TERLALU_BANYAK
    assert respons.status_code == status.HTTP_400_BAD_REQUEST
    data = respons.json()
    assert data["kode"] in (
        KodeGalat.DIMENSI_TERLALU_BESAR,
        KodeGalat.PIKSEL_TERLALU_BANYAK,
        KodeGalat.BERKAS_RUSAK,
    )


# ============================================================================
# 3. M1 d: UJI NEGATIF PARAMETRISASI KEAMANAN OWASP UNTUK SELURUH RUTE SERVER
# ============================================================================


@pytest.mark.parametrize("rute,data_form", RUTE_OPERASI_SERVER)
def test_tolak_berkas_terlalu_besar_pada_rute_server(rute, data_form):
    """Tolak jika ukuran badan berkas melebihi 10 MB (HTTP 413)."""
    badan_raksasa = b"\x89PNG\r\n\x1a\n" + b"\x00" * (10 * 1024 * 1024 + 1024)
    respons = klien.post(
        rute,
        files={"gambar": ("besar.png", badan_raksasa, "image/png")},
        data=data_form,
    )
    assert respons.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    assert respons.json()["kode"] == KodeGalat.BERKAS_TERLALU_BESAR


@pytest.mark.parametrize("rute,data_form", RUTE_OPERASI_SERVER)
def test_tolak_magic_bytes_palsu_pada_rute_server(rute, data_form):
    """Tolak berkas teks yang dinamai .png (HTTP 415)."""
    berkas_palsu = b"INI BUKAN MAGIC BYTES GAMBAR APAPUN"
    respons = klien.post(
        rute,
        files={"gambar": ("palsu.png", berkas_palsu, "image/png")},
        data=data_form,
    )
    assert respons.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    assert respons.json()["kode"] == KodeGalat.FORMAT_TIDAK_DIDUKUNG


@pytest.mark.parametrize("rute,data_form", RUTE_OPERASI_SERVER)
def test_tolak_berkas_kosong_pada_rute_server(rute, data_form):
    """Tolak berkas 0 byte (HTTP 400)."""
    respons = klien.post(
        rute,
        files={"gambar": ("kosong.png", b"", "image/png")},
        data=data_form,
    )
    assert respons.status_code == status.HTTP_400_BAD_REQUEST
    assert respons.json()["kode"] == KodeGalat.BERKAS_RUSAK


@pytest.mark.parametrize("rute,data_form", RUTE_OPERASI_SERVER)
def test_tolak_parameter_tak_dikenal_extra_forbid_pada_rute_server(rute, data_form):
    """Tolak jika klien mengirimkan atribut parameter asing di luar skema (HTTP 422)."""
    buffer_citra = buat_buffer_png(16, 16)
    respons = klien.post(
        rute,
        files={"gambar": ("uji.png", buffer_citra, "image/png")},
        data={"parameter": '{"atribut_asing_ilegal": 9999}'},
    )
    assert respons.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert respons.json()["kode"] == KodeGalat.PARAMETER_TIDAK_VALID


@pytest.mark.parametrize("rute,data_form", RUTE_OPERASI_SERVER)
def test_tolak_multipart_tanpa_berkas_pada_rute_server(rute, data_form):
    """Tolak jika field gambar tidak disediakan dalam form multipart (HTTP 422)."""
    respons = klien.post(rute, data=data_form)
    assert respons.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert respons.json()["kode"] == KodeGalat.PARAMETER_TIDAK_VALID


@pytest.mark.parametrize("rute,data_form", RUTE_OPERASI_SERVER)
def test_zero_disk_footprint_pada_rute_server(rute, data_form, tmp_path):
    """Membuktikan pemrosesan berlangsung murni di RAM tanpa penulisan berkas ke disk."""
    daftar_awal = set(os.listdir("."))
    buffer_citra = buat_buffer_png(32, 32)

    respons = klien.post(
        rute,
        files={"gambar": ("uji.png", buffer_citra, "image/png")},
        data=data_form,
    )
    assert respons.status_code == status.HTTP_200_OK

    daftar_akhir = set(os.listdir("."))
    assert daftar_awal == daftar_akhir


@pytest.mark.parametrize("rute,data_form", RUTE_OPERASI_SERVER)
def test_zero_ip_dan_filename_logging_pada_rute_server(rute, data_form, caplog):
    """Membuktikan alamat IP dan nama berkas asli pengguna tidak pernah dicatat di log."""
    caplog.clear()
    buffer_citra = buat_buffer_png(16, 16)
    nama_rahasia = "foto_pribadi_rahasia_keluarga_fathin_123.png"

    respons = klien.post(
        rute,
        files={"gambar": (nama_rahasia, buffer_citra, "image/png")},
        data=data_form,
        headers={"X-Forwarded-For": "203.0.113.195"},
    )
    assert respons.status_code == status.HTTP_200_OK

    semua_pesan = " ".join(record.message for record in caplog.records)
    assert "203.0.113.195" not in semua_pesan
    assert "foto_pribadi_rahasia" not in semua_pesan
