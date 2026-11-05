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
        { id: 'halus_gaussian', label: 'halus_gaussian (σ=10)', param: { sigma: 10.0 } },
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
      {
        id: 'tajam_unsharp',
        label: 'tajam_unsharp (jumlah)',
        tombolId: 'tombol-tambah-operasi-tajam_unsharp',
        elementId: 'param-jumlah',
        tipe: 'slider',
        hitungVal: (i) => (0.5 + (i % 15) * 0.2).toFixed(1),
      },
      {
        id: 'halus_gaussian_sigma3',
        label: 'halus_gaussian (σ=3)',
        tombolId: 'tombol-tambah-operasi-halus_gaussian',
        elementId: 'param-sigma',
        tipe: 'slider',
        hitungVal: (i) => (1.0 + (i % 6) * 0.5).toFixed(1),
      },
      {
        id: 'halus_gaussian_sigma10',
        label: 'halus_gaussian (σ=10)',
        tombolId: 'tombol-tambah-operasi-halus_gaussian',
        elementId: 'param-sigma',
        tipe: 'slider',
        hitungVal: (i) => (8.0 + (i % 5) * 0.5).toFixed(1),
      },
      {
        id: 'halus_median_5',
        label: 'halus_median (ukuran 5)',
        tombolId: 'tombol-tambah-operasi-halus_median',
        elementId: 'param-ukuran',
        tipe: 'select',
        setup: async () => {
          await page.locator('#param-ukuran').selectOption('5');
          await page.waitForTimeout(200);
        },
        hitungVal: (i) => (i % 2 === 0 ? '5' : '3'),
      },
      {
        id: 'konvolusi_kernel_5x5',
        label: 'konvolusi_kernel (5x5 offset)',
        tombolId: 'tombol-tambah-operasi-konvolusi_kernel',
        elementId: 'input[id$="-offset"]',
        tipe: 'angka',
        setup: async () => {
          await page
            .getByTestId('editor-matriks-kernel')
            .getByRole('button', { name: '5×5' })
            .click();
          await page.waitForTimeout(200);
        },
        hitungVal: (i) => String(Math.round(((i % 15) + 1) * 5)),
      },
      {
        id: 'tepi_sobel',
        label: 'tepi_sobel (penguatan)',
        tombolId: 'tombol-tambah-operasi-tepi_sobel',
        elementId: 'param-penguatan',
        tipe: 'slider',
        hitungVal: (i) => (0.5 + (i % 15) * 0.2).toFixed(1),
      },
      {
        id: 'biner_manual',
        label: 'biner_manual (ambang)',
        tombolId: 'tombol-tambah-operasi-biner_manual',
        elementId: 'param-ambang',
        tipe: 'slider',
        hitungVal: (i) => String(Math.round(60 + (i % 15) * 5)),
      },
    ];

    const hasilSliderE2E = {};

    for (const item of operasiSliderUji) {
      // Kosongkan pipeline jika ada
      const tombolKosongkan = page.getByRole('button', { name: 'Kosongkan Pipeline' });
      if (await tombolKosongkan.isVisible()) {
        await tombolKosongkan.click();
      }

      await page.getByTestId(item.tombolId).click();
      if (item.setup) {
        await item.setup();
      }

      const selectorEl = item.elementId.startsWith('input[')
        ? item.elementId
        : `#${item.elementId}`;
      const inputEl = page.locator(selectorEl);
      await expect(inputEl).toBeVisible();

      // Reset array pelacakan interaksi & longtasks di peramban
      await page.evaluate(() => {
        window.__longtasks = [];
        window.__riwayatFrameTampil = [];
      });

      // Lakukan simulasi scrubbing interaktif cepat 30 kali input (0.1)
      const daftarNilai = [];
      for (let i = 0; i < 30; i++) {
        daftarNilai.push(item.hitungVal(i));
      }

      const hasilScrub = await page.evaluate(
        async ({ idElemen, nilaiArray, tipe }) => {
          const el = idElemen.startsWith('input[')
            ? document.querySelector(idElemen)
            : document.getElementById(idElemen);
          if (!el) throw new Error('Elemen tidak ditemukan: ' + idElemen);

          window.__riwayatFrameTampil = [];
          const tAwalScrub = performance.now();
          let tInputTerakhir = tAwalScrub;

          // Kirim 30 kali input secara realistis dan cepat (~25ms per geser)
          for (let i = 0; i < nilaiArray.length; i++) {
            const val = nilaiArray[i];
            tInputTerakhir = performance.now();
            window.__tInputTerakhir = tInputTerakhir;

            if (tipe === 'select') {
              const nativeSelectSetter = Object.getOwnPropertyDescriptor(
                window.HTMLSelectElement.prototype,
                'value'
              ).set;
              nativeSelectSetter.call(el, String(val));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              const nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value'
              ).set;
              nativeSetter.call(el, String(val));
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Jeda antar pergerakan slider (25 ms)
            await new Promise((r) => setTimeout(r, 25));
          }

          // Tunggu hingga komputasi worker selesai dan kanvas menampilkan nilai stabil akhir
          const batasWaktuMaksimal = 8000;
          const tMulaiTunggu = performance.now();
          let stabil = false;

          while (performance.now() - tMulaiTunggu < batasWaktuMaksimal) {
            const idle = typeof window.__apakahPekerjaIdle === 'function'
              ? window.__apakahPekerjaIdle()
              : true;
            const riwayat = window.__riwayatFrameTampil || [];
            const frameTerakhir = riwayat[riwayat.length - 1];

            if (idle && frameTerakhir && frameTerakhir.tInput >= tInputTerakhir - 2) {
              stabil = true;
              break;
            }
            await new Promise((r) => setTimeout(r, 20));
          }

          const tStabil = performance.now();
          const riwayatFrame = window.__riwayatFrameTampil || [];
          const waktuStabilMs = tStabil - tInputTerakhir;
          const totalDurasiScrubDetik = (tStabil - tAwalScrub) / 1000;
          const fps = totalDurasiScrubDetik > 0
            ? riwayatFrame.length / totalDurasiScrubDetik
            : 0;

          return {
            suksesStabil: stabil,
            totalInputDikirim: nilaiArray.length,
            jumlahFrameTampil: riwayatFrame.length,
            waktuStabilMs: parseFloat(waktuStabilMs.toFixed(2)),
            fps: parseFloat(fps.toFixed(2)),
            latensiPerFrameMs: riwayatFrame.map((f) => parseFloat(f.latensiMs.toFixed(2))),
          };
        },
        { idElemen: item.elementId, nilaiArray: daftarNilai, tipe: item.tipe }
      );

      const longtasks = await page.evaluate(() => window.__longtasks || []);
      const totalLongtask = longtasks.length;
      const maxLongtaskMs = longtasks.reduce((m, l) => Math.max(m, l.duration), 0);

      const hitungStat = (arr) => {
        if (!arr || arr.length === 0) return { median: 0, p95: 0 };
        const s = [...arr].sort((a, b) => a - b);
        return {
          median: parseFloat(s[Math.floor(s.length / 2)].toFixed(2)),
          p95: parseFloat(s[Math.floor(s.length * 0.95)].toFixed(2)),
        };
      };

      const statLatensiFrame = hitungStat(hasilScrub.latensiPerFrameMs);

      hasilSliderE2E[item.id] = {
        label: item.label,
        latensiFrameTampil: statLatensiFrame,
        waktuStabilMs: hasilScrub.waktuStabilMs,
        fpsScrub: hasilScrub.fps,
        jumlahFrameTampil: hasilScrub.jumlahFrameTampil,
        totalInputDikirim: hasilScrub.totalInputDikirim,
        totalLongtask,
        maxLongtaskMs: parseFloat(maxLongtaskMs.toFixed(2)),
      };

      expect(hasilScrub.suksesStabil).toBe(true);
      expect(hasilScrub.jumlahFrameTampil).toBeGreaterThan(0);
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

    // Pastikan ukuran 5x5 dipilih untuk tangkapan layar matriks 5x5
    const tombol5x5 = page.getByTestId('editor-matriks-kernel').getByRole('button', { name: '5×5' });
    if (await tombol5x5.isVisible()) {
      await tombol5x5.click();
      await page.waitForTimeout(200);
    }

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
