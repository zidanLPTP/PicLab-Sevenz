# PicLab Sevenz

Website pengolah citra digital bergaya editor modern dengan arsitektur hibrida (pemrosesan instan di browser dan komputasi lanjutan di backend FastAPI).

Proyek ini dibangun dengan prioritas utama pada **utilitas praktis** bagi pengguna awam dan **mode belajar edukatif** bagi mahasiswa pengolahan citra digital.

---

## 🚀 Teknologi Utama

- **Frontend**: React 18 (JavaScript), Vite, Tailwind CSS v3.
- **Backend**: Python 3.13+, FastAPI, Uvicorn.
- **Pengujian**:
  - Frontend: Vitest + React Testing Library.
  - Backend: pytest + HTTPX.
  - End-to-End: Playwright (Chromium).
- **Kualitas Kode**: ESLint, Prettier, Ruff.
- **Integrasi Berkelanjutan (CI)**: GitHub Actions.

---

## 📁 Struktur Folder

Struktur folder utama proyek mengacu pada spesifikasi (`spec.md` bagian 12):

```text
PicLab-Sevenz/
├── .github/
│   └── workflows/       # Alur kerja GitHub Actions (CI: lint, uji, e2e)
├── backend/
│   ├── app/
│   │   ├── inti/        # Konfigurasi aplikasi & CORS
│   │   ├── rute/        # Titik akhir API (termasuk /kesehatan)
│   │   ├── layanan/     # Logika bisnis pemrosesan citra
│   │   ├── skema/       # Skema validasi data
│   │   └── utama.py     # Inisialisasi aplikasi FastAPI
│   ├── uji/             # Pengujian unit backend (pytest)
│   ├── requirements.txt # Daftar dependensi Python
│   ├── pyproject.toml   # Konfigurasi proyek & pytest/ruff
│   └── main.py          # Titik masuk eksekusi backend
├── frontend/
│   ├── public/          # Berkas statis & aset logo SVG
│   │   ├── contoh/      # Gambar contoh bebas lisensi
│   │   ├── favicon.svg  # Favicon ikon lensa optik
│   │   └── logo-piclab.svg # Logo penuh PicLab Sevenz
│   ├── src/
│   │   ├── komponen/    # Komponen antarmuka React
│   │   │   ├── AreaKanvas.jsx
│   │   │   ├── AreaUnggah.jsx
│   │   │   ├── BilahAksiKanvas.jsx
│   │   │   ├── BilahAtas.jsx
│   │   │   ├── DaftarLangkahPipeline.jsx
│   │   │   ├── DaftarRiwayatPerubahan.jsx
│   │   │   ├── EditorMatriksKernel.jsx
│   │   │   ├── HistogramCitra.jsx
│   │   │   ├── KartuBelajarOperasi.jsx
│   │   │   ├── ModalPrivasi.jsx
│   │   │   ├── PanelOperasi.jsx
│   │   │   ├── PanelParameter.jsx
│   │   │   └── PenggeserSebelumSesudah.jsx
│   │   ├── halaman/     # Halaman aplikasi
│   │   ├── mesin/       # Algoritma pemrosesan citra klien murni (30 operasi)
│   │   │   ├── utilitasCitra.js
│   │   │   ├── dasar.js
│   │   │   ├── warna.js
│   │   │   ├── enhancement.js
│   │   │   ├── biner.js
│   │   │   ├── smoothing.js
│   │   │   ├── sharpening.js
│   │   │   ├── konvolusi.js
│   │   │   ├── tepi.js
│   │   │   ├── spasial/
│   │   │   │   └── utilitasKonvolusi.js
│   │   │   ├── preset.js
│   │   │   ├── eksekutorPipeline.js
│   │   │   ├── pipeline.js
│   │   │   └── katalogOperasi.js
│   │   ├── tema/        # Sumber kebenaran tunggal token desain
│   │   │   └── token.js
│   │   ├── pekerja/     # Web Worker untuk pemrosesan citra non-blocking
│   │   │   ├── pekerjaCitra.js
│   │   │   └── pengelolaPekerja.js
│   │   ├── hook/        # Kustom React Hook
│   │   ├── bahasa/      # Berkas internasionalisasi (id.json & en.json)
│   │   ├── gaya/        # Gaya visual & utilitas CSS
│   │   ├── utilitas/    # Validasi berkas biner (OWASP) & batas konfigurasi
│   │   ├── uji/         # Pengujian frontend (Vitest + RTL)
│   │   ├── Aplikasi.jsx # Komponen akar antarmuka editor tiga area
│   │   └── main.jsx     # Titik masuk render React
│   ├── package.json     # Dependensi & skrip frontend
│   ├── vite.config.js   # Konfigurasi Vite & Vitest
│   └── tailwind.config.js # Konfigurasi tema & token desain Tailwind
├── e2e/                 # Pengujian End-to-End (Playwright)
├── tangkapan-layar/     # Tangkapan layar QA visual (diabaikan git)
├── Agent.md             # Panduan kerja dan aturan agent
├── spec.md              # Spesifikasi teknis & urutan tahap
├── styleguide.md        # Panduan sistem desain dan antarmuka
├── CHANGELOG.md         # Catatan perubahan berkala
├── .env.example         # Contoh variabel lingkungan
└── README.md            # Dokumentasi ini
```

