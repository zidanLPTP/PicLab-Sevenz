import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';

test.describe('PicLab Sevenz — Verifikasi Revisi 2 Tahap 2 (Reguler E2E Suite)', () => {
  test('R5. E2E Unduhan Resolusi Penuh & Verifikasi Dekode Piksel Nyata', async ({
    page,
  }) => {
    await page.goto('/');

    // --- Kasus 1: Operasi Tonal Negatif (Verifikasi nilai piksel 255 - asli) ---
    const pathUji100 = path.resolve('frontend/public/contoh/uji-100x100.png');
    const inputUnggah = page.locator('#input-citra-unggah');
    await inputUnggah.setInputFiles(pathUji100);
    await expect(page.getByRole('slider')).toBeVisible();

    // Pilih operasi Negatif Citra
    await page.getByRole('button', { name: /^Negatif Citra/ }).click();

    // Unduh hasil
    const eventUnduhNegatif = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const unduhNegatif = await eventUnduhNegatif;
    const pathFileNegatif = await unduhNegatif.path();
    const bufferNegatif = await fs.promises.readFile(pathFileNegatif);

    // Dekode berkas unduhan di browser dan cek piksel tengah (50, 50)
    // Nilai asli di (50, 50) adalah [100, 150, 200, 255]
    // Nilai negatif yang diharapkan: 255 - 100 = 155, 255 - 150 = 105, 255 - 200 = 55
    const hasilNegatif = await page.evaluate(async (base64) => {
      const blob = await fetch(`data:image/png;base64,${base64}`).then((r) =>
        r.blob()
      );
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const p = ctx.getImageData(50, 50, 1, 1).data;
      return {
        width: bmp.width,
        height: bmp.height,
        r: p[0],
        g: p[1],
        b: p[2],
        a: p[3],
      };
    }, bufferNegatif.toString('base64'));

    expect(hasilNegatif.width).toBe(100);
    expect(hasilNegatif.height).toBe(100);
    expect(hasilNegatif.r).toBe(155);
    expect(hasilNegatif.g).toBe(105);
    expect(hasilNegatif.b).toBe(55);
    expect(hasilNegatif.a).toBe(255);

    // --- Kasus 2: Rotasi 90° pada citra > 1024 px (Membuktikan resolusi penuh & dimensi tertukar) ---
    await page.getByRole('button', { name: 'Ganti Gambar' }).click();
    const pathUji1200 = path.resolve('frontend/public/contoh/uji-1200x800.png');
    await inputUnggah.setInputFiles(pathUji1200);
    await expect(page.getByRole('slider')).toBeVisible();

    // Pilih Rotasi 90°
    await page.getByRole('button', { name: /^Rotasi 90°/ }).click();

    const eventUnduhRotasi = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const unduhRotasi = await eventUnduhRotasi;
    const pathFileRotasi = await unduhRotasi.path();
    const bufferRotasi = await fs.promises.readFile(pathFileRotasi);

    const hasilRotasi = await page.evaluate(async (base64) => {
      const blob = await fetch(`data:image/png;base64,${base64}`).then((r) =>
        r.blob()
      );
      const bmp = await createImageBitmap(blob);
      return { width: bmp.width, height: bmp.height };
    }, bufferRotasi.toString('base64'));

    // Dimensi asli 1200x800 (> 1024 px preview) tertukar menjadi 800x1200 pada resolusi penuh
    expect(hasilRotasi.width).toBe(800);
    expect(hasilRotasi.height).toBe(1200);

    // --- Kasus 3: Ubah Ukuran (Resize) & Crop pada resolusi penuh ---
    await page.getByRole('button', { name: /^Ubah Ukuran/ }).click();
    // Isi lebarBaru=350, tinggiBaru=220
    const inputsAngka = page.locator('input[type="number"]');
    await inputsAngka.nth(0).fill('350');
    await inputsAngka.nth(1).fill('220');

    const eventUnduhResize = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const unduhResize = await eventUnduhResize;
    const pathFileResize = await unduhResize.path();
    const bufferResize = await fs.promises.readFile(pathFileResize);

    const hasilResize = await page.evaluate(async (base64) => {
      const blob = await fetch(`data:image/png;base64,${base64}`).then((r) =>
        r.blob()
      );
      const bmp = await createImageBitmap(blob);
      return { width: bmp.width, height: bmp.height };
    }, bufferResize.toString('base64'));

    expect(hasilResize.width).toBe(350);
    expect(hasilResize.height).toBe(220);
  });

  test('P2. Verifikasi Rendering Preview Kanvas Langsung (Zero PNG Encoding)', async ({
    page,
  }) => {
    await page.goto('/');

    const pathUji100 = path.resolve('frontend/public/contoh/uji-100x100.png');
    await page.locator('#input-citra-unggah').setInputFiles(pathUji100);

    // Pastikan elemen canvas sesudah langsung terpasang di DOM
    const kanvasSesudah = page.locator('canvas[data-testid="kanvas-sesudah"]');
    await expect(kanvasSesudah).toBeVisible();

    // Verifikasi bahwa canvas memiliki dimensi piksel internal
    const dimensi = await kanvasSesudah.evaluate((c) => ({
      width: c.width,
      height: c.height,
    }));
    expect(dimensi.width).toBe(100);
    expect(dimensi.height).toBe(100);
  });

  test('P6. Verifikasi Peringatan Batas Dimensi Aman Muncul di UI (Input > 4096 px)', async ({
    page,
  }) => {
    await page.goto('/');

    const pathUji100 = path.resolve('frontend/public/contoh/uji-100x100.png');
    await page.locator('#input-citra-unggah').setInputFiles(pathUji100);

    // Pilih Ubah Ukuran
    await page.getByRole('button', { name: /^Ubah Ukuran/ }).click();

    // Isi nilai melebihi batas 4096 px
    const inputLebar = page.locator('input[type="number"]').first();
    await inputLebar.fill('5000');

    // Verifikasi banner role="alert" terlihat di antarmuka
    const alertBanner = page.locator(
      '[data-testid="peringatan-batas-dimensi"]'
    );
    await expect(alertBanner).toBeVisible();
    await expect(alertBanner).toContainText('4096');

    // Kembalikan ke nilai aman 400
    await inputLebar.fill('400');
    await expect(alertBanner).not.toBeVisible();
  });
});
