# Catatan Perubahan (Changelog)

Semua perubahan penting pada proyek **PicLab Sevenz** akan didokumentasikan dalam berkas ini.

Format berkas ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mengikuti prinsip [Semantic Versioning](https://semver.org/lang/id/).

## [0.2.0] - 2026-11-03

### Ditambahkan
- **Sistem Desain & Keputusan Visual**: Integrasi hasil skill UI UX PRO MAX ke dalam `styleguide.md` bagian 6, 7, dan 8 dengan arah *Flat Functional Workspace* yang memusatkan fokus visual pada kanvas citra.
- **Token Tema Tailwind**: Konfigurasi token warna terstandarisasi (`latar`, `garis`, `teks`, `primer`, `aksen`, `status`), tipografi, dan skala radius/bayangan di `tailwind.config.js`.
- **Identitas & Logo Proyek**: Logo vektor SVG penuh (`/logo-piclab.svg`) dan ikon favicon (`/favicon.svg`) yang memadukan aperture optik presisi dan piksel digital tanpa gaya template AI.
- **Internasionalisasi (i18n)**: Integrasi pustaka `i18next` dan `react-i18next` dengan berkas kamus `id.json` dan `en.json`. Mendukung pergantian bahasa instan tanpa memuat ulang halaman serta tersimpan di `localStorage`.
- **Layout Tiga Area Editor**:
  - `BilahAtas.jsx`: Menampilkan logo, pemilih bahasa ID/EN, tautan Belajar (nonaktif dengan status jelas menuju Tahap 9), dan tautan Privasi.
  - `ModalPrivasi.jsx`: Dialog transparansi privasi yang menyatakan pemrosesan klien tidak meninggalkan peramban.
  - `PanelOperasi.jsx`: Panel kiri dengan kerangka rapi keadaan belum ada operasi.
  - `PanelParameter.jsx`: Panel kanan dengan kerangka rapi keadaan belum ada parameter/riwayat.
  - `AreaKanvas.jsx`: Kanvas interaktif dengan kontrol zoom (+, -, 100%, pas layar, roda mouse, keyboard) dan geser (pan).
  - `PenggeserSebelumSesudah.jsx`: Pembanding citra sebelum dan sesudah interaktif berbasis WAI-ARIA slider dengan kontrol drag dan keyboard.
  - `BilahAksiKanvas.jsx`: Menampilkan metadata citra (nama, dimensi, ukuran byte), tombol ganti citra, dan unduh resolusi penuh (PNG, JPG, WebP).
  - `AreaUnggah.jsx`: Keadaan kosong interaktif dengan fitur seret-lepas (*drag and drop*), pemilih berkas, info batasan format, indikator memuat, dan jalan pintas gambar contoh.
- **Konfigurasi Batas & Validasi Klien (OWASP)**: Berkas terpusat `konfigurasiBerkas.js` dan modul `validasiBerkas.js` yang memeriksa tanda tangan biner (magic bytes), menolak SVG, membatasi ukuran (10 MB), dimensi (4096 px), dan total piksel (16 juta piksel).
- **Pengujian End-to-End (Playwright)**: Penyiapan alur pengujian peramban Chromium di folder `e2e/` yang memvalidasi alur pergantian bahasa, alur galat berkas, alur utama unggah -> slider -> unduh, serta visual QA pada resolusi 1280px dan 1920px.
- **Pembaruan CI**: Penambahan job pengujian E2E Playwright ke dalam `.github/workflows/ci.yml`.

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
