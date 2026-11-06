import { expect, test } from '@playwright/test';
import { spawn } from 'child_process';
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
  if (prosesBackend && prosesBackend.pid) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(prosesBackend.pid), '/f', '/t']);
      } else {
        process.kill(-prosesBackend.pid);
      }
    } catch {
      // Abaikan jika proses sudah mati
    }
    prosesBackend = null;
  }
}

test.describe('PicLab Sevenz — E2E Operasi Server Tahap 6 (Backend Nyata)', () => {
  test.beforeAll(async () => {
    await mulaiBackend();
  });

  test.afterAll(() => {
    matikanBackend();
  });

  test('Alur lengkap: 6 operasi server nyata diuji berturut-turut pada pipeline', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Verifikasi Status Server Terhubung
    const indikator = page.getByTestId('indikator-status-server');
    await expect(indikator).toBeVisible();
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tersedia', {
      timeout: 15000,
    });

    // 2. Unggah Citra Uji Deterministik 4x2
    const jalurCitraUji = path.resolve('test-assets/tangga-4x2.png');
    expect(fs.existsSync(jalurCitraUji)).toBe(true);
    const inputUnggah = page.locator('input[type="file"]');
    await inputUnggah.setInputFiles(jalurCitraUji);

    // Pastikan kanvas sesudah muncul
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible({ timeout: 15000 });

    // 3. Uji Operasi 1: Deteksi Tepi Canny (/api/v1/tepi/canny)
    const tombolCanny = page.getByTestId('tombol-tambah-operasi-tepi_canny');
    await expect(tombolCanny).toBeVisible();
    await expect(tombolCanny).toBeEnabled();

    const tungguCanny = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/tepi/canny') &&
        res.status() === 200 &&
        res.request().method() === 'POST'
    );
    await tombolCanny.click();
    const respCanny = await tungguCanny;
    expect(respCanny.status()).toBe(200);

    // 4. Uji Operasi 2: Deteksi Kontur (/api/v1/kontur)
    const tombolKontur = page.getByTestId('tombol-tambah-operasi-kontur_deteksi');
    await expect(tombolKontur).toBeVisible();

    const tungguKontur = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/kontur') &&
        res.status() === 200 &&
        res.request().method() === 'POST'
    );
    await tombolKontur.click();
    const respKontur = await tungguKontur;
    expect(respKontur.status()).toBe(200);

    // 5. Uji Operasi 3: Morfologi (/api/v1/morfologi)
    const tombolMorfologi = page.getByTestId('tombol-tambah-operasi-morfologi_matematika');
    await expect(tombolMorfologi).toBeVisible();

    const tungguMorfologi = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/morfologi') &&
        res.status() === 200 &&
        res.request().method() === 'POST'
    );
    await tombolMorfologi.click();
    const respMorfologi = await tungguMorfologi;
    expect(respMorfologi.status()).toBe(200);

    // 6. Uji Operasi 4: Segmentasi K-Means (/api/v1/segmentasi)
    const tombolSegmentasi = page.getByTestId('tombol-tambah-operasi-segmentasi_citra');
    await expect(tombolSegmentasi).toBeVisible();

    const tungguSegmentasi = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/segmentasi') &&
        res.status() === 200 &&
        res.request().method() === 'POST'
    );
    await tombolSegmentasi.click();
    const respSegmentasi = await tungguSegmentasi;
    expect(respSegmentasi.status()).toBe(200);

    // 7. Uji Operasi 5: Reduksi Noise Bilateral (/api/v1/noise/reduksi)
    const tombolNoise = page.getByTestId('tombol-tambah-operasi-noise_reduksi');
    await expect(tombolNoise).toBeVisible();

    const tungguNoise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/noise/reduksi') &&
        res.status() === 200 &&
        res.request().method() === 'POST'
    );
    await tombolNoise.click();
    const respNoise = await tungguNoise;
    expect(respNoise.status()).toBe(200);

    // 8. Uji Operasi 6: Pemfilteran Frekuensi FFT (/api/v1/frekuensi)
    const tombolFrekuensi = page.getByTestId('tombol-tambah-operasi-frekuensi_fft');
    await expect(tombolFrekuensi).toBeVisible();

    const tungguFrekuensi = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/frekuensi') &&
        res.status() === 200 &&
        res.request().method() === 'POST'
    );
    await tombolFrekuensi.click();
    const respFrekuensi = await tungguFrekuensi;
    expect(respFrekuensi.status()).toBe(200);

    // 9. Unduh Hasil Resolusi Penuh dengan Operasi Server di Pipeline
    const promiseUnduh = page.waitForEvent('download');
    const tombolUnduh = page.getByRole('button', {
      name: /Unduh Hasil|Download Result/,
    });
    await tombolUnduh.click();
    const unduhan = await promiseUnduh;
    const namaBerkas = unduhan.suggestedFilename();
    expect(namaBerkas).toContain('piclab');
    expect(namaBerkas.endsWith('.png')).toBe(true);
  });

  test('Urutan hibrida (Klien -> Server -> Klien) dengan prefix caching & undo/redo', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const indikator = page.getByTestId('indikator-status-server');
    await expect(indikator).toBeVisible();
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tersedia', {
      timeout: 15000,
    });

    const jalurCitraUji = path.resolve('test-assets/tangga-4x2.png');
    await page.locator('input[type="file"]').setInputFiles(jalurCitraUji);
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible({ timeout: 15000 });

    // Tambah Langkah 1: Klien (Kecerahan)
    await page.getByTestId('tombol-tambah-operasi-dasar_kecerahan').click();

    // Tambah Langkah 2: Server (Canny)
    const tungguCanny = page.waitForResponse(
      (res) => res.url().includes('/api/v1/tepi/canny') && res.status() === 200
    );
    await page.getByTestId('tombol-tambah-operasi-tepi_canny').click();
    await tungguCanny;

    // Tambah Langkah 3: Klien (Negatif)
    await page.getByTestId('tombol-tambah-operasi-dasar_negatif').click();

    const itemLangkah = page.locator('[role="listitem"]');
    await expect(itemLangkah).toHaveCount(3);

    // Uji Undo: kembali ke 2 langkah
    const tombolUndo = page.getByRole('button', { name: /Urungkan \(Undo\)|Undo/ });
    await expect(tombolUndo).toBeEnabled();
    await tombolUndo.click();
    await expect(itemLangkah).toHaveCount(2);

    // Uji Redo: maju kembali ke 3 langkah
    const tombolRedo = page.getByRole('button', { name: /Ulangi \(Redo\)|Redo/ });
    await expect(tombolRedo).toBeEnabled();
    await tombolRedo.click();
    await expect(itemLangkah).toHaveCount(3);
  });
});
