import { expect, test } from '@playwright/test';

test.describe('J1: Verifikasi Gating Antrean Worker (Latest-Wins) & UI Bebas Macet', () => {
  test('A. Pengujian Langsung Gating: 30 Permintaan Beruntun Menghasilkan <= 3 Komputasi di Worker', async ({
    page,
  }) => {
    await page.goto('/');

    const hasilUjiGating = await page.evaluate(async () => {
      const {
        jalankanPipeline,
        resetStatistikPekerja,
        statistikPekerja,
      } = await import('/src/pekerja/pengelolaPekerja.js');

      resetStatistikPekerja();

      // Buat citra sintetis preview 400x300
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 300;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(0, 0, 400, 300);
      const imgData = ctx.getImageData(0, 0, 400, 300);
      const citra = {
        data: new Uint8ClampedArray(imgData.data),
        width: 400,
        height: 300,
      };

      // Luncurkan 30 permintaan pipeline serentak (mensimulasikan geseran slider cepat)
      const janjiPermintaan = [];
      for (let i = 1; i <= 30; i++) {
        const langkah = [
          {
            id: 'langkah-1',
            idOperasi: 'halus_gaussian',
            parameter: { sigma: 1.0 + i * 0.1 },
            aktif: true,
          },
        ];
        janjiPermintaan.push(jalankanPipeline(langkah, citra, { rasio: 1.0 }, true));
      }

      const hasilSemua = await Promise.all(janjiPermintaan);

      // Verifikasi: permintaan terakhir (indeks 29) WAJIB bukan usang dan memiliki hasil
      const hasilTerakhir = hasilSemua[29];

      // Hitung jumlah respons yang berstatus usang
      const totalResponsUsang = hasilSemua.filter((h) => h.usang === true).length;

      return {
        statistik: { ...statistikPekerja },
        hasilTerakhirValid:
          Boolean(hasilTerakhir.hasil) &&
          hasilTerakhir.usang === false &&
          hasilTerakhir.hasil.data.length === 400 * 300 * 4,
        totalResponsUsang,
      };
    });

    console.log('Hasil Uji Gating 30 Permintaan:', hasilUjiGating);

    // Verifikasi kriteria J1 a & J1 d:
    // (i) Tepat 30 permintaan masuk ke pengelola worker
    expect(hasilUjiGating.statistik.totalPermintaanMasuk).toBe(30);

    // (ii) Komputasi worker yang dijalankan JAUH lebih kecil dari 30 (maksimal 3 komputasi!)
    expect(hasilUjiGating.statistik.totalKomputasiWorkerMulai).toBeLessThanOrEqual(3);

    // (iii) Sebagian besar permintaan (>= 27) berhasil dilewati / dibuang
    expect(hasilUjiGating.totalResponsUsang).toBeGreaterThanOrEqual(27);

    // (iv) Permintaan terakhir WAJIB sukses terhitung dan menghasilkan citra valid
    expect(hasilUjiGating.hasilTerakhirValid).toBe(true);
  });

  test('B. Interaksi Slider UI: Gerakan Slider Cepat Tidak Membekukan UI & Nilai Akhir Selalu Tampil', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Muat gambar contoh
    await page.getByRole('button', { name: 'Gunakan Gambar Contoh' }).click();
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible();

    // 2. Tambahkan operasi tajam_unsharp
    await page.getByTestId('tombol-tambah-operasi-tajam_unsharp').click();
    const slider = page.locator('#param-sigma');
    await expect(slider).toBeVisible();

    // 3. Tunggu operasi awal selesai, lalu reset statistik worker
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      if (window.__statistikPekerja) {
        window.__statistikPekerja.totalPermintaanMasuk = 0;
        window.__statistikPekerja.totalPermintaanDilewati = 0;
        window.__statistikPekerja.totalKomputasiWorkerMulai = 0;
        window.__statistikPekerja.totalKomputasiWorkerSelesai = 0;
        window.__statistikPekerja.totalHasilUsangDibuang = 0;
      }
    });

    // 4. Fokus slider dan tekan tombol ArrowRight 15 kali cepat
    await slider.focus();
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('ArrowRight');
    }

    // Tunggu render kanvas selesai
    await page.waitForTimeout(500);

    // 5. Periksa statistik worker di UI
    const stats = await page.evaluate(() => window.__statistikPekerja);
    console.log('Statistik Worker Setelah Keyboard Slider Cepat:', stats);

    // Jumlah komputasi yang dijalankan worker jauh lebih kecil dari jumlah event input
    expect(stats.totalKomputasiWorkerMulai).toBeLessThan(stats.totalPermintaanMasuk);
    expect(stats.totalKomputasiWorkerSelesai).toBe(stats.totalKomputasiWorkerMulai);

    // Nilai akhir tetap stabil dan tidak tertimpa hasil usang
    const nilaiAkhir = await slider.inputValue();
    await page.waitForTimeout(400);
    expect(await slider.inputValue()).toBe(nilaiAkhir);
  });
});
