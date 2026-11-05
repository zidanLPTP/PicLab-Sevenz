# Catatan Perubahan (Changelog)

Semua perubahan penting pada proyek **PicLab Sevenz** akan didokumentasikan dalam berkas ini.

Format berkas ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mengikuti prinsip [Semantic Versioning](https://semver.org/lang/id/).

## [0.6.0] - 2026-11-05

### Ditambahkan
- **Fondasi Backend FastAPI & Validasi Berlapis (Tahap 5)**:
  - Arsitektur modular di `backend/app/` (`inti/`, `rute/`, `layanan/`, `skema/`, `konfigurasi.py`, `utama.py`).
  - Validasi bertingkat murah ke mahal:
    - Batas ukuran aliran masuk 10 MB dibaca per-chunk 64 KB (penolakan HTTP 413 `BERKAS_TERLALU_BESAR` seketika saat melebihi batas tanpa membaca seluruh isi).
    - Verifikasi magic bytes biner untuk format JPEG, PNG, WebP, dan BMP (HTTP 415 `FORMAT_TIDAK_DIDUKUNG`).
    - Verifikasi dimensi header `citra.size` via Pillow tanpa full decode untuk mencegah *decompression bomb* (HTTP 400 `DIMENSI_TERLALU_BESAR` > 4096 px dan `PIKSEL_TERLALU_BANYAK` > 16 MP).
    - Sanitasi parameter dengan batas rentang eksplisit (HTTP 422 `PARAMETER_TIDAK_VALID`).
  - Pemrosesan murni di memori (RAM) via `io.BytesIO` dan array NumPy dengan bukti 0 penulisan ke disk (`test_tanpa_disk.py`).
  - Format respon galat standar seragam `{ "kode": "...", "pesan": "..." }` untuk seluruh penangan eksepsi.
- **Keamanan OWASP & Pertahanan Server**:
  - Pembatas laju (*Rate Limiter*) IP bawaan menggunakan SlowAPI (60 req/menit dengan header HTTP 429 `TERLALU_BANYAK_PERMINTAAN` dan `Retry-After`).
  - Semafor pembatas konkurensi serentak (`BATAS_PERMINTAAN_SERENTAK = 2`) yang mengembalikan HTTP 503 `SERVER_SIBUK` saat kapasitas maksimal tercapai.
  - Batas waktu per-permintaan (*request timeout*) 15 detik dengan `asyncio.wait_for`.
  - CORS ketat hanya untuk origin terdaftar, metode `GET, POST, OPTIONS`, dan header terdaftar.
  - Header keamanan OWASP: `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `Content-Security-Policy: frame-ancestors 'none'`, penghapusan header bocoran `server`.
  - Audit dependensi otomatis: `pip-audit` menghasilkan 0 vulnerabilitas pada requirements backend produksi.
  - Privasi log server: format log kustom terbukti murni mencatat metode, rute, status HTTP, durasi, dan kode galat tanpa pernah mencatat nama berkas asli pengguna (`test_log_privasi.py`).
- **Penghubung Klien API & Graceful Degradation**:
  - Modul layanan `frontend/src/layanan/api.js` dengan mekanisme pembatalan otomatis permintaan usang (*latest-wins AbortController*) per rute, validasi ukuran <10 MB di klien, dan nama berkas generik `citra.png`.
  - Kustom hook `useStatusServer.js`: pemeriksaan awal, polling berkala 30s, penghentian polling saat tab disembunyikan (`visibilitychange`), backoff eksponensial saat server offline, dan pemicu periksa manual.
  - Indikator status server di `BilahAtas.jsx` dengan token sistem desain resmi, animasi status reaktif (hijau/merah/abu), tooltip dwibahasa, dan tombol periksa ulang manual.
  - Graceful degradation: aplikasi klien tetap 100% berfungsi mandiri saat backend mati/offline; operasi dengan metadata `lokasi: 'server'` dinonaktifkan secara aman dengan keterangan ramah pengguna di `PanelOperasi.jsx`.
  - Pembaruan Dialog Privasi dwibahasa (poin 4) yang menjelaskan transparansi pencatatan log server tanpa nama berkas asli.
- **Kit Mandiri Uji Kelayakan Hosting Bersama (F')**:
  - Paket berdiri sendiri di `backend/kelayakan/` dengan dependensi terpisah (`requirements-uji.txt`). OpenCV dan SciPy HANYA ada di sini dan tidak masuk requirements backend produksi.
  - Skrip diagnostik: `aplikasi_minimal.py` (FastAPI minimal di RAM), `periksa_lingkungan.py` (deteksi cgroup/LVE), `ukur_beban.py` (beban sintetis deterministik 1, 4, 8, 16 MP dengan waktu median dan puncak memori), `uji_konkurensi.py` (uji beban stdlib), dan `passenger_wsgi.py` (jembatan ASGI->WSGI via `a2wsgi`).
  - Garis Dasar Laptop terukur empiris pada Python 3.13.5 (1 MP = 47,2 ms / 7,63 MB; 4 MP = 174,9 ms / 30,52 MB; 8 MP = 929,3 ms / 60,97 MB; 16 MP = 1916,4 ms / 122,08 MB) disertai dokumentasi keterbatasan memori `tracemalloc`.
  - Dokumen panduan `SYARAT_HOSTING_SEBELUM_MEMBELI.md` memuat batas minimal RAM 1–2 GB, dukungan wheel biner, versi Python minimum 3.10, dan 5 pertanyaan sebelum sewa hosting.
  - Pencatatan keputusan Fathin (2026-11-05): hosting bersama belum dibeli dan pengujian di hosting nyata ditunda hingga Tahap 11 sebelum deployment.

## [0.5.0] - 2026-11-04

### Ditambahkan
- **Mesin Operasi Spasial, Biner, & Konvolusi Murni (Tahap 4 — Penutupan MVP)**:
  - 13 Operasi Citra Baru terdaftar di katalog bawaan (total 30 operasi):
    - *Citra Biner*: `biner_manual` (ambang luminans Rec.601), `biner_otsu` (pengambangan optimal variansi antar-kelas dengan tie-breaker variansi seri), `biner_adaptif` (Mean-C lokal dinamis menggunakan Summed-Area Table / Citra Integral $O(1)$).
    - *Smoothing*: `halus_mean` (penapis kotak integral $O(1)$ berkinerja independen terhadap radius), `halus_gaussian` (konvolusi separabel 1D horizontal lalu vertikal untuk efisiensi $O(2K)$), `halus_median` (penapis peringkat bebas alokasi per piksel, 3×3 dengan *sorting network* dan 5×5 dengan *insertion sort*).
    - *Sharpening*: `tajam_unsharp` (penajaman mikrokontras berbasis selisih masker kabur Gaussian dengan ambang tonal), `tajam_kernel` (penajaman Laplacian diskrit 4-tetangga dan 8-tetangga).
    - *Konvolusi Spasial*: `konvolusi_kernel` (konvolusi 2D sejati dengan pemutaran 180° terbukti matematis, replikasi piksel tepi, pembagi dinamis, dan offset bias).
    - *Deteksi Tepi*: `tepi_sobel` (gradien diferensial terbobot), `tepi_prewitt` (gradien seragam), `tepi_roberts` (gradien diagonal 2×2), `tepi_laplacian` (turunan kedua isotropik untuk menemukan *zero-crossing*).
  - Sanitasi dan penjepitan ketat parameter spasial (`KONFIGURASI_SPASIAL`): batas elemen matriks $[-100, 100]$, radius mean $[1, 50]$, sigma $[0.1, 30.0]$, jendela adaptif ganjil $[3, 151]$, dan penguatan tepi $[0.1, 10.0]$ (OWASP & ketahanan memori).
- **Editor Matriks Kernel Interaktif & Aksesibel**:
  - Komponen `EditorMatriksKernel.jsx` mendukung matriks 3×3 dan 5×5 dengan navigasi keyboard panah 2D (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`), komit pada Enter/blur, tombol ganti ukuran adaptif berpusat, dropdown 9 preset kernel standar, kalkulator jumlah bobot otomatis, serta umpan balik kesalahan non-warna (ikon + teks pesan WAI-ARIA `aria-invalid`).
