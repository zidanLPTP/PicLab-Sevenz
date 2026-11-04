import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';

test.describe('PicLab Sevenz — Pengujian E2E Tahap 3: Pipeline & Riwayat Perubahan', () => {
  test('Alur Lengkap: Tambah Langkah -> Sesuaikan -> Reorder -> Toggle -> Undo/Redo -> Lompat Riwayat -> Preset -> Unduh', async ({
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
    await expect(page.getByRole('slider', { name: /penggeser/i })).toBeVisible();

    // 2. Verifikasi keadaan awal pipeline kosong
    await expect(
      page.getByText('Belum ada efek diterapkan. Pilih operasi dari panel kiri untuk mulai.')
    ).toBeVisible();

    // 3. Tambah 3 operasi ke pipeline: Kecerahan, Negatif Citra, Rotasi 90°
    await page.getByRole('button', { name: /^Kecerahan/ }).click();
    await expect(page.getByText('Belum ada efek diterapkan')).not.toBeVisible();
    await expect(page.getByRole('list', { name: 'Rangkaian Operasi' })).toBeVisible();

    await page.getByRole('button', { name: /^Negatif Citra/ }).click();
    await page.getByRole('button', { name: /^Rotasi 90°/ }).click();

    // Verifikasi ada 3 item dalam daftar rangkaian
    const itemPipeline = page.locator('[role="listitem"]');
    await expect(itemPipeline).toHaveCount(3);
    await expect(itemPipeline.nth(0)).toContainText('Kecerahan');
    await expect(itemPipeline.nth(1)).toContainText('Negatif Citra');
    await expect(itemPipeline.nth(2)).toContainText('Rotasi 90°');

    // 4. Pilih langkah Kecerahan dan ubah nilainya via slider
    await itemPipeline.nth(0).click();
    const sliderKecerahan = page.locator('#param-kecerahan');
    await expect(sliderKecerahan).toBeVisible();
    await sliderKecerahan.fill('35');
    await sliderKecerahan.dispatchEvent('pointerup');

    // 5. Ubah urutan langkah: Pindahkan Rotasi (langkah 3) naik ke langkah 2 via tombol naik
    const tombolNaikRotasi = page.getByRole('button', {
      name: 'Pindahkan langkah ke atas Rotasi 90°',
    });
    await tombolNaikRotasi.click();

    // Verifikasi pengumuman ARIA live terbarui
    const ariaAnnouncement = page.locator('[data-testid="aria-pengumuman-pipeline"]');
    await expect(ariaAnnouncement).toContainText('Rotasi 90° dipindahkan');

    // Verifikasi urutan baru: Kecerahan (1), Rotasi 90° (2), Negatif Citra (3)
    await expect(itemPipeline.nth(1)).toContainText('Rotasi 90°');
    await expect(itemPipeline.nth(2)).toContainText('Negatif Citra');

    // 6. Nonaktifkan langkah Negatif Citra
    const tombolToggleNegatif = itemPipeline.nth(2).getByTestId('tombol-toggle-langkah');
    await tombolToggleNegatif.click();
    await expect(itemPipeline.nth(2)).toContainText('(Nonaktif)');

    // 7. Uji tombol Undo & Redo di Bilah Aksi
    const tombolUndo = page.getByRole('button', { name: 'Urungkan (Undo)' });
    const tombolRedo = page.getByRole('button', { name: 'Ulangi (Redo)' });

    await expect(tombolUndo).toBeEnabled();
    // Klik Undo: Negatif kembali aktif
    await tombolUndo.click();
    await expect(itemPipeline.nth(2)).not.toContainText('(Nonaktif)');

    // Klik Redo: Negatif kembali nonaktif
    await tombolRedo.click();
    await expect(itemPipeline.nth(2)).toContainText('(Nonaktif)');

    // 8. Uji Pintasan Keyboard: Ctrl+Z (Undo) dan Ctrl+Shift+Z (Redo)
    await page.keyboard.press('Control+z');
    await expect(itemPipeline.nth(2)).not.toContainText('(Nonaktif)');

    await page.keyboard.press('Control+Shift+z');
    await expect(itemPipeline.nth(2)).toContainText('(Nonaktif)');

    // 9. Buka Riwayat Perubahan dan Lompat Snapshot
    const tombolRiwayat = page.getByRole('button', { name: /Riwayat Perubahan/i });
    await tombolRiwayat.click();

    // Verifikasi daftar riwayat terbuka dan memiliki snapshot
    const itemRiwayat = page.locator('button:has-text("#1")');
    await expect(itemRiwayat).toBeVisible();

    // Lompat ke kondisi awal (#1)
    await itemRiwayat.click();
    // Pipeline harus kembali kosong
    await expect(
      page.getByText('Belum ada efek diterapkan. Pilih operasi dari panel kiri untuk mulai.')
    ).toBeVisible();

    // Redo kembali ke kondisi terkini via tombol redo beberapa kali atau lompat riwayat
    const tombolSnapshotTerakhir = page.locator('button:has-text("#")').last();
    await tombolSnapshotTerakhir.click();
    await expect(itemPipeline).toHaveCount(3);

    // 10. Muat Preset Awal: 'Hitam Putih'
    await page.getByTestId('tombol-preset-hitam_putih').click();
    // Verifikasi langkah preset masuk ke pipeline (Grayscale & Kontras)
    await expect(itemPipeline).toHaveCount(2);
    await expect(itemPipeline.nth(0)).toContainText('Derajat Keabuan');
    await expect(itemPipeline.nth(1)).toContainText('Kontras');

    // F2 d. Verifikasi Undo setelah memuat preset mengembalikan pipeline sebelumnya persis
    await tombolUndo.click();
    await expect(itemPipeline).toHaveCount(3);
    await expect(itemPipeline.nth(0)).toContainText('Kecerahan');
    await expect(itemPipeline.nth(1)).toContainText('Rotasi 90°');
    await expect(itemPipeline.nth(2)).toContainText('Negatif Citra');
    await expect(itemPipeline.nth(2)).toContainText('(Nonaktif)');

    // Redo kembali ke preset Hitam Putih
    await tombolRedo.click();
    await expect(itemPipeline).toHaveCount(2);
    await expect(itemPipeline.nth(0)).toContainText('Derajat Keabuan');
    await expect(itemPipeline.nth(1)).toContainText('Kontras');

    // 11. Unduh citra resolusi penuh dan verifikasi data piksel nyata (bukan kanvas kosong)
    const unduhanPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const unduhan = await unduhanPromise;
    const pathFile = await unduhan.path();
    const bufferUnduh = await fs.promises.readFile(pathFile);

    // Dekode PNG aktual di peramban
    const hasilDekode = await page.evaluate(async (base64) => {
      const blob = await fetch(`data:image/png;base64,${base64}`).then((r) =>
        r.blob()
      );
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const p = ctx.getImageData(
        Math.floor(bmp.width / 2),
        Math.floor(bmp.height / 2),
        1,
        1
      ).data;

      return {
        width: bmp.width,
        height: bmp.height,
        r: p[0],
        g: p[1],
        b: p[2],
        a: p[3],
      };
    }, bufferUnduh.toString('base64'));

    expect(hasilDekode.width).toBeGreaterThan(0);
    expect(hasilDekode.height).toBeGreaterThan(0);
    expect(hasilDekode.a).toBe(255);
    // Preset hitam putih menghasilkan R === G === B
    expect(hasilDekode.r).toBe(hasilDekode.g);
    expect(hasilDekode.g).toBe(hasilDekode.b);

    // 12. Pastikan tidak ada galat konsol peramban
    expect(errorKonsol).toHaveLength(0);
  });

  test('F2 c. E2E Unduhan Resolusi Penuh: Pipeline 2 Langkah Tonal + Rotasi & Nilai Piksel Eksak', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Unggah citra uji dengan nilai piksel diketahui
    // Citra uji-100x100.png: dimensi 100x100, piksel pada (50, 50) = [100, 150, 200, 255]
    const pathUji = path.resolve('frontend/public/contoh/uji-100x100.png');
    await page.locator('#input-citra-unggah').setInputFiles(pathUji);
    await expect(page.getByRole('slider', { name: /penggeser/i })).toBeVisible();

    // 2. Tambah Langkah 1: Kecerahan (+20)
    await page
      .getByTestId('tombol-tambah-operasi-dasar_kecerahan')
      .click();
    const sliderKecerahan = page.locator('#param-kecerahan');
    await sliderKecerahan.fill('20');
    await sliderKecerahan.dispatchEvent('pointerup');

    // Nilai harapan setelah langkah 1 pada piksel (50, 50):
    // R: 100 + 20 = 120
    // G: 150 + 20 = 170
    // B: 200 + 20 = 220

    // 3. Tambah Langkah 2: Negatif Citra
    await page
      .getByTestId('tombol-tambah-operasi-dasar_negatif')
      .click();

    // Nilai harapan setelah langkah 2 pada piksel (50, 50):
    // R: 255 - 120 = 135
    // G: 255 - 170 = 85
    // B: 255 - 220 = 35

    // 4. Tambah Langkah 3: Rotasi 90°
    await page
      .getByTestId('tombol-tambah-operasi-dasar_rotasi')
      .click();

    // 5. Unduh hasil berkas resolusi penuh
    const unduhanPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const unduhan = await unduhanPromise;
    const pathUnduh = await unduhan.path();
    const bufferUnduh = await fs.promises.readFile(pathUnduh);

    // 6. Dekode berkas PNG unduhan di peramban dan periksa piksel terhitung
    const hasilDekode = await page.evaluate(async (base64) => {
      const blob = await fetch(`data:image/png;base64,${base64}`).then((r) =>
        r.blob()
      );
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);

      // Pada citra 100x100 terputar 90°, piksel (50, 50) berpindah ke (49, 50)
      const p = ctx.getImageData(49, 50, 1, 1).data;
      return {
        width: bmp.width,
        height: bmp.height,
        r: p[0],
        g: p[1],
        b: p[2],
        a: p[3],
      };
    }, bufferUnduh.toString('base64'));

    // Verifikasi dimensi terputar
    expect(hasilDekode.width).toBe(100);
    expect(hasilDekode.height).toBe(100);

    // Verifikasi nilai piksel hasil unduhan eksak sesuai hitungan matematis
    expect(hasilDekode.r).toBe(135);
    expect(hasilDekode.g).toBe(85);
    expect(hasilDekode.b).toBe(35);
    expect(hasilDekode.a).toBe(255);
  });

  test('F4. E2E Coalescing Keyboard: Penekanan Panah Slider Cepat & Pengetikan Angka', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Muat gambar contoh
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByRole('slider', { name: /penggeser/i })).toBeVisible();

    // 2. Tambah operasi Kecerahan ke pipeline
    await page
      .getByTestId('tombol-tambah-operasi-dasar_kecerahan')
      .click();

    // Buka panel riwayat untuk mengamati jumlah entri
    await page.getByRole('button', { name: /Riwayat Perubahan/i }).click();
    const itemRiwayat = page.locator('button:has-text("#")');
    const jumlahAwal = await itemRiwayat.count(); // 2 (#1 Kondisi Awal, #2 Tambah Kecerahan)

    // 3. Uji (ii) Tombol Panah Cepat: Fokus slider dan tekan panah kanan 5 kali beruntun
    const slider = page.locator('#param-kecerahan');
    await slider.focus();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
    }

    // Tunggu jeda debounce berakhir (> JEDA_COALESCING_MS 200 ms)
    await page.waitForTimeout(300);

    // Verifikasi entri riwayat bertambah TEPAT 1 (bukan 5 entri!)
    const jumlahSetelahPanah = await itemRiwayat.count();
    expect(jumlahSetelahPanah).toBe(jumlahAwal + 1);

    // Uji Undo: Tepat 1 kali undo mengembalikan nilai slider ke semula (0)
    await page.keyboard.press('Control+z');
    await expect(slider).toHaveValue('0');

    // 4. Uji (iii) Pengetikan Angka: Ketik angka dan tekan Enter
    const inputAngka = page.locator('input[type="number"]').first();
    await inputAngka.focus();
    await inputAngka.fill('45');
    await page.keyboard.press('Enter');

    // Verifikasi entri riwayat bertambah TEPAT 1
    const jumlahSetelahKetik = await itemRiwayat.count();
    expect(jumlahSetelahKetik).toBe(jumlahAwal + 1);

    // Lepas fokus masukan teks agar pintasan global Ctrl+Z aktif
    await inputAngka.blur();

    // Uji Undo: Tepat 1 kali undo mengembalikan nilai ke semula (0)
    await page.keyboard.press('Control+z');
    await expect(slider).toHaveValue('0');
  });
});
