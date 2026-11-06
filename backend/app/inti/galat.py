"""Modul penanganan galat terstandarisasi PicLab Sevenz (spec.md bagian 11 & Tahap 5).

Menyediakan kelas eksepsi kustom dan penangan galat global untuk memastikan
seluruh respons galat berbentuk: { "kode": "...", "pesan": "..." } tanpa membocorkan
detail internal sistem (OWASP A03 / A05).
"""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


# Konstanta Kode Galat Baku
class KodeGalat:
    BERKAS_TERLALU_BESAR = "BERKAS_TERLALU_BESAR"
    FORMAT_TIDAK_DIDUKUNG = "FORMAT_TIDAK_DIDUKUNG"
    BERKAS_RUSAK = "BERKAS_RUSAK"
    DIMENSI_TERLALU_BESAR = "DIMENSI_TERLALU_BESAR"
    PIKSEL_TERLALU_BANYAK = "PIKSEL_TERLALU_BANYAK"
    PIKSEL_TERLALU_BANYAK_UNTUK_OPERASI = "PIKSEL_TERLALU_BANYAK_UNTUK_OPERASI"
    TERLALU_BANYAK_PERMINTAAN = "TERLALU_BANYAK_PERMINTAAN"
    PARAMETER_TIDAK_VALID = "PARAMETER_TIDAK_VALID"
    SERVER_SIBUK = "SERVER_SIBUK"
    BATAS_WAKTU_HABIS = "BATAS_WAKTU_HABIS"
    RUTE_TIDAK_DITEMUKAN = "RUTE_TIDAK_DITEMUKAN"
    METODE_TIDAK_DIIZINKAN = "METODE_TIDAK_DIIZINKAN"
    GALAT_INTERNAL = "GALAT_INTERNAL"


# Pesan Galat Aman untuk Pengguna (Bahasa Indonesia Ramah Pengguna Awam)
PESAN_GALAT_BAKU = {
    KodeGalat.BERKAS_TERLALU_BESAR: "Ukuran berkas melebihi batas maksimum yang diizinkan (10 MB).",
    KodeGalat.FORMAT_TIDAK_DIDUKUNG: "Format berkas tidak didukung. Harap gunakan berkas JPEG, PNG, WebP, atau BMP.",
    KodeGalat.BERKAS_RUSAK: "Berkas citra rusak atau tidak dapat didekode.",
    KodeGalat.DIMENSI_TERLALU_BESAR: "Dimensi sisi citra melebihi batas maksimum yang diizinkan (4096 piksel).",
    KodeGalat.PIKSEL_TERLALU_BANYAK: "Total piksel citra melebihi batas maksimum aman pemrosesan (16 juta piksel).",
    KodeGalat.PIKSEL_TERLALU_BANYAK_UNTUK_OPERASI: "Total piksel citra melebihi batas maksimum aman untuk operasi ini. Harap perkecil dimensi citra atau gunakan operasi lain.",
    KodeGalat.TERLALU_BANYAK_PERMINTAAN: "Terlalu banyak permintaan dalam waktu singkat. Silakan coba sesaat lagi.",
    KodeGalat.PARAMETER_TIDAK_VALID: "Parameter yang diberikan tidak valid atau berada di luar rentang yang diizinkan.",
    KodeGalat.SERVER_SIBUK: "Server sedang memproses beban maksimal. Silakan coba kembali sesaat lagi.",
    KodeGalat.BATAS_WAKTU_HABIS: "Batas waktu pemrosesan permintaan telah terlampaui.",
    KodeGalat.RUTE_TIDAK_DITEMUKAN: "Rute yang diminta tidak ditemukan di server.",
    KodeGalat.METODE_TIDAK_DIIZINKAN: "Metode HTTP tidak diizinkan untuk endpoint ini.",
    KodeGalat.GALAT_INTERNAL: "Terjadi kesalahan internal pada server. Silakan coba lagi.",
}


class GalatAplikasi(Exception):
    """Eksepsi dasar untuk galat bisnis dan validasi PicLab Sevenz."""

    def __init__(
        self,
        kode: str,
        pesan: str | None = None,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        headers: dict[str, str] | None = None,
    ):
        super().__init__(pesan or PESAN_GALAT_BAKU.get(kode, "Terjadi kesalahan."))
        self.kode = kode
        self.pesan = pesan or PESAN_GALAT_BAKU.get(kode, "Terjadi kesalahan.")
        self.status_code = status_code
        self.headers = headers or {}


def daftarkan_penangan_galat(app: FastAPI) -> None:
    """Mendaftarkan penangan pengecualian global pada aplikasi FastAPI."""

    @app.exception_handler(GalatAplikasi)
    async def tangani_galat_aplikasi(
        request: Request, exc: GalatAplikasi
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"kode": exc.kode, "pesan": exc.pesan},
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def tangani_galat_validasi_pydantic(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Menghindari membocorkan jejak tumpukan atau struktur internal schema
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "kode": KodeGalat.PARAMETER_TIDAK_VALID,
                "pesan": PESAN_GALAT_BAKU[KodeGalat.PARAMETER_TIDAK_VALID],
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def tangani_galat_starlette(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        headers = dict(exc.headers or {})
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            kode = KodeGalat.RUTE_TIDAK_DITEMUKAN
        elif exc.status_code == status.HTTP_405_METHOD_NOT_ALLOWED:
            kode = KodeGalat.METODE_TIDAK_DIIZINKAN
        elif exc.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE:
            kode = KodeGalat.BERKAS_TERLALU_BESAR
        elif exc.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE:
            kode = KodeGalat.FORMAT_TIDAK_DIDUKUNG
        elif exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            kode = KodeGalat.TERLALU_BANYAK_PERMINTAAN
        elif exc.status_code == status.HTTP_503_SERVICE_UNAVAILABLE:
            kode = KodeGalat.SERVER_SIBUK
        elif exc.status_code == status.HTTP_504_GATEWAY_TIMEOUT:
            kode = KodeGalat.BATAS_WAKTU_HABIS
        else:
            kode = KodeGalat.GALAT_INTERNAL

        pesan = PESAN_GALAT_BAKU.get(kode, "Terjadi kesalahan pada permintaan.")
        return JSONResponse(
            status_code=exc.status_code,
            content={"kode": kode, "pesan": pesan},
            headers=headers,
        )

    @app.exception_handler(Exception)
    async def tangani_galat_tak_terduga(
        request: Request, exc: Exception
    ) -> JSONResponse:
        # Zero Information Leakage (OWASP A05): jangan pernah membocorkan traceback
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "kode": KodeGalat.GALAT_INTERNAL,
                "pesan": PESAN_GALAT_BAKU[KodeGalat.GALAT_INTERNAL],
            },
        )