- **Kartu Belajar Konsep Akademis Dwibahasa**:
  - Komponen `KartuBelajarOperasi.jsx` berupa akordion lipat (*collapsible*, default tertutup) di bilah kanan yang menampilkan nama akademis teknis, tujuan & kapan digunakan, rumus matematika notasi Unicode murni (tanpa dependensi pustaka berat), dan rincian parameter dwibahasa (ID & EN). (Catatan: visualisasi interaktif piksel/histogram dijadwalkan pada Tahap 9).
- **Preset Tambahan untuk Pengguna Awam**:
  - 3 preset baru: `pertajam` (Unsharp Masking), `siluet_tepi` (Sobel kontur terinversi), dan `hapus_noise` (Median filter) melengkapi total 8 preset siap pakai.
- **Pengujian & Tolok Ukur Kinerja Terstandarisasi**:
  - 28 pengujian unit baru di `frontend/src/uji/mesinTahap4.test.js` mencakup perhitungan manual citra sintetis kecil, pembuktian rotasi 180° konvolusi sejati vs korelasi, replikasi tepi, stabilitas Otsu pada citra datar, uji kasus batas 1×1 dan 2×2, serta verifikasi immutability dan preservasi kanal alfa pada seluruh 30 operasi.
  - 8 pengujian E2E Playwright di `e2e/tahap4.spec.js` memvalidasi alur unggah citra tangga kontras, Otsu biner, Sobel, editor matriks 5×5, undo/redo matriks, preset, alur bilingual, keyboard accessibility, dan verifikasi MVP mandiri tanpa backend (0 network requests).
  - Pengukuran benchmark terstandarisasi dengan Web Worker *latest-wins gating*: percepatan nyata terukur ~1.2-1.5x untuk Gaussian/Unsharp/Sobel dan ~5.4x untuk Median 5x5 (Huang sliding histogram vs perulangan naif). Efisiensi median 5x5 vs 3x3 pada resolusi 12 MP terbukti dipengaruhi oleh pola traversal memori lokal dan cache hierarchy (bukan percabangan / *branch misprediction*). Memori heap peramban dilaporkan tidak terukur karena `performance.memory` Chromium dikonstankan peramban demi keamanan.
  - Tangkapan layar QA visual di `tangkapan-layar/` pada resolusi 1920×1080 dan 1280×800 untuk bahasa Indonesia dan Inggris menampilkan editor matriks 5×5 dan kartu belajar konsep.

