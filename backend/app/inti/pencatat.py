"""Modul pencatat log terstruktur dan privasi tinggi PicLab Sevenz (Agent.md bagian 7 & spec.md bagian 10).

Menjamin privasi pengguna dengan prinsip Zero Sensitive Logging:
- Tidak mencatat isi citra atau representasi biner
- Tidak mencatat nama berkas asli pengguna
- Tidak mencatat alamat IP mentah pengguna (Zero IP logging)
- Hanya mencatat: Metode HTTP, Rute, Status HTTP, Durasi (ms), dan Kode Galat.
"""

import logging
import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("piclab.akses")
logger.setLevel(logging.INFO)

# Handler konsol dengan format bersih
if not logger.handlers:
    ch = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    ch.setFormatter(formatter)
    logger.addHandler(ch)


class MiddlewareLogPrivasi(BaseHTTPMiddleware):
    """Middleware pencatat log akses yang aman dan bebas kebocoran data pengguna."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        t_awal = time.perf_counter()
        metode = request.method
        rute = request.url.path

        respons = await call_next(request)

        durasi_ms = (time.perf_counter() - t_awal) * 1000.0
        status_code = respons.status_code

        # Catat ringkasan akses aman tanpa IP mentah atau nama berkas
        logger.info(f"{metode} {rute} - {status_code} - {durasi_ms:.2f}ms")

        return respons
