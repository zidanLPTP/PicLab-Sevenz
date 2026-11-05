"""Rute pemeriksaan kesehatan server (spec.md bagian 9 & Tahap 5)."""

from fastapi import APIRouter

from app.inti.konfigurasi import konfigurasi

router = APIRouter(tags=["Kesehatan"])


@router.get("/kesehatan", summary="Pemeriksaan status server")
async def periksa_kesehatan():
    """Mengembalikan status hidup server dan versi aplikasi tanpa rincian internal sistem."""
    return {
        "status": "sehat",
        "versi": konfigurasi.VERSI,
        "pesan": "Server backend PicLab Sevenz beroperasi normal.",
    }