## [0.4.0] - 2026-11-04

### Ditambahkan
- **Model Pipeline Non-Destruktif Murni & Manajemen Riwayat Undo/Redo (Tahap 3)**:
  - Arsitektur tumpukan operasi berantai murni (`pipeline.js`) yang mengelola langkah pemrosesan non-destruktif dengan batas maksimum 30 langkah dan 100 tumpukan riwayat.
  - Reducer berkarakter murni (*pure function*) deterministik tanpa pembangkitan ID non-deterministik maupun `Date.now()` di dalam tubuh reducer.
  - Snapshot riwayat murni hanya menyimpan konfigurasi parameter dan urutan langkah tanpa menduplikasi data bitmap piksel di RAM (terukur empiris 56.291 byte / ~55 KB untuk 100 snapshot).
  - Mekanisme coalescing slider: penggeseran pointer slider dikomit saat pointer dilepas (`pointerup`), panah keyboard didebounce (`JEDA_COALESCING_MS: 200`), masukan angka dikomit pada blur/Enter, serta dropdown dan sakelar aktif instan 1 entri.
- **Eksekutor Pipeline Sekuensial Berkinerja Tinggi & Prefix Caching**:
  - `eksekusiPipelineSekuensial` di Web Worker mendukung propagasi dimensi citra dinamis (crop, resize, rotasi) secara berurutan.
  - Prefix caching cerdas untuk preview interaktif: perubahan pada langkah $k$ hanya menghitung ulang langkah $k$ hingga akhir dengan menggunakan kembali hasil antara langkah $0..k-1$ dari memori worker (median komputasi worker cache hit ~9.0 ms vs worst-case ~38.8 ms).
  - Pembuktian identitas byte-for-byte antara jalur ber-cache dan non-cache pada pengujian 15 mutasi acak ber-seed.
  - Eksekusi unduhan resolusi penuh 12 MP tanpa cache intermediate untuk menjaga efisiensi RAM browser.
