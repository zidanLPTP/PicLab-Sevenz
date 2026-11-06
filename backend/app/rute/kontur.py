"""Rute operasi deteksi dan visualisasi kontur (Tahap 6)."""

from fastapi import APIRouter, File, Form, Response, UploadFile
from pydantic import ValidationError

from app.inti.galat import GalatAplikasi, KodeGalat
from app.layanan.operasi_kontur import cari_dan_gambar_kontur
from app.rute.dasar_operasi import eksekusi_operasi_citra
from app.skema.operasi_server import ParameterKontur

router = APIRouter(prefix="/api/v1/kontur", tags=["Deteksi Kontur"])


@router.post(
    "",
    summary="Deteksi dan Visualisasi Kontur Objek",
    response_class=Response,
    responses={
        200: {
            "content": {"image/png": {}},
            "description": "Citra visualisasi kontur PNG.",
        },
        400: {"description": "Parameter tidak valid atau berkas rusak."},
        413: {"description": "Ukuran berkas melebihi 10 MB."},
        415: {"description": "Format berkas tidak didukung."},
        503: {"description": "Server sibuk."},
        504: {"description": "Batas waktu pemrosesan terlampaui."},
    },
)
async def endpoint_deteksi_kontur(
    gambar: UploadFile = File(..., description="Berkas citra masukan"),
    parameter: str = Form(default="{}", description="JSON string parameter Kontur"),
) -> Response:
    """Mendeteksi kontur objek dan menggambarnya di atas kanvas dengan preservasi alfa."""
    try:
        skema = ParameterKontur.dari_json_form(parameter)
    except (ValueError, ValidationError) as exc:
        raise GalatAplikasi(
            kode=KodeGalat.PARAMETER_TIDAK_VALID,
            pesan=f"Parameter tidak valid: {str(exc)}",
            status_code=400,
        )

    return await eksekusi_operasi_citra(
        berkas_gambar=gambar,
        nama_operasi="deteksi_kontur",
        fungsi_komputasi=cari_dan_gambar_kontur,
        argumen_fungsi=skema.model_dump(),
    )
