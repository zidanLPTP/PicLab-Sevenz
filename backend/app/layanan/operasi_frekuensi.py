"""Modul layanan transformasi domain frekuensi Fast Fourier Transform (FFT).

Dioptimalkan untuk lingkungan hosting terbatas sumber daya (spec.md bagian 13 & Tahap 6):
- Pemrosesan HANYA pada kanal luminans (float32 murni), kanal krominans dipertahankan tanpa distorsi.
- Ukuran matriks diperluas ke getOptimalDFTSize untuk komputasi O(N log N) paling efisien.
- Zero copy yang tidak perlu dan bebas alokasi complex128 64-bit ganda.
"""

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
    """Membuat matriks masker domain frekuensi 2D float32 yang telah dipusatkan."""
    tinggi, lebar = bentuk
    # Titik tengah frekuensi nol
    cy, cx = tinggi / 2.0, lebar / 2.0

    u = (np.arange(tinggi, dtype=np.float32) - cy).reshape(-1, 1)
    v = (np.arange(lebar, dtype=np.float32) - cx).reshape(1, -1)
    jarak_kuadrat = u**2 + v**2

    cutoff = max(float(d0), 1e-4)
    cutoff_kuadrat = cutoff**2
    jenis = jenis_filter.lower()
    tipe = tipe_filter.lower()

    if jenis == "gaussian":
        h_lowpass = np.exp(-jarak_kuadrat / (2.0 * cutoff_kuadrat))
    elif jenis == "butterworth":
        n = max(1, int(orde))
        h_lowpass = 1.0 / (1.0 + (jarak_kuadrat / cutoff_kuadrat) ** n)
    else:  # ideal
        h_lowpass = (jarak_kuadrat <= cutoff_kuadrat).astype(np.float32)

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
    rasio: float = 1.0,
) -> np.ndarray:
    """Menerapkan 2D DFT pada luminans citra masukan dengan padding optimal dan alokasi float32.

    Argumen:
        gambar_np: Citra masukan RGB atau RGBA uint8.
        jenis_filter: 'ideal', 'gaussian', atau 'butterworth'.
        tipe_filter: 'lowpass' atau 'highpass'.
        frekuensi_cut_off: Radius batas frekuensi (D0).
        orde: Orde penapis Butterworth.
        mode_keluaran: 'gambar_terfilter' atau 'spektrum_magnitudo'.
        rasio: Rasio skala pratinjau (untuk penskalaan dimensi spasial/frekuensi).

    Mengembalikan:
        Array NumPy citra uint8 hasil transformasi atau visualisasi magnitudo spektrum.
    """
    if gambar_np.dtype != np.uint8:
        gambar_np = np.clip(gambar_np, 0, 255).astype(np.uint8)

    rgb, alfa = pisahkan_alfa(gambar_np)
    tinggi_asli, lebar_asli = rgb.shape[:2]

    # Ekstraksi kanal luminans dan krominans
    apakah_berwarna = rgb.ndim == 3 and rgb.shape[2] == 3
    if apakah_berwarna:
        ycrcb = cv2.cvtColor(rgb, cv2.COLOR_RGB2YCrCb)
        luminans = ycrcb[:, :, 0]
        krominans_cr = ycrcb[:, :, 1]
        krominans_cb = ycrcb[:, :, 2]
    else:
        luminans = rgb if rgb.ndim == 2 else rgb[:, :, 0]

    # Skalakan frekuensi cutoff terhadap rasio resolusi pratinjau
    cutoff_efektif = max(1.0, float(frekuensi_cut_off) * float(rasio))

    # Optimalkan ukuran untuk algoritma FFT cepat (faktor 2, 3, 5)
    opt_tinggi = cv2.getOptimalDFTSize(tinggi_asli)
    opt_lebar = cv2.getOptimalDFTSize(lebar_asli)

    # Padding tepi citra ke ukuran optimal
    pad_bawah = opt_tinggi - tinggi_asli
    pad_kanan = opt_lebar - lebar_asli
    if pad_bawah > 0 or pad_kanan > 0:
        luminans_pad = cv2.copyMakeBorder(
            luminans,
            0,
            pad_bawah,
            0,
            pad_kanan,
            cv2.BORDER_REFLECT,
        )
    else:
        luminans_pad = luminans

    # Konversi ke float32 dan lakukan 2D DFT (kompleks 2-kanal real+imag float32)
    luminans_f32 = np.ascontiguousarray(luminans_pad, dtype=np.float32)
    dft = cv2.dft(luminans_f32, flags=cv2.DFT_COMPLEX_OUTPUT)

    # Pergeseran frekuensi nol ke pusat (fftshift)
    dft_shift = np.fft.fftshift(dft, axes=(0, 1))

    if mode_keluaran == "spektrum_magnitudo":
        # Magnitudo = sqrt(real^2 + imag^2)
        real = dft_shift[:, :, 0]
        imag = dft_shift[:, :, 1]
        magnitudo = cv2.magnitude(real, imag)
        spektrum = 20.0 * np.log(1.0 + magnitudo)
        spektrum_pangkas = spektrum[:tinggi_asli, :lebar_asli]
        spektrum_norm = cv2.normalize(
            spektrum_pangkas, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U
        )
        spektrum_rgb = cv2.cvtColor(spektrum_norm, cv2.COLOR_GRAY2RGB)
        return gabungkan_alfa(spektrum_rgb, alfa)

    # Buat masker filter frekuensi berdimensi optimal
    masker = buat_masker_filter(
        (opt_tinggi, opt_lebar),
        jenis_filter=jenis_filter,
        tipe_filter=tipe_filter,
        d0=cutoff_efektif,
        orde=orde,
    )

    # Terapkan masker pada kedua komponen (real dan imajiner)
    dft_shift[:, :, 0] *= masker
    dft_shift[:, :, 1] *= masker

    # Kembalikan pergeseran pusat frekuensi (ifftshift)
    dft_ishift = np.fft.ifftshift(dft_shift, axes=(0, 1))

    # Transformasi Balik DFT (IDFT) dengan normalisasi
    hasil_idft = cv2.idft(dft_ishift, flags=cv2.DFT_SCALE | cv2.DFT_REAL_OUTPUT)

    # Pangkas hasil padding ke ukuran asli citra masukan
    luminans_rekonstruksi = hasil_idft[:tinggi_asli, :lebar_asli]
    luminans_uint8 = np.clip(luminans_rekonstruksi, 0, 255).astype(np.uint8)

    if apakah_berwarna:
        ycrcb_rekonstruksi = cv2.merge([luminans_uint8, krominans_cr, krominans_cb])
        hasil_rgb = cv2.cvtColor(ycrcb_rekonstruksi, cv2.COLOR_YCrCb2RGB)
    else:
        hasil_rgb = cv2.cvtColor(luminans_uint8, cv2.COLOR_GRAY2RGB)

    return gabungkan_alfa(hasil_rgb, alfa)
