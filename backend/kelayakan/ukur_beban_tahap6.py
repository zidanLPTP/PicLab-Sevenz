#!/usr/bin/env python3
"""Skrip Pengukur Beban Komputasi dan Memori Operasi Server Tahap 6 (PicLab Sevenz).

Label Tegas: GARIS DASAR LAPTOP, BUKAN HASIL HOSTING (Keputusan Fathin: hosting belum dibeli).

Membangkitkan citra sintetis berwarna deterministik (1 MP, 4 MP, 8 MP, 16 MP)
dan mengukur durasi komputasi median & P95 serta puncak RSS psutil untuk 6 operasi server:
1. Canny Edge Detection
2. Deteksi & Gambar Kontur
3. Morfologi Matematika (Dilasi)
4. Segmentasi K-Means (k=4)
5. Reduksi Noise Bilateral
6. Transformasi Frekuensi FFT (Butterworth Lowpass)
"""

import json
import os
import statistics
import sys
import time
import tracemalloc

import cv2
import numpy as np
import psutil

# Tambahkan direktori root backend ke sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.layanan.operasi_frekuensi import filter_frekuensi_fft
from app.layanan.operasi_kontur import cari_dan_gambar_kontur
from app.layanan.operasi_morfologi import terapkan_morfologi
from app.layanan.operasi_noise import reduksi_noise_bilateral
from app.layanan.operasi_segmentasi import segmentasi_kmeans
from app.layanan.operasi_tepi import deteksi_tepi_canny

cv2.setNumThreads(2)

RESOLUSI_UJI = [
    {"label": "1 MP", "lebar": 1000, "tinggi": 1000, "total_piksel": 1_000_000},
    {"label": "4 MP", "lebar": 2000, "tinggi": 2000, "total_piksel": 4_000_000},
    {"label": "8 MP", "lebar": 3264, "tinggi": 2448, "total_piksel": 7_990_272},
    {
        "label": "16 MP (Batas Maks)",
        "lebar": 4000,
        "tinggi": 4000,
        "total_piksel": 16_000_000,
    },
]

ULANGAN_PENGUKURAN = 3


