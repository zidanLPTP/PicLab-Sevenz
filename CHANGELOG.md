# Catatan Perubahan (Changelog)

Semua perubahan penting pada proyek **PicLab Sevenz** akan didokumentasikan dalam berkas ini.

Format berkas ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mengikuti prinsip [Semantic Versioning](https://semver.org/lang/id/).

## [0.1.0] - 2026-11-03

### Ditambahkan
- **Fondasi Frontend**: Inisialisasi Vite + React (JavaScript) dengan styling Tailwind CSS.
- **Konfigurasi Kualitas Frontend**: Pengaturan ESLint 9 (flat config) dan Prettier.
- **Pengujian Frontend**: Penyiapan Vitest + React Testing Library beserta contoh uji unit komponen `Aplikasi.jsx`.
- **Fondasi Backend**: Inisialisasi framework FastAPI dengan struktur modular (`app/inti`, `app/rute`, `app/layanan`, `app/skema`).
- **Endpoint Pemeriksaan Kesehatan**: Penambahan rute `GET /kesehatan` pada backend yang mengembalikan status kesehatan layanan dan versi API.
- **Pengujian Backend**: Penyiapan pytest dengan pengujian unit untuk endpoint `GET /kesehatan`.
- **Linter Backend**: Konfigurasi Ruff untuk penegakan standar kode Python.
- **Konfigurasi Repositori**: Berkas `.gitignore`, `.env.example`, dan `README.md` awal.
- **Otomasi CI**: Alur kerja GitHub Actions (`.github/workflows/ci.yml`) untuk linting, pengujian, dan pembangunan produksi frontend serta backend.
