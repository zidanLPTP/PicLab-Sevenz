#!/usr/bin/env python3
"""Skrip Pengukur Beban Komputasi dan Memori Operasi Server Tahap 6 (PicLab Sevenz).

Label Tegas: GARIS DASAR LAPTOP, BUKAN HASIL HOSTING (Keputusan Fathin: hosting belum dibeli).

Fitur Sesuai M2 & M3:
- Resolusi rasio 1:1: 1 MP (1000x1000), 2 MP (1414x1414), 4 MP (2000x2000), 8 MP (2828x2828), 16 MP (4000x4000).
- Citra sintetis deterministik identik (gradien + kotak kontras + derau gaussian ber-seed 42).
- Eksekusi tiap operasi di PROSES TERPISAH (multiprocessing spawn) untuk isolasi memori mutlak.
- 2 putaran pemanasan dan 5 ulangan pengukuran; catat durasi Median dan P95 (ms).
- Pencatatan puncak RSS nyata (Working Set puncak psutil) dan heap tracemalloc.
- Pembatasan cv2.setNumThreads(2).
- Penyimpanan otomatis ke backend/kelayakan/garis_dasar_tahap6_laptop.json.
"""

import json
import multiprocessing as mp
import os
import sys
import threading
import time
import tracemalloc
from typing import Any

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

RESOLUSI_BENCHMARK = [
    {"label": "1 MP", "lebar": 1000, "tinggi": 1000, "total_piksel": 1_000_000},
    {"label": "2 MP", "lebar": 1414, "tinggi": 1414, "total_piksel": 1_999_396},
    {"label": "4 MP", "lebar": 2000, "tinggi": 2000, "total_piksel": 4_000_000},
    {"label": "8 MP", "lebar": 2828, "tinggi": 2828, "total_piksel": 7_997_584},
    {"label": "16 MP", "lebar": 4000, "tinggi": 4000, "total_piksel": 16_000_000},
]

OPERASI_DAFTAR = [
    ("tepi_canny", "Canny Edge Detection"),
    ("kontur", "Deteksi Kontur"),
    ("morfologi", "Morfologi Dilasi"),
    ("segmentasi", "Segmentasi K-Means (k=4)"),
    ("noise", "Reduksi Noise Bilateral"),
    ("frekuensi", "Frekuensi FFT Butterworth"),
]


