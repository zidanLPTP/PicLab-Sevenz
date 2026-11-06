"""Modul layanan deteksi dan visualisasi kontur menggunakan OpenCV."""

from typing import List, Tuple

import cv2
import numpy as np

from app.layanan.operasi_tepi import gabungkan_alfa, pisahkan_alfa


def konversi_warna_hex(hex_warna: str) -> Tuple[int, int, int]:
    """Mengonversi format warna heksadesimal #RRGGBB menjadi tuple RGB integer."""
    hex_bersih = hex_warna.lstrip("#")
    if len(hex_bersih) != 6:
        return (0, 255, 0)
    try:
        r = int(hex_bersih[0:2], 16)
        g = int(hex_bersih[2:4], 16)
        b = int(hex_bersih[4:6], 16)
        return (r, g, b)
    except ValueError:
        return (0, 255, 0)


def cari_dan_gambar_kontur(
    gambar_np: np.ndarray,
    metode: str = "biner",
    ambang: float = 128.0,
    mode_retrieval: str = "tree",
    luas_minimum: float = 10.0,
    ketebalan_garis: int = 2,
    tampilan: str = "overlay",
    warna_garis: str = "#00ff00",
    rasio: float = 1.0,
) -> Tuple[np.ndarray, int]:
    """Mencari kontur objek dan menggambarnya pada kanvas keluaran.

    Argumen:
        gambar_np: Citra masukan RGB atau RGBA.
        metode: 'biner', 'otsu', atau 'canny'.
        ambang: Nilai ambang untuk binarisasi (bila metode='biner').
        mode_retrieval: 'tree', 'external', atau 'list'.
        luas_minimum: Batas luas piksel minimum kontur yang digambar.
        ketebalan_garis: Ketebalan garis kontur (piksel).
        tampilan: 'overlay', 'latar_hitam', atau 'latar_putih'.
        warna_garis: Kode warna heksadesimal #RRGGBB.
        rasio: Rasio skala pratinjau.

    Mengembalikan:
        Tuple (gambar_hasil_np, jumlah_kontur_terpilih).
    """
    if gambar_np.dtype != np.uint8:
        gambar_np = np.clip(gambar_np, 0, 255).astype(np.uint8)

    rgb, alfa = pisahkan_alfa(gambar_np)
    if rgb.ndim == 3:
        abu = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    else:
        abu = rgb.copy()

    # Tahap binarisasi sesuai metode
    if metode == "otsu":
        _, biner = cv2.threshold(abu, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    elif metode == "canny":
        biner = cv2.Canny(abu, 50, 150)
    else:
        _, biner = cv2.threshold(abu, float(ambang), 255, cv2.THRESH_BINARY)

    # Pemilihan mode retrieval OpenCV
    mode_cv = cv2.RETR_TREE
    if mode_retrieval == "external":
        mode_cv = cv2.RETR_EXTERNAL
    elif mode_retrieval == "list":
        mode_cv = cv2.RETR_LIST

    kontur_semua, _ = cv2.findContours(biner, mode_cv, cv2.CHAIN_APPROX_SIMPLE)

    # Skalakan luas minimum dan ketebalan garis terhadap rasio pratinjau jika rasio < 1.0
    luas_min_efektif = max(0.0, float(luas_minimum) * (float(rasio) ** 2))
    tebal_raw = int(round(int(ketebalan_garis) * float(rasio)))
    tebal_efektif = max(1, tebal_raw)

    # Filter kontur berdasarkan luas minimum
    kontur_valid: List[np.ndarray] = [
        k for k in kontur_semua if cv2.contourArea(k) >= luas_min_efektif
    ]

    tinggi, lebar = abu.shape[:2]

    # Penyiapan kanvas dasar
    if tampilan == "latar_hitam":
        kanvas = np.zeros((tinggi, lebar, 3), dtype=np.uint8)
    elif tampilan == "latar_putih":
        kanvas = np.full((tinggi, lebar, 3), 255, dtype=np.uint8)
    else:
        if rgb.ndim == 2:
            kanvas = cv2.cvtColor(rgb, cv2.COLOR_GRAY2RGB)
        else:
            kanvas = rgb.copy()

    warna_rgb = konversi_warna_hex(warna_garis)

    # Gambar kontur
    if kontur_valid:
        cv2.drawContours(kanvas, kontur_valid, -1, warna_rgb, tebal_efektif)

    hasil = gabungkan_alfa(kanvas, alfa)
    return hasil, len(kontur_valid)
