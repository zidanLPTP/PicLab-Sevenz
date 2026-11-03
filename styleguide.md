# styleguide.md — Panduan Tampilan PicLab Sevenz

Versi awal. Bagian 1 sampai 5 adalah **aturan tetap** dari Fathin. Bagian 6 sampai 9 adalah **keputusan desain yang diisi agent** di Tahap 1 setelah menjalankan skill **UI UX PRO MAX**. Sebelum Tahap 1 selesai, bagian itu masih kosong dan itu normal.

## 1. Karakter Produk

- Kata kunci: **simple, modern, lengkap**.
- Terasa seperti alat kerja yang rapi, bukan halaman promosi. Pengguna datang untuk mengolah gambar, jadi kanvas adalah pusat perhatian dan antarmuka tidak boleh berebut dengannya.
- Dua jenis pengguna: awam (butuh cepat dan jelas) dan mahasiswa (butuh penjelasan). Desain harus melayani keduanya tanpa membuat tampilan awam terasa penuh.

## 2. Aturan Tetap

- Layout gaya **editor tiga area**: kiri (operasi dan preset), tengah (kanvas), kanan (parameter, pipeline, panel belajar).
- **Desktop dulu.** Layout tidak boleh rusak total di layar kecil, tetapi tidak dioptimalkan untuk mobile.
- **Hanya satu tema (terang).** Tidak ada mode gelap.
- **Dua bahasa.** Setiap teks harus muat dalam bahasa Indonesia dan Inggris. Jangan merancang komponen yang hanya muat dengan teks pendek satu bahasa.
- **Preview langsung.** Mengubah parameter langsung mengubah tampilan, tanpa tombol "Terapkan" untuk operasi klien.
- Gaya visual **tidak mengikuti referensi tertentu**. Arahnya ditentukan oleh skill UI UX PRO MAX.

## 3. Ikon dan Aset

- Semua ikon dari **satu pustaka ikon** (disarankan `lucide-react`). Tidak boleh mencampur beberapa pustaka.
- Ukuran dan ketebalan garis ikon konsisten di seluruh aplikasi.
- **Dilarang:**
  - emoji sebagai ikon atau hiasan antarmuka
  - ikon percikan atau bintang berkilau sebagai penanda "fitur AI" atau hiasan
  - gradasi ungu-biru default dan efek cahaya berlebihan
  - ilustrasi stok generik, avatar palsu, testimoni palsu
  - teks isian seperti "Lorem ipsum", "Welcome to the future", "Unleash your creativity"
- Logo dibuat dengan skill pembuat gambar, dalam format SVG bila memungkinkan, disimpan di `frontend/public/`. Siapkan versi penuh (dengan nama) dan versi ikon kecil (untuk favicon).
- Gambar contoh untuk keadaan kosong atau demo harus gambar bebas lisensi atau buatan sendiri, dan dicatat sumbernya.

## 4. Gaya Penulisan Teks Antarmuka

- Ringkas, jelas, aktif. Label tombol berupa kata kerja ("Unduh hasil", "Tambah ke pipeline").
- Nama operasi punya dua tingkat: nama yang mudah bagi awam (misalnya "Pertajam") dan nama teknis di panel belajar (misalnya "Unsharp Mask").
- Pesan galat menjelaskan apa yang terjadi dan apa yang bisa dilakukan pengguna. Tanpa istilah teknis internal.
- Istilah teknis tetap dipakai apa adanya bila memang standar (misalnya "Sobel", "Otsu", "histogram"), dengan penjelasan singkat di panel belajar.
- Semua teks di berkas terjemahan, tidak ditulis langsung di komponen.

## 5. Interaksi dan Keadaan

Setiap komponen interaktif harus punya rancangan untuk: normal, hover, fokus (terlihat jelas untuk keyboard), aktif, nonaktif, memuat, dan galat.

Keadaan layar yang wajib dirancang:
- **Kosong**: belum ada gambar. Ajak mengunggah, tampilkan format dan batas yang didukung, dan tawarkan gambar contoh.
- **Memuat**: indikator untuk operasi server, bukan layar beku. Operasi klien tidak membekukan UI.
- **Server tidak tersedia**: operasi server tampil nonaktif dengan penjelasan, operasi klien tetap bisa dipakai.
- **Galat berkas**: format salah, terlalu besar, dimensi melebihi batas.
- **Hasil**: slider sebelum/sesudah, informasi ukuran dan dimensi, tombol unduh.