def bangkitkan_citra_sintetis(lebar: int, tinggi: int) -> np.ndarray:
    """Membangkitkan citra RGB sintetis deterministik bernilai gradien, bentuk geometris, dan derau."""
    np.random.seed(42)
    # Gradien horizontal dan vertikal
    x = np.linspace(0, 255, lebar, dtype=np.uint8)
    y = np.linspace(0, 255, tinggi, dtype=np.uint8)
    xx, yy = np.meshgrid(x, y)
    r = xx
    g = yy
    b = ((xx.astype(np.uint16) + yy.astype(np.uint16)) // 2).astype(np.uint8)

    # Tambahkan persegi kontras tinggi di tengah
    cx, cy = lebar // 2, tinggi // 2
    r_radius = max(10, min(lebar, tinggi) // 10)
    r[cy - r_radius : cy + r_radius, cx - r_radius : cx + r_radius] = 255
    g[cy - r_radius : cy + r_radius, cx - r_radius : cx + r_radius] = 0
    b[cy - r_radius : cy + r_radius, cx - r_radius : cx + r_radius] = 255

    # Tambahkan sedikit derau gaussian deterministik (standar deviasi 5)
    derau = np.random.normal(0, 5, (tinggi, lebar, 3))
    gabung = np.clip(
        np.stack([r, g, b], axis=-1).astype(np.float64) + derau, 0, 255
    ).astype(np.uint8)
    return gabung


def jalankan_operasi(id_op: str, citra: np.ndarray) -> Any:
    """Mengeksekusi satu operasi citra dengan parameter baku."""
    if id_op == "tepi_canny":
        return deteksi_tepi_canny(citra, ambang_bawah=50, ambang_atas=150)
    elif id_op == "kontur":
        return cari_dan_gambar_kontur(citra, metode="biner", ambang=128)
    elif id_op == "morfologi":
        return terapkan_morfologi(citra, operasi="dilasi", ukuran=3)
    elif id_op == "segmentasi":
        return segmentasi_kmeans(citra, k=4, iterasi=10)
    elif id_op == "noise":
        return reduksi_noise_bilateral(
            citra, diameter=7, sigma_warna=50, sigma_ruang=50
        )
    elif id_op == "frekuensi":
        return filter_frekuensi_fft(
            citra, jenis_filter="butterworth", frekuensi_cut_off=30, orde=2
        )
    raise ValueError(f"Operasi tidak dikenal: {id_op}")


def worker_proses_pengukuran(
    id_op: str, lebar: int, tinggi: int, antrean_hasil: mp.Queue
):
    """Fungsi pekerja yang berjalan di proses terpisah (isolasi memori total)."""
    cv2.setNumThreads(2)
    proses_saat_ini = psutil.Process(os.getpid())

    # Pemantau RSS puncak dengan thread polling interval 2 ms
    berhenti_pantau = False
    puncak_rss_tercatat = 0.0

    def pemantau():
        nonlocal puncak_rss_tercatat
        while not berhenti_pantau:
            try:
                mem = proses_saat_ini.memory_info()
                # Pada Windows, peak_wset mencatat Peak Working Set
                rss_saat_ini = getattr(mem, "peak_wset", mem.rss) / (1024 * 1024)
                if rss_saat_ini > puncak_rss_tercatat:
                    puncak_rss_tercatat = rss_saat_ini
            except Exception:
                pass
            time.sleep(0.002)

    thread_pemantau = threading.Thread(target=pemantau, daemon=True)
    thread_pemantau.start()

    tracemalloc.start()
    citra = bangkitkan_citra_sintetis(lebar, tinggi)

    # 2 Kali Pemanasan
    for _ in range(2):
        _ = jalankan_operasi(id_op, citra)

    # 5 Kali Pengukuran
    durasi_list = []
    for _ in range(5):
        t_mulai = time.perf_counter()
        _ = jalankan_operasi(id_op, citra)
        t_selesai = time.perf_counter()
        durasi_list.append((t_selesai - t_mulai) * 1000.0)

    _, peak_heap = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    berhenti_pantau = True
    thread_pemantau.join(timeout=0.1)

    # Pastikan RSS puncak minimal sebesar RSS akhir
    try:
        mem_akhir = proses_saat_ini.memory_info()
        rss_akhir = getattr(mem_akhir, "peak_wset", mem_akhir.rss) / (1024 * 1024)
        if rss_akhir > puncak_rss_tercatat:
            puncak_rss_tercatat = rss_akhir
    except Exception:
        pass

    median_ms = float(np.median(durasi_list))
    p95_ms = float(np.percentile(durasi_list, 95))
    heap_mb = peak_heap / (1024 * 1024)

    hasil = {
        "id_op": id_op,
        "durasi_median_ms": round(median_ms, 2),
        "durasi_p95_ms": round(p95_ms, 2),
        "puncak_rss_mb": round(puncak_rss_tercatat, 2),
        "puncak_heap_mb": round(heap_mb, 2),
    }
    antrean_hasil.put(hasil)


def main():
    print("=" * 100)
    print("BENCHMARK OPERASI SERVER TAHAP 6 (GARIS DASAR LAPTOP - BUKAN HASIL HOSTING)")
    print("Keputusan Fathin: Hosting belum dibeli, pengujian hosting ditunda.")
    print("=" * 100)

    hasil_keseluruhan = {
        "status_lingkungan": "GARIS DASAR LAPTOP (BUKAN HASIL HOSTING)",
        "alasan_status": "Hosting belum dibeli sesuai keputusan Fathin, hasil hosting belum ada.",
        "cv2_threads": 2,
        "ulangan": 5,
        "pemanasan": 2,
        "resolusi": {},
    }

    for res in RESOLUSI_BENCHMARK:
        label = res["label"]
        lebar = res["lebar"]
        tinggi = res["tinggi"]
        total_piksel = res["total_piksel"]
        print(f"\n[RESOLUSI] {label} ({lebar}x{tinggi} - {total_piksel:,} piksel)")
        print(
            f"{'Operasi':<32} | {'Median (ms)':<12} | {'P95 (ms)':<12} | {'Puncak RSS (MB)':<16} | {'Heap (MB)':<12}"
        )
        print("-" * 95)

        hasil_keseluruhan["resolusi"][label] = {
            "lebar": lebar,
            "tinggi": tinggi,
            "total_piksel": total_piksel,
            "operasi": {},
        }

        for id_op, nama_op in OPERASI_DAFTAR:
            antrean = mp.Queue()
            proses = mp.Process(
                target=worker_proses_pengukuran,
                args=(id_op, lebar, tinggi, antrean),
            )
            proses.start()
            proses.join(timeout=120)

            if proses.is_alive():
                proses.terminate()
                proses.join()
                data_op = {
                    "nama": nama_op,
                    "durasi_median_ms": -1.0,
                    "durasi_p95_ms": -1.0,
                    "puncak_rss_mb": -1.0,
                    "puncak_heap_mb": -1.0,
                    "catatan": "TIMEOUT > 120s",
                }
            else:
                data_op = antrean.get()
                data_op["nama"] = nama_op

            hasil_keseluruhan["resolusi"][label]["operasi"][id_op] = data_op

            print(
                f"{nama_op:<32} | "
                f"{data_op['durasi_median_ms']:<12.1f} | "
                f"{data_op['durasi_p95_ms']:<12.1f} | "
                f"{data_op['puncak_rss_mb']:<16.1f} | "
                f"{data_op['puncak_heap_mb']:<12.1f}"
            )

    # Simpan ke berkas json
    jalur_json = os.path.join(
        os.path.dirname(__file__), "garis_dasar_tahap6_laptop.json"
    )
    with open(jalur_json, "w", encoding="utf-8") as f:
        json.dump(hasil_keseluruhan, f, indent=2)

    print("\n" + "=" * 100)
    print(f"Data benchmark berhasil disimpan ke: {jalur_json}")
    print("=" * 100)


if __name__ == "__main__":
    mp.freeze_support()
    main()