- **Antarmuka Pengguna, Aksesibilitas, & Integritas Token Desain**:
  - Panel Kiri: 5 Preset awal siap pakai ("Hitam Putih", "Kontras Tinggi", "Hangat Klasik", "Perbaiki Otomatis", "Negatif") dengan komposisi operasi resmi tervalidasi terhadap skema katalog.
  - Panel Kanan: `DaftarLangkahPipeline.jsx` mendukung seret-lepas (drag-and-drop HTML5), penataan ulang langkah keyboard dengan pengumuman ARIA live (`aria-live="polite"`), sakelar aktif/nonaktif per langkah, dan tombol hapus.
  - `DaftarRiwayatPerubahan.jsx`: Akordion kolapsibel yang menampilkan snapshot perubahan dengan cap waktu dan kemampuan melompat ke snapshot mana pun di masa lalu/depan.
  - Bilah Aksi Kanvas: Tombol Undo dan Redo dengan status nonaktif adaptif serta dukungan pintasan keyboard global `Ctrl+Z`, `Ctrl+Shift+Z`, dan `Ctrl+Y`.
  - Penegakan integritas token desain: eliminasi seluruh kelas warna/garis yang tidak terdaftar di `TOKEN_TEMA` (`hover:bg-primer-gelap`, `text-bahaya`, `hover:bg-bahaya/10`, `bg-peringatan/10`, dll) dan penambahan uji otomatis pemindai kelas token di `tokenDesain.test.js`.
- **Utilitas Pengujian Mandiri**:
  - Generator citra uji biner deterministik berbasis Node.js murni (`e2e/utilitas/bangkitkanCitraUji.js`) tanpa ketergantungan runtime Python.

## [0.3.2] - 2026-11-04

### Diperbaiki
- **Eliminasi Total Eval & Registri Statis Modular (0.1)**:
  - Menghapus penggunaan `new Function` / `eval` pada Web Worker dan thread utama sesuai standar OWASP dan Agent.md bagian 7.
  - Mengganti sinkronisasi berbasis IPC `DAFTARKAN_OPERASI` dengan penemuan registri statis otomatis menggunakan `import.meta.glob`.
  - Ekstensibilitas dibuktikan melalui fixture definisi statis di `frontend/src/mesin/uji_fixture/fixtureOperasiInversi.js` yang hanya dimuat pada mode uji via `frontend/.env.test`.
  - Penambahan operasi baru kini murni hanya menyentuh 2 berkas: berkas definisi operasi dan berkas lokalisasi bahasa (`id.json` / `en.json`).
- **Pembersihan Berkas Aset Besar dari Bundle Publik (0.2)**:
  - Menghapus citra biner besar (`foto-4000x3000.png` sebesar 2,65 MB dan `acak-4000x3000.png` sebesar 34,37 MB) dari `frontend/public/contoh/`.
  - Menggantikan aset uji dengan skrip generator deterministik Python `e2e/utilitas/bangkitkanCitraUji.py` yang menyimpan berkas ke `test-assets/` yang terabaikan oleh git (`.gitignore`).
- **Perluasan Penegakan Token Desain ke Seluruh frontend/src (0.3)**:
  - Memperluas cakupan pemindaian `tokenDesain.test.js` secara rekursif ke seluruh berkas `.jsx`, `.js`, dan `.css` di dalam `frontend/src/` (bukan hanya folder komponen).
  - Memastikan tidak ada kelas warna bawaan Tailwind maupun kode hex liar di seluruh proyek.
- **Konsistensi Skala Koordinat Preview vs Penuh (0.4)**:
  - Menambahkan parameter `konteksSkala` (`{ rasio: number }`) pada fungsi `terapkan` untuk operasi koordinat piksel geometris (`dasar_crop`, `dasar_ubah_ukuran`, `dasar_rotasi`).
  - Menjamin parameter koordinat asli terskala proporsional saat dieksekusi pada kanvas preview responsif.
  - Menambahkan pengujian integrasi `konsistensiSkala.test.js`.

## [0.3.1] - 2026-11-04

### Diperbaiki
- **Penegakan Token Sistem Desain & Pengujian Regresi Warna (V5)**:
  - Mengeliminasi seluruh penggunaan kelas warna default Tailwind (`slate-*`, `amber-*`, `rose-*`, `teal-*`, dsb) dan kode heksadesimal mentah di dalam kode komponen `frontend/src/komponen/`.
  - Membangun modul `frontend/src/tema/token.js` sebagai sumber kebenaran tunggal (*single source of truth*) yang dipadukan ke dalam `tailwind.config.js` dan didokumentasikan di `styleguide.md` bagian 6.
  - Menambahkan pengujian Vitest otomatis `tokenDesain.test.js` untuk mencegah regresi warna di masa mendatang.
