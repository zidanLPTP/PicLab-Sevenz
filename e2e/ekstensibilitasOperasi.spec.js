import { expect, test } from '@playwright/test';

test.describe('Verifikasi Ekstensibilitas Registri Statis & Web Worker (Tanpa Eval)', () => {
  test('Operasi fixture uji terdaftar statis di folder uji, muncul di UI, dan dieksekusi di Web Worker', async ({
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

    // 2. Verifikasi jumlah operasi adalah 18 (17 bawaan + 1 fixture uji statis)
    const badgeJumlahOperasi = page
      .locator('aside')
      .first()
      .locator('span.rounded-full');
    await expect(badgeJumlahOperasi).toHaveText('31');

    // 3. Verifikasi tombol operasi fixture muncul di panel operasi tanpa eval
    const tombolOperasiKustom = page.getByRole('button', {
      name: /^Inversi Kustom/,
    });
    await expect(tombolOperasiKustom).toBeVisible();

    // 4. Klik operasi kustom
    await tombolOperasiKustom.click();

    // 5. Verifikasi panel parameter merender skema parameter kustom
    await expect(
      page.getByText('Custom Intensity Color Inversion')
    ).toBeVisible();
    await expect(page.getByText('Intensitas Efek')).toBeVisible();

    // Inisialisasi catatan profil untuk pelacakan eksekusi
    await page.evaluate(() => {
      window.__catatanProfil = window.__catatanProfil || [];
    });

    // 6. Geser slider parameter intensitas
    const inputAngka = page.locator('input[type="number"]').first();
    await expect(inputAngka).toBeVisible();
    await inputAngka.fill('50');

    // Tunggu sejenak hingga worker menyelesaikan komputasi
    await page.waitForTimeout(300);

    // 7. Verifikasi eksekusi benar-benar berjalan di Web Worker (bukan fallback)
    const catatanWorker = await page.evaluate(() => {
      const log = window.__catatanProfil || [];
      return log.filter((entry) => entry.idOperasi === 'dasar_inversi_kustom');
    });

    expect(catatanWorker.length).toBeGreaterThan(0);
    const entriTerakhir = catatanWorker[catatanWorker.length - 1];
    expect(entriTerakhir.faseKomputasiWorker).toBeGreaterThan(0);

    // Pastikan tidak ada galat konsol browser
    expect(errorKonsol).toHaveLength(0);
  });
});
