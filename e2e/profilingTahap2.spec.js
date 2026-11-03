import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';

test.describe('P1. Profiling Rinci Latensi Ujung ke Ujung Slider', () => {
  test('P1. Ukur Rincian Setiap Tahap Eksekusi (Kecerahan & Hue pada Foto 4000x3000)', async ({
    page,
  }) => {
    test.setTimeout(120000);

    await page.goto('/');

    // Aktifkan wadah pencatatan profil di window
    await page.evaluate(() => {
      window.__catatanProfil = [];
      window.__terakhirDurasiHistogram = 0;
    });

    // Muat citra besar 4000x3000 (resolusi penuh 12 MP, preview 1024x768)
    const pathUji4000 = path.resolve(
      'frontend/public/contoh/foto-4000x3000.png'
    );
    const inputUnggah = page.locator('#input-citra-unggah');
    await inputUnggah.setInputFiles(pathUji4000);
    await expect(page.getByRole('slider')).toBeVisible();

    async function profilOperasi(idTombol, idParam, nilaiList) {
      await page.getByRole('button', { name: idTombol }).click();
      await page.waitForTimeout(400);

      const rincianList = [];

      for (const val of nilaiList) {
        const metrikIterasi = await page.evaluate(
          async ({ paramId, nilai }) => {
            const inputKontrol =
              document.querySelector(`input[type="range"]#param-${paramId}`) ||
              document.querySelector(`#param-${paramId}`);
            const imgSesudah = document.querySelector(
              'img[alt*="Sesudah"], img[alt*="After"]'
            );

            if (!inputKontrol || !imgSesudah) {
              throw new Error('Elemen tidak ditemukan');
            }

            const urlAwal = imgSesudah.src;
            const tMulaiInput = performance.now();

            const tungguObserver = new Promise((resolve) => {
              let selesai = false;
              const rampungkan = () => {
                if (selesai) return;
                selesai = true;
                imgSesudah.removeEventListener('load', rampungkan);
                obs.disconnect();
                resolve(performance.now() - tMulaiInput);
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
              setTimeout(rampungkan, 4000);
            });

            // Pemicu native setter slider
            const nativeSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              'value'
            ).set;
            nativeSetter.call(inputKontrol, String(nilai));
            inputKontrol.dispatchEvent(new Event('input', { bubbles: true }));
            inputKontrol.dispatchEvent(new Event('change', { bubbles: true }));

            const totalLatensiUji = await tungguObserver;

            // Ambil catatan profil terakhir yang direkam oleh Aplikasi.jsx
            const catatan =
              window.__catatanProfil[window.__catatanProfil.length - 1] || {};

            const tSelesaiTampil = catatan.tSelesaiTampil || tMulaiInput;
            const selisihMekanismeUji = Math.max(
              0,
              tMulaiInput + totalLatensiUji - tSelesaiTampil
            );

            return {
              totalLatensiUji,
              faseInputKeKirim: catatan.faseInputKeKirim || 0,
              faseKirimKeWorker: catatan.faseKirimKeWorker || 0,
              faseKomputasiWorker: catatan.faseKomputasiWorker || 0,
              faseTransferBalik: catatan.faseTransferBalik || 0,
              fasePembuatanTampil: catatan.fasePembuatanTampil || 0,
              faseRenderReact: catatan.faseRenderReact || 0,
              durasiHistogram: catatan.durasiHistogram || 0,
              faseMekanismeUjiDanDecode: selisihMekanismeUji,
            };
          },
          { paramId: idParam, nilai: val }
        );

        rincianList.push(metrikIterasi);
        await page.waitForTimeout(30);
      }

      function hitungStatistik(arr, key) {
        const sorted = arr.map((x) => x[key]).sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        return {
          median: Number(median.toFixed(2)),
          p95: Number(p95.toFixed(2)),
        };
      }

      return {
        total: hitungStatistik(rincianList, 'totalLatensiUji'),
        faseInputKeKirim: hitungStatistik(rincianList, 'faseInputKeKirim'),
        faseKirimKeWorker: hitungStatistik(rincianList, 'faseKirimKeWorker'),
        faseKomputasiWorker: hitungStatistik(rincianList, 'faseKomputasiWorker'),
        faseTransferBalik: hitungStatistik(rincianList, 'faseTransferBalik'),
        fasePembuatanTampil: hitungStatistik(rincianList, 'fasePembuatanTampil'),
        faseRenderReact: hitungStatistik(rincianList, 'faseRenderReact'),
        durasiHistogram: hitungStatistik(rincianList, 'durasiHistogram'),
        faseMekanismeUjiDanDecode: hitungStatistik(
          rincianList,
          'faseMekanismeUjiDanDecode'
        ),
      };
    }

    // Profiling Kecerahan (30 pengulangan)
    const nilaiKecerahan = Array.from({ length: 30 }, (_, i) => -50 + i * 3);
    const profilKecerahan = await profilOperasi(
      /^Kecerahan/,
      'kecerahan',
      nilaiKecerahan
    );

    // Profiling Hue (30 pengulangan)
    const nilaiHue = Array.from({ length: 30 }, (_, i) => -150 + i * 10);
    const profilHue = await profilOperasi(
      /^Pergeseran Hue/,
      'pergeseran',
      nilaiHue
    );

    const hasilProfilingP1 = {
      kecerahan: profilKecerahan,
      hue: profilHue,
    };

    console.log(
      'HASIL PROFILING RINCI P1:',
      JSON.stringify(hasilProfilingP1, null, 2)
    );

    fs.writeFileSync(
      'tangkapan-layar/profiling-p1-rincian.json',
      JSON.stringify(hasilProfilingP1, null, 2)
    );

    expect(profilKecerahan.total.median).toBeGreaterThan(0);
    expect(profilHue.total.median).toBeGreaterThan(0);
  });
});
