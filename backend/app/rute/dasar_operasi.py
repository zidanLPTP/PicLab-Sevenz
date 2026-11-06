"""Modul pembantu eksekusi operasi citra server dengan isolasi memori dan semafor."""

import asyncio
import io
import time
from typing import Any, Callable, Dict, Tuple

import numpy as np
from fastapi import Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from PIL import Image

from app.inti.galat import GalatAplikasi, KodeGalat
from app.inti.keamanan import pembatas_konkurensi
from app.inti.konfigurasi import konfigurasi
from app.layanan.validasi_berkas import (
    baca_dan_validasi_stream,
    validasi_dan_buka_citra,
)


def encode_citra_png(array_np: np.ndarray) -> Tuple[bytes, int, int]:
    """Mengonversi array NumPy citra ke byte buffer PNG di memori tanpa menyentuh disk."""
    hasil_pil = Image.fromarray(array_np)
    buffer_out = io.BytesIO()
    # Simpan sebagai PNG murni tanpa metadata (EXIF/GPS/ICC dihapus otomatis)
    hasil_pil.save(buffer_out, format="PNG", optimize=False)
    buffer_out.seek(0)
    lebar, tinggi = hasil_pil.size
    return buffer_out.getvalue(), lebar, tinggi


async def eksekusi_operasi_citra(
    berkas_gambar: UploadFile,
    nama_operasi: str,
    fungsi_komputasi: Callable[..., Any],
    argumen_fungsi: Dict[str, Any],
    header_tambahan: Dict[str, str] | None = None,
    batas_waktu_detik: float | None = None,
) -> Response:
    """Mengelola alur pemrosesan citra server: semafor, pembatasan stream, timeout, dan encoding PNG murni.

    Pelepasan semafor dijamin terjadi HANYA setelah komputasi di threadpool selesai secara riil (M4 a).
    """
    if pembatas_konkurensi.locked():
        raise GalatAplikasi(
            kode=KodeGalat.SERVER_SIBUK,
            pesan="Server sedang memproses beban maksimal permintaan serentak. Coba sesaat lagi.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # 1. Baca dan validasi ukuran stream berkas masuk (maks 10 MB)
    buffer_mentah = await baca_dan_validasi_stream(
        berkas_gambar, konfigurasi.UKURAN_BERKAS_MAKS_BYTE
    )

    timeout_aktif = batas_waktu_detik or konfigurasi.BATAS_WAKTU_DETIK
    loop = asyncio.get_running_loop()

    # Kunci semafor konkurensi (BATAS_PERMINTAAN_SERENTAK = 2)
    await pembatas_konkurensi.acquire()
    semafor_dilepas = False

    def runner_sinkron() -> Tuple[bytes, int, int, Dict[str, str]]:
        nonlocal semafor_dilepas
        try:
            waktu_mulai = time.perf_counter()
            # Decode HANYA melalui Pillow (bukan cv2.imdecode), amankan dari bom dekompresi
            citra_pil, _ = validasi_dan_buka_citra(bytes(buffer_mentah))
            array_piksel = np.array(citra_pil)

            hasil = fungsi_komputasi(array_piksel, **argumen_fungsi)
            info_ekstra: Dict[str, str] = {}
            if isinstance(hasil, tuple):
                array_hasil, ekstra = hasil
                if isinstance(ekstra, (int, float, str)):
                    info_ekstra["X-Info-Operasi"] = str(ekstra)
                elif isinstance(ekstra, list):
                    info_ekstra["X-Info-Operasi"] = ",".join(str(x) for x in ekstra)
            else:
                array_hasil = hasil

            # Encode HANYA melalui Pillow ke format PNG murni tanpa metadata
            png_bytes, lebar, tinggi = encode_citra_png(array_hasil)
            durasi_ms = (time.perf_counter() - waktu_mulai) * 1000.0
            info_ekstra["X-Waktu-Proses-Ms"] = f"{durasi_ms:.2f}"
            return png_bytes, lebar, tinggi, info_ekstra
        finally:
            # Semafor DILEPAS HANYA saat thread komputasi selesai sepenuhnya (M4 a)
            if not semafor_dilepas:
                semafor_dilepas = True
                loop.call_soon_threadsafe(pembatas_konkurensi.release)

    try:
        png_bytes, lebar, tinggi, info_ekstra = await asyncio.wait_for(
            run_in_threadpool(runner_sinkron),
            timeout=timeout_aktif,
        )
    except asyncio.TimeoutError:
        raise GalatAplikasi(
            kode=KodeGalat.BATAS_WAKTU_HABIS,
            pesan="Waktu komputasi melebihi batas yang diizinkan server.",
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
        )

    headers = {
        "X-Lebar": str(lebar),
        "X-Tinggi": str(tinggi),
        "X-Format-Keluaran": "PNG",
        "X-Operasi": nama_operasi,
    }
    headers.update(info_ekstra)
    if header_tambahan:
        headers.update(header_tambahan)

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers=headers,
    )
