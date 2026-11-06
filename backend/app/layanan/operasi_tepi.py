"""Modul layanan deteksi tepi Canny pada citra menggunakan OpenCV."""

from typing import Tuple

import cv2
import numpy as np


def pisahkan_alfa(gambar_np: np.ndarray) -> Tuple[np.ndarray, np.ndarray | None]:
    """Memisahkan kanal RGB dan kanal Alfa jika ada."""
    if gambar_np.ndim == 3 and gambar_np.shape[2] == 4:
        rgb = gambar_np[:, :, :3]
        alfa = gambar_np[:, :, 3]
        return rgb, alfa
    return gambar_np, None


def gabungkan_alfa(rgb_np: np.ndarray, alfa_np: np.ndarray | None) -> np.ndarray:
    """Menggabungkan kembali kanal Alfa ke citra RGB jika sebelumnya memiliki alfa."""
    if alfa_np is None:
        return rgb_np
    if rgb_np.ndim == 2:
        # Jika citra keluaran adalah grayscale 2D, perluas ke 3 kanal sebelum menambahkan alfa
        rgb_np = cv2.cvtColor(rgb_np, cv2.COLOR_GRAY2RGB)
    return np.dstack((rgb_np, alfa_np))


def deteksi_tepi_canny(
    gambar_np: np.ndarray,
    ambang_bawah: float = 50.0,
    ambang_atas: float = 150.0,
    ukuran_apertur: int = 3,
    l2_gradient: bool = False,
    blur_awal: bool = True,
    inversi: bool = False,
) -> np.ndarray:
    """Mendeteksi tepi menggunakan algoritma Canny dengan preservasi kanal alfa.

    Argumen:
        gambar_np: Array NumPy citra RGB atau RGBA (uint8).
        ambang_bawah: Nilai ambang histeresis bawah.
        ambang_atas: Nilai ambang histeresis atas.
        ukuran_apertur: Ukuran apertur Sobel (3, 5, atau 7).
        l2_gradient: Apakah menggunakan norma L2 untuk gradien.
        blur_awal: Apakah menerapkan Gaussian blur awal 5x5 untuk reduksi noise.
        inversi: Jika True, tepi berwarna hitam dan latar putih.

    Mengembalikan:
        Array NumPy citra uint8 dengan tepi Canny terdeteksi.
    """
    if gambar_np.dtype != np.uint8:
        gambar_np = np.clip(gambar_np, 0, 255).astype(np.uint8)

    rgb, alfa = pisahkan_alfa(gambar_np)

    if rgb.ndim == 3:
        abu = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    else:
        abu = rgb.copy()

    if blur_awal:
        abu = cv2.GaussianBlur(abu, (5, 5), 1.4)

    tepi = cv2.Canny(
        image=abu,
        threshold1=float(ambang_bawah),
        threshold2=float(ambang_atas),
        apertureSize=int(ukuran_apertur),
        L2gradient=bool(l2_gradient),
    )

    if inversi:
        tepi = cv2.bitwise_not(tepi)

    tepi_rgb = cv2.cvtColor(tepi, cv2.COLOR_GRAY2RGB)
    return gabungkan_alfa(tepi_rgb, alfa)
