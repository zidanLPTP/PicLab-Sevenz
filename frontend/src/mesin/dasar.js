/**
 * Operasi Citra Dasar PicLab Sevenz (spec.md bagian 4).
 * Semua fungsi adalah fungsi murni yang menerima { data, width, height }
 * dan parameter, lalu mengembalikan objek citra baru tanpa memutasi masukan.
 */

import { BATASAN_BERKAS } from '../utilitas/konfigurasiBerkas';
import {
  buatCitraKosong,
  buatTabelPencarian,
  clamp,
  hitungLuminansRec601,
} from './utilitasCitra';

/**
 * Operasi Kecerahan (Brightness).
 * Metode: Transformasi titik linear dengan Look-Up Table (LUT).
 * Rumus inti: V' = clamp(V + nilaiOffset)
 */
export const operasiKecerahan = {
  id: 'dasar_kecerahan',
  kategori: 'dasar',
  kunciNama: 'operasi.dasar.kecerahan.nama',
  kunciDeskripsi: 'operasi.dasar.kecerahan.deskripsi',
  namaTeknis: 'Linear Brightness Shift',
  skemaParameter: [
    {
      id: 'kecerahan',
      kunciLabel: 'parameter.kecerahan',
      tipe: 'slider',
      min: -150,
      max: 150,
      step: 1,
      nilaiAwal: 0,
      satuan: '',
    },
  ],
  terapkan(citra, parameter = {}) {
    let nilaiOffset = Number(parameter.kecerahan);
    if (!Number.isFinite(nilaiOffset)) nilaiOffset = 0;
    nilaiOffset = Math.max(-150, Math.min(150, Math.round(nilaiOffset)));

    if (nilaiOffset === 0)
      return { ...citra, data: new Uint8ClampedArray(citra.data) };

    const lut = buatTabelPencarian((v) => v + nilaiOffset);
    const hasil = buatCitraKosong(citra.width, citra.height);
    const src = citra.data;
    const dst = hasil.data;
    const len = src.length;

    for (let i = 0; i < len; i += 4) {
      dst[i] = lut[src[i]];
      dst[i + 1] = lut[src[i + 1]];
      dst[i + 2] = lut[src[i + 2]];
      dst[i + 3] = src[i + 3]; // Alfa dipertahankan utuh
    }
    return hasil;
  },
};

/**
 * Operasi Kontras (Contrast).
 * Metode: Peregangan kontras berpusat di midtone (128) via LUT.
 * Rumus inti: faktor = (259 * (kontras + 255)) / (255 * (259 - kontras))
 *             V' = clamp(faktor * (V - 128) + 128)
 */
export const operasiKontras = {
  id: 'dasar_kontras',
  kategori: 'dasar',
  kunciNama: 'operasi.dasar.kontras.nama',
  kunciDeskripsi: 'operasi.dasar.kontras.deskripsi',
  namaTeknis: 'Midtone-Centered Contrast Adjustment',
  skemaParameter: [
    {
      id: 'kontras',
      kunciLabel: 'parameter.kontras',
      tipe: 'slider',
      min: -100,
      max: 100,
      step: 1,
      nilaiAwal: 0,
      satuan: '',
    },
  ],
  terapkan(citra, parameter = {}) {
    let c = Number(parameter.kontras);
    if (!Number.isFinite(c)) c = 0;
    c = Math.max(-100, Math.min(100, Math.round(c)));

    if (c === 0) return { ...citra, data: new Uint8ClampedArray(citra.data) };

    const faktor = (259 * (c + 255)) / (255 * (259 - c));
    const lut = buatTabelPencarian((v) => faktor * (v - 128) + 128);

    const hasil = buatCitraKosong(citra.width, citra.height);
    const src = citra.data;
    const dst = hasil.data;
    const len = src.length;

    for (let i = 0; i < len; i += 4) {
      dst[i] = lut[src[i]];
      dst[i + 1] = lut[src[i + 1]];
      dst[i + 2] = lut[src[i + 2]];
      dst[i + 3] = src[i + 3];
    }
    return hasil;
  },
};

