"""Aplikasi utama FastAPI untuk PicLab Sevenz."""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.inti.konfigurasi import konfigurasi
from app.rute.kesehatan import perute as perute_kesehatan


def buat_aplikasi() -> FastAPI:
    """Membuat dan mengonfigurasi instans aplikasi FastAPI."""
    app = FastAPI(
        title=konfigurasi.NAMA_PROYEK,
        version=konfigurasi.VERSI,
        description=konfigurasi.DESKRIPSI,
    )

    # Middleware CORS untuk komunikasi aman dengan frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=konfigurasi.ORIGIN_DIIZINKAN,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Mendaftarkan rute-rute aplikasi
    app.include_router(perute_kesehatan)

    return app


aplikasi = buat_aplikasi()

if __name__ == "__main__":
    uvicorn.run(
        "app.utama:aplikasi",
        host=konfigurasi.HOST,
        port=konfigurasi.PORT,
        reload=True,
    )
