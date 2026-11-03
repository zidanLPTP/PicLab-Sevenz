"""Modul konfigurasi inti backend PicLab Sevenz."""
import os


class KonfigurasiAplikasi:
    """Konfigurasi dasar aplikasi PicLab Sevenz."""

    NAMA_PROYEK: str = "PicLab Sevenz API"
    VERSI: str = "0.1.0"
    DESKRIPSI: str = "Backend API untuk aplikasi pengolahan citra digital PicLab Sevenz"

    HOST: str = os.getenv("HOST_BACKEND", "127.0.0.1")
    PORT: int = int(os.getenv("PORT_BACKEND", "8000"))

    # Pengaturan CORS
    ORIGIN_DIIZINKAN: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "ORIGIN_DIIZINKAN", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ]


konfigurasi = KonfigurasiAplikasi()
