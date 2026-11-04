import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';

test.describe('PicLab Sevenz — Benchmark Tahap 4: 13 Operasi Baru, Longtasks, & Tangkapan Layar Visual', () => {
  test('Benchmark 13 Operasi Spasial, Latensi E2E, Longtasks, & Screenshot Visual', async ({
    page,
  }) => {
    test.setTimeout(360000); // 6 menit untuk 12 MP komputasi

    await page.goto('/');

    // ========================================================================
    // 1. BENCHMARK WEB WORKER: 13 OPERASI BARU PADA PREVIEW & 12 MP
    // ========================================================================
    console.log('Memulai benchmark Web Worker untuk 13 operasi baru Tahap 4...');

    const hasilWorker = await page.evaluate(async () => {
      const { jalankanOperasi } = await import(
        '/src/pekerja/pengelolaPekerja.js'
      );

      // 1. Buat citra 12 MP sintetis (4000x3000) dengan gradien warna nyata
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

      // 2. Buat citra preview 1024x768 dari citra 12 MP
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

      // Daftar 13 operasi baru Tahap 4 beserta parameter uji representatif
      const operasiUji = [
        { id: 'biner_manual', param: { ambang: 128, inversi: false } },
        { id: 'biner_otsu', param: { inversi: false } },
        { id: 'biner_adaptif', param: { jendela: 15, konstanta: 10, inversi: false } },
        { id: 'halus_mean', param: { radius: 2 } },
        { id: 'halus_gaussian', param: { sigma: 1.5 } },
        { id: 'halus_median', param: { ukuran: 3 } },
        { id: 'tajam_unsharp', param: { sigma: 1.5, jumlah: 1.5, ambang: 0 } },
        { id: 'tajam_kernel', param: { model: '4_tetangga' } },
        {
          id: 'konvolusi_kernel',
          param: {
            ukuran: 3,
            matriks: [0, -1, 0, -1, 5, -1, 0, -1, 0],
            pembagi: 1,
            offset: 0,
          },
        },
        { id: 'tepi_sobel', param: { arah: 'gabungan', penguatan: 1.0, inversi: false } },
        { id: 'tepi_prewitt', param: { arah: 'gabungan', penguatan: 1.0, inversi: false } },
        { id: 'tepi_roberts', param: { arah: 'gabungan', penguatan: 1.0, inversi: false } },
        { id: 'tepi_laplacian', param: { model: '4_tetangga', penguatan: 1.0, inversi: false } },
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
        // (A) Pengukuran pada Preview 1024x768 (30 iterasi)
        const durasiPreview = [];
        for (let i = 0; i < 30; i++) {
          const tAwal = performance.now();
          await jalankanOperasi(op.id, citraPreview, op.param);
          durasiPreview.push(performance.now() - tAwal);
        }

        // (B) Pengukuran pada 12 MP (4000x3000)
        const tAwal12 = performance.now();
        await jalankanOperasi(op.id, citraPenuh, op.param);
        const durasi12MP = performance.now() - tAwal12;

        ringkasan[op.id] = {
          preview: hitungStat(durasiPreview),
          durasi12MPMs: parseFloat(durasi12MP.toFixed(2)),
        };
      }

      return ringkasan;
    });

    console.log('Hasil Benchmark Web Worker Tahap 4:', JSON.stringify(hasilWorker, null, 2));

    // ========================================================================
    // 2. PENGUKURAN LONGTASKS & LATENSI E2E PADA ANTARMUKA PENGGUNA (UI)
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

    // Tambahkan operasi Ambang Manual untuk pengujian slider interaktif
    await page.getByTestId('tombol-tambah-operasi-biner_manual').click();
    const sliderAmbang = page.locator('#param-ambang');
    await expect(sliderAmbang).toBeVisible();

    // Catat latensi E2E interaksi slider 30 kali
    const latensiSlider = [];
    for (let i = 0; i < 30; i++) {
      const val = 100 + (i % 50);
      const tAwal = await page.evaluate((v) => {
        const mark = performance.now();
        window.__tMark = mark;
        return mark;
      }, val);

      await sliderAmbang.fill(val.toString());
      await sliderAmbang.dispatchEvent('input');

      // Tunggu hingga requestAnimationFrame kanvas preview selesai
      const tSelesai = await page.evaluate(async () => {
        return new Promise((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve(performance.now());
            });
          });
        });
      });

      latensiSlider.push(tSelesai - tAwal);
      await page.waitForTimeout(20);
    }

    const hitungStatArray = (arr) => {
      const s = [...arr].sort((a, b) => a - b);
      const med = s[Math.floor(s.length / 2)];
      const p95 = s[Math.floor(s.length * 0.95)];
      return {
        median: parseFloat(med.toFixed(2)),
        p95: parseFloat(p95.toFixed(2)),
      };
    };

    const statE2E = hitungStatArray(latensiSlider);

    // Ambil rekap longtask
    const dataLongtask = await page.evaluate(() => {
      const lt = window.__longtasks || [];
      const durasiMaks = lt.length > 0 ? Math.max(...lt.map((t) => t.duration)) : 0;
      return {
        totalLongtask: lt.length,
        durasiMaksMs: parseFloat(durasiMaks.toFixed(2)),
      };
    });

    console.log('Latensi E2E Slider Ambang:', statE2E);
    console.log('Rekap Longtask:', dataLongtask);

    // ========================================================================
    // 3. TANGKAPAN LAYAR VISUAL SISTEM (1920px & 1280px, ID & EN)
    // ========================================================================
    const dirTangkapan = path.resolve('tangkapan-layar');
    if (!fs.existsSync(dirTangkapan)) {
      fs.mkdirSync(dirTangkapan, { recursive: true });
    }

    // A. Siapkan state: Konvolusi Kernel Kustom 5x5 + Kartu Belajar Terbuka
    await page.getByRole('button', { name: 'Kosongkan Pipeline' }).click();
    await page.getByTestId('tombol-tambah-operasi-konvolusi_kernel').click();

    const editorMatriks = page.getByTestId('editor-matriks-kernel');
    await expect(editorMatriks).toBeVisible();
    await editorMatriks.getByRole('button', { name: '5×5' }).click();

    const kartuBelajar = page.getByTestId('kartu-belajar-operasi');
    await expect(kartuBelajar).toBeVisible();
    const tombolBukaKartu = kartuBelajar.getByRole('button');
    await tombolBukaKartu.click();
    await expect(tombolBukaKartu).toHaveAttribute('aria-expanded', 'true');

    // 1. 1920x1080 Bahasa Indonesia (Matriks 5x5 + Kartu Belajar)
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(dirTangkapan, 'tahap4-1920px-matriks-belajar-id.png'),
      fullPage: true,
    });

    // 2. 1280x800 Bahasa Indonesia (Matriks 5x5 + Kartu Belajar)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(dirTangkapan, 'tahap4-1280px-matriks-belajar-id.png'),
      fullPage: true,
    });

    // 3. Ganti ke Bahasa Inggris
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.waitForTimeout(300);

    // 4. 1920x1080 Bahasa Inggris (Matriks 5x5 + Kartu Belajar)
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(dirTangkapan, 'tahap4-1920px-matriks-belajar-en.png'),
      fullPage: true,
    });

    // 5. 1280x800 Bahasa Inggris (Matriks 5x5 + Kartu Belajar)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(dirTangkapan, 'tahap4-1280px-matriks-belajar-en.png'),
      fullPage: true,
    });

    // B. State: Preset "Siluet Tepi" Aktif
    await page.getByRole('button', { name: 'ID', exact: true }).click(); // Kembali ke ID
    await page.getByRole('button', { name: 'Kosongkan Pipeline' }).click();
    await page.getByTestId('tombol-preset-siluet_tepi').click();
    await page.waitForTimeout(500);

    // 6. 1920x1080 Preset Siluet Tepi
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: path.join(dirTangkapan, 'tahap4-1920px-siluet-tepi.png'),
      fullPage: true,
    });

    // 7. Simpan berkas hasil benchmark ke JSON
    const dataHasilAkhir = {
      tanggalPengujian: new Date().toISOString(),
      lingkungan: {
        browser: 'Chromium (Playwright)',
        os: 'Windows 64-bit',
      },
      benchmarkWorker13Operasi: hasilWorker,
      latensiE2ESlider: statE2E,
      metrikLongtask: dataLongtask,
    };

    fs.writeFileSync(
      path.join(dirTangkapan, 'benchmark-tahap4.json'),
      JSON.stringify(dataHasilAkhir, null, 2)
    );

    console.log('Seluruh benchmark dan tangkapan layar Tahap 4 berhasil disimpan!');
  });
});
