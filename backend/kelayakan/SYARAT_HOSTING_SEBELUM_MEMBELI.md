# Syarat Teknis Hosting Bersama Sebelum Membeli (PicLab Sevenz)

> **Status Dokumen**: Disusun berdasarkan hasil pengujian Garis Dasar Laptop (2026-11-06).  
> **Keputusan Arsitektur (Bertanggal 2026-11-05)**: Hosting belum dibeli dan belum akan dibeli dalam waktu dekat (Keputusan Fathin). Kit kelayakan dan dokumen ini disiapkan sekarang agar menjadi panduan verifikasi spesifikasi sebelum hosting dibeli pada Tahap 11. Tahap 6–10 dikembangkan dan diuji secara lokal.

---

## 1. Kebutuhan Teknis Mutlak (Terbukti Perlu dari Pengujian Laptop)

| Parameter | Kebutuhan Minimum | Nilai Ideal / Disarankan | Dasar Pengujian & Bukti |
| :--- | :--- | :--- | :--- |
| **Versi Python** | **Python 3.11** | Python 3.12 atau 3.13 | EOL Python 3.10 adalah Oktober 2026 (PEP 619). Backend PicLab Sevenz mewajibkan Python `>=3.11` untuk dukungan jangka panjang FastAPI, Pillow 10.4+, NumPy 1.26+, dan Pydantic v2. |
| **RAM Alokasi Proses (LVE/cgroup)** | **1.024 MB (1 GB)** | **2.048 MB (2 GB)** | Pengukuran Garis Dasar Laptop via `psutil` menunjukkan puncak RSS 16 MP mencapai 155,50 MB (heap Python 122,08 MB). Dengan semafor 2 permintaan serentak (`BATAS_PERMINTAAN_SERENTAK=2`), kebutuhan proses tunggal mencapai ~311 MB. Namun jika web server spawn 2–3 worker proses, RAM minimum 1 GB mutlak dibutuhkan. |
| **Ekstensi & Compiler** | `pip install --only-binary=:all:` | Wheel biner Linux (`manylinux`) | Hosting bersama umumnya melarang compiler `gcc`/`g++` di lingkungan pengguna. Semua wheel biner harus dapat diunduh langsung tanpa kompilasi. |
| **Akses Eksekusi & Deploy** | **Akses SSH** + Git | Akses Terminal panel / SSH Key | Diperlukan untuk instalasi dependensi via virtual environment (`venv`) dan penarikan kode repositori. |
| **Dukungan Aplikasi Python** | Fitur aplikasi Python di panel hosting bersama (Phusion Passenger / WSGI / ASGI) | Passenger WSGI terintegrasi Apache/Nginx | Memungkinkan menjalankan skrip Python sebagai daemon web service di belakang reverse proxy port 80/443. |
| **Subdomain & SSL** | Subdomain terpisah (`api.domain.com`) | Free Let's Encrypt SSL otomatis | Memisahkan frontend statis (port 443/CDN) dari API backend dengan enkripsi HTTPS wajib untuk menghindari mixed content. |
| **Batas Waktu Request (Timeout)** | **30 detik** | 60 detik | Operasi 16 MP dengan filter Gaussian Blur + enkode PNG membutuhkan waktu komputasi ~0,7 detik di laptop Core i7/Ryzen. Di CPU hosting throttled (1 Core LVE 100%), durasi dapat membengkak hingga 5–15 detik. |
| **Perilaku Proses Idle** | Daemon restart otomatis / On-demand spin-up | Keep-alive 1 proses minimal | Passenger di hosting bersama mematikan proses setelah idle 5–10 menit. Permintaan pertama (cold start) harus bangkit < 5 detik. |
| **Akses Log** | Log galat web server & Passenger (`stderr.log`) | Akses berkas log di direktori pengguna | Diperlukan untuk mendiagnosis crash Out-of-Memory (OOM) atau kegagalan modul WSGI. |
| **Garansi Pengembalian Dana** | **Minimal 14 hari** (ideal 30 hari) | Garansi uang kembali tanpa syarat | Sesuai `spec.md` bagian 14: garansi ini wajib untuk memitigasi risiko jika cgroup mematikan proses saat uji kelayakan dijalankan. |

