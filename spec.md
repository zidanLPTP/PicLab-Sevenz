# spec.md — Spesifikasi PicLab Sevenz

Versi awal. Dokumen ini adalah sumber kebenaran untuk **apa** yang dibangun dan **urutan tahapnya**. Aturan cara kerja ada di `Agent.md`, aturan tampilan di `styleguide.md`.

## 1. Tujuan dan Bukan Tujuan

**Tujuan**
- Website pengolah citra digital yang lengkap, cepat, dan nyaman dipakai orang awam.
- Menyediakan mode belajar yang menjelaskan konsep di balik tiap operasi untuk mahasiswa.
- Menjadi proyek portofolio yang rapi, teruji, dan aman.

**Bukan tujuan (versi ini)**
- Akun dan login, penyimpanan gambar pengguna, database.
- Pemrosesan banyak gambar sekaligus (batch).
- Mode gelap, aplikasi mobile native, analitik.
- Editor ala Photoshop (layer, brush, seleksi bebas).

## 2. Pengguna

1. **Pengguna awam**: ingin mengubah gambar dengan cepat. Butuh preset, nama operasi yang mudah dipahami, dan hasil langsung terlihat.
2. **Mahasiswa**: ingin tahu cara kerja operasi. Butuh penjelasan konsep, rumus, kernel, histogram, dan demo langkah algoritma.

Utilitas adalah prioritas utama. Fitur belajar tidak boleh mengganggu alur pengguna awam (misalnya sebagai panel opsional, bukan halangan).

## 3. Arsitektur Hybrid

```
Browser (React + Web Worker)            Server (FastAPI)
- unggah, tampilan, kanvas              - operasi berat atau butuh library Python
- operasi ringan & preview langsung     - validasi ketat berkas
- pipeline, undo/redo, riwayat          - proses di memori, tanpa simpan ke disk
- slider sebelum/sesudah, unduh         - respons berupa gambar hasil + metadata
```

Prinsip pembagian:
- **Klien** untuk operasi yang cepat dan perlu respons real-time saat slider digeser (privasi lebih baik, tanpa beban server).
- **Server** untuk operasi yang berat, butuh OpenCV/SciPy, atau lebih akurat dengan library Python.
- Preview langsung memakai gambar yang diperkecil. Hasil akhir memakai resolusi penuh.
- Untuk operasi server, preview memakai debounce (misalnya 300 ms) dan gambar kecil. Tombol "Terapkan" menghasilkan versi resolusi penuh.
- Aplikasi harus tetap berguna meskipun server mati: fitur klien tetap jalan, fitur server tampil nonaktif dengan pesan yang jelas.

## 4. Daftar Fitur

Kolom **Lokasi**: K = klien, S = server. Kolom **Fase**: MVP = tahap 0 sampai 4 (aplikasi bisa dipakai penuh tanpa server), Lanjutan = tahap berikutnya.

