/**
 * Operasi Citra Deteksi Tepi Dasar (spec.md bagian 4 & Tahap 4).
 * Semua operator deteksi tepi bekerja pada luminans Rec.601 dan menghasilkan citra monokrom (R=G=B).
 * Operator tepi menggunakan besaran gradien non-arah (|G| atau sqrt(Gx^2 + Gy^2)),
 * sehingga tanda arah gradien positif/negatif tidak berpengaruh pada intensitas tepi.
 * Optimasi: Pemisahan interior loop bebas percabangan dengan border khusus.
 * Kanal alfa (A) selalu dipertahankan utuh tanpa alokasi memori per piksel.
 */

import { ekstrakLuminansRec601 } from './spasial/utilitasKonvolusi';
import { buatCitraKosong, clamp } from './utilitasCitra';

/**
 * Operasi Deteksi Tepi Sobel.
 * Menggunakan gradien turunan pertama dengan pembobotan Gaussian pada sumbu ortogonal:
 *   Gx = [ -1, 0, 1; -2, 0, 2; -1, 0, 1 ]
 *   Gy = [ -1, -2, -1; 0, 0, 0; 1, 2, 1 ]
 *   Besaran = round(sqrt(Gx^2 + Gy^2) * penguatan)
 */
export const operasiTepiSobel = {
  id: 'tepi_sobel',
  kategori: 'tepi',
  kunciNama: 'operasi.tepi.sobel.nama',
  kunciDeskripsi: 'operasi.tepi.sobel.deskripsi',
  namaTeknis: 'Sobel Gradient Edge Detector',
  skemaParameter: [
    {
      id: 'arah',
      kunciLabel: 'parameter.arahGradien',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'gabungan', kunciLabel: 'parameter.arahGabungan' },
        { nilai: 'horizontal', kunciLabel: 'parameter.arahHorizontal' },
        { nilai: 'vertikal', kunciLabel: 'parameter.arahVertikal' },
      ],
      nilaiAwal: 'gabungan',
    },
    {
      id: 'penguatan',
      kunciLabel: 'parameter.penguatanGradien',
      tipe: 'slider',
      min: 0.5,
      max: 5.0,
      step: 0.1,
      nilaiAwal: 1.0,
      satuan: 'x',
    },
    {
      id: 'inversi',
      kunciLabel: 'parameter.inversi',
      tipe: 'sakelar',
      nilaiAwal: false,
    },
  ],
  terapkan(citra, parameter = {}) {
    const arah = parameter.arah || 'gabungan';
    let g = Number(parameter.penguatan);
    if (!Number.isFinite(g)) g = 1.0;
    g = Math.max(0.5, Math.min(5.0, g));
    const inversi = Boolean(parameter.inversi);

    const { width, height, data: src } = citra;
    const lum = ekstrakLuminansRec601(citra);
    const hasil = buatCitraKosong(width, height);
    const dst = hasil.data;

    // Jika dimensi citra <= 2, seluruh piksel berada di border
    if (width <= 2 || height <= 2) {
      for (let y = 0; y < height; y++) {
        const ym1 = y > 0 ? y - 1 : 0;
        const yp1 = y < height - 1 ? y + 1 : height - 1;
        const rowY = y * width;
        const rowYm1 = ym1 * width;
        const rowYp1 = yp1 * width;

        for (let x = 0; x < width; x++) {
          const xm1 = x > 0 ? x - 1 : 0;
          const xp1 = x < width - 1 ? x + 1 : width - 1;

          const p00 = lum[rowYm1 + xm1];
          const p01 = lum[rowYm1 + x];
          const p02 = lum[rowYm1 + xp1];

          const p10 = lum[rowY + xm1];
          const p12 = lum[rowY + xp1];

          const p20 = lum[rowYp1 + xm1];
          const p21 = lum[rowYp1 + x];
          const p22 = lum[rowYp1 + xp1];

          const gx = p02 + 2 * p12 + p22 - (p00 + 2 * p10 + p20);
          const gy = p20 + 2 * p21 + p22 - (p00 + 2 * p01 + p02);

          let besaran;
          if (arah === 'horizontal') {
            besaran = Math.abs(gx);
          } else if (arah === 'vertikal') {
            besaran = Math.abs(gy);
          } else {
            besaran = Math.sqrt(gx * gx + gy * gy);
          }

          let nilai = clamp(Math.round(besaran * g));
          if (inversi) nilai = 255 - nilai;

          const dstIdx = (rowY + x) * 4;
          dst[dstIdx] = nilai;
          dst[dstIdx + 1] = nilai;
          dst[dstIdx + 2] = nilai;
          dst[dstIdx + 3] = src[dstIdx + 3];
        }
      }
      return hasil;
    }

    // 1. Interior: y in [1, height - 2], x in [1, width - 2]
    for (let y = 1; y < height - 1; y++) {
      const rowYm1 = (y - 1) * width;
      const rowY = y * width;
      const rowYp1 = (y + 1) * width;
      let dstIdx = (rowY + 1) * 4;

      for (let x = 1; x < width - 1; x++) {
        const p00 = lum[rowYm1 + x - 1];
        const p01 = lum[rowYm1 + x];
        const p02 = lum[rowYm1 + x + 1];

        const p10 = lum[rowY + x - 1];
        const p12 = lum[rowY + x + 1];

        const p20 = lum[rowYp1 + x - 1];
        const p21 = lum[rowYp1 + x];
        const p22 = lum[rowYp1 + x + 1];

        const gx = p02 + 2 * p12 + p22 - (p00 + 2 * p10 + p20);
        const gy = p20 + 2 * p21 + p22 - (p00 + 2 * p01 + p02);

        let besaran;
        if (arah === 'horizontal') {
          besaran = Math.abs(gx);
        } else if (arah === 'vertikal') {
          besaran = Math.abs(gy);
        } else {
          besaran = Math.sqrt(gx * gx + gy * gy);
        }

        let nilai = clamp(Math.round(besaran * g));
        if (inversi) nilai = 255 - nilai;

        dst[dstIdx] = nilai;
        dst[dstIdx + 1] = nilai;
        dst[dstIdx + 2] = nilai;
        dst[dstIdx + 3] = src[dstIdx + 3];
        dstIdx += 4;
      }
    }

    // 2. Borders
    for (let y = 0; y < height; y++) {
      const isBorderY = y === 0 || y === height - 1;
      const ym1 = y > 0 ? y - 1 : 0;
      const yp1 = y < height - 1 ? y + 1 : height - 1;
      const rowY = y * width;
      const rowYm1 = ym1 * width;
      const rowYp1 = yp1 * width;

      const xs = isBorderY
        ? Array.from({ length: width }, (_, i) => i)
        : [0, width - 1];

      for (const x of xs) {
        const xm1 = x > 0 ? x - 1 : 0;
        const xp1 = x < width - 1 ? x + 1 : width - 1;

        const p00 = lum[rowYm1 + xm1];
        const p01 = lum[rowYm1 + x];
        const p02 = lum[rowYm1 + xp1];

        const p10 = lum[rowY + xm1];
        const p12 = lum[rowY + xp1];

        const p20 = lum[rowYp1 + xm1];
        const p21 = lum[rowYp1 + x];
        const p22 = lum[rowYp1 + xp1];

        const gx = p02 + 2 * p12 + p22 - (p00 + 2 * p10 + p20);
        const gy = p20 + 2 * p21 + p22 - (p00 + 2 * p01 + p02);

        let besaran;
        if (arah === 'horizontal') {
          besaran = Math.abs(gx);
        } else if (arah === 'vertikal') {
          besaran = Math.abs(gy);
        } else {
          besaran = Math.sqrt(gx * gx + gy * gy);
        }

        let nilai = clamp(Math.round(besaran * g));
        if (inversi) nilai = 255 - nilai;

        const dstIdx = (rowY + x) * 4;
        dst[dstIdx] = nilai;
        dst[dstIdx + 1] = nilai;
        dst[dstIdx + 2] = nilai;
        dst[dstIdx + 3] = src[dstIdx + 3];
      }
    }

    return hasil;
  },
};

