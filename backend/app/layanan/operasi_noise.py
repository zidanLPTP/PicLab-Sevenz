"""Modul layanan reduksi noise citra (Bilateral, Non-Local Means, Median) OpenCV."""

import cv2
import numpy as np

from app.inti.galat import GalatAplikasi, KodeGalat
from app.inti.konfigurasi import konfigurasi
from app.layanan.operasi_tepi import gabungkan_alfa, pisahkan_alfa


def reduksi_noise_bilateral(
    gambar_np: np.ndarray,
    diameter: int = 9,
    sigma_warna: float = 75.0,
    sigma_ruang: float = 75.0,
    rasio: float = 1.0,
) -> np.ndarray:
    """Menerapkan Bilateral Filter untuk reduksi noise dengan mempertahankan tepi tajam."""
    rgb, alfa = pisahkan_alfa(gambar_np)
    # Skalakan diameter dan sigma ruang terhadap resolusi pratinjau jika rasio < 1.0
    d_raw = int(round(int(diameter) * float(rasio)))
    d_efektif = max(3, d_raw if d_raw % 2 != 0 else d_raw + 1)
    sigma_r_efektif = max(1.0, float(sigma_ruang) * float(rasio))

    hasil_rgb = cv2.bilateralFilter(rgb, d_efektif, float(sigma_warna), sigma_r_efektif)
    return gabungkan_alfa(hasil_rgb, alfa)


def reduksi_noise_nlm(
    gambar_np: np.ndarray,
    kekuatan_filter: float = 10.0,
    kekuatan_warna: float = 10.0,
    ukuran_templat: int = 7,
    ukuran_pencarian: int = 21,
    rasio: float = 1.0,
) -> np.ndarray:
    """Menerapkan Non-Local Means (NLM) Denoising untuk reduksi noise bertekstur.

    Dibatasi hingga BATAS_PIKSEL_NLM (4 MP) guna mencegah kehabisan waktu/CPU di hosting (M3 c & d).
    """
    rgb, alfa = pisahkan_alfa(gambar_np)
    tinggi, lebar = rgb.shape[:2]
    total_piksel = tinggi * lebar

    if total_piksel > konfigurasi.BATAS_PIKSEL_NLM:
        raise GalatAplikasi(
            kode=KodeGalat.PIKSEL_TERLALU_BANYAK_UNTUK_OPERASI,
            pesan=(
                f"Citra berukuran {lebar}x{tinggi} ({total_piksel:,} piksel) melebihi batas "
                f"kemampuan komputasi Non-Local Means ({konfigurasi.BATAS_PIKSEL_NLM:,} piksel / 4 MP). "
                "Gunakan penapis Bilateral atau perkecil citra terlebih dahulu."
            ),
            status_code=400,
        )

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


def reduksi_noise_median(
    gambar_np: np.ndarray,
    ukuran_kernel: int = 5,
    rasio: float = 1.0,
) -> np.ndarray:
    """Menerapkan filter median untuk reduksi noise salt-and-pepper."""
    rgb, alfa = pisahkan_alfa(gambar_np)
    k_raw = int(round(int(ukuran_kernel) * float(rasio)))
    k_efektif = max(3, k_raw if k_raw % 2 != 0 else k_raw + 1)
    hasil_rgb = cv2.medianBlur(rgb, k_efektif)
    return gabungkan_alfa(hasil_rgb, alfa)
