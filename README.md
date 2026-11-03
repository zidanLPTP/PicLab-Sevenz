# PicLab Sevenz

Website pengolah citra digital bergaya editor modern dengan arsitektur hibrida (pemrosesan instan di browser dan komputasi lanjutan di backend FastAPI).

Proyek ini dibangun dengan prioritas utama pada **utilitas praktis** bagi pengguna awam dan **mode belajar edukatif** bagi mahasiswa pengolahan citra digital.

---

## 🚀 Teknologi Utama

- **Frontend**: React (JavaScript, tanpa TypeScript), Vite, Tailwind CSS.
- **Backend**: Python 3.13+, FastAPI, Uvicorn.
- **Pengujian**:
  - Frontend: Vitest + React Testing Library.
  - Backend: pytest + HTTPX.
- **Kualitas Kode**: ESLint, Prettier, Ruff.
- **Integrasi Berkelanjutan (CI)**: GitHub Actions.

---

## 📁 Struktur Folder

Struktur folder utama proyek mengacu pada spesifikasi (`spec.md` bagian 12):

```text
PicLab-Sevenz/
├── .github/
│   └── workflows/       # Alur kerja GitHub Actions (CI)
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
│   ├── public/          # Berkas statis
│   ├── src/
│   │   ├── komponen/    # Komponen antarmuka React
│   │   ├── halaman/     # Halaman aplikasi
│   │   ├── mesin/       # Algoritma pemrosesan citra klien
│   │   ├── pekerja/     # Web Worker untuk komputasi berat
│   │   ├── hook/        # Kustom React Hook
│   │   ├── bahasa/      # Berkas internasionalisasi (id/en)
│   │   ├── gaya/        # Gaya visual & utilitas CSS
│   │   ├── utilitas/    # Fungsi pembantu murni
│   │   ├── uji/         # Pengujian frontend (Vitest + RTL)
│   │   ├── Aplikasi.jsx # Komponen akar antarmuka
│   │   └── main.jsx     # Titik masuk render React
│   ├── package.json     # Dependensi & skrip frontend
│   ├── vite.config.js   # Konfigurasi Vite & Vitest
│   └── tailwind.config.js # Konfigurasi tema Tailwind CSS
├── e2e/                 # Pengujian End-to-End (Playwright)
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

### Pengujian Frontend:
```bash
npm --prefix frontend test
```

### Pengujian Backend:
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
- [ ] **Tahap 1 — Kerangka editor dan sistem desain** *(tahap berikutnya)*.
