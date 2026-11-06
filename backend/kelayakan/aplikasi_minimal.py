"""Aplikasi FastAPI Minimal Mandiri untuk Uji Kelayakan Hosting (PicLab Sevenz).

Menyediakan endpoint diagnostik kesehatan dan pengolahan citra murni di memori (RAM)
tanpa penulisan ke disk untuk menguji batas cgroup, CPU throttling, dan kompatibilitas Passenger/ASGI.
"""

import io
import os
import sys
import time
import tracemalloc

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from PIL import Image

try:
    import cv2
    import numpy as np

    OPENCV_TERSEDIA = True
except ImportError:
    OPENCV_TERSEDIA = False

app = FastAPI(
    title="PicLab Sevenz - Minimal Hosting Benchmark",
    description="Endpoint diagnostik mandiri untuk pengujian hosting cPanel / VPS",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Lebar", "X-Tinggi", "X-Durasi-Ms", "X-Puncak-Memori-KB"],
)

UKURAN_MAKS_BYTE = 10 * 1024 * 1024  # 10 MB
DIMENSI_MAKS_PX = 4096
PIKSEL_MAKS = 16_000_000


@app.get("/kesehatan")
def get_kesehatan():
    """Mengembalikan status lingkungan Python dan alokasi memori proses."""
    memori_info = {}
    try:
        import resource

        usage = resource.getrusage(resource.RUSAGE_SELF)
        memori_info["maxrss_kb"] = usage.ru_maxrss
    except ImportError:
        memori_info["maxrss_kb"] = None

    return {
        "status": "sehat",
        "layanan": "piclab-hosting-uji",
        "versi": "0.1.0",
        "python": sys.version,
        "pid": os.getpid(),
        "opencv_tersedia": OPENCV_TERSEDIA,
        "memori": memori_info,
        "waktu_server_utc": time.strftime(
            "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
        ),
    }


@app.post("/api/uji-gambar")
async def pos_uji_gambar(
    gambar: UploadFile = File(...),
    operasi: str = Form("canny"),
    treshold1: float = Form(100.0),
    treshold2: float = Form(200.0),
):
    """Menerima citra, memproses di RAM (Canny / Inversi / Flip), dan mengembalikan hasil PNG."""
    tracemalloc.start()
    t_mulai = time.perf_counter()

    try:
        # 1. Baca byte citra dari upload stream dengan batas ukuran
        isi = await gambar.read(UKURAN_MAKS_BYTE + 1)
        if len(isi) > UKURAN_MAKS_BYTE:
            return JSONResponse(
                status_code=413,
                content={
                    "kode": "BERKAS_TERLALU_BESAR",
                    "pesan": "Ukuran citra melebihi batas 10 MB.",
                },
            )
        if len(isi) == 0:
            return JSONResponse(
                status_code=400,
                content={
                    "kode": "BERKAS_KOSONG",
                    "pesan": "Berkas citra kosong.",
                },
            )

        # 2. Dekode citra di memori via Pillow
        stream_masuk = io.BytesIO(isi)
        try:
            with Image.open(stream_masuk) as citra:
                citra.verify()
        except Exception:
            return JSONResponse(
                status_code=415,
                content={
                    "kode": "BERKAS_RUSAK",
                    "pesan": "Format atau struktur berkas citra tidak valid.",
                },
            )

        stream_masuk.seek(0)
        with Image.open(stream_masuk) as citra:
            lebar, tinggi = citra.size
            if lebar > DIMENSI_MAKS_PX or tinggi > DIMENSI_MAKS_PX:
                return JSONResponse(
                    status_code=400,
                    content={
                        "kode": "DIMENSI_TERLALU_BESAR",
                        "pesan": f"Dimensi citra ({lebar}x{tinggi}) melebihi batas 4096 px.",
                    },
                )
            if lebar * tinggi > PIKSEL_MAKS:
                return JSONResponse(
                    status_code=400,
                    content={
                        "kode": "PIKSEL_TERLALU_BANYAK",
                        "pesan": f"Total piksel ({lebar * tinggi}) melebihi batas 16 MP.",
                    },
                )

            # Normalisasi ke RGB untuk pemrosesan
            citra_rgb = citra.convert("RGB")

        # 3. Pemrosesan Citra Murni di RAM
        stream_keluar = io.BytesIO()

        if operasi == "canny" and OPENCV_TERSEDIA:
            arr_np = np.array(citra_rgb)
            abu = cv2.cvtColor(arr_np, cv2.COLOR_RGB2GRAY)
            tepi = cv2.Canny(abu, int(treshold1), int(treshold2))
            citra_hasil = Image.fromarray(tepi)
        elif operasi == "flip":
            citra_hasil = citra_rgb.transpose(Image.FLIP_LEFT_RIGHT)
        else:
            # Fallback jika OpenCV tidak ada: balik horizontal
            citra_hasil = citra_rgb.transpose(Image.FLIP_LEFT_RIGHT)

        citra_hasil.save(stream_keluar, format="PNG", optimize=False)
        byte_keluar = stream_keluar.getvalue()

        t_selesai = time.perf_counter()
        durasi_ms = round((t_selesai - t_mulai) * 1000, 2)
        _, puncak_byte = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        return Response(
            content=byte_keluar,
            media_type="image/png",
            headers={
                "X-Lebar": str(lebar),
                "X-Tinggi": str(tinggi),
                "X-Durasi-Ms": str(durasi_ms),
                "X-Puncak-Memori-KB": str(round(puncak_byte / 1024, 1)),
            },
        )

    except Exception as err:
        tracemalloc.stop()
        return JSONResponse(
            status_code=500,
            content={
                "kode": "GALAT_INTERNAL",
                "pesan": f"Terjadi kesalahan pemrosesan citra: {str(err)}",
            },
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