def bangkitkan_array_sintetis(lebar: int, tinggi: int) -> np.ndarray:
    """Membangkitkan array NumPy uint8 RGB deterministik di RAM."""
    x = np.linspace(0, 255, lebar, dtype=np.uint8)
    y = np.linspace(0, 255, tinggi, dtype=np.uint8)
    xx, yy = np.meshgrid(x, y)
    r = xx
    g = yy
    b = ((xx.astype(np.uint16) + yy.astype(np.uint16)) // 2).astype(np.uint8)
    # Tambahkan kotak kontras di tengah untuk fitur kontur/tepi
    cx, cy = lebar // 2, tinggi // 2
    r[cy - 100 : cy + 100, cx - 100 : cx + 100] = 255
    g[cy - 100 : cy + 100, cx - 100 : cx + 100] = 0
    b[cy - 100 : cy + 100, cx - 100 : cx + 100] = 255
    return np.stack([r, g, b], axis=-1)


def ukur_operasi(fungsi_op, array_np, **kwargs):
    """Mengukur durasi satu operasi pemrosesan citra."""
    t_awal = time.perf_counter()
    _ = fungsi_op(array_np, **kwargs)
    t_akhir = time.perf_counter()
    return (t_akhir - t_awal) * 1000.0


def main():
    print("=" * 105)
    print("BENCHMARK OPERASI SERVER TAHAP 6 (GARIS DASAR LAPTOP - BUKAN HASIL HOSTING)")
    print("=" * 105)

    proses = psutil.Process(os.getpid())
    hasil_semua = []

    for res in RESOLUSI_UJI:
        label = res["label"]
        lebar = res["lebar"]
        tinggi = res["tinggi"]
        print(f"\n--- Pengujian Resolusi: {label} ({lebar}x{tinggi}) ---")

        tracemalloc.start()
        rss_awal = proses.memory_info().rss / (1024 * 1024)

        # Alokasi citra sintetis di RAM
        citra_np = bangkitkan_array_sintetis(lebar, tinggi)

        durasi_per_op = {
            "canny": [],
            "kontur": [],
            "morfologi": [],
            "segmentasi": [],
            "noise": [],
            "frekuensi": [],
        }

        # Pemanasan 1 putaran Canny
        _ = deteksi_tepi_canny(citra_np)

        for _ in range(ULANGAN_PENGUKURAN):
            durasi_per_op["canny"].append(
                ukur_operasi(
                    deteksi_tepi_canny, citra_np, ambang_bawah=50, ambang_atas=150
                )
            )
            durasi_per_op["kontur"].append(
                ukur_operasi(
                    cari_dan_gambar_kontur, citra_np, metode="biner", ambang=128
                )
            )
            durasi_per_op["morfologi"].append(
                ukur_operasi(terapkan_morfologi, citra_np, operasi="dilasi", ukuran=3)
            )
            # Untuk segmentasi k-means pada 16 MP dibatasi iterasi 10 untuk efisiensi benchmark
            durasi_per_op["segmentasi"].append(
                ukur_operasi(segmentasi_kmeans, citra_np, k=4, iterasi=10)
            )
            durasi_per_op["noise"].append(
                ukur_operasi(
                    reduksi_noise_bilateral,
                    citra_np,
                    diameter=9,
                    sigma_warna=75,
                    sigma_ruang=75,
                )
            )
            durasi_per_op["frekuensi"].append(
                ukur_operasi(
                    filter_frekuensi_fft,
                    citra_np,
                    jenis_filter="butterworth",
                    frekuensi_cut_off=30,
                    orde=2,
                )
            )

        rss_akhir = proses.memory_info().rss / (1024 * 1024)
        _, peak_heap = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        heap_mb = peak_heap / (1024 * 1024)

        data_res = {
            "resolusi": label,
            "dimensi": f"{lebar}x{tinggi}",
            "total_piksel": res["total_piksel"],
            "puncak_rss_mb": round(max(rss_awal, rss_akhir), 2),
            "puncak_heap_mb": round(heap_mb, 2),
            "metrik_operasi": {},
        }

        for op_nama, daftar_waktu in durasi_per_op.items():
            median_waktu = round(statistics.median(daftar_waktu), 2)
            p95_waktu = round(sorted(daftar_waktu)[int(len(daftar_waktu) * 0.95)], 2)
            data_res["metrik_operasi"][op_nama] = {
                "median_ms": median_waktu,
                "p95_ms": p95_waktu,
            }
            print(
                f"  [{op_nama.upper():12s}] Median: {median_waktu:8.2f} ms | P95: {p95_waktu:8.2f} ms"
            )

        print(
            f"  Puncak RSS Memori: {data_res['puncak_rss_mb']:.2f} MB | Puncak Heap Python: {data_res['puncak_heap_mb']:.2f} MB"
        )
        hasil_semua.append(data_res)

    jalur_json = os.path.join(
        os.path.dirname(__file__), "garis_dasar_tahap6_laptop.json"
    )
    with open(jalur_json, "w", encoding="utf-8") as f:
        json.dump(
            {
                "label": "GARIS DASAR LAPTOP (BUKAN HASIL HOSTING)",
                "keputusan_fathin": "Hosting belum dibeli dan belum akan dibeli dalam waktu dekat. Hasil di hosting ditunda.",
                "tanggal_pengujian": time.strftime("%Y-%m-%d %H:%M:%S"),
                "lingkungan": {
                    "os": sys.platform,
                    "python": sys.version.split()[0],
                    "cpu_count": psutil.cpu_count(logical=True),
                    "ram_total_gb": round(psutil.virtual_memory().total / (1024**3), 2),
                },
                "hasil": hasil_semua,
            },
            f,
            indent=2,
        )

    print("\n" + "=" * 105)
    print(f"Hasil pengukuran berhasil disimpan ke: {jalur_json}")
    print("=" * 105)


if __name__ == "__main__":
    main()
