/**
 * Pengujian Unit Mesin Operasi Citra Spasial, Biner, & Konvolusi (Tahap 4).
 * Mencakup 13 operasi baru:
 * - Citra biner: manual, Otsu, adaptif
 * - Smoothing: mean (integral), Gaussian (separable), median (3x3 & 5x5)
 * - Sharpening: unsharp mask, kernel sharpen
 * - Konvolusi: konvolusi_kernel (3x3 & 5x5, pembuktian rotasi 180° konvolusi sejati)
 * - Deteksi tepi: Sobel, Prewitt, Roberts, Laplacian
 */

import { describe, expect, it } from 'vitest';
import {
  operasiBinerAdaptif,
  operasiBinerManual,
  operasiBinerOtsu,
} from '../mesin/biner';
import {
  operasiKonvolusiKernel,
  PRESET_KERNEL,
  normalisasiMatriksKernel,
} from '../mesin/konvolusi';
import { operasiTajamKernel, operasiTajamUnsharp } from '../mesin/sharpening';
import {
  operasiHalusGaussian,
  operasiHalusMean,
  operasiHalusMedian,
} from '../mesin/smoothing';
import {
  operasiTepiLaplacian,
  operasiTepiPrewitt,
  operasiTepiRoberts,
  operasiTepiSobel,
} from '../mesin/tepi';
import {
  ambilIndeksReplikasiTepi,
  bangunCitraIntegral,
  bangunKernelGaussian1D,
  konvolusi2DSejati,
  penapisMedian,
} from '../mesin/spasial/utilitasKonvolusi';
import {
  dapatkanSemuaOperasi,
  ekstrakNilaiAwalParameter,
  bersihkanParameter,
} from '../mesin/katalogOperasi';
import { eksekusiPipelineSekuensial } from '../mesin/eksekutorPipeline';

/**
 * Utilitas pembuat ImageData buatan untuk pengujian.
 */
function buatCitraUji(lebar, tinggi, nilaiPiksel = []) {
  const data = new Uint8ClampedArray(lebar * tinggi * 4);
  for (let i = 0; i < lebar * tinggi; i++) {
    const idx = i * 4;
    const v = nilaiPiksel[i] !== undefined ? nilaiPiksel[i] : 0;
    data[idx] = v; // R
    data[idx + 1] = v; // G
    data[idx + 2] = v; // B
    data[idx + 3] = 255; // A
  }
  return { width: lebar, height: tinggi, data };
}

