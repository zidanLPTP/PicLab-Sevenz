# Agent.md — Aturan Kerja Agent untuk PicLab Sevenz

Dokumen ini wajib dibaca di awal setiap sesi. Dokumen pendamping: `spec.md` (apa yang dibangun dan urutan tahapnya) dan `styleguide.md` (aturan tampilan).
Kalau ada konflik antar dokumen, urutan prioritasnya: instruksi terbaru dari Fathin, lalu `Agent.md`, lalu `spec.md`, lalu `styleguide.md`.

## 1. Proyek

- Nama: **PicLab Sevenz**
- Repo: https://github.com/zidanLPTP/PicLab-Sevenz
- Ringkasan: website pengolah citra digital bergaya editor. Pengguna mengunggah satu gambar, menerapkan operasi (warna, enhancement, biner, konvolusi, deteksi tepi, kontur, morfologi, kompresi, steganografi, watermark, dan lainnya), melihat hasil langsung, lalu mengunduhnya.
- Prioritas produk: **utilitas dulu** (hasil cepat untuk orang awam), **edukasi kedua** (mode belajar konsep untuk mahasiswa).
- Tujuan proyek: portofolio, penerapan materi kuliah Pengolahan Citra Digital, dan nantinya dipakai umum.

## 2. Peran

- **Fathin**: project manager dan pengambil keputusan akhir.
- **Agent (kamu)**: rekan koding. Kamu boleh langsung menulis kode tanpa menunggu persetujuan rencana, tetapi setiap tahap wajib diakhiri dengan laporan sesuai format di bagian 11.
- **Claude (di luar Antigravity)**: reviewer tahap. Fathin mengirim laporanmu ke Claude, Claude menyatakan lolos atau tidak, lalu memberi prompt tahap berikutnya.
- Kerjakan **hanya satu tahap per prompt**. Jangan mengerjakan tahap berikutnya sebelum diminta.

## 3. Stack

| Bagian | Pilihan |
|---|---|
| Frontend | React + **JavaScript** (bukan TypeScript), Vite |
| Styling | Tailwind CSS. Pustaka UI boleh dipilih agent selama kompatibel dengan Tailwind (misalnya shadcn/ui atau Radix) dan dicatat alasannya di laporan |
| Ikon | Satu pustaka ikon saja (disarankan `lucide-react`), tidak boleh campur |
| Pemrosesan klien | Canvas API, ImageData, Web Worker. WebAssembly atau OpenCV.js hanya jika memang perlu |
| Backend | Python + FastAPI, dengan OpenCV, NumPy, Pillow, SciPy bila perlu |
| Database | **Tidak ada** (stateless). Riwayat dan undo/redo disimpan di memori klien |
| Uji frontend | Vitest + React Testing Library |
| Uji backend | pytest |
| Uji E2E | Playwright |
| CI | GitHub Actions |

Versi Node dan Python: **sesuaikan dengan yang terpasang di laptop Fathin**. Cek dulu dengan `node -v` dan `python --version`. Kalau versinya terlalu lama untuk dependency yang dibutuhkan, laporkan dan usulkan pembaruan, jangan diam-diam menurunkan kualitas solusi.

## 4. Bahasa dan Penamaan

Semua yang kamu tulis sendiri memakai **bahasa Indonesia**:

- nama file dan folder (contoh: `PanelParameter.jsx`, `ambangOtsu.js`, `layanan_steganografi.py`)
- nama variabel, fungsi, komponen, kelas
- komentar kode dan docstring
- pesan commit
- README, CHANGELOG, dan laporan tahap

Pengecualian (tetap bahasa Inggris karena bukan buatan kita): kata kunci bahasa, nama API dan metode bawaan library (`useState`, `getImageData`, `cv2.Canny`), nama paket, nama file konfigurasi standar (`package.json`, `vite.config.js`, `Dockerfile`).

