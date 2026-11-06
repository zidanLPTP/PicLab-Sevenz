"""Modul layanan reduksi noise citra (Bilateral, Non-Local Means, Median) OpenCV."""

import cv2
import numpy as np

from app.layanan.operasi_tepi import gabungkan_alfa, pisahkan_alfa


def reduksi_noise_bilateral(
    gambar_np: np.ndarray,
    diameter: int = 9,
    sigma_warna: float = 75.0,
    sigma_ruang: float = 75.0,
) -> np.ndarray:
    """Menerapkan Bilateral Filter untuk reduksi noise dengan mempertahankan tepi tajam."""
    rgb, alfa = pisahkan_alfa(gambar_np)
    d = max(1, int(diameter))
    hasil_rgb = cv2.bilateralFilter(rgb, d, float(sigma_warna), float(sigma_ruang))
    return gabungkan_alfa(hasil_rgb, alfa)


def reduksi_noise_nlm(
    gambar_np: np.ndarray,
    kekuatan_filter: float = 10.0,
    kekuatan_warna: float = 10.0,
    ukuran_templat: int = 7,
    ukuran_pencarian: int = 21,
) -> np.ndarray:
    """Menerapkan Non-Local Means (NLM) Denoising untuk reduksi noise bertekstur."""
    rgb, alfa = pisahkan_alfa(gambar_np)
    h = float(kekuatan_filter)
    h_warna = float(kekuatan_warna)
    templat = max(3, int(ukuran_templat))
    if templat % 2 == 0:
        templat += 1
    pencarian = max(5, int(ukuran_pencarian))
    if pencarian % 2 == 0:
        pencarian += 1

    if rgb.ndim == 3 and rgb.shape[2] == 3:
        hasil_rgb = cv2.fastNlMeansDenoisingColored(
            src=rgb,
            dst=None,
            h=h,
            hColor=h_warna,
            templateWindowSize=templat,
            searchWindowSize=pencarian,
        )
    else:
        hasil_rgb = cv2.fastNlMeansDenoising(
            src=rgb,
            dst=None,
            h=h,
            templateWindowSize=templat,
            searchWindowSize=pencarian,
        )

    return gabungkan_alfa(hasil_rgb, alfa)


def reduksi_noise_median(gambar_np: np.ndarray, ukuran_kernel: int = 5) -> np.ndarray:
    """Menerapkan filter median untuk reduksi noise salt-and-pepper."""
    rgb, alfa = pisahkan_alfa(gambar_np)
    k = max(3, int(ukuran_kernel))
    if k % 2 == 0:
        k += 1
    hasil_rgb = cv2.medianBlur(rgb, k)
    return gabungkan_alfa(hasil_rgb, alfa)
