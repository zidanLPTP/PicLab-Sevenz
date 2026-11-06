"""Titik masuk utama untuk menjalankan server backend."""

import os

import uvicorn

from app.inti.konfigurasi import konfigurasi
from app.utama import aplikasi

__all__ = ["aplikasi"]

if __name__ == "__main__":
    reload_aktif = (
        not konfigurasi.PRODUKSI and os.getenv("RELOAD", "false").lower() == "true"
    )
    uvicorn.run(
        "app.utama:aplikasi",
        host=konfigurasi.HOST,
        port=konfigurasi.PORT,
        reload=reload_aktif,
        access_log=False,  # Matikan log akses bawaan Uvicorn demi privasi (Zero IP Logging)
        server_header=False,  # Jangan kirim header 'server: uvicorn' demi keamanan
    )