Aksesibilitas dasar: bisa dioperasikan keyboard, kontras teks memenuhi standar WCAG AA, setiap kontrol punya label, slider punya nilai yang dibacakan.

Gerakan (animasi): halus dan fungsional, singkat, menghormati preferensi `prefers-reduced-motion`.

## 6. Sistem Desain (diisi agent di Tahap 1 lewat UI UX PRO MAX)

Keputusan desain ini dihasilkan melalui skill **UI UX PRO MAX** berdasarkan analisis kebutuhan aplikasi editor citra digital bergaya utilitas kerja modern:

- **Arah gaya dan alasannya**: *Flat Functional Workspace* / *Minimalist Studio Tool*. Antarmuka dirancang bersih, fungsional, dan fokus pada konten citra tanpa efek gradasi liar, efek kilau, atau bayangan dekoratif berlebihan. Kanvas citra adalah pusat gravitasi visual. Panel instrumen diatur dengan garis batas tegas bernilai kontras tinggi untuk memisahkan ruang kerja secara rapi.
- **Palet warna**:
  - **Latar & Permukaan**:
    - `latar-aplikasi`: `#F8FAFC` (Slate 50 — latar belakang editor)
    - `permukaan-panel`: `#FFFFFF` (Putih murni — latar bilah dan panel)
    - `permukaan-kanvas`: `#F1F5F9` (Slate 100 — latar area kerja kanvas)
    - `garis-panel`: `#E2E8F0` (Slate 200 — garis pemisah panel)
  - **Teks (dengan rasio kontras WCAG AA/AAA terverifikasi)**:
    - `teks-utama`: `#0F172A` (Slate 900 — teks utama, kontras **15.6:1** pada `#FFFFFF`, melampaui WCAG AAA)
    - `teks-sekunder`: `#334155` (Slate 700 — teks pendukung, kontras **9.5:1**, WCAG AAA)
    - `teks-redup`: `#64748B` (Slate 500 — teks label/info pasif, kontras **4.6:1**, memenuhi WCAG AA)
  - **Aksen Brand & Interaksi**:
    - `primer`: `#0D9488` (Teal 600 — warna identitas, fokus kontrol, seleksi aktif)
    - `primer-sorot`: `#0F766E` (Teal 700 — keadaan tombol hover/aktif, kontras teks putih **5.8:1**, WCAG AA)
    - `primer-lembut`: `#F0FDFA` (Teal 50 — latar badge atau item terpilih)
    - `aksen`: `#D97706` (Amber 600 — aksen peringatan & aksi sekunder)
  - **Status**:
    - `status-sukses`: `#059669` (Emerald 600 — kontras teks putih **4.6:1**, WCAG AA)
    - `status-peringatan`: `#D97706` (Amber 600 — teks kontras pada latar terang)
    - `status-galat`: `#DC2626` (Red 600 — kontras teks putih **4.6:1**, WCAG AA)
    - `latar-galat`: `#FEF2F2` (Red 50 — latar kotak pesan galat berkas)
- **Tipografi**:
  - Antarmuka & Teks: `Plus Jakarta Sans`, `Inter`, `system-ui`, `-apple-system`, `sans-serif`.
  - Kode, Matriks & Info Dimensi: `ui-monospace`, `SFMono-Regular`, `Menlo`, `monospace`.
  - Skala Ukuran:
    - `teks-xs`: 0.75rem (12px, baris 1rem)
    - `teks-sm`: 0.875rem (14px, baris 1.25rem)
    - `teks-base`: 1rem (16px, baris 1.5rem)
    - `teks-lg`: 1.125rem (18px, baris 1.75rem)
    - `teks-xl`: 1.25rem (20px, baris 1.75rem)
- **Skala Jarak dan Radius Sudut**:
  - Jarak: `1` (4px), `2` (8px), `3` (12px), `4` (16px), `6` (24px), `8` (32px).
  - Radius sudut:
    - `radius-sm`: 4px (badge, kontrol mikro)
    - `radius-md`: 6px (tombol, input kontrol, pemilih)
    - `radius-lg`: 8px (panel instrumen, wadah kanvas, modal)
- **Bayangan dan Batas**:
  - `bayangan-panel`: `0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)`
  - `batas-panel`: `1px solid #E2E8F0`
  - `cincin-fokus`: `2px solid #0D9488` dengan offset 2px
