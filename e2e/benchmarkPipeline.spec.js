import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';

test.describe('PicLab Sevenz — Benchmark Pipeline 5 Langkah & Tangkapan Layar Tahap 3', () => {
  test('Benchmark Pipeline: Latensi Prefix Cache vs Worst-Case, Longtasks, & Unduh 12 MP', async ({
    page,
  }) => {
    test.setTimeout(300000); // 5 menit

    await page.goto('/');

    // 1. Eksekusi benchmark pipeline 5 langkah di Web Worker secara terisolasi
    // Mengukur komputasi murni di Web Worker pada preview 1024x768 dan citra 12 MP (4000x3000)
    const hasilWorker = await page.evaluate(async () => {
      const { jalankanPipeline } = await import(
        '/src/pekerja/pengelolaPekerja.js'
      );

      // Buat citra 12 MP sintetis (4000x3000) dengan gradien warna nyata
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

      // Buat citra preview 1024x768 dari citra 12 MP
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

      // Pipeline 5 langkah terdaftar:
      // Langkah 0: dasar_kecerahan
      // Langkah 1: dasar_kontras
      // Langkah 2: warna_saturasi
      // Langkah 3: dasar_negatif
      // Langkah 4: warna_balance
      const buatPipeline5 = (valLangkah0 = 20, valLangkah4Merah = 15) => [
        {
          id: 'kecerahan-0',
          idOperasi: 'dasar_kecerahan',
          aktif: true,
          parameter: { kecerahan: valLangkah0 },
        },
        {
          id: 'kontras-1',
          idOperasi: 'dasar_kontras',
          aktif: true,
          parameter: { kontras: 25 },
        },
        {
          id: 'saturasi-2',
          idOperasi: 'warna_saturasi',
          aktif: true,
          parameter: { saturasi: 15 },
        },
        {
          id: 'negatif-3',
          idOperasi: 'dasar_negatif',
          aktif: true,
          parameter: {},
        },
        {
          id: 'balance-4',
          idOperasi: 'warna_balance',
          aktif: true,
          parameter: { merah: valLangkah4Merah, hijau: 5, biru: -10 },
        },
      ];

      // Pemanasan Web Worker (Warm-up)
      await jalankanPipeline(
        buatPipeline5(20, 15),
        citraPreview,
        { rasio: 1.0 },
        true
      );

      // (A) Konfigurasi 1: Worst-Case (Langkah 0 diubah -> cache prefix panjang 0 -> semua 5 langkah dihitung ulang)
      // Pengulangan: 30 kali
      const durasiWorstCaseWorker = [];
      for (let i = 0; i < 30; i++) {
        const p = buatPipeline5(10 + (i % 20), 15);
        const t0 = performance.now();
        await jalankanPipeline(p, citraPreview, { rasio: 1.0 }, true);
        durasiWorstCaseWorker.push(performance.now() - t0);
      }

      // (B) Konfigurasi 2: Cache Hit (Langkah ke-5 diubah -> langkah 0..3 diambil dari cache -> hanya 1 langkah dihitung)
      // Pengulangan: 30 kali
      const durasiCacheHitWorker = [];
      for (let i = 0; i < 30; i++) {
        const valMerah = 5 + (i % 20);
        const p = buatPipeline5(20, valMerah);
        const t0 = performance.now();
        await jalankanPipeline(p, citraPreview, { rasio: 1.0 }, true);
        durasiCacheHitWorker.push(performance.now() - t0);
      }

      // (C) Konfigurasi 3: Unduh Resolusi Penuh 12 MP (4000x3000, eksekusi sekuensial 5 langkah tanpa intermediate cache)
      const tAwalUnduh = performance.now();
      const resPenuh = await jalankanPipeline(
        buatPipeline5(20, 15),
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
        previewWorstCaseWorker: hitungStat(durasiWorstCaseWorker),
        previewCacheHitWorker: hitungStat(durasiCacheHitWorker),
        durasiUnduh12MPMs: parseFloat(durasiUnduh12MP.toFixed(2)),
        lebarHasilPenuh: resPenuh.hasil.width,
        tinggiHasilPenuh: resPenuh.hasil.height,
      };
    });

    expect(hasilWorker.lebarHasilPenuh).toBe(4000);
    expect(hasilWorker.tinggiHasilPenuh).toBe(3000);
    expect(hasilWorker.previewCacheHitWorker.median).toBeLessThan(
      hasilWorker.previewWorstCaseWorker.median
    );

    // 2. Pasang PerformanceObserver untuk longtask & profil latensi ujung-ke-ujung di UI
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

    // Buka gambar contoh di antarmuka pengguna
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByRole('slider')).toBeVisible();

    // Terapkan preset Hitam Putih (2 langkah) + tambah 1 langkah Kecerahan = total 3 langkah pipeline
    await page.getByTestId('tombol-preset-hitam_putih').click();
    await page.getByTestId('tombol-tambah-operasi-dasar_kecerahan').click();

    // Bersihkan catatan profil sebelum pengukuran interaktif slider
    await page.evaluate(() => {
      window.__catatanProfil = [];
    });

    // Geser slider kecerahan interaktif 30 kali untuk mengukur latensi ujung ke ujung & longtasks
    const sliderKecerahan = page.locator('#param-kecerahan');
    for (let i = 0; i < 30; i++) {
      const val = ((i * 3) % 40) - 20;
      await sliderKecerahan.fill(val.toString());
      await sliderKecerahan.dispatchEvent('input');
      await page.waitForTimeout(20);
    }
    await sliderKecerahan.dispatchEvent('pointerup');

    // Tunggu idle render peramban
    await page.waitForTimeout(300);

    const dataProfilUi = await page.evaluate(() => {
      const longtasks = window.__longtasks || [];
      const catatan = window.__catatanProfil || [];

      // Hitung total latensi ujung-ke-ujung per event
      const latensiE2E = catatan.map(
        (c) =>
          c.faseInputKeKirim +
          c.faseKirimKeWorker +
          c.faseKomputasiWorker +
          c.faseTransferBalik +
          c.faseRenderReact
      );

      const hitungStat = (arr) => {
        if (arr.length === 0) return { median: 0, p95: 0 };
        const s = [...arr].sort((a, b) => a - b);
        const med = s[Math.floor(s.length / 2)];
        const p95 = s[Math.floor(s.length * 0.95)];
        return {
          median: parseFloat(med.toFixed(2)),
          p95: parseFloat(p95.toFixed(2)),
        };
      };

      const longtaskMaks =
        longtasks.length > 0 ? Math.max(...longtasks.map((t) => t.duration)) : 0;

      return {
        latensiE2E: hitungStat(latensiE2E),
        jumlahSampelE2E: latensiE2E.length,
        longtaskCount: longtasks.length,
        longtaskMaksMs: parseFloat(longtaskMaks.toFixed(2)),
      };
    });

    const dataHasil = {
      workerPreviewWorstCaseMs: hasilWorker.previewWorstCaseWorker,
      workerPreviewCacheHitMs: hasilWorker.previewCacheHitWorker,
      workerUnduh12MPMs: hasilWorker.durasiUnduh12MPMs,
      uiLatensiUjungKeUjungMs: dataProfilUi.latensiE2E,
      uiLongtasksCount: dataProfilUi.longtaskCount,
      uiLongtaskMaksMs: dataProfilUi.longtaskMaksMs,
    };

    console.log(
      'BENCHMARK_PIPELINE_HASIL_REVISI2:',
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
    // Pastikan folder tangkapan-layar ada
    if (!fs.existsSync('tangkapan-layar')) {
      fs.mkdirSync('tangkapan-layar', { recursive: true });
    }

    // A. Pengujian Bahasa Indonesia
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('piclab_bahasa', 'id'));
    await page.reload();

    // Buka gambar contoh
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByRole('slider')).toBeVisible();

    // Terapkan SATU PRESET (Hitam Putih: 2 langkah) + 1 langkah Kecerahan = total 3 langkah pipeline
    await page.getByTestId('tombol-preset-hitam_putih').click();
    await page
      .getByTestId('tombol-tambah-operasi-dasar_kecerahan')
      .click();

    // Buka akordion riwayat perubahan
    await page.getByRole('button', { name: /Riwayat Perubahan/i }).click();
    await expect(page.locator('button:has-text("#1")')).toBeVisible();

    // Ambil tangkapan layar 1280x800 ID
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({
      path: 'tangkapan-layar/tahap3-1280px-id.png',
      fullPage: true,
    });

    // Ambil tangkapan layar 1920x1080 ID
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: 'tangkapan-layar/tahap3-1920px-id.png',
      fullPage: true,
    });

    // B. Pengujian Bahasa Inggris
    const tombolBahasa = page.getByRole('button', { name: 'EN', exact: true });
    await tombolBahasa.click();
    await page.waitForTimeout(300);

    // Ambil tangkapan layar 1280x800 EN
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({
      path: 'tangkapan-layar/tahap3-1280px-en.png',
      fullPage: true,
    });

    // Ambil tangkapan layar 1920x1080 EN
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
