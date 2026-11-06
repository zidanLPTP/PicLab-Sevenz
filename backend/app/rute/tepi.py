"""Rute operasi deteksi tepi server (Tahap 6)."""

from fastapi import APIRouter, File, Form, Response, UploadFile
from pydantic import ValidationError

from app.inti.galat import GalatAplikasi, KodeGalat
from app.layanan.operasi_tepi import deteksi_tepi_canny
from app.rute.dasar_operasi import eksekusi_operasi_citra
from app.skema.operasi_server import ParameterCanny

router = APIRouter(prefix="/api/v1/tepi", tags=["Deteksi Tepi"])


@router.post(
    "/canny",
    summary="Deteksi Tepi Canny",
    response_class=Response,
    responses={
        200: {"content": {"image/png": {}}, "description": "Citra tepi Canny PNG."},
        400: {"description": "Parameter tidak valid atau berkas rusak."},
        413: {"description": "Ukuran berkas melebihi 10 MB."},
        415: {"description": "Format berkas tidak didukung."},
        503: {"description": "Server sibuk."},
        504: {"description": "Batas waktu pemrosesan terlampaui."},
    },
)
async def endpoint_deteksi_tepi_canny(
    gambar: UploadFile = File(..., description="Berkas citra masukan"),
    parameter: str = Form(default="{}", description="JSON string parameter Canny"),
) -> Response:
    """Mendeteksi tepi citra menggunakan algoritma Canny dengan preservasi alfa."""
    try:
        skema = ParameterCanny.dari_json_form(parameter)
    except (ValueError, ValidationError) as exc:
        raise GalatAplikasi(
            kode=KodeGalat.PARAMETER_TIDAK_VALID,
            pesan=f"Parameter tidak valid: {str(exc)}",
            status_code=400,
        )

    return await eksekusi_operasi_citra(
        berkas_gambar=gambar,
        nama_operasi="tepi_canny",
        fungsi_komputasi=deteksi_tepi_canny,
        argumen_fungsi=skema.model_dump(),
    )
