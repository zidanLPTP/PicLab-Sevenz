# PicLab Sevenz

Website pengolah citra digital bergaya editor modern dengan arsitektur hibrida (pemrosesan instan di browser dan komputasi lanjutan di backend FastAPI).

Proyek ini dibangun dengan prioritas utama pada **utilitas praktis** bagi pengguna awam dan **mode belajar edukatif** bagi mahasiswa pengolahan citra digital.

---

## 🚀 Teknologi Utama

- **Frontend**: React 18 (JavaScript), Vite, Tailwind CSS v3, Lucide Icons, i18next.
- **Backend**: Python 3.11+ (teruji pada v3.11 dan v3.13.5, batas minimum `>=3.11` sesuai PEP 619), FastAPI, Uvicorn, Pillow, NumPy, OpenCV Headless (`cv2.setNumThreads(2)`).
- **Pengujian**:
  - Frontend: Vitest + React Testing Library (15 berkas uji, 146 pengujian lulus).
  - Backend: pytest + HTTPX (65 pengujian unit, integrasi, dan keamanan OWASP lulus).
  - End-to-End: Playwright Chromium (39 pengujian E2E deterministik lulus, mencakup integrasi klien-server nyata tanpa mock dan operasi pemrosesan citra server lanjutan).
- **Kualitas & Keamanan**: ESLint, Prettier, Ruff, pip-audit (0 kerentanan), npm audit (0 kerentanan produksi).
- **Integrasi Berkelanjutan (CI)**: GitHub Actions (matriks Python 3.11 & 3.13, Node 22).

---

## 📁 Struktur Folder

Struktur folder utama proyek mengacu pada spesifikasi (`spec.md` bagian 12):

```text
PicLab-Sevenz/
├── .github/
│   └── workflows/       # Alur kerja GitHub Actions (CI: lint, uji frontend, matriks backend 3.11 & 3.13, e2e)
├── backend/
│   ├── app/
│   │   ├── inti/        # Konfigurasi aplikasi, zero IP logging, & CORS ketat
│   │   ├── rute/        # Titik akhir API (GET /kesehatan, POST /api/uji/gema)
│   │   ├── layanan/     # Logika bisnis validasi stream & mitigasi keamanan
│   │   ├── skema/       # Skema format galat standar { kode, pesan }
│   │   └── utama.py     # Inisialisasi aplikasi FastAPI & penanganan galat terpusat
│   ├── kelayakan/       # Paket mandiri uji kelayakan hosting bersama (disiapkan untuk Fathin)
│   │   ├── aplikasi_minimal.py      # Server FastAPI diagnostik minimal (RAM murni)
│   │   ├── periksa_lingkungan.py    # Skrip deteksi libc, cgroup limit, & latensi library
│   │   ├── ukur_beban.py            # Skrip pengukur beban sintetis via psutil (1, 4, 8, 16 MP)
│   │   ├── uji_konkurensi.py        # Skrip uji konkurensi permintaan serentak (stdlib)
│   │   ├── passenger_wsgi.py        # Jembatan ASGI-ke-WSGI untuk Phusion Passenger
│   │   ├── requirements-uji.txt     # Dependensi uji kelayakan (OpenCV & SciPy hanya di sini)
│   │   ├── garis_dasar_laptop.json  # Hasil pengukuran garis dasar pada perangkat laptop
│   │   ├── SYARAT_HOSTING_SEBELUM_MEMBELI.md # Dokumen spesifikasi sebelum sewa hosting
│   │   └── README.md                # Panduan langkah demi langkah pemasangan di hosting
│   ├── uji/             # Pengujian unit, integrasi, dan keamanan backend (pytest)
│   ├── requirements.txt # Dependensi backend produksi (ramping, 98.80 MB venv bersih)
│   ├── requirements-dev.txt # Dependensi pengembangan, pengujian, dan audit keamanan
│   ├── pyproject.toml   # Konfigurasi proyek & ruff/pytest (requires-python = ">=3.11")
│   └── main.py          # Titik masuk eksekusi server backend Uvicorn (access_log=False)
├── frontend/            # Kode sumber klien React + Vite
└── e2e/                 # Pengujian End-to-End Playwright (alur klien dan klien-server nyata)
```

---

## 🛠️ Panduan Menjalankan Proyek

### 1. Prasyarat Sistem
- **Node.js**: v20+ (teruji pada v22.16.0 LTS)
- **Python**: **v3.11 minimum yang harus tersedia** (teruji pada v3.11 dan v3.13.5; Python 3.10 EOL Oktober 2026 PEP 619)

### 2. Persiapan Lingkungan
Salin berkas konfigurasi lingkungan:
```bash
cp .env.example .env
```

