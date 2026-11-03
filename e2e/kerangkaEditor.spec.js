import { expect, test } from '@playwright/test';

test.describe('PicLab Sevenz — Pengujian E2E Tahap 1', () => {
  test('Alur pergantian bahasa antarmuka (ID <-> EN)', async ({ page }) => {
    const errorKonsol = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errorKonsol.push(msg.text());
    });
    page.on('pageerror', (err) => errorKonsol.push(err.message));

    await page.goto('/');

    // Verifikasi teks bawaan bahasa Indonesia
    await expect(
      page.getByText('Unggah Gambar untuk Mulai Mengolah')
    ).toBeVisible();
    await expect(page.getByText('Katalog Operasi Citra')).toBeVisible();

    // Beralih ke Bahasa Inggris
    await page.getByRole('button', { name: 'EN' }).click();

    // Verifikasi teks berubah menjadi Bahasa Inggris
    await expect(
      page.getByText('Upload an Image to Start Processing')
    ).toBeVisible();
    await expect(page.getByText('Operation Catalog')).toBeVisible();

    // Uji buka dialog Privasi dalam Bahasa Inggris
    await page.getByRole('button', { name: 'Privacy' }).click();
    await expect(
      page.getByText('User Data Privacy & Security')
    ).toBeVisible();
    await page.getByRole('button', { name: 'Understood and Close' }).click();
    await expect(
      page.getByText('User Data Privacy & Security')
    ).not.toBeVisible();

    // Kembali ke Bahasa Indonesia
    await page.getByRole('button', { name: 'ID' }).click();
    await expect(
      page.getByText('Unggah Gambar untuk Mulai Mengolah')
    ).toBeVisible();

    // Pastikan tidak ada galat konsol JavaScript
    expect(errorKonsol).toHaveLength(0);
  });

  test('Alur galat berkas dan pemulihan', async ({ page }) => {
    await page.goto('/');

    // Siapkan berkas teks yang tidak didukung
    const bufferTeks = Buffer.from('Ini bukan citra raster yang valid');
    const inputUnggah = page.locator('#input-citra-unggah');

    await inputUnggah.setInputFiles({
      name: 'dokumen.txt',
      mimeType: 'text/plain',
      buffer: bufferTeks,
    });

    // Verifikasi pesan galat muncul
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(
      page.getByText(
        'Format berkas tidak didukung. Harap gunakan berkas JPG, PNG, WebP, atau BMP.'
      )
    ).toBeVisible();

    // Klik tombol coba lagi
    await page.getByText('Coba Unggah Berkas Lain').click();
    await expect(page.getByRole('alert')).not.toBeVisible();
  });

  test('Alur utama: unggah citra -> interaksi kanvas slider -> unduh', async ({
    page,
  }) => {
    const errorKonsol = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errorKonsol.push(msg.text());
    });
    page.on('pageerror', (err) => errorKonsol.push(err.message));

    await page.goto('/');

    // Klik tombol Gunakan Gambar Contoh
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();

    // Tunggu kanvas dan bilah aksi muncul
    await expect(page.getByRole('slider')).toBeVisible();
    await expect(page.getByText('lanskap-contoh.png')).toBeVisible();

    // Verifikasi tombol zoom kanvas
    await expect(
      page.getByRole('button', { name: 'Perbesar tampilan' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Perkecil tampilan' })
    ).toBeVisible();

    // Interaksi slider sebelum/sesudah dengan keyboard
    const slider = page.getByRole('slider');
    await slider.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveAttribute('aria-valuenow', '48');
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuenow', '50');

    // Uji unduh berkas
    const eventUnduhPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const unduhan = await eventUnduhPromise;

    expect(unduhan.suggestedFilename()).toBe('lanskap-contoh-piclab.png');

    // Uji tombol Ganti Gambar
    await page.getByRole('button', { name: 'Ganti Gambar' }).click();
    await expect(
      page.getByText('Unggah Gambar untuk Mulai Mengolah')
    ).toBeVisible();

    // Pastikan tidak ada galat konsol selama alur berjalan
    expect(errorKonsol).toHaveLength(0);
  });

  test('Tangkapan Layar Visual QA (1280px dan 1920px)', async ({ page }) => {
    // 1. Resolusi Desktop 1280px
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.screenshot({
      path: 'tangkapan-layar/editor-1280px-kosong.png',
      fullPage: true,
    });

    // Muat gambar contoh dan ambil tangkapan layar
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByRole('slider')).toBeVisible();
    await page.screenshot({
      path: 'tangkapan-layar/editor-1280px-citra.png',
      fullPage: true,
    });

    // 2. Resolusi Desktop Lebar 1920px
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: 'tangkapan-layar/editor-1920px-citra.png',
      fullPage: true,
    });

    // Reset ke kosong untuk tangkapan layar 1920px kosong
    await page.getByRole('button', { name: 'Ganti Gambar' }).click();
    await expect(
      page.getByText('Unggah Gambar untuk Mulai Mengolah')
    ).toBeVisible();
    await page.screenshot({
      path: 'tangkapan-layar/editor-1920px-kosong.png',
      fullPage: true,
    });
  });
});
