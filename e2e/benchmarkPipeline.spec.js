import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';

test.describe('PicLab Sevenz — Benchmark Pipeline 5 Langkah & Tangkapan Layar Tahap 3', () => {
  test('Benchmark Pipeline: Latensi Prefix Cache vs Worst-Case, Longtasks, & Unduh 12 MP', async ({
    page,
  }) => {
    test.setTimeout(300000); // 5 menit

    await page.goto('/');

    // 1. Eksekusi benchmark pipeline 5 langkah di worker langsung pada resolusi penuh 12 MP & preview 1024x768
    const hasilWorker = await page.evaluate(async () => {
      const { jalankanPipeline } = await import(
        '/src/pekerja/pengelolaPekerja.js'
      );

      // Buat citra 12 MP sintetis (4000x3000)
      const c12 = document.createElement('canvas');
      c12.width = 4000;
      c12.height = 3000;
      const ctx12 = c12.getContext('2d');
      const grad = ctx12.createLinearGradient(0, 0, 4000, 3000);
      grad.addColorStop(0, '#ff416c');
      grad.addColorStop(0.3, '#ff4b2b');
      grad.addColorStop(0.6, '#1a2a6c');
      grad.addColorStop(1, '#fdbb2d');
      ctx12.fillStyle = grad;
      ctx12.fillRect(0, 0, 4000, 3000);
      const data12 = ctx12.getImageData(0, 0, 4000, 3000);
      const citraPenuh = {
        data: new Uint8ClampedArray(data12.data),
        width: 4000,
        height: 3000,
      };

      // Preview 1024x768
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

      // Pipeline 5 langkah:
      // Langkah 0: Kecerahan
      // Langkah 1: Kontras
      // Langkah 2: Saturasi
      // Langkah 3: Negatif Citra
      // Langkah 4: Gamma
      const buatPipeline5 = (valLangkah1 = 20, valLangkah5 = 1.2) => [
        {
          id: 'kecerahan-1',
          idOperasi: 'dasar_kecerahan',
          aktif: true,
          parameter: { kecerahan: valLangkah1 },
        },
        {
          id: 'kontras-2',
          idOperasi: 'dasar_kontras',
          aktif: true,
          parameter: { kontras: 25 },
        },
        {
          id: 'saturasi-3',
          idOperasi: 'warna_saturasi',
          aktif: true,
          parameter: { saturasi: 15 },
        },
        {
          id: 'negatif-4',
          idOperasi: 'dasar_negatif',
          aktif: true,
          parameter: {},
        },
        {
          id: 'gamma-5',
          idOperasi: 'enhancement_gamma',
          aktif: true,
          parameter: { gamma: valLangkah5 },
        },
      ];

      // Pemanasan
      await jalankanPipeline(
        buatPipeline5(20, 1.2),
        citraPreview,
        { rasio: 1.0 },
        true
      );

      // (A) Ukur Worst-Case: Langkah 0 diubah (semua 5 langkah dihitung)
      const durasiWorstCasePreview = [];
      for (let i = 0; i < 15; i++) {
        const val = 10 + i;
        const p = buatPipeline5(val, 1.2);
        const t0 = performance.now();
        await jalankanPipeline(p, citraPreview, { rasio: 1.0 }, true);
        durasiWorstCasePreview.push(performance.now() - t0);
      }

      // (B) Ukur Best-Case (Prefix Cache Hit): Hanya langkah ke-5 diubah (langkah 0-3 dari cache)
      const durasiCachePreview = [];
      for (let i = 0; i < 25; i++) {
        const valGamma = 1.0 + i * 0.05;
        const p = buatPipeline5(24, valGamma);
        const t0 = performance.now();
        await jalankanPipeline(p, citraPreview, { rasio: 1.0 }, true);
        durasiCachePreview.push(performance.now() - t0);
      }

      // (C) Unduh Resolusi Penuh 12 MP (Eksekusi 5 langkah tanpa cache intermediate)
      const tAwalUnduh = performance.now();
      const resPenuh = await jalankanPipeline(
        buatPipeline5(25, 1.2),
        citraPenuh,
        { rasio: 1.0 },
        false
      );
      const durasiUnduh12MP = performance.now() - tAwalUnduh;

      const hitungStat = (arr) => {
        const s = [...arr].sort((a, b) => a - b);
        const med = s[Math.floor(s.length / 2)];
        const p95 = s[Math.floor(s.length * 0.95)];
        return {
          median: parseFloat(med.toFixed(2)),
          p95: parseFloat(p95.toFixed(2)),
        };
      };

      return {
        previewWorstCase: hitungStat(durasiWorstCasePreview),
        previewCacheHit: hitungStat(durasiCachePreview),
        durasiUnduh12MPMs: parseFloat(durasiUnduh12MP.toFixed(2)),
        lebarHasilPenuh: resPenuh.hasil.width,
        tinggiHasilPenuh: resPenuh.hasil.height,
      };
    });

    expect(hasilWorker.lebarHasilPenuh).toBe(4000);
    expect(hasilWorker.tinggiHasilPenuh).toBe(3000);
    expect(hasilWorker.previewCacheHit.median).toBeLessThan(
      hasilWorker.previewWorstCase.median
    );

    // 2. Pasang PerformanceObserver longtask di UI saat slider digeser interaktif
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

    // Muat citra contoh di UI
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByRole('slider')).toBeVisible();

    // Tambah 3 langkah ke pipeline
    await page
      .getByTestId('tombol-tambah-operasi-dasar_kecerahan')
      .click();
    await page.getByTestId('tombol-tambah-operasi-dasar_kontras').click();
    await page
      .getByTestId('tombol-tambah-operasi-warna_saturasi')
      .click();

    // Geser slider saturasi bolak-balik 30 kali
    const sliderSaturasi = page.locator('#param-saturasi');
    for (let i = 0; i < 30; i++) {
      const val = (i % 20) - 10;
      await sliderSaturasi.fill(val.toString());
      await sliderSaturasi.dispatchEvent('input');
    }
    await sliderSaturasi.dispatchEvent('pointerup');

    // Tunggu jeda idle render
    await page.waitForTimeout(300);

    const dataLongtask = await page.evaluate(() => window.__longtasks);
    const longtaskCount = dataLongtask.length;
    const longtaskMaksMs =
      longtaskCount > 0
        ? Math.max(...dataLongtask.map((t) => t.duration))
        : 0;

    const dataHasil = {
      ...hasilWorker,
      uiLongtasksCount: longtaskCount,
      uiLongtaskMaksMs: parseFloat(longtaskMaksMs.toFixed(2)),
    };

    console.log(
      'BENCHMARK_PIPELINE_HASIL:',
      JSON.stringify(dataHasil, null, 2)
    );

    fs.writeFileSync(
      path.resolve('tangkapan-layar/benchmark-pipeline-tahap3.json'),
      JSON.stringify(dataHasil, null, 2)
    );
  });

  test('Tangkapan Layar QA Visual Tahap 3 (1280px & 1920px, ID & EN)', async ({
    page,
  }) => {
    // A. Bahasa Indonesia
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('piclab_bahasa', 'id'));
    await page.reload();

    // Buka gambar contoh
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByRole('slider')).toBeVisible();

    // Tambah beberapa langkah pipeline
    await page
      .getByTestId('tombol-tambah-operasi-dasar_kecerahan')
      .click();
    await page.getByTestId('tombol-tambah-operasi-dasar_kontras').click();
    await page
      .getByTestId('tombol-tambah-operasi-warna_saturasi')
      .click();

    // Buka accordion riwayat perubahan
    await page.getByRole('button', { name: /Riwayat Perubahan/i }).click();
    await expect(page.locator('button:has-text("#1")')).toBeVisible();

    // Tangkapan layar 1280x800 ID
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({
      path: 'tangkapan-layar/tahap3-1280px-id.png',
      fullPage: true,
    });

    // Tangkapan layar 1920x1080 ID
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: 'tangkapan-layar/tahap3-1920px-id.png',
      fullPage: true,
    });

    // B. Bahasa Inggris
    const tombolBahasa = page.getByRole('button', { name: 'EN', exact: true });
    await tombolBahasa.click();
    await page.waitForTimeout(200);

    // Tangkapan layar 1280x800 EN
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({
      path: 'tangkapan-layar/tahap3-1280px-en.png',
      fullPage: true,
    });

    // Tangkapan layar 1920x1080 EN
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: 'tangkapan-layar/tahap3-1920px-en.png',
      fullPage: true,
    });

    expect(fs.existsSync('tangkapan-layar/tahap3-1280px-id.png')).toBe(true);
    expect(fs.existsSync('tangkapan-layar/tahap3-1920px-id.png')).toBe(true);
    expect(fs.existsSync('tangkapan-layar/tahap3-1280px-en.png')).toBe(true);
    expect(fs.existsSync('tangkapan-layar/tahap3-1920px-en.png')).toBe(true);
  });
});