| Kategori | Operasi | Lokasi | Fase | Bukti Terverifikasi |
|---|---|---|---|---|
| Operasi dasar | Kecerahan, kontras, negatif, grayscale, flip, rotasi, crop, ubah ukuran | K | MVP | `dasar_kecerahan` s.d. `dasar_ubah_ukuran` (`e2e/operasiCitra.spec.js`, `mesinOperasi.test.js`) |
| Operasi warna | Pisah kanal RGB, ruang warna (HSV, grayscale), saturasi, hue, sepia, balance warna | K | MVP | `warna_pisah_kanal` s.d. `warna_balance` (`e2e/operasiCitra.spec.js`, `mesinOperasi.test.js`) |
| Enhancement | Histogram, equalization, peregangan kontras, koreksi gamma | K | MVP | `enhancement_ekualisasi` s.d. `enhancement_gamma` (`e2e/operasiCitra.spec.js`, `mesinOperasi.test.js`) |
| Citra biner | Threshold manual, Otsu, adaptif, inversi | K | MVP | `biner_manual`, `biner_otsu`, `biner_adaptif` (`e2e/tahap4.spec.js`, `mesinTahap4.test.js`) |
| Smoothing | Mean, Gaussian, median (kecil) | K | MVP | `halus_mean`, `halus_gaussian`, `halus_median` (`e2e/tahap4.spec.js`, `mesinTahap4.test.js`) |
| Sharpening | Unsharp mask, kernel sharpen | K | MVP | `tajam_unsharp`, `tajam_kernel` (`e2e/tahap4.spec.js`, `mesinTahap4.test.js`) |
| Konvolusi | Kernel preset dan kernel kustom ukuran 3×3 dan 5×5 | K | MVP | `konvolusi_kernel` (`e2e/tahap4.spec.js`, `mesinTahap4.test.js`) |
| Deteksi tepi (dasar) | Sobel, Prewitt, Roberts, Laplacian | K | MVP | `tepi_sobel`, `tepi_prewitt`, `tepi_roberts`, `tepi_laplacian` (`e2e/tahap4.spec.js`) |
| Pipeline dan riwayat | Susun operasi berurutan, urutkan ulang, aktif/nonaktif, undo/redo | K | MVP | `pipeline.js`, `eksekutorPipeline.js` (`e2e/pipelineRiwayat.spec.js`, `pipeline.test.js`) |
| Pembanding | Slider sebelum/sesudah, unduh hasil | K | MVP | `PenggeserSebelumSesudah.jsx`, `BilahAksiKanvas.jsx` (`e2e/kerangkaEditor.spec.js`) |
| Deteksi tepi (lanjut) | Canny | S | Lanjutan | Tahap 6 |
| Kontur | Pencarian dan gambar kontur, jumlah kontur | S | Lanjutan | Tahap 6 |
| Morfologi | Erosi, dilasi, opening, closing, pilihan struktur elemen | S | Lanjutan | Tahap 6 |
| Segmentasi | Berbasis threshold, k-means warna, watershed (dasar) | S | Lanjutan | Tahap 6 |
| Reduksi noise | Median besar, bilateral, non-local means | S | Lanjutan | Tahap 6 |
| Tambah noise | Gaussian, garam-lada | K atau S | Lanjutan | Tahap 6/8 |
| Filter frekuensi | FFT, spektrum, low-pass, high-pass | S | Lanjutan | Tahap 6 |
| Kompresi | JPEG (kualitas), PNG/WebP lossless, perbandingan ukuran | S | Lanjutan | Tahap 7 |
| Demo algoritma kompresi | RLE, Huffman (langkah demi langkah, rasio) | K atau S | Lanjutan | Tahap 7 |
| Steganografi | LSB: sisipkan dan ekstrak teks atau gambar kecil | S | Lanjutan | Tahap 8 |
| Watermark | Teks dan logo, visible dan invisible, pilihan posisi, opasitas, ukuran | K (visible), S (invisible) | Lanjutan | Tahap 8 |
| Mode belajar | Penjelasan konsep, rumus, visual kernel, hubungan ke operasi | K | Lanjutan | Tahap 9 |

Preset untuk pengguna awam (contoh: "Pertajam", "Hitam putih", "Siluet tepi", "Hapus noise") disusun dari operasi di atas dan ditempatkan menonjol di editor.

## 5. Mode Belajar

- Tiap operasi punya kartu penjelasan: apa fungsinya, kapan dipakai, rumus inti, parameter, contoh sebelum dan sesudah.
- Panel opsional di samping parameter (bukan halaman terpisah wajib). Ada juga halaman "Belajar" yang merangkum semua topik.
- Visualisasi interaktif: tampilan kernel dan perhitungannya pada satu piksel, histogram sebelum dan sesudah, spektrum FFT, langkah RLE dan pohon Huffman.
- Konten tersedia dalam Indonesia dan Inggris.
- Isi materi disusun dari konsep Pengolahan Citra Digital dan harus akurat. Kalau agent ragu pada sebuah rumus, tandai di laporan, jangan mengarang.

