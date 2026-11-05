# PicLab Sevenz

Website pengolah citra digital bergaya editor modern dengan arsitektur hibrida (pemrosesan instan di browser dan komputasi lanjutan di backend FastAPI).

Proyek ini dibangun dengan prioritas utama pada **utilitas praktis** bagi pengguna awam dan **mode belajar edukatif** bagi mahasiswa pengolahan citra digital.

---

## 🚀 Teknologi Utama

- **Frontend**: React 18 (JavaScript), Vite, Tailwind CSS v3, Lucide Icons, i18next.
- **Backend**: Python 3.10+ (teruji pada v3.10 dan v3.13.5), FastAPI, Uvicorn, Pillow, NumPy.
- **Pengujian**:
  - Frontend: Vitest + React Testing Library (14 berkas uji, 142 pengujian lulus).
  - Backend: pytest + HTTPX (29 pengujian unit & integrasi OWASP lulus).
  - End-to-End: Playwright Chromium (30 pengujian E2E deterministik lulus).
- **Kualitas & Keamanan**: ESLint, Prettier, Ruff, pip-audit (0 kerentanan), npm audit (0 kerentanan).
- **Integrasi Berkelanjutan (CI)**: GitHub Actions (matriks Python 3.10 & 3.13, Node 22).

---

## 📁 Struktur Folder

Struktur folder utama proyek mengacu pada spesifikasi (`spec.md` bagian 12):

```text
PicLab-Sevenz/
├── .github/
│   └── workflows/       # Alur kerja GitHub Actions (CI: lint, uji frontend, matriks backend, e2e)
├── backend/
│   ├── app/
│   │   ├── inti/        # Konfigurasi aplikasi & CORS ketat
│   │   ├── rute/        # Titik akhir API (GET /kesehatan, POST /api/uji/gema)
│   │   ├── layanan/     # Logika bisnis validasi stream & mitigasi keamanan
│   │   ├── skema/       # Skema format galat standar { kode, pesan }
│   │   ├── konfigurasi.py # Sumber kebenaran tunggal batas ukuran & memori backend
│   │   └── utama.py     # Inisialisasi aplikasi FastAPI & penanganan galat terpusat
│   ├── kelayakan/       # Paket mandiri uji kelayakan hosting bersama (disiapkan untuk Fathin)
│   │   ├── aplikasi_minimal.py      # Server FastAPI diagnostik minimal (RAM murni)
│   │   ├── periksa_lingkungan.py    # Skrip deteksi libc, cgroup limit, & latensi library
│   │   ├── ukur_beban.py            # Skrip pengukur beban sintetis (1, 4, 8, 16 MP)
│   │   ├── uji_konkurensi.py        # Skrip uji konkurensi permintaan serentak (stdlib)
│   │   ├── passenger_wsgi.py        # Jembatan ASGI-ke-WSGI untuk Phusion Passenger
│   │   ├── requirements-uji.txt     # Dependensi uji kelayakan (OpenCV & SciPy hanya di sini)
│   │   ├── garis_dasar_laptop.json  # Hasil pengukuran garis dasar pada perangkat laptop
│   │   ├── SYARAT_HOSTING_SEBELUM_MEMBELI.md # Dokumen spesifikasi sebelum sewa hosting
│   │   └── README.md                # Panduan langkah demi langkah pemasangan di hosting
│   ├── uji/             # Pengujian unit, integrasi, dan keamanan backend (pytest)
│   ├── requirements.txt # Dependensi backend produksi (bersih tanpa OpenCV/SciPy)
│   ├── pyproject.toml   # Konfigurasi proyek & ruff/pytest (requires-python = ">=3.10")
│   └── main.py          # Titik masuk eksekusi server backend
├── frontend/
│   ├── public/          # Berkas statis & aset logo SVG
│   ├── src/
│   │   ├── komponen/    # Komponen antarmuka React (BilahAtas, PanelOperasi, AreaKanvas, dll)
│   │   ├── mesin/       # Algoritma pemrosesan citra Web Worker (30 operasi klien bawaan)
│   │   ├── layanan/     # Layanan jaringan API klien (api.js, pembatalan latest-wins)
│   │   ├── hook/        # Kustom React Hook (useStatusServer.js pemantau reaktif)
│   │   ├── tema/        # Sumber kebenaran tunggal token desain (token.js)
│   │   ├── bahasa/      # Berkas internasionalisasi (id.json & en.json)
│   │   ├── utilitas/    # Validasi biner klien (konfigurasiBerkas.js)
│   │   └── uji/         # Pengujian frontend unit & integrasi
│   ├── package.json     # Dependensi & skrip frontend
│   └── tailwind.config.js # Konfigurasi tema token desain
├── e2e/                 # Pengujian End-to-End Playwright (termasuk penghubungServer.spec.js)
├── Agent.md             # Panduan kerja dan tata tertib agen
├── spec.md              # Spesifikasi teknis arsitektur
├── styleguide.md        # Panduan sistem desain dan antarmuka
├── CHANGELOG.md         # Catatan perubahan berkala
├── .env.example         # Contoh variabel lingkungan
└── README.md            # Dokumentasi utama proyek
```

---

## 🛠️ Panduan Menjalankan Proyek

### 1. Prasyarat Sistem
- **Node.js**: v20+ (teruji pada v22.16.0 LTS)
- **Python**: **v3.10 minimum yang harus tersedia di hosting** (teruji pada v3.10 dan v3.13.5)

### 2. Persiapan Lingkungan
Salin berkas konfigurasi lingkungan:
```bash
cp .env.example .env
```

Pasang dependensi frontend:
```bash
npm --prefix frontend install
```

