# Paket Mandiri Uji Kelayakan Hosting Bersama (PicLab Sevenz)

> **Catatan Keputusan Arsitektur (Bertanggal: 2026-11-05)**:  
> Sesuai instruksi Fathin, hosting bersama **belum dibeli dan belum akan dibeli dalam waktu dekat**. Pengujian kelayakan di server hosting bersama **TIDAK dijalankan sekarang**, melainkan akan dijalankan setelah hosting dibeli dan sebelum deployment (Tahap 11). Tahap 6–10 dikembangkan dan diuji secara lokal.  
> Paket mandiri (`backend/kelayakan/`) beserta garis dasar pengukuran laptop telah disiapkan lengkap sekarang agar siap pakai kapan pun hosting telah tersedia.

---

## 1. Ikhtisar & Tujuan Kit Mandiri

Paket ini dirancang sepenuhnya berdiri sendiri (*self-contained*) dengan dependensi terpisah dari backend produksi. Pustaka komputasi berat seperti `opencv-python-headless` dan `scipy` **HANYA** didefinisikan di sini untuk menguji kemampuan server, dan **TIDAK** disertakan dalam dependensi backend produksi PicLab Sevenz.

Kit ini bertujuan menguji tiga aspek kritis sebelum deployment:
1. **Batas Memori LVE/cgroup**: Memastikan batas RAM hosting tidak mematikan proses (*OOM killer*) saat memproses citra resolusi tinggi hingga 16 MP.
2. **Dampak CPU Throttling**: Mengukur degradasi waktu komputasi spasial di bawah pembatasan CPU hosting bersama.
3. **Kompatibilitas Passenger ASGI->WSGI**: Memverifikasi adaptor `a2wsgi` pada Phusion Passenger tanpa menimbulkan memory leak atau proses zombie.

---

## 2. Panduan Langkah Demi Langkah Memasang di Hosting Bersama

Panduan ini berlaku umum untuk panel hosting bersama modern (cPanel, DirectAdmin, atau panel hosting berbasis Linux lainnya dengan fitur aplikasi Python).

### Langkah 1: Hubungkan ke Server via SSH
Buka terminal dan lakukan autentikasi SSH ke akun hosting:
```bash
ssh username@domain-atau-ip-server -p 22
```

### Langkah 2: Buat Aplikasi Python di Panel Hosting
1. Buka antarmuka panel kontrol hosting (misal menu *Setup Python App* / *Python Manager*).
2. Pilih versi Python: **Python 3.10** (minimum yang didukung), **3.11**, atau **3.12**.
3. Tentukan direktori aplikasi: `piclab-kelayakan`.
4. Tentukan URI aplikasi atau subdomain: arahkan ke subdomain API khusus, misalnya `api.domain.com`.
5. Klik **Create** / **Save**. Panel akan menyiapkan lingkungan virtualenv secara otomatis.

### Langkah 3: Masuk ke Lingkungan Virtualenv & Unggah Berkas
Salin perintah aktivasi virtualenv yang diberikan oleh panel (biasanya terlihat di bagian atas halaman pengaturan Python), contoh:
```bash
source /home/username/virtualenv/piclab-kelayakan/3.11/bin/activate
cd ~/piclab-kelayakan
```
Unggah seluruh isi folder `backend/kelayakan/` ke direktori tersebut menggunakan Git atau SFTP.

### Langkah 4: Pasang Dependensi Biner Murni (`--only-binary=:all:`)
Hosting bersama umumnya menonaktifkan compiler C (`gcc`, `make`). Jalankan perintah pip dengan opsi wajib `--only-binary=:all:`:
```bash
pip install --upgrade pip
pip install --only-binary=:all: -r requirements-uji.txt
```

> **Apa yang dilakukan jika instalasi gagal?**
> - **Jika `opencv-python-headless` gagal terpasang**: Hal ini lazim terjadi jika sistem hosting kekurangan library dinamis OS (`libGL.so.1`, `libglib-2.0.so.0`). Jangan panik: aplikasi dan skrip pengukur beban memiliki fallback otomatis ke Pillow + NumPy. Catat kegagalan ini di laporan agar operasi Canny Tahap 6 dapat disesuaikan menggunakan kernel konvolusi murni NumPy.
> - **Jika error compiler memaksa build wheel**: Periksa versi Python. Pastikan menggunakan Python 3.10 atau 3.11 yang memiliki ketersediaan wheel biner `manylinux` paling lengkap di PyPI.

