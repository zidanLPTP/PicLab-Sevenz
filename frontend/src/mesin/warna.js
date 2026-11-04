/**
 * Operasi Citra Warna PicLab Sevenz (spec.md bagian 4).
 * Semua fungsi adalah fungsi murni yang menerima { data, width, height }
 * dan parameter, lalu mengembalikan objek citra baru tanpa memutasi masukan.
 */

import { buatCitraKosong, buatTabelPencarian } from './utilitasCitra';

/**
 * Operasi Pemisah Kanal RGB.
 * Metode: Isolasi kanal warna individual menjadi citra monokrom atau berwarna.
 * Rumus inti:
 *   Mode berwarna: R'=R, G'=0, B'=0 (untuk kanal merah)
 *   Mode keabuan:  R'=R, G'=R, B'=R (untuk kanal merah)
 */
export const operasiPisahKanal = {
  id: 'warna_pisah_kanal',
  kategori: 'warna',
  kunciNama: 'operasi.warna.pisahKanal.nama',
  kunciDeskripsi: 'operasi.warna.pisahKanal.deskripsi',
  namaTeknis: 'Color Channel Isolation (RGB Split)',
  skemaParameter: [
    {
      id: 'kanal',
      kunciLabel: 'parameter.pilihKanal',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'r', kunciLabel: 'parameter.kanalMerah' },
        { nilai: 'g', kunciLabel: 'parameter.kanalHijau' },
        { nilai: 'b', kunciLabel: 'parameter.kanalBiru' },
      ],
      nilaiAwal: 'r',
    },
    {
      id: 'modeTampil',
      kunciLabel: 'parameter.modeTampil',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'keabuan', kunciLabel: 'parameter.tampilKeabuan' },
        { nilai: 'berwarna', kunciLabel: 'parameter.tampilBerwarna' },
      ],
      nilaiAwal: 'keabuan',
    },
  ],
  terapkan(citra, parameter = {}) {
    const opsiKanal = ['r', 'g', 'b'];
    const kanal = opsiKanal.includes(parameter.kanal) ? parameter.kanal : 'r';

    const opsiMode = ['keabuan', 'berwarna'];
    const mode = opsiMode.includes(parameter.modeTampil)
      ? parameter.modeTampil
      : 'keabuan';

    const hasil = buatCitraKosong(citra.width, citra.height);
    const src = citra.data;
    const dst = hasil.data;
    const len = src.length;

    const offsetKanal = kanal === 'r' ? 0 : kanal === 'g' ? 1 : 2;

    for (let i = 0; i < len; i += 4) {
      const val = src[i + offsetKanal];
      if (mode === 'keabuan') {
        dst[i] = val;
        dst[i + 1] = val;
        dst[i + 2] = val;
      } else {
        dst[i] = kanal === 'r' ? val : 0;
        dst[i + 1] = kanal === 'g' ? val : 0;
        dst[i + 2] = kanal === 'b' ? val : 0;
      }
      dst[i + 3] = src[i + 3];
    }
    return hasil;
  },
};

/**
 * Operasi Ruang Warna (Color Space Representation).
 * Metode: Transformasi ke representasi Grayscale atau kanal HSV sebagai citra.
 * Rumus inti:
 *   Grayscale: Rec.601 (0.299R + 0.587G + 0.114B)
 *   HSV Hue:   H (0..360) dipetakan ke 0..255: round(H * 255 / 360)
 *   HSV Sat:   S (0..1) dipetakan ke 0..255: round(S * 255)
 *   HSV Val:   V (0..1) dipetakan ke 0..255: round(V * 255)
 */