Pasang dependensi frontend:
```bash
npm --prefix frontend install
```

Siapkan lingkungan virtual dan dependensi backend:
```bash
cd backend
python -m venv .venv
# Pada Windows:
.venv\Scripts\pip install -r requirements.txt
# Untuk pengembangan, pengujian, dan audit keamanan:
.venv\Scripts\pip install -r requirements-dev.txt
# Pada Linux / macOS:
# source .venv/bin/activate && pip install -r requirements-dev.txt
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
Dokumentasi OpenAPI interaktif: `http://127.0.0.1:8000/docs` (otomatis dinonaktifkan / 404 saat mode produksi aktif)

### Format Galat Standar & Pemetaan Kode HTTP
Seluruh respons kesalahan dari backend API mengembalikan format JSON seragam `{ "kode": "STRING_TETAP", "pesan": "..." }`:

| Rute Endpoint | Metode | Kode HTTP | Kode Galat (`kode`) | Kondisi Pemicu |
| :--- | :--- | :--- | :--- | :--- |
| `/*` (Semua) | GET/POST | **404 Not Found** | `RUTE_TIDAK_DITEMUKAN` | Rute URL tidak terdaftar di server |
| `/*` (Semua) | DELETE/PUT | **405 Method Not Allowed** | `METODE_TIDAK_DIIZINKAN` | Metode HTTP tidak diizinkan pada endpoint |
| `/api/*` | POST | **400 Bad Request** | `BERKAS_RUSAK` | Berkas kosong (0 byte) atau header citra korup |
| `/api/*` | POST | **400 Bad Request** | `DIMENSI_TERLALU_BESAR` | Sisi citra melebihi 4096 piksel |
| `/api/*` | POST | **400 Bad Request** | `PIKSEL_TERLALU_BANYAK` | Total piksel melebihi 16.000.000 piksel |
| `/api/*` | POST | **413 Content Too Large** | `BERKAS_TERLALU_BESAR` | Ukuran payload melebihi 10 MB |
| `/api/*` | POST | **415 Unsupported Media** | `FORMAT_TIDAK_DIDUKUNG` | Berkas bukan JPEG, PNG, WebP, atau BMP (termasuk SVG & teks) |
| `/api/*` | POST | **422 Unprocessable Content** | `PARAMETER_TIDAK_VALID` | Parameter form/JSON tidak sesuai skema Pydantic |
| `/*` (Kecuali `/kesehatan`) | Semua | **429 Too Many Requests** | `TERLALU_BANYAK_PERMINTAAN` | Melebihi batas laju (60 permintaan/menit per IP) |
| `/api/*` | POST | **500 Internal Server Error**| `GALAT_INTERNAL` | Kesalahan tak terduga (tanpa kebocoran stacktrace) |
| `/api/*` | POST | **503 Service Unavailable** | `SERVER_SIBUK` | Beban serentak melampaui semafor (maks 2 antrean) |

> [!WARNING]
> **Peringatan Penting Rate Limiting & Reverse Proxy**:  
> Pembatas laju (*Rate Limiter*) `PembatasLajuMemori` bekerja secara mandiri di memori server tanpa pustaka pihak ketiga (*slowapi*/Redis). Secara bawaan (`PERCAYAI_PROXY=false`), header `X-Forwarded-For` diabaikan demi keamanan spoofing.  
> **Konsekuensi**: Jika aplikasi diletakkan di belakang reverse proxy hosting bersama tanpa mengaktifkan `PERCAYAI_PROXY=true` dan mendaftarkan IP proxy di `PROXY_TERPERCAYA`, maka seluruh klien akan terbaca memiliki alamat IP yang sama (IP peladen lokal proxy), sehingga batas laju 60 req/menit akan berlaku secara **global** untuk semua pengguna.

> [!NOTE]
> **Catatan Dependensi untuk Tahap 11 (Deployment)**:  
> Paket `uvicorn[standard]` pada `backend/requirements.txt` hanya diperlukan untuk menjalankan server ASGI mandiri lokal/VPS. Pada jalur hosting bersama berbasis cPanel / Phusion Passenger WSGI, `uvicorn` tidak digunakan karena daemon web server Apache/Nginx menangani socket HTTP dan gateway via WSGI (`passenger_wsgi.py` + `a2wsgi`).

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
*Diukur menggunakan `backend/kelayakan/ukur_beban.py` dengan 1 pemanasan + 5 ulangan (median)*:

