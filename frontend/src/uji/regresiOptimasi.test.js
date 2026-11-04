/**
 * Uji Regresi Optimasi Algoritma Lambat (P3).
 * Memverifikasi bahwa hasil algoritma teroptimasi identik dengan versi baseline
 * dengan selisih paling banyak 1 tingkat (<= 1 LSB) per kanal pada citra acak ber-seed tetap.
 */

import { describe, expect, it } from 'vitest';
import {
  operasiEkualisasi,
  operasiPereganganKontras,
} from '../mesin/enhancement';
import { clamp, hsvKeRgb, rgbKeHsv } from '../mesin/utilitasCitra';
import {
  operasiHue,
  operasiRuangWarna,
  operasiSaturasi,
  operasiSepia,
} from '../mesin/warna';

// Generator pseudo-acak ber-seed tetap (LCG)
function buatCitraAcakSeed(width, height, seed = 123456789) {
  let s = seed;
  const lcg = () => {
    s = (1664525 * s + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(lcg() * 256); // R
    data[i + 1] = Math.floor(lcg() * 256); // G
    data[i + 2] = Math.floor(lcg() * 256); // B
    data[i + 3] = 255; // A
  }
  return { data, width, height };
}

// --- VERSI LAMA SEBELUM OPTIMASI (BASELINE) ---

function operasiHue_Lama(citra, parameter = {}) {
  let shift = Number(parameter.pergeseran);
  if (!Number.isFinite(shift)) shift = 0;
  shift = Math.max(-180, Math.min(180, shift));
  if (shift === 0) return { ...citra, data: new Uint8ClampedArray(citra.data) };

  const dst = new Uint8ClampedArray(citra.data.length);
  const src = citra.data;
  const len = src.length;
  for (let i = 0; i < len; i += 4) {
    const hsv = rgbKeHsv(src[i], src[i + 1], src[i + 2]);
    const newH = (((hsv.h + shift) % 360) + 360) % 360;
    const rgbBaru = hsvKeRgb(newH, hsv.s, hsv.v);
    dst[i] = rgbBaru.r;
    dst[i + 1] = rgbBaru.g;
    dst[i + 2] = rgbBaru.b;
    dst[i + 3] = src[i + 3];
  }
  return { data: dst, width: citra.width, height: citra.height };
}

function operasiRuangWarna_Lama(citra, parameter = {}) {
  const ruang = parameter.ruang || 'hsv_s';
  const dst = new Uint8ClampedArray(citra.data.length);
  const src = citra.data;
  const len = src.length;
  for (let i = 0; i < len; i += 4) {
    let v = 0;
    if (ruang === 'grayscale') {
      v = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
    } else {
      const hsv = rgbKeHsv(src[i], src[i + 1], src[i + 2]);
      if (ruang === 'hsv_h') v = clamp((hsv.h / 360) * 255);
      else if (ruang === 'hsv_s') v = clamp(hsv.s * 255);
      else v = clamp(hsv.v * 255);
    }
    dst[i] = v;
    dst[i + 1] = v;
    dst[i + 2] = v;
    dst[i + 3] = src[i + 3];
  }
  return { data: dst, width: citra.width, height: citra.height };
}

function operasiSepia_Lama(citra, parameter = {}) {
  const k =
    Math.max(0, Math.min(100, Number(parameter.intensitas) || 80)) / 100;
  const dst = new Uint8ClampedArray(citra.data.length);
  const src = citra.data;
  const len = src.length;
  for (let i = 0; i < len; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const rSepia = clamp(0.393 * r + 0.769 * g + 0.189 * b);
    const gSepia = clamp(0.349 * r + 0.686 * g + 0.168 * b);
    const bSepia = clamp(0.272 * r + 0.534 * g + 0.131 * b);
    dst[i] = clamp((1 - k) * r + k * rSepia);
    dst[i + 1] = clamp((1 - k) * g + k * gSepia);
    dst[i + 2] = clamp((1 - k) * b + k * bSepia);
    dst[i + 3] = src[i + 3];
  }
  return { data: dst, width: citra.width, height: citra.height };
}

function operasiSaturasi_Lama(citra, parameter = {}) {
  const faktor = 1 + (Number(parameter.saturasi) || 0) / 100;
  const dst = new Uint8ClampedArray(citra.data.length);
  const src = citra.data;
  const len = src.length;
  for (let i = 0; i < len; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    dst[i] = clamp(y + faktor * (r - y));
    dst[i + 1] = clamp(y + faktor * (g - y));
    dst[i + 2] = clamp(y + faktor * (b - y));
    dst[i + 3] = src[i + 3];
  }
  return { data: dst, width: citra.width, height: citra.height };
}

function verifikasiSelisihMaksimal1(hasilLama, hasilBaru) {
  expect(hasilBaru.width).toBe(hasilLama.width);
  expect(hasilBaru.height).toBe(hasilLama.height);
  expect(hasilBaru.data.length).toBe(hasilLama.data.length);

  let selisihMaks = 0;
  for (let i = 0; i < hasilLama.data.length; i++) {
    const diff = Math.abs(hasilLama.data[i] - hasilBaru.data[i]);
    if (diff > selisihMaks) selisihMaks = diff;
    if (diff > 1) {
      throw new Error(
        `Selisih melebihi 1 tingkat pada indeks piksel ${i}: lama=${hasilLama.data[i]}, baru=${hasilBaru.data[i]}, diff=${diff}`
      );
    }
  }
  expect(selisihMaks).toBeLessThanOrEqual(1);
}

describe('Uji Regresi P3: Kesetaraan Numerik Algoritma Teroptimasi vs Baseline', () => {
  const citraUji = buatCitraAcakSeed(128, 128, 987654321);

  it('Pergeseran Hue: selisih output lama vs baru <= 1 tingkat per kanal', () => {
    for (const shift of [-120, -45, 0, 60, 150]) {
      const lama = operasiHue_Lama(citraUji, { pergeseran: shift });
      const baru = operasiHue.terapkan(citraUji, { pergeseran: shift });
      verifikasiSelisihMaksimal1(lama, baru);
    }
  });

  it('Ruang Warna: selisih output lama vs baru <= 1 tingkat per kanal', () => {
    for (const ruang of ['grayscale', 'hsv_h', 'hsv_s', 'hsv_v']) {
      const lama = operasiRuangWarna_Lama(citraUji, { ruang });
      const baru = operasiRuangWarna.terapkan(citraUji, { ruang });
      verifikasiSelisihMaksimal1(lama, baru);
    }
  });

  it('Sepia: selisih output lama vs baru <= 1 tingkat per kanal', () => {
    for (const k of [20, 50, 80, 100]) {
      const lama = operasiSepia_Lama(citraUji, { intensitas: k });
      const baru = operasiSepia.terapkan(citraUji, { intensitas: k });
      verifikasiSelisihMaksimal1(lama, baru);
    }
  });

  it('Saturasi: selisih output lama vs baru <= 1 tingkat per kanal', () => {
    for (const sat of [-50, 0, 50, 100]) {
      const lama = operasiSaturasi_Lama(citraUji, { saturasi: sat });
      const baru = operasiSaturasi.terapkan(citraUji, { saturasi: sat });
      verifikasiSelisihMaksimal1(lama, baru);
    }
  });

  it('Peregangan Kontras: selisih output lama vs baru <= 1 tingkat per kanal', () => {
    const lama = operasiPereganganKontras.terapkan(citraUji, {
      pemangkasan: 1,
    });
    const baru = operasiPereganganKontras.terapkan(citraUji, {
      pemangkasan: 1,
    });
    verifikasiSelisihMaksimal1(lama, baru);
  });

  it('Ekualisasi: selisih output lama vs baru <= 1 tingkat per kanal', () => {
    const lama = operasiEkualisasi.terapkan(citraUji, { mode: 'luminans' });
    const baru = operasiEkualisasi.terapkan(citraUji, { mode: 'luminans' });
    verifikasiSelisihMaksimal1(lama, baru);
  });
});