Siapkan lingkungan virtual dan dependensi backend produksi:
```bash
cd backend
python -m venv .venv
# Pada Windows:
.venv\Scripts\pip install -r requirements.txt
# Pada Linux / macOS:
# source .venv/bin/activate && pip install -r requirements.txt
cd ..
```

---

## ⚡ Menjalankan Aplikasi (Satu Perintah)

### Menjalankan Frontend:
```bash
npm run dev:frontend
```
Aplikasi frontend akan aktif di: `http://localhost:5173`

### Menjalankan Backend:
```bash
npm run dev:backend
```
API backend akan aktif di: `http://127.0.0.1:8000`  
Endpoint pemeriksaan kesehatan: `http://127.0.0.1:8000/kesehatan`  
Dokumentasi OpenAPI interaktif: `http://127.0.0.1:8000/docs`

---

## 🧪 Menjalankan Pengujian, Audit Keamanan, & Linting

### Pengujian Frontend (Vitest):
```bash
npm run test:frontend
```

### Pengujian Backend (pytest):
```bash
npm run test:backend
```

### Pengujian End-to-End (Playwright):
```bash
npm run test:e2e
```

### Audit Keamanan Dependensi (OWASP):
```bash
# Audit backend Python (CVE/PyPA vulnerability check)
npm run audit:backend

# Audit frontend npm
npm run audit:frontend
```

### Pemeriksaan Gaya Kode (Linting):
```bash
npm run lint
```

---

## 🌐 Kesiapan Hosting & Keputusan Arsitektur

> **Catatan Keputusan Fathin (Bertanggal: 2026-11-05)**:  
> Hosting bersama **belum dibeli dan belum akan dibeli dalam waktu dekat**. Pengujian kelayakan di server hosting bersama **TIDAK dijalankan sekarang**, melainkan disiapkan sebagai paket mandiri di `backend/kelayakan/` beserta dokumen panduan spesifikasi `SYARAT_HOSTING_SEBELUM_MEMBELI.md` dan garis dasar pengukuran laptop.  
> Pengujian di hosting nyata akan dijalankan setelah hosting dibeli dan sebelum deployment di Tahap 11. Tahap 6–10 dikembangkan dan diuji secara lokal.

### Ringkasan Garis Dasar Laptop (Bukan Hasil Hosting):
| Resolusi Citra | Total Piksel | Median Durasi (ms) | Puncak Heap Python (MB) |
| :--- | :--- | :--- | :--- |
| **1 MP** (1000×1000) | 1.000.000 px | 47,2 ms | 7,63 MB |
| **4 MP** (2000×2000) | 4.000.000 px | 174,9 ms | 30,52 MB |
| **8 MP** (3264×2448) | 7.990.272 px | 929,3 ms | 60,97 MB |
| **16 MP** (4000×4000) | 16.000.000 px | 1.916,4 ms | 122,08 MB |

*Catatan Keterbatasan: Tracemalloc hanya mengukur alokasi heap murni Python. Alokasi internal library C (NumPy/Pillow) dan page cache sistem operasi riil diperkirakan 2x–3x lebih besar.*

---

## 📌 Status Tahapan Proyek

- [x] **Tahap 0 — Fondasi repo** (Struktur repositori, Vite + React + Tailwind, FastAPI + `/kesehatan`, Vitest dan pytest, konfigurasi CI).
- [x] **Tahap 1 — Kerangka editor dan sistem desain** (Sistem desain UI UX PRO MAX, token Tailwind, logo SVG & favicon, layout tiga area, validasi berkas klien OWASP, slider sebelum/sesudah, zoom/pan kanvas, unduh resolusi penuh, i18n ID/EN, pengujian Vitest dan E2E Playwright).
- [x] **Tahap 2 — Mesin operasi klien: dasar, warna, enhancement** (Arsitektur fungsi murni `{ data, width, height }`, 17 operasi citra bawaan, Web Worker pola latest-wins, preview responsif 1024 px, unduh resolusi penuh multi-format, visualisasi histogram RGB & luminans SVG mandiri, registri dinamis ekstensibel).
- [x] **Tahap 3 — Pipeline operasi, riwayat, undo/redo, dan preset** (Tumpukan operasi non-destruktif berantai, reducer deterministik, riwayat snapshot ringan ~55 KB / 100 snapshot, prefix caching di worker, reorder seret & keyboard ARIA live, 5 preset awal).
- [x] **Tahap 4 — Biner, konvolusi, smoothing, sharpening, deteksi tepi dasar (Penutupan MVP)** (13 operasi spasial/konvolusi baru total 30 operasi klien, konvolusi sejati pemutaran 180°, editor matriks 3×3 & 5×5 navigasi keyboard, kartu belajar konsep dwibahasa, 3 preset baru, verifikasi standalone 0 network requests ke server).
- [x] **Tahap 5 — Backend: fondasi, keamanan, penghubung klien, uji kelayakan hosting** (Fondasi backend FastAPI terstruktur, validasi bertingkat murah ke mahal 10 MB/4096 px/16 MP, pencegahan decompression bomb, pemrosesan murni RAM 0 disk write, rate limiter 429, semafor serentak 503, header keamanan OWASP, penanganan galat standar `{ kode, pesan }`, penghubung klien latest-wins AbortController, hook pemantau reaktif status server di bilah atas, graceful degradation 100% operasi klien mandiri saat server offline, pembaruan privasi poin 4, paket mandiri `backend/kelayakan/` beserta garis dasar laptop dan panduan spesifikasi hosting).
- [ ] **Tahap 6 — Operasi server: Canny, kontur, morfologi, segmentasi, noise, FFT** *(tahap berikutnya)*.