---

## 🛠️ Panduan Menjalankan Proyek

### 1. Prasyarat Sistem
- **Node.js**: v20+ (teruji pada v22.16.0)
- **Python**: v3.11+ (teruji pada v3.13.5)

### 2. Persiapan Awal
Salin berkas konfigurasi lingkungan:
```bash
cp .env.example .env
```

Siapkan dependensi frontend:
```bash
cd frontend
npm install
cd ..
```

Siapkan lingkungan virtual dan dependensi backend:
```bash
cd backend
python -m venv .venv
# Pada Windows PowerShell:
.venv\Scripts\pip install -r requirements.txt
# Pada Linux / macOS:
# source .venv/bin/activate && pip install -r requirements.txt
cd ..
```

---

## ⚡ Menjalankan Aplikasi (Satu Perintah)

### Menjalankan Frontend:
Cukup jalankan satu perintah berikut dari folder root:
```bash
npm --prefix frontend run dev
```
*(Atau masuk ke folder `frontend` lalu ketik `npm run dev`)*.  
Aplikasi frontend akan aktif di: `http://localhost:5173`

### Menjalankan Backend:
Cukup jalankan satu perintah berikut dari folder root:
```bash
backend\.venv\Scripts\python backend\main.py
```
*(Pada Linux/macOS: `backend/.venv/bin/python backend/main.py` atau jalankan `python main.py` dari dalam folder `backend` setelah mengaktifkan virtual environment)*.  
API backend akan aktif di: `http://127.0.0.1:8000`  
Endpoint pemeriksaan kesehatan: `http://127.0.0.1:8000/kesehatan`

---

## 🧪 Menjalankan Pengujian & Linting

### Pengujian Unit Frontend (Vitest):
```bash
npm --prefix frontend test
```

### Pengujian E2E (Playwright):
```bash
npx playwright test
```

### Benchmark Kinerja & Pengujian Latensi Spasial:
```bash
$env:RUN_BENCHMARK="true"; npx playwright test e2e/benchmarkTahap4.spec.js
```

### Pengujian Backend (pytest):
```bash
cd backend
.venv\Scripts\pytest -v
cd ..
```

### Pemeriksaan Gaya Kode (Linting):
```bash
# Frontend (ESLint + Prettier check)
npm --prefix frontend run lint
npm --prefix frontend run format:check

# Backend (Ruff)
cd backend
.venv\Scripts\ruff check .
cd ..
```

---

## 📌 Status Proyek

- [x] **Tahap 0 — Fondasi repo** (Struktur repositori, Vite + React + Tailwind, FastAPI + endpoint `/kesehatan`, pengujian Vitest dan pytest, konfigurasi CI).
- [x] **Tahap 1 — Kerangka editor dan sistem desain** (Sistem desain UI UX PRO MAX, token Tailwind, logo SVG & favicon, layout tiga area, validasi berkas klien OWASP, slider sebelum/sesudah, zoom/pan kanvas, unduh resolusi penuh, i18n ID/EN, pengujian Vitest dan E2E Playwright).
- [x] **Tahap 2 — Mesin operasi klien: dasar, warna, enhancement** (Arsitektur fungsi murni `{ data, width, height }`, 17 operasi citra bawaan, Web Worker dengan pola "permintaan terbaru menang", preview responsif batas 1024 px, unduh resolusi penuh multi-format, visualisasi histogram RGB & luminans SVG mandiri, registri dinamis ekstensibel).
- [x] **Tahap 3 — Pipeline operasi, riwayat, undo/redo, dan preset** (Tumpukan operasi non-destruktif berantai, reducer deterministik, riwayat snapshot ringan ~55 KB / 100 snapshot, prefix caching di worker, reorder seret & keyboard ARIA live, 5 preset awal).
- [x] **Tahap 4 — Biner, konvolusi, smoothing, sharpening, deteksi tepi dasar (Penutupan MVP)** (13 operasi spasial/konvolusi baru total 30 operasi, konvolusi sejati pemutaran 180°, editor matriks 3×3 & 5×5 navigasi panah keyboard, kartu belajar konsep akademis dwibahasa, 3 preset baru, verifikasi standalone 0 network requests ke server).
- [ ] **Tahap 5 — Integrasi backend, Canny, dan operasi server pertama** *(tahap berikutnya)*.