---

## 2. Asumsi Teknis (Ditandai Khusus)

> [!NOTE]
> - `[ASUMSI 1]` **Sistem Operasi**: Diasumsikan berbasis Linux 64-bit (CloudLinux, AlmaLinux, Rocky Linux, atau Ubuntu Server) dengan glibc modern (dukungan `manylinux2014` atau `manylinux_2_28`).
> - `[ASUMSI 2]` **Web Server & Gateway**: Diasumsikan menggunakan Apache/Nginx dengan modul Phusion Passenger atau daemon WSGI. Adaptor `a2wsgi` disediakan di kit untuk menjembatani ASGI FastAPI ke WSGI Passenger.
> - `[ASUMSI 3]` **Batasan Port**: Port arbitrer (seperti `:8000`) diasumsikan tertutup firewall masuk; oleh karena itu lalu lintas wajib melewati reverse proxy web server melalui subdomain atau rute URL standar port 80/443.
> - `[ASUMSI 4]` **Semafor Konkurensi Per-Proses**: Semafor FastAPI (`asyncio.Semaphore(2)`) bekerja pada tingkat proses tunggal. Jika panel hosting bersama mengonfigurasi multi-worker Passenger (misalnya 3 proses), maka kapasitas serentak global menjadi 6 permintaan.

---

## 3. Rencana Cadangan (Graceful Fallback & Contingency Plan)

Jika setelah dibeli pada Tahap 11, hosting bersama terbukti tidak mampu menangani beban penuh:

1. **Penurunan Batas Resolusi di Konfigurasi Tanpa Ubah Kode**:
   - Jika memori LVE hosting hanya 512 MB, ubah nilai `TOTAL_PIKSEL_MAKS` di `backend/app/inti/konfigurasi.py` (atau melalui environment variable `TOTAL_PIKSEL_MAKS=8000000`) dari 16 MP menjadi 8 MP atau 4 MP. Seluruh endpoint otomatis menolak citra berlebih tanpa perubahan kode program.
2. **Pengalihan Operasi ke Sisi Klien**:
   - Operasi penapisan ringan yang membebani backend dialihkan ke Web Worker klien (yang terbukti mampu memproses hingga 16 MP di peramban pengguna).
3. **Migrasi ke VPS Mikro (Tahap 11)**:
   - Jika Passenger WSGI hosting bersama bermasalah dengan proses zombie atau OOM killer, gunakan opsi VPS kecil ($4–$5/bulan) dengan Dockerfile mandiri yang telah disiapkan pada Tahap 11.

---

## 4. Daftar Pertanyaan untuk Penyedia Hosting Sebelum Membeli

Salin dan kirimkan daftar pertanyaan berikut ke bagian penjualan (sales/support) calon penyedia hosting sebelum melakukan pembayaran:

1. **Batas Memori LVE/cgroup**:
   *"Berapa alokasi batas memori fisik (Physical Memory Limit / LVE PMEM) per akun hosting untuk paket ini? Apakah mencapai minimal 1 GB atau 2 GB?"*
2. **Ketersediaan Versi Python**:
   *"Apakah fitur pengelolaan Python di panel hosting mendukung Python versi 3.11, 3.12, atau 3.13? Apakah pengguna memiliki akses terminal SSH dan perintah `python3 -m venv`?"*
3. **Instalasi Paket Biner**:
   *"Apakah pengguna dapat memasang library Python biner via `pip install --only-binary=:all:` (misalnya NumPy dan Pillow) tanpa pemblokiran compiler atau pembatasan kuota proses?"*
4. **Batas Eksekusi CPU & Timeout**:
   *"Berapa batas waktu timeout eksekusi skrip (FastCGI/Passenger request timeout) dan alokasi CPU (100% dari 1 core)? Apakah eksekusi pemrosesan selama 15 detik akan dihentikan paksa (killed)?"*
5. **Kebijakan Garansi Uang Kembali**:
   *"Apakah paket ini memiliki garansi pengembalian dana 100% (money-back guarantee) dalam 14–30 hari jika lingkungan Python terbukti tidak kompatibel dengan beban aplikasi kami?"*