### Langkah 5: Konfigurasi Subdomain `api.` dan CORS
1. Buat subdomain `api.domainanda.com` di menu Subdomains panel.
2. Arahkan Document Root subdomain ke folder `piclab-kelayakan/public` (atau folder aplikasi Python).
3. Pasang sertifikat SSL gratis (Let's Encrypt / AutoSSL) agar protokol HTTPS aktif.
4. Pastikan header CORS diizinkan untuk origin frontend Anda (telah dikonfigurasi di `aplikasi_minimal.py` dengan `CORSMiddleware`).

### Langkah 6: Konfigurasi Adaptor `passenger_wsgi.py` (ASGI ke WSGI)
Passenger pada Apache/Nginx bekerja berbasis WSGI synchronous, sedangkan FastAPI berbasis asynchronous (ASGI). Berkas `passenger_wsgi.py` di kit ini menggunakan jembatan `a2wsgi.ASGIMiddleware`:
```python
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from a2wsgi import ASGIMiddleware
from aplikasi_minimal import app

# Jembatan ASGI FastAPI menuju WSGI Passenger
application = ASGIMiddleware(app)
```
> **Keterbatasan Adaptor `a2wsgi`**: Adaptor ini menjalankan event loop asyncio di dalam thread worker WSGI. Hindari penggunaan streaming body tanpa batas atau websocket jangka panjang pada hosting bersama.

### Langkah 7: Memeriksa Log & Memulai Ulang Aplikasi
- **Akses Log Galat**: Periksa berkas `passenger.log`, `stderr.log`, atau berkas log di direktori `~/logs/` untuk melihat galat startup atau OOM.
- **Cara Memulai Ulang (Restart)**:
  Cukup buat atau sentuh berkas `restart.txt` di dalam folder `tmp/`:
  ```bash
  mkdir -p tmp && touch tmp/restart.txt
  ```
  Passenger akan memuat ulang proses Python pada request berikutnya tanpa perlu me-reboot server.

---

## 3. Menjalankan Skrip Pengujian di Server (Saat Hosting Sudah Tersedia)

Setelah hosting dibeli pada Tahap 11, jalankan urutan pengujian berikut di terminal SSH:

```bash
# 1. Periksa libc, cgroup limit, dan kecepatan impor library
python periksa_lingkungan.py

# 2. Ukur beban komputasi & alokasi memori sintetis (1 MP, 4 MP, 8 MP, 16 MP)
python ukur_beban.py

# 3. Uji konkurensi endpoint (stdlib tanpa dependensi tambahan)
python uji_konkurensi.py --jumlah 20 --pekerja 4
```

---

## 4. Templat Laporan Hasil Uji Hosting (Tinggal Diisi)

Salin templat ini, isi berdasarkan keluaran berkas `lingkungan.json`, `hasil_beban.json`, dan `hasil_konkurensi.json`, lalu serahkan kepada tim arsitektur:

```markdown
### Laporan Uji Kelayakan Hosting Bersama PicLab Sevenz
- **Nama Penguji**: Fathin
- **Tanggal Pengujian**: [YYYY-MM-DD]
- **Penyedia Hosting**: [Nama Provider]
- **Tipe Paket**: [Hosting Bersama / CloudLinux / VPS KVM]

#### 1. Karakteristik Lingkungan Server
- Versi Python Server: [...]
- Arsitektur & Libc: [...]
- Batas Memori Fisik (LVE PMEM / cgroup): [...] MB
- Dukungan Wheel Biner (OpenCV Headless): [Berhasil / Gagal]
- Web Server / WSGI Server: [LiteSpeed / Apache mod_passenger / Nginx Unit]

#### 2. Hasil Pengukuran Beban Komputasi di Hosting
| Resolusi Citra | Durasi Total (ms) | Puncak Heap RAM (MB) | Status Eksekusi |
| :--- | :--- | :--- | :--- |
| **1 MP** (1000x1000) | ... ms | ... MB | [Sukses / OOM / Timeout] |
| **4 MP** (2000x2000) | ... ms | ... MB | [Sukses / OOM / Timeout] |
| **8 MP** (3264x2448) | ... ms | ... MB | [Sukses / OOM / Timeout] |
| **16 MP** (4000x4000) | ... ms | ... MB | [Sukses / OOM / Timeout] |

#### 3. Hasil Uji Konkurensi & Batas Serentak
- Permintaan Terkirim: 20
- Respons Berhasil (HTTP 200): [...]
- Respons Dibatasi (HTTP 429 / 503): [...]
- Latensi Median: [...] ms
- Kejadian Proses Dimatikan (Killed/OOM): [Ada / Tidak Ada]

#### 4. Kesimpulan & Rekomendasi
- Apakah hosting layak menjalankan batas 16 MP penuh? [Ya / Perlu Diturunkan ke 8 MP]
- Catatan kendala teknis: [...]
```
