"""Rute operasi transformasi domain frekuensi Fast Fourier Transform (Tahap 6)."""

from fastapi import APIRouter, File, Form, Response, UploadFile
from pydantic import ValidationError

from app.inti.galat import GalatAplikasi, KodeGalat
from app.layanan.operasi_frekuensi import filter_frekuensi_fft
from app.rute.dasar_operasi import eksekusi_operasi_citra
from app.skema.operasi_server import ParameterFrekuensi

router = APIRouter(prefix="/api/v1/frekuensi", tags=["Domain Frekuensi"])


@router.post(
    "",
    summary="Pemfilteran Domain Frekuensi FFT",
    response_class=Response,
    responses={
        200: {
            "content": {"image/png": {}},
            "description": "Citra hasil filter FFT atau spektrum magnitudo PNG.",
        },
        400: {"description": "Parameter tidak valid atau berkas rusak."},
        413: {"description": "Ukuran berkas melebihi 10 MB."},
        415: {"description": "Format berkas tidak didukung."},
        503: {"description": "Server sibuk."},
        504: {"description": "Batas waktu pemrosesan terlampaui."},
    },
)
async def endpoint_frekuensi_fft(
    gambar: UploadFile = File(..., description="Berkas citra masukan"),
    parameter: str = Form(default="{}", description="JSON string parameter Frekuensi"),
) -> Response:
    """Menerapkan transformasi Fourier 2D (FFT), pemfilteran frekuensi, atau visualisasi spektrum."""
    try:
        skema = ParameterFrekuensi.dari_json_form(parameter)
    except (ValueError, ValidationError) as exc:
        raise GalatAplikasi(
            kode=KodeGalat.PARAMETER_TIDAK_VALID,
            pesan=f"Parameter tidak valid: {str(exc)}",
            status_code=422,
        )

    return await eksekusi_operasi_citra(
        berkas_gambar=gambar,
        nama_operasi=f"fft_{skema.jenis_filter}_{skema.tipe_filter}",
        fungsi_komputasi=filter_frekuensi_fft,
        argumen_fungsi=skema.model_dump(),
    )