- **Ekstensibilitas Nyata & Sinkronisasi Registri Web Worker (V6)**:
  - Membangun mekanisme sinkronisasi dua arah antara thread utama dan Web Worker melalui protokol pesan dinamis `{ tipe: 'DAFTARKAN_OPERASI' }`.
  - Menerapkan pendaftaran dinamis reaktif via `langganRegistri` pada `PanelOperasi.jsx` sehingga operasi baru langsung muncul dan memperbarui indikator jumlah operasi di antarmuka.
  - Membuktikan prinsip "penambahan operasi cukup lewat satu berkas definisi" melalui fixture `frontend/src/mesin/fixtureOperasiInversi.js` dan pengujian E2E Playwright `ekstensibilitasOperasi.spec.js` yang memvalidasi operasi kustom dieksekusi di dalam Web Worker (`faseKomputasiWorker > 0`).
- **Validasi Metodologi Benchmark & Baseline Komparatif Sebanding (V1, V2, V3, V4)**:
  - Mengoreksi metodologi benchmark dengan menggunakan citra foto warna nyata 12 MP (`foto-4000x3000.png`, hanya 0.0016% piksel abu-abu) dan citra acak berwarna penuh (`acak-4000x3000.png`) serta parameter uji aktif non-nol (misal `pergeseran: 60` untuk hue, `kecerahan: 30` untuk kecerahan).
  - Melakukan pengukuran baseline sebanding pada komit `2129605` melalui *git worktree* untuk membuktikan dampak optimasi algoritma inlined tanpa alokasi objek dan jalur render kanvas langsung (zero PNG encoding).
  - Mengukur latensi ujung-ke-ujung slider secara presisi menggunakan kait penyelesaian visual `requestAnimationFrame` dan `putImageData`.
  - Menghilangkan longtask berulang selama pergeseran slider (dari 54 longtask pada baseline menjadi hanya 2-4 lonjakan mikro tak berulang pada batas 50 ms).

## [0.3.0] - 2026-11-03

### Ditambahkan
- **Arsitektur Mesin Operasi Citra Murni**:
  - Seluruh algoritma citra diimplementasikan sebagai fungsi murni pada objek `{ data: Uint8ClampedArray, width: number, height: number }` di `frontend/src/mesin/`.
  - Fungsi tidak memutasi masukan (`immutability`), menjaga kanal alfa utuh, dan bekerja tanpa dependensi DOM/browser sehingga dapat diuji secara terisolasi.
- **Katalog 17 Operasi Citra Bawaan**:
  - **Operasi Dasar** (`dasar.js`): Kecerahan (LUT linear), Kontras (peregangan midtone), Negatif (pembalikan fotometrik), Grayscale (ITU-R BT.601), Pembalik / Flip (horizontal & vertikal), Rotasi (ortogonal 90°, 180°, 270°), Potong / Crop (ekstraksi sub-matriks koordinat), Ubah Ukuran / Resize (resampling murni Nearest Neighbor & Bilinear).
  - **Operasi Warna** (`warna.js`): Pisah Kanal RGB (isolasi kanal mode berwarna atau keabuan), Ruang Warna (dekomposisi HSV H/S/V & Grayscale), Saturasi (penskalaan saturasi menjaga luminans), Pergeseran Hue (rotasi lingkaran derajat HSV), Efek Sepia (matriks afinitas hangat), Keseimbangan Warna (penguatan kanal R, G, B independen via LUT).
  - **Operasi Enhancement** (`enhancement.js`): Ekualisasi Histogram (ekualisasi luminans menjaga warna & per-kanal via CDF LUT), Peregangan Kontras (normalisasi min-max dengan pemangkasan persentil ekstrem), Koreksi Gamma (transformasi kurva daya non-linear fotometrik).
- **Arsitektur Registri Dinamis**:
  - Modul `katalogOperasi.js` yang menyediakan skema seragam (id, kategori, kunci i18n, nama teknis, skema parameter dinamis, fungsi terapkan).
  - Penambahan operasi baru cukup dengan mendaftarkan satu objek definisi tanpa perlu memodifikasi komponen UI.
- **Web Worker & Pola Permintaan Terbaru Menang**:
  - Eksekusi komputasi citra di thread terpisah (`frontend/src/pekerja/pekerjaCitra.js`) memanfaatkan *Transferable ArrayBuffer*.
  - Modul `pengelolaPekerja.js` membuang respons basi ketika parameter digeser cepat dan menyediakan fallback sinkron otomatis untuk lingkungan Vitest/Node.
