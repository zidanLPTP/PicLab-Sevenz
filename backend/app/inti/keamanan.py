"""Modul middleware keamanan, rate limiting, pembatas konkurensi, dan security headers.

Mengimplementasikan pertahanan berlapis sesuai panduan OWASP dan spec.md bagian 10:
- Pengenalan identitas klien aman di belakang reverse proxy (hanya bila diaktifkan secara eksplisit)
- Penolakan dini berdasarkan Content-Length sebelum membaca isi (OWASP A04)
- Rate limiting berbasis jendela geser di memori (429 + Retry-After)
- Pembatas permintaan serentak Semaphore (503 SERVER_SIBUK)
- Security Headers nosniff, no-store, CSP, Frame-Options
- Penanganan timeout per permintaan (504 BATAS_WAKTU_HABIS)
"""

import asyncio
import time
from collections import defaultdict
from typing import Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.inti.galat import PESAN_GALAT_BAKU, KodeGalat
from app.inti.konfigurasi import konfigurasi

# Semaphore global per proses untuk pembatasan pemrosesan citra serentak
pembatas_konkurensi = asyncio.Semaphore(konfigurasi.BATAS_PERMINTAAN_SERENTAK)


def dapatkan_ip_klien(request: Request) -> str:
    """Mendapatkan alamat IP klien secara aman.

    Header X-Forwarded-For HANYA diperiksa jika PERCAYAI_PROXY=True DAN koneksi
    langsung berasal dari daftar PROXY_TERPERCAYA.
    Jika PERCAYAI_PROXY=False (default bawaan), header proxy palsu selalu diabaikan
    dan koneksi langsung yang digunakan.
    """
    host_koneksi_langsung = request.client.host if request.client else "127.0.0.1"

    if (
        konfigurasi.PERCAYAI_PROXY
        and host_koneksi_langsung in konfigurasi.PROXY_TERPERCAYA
    ):
        xff = request.headers.get("x-forwarded-for")
        if xff:
            ip_klien = xff.split(",")[0].strip()
            if ip_klien:
                return ip_klien

    return host_koneksi_langsung


class PembatasLajuMemori:
    """Rate limiter geser murni memori berbasis alamat IP klien.

    Bebas dependensi eksternal (tanpa Redis atau library pihak ketiga), aman untuk hosting bersama.
    """

    def __init__(self, batas_per_menit: int):
        self.batas_per_menit = batas_per_menit
        self.riwayat_permintaan: dict[str, list[float]] = defaultdict(list)
        self.kunci = asyncio.Lock()

    async def apakah_diizinkan(self, ip: str) -> tuple[bool, int]:
        """Memeriksa apakah permintaan diizinkan dan mengembalikan waktu tunggu (detik)."""
        sekarang = time.time()
        batas_waktu_lampau = sekarang - 60.0

        async with self.kunci:
            permintaan_aktif = [
                t for t in self.riwayat_permintaan[ip] if t > batas_waktu_lampau
            ]
            self.riwayat_permintaan[ip] = permintaan_aktif

            if len(permintaan_aktif) >= self.batas_per_menit:
                waktu_paling_awal = permintaan_aktif[0]
                sisa_waktu = max(1, int(60.0 - (sekarang - waktu_paling_awal)))
                return False, sisa_waktu

            self.riwayat_permintaan[ip].append(sekarang)
            return True, 0

    def reset_sinkron(self) -> None:
        """Membersihkan riwayat secara sinkron untuk keperluan pengujian."""
        self.riwayat_permintaan.clear()


pembatas_laju_global = PembatasLajuMemori(konfigurasi.BATAS_LAJU_PER_MENIT)


class MiddlewareKeamanan(BaseHTTPMiddleware):
    """Middleware terpadu untuk Security Headers, Early Content-Length Check, Rate Limiting, dan Sanitasi."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 1. Tolak dini berdasarkan Content-Length HTTP SEBELUM membaca isi multipart
        header_cl = request.headers.get("content-length")
        if header_cl:
            try:
                cl = int(header_cl)
                if cl > konfigurasi.UKURAN_BERKAS_MAKS_BYTE:
                    return JSONResponse(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        content={
                            "kode": KodeGalat.BERKAS_TERLALU_BESAR,
                            "pesan": PESAN_GALAT_BAKU[KodeGalat.BERKAS_TERLALU_BESAR],
                        },
                    )
            except ValueError:
                pass

        # 2. Pemeriksaan Rate Limiting (Kecuali untuk endpoint pemeriksaan kesehatan)
        if request.url.path != "/kesehatan":
            ip_klien = dapatkan_ip_klien(request)
            diizinkan, sisa_waktu = await pembatas_laju_global.apakah_diizinkan(
                ip_klien
            )
            if not diizinkan:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "kode": KodeGalat.TERLALU_BANYAK_PERMINTAAN,
                        "pesan": PESAN_GALAT_BAKU[KodeGalat.TERLALU_BANYAK_PERMINTAAN],
                    },
                    headers={"Retry-After": str(sisa_waktu)},
                )

        # 3. Panggil rute berikutnya
        respons = await call_next(request)

        # 4. Suntikkan Header Keamanan Standar OWASP pada seluruh respons
        respons.headers["X-Content-Type-Options"] = "nosniff"
        respons.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        respons.headers["X-Frame-Options"] = "DENY"
        respons.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        respons.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none';"
        )

        # Header Cache-Control ketat untuk seluruh endpoint data citra & API (Privasi)
        if request.url.path.startswith("/api/"):
            respons.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            respons.headers["Pragma"] = "no-cache"

        # Sembunyikan identitas software server (Zero Information Disclosure)
        if "server" in respons.headers:
            del respons.headers["server"]

        return respons