export const operasiRuangWarna = {
  id: 'warna_ruang_warna',
  kategori: 'warna',
  kunciNama: 'operasi.warna.ruangWarna.nama',
  kunciDeskripsi: 'operasi.warna.ruangWarna.deskripsi',
  namaTeknis: 'Color Space Decomposition (RGB to HSV / Grayscale)',
  skemaParameter: [
    {
      id: 'ruang',
      kunciLabel: 'parameter.pilihRuangWarna',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'grayscale', kunciLabel: 'parameter.ruangGrayscale' },
        { nilai: 'hsv_h', kunciLabel: 'parameter.ruangHsvH' },
        { nilai: 'hsv_s', kunciLabel: 'parameter.ruangHsvS' },
        { nilai: 'hsv_v', kunciLabel: 'parameter.ruangHsvV' },
      ],
      nilaiAwal: 'hsv_s',
    },
  ],
  terapkan(citra, parameter = {}) {
    const opsiRuang = ['grayscale', 'hsv_h', 'hsv_s', 'hsv_v'];
    const ruang = opsiRuang.includes(parameter.ruang)
      ? parameter.ruang
      : 'hsv_s';

    const hasil = buatCitraKosong(citra.width, citra.height);
    const src = citra.data;
    const dst = hasil.data;
    const len = src.length;

    if (ruang === 'grayscale') {
      for (let i = 0; i < len; i += 4) {
        const v =
          ((299 * src[i] + 587 * src[i + 1] + 114 * src[i + 2] + 500) / 1000) |
          0;
        dst[i] = v;
        dst[i + 1] = v;
        dst[i + 2] = v;
        dst[i + 3] = src[i + 3];
      }
    } else if (ruang === 'hsv_v') {
      for (let i = 0; i < len; i += 4) {
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const v = r > g ? (r > b ? r : b) : g > b ? g : b;
        dst[i] = v;
        dst[i + 1] = v;
        dst[i + 2] = v;
        dst[i + 3] = src[i + 3];
      }
    } else if (ruang === 'hsv_s') {
      for (let i = 0; i < len; i += 4) {
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const max = r > g ? (r > b ? r : b) : g > b ? g : b;
        let v = 0;
        if (max > 0) {
          const min = r < g ? (r < b ? r : b) : g < b ? g : b;
          v = Math.round(((max - min) / max) * 255);
        }
        dst[i] = v;
        dst[i + 1] = v;
        dst[i + 2] = v;
        dst[i + 3] = src[i + 3];
      }
    } else {
      // hsv_h
      for (let i = 0; i < len; i += 4) {
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const max = r > g ? (r > b ? r : b) : g > b ? g : b;
        const min = r < g ? (r < b ? r : b) : g < b ? g : b;
        const d = max - min;
        let v = 0;
        if (d > 0) {
          let h = 0;
          if (max === r) h = ((g - b) / d) % 6;
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h *= 60;
          if (h < 0) h += 360;
          v = Math.round((h / 360) * 255);
        }
        dst[i] = v;
        dst[i + 1] = v;
        dst[i + 2] = v;
        dst[i + 3] = src[i + 3];
      }
    }
    return hasil;
  },
};

/**
 * Operasi Saturasi Warna.
 * Metode: Interpolasi linear antara intensitas luminans Y dan nilai warna asli.
 * Rumus inti: faktor = 1 + (saturasi / 100)
 *             C' = clamp(Y + faktor * (C - Y))
 */
export const operasiSaturasi = {
  id: 'warna_saturasi',
  kategori: 'warna',
  kunciNama: 'operasi.warna.saturasi.nama',
  kunciDeskripsi: 'operasi.warna.saturasi.deskripsi',
  namaTeknis: 'Luminance-Preserving Saturation Scaling',
  skemaParameter: [
    {
      id: 'saturasi',
      kunciLabel: 'parameter.saturasi',
      tipe: 'slider',
      min: -100,
      max: 100,
      step: 1,
      nilaiAwal: 0,
      satuan: '%',
    },
  ],
  terapkan(citra, parameter = {}) {
    let sat = Number(parameter.saturasi);
    if (!Number.isFinite(sat)) sat = 0;
    sat = Math.max(-100, Math.min(100, sat));

    if (sat === 0) return { ...citra, data: new Uint8ClampedArray(citra.data) };

    const faktor = 1 + sat / 100;
    const hasil = buatCitraKosong(citra.width, citra.height);
    const src = citra.data;
    const dst = hasil.data;
    const len = src.length;

    for (let i = 0; i < len; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      dst[i] = Math.round(y + faktor * (r - y));
      dst[i + 1] = Math.round(y + faktor * (g - y));
      dst[i + 2] = Math.round(y + faktor * (b - y));
      dst[i + 3] = src[i + 3];
    }
    return hasil;
  },
};

