"""Modul layanan operasi morfologi matematika citra menggunakan OpenCV."""

import cv2
import numpy as np

from app.layanan.operasi_tepi import gabungkan_alfa, pisahkan_alfa

PETA_OPERASI = {
    "erosi": cv2.MORPH_ERODE,
    "dilasi": cv2.MORPH_DILATE,
    "opening": cv2.MORPH_OPEN,
    "closing": cv2.MORPH_CLOSE,
    "gradient": cv2.MORPH_GRADIENT,
    "tophat": cv2.MORPH_TOPHAT,
    "blackhat": cv2.MORPH_BLACKHAT,
}

PETA_BENTUK = {
    "persegi": cv2.MORPH_RECT,
    "silang": cv2.MORPH_CROSS,
    "elips": cv2.MORPH_ELLIPSE,
}


def terapkan_morfologi(
    gambar_np: np.ndarray,
    operasi: str = "erosi",
    bentuk_elemen: str = "persegi",
    ukuran: int = 3,
    iterasi: int = 1,
) -> np.ndarray:
    """Menerapkan operasi morfologi citra matematika dengan preservasi kanal alfa.

    Argumen:
        gambar_np: Citra masukan RGB atau RGBA.
        operasi: 'erosi', 'dilasi', 'opening', 'closing', 'gradient', 'tophat', atau 'blackhat'.
        bentuk_elemen: 'persegi', 'silang', atau 'elips'.
        ukuran: Ukuran kernel elemen penstruktur (misal 3, 5, 7).
        iterasi: Frekuensi penerapan operasi.

    Mengembalikan:
        Array NumPy citra uint8 hasil transformasi morfologi.
    """
    if gambar_np.dtype != np.uint8:
        gambar_np = np.clip(gambar_np, 0, 255).astype(np.uint8)

    rgb, alfa = pisahkan_alfa(gambar_np)

    op_cv = PETA_OPERASI.get(operasi.lower(), cv2.MORPH_ERODE)
    bentuk_cv = PETA_BENTUK.get(bentuk_elemen.lower(), cv2.MORPH_RECT)

    ukuran_kernel = max(1, int(ukuran))
    if ukuran_kernel % 2 == 0:
        ukuran_kernel += 1

    kernel = cv2.getStructuringElement(bentuk_cv, (ukuran_kernel, ukuran_kernel))

    hasil_rgb = cv2.morphologyEx(rgb, op_cv, kernel, iterations=max(1, int(iterasi)))

    return gabungkan_alfa(hasil_rgb, alfa)
