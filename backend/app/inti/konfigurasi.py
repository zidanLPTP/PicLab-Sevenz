"""Modul konfigurasi inti backend PicLab Sevenz (spec.md bagian 8 & Tahap 5).

Menyediakan sumber kebenaran tunggal untuk seluruh batasan keamanan berkas,
rate limiting, CORS, timeout, dan lingkungan eksekusi.
"""

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class KonfigurasiAplikasi:
    """Konfigurasi batas dan pengaturan aplikasi backend PicLab Sevenz."""

    NAMA_PROYEK: str = "PicLab Sevenz API"
    VERSI: str = "0.7.0"
    DESKRIPSI: str = "Backend API untuk aplikasi pengolahan citra digital PicLab Sevenz"

    HOST: str = os.getenv("HOST_BACKEND", "127.0.0.1")
    PORT: int = int(os.getenv("PORT_BACKEND", "8000"))

    # Batasan berkas (sinkron dengan spec.md bagian 8 & frontend konfigurasiBerkas.js)
    UKURAN_BERKAS_MAKS_BYTE: int = int(
        os.getenv("UKURAN_BERKAS_MAKS_BYTE", str(10 * 1024 * 1024))
    )  # 10 MB
    DIMENSI_MAKS_SISI: int = int(os.getenv("DIMENSI_MAKS_SISI", "4096"))  # 4096 px
    TOTAL_PIKSEL_MAKS: int = int(
        os.getenv("TOTAL_PIKSEL_MAKS", "16000000")
    )  # 16 Juta piksel (Batas global)

    # Batasan piksel khusus per operasi berat (spec.md bagian 13 & target < 5 detik)
    BATAS_PIKSEL_NLM: int = int(
        os.getenv("BATAS_PIKSEL_NLM", "4000000")
    )  # 4 Juta piksel untuk Non-Local Means

    # Format citra yang didukung
    TIPE_MIME_DIIZINKAN: tuple[str, ...] = (
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/bmp",
    )
    EKSTENSI_DIIZINKAN: tuple[str, ...] = ("jpg", "jpeg", "png", "webp", "bmp")

    # Pengaturan CORS (Ketat: hanya origin terdaftar, tanpa wildcard *)
    ORIGIN_DIIZINKAN: list[str] = field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.getenv(
                "ORIGIN_DIIZINKAN",
                "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
            ).split(",")
            if origin.strip()
        ]
    )

    # Keamanan & Perlindungan Beban Sumber Daya (Rate Limiting, Concurrency, Timeout)
    BATAS_LAJU_PER_MENIT: int = int(os.getenv("BATAS_LAJU_PER_MENIT", "60"))
    BATAS_PERMINTAAN_SERENTAK: int = int(os.getenv("BATAS_PERMINTAAN_SERENTAK", "2"))
    BATAS_WAKTU_DETIK: float = float(os.getenv("BATAS_WAKTU_DETIK", "15.0"))

    # Pengaturan Proxy Klien untuk Rate Limiting
    # Header X-Forwarded-For HANYA dipercaya bila PERCAYAI_PROXY=True DAN IP koneksi langsung ada di PROXY_TERPERCAYA.
    PERCAYAI_PROXY: bool = os.getenv("PERCAYAI_PROXY", "false").lower() == "true"
    PROXY_TERPERCAYA: list[str] = field(
        default_factory=lambda: [
            ip.strip()
            for ip in os.getenv("PROXY_TERPERCAYA", "127.0.0.1,::1").split(",")
            if ip.strip()
        ]
    )

    # Mode Produksi (menonaktifkan /docs, /redoc, /openapi.json)
    PRODUKSI: bool = (
        os.getenv("ENVIRONMENT", "development").lower() in ("production", "prod")
        or os.getenv("MODE_PRODUKSI", "false").lower() == "true"
    )


konfigurasi = KonfigurasiAplikasi()
