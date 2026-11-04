/**
 * Operasi Citra Biner (spec.md bagian 4 & Tahap 4).
 * Semua fungsi beroperasi pada luminans Rec.601 dan menghasilkan citra monokrom biner (0 atau 255).
 * Nilai kanal alfa (A) selalu dipertahankan utuh tanpa alokasi objek per piksel.
 */

import {
  ambilJumlahJendelaIntegral,
  bangunCitraIntegral,
  ekstrakLuminansRec601,
  hitungAmbangOtsu,
} from './spasial/utilitasKonvolusi';
import { buatCitraKosong } from './utilitasCitra';

/**
 * Operasi Pengambangan Manual (Manual Thresholding).
 * Rumus inti:
 *   Normal:   Y' = 255 jika Y > ambang, selain itu 0
 *   Inversi:  Y' = 255 jika Y <= ambang, selain itu 0
 */
export const operasiBinerManual = {
  id: 'biner_manual',
  kategori: 'biner',
  kunciNama: 'operasi.biner.manual.nama',
  kunciDeskripsi: 'operasi.biner.manual.deskripsi',
  namaTeknis: 'Global Fixed Thresholding',
  skemaParameter: [
    {
      id: 'ambang',
      kunciLabel: 'parameter.ambang',
      tipe: 'slider',
      min: 0,
      max: 255,
      step: 1,
      nilaiAwal: 128,
      satuan: '',
    },
    {
      id: 'inversi',
      kunciLabel: 'parameter.inversi',
      tipe: 'sakelar',
      nilaiAwal: false,
    },
  ],
  terapkan(citra, parameter = {}) {
    let t = Number(parameter.ambang);
    if (!Number.isFinite(t)) t = 128;
    t = Math.max(0, Math.min(255, Math.round(t)));
    const inversi = Boolean(parameter.inversi);

    const { width, height, data: src } = citra;
    const hasil = buatCitraKosong(width, height);
    const dst = hasil.data;
    const len = src.length;

    for (let i = 0; i < len; i += 4) {
      // Hitung luminans Rec.601 cepat
      const y =
        ((299 * src[i] + 587 * src[i + 1] + 114 * src[i + 2] + 500) / 1000) | 0;

      const putih = inversi ? y <= t : y > t;
      const biner = putih ? 255 : 0;

      dst[i] = biner;
      dst[i + 1] = biner;
      dst[i + 2] = biner;
      dst[i + 3] = src[i + 3];
    }

    return hasil;
  },
};

/**
 * Operasi Pengambangan Otsu (Otsu Thresholding).
 * Memilih ambang t optimal secara otomatis yang memaksimalkan varians antar-kelas:
 *   σ_B^2(t) = ω_0(t) * ω_1(t) * [μ_0(t) - μ_1(t)]^2
 */
export const operasiBinerOtsu = {
  id: 'biner_otsu',
  kategori: 'biner',
  kunciNama: 'operasi.biner.otsu.nama',
  kunciDeskripsi: 'operasi.biner.otsu.deskripsi',
  namaTeknis: "Otsu's Global Optimum Thresholding",
  skemaParameter: [
    {
      id: 'inversi',
      kunciLabel: 'parameter.inversi',
      tipe: 'sakelar',
      nilaiAwal: false,
    },
  ],
  terapkan(citra, parameter = {}) {
    const inversi = Boolean(parameter.inversi);
    const { width, height, data: src } = citra;

    const lum = ekstrakLuminansRec601(citra);
    const ambangOtsu = hitungAmbangOtsu(lum);

    const hasil = buatCitraKosong(width, height);
    const dst = hasil.data;
    const len = src.length;

    for (let i = 0, j = 0; i < len; i += 4, j++) {
      const y = lum[j];
      const putih = inversi ? y <= ambangOtsu : y > ambangOtsu;
      const biner = putih ? 255 : 0;

      dst[i] = biner;
      dst[i + 1] = biner;
      dst[i + 2] = biner;
      dst[i + 3] = src[i + 3];
    }

    // Sertakan ambang terpilih pada objek hasil untuk keperluan inspeksi / UI
    hasil.metadataOperasi = { ambangTerhitung: ambangOtsu };
    hasil.metadata = { ambangTerhitung: ambangOtsu };
    return hasil;
  },
};

/**
 * Operasi Pengambangan Adaptif (Adaptive Local Thresholding via Integral Image).
 * Menghitung nilai ambang lokal dinamis per jendela:
 *   T(x,y) = Rata-rata jendela (ukuran ganjil) - C
 *   Y' = 255 jika Y > T(x,y), selain itu 0
 */
export const operasiBinerAdaptif = {
  id: 'biner_adaptif',
  kategori: 'biner',
  kunciNama: 'operasi.biner.adaptif.nama',
  kunciDeskripsi: 'operasi.biner.adaptif.deskripsi',
  namaTeknis: 'Adaptive Mean-C Local Thresholding',
  skemaParameter: [
    {
      id: 'jendela',
      kunciLabel: 'parameter.jendelaAdaptif',
      tipe: 'slider',
      min: 3,
      max: 99,
      step: 2,
      nilaiAwal: 15,
      satuan: 'px',
    },
    {
      id: 'c',
      kunciLabel: 'parameter.konstantaC',
      tipe: 'slider',
      min: -50,
      max: 50,
      step: 1,
      nilaiAwal: 5,
      satuan: '',
    },
    {
      id: 'inversi',
      kunciLabel: 'parameter.inversi',
      tipe: 'sakelar',
      nilaiAwal: false,
    },
  ],
  terapkan(citra, parameter = {}, konteksSkala = { rasio: 1.0 }) {
    let jRaw = Number(parameter.jendela);
    if (!Number.isFinite(jRaw)) jRaw = 15;

    // Skala parameter jendela untuk preview responsif jika rasio < 1.0
    const rasio =
      konteksSkala && Number.isFinite(konteksSkala.rasio)
        ? konteksSkala.rasio
        : 1.0;
    let jendelaEfektif = Math.round(jRaw * rasio);
    if (jendelaEfektif % 2 === 0) jendelaEfektif += 1;
    jendelaEfektif = Math.max(3, Math.min(151, jendelaEfektif));

    let c = Number(parameter.c);
    if (!Number.isFinite(c)) c = 5;
    const inversi = Boolean(parameter.inversi);

    const { width, height, data: src } = citra;
    const lum = ekstrakLuminansRec601(citra);
    const integral = bangunCitraIntegral(lum, width, height, -1);
    const wInt = width + 1;

    const r = Math.floor(jendelaEfektif / 2);
    const hasil = buatCitraKosong(width, height);
    const dst = hasil.data;

    for (let y = 0; y < height; y++) {
      const y1 = Math.max(0, y - r);
      const y2 = Math.min(height - 1, y + r);
      const yOffset = y * width;

      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - r);
        const x2 = Math.min(width - 1, x + r);
        const area = (x2 - x1 + 1) * (y2 - y1 + 1);

        const sumLum = ambilJumlahJendelaIntegral(integral, wInt, x1, y1, x2, y2);
        const ambangLokal = sumLum / area - c;

        const srcIdx = (yOffset + x) * 4;
        const yVal = lum[yOffset + x];

        const putih = inversi ? yVal <= ambangLokal : yVal > ambangLokal;
        const biner = putih ? 255 : 0;

        dst[srcIdx] = biner;
        dst[srcIdx + 1] = biner;
        dst[srcIdx + 2] = biner;
        dst[srcIdx + 3] = src[srcIdx + 3];
      }
    }

    return hasil;
  },
};
