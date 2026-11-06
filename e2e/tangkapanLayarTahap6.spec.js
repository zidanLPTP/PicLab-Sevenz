import { expect, test } from '@playwright/test';
import { spawn } from 'child_process';
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

test.describe('PicLab Sevenz — Tangkapan Layar Visual QA Tahap 6', () => {
  test.beforeAll(async () => {
    await mulaiBackend();
  });

  test.afterAll(() => {
    matikanBackend();
  });

  test('Mengambil tangkapan layar antarmuka operasi server Tahap 6 (1280px dan 1920px, ID & EN)', async ({
    page,
  }) => {
    // 1. Tangkapan Layar 1280px Bahasa Indonesia
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Pastikan server backend terhubung
    const indikator = page.getByTestId('indikator-status-server');
    await expect(indikator).toBeVisible();
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tersedia', {
      timeout: 15000,
    });

    // Muat citra contoh
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible();

    // Tambahkan operasi server Canny
    const tombolCanny = page.getByTestId('tombol-tambah-operasi-tepi_canny');
    await expect(tombolCanny).toBeVisible();
    await tombolCanny.click();

    // Pastikan item pipeline muncul
    const itemPipeline = page.locator('[role="listitem"]');
    await expect(itemPipeline.first()).toBeVisible({ timeout: 10000 });
    await expect(itemPipeline.first()).toContainText('Canny');

    // Tunggu proses operasi server selesai dan hasil kanvas terbarui
    await page.waitForTimeout(2000);

    // Tangkap layar 1280px ID
    await page.screenshot({
      path: 'tangkapan-layar/tahap6-1280px-operasi-server-id.png',
      fullPage: true,
    });

    // 2. Tangkapan Layar 1280px Bahasa Inggris
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: 'tangkapan-layar/tahap6-1280px-operasi-server-en.png',
      fullPage: true,
    });

    // Kembalikan ke ID
    await page.getByRole('button', { name: 'ID', exact: true }).click();
    await page.waitForTimeout(400);

    // 3. Tambahkan operasi hibrida (Klien -> Server -> Klien)
    const tombolNegatif = page.getByRole('button', { name: /Negatif Citra/ });
    await expect(tombolNegatif).toBeVisible();
    await tombolNegatif.click();
    await page.waitForTimeout(1500);

    // 4. Tangkapan Layar 1920px Bahasa Indonesia
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: 'tangkapan-layar/tahap6-1920px-hibrida-katalog-id.png',
      fullPage: true,
    });

    // 5. Tangkapan Layar 1920px Bahasa Inggris
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: 'tangkapan-layar/tahap6-1920px-hibrida-katalog-en.png',
      fullPage: true,
    });
  });
});