Konvensi:
- Komponen React: `PascalCase` (`PenggeserSebelumSesudah.jsx`)
- Fungsi, variabel, hook: `camelCase` (`terapkanKonvolusi`, `useRiwayatOperasi`)
- Konstanta: `HURUF_BESAR_ULAR` (`UKURAN_MAKS_BERKAS`)
- Python: `snake_case` untuk fungsi dan variabel, `PascalCase` untuk kelas
- Teks yang tampil ke pengguna **tidak boleh ditulis langsung di komponen**. Semua lewat berkas terjemahan (lihat `spec.md` bagian i18n).

## 5. Aturan Tampilan

- Ikuti `styleguide.md`. Keputusan visual (warna, font, gaya) berasal dari skill **UI UX PRO MAX**, bukan dari tebakanmu.
- **Dilarang memakai ikon atau gaya "template AI"**: emoji sebagai ikon, ikon percikan/bintang berkilau sebagai hiasan, gradasi ungu-biru default, ilustrasi generik, teks isian seperti "Lorem ipsum" atau "Welcome to our platform".
- Semua ikon berasal dari satu pustaka ikon. Tidak ada ikon buatan tangan kecuali logo.
- Logo dibuat dengan skill pembuat gambar, lalu disimpan sebagai SVG atau PNG di `frontend/public/` dan didokumentasikan di `styleguide.md`.
- Fokus desktop. Mobile tidak wajib, tetapi jangan membuat layout yang rusak total di layar kecil.
- Tidak ada mode gelap.

## 6. Pemakaian Skill

Pakai skill yang relevan tanpa menunggu diminta. Kalau skill yang dibutuhkan belum terpasang, pasang lewat **skills-manager** dan laporkan apa yang dipasang.

| Situasi | Skill |
|---|---|
| Memecah pekerjaan, merencanakan, debugging sistematis, review sebelum lapor | Superpowers |
| Menentukan sistem desain, membuat komponen dan layout, membuat logo | UI UX PRO MAX |
| Kode yang menyentuh unggahan berkas, input pengguna, API, header, dependency | OWASP Secure Coding |
| Memverifikasi alur utama di browser sungguhan | Playwright (browser testing) |
| Menyiapkan deployment (tahap akhir saja) | Coolify deployment, hanya untuk opsi cadangan VPS. Target utama adalah hosting bersama, ikuti `spec.md` bagian 14 |
| Memasang kemampuan baru yang belum ada | skills-manager |
| Penyederhanaan atau gaya kerja khusus | Ponytail, sesuai deskripsi skill-nya |

Di setiap laporan, sebutkan skill mana yang dipakai dan untuk apa.

## 7. Keamanan dan Privasi (wajib)

- **Gambar pengguna tidak boleh disimpan.** Di server, proses di memori (`BytesIO`/array NumPy). Jangan menulis ke disk. Kalau terpaksa memakai berkas sementara, hapus di blok `finally`.
- Jangan mencatat (log) isi gambar, nama berkas asli, atau data pengguna.
- Validasi di server, bukan hanya di klien: ukuran berkas, jenis berkas (cek isi/magic bytes, jangan hanya ekstensi atau header `Content-Type`), dimensi piksel maksimum, dan jumlah piksel total untuk mencegah *decompression bomb*.
- Terapkan pembatasan laju (rate limiting), CORS yang ketat, header keamanan, dan pesan galat yang tidak membocorkan detail internal.
- Jangan commit rahasia. Gunakan `.env` dan sediakan `.env.example`.
- Audit dependency (`npm audit`, `pip-audit`) di tahap pengujian akhir dan catat hasilnya.

## 8. Kualitas Kode

- Algoritma pemrosesan citra dipisah dari komponen UI sebagai fungsi murni agar mudah diuji.
- Operasi berat di klien dijalankan di **Web Worker** supaya antarmuka tidak membeku.
- Preview langsung memakai versi gambar yang diperkecil, hasil akhir memakai resolusi penuh.
- Setiap algoritma punya komentar singkat berisi nama metode dan rumus intinya. Ini juga bahan untuk mode belajar.
- Jangan menambahkan dependency besar tanpa alasan yang jelas. Setiap dependency baru dicatat di laporan (nama, fungsi, ukuran kira-kira).
- Tidak ada kode mati, `console.log` sisa debugging, atau komentar `TODO` tanpa dicatat di laporan.

