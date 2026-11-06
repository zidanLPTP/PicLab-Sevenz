"""Modul layanan segmentasi citra (K-Means dan Multi-Otsu Thresholding)."""

from typing import Tuple

import cv2
import numpy as np

from app.layanan.operasi_tepi import gabungkan_alfa, pisahkan_alfa


def segmentasi_kmeans(
    gambar_np: np.ndarray,
    k: int = 4,
    iterasi: int = 20,
    epsilon: float = 0.2,
) -> Tuple[np.ndarray, int]:
    """Segmentasi kuantisasi warna citra menggunakan algoritma K-Means OpenCV.

    Argumen:
        gambar_np: Citra masukan RGB atau RGBA.
        k: Jumlah klaster warna (2 sampai 16).
        iterasi: Jumlah iterasi maksimum konvergensi.
        epsilon: Ambang batas selisih presisi pergeseran pusat klaster.

    Mengembalikan:
        Tuple (gambar_hasil_np, jumlah_klaster).
    """
    if gambar_np.dtype != np.uint8:
        gambar_np = np.clip(gambar_np, 0, 255).astype(np.uint8)

    rgb, alfa = pisahkan_alfa(gambar_np)
    if rgb.ndim == 2:
        rgb = cv2.cvtColor(rgb, cv2.COLOR_GRAY2RGB)

    tinggi, lebar = rgb.shape[:2]
    piksel = rgb.reshape((-1, 3)).astype(np.float32)

    k_tervalidasi = max(2, min(16, int(k)))
    kriteria = (
        cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER,
        max(1, int(iterasi)),
        float(epsilon),
    )

    _, label, pusat = cv2.kmeans(
        data=piksel,
        K=k_tervalidasi,
        bestLabels=None,
        criteria=kriteria,
        attempts=10,
        flags=cv2.KMEANS_RANDOM_CENTERS,
    )

    pusat_uint8 = np.uint8(pusat)
    tersegmentasi = pusat_uint8[label.flatten()]
    hasil_rgb = tersegmentasi.reshape((tinggi, lebar, 3))

    hasil = gabungkan_alfa(hasil_rgb, alfa)
    return hasil, k_tervalidasi


def hitung_ambang_multi_otsu(abu: np.ndarray, kelas: int = 3) -> list[int]:
    """Menghitung ambang batas segmentasi multi-level Otsu pada histogram grayscale."""
    kelas_tervalidasi = max(2, min(5, int(kelas)))
    if kelas_tervalidasi == 2:
        ambang, _ = cv2.threshold(abu, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return [int(ambang)]

    hist, _ = np.histogram(abu, bins=256, range=(0, 256))
    total_piksel = abu.size
    p = hist / float(total_piksel)

    # Multi-Otsu untuk kelas = 3 (2 ambang t1 < t2)
    if kelas_tervalidasi == 3:
        variansi_maks = -1.0
        ambang_terbaik = [85, 170]
        # Penelusuran langkah 2 untuk efisiensi
        mu_t = np.sum(np.arange(256) * p)

        omega1 = 0.0
        mu1_num = 0.0
        for t1 in range(1, 254, 2):
            omega1 += np.sum(p[t1 - 1 : t1 + 1])
            mu1_num += np.sum(np.arange(t1 - 1, t1 + 1) * p[t1 - 1 : t1 + 1])
            if omega1 == 0:
                continue

            omega2 = 0.0
            mu2_num = 0.0
            for t2 in range(t1 + 2, 255, 2):
                p_seg = p[t2 - 1 : t2 + 1]
                idx_seg = np.arange(t2 - 1, t2 + 1)
                omega2 += np.sum(p_seg)
                mu2_num += np.sum(idx_seg * p_seg)
                if omega2 == 0:
                    continue

                omega3 = 1.0 - omega1 - omega2
                if omega3 <= 0:
                    break

                mu3_num = mu_t - mu1_num - mu2_num
                mu1 = mu1_num / omega1
                mu2 = mu2_num / omega2
                mu3 = mu3_num / omega3

                sigma_b = (
                    omega1 * (mu1 - mu_t) ** 2
                    + omega2 * (mu2 - mu_t) ** 2
                    + omega3 * (mu3 - mu_t) ** 2
                )
                if sigma_b > variansi_maks:
                    variansi_maks = sigma_b
                    ambang_terbaik = [t1, t2]

        return ambang_terbaik

    # Untuk kelas > 3, gunakan kuantil histogram bertingkat yang stabil
    persentil = np.linspace(0, 100, kelas_tervalidasi + 1)[1:-1]
    ambang_kuantil = [int(np.percentile(abu, q)) for q in persentil]
    return sorted(list(set(ambang_kuantil)))


def segmentasi_multi_otsu(
    gambar_np: np.ndarray,
    kelas: int = 3,
) -> Tuple[np.ndarray, list[int]]:
    """Segmentasi citra bertingkat (Multi-Otsu) pada intensitas grayscale.

    Argumen:
        gambar_np: Citra masukan RGB atau RGBA.
        kelas: Jumlah kelas pemisahan (2 sampai 5).

    Mengembalikan:
        Tuple (gambar_hasil_np, daftar_nilai_ambang).
    """
    if gambar_np.dtype != np.uint8:
        gambar_np = np.clip(gambar_np, 0, 255).astype(np.uint8)

    rgb, alfa = pisahkan_alfa(gambar_np)
    if rgb.ndim == 3:
        abu = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    else:
        abu = rgb.copy()

    kelas_tervalidasi = max(2, min(5, int(kelas)))
    ambang_list = hitung_ambang_multi_otsu(abu, kelas_tervalidasi)

    # Tingkat intensitas keluaran terdistribusi merata [0, ..., 255]
    nilai_level = np.linspace(0, 255, kelas_tervalidasi, dtype=np.uint8)
    hasil_abu = np.zeros_like(abu, dtype=np.uint8)

    batas_bawah = 0
    for i, ambang in enumerate(ambang_list):
        masker = (abu >= batas_bawah) & (abu < ambang)
        hasil_abu[masker] = nilai_level[i]
        batas_bawah = ambang
    masker_akhir = abu >= batas_bawah
    hasil_abu[masker_akhir] = nilai_level[-1]

    hasil_rgb = cv2.cvtColor(hasil_abu, cv2.COLOR_GRAY2RGB)
    hasil = gabungkan_alfa(hasil_rgb, alfa)
    return hasil, ambang_list
