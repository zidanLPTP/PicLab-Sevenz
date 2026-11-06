"""Rute operasi reduksi noise citra (Tahap 6)."""

from fastapi import APIRouter, File, Form, Response, UploadFile
from pydantic import ValidationError

from app.inti.galat import GalatAplikasi, KodeGalat
from app.layanan.operasi_noise import (
    reduksi_noise_bilateral,
    reduksi_noise_median,
    reduksi_noise_nlm,
)
from app.rute.dasar_operasi import eksekusi_operasi_citra
from app.skema.operasi_server import ParameterNoise

router = APIRouter(prefix="/api/v1/noise", tags=["Reduksi Noise"])


@router.post(
    "/reduksi",
    summary="Reduksi Noise Citra (Bilateral, NLM, Median)",
    response_class=Response,
    responses={
        200: {
            "content": {"image/png": {}},
            "description": "Citra tereduksi noise PNG.",
        },
        400: {"description": "Parameter tidak valid atau berkas rusak."},
        413: {"description": "Ukuran berkas melebihi 10 MB."},
        415: {"description": "Format berkas tidak didukung."},
        503: {"description": "Server sibuk."},
        504: {"description": "Batas waktu pemrosesan terlampaui."},
    },
)
async def endpoint_reduksi_noise(
    gambar: UploadFile = File(..., description="Berkas citra masukan"),
    parameter: str = Form(default="{}", description="JSON string parameter Noise"),
) -> Response:
    """Mereduksi noise pada citra menggunakan Bilateral filter, NLM denoising, atau filter Median."""
    try:
        skema = ParameterNoise.dari_json_form(parameter)
    except (ValueError, ValidationError) as exc:
        raise GalatAplikasi(
            kode=KodeGalat.PARAMETER_TIDAK_VALID,
            pesan=f"Parameter tidak valid: {str(exc)}",
            status_code=422,
        )

    if skema.metode == "nlm":
        return await eksekusi_operasi_citra(
            berkas_gambar=gambar,
            nama_operasi="reduksi_noise_nlm",
            fungsi_komputasi=reduksi_noise_nlm,
            argumen_fungsi={
                "kekuatan_filter": skema.kekuatan_filter,
                "kekuatan_warna": skema.kekuatan_warna,
                "ukuran_templat": skema.ukuran_templat,
                "ukuran_pencarian": skema.ukuran_pencarian,
                "rasio": skema.rasio,
            },
            batas_waktu_detik=10.0,
        )
    elif skema.metode == "median":
        return await eksekusi_operasi_citra(
            berkas_gambar=gambar,
            nama_operasi="reduksi_noise_median",
            fungsi_komputasi=reduksi_noise_median,
            argumen_fungsi={
                "ukuran_kernel": skema.ukuran_kernel,
                "rasio": skema.rasio,
            },
        )

    return await eksekusi_operasi_citra(
        berkas_gambar=gambar,
        nama_operasi="reduksi_noise_bilateral",
        fungsi_komputasi=reduksi_noise_bilateral,
        argumen_fungsi={
            "diameter": skema.diameter,
            "sigma_warna": skema.sigma_warna,
            "sigma_ruang": skema.sigma_ruang,
            "rasio": skema.rasio,
        },
    )
