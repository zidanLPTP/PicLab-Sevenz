"""Pengujian untuk rute pemeriksaan kesehatan (/kesehatan)."""
from fastapi.testclient import TestClient

from app.utama import aplikasi

klien_uji = TestClient(aplikasi)


def test_endpoint_kesehatan_berhasil():
    """Menguji endpoint GET /kesehatan mengembalikan status 200 dan data benar."""
    respons = klien_uji.get("/kesehatan")
    assert respons.status_code == 200

    data = respons.json()
    assert data["status"] == "sehat"
    assert "pesan" in data
    assert "versi" in data
