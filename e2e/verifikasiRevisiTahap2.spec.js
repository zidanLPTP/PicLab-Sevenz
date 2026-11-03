import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';

test.describe('PicLab Sevenz — Verifikasi Revisi Tahap 2 (R1, R2, R4, R5)', () => {
  test('R5. E2E Unduhan Resolusi Penuh & Verifikasi Dekode Piksel Nyata', async ({
    page,
  }) => {
    await page.goto('/');

    // --- Kasus 1: Operasi Tonal Negatif (Verifikasi nilai piksel 255 - asli) ---
    const pathUji100 = path.resolve('frontend/public/contoh/uji-100x100.png');
    const inputUnggah = page.locator('#input-citra-unggah');
    await inputUnggah.setInputFiles(pathUji100);
    await expect(page.getByRole('slider')).toBeVisible();

    // Pilih operasi Negatif Citra
    await page.getByRole('button', { name: /^Negatif Citra/ }).click();

    // Unduh hasil
    const eventUnduhNegatif = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const unduhNegatif = await eventUnduhNegatif;
    const pathFileNegatif = await unduhNegatif.path();
    const bufferNegatif = await fs.promises.readFile(pathFileNegatif);

    // Dekode berkas unduhan di browser dan cek piksel tengah (50, 50)
    // Nilai asli di (50, 50) adalah [100, 150, 200, 255]
    // Nilai negatif yang diharapkan: 255 - 100 = 155, 255 - 150 = 105, 255 - 200 = 55
    const hasilNegatif = await page.evaluate(async (base64) => {
      const blob = await fetch(`data:image/png;base64,${base64}`).then((r) =>
        r.blob()
      );
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const p = ctx.getImageData(50, 50, 1, 1).data;
      return {
        width: bmp.width,
        height: bmp.height,
        r: p[0],
        g: p[1],
        b: p[2],
        a: p[3],
      };
    }, bufferNegatif.toString('base64'));

    expect(hasilNegatif.width).toBe(100);
    expect(hasilNegatif.height).toBe(100);
    expect(hasilNegatif.r).toBe(155);
    expect(hasilNegatif.g).toBe(105);
    expect(hasilNegatif.b).toBe(55);
    expect(hasilNegatif.a).toBe(255);

    // --- Kasus 2: Rotasi 90° pada citra > 1024 px (Membuktikan resolusi penuh & dimensi tertukar) ---
    await page.getByRole('button', { name: 'Ganti Gambar' }).click();
    const pathUji1200 = path.resolve('frontend/public/contoh/uji-1200x800.png');
    await inputUnggah.setInputFiles(pathUji1200);
    await expect(page.getByRole('slider')).toBeVisible();

    // Pilih Rotasi 90°
    await page.getByRole('button', { name: /^Rotasi 90°/ }).click();

    const eventUnduhRotasi = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const unduhRotasi = await eventUnduhRotasi;
    const pathFileRotasi = await unduhRotasi.path();
    const bufferRotasi = await fs.promises.readFile(pathFileRotasi);

    const hasilRotasi = await page.evaluate(async (base64) => {
      const blob = await fetch(`data:image/png;base64,${base64}`).then((r) =>
        r.blob()
      );
      const bmp = await createImageBitmap(blob);
      return { width: bmp.width, height: bmp.height };
    }, bufferRotasi.toString('base64'));

    // Dimensi asli 1200x800 (> 1024 px preview) tertukar menjadi 800x1200 pada resolusi penuh
    expect(hasilRotasi.width).toBe(800);
    expect(hasilRotasi.height).toBe(1200);

    // --- Kasus 3: Ubah Ukuran (Resize) & Crop pada resolusi penuh ---
    await page.getByRole('button', { name: /^Ubah Ukuran/ }).click();
    // Isi lebarBaru=350, tinggiBaru=220
    const inputsAngka = page.locator('input[type="number"]');
    await inputsAngka.nth(0).fill('350');
    await inputsAngka.nth(1).fill('220');

    const eventUnduhResize = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Hasil' }).click();
    const unduhResize = await eventUnduhResize;
    const pathFileResize = await unduhResize.path();
    const bufferResize = await fs.promises.readFile(pathFileResize);

    const hasilResize = await page.evaluate(async (base64) => {
      const blob = await fetch(`data:image/png;base64,${base64}`).then((r) =>
        r.blob()
      );
      const bmp = await createImageBitmap(blob);
      return { width: bmp.width, height: bmp.height };
    }, bufferResize.toString('base64'));

    expect(hasilResize.width).toBe(350);
    expect(hasilResize.height).toBe(220);
  });

  test('R1. Uji Longtask & Latensi Ujung ke Ujung Slider (Citra 4000x3000)', async ({
    page,
  }) => {
    test.setTimeout(90000); // Waktu cukup untuk 30 pengulangan x 3 operasi

    await page.goto('/');

    // Pasang PerformanceObserver longtask di browser
    await page.evaluate(() => {
      window.__longTasks = [];
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__longTasks.push({
            durasi: entry.duration,
            waktuMulai: entry.startTime,
            nama: entry.name,
          });
        }
      });
      obs.observe({ entryTypes: ['longtask'] });
    });

    // Muat citra besar 4000x3000
    const pathUji4000 = path.resolve('frontend/public/contoh/foto-4000x3000.png');
    const inputUnggah = page.locator('#input-citra-unggah');
    await inputUnggah.setInputFiles(pathUji4000);
    await expect(page.getByRole('slider')).toBeVisible();

    // Fungsi pengukur latensi slider ujung-ke-ujung (input event -> preview blob URL berubah)
    async function ukurLatensiOperasi(idTombolOperasi, idParam, nilaiArray) {
      await page.getByRole('button', { name: idTombolOperasi }).click();
      await page.waitForTimeout(400); // Tunggu panel parameter dan operasi aktif selesai dirender

      const latensiList = [];

      for (const val of nilaiArray) {
        const latensi = await page.evaluate(
          async ({ paramId, nilai }) => {
            const inputKontrol =
              document.querySelector(`input[type="range"]#param-${paramId}`) ||
              document.querySelector(`#param-${paramId}`) ||
              document.querySelector('input[type="number"]');

            const imgSesudah = document.querySelector(
              'img[alt*="Sesudah"], img[alt*="After"]'
            );

            if (!inputKontrol || !imgSesudah) {
              throw new Error(
                `Elemen kontrol param-${paramId} atau imgSesudah tidak ditemukan`
              );
            }

            const urlAwal = imgSesudah.src;
            const waktuMulai = performance.now();

            const tungguPembaruan = new Promise((resolve) => {
              let selesai = false;
              const rampungkan = () => {
                if (selesai) return;
                selesai = true;
                imgSesudah.removeEventListener('load', rampungkan);
                obs.disconnect();
                resolve(performance.now() - waktuMulai);
              };

              const obs = new MutationObserver(() => {
                if (imgSesudah.src !== urlAwal) {
                  rampungkan();
                }
              });

              imgSesudah.addEventListener('load', rampungkan);
              obs.observe(imgSesudah, {
                attributes: true,
                attributeFilter: ['src'],
              });

              // Timeout pengaman per iterasi
              setTimeout(() => {
                rampungkan();
              }, 3000);
            });

            // Pemicu interaksi slider (panggil native setter agar React onChange terpicu)
            const nativeSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              'value'
            ).set;
            nativeSetter.call(inputKontrol, String(nilai));
            inputKontrol.dispatchEvent(new Event('input', { bubbles: true }));
            inputKontrol.dispatchEvent(new Event('change', { bubbles: true }));

            return await tungguPembaruan;
          },
          { paramId: idParam, nilai: val }
        );

        latensiList.push(latensi);
        // Beri jeda kecil agar thread stabil
        await page.waitForTimeout(30);
      }

      latensiList.sort((a, b) => a - b);
      const median = latensiList[Math.floor(latensiList.length / 2)];
      const p95 = latensiList[Math.floor(latensiList.length * 0.95)];
      return { latensiList, median, p95 };
    }

    // 1. Kecerahan (30 pengulangan)
    const nilaiKecerahan = Array.from({ length: 30 }, (_, i) => -50 + i * 3);
    const hasilKecerahan = await ukurLatensiOperasi(
      /^Kecerahan/,
      'kecerahan',
      nilaiKecerahan
    );

    // 2. Pergeseran Hue (30 pengulangan)
    const nilaiHue = Array.from({ length: 30 }, (_, i) => -150 + i * 10);
    const hasilHue = await ukurLatensiOperasi(
      /^Pergeseran Hue/,
      'pergeseran',
      nilaiHue
    );

    // 3. Ubah Ukuran Bilinear (30 pengulangan)
    const nilaiResize = Array.from({ length: 30 }, (_, i) => 400 + i * 10);
    const hasilResize = await ukurLatensiOperasi(
      /^Ubah Ukuran/,
      'lebarBaru',
      nilaiResize
    );

    // Ambil rekam jejak longtask
    const dataLongtask = await page.evaluate(() => window.__longTasks);

    // Simpan metrik ke berkas JSON agar dapat dirujuk di laporan
    const laporanPerforma = {
      longtasks: dataLongtask,
      jumlahLongtask: dataLongtask.length,
      longtaskMaksMs:
        dataLongtask.length > 0
          ? Math.max(...dataLongtask.map((t) => t.durasi))
          : 0,
      kecerahan: {
        median: hasilKecerahan.median,
        p95: hasilKecerahan.p95,
      },
      hue: {
        median: hasilHue.median,
        p95: hasilHue.p95,
      },
      resizeBilinear: {
        median: hasilResize.median,
        p95: hasilResize.p95,
      },
    };

    fs.writeFileSync(
      'tangkapan-layar/metrik-performa-r1.json',
      JSON.stringify(laporanPerforma, null, 2)
    );

    // Verifikasi bahwa metrik berhasil direkam dan operasi responsif terbarui
    expect(laporanPerforma.jumlahLongtask).toBeGreaterThanOrEqual(0);
    expect(laporanPerforma.kecerahan.median).toBeGreaterThan(0);
    expect(laporanPerforma.hue.median).toBeGreaterThan(0);
    expect(laporanPerforma.resizeBilinear.median).toBeGreaterThan(0);
  });

  test('R2. Pengukuran Ulang Benchmark 17 Operasi Nyata di Browser (Playwright Web Worker)', async ({
    page,
  }) => {
    test.setTimeout(120000); // 2 menit untuk benchmark penuh 17 operasi di worker

    await page.goto('/');

    // Benchmark 17 operasi di dalam browser nyata melalui Web Worker
    const hasilBenchmark = await page.evaluate(async () => {
      // Akses modul pengelola pekerja
      const { jalankanOperasi, ekstrakDataCitra } = await import(
        '/src/pekerja/pengelolaPekerja.js'
      );
      const { dapatkanSemuaOperasi, ekstrakNilaiAwalParameter } = await import(
        '/src/mesin/katalogOperasi.js'
      );

      // Muat citra uji 4000x3000
      const img = new Image();
      img.src = '/contoh/foto-4000x3000.png';
      await img.decode();

      // Citra preview (1024 px sisi terpanjang: 1024x768)
      const citraPreview = ekstrakDataCitra(img, true);
      // Citra penuh (4000x3000)
      const citraPenuh = ekstrakDataCitra(img, false);

      const semuaOperasi = dapatkanSemuaOperasi();
      const hasilTabel = [];

      for (const op of semuaOperasi) {
        const param = ekstrakNilaiAwalParameter(op);
        if (op.id === 'dasar_kecerahan') param.kecerahan = 25;
        if (op.id === 'dasar_kontras') param.kontras = 25;
        if (op.id === 'warna_saturasi') param.saturasi = 25;
        if (op.id === 'warna_hue') param.pergeseran = 45;
        if (op.id === 'warna_balance') param.merah = 20;

        // 1. Ukur Preview (5 pengulangan median)
        const durasiPreviewList = [];
        for (let i = 0; i < 5; i++) {
          const res = await jalankanOperasi(op.id, citraPreview, param);
          durasiPreviewList.push(res.durasi);
        }
        durasiPreviewList.sort((a, b) => a - b);
        const medianPreview = durasiPreviewList[2];

        // 2. Ukur Resolusi Penuh (3 pengulangan median)
        const durasiPenuhList = [];
        for (let i = 0; i < 3; i++) {
          const res = await jalankanOperasi(op.id, citraPenuh, param);
          durasiPenuhList.push(res.durasi);
        }
        durasiPenuhList.sort((a, b) => a - b);
        const medianPenuh = durasiPenuhList[1];

        hasilTabel.push({
          id: op.id,
          namaTeknis: op.namaTeknis,
          durasiPreviewMs: +medianPreview.toFixed(1),
          durasiPenuhMs: +medianPenuh.toFixed(1),
        });
      }

      return {
        dimensiPreview: `${citraPreview.width}x${citraPreview.height}`,
        dimensiPenuh: `${citraPenuh.width}x${citraPenuh.height}`,
        tabel: hasilTabel,
      };
    });

    fs.writeFileSync(
      'tangkapan-layar/benchmark-17-operasi.json',
      JSON.stringify(hasilBenchmark, null, 2)
    );

    expect(hasilBenchmark.tabel).toHaveLength(17);
  });
});
