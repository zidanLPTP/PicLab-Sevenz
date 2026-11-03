/**
 * Operasi Enhancement Citra PicLab Sevenz (spec.md bagian 4).
 * Semua fungsi adalah fungsi murni yang menerima { data, width, height }
 * dan parameter, lalu mengembalikan objek citra baru tanpa memutasi masukan.
 */

import {
  buatCitraKosong,
  buatTabelPencarian,
  clamp,
  hitungHistogram,
} from './utilitasCitra';

/**
 * Operasi Ekualisasi Histogram (Histogram Equalization).
 * Metode: Perataan distribusi intensitas piksel melalui Cumulative Distribution Function (CDF).
 * Mode default: Pada kanal luminans (menjaga hue dan saturasi alami citra).
 *   - Rumus rasio luminans per piksel:
 *     Y = round(0.299*R + 0.587*G + 0.114*B)
 *     Y' = round(((CDF(Y) - CDF_min) / (TotalPiksel - CDF_min)) * 255)
 *     Jika Y == 0 -> R'=G'=B'=Y'
 *     Jika Y > 0  -> rasio = Y' / Y
 *                    R' = clamp(R * rasio)
 *                    G' = clamp(G * rasio)
 *                    B' = clamp(B * rasio)
 *     Jika hasil melebihi 255, fungsi clamp() menjepit nilai ke 255.
 *   - Kasus citra seragam: jika seluruh piksel bernilai sama, totalPiksel <= cdfMin,
 *     fungsi menghasilkan LUT(v) = v untuk mencegah pembagian nol (0 / 0).
 * Mode alternatif: Per-kanal RGB individual melalui LUT CDF masing-masing kanal.
 */
export const operasiEkualisasi = {
  id: 'enhancement_ekualisasi',
  kategori: 'enhancement',
  kunciNama: 'operasi.enhancement.ekualisasi.nama',
  kunciDeskripsi: 'operasi.enhancement.ekualisasi.deskripsi',
  namaTeknis: 'Cumulative Distribution Function (CDF) Histogram Equalization',
  skemaParameter: [
    {
      id: 'mode',
      kunciLabel: 'parameter.modeEkualisasi',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'luminans', kunciLabel: 'parameter.ekualisasiLuminans' },
        { nilai: 'per_kanal', kunciLabel: 'parameter.ekualisasiPerKanal' },
      ],
      nilaiAwal: 'luminans',
    },
  ],
  terapkan(citra, parameter = {}) {
    const opsiMode = ['luminans', 'per_kanal'];
    const mode = opsiMode.includes(parameter.mode)
      ? parameter.mode
      : 'luminans';

    const { width, height, data: src } = citra;
    const totalPiksel = width * height;
    if (totalPiksel === 0)
      return { ...citra, data: new Uint8ClampedArray(citra.data) };

    const hasil = buatCitraKosong(width, height);
    const dst = hasil.data;
    const len = src.length;

    // Helper untuk menghitung LUT dari histogram 256 nilai via CDF
    function hitungLutCdf(hist) {
      let cdfMin = -1;
      let kumulatif = 0;
      const lut = new Uint8Array(256);

      for (let i = 0; i < 256; i++) {
        kumulatif += hist[i];
        if (cdfMin === -1 && kumulatif > 0) {
          cdfMin = kumulatif;
        }

        // Perlindungan kasus citra seragam: jika totalPiksel <= cdfMin, cegah pembagian nol
        if (cdfMin === -1 || totalPiksel <= cdfMin) {
          lut[i] = i;
        } else {
          lut[i] = clamp(
            Math.round(((kumulatif - cdfMin) / (totalPiksel - cdfMin)) * 255)
          );
        }
      }
      return lut;
    }

    if (mode === 'per_kanal') {
      // Ekualisasi per kanal independen (R, G, B)
      const hist = hitungHistogram(citra);
      const lutR = hitungLutCdf(hist.r);
      const lutG = hitungLutCdf(hist.g);
      const lutB = hitungLutCdf(hist.b);

      for (let i = 0; i < len; i += 4) {
        dst[i] = lutR[src[i]];
        dst[i + 1] = lutG[src[i + 1]];
        dst[i + 2] = lutB[src[i + 2]];
        dst[i + 3] = src[i + 3];
      }
    } else {
      // Default: Ekualisasi pada Luminans (menjaga integritas warna)
      const histY = new Uint32Array(256);
      for (let i = 0; i < len; i += 4) {
        const y =
          ((299 * src[i] + 587 * src[i + 1] + 114 * src[i + 2] + 500) / 1000) |
          0;
        histY[y]++;
      }
      const lutY = hitungLutCdf(histY);

      for (let i = 0; i < len; i += 4) {
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const yLama = ((299 * r + 587 * g + 114 * b + 500) / 1000) | 0;
        const yBaru = lutY[yLama];

        if (yLama === 0) {
          dst[i] = yBaru;
          dst[i + 1] = yBaru;
          dst[i + 2] = yBaru;
        } else {
          // Rasio luminans per piksel diskalakan ke kanal warna
          const rasio = yBaru / yLama;
          // Hasil di atas 255 dijepit secara otomatis oleh Uint8ClampedArray
          dst[i] = r * rasio;
          dst[i + 1] = g * rasio;
          dst[i + 2] = b * rasio;
        }
        dst[i + 3] = src[i + 3];
      }
    }

    return hasil;
  },
};

