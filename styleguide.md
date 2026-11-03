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

> Agent: jalankan skill, lalu tulis keputusan di bagian ini beserta alasan singkatnya. Jangan mengisi dengan tebakan sebelum skill dijalankan.

- Arah gaya dan alasannya: _belum diisi_
- Palet warna (token nama + nilai, termasuk warna status sukses/peringatan/galat): _belum diisi_
- Tipografi (font, ukuran, bobot, tinggi baris, untuk judul, isi, kode/angka): _belum diisi_
- Skala jarak dan radius sudut: _belum diisi_
- Bayangan dan batas: _belum diisi_
- Pustaka UI terpilih dan alasannya (harus kompatibel Tailwind): _belum diisi_
- Pustaka ikon terpilih: _belum diisi_

Semua nilai di atas dijadikan token di konfigurasi Tailwind (dan variabel CSS bila perlu). Komponen tidak boleh memakai nilai warna atau ukuran "liar" di luar token.

## 7. Komponen Inti (diisi di Tahap 1 dan dilengkapi di tahap berikutnya)

Daftar yang harus punya gaya konsisten:
- Bilah atas (logo, pemilih bahasa, tautan Belajar dan Privasi)
- Daftar operasi dan pencarian operasi, kartu preset
- Kanvas, kontrol zoom dan geser, bilah aksi (unggah, undo, redo, unduh)
- Slider sebelum/sesudah
- Panel parameter: slider, input angka, pilihan, sakelar, editor matriks kernel
- Panel pipeline dan riwayat (daftar yang bisa diurutkan ulang)
- Panel belajar: kartu konsep, tampilan rumus, visualisasi histogram/kernel/spektrum
- Dialog, toast/notifikasi, tooltip
- Keadaan kosong, memuat, dan galat

Untuk tiap komponen, agent mencatat di sini: nama berkas, varian, dan aturan pemakaian singkat.

## 8. Logo dan Identitas

- Nama: **PicLab Sevenz**
- Berkas logo: _belum diisi_
- Aturan pemakaian (ruang kosong, ukuran minimum, latar yang diizinkan): _belum diisi_
- Favicon: _belum diisi_

## 9. Daftar Periksa Visual (dipakai di setiap laporan tahap yang menyentuh UI)

- [ ] Hanya memakai token warna dan jarak dari bagian 6
- [ ] Hanya satu pustaka ikon, tidak ada emoji atau ikon "template AI"
- [ ] Semua teks lewat berkas terjemahan dan muat di dua bahasa
- [ ] Semua keadaan (normal, hover, fokus, nonaktif, memuat, galat) sudah ada
- [ ] Fokus keyboard terlihat, kontras memadai
- [ ] Layout editor tiga area tidak rusak pada lebar desktop umum (1280 sampai 1920 px)
- [ ] Tidak ada teks isian atau gambar palsu