/**
 * Operasi Pergeseran Hue (Hue Shift).
 * Metode: Transformasi RGB -> HSV -> pergeseran sudut Hue -> RGB (inlined zero-allocation).
 * Rumus inti: H' = (H + pergeseran + 360) % 360
 */
export const operasiHue = {
  id: 'warna_hue',
  kategori: 'warna',
  kunciNama: 'operasi.warna.hue.nama',
  kunciDeskripsi: 'operasi.warna.hue.deskripsi',
  namaTeknis: 'Circular Hue Angle Rotation in HSV Space',
  skemaParameter: [
    {
      id: 'pergeseran',
      kunciLabel: 'parameter.pergeseranHue',
      tipe: 'slider',
      min: -180,
      max: 180,
      step: 1,
      nilaiAwal: 0,
      satuan: '°',
    },
  ],
  terapkan(citra, parameter = {}) {
    let shift = Number(parameter.pergeseran);
    if (!Number.isFinite(shift)) shift = 0;
    shift = Math.max(-180, Math.min(180, shift));

    if (shift === 0)
      return { ...citra, data: new Uint8ClampedArray(citra.data) };

    const hasil = buatCitraKosong(citra.width, citra.height);
    const src = citra.data;
    const dst = hasil.data;
    const len = src.length;

    for (let i = 0; i < len; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      if (r === g && g === b) {
        dst[i] = r;
        dst[i + 1] = g;
        dst[i + 2] = b;
        dst[i + 3] = src[i + 3];
        continue;
      }

      const max = r > g ? (r > b ? r : b) : g > b ? g : b;
      const min = r < g ? (r < b ? r : b) : g < b ? g : b;
      const d = max - min;

      let h = 0;
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;

      let newH = (h + shift) % 360;
      if (newH < 0) newH += 360;

      const hNorm = newH / 60;
      const x = d * (1 - Math.abs((hNorm % 2) - 1));
      const sector = hNorm | 0;

      let r1 = 0,
        g1 = 0,
        b1 = 0;
      if (sector === 0) {
        r1 = d;
        g1 = x;
        b1 = 0;
      } else if (sector === 1) {
        r1 = x;
        g1 = d;
        b1 = 0;
      } else if (sector === 2) {
        r1 = 0;
        g1 = d;
        b1 = x;
      } else if (sector === 3) {
        r1 = 0;
        g1 = x;
        b1 = d;
      } else if (sector === 4) {
        r1 = x;
        g1 = 0;
        b1 = d;
      } else {
        r1 = d;
        g1 = 0;
        b1 = x;
      }

      dst[i] = r1 + min;
      dst[i + 1] = g1 + min;
      dst[i + 2] = b1 + min;
      dst[i + 3] = src[i + 3];
    }
    return hasil;
  },
};

/**
 * Operasi Efek Sepia (Sepia Tone).
 * Metode: Transformasi matriks afinitas warna sepia klasik (precalculated 3x3 coefficients).
 * Rumus inti:
 *   R_sepia = clamp(0.393*R + 0.769*G + 0.189*B)
 *   G_sepia = clamp(0.349*R + 0.686*G + 0.168*B)
 *   B_sepia = clamp(0.272*R + 0.534*G + 0.131B)
 *   C' = (1 - intensitas) * C + intensitas * C_sepia
 */
