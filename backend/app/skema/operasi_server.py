"""Skema Pydantic untuk validasi parameter operasi server (Tahap 6)."""

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SkemaDasarOperasi(BaseModel):
    """Model dasar operasi server dengan larangan penambahan atribut asing (extra forbid)."""

    model_config = ConfigDict(extra="forbid")
    rasio: float = Field(default=1.0, gt=0.0, le=1.0)

    @classmethod
    def dari_json_form(
        cls, data_raw: str | dict[str, Any] | None
    ) -> "SkemaDasarOperasi":
        """Mem-parsing string JSON form parameter menjadi instans skema yang tervalidasi."""
        if not data_raw:
            return cls()
        if isinstance(data_raw, str):
            try:
                data_dict = json.loads(data_raw)
            except json.JSONDecodeError as exc:
                raise ValueError("Format JSON parameter tidak valid.") from exc
        else:
            data_dict = data_raw
        return cls(**data_dict)


class ParameterCanny(SkemaDasarOperasi):
    """Parameter deteksi tepi Canny."""

    ambang_bawah: float = Field(default=50.0, ge=0.0, le=1000.0)
    ambang_atas: float = Field(default=150.0, ge=0.0, le=1000.0)
    ukuran_apertur: int = Field(default=3)
    l2_gradient: bool = Field(default=False)
    blur_awal: bool = Field(default=True)
    inversi: bool = Field(default=False)

    @field_validator("ukuran_apertur")
    @classmethod
    def validasi_apertur(cls, v: int) -> int:
        if v not in (3, 5, 7):
            raise ValueError("Ukuran apertur harus bernilai 3, 5, atau 7.")
        return v

    @model_validator(mode="after")
    def validasi_rentang_ambang(self) -> "ParameterCanny":
        if self.ambang_bawah >= self.ambang_atas:
            raise ValueError(
                "Nilai ambang bawah Canny harus lebih kecil dari ambang atas."
            )
        return self


class ParameterKontur(SkemaDasarOperasi):
    """Parameter deteksi dan visualisasi kontur."""

    metode: str = Field(default="biner", pattern="^(biner|otsu|canny)$")
    ambang: float = Field(default=128.0, ge=0.0, le=255.0)
    mode_retrieval: str = Field(default="tree", pattern="^(tree|external|list)$")
    luas_minimum: float = Field(default=10.0, ge=0.0)
    ketebalan_garis: int = Field(default=2, ge=1, le=20)
    tampilan: str = Field(
        default="overlay", pattern="^(overlay|latar_hitam|latar_putih)$"
    )
    warna_garis: str = Field(default="#00ff00", pattern="^#[0-9a-fA-F]{6}$")


class ParameterMorfologi(SkemaDasarOperasi):
    """Parameter operasi morfologi citra."""

    operasi: str = Field(
        default="erosi",
        pattern="^(erosi|dilasi|opening|closing|gradient|tophat|blackhat)$",
    )
    bentuk_elemen: str = Field(default="persegi", pattern="^(persegi|silang|elips)$")
    ukuran: int = Field(default=3, ge=1, le=51)
    iterasi: int = Field(default=1, ge=1, le=10)


class ParameterSegmentasi(SkemaDasarOperasi):
    """Parameter segmentasi K-Means atau Multi-Otsu."""

    metode: str = Field(default="kmeans", pattern="^(kmeans|multi_otsu)$")
    k: int = Field(default=4, ge=2, le=8)
    kelas: int = Field(default=3, ge=2, le=5)
    iterasi: int = Field(default=20, ge=1, le=100)
    epsilon: float = Field(default=0.2, ge=0.001, le=10.0)


class ParameterNoise(SkemaDasarOperasi):
    """Parameter reduksi noise Bilateral, NLM, atau Median."""

    metode: str = Field(default="bilateral", pattern="^(bilateral|nlm|median)$")
    diameter: int = Field(default=9, ge=1, le=25)
    sigma_warna: float = Field(default=75.0, ge=1.0, le=300.0)
    sigma_ruang: float = Field(default=75.0, ge=1.0, le=300.0)
    kekuatan_filter: float = Field(default=10.0, ge=1.0, le=50.0)
    kekuatan_warna: float = Field(default=10.0, ge=1.0, le=50.0)
    ukuran_templat: int = Field(default=7, ge=3, le=15)
    ukuran_pencarian: int = Field(default=21, ge=5, le=35)
    ukuran_kernel: int = Field(default=5, ge=3, le=25)


class ParameterFrekuensi(SkemaDasarOperasi):
    """Parameter transformasi frekuensi Fast Fourier Transform (FFT)."""

    jenis_filter: str = Field(default="ideal", pattern="^(ideal|gaussian|butterworth)$")
    tipe_filter: str = Field(default="lowpass", pattern="^(lowpass|highpass)$")
    frekuensi_cut_off: float = Field(default=30.0, ge=1.0, le=2000.0)
    orde: int = Field(default=2, ge=1, le=10)
    mode_keluaran: str = Field(
        default="gambar_terfilter",
        pattern="^(gambar_terfilter|spektrum_magnitudo)$",
    )
