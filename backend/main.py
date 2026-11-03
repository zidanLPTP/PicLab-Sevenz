"""Titik masuk utama untuk menjalankan server backend."""
import uvicorn

from app.inti.konfigurasi import konfigurasi
from app.utama import aplikasi

__all__ = ["aplikasi"]

if __name__ == "__main__":
    uvicorn.run(
        "app.utama:aplikasi",
        host=konfigurasi.HOST,
        port=konfigurasi.PORT,
        reload=True,
    )

