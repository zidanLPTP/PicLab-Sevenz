/**
 * Operasi Citra Sharpening / Penajaman (spec.md bagian 4 & Tahap 4).
 * Memproses tiap kanal RGB secara independen dengan replikasi piksel tepi,
 * menjaga kanal alfa (A), dan zero-allocation di dalam loop per piksel.
 */

import {
  bangunKernelGaussian1D,
  konvolusi2DSejati,
  konvolusiSeparable1D,
} from './spasial/utilitasKonvolusi';
import { clamp } from './utilitasCitra';

/**
 * Operasi Penajaman Unsharp Masking.
 * Rumus inti:
 *   diff = f(x,y) - f_blur(x,y)
 *   g(x,y) = clamp(round(f(x,y) + k * diff)) jika |diff| >= ambang, selain itu f(x,y)
 */
export const operasiTajamUnsharp = {
  id: 'tajam_unsharp',
  kategori: 'sharpening',
  kunciNama: 'operasi.sharpening.unsharp.nama',
  kunciDeskripsi: 'operasi.sharpening.unsharp.deskripsi',
  namaTeknis: 'Unsharp Masking with Tonal Threshold',
  skemaParameter: [
    {
      id: 'sigma',
      kunciLabel: 'parameter.sigmaGaussian',
      tipe: 'slider',
      min: 0.5,
      max: 10.0,
      step: 0.5,
      nilaiAwal: 1.5,
      satuan: '',
    },
    {
      id: 'jumlah',
      kunciLabel: 'parameter.kekuatanTajam',
      tipe: 'slider',
      min: 0.1,
      max: 5.0,
      step: 0.1,
      nilaiAwal: 1.0,
      satuan: 'x',
    },
    {
      id: 'ambang',
      kunciLabel: 'parameter.ambangBatasTonal',
      tipe: 'slider',
      min: 0,
      max: 50,
      step: 1,
      nilaiAwal: 0,
      satuan: '',
    },
  ],
  terapkan(citra, parameter = {}, konteksSkala = { rasio: 1.0 }) {
    let sRaw = Number(parameter.sigma);
    if (!Number.isFinite(sRaw)) sRaw = 1.5;

    const rasio =
      konteksSkala && Number.isFinite(konteksSkala.rasio)
        ? konteksSkala.rasio
        : 1.0;
    const sigmaEfektif = sRaw * rasio;

    let k = Number(parameter.jumlah);
    if (!Number.isFinite(k)) k = 1.0;
    k = Math.max(0.1, Math.min(5.0, k));

    let th = Number(parameter.ambang);
    if (!Number.isFinite(th)) th = 0;
    th = Math.max(0, Math.min(50, th));

    const { width, height, data: src } = citra;
    const dst = new Uint8ClampedArray(src.length);
    const len = src.length;

    // Jika sigma efektif < 0.3 atau k == 0, tidak ada penajaman
    if (sigmaEfektif < 0.3 || k <= 0) {
      return { ...citra, data: new Uint8ClampedArray(src) };
    }

    const { kernel, radius } = bangunKernelGaussian1D(sigmaEfektif);
    const blurData = konvolusiSeparable1D(citra, kernel, radius);

    for (let i = 0; i < len; i += 4) {
      for (let c = 0; c < 3; c++) {
        const orig = src[i + c];
        const blur = blurData[i + c];
        const diff = orig - blur;

        if (Math.abs(diff) >= th) {
          dst[i + c] = clamp(Math.round(orig + k * diff));
        } else {
          dst[i + c] = orig;
        }
      }
      dst[i + 3] = src[i + 3];
    }

    return { width, height, data: dst };
  },
};

/**
 * Operasi Penajaman Berbasis Kernel Laplacian.
 * Menggabungkan kernel impuls identitas dengan kernel Laplacian berbobot kekuatan.
 *   Kernel 4-tetangga: [ 0, -k, 0; -k, 1+4k, -k; 0, -k, 0 ]
 *   Kernel 8-tetangga: [ -k, -k, -k; -k, 1+8k, -k; -k, -k, -k ]
 */
export const operasiTajamKernel = {
  id: 'tajam_kernel',
  kategori: 'sharpening',
  kunciNama: 'operasi.sharpening.kernel.nama',
  kunciDeskripsi: 'operasi.sharpening.kernel.deskripsi',
  namaTeknis: 'Laplacian Sharpening Kernel',
  skemaParameter: [
    {
      id: 'jenis',
      kunciLabel: 'parameter.jenisTetangga',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'tetangga4', kunciLabel: 'parameter.tetangga4' },
        { nilai: 'tetangga8', kunciLabel: 'parameter.tetangga8' },
      ],
      nilaiAwal: 'tetangga4',
    },
    {
      id: 'kekuatan',
      kunciLabel: 'parameter.kekuatanTajam',
      tipe: 'slider',
      min: 0.1,
      max: 3.0,
      step: 0.1,
      nilaiAwal: 1.0,
      satuan: 'x',
    },
  ],
  terapkan(citra, parameter = {}) {
    const jenis = parameter.jenis === 'tetangga8' ? 'tetangga8' : 'tetangga4';
    let k = Number(parameter.kekuatan);
    if (!Number.isFinite(k)) k = 1.0;
    k = Math.max(0.1, Math.min(3.0, k));

    let kernel;
    if (jenis === 'tetangga4') {
      kernel = [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0];
    } else {
      kernel = [-k, -k, -k, -k, 1 + 8 * k, -k, -k, -k, -k];
    }

    const data = konvolusi2DSejati(citra, kernel, 3, 1, 0);
    return {
      width: citra.width,
      height: citra.height,
      data,
    };
  },
};
