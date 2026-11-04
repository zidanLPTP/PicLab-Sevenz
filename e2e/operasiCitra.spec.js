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

    // 3. Ubah slider / input angka kecerahan
    const inputAngka = page.locator('input[type="number"]').first();
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

    const kotakCari = page.getByPlaceholder(/Cari nama operasi/i);
    await expect(kotakCari).toBeVisible();

    // Ketik "sepia"
    await kotakCari.fill('sepia');

    // Pastikan operasi Efek Sepia tetap tampil
    await expect(page.getByRole('button', { name: /^Efek Sepia/ })).toBeVisible();

    // Pastikan operasi lain (seperti Kecerahan) tidak tampil
    await expect(
      page.getByRole('button', { name: /^Kecerahan/ })
    ).not.toBeVisible();

    // Kosongkan kotak pencarian
    await kotakCari.fill('');
    await expect(page.getByRole('button', { name: /^Kecerahan/ })).toBeVisible();
  });

  test('Tangkapan Layar Visual QA Tahap 2 (1280px & 1920px, ID & EN)', async ({
    page,
  }) => {
    // 1280px Bahasa Indonesia
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await page.getByRole('button', { name: /^Kecerahan/ }).click();
    await page.screenshot({
      path: 'tangkapan-layar/tahap2-1280px-id.png',
      fullPage: true,
    });

    // 1920px Bahasa Indonesia
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: 'tangkapan-layar/tahap2-1920px-id.png',
      fullPage: true,
    });

    // 1280px Bahasa Inggris
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.screenshot({
      path: 'tangkapan-layar/tahap2-1280px-en.png',
      fullPage: true,
    });

    // 1920px Bahasa Inggris
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: 'tangkapan-layar/tahap2-1920px-en.png',
      fullPage: true,
    });
  });
});
