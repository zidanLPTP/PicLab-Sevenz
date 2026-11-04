/**
 * Operasi Citra Smoothing / Penghalusan (spec.md bagian 4 & Tahap 4).
 * Memproses tiap kanal RGB secara independen dengan replikasi piksel tepi,
 * menjaga kanal alfa (A), dan zero-allocation di dalam loop per piksel.
 */

import {
  bangunKernelGaussian1D,
  konvolusiSeparable1D,
  penapisMeanIntegral,
  penapisMedian,
} from './spasial/utilitasKonvolusi';

/**
 * Operasi Penghalusan Rata-rata Kotak (Box Blur / Mean Filter).
 * Menggunakan citra integral untuk kinerja O(1) per piksel terlepas dari radius.
 */
export const operasiHalusMean = {
  id: 'halus_mean',
  kategori: 'smoothing',
  kunciNama: 'operasi.smoothing.mean.nama',
  kunciDeskripsi: 'operasi.smoothing.mean.deskripsi',
  namaTeknis: 'Box Blur via Integral Image',
  skemaParameter: [
    {
      id: 'radius',
      kunciLabel: 'parameter.radiusMean',
      tipe: 'slider',
      min: 1,
      max: 25,
      step: 1,
      nilaiAwal: 3,
      satuan: 'px',
    },
  ],
  terapkan(citra, parameter = {}, konteksSkala = { rasio: 1.0 }) {
    let rRaw = Number(parameter.radius);
    if (!Number.isFinite(rRaw)) rRaw = 3;

    const rasio =
      konteksSkala && Number.isFinite(konteksSkala.rasio)
        ? konteksSkala.rasio
        : 1.0;
    const radiusEfektif = Math.round(rRaw * rasio);

    if (radiusEfektif < 1) {
      return { ...citra, data: new Uint8ClampedArray(citra.data) };
    }

    const data = penapisMeanIntegral(citra, radiusEfektif);
    return {
      width: citra.width,
      height: citra.height,
      data,
    };
  },
};

/**
 * Operasi Penghalusan Gaussian (Gaussian Blur).
 * Menggunakan konvolusi terpisah (separable 1D horizontal & 1D vertical) berbobot G(x) = exp(-x^2 / (2*sigma^2)).
 */
export const operasiHalusGaussian = {
  id: 'halus_gaussian',
  kategori: 'smoothing',
  kunciNama: 'operasi.smoothing.gaussian.nama',
  kunciDeskripsi: 'operasi.smoothing.gaussian.deskripsi',
  namaTeknis: 'Separable 2D Gaussian Filter',
  skemaParameter: [
    {
      id: 'sigma',
      kunciLabel: 'parameter.sigmaGaussian',
      tipe: 'slider',
      min: 0.5,
      max: 20.0,
      step: 0.5,
      nilaiAwal: 2.0,
      satuan: '',
    },
  ],
  terapkan(citra, parameter = {}, konteksSkala = { rasio: 1.0 }) {
    let sRaw = Number(parameter.sigma);
    if (!Number.isFinite(sRaw)) sRaw = 2.0;

    const rasio =
      konteksSkala && Number.isFinite(konteksSkala.rasio)
        ? konteksSkala.rasio
        : 1.0;
    const sigmaEfektif = sRaw * rasio;

    // Jika sigma efektif < 0.3, konvolusi Gaussian mendekati delta Dirac (identitas)
    if (sigmaEfektif < 0.3) {
      return { ...citra, data: new Uint8ClampedArray(citra.data) };
    }

    const { kernel, radius } = bangunKernelGaussian1D(sigmaEfektif);
    const data = konvolusiSeparable1D(citra, kernel, radius);
    return {
      width: citra.width,
      height: citra.height,
      data,
    };
  },
};

/**
 * Operasi Penghalusan Median (Median Filter).
 * Penapis non-linear yang menggantikan tiap piksel dengan nilai tengah tetangga terurut.
 * Sangat efektif membuang noise bintik (salt-and-pepper) tanpa mengaburkan tepi.
 */
export const operasiHalusMedian = {
  id: 'halus_median',
  kategori: 'smoothing',
  kunciNama: 'operasi.smoothing.median.nama',
  kunciDeskripsi: 'operasi.smoothing.median.deskripsi',
  namaTeknis: 'Non-Linear 2D Rank Median Filter',
  skemaParameter: [
    {
      id: 'ukuran',
      kunciLabel: 'parameter.ukuranJendela',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 3, kunciLabel: 'parameter.ukuranJendela3' },
        { nilai: 5, kunciLabel: 'parameter.ukuranJendela5' },
      ],
      nilaiAwal: 3,
    },
  ],
  terapkan(citra, parameter = {}) {
    let u = Number(parameter.ukuran);
    if (u !== 3 && u !== 5) u = 3;

    const data = penapisMedian(citra, u);
    return {
      width: citra.width,
      height: citra.height,
      data,
    };
  },
};