## 6. Layout Editor

Gaya editor tiga area (detail visual di `styleguide.md`):
- **Kiri**: daftar operasi per kategori, pencarian operasi, preset.
- **Tengah**: kanvas gambar, zoom dan geser, slider sebelum/sesudah, bilah aksi (unggah, undo, redo, unduh).
- **Kanan**: parameter operasi terpilih, pipeline/riwayat, panel belajar (bisa dilipat).
- Perubahan parameter menghasilkan **preview langsung**.
- Keadaan kosong (belum ada gambar), memuat, dan galat harus dirancang, bukan dibiarkan default.
- Bahasa bisa diganti Indonesia atau Inggris kapan saja tanpa memuat ulang halaman, dan pilihan diingat di `localStorage`.

## 7. Pipeline, Undo/Redo, Riwayat

- Pipeline adalah daftar operasi berurutan yang diterapkan pada gambar asli.
- Pengguna bisa menambah, menghapus, mengubah parameter, mengaktifkan/menonaktifkan, dan mengurutkan ulang langkah.
- Undo/redo mencakup semua perubahan pipeline. Riwayat ditampilkan sebagai daftar yang bisa diklik.
- Semua state ada di memori klien. Tidak ada penyimpanan di server. Menutup halaman menghapus semuanya.

## 8. Batasan Berkas

Batas ini bisa diubah lewat satu berkas konfigurasi (`konfigurasi`), tidak ditulis berulang di kode.

| Item | Nilai awal |
|---|---|
| Format masukan | JPG/JPEG, PNG, WebP, BMP |
| Ukuran berkas maks | 10 MB |
| Dimensi maks | 4096 px sisi terpanjang |
| Total piksel maks | 16 juta piksel |
| Format unduhan | PNG (default), JPG, WebP |
| Jumlah gambar | 1 gambar pada satu waktu |

Catatan teknis: steganografi LSB harus selalu menghasilkan **PNG** (lossless), karena JPG akan merusak bit tersembunyi. Aplikasi harus memberi tahu pengguna.

## 9. Rancangan API Backend (awal)

Semua endpoint menerima `multipart/form-data` (gambar + parameter) dan membalas gambar atau JSON. Nama rute memakai bahasa Indonesia.

| Rute | Fungsi |
|---|---|
| `GET /kesehatan` | Cek server hidup |
| `POST /api/tepi/canny` | Deteksi tepi Canny |
| `POST /api/kontur` | Kontur |
| `POST /api/morfologi` | Erosi, dilasi, opening, closing |
| `POST /api/segmentasi` | Segmentasi |
| `POST /api/noise/reduksi` | Reduksi noise |
| `POST /api/frekuensi` | FFT dan filter frekuensi |
| `POST /api/kompresi` | Kompresi dan perbandingan ukuran |
| `POST /api/steganografi/sisipkan` | LSB sisipkan |
| `POST /api/steganografi/ekstrak` | LSB ekstrak |
| `POST /api/watermark/tak-terlihat` | Watermark invisible |

Aturan: validasi ketat, proses di memori, tidak ada penyimpanan, galat berbentuk `{ "kode": "...", "pesan": "..." }` tanpa detail internal. Agent boleh menyesuaikan nama rute, tetapi harus mendokumentasikannya di README.

## 10. Keamanan dan Privasi

Rincian aturan ada di `Agent.md` bagian 7. Ringkasan target:
- Tidak ada gambar yang tersimpan di server setelah respons dikirim.
- Validasi isi berkas, batas ukuran dan piksel, rate limiting, CORS ketat, header keamanan.
- Teks watermark dan pesan steganografi diperlakukan sebagai input tak tepercaya.
- Ada halaman atau bagian kecil "Privasi" yang jujur menjelaskan: operasi klien tidak meninggalkan browser, operasi server dikirim lalu dihapus segera.