| Resolusi Citra | Total Piksel | Median Total (ms) | Puncak RSS OS (`psutil`) | Puncak Heap Python (`tracemalloc`) | Median Gaussian Blur (ms) | Ukuran PNG (KB) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1 MP** (1000×1000) | 1.000.000 px | 44,9 ms | 40,94 MB | 7,63 MB | 27,6 ms | 10,5 KB |
| **4 MP** (2000×2000) | 4.000.000 px | 176,9 ms | 64,28 MB | 30,52 MB | 118,5 ms | 28,0 KB |
| **8 MP** (3264×2448) | 7.990.272 px | 355,6 ms | 94,86 MB | 60,97 MB | 232,7 ms | 48,5 KB |
| **16 MP** (4000×4000) | 16.000.000 px | 697,6 ms | 155,50 MB | 122,08 MB | 469,4 ms | 81,6 KB |

*Catatan Penamaan: Kolom `Median Gaussian Blur (ms)` mengukur waktu median algoritma filter Gaussian Blur (radius=2). Keterbatasan semafor konkurensi FastAPI (`BATAS_PERMINTAAN_SERENTAK = 2`) bekerja per-proses; jika hosting menjalankan multi-proses worker Passenger, kapasitas serentak global menjadi perkalian dari jumlah proses aktif.*

---

## 📌 Status Tahapan Proyek

- [x] **Tahap 0 — Fondasi repo** (Struktur repositori, Vite + React + Tailwind, FastAPI + `/kesehatan`, Vitest dan pytest, konfigurasi CI).
- [x] **Tahap 1 — Kerangka editor dan sistem desain** (Sistem desain UI UX PRO MAX, token Tailwind, logo SVG & favicon, layout tiga area, validasi berkas klien OWASP, slider sebelum/sesudah, zoom/pan kanvas, unduh resolusi penuh, i18n ID/EN, pengujian Vitest dan E2E Playwright).
- [x] **Tahap 2 — Mesin operasi klien: dasar, warna, enhancement** (Arsitektur fungsi murni `{ data, width, height }`, 17 operasi citra bawaan, Web Worker pola latest-wins, preview responsif 1024 px, unduh resolusi penuh multi-format, visualisasi histogram RGB & luminans SVG mandiri, registri dinamis ekstensibel).
- [x] **Tahap 3 — Pipeline operasi, riwayat, undo/redo, dan preset** (Tumpukan operasi non-destruktif berantai, reducer deterministik, riwayat snapshot ringan ~55 KB / 100 snapshot, prefix caching di worker, reorder seret & keyboard ARIA live, 5 preset awal).
- [x] **Tahap 4 — Biner, konvolusi, smoothing, sharpening, deteksi tepi dasar (Penutupan MVP)** (13 operasi spasial/konvolusi baru total 30 operasi klien, konvolusi sejati pemutaran 180°, editor matriks 3×3 & 5×5 navigasi keyboard, kartu belajar konsep dwibahasa, 3 preset baru, verifikasi standalone 0 network requests ke server).
- [x] **Tahap 5 — Backend: fondasi, keamanan, penghubung klien, uji kelayakan hosting (Revisi Selesai Penuh)** (Fondasi backend FastAPI terstruktur, validasi bertingkat murah ke mahal 10 MB/4096 px/16 MP, pencegahan decompression bomb, pemrosesan murni RAM 0 disk write, rate limiter 429, semafor serentak 503, header keamanan OWASP, penanganan galat standar `{ kode, pesan }`, Zero IP logging pada server aplikasi dan Uvicorn access log dibungkam, isolasi dependensi produksi requirements.txt 98.80 MB vs dev 157.66 MB, mode lokal statis murni saat VITE_ALAMAT_API kosong dengan 0 request kesehatan, pengujian integrasi klien-server nyata tanpa mock Playwright 4 skenario lulus, pembaruan privasi poin 4 dengan catatan keterbatasan reverse proxy upstream, paket mandiri `backend/kelayakan/` beserta garis dasar laptop RSS terukur psutil dan panduan spesifikasi hosting).
- [x] **Tahap 6 — Operasi server: Canny, kontur, morfologi, segmentasi, noise, FFT** (6 modul pemrosesan citra tingkat lanjut murni di RAM tanpa penulisan disk fisik menggunakan OpenCV `cv2.setNumThreads(2)`, skema Pydantic `extra='forbid'`, pengujian 65 uji unit backend pytest, integrasi katalog frontend dengan debounce 400 ms dan isolasi memori WebP/PNG, 39 uji Playwright E2E deterministik termasuk alur berantai hibrida klien-server, 4 tangkapan layar visual QA 1280px/1920px dwibahasa, dan benchmark garis dasar laptop multi-resolusi 1–16 MP terukur psutil & tracemalloc).
- [ ] **Tahap 7 — Kompresi dan demo algoritma** *(tahap berikutnya)*.
