import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';

test.describe('PicLab Sevenz — Skrip Benchmark Khusus & Pengukuran Kinerja (P4 & P5)', () => {
  test('B1. Benchmark 17 Operasi di Browser Nyata (Chromium Worker, Preview & 12 MP)', async ({
    page,
  }) => {
    test.setTimeout(180000); // 3 menit waktu cukup untuk benchmark komprehensif

    await page.goto('/');

    const hasilBenchmark = await page.evaluate(async () => {
      const { jalankanOperasi, ekstrakDataCitra } = await import(
        '/src/pekerja/pengelolaPekerja.js'
      );
      const { dapatkanSemuaOperasi, ekstrakNilaiAwalParameter } = await import(
        '/src/mesin/katalogOperasi.js'
      );

      // Siapkan citra uji preview (1024x768) dan citra penuh (4000x3000)
      const kanvasPreview = document.createElement('canvas');
      kanvasPreview.width = 1024;
      kanvasPreview.height = 768;
      const ctxPreview = kanvasPreview.getContext('2d');
      ctxPreview.fillStyle = '#4f46e5';
      ctxPreview.fillRect(0, 0, 1024, 768);
      const imgDataPreview = ctxPreview.getImageData(0, 0, 1024, 768);
      const citraPreview = {
        data: new Uint8ClampedArray(imgDataPreview.data),
        width: 1024,
        height: 768,
      };

      const kanvasPenuh = document.createElement('canvas');
      kanvasPenuh.width = 4000;
      kanvasPenuh.height = 3000;
      const ctxPenuh = kanvasPenuh.getContext('2d');
      ctxPenuh.fillStyle = '#059669';
      ctxPenuh.fillRect(0, 0, 4000, 3000);
      const imgDataPenuh = ctxPenuh.getImageData(0, 0, 4000, 3000);
      const citraPenuh = {
        data: new Uint8ClampedArray(imgDataPenuh.data),
        width: 4000,
        height: 3000,
      };

      const semuaOperasi = dapatkanSemuaOperasi();
      const tabelHasil = [];

      for (const op of semuaOperasi) {
        // Parameter standar uji
        const paramUjiPreview = ekstrakNilaiAwalParameter(op);
        const paramUjiPenuh = ekstrakNilaiAwalParameter(op);

        // Penyesuaian parameter ukuran agar menguji beban proporsional
        if (op.id === 'dasar_crop') {
          paramUjiPreview.x = 0;
          paramUjiPreview.y = 0;
          paramUjiPreview.lebar = 512;
          paramUjiPreview.tinggi = 384;

          paramUjiPenuh.x = 0;
          paramUjiPenuh.y = 0;
          paramUjiPenuh.lebar = 2000;
          paramUjiPenuh.tinggi = 1500;
        } else if (op.id === 'dasar_ubah_ukuran') {
          paramUjiPreview.lebarBaru = 512;
          paramUjiPreview.tinggiBaru = 384;
          paramUjiPreview.metode = 'bilinear';

          paramUjiPenuh.lebarBaru = 2000;
          paramUjiPenuh.tinggiBaru = 1500;
          paramUjiPenuh.metode = 'bilinear';
        }

        // Warm-up 3 kali
        for (let w = 0; w < 3; w++) {
          await jalankanOperasi(op.id, citraPreview, paramUjiPreview);
        }

        // Pengulangan 10 kali untuk Preview
        const durasiPreviewList = [];
        for (let r = 0; r < 10; r++) {
          const t0 = performance.now();
          const { durasi } = await jalankanOperasi(
            op.id,
            citraPreview,
            paramUjiPreview
          );
          durasiPreviewList.push(durasi);
        }
        durasiPreviewList.sort((a, b) => a - b);
        const medianPreview =
          durasiPreviewList[Math.floor(durasiPreviewList.length / 2)];
        const p95Preview =
          durasiPreviewList[Math.floor(durasiPreviewList.length * 0.95)];

        // Warm-up 1 kali untuk Penuh
        await jalankanOperasi(op.id, citraPenuh, paramUjiPenuh);

        // Pengulangan 5 kali untuk Resolusi Penuh 12 MP
        const durasiPenuhList = [];
        for (let r = 0; r < 5; r++) {
          const { durasi } = await jalankanOperasi(
            op.id,
            citraPenuh,
            paramUjiPenuh
          );
          durasiPenuhList.push(durasi);
        }
        durasiPenuhList.sort((a, b) => a - b);
        const medianPenuh =
          durasiPenuhList[Math.floor(durasiPenuhList.length / 2)];
        const p95Penuh =
          durasiPenuhList[Math.floor(durasiPenuhList.length * 0.95)];

        tabelHasil.push({
          id: op.id,
          namaTeknis: op.namaTeknis,
          parameterPreview: paramUjiPreview,
          parameterPenuh: paramUjiPenuh,
          previewMedianMs: Number(medianPreview.toFixed(2)),
          previewP95Ms: Number(p95Preview.toFixed(2)),
          penuhMedianMs: Number(medianPenuh.toFixed(2)),
          penuhP95Ms: Number(p95Penuh.toFixed(2)),
        });
      }

      return {
        lingkungan: 'Chromium Browser (Playwright) via Web Worker',
        warmUp: '3x preview, 1x penuh',
        pengulangan: '10x preview, 5x penuh',
        dimensiPreview: '1024x768 (0.78 MP)',
        dimensiPenuh: '4000x3000 (12.0 MP)',
        tabel: tabelHasil,
      };
    });

    fs.writeFileSync(
      'tangkapan-layar/benchmark-17-operasi.json',
      JSON.stringify(hasilBenchmark, null, 2)
    );

    console.log('BENCHMARK 17 OPERASI SELESAI:', hasilBenchmark.tabel.length);
    expect(hasilBenchmark.tabel.length).toBe(17);
  });

  test('B2. Pengukuran Latensi Ujung ke Ujung Slider & Longtask (5 Operasi Kunci)', async ({
    page,
  }) => {
    test.setTimeout(180000);

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

    const pathUji4000 = path.resolve(
      'frontend/public/contoh/foto-4000x3000.png'
    );
    const inputUnggah = page.locator('#input-citra-unggah');
    await inputUnggah.setInputFiles(pathUji4000);
    await expect(page.getByRole('slider')).toBeVisible();

    async function ukurLatensi(idTombol, idParam, nilaiList) {
      await page.getByRole('button', { name: idTombol }).click();
      await page.waitForTimeout(400);

      const latensiList = [];

      for (const val of nilaiList) {
        const latensi = await page.evaluate(
          async ({ paramId, nilai }) => {
            const inputKontrol =
              document.querySelector(`input[type="range"]#param-${paramId}`) ||
              document.querySelector(`#param-${paramId}`);
            const kanvasSesudah = document.querySelector(
              'canvas[data-testid="kanvas-sesudah"]'
            );

            if (!inputKontrol || !kanvasSesudah) {
              throw new Error('Elemen tidak ditemukan');
            }

            const tMulai = performance.now();

            // Pemicu native setter slider atau select
            const isSelect = inputKontrol.tagName === 'SELECT';
            if (isSelect) {
              const nativeSelectSetter = Object.getOwnPropertyDescriptor(
                window.HTMLSelectElement.prototype,
                'value'
              )?.set;
              if (nativeSelectSetter) {
                nativeSelectSetter.call(inputKontrol, String(nilai));
              } else {
                inputKontrol.value = String(nilai);
              }
            } else {
              const nativeInputSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value'
              )?.set;
              if (nativeInputSetter) {
                nativeInputSetter.call(inputKontrol, String(nilai));
              } else {
                inputKontrol.value = String(nilai);
              }
            }
            inputKontrol.dispatchEvent(new Event('input', { bubbles: true }));
            inputKontrol.dispatchEvent(new Event('change', { bubbles: true }));

            // Tunggu render frame berikutnya untuk memastikan putImageData selesai diproses GPU
            await new Promise((r) => requestAnimationFrame(() => r()));
            return performance.now() - tMulai;
          },
          { paramId: idParam, nilai: val }
        );

        latensiList.push(latensi);
        await page.waitForTimeout(30);
      }

      latensiList.sort((a, b) => a - b);
      const median = latensiList[Math.floor(latensiList.length / 2)];
      const p95 = latensiList[Math.floor(latensiList.length * 0.95)];
      return {
        median: Number(median.toFixed(2)),
        p95: Number(p95.toFixed(2)),
      };
    }

    // 1. Kecerahan (30 pengulangan)
    const hasilKecerahan = await ukurLatensi(
      /^Kecerahan/,
      'kecerahan',
      Array.from({ length: 30 }, (_, i) => -50 + i * 3)
    );

    // 2. Pergeseran Hue (30 pengulangan)
    const hasilHue = await ukurLatensi(
      /^Pergeseran Hue/,
      'pergeseran',
      Array.from({ length: 30 }, (_, i) => -150 + i * 10)
    );

    // 3. Ubah Ukuran Bilinear (30 pengulangan)
    const hasilResize = await ukurLatensi(
      /^Ubah Ukuran/,
      'lebarBaru',
      Array.from({ length: 30 }, (_, i) => 400 + i * 10)
    );

    // 4. Sepia (30 pengulangan)
    const hasilSepia = await ukurLatensi(
      /^Efek Sepia/,
      'intensitas',
      Array.from({ length: 30 }, (_, i) => 20 + i * 2)
    );

    // 5. Ekualisasi Histogram (30 pengulangan pemicuan)
    const hasilEkualisasi = await ukurLatensi(
      /^Ekualisasi Histogram/,
      'mode',
      Array.from({ length: 30 }, (_, i) =>
        i % 2 === 0 ? 'luminans' : 'per_kanal'
      )
    );

    const dataLongtask = await page.evaluate(() => window.__longTasks);

    const laporanR1 = {
      longtasks: dataLongtask,
      jumlahLongtask: dataLongtask.length,
      longtaskMaksMs:
        dataLongtask.length > 0
          ? Math.max(...dataLongtask.map((t) => t.durasi))
          : 0,
      kecerahan: hasilKecerahan,
      hue: hasilHue,
      resizeBilinear: hasilResize,
      sepia: hasilSepia,
      ekualisasi: hasilEkualisasi,
    };

    console.log('HASIL P4 LATENSI & LONGTASK:', laporanR1);

    fs.writeFileSync(
      'tangkapan-layar/metrik-performa-r1.json',
      JSON.stringify(laporanR1, null, 2)
    );

    expect(hasilKecerahan.median).toBeLessThanOrEqual(100);
    expect(hasilHue.median).toBeLessThanOrEqual(100);
  });
});