## 11. Internasionalisasi

- Dua bahasa: Indonesia (default) dan Inggris.
- Semua teks tampilan berada di berkas terjemahan (misalnya `frontend/src/bahasa/id.json` dan `en.json`), diakses lewat pustaka i18n.
- Pesan galat dari server berupa kode, diterjemahkan di klien.
- Kunci terjemahan ditulis bahasa Indonesia.

## 12. Struktur Folder Awal

```
PicLab-Sevenz/
  Agent.md  spec.md  styleguide.md  README.md  CHANGELOG.md
  .github/workflows/
  frontend/
    public/
    src/
      komponen/      halaman/      mesin/      pekerja/
      hook/          bahasa/       gaya/       utilitas/
      uji/
  backend/
    app/
      rute/   layanan/   skema/   inti/
    uji/
  e2e/
```

Agent boleh menyesuaikan, tetapi perubahan struktur dicatat di laporan.

## 13. Target Kualitas

- Preview langsung terasa mulus: umpan balik slider di bawah sekitar 100 ms untuk gambar preview pada laptop biasa, UI tidak membeku.
- Waktu proses server untuk hasil akhir di bawah sekitar 5 detik pada gambar ukuran batas.
- Cakupan uji: algoritma inti dan endpoint server punya uji unit, alur utama punya uji E2E.
- Aksesibilitas dasar: bisa dioperasikan keyboard, kontras cukup, label pada kontrol.

## 14. Deployment

> **Catatan Keputusan Arsitektur (Bertanggal: 2026-11-05)**:  
> Hosting bersama belum dibeli dan belum akan dibeli dalam waktu dekat (Keputusan Fathin). Uji kelayakan hosting TIDAK dijalankan sekarang pada Tahap 5, melainkan disiapkan sebagai paket mandiri (backend/kelayakan/) beserta garis dasar pengukuran laptop, dan akan dieksekusi setelah hosting dibeli serta sebelum deployment (Tahap 11). Tahap 6–10 dikembangkan dan diuji secara lokal.


- Tahap awal: **berjalan lokal**.
- Target: hosting bersama milik Fathin dengan akses SSH, Node.js, Python, Git Control, dan Cron Jobs. Docker dan Coolify kemungkinan **tidak tersedia** di hosting jenis ini, jadi jalur deployment utamanya:
  1. Frontend: hasil `npm run build` (folder `dist`) diunggah ke domain atau subdomain sebagai situs statis.
  2. Backend: FastAPI dijalankan lewat fitur aplikasi Python di panel hosting (umumnya berbasis Passenger/WSGI). FastAPI adalah ASGI, jadi mungkin perlu adaptor seperti `a2wsgi` atau cara lain yang didukung hosting. Backend sebaiknya di subdomain terpisah (misalnya `api.`), dengan CORS yang ketat.
  3. Pembaruan: tarik kode lewat Git Control atau SSH.
- Hal yang harus **dibuktikan lewat uji**, bukan diasumsikan: batas RAM dan CPU per proses, apakah proses yang lama dimatikan, apakah `opencv-python-headless`, NumPy, dan SciPy terpasang lewat `pip` tanpa kompilasi, dan waktu serta memori yang dipakai untuk memproses gambar pada ukuran batas. Kalau terlalu berat, turunkan batas total piksel (misalnya menjadi 8 juta) atau pindahkan operasi tertentu ke klien.
- Uji kelayakan hosting dilakukan sebelum Tahap 6 (lihat Tahap 5). Idealnya dijalankan **sebelum membeli paket jangka panjang**, atau pilih paket dengan garansi pengembalian uang.
- Fitur klien harus bisa berjalan tanpa backend, sehingga MVP bisa di-deploy sebagai situs statis lebih dulu.
- Dockerfile dan konfigurasi Coolify tetap disiapkan di Tahap 11 hanya sebagai opsi cadangan jika nanti pindah ke VPS.