export const operasiSepia = {
  id: 'warna_sepia',
  kategori: 'warna',
  kunciNama: 'operasi.warna.sepia.nama',
  kunciDeskripsi: 'operasi.warna.sepia.deskripsi',
  namaTeknis: 'Affine Matrix Sepia Tinting with Blend Factor',
  skemaParameter: [
    {
      id: 'intensitas',
      kunciLabel: 'parameter.intensitasSepia',
      tipe: 'slider',
      min: 0,
      max: 100,
      step: 1,
      nilaiAwal: 80,
      satuan: '%',
    },
  ],
  terapkan(citra, parameter = {}) {
    let kRaw = Number(parameter.intensitas);
    if (!Number.isFinite(kRaw)) kRaw = 80;
    const k = Math.max(0, Math.min(100, kRaw)) / 100;

    if (k === 0) return { ...citra, data: new Uint8ClampedArray(citra.data) };

    const invK = 1 - k;
    const hasil = buatCitraKosong(citra.width, citra.height);
    const src = citra.data;
    const dst = hasil.data;
    const len = src.length;

    for (let i = 0; i < len; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      let rSepia = 0.393 * r + 0.769 * g + 0.189 * b;
      if (rSepia > 255) rSepia = 255;
      let gSepia = 0.349 * r + 0.686 * g + 0.168 * b;
      if (gSepia > 255) gSepia = 255;
      let bSepia = 0.272 * r + 0.534 * g + 0.131 * b;
      if (bSepia > 255) bSepia = 255;

      dst[i] = invK * r + k * rSepia;
      dst[i + 1] = invK * g + k * gSepia;
      dst[i + 2] = invK * b + k * bSepia;
      dst[i + 3] = src[i + 3];
    }
    return hasil;
  },
};

/**
 * Operasi Keseimbangan Warna (Color Balance).
 * Metode: Penguatan independen per kanal merah, hijau, dan biru via LUT.
 * Rumus inti: C' = clamp(C * (1 + penguatan / 100))
 */
export const operasiBalanceWarna = {
  id: 'warna_balance',
  kategori: 'warna',
  kunciNama: 'operasi.warna.balance.nama',
  kunciDeskripsi: 'operasi.warna.balance.deskripsi',
  namaTeknis: 'Independent RGB Channel Gain Adjustment',
  skemaParameter: [
    {
      id: 'merah',
      kunciLabel: 'parameter.penguatanMerah',
      tipe: 'slider',
      min: -100,
      max: 100,
      step: 1,
      nilaiAwal: 0,
      satuan: '',
    },
    {
      id: 'hijau',
      kunciLabel: 'parameter.penguatanHijau',
      tipe: 'slider',
      min: -100,
      max: 100,
      step: 1,
      nilaiAwal: 0,
      satuan: '',
    },
    {
      id: 'biru',
      kunciLabel: 'parameter.penguatanBiru',
      tipe: 'slider',
      min: -100,
      max: 100,
      step: 1,
      nilaiAwal: 0,
      satuan: '',
    },
  ],
  terapkan(citra, parameter = {}) {
    let m = Number(parameter.merah);
    let h = Number(parameter.hijau);
    let b = Number(parameter.biru);
    if (!Number.isFinite(m)) m = 0;
    if (!Number.isFinite(h)) h = 0;
    if (!Number.isFinite(b)) b = 0;
    m = Math.max(-100, Math.min(100, m));
    h = Math.max(-100, Math.min(100, h));
    b = Math.max(-100, Math.min(100, b));

    const gainR = 1 + m / 100;
    const gainG = 1 + h / 100;
    const gainB = 1 + b / 100;

    const lutR = buatTabelPencarian((v) => v * gainR);
    const lutG = buatTabelPencarian((v) => v * gainG);
    const lutB = buatTabelPencarian((v) => v * gainB);

    const hasil = buatCitraKosong(citra.width, citra.height);
    const src = citra.data;
    const dst = hasil.data;
    const len = src.length;

    for (let i = 0; i < len; i += 4) {
      dst[i] = lutR[src[i]];
      dst[i + 1] = lutG[src[i + 1]];
      dst[i + 2] = lutB[src[i + 2]];
      dst[i + 3] = src[i + 3];
    }
    return hasil;
  },
};
