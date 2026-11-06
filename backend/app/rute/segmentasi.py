"""Rute operasi segmentasi citra (Tahap 6)."""

from fastapi import APIRouter, File, Form, Response, UploadFile
from pydantic import ValidationError

from app.inti.galat import GalatAplikasi, KodeGalat
from app.layanan.operasi_segmentasi import segmentasi_kmeans, segmentasi_multi_otsu
from app.rute.dasar_operasi import eksekusi_operasi_citra
from app.skema.operasi_server import ParameterSegmentasi

router = APIRouter(prefix="/api/v1/segmentasi", tags=["Segmentasi Citra"])


@router.post(
    "",
    summary="Segmentasi Citra (K-Means atau Multi-Otsu)",
    response_class=Response,
    responses={
        200: {"content": {"image/png": {}}, "description": "Citra tersegmentasi PNG."},
        400: {"description": "Parameter tidak valid atau berkas rusak."},
        413: {"description": "Ukuran berkas melebihi 10 MB."},
        415: {"description": "Format berkas tidak didukung."},
        503: {"description": "Server sibuk."},
        504: {"description": "Batas waktu pemrosesan terlampaui."},
    },
)
async def endpoint_segmentasi(
    gambar: UploadFile = File(..., description="Berkas citra masukan"),
    parameter: str = Form(default="{}", description="JSON string parameter Segmentasi"),
) -> Response:
    """Melakukan segmentasi klaster warna K-Means atau Multi-level Otsu thresholding."""
    try:
        skema = ParameterSegmentasi.dari_json_form(parameter)
    except (ValueError, ValidationError) as exc:
        raise GalatAplikasi(
            kode=KodeGalat.PARAMETER_TIDAK_VALID,
            pesan=f"Parameter tidak valid: {str(exc)}",
            status_code=400,
        )

    if skema.metode == "multi_otsu":
        return await eksekusi_operasi_citra(
            berkas_gambar=gambar,
            nama_operasi="segmentasi_multi_otsu",
            fungsi_komputasi=segmentasi_multi_otsu,
            argumen_fungsi={"kelas": skema.kelas},
        )

    return await eksekusi_operasi_citra(
        berkas_gambar=gambar,
        nama_operasi="segmentasi_kmeans",
        fungsi_komputasi=segmentasi_kmeans,
        argumen_fungsi={
            "k": skema.k,
            "iterasi": skema.iterasi,
            "epsilon": skema.epsilon,
        },
    )
