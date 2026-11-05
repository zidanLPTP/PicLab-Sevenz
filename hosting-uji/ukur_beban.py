#!/usr/bin/env python3
"""Skrip Pengukur Beban Komputasi dan Memori Sintetis (PicLab Sevenz).

Membangkitkan citra sintetis multi-resolusi di memori (1 MP, 4 MP, 8 MP, 16 MP)
dan mengukur waktu komputasi serta puncak memori RAM (via tracemalloc)
untuk menentukan batas aman CPU throttling dan cgroup hosting bersama.
"""

import io
import json
import os
import sys
import time
import tracemalloc
from PIL import Image, ImageFilter

try:
    import cv2
    import numpy as np

    OPENCV_TERSEDIA = True
except ImportError:
    OPENCV_TERSEDIA = False


RESOLUSI_UJI = [
    {"label": "1 MP", "lebar": 1000, "tinggi": 1000, "total_piksel": 1_000_000},
    {"label": "4 MP", "lebar": 2000, "tinggi": 2000, "total_piksel": 4_000_000},
    {"label": "8 MP", "lebar": 3264, "tinggi": 2448, "total_piksel": 7_990_272},
    {"label": "16 MP (Batas Maks)", "lebar": 4000, "tinggi": 4000, "total_piksel": 16_000_000},
]


def bangkitkan_citra_sintetis(lebar, tinggi):
    """Membangkitkan pola sintetis gradien + noise di memori (RAM)."""
    # Menggunakan Pillow murni agar tidak bergantung pada OpenCV
    citra = Image.new("RGB", (lebar, tinggi), color=(128, 128, 128))
    # Buat gradien sederhana
    return citra


def uji_beban_resolusi(res_info):
    """Menguji beban komputasi dan memori pada satu resolusi tertentu."""
    lebar = res_info["lebar"]
    tinggi = res_info["tinggi"]
    label = res_info["label"]

    tracemalloc.start()
    t_awal = time.perf_counter()

    # 1. Alokasi citra sintetis
    citra = bangkitkan_citra_sintetis(lebar, tinggi)
    t_buat = time.perf_counter()

    # 2. Operasi Pillow: Filter Penghalusan (Gaussian Blur radius 2)
    citra_halus = citra.filter(ImageFilter.GaussianBlur(radius=2))
    t_filter = time.perf_counter()

    # 3. Operasi OpenCV / NumPy jika ada: Deteksi Tepi Canny atau Inversi
    durasi_canny_ms = None
    if OPENCV_TERSEDIA:
        t_canny_mulai = time.perf_counter()
        arr = np.array(citra_halus)
        abu = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
        _ = cv2.Canny(abu, 100, 200)
        durasi_canny_ms = round((time.perf_counter() - t_canny_mulai) * 1000, 2)

    # 4. Operasi Encode ke PNG di memori (RAM)
    stream = io.BytesIO()
    citra_halus.save(stream, format="PNG", optimize=False)
    ukuran_png_kb = round(len(stream.getvalue()) / 1024, 1)
    t_encode = time.perf_counter()

    _, puncak_byte = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    durasi_total_ms = round((t_encode - t_awal) * 1000, 2)
    durasi_filter_ms = round((t_filter - t_buat) * 1000, 2)
    durasi_encode_ms = round((t_encode - t_filter) * 1000, 2)
    puncak_ram_mb = round(puncak_byte / (1024 * 1024), 2)

    return {
        "resolusi": label,
        "dimensi": f"{lebar}x{tinggi}",
        "total_piksel": res_info["total_piksel"],
        "durasi_filter_ms": durasi_filter_ms,
        "durasi_canny_ms": durasi_canny_ms,
        "durasi_encode_png_ms": durasi_encode_ms,
        "durasi_total_ms": durasi_total_ms,
        "puncak_ram_mb": puncak_ram_mb,
        "ukuran_png_kb": ukuran_png_kb,
    }


def main():
    print("=" * 76)
    print("      PICLAB SEVENZ — PENGUKUR BEBAN KOMPUTASI & MEMORI SINTETIS")
    print("=" * 76)
    print(f"OpenCV Terpasang : {'YA' if OPENCV_TERSEDIA else 'TIDAK (Pillow Fallback)'}")
    print("Memulai pengujian beban citra di RAM...")
    print("-" * 76)

    hasil_semua = []

    print(
        f"{'Resolusi':<18} | {'Total ms':<10} | {'Puncak RAM':<12} | {'Filter ms':<10} | {'Encode ms':<10} | {'PNG KB'}"
    )
    print("-" * 76)

    for item in RESOLUSI_UJI:
        sys.stdout.flush()
        try:
            res = uji_beban_resolusi(item)
            hasil_semua.append(res)
            print(
                f"{res['resolusi']:<18} | "
                f"{res['durasi_total_ms']:<10.1f} | "
                f"{res['puncak_ram_mb']:<9.2f} MB | "
                f"{res['durasi_filter_ms']:<10.1f} | "
                f"{res['durasi_encode_png_ms']:<10.1f} | "
                f"{res['ukuran_png_kb']}"
            )
        except MemoryError:
            print(f"{item['label']:<18} | GAGAL (MemoryError - Melebihi Batas RAM Server!)")
            hasil_semua.append({"resolusi": item["label"], "status": "OUT_OF_MEMORY"})
        except Exception as err:
            print(f"{item['label']:<18} | GAGAL ({err})")
            hasil_semua.append({"resolusi": item["label"], "status": "GALAT", "pesan": str(err)})

    print("=" * 76)

    with open("hasil_beban.json", "w", encoding="utf-8") as f:
        json.dump(hasil_semua, f, indent=2)
    print("Hasil pengujian lengkap disimpan ke: hasil_beban.json\n")


if __name__ == "__main__":
    main()
