import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';

test.describe('PicLab Sevenz — Pengujian E2E Tahap 4: Biner, Spasial, Konvolusi, & Deteksi Tepi', () => {
  const fileTangga = path.resolve('test-assets', 'tangga-100x100.png');
  const fileSintetis = path.resolve('test-assets', 'uji-40x30.png');

  test.beforeAll(() => {
    // Pastikan berkas aset uji tersedia
    if (!fs.existsSync(fileTangga) || !fs.existsSync(fileSintetis)) {
      throw new Error(
        'Aset uji tangga-100x100.png atau uji-40x30.png belum dibangkitkan. Jalankan bangkitkanCitraUji.js!'
      );
    }
  });

  // ==========================================================================
  // 1. UJI ALUR OTSU: CITRA TANGGA -> OTSU -> UNDUH -> SEMUA PIKSEL 0 / 255
  // ==========================================================================
  test('1. Alur Citra Biner Otsu: Upload tangga -> terapkan Otsu -> unduh -> periksa piksel hasil hanya 0 atau 255', async ({
    page,
  }) => {
    await page.goto('/');

    // Upload berkas citra tangga
    const inputUnggah = page.locator('input[type="file"]');
    await inputUnggah.setInputFiles(fileTangga);
    await expect(page.getByRole('slider', { name: /penggeser/i })).toBeVisible();

    // Tambahkan operasi Ambang Otsu ke pipeline
    await page.getByTestId('tombol-tambah-operasi-biner_otsu').click();
    await expect(page.getByRole('list', { name: 'Rangkaian Operasi' })).toBeVisible();

    // Unduh berkas hasil pemrosesan
    const unduhPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const unduhan = await unduhPromise;
    const pathUnduh = await unduhan.path();
    const bufferUnduh = await fs.promises.readFile(pathUnduh);

    // Dekode citra PNG unduhan di browser dan verifikasi seluruh piksel murni biner (0 atau 255)
    const dataPiksel = await page.evaluate(async (base64) => {
      const blob = await fetch(`data:image/png;base64,${base64}`).then((r) =>
        r.blob()
      );
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height).data;

      let bukanBiner = 0;
      let count0 = 0;
      let count255 = 0;

      for (let i = 0; i < imgData.length; i += 4) {
        const val = imgData[i];
        if (val !== 0 && val !== 255) {
          bukanBiner++;
        }
        if (val === 0) count0++;
        if (val === 255) count255++;
      }

      return {
        width: bmp.width,
        height: bmp.height,
        bukanBiner,
        count0,
        count255,
      };
    }, bufferUnduh.toString('base64'));

    expect(dataPiksel.width).toBe(100);
    expect(dataPiksel.height).toBe(100);
    // Tidak boleh ada nilai selain 0 atau 255
    expect(dataPiksel.bukanBiner).toBe(0);
    // Harus ada piksel hitam dan piksel putih
    expect(dataPiksel.count0).toBeGreaterThan(0);
    expect(dataPiksel.count255).toBeGreaterThan(0);
  });

  // ==========================================================================
  // 2. UJI ALUR SOBEL: CITRA TANGGA -> SOBEL -> UNDUH -> TEPI TERANG, RATA 0
  // ==========================================================================
  test('2. Alur Deteksi Tepi Sobel: Upload tangga -> Sobel -> unduh -> kolom tepi terang, area datar 0', async ({
    page,
  }) => {
    await page.goto('/');

    const inputUnggah = page.locator('input[type="file"]');
    await inputUnggah.setInputFiles(fileTangga);
    await expect(page.getByRole('slider', { name: /penggeser/i })).toBeVisible();

    // Tambahkan Operator Sobel
    await page.getByTestId('tombol-tambah-operasi-tepi_sobel').click();

    // Unduh hasil resolusi penuh
    const unduhPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const unduhan = await unduhPromise;
    const pathUnduh = await unduhan.path();
    const bufferUnduh = await fs.promises.readFile(pathUnduh);

    // Dekode dan evaluasi nilai piksel pada koordinat tepi dan koordinat datar
    const evaluasiTepi = await page.evaluate(async (base64) => {
      const blob = await fetch(`data:image/png;base64,${base64}`).then((r) =>
        r.blob()
      );
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);

      // Piksel pada area datar kiri (x=20, y=50) dan kanan (x=80, y=50)
      const datarKiri = ctx.getImageData(20, 50, 1, 1).data[0];
      const datarKanan = ctx.getImageData(80, 50, 1, 1).data[0];

      // Piksel tepat di perbatasan kontras vertikal (x=49 dan x=50, y=50)
      const tepiTengah1 = ctx.getImageData(49, 50, 1, 1).data[0];
      const tepiTengah2 = ctx.getImageData(50, 50, 1, 1).data[0];

      return {
        datarKiri,
        datarKanan,
        tepiTengah1,
        tepiTengah2,
      };
    }, bufferUnduh.toString('base64'));

    // Hitung nilai eksak matematis di dalam pengujian (H6 ii):
    // Pada citra tangga vertikal: sisi kiri (x=0..49) bernilai 40, sisi kanan (x=50..99) bernilai 220
    // Area seragam (x=20 dan x=80): tetangga identik sehingga Gx = 0, Gy = 0 -> respon = 0
    // Pada tepi batas x=49: tetangga kiri=40, tetangga kanan=220
    // Gx = (220*1 + 220*2 + 220*1) - (40*1 + 40*2 + 40*1) = 880 - 160 = 720
    // Gy = 0, Besaran = sqrt(720^2 + 0) = 720 -> clamp(720) = 255
    const expectedDatar = 0;
    const expectedTepi = 255;

    expect(evaluasiTepi.datarKiri).toBe(expectedDatar);
    expect(evaluasiTepi.datarKanan).toBe(expectedDatar);
    expect(evaluasiTepi.tepiTengah1).toBe(expectedTepi);
    expect(evaluasiTepi.tepiTengah2).toBe(expectedTepi);
  });

  // ==========================================================================
  // 3. UJI ALUR EDITOR MATRIKS KERNEL: UKURAN 5x5, VALIDASI INPUT, UNDUH KECOCOKAN
  // ==========================================================================
  test('3. Alur Editor Matriks: Konvolusi kustom -> ubah ke 5x5 -> validasi huruf -> cocok hitungan tangan', async ({
    page,
  }) => {
    await page.goto('/');

    const inputUnggah = page.locator('input[type="file"]');
    await inputUnggah.setInputFiles(fileTangga);
    await expect(page.getByRole('slider', { name: /penggeser/i })).toBeVisible();

    // Tambah operasi Konvolusi Kernel
    await page.getByTestId('tombol-tambah-operasi-konvolusi_kernel').click();

    // Verifikasi komponen editor matriks tampil
    const editorMatriks = page.getByTestId('editor-matriks-kernel');
    await expect(editorMatriks).toBeVisible();

    // Beralih ke ukuran matriks 5x5
    await editorMatriks.getByRole('button', { name: '5×5' }).click();
    const selMatriks = editorMatriks.locator('div[role="gridcell"] input');
    // Matriks 5x5 memiliki tepat 25 sel grid
    await expect(selMatriks).toHaveCount(25);

    // Uji validasi input tak valid: masukkan huruf dan angka di luar batas (H6 iv)
    const selPusat = selMatriks.nth(12); // Indeks 12 adalah baris 3 kolom 3 (pusat 5x5)
    await selPusat.fill('abc'); // Huruf tidak valid
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(selPusat).toHaveAttribute('aria-invalid', 'true');

    await selPusat.fill('9999'); // Melampaui batas maksimum 100
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(selPusat).toHaveAttribute('aria-invalid', 'true');

    // Beralih kembali ke 3x3 untuk menerapkan kernel asimetris kustom (H6 iii)
    await editorMatriks.getByRole('button', { name: '3×3' }).click();
    const selMatriks3 = editorMatriks.locator('div[role="gridcell"] input');

    // Masukkan kernel asimetris: baris 1 kolom 1 bernilai 1, baris 1 kolom 2 bernilai 2, lainnya 0
    // [ 1, 2, 0 ]
    // [ 0, 0, 0 ]
    // [ 0, 0, 0 ]
    // Pembagi = 1, Offset = 0
    await selMatriks3.nth(0).fill('1');
    await selMatriks3.nth(1).fill('2');
    for (let s = 2; s < 9; s++) {
      await selMatriks3.nth(s).fill('0');
    }
    const inputPembagi = page.locator('input[id$="-pembagi"]');
    await inputPembagi.fill('1');
    const inputOffset = page.locator('input[id$="-offset"]');
    await inputOffset.fill('0');
    await inputOffset.dispatchEvent('blur');

    // Unduh hasil dan periksa kecocokan titik tertentu terhadap hitungan tangan (H6 iii)
    const unduhPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const unduhan = await unduhPromise;
    const pathUnduh = await unduhan.path();
    const bufferUnduh = await fs.promises.readFile(pathUnduh);

    // Hitungan tangan:
    // Pada citra tangga, area kiri (x=20, y=20) semua piksel bernilai 40
    // Respons konvolusi = 40 * 1 + 40 * 2 = 120!
    const hasilHitung = await page.evaluate(async (base64) => {
      const blob = await fetch(`data:image/png;base64,${base64}`).then((r) =>
        r.blob()
      );
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const p = ctx.getImageData(20, 20, 1, 1).data;
      return { r: p[0], a: p[3] };
    }, bufferUnduh.toString('base64'));

    expect(hasilHitung.r).toBe(120);
    expect(hasilHitung.a).toBe(255);
  });

  // ==========================================================================
  // 4. UJI UNDO / REDO PADA PERUBAHAN MATRIKS KERNEL
  // ==========================================================================
  test('4. Alur Undo/Redo: Perubahan sel matriks kernel tercatat dalam riwayat dan dapat di-undo/redo', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByRole('slider', { name: /penggeser/i })).toBeVisible();

    // Tambah operasi Konvolusi Kernel
    await page.getByTestId('tombol-tambah-operasi-konvolusi_kernel').click();

    const editorMatriks = page.getByTestId('editor-matriks-kernel');
    await expect(editorMatriks).toBeVisible();

    // Ubah nilai sel (1,1) menjadi 3
    const selPusat = editorMatriks.locator('div[role="gridcell"] input').nth(4); // Indeks 4 = pusat 3x3
    await selPusat.fill('3');
    await selPusat.dispatchEvent('blur');

    // Lakukan Undo
    const tombolUndo = page.getByRole('button', { name: 'Urungkan (Undo)' });
    await tombolUndo.click();

    // Verifikasi nilai kembali ke 1 (identitas awal)
    await expect(selPusat).toHaveValue('1');

    // Lakukan Redo
    const tombolRedo = page.getByRole('button', { name: 'Ulangi (Redo)' });
    await tombolRedo.click();

    // Verifikasi nilai pulih menjadi 3
    await expect(selPusat).toHaveValue('3');
  });

  // ==========================================================================
  // 5. UJI PRESET BARU "SILUET TEPI" & "HAPUS NOISE"
  // ==========================================================================
  test('5. Alur Preset: Terapkan preset "Siluet Tepi" dan "Hapus Noise" berhasil memuat konfigurasi', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByRole('slider', { name: /penggeser/i })).toBeVisible();

    // Klik preset "Siluet Tepi"
    const presetSiluet = page.getByTestId('tombol-preset-siluet_tepi');
    await presetSiluet.click();

    // Verifikasi pipeline berisi operasi Sobel
    const itemPipeline = page.locator('[role="listitem"]');
    await expect(itemPipeline).toHaveCount(1);
    await expect(itemPipeline.first()).toContainText('Operator Sobel');

    // Periksa sakelar inversi aktif
    const sakelarInversi = page.getByTestId('sakelar-inversi');
    await expect(sakelarInversi).toHaveAttribute('aria-checked', 'true');

    // Kosongkan pipeline lalu coba preset "Hapus Noise"
    await page.getByRole('button', { name: 'Kosongkan Pipeline' }).click();
    await page.getByTestId('tombol-preset-hapus_noise').click();

    await expect(itemPipeline).toHaveCount(1);
    await expect(itemPipeline.first()).toContainText('Penapis Median');
  });

  // ==========================================================================
  // 6. UJI KARTU BELAJAR & DUKUNGAN BILINGUAL
  // ==========================================================================
  test('6. Alur Mode Belajar: Buka kartu belajar konsep -> ganti bahasa ke Inggris -> teks terbarui instan', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByRole('slider', { name: /penggeser/i })).toBeVisible();

    // Tambah Ambang Otsu
    await page.getByTestId('tombol-tambah-operasi-biner_otsu').click();

    // Buka Kartu Belajar Konsep
    const kartuBelajar = page.getByTestId('kartu-belajar-operasi');
    await expect(kartuBelajar).toBeVisible();
    const tombolBuka = kartuBelajar.getByRole('button');
    await tombolBuka.click();
    await expect(tombolBuka).toHaveAttribute('aria-expanded', 'true');

    // Verifikasi teks bahasa Indonesia tampil
    await expect(
      kartuBelajar.getByText("Otsu's Global Optimum Thresholding")
    ).toBeVisible();
    await expect(kartuBelajar.getByText(/Rumus Matematika Inti/i)).toBeVisible();

    // Ganti bahasa ke Inggris melalui tombol navigasi
    await page.getByRole('button', { name: 'EN', exact: true }).click();

    // Verifikasi teks berubah ke bahasa Inggris seketika tanpa reload
    await expect(page.getByText('Concept Learning Mode')).toBeVisible();
    await expect(page.getByText('Core Mathematical Formula')).toBeVisible();
    await expect(page.getByText('Academic Technical Name')).toBeVisible();
  });

  // ==========================================================================
  // 7. UJI AKSESIBILITAS KEYBOARD PADA EDITOR MATRIKS
  // ==========================================================================
  test('7. Alur Aksesibilitas: Navigasi tombol panah keyboard berpindah sel matriks secara akurat', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByRole('slider', { name: /penggeser/i })).toBeVisible();

    await page.getByTestId('tombol-tambah-operasi-konvolusi_kernel').click();
    const editorMatriks = page.getByTestId('editor-matriks-kernel');
    await expect(editorMatriks).toBeVisible();

    const sel00 = editorMatriks.locator('input[aria-label="Baris 1, Kolom 1"]');
    const sel01 = editorMatriks.locator('input[aria-label="Baris 1, Kolom 2"]');
    const sel11 = editorMatriks.locator('input[aria-label="Baris 2, Kolom 2"]');

    // Pastikan sel visible dan fokus ke sel pertama
    await expect(sel00).toBeVisible();
    await sel00.focus();
    await expect(sel00).toBeFocused();

    // Tekan ArrowRight untuk berpindah ke kolom berikutnya
    await page.keyboard.press('ArrowRight');
    await expect(sel01).toBeFocused();

    // Tekan ArrowDown untuk berpindah ke baris bawahnya
    await page.keyboard.press('ArrowDown');
    await expect(sel11).toBeFocused();
  });

  // ==========================================================================
  // 8. VERIFIKASI STANDALONE MVP TANPA BACKEND (0 NETWORK REQUESTS KE SERVER)
  // ==========================================================================
  test('8. Verifikasi MVP Mandiri: 0 network request keluar ke server/backend saat menjalankan seluruh operasi', async ({
    page,
  }) => {
    const requestKeluar = [];
    await page.route('**', (route) => {
      const url = route.request().url();
      // Catat request ke endpoint backend API
      if (
        url.includes('/api/') ||
        url.includes('/kesehatan') ||
        url.includes(':8000')
      ) {
        requestKeluar.push(url);
      }
      route.continue();
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();

    // Terapkan rentetan operasi baru
    await page.getByTestId('tombol-tambah-operasi-biner_otsu').click();
    await page.getByTestId('tombol-tambah-operasi-halus_mean').click();
    await page.getByTestId('tombol-tambah-operasi-tajam_unsharp').click();
    await page.getByTestId('tombol-tambah-operasi-tepi_sobel').click();

    // Unduh hasil
    const unduhPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    await unduhPromise;

    // Verifikasi benar-benar 0 request keluar ke backend
    expect(requestKeluar).toHaveLength(0);
  });
});
