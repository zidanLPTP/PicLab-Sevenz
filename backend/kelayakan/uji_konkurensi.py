#!/usr/bin/env python3
"""Skrip Penguji Konkurensi dan Batas Beban Serentak (PicLab Sevenz).

Menggunakan pustaka standar Python (urllib.request + ThreadPoolExecutor)
untuk menembak endpoint backend secara serentak, mendeteksi respon 200, 429 (Rate Limit),
dan 503 (Server Sibuk / Batas Semaphore).
"""

import argparse
import concurrent.futures
import json
import statistics
import sys
import time
import urllib.error
import urllib.request


def kirim_permintaan_kesehatan(url):
    """Mengirim satu permintaan GET ke endpoint kesehatan."""
    t0 = time.perf_counter()
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "PicLab-HostingUji/1.0", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            durasi_ms = round((time.perf_counter() - t0) * 1000, 2)
            return {"status": status, "durasi_ms": durasi_ms, "galat": None}
    except urllib.error.HTTPError as err:
        durasi_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {"status": err.code, "durasi_ms": durasi_ms, "galat": str(err.reason)}
    except Exception as err:
        durasi_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {"status": 0, "durasi_ms": durasi_ms, "galat": str(err)}


def uji_beban_serentak(url, jumlah_permintaan=20, pekerja_serentak=5):
    """Menjalankan sejumlah permintaan serentak dengan worker pool."""
    print(f"Mengirim {jumlah_permintaan} permintaan ke {url} (Konkurensi: {pekerja_serentak})...")

    t_mulai_semua = time.perf_counter()
    hasil_list = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=pekerja_serentak) as executor:
        futures = [executor.submit(kirim_permintaan_kesehatan, url) for _ in range(jumlah_permintaan)]
        for f in concurrent.futures.as_completed(futures):
            hasil_list.append(f.result())

    durasi_total_detik = time.perf_counter() - t_mulai_semua

    # Analisis statistik status
    distribusi_status = {}
    latensi_list = []

    for h in hasil_list:
        st = h["status"]
        distribusi_status[st] = distribusi_status.get(st, 0) + 1
        if h["status"] == 200:
            latensi_list.append(h["durasi_ms"])

    ringkasan = {
        "url": url,
        "total_permintaan": jumlah_permintaan,
        "konkurensi": pekerja_serentak,
        "durasi_total_detik": round(durasi_total_detik, 2),
        "throughput_req_per_detik": round(jumlah_permintaan / durasi_total_detik, 2),
        "distribusi_status": distribusi_status,
        "sukses_200": distribusi_status.get(200, 0),
        "rate_limited_429": distribusi_status.get(429, 0),
        "server_sibuk_503": distribusi_status.get(503, 0),
        "gagal_jaringan": distribusi_status.get(0, 0),
    }

    if latensi_list:
        latensi_list.sort()
        idx_p95 = int(len(latensi_list) * 0.95)
        ringkasan["latensi_ms"] = {
            "min": round(min(latensi_list), 2),
            "median": round(statistics.median(latensi_list), 2),
            "p95": round(latensi_list[min(idx_p95, len(latensi_list) - 1)], 2),
            "max": round(max(latensi_list), 2),
        }
    else:
        ringkasan["latensi_ms"] = None

    return ringkasan


def main():
    parser = argparse.ArgumentParser(description="Penguji Konkurensi PicLab Sevenz")
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:8000/kesehatan",
        help="URL endpoint target (default: http://127.0.0.1:8000/kesehatan)",
    )
    parser.add_argument(
        "--jumlah",
        type=int,
        default=20,
        help="Total jumlah permintaan (default: 20)",
    )
    parser.add_argument(
        "--pekerja",
        type=int,
        default=5,
        help="Jumlah thread pekerja serentak (default: 5)",
    )
    args = parser.parse_args()

    ringkasan = uji_beban_serentak(args.url, args.jumlah, args.pekerja)

    print("\n" + "=" * 54)
    print("           HASIL UJI KONKURENSI HOSTING")
    print("=" * 54)
    print(f"Target URL            : {ringkasan['url']}")
    print(f"Total Permintaan      : {ringkasan['total_permintaan']}")
    print(f"Pekerja Serentak      : {ringkasan['konkurensi']}")
    print(f"Durasi Total          : {ringkasan['durasi_total_detik']} detik")
    print(f"Throughput Rata-rata  : {ringkasan['throughput_req_per_detik']} req/detik")
    print("\nDistribusi Status HTTP:")
    for st, count in ringkasan["distribusi_status"].items():
        label = "Sukses" if st == 200 else ("Rate Limit (429)" if st == 429 else ("Server Sibuk (503)" if st == 503 else "Galat"))
        print(f"  • HTTP {st} ({label}): {count} permintaan")

    if ringkasan["latensi_ms"]:
        lat = ringkasan["latensi_ms"]
        print("\nLatensi Permintaan Sukses (ms):")
        print(f"  • Min    : {lat['min']} ms")
        print(f"  • Median : {lat['median']} ms")
        print(f"  • P95    : {lat['p95']} ms")
        print(f"  • Max    : {lat['max']} ms")
    print("=" * 54)

    with open("hasil_konkurensi.json", "w", encoding="utf-8") as f:
        json.dump(ringkasan, f, indent=2)
    print("\nHasil tersimpan ke: hasil_konkurensi.json\n")


if __name__ == "__main__":
    main()