/**
 * Operasi Negatif Citra (Invert).
 * Metode: Pembalikan intensitas piksel via LUT.
 * Rumus inti: V' = 255 - V
 */
export const operasiNegatif = {
  id: 'dasar_negatif',
  kategori: 'dasar',
  kunciNama: 'operasi.dasar.negatif.nama',
  kunciDeskripsi: 'operasi.dasar.negatif.deskripsi',
  namaTeknis: 'Photographic Negative Inversion',
  skemaParameter: [],
  terapkan(citra) {
    const lut = buatTabelPencarian((v) => 255 - v);
    const hasil = buatCitraKosong(citra.width, citra.height);
    const src = citra.data;
    const dst = hasil.data;
    const len = src.length;

    for (let i = 0; i < len; i += 4) {
      dst[i] = lut[src[i]];
      dst[i + 1] = lut[src[i + 1]];
      dst[i + 2] = lut[src[i + 2]];
      dst[i + 3] = src[i + 3];
    }
    return hasil;
  },
};

/**
 * Operasi Citra Grayscale (Derajat Keabuan).
 * Metode: Konversi ITU-R BT.601 (Rec.601).
 * Rumus inti: Y = Math.round(0.299*R + 0.587*G + 0.114*B), R'=G'=B'=Y
 */
export const operasiGrayscale = {
  id: 'dasar_grayscale',
  kategori: 'dasar',
  kunciNama: 'operasi.dasar.grayscale.nama',
  kunciDeskripsi: 'operasi.dasar.grayscale.deskripsi',
  namaTeknis: 'Rec.601 Luma Grayscale Conversion',
  skemaParameter: [],
  terapkan(citra) {
    const hasil = buatCitraKosong(citra.width, citra.height);
    const src = citra.data;
    const dst = hasil.data;
    const len = src.length;

    for (let i = 0; i < len; i += 4) {
      const y = hitungLuminansRec601(src[i], src[i + 1], src[i + 2]);
      dst[i] = y;
      dst[i + 1] = y;
      dst[i + 2] = y;
      dst[i + 3] = src[i + 3];
    }
    return hasil;
  },
};

/**
 * Operasi Pembalik Citra (Flip).
 * Metode: Pemetaan koordinat geometri piksel.
 * Rumus inti: Horizontal: (x, y) -> (width - 1 - x, y)
 *             Vertikal:   (x, y) -> (x, height - 1 - y)
 */
export const operasiFlip = {
  id: 'dasar_flip',
  kategori: 'dasar',
  kunciNama: 'operasi.dasar.flip.nama',
  kunciDeskripsi: 'operasi.dasar.flip.deskripsi',
  namaTeknis: 'Geometric Axis Reflection',
  skemaParameter: [
    {
      id: 'arah',
      kunciLabel: 'parameter.arahFlip',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'horizontal', kunciLabel: 'parameter.horizontal' },
        { nilai: 'vertikal', kunciLabel: 'parameter.vertikal' },
        { nilai: 'keduanya', kunciLabel: 'parameter.keduanya' },
      ],
      nilaiAwal: 'horizontal',
    },
  ],
  terapkan(citra, parameter = {}) {
    const opsiArah = ['horizontal', 'vertikal', 'keduanya'];
    const arah = opsiArah.includes(parameter.arah)
      ? parameter.arah
      : 'horizontal';

    const { width, height, data: src } = citra;
    const hasil = buatCitraKosong(width, height);
    const dst = hasil.data;

    const flipH = arah === 'horizontal' || arah === 'keduanya';
    const flipV = arah === 'vertikal' || arah === 'keduanya';

    for (let y = 0; y < height; y++) {
      const targetY = flipV ? height - 1 - y : y;
      for (let x = 0; x < width; x++) {
        const targetX = flipH ? width - 1 - x : x;
        const srcIdx = (y * width + x) * 4;
        const dstIdx = (targetY * width + targetX) * 4;

        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }
    return hasil;
  },
};