## 15. Tahapan

Setiap tahap: prompt dari Fathin, pengerjaan agent, laporan, penilaian Claude. **MVP = tahap 0 sampai 4.**

### Tahap 0 — Fondasi repo
Isi: inisialisasi struktur folder, Vite + React (JS) + Tailwind, linting dan format, Vitest, struktur backend FastAPI kosong dengan `/kesehatan`, pytest, `.gitignore`, `.env.example`, README awal, CHANGELOG awal, CI dasar (lint + uji), cek versi Node/Python laptop.
Lolos jika: frontend dan backend bisa dijalankan dengan satu perintah masing-masing, uji contoh lulus di lokal dan CI, dokumen awal ada.

### Tahap 1 — Kerangka editor dan sistem desain
Isi: jalankan skill UI UX PRO MAX untuk menentukan sistem desain dan isi `styleguide.md` bagian keputusan desain, buat logo, layout tiga area, unggah gambar dengan validasi klien, kanvas dengan zoom/geser, slider sebelum/sesudah, tombol unduh, i18n Indonesia dan Inggris, keadaan kosong/memuat/galat.
Lolos jika: gambar bisa diunggah dan diunduh, bahasa bisa diganti, tampilan sesuai `styleguide.md`, tidak ada ikon template AI, ada uji E2E alur unggah dan unduh.

### Tahap 2 — Mesin operasi klien: dasar, warna, enhancement
Isi: Web Worker pemroses, operasi dasar, operasi warna, histogram, equalization, gamma, preview langsung dengan gambar diperkecil, panel parameter dinamis berbasis definisi operasi.
Lolos jika: semua operasi tahap ini bekerja dan teruji unit, slider tidak membekukan UI, penambahan operasi baru cukup lewat satu berkas definisi.

### Tahap 3 — Pipeline, undo/redo, riwayat
Isi: model pipeline, panel pipeline (tambah, hapus, urutkan, aktif/nonaktif), undo/redo, riwayat yang bisa diklik, preset awal untuk pengguna awam.
Lolos jika: pipeline menghasilkan gambar yang sama dengan penerapan manual berurutan, undo/redo konsisten, ada uji unit model pipeline dan E2E.

### Tahap 4 — Biner, konvolusi, smoothing, sharpening, deteksi tepi dasar
Isi: threshold manual/Otsu/adaptif, konvolusi dengan kernel preset dan kustom (editor matriks), smoothing, sharpening, Sobel/Prewitt/Roberts/Laplacian, penjelasan singkat per operasi (awal mode belajar).
Lolos jika: hasil sesuai perhitungan tangan pada uji kecil, kernel kustom tervalidasi, MVP lengkap dan bisa dipakai tanpa server, README dan CHANGELOG diperbarui.

### Tahap 5 — Backend: fondasi, keamanan, penghubung klien
Isi: validasi berkas ketat (isi, ukuran, piksel), proses di memori tanpa simpan disk, rate limiting, CORS, header keamanan, format galat standar, layanan API di klien, status server di UI dan perilaku jika server mati. Pakai skill OWASP. Tambahkan juga **uji kelayakan hosting**: siapkan backend minimal (`/kesehatan`, impor OpenCV/NumPy/SciPy, satu operasi pada gambar ukuran batas) beserta skrip pengukur waktu dan memori, lalu Fathin menjalankannya di hosting dan melaporkan hasilnya.
Lolos jika: berkas tidak valid ditolak dengan pesan yang benar, tidak ada berkas tersisa di disk setelah permintaan, uji pytest untuk kasus gagal, fitur klien tetap jalan saat server mati, skrip uji kelayakan hosting tersedia dan hasil pengujian di hosting (atau alasan belum dijalankan) tercatat di laporan.

