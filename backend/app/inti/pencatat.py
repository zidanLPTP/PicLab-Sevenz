"""Modul pencatat log terstruktur dan privasi tinggi PicLab Sevenz (spec.md bagian 10 & K2).

Menjamin privasi penuh pengguna dengan prinsip Zero Sensitive Logging:
- Tidak mencatat isi citra atau representasi biner
- Tidak mencatat nama berkas asli pengguna
- Tidak mencatat alamat IP pengguna (Zero IP logging)
- Mematikan log akses bawaan Uvicorn yang mencatat IP dan baris permintaan
- Hanya mencatat: Metode HTTP, Rute (tanpa query string), Status HTTP, dan Durasi (ms).
"""

import logging
import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("piclab.akses")
logger.setLevel(logging.INFO)

# Handler konsol dengan format bersih bebas IP
if not logger.handlers:
    ch = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    ch.setFormatter(formatter)
    logger.addHandler(ch)

# Bungkam log akses bawaan Uvicorn yang secara default mencatat IP klien dan query
uvicorn_access_logger = logging.getLogger("uvicorn.access")
uvicorn_access_logger.handlers.clear()
uvicorn_access_logger.propagate = False
uvicorn_access_logger.disabled = True


class MiddlewareLogPrivasi(BaseHTTPMiddleware):
    """Middleware pencatat log akses yang aman dan bebas kebocoran data pengguna."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        t_awal = time.perf_counter()
        metode = request.method
        # Catat HANYA path rute murni tanpa query string parameter
        rute = request.url.path

        respons = await call_next(request)

        durasi_ms = (time.perf_counter() - t_awal) * 1000.0
        status_code = respons.status_code

        # Catat ringkasan akses aman tanpa IP mentah, tanpa query string, tanpa nama berkas
        logger.info(f"{metode} {rute} - {status_code} - {durasi_ms:.2f}ms")

        return respons
