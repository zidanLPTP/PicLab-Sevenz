#!/usr/bin/env python3
"""Skrip Diagnostik Lingkungan Server Hosting (PicLab Sevenz).

Mendeteksi spesifikasi OS, versi Python, alokasi memori cgroup/resource,
dan menguji waktu impor (load latency) pustaka numerik/citra (NumPy, SciPy, Pillow, OpenCV).
"""

import importlib
import json
import os
import platform
import sys
import time


def ukur_impor_modul(nama_modul):
    """Mengukur durasi waktu impor modul dalam milidetik dan versi yang terpasang."""
    t0 = time.perf_counter()
    try:
        modul = importlib.import_module(nama_modul)
        durasi_ms = round((time.perf_counter() - t0) * 1000, 2)
        versi = getattr(modul, "__version__", "Terpasang (tanpa __version__)")
        return {
            "status": "SUKSES",
            "durasi_ms": durasi_ms,
            "versi": str(versi),
            "lokasi": getattr(modul, "__file__", "bawaan"),
        }
    except ImportError as err:
        return {
            "status": "GAGAL_IMPORT",
            "durasi_ms": None,
            "galat": str(err),
        }
    except Exception as err:
        return {
            "status": "GALAT",
            "durasi_ms": None,
            "galat": str(err),
        }


def periksa_cgroup_memori():
    """Membaca batas memori cgroup Linux jika tersedia."""
    info_cgroup = {}
    jalur_v2 = "/sys/fs/cgroup/memory.max"
    jalur_v1 = "/sys/fs/cgroup/memory/memory.limit_in_bytes"

    if os.path.exists(jalur_v2):
        try:
            with open(jalur_v2, "r", encoding="utf-8") as f:
                val = f.read().strip()
                info_cgroup["cgroup_v2_memory_max"] = (
                    "unlimited"
                    if val == "max"
                    else f"{int(val) / (1024 * 1024):.1f} MB"
                )
        except Exception as e:
            info_cgroup["cgroup_v2_error"] = str(e)

    if os.path.exists(jalur_v1):
        try:
            with open(jalur_v1, "r", encoding="utf-8") as f:
                val = int(f.read().strip())
                # Nilai di atas 1 PB menandakan tidak ada batas
                if val > 10**15:
                    info_cgroup["cgroup_v1_limit"] = "unlimited"
                else:
                    info_cgroup["cgroup_v1_limit"] = f"{val / (1024 * 1024):.1f} MB"
        except Exception as e:
            info_cgroup["cgroup_v1_error"] = str(e)

    # resource rlimit
    try:
        import resource

        soft, hard = resource.getrlimit(resource.RLIMIT_AS)
        info_cgroup["rlimit_as_soft"] = (
            "unlimited"
            if soft == resource.RLIM_INFINITY
            else f"{soft / (1024 * 1024):.1f} MB"
        )
        info_cgroup["rlimit_as_hard"] = (
            "unlimited"
            if hard == resource.RLIM_INFINITY
            else f"{hard / (1024 * 1024):.1f} MB"
        )
    except (ImportError, AttributeError):
        info_cgroup["rlimit"] = "Modul resource tidak tersedia (Windows OS)"

    return info_cgroup


def periksa_libc():
    """Mendeteksi libc pada sistem Linux."""
    try:
        libc_ver = platform.libc_ver()
        if libc_ver[0]:
            return f"{libc_ver[0]} {libc_ver[1]}"
    except Exception:
        pass
    return "Tidak terdeteksi / Non-Linux"


def jalankan_pemeriksaan():
    """Menjalankan seluruh diagnostik lingkungan server."""
    hasil = {
        "sistem": {
            "os": platform.system(),
            "rilis": platform.release(),
            "arsitektur": platform.machine(),
            "prosesor": platform.processor() or "Tidak diketahui",
            "cpu_count": os.cpu_count(),
            "libc": periksa_libc(),
        },
        "python": {
            "versi": platform.python_version(),
            "executable": sys.executable,
            "prefix": sys.prefix,
            "in_venv": sys.prefix != sys.base_prefix,
        },
        "memori": periksa_cgroup_memori(),
        "pustaka": {},
    }

    modul_kunci = ["numpy", "scipy", "PIL", "cv2", "fastapi", "uvicorn", "a2wsgi"]
    for m in modul_kunci:
        hasil["pustaka"][m] = ukur_impor_modul(m)

    return hasil


def cetak_laporan_tabel(hasil):
    """Mencetak laporan diagnostik dalam bentuk teks ramah terminal."""
    print("=" * 68)
    print("   PICLAB SEVENZ — DIAGNOSTIK KELAYAKAN LINGKUNGAN HOSTING")
    print("=" * 68)

    sis = hasil["sistem"]
    print(f"OS & Arsitektur : {sis['os']} {sis['rilis']} ({sis['arsitektur']})")
    print(f"Jumlah Inti CPU : {sis['cpu_count']}")
    print(f"LibC Rilis      : {sis['libc']}")

    py = hasil["python"]
    print(f"Versi Python    : {py['versi']}")
    print(f"Path Python     : {py['executable']}")
    print(f"Lingkungan Venv : {'YA' if py['in_venv'] else 'TIDAK (Sistem Global)'}")

    print("\n[Batas Memori & CGroup]")
    for k, v in hasil["memori"].items():
        print(f"  • {k:20}: {v}")

    print("\n[Pengujian Impor Pustaka Numerik & Citra]")
    print(f"  {'Modul':<12} | {'Status':<14} | {'Durasi (ms)':<12} | {'Versi'}")
    print("  " + "-" * 62)
    for nama, data in hasil["pustaka"].items():
        durasi = f"{data['durasi_ms']} ms" if data["durasi_ms"] is not None else "-"
        versi = data.get("versi", data.get("galat", "-"))
        print(f"  {nama:<12} | {data['status']:<14} | {durasi:<12} | {versi}")
    print("=" * 68)


if __name__ == "__main__":
    data_hasil = jalankan_pemeriksaan()
    cetak_laporan_tabel(data_hasil)

    # Simpan keluaran ke JSON jika diminta
    with open("lingkungan.json", "w", encoding="utf-8") as f:
        json.dump(data_hasil, f, indent=2)
    print("\nHasil diagnostik tersimpan di: lingkungan.json\n")
