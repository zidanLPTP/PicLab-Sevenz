"""Aplikasi utama FastAPI untuk PicLab Sevenz (spec.md bagian 12 & Tahap 6)."""

import cv2
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.inti.galat import daftarkan_penangan_galat
from app.inti.keamanan import MiddlewareKeamanan
from app.inti.konfigurasi import konfigurasi
from app.inti.pencatat import MiddlewareLogPrivasi
from app.rute.frekuensi import router as router_frekuensi
from app.rute.kesehatan import router as router_kesehatan
from app.rute.kontur import router as router_kontur
from app.rute.morfologi import router as router_morfologi
from app.rute.noise import router as router_noise
from app.rute.segmentasi import router as router_segmentasi
from app.rute.tepi import router as router_tepi
from app.rute.uji import router as router_uji

# Batasi penggunaan utas internal OpenCV agar tidak melahap kuota CPU di lingkungan bersama
cv2.setNumThreads(2)


def buat_aplikasi() -> FastAPI:
    """Membuat dan mengonfigurasi instans aplikasi FastAPI dengan standar keamanan OWASP."""
    app = FastAPI(
        title=konfigurasi.NAMA_PROYEK,
        version=konfigurasi.VERSI,
        description=konfigurasi.DESKRIPSI,
        # Di lingkungan produksi, nonaktifkan dokumentasi OpenAPI interaktif
        docs_url=None if konfigurasi.PRODUKSI else "/docs",
        redoc_url=None if konfigurasi.PRODUKSI else "/redoc",
        openapi_url=None if konfigurasi.PRODUKSI else "/openapi.json",
    )

    # 1. Daftarkan Middleware Logging Privasi Terstruktur (Bebas IP, Bebas Query)
    app.add_middleware(MiddlewareLogPrivasi)

    # 2. Daftarkan Middleware Keamanan (Security Headers & Rate Limiting)
    app.add_middleware(MiddlewareKeamanan)

    # 3. Middleware CORS Ketat (Hanya origin terdaftar, tanpa wildcard *, tanpa credentials)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=konfigurasi.ORIGIN_DIIZINKAN,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # 4. Daftarkan Penangan Pengecualian Global Berformat Baku
    daftarkan_penangan_galat(app)

    # 5. Mendaftarkan Rute-rute API Aplikasi
    app.include_router(router_kesehatan)
    app.include_router(router_tepi)
    app.include_router(router_kontur)
    app.include_router(router_morfologi)
    app.include_router(router_segmentasi)
    app.include_router(router_noise)
    app.include_router(router_frekuensi)
    app.include_router(router_uji)

    return app


aplikasi = buat_aplikasi()

if __name__ == "__main__":
    uvicorn.run(
        "app.utama:aplikasi",
        host=konfigurasi.HOST,
        port=konfigurasi.PORT,
        reload=not konfigurasi.PRODUKSI,
        access_log=False,
        server_header=False,
    )