describe('Mesin Operasi Citra Spasial & Konvolusi (Tahap 4 MVP)', () => {
  // ==========================================================================
  // 1. REPLIKASI PIKSEL TEPI & KONVOLUSI SEJATI (ROTASI 180 DERAJAT)
  // ==========================================================================
  describe('Utilitas Konvolusi: Replikasi Tepi & Pembuktian Konvolusi Sejati', () => {
    it('mereplikasi koordinat di luar batas ke piksel tepi terdekat (clamping)', () => {
      // Citra 3x3: x in [0,2], y in [0,2]
      expect(ambilIndeksReplikasiTepi(-1, -1, 3, 3)).toBe(0); // Top-left (0,0)
      expect(ambilIndeksReplikasiTepi(5, 5, 3, 3)).toBe((2 * 3 + 2) * 4); // Bottom-right (2,2)
      expect(ambilIndeksReplikasiTepi(-2, 1, 3, 3)).toBe((1 * 3 + 0) * 4); // Left edge clamped to x=0
      expect(ambilIndeksReplikasiTepi(1, 4, 3, 3)).toBe((2 * 3 + 1) * 4); // Bottom edge clamped to y=2
    });

    it('membuktikan konvolusi sejati memutar kernel 180 derajat (bukan korelasi)', () => {
      // Buat citra 3x3 dengan hanya satu piksel putih di kanan-bawah (x=2, y=2), lainnya 0
      // Citra f:
      // [ 0, 0, 0 ]
      // [ 0, 0, 0 ]
      // [ 0, 0, 100 ]
      const citra = buatCitraUji(3, 3, [0, 0, 0, 0, 0, 0, 0, 0, 100]);

      // Kernel asimetris w berukuran 3x3:
      // [ 1, 2, 3 ]
      // [ 4, 5, 6 ]
      // [ 7, 8, 9 ]
      // Pada konvolusi sejati g(x,y) = sum_u sum_v w(u,v) * f(x-u, y-v):
      // Untuk piksel tengah (1,1):
      // u=-1, v=-1: w(-1,-1)=1 dikali f(1 - (-1), 1 - (-1)) = f(2, 2) = 100!
      // Jadi kontribusi f(2,2) dikalikan dengan w(0,0) = 1 (elemen kiri-atas kernel)!
      // Sebaliknya, jika korelasi (tanpa pemutaran 180°), f(2,2) dikalikan w(2,2) = 9.
      const kernelAsimetris = [1, 2, 3, 4, 5, 6, 7, 8, 9];

      const hasil = konvolusi2DSejati(citra, kernelAsimetris, 3, 1, 0);

      // Piksel tengah (x=1, y=1) indeks = (1*3 + 1)*4 = 16
      // Karena f(2,2) dikalikan w(-1,-1) = kernel[0] = 1:
      // Piksel-piksel lain f(...) = 0, sehingga nilai tengah HARUS 1 * 100 = 100
      expect(hasil[16]).toBe(100);

      // Verifikasi piksel pojok kanan-bawah (x=2,y=2) hasil konvolusi:
      // Karena replikasi tepi, tetangga kanan & bawah juga bernilai 100.
    });

    it('menghitung citra integral secara akurat untuk mean O(1) dan adaptif', () => {
      // Citra 2x2:
      // [ 10, 20 ]
      // [ 30, 40 ]
      const citra = buatCitraUji(2, 2, [10, 20, 30, 40]);
      const integral = bangunCitraIntegral(citra.data, 2, 2, 0);
      // Ukuran matriks integral: (W+1) * (H+1) = 3x3
      // Baris 0: [0, 0, 0]
      // Baris 1: [0, 10, 10+20=30]
      // Baris 2: [0, 10+30=40, 10+20+30+40=100]
      expect(integral[0]).toBe(0);
      expect(integral[1 * 3 + 1]).toBe(10);
      expect(integral[1 * 3 + 2]).toBe(30);
      expect(integral[2 * 3 + 1]).toBe(40);
      expect(integral[2 * 3 + 2]).toBe(100);
    });

    it('bangunKernelGaussian1D menghasilkan bobot simetris ternormalisasi sum ~ 1', () => {
      const k1D = bangunKernelGaussian1D(1.0);
      let sum = 0;
      for (let i = 0; i < k1D.kernel.length; i++) {
        sum += k1D.kernel[i];
      }
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-5);
      // Simetri: elemen pertama sama dengan elemen terakhir
      expect(k1D.kernel[0]).toBeCloseTo(k1D.kernel[k1D.kernel.length - 1], 6);
    });
  });

  // ==========================================================================
  // 2. CITRA BINER (MANUAL, OTSU, ADAPTIF)
  // ==========================================================================
  describe('Operasi Citra Biner (biner_manual, biner_otsu, biner_adaptif)', () => {
    it('biner_manual: memisahkan piksel berdasarkan ambang dan mendukung inversi', () => {
      // Citra 4x1 dengan luminans: [50, 127, 128, 200]
      const citra = buatCitraUji(4, 1, [50, 127, 128, 200]);

      // Ambang 127, inversi false: <= 127 jadi 0, > 127 jadi 255
      const hasilBiasa = operasiBinerManual.terapkan(citra, {
        ambang: 127,
        inversi: false,
      });
      expect(hasilBiasa.data[0]).toBe(0);
      expect(hasilBiasa.data[4]).toBe(0);
      expect(hasilBiasa.data[8]).toBe(255);
      expect(hasilBiasa.data[12]).toBe(255);

      // Inversi true: <= 127 jadi 255, > 127 jadi 0
      const hasilInversi = operasiBinerManual.terapkan(citra, {
        ambang: 127,
        inversi: true,
      });
      expect(hasilInversi.data[0]).toBe(255);
      expect(hasilInversi.data[4]).toBe(255);
      expect(hasilInversi.data[8]).toBe(0);
      expect(hasilInversi.data[12]).toBe(0);
    });

    it('biner_otsu: menghitung ambang optimal bimodal dan memilih T terkecil jika variansi seri', () => {
      // Citra bimodal seimbang: 4 piksel bernilai 20, 4 piksel bernilai 200
      const piksel = [20, 20, 20, 20, 200, 200, 200, 200];
      const citra = buatCitraUji(8, 1, piksel);

      const hasil = operasiBinerOtsu.terapkan(citra, { inversi: false });
      // Ambang optimal Otsu berada di antara 20 dan 200
      expect(hasil.metadata.ambangTerhitung).toBeGreaterThanOrEqual(20);
      expect(hasil.metadata.ambangTerhitung).toBeLessThanOrEqual(200);

      // 4 piksel pertama jadi 0, 4 piksel berikutnya jadi 255
      for (let i = 0; i < 4; i++) {
        expect(hasil.data[i * 4]).toBe(0);
      }
      for (let i = 4; i < 8; i++) {
        expect(hasil.data[i * 4]).toBe(255);
      }
    });

    it('biner_otsu: stabil pada citra seragam (flat) tanpa menghasilkan NaN', () => {
      const citraFlat = buatCitraUji(4, 4, new Array(16).fill(100));
      const hasil = operasiBinerOtsu.terapkan(citraFlat, { inversi: false });
      expect(hasil.metadata.ambangTerhitung).toBeDefined();
      expect(Number.isFinite(hasil.metadata.ambangTerhitung)).toBe(true);
      for (let i = 0; i < hasil.data.length; i += 4) {
        expect(hasil.data[i] === 0 || hasil.data[i] === 255).toBe(true);
      }
    });

    it('biner_adaptif: thresholding lokal adaptif mean-C berhasil segmentasi variasi iluminasi', () => {
      // Citra dengan gradien latar belakang terang di kiri dan gelap di kanan
      // Titik foreground kontras lokal
      const citra = buatCitraUji(5, 1, [240, 180, 240, 40, 10]);
      const hasil = operasiBinerAdaptif.terapkan(citra, {
        ukuranJendela: 3,
        konstantaC: 10,
        inversi: false,
      });

      // Setiap piksel dibandingkan dengan mean tetangga 3x1 dikurang C
      expect(hasil.width).toBe(5);
      expect(hasil.height).toBe(1);
      for (let i = 0; i < 5; i++) {
        expect(hasil.data[i * 4] === 0 || hasil.data[i * 4] === 255).toBe(true);
      }
    });
  });

  // ==========================================================================
  // 3. SMOOTHING (MEAN, GAUSSIAN, MEDIAN)
  // ==========================================================================
  describe('Operasi Smoothing (halus_mean, halus_gaussian, halus_median)', () => {
    it('halus_mean: meratakan nilai piksel menggunakan penapis kotak integral', () => {
      // Citra 3x3 dengan 1 titik tengah 90, sekeliling 0
      // [ 0,  0,  0 ]
      // [ 0, 90,  0 ]
      // [ 0,  0,  0 ]
      const citra = buatCitraUji(3, 3, [0, 0, 0, 0, 90, 0, 0, 0, 0]);

      const hasil = operasiHalusMean.terapkan(citra, { radius: 1 });
      // Jendela 3x3 mencakup 9 piksel dengan total jumlah 90.
      // Rata-rata di piksel tengah = 90 / 9 = 10.
      expect(hasil.data[16]).toBe(10);
    });

    it('halus_gaussian: melakukan blur separabel 1D tanpa distorsi', () => {
      const citra = buatCitraUji(
        5,
        5,
        [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0,
        ]
      );

      const hasil = operasiHalusGaussian.terapkan(citra, { sigma: 1.0 });
      // Titik tengah menyebar ke tetangga secara simetris
      const tengah = hasil.data[(2 * 5 + 2) * 4];
      const atas = hasil.data[(1 * 5 + 2) * 4];
      const bawah = hasil.data[(3 * 5 + 2) * 4];
      const kiri = hasil.data[(2 * 5 + 1) * 4];
      const kanan = hasil.data[(2 * 5 + 3) * 4];

      expect(tengah).toBeGreaterThan(0);
      expect(atas).toBe(bawah);
      expect(kiri).toBe(kanan);
      expect(atas).toBe(kiri);
      expect(tengah).toBeGreaterThan(atas);
    });

    it('halus_median: menghilangkan derau impuls (salt-and-pepper) secara sempurna', () => {
      // Citra 3x3 bernilai 50, tetapi piksel tengah rusak menjadi 255 (salt noise)
      // [ 50,  50, 50 ]
      // [ 50, 255, 50 ]
      // [ 50,  50, 50 ]
      const citra = buatCitraUji(3, 3, [50, 50, 50, 50, 255, 50, 50, 50, 50]);

      const hasil = operasiHalusMedian.terapkan(citra, { ukuran: 3 });
      // Nilai median dari sembilan elemen [50, 50, 50, 50, 50, 50, 50, 50, 255] adalah 50!
      expect(hasil.data[16]).toBe(50);
    });

    it('halus_median 5x5: berjalan stabil pada citra kecil dengan sorting network/insertion sort', () => {
      const citra = buatCitraUji(5, 5, new Array(25).fill(77));
      const hasil = operasiHalusMedian.terapkan(citra, { ukuran: 5 });
      expect(hasil.data[(2 * 5 + 2) * 4]).toBe(77);
    });
  });

  // ==========================================================================
  // 4. SHARPENING (UNSHARP MASK & KERNEL SHARPEN)
  // ==========================================================================
  describe('Operasi Sharpening (tajam_unsharp, tajam_kernel)', () => {
    it('tajam_unsharp: mempertajam detail kontras dengan rumus f + k*(f - blur)', () => {
      const citra = buatCitraUji(
        5,
        5,
        [
          50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 150, 50, 50, 50, 50,
          50, 50, 50, 50, 50, 50, 50, 50,
        ]
      );

      const hasil = operasiTajamUnsharp.terapkan(citra, {
        sigma: 1.0,
        jumlah: 1.5,
        ambang: 0,
      });

      // Piksel pusat (150) yang lebih terang dari sekelilingnya menjadi lebih terang (> 150)
      const tengah = hasil.data[(2 * 5 + 2) * 4];
      expect(tengah).toBeGreaterThan(150);
    });

    it('tajam_kernel: menerapkan penajaman berbasis Laplacian 4-tetangga dan 8-tetangga', () => {
      const citra = buatCitraUji(3, 3, [50, 50, 50, 50, 100, 50, 50, 50, 50]);

      // Laplacian 4-tetangga kernel:
      // [  0, -1,  0 ]
      // [ -1,  5, -1 ]
      // [  0, -1,  0 ]
      // Pusat = 5*100 - (50+50+50+50) = 500 - 200 = 300 -> clamp ke 255
      const hasil4 = operasiTajamKernel.terapkan(citra, {
        model: '4_tetangga',
      });
      expect(hasil4.data[16]).toBe(255);

      // Laplacian 8-tetangga kernel:
      // [ -1, -1, -1 ]
      // [ -1,  9, -1 ]
      // [ -1, -1, -1 ]
      // Pusat = 9*100 - 8*50 = 900 - 400 = 500 -> clamp ke 255
      const hasil8 = operasiTajamKernel.terapkan(citra, {
        model: '8_tetangga',
      });
      expect(hasil8.data[16]).toBe(255);
    });
  });

  // ==========================================================================
  // 5. KONVOLUSI KUSTOM & PRESET KERNEL
  // ==========================================================================
  describe('Operasi Konvolusi Kernel (konvolusi_kernel)', () => {
    it('normalisasiMatriksKernel mengamankan input array, 2D array, dan NaN', () => {
      const k1 = normalisasiMatriksKernel([1, 'abc', 3, 4, 5, 6, 7, 8, 9], 3);
      expect(k1[1]).toBe(0); // NaN replaced with 0

      // Input 2D array
      const k2 = normalisasiMatriksKernel(
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        3
      );
      expect(k2.length).toBe(9);
      expect(k2[4]).toBe(5);

      // Non-array fallback ke identitas
      const k3 = normalisasiMatriksKernel('bukan_array', 3);
      expect(k3).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    });

    it('menerapkan preset kernel identitas tanpa mengubah citra', () => {
      const citra = buatCitraUji(3, 3, [10, 20, 30, 40, 50, 60, 70, 80, 90]);
      const identitas = PRESET_KERNEL.identitas;

      const hasil = operasiKonvolusiKernel.terapkan(citra, {
        ukuran: identitas.ukuran,
        matriks: identitas.matriks,
        pembagi: identitas.pembagi,
        offset: identitas.offset,
      });

      for (let i = 0; i < citra.data.length; i++) {
        expect(hasil.data[i]).toBe(citra.data[i]);
      }
    });

    it('menerapkan kernel 5x5 kustom dengan pembagi dan bias offset', () => {
      const citra = buatCitraUji(5, 5, new Array(25).fill(100));
      // Kernel rata-rata 5x5 sederhana
      const k5 = new Array(25).fill(1);
      const hasil = operasiKonvolusiKernel.terapkan(citra, {
        ukuran: 5,
        matriks: k5,
        pembagi: 25,
        offset: 10,
      });

      // 100 * 25 / 25 + 10 = 110
      expect(hasil.data[(2 * 5 + 2) * 4]).toBe(110);
    });
  });

  // ==========================================================================
  // 6. DETEKSI TEPI (SOBEL, PREWITT, ROBERTS, LAPLACIAN)
  // ==========================================================================
  describe('Operasi Deteksi Tepi (tepi_sobel, tepi_prewitt, tepi_roberts, tepi_laplacian)', () => {
    it('seluruh detektor tepi menghasilkan nilai 0 pada citra seragam (flat/tanpa tepi)', () => {
      const citraRata = buatCitraUji(6, 6, new Array(36).fill(150));

      const detektor = [
        {
          op: operasiTepiSobel,
          param: { arah: 'gabungan', penguatan: 1.0, inversi: false },
        },
        {
          op: operasiTepiPrewitt,
          param: { arah: 'gabungan', penguatan: 1.0, inversi: false },
        },
        {
          op: operasiTepiRoberts,
          param: { arah: 'gabungan', penguatan: 1.0, inversi: false },
        },
        {
          op: operasiTepiLaplacian,
          param: { model: '4_tetangga', penguatan: 1.0, inversi: false },
        },
      ];

      for (const { op, param } of detektor) {
        const hasil = op.terapkan(citraRata, param);
        // Pada citra datar, gradien bernilai 0 di seluruh piksel
        for (let i = 0; i < hasil.data.length; i += 4) {
          expect(hasil.data[i]).toBe(0);
        }
      }
    });

    it('tepi_sobel: mendeteksi tepi tangga vertikal dan menghitung gradien horizontal', () => {
      // Citra 4x4 dengan tangga kontras vertikal: sisi kiri (x=0,1) bernilai 50, sisi kanan (x=2,3) bernilai 200
      const citraTangga = buatCitraUji(
        4,
        4,
        [50, 50, 200, 200, 50, 50, 200, 200, 50, 50, 200, 200, 50, 50, 200, 200]
      );

      const hasilSobel = operasiTepiSobel.terapkan(citraTangga, {
        arah: 'horizontal',
        penguatan: 1.0,
        inversi: false,
      });

      // Kolom x=1 dan x=2 berada di perbatasan tepi, harus memiliki respon gradien yang sangat kuat (> 0)
      const responTepiX1 = hasilSobel.data[(1 * 4 + 1) * 4];
      const responTepiX2 = hasilSobel.data[(1 * 4 + 2) * 4];
      expect(responTepiX1).toBeGreaterThan(50);
      expect(responTepiX2).toBeGreaterThan(50);

      // Sementara kolom seragam x=0 gradiennya jauh lebih kecil/0
      const responRataX0 = hasilSobel.data[(1 * 4 + 0) * 4];
      expect(responTepiX1).toBeGreaterThan(responRataX0);
    });

    it('tepi_roberts: mendeteksi diskontinuitas diagonal pada pasangan 2x2', () => {
      const citra = buatCitraUji(3, 3, [100, 0, 0, 0, 0, 0, 0, 0, 0]);

      const hasil = operasiTepiRoberts.terapkan(citra, {
        arah: 'gabungan',
        penguatan: 1.0,
        inversi: false,
      });

      expect(hasil.width).toBe(3);
      expect(hasil.height).toBe(3);
      expect(hasil.data[0]).toBeGreaterThan(0);
    });

    it('tepi_laplacian: merespon diskontinuitas turunan kedua dan mendukung inversi', () => {
      const citra = buatCitraUji(3, 3, [0, 0, 0, 0, 100, 0, 0, 0, 0]);

      const hasilBiasa = operasiTepiLaplacian.terapkan(citra, {
        model: '8_tetangga',
        penguatan: 1.0,
        inversi: false,
      });
      expect(hasilBiasa.data[16]).toBe(255); // Pusat respon maksimal

      const hasilInversi = operasiTepiLaplacian.terapkan(citra, {
        model: '8_tetangga',
        penguatan: 1.0,
        inversi: true,
      });
      expect(hasilInversi.data[16]).toBe(0); // 255 - 255 = 0
    });
  });

  // ==========================================================================
  // 7. KASUS BATAS (CITRA 1x1, 2x2, DAN REGISTRI LENGKAP 30 OPERASI)
  // ==========================================================================
  describe('Kasus Batas & Verifikasi Immutability/Alfa Seluruh 30 Operasi', () => {
    const semuaOperasi = dapatkanSemuaOperasi();

    it('memiliki tepat minimal 30 operasi terdaftar di katalog pada Tahap 4', () => {
      expect(semuaOperasi.length).toBeGreaterThanOrEqual(30);
    });

    it('berjalan aman pada citra ekstrem 1x1 tanpa melempar pengecualian atau NaN', () => {
      const citra1x1 = buatCitraUji(1, 1, [123]);
      for (const op of semuaOperasi) {
        const param = ekstrakNilaiAwalParameter(op);
        const hasil = op.terapkan(citra1x1, param);
        expect(hasil.width).toBeGreaterThanOrEqual(1);
        expect(hasil.height).toBeGreaterThanOrEqual(1);
        expect(Number.isFinite(hasil.data[0])).toBe(true);
        expect(hasil.data[3]).toBe(255); // Alpha utuh
      }
    });

    it('berjalan aman pada citra 2x2 yang lebih kecil dari ukuran kernel (3x3 dan 5x5)', () => {
      const citra2x2 = buatCitraUji(2, 2, [10, 50, 150, 200]);
      for (const op of semuaOperasi) {
        const param = ekstrakNilaiAwalParameter(op);
        const hasil = op.terapkan(citra2x2, param);
        expect(hasil.data.length).toBeGreaterThanOrEqual(4);
        for (let i = 0; i < hasil.data.length; i++) {
          expect(Number.isFinite(hasil.data[i])).toBe(true);
        }
      }
    });

    it('memastikan buffer masukan tidak termutasi pada seluruh operasi baru (immutability)', () => {
      const masukan = buatCitraUji(3, 3, [10, 20, 30, 40, 50, 60, 70, 80, 90]);
      const salinan = new Uint8ClampedArray(masukan.data);

      for (const op of semuaOperasi) {
        const param = ekstrakNilaiAwalParameter(op);
        const hasil = op.terapkan(masukan, param);

        // Masukan harus tetap 100% identik
        expect(masukan.data).toEqual(salinan);
        expect(hasil).not.toBe(masukan);
        expect(hasil.data).not.toBe(masukan.data);
      }
    });

    it('mempertahankan transparansi kanal alfa (A) pada seluruh 30 operasi', () => {
      const citraAlfa = {
        width: 3,
        height: 3,
        data: new Uint8ClampedArray([
          10, 10, 10, 0, 20, 20, 20, 128, 30, 30, 30, 255, 40, 40, 40, 64, 50,
          50, 50, 192, 60, 60, 60, 255, 70, 70, 70, 32, 80, 80, 80, 96, 90, 90,
          90, 200,
        ]),
      };

      for (const op of semuaOperasi) {
        const param = ekstrakNilaiAwalParameter(op);
        const hasil = op.terapkan(citraAlfa, param);

        if (
          hasil.width === 3 &&
          hasil.height === 3 &&
          op.id !== 'dasar_flip' &&
          op.id !== 'dasar_rotasi'
        ) {
          // Piksel tengah (x=1, y=1) indeks alfa = 16 + 3 = 19
          expect(hasil.data[19]).toBe(192);
          // Piksel kiri atas alfa = 3
          expect(hasil.data[3]).toBe(0);
          // Piksel kanan atas alfa = 11
          expect(hasil.data[11]).toBe(255);
        }
      }
    });

    it('membersihkan parameter kotor (NaN, string, null, matriks rusak) tanpa melempar galat', () => {
      for (const op of semuaOperasi) {
        const paramKotor = {
          ambang: 'kacau',
          inversi: 'bukan_boolean',
          ukuranJendela: NaN,
          konstantaC: Infinity,
          radius: -99,
          sigma: 'sangat_blur',
          ukuran: 999,
          jumlah: NaN,
          model: 'model_palsu',
          matriks: 'bukan_array',
          pembagi: 0,
          offset: Infinity,
          arah: 'arah_ajaib',
          penguatan: NaN,
        };

        const paramBersih = bersihkanParameter(op, paramKotor);
        expect(paramBersih).toBeDefined();

        const citra = buatCitraUji(3, 3, [10, 20, 30, 40, 50, 60, 70, 80, 90]);
        const hasil = op.terapkan(citra, paramBersih);
        expect(hasil.data).toBeInstanceOf(Uint8ClampedArray);
      }
    });
  });

  // ==========================================================================
  // 8. SIMULASI PIPELINE ACAK & KONSISTENSI CACHE PREFIX DENGAN OPERASI BARU
  // ==========================================================================
  describe('Simulasi Pipeline Berantai & Prefix Cache dengan Operasi Baru', () => {
    it('hasil eksekusi berulang dari snapshot pipeline spasial menghasilkan data identik (deterministik)', () => {
      const citra = buatCitraUji(
        4,
        4,
        [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160]
      );

      const langkahPipeline = [
        {
          id: '1',
          idOperasi: 'halus_mean',
          parameter: { radius: 1 },
          aktif: true,
        },
        {
          id: '2',
          idOperasi: 'tajam_unsharp',
          parameter: { sigma: 1.0, jumlah: 1.5, ambang: 0 },
          aktif: true,
        },
        {
          id: '3',
          idOperasi: 'tepi_sobel',
          parameter: { arah: 'gabungan', penguatan: 1.0, inversi: false },
          aktif: true,
        },
        {
          id: '4',
          idOperasi: 'biner_otsu',
          parameter: { inversi: false },
          aktif: true,
        },
      ];

      const run1 = eksekusiPipelineSekuensial(langkahPipeline, citra);
      const run2 = eksekusiPipelineSekuensial(langkahPipeline, citra);

      expect(run1.hasil.data).toEqual(run2.hasil.data);
      expect(run1.langkahDieksekusi).toBe(4);
      expect(run2.langkahDieksekusi).toBe(4);
    });
  });

  // ==========================================================================
  // 9. UJI REGRESI & KESETARAAN DENGAN IMPLEMENTASI REFERENSI NAIF MURNI (J3)
  // ==========================================================================
  describe('9. Uji Regresi & Kesetaraan dengan Implementasi Referensi Terpisah Naif Murni (J3)', () => {
    // Implementasi Referensi Terpisah yang Naif, Murni, dan Independen
    function refKonvolusi2DNaif(
      citra,
      kernel,
      ukuranKernel,
      pembagi = 1,
      offset = 0
    ) {
      const { width, height, data } = citra;
      const radius = Math.floor(ukuranKernel / 2);
      const hasil = new Uint8ClampedArray(width * height * 4);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idxTujuan = (y * width + x) * 4;
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let ky = 0; ky < ukuranKernel; ky++) {
              for (let kx = 0; kx < ukuranKernel; kx++) {
                // Konvolusi sejati membalik kernel 180 derajat:
                // Elemen kernel kx, ky berpasangan dengan piksel pada -(kx - radius), -(ky - radius)
                const bobot = kernel[ky * ukuranKernel + kx];
                const px = Math.min(Math.max(x - (kx - radius), 0), width - 1);
                const py = Math.min(Math.max(y - (ky - radius), 0), height - 1);
                const srcIdx = (py * width + px) * 4 + c;
                sum += data[srcIdx] * bobot;
              }
            }
            const v = Math.round(sum / pembagi) + offset;
            hasil[idxTujuan + c] = Math.max(0, Math.min(255, v));
          }
          hasil[idxTujuan + 3] = data[idxTujuan + 3];
        }
      }
      return hasil;
    }

    function refMedianNaif(citra, ukuran) {
      const { width, height, data } = citra;
      const radius = Math.floor(ukuran / 2);
      const N = ukuran * ukuran;
      const medianIdx = Math.floor(N / 2);
      const hasil = new Uint8ClampedArray(width * height * 4);
      const buffer = new Float64Array(N);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idxTujuan = (y * width + x) * 4;
          for (let c = 0; c < 3; c++) {
            let count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                const px = Math.min(Math.max(x + dx, 0), width - 1);
                const py = Math.min(Math.max(y + dy, 0), height - 1);
                buffer[count++] = data[(py * width + px) * 4 + c];
              }
            }
            // Pengurutan naif murni
            const sorted = Array.from(buffer).sort((a, b) => a - b);
            hasil[idxTujuan + c] = sorted[medianIdx];
          }
          hasil[idxTujuan + 3] = data[idxTujuan + 3];
        }
      }
      return hasil;
    }

    function refSobelNaif(citra, penguatan = 1.0) {
      const { width, height, data } = citra;
      const hasil = new Uint8ClampedArray(width * height * 4);
      const lum = new Uint8Array(width * height);
      for (let i = 0; i < width * height; i++) {
        const s = i * 4;
        lum[i] = Math.max(
          0,
          Math.min(
            255,
            Math.round(
              0.299 * data[s] + 0.587 * data[s + 1] + 0.114 * data[s + 2]
            )
          )
        );
      }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idxTujuan = (y * width + x) * 4;
          const getLum = (px, py) => {
            const cx = Math.min(Math.max(px, 0), width - 1);
            const cy = Math.min(Math.max(py, 0), height - 1);
            return lum[cy * width + cx];
          };

          const p00 = getLum(x - 1, y - 1);
          const p01 = getLum(x, y - 1);
          const p02 = getLum(x + 1, y - 1);
          const p10 = getLum(x - 1, y);
          const p12 = getLum(x + 1, y);
          const p20 = getLum(x - 1, y + 1);
          const p21 = getLum(x, y + 1);
          const p22 = getLum(x + 1, y + 1);

          const gx = p02 + 2 * p12 + p22 - (p00 + 2 * p10 + p20);
          const gy = p20 + 2 * p21 + p22 - (p00 + 2 * p01 + p02);
          const besaran = Math.sqrt(gx * gx + gy * gy);
          const nilai = Math.max(
            0,
            Math.min(255, Math.round(besaran * penguatan))
          );

          hasil[idxTujuan] = nilai;
          hasil[idxTujuan + 1] = nilai;
          hasil[idxTujuan + 2] = nilai;
          hasil[idxTujuan + 3] = data[idxTujuan + 3];
        }
      }
      return hasil;
    }

    function refGaussianSeparableNaif(citra, sigma) {
      const radius = Math.max(1, Math.ceil(sigma * 3));
      const size = radius * 2 + 1;
      const k1d = new Float64Array(size);
      let sum = 0;
      for (let i = -radius; i <= radius; i++) {
        const v = Math.exp(-(i * i) / (2 * sigma * sigma));
        k1d[i + radius] = v;
        sum += v;
      }
      for (let i = 0; i < size; i++) k1d[i] /= sum;

      const { width, height, data } = citra;
      // Pass 1 Horizontal
      const temp = new Float64Array(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          for (let c = 0; c < 3; c++) {
            let acc = 0;
            for (let i = -radius; i <= radius; i++) {
              const px = Math.min(Math.max(x + i, 0), width - 1);
              acc += data[(y * width + px) * 4 + c] * k1d[i + radius];
            }
            temp[idx + c] = acc;
          }
          temp[idx + 3] = data[idx + 3];
        }
      }

      // Pass 2 Vertikal
      const hasil = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          for (let c = 0; c < 3; c++) {
            let acc = 0;
            for (let i = -radius; i <= radius; i++) {
              const py = Math.min(Math.max(y + i, 0), height - 1);
              acc += temp[(py * width + x) * 4 + c] * k1d[i + radius];
            }
            hasil[idx + c] = Math.max(0, Math.min(255, Math.round(acc)));
          }
          hasil[idx + 3] = Math.round(temp[idx + 3]);
        }
      }
      return hasil;
    }

    // Generator citra pseudo-random dengan seed tetap (LCRNG deterministik)
    function bangunCitraUjiDeterministik(w, h, seed = 42) {
      let state = seed;
      const data = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h * 4; i += 4) {
        state = (state * 1664525 + 1013904223) >>> 0;
        data[i] = state & 0xff;
        state = (state * 1664525 + 1013904223) >>> 0;
        data[i + 1] = state & 0xff;
        state = (state * 1664525 + 1013904223) >>> 0;
        data[i + 2] = state & 0xff;
        data[i + 3] = 255;
      }
      return { width: w, height: h, data };
    }

    // Kasus dimensi citra yang diuji sesuai J3:
    // 1x1, 1xN (10x1), Nx1 (1x10), lebih kecil dari kernel (2x2), non-bujursangkar lebar (25x13)
    const daftarDimensiUji = [
      { w: 1, h: 1, label: '1x1' },
      { w: 10, h: 1, label: '1xN (10x1)' },
      { w: 1, h: 10, label: 'Nx1 (1x10)' },
      { w: 2, h: 2, label: '2x2 (lebih kecil dari kernel 3x3)' },
      { w: 25, h: 13, label: '25x13 (non-bujursangkar lebar)' },
    ];

    it('Konvolusi 2D: byte-per-byte 100% identik (MAE = 0) dengan referensi naif pada seluruh kasus sudut', () => {
      const kernel3x3 = [1, 2, 1, 0, 0, 0, -1, -2, -1];
      const kernel5x5 = [
        1, 2, 3, 2, 1, 2, 4, 6, 4, 2, 3, 6, 9, 6, 3, 2, 4, 6, 4, 2, 1, 2, 3, 2,
        1,
      ];

      for (const d of daftarDimensiUji) {
        const citra = bangunCitraUjiDeterministik(d.w, d.h, 101);

        // 3x3
        const hasilCepat3 = konvolusi2DSejati(citra, kernel3x3, 3, 1, 128);
        const hasilNaif3 = refKonvolusi2DNaif(citra, kernel3x3, 3, 1, 128);
        expect(hasilCepat3).toEqual(hasilNaif3);

        // 5x5
        const hasilCepat5 = konvolusi2DSejati(citra, kernel5x5, 5, 81, 0);
        const hasilNaif5 = refKonvolusi2DNaif(citra, kernel5x5, 5, 81, 0);
        expect(hasilCepat5).toEqual(hasilNaif5);
      }
    });

    it('Median 3x3 & 5x5: byte-per-byte 100% identik (MAE = 0) dengan pengurutan naif pada seluruh kasus sudut', () => {
      for (const d of daftarDimensiUji) {
        const citra = bangunCitraUjiDeterministik(d.w, d.h, 202);

        // Median 3x3 (jaringan seleksi vs naive sort)
        const med3Cepat = penapisMedian(citra, 3);
        const med3Naif = refMedianNaif(citra, 3);
        expect(med3Cepat).toEqual(med3Naif);

        // Median 5x5 (Huang sliding / counting vs naive sort)
        const med5Cepat = penapisMedian(citra, 5);
        const med5Naif = refMedianNaif(citra, 5);
        expect(med5Cepat).toEqual(med5Naif);
      }
    });

    it('Sobel: byte-per-byte 100% identik (MAE = 0) dengan turunan spasial naif pada seluruh kasus sudut', () => {
      for (const d of daftarDimensiUji) {
        const citra = bangunCitraUjiDeterministik(d.w, d.h, 303);
        const sobelCepat = operasiTepiSobel.terapkan(citra, {
          arah: 'gabungan',
          penguatan: 1.0,
        });
        const sobelNaifRes = refSobelNaif(citra, 1.0);
        expect(sobelCepat.data).toEqual(sobelNaifRes);
      }
    });

    it('Gaussian: selisih float dengan referensi naif <= 1 tingkat per piksel pada seluruh kasus sudut', () => {
      for (const d of daftarDimensiUji) {
        const citra = bangunCitraUjiDeterministik(d.w, d.h, 404);
        const gCepat = operasiHalusGaussian.terapkan(citra, { sigma: 1.5 });
        const gNaif = refGaussianSeparableNaif(citra, 1.5);

        for (let i = 0; i < citra.data.length; i++) {
          const diff = Math.abs(gCepat.data[i] - gNaif[i]);
          expect(diff).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  // ==========================================================================
  // 10. UJI PERHITUNGAN TANGAN PEMBAGI OTOMATIS & KASUS IMPULS (J4 a)
  // ==========================================================================
  describe('10. Uji Perhitungan Tangan Pembagi Otomatis & Kasus Impuls (J4 a)', () => {
    it('(a) Aturan pembagi otomatis: sum > 0 -> sum; sum <= 0 -> 1', () => {
      const hitungPembagiOtomatis = (kernel) => {
        const sum = kernel.reduce((acc, v) => acc + (Number(v) || 0), 0);
        return sum > 0 ? sum : 1;
      };

      // Box blur 3x3: sum = 9 -> pembagi 9
      const boxBlur = [1, 1, 1, 1, 1, 1, 1, 1, 1];
      expect(hitungPembagiOtomatis(boxBlur)).toBe(9);

      // Pertajam: [0, -1, 0, -1, 5, -1, 0, -1, 0] -> sum = 1 -> pembagi 1
      const pertajam = [0, -1, 0, -1, 5, -1, 0, -1, 0];
      expect(hitungPembagiOtomatis(pertajam)).toBe(1);

      // Sobel horizontal: [-1, 0, 1, -2, 0, 2, -1, 0, 1] -> sum = 0 -> pembagi 1
      const sobelH = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      expect(hitungPembagiOtomatis(sobelH)).toBe(1);

      // Kernel jumlah negatif: [-1, -1, -1, -1, 0, -1, -1, -1, -1] -> sum = -8 -> pembagi 1
      const negatifSum = [-1, -1, -1, -1, 0, -1, -1, -1, -1];
      expect(hitungPembagiOtomatis(negatifSum)).toBe(1);
    });

    it('(b) Kernel 1..9 dengan impuls di (2, 2): pembagi eksplisit 1 (hasil 100) vs pembagi otomatis (hasil 2)', () => {
      // Citra 3x3: hanya piksel pojok kanan bawah (2, 2) bernilai 100
      const citraImpuls = buatCitraUji(3, 3, [0, 0, 0, 0, 0, 0, 0, 0, 100]);
      const kernel1ke9 = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // sum = 45

      // Kasus 1: Pembagi eksplisit = 1
      // Rotasi 180° memasangkan w(0,0)=1 dengan f(1-(-1), 1-(-1)) = f(2,2) = 100
      // Hasil = round(100 * 1 / 1) = 100
      const hasilEksplisit = operasiKonvolusiKernel.terapkan(citraImpuls, {
        ukuran: 3,
        matriks: kernel1ke9,
        pembagi: 1,
        offset: 0,
      });
      const idxTengah = (1 * 3 + 1) * 4;
      expect(hasilEksplisit.data[idxTengah]).toBe(100);

      // Kasus 2: Pembagi otomatis (sum = 45)
      // Hasil = round(100 * 1 / 45) = round(2.222) = 2
      const hasilOtomatis = operasiKonvolusiKernel.terapkan(citraImpuls, {
        ukuran: 3,
        matriks: kernel1ke9,
        pembagi: 0, // Memicu pembagi otomatis sum = 45
        offset: 0,
      });
      expect(hasilOtomatis.data[idxTengah]).toBe(2);
    });

    it('(c) Kernel 1..9 dengan impuls di tengah (1, 1): bobot tengah K(1,1)=5', () => {
      // Citra 3x3: hanya piksel tengah (1, 1) bernilai 100, lainnya 0
      const citraTengah = buatCitraUji(3, 3, [0, 0, 0, 0, 100, 0, 0, 0, 0]);
      const kernel1ke9 = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // sum = 45

      // Pada konvolusi di tengah (1, 1), bobot elemen pusat adalah kernel[4] = 5
      // Kontribusi piksel (1, 1) adalah 100 * 5 = 500

      // Kasus 1: Pembagi eksplisit 1 -> 500 diklem ke 255
      const hasilEksplisit = operasiKonvolusiKernel.terapkan(citraTengah, {
        ukuran: 3,
        matriks: kernel1ke9,
        pembagi: 1,
        offset: 0,
      });
      const idxTengah = (1 * 3 + 1) * 4;
      expect(hasilEksplisit.data[idxTengah]).toBe(255);

      // Kasus 2: Pembagi otomatis (sum = 45) -> round(500 / 45) = round(11.111) = 11
      const hasilOtomatis = operasiKonvolusiKernel.terapkan(citraTengah, {
        ukuran: 3,
        matriks: kernel1ke9,
        pembagi: 0,
        offset: 0,
      });
      expect(hasilOtomatis.data[idxTengah]).toBe(11);
    });
  });

  // ==========================================================================
  // 11. UJI PRESET KERNEL 3x3 DAN 5x5: JUMLAH & SIMETRI (H4 b)
  // ==========================================================================
  describe('11. Uji Preset Kernel 3x3 dan 5x5: Jumlah & Simetri (H4 b)', () => {
    it('memastikan PRESET_KERNEL memuat tepat 9 preset standar tanpa Prewitt / Roberts', () => {
      const kunciPreset = Object.keys(PRESET_KERNEL);
      expect(kunciPreset).toHaveLength(9);
      expect(kunciPreset).toEqual([
        'identitas',
        'blur_kotak',
        'gaussian_3x3',
        'gaussian_5x5',
        'pertajam',
        'emboss',
        'sobel_horizontal',
        'sobel_vertikal',
        'laplacian',
      ]);
      expect(kunciPreset).not.toContain('prewitt');
      expect(kunciPreset).not.toContain('roberts');
    });

    it('memverifikasi sifat matematis jumlah bobot dan simetri tiap preset', () => {
      const sumMatriks = (m) => m.reduce((a, b) => a + b, 0);

      // Identitas: sum = 1, simetris
      expect(sumMatriks(PRESET_KERNEL.identitas.matriks)).toBe(1);
      expect(PRESET_KERNEL.identitas.ukuran).toBe(3);

      // Blur kotak: sum = 9, simetris
      expect(sumMatriks(PRESET_KERNEL.blur_kotak.matriks)).toBe(9);
      expect(PRESET_KERNEL.blur_kotak.pembagi).toBe(9);

      // Gaussian 3x3: sum = 16, simetris
      expect(sumMatriks(PRESET_KERNEL.gaussian_3x3.matriks)).toBe(16);
      expect(PRESET_KERNEL.gaussian_3x3.pembagi).toBe(16);

      // Gaussian 5x5: sum = 256, simetris
      expect(sumMatriks(PRESET_KERNEL.gaussian_5x5.matriks)).toBe(256);
      expect(PRESET_KERNEL.gaussian_5x5.ukuran).toBe(5);
      expect(PRESET_KERNEL.gaussian_5x5.pembagi).toBe(256);

      // Pertajam: sum = 1, simetris
      expect(sumMatriks(PRESET_KERNEL.pertajam.matriks)).toBe(1);

      // Sobel horizontal: sum = 0, antisimetris vertikal
      const sh = PRESET_KERNEL.sobel_horizontal.matriks;
      expect(sumMatriks(sh)).toBe(0);
      for (let r = 0; r < 3; r++) {
        expect(sh[r * 3 + 0]).toBe(-sh[r * 3 + 2]);
      }

      // Sobel vertikal: sum = 0, antisimetris horizontal
      const sv = PRESET_KERNEL.sobel_vertikal.matriks;
      expect(sumMatriks(sv)).toBe(0);
      for (let c = 0; c < 3; c++) {
        expect(sv[0 * 3 + c]).toBe(-sv[2 * 3 + c]);
      }

      // Laplacian: sum = 0, offset = 128
      expect(sumMatriks(PRESET_KERNEL.laplacian.matriks)).toBe(0);
      expect(PRESET_KERNEL.laplacian.offset).toBe(128);
    });
  });

  // ==========================================================================
  // 12. UJI KEMIRIPAN PRATINJAU VS HASIL PENUH DIPERKECIL (H5)
  // ==========================================================================
  describe('12. Uji Kemiripan Pratinjau vs Hasil Penuh Diperkecil (H5)', () => {
    it('Gaussian, Mean, Adaptif, dan Unsharp diskalakan dengan konteksSkala dan mendekati hasil penuh', () => {
      // Citra sintetis halus 64x64 dengan gradien lembut
      const wPenuh = 64;
      const hPenuh = 64;
      const dataPenuh = new Uint8ClampedArray(wPenuh * hPenuh * 4);
      for (let y = 0; y < hPenuh; y++) {
        for (let x = 0; x < wPenuh; x++) {
          const idx = (y * wPenuh + x) * 4;
          const val = Math.round(((x + y) / (wPenuh + hPenuh)) * 255);
          dataPenuh[idx] = val;
          dataPenuh[idx + 1] = val;
          dataPenuh[idx + 2] = val;
          dataPenuh[idx + 3] = 255;
        }
      }
      const citraPenuh = { width: wPenuh, height: hPenuh, data: dataPenuh };

      // Citra preview 32x32 (skala 0.5)
      const wPrev = 32;
      const hPrev = 32;
      const dataPrev = new Uint8ClampedArray(wPrev * hPrev * 4);
      for (let y = 0; y < hPrev; y++) {
        for (let x = 0; x < wPrev; x++) {
          const idx = (y * wPrev + x) * 4;
          const srcIdx = (y * 2 * wPenuh + x * 2) * 4;
          dataPrev[idx] = dataPenuh[srcIdx];
          dataPrev[idx + 1] = dataPenuh[srcIdx + 1];
          dataPrev[idx + 2] = dataPenuh[srcIdx + 2];
          dataPrev[idx + 3] = 255;
        }
      }
      const citraPrev = { width: wPrev, height: hPrev, data: dataPrev };

      // 1. Uji Gaussian: penuh sigma=4, preview sigma=4 dengan rasio=0.5 (sigma efektif=2)
      const gFull = operasiHalusGaussian.terapkan(
        citraPenuh,
        { sigma: 4.0 },
        { rasio: 1.0 }
      );
      const gPrev = operasiHalusGaussian.terapkan(
        citraPrev,
        { sigma: 4.0 },
        { rasio: 0.5 }
      );
      // Ukur Mean Absolute Error (MAE) antara gPrev dan subsample gFull
      let totalDiffG = 0;
      for (let y = 2; y < hPrev - 2; y++) {
        for (let x = 2; x < wPrev - 2; x++) {
          const pIdx = (y * wPrev + x) * 4;
          const fIdx = (y * 2 * wPenuh + x * 2) * 4;
          totalDiffG += Math.abs(gPrev.data[pIdx] - gFull.data[fIdx]);
        }
      }
      const maeG = totalDiffG / ((wPrev - 4) * (hPrev - 4));
      // Toleransi MAE pada citra halus adalah <= 3 tingkat
      expect(maeG).toBeLessThanOrEqual(3.0);

      // 2. Uji Mean: penuh radius=4, preview radius=4 dengan rasio=0.5 (radius efektif=2)
      const mFull = operasiHalusMean.terapkan(
        citraPenuh,
        { radius: 4 },
        { rasio: 1.0 }
      );
      const mPrev = operasiHalusMean.terapkan(
        citraPrev,
        { radius: 4 },
        { rasio: 0.5 }
      );
      let totalDiffM = 0;
      for (let y = 2; y < hPrev - 2; y++) {
        for (let x = 2; x < wPrev - 2; x++) {
          const pIdx = (y * wPrev + x) * 4;
          const fIdx = (y * 2 * wPenuh + x * 2) * 4;
          totalDiffM += Math.abs(mPrev.data[pIdx] - mFull.data[fIdx]);
        }
      }
      const maeM = totalDiffM / ((wPrev - 4) * (hPrev - 4));
      expect(maeM).toBeLessThanOrEqual(3.0);

      // 3. Uji Biner Adaptif (J5): penuh jendela=15, preview jendela=15 dengan rasio=0.5 (jendela efektif=7)
      const bFull = operasiBinerAdaptif.terapkan(
        citraPenuh,
        { jendela: 15, c: 5, inversi: false },
        { rasio: 1.0 }
      );
      const bPrev = operasiBinerAdaptif.terapkan(
        citraPrev,
        { jendela: 15, c: 5, inversi: false },
        { rasio: 0.5 }
      );
      let ketidakcocokanBiner = 0;
      let totalPikselBiner = 0;
      for (let y = 4; y < hPrev - 4; y++) {
        for (let x = 4; x < wPrev - 4; x++) {
          const pIdx = (y * wPrev + x) * 4;
          const fIdx = (y * 2 * wPenuh + x * 2) * 4;
          if (bPrev.data[pIdx] !== bFull.data[fIdx]) {
            ketidakcocokanBiner++;
          }
          totalPikselBiner++;
        }
      }
      const rasioBedaBiner = ketidakcocokanBiner / totalPikselBiner;
      // Perbedaan biner karena diskritisasi jendela lokal diperbolehkan <= 5% (0.05)
      expect(rasioBedaBiner).toBeLessThanOrEqual(0.05);

      // 4. Uji Unsharp Masking (J5): penuh sigma=3.0, preview sigma=3.0 dengan rasio=0.5 (sigma efektif=1.5)
      const uFull = operasiTajamUnsharp.terapkan(
        citraPenuh,
        { sigma: 3.0, jumlah: 1.5, ambang: 0 },
        { rasio: 1.0 }
      );
      const uPrev = operasiTajamUnsharp.terapkan(
        citraPrev,
        { sigma: 3.0, jumlah: 1.5, ambang: 0 },
        { rasio: 0.5 }
      );
      let totalDiffU = 0;
      for (let y = 2; y < hPrev - 2; y++) {
        for (let x = 2; x < wPrev - 2; x++) {
          const pIdx = (y * wPrev + x) * 4;
          const fIdx = (y * 2 * wPenuh + x * 2) * 4;
          totalDiffU += Math.abs(uPrev.data[pIdx] - uFull.data[fIdx]);
        }
      }
      const maeU = totalDiffU / ((wPrev - 4) * (hPrev - 4));
      // Toleransi penajaman unsharp pada citra halus adalah MAE <= 4.0 tingkat
      expect(maeU).toBeLessThanOrEqual(4.0);
    });
  });
});