/**
 * Operasi Rotasi Citra (Kelipatan 90 Derajat).
 * Metode: Transformasi matriks rotasi ortogonal.
 * Rumus inti:
 *   90°:  (x, y) -> (height - 1 - y, x), dimensi baru: [height, width]
 *   180°: (x, y) -> (width - 1 - x, height - 1 - y), dimensi: [width, height]
 *   270°: (x, y) -> (y, width - 1 - x), dimensi baru: [height, width]
 */
export const operasiRotasi = {
  id: 'dasar_rotasi',
  kategori: 'dasar',
  kunciNama: 'operasi.dasar.rotasi.nama',
  kunciDeskripsi: 'operasi.dasar.rotasi.deskripsi',
  namaTeknis: 'Orthogonal 90-Degree Matrix Rotation',
  skemaParameter: [
    {
      id: 'sudut',
      kunciLabel: 'parameter.sudutRotasi',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 90, kunciLabel: 'parameter.rotasi90' },
        { nilai: 180, kunciLabel: 'parameter.rotasi180' },
        { nilai: 270, kunciLabel: 'parameter.rotasi270' },
      ],
      nilaiAwal: 90,
    },
  ],
  terapkan(citra, parameter = {}) {
    const sudutAngka = Number(parameter.sudut);
    const sudut = [90, 180, 270].includes(sudutAngka) ? sudutAngka : 90;
    const { width, height, data: src } = citra;

    let targetW = width;
    let targetH = height;
    if (sudut === 90 || sudut === 270) {
      targetW = height;
      targetH = width;
    }

    const hasil = buatCitraKosong(targetW, targetH);
    const dst = hasil.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let destX, destY;
        if (sudut === 90) {
          destX = height - 1 - y;
          destY = x;
        } else if (sudut === 180) {
          destX = width - 1 - x;
          destY = height - 1 - y;
        } else {
          // 270 derajat
          destX = y;
          destY = width - 1 - x;
        }

        const srcIdx = (y * width + x) * 4;
        const dstIdx = (destY * targetW + destX) * 4;

        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }
    return hasil;
  },
};

/**
 * Operasi Pemotongan Citra (Crop).
 * Metode: Ekstraksi sub-matriks piksel koordinat [x, y, lebar, tinggi].
 * Rumus inti: dest(dx, dy) = src(x + dx, y + dy)
 * Dilengkapi batasan dimensi dan koordinat aman untuk mencegah memori liar.
 */
