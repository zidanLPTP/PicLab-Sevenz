"""Rute percobaan integrasi klien-server (Tahap 5).

Menyediakan endpoint POST /api/uji/gema untuk memvalidasi jalur lengkap unggahan,
validasi ketat, eksekusi pemrosesan murni di memori, dan pengembalian citra PNG.
"""

import asyncio
import io

import numpy as np
from fastapi import APIRouter, File, Form, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from PIL import Image

from app.inti.galat import GalatAplikasi, KodeGalat
from app.inti.keamanan import pembatas_konkurensi
from app.inti.konfigurasi import konfigurasi
from app.layanan.validasi_berkas import (
    baca_dan_validasi_stream,
    validasi_dan_buka_citra,
)

router = APIRouter(prefix="/api/uji", tags=["Uji Jalur Integrasi"])


def proses_gema_di_memori(
    buffer_bytes: bytes, balik_horizontal: bool
) -> tuple[bytes, int, int]:
    """Memproses citra murni di memori via Pillow dan NumPy (Threadpool CPU-bound).

    Tidak ada penulisan berkas ke disk sama sekali (0 bytes written).
    """
    citra_pil, _ = validasi_dan_buka_citra(buffer_bytes)

    # Konversi ke NumPy array untuk manipulasi piksel murni
    array_piksel = np.array(citra_pil)

    if balik_horizontal:
        # Pembalikan horizontal (sumbu x / kolom)
        array_piksel = np.fliplr(array_piksel)

    # Kembalikan ke objek Pillow dan encode sebagai PNG lossless di memori
    hasil_pil = Image.fromarray(array_piksel)
    buffer_keluaran = io.BytesIO()
    hasil_pil.save(buffer_keluaran, format="PNG", optimize=False)
    buffer_keluaran.seek(0)

    lebar, tinggi = hasil_pil.size
    return buffer_keluaran.getvalue(), lebar, tinggi


@router.post(
    "/gema",
    summary="Endpoint percobaan validasi dan pemrosesan citra murni di memori",
    response_class=Response,
    responses={
        200: {
            "content": {"image/png": {}},
            "description": "Citra hasil pembalikan horizontal dalam format PNG.",
        },
        400: {"description": "Berkas rusak atau dimensi melebihi batas."},
        413: {"description": "Ukuran berkas melebihi batas maksimum 10 MB."},
        415: {"description": "Format berkas tidak didukung atau berupa SVG/animasi."},
        429: {"description": "Terlalu banyak permintaan (Rate limit terlampaui)."},
        503: {"description": "Server sibuk (Batas konkurensi terlampaui)."},
        504: {"description": "Batas waktu pemrosesan terlampaui (Timeout)."},
    },
)
async def uji_gema_gambar(
    gambar: UploadFile = File(..., description="Berkas citra masukan"),
    balik_horizontal: bool = Form(
        default=True, description="Pilihan membalik citra secara horizontal"
    ),
):
    """Menerima berkas citra, melakukan validasi penuh berperingkat murah-ke-mahal,

    dan membalik horizontal murni di memori (zero disk footprint).
    """
    # 1. Lindungi Server dari Overload Concurrency (Semaphore non-blocking)
    if pembatas_konkurensi.locked():
        raise GalatAplikasi(
            kode=KodeGalat.SERVER_SIBUK,
            pesan="Server sedang memproses beban maksimal permintaan serentak. Coba sesaat lagi.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    async with pembatas_konkurensi:
        # 2. Baca Stream dengan Batas Keras 10 MB
        buffer_mentah = await baca_dan_validasi_stream(
            gambar, konfigurasi.UKURAN_BERKAS_MAKS_BYTE
        )

        # 3. Jalankan Operasi CPU Berat di Threadpool dengan Batas Waktu Timeout
        try:
            png_bytes, lebar, tinggi = await asyncio.wait_for(
                run_in_threadpool(
                    proses_gema_di_memori, bytes(buffer_mentah), balik_horizontal
                ),
                timeout=konfigurasi.BATAS_WAKTU_DETIK,
            )
        except asyncio.TimeoutError:
            raise GalatAplikasi(
                kode=KodeGalat.BATAS_WAKTU_HABIS,
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            )

        # 4. Kirim Citra PNG dengan Header Metadata
        return Response(
            content=png_bytes,
            media_type="image/png",
            headers={
                "X-Lebar": str(lebar),
                "X-Tinggi": str(tinggi),
                "X-Format-Keluaran": "PNG",
                "X-Operasi": "gema_balik_horizontal",
            },
        )


@router.get(
    "/simulasi-galat-internal",
    summary="Simulasi kesalahan internal tak terduga untuk pengujian respon 500",
    include_in_schema=False,
)
async def rute_simulasi_galat_internal():
    """Memicu eksepsi runtime tak terduga untuk memverifikasi penanganan galat 500."""
    raise RuntimeError(
        "Simulasi crash internal untuk memverifikasi Zero Information Leakage."
    )