/**
 * Operasi Deteksi Tepi Prewitt.
 * Serupa dengan Sobel namun menggunakan pembobotan seragam (tanpa faktor 2 di tengah):
 *   Gx = [ -1, 0, 1; -1, 0, 1; -1, 0, 1 ]
 *   Gy = [ -1, -1, -1; 0, 0, 0; 1, 1, 1 ]
 */
export const operasiTepiPrewitt = {
  id: 'tepi_prewitt',
  kategori: 'tepi',
  kunciNama: 'operasi.tepi.prewitt.nama',
  kunciDeskripsi: 'operasi.tepi.prewitt.deskripsi',
  namaTeknis: 'Prewitt Unweighted Gradient Edge Detector',
  skemaParameter: [
    {
      id: 'arah',
      kunciLabel: 'parameter.arahGradien',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'gabungan', kunciLabel: 'parameter.arahGabungan' },
        { nilai: 'horizontal', kunciLabel: 'parameter.arahHorizontal' },
        { nilai: 'vertikal', kunciLabel: 'parameter.arahVertikal' },
      ],
      nilaiAwal: 'gabungan',
    },
    {
      id: 'penguatan',
      kunciLabel: 'parameter.penguatanGradien',
      tipe: 'slider',
      min: 0.5,
      max: 5.0,
      step: 0.1,
      nilaiAwal: 1.0,
      satuan: 'x',
    },
    {
      id: 'inversi',
      kunciLabel: 'parameter.inversi',
      tipe: 'sakelar',
      nilaiAwal: false,
    },
  ],
  terapkan(citra, parameter = {}) {
    const arah = parameter.arah || 'gabungan';
    let g = Number(parameter.penguatan);
    if (!Number.isFinite(g)) g = 1.0;
    g = Math.max(0.5, Math.min(5.0, g));
    const inversi = Boolean(parameter.inversi);

    const { width, height, data: src } = citra;
    const lum = ekstrakLuminansRec601(citra);
    const hasil = buatCitraKosong(width, height);
    const dst = hasil.data;

    // 1. Interior: y in [1, height - 2], x in [1, width - 2]
    for (let y = 1; y < height - 1; y++) {
      const rowYm1 = (y - 1) * width;
      const rowY = y * width;
      const rowYp1 = (y + 1) * width;
      let dstIdx = (rowY + 1) * 4;

      for (let x = 1; x < width - 1; x++) {
        const p00 = lum[rowYm1 + x - 1];
        const p01 = lum[rowYm1 + x];
        const p02 = lum[rowYm1 + x + 1];

        const p10 = lum[rowY + x - 1];
        const p12 = lum[rowY + x + 1];

        const p20 = lum[rowYp1 + x - 1];
        const p21 = lum[rowYp1 + x];
        const p22 = lum[rowYp1 + x + 1];

        const gx = p02 + p12 + p22 - (p00 + p10 + p20);
        const gy = p20 + p21 + p22 - (p00 + p01 + p02);

        let besaran;
        if (arah === 'horizontal') {
          besaran = Math.abs(gx);
        } else if (arah === 'vertikal') {
          besaran = Math.abs(gy);
        } else {
          besaran = Math.sqrt(gx * gx + gy * gy);
        }

        let nilai = clamp(Math.round(besaran * g));
        if (inversi) nilai = 255 - nilai;

        dst[dstIdx] = nilai;
        dst[dstIdx + 1] = nilai;
        dst[dstIdx + 2] = nilai;
        dst[dstIdx + 3] = src[dstIdx + 3];
        dstIdx += 4;
      }
    }

    // 2. Borders
    for (let y = 0; y < height; y++) {
      const isBorderY = y === 0 || y === height - 1;
      const ym1 = y > 0 ? y - 1 : 0;
      const yp1 = y < height - 1 ? y + 1 : height - 1;
      const rowY = y * width;
      const rowYm1 = ym1 * width;
      const rowYp1 = yp1 * width;

      const xs = isBorderY
        ? Array.from({ length: width }, (_, i) => i)
        : [0, width - 1];

      for (const x of xs) {
        const xm1 = x > 0 ? x - 1 : 0;
        const xp1 = x < width - 1 ? x + 1 : width - 1;

        const p00 = lum[rowYm1 + xm1];
        const p01 = lum[rowYm1 + x];
        const p02 = lum[rowYm1 + xp1];

        const p10 = lum[rowY + xm1];
        const p12 = lum[rowY + xp1];

        const p20 = lum[rowYp1 + xm1];
        const p21 = lum[rowYp1 + x];
        const p22 = lum[rowYp1 + xp1];

        const gx = p02 + p12 + p22 - (p00 + p10 + p20);
        const gy = p20 + p21 + p22 - (p00 + p01 + p02);

        let besaran;
        if (arah === 'horizontal') {
          besaran = Math.abs(gx);
        } else if (arah === 'vertikal') {
          besaran = Math.abs(gy);
        } else {
          besaran = Math.sqrt(gx * gx + gy * gy);
        }

        let nilai = clamp(Math.round(besaran * g));
        if (inversi) nilai = 255 - nilai;

        const dstIdx = (rowY + x) * 4;
        dst[dstIdx] = nilai;
        dst[dstIdx + 1] = nilai;
        dst[dstIdx + 2] = nilai;
        dst[dstIdx + 3] = src[dstIdx + 3];
      }
    }

    return hasil;
  },
};

