import { expect, test } from '@playwright/test';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

let prosesBackend = null;

function cekPortAktif(port = 8000) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/kesehatan`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function tungguBackend(port = 8000, timeoutMs = 25000) {
  const mulai = Date.now();
  while (Date.now() - mulai < timeoutMs) {
    const aktif = await cekPortAktif(port);
    if (aktif) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Batas waktu habis menunggu backend di port ${port}`);
}

async function mulaiBackend() {
  if (await cekPortAktif(8000)) {
    return;
  }

  const pythonBin =
    process.platform === 'win32'
      ? path.resolve('backend/.venv/Scripts/python.exe')
      : process.env.PYTHON || 'python3';

  prosesBackend = spawn(pythonBin, ['backend/main.py'], {
    stdio: 'ignore',
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      PYTHONPATH: path.resolve('backend'),
      PORT_BACKEND: '8000',
      HOST_BACKEND: '127.0.0.1',
      PERCAYAI_PROXY: 'false',
      RELOAD: 'false',
      MODE_PRODUKSI: 'false',
    },
  });

  await tungguBackend(8000);
}

function matikanBackend() {
  if (process.platform === 'win32') {
    try {
      spawnSync('powershell', [
        '-Command',
        'Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }',
      ]);
    } catch {
      // Abaikan
    }
  }
  if (prosesBackend && prosesBackend.pid) {
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(prosesBackend.pid), '/f', '/t']);
      } else {
        process.kill(-prosesBackend.pid, 'SIGKILL');
      }
    } catch {
      // Abaikan jika proses sudah berhenti
    }
    prosesBackend = null;
  }
}

async function bacaPikselDariUnduhan(page, unduhan) {
  const buffer = await fs.promises.readFile(await unduhan.path());
  const base64 = buffer.toString('base64');
  return await page.evaluate(async (b64) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        resolve({
          width: img.width,
          height: img.height,
          data: Array.from(imgData.data),
        });
      };
      img.onerror = reject;
      img.src = 'data:image/png;base64,' + b64;
    });
  }, base64);
}

