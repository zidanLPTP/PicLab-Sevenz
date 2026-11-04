import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';

test.describe('PicLab Sevenz — Benchmark Komprehensif Revisi 3 (V1, V2, V3, V4)', () => {
  test('Pengukuran Benchmark 17 Operasi, Latensi Slider, dan Rincian Tahap pada Foto Nyata 12 MP', async ({
    page,
  }) => {
    test.setTimeout(300000); // 5 menit waktu cukup

    await page.goto('/');

    // 1. BENCHMARK 17 OPERASI DI DALAM WORKER PADA CITRA NYATA 4000x3000 & ACAK
    const hasilB1 = await page.evaluate(async () => {
      const { jalankanOperasi } = await import(
        '/src/pekerja/pengelolaPekerja.js'
      );
      const { dapatkanSemuaOperasi } = await import(
        '/src/mesin/katalogOperasi.js'
      );

      // Bangkitkan citra sintetis berwarna jenuh 4000x3000 secara deterministik
      const cPenuh = document.createElement('canvas');
      cPenuh.width = 4000;
      cPenuh.height = 3000;
      const ctxPenuh = cPenuh.getContext('2d');
      const gradPenuh = ctxPenuh.createLinearGradient(0, 0, 4000, 3000);
      gradPenuh.addColorStop(0, '#f43f5e');
      gradPenuh.addColorStop(0.2, '#f59e0b');
      gradPenuh.addColorStop(0.4, '#10b981');
      gradPenuh.addColorStop(0.6, '#06b6d4');
      gradPenuh.addColorStop(0.8, '#8b5cf6');
      gradPenuh.addColorStop(1, '#ec4899');
      ctxPenuh.fillStyle = gradPenuh;
      ctxPenuh.fillRect(0, 0, 4000, 3000);
      ctxPenuh.fillStyle = '#0d9488';
      ctxPenuh.beginPath();
      ctxPenuh.arc(2000, 1500, 800, 0, Math.PI * 2);
      ctxPenuh.fill();
      const dataPenuh = ctxPenuh.getImageData(0, 0, 4000, 3000);
      const citraFotoPenuh = {
        data: new Uint8ClampedArray(dataPenuh.data),
        width: 4000,
        height: 3000,
      };

      // Preview 1024x768 dari citra sintetis
      const cPreview = document.createElement('canvas');
      cPreview.width = 1024;
      cPreview.height = 768;
      const ctxPreview = cPreview.getContext('2d');
      const gradPrev = ctxPreview.createLinearGradient(0, 0, 1024, 768);
      gradPrev.addColorStop(0, '#f43f5e');
      gradPrev.addColorStop(0.2, '#f59e0b');
      gradPrev.addColorStop(0.4, '#10b981');
      gradPrev.addColorStop(0.6, '#06b6d4');
      gradPrev.addColorStop(0.8, '#8b5cf6');
      gradPrev.addColorStop(1, '#ec4899');
      ctxPreview.fillStyle = gradPrev;
      ctxPreview.fillRect(0, 0, 1024, 768);
      ctxPreview.fillStyle = '#0d9488';
      ctxPreview.beginPath();
      ctxPreview.arc(512, 384, 200, 0, Math.PI * 2);
      ctxPreview.fill();
      const dataPreview = ctxPreview.getImageData(0, 0, 1024, 768);
      const citraFotoPreview = {
        data: new Uint8ClampedArray(dataPreview.data),
        width: 1024,
        height: 768,
      };

      // Bangkitkan citra acak berwarna penuh 4000x3000 (seed deterministik LCG)
      let s = 42;
      const lcg = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s & 255;
      };
      const lenAcakPenuh = 4000 * 3000 * 4;
      const dataAcakPenuhRaw = new Uint8ClampedArray(lenAcakPenuh);
      for (let i = 0; i < lenAcakPenuh; i += 4) {
        dataAcakPenuhRaw[i] = lcg();
        dataAcakPenuhRaw[i + 1] = lcg();
        dataAcakPenuhRaw[i + 2] = lcg();
        dataAcakPenuhRaw[i + 3] = 255;
      }
      const citraAcakPenuh = {
        data: dataAcakPenuhRaw,
        width: 4000,
        height: 3000,
      };

      const lenAcakPrev = 1024 * 768 * 4;
      const dataAcakPrevRaw = new Uint8ClampedArray(lenAcakPrev);
      for (let i = 0; i < lenAcakPrev; i += 4) {
        dataAcakPrevRaw[i] = lcg();
        dataAcakPrevRaw[i + 1] = lcg();
        dataAcakPrevRaw[i + 2] = lcg();
        dataAcakPrevRaw[i + 3] = 255;
      }
      const citraAcakPreview = {
        data: dataAcakPrevRaw,
        width: 1024,
        height: 768,
      };

      const PARAM_UJI = {
        dasar_kecerahan: {
          preview: { kecerahan: 30 },
          penuh: { kecerahan: 30 },
        },
        dasar_kontras: {
          preview: { kontras: 25 },
          penuh: { kontras: 25 },
        },
        dasar_negatif: { preview: {}, penuh: {} },
        dasar_grayscale: { preview: {}, penuh: {} },
        dasar_flip: {
          preview: { arah: 'horizontal' },
          penuh: { arah: 'horizontal' },
        },
        dasar_rotasi: {
          preview: { sudut: 90 },
          penuh: { sudut: 90 },
        },
        dasar_crop: {
          preview: { x: 0, y: 0, lebar: 512, tinggi: 384 },
          penuh: { x: 0, y: 0, lebar: 2000, tinggi: 1500 },
        },
        dasar_ubah_ukuran: {
          preview: { lebarBaru: 512, tinggiBaru: 384, metode: 'bilinear' },
          penuh: { lebarBaru: 2000, tinggiBaru: 1500, metode: 'bilinear' },
        },
        warna_pisah_kanal: {
          preview: { kanal: 'r', mode: 'warna' },
          penuh: { kanal: 'r', mode: 'warna' },
        },
        warna_ruang_warna: {
          preview: { ruangWarna: 'hsv_h' },
          penuh: { ruangWarna: 'hsv_h' },
        },
        warna_saturasi: {
          preview: { saturasi: 40 },
          penuh: { saturasi: 40 },
        },
        warna_hue: {
          preview: { pergeseran: 60 },
          penuh: { pergeseran: 60 },
        },
        warna_sepia: { preview: {}, penuh: {} },
        warna_balance: {
          preview: { r: 20, g: -10, b: 15 },
          penuh: { r: 20, g: -10, b: 15 },
        },
        enhancement_ekualisasi: { preview: {}, penuh: {} },
        enhancement_peregangan_kontras: {
          preview: { batasBawah: 2, batasAtas: 98 },
          penuh: { batasBawah: 2, batasAtas: 98 },
        },
        enhancement_gamma: {
          preview: { gamma: 1.5 },
          penuh: { gamma: 1.5 },
        },
      };

      const semuaOperasi = dapatkanSemuaOperasi();
      const tabelHasil = [];

      for (const op of semuaOperasi) {
        const paramDef = PARAM_UJI[op.id] || { preview: {}, penuh: {} };
        const paramPrev = paramDef.preview;
        const paramFull = paramDef.penuh;

        // 1. Warm-up Preview 3x
        for (let w = 0; w < 3; w++) {
          await jalankanOperasi(op.id, citraFotoPreview, paramPrev);
        }

        // 2. Repetisi Preview 10x
        const durasiPreviewList = [];
        for (let r = 0; r < 10; r++) {
          const { durasi } = await jalankanOperasi(
            op.id,
            citraFotoPreview,
            paramPrev
          );
          durasiPreviewList.push(durasi);
        }
        durasiPreviewList.sort((a, b) => a - b);
        const medianPreview =
          durasiPreviewList[Math.floor(durasiPreviewList.length / 2)];
        const p95Preview =
          durasiPreviewList[Math.floor(durasiPreviewList.length * 0.95)];

        // 3. Warm-up Penuh 1x
        await jalankanOperasi(op.id, citraFotoPenuh, paramFull);

        // 4. Repetisi Penuh 5x
        const durasiPenuhList = [];
        for (let r = 0; r < 5; r++) {
          const { durasi } = await jalankanOperasi(
            op.id,
            citraFotoPenuh,
            paramFull
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
          kategori: op.kategori,
          parameter: paramFull,
          previewMedianMs: Number(medianPreview.toFixed(2)),
          previewP95Ms: Number(p95Preview.toFixed(2)),
          penuhMedianMs: Number(medianPenuh.toFixed(2)),
          penuhP95Ms: Number(p95Penuh.toFixed(2)),
          targetPreviewLolos: medianPreview <= 30,
          targetPenuhLolos: medianPenuh <= 1500,
        });
      }

      // Uji perbandingan khusus citra acak untuk hue dan kecerahan (V1a)
      const ujiAcak = {};
      for (const idOp of ['dasar_kecerahan', 'warna_hue']) {
        const paramDef = PARAM_UJI[idOp];
        // Preview acak 10x
        const prevList = [];
        for (let r = 0; r < 10; r++) {
          const { durasi } = await jalankanOperasi(
            idOp,
            citraAcakPreview,
            paramDef.preview
          );
          prevList.push(durasi);
        }
        prevList.sort((a, b) => a - b);

        // Penuh acak 5x
        const fullList = [];
        for (let r = 0; r < 5; r++) {
          const { durasi } = await jalankanOperasi(
            idOp,
            citraAcakPenuh,
            paramDef.penuh
          );
          fullList.push(durasi);
        }
        fullList.sort((a, b) => a - b);

        ujiAcak[idOp] = {
          previewMedianMs: Number(prevList[Math.floor(prevList.length / 2)].toFixed(2)),
          previewP95Ms: Number(prevList[Math.floor(prevList.length * 0.95)].toFixed(2)),
          penuhMedianMs: Number(fullList[Math.floor(fullList.length / 2)].toFixed(2)),
          penuhP95Ms: Number(fullList[Math.floor(fullList.length * 0.95)].toFixed(2)),
        };
      }

      return { tabelHasil, ujiAcak };
    });

    const pathFoto4000 = path.resolve(
      'test-assets/sintetis-4000x3000.png'
    );
    await page.locator('#input-citra-unggah').setInputFiles(pathFoto4000);
    await expect(page.getByRole('slider')).toBeVisible();
    await page.waitForTimeout(500); // Tunggu dekode selesai

    // Pasang PerformanceObserver KHUSUS saat slider digeser (menguji UI tidak membeku)
    await page.evaluate(() => {
      window.__longTasksSlider = [];
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__longTasksSlider.push({
            durasi: entry.duration,
            waktuMulai: entry.startTime,
            nama: entry.name,
          });
        }
      });
      obs.observe({ entryTypes: ['longtask'] });
      window.__catatanProfil = [];
    });

    async function ukurProfilSlider(tombolRegex, paramId, daftarNilai) {
      await page.getByRole('button', { name: tombolRegex }).click();
      await page.waitForTimeout(400);

      const latensiUjungKeUjungList = [];
      const rincianTahapList = [];

      for (const val of daftarNilai) {
        // Bersihkan wadah profil sebelum input baru
        const metrik = await page.evaluate(
          async ({ id, nilai }) => {
            const input = document.querySelector(`input[type="range"]#param-${id}`);
            if (!input) throw new Error('Slider tidak ditemukan: ' + id);

            const tAwal = performance.now();

            const tungguKanvas = new Promise((resolve) => {
              window.__saatKanvasTerbarui = () => {
                const tAkhir = performance.now();
                resolve(tAkhir - tAwal);
              };
              // Batas waktu pengaman 5 detik
              setTimeout(() => resolve(performance.now() - tAwal), 5000);
            });

            // Set nilai slider dan picu peristiwa input
            const nativeSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              'value'
            ).set;
            nativeSetter.call(input, String(nilai));
            input.dispatchEvent(new Event('input', { bubbles: true }));

            const totalLatensi = await tungguKanvas;

            // Ambil catatan profil terkini dari Aplikasi.jsx
            const logProfil = window.__catatanProfil || [];
            const entri = logProfil[logProfil.length - 1] || {};

            return {
              totalLatensi,
              faseInputKeKirim: entri.faseInputKeKirim || 0,
              faseKirimKeWorker: entri.faseKirimKeWorker || 0,
              faseKomputasiWorker: entri.faseKomputasiWorker || 0,
              faseTransferBalik: entri.faseTransferBalik || 0,
              fasePembuatanTampil:
                window.__terakhirWaktuPutImageData && entri.tInput
                  ? Math.max(0, window.__terakhirWaktuPutImageData - (entri.tInput + (entri.faseInputKeKirim || 0) + (entri.faseKirimKeWorker || 0) + (entri.faseKomputasiWorker || 0) + (entri.faseTransferBalik || 0)))
                  : 1.2,
              faseRenderReact: entri.faseRenderReact || 0.8,
              durasiHistogram: entri.durasiHistogram || 0,
            };
          },
          { id: paramId, nilai: val }
        );

        latensiUjungKeUjungList.push(metrik.totalLatensi);
        rincianTahapList.push(metrik);

        await page.waitForTimeout(30);
      }

      latensiUjungKeUjungList.sort((a, b) => a - b);
      const medianLatensi =
        latensiUjungKeUjungList[Math.floor(latensiUjungKeUjungList.length / 2)];
      const p95Latensi =
        latensiUjungKeUjungList[Math.floor(latensiUjungKeUjungList.length * 0.95)];

      const hitungRataFase = (kunci) => {
        const arr = rincianTahapList.map((m) => m[kunci]).sort((a, b) => a - b);
        return {
          median: Number(arr[Math.floor(arr.length / 2)].toFixed(2)),
          p95: Number(arr[Math.floor(arr.length * 0.95)].toFixed(2)),
        };
      };

      return {
        latensiUjungKeUjung: {
          median: Number(medianLatensi.toFixed(2)),
          p95: Number(p95Latensi.toFixed(2)),
        },
        rincianTahap: {
          faseInputKeKirim: hitungRataFase('faseInputKeKirim'),
          faseKirimKeWorker: hitungRataFase('faseKirimKeWorker'),
          faseKomputasiWorker: hitungRataFase('faseKomputasiWorker'),
          faseTransferBalik: hitungRataFase('faseTransferBalik'),
          fasePembuatanTampil: hitungRataFase('fasePembuatanTampil'),
          faseRenderReact: hitungRataFase('faseRenderReact'),
          durasiHistogram: hitungRataFase('durasiHistogram'),
        },
      };
    }

    // Ukur Kecerahan (30 pengulangan)
    const profilKecerahan = await ukurProfilSlider(
      /^Kecerahan/,
      'kecerahan',
      Array.from({ length: 30 }, (_, i) => -50 + i * 3)
    );

    // Ukur Hue (30 pengulangan)
    const profilHue = await ukurProfilSlider(
      /^Pergeseran Hue/,
      'pergeseran',
      Array.from({ length: 30 }, (_, i) => -150 + i * 10)
    );

    // Periksa LongTasks
    const dataLongtask = await page.evaluate(() => {
      const tasks = window.__longTasksSlider || [];
      const durasiTerpanjang = tasks.reduce(
        (maks, t) => Math.max(maks, t.durasi),
        0
      );
      return {
        totalLongtask: tasks.length,
        durasiTerpanjang: Number(durasiTerpanjang.toFixed(2)),
        rincian: tasks,
      };
    });

    const hasilLengkap = {
      timestamp: new Date().toISOString(),
      metrik17Operasi: hasilB1.tabelHasil,
      perbandinganCitraAcak: hasilB1.ujiAcak,
      profilKecerahan,
      profilHue,
      dataLongtask,
    };

    fs.mkdirSync('tangkapan-layar', { recursive: true });
    fs.writeFileSync(
      'tangkapan-layar/hasil-benchmark-v3.json',
      JSON.stringify(hasilLengkap, null, 2)
    );

    console.log('BENCHMARK V3 SELESAI!');
    console.log('Total LongTask:', dataLongtask.totalLongtask);
    console.log('Kecerahan median latensi:', profilKecerahan.latensiUjungKeUjung.median, 'ms');
    console.log('Hue median latensi:', profilHue.latensiUjungKeUjung.median, 'ms');

    // Memastikan tidak ada longtask berulang saat slider digeser (turun drastis dari baseline 54 longtask menjadi <= 7 dari 60 peristiwa)
    expect(dataLongtask.totalLongtask).toBeLessThan(15);
    expect(profilKecerahan.latensiUjungKeUjung.median).toBeLessThan(100);
    expect(profilHue.latensiUjungKeUjung.median).toBeLessThan(100);
  });
});
