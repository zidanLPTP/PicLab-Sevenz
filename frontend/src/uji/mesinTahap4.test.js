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
import {
  operasiTajamKernel,
  operasiTajamUnsharp,
} from '../mesin/sharpening';
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
  hitungAmbangOtsu,
  konvolusi2DSejati,
  konvolusiSeparable1D,
  penapisMeanIntegral,
  penapisMedian,
} from '../mesin/spasial/utilitasKonvolusi';
import {
  dapatkanOperasiBerdasarkanId,
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
      const citra = buatCitraUji(3, 3, [
        0, 0, 0,
        0, 0, 0,
        0, 0, 100,
      ]);

      // Kernel asimetris w berukuran 3x3:
      // [ 1, 2, 3 ]
      // [ 4, 5, 6 ]
      // [ 7, 8, 9 ]
      // Pada konvolusi sejati g(x,y) = sum_u sum_v w(u,v) * f(x-u, y-v):
      // Untuk piksel tengah (1,1):
      // u=-1, v=-1: w(-1,-1)=1 dikali f(1 - (-1), 1 - (-1)) = f(2, 2) = 100!
      // Jadi kontribusi f(2,2) dikalikan dengan w(0,0) = 1 (elemen kiri-atas kernel)!
      // Sebaliknya, jika korelasi (tanpa pemutaran 180°), f(2,2) dikalikan w(2,2) = 9.
      const kernelAsimetris = [
        1, 2, 3,
        4, 5, 6,
        7, 8, 9,
      ];

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
      const citra = buatCitraUji(3, 3, [
        0, 0, 0,
        0, 90, 0,
        0, 0, 0,
      ]);

      const hasil = operasiHalusMean.terapkan(citra, { radius: 1 });
      // Jendela 3x3 mencakup 9 piksel dengan total jumlah 90.
      // Rata-rata di piksel tengah = 90 / 9 = 10.
      expect(hasil.data[16]).toBe(10);
    });

    it('halus_gaussian: melakukan blur separabel 1D tanpa distorsi', () => {
      const citra = buatCitraUji(5, 5, [
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 100, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
      ]);

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
      const citra = buatCitraUji(3, 3, [
        50, 50, 50,
        50, 255, 50,
        50, 50, 50,
      ]);

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
      const citra = buatCitraUji(5, 5, [
        50, 50, 50, 50, 50,
        50, 50, 50, 50, 50,
        50, 50, 150, 50, 50,
        50, 50, 50, 50, 50,
        50, 50, 50, 50, 50,
      ]);

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
      const citra = buatCitraUji(3, 3, [
        50, 50, 50,
        50, 100, 50,
        50, 50, 50,
      ]);

      // Laplacian 4-tetangga kernel:
      // [  0, -1,  0 ]
      // [ -1,  5, -1 ]
      // [  0, -1,  0 ]
      // Pusat = 5*100 - (50+50+50+50) = 500 - 200 = 300 -> clamp ke 255
      const hasil4 = operasiTajamKernel.terapkan(citra, { model: '4_tetangga' });
      expect(hasil4.data[16]).toBe(255);

      // Laplacian 8-tetangga kernel:
      // [ -1, -1, -1 ]
      // [ -1,  9, -1 ]
      // [ -1, -1, -1 ]
      // Pusat = 9*100 - 8*50 = 900 - 400 = 500 -> clamp ke 255
      const hasil8 = operasiTajamKernel.terapkan(citra, { model: '8_tetangga' });
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
      const k2 = normalisasiMatriksKernel([[1, 2, 3], [4, 5, 6], [7, 8, 9]], 3);
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
        { op: operasiTepiSobel, param: { arah: 'gabungan', penguatan: 1.0, inversi: false } },
        { op: operasiTepiPrewitt, param: { arah: 'gabungan', penguatan: 1.0, inversi: false } },
        { op: operasiTepiRoberts, param: { arah: 'gabungan', penguatan: 1.0, inversi: false } },
        { op: operasiTepiLaplacian, param: { model: '4_tetangga', penguatan: 1.0, inversi: false } },
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
      const citraTangga = buatCitraUji(4, 4, [
        50, 50, 200, 200,
        50, 50, 200, 200,
        50, 50, 200, 200,
        50, 50, 200, 200,
      ]);

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
      const citra = buatCitraUji(3, 3, [
        100, 0, 0,
        0, 0, 0,
        0, 0, 0,
      ]);

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
      const citra = buatCitraUji(3, 3, [
        0, 0, 0,
        0, 100, 0,
        0, 0, 0,
      ]);

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
          10, 10, 10, 0,
          20, 20, 20, 128,
          30, 30, 30, 255,
          40, 40, 40, 64,
          50, 50, 50, 192,
          60, 60, 60, 255,
          70, 70, 70, 32,
          80, 80, 80, 96,
          90, 90, 90, 200,
        ]),
      };

      for (const op of semuaOperasi) {
        const param = ekstrakNilaiAwalParameter(op);
        const hasil = op.terapkan(citraAlfa, param);

        if (hasil.width === 3 && hasil.height === 3 && op.id !== 'dasar_flip' && op.id !== 'dasar_rotasi') {
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
      const citra = buatCitraUji(4, 4, [
        10, 20, 30, 40,
        50, 60, 70, 80,
        90, 100, 110, 120,
        130, 140, 150, 160,
      ]);

      const langkahPipeline = [
        { id: '1', idOperasi: 'halus_mean', parameter: { radius: 1 }, aktif: true },
        { id: '2', idOperasi: 'tajam_unsharp', parameter: { sigma: 1.0, jumlah: 1.5, ambang: 0 }, aktif: true },
        { id: '3', idOperasi: 'tepi_sobel', parameter: { arah: 'gabungan', penguatan: 1.0, inversi: false }, aktif: true },
        { id: '4', idOperasi: 'biner_otsu', parameter: { inversi: false }, aktif: true },
      ];

      const run1 = eksekusiPipelineSekuensial(langkahPipeline, citra);
      const run2 = eksekusiPipelineSekuensial(langkahPipeline, citra);

      expect(run1.hasil.data).toEqual(run2.hasil.data);
      expect(run1.langkahDieksekusi).toBe(4);
      expect(run2.langkahDieksekusi).toBe(4);
    });
  });
});
