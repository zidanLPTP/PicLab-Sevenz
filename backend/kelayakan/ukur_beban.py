#!/usr/bin/env python3
"""Skrip Pengukur Beban Komputasi dan Memori Sintetis (PicLab Sevenz).

Membangkitkan citra sintetis berwarna deterministik di memori (1 MP, 4 MP, 8 MP, 16 MP)
dan mengukur waktu median komputasi serta puncak alokasi memori RAM (via tracemalloc)
untuk menetapkan Garis Dasar Laptop sebelum pengujian hosting nyata.
"""

import io
import json
import statistics
import sys
import time
import tracemalloc
from PIL import Image, ImageFilter

import numpy as np

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

ULANGAN_PENGUKURAN = 5  # 5 kali ulangan untuk menghitung median stabil


def bangkitkan_citra_sintetis_berwarna(lebar, tinggi):
    """Membangkitkan citra RGB sintetis berwarna deterministik di RAM via NumPy tervektorisasi."""
    x = np.linspace(0, 255, lebar, dtype=np.uint8)
    y = np.linspace(0, 255, tinggi, dtype=np.uint8)
    xx, yy = np.meshgrid(x, y)
    r = xx
    g = yy
    b = ((xx.astype(np.uint16) + yy.astype(np.uint16)) // 2).astype(np.uint8)
    rgb = np.stack([r, g, b], axis=-1)
    return Image.fromarray(rgb, "RGB")


def ukur_satu_putaran(lebar, tinggi):
    """Menjalankan satu putaran operasi pemrosesan citra sintetis dan mengembalikan durasi & memori."""
    tracemalloc.start()
    t_awal = time.perf_counter()

    # 1. Alokasi citra sintetis berwarna
    citra = bangkitkan_citra_sintetis_berwarna(lebar, tinggi)
    t_buat = time.perf_counter()

    # 2. Filter Penghalusan Spasial (Gaussian Blur radius 2)
    citra_halus = citra.filter(ImageFilter.GaussianBlur(radius=2))
    t_filter = time.perf_counter()

    # 3. Operasi Canny jika OpenCV terpasang, atau rotasi transposisi
    durasi_opsi_ms = None
    if OPENCV_TERSEDIA:
        t_opsi_mulai = time.perf_counter()
        arr = np.array(citra_halus)
        abu = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
        _ = cv2.Canny(abu, 100, 200)
        durasi_opsi_ms = round((time.perf_counter() - t_opsi_mulai) * 1000, 2)

    # 4. Enkode PNG di RAM
    stream = io.BytesIO()
    citra_halus.save(stream, format="PNG", optimize=False)
    ukuran_png_kb = round(len(stream.getvalue()) / 1024, 1)
    t_encode = time.perf_counter()

    _, puncak_byte = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    durasi_total_ms = (t_encode - t_awal) * 1000
    durasi_filter_ms = (t_filter - t_buat) * 1000
    durasi_encode_ms = (t_encode - t_filter) * 1000
    puncak_ram_mb = puncak_byte / (1024 * 1024)

    return {
        "durasi_total_ms": durasi_total_ms,
        "durasi_filter_ms": durasi_filter_ms,
        "durasi_encode_ms": durasi_encode_ms,
        "durasi_opsi_ms": durasi_opsi_ms,
        "puncak_ram_mb": puncak_ram_mb,
        "ukuran_png_kb": ukuran_png_kb,
    }


def uji_beban_resolusi(res_info):
    """Menjalankan pemanasan dan ulangan pengukuran untuk menghitung median stabil."""
    lebar = res_info["lebar"]
    tinggi = res_info["tinggi"]
    label = res_info["label"]

    # 1. Pemanasan (Warmup) 1 putaran
    _ = ukur_satu_putaran(lebar, tinggi)

    # 2. Pengukuran Berulang (5 putaran)
    daftar_total_ms = []
    daftar_filter_ms = []
    daftar_encode_ms = []
    daftar_puncak_mb = []
    ukuran_png_kb = 0.0

    for _ in range(ULANGAN_PENGUKURAN):
        hasil_putaran = ukur_satu_putaran(lebar, tinggi)
        daftar_total_ms.append(hasil_putaran["durasi_total_ms"])
        daftar_filter_ms.append(hasil_putaran["durasi_filter_ms"])
        daftar_encode_ms.append(hasil_putaran["durasi_encode_ms"])
        daftar_puncak_mb.append(hasil_putaran["puncak_ram_mb"])
        ukuran_png_kb = hasil_putaran["ukuran_png_kb"]

    return {
        "resolusi": label,
        "dimensi": f"{lebar}x{tinggi}",
        "total_piksel": res_info["total_piksel"],
        "ulangan": ULANGAN_PENGUKURAN,
        "median_total_ms": round(statistics.median(daftar_total_ms), 2),
        "median_filter_ms": round(statistics.median(daftar_filter_ms), 2),
        "median_encode_ms": round(statistics.median(daftar_encode_ms), 2),
        "puncak_ram_mb": round(max(daftar_puncak_mb), 2),
        "median_ram_mb": round(statistics.median(daftar_puncak_mb), 2),
        "ukuran_png_kb": ukuran_png_kb,
    }


def main():
    print("=" * 86)
    print("   GARIS DASAR LAPTOP, BUKAN HASIL HOSTING — PENGUKUR BEBAN PICLAB SEVENZ")
    print("=" * 86)
    print("PENTING:")
    print("1. Angka ini diukur pada perangkat laptop pengembang, BUKAN di server hosting bersama.")
    print("2. Jangan menyimpulkan kelayakan hosting bersama dari angka laptop ini.")
    print("3. Keterbatasan Memori: Tracemalloc hanya mengukur alokasi heap murni Python.")
    print("   Alokasi internal pustaka C (Pillow C / NumPy C / OpenCV C) serta page cache")
    print("   dan RSS sistem operasi riil dapat 2x hingga 3x lebih besar dari angka di bawah.")
    print("-" * 86)
    print(f"Versi Python: {sys.version.split()[0]} ({sys.platform})")
    print(
        f"OpenCV Terpasang: {'YA' if OPENCV_TERSEDIA else 'TIDAK (Pillow & NumPy Standar)'}"
    )
    print(f"Metode: 1 kali pemanasan + {ULANGAN_PENGUKURAN} kali ulangan (Median)")
    print("-" * 86)

    hasil_semua = []

    print(
        f"{'Resolusi':<18} | {'Median Total':<13} | {'Puncak RAM':<12} | {'Median Filter':<14} | {'Median Encode':<14} | {'PNG KB'}"
    )
    print("-" * 86)

    for item in RESOLUSI_UJI:
        sys.stdout.flush()
        try:
            res = uji_beban_resolusi(item)
            hasil_semua.append(res)
            print(
                f"{res['resolusi']:<18} | "
                f"{res['median_total_ms']:<10.1f} ms | "
                f"{res['puncak_ram_mb']:<9.2f} MB | "
                f"{res['median_filter_ms']:<11.1f} ms | "
                f"{res['median_encode_ms']:<11.1f} ms | "
                f"{res['ukuran_png_kb']}"
            )
        except MemoryError:
            print(
                f"{item['label']:<18} | GAGAL (MemoryError - Melebihi Batas RAM!)\n"
            )
            hasil_semua.append(
                {"resolusi": item["label"], "status": "OUT_OF_MEMORY"}
            )
        except Exception as err:
            print(f"{item['label']:<18} | GAGAL ({err})")
            hasil_semua.append(
                {
                    "resolusi": item["label"],
                    "status": "GALAT",
                    "pesan": str(err),
                }
            )

    print("=" * 86)

    nama_berkas_json = "garis_dasar_laptop.json"
    with open(nama_berkas_json, "w", encoding="utf-8") as f:
        json.dump(
            {
                "kategori": "GARIS_DASAR_LAPTOP_BUKAN_HASIL_HOSTING",
                "penjelasan_keterbatasan": "Tracemalloc hanya melacak alokasi heap Python murni. Overhead library C dan RSS riil pada OS hosting bersama diperkirakan 2x-3x dari puncak heap Python.",
                "tanggal": "2026-11-05",
                "lingkungan": {
                    "python": sys.version,
                    "platform": sys.platform,
                },
                "hasil": hasil_semua,
            },
            f,
            indent=2,
        )
    print(f"Hasil pengukuran JSON disimpan ke: {nama_berkas_json}\n")


if __name__ == "__main__":
    main()
