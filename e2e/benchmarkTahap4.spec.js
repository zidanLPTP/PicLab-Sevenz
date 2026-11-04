import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';

test.describe('PicLab Sevenz — Benchmark Tahap 4: 13 Operasi Baru, Longtasks, & Tangkapan Layar Visual', () => {
  test('Benchmark 13 Operasi Spasial, Latensi E2E, Longtasks, & Screenshot Visual', async ({
    page,
  }) => {
    test.setTimeout(480000); // 8 menit untuk pengujian komprehensif

    await page.goto('/');

    // ========================================================================
    // 1. BENCHMARK WEB WORKER: 13 OPERASI PADA PARAMETER REPRESENTATIF (H1)
    // ========================================================================
    console.log('Memulai benchmark Web Worker untuk 13 operasi baru Tahap 4...');

    const hasilWorker = await page.evaluate(async () => {
      const { jalankanOperasi } = await import(
        '/src/pekerja/pengelolaPekerja.js'
      );

      // (A) Bangkitkan citra sintetis 12 MP (4000x3000) gradien warna nyata
      const c12 = document.createElement('canvas');
      c12.width = 4000;
      c12.height = 3000;
      const ctx12 = c12.getContext('2d');
      const grad = ctx12.createLinearGradient(0, 0, 4000, 3000);
      grad.addColorStop(0, '#e65c00');
      grad.addColorStop(0.3, '#f9d423');
      grad.addColorStop(0.7, '#2193b0');
      grad.addColorStop(1, '#6dd5ed');
      ctx12.fillStyle = grad;
      ctx12.fillRect(0, 0, 4000, 3000);
      const data12 = ctx12.getImageData(0, 0, 4000, 3000);
      const citraPenuh = {
        data: new Uint8ClampedArray(data12.data),
        width: 4000,
        height: 3000,
      };

      // (B) Bangkitkan citra preview 1024x768 dari citra 12 MP
      const cPrev = document.createElement('canvas');
      cPrev.width = 1024;
      cPrev.height = 768;
      const ctxPrev = cPrev.getContext('2d');
      ctxPrev.drawImage(c12, 0, 0, 1024, 768);
      const dataPrev = ctxPrev.getImageData(0, 0, 1024, 768);
      const citraPreview = {
        data: new Uint8ClampedArray(dataPrev.data),
        width: 1024,
        height: 768,
      };

      // Daftar parameter representatif sesuai spec H1 d
      const operasiUji = [
        { id: 'biner_manual', label: 'biner_manual (ambang 128)', param: { ambang: 128, inversi: false } },
        { id: 'biner_otsu', label: 'biner_otsu (global)', param: { inversi: false } },
        { id: 'biner_adaptif', label: 'biner_adaptif (jendela 15)', param: { jendela: 15, c: 5, inversi: false } },
        { id: 'biner_adaptif', label: 'biner_adaptif (jendela 25)', param: { jendela: 25, c: 5, inversi: false } },
        { id: 'halus_mean', label: 'halus_mean (radius 5)', param: { radius: 5 } },
        { id: 'halus_gaussian', label: 'halus_gaussian (σ=3)', param: { sigma: 3.0 } },
        { id: 'halus_gaussian', label: 'halus_gaussian (σ=5)', param: { sigma: 5.0 } },
        { id: 'halus_median', label: 'halus_median (ukuran 3)', param: { ukuran: 3 } },
        { id: 'halus_median', label: 'halus_median (ukuran 5)', param: { ukuran: 5 } },
        { id: 'tajam_unsharp', label: 'tajam_unsharp (σ=3, jumlah 1.5)', param: { sigma: 3.0, jumlah: 1.5, ambang: 0 } },
        { id: 'tajam_kernel', label: 'tajam_kernel (4_tetangga)', param: { model: '4_tetangga' } },
        {
          id: 'konvolusi_kernel',
          label: 'konvolusi_kernel (5x5 Gaussian)',
          param: {
            ukuran: 5,
            matriks: [
              1, 4, 6, 4, 1,
              4, 16, 24, 16, 4,
              6, 24, 36, 24, 6,
              4, 16, 24, 16, 4,
              1, 4, 6, 4, 1,
            ],
            pembagi: 256,
            offset: 0,
          },
        },
        { id: 'tepi_sobel', label: 'tepi_sobel (gabungan)', param: { arah: 'gabungan', penguatan: 1.0, inversi: false } },
        { id: 'tepi_prewitt', label: 'tepi_prewitt (gabungan)', param: { arah: 'gabungan', penguatan: 1.0, inversi: false } },
        { id: 'tepi_roberts', label: 'tepi_roberts (gabungan)', param: { arah: 'gabungan', penguatan: 1.0, inversi: false } },
        { id: 'tepi_laplacian', label: 'tepi_laplacian (4_tetangga)', param: { model: '4_tetangga', penguatan: 1.0, inversi: false } },
      ];

      const ringkasan = {};

      const hitungStat = (arr) => {
        const s = [...arr].sort((a, b) => a - b);
        const med = s[Math.floor(s.length / 2)];
        const p95 = s[Math.floor(s.length * 0.95)];
        return {
          median: parseFloat(med.toFixed(2)),
          p95: parseFloat(p95.toFixed(2)),
        };
      };

      for (const op of operasiUji) {
        // (i) Pemanasan (Warmup) 3x pada preview
        for (let w = 0; w < 3; w++) {
          await jalankanOperasi(op.id, citraPreview, op.param);
        }

        // (ii) Pengukuran pada Preview 1024x768 (30 iterasi)
        const durasiPreview = [];
        for (let i = 0; i < 30; i++) {
          const tAwal = performance.now();
          await jalankanOperasi(op.id, citraPreview, op.param);
          durasiPreview.push(performance.now() - tAwal);
        }

        // (iii) Pengukuran pada 12 MP (4000x3000) (3 iterasi dengan pemanasan 1x)
        await jalankanOperasi(op.id, citraPenuh, op.param);
        const durasi12MP = [];
        for (let i = 0; i < 3; i++) {
          const tAwal12 = performance.now();
          await jalankanOperasi(op.id, citraPenuh, op.param);
          durasi12MP.push(performance.now() - tAwal12);
        }

        ringkasan[op.label] = {
          preview: hitungStat(durasiPreview),
          resolusi12MP: hitungStat(durasi12MP),
        };
      }

      // (C) Pembuktian Pipeline Berat 12 MP (Gaussian σ=3 + Median 5x5 + Sobel) (H1 e)
      const tAwalHeavy = performance.now();
      const res1 = await jalankanOperasi('halus_gaussian', citraPenuh, { sigma: 3.0 });
      const res2 = await jalankanOperasi('halus_median', res1.hasil, { ukuran: 5 });
      const res3 = await jalankanOperasi('tepi_sobel', res2.hasil, { arah: 'gabungan', penguatan: 1.0 });
      const durasiHeavyPipeline12MP = performance.now() - tAwalHeavy;

      // Estimasi puncak memori heap peramban
      const memori = window.performance?.memory
        ? {
            usedJSHeapSizeMB: parseFloat(
              (window.performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2)
            ),
            totalJSHeapSizeMB: parseFloat(
              (window.performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(2)
            ),
          }
        : { status: 'Memory API not exposed' };

      return {
        benchmarkOperasi: ringkasan,
        heavyPipeline12MP: {
          durasiTotalMs: parseFloat(durasiHeavyPipeline12MP.toFixed(2)),
          selesaiTanpaOOM: res3.hasil && res3.hasil.data.length === 4000 * 3000 * 4,
          memori,
        },
      };
    });

    console.log(
      'Hasil Benchmark Web Worker Tahap 4:',
      JSON.stringify(hasilWorker, null, 2)
    );

    // ========================================================================
    // 2. PENGUKURAN LATENSI SLIDER E2E & LONGTASKS SESUDAH OPTIMASI (H2)
    // ========================================================================
    // Pasang PerformanceObserver longtask di thread utama
    await page.evaluate(() => {
      window.__longtasks = [];
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__longtasks.push({
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });
      obs.observe({ entryTypes: ['longtask'] });
    });

    // Muat gambar contoh di UI
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByRole('slider', { name: /penggeser/i })).toBeVisible();

    const operasiSliderUji = [
      { id: 'biner_manual', tombolId: 'tombol-tambah-operasi-biner_manual', sliderId: 'param-ambang', min: 60, delta: 10, isInt: true },
      { id: 'halus_gaussian', tombolId: 'tombol-tambah-operasi-halus_gaussian', sliderId: 'param-sigma', min: 1.0, delta: 0.2, isInt: false },
      { id: 'tajam_unsharp', tombolId: 'tombol-tambah-operasi-tajam_unsharp', sliderId: 'param-sigma', min: 1.0, delta: 0.2, isInt: false },
      { id: 'tepi_sobel', tombolId: 'tombol-tambah-operasi-tepi_sobel', sliderId: 'param-penguatan', min: 1.0, delta: 0.1, isInt: false },
    ];

    const hasilSliderE2E = {};

    for (const item of operasiSliderUji) {
      // Kosongkan pipeline jika ada
      const tombolKosongkan = page.getByRole('button', { name: 'Kosongkan Pipeline' });
      if (await tombolKosongkan.isVisible()) {
        await tombolKosongkan.click();
      }

      await page.getByTestId(item.tombolId).click();
      const slider = page.locator(`#${item.sliderId}`);
      await expect(slider).toBeVisible();

      // Reset counter longtask
      await page.evaluate(() => { window.__longtasks = []; });

      const durasiInteraksi = [];
      for (let i = 0; i < 30; i++) {
        const val = item.isInt
          ? String(Math.round(item.min + (i % 10) * item.delta))
          : (item.min + (i % 10) * item.delta).toFixed(1);

        const latensi = await page.evaluate(async ({ idParam, nilai }) => {
          const input = document.getElementById(idParam);
          if (!input) throw new Error('Slider tidak ditemukan: ' + idParam);

          const tAwal = performance.now();
          const tungguKanvas = new Promise((resolve) => {
            window.__saatKanvasTerbarui = () => resolve(performance.now() - tAwal);
            setTimeout(() => resolve(performance.now() - tAwal), 3000);
          });

          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
          ).set;
          nativeSetter.call(input, String(nilai));
          input.dispatchEvent(new Event('input', { bubbles: true }));

          const durasi = await tungguKanvas;
          return durasi;
        }, { idParam: item.sliderId, nilai: val });

        durasiInteraksi.push(latensi);
      }

      const longtasks = await page.evaluate(() => window.__longtasks || []);
      const totalLongtask = longtasks.length;
      const maxLongtaskMs = longtasks.reduce((m, l) => Math.max(m, l.duration), 0);

      const hitungStat = (arr) => {
        const s = [...arr].sort((a, b) => a - b);
        return {
          median: parseFloat(s[Math.floor(s.length / 2)].toFixed(2)),
          p95: parseFloat(s[Math.floor(s.length * 0.95)].toFixed(2)),
        };
      };

      hasilSliderE2E[item.id] = {
        ...hitungStat(durasiInteraksi),
        totalLongtask,
        maxLongtaskMs: parseFloat(maxLongtaskMs.toFixed(2)),
      };
    }

    console.log(
      'Hasil Latensi Slider E2E & Longtasks:',
      JSON.stringify(hasilSliderE2E, null, 2)
    );

    // ========================================================================
    // 3. TANGKAPAN LAYAR VISUAL QA (1920px & 1280px, ID & EN) (H9)
    // ========================================================================
    const targetFolder = path.resolve('tangkapan-layar');
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    // Setel tampilan ke editor matriks & kartu belajar
    const tombolKosongkan = page.getByRole('button', { name: 'Kosongkan Pipeline' });
    if (await tombolKosongkan.isVisible()) await tombolKosongkan.click();
    await page.getByTestId('tombol-tambah-operasi-konvolusi_kernel').click();

    // Buka Kartu Belajar Konsep
    const kartuBelajar = page.getByTestId('kartu-belajar-operasi');
    const tombolKartu = kartuBelajar.getByRole('button');
    if ((await tombolKartu.getAttribute('aria-expanded')) !== 'true') {
      await tombolKartu.click();
    }

    // 1. 1920x1080 ID
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByRole('button', { name: 'ID', exact: true }).click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(targetFolder, 'tahap4-1920px-matriks-belajar-id.png'),
    });

    // 2. 1920x1080 EN
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(targetFolder, 'tahap4-1920px-matriks-belajar-en.png'),
    });

    // 3. 1280x800 EN
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(targetFolder, 'tahap4-1280px-matriks-belajar-en.png'),
    });

    // 4. 1280x800 ID
    await page.getByRole('button', { name: 'ID', exact: true }).click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(targetFolder, 'tahap4-1280px-matriks-belajar-id.png'),
    });

    // Simpan seluruh data benchmark ke berkas JSON
    const dataLengkap = {
      tanggalPengujian: new Date().toISOString(),
      lingkungan: { browser: 'Chromium (Playwright)', os: 'Windows 64-bit' },
      hasilWorker: hasilWorker.benchmarkOperasi,
      heavyPipeline12MP: hasilWorker.heavyPipeline12MP,
      latensiSliderE2E: hasilSliderE2E,
    };
    fs.writeFileSync(
      path.join(targetFolder, 'benchmark-tahap4.json'),
      JSON.stringify(dataLengkap, null, 2)
    );

    expect(hasilWorker.heavyPipeline12MP.selesaiTanpaOOM).toBe(true);
  });
});