export const operasiCrop = {
  id: 'dasar_crop',
  kategori: 'dasar',
  kunciNama: 'operasi.dasar.crop.nama',
  kunciDeskripsi: 'operasi.dasar.crop.deskripsi',
  namaTeknis: 'Rectangular Sub-Matrix Extraction',
  skemaParameter: [
    {
      id: 'x',
      kunciLabel: 'parameter.posisiX',
      tipe: 'angka',
      min: 0,
      max: 4096,
      step: 1,
      nilaiAwal: 0,
      satuan: 'px',
    },
    {
      id: 'y',
      kunciLabel: 'parameter.posisiY',
      tipe: 'angka',
      min: 0,
      max: 4096,
      step: 1,
      nilaiAwal: 0,
      satuan: 'px',
    },
    {
      id: 'lebar',
      kunciLabel: 'parameter.lebarPotong',
      tipe: 'angka',
      min: 1,
      max: 4096,
      step: 1,
      nilaiAwal: 100,
      satuan: 'px',
    },
    {
      id: 'tinggi',
      kunciLabel: 'parameter.tinggiPotong',
      tipe: 'angka',
      min: 1,
      max: 4096,
      step: 1,
      nilaiAwal: 100,
      satuan: 'px',
    },
  ],
  terapkan(citra, parameter = {}, konteksSkala = { rasio: 1.0 }) {
    const { width: srcW, height: srcH, data: src } = citra;
    const rasio =
      Number(konteksSkala?.rasio) > 0 ? Number(konteksSkala.rasio) : 1.0;

    const rawX = Number(parameter.x) * rasio;
    const rawY = Number(parameter.y) * rasio;
    const rawW = Number(parameter.lebar) * rasio;
    const rawH = Number(parameter.tinggi) * rasio;

    const startX = Math.max(
      0,
      Math.min(srcW - 1, Number.isFinite(rawX) ? Math.round(rawX) : 0)
    );
    const startY = Math.max(
      0,
      Math.min(srcH - 1, Number.isFinite(rawY) ? Math.round(rawY) : 0)
    );

    const maxW = srcW - startX;
    const maxH = srcH - startY;

    let cropW = Math.max(
      1,
      Math.min(maxW, Number.isFinite(rawW) ? Math.round(rawW) : maxW)
    );
    let cropH = Math.max(
      1,
      Math.min(maxH, Number.isFinite(rawH) ? Math.round(rawH) : maxH)
    );

    // Menjamin kepatuhan pada batas dimensi maksimum konfigurasi
    cropW = Math.min(BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL, cropW);
    cropH = Math.min(BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL, cropH);

    const hasil = buatCitraKosong(cropW, cropH);
    const dst = hasil.data;

    for (let cy = 0; cy < cropH; cy++) {
      const srcY = startY + cy;
      for (let cx = 0; cx < cropW; cx++) {
        const srcX = startX + cx;
        const srcIdx = (srcY * srcW + srcX) * 4;
        const dstIdx = (cy * cropW + cx) * 4;

        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }
    return hasil;
  },
};

/**
 * Operasi Ubah Ukuran Citra (Resize).
 * Metode: Interpolasi Nearest Neighbor atau Bilinear murni (bukan drawImage).
 * Rumus Nearest: srcX = Math.floor(x * (srcW / dstW)), srcY = Math.floor(y * (srcH / dstH))
 * Rumus Bilinear: f(x, y) = (1-dx)(1-dy)f00 + dx(1-dy)f10 + (1-dx)dy*f01 + dx*dy*f11
 * Menjamin penjepitan ke batas maksimum 4096 px dan 16 juta piksel (spec.md bagian 8).
 */
export const operasiUbahUkuran = {
  id: 'dasar_ubah_ukuran',
  kategori: 'dasar',
  kunciNama: 'operasi.dasar.ubahUkuran.nama',
  kunciDeskripsi: 'operasi.dasar.ubahUkuran.deskripsi',
  namaTeknis: 'Pure Geometric Nearest/Bilinear Resampling',
  skemaParameter: [
    {
      id: 'lebarBaru',
      kunciLabel: 'parameter.lebarBaru',
      tipe: 'slider',
      min: 16,
      max: BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL,
      step: 10,
      nilaiAwal: 400,
      satuan: 'px',
    },
    {
      id: 'tinggiBaru',
      kunciLabel: 'parameter.tinggiBaru',
      tipe: 'slider',
      min: 16,
      max: BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL,
      step: 10,
      nilaiAwal: 300,
      satuan: 'px',
    },
    {
      id: 'metode',
      kunciLabel: 'parameter.metodeInterpolasi',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'bilinear', kunciLabel: 'parameter.bilinear' },
        { nilai: 'nearest', kunciLabel: 'parameter.tetanggaTerdekat' },
      ],
      nilaiAwal: 'bilinear',
    },
  ],
  terapkan(citra, parameter = {}, konteksSkala = { rasio: 1.0 }) {
    const { width: srcW, height: srcH, data: src } = citra;
    const rasio =
      Number(konteksSkala?.rasio) > 0 ? Number(konteksSkala.rasio) : 1.0;

    const rawW = Number(parameter.lebarBaru) * rasio;
    const rawH = Number(parameter.tinggiBaru) * rasio;
    const parsedW = Number.isFinite(rawW) ? rawW : srcW;
    const parsedH = Number.isFinite(rawH) ? rawH : srcH;

    let targetW = Math.max(
      1,
      Math.min(BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL, Math.round(parsedW))
    );
    let targetH = Math.max(
      1,
      Math.min(BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL, Math.round(parsedH))
    );

    // Validasi batas total piksel (16 juta piksel)
    if (targetW * targetH > BATASAN_BERKAS.TOTAL_PIKSEL_MAKS) {
      const skala = Math.sqrt(
        BATASAN_BERKAS.TOTAL_PIKSEL_MAKS / (targetW * targetH)
      );
      targetW = Math.max(1, Math.floor(targetW * skala));
      targetH = Math.max(1, Math.floor(targetH * skala));
    }

    const opsiMetode = ['nearest', 'bilinear'];
    const metode = opsiMetode.includes(parameter.metode)
      ? parameter.metode
      : 'bilinear';

    const hasil = buatCitraKosong(targetW, targetH);
    const dst = hasil.data;

    const skalaX = srcW / targetW;
    const skalaY = srcH / targetH;

    if (metode === 'nearest') {
      // Interpolasi Tetangga Terdekat (Nearest Neighbor)
      for (let y = 0; y < targetH; y++) {
        const srcY = Math.min(srcH - 1, Math.floor(y * skalaY));
        for (let x = 0; x < targetW; x++) {
          const srcX = Math.min(srcW - 1, Math.floor(x * skalaX));
          const srcIdx = (srcY * srcW + srcX) * 4;
          const dstIdx = (y * targetW + x) * 4;

          dst[dstIdx] = src[srcIdx];
          dst[dstIdx + 1] = src[srcIdx + 1];
          dst[dstIdx + 2] = src[srcIdx + 2];
          dst[dstIdx + 3] = src[srcIdx + 3];
        }
      }
    } else {
      // Interpolasi Bilinear
      for (let y = 0; y < targetH; y++) {
        const srcYFloat = (y + 0.5) * skalaY - 0.5;
        const y0 = Math.max(0, Math.floor(srcYFloat));
        const y1 = Math.min(srcH - 1, y0 + 1);
        const dy = Math.max(0, Math.min(1, srcYFloat - y0));

        for (let x = 0; x < targetW; x++) {
          const srcXFloat = (x + 0.5) * skalaX - 0.5;
          const x0 = Math.max(0, Math.floor(srcXFloat));
          const x1 = Math.min(srcW - 1, x0 + 1);
          const dx = Math.max(0, Math.min(1, srcXFloat - x0));

          const w00 = (1 - dx) * (1 - dy);
          const w10 = dx * (1 - dy);
          const w01 = (1 - dx) * dy;
          const w11 = dx * dy;

          const i00 = (y0 * srcW + x0) * 4;
          const i10 = (y0 * srcW + x1) * 4;
          const i01 = (y1 * srcW + x0) * 4;
          const i11 = (y1 * srcW + x1) * 4;

          const dstIdx = (y * targetW + x) * 4;

          dst[dstIdx] = clamp(
            src[i00] * w00 + src[i10] * w10 + src[i01] * w01 + src[i11] * w11
          );
          dst[dstIdx + 1] = clamp(
            src[i00 + 1] * w00 +
              src[i10 + 1] * w10 +
              src[i01 + 1] * w01 +
              src[i11 + 1] * w11
          );
          dst[dstIdx + 2] = clamp(
            src[i00 + 2] * w00 +
              src[i10 + 2] * w10 +
              src[i01 + 2] * w01 +
              src[i11 + 2] * w11
          );
          dst[dstIdx + 3] = clamp(
            src[i00 + 3] * w00 +
              src[i10 + 3] * w10 +
              src[i01 + 3] * w01 +
              src[i11 + 3] * w11
          );
        }
      }
    }

    return hasil;
  },
};