/**
 * Operasi Deteksi Tepi Roberts Cross.
 * Menggunakan gradien diagonal 2x2 yang sangat cepat:
 *   Gx = f(x, y) - f(x+1, y+1)
 *   Gy = f(x+1, y) - f(x, y+1)
 *   Besaran = round(sqrt(Gx^2 + Gy^2) * penguatan)
 */
export const operasiTepiRoberts = {
  id: 'tepi_roberts',
  kategori: 'tepi',
  kunciNama: 'operasi.tepi.roberts.nama',
  kunciDeskripsi: 'operasi.tepi.roberts.deskripsi',
  namaTeknis: 'Roberts Cross 2x2 Diagonal Gradient',
  skemaParameter: [
    {
      id: 'arah',
      kunciLabel: 'parameter.arahGradien',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'gabungan', kunciLabel: 'parameter.arahGabungan' },
        { nilai: 'horizontal', kunciLabel: 'parameter.arahDiagonal1' },
        { nilai: 'vertikal', kunciLabel: 'parameter.arahDiagonal2' },
      ],
      nilaiAwal: 'gabungan',
    },
    {
      id: 'penguatan',
      kunciLabel: 'parameter.penguatanGradien',
      tipe: 'slider',
      min: 0.5,
      max: 5.0,
      step: 0.1,
      nilaiAwal: 1.0,
      satuan: 'x',
    },
    {
      id: 'inversi',
      kunciLabel: 'parameter.inversi',
      tipe: 'sakelar',
      nilaiAwal: false,
    },
  ],
  terapkan(citra, parameter = {}) {
    const arah = parameter.arah || 'gabungan';
    let g = Number(parameter.penguatan);
    if (!Number.isFinite(g)) g = 1.0;
    g = Math.max(0.5, Math.min(5.0, g));
    const inversi = Boolean(parameter.inversi);

    const { width, height, data: src } = citra;
    const lum = ekstrakLuminansRec601(citra);
    const hasil = buatCitraKosong(width, height);
    const dst = hasil.data;

    // 1. Interior: y in [0, height - 2], x in [0, width - 2]
    for (let y = 0; y < height - 1; y++) {
      const rowY = y * width;
      const rowYp1 = (y + 1) * width;
      let dstIdx = rowY * 4;

      for (let x = 0; x < width - 1; x++) {
        const p00 = lum[rowY + x];
        const p01 = lum[rowY + x + 1];
        const p10 = lum[rowYp1 + x];
        const p11 = lum[rowYp1 + x + 1];

        const gx = p00 - p11;
        const gy = p01 - p10;

        let besaran;
        if (arah === 'horizontal') {
          besaran = Math.abs(gx);
        } else if (arah === 'vertikal') {
          besaran = Math.abs(gy);
        } else {
          besaran = Math.sqrt(gx * gx + gy * gy);
        }

        let nilai = clamp(Math.round(besaran * g));
        if (inversi) nilai = 255 - nilai;

        dst[dstIdx] = nilai;
        dst[dstIdx + 1] = nilai;
        dst[dstIdx + 2] = nilai;
        dst[dstIdx + 3] = src[dstIdx + 3];
        dstIdx += 4;
      }
    }

    // 2. Borders (bottom row & right column)
    for (let y = 0; y < height; y++) {
      const isBottom = y === height - 1;
      const yp1 = isBottom ? height - 1 : y + 1;
      const rowY = y * width;
      const rowYp1 = yp1 * width;

      const xs = isBottom
        ? Array.from({ length: width }, (_, i) => i)
        : [width - 1];

      for (const x of xs) {
        const xp1 = x < width - 1 ? x + 1 : width - 1;

        const p00 = lum[rowY + x];
        const p01 = lum[rowY + xp1];
        const p10 = lum[rowYp1 + x];
        const p11 = lum[rowYp1 + xp1];

        const gx = p00 - p11;
        const gy = p01 - p10;

        let besaran;
        if (arah === 'horizontal') {
          besaran = Math.abs(gx);
        } else if (arah === 'vertikal') {
          besaran = Math.abs(gy);
        } else {
          besaran = Math.sqrt(gx * gx + gy * gy);
        }

        let nilai = clamp(Math.round(besaran * g));
        if (inversi) nilai = 255 - nilai;

        const dstIdx = (rowY + x) * 4;
        dst[dstIdx] = nilai;
        dst[dstIdx + 1] = nilai;
        dst[dstIdx + 2] = nilai;
        dst[dstIdx + 3] = src[dstIdx + 3];
      }
    }

    return hasil;
  },
};

