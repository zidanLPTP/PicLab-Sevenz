#!/usr/bin/env python3
"""Skrip Pengukur Beban Komputasi dan Memori Sintetis (PicLab Sevenz).

Label Tegas: GARIS DASAR LAPTOP, BUKAN HASIL HOSTING.

Membangkitkan citra sintetis berwarna deterministik di memori (1 MP, 4 MP, 8 MP, 16 MP)
dan mengukur waktu median komputasi serta PUNCAK RSS NYATA via psutil dan alokasi heap via tracemalloc.
"""

import io
import json
import os
import statistics
import sys
import time
import tracemalloc

import numpy as np
import psutil
from PIL import Image, ImageFilter

try:
    import cv2

    OPENCV_TERSEDIA = True
except ImportError:
    OPENCV_TERSEDIA = False


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

ULANGAN_PENGUKURAN = 5


def bangkitkan_citra_sintetis_berwarna(lebar, tinggi):
    """Membangkitkan citra RGB sintetis berwarna deterministik di RAM via NumPy."""
    x = np.linspace(0, 255, lebar, dtype=np.uint8)
    y = np.linspace(0, 255, tinggi, dtype=np.uint8)
    xx, yy = np.meshgrid(x, y)
    r = xx
    g = yy
    b = ((xx.astype(np.uint16) + yy.astype(np.uint16)) // 2).astype(np.uint8)
    rgb = np.stack([r, g, b], axis=-1)
    return Image.fromarray(rgb, "RGB")


def ukur_satu_putaran(lebar, tinggi):
    """Menjalankan satu putaran operasi pemrosesan citra sintetis."""
    proses_saat_ini = psutil.Process(os.getpid())
    rss_awal_byte = proses_saat_ini.memory_info().rss

    tracemalloc.start()
    t_awal = time.perf_counter()

    # 1. Alokasi citra sintetis berwarna
    citra = bangkitkan_citra_sintetis_berwarna(lebar, tinggi)
    t_buat = time.perf_counter()

    # 2. Filter Gaussian Blur radius 2
    citra_halus = citra.filter(ImageFilter.GaussianBlur(radius=2))
    t_filter = time.perf_counter()

    # 3. Enkode PNG di RAM
    stream = io.BytesIO()
    citra_halus.save(stream, format="PNG", optimize=False)
    ukuran_png_kb = round(len(stream.getvalue()) / 1024, 1)
    t_encode = time.perf_counter()

    _, puncak_tracemalloc_byte = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    rss_akhir_byte = proses_saat_ini.memory_info().rss
    puncak_rss_mb = max(rss_awal_byte, rss_akhir_byte) / (1024 * 1024)

    durasi_total_ms = (t_encode - t_awal) * 1000
    durasi_gaussian_ms = (t_filter - t_buat) * 1000
    durasi_encode_ms = (t_encode - t_filter) * 1000
    heap_python_mb = puncak_tracemalloc_byte / (1024 * 1024)

    return {
        "durasi_total_ms": durasi_total_ms,
        "durasi_gaussian_ms": durasi_gaussian_ms,
        "durasi_encode_ms": durasi_encode_ms,
        "puncak_rss_mb": puncak_rss_mb,
        "heap_python_mb": heap_python_mb,
        "ukuran_png_kb": ukuran_png_kb,
    }


def uji_beban_resolusi(res_info):
    """Menjalankan pemanasan dan ulangan pengukuran."""
    lebar = res_info["lebar"]
    tinggi = res_info["tinggi"]
    label = res_info["label"]

    # Pemanasan 1 putaran
    _ = ukur_satu_putaran(lebar, tinggi)

    daftar_total_ms = []
    daftar_gaussian_ms = []
    daftar_encode_ms = []
    daftar_rss_mb = []
    daftar_heap_mb = []
    ukuran_png_kb = 0.0

    for _ in range(ULANGAN_PENGUKURAN):
        hasil = ukur_satu_putaran(lebar, tinggi)
        daftar_total_ms.append(hasil["durasi_total_ms"])
        daftar_gaussian_ms.append(hasil["durasi_gaussian_ms"])
        daftar_encode_ms.append(hasil["durasi_encode_ms"])
        daftar_rss_mb.append(hasil["puncak_rss_mb"])
        daftar_heap_mb.append(hasil["heap_python_mb"])
        ukuran_png_kb = hasil["ukuran_png_kb"]

    return {
        "resolusi": label,
        "dimensi": f"{lebar}x{tinggi}",
        "total_piksel": res_info["total_piksel"],
        "ulangan": ULANGAN_PENGUKURAN,
        "median_total_ms": round(statistics.median(daftar_total_ms), 2),
        "median_gaussian_ms": round(statistics.median(daftar_gaussian_ms), 2),
        "median_encode_ms": round(statistics.median(daftar_encode_ms), 2),
        "puncak_rss_mb": round(max(daftar_rss_mb), 2),
        "median_heap_mb": round(statistics.median(daftar_heap_mb), 2),
        "ukuran_png_kb": ukuran_png_kb,
    }


def main():
    print("=" * 95)
    print("   GARIS DASAR LAPTOP, BUKAN HASIL HOSTING — PENGUKUR BEBAN PICLAB SEVENZ")
    print("=" * 95)
    print("PENTING:")
    print("1. Data ini merupakan GARIS DASAR LAPTOP, BUKAN HASIL HOSTING.")
    print("2. Uji kelayakan hosting nyata ditunda sesuai keputusan Fathin sampai hosting dibeli.")
    print("3. Puncak RSS diukur menggunakan psutil nyata (Resident Set Size OS).")
    print("4. Kolom 'Median Gaussian (ms)' mengukur median durasi filter Gaussian Blur.")
    print("-" * 95)
    print(f"Versi Python: {sys.version.split()[0]} ({sys.platform})")
    print(f"Metode: 1 kali pemanasan + {ULANGAN_PENGUKURAN} kali ulangan (Median)")
    print("-" * 95)

    hasil_semua = []

    print(
        f"{'Resolusi':<18} | {'Median Total':<13} | {'Puncak RSS':<13} | {'Heap Python':<13} | {'Median Gaussian':<16} | {'PNG KB'}"
    )
    print("-" * 95)

    for item in RESOLUSI_UJI:
        sys.stdout.flush()
        try:
            res = uji_beban_resolusi(item)
            hasil_semua.append(res)
            print(
                f"{res['resolusi']:<18} | "
                f"{res['median_total_ms']:<10.1f} ms | "
                f"{res['puncak_rss_mb']:<10.2f} MB | "
                f"{res['median_heap_mb']:<10.2f} MB | "
                f"{res['median_gaussian_ms']:<13.1f} ms | "
                f"{res['ukuran_png_kb']}"
            )
        except MemoryError:
            print(f"{item['label']:<18} | GAGAL (MemoryError)")
            hasil_semua.append({"resolusi": item["label"], "status": "OUT_OF_MEMORY"})
        except Exception as err:
            print(f"{item['label']:<18} | GAGAL ({err})")
            hasil_semua.append({"resolusi": item["label"], "status": "GALAT", "pesan": str(err)})

    print("=" * 95)

    jalur_json = os.path.join(os.path.dirname(os.path.abspath(__file__)), "garis_dasar_laptop.json")
    with open(jalur_json, "w", encoding="utf-8") as f:
        json.dump(
            {
                "kategori": "GARIS_DASAR_LAPTOP_BUKAN_HASIL_HOSTING",
                "penjelasan": "Garis dasar performa laptop pengembang terukur via psutil (RSS nyata) dan tracemalloc (Heap).",
                "tanggal": "2026-11-06",
                "lingkungan": {
                    "python": sys.version,
                    "platform": sys.platform,
                    "cpu_count": psutil.cpu_count(logical=True),
                    "total_ram_gb": round(psutil.virtual_memory().total / (1024**3), 2),
                },
                "hasil": hasil_semua,
            },
            f,
            indent=2,
        )
    print(f"Hasil pengukuran tersimpan ke: {jalur_json}\n")


if __name__ == "__main__":
    main()
