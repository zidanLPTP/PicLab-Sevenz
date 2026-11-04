/**
 * Operasi Citra Konvolusi Kustom & Preset Kernel (spec.md bagian 4 & Tahap 4).
 * Mendukung kernel matriks 3x3 dan 5x5 dengan konvolusi sejati (pembalikan 180°),
 * replikasi piksel tepi, dan penanganan pembagi serta bias offset.
 */

import { KONFIGURASI_SPASIAL } from '../utilitas/konfigurasiPipeline';
import { konvolusi2DSejati } from './spasial/utilitasKonvolusi';

/**
 * Daftar Preset Kernel Konvolusi Standar.
 */
export const PRESET_KERNEL = {
  identitas: {
    kunciLabel: 'presetKernel.identitas',
    ukuran: 3,
    matriks: [0, 0, 0, 0, 1, 0, 0, 0, 0],
    pembagi: 1,
    offset: 0,
  },
  blur_kotak: {
    kunciLabel: 'presetKernel.blurKotak',
    ukuran: 3,
    matriks: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    pembagi: 9,
    offset: 0,
  },
  gaussian_3x3: {
    kunciLabel: 'presetKernel.gaussian3x3',
    ukuran: 3,
    matriks: [1, 2, 1, 2, 4, 2, 1, 2, 1],
    pembagi: 16,
    offset: 0,
  },
  gaussian_5x5: {
    kunciLabel: 'presetKernel.gaussian5x5',
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
  pertajam: {
    kunciLabel: 'presetKernel.pertajam',
    ukuran: 3,
    matriks: [0, -1, 0, -1, 5, -1, 0, -1, 0],
    pembagi: 1,
    offset: 0,
  },
  emboss: {
    kunciLabel: 'presetKernel.emboss',
    ukuran: 3,
    matriks: [-2, -1, 0, -1, 1, 1, 0, 1, 2],
    pembagi: 1,
    offset: 128,
  },
  sobel_horizontal: {
    kunciLabel: 'presetKernel.sobelHorizontal',
    ukuran: 3,
    matriks: [-1, 0, 1, -2, 0, 2, -1, 0, 1],
    pembagi: 1,
    offset: 128,
  },
  sobel_vertikal: {
    kunciLabel: 'presetKernel.sobelVertikal',
    ukuran: 3,
    matriks: [-1, -2, -1, 0, 0, 0, 1, 2, 1],
    pembagi: 1,
    offset: 128,
  },
  laplacian: {
    kunciLabel: 'presetKernel.laplacian',
    ukuran: 3,
    matriks: [0, 1, 0, 1, -4, 1, 0, 1, 0],
    pembagi: 1,
    offset: 128,
  },
};

/**
 * Validasi dan normalisasi matriks kernel konvolusi.
 * Mengembalikan kernel aman berukuran ukuranK*ukuranK dengan elemen dijepit [-100, 100].
 *
 * @param {any} matriks
 * @param {number} ukuranK 3 atau 5
 * @returns {number[]}
 */
export function normalisasiMatriksKernel(matriks, ukuranK) {
  const k = ukuranK === 5 ? 5 : 3;
  const panjangHarapan = k * k;

  let arr = matriks;
  if (Array.isArray(arr) && Array.isArray(arr[0])) {
    arr = arr.flat();
  }

  // Jika masukan bukan array atau panjang tidak sesuai, kembalikan kernel identitas
  if (!Array.isArray(arr) || arr.length !== panjangHarapan) {
    const identitas = new Array(panjangHarapan).fill(0);
    const centerIdx = Math.floor(k / 2) * k + Math.floor(k / 2);
    identitas[centerIdx] = 1;
    return identitas;
  }

  const hasil = new Array(panjangHarapan);
  for (let i = 0; i < panjangHarapan; i++) {
    const val = Number(arr[i]);
    if (!Number.isFinite(val)) {
      hasil[i] = 0;
    } else {
      hasil[i] = Math.max(
        KONFIGURASI_SPASIAL.NILAI_ELEMEN_MATRIKS_MIN,
        Math.min(KONFIGURASI_SPASIAL.NILAI_ELEMEN_MATRIKS_MAX, val)
      );
    }
  }
  return hasil;
}

/**
 * Operasi Konvolusi Kernel Kustom 3x3 dan 5x5.
 * Rumus inti:
 *   g(x,y) = clamp(round(Σ_s Σ_t w(s,t) * f(x-s, y-t) / pembagi + offset))
 */
export const operasiKonvolusiKernel = {
  id: 'konvolusi_kernel',
  kategori: 'konvolusi',
  kunciNama: 'operasi.konvolusi.kernel.nama',
  kunciDeskripsi: 'operasi.konvolusi.kernel.deskripsi',
  namaTeknis: '2D Spatial Matrix Convolution (3x3 & 5x5)',
  skemaParameter: [
    {
      id: 'ukuran',
      kunciLabel: 'parameter.ukuranKernel',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 3, kunciLabel: 'parameter.ukuran3x3' },
        { nilai: 5, kunciLabel: 'parameter.ukuran5x5' },
      ],
      nilaiAwal: 3,
    },
    {
      id: 'matriks',
      kunciLabel: 'parameter.matriksKernel',
      tipe: 'matriks',
      nilaiAwal: [0, 0, 0, 0, 1, 0, 0, 0, 0],
    },
    {
      id: 'pembagi',
      kunciLabel: 'parameter.pembagiKernel',
      tipe: 'angka',
      nilaiAwal: 1,
    },
    {
      id: 'offset',
      kunciLabel: 'parameter.offsetBias',
      tipe: 'slider',
      min: -255,
      max: 255,
      step: 1,
      nilaiAwal: 0,
      satuan: '',
    },
  ],
  terapkan(citra, parameter = {}) {
    let u = Number(parameter.ukuran);
    if (u !== 3 && u !== 5) u = 3;

    const kernel = normalisasiMatriksKernel(parameter.matriks, u);

    let pembagi = Number(parameter.pembagi);
    if (!Number.isFinite(pembagi) || pembagi === 0) {
      let sum = 0;
      for (let i = 0; i < kernel.length; i++) sum += kernel[i];
      pembagi = sum > 0 ? sum : 1;
    }

    let offset = Number(parameter.offset);
    if (!Number.isFinite(offset)) offset = 0;
    offset = Math.max(-255, Math.min(255, Math.round(offset)));

    const data = konvolusi2DSejati(citra, kernel, u, pembagi, offset);
    return {
      width: citra.width,
      height: citra.height,
      data,
    };
  },
};
