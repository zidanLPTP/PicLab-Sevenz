"""Pengujian sinkronisasi batasan antara backend Python dan frontend JavaScript (Tahap 5).

Memastikan nilai awal batasan berkas di backend/app/inti/konfigurasi.py
identik dengan frontend/src/utilitas/konfigurasiBerkas.js dan spec.md bagian 8.
"""

import re
from pathlib import Path

from app.inti.konfigurasi import konfigurasi


def test_sinkronisasi_batasan_klien_dan_server():
    """Memverifikasi bahwa konstanta batasan berkas frontend dan backend sinkron 100%."""
    jalur_js = (
        Path(__file__).parent.parent.parent
        / "frontend"
        / "src"
        / "utilitas"
        / "konfigurasiBerkas.js"
    )
    assert jalur_js.exists(), f"Berkas {jalur_js} tidak ditemukan!"

    isi_js = jalur_js.read_text(encoding="utf-8")

    # 1. Ukuran Maks Byte (10 * 1024 * 1024 = 10485760)
    match_ukuran = re.search(
        r"UKURAN_MAKS_BYTE:\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)", isi_js
    )
    assert match_ukuran, "UKURAN_MAKS_BYTE tidak ditemukan di JS"
    ukuran_js = (
        int(match_ukuran.group(1))
        * int(match_ukuran.group(2))
        * int(match_ukuran.group(3))
    )
    assert konfigurasi.UKURAN_BERKAS_MAKS_BYTE == ukuran_js == 10485760

    # 2. Dimensi Maks Sisi (4096)
    match_dimensi = re.search(r"DIMENSI_SISI_MAKS_PIKSEL:\s*(\d+)", isi_js)
    assert match_dimensi, "DIMENSI_SISI_MAKS_PIKSEL tidak ditemukan di JS"
    dimensi_js = int(match_dimensi.group(1))
    assert konfigurasi.DIMENSI_MAKS_SISI == dimensi_js == 4096

    # 3. Total Piksel Maks (16_000_000)
    match_piksel = re.search(r"TOTAL_PIKSEL_MAKS:\s*([\d_]+)", isi_js)
    assert match_piksel, "TOTAL_PIKSEL_MAKS tidak ditemukan di JS"
    piksel_js = int(match_piksel.group(1).replace("_", ""))
    assert konfigurasi.TOTAL_PIKSEL_MAKS == piksel_js == 16000000

    # 4. Format Ekstensi Didukung
    for ekstensi in konfigurasi.EKSTENSI_DIIZINKAN:
        assert f".{ekstensi}" in isi_js, f"Ekstensi {ekstensi} tidak ditemukan di JS"