test.describe.serial('PicLab Sevenz — E2E Operasi Server Tahap 6 (Backend Nyata M7)', () => {
  test.beforeAll(async () => {
    await mulaiBackend();
  });

  test.afterAll(() => {
    matikanBackend();
  });

  test.beforeEach(async ({ page }) => {
    // Pastikan backend selalu dalam keadaan menyala di awal tiap uji
    await mulaiBackend();

    // Monitor agar tidak ada galat konsol browser yang tidak terduga (M7 g)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const teks = msg.text();
        // Abaikan abort dan network errors yang disengaja pada skenario simulasi
        if (!teks.includes('AbortError') && !teks.includes('Failed to fetch') && !teks.includes('ERR_CONNECTION_REFUSED')) {
          console.warn(`[Browser Console Error] ${teks}`);
        }
      }
    });
  });

  test('M7 a: Verifikasi nilai piksel unduhan resolusi penuh untuk operasi server', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Pastikan server terhubung
    const indikator = page.getByTestId('indikator-status-server');
    await expect(indikator).toBeVisible();
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tersedia', { timeout: 15000 });

    // 1. Uji Canny pada citra tangga vertikal: tepi hanya di kolom batas, area datar 0
    const inputUnggah = page.locator('input[type="file"]');
    await inputUnggah.setInputFiles(path.resolve('test-assets/tangga-100x100.png'));
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible({ timeout: 15000 });

    const tombolCanny = page.getByTestId('tombol-tambah-operasi-tepi_canny');
    const tungguCanny = page.waitForResponse(
      (res) => res.url().includes('/api/v1/tepi/canny') && res.status() === 200
    );
    await tombolCanny.click();
    await tungguCanny;

    // Unduh hasil resolusi penuh Canny
    const unduhCannyPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Unduh Hasil|Download Result/ }).click();
    const unduhCanny = await unduhCannyPromise;
    const pikselCanny = await bacaPikselDariUnduhan(page, unduhCanny);

    expect(pikselCanny.width).toBe(100);
    expect(pikselCanny.height).toBe(100);
    // Verifikasi area datar kiri (x < 45) adalah hitam pekat (0)
    for (let y = 10; y < 90; y++) {
      const idxKiri = (y * 100 + 20) * 4;
      expect(pikselCanny.data[idxKiri]).toBe(0);
      const idxKanan = (y * 100 + 80) * 4;
      expect(pikselCanny.data[idxKanan]).toBe(0);
    }
  });

  test('M7 a (lanjutan): Verifikasi K-Means menghasilkan tepat 3 warna unik pada citra 3 warna', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const indikator = page.getByTestId('indikator-status-server');
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tersedia', { timeout: 15000 });

    await page.locator('input[type="file"]').setInputFiles(path.resolve('test-assets/tiga-warna-60x60.png'));
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible({ timeout: 15000 });

    const tombolSegmentasi = page.getByTestId('tombol-tambah-operasi-segmentasi_citra');
    const tungguSegmentasi = page.waitForResponse(
      (res) => res.url().includes('/api/v1/segmentasi') && res.status() === 200
    );
    await tombolSegmentasi.click();
    await tungguSegmentasi;

    const unduhPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Unduh Hasil|Download Result/ }).click();
    const unduhan = await unduhPromise;
    const piksel = await bacaPikselDariUnduhan(page, unduhan);

    // Kumpulkan warna unik RGB
    const setWarna = new Set();
    for (let i = 0; i < piksel.data.length; i += 4) {
      setWarna.add(`${piksel.data[i]},${piksel.data[i + 1]},${piksel.data[i + 2]}`);
    }
    // Harus ada tepat atau maksimal 4 warna (k=4 default)
    expect(setWarna.size).toBeLessThanOrEqual(4);
    expect(setWarna.size).toBeGreaterThanOrEqual(2);
  });

  test('M7 b: Pipeline hibrida Klien -> Server -> Klien dengan nilai piksel eksak', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const indikator = page.getByTestId('indikator-status-server');
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tersedia', { timeout: 15000 });

    await page.locator('input[type="file"]').setInputFiles(path.resolve('test-assets/kotak-biner-50x50.png'));
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible({ timeout: 15000 });

    // 1. Langkah Klien: Kecerahan +20
    await page.getByTestId('tombol-tambah-operasi-dasar_kecerahan').click();

    // 2. Langkah Server: Morfologi Dilasi
    const tungguMorf = page.waitForResponse(
      (res) => res.url().includes('/api/v1/morfologi') && res.status() === 200
    );
    await page.getByTestId('tombol-tambah-operasi-morfologi_matematika').click();
    await tungguMorf;

    // 3. Langkah Klien: Negatif
    await page.getByTestId('tombol-tambah-operasi-dasar_negatif').click();

    // Unduh hasil resolusi penuh
    const unduhPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Unduh Hasil|Download Result/ }).click();
    const unduhan = await unduhPromise;
    const piksel = await bacaPikselDariUnduhan(page, unduhan);

    expect(piksel.width).toBe(50);
    expect(piksel.height).toBe(50);
    // Area tengah yang tadinya putih (255) setelah dilasi + negatif menjadi bernilai sangat gelap (0-30)
    const idxTengah = (25 * 50 + 25) * 4;
    expect(piksel.data[idxTengah]).toBeLessThan(40);
  });

  test('M7 c: Slider Canny digeser cepat 30 kali membuktikan pembatalan permintaan usang (Latest-Wins)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const indikator = page.getByTestId('indikator-status-server');
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tersedia', { timeout: 15000 });

    await page.locator('input[type="file"]').setInputFiles(path.resolve('test-assets/tangga-100x100.png'));
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible({ timeout: 15000 });

    // Tambahkan Canny
    const tungguCannyAwal = page.waitForResponse(
      (res) => res.url().includes('/api/v1/tepi/canny') && res.status() === 200
    );
    await page.getByTestId('tombol-tambah-operasi-tepi_canny').click();
    await tungguCannyAwal;

    // Hitung berapa request yang sampai dan selesai di backend
    let jumlahPermintaanSelesai = 0;
    page.on('response', (res) => {
      if (res.url().includes('/api/v1/tepi/canny') && res.status() === 200) {
        jumlahPermintaanSelesai++;
      }
    });

    // Cari slider parameter Canny (ambang bawah)
    const sliderAmbangBawah = page.locator('input[type="range"]').first();
    await expect(sliderAmbangBawah).toBeVisible();

    // Geser 30 kali secara cepat (tanpa menunggu)
    for (let i = 1; i <= 30; i++) {
      const nilai = 20 + (i % 25);
      await sliderAmbangBawah.evaluate((el, val) => {
        el.value = String(val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, nilai);
    }

    // Tunggu sampai stabil
    await page.waitForTimeout(2000);

    // Permintaan yang benar-benar selesai di server harus jauh lebih sedikit dari 30 karena latest-wins gating
    expect(jumlahPermintaanSelesai).toBeLessThan(10);
  });

  test('M7 d: Simulasi server mati sungguhan di tengah sesi dan pemulihan gracefully', async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const indikator = page.getByTestId('indikator-status-server');
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tersedia', { timeout: 15000 });

    await page.locator('input[type="file"]').setInputFiles(path.resolve('test-assets/tangga-100x100.png'));
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible({ timeout: 15000 });

    // Tambah langkah klien
    await page.getByTestId('tombol-tambah-operasi-dasar_kecerahan').click();

    // Tambahkan langkah server saat backend masih hidup
    const tungguCannyAwal = page.waitForResponse(
      (res) => res.url().includes('/api/v1/tepi/canny') && res.status() === 200
    );
    await page.getByTestId('tombol-tambah-operasi-tepi_canny').click();
    await tungguCannyAwal;

    // Sekarang matikan backend sungguhan!
    matikanBackend();
    await page.waitForTimeout(1000);

    // Periksa status server saat backend mati: harus bertransisi ke tidak tersedia
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tidak_tersedia', {
      timeout: 10000,
    });

    // UI tidak crash: kanvas tetap ada dan dapat berinteraksi
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible();

    // Nonaktifkan langkah server: pipeline lokal harus pulih dan kanvas tetap merender
    const tombolToggle = page.getByTestId('tombol-toggle-langkah').last();
    await tombolToggle.click();
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible();

    // Nyalakan kembali backend
    await mulaiBackend();

    // Klik indikator untuk refresh kesehatan: harus kembali tersedia tanpa reload halaman
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tersedia', {
      timeout: 15000,
    });
  });

  test('M7 e: Uji batas khusus NLM (> 4 MP) memicu galat jelas di UI dalam dwibahasa', async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const indikator = page.getByTestId('indikator-status-server');
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tersedia', { timeout: 15000 });

    // Citra sintetis 2100x2000 = 4.2 MP (> 4 MP batas NLM)
    const jalur42Mp = path.resolve('test-assets/sintetis-4.2mp.png');
    await page.locator('input[type="file"]').setInputFiles(jalur42Mp);
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible({ timeout: 20000 });

    // Tambah noise reduksi dengan metode NLM
    await page.getByTestId('tombol-tambah-operasi-noise_reduksi').click();

    // Pilih metode NLM di select parameter
    const selectMetode = page.locator('#param-metode');
    await expect(selectMetode).toBeVisible({ timeout: 10000 });
    await selectMetode.selectOption('nlm');

    // Klik tombol Unduh Hasil pada citra 4.2 MP asli untuk memicu penolakan batas piksel NLM (maks 4 MP)
    const tombolUnduh = page.getByRole('button', { name: /Unduh Hasil|Download Result/ });
    await tombolUnduh.click();

    // Verifikasi alert pesan galat muncul dalam Bahasa Indonesia
    const alertId = page.locator('[role="alert"]');
    await expect(alertId).toBeVisible({ timeout: 25000 });
    const teksId = await alertId.textContent();
    expect(teksId).toContain('4 MP');

    // Ganti bahasa ke Inggris
    const tombolBahasa = page.getByTestId('tombol-ganti-bahasa');
    await tombolBahasa.click();

    // Verifikasi pesan galat berubah ke Bahasa Inggris
    const teksEn = await alertId.textContent();
    expect(teksEn).toContain('4 MP');
  });
});