## 9. Pengujian

- Algoritma inti: uji unit dengan masukan kecil yang hasilnya bisa dihitung tangan (misalnya matriks 3×3 untuk konvolusi).
- Backend: pytest untuk setiap endpoint, termasuk kasus gagal (berkas salah jenis, terlalu besar, rusak).
- E2E Playwright: alur utama (unggah, terapkan operasi, geser slider, lihat sebelum/sesudah, unduh) dan perpindahan bahasa.
- Tahap tidak boleh dilaporkan selesai jika ada uji yang gagal. Sertakan ringkasan hasil uji di laporan.

## 10. Git, README, dan CHANGELOG

- Cabang: `main` selalu stabil. Kerjakan tiap tahap di cabang `tahap-N-nama-singkat`, lalu gabungkan setelah lolos.
- Pesan commit bahasa Indonesia dengan awalan: `fitur:`, `perbaikan:`, `refaktor:`, `uji:`, `dokumentasi:`, `bangun:`, `keamanan:`. Contoh: `fitur: tambah deteksi tepi Sobel di panel klien`.
- Commit kecil dan fokus. Hindari satu commit raksasa per tahap.
- **Wajib** memperbarui `README.md` dan `CHANGELOG.md` setiap selesai satu fitur (bukan hanya di akhir tahap). Format CHANGELOG: Keep a Changelog, bahasa Indonesia.

## 11. Alur Tahap dan Format Laporan

Alur: Fathin memberi prompt tahap, kamu mengerjakan, kamu mencetak laporan di terminal, Fathin menyalin laporan ke Claude untuk dinilai.

Laporan wajib mengikuti format ini persis, agar mudah dinilai:

```
=== LAPORAN TAHAP N: <nama tahap> ===

1. RINGKASAN
   <2-4 kalimat: apa yang selesai>

2. DAFTAR PERUBAHAN
   - berkas/folder dibuat atau diubah, dan fungsinya

3. KRITERIA LOLOS (dari spec.md)
   - [x] / [ ] setiap kriteria, dengan bukti singkat (nama berkas, perintah, hasil)

4. HASIL PENGUJIAN
   - perintah yang dijalankan dan ringkasan hasilnya (lulus/gagal/jumlah)

5. SKILL YANG DIPAKAI
   - nama skill dan untuk apa

6. DEPENDENCY BARU
   - nama, fungsi, alasan (atau "tidak ada")

7. KEPUTUSAN DAN ASUMSI
   - hal yang kamu putuskan sendiri dan alasannya

8. MASALAH / HAL YANG BELUM BERES
   - jujur, termasuk yang setengah jalan

9. CARA MENJALANKAN DAN MEMERIKSA
   - perintah persis agar Fathin bisa mencoba sendiri

10. COMMIT TERAKHIR
    - hash dan pesan
```

Aturan laporan:
- Jujur. Jangan menandai kriteria `[x]` kalau belum benar-benar diuji.
- Kalau ada yang gagal atau ditunda, tulis di bagian 8. Itu tidak mengurangi nilai, menyembunyikannya yang mengurangi.
- Jika Claude menyatakan tahap **tidak lolos**, Fathin akan mengirim catatan perbaikan. Perbaiki hanya yang dicatat, lalu cetak laporan ulang dengan format yang sama dan tambahkan bagian "REVISI" di atasnya.

## 12. Definisi Selesai (berlaku untuk setiap tahap)

1. Semua kriteria lolos tahap itu di `spec.md` terpenuhi.
2. Semua uji lulus dan tidak ada galat di konsol atau terminal saat dijalankan.
3. `README.md` dan `CHANGELOG.md` sudah diperbarui.
4. Tidak ada pelanggaran aturan bagian 4, 5, dan 7.
5. Laporan sudah dicetak sesuai format bagian 11.