- **Preview Responsif & Unduh Resolusi Penuh**:
  - Preview interaktif bekerja pada salinan gambar yang diperkecil (sisi terpanjang maks 1024 px, didefinisikan di `BATASAN_BERKAS.DIMENSI_MAKS_PREVIEW`).
  - Unduhan hasil tetap dieksekusi pada resolusi penuh hingga 16 juta piksel dengan indikator proses memuat.
- **Visualisasi Histogram SVG Mandiri**:
  - Komponen `HistogramCitra.jsx` berbasis SVG murni tanpa pustaka grafik pihak ketiga.
  - Menampilkan grafik histogram kanal Luminans, Merah, Hijau, dan Biru untuk kondisi sebelum dan sesudah operasi.
- **Penyempurnaan Aksesibilitas & Dialog Privasi**:
  - Modal Privasi (`ModalPrivasi.jsx`) kini memiliki penguncian fokus (*focus trap*), penutupan tombol Escape, dan pengembalian fokus ke pemicu.
- **Peringatan Batas Dimensi Terlihat (P6)**:
  - Penambahan banner peringatan `role="alert"` dinamis pada `PanelParameter.jsx` bila nilai ubah ukuran atau pemotongan melampaui 4096 px atau 16 MP, dengan pesan penjelasan multibahasa (ID/EN) dan nilai efektif yang dijepit.
- **Jalur Render Preview Kanvas Langsung (P2)**:
  - `PenggeserSebelumSesudah.jsx` dan `AreaKanvas.jsx` kini merender pratinjau langsung ke elemen `<canvas>` menggunakan `ctx.putImageData`, meniadakan konversi `toBlob` dan kompresi PNG di thread utama selama penggeseran slider interaktif.
- **Optimasi Algoritma Citra Murni (P3)**:
  - Eliminasi alokasi objek per-piksel pada `warna_hue`, `warna_ruang_warna`, `warna_saturasi`, `warna_sepia`, `enhancement_ekualisasi`, dan `enhancement_peregangan_kontras`. Seluruh operasi kini mencapai median komputasi worker < 10 ms pada preview dan < 150 ms pada resolusi penuh 12 MP, dengan jaminan kesetaraan numerik (selisih <= 1 LSB) terverifikasi lewat uji regresi `regresiOptimasi.test.js`.
- **Pemisahan Skrip Benchmark dari CI Reguler (P5)**:
  - Perintah `npm run benchmark` menjalankan pengujian komprehensif 12 MP dan pengukuran latensi ujung-ke-ujung (`e2e/benchmarkTahap2.spec.js`) secara terpisah dari suite E2E reguler. Suite E2E reguler stabil menyelesaikan 11 pengujian dalam waktu ~6,5 detik.
- **Pengujian Unit & E2E Komprehensif**:
  - 57 pengujian unit lulus di Vitest (termasuk pemetaan 17 operasi mandiri, uji regresi optimasi numerik, uji penjepitan batas dimensi, dan uji registri lengkap).
  - 11 pengujian E2E Playwright lulus konsisten, memvalidasi alur operasi -> slider -> histogram -> unduh resolusi penuh, rotasi dimensi sebelum-sesudah, pencarian katalog, rendering kanvas langsung, serta peringatan batas dimensi di UI.

## [0.2.0] - 2026-11-03

### Ditambahkan
- **Sistem Desain & Keputusan Visual**: Integrasi hasil skill UI UX PRO MAX ke dalam `styleguide.md` bagian 6, 7, dan 8 dengan arah *Flat Functional Workspace* yang memusatkan fokus visual pada kanvas citra.
- **Token Tema Tailwind**: Konfigurasi token warna terstandarisasi (`latar`, `garis`, `teks`, `primer`, `aksen`, `status`), tipografi, dan skala radius/bayangan di `tailwind.config.js`.
- **Identitas & Logo Proyek**: Logo vektor SVG penuh (`/logo-piclab.svg`) dan ikon favicon (`/favicon.svg`) yang memadukan aperture optik presisi dan piksel digital tanpa gaya template AI.
- **Internasionalisasi (i18n)**: Integrasi pustaka `i18next` dan `react-i18next` dengan berkas kamus `id.json` dan `en.json`. Mendukung pergantian bahasa instan tanpa memuat ulang halaman serta tersimpan di `localStorage`.
- **Layout Tiga Area Editor**:
  - `BilahAtas.jsx`: Menampilkan logo, pemilih bahasa ID/EN, tautan Belajar (nonaktif dengan status jelas "Segera hadir"), dan tautan Privasi.
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
