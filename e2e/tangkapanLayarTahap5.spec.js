import { expect, test } from '@playwright/test';

test.describe('Visual QA Tahap 5 — Tangkapan Layar Status Server & Privasi', () => {
  test('Ambil tangkapan layar Visual QA Tahap 5 (1280px & 1920px, ID & EN)', async ({
    page,
  }) => {
    // Skenario 1: Server Mati (Indikator Merah) - ID & EN
    await page.route(/\/kesehatan/, (route) => route.abort('failed'));

    // 1920px ID - Server Mati
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const indikator = page.getByTestId('indikator-status-server');
    await expect(indikator).toBeVisible();
    await expect(indikator).toHaveAttribute('data-status', 'tidak_tersedia');

    await page.screenshot({
      path: 'tangkapan-layar/tahap5-1920px-server-mati-id.png',
      fullPage: true,
    });

    // Buka Modal Privasi untuk menangkap Poin 4 (ID)
    await page.getByRole('button', { name: /Privasi/ }).click();
    const modalPrivasi = page.getByRole('dialog');
    await expect(modalPrivasi).toBeVisible();
    await page.screenshot({
      path: 'tangkapan-layar/tahap5-1920px-privasi-poin4-id.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: /Mengerti dan Tutup/ }).click();
    await expect(modalPrivasi).not.toBeVisible();

    // Terapkan Operasi Klien saat Server Mati (Membuktikan Graceful Degradation)
    await page.getByRole('button', { name: /Gunakan Gambar Contoh/ }).click();
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible();
    await page.getByTestId('tombol-tambah-operasi-dasar_kecerahan').click();
    await page.getByTestId('tombol-tambah-operasi-warna_sepia').click();

    await page.screenshot({
      path: 'tangkapan-layar/tahap5-1920px-graceful-degradation-citra-id.png',
      fullPage: true,
    });

    // 1280px EN - Ganti Bahasa ke Inggris & Uji Server Aktif (Mock 200)
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

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ganti ke Bahasa Inggris
    await page.getByRole('button', { name: 'EN', exact: true }).click();

    // Picu periksa manual server aktif
    const tungguKesehatan = page.waitForResponse((r) =>
      r.url().includes('/kesehatan')
    );
    await page.getByTestId('indikator-status-server').click();
    await tungguKesehatan;

    await expect(page.getByTestId('indikator-status-server')).toHaveAttribute(
      'data-status',
      'tersedia'
    );

    await page.screenshot({
      path: 'tangkapan-layar/tahap5-1280px-server-aktif-en.png',
      fullPage: true,
    });

    // Buka Modal Privasi Versi EN
    await page.getByRole('button', { name: /Privacy/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({
      path: 'tangkapan-layar/tahap5-1280px-privasi-poin4-en.png',
      fullPage: true,
    });
  });
});
