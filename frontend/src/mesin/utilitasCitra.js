/**
 * Utilitas pembantu murni untuk mesin pengolahan citra PicLab Sevenz.
 * Semua fungsi bekerja pada struktur data murni { data: Uint8ClampedArray, width: number, height: number }
 * tanpa ketergantungan pada DOM atau browser Canvas API.
 */

/**
 * Membuat objek wadah citra baru yang kosong.
 *
 * @param {number} width - Lebar citra dalam piksel
 * @param {number} height - Tinggi citra dalam piksel
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
export function buatCitraKosong(width, height) {
  const lebarBulat = Math.max(1, Math.round(width));
  const tinggiBulat = Math.max(1, Math.round(height));
  return {
    data: new Uint8ClampedArray(lebarBulat * tinggiBulat * 4),
    width: lebarBulat,
    height: tinggiBulat,
  };
}

/**
 * Membuat salinan mendalam (deep clone) dari objek citra yang ada.
 *
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
export function salinCitra(citra) {
  return {
    data: new Uint8ClampedArray(citra.data),
    width: citra.width,
    height: citra.height,
  };
}

/**
 * Membatasi nilai ke rentang [min, max] dan membulatkan ke bilangan bulat.
 *
 * @param {number} nilai
 * @param {number} [min=0]
 * @param {number} [max=255]
 * @returns {number}
 */
export function clamp(nilai, min = 0, max = 255) {
  if (Number.isNaN(nilai)) return min;
  return Math.max(min, Math.min(max, Math.round(nilai)));
}

/**
 * Menghitung nilai luminans grayscale sesuai standar ITU-R BT.601 (Rec.601).
 * Rumus: Y = 0.299*R + 0.587*G + 0.114*B
 *
 * @param {number} r - Komponen Merah (0..255)
 * @param {number} g - Komponen Hijau (0..255)
 * @param {number} b - Komponen Biru (0..255)
 * @returns {number} Nilai luminans bulat ter-clamp (0..255)
 */
export function hitungLuminansRec601(r, g, b) {
  return clamp(0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * Membuat tabel pencarian (Look-Up Table / LUT) ukuran 256 entri.
 * Mengoptimalkan komputasi per-nilai piksel secara dramatis.
 *
 * @param {(v: number) => number} fungsiTransformasi - Fungsi yang memetakan nilai 0..255
 * @returns {Uint8Array}
 */
export function buatTabelPencarian(fungsiTransformasi) {
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = clamp(fungsiTransformasi(i));
  }
  return lut;
}

/**
 * Mengonversi nilai RGB (0..255) ke format HSV:
 * H (0..360 derajat), S (0..1), V (0..1).
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{ h: number, s: number, v: number }}
 */
export function rgbKeHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
    h = h * 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
}

/**
 * Mengonversi nilai HSV ke format RGB (0..255).
 *
 * @param {number} h - Hue (0..360)
 * @param {number} s - Saturasi (0..1)
 * @param {number} v - Value/Kecerahan (0..1)
 * @returns {{ r: number, g: number, b: number }}
 */
export function hsvKeRgb(h, s, v) {
  const c = v * s;
  const hNorm = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hNorm % 2) - 1));
  const m = v - c;

  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (hNorm >= 0 && hNorm < 1) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (hNorm >= 1 && hNorm < 2) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (hNorm >= 2 && hNorm < 3) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (hNorm >= 3 && hNorm < 4) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (hNorm >= 4 && hNorm < 5) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  return {
    r: clamp((r1 + m) * 255),
    g: clamp((g1 + m) * 255),
    b: clamp((b1 + m) * 255),
  };
}

/**
 * Menghitung frekuensi kemunculan piksel (histogram) untuk kanal R, G, B, dan Luminans.
 *
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra
 * @returns {{ r: Uint32Array, g: Uint32Array, b: Uint32Array, luminans: Uint32Array, nilaiMaksimum: number }}
 */
export function hitungHistogram(citra) {
  const rHist = new Uint32Array(256);
  const gHist = new Uint32Array(256);
  const bHist = new Uint32Array(256);
  const lumHist = new Uint32Array(256);

  const len = citra.data.length;
  let maks = 0;

  for (let i = 0; i < len; i += 4) {
    const r = citra.data[i];
    const g = citra.data[i + 1];
    const b = citra.data[i + 2];
    const lum = hitungLuminansRec601(r, g, b);

    rHist[r]++;
    gHist[g]++;
    bHist[b]++;
    lumHist[lum]++;

    if (rHist[r] > maks) maks = rHist[r];
    if (gHist[g] > maks) maks = gHist[g];
    if (bHist[b] > maks) maks = bHist[b];
    if (lumHist[lum] > maks) maks = lumHist[lum];
  }

  return {
    r: rHist,
    g: gHist,
    b: bHist,
    luminans: lumHist,
    nilaiMaksimum: maks,
    totalPiksel: citra.width * citra.height,
  };
}
