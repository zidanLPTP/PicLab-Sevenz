"""Rute operasi morfologi matematika citra (Tahap 6)."""

from fastapi import APIRouter, File, Form, Response, UploadFile
from pydantic import ValidationError

from app.inti.galat import GalatAplikasi, KodeGalat
from app.layanan.operasi_morfologi import terapkan_morfologi
from app.rute.dasar_operasi import eksekusi_operasi_citra
from app.skema.operasi_server import ParameterMorfologi

router = APIRouter(prefix="/api/v1/morfologi", tags=["Morfologi Matematika"])


@router.post(
    "",
    summary="Operasi Morfologi Matematika",
    response_class=Response,
    responses={
        200: {
            "content": {"image/png": {}},
            "description": "Citra hasil operasi morfologi PNG.",
        },
        400: {"description": "Parameter tidak valid atau berkas rusak."},
        413: {"description": "Ukuran berkas melebihi 10 MB."},
        415: {"description": "Format berkas tidak didukung."},
        503: {"description": "Server sibuk."},
        504: {"description": "Batas waktu pemrosesan terlampaui."},
    },
)
async def endpoint_morfologi(
    gambar: UploadFile = File(..., description="Berkas citra masukan"),
    parameter: str = Form(default="{}", description="JSON string parameter Morfologi"),
) -> Response:
    """Menerapkan transformasi morfologi matematika citra dengan preservasi alfa."""
    try:
        skema = ParameterMorfologi.dari_json_form(parameter)
    except (ValueError, ValidationError) as exc:
        raise GalatAplikasi(
            kode=KodeGalat.PARAMETER_TIDAK_VALID,
            pesan=f"Parameter tidak valid: {str(exc)}",
            status_code=400,
        )

    return await eksekusi_operasi_citra(
        berkas_gambar=gambar,
        nama_operasi=f"morfologi_{skema.operasi}",
        fungsi_komputasi=terapkan_morfologi,
        argumen_fungsi=skema.model_dump(),
    )
