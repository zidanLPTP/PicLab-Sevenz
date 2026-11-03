import { expect, test } from '@playwright/test';

test.describe('PicLab Sevenz — Pengujian E2E Tahap 2: Mesin Operasi Klien', () => {
  test('Alur lengkap: Pilih operasi -> ubah slider -> verifikasi histogram -> unduh resolusi penuh', async ({
    page,
  }) => {
    const errorKonsol = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errorKonsol.push(msg.text());
    });
    page.on('pageerror', (err) => errorKonsol.push(err.message));

    await page.goto('/');

    // 1. Muat gambar contoh
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByRole('slider')).toBeVisible();

    // 2. Pilih Operasi Kecerahan di panel kiri (tombol berawalan "Kecerahan")
    await page.getByRole('button', { name: /^Kecerahan/ }).click();

    // Verifikasi panel kanan menampilkan parameter kecerahan
    await expect(page.getByText('Linear Brightness Shift')).toBeVisible();
    await expect(
      page.getByText('Satu operasi aktif pada satu waktu (beroperasi pada citra asli).')
    ).toBeVisible();

    // 3. Ubah slider / input angka kecerahan
    const inputAngka = page.locator('input[type="number"]');
    await expect(inputAngka).toBeVisible();
    await inputAngka.fill('50');

    // 4. Periksa visualisasi histogram
    const tombolHistogram = page.getByRole('button', {
      name: /Histogram Citra/i,
    });
    await expect(tombolHistogram).toBeVisible();

    // Verifikasi SVG histogram dirender
    const svgHistogram = page.locator('svg[role="img"]').first();
    await expect(svgHistogram).toBeVisible();
    await expect(svgHistogram).toHaveAttribute(
      'aria-label',
      /Visualisasi Histogram Citra/i
    );

    // 5. Unduh hasil citra beroperasi pada resolusi penuh
    const eventUnduhPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const unduhan = await eventUnduhPromise;

    // Nama unduhan memuat nama berkas asli, sufiks piclab, dan ID operasi
    expect(unduhan.suggestedFilename()).toBe(
      'lanskap-contoh-piclab-dasar_kecerahan.png'
    );

    // Pastikan tidak ada galat konsol browser
    expect(errorKonsol).toHaveLength(0);
  });

  test('Operasi pengubah geometri (Rotasi 90°): verifikasi dimensi sebelum -> sesudah', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByRole('slider')).toBeVisible();

    // Pilih Rotasi di panel kiri
    await page.getByRole('button', { name: /^Rotasi 90°/ }).click();
    await expect(
      page.getByText('Orthogonal 90-Degree Matrix Rotation')
    ).toBeVisible();

    // Verifikasi indikator dimensi di Bilah Aksi Kanvas menampilkan dimensi sebelum dan sesudah
    // lanskap-contoh.png memiliki dimensi 400x300, setelah rotasi 90 derajat menjadi 300x400
    await expect(page.getByText('400 × 300')).toBeVisible();
    await expect(page.getByText('300 × 400')).toBeVisible();

    // Unduh dan verifikasi nama berkas rotasi
    const eventUnduh = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const berkasUnduh = await eventUnduh;
    expect(berkasUnduh.suggestedFilename()).toBe(
      'lanskap-contoh-piclab-dasar_rotasi.png'
    );
  });

  test('Pencarian katalog operasi: filter cepat berdasarkan kata kunci', async ({
    page,
  }) => {
    await page.goto('/');

    // Cari 'sepia' di kotak pencarian panel operasi
    const inputCari = page.getByPlaceholder('Cari nama operasi...');
    await inputCari.fill('sepia');

    // Hanya tombol Efek Sepia yang tampil
    await expect(page.getByRole('button', { name: /^Efek Sepia/ })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Rotasi 90°/ })
    ).not.toBeVisible();

    // Kosongkan pencarian
    await inputCari.fill('');
    await expect(
      page.getByRole('button', { name: /^Rotasi 90°/ })
    ).toBeVisible();
  });

  test('Tangkapan Layar Visual QA Tahap 2 (1280px & 1920px, ID & EN)', async ({
    page,
  }) => {
    // 1. Resolusi 1280px Bahasa Indonesia (dengan operasi aktif & histogram terbuka)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await page.getByRole('button', { name: /^Kecerahan/ }).click();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: 'tangkapan-layar/editor-1280px-operasi-id.png',
      fullPage: true,
    });

    // 2. Resolusi 1920px Bahasa Indonesia
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: 'tangkapan-layar/editor-1920px-operasi-id.png',
      fullPage: true,
    });

    // 3. Resolusi 1280px Bahasa Inggris
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.waitForTimeout(200);
    await page.screenshot({
      path: 'tangkapan-layar/editor-1280px-operasi-en.png',
      fullPage: true,
    });

    // 4. Resolusi 1920px Bahasa Inggris
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: 'tangkapan-layar/editor-1920px-operasi-en.png',
      fullPage: true,
    });
  });
});
