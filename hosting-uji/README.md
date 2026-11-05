# Paket Uji Kelayakan Hosting (PicLab Sevenz — Tahap 5)

Paket diagnostik mandiri ini disiapkan khusus untuk **Fathin** guna menguji kelayakan lingkungan server (cPanel Shared Hosting atau VPS Linux) sebelum implementasi penuh backend komputasi citra di Tahap 6.

Pengujian ini fokus pada **tiga hal krusial**:
1. Batasan alokasi memori proses (*cgroup memory limit* / *CloudLinux LVE*).
2. Dampak *CPU throttling* hosting bersama terhadap operasi citra multi-resolusi (1 MP hingga 16 MP).
3. Kompatibilitas pustaka numerik/citra (Pillow, NumPy, OpenCV, a2wsgi/Passenger).

---

## 1. Panduan Akses SSH & Penyiapan Virtualenv

### Langkah 1: Masuk ke Server via Terminal SSH
Gunakan terminal lokal (macOS/Linux) atau PowerShell/PuTTY (Windows):
```bash
ssh username@nama-domain-atau-ip -p 22
```

### Langkah 2: Buat atau Aktifkan Virtualenv Python
Pastikan Python versi 3.10, 3.11, atau 3.12 aktif:
```bash
python3 --version

# Buat venv baru jika belum ada
python3 -m venv venv-uji
source venv-uji/bin/activate
```

### Langkah 3: Pasang Dependensi dengan Roda Biner Murni
Untuk hosting bersama tanpa *compiler* C/C++ (`gcc`/`g++`), gunakan opsi wajib `--only-binary=:all:` agar `pip` hanya mengunduh roda biner *pre-compiled*:
```bash
cd hosting-uji
pip install --upgrade pip
pip install --only-binary=:all: -r requirements-uji.txt
```
*(Opsional: Jika ingin menguji OpenCV headless pada server, jalankan: `pip install --only-binary=:all: opencv-python-headless`)*

---

## 2. Urutan Pelaksanaan Uji Mandiri

### Uji 1: Diagnostik Lingkungan & Waktu Muat Modul
Mendeteksi libc, inti CPU, batas cgroup, dan latensi impor pustaka numerik:
```bash
python periksa_lingkungan.py
```
*Keluaran akan tercetak di layar dan otomatis tersimpan ke berkas `lingkungan.json`.*

### Uji 2: Pengukur Beban Sintetis (1 MP, 4 MP, 8 MP, 16 MP)
Menguji komputasi murni di memori RAM dan mengukur puncak konsumsi RAM dengan `tracemalloc`:
```bash
python ukur_beban.py
```
*Keluaran akan tercetak di layar dan otomatis tersimpan ke berkas `hasil_beban.json`.*

### Uji 3: Uji Konkurensi & Batas Serentak
Menjalankan server diagnostik minimal dan menguji respon terhadap permintaan serentak:
```bash
# Terminal 1 (Jalankan server di latar belakang):
python aplikasi_minimal.py &

# Terminal 2 (Atau tunggu 2 detik, lalu jalankan penguji konkurensi):
python uji_konkurensi.py --jumlah 20 --pekerja 5
```
*Keluaran akan tercetak di layar dan otomatis tersimpan ke berkas `hasil_konkurensi.json`.*

---

## 3. Templat Laporan Hasil Uji (Salin & Kirimkan ke Tim)

Salin bagian ini, isi hasilnya dari berkas keluaran JSON/terminal, dan kirimkan kembali kepada tim pengembang:

```markdown
### Laporan Uji Kelayakan Hosting PicLab Sevenz
- **Nama Penguji**: Fathin
- **Tanggal Uji**: [YYYY-MM-DD]
- **Tipe Hosting**: [cPanel Shared Hosting / CloudLinux / VPS KVM]
- **Nama Provider**: [Nama Penyedia Hosting]

#### 1. Spesifikasi Server
- OS & Arsitektur: [...]
- Versi Python: [...]
- Batas Memori cgroup/LVE: [...]
- Status OpenCV: [Tersedia / Gagal Pasang]

#### 2. Hasil Beban Memori & Latensi
| Resolusi | Durasi Total (ms) | Puncak RAM (MB) | Status |
| :--- | :--- | :--- | :--- |
| 1 MP | ... ms | ... MB | Sukses / OOM |
| 4 MP | ... ms | ... MB | Sukses / OOM |
| 8 MP | ... ms | ... MB | Sukses / OOM |
| 16 MP (Batas Maks) | ... ms | ... MB | Sukses / OOM |

#### 3. Hasil Konkurensi
- Permintaan Sukses (200): [...]
- Permintaan Terbatas (429/503): [...]
- Latensi Median: [...] ms
- Catatan Kendala / Throttling: [...]
```

---

## 4. Daftar Pertanyaan Keputusan Arsitektur

Mohon konfirmasi jawaban atas 4 pertanyaan berikut setelah pengujian selesai:

1. **Batas Memori RAM:** Apakah server mampu memproses citra 16 MP tanpa terbunuh oleh *Out-Of-Memory* (OOM Killer) cgroup?
2. **Kompilasi Biner:** Apakah instalasi `opencv-python-headless` berhasil dengan opsi `--only-binary=:all:`, atau server memblokir pustaka C shared (`libGL`, `libgthread`)?
3. **Eksekusi Background / Daemon:** Apakah penyedia hosting mengizinkan proses FastAPI/Uvicorn berjalan terus di port internal, atau wajib menggunakan `passenger_wsgi.py` via Phusion Passenger?
4. **Toleransi Throttling:** Apakah komputasi 8 MP selesai di bawah batas waktu 3000 ms, atau mengalami pembatasan frekuensi CPU (*CPU throttling*) yang signifikan?
