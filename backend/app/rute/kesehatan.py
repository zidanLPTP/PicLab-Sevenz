"""Rute pemeriksaan kesehatan server PicLab Sevenz."""
from fastapi import APIRouter

from app.inti.konfigurasi import konfigurasi

perute = APIRouter(tags=["Kesehatan"])


@perute.get("/kesehatan")
async def periksa_kesehatan():
    """Mengembalikan status kesehatan backend API."""
    return {
        "status": "sehat",
        "pesan": "Layanan PicLab Sevenz berjalan dengan baik",
        "versi": konfigurasi.VERSI,
    }