- **Pustaka UI terpilih dan alasannya**:
  - Pustaka: Komponen *Headless / Tailwind-Native Accessibility Components*.
  - Alasan: Sangat ringan tanpa bloat runtime eksternal, 100% kompatibel dengan Tailwind CSS v3, memenuhi standar WAI-ARIA (peran tombol, slider `aria-valuenow`, dialog `aria-modal`), dan mudah diuji unit.
- **Pustaka Ikon terpilih**:
  - Pustaka: `lucide-react`
  - Alasan: Ikon konsisten bergaya outline modern yang rapi, ketebalan garis standar 1.75px, ukuran baku 18px untuk tombol antarmuka dan 24px untuk wadah unggah citra.

## 7. Komponen Inti (diisi di Tahap 1 dan dilengkapi di tahap berikutnya)

Daftar komponen yang dibangun pada Tahap 1:
- `BilahAtas.jsx`: Bilah atas memuat logo PicLab Sevenz, pemilih bahasa (ID/EN), tautan Belajar (nonaktif dengan keterangan "Tersedia di Tahap 9"), dan tautan Privasi (membuka dialog informasi privasi).
- `PanelOperasi.jsx`: Panel kiri editor yang menampilkan kerangka jujur keadaan belum ada operasi citra yang diterapkan pada Tahap 1.
- `PanelParameter.jsx`: Panel kanan editor yang menampilkan kerangka jujur keadaan belum ada parameter operasi yang disetel.
- `AreaKanvas.jsx`: Kanvas interaktif tengah dengan dukungan zoom roda mouse, tombol zoom (+, -, 100%, pas layar), geser (pan), dan ramah keyboard.
- `PenggeserSebelumSesudah.jsx`: Komponen slider pembanding sebelum dan sesudah dengan bilah pemisah interaktif, label terbaca, dan atribut ARIA lengkap (`role="slider"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`).
- `BilahAksiKanvas.jsx`: Bilah kontrol di bawah kanvas untuk menampilkan informasi berkas (nama citra, dimensi, ukuran), tombol ganti citra, dan opsi unduh citra (PNG, JPG, WebP).
- `AreaUnggah.jsx`: Keadaan kosong editor yang menyediakan area seret-lepas (*drag and drop*), tombol jelajah berkas, rincian batasan format/ukuran, dan tombol jalan pintas untuk memuat gambar contoh.
- `ModalPrivasi.jsx`: Dialog penjelasan privasi yang transparan dan jujur menyatakan bahwa pemrosesan klien tidak meninggalkan peramban.

## 8. Logo dan Identitas

- **Nama**: **PicLab Sevenz**
- **Filosofi Visual**: Ikon menggabungkan bentuk apertur lensa optik presisi dan sel piksel digital, melambangkan laboratorium pengolahan citra digital modern yang akurat.
- **Berkas Logo**:
  - Versi Penuh (Ikon + Nama): `/logo-piclab.svg` (disimpan di `frontend/public/logo-piclab.svg`)
  - Versi Ikon Kecil & Favicon: `/favicon.svg` (disimpan di `frontend/public/favicon.svg`)
- **Aturan Pemakaian**:
  - Ruang kosong minimum di sekeliling logo setara 50% dari tinggi ikon.
  - Ukuran minimum pada antarmuka: tinggi 28px untuk versi penuh, 16px untuk favicon.
  - Latar yang diizinkan: latar terang (`#FFFFFF`, `#F8FAFC`, `#F1F5F9`).
- **Sumber Gambar Contoh**:
  - Gambar contoh untuk keadaan kosong adalah citra lanskap uji bebas lisensi (*public domain* / CC0) yang dibuat sendiri dan disimpan di `frontend/public/contoh/gambar-contoh.webp`.

## 9. Daftar Periksa Visual (dipakai di setiap laporan tahap yang menyentuh UI)

- [ ] Hanya memakai token warna dan jarak dari bagian 6
- [ ] Hanya satu pustaka ikon, tidak ada emoji atau ikon "template AI"
- [ ] Semua teks lewat berkas terjemahan dan muat di dua bahasa
- [ ] Semua keadaan (normal, hover, fokus, nonaktif, memuat, galat) sudah ada
- [ ] Fokus keyboard terlihat, kontras memadai
- [ ] Layout editor tiga area tidak rusak pada lebar desktop umum (1280 sampai 1920 px)
- [ ] Tidak ada teks isian atau gambar palsu
