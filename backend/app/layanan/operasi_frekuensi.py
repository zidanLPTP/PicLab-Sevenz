"""Modul layanan transformasi domain frekuensi Fast Fourier Transform (FFT)."""

from typing import Tuple

import cv2
import numpy as np

from app.layanan.operasi_tepi import gabungkan_alfa, pisahkan_alfa


def buat_masker_filter(
    bentuk: Tuple[int, int],
    jenis_filter: str = "ideal",
    tipe_filter: str = "lowpass",
    d0: float = 30.0,
    orde: int = 2,
) -> np.ndarray:
    """Membuat matriks masker domain frekuensi 2D yang telah dipusatkan."""
    tinggi, lebar = bentuk
    u = np.arange(tinggi) - (tinggi / 2.0)
    v = np.arange(lebar) - (lebar / 2.0)
    v_grid, u_grid = np.meshgrid(v, u)
    jarak = np.sqrt(u_grid**2 + v_grid**2).astype(np.float32)

    cutoff = max(float(d0), 1e-4)
    jenis = jenis_filter.lower()
    tipe = tipe_filter.lower()

    if jenis == "gaussian":
        h_lowpass = np.exp(-(jarak**2) / (2.0 * (cutoff**2)))
    elif jenis == "butterworth":
        n = max(1, int(orde))
        h_lowpass = 1.0 / (1.0 + (jarak / cutoff) ** (2 * n))
    else:  # ideal
        h_lowpass = (jarak <= cutoff).astype(np.float32)

    if tipe == "highpass":
        return (1.0 - h_lowpass).astype(np.float32)
    return h_lowpass.astype(np.float32)


def filter_frekuensi_fft(
    gambar_np: np.ndarray,
    jenis_filter: str = "ideal",
    tipe_filter: str = "lowpass",
    frekuensi_cut_off: float = 30.0,
    orde: int = 2,
    mode_keluaran: str = "gambar_terfilter",
) -> np.ndarray:
    """Menerapkan transformasi Fourier 2D, pemfilteran domain frekuensi, dan rekonstruksi spasial.

    Argumen:
        gambar_np: Citra masukan RGB atau RGBA.
        jenis_filter: 'ideal', 'gaussian', atau 'butterworth'.
        tipe_filter: 'lowpass' atau 'highpass'.
        frekuensi_cut_off: Jari-jari radius frekuensi cut-off (D0).
        orde: Orde polinomial untuk filter Butterworth.
        mode_keluaran: 'gambar_terfilter' atau 'spektrum_magnitudo'.

    Mengembalikan:
        Array NumPy citra uint8 hasil transformasi atau visualisasi spektrum.
    """
    if gambar_np.dtype != np.uint8:
        gambar_np = np.clip(gambar_np, 0, 255).astype(np.uint8)

    rgb, alfa = pisahkan_alfa(gambar_np)
    tinggi, lebar = rgb.shape[:2]

    masker = buat_masker_filter(
        (tinggi, lebar),
        jenis_filter=jenis_filter,
        tipe_filter=tipe_filter,
        d0=frekuensi_cut_off,
        orde=orde,
    )

    if mode_keluaran == "spektrum_magnitudo":
        # Gunakan skala abu-abu untuk visualisasi magnitudo spektrum terpusat
        if rgb.ndim == 3:
            abu = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        else:
            abu = rgb
        f = np.fft.fft2(abu.astype(np.float32))
        fshift = np.fft.fftshift(f)
        spektrum = 20.0 * np.log(1.0 + np.abs(fshift))
        spektrum_norm = cv2.normalize(
            spektrum, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U
        )
        spektrum_rgb = cv2.cvtColor(spektrum_norm, cv2.COLOR_GRAY2RGB)
        return gabungkan_alfa(spektrum_rgb, alfa)

    # Filter diterapkan pada setiap kanal warna secara independen
    if rgb.ndim == 3:
        hasil_kanal = []
        for c in range(rgb.shape[2]):
            kanal = rgb[:, :, c].astype(np.float32)
            f = np.fft.fft2(kanal)
            fshift = np.fft.fftshift(f)
            fshift_terfilter = fshift * masker
            f_ishift = np.fft.ifftshift(fshift_terfilter)
            kanal_rekonstruksi = np.real(np.fft.ifft2(f_ishift))
            hasil_kanal.append(np.clip(kanal_rekonstruksi, 0, 255).astype(np.uint8))
        hasil_rgb = np.dstack(hasil_kanal)
    else:
        f = np.fft.fft2(rgb.astype(np.float32))
        fshift = np.fft.fftshift(f)
        fshift_terfilter = fshift * masker
        f_ishift = np.fft.ifftshift(fshift_terfilter)
        hasil_real = np.real(np.fft.ifft2(f_ishift))
        hasil_rgb = np.clip(hasil_real, 0, 255).astype(np.uint8)

    return gabungkan_alfa(hasil_rgb, alfa)
