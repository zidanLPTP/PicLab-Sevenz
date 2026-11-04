import { expect, test } from '@playwright/test';
import { operasiFixtureInversi } from '../frontend/src/mesin/fixtureOperasiInversi';

test.describe('Verifikasi Ekstensibilitas Registri & Web Worker (V6)', () => {
  test('Operasi kustom terdaftar dinamis, muncul di UI, dan dieksekusi di Web Worker', async ({
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

    // 2. Verifikasi jumlah operasi awal adalah 17
    const badgeJumlahOperasi = page.locator('aside span.rounded-full');
    await expect(badgeJumlahOperasi).toHaveText('17');

    // 3. Daftarkan operasi kustom satu-berkas secara dinamis ke browser
    await page.evaluate((definisiFixture) => {
      if (window.__daftarkanOperasiBaru) {
        let str = definisiFixture.sumberFungsi.trim();
        if (
          !str.startsWith('function') &&
          !str.startsWith('(') &&
          !str.includes('=>')
        ) {
          str = 'function ' + str;
        }
        window.__daftarkanOperasiBaru({
          ...definisiFixture,
          // Rekonstruksi fungsi murni
          terapkan: new Function('return (' + str + ')')(),
        });
      }
    }, {
      id: operasiFixtureInversi.id,
      kategori: operasiFixtureInversi.kategori,
      kunciNama: operasiFixtureInversi.kunciNama,
      kunciDeskripsi: operasiFixtureInversi.kunciDeskripsi,
      namaTeknis: operasiFixtureInversi.namaTeknis,
      skemaParameter: operasiFixtureInversi.skemaParameter,
      sumberFungsi: operasiFixtureInversi.terapkan.toString(),
    });

    // 4. Verifikasi badge jumlah operasi bertambah menjadi 18
    await expect(badgeJumlahOperasi).toHaveText('18');

    // 5. Verifikasi tombol operasi kustom muncul di panel operasi
    const tombolOperasiKustom = page.getByRole('button', {
      name: /^Inversi Kustom/,
    });
    await expect(tombolOperasiKustom).toBeVisible();

    // 6. Klik operasi kustom
    await tombolOperasiKustom.click();

    // 7. Verifikasi panel parameter merender skema parameter kustom
    await expect(page.getByText('Custom Intensity Color Inversion')).toBeVisible();
    await expect(page.getByText('Intensitas Efek')).toBeVisible();

    // Inisialisasi catatan profil untuk pelacakan eksekusi
    await page.evaluate(() => {
      window.__catatanProfil = window.__catatanProfil || [];
    });

    // 8. Geser slider parameter intensitas
    const inputAngka = page.locator('input[type="number"]');
    await expect(inputAngka).toBeVisible();
    await inputAngka.fill('50');

    // Tunggu sejenak hingga worker menyelesaikan komputasi
    await page.waitForTimeout(300);

    // 9. Verifikasi eksekusi benar-benar berjalan di Web Worker (bukan fallback)
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
