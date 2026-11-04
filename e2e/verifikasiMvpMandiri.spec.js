import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';

test.describe('H7: Pembuktian MVP Mandiri Client-Side Tanpa Backend', () => {
  test('Alur kerja lengkap MVP mandiri: Unggah -> Semua Kategori Operasi -> Pipeline Undo/Redo -> Unduh Citra Valid', async ({
    page,
  }) => {
    const permintaanJaringan = [];
    const galatKonsol = [];

    // 1. Pantau seluruh lalu lintas jaringan
    page.on('request', (req) => {
      permintaanJaringan.push({
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
      });
    });

    // 2. Pantau pesan konsol peramban
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        galatKonsol.push({
          teks: msg.text(),
          lokasi: msg.location(),
        });
      }
    });

    // 3. Muat aplikasi
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 4. Muat gambar contoh (aliran data citra murni di memori klien)
    const tombolContoh = page.getByRole('button', {
      name: 'Gunakan Gambar Contoh',
    });
    await expect(tombolContoh).toBeVisible();
    await tombolContoh.click();

    // Pastikan kanvas preview dan kontrol editor siap
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible();

    // 5. Terapkan operasi dari tiap kategori (6 kategori lengkap spec.md bagian 4)
    // (a) Kategori Dasar: dasar_kecerahan
    await page.getByTestId('tombol-tambah-operasi-dasar_kecerahan').click();
    // (b) Kategori Warna: warna_sepia
    await page.getByTestId('tombol-tambah-operasi-warna_sepia').click();
    // (c) Kategori Enhancement: enhancement_ekualisasi
    await page.getByTestId('tombol-tambah-operasi-enhancement_ekualisasi').click();
    // (d) Kategori Biner: biner_otsu
    await page.getByTestId('tombol-tambah-operasi-biner_otsu').click();
    // (e) Kategori Spasial: halus_gaussian
    await page.getByTestId('tombol-tambah-operasi-halus_gaussian').click();
    // (f) Kategori Tepi: tepi_sobel
    await page.getByTestId('tombol-tambah-operasi-tepi_sobel').click();

    // 6. Uji Undo dan Redo
    const tombolUndo = page.getByRole('button', { name: 'Urungkan (Undo)' });
    const tombolRedo = page.getByRole('button', { name: 'Ulangi (Redo)' });

    await expect(tombolUndo).toBeEnabled();
    await tombolUndo.click(); // Batalkan penambahan tepi_sobel
    await expect(tombolRedo).toBeEnabled();
    await tombolRedo.click(); // Kembalikan penambahan tepi_sobel

    // 7. Unduh citra hasil resolusi penuh
    const unduhanPromise = page.waitForEvent('download');
    const tombolUnduh = page.getByRole('button', { name: 'Unduh Hasil' });
    await expect(tombolUnduh).toBeVisible();
    await tombolUnduh.click();

    const unduhan = await unduhanPromise;
    const namaBerkas = unduhan.suggestedFilename();
    expect(namaBerkas).toMatch(/^lanskap-contoh-piclab-pipeline-.*\.png$/);

    const jalurSimpan = path.resolve(
      'tangkapan-layar',
      'uji-unduhan-mvp-mandiri.png'
    );
    await unduhan.saveAs(jalurSimpan);

    // Verifikasi fisik berkas unduhan
    const stats = fs.statSync(jalurSimpan);
    expect(stats.size).toBeGreaterThan(1000); // Ukuran wajar citra PNG

    // Periksa signature header PNG (8 byte: 89 50 4E 47 0D 0A 1A 0A)
    const fd = fs.openSync(jalurSimpan, 'r');
    const bufferHeader = Buffer.alloc(8);
    fs.readSync(fd, bufferHeader, 0, 8, 0);
    fs.closeSync(fd);
    const magicHeader = bufferHeader.toString('hex').toUpperCase();
    expect(magicHeader).toBe('89504E470D0A1A0A');

    // 8. Verifikasi Inspeksi Jaringan:
    // Pastikan SEMUA permintaan jaringan hanya berasal dari origin lokal statis, data:, atau blob:
    const originAplikasi = new URL(page.url()).origin;
    const permintaanAsing = permintaanJaringan.filter((req) => {
      if (req.url.startsWith('data:') || req.url.startsWith('blob:'))
        return false;
      return !req.url.startsWith(originAplikasi);
    });

    console.log(
      `Total permintaan jaringan: ${permintaanJaringan.length}, Asing: ${permintaanAsing.length}`
    );
    expect(permintaanAsing).toHaveLength(0);

    // 9. Verifikasi Konsol: Pastikan tidak ada galat konsol
    console.log(`Total galat konsol: ${galatKonsol.length}`);
    expect(galatKonsol).toHaveLength(0);

    // Simpan metadata hasil inspeksi mandiri untuk laporan
    const laporanMvp = {
      berhasil: true,
      totalPermintaanJaringan: permintaanJaringan.length,
      daftarUrlJaringan: [
        ...new Set(
          permintaanJaringan.map((r) =>
            r.url.replace(originAplikasi, '').split('?')[0]
          )
        ),
      ],
      permintaanKeBackend: permintaanAsing.length,
      totalGalatKonsol: galatKonsol.length,
      namaBerkasUnduhan: namaBerkas,
      ukuranUnduhanBytes: stats.size,
      signaturePngValid: true,
    };

    fs.writeFileSync(
      path.resolve('tangkapan-layar', 'laporan-inspeksi-mvp.json'),
      JSON.stringify(laporanMvp, null, 2),
      'utf-8'
    );
  });
});