/**
 * Operasi Deteksi Tepi Laplacian (Turunan Kedua).
 * Menghitung kelengkungan intensitas lokal menggunakan operator isotropik:
 *   4-tetangga: | f(x, y-1) + f(x-1, y) + f(x+1, y) + f(x, y+1) - 4*f(x,y) |
 *   8-tetangga: | Σ_tetangga - 8*f(x,y) |
 */
export const operasiTepiLaplacian = {
  id: 'tepi_laplacian',
  kategori: 'tepi',
  kunciNama: 'operasi.tepi.laplacian.nama',
  kunciDeskripsi: 'operasi.tepi.laplacian.deskripsi',
  namaTeknis: 'Laplacian Second-Derivative Operator',
  skemaParameter: [
    {
      id: 'varian',
      kunciLabel: 'parameter.jenisTetangga',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'tetangga4', kunciLabel: 'parameter.tetangga4' },
        { nilai: 'tetangga8', kunciLabel: 'parameter.tetangga8' },
      ],
      nilaiAwal: 'tetangga4',
    },
    {
      id: 'penguatan',
      kunciLabel: 'parameter.penguatanGradien',
      tipe: 'slider',
      min: 0.5,
      max: 5.0,
      step: 0.1,
      nilaiAwal: 1.0,
      satuan: 'x',
    },
    {
      id: 'inversi',
      kunciLabel: 'parameter.inversi',
      tipe: 'sakelar',
      nilaiAwal: false,
    },
  ],
  terapkan(citra, parameter = {}) {
    const varian = parameter.varian === 'tetangga8' ? 'tetangga8' : 'tetangga4';
    let g = Number(parameter.penguatan);
    if (!Number.isFinite(g)) g = 1.0;
    g = Math.max(0.5, Math.min(5.0, g));
    const inversi = Boolean(parameter.inversi);

    const { width, height, data: src } = citra;
    const lum = ekstrakLuminansRec601(citra);
    const hasil = buatCitraKosong(width, height);
    const dst = hasil.data;

    // 1. Interior: y in [1, height - 2], x in [1, width - 2]
    for (let y = 1; y < height - 1; y++) {
      const rowYm1 = (y - 1) * width;
      const rowY = y * width;
      const rowYp1 = (y + 1) * width;
      let dstIdx = (rowY + 1) * 4;

      for (let x = 1; x < width - 1; x++) {
        const p11 = lum[rowY + x];
        let resp;

        if (varian === 'tetangga4') {
          const p01 = lum[rowYm1 + x];
          const p10 = lum[rowY + x - 1];
          const p12 = lum[rowY + x + 1];
          const p21 = lum[rowYp1 + x];
          resp = Math.abs(p01 + p10 + p12 + p21 - 4 * p11);
        } else {
          const p00 = lum[rowYm1 + x - 1];
          const p01 = lum[rowYm1 + x];
          const p02 = lum[rowYm1 + x + 1];
          const p10 = lum[rowY + x - 1];
          const p12 = lum[rowY + x + 1];
          const p20 = lum[rowYp1 + x - 1];
          const p21 = lum[rowYp1 + x];
          const p22 = lum[rowYp1 + x + 1];
          const sum8 = p00 + p01 + p02 + p10 + p12 + p20 + p21 + p22;
          resp = Math.abs(sum8 - 8 * p11);
        }

        let nilai = clamp(Math.round(resp * g));
        if (inversi) nilai = 255 - nilai;

        dst[dstIdx] = nilai;
        dst[dstIdx + 1] = nilai;
        dst[dstIdx + 2] = nilai;
        dst[dstIdx + 3] = src[dstIdx + 3];
        dstIdx += 4;
      }
    }

    // 2. Borders
    for (let y = 0; y < height; y++) {
      const isBorderY = y === 0 || y === height - 1;
      const ym1 = y > 0 ? y - 1 : 0;
      const yp1 = y < height - 1 ? y + 1 : height - 1;
      const rowY = y * width;
      const rowYm1 = ym1 * width;
      const rowYp1 = yp1 * width;

      const xs = isBorderY
        ? Array.from({ length: width }, (_, i) => i)
        : [0, width - 1];

      for (const x of xs) {
        const xm1 = x > 0 ? x - 1 : 0;
        const xp1 = x < width - 1 ? x + 1 : width - 1;

        const p11 = lum[rowY + x];
        let resp;

        if (varian === 'tetangga4') {
          const p01 = lum[rowYm1 + x];
          const p10 = lum[rowY + xm1];
          const p12 = lum[rowY + xp1];
          const p21 = lum[rowYp1 + x];
          resp = Math.abs(p01 + p10 + p12 + p21 - 4 * p11);
        } else {
          const p00 = lum[rowYm1 + xm1];
          const p01 = lum[rowYm1 + x];
          const p02 = lum[rowYm1 + xp1];
          const p10 = lum[rowY + xm1];
          const p12 = lum[rowY + xp1];
          const p20 = lum[rowYp1 + xm1];
          const p21 = lum[rowYp1 + x];
          const p22 = lum[rowYp1 + xp1];

          const sum8 = p00 + p01 + p02 + p10 + p12 + p20 + p21 + p22;
          resp = Math.abs(sum8 - 8 * p11);
        }

        let nilai = clamp(Math.round(resp * g));
        if (inversi) nilai = 255 - nilai;

        const dstIdx = (rowY + x) * 4;
        dst[dstIdx] = nilai;
        dst[dstIdx + 1] = nilai;
        dst[dstIdx + 2] = nilai;
        dst[dstIdx + 3] = src[dstIdx + 3];
      }
    }

    return hasil;
  },
};