### Tahap 6 — Operasi server: Canny, kontur, morfologi, segmentasi, noise, FFT
Isi: endpoint dan panel UI untuk masing-masing, preview debounce, hasil akhir resolusi penuh, integrasi ke pipeline.
Lolos jika: tiap operasi punya uji pytest dan uji integrasi dari klien, waktu proses wajar sesuai bagian 13.

### Tahap 7 — Kompresi dan demo algoritma
Isi: kompresi JPEG/PNG/WebP dengan perbandingan ukuran dan kualitas, demo RLE dan Huffman langkah demi langkah dengan rasio kompresi.
Lolos jika: perbandingan ukuran akurat, demo Huffman menampilkan tabel kode dan hasil yang bisa didekode kembali tepat sama.

### Tahap 8 — Steganografi LSB dan watermark
Isi: sisipkan dan ekstrak LSB (teks dan gambar kecil, cek kapasitas), keluaran PNG wajib, watermark teks dan logo, visible (posisi, opasitas, ukuran) dan invisible.
Lolos jika: pesan yang disisipkan bisa diekstrak persis sama, kapasitas melebihi batas ditolak dengan pesan jelas, watermark invisible bisa dideteksi kembali.

### Tahap 9 — Mode belajar penuh
Isi: materi tiap operasi (dua bahasa), visualisasi interaktif (kernel pada piksel, histogram, spektrum FFT), halaman Belajar, tautan dari operasi ke materi dan sebaliknya.
Lolos jika: setiap operasi punya penjelasan akurat, rumus tampil benar, konten ada di kedua bahasa, mode belajar tidak mengganggu alur utilitas.

### Tahap 10 — Pengujian menyeluruh, keamanan, performa
Isi: lengkapi uji unit dan E2E Playwright, audit OWASP dan dependency, profil performa, perbaikan aksesibilitas dasar, rapikan kode.
Lolos jika: semua uji lulus, tidak ada temuan keamanan tinggi yang terbuka, target bagian 13 tercapai atau penyimpangannya dicatat.

### Tahap 11 — CI/CD dan kesiapan deployment
Isi: GitHub Actions lengkap (lint, uji, build), skrip dan panduan deployment ke hosting bersama (build frontend, backend lewat aplikasi Python di panel hosting, pembaruan lewat Git/SSH, pengaturan subdomain API dan CORS), Dockerfile dan konfigurasi Coolify sebagai opsi cadangan VPS, panduan deployment di README.
Lolos jika: pipeline CI hijau, build produksi berjalan, panduan deployment bisa diikuti langkah demi langkah.

## 16. Keputusan yang Sudah Diambil

- Frontend React + JavaScript, backend Python FastAPI, hybrid.
- Tanpa database dan tanpa login. Gambar langsung dihapus setelah diproses.
- Satu gambar saja, desktop dulu, tanpa mode gelap, tanpa analitik.
- Dua bahasa (Indonesia dan Inggris). Kode dan commit berbahasa Indonesia.
- Desain ditentukan skill UI UX PRO MAX. Logo digenerate.
- Steganografi hanya LSB. Watermark teks dan logo, visible dan invisible.

## 17. Pertanyaan Terbuka

Agent mencatat jawaban atau usulannya di laporan tahap yang relevan, lalu Fathin memutuskan.
- Pustaka UI mana yang paling cocok dengan Tailwind (agent mengusulkan di tahap 1).
- Hasil uji kelayakan hosting (Pembaruan Keputusan 2026-11-05): Hosting bersama belum dibeli dan belum akan dibeli dalam waktu dekat (Keputusan Fathin). Kit kelayakan (backend/kelayakan/) dan garis dasar laptop telah siap; eksekusi pengujian di hosting nyata ditunda hingga Tahap 11 sebelum deployment. Tahap 6–10 fokus pada pengembangan dan pengujian lokal.
- Batas ukuran dan piksel final setelah diuji di laptop nyata (tahap 10).