/**
 * Operasi Peregangan Kontras (Contrast Stretching).
 * Metode: Normalisasi rentang dinamis min-max dengan pemangkasan persentil ekstrem.
 * Rumus inti:
 *   V' = round(((clamp(V, vMin, vMax) - vMin) / (vMax - vMin)) * 255)
 *   Kasus vMax <= vMin: vMin disetel 0 dan vMax disetel 255 untuk mencegah pembagian nol.
 */
export const operasiPereganganKontras = {
  id: 'enhancement_peregangan_kontras',
  kategori: 'enhancement',
  kunciNama: 'operasi.enhancement.pereganganKontras.nama',
  kunciDeskripsi: 'operasi.enhancement.pereganganKontras.deskripsi',
  namaTeknis: 'Min-Max Dynamic Range Normalization with Percentile Clipping',
  skemaParameter: [
    {
      id: 'pemangkasan',
      kunciLabel: 'parameter.persentilPangkas',
      tipe: 'slider',
      min: 0,
      max: 5,
      step: 0.5,
      nilaiAwal: 1,
      satuan: '%',
    },
  ],
  terapkan(citra, parameter = {}) {
    let p = Number(parameter.pemangkasan);
    if (!Number.isFinite(p)) p = 1;
    p = Math.max(0, Math.min(5, p));
    const persentil = p / 100;

    const { width, height, data: src } = citra;
    const len = src.length;
    const totalPiksel = width * height;
    if (totalPiksel === 0)
      return { ...citra, data: new Uint8ClampedArray(citra.data) };

    const lumHist = new Uint32Array(256);
    for (let i = 0; i < len; i += 4) {
      const y =
        ((299 * src[i] + 587 * src[i + 1] + 114 * src[i + 2] + 500) / 1000) | 0;
      lumHist[y]++;
    }

    // Cari vMin dan vMax dengan pemangkasan persentil
    const ambangBawah = Math.round(totalPiksel * persentil);
    const ambangAtas = Math.round(totalPiksel * (1 - persentil));

    let kumulatif = 0;
    let vMin = 0;
    for (let i = 0; i < 256; i++) {
      kumulatif += lumHist[i];
      if (kumulatif > ambangBawah) {
        vMin = i;
        break;
      }
    }

    kumulatif = 0;
    let vMax = 255;
    for (let i = 0; i < 256; i++) {
      kumulatif += lumHist[i];
      if (kumulatif >= ambangAtas) {
        vMax = i;
        break;
      }
    }

    // Penanganan kasus tepi jika vMax <= vMin (misal citra kontras datar)
    if (vMax <= vMin) {
      vMin = 0;
      vMax = 255;
    }

    const rentang = vMax - vMin;
    const lut = buatTabelPencarian((v) => {
      const vTerpangkas = Math.max(vMin, Math.min(vMax, v));
      return ((vTerpangkas - vMin) / rentang) * 255;
    });

    const hasil = buatCitraKosong(width, height);
    const dst = hasil.data;

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
 * Operasi Koreksi Gamma (Gamma Correction).
 * Metode: Transformasi kurva daya non-linear fotometrik via LUT.
 * Rumus inti: V' = round(255 * (V / 255)^gamma)
 */
export const operasiGamma = {
  id: 'enhancement_gamma',
  kategori: 'enhancement',
  kunciNama: 'operasi.enhancement.gamma.nama',
  kunciDeskripsi: 'operasi.enhancement.gamma.deskripsi',
  namaTeknis: 'Non-Linear Power-Law (Gamma) Photometric Transform',
  skemaParameter: [
    {
      id: 'gamma',
      kunciLabel: 'parameter.nilaiGamma',
      tipe: 'slider',
      min: 0.1,
      max: 4.0,
      step: 0.05,
      nilaiAwal: 1.0,
      satuan: '',
    },
  ],
  terapkan(citra, parameter = {}) {
    let g = Number(parameter.gamma);
    if (!Number.isFinite(g) || g <= 0) g = 1.0;
    g = Math.max(0.1, Math.min(4.0, g));

    if (g === 1.0) return { ...citra, data: new Uint8ClampedArray(citra.data) };

    const lut = buatTabelPencarian((v) => 255 * Math.pow(v / 255, g));
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
