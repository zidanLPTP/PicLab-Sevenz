"""Pengujian jaminan privasi dan zero disk footprint (Agent.md bagian 7 & spec.md bagian 10).

Membuktikan bahwa TIDAK ADA penulisan berkas ke direktori kerja atau direktori sementara (tmp),
dan tidak ada sisa berkas apapun setelah permintaan sukses maupun gagal.
"""

import io
import os
import tempfile
from unittest.mock import patch

from fastapi import status
from fastapi.testclient import TestClient
from PIL import Image

from app.utama import aplikasi

klien = TestClient(aplikasi)


def buat_citra_png() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (30, 30), (255, 128, 0))
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_tidak_ada_berkas_tersisa_di_disk_setelah_permintaan_sukses():
    """Memverifikasi bahwa direktori temp dan working dir tidak bertambah berkas setelah request sukses."""
    dir_tmp = tempfile.gettempdir()
    daftar_tmp_awal = set(os.listdir(dir_tmp))
    daftar_kerja_awal = set(os.listdir("."))

    citra = buat_citra_png()
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("uji.png", citra, "image/png")},
        data={"balik_horizontal": "true"},
    )
    assert respons.status_code == status.HTTP_200_OK

    daftar_tmp_akhir = set(os.listdir(dir_tmp))
    daftar_kerja_akhir = set(os.listdir("."))

    # Periksa berkas baru di tmp
    berkas_baru_tmp = daftar_tmp_akhir - daftar_tmp_awal
    berkas_baru_kerja = daftar_kerja_akhir - daftar_kerja_awal

    assert len(berkas_baru_tmp) == 0, (
        f"Ditemukan berkas tersisa di temp: {berkas_baru_tmp}"
    )
    assert len(berkas_baru_kerja) == 0, (
        f"Ditemukan berkas tersisa di workspace: {berkas_baru_kerja}"
    )


def test_tidak_ada_berkas_tersisa_di_disk_setelah_permintaan_gagal():
    """Memverifikasi bahwa penolakan berkas rusak/terlalu besar tidak meninggalkan residu di disk."""
    dir_tmp = tempfile.gettempdir()
    daftar_tmp_awal = set(os.listdir(dir_tmp))

    # Kirim muatan rusak
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("rusak.png", b"data_rusak_bukan_citra", "image/png")},
    )
    assert respons.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE

    daftar_tmp_akhir = set(os.listdir(dir_tmp))
    berkas_baru_tmp = daftar_tmp_akhir - daftar_tmp_awal
    assert len(berkas_baru_tmp) == 0


def test_jalur_pemrosesan_tidak_memanggil_tempfile_namedtemporaryfile():
    """Memverifikasi bahwa pemrosesan citra murni di memori dan tidak memanggil NamedTemporaryFile."""
    with patch("tempfile.NamedTemporaryFile") as mock_tmp:
        citra = buat_citra_png()
        respons = klien.post(
            "/api/uji/gema",
            files={"gambar": ("uji.png", citra, "image/png")},
        )
        assert respons.status_code == status.HTTP_200_OK
        assert not mock_tmp.called, "NamedTemporaryFile seharusnya TIDAK dipanggil!"
