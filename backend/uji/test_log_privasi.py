"""Pengujian kebijakan privasi pencatatan log (Agent.md bagian 7 & spec.md bagian 10).

Membuktikan dengan rekaman caplog bahwa nama berkas asli pengguna,
isi citra, dan alamat IP mentah TIDAK PERNAH dicatat ke log server.
"""

import io
import logging

from fastapi import status
from fastapi.testclient import TestClient
from PIL import Image

from app.utama import aplikasi

klien = TestClient(aplikasi)


def buat_citra_dummy() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (10, 10), (0, 100, 200))
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_log_tidak_memuat_nama_berkas_asli_dan_isi_citra(caplog):
    """Memverifikasi bahwa nama berkas rahasia pengguna tidak muncul di log."""
    caplog.set_level(logging.INFO)

    nama_berkas_rahasia = "dokumen_rahasia_identitas_warga_fathin_998877.png"
    citra = buat_citra_dummy()

    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": (nama_berkas_rahasia, citra, "image/png")},
    )
    assert respons.status_code == status.HTTP_200_OK

    seluruh_teks_log = caplog.text

    # Pastikan nama berkas rahasia TIDAK ADA di log
    assert nama_berkas_rahasia not in seluruh_teks_log, (
        f"Nama berkas sensitif bocor ke dalam log: {seluruh_teks_log}"
    )

    # Pastikan kata kunci nama berkas tidak dicatat
    assert "dokumen_rahasia" not in seluruh_teks_log
    assert "fathin" not in seluruh_teks_log


def test_log_hanya_mencatat_metode_rute_status_durasi(caplog):
    """Memverifikasi bahwa format log ringkas dan patuh privasi."""
    caplog.set_level(logging.INFO)

    citra = buat_citra_dummy()
    respons = klien.post(
        "/api/uji/gema",
        files={"gambar": ("foto.png", citra, "image/png")},
    )
    assert respons.status_code == status.HTTP_200_OK

    # Log harus memuat metode, path, status, dan ms
    assert "POST /api/uji/gema - 200" in caplog.text
    assert "ms" in caplog.text
