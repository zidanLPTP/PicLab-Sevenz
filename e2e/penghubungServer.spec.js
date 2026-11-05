import { expect, test } from '@playwright/test';

test.describe('Tahap 5: Penghubung Klien-Backend & Graceful Degradation', () => {
  test('Skenario A (Server MATI): Aplikasi tetap 100% berfungsi untuk klien, indikator bilah atas Server Mati', async ({
    page,
  }) => {
    const galatKonsol = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        galatKonsol.push(msg.text());
      }
    });

    // Simulasikan server backend mati (koneksi ditolak)
    await page.route(/\/kesehatan/, (route) => route.abort('failed'));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Verifikasi Indikator Status di Bilah Atas
    const indikator = page.getByTestId('indikator-status-server');
    await expect(indikator).toBeVisible();
    await expect(indikator).toHaveAttribute('data-status', 'tidak_tersedia');
    await expect(indikator).toContainText(/Server Mati|Server Offline/);

    // 2. Klik tombol periksa manual saat server mati: tetap bertransisi dengan aman
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tidak_tersedia');

    // 3. Verifikasi Dialog Privasi Poin 4
    const tombolPrivasi = page.getByRole('button', { name: /Privasi|Privacy/ });
    await tombolPrivasi.click();
    const modalPrivasi = page.getByRole('dialog');
    await expect(modalPrivasi).toBeVisible();
    await expect(modalPrivasi).toContainText(
      /Log server hanya mencatat metode|Server logs record only/
    );
    const tombolTutup = page.getByRole('button', {
      name: /Mengerti dan Tutup|Understood and Close/,
    });
    await tombolTutup.click();
    await expect(modalPrivasi).not.toBeVisible();

    // 4. Verifikasi Operasi Klien 100% Berfungsi Normal
    const tombolContoh = page.getByRole('button', {
      name: /Gunakan Gambar Contoh|Use Sample Image/,
    });
    await expect(tombolContoh).toBeVisible();
    await tombolContoh.click();

    // Pastikan kanvas sesudah muncul
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible();

    // Terapkan operasi klien: dasar_kecerahan dan warna_sepia
    await page.getByTestId('tombol-tambah-operasi-dasar_kecerahan').click();
    await page.getByTestId('tombol-tambah-operasi-warna_sepia').click();

    // Pastikan langkah pipeline bertambah menjadi 2
    const itemLangkah = page.locator('[role="listitem"]');
    await expect(itemLangkah).toHaveCount(2);

    // Uji Unduh Citra pada kondisi server mati
    const unduhanPromise = page.waitForEvent('download');
    const tombolUnduh = page.getByRole('button', {
      name: /Unduh Hasil|Download Result/,
    });
    await expect(tombolUnduh).toBeVisible();
    await tombolUnduh.click();
    const unduhan = await unduhanPromise;
    expect(unduhan.suggestedFilename()).toMatch(/\.png$/);

    // Tidak boleh ada galat unhandled crash
    const galatFatal = galatKonsol.filter(
      (g) =>
        !g.includes('ERR_CONNECTION_REFUSED') &&
        !g.includes('Failed to fetch') &&
        !g.includes('net::ERR_FAILED') &&
        !g.includes('Failed to load resource')
    );
    expect(galatFatal).toHaveLength(0);
  });

  test('Skenario B (Server HIDUP): Indikator menampilkan Server Aktif saat periksa manual dipicu', async ({
    page,
  }) => {
    // Simulasikan server backend hidup dan merespons 200 OK dengan header CORS lengkap
    await page.route(/\/kesehatan/, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
        body: JSON.stringify({
          status: 'sehat',
          layanan: 'piclab-backend',
          versi: '0.1.0',
        }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const indikator = page.getByTestId('indikator-status-server');
    await expect(indikator).toBeVisible();

    // Tunggu respons kesehatan saat klik periksa manual
    const tungguKesehatan = page.waitForResponse((r) =>
      r.url().includes('/kesehatan')
    );
    await indikator.click();
    await tungguKesehatan;

    // Indikator harus bertransisi ke status tersedia
    await expect(indikator).toHaveAttribute('data-status', 'tersedia');
    await expect(indikator).toContainText(/Server Aktif|Server Online/);
  });

  test('Skenario C (Degradasi Dinamis): Server mati di tengah sesi, UI tidak crash', async ({
    page,
  }) => {
    let serverAktif = true;

    await page.route(/\/kesehatan/, (route) => {
      if (serverAktif) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          },
          body: JSON.stringify({ status: 'sehat' }),
        });
      }
      return route.abort('connectionrefused');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const indikator = page.getByTestId('indikator-status-server');

    // Mula-mula periksa saat server hidup
    const tungguKesehatan1 = page.waitForResponse((r) =>
      r.url().includes('/kesehatan')
    );
    await indikator.click();
    await tungguKesehatan1;
    await expect(indikator).toHaveAttribute('data-status', 'tersedia');

    // Server tiba-tiba mati di tengah jalan
    serverAktif = false;

    // Pengguna memicu periksa ulang manual saat server mati
    await indikator.click();

    // Indikator beralih ke tidak_tersedia tanpa merusak UI
    await expect(indikator).toHaveAttribute('data-status', 'tidak_tersedia');
    await expect(indikator).toContainText(/Server Mati|Server Offline/);

    // Muat citra dan pastikan editor tetap berjalan normal
    await page
      .getByRole('button', { name: /Gunakan Gambar Contoh|Use Sample Image/ })
      .click();
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible();
  });
});
