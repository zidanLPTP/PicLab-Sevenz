/**
 * Utilitas Matematika Pemrosesan Citra Spasial & Konvolusi (spec.md bagian 4 & Tahap 4).
 * Seluruh fungsi berkarakter murni (pure functions) dengan replikasi piksel tepi,
 * pemisahan area interior bebas percabangan, alokasi memori minimal,
 * zero-allocation di dalam loop per piksel, dan penjagaan alfa.
 */

import { clamp, hitungLuminansRec601 } from '../utilitasCitra';

/**
 * Mengambil indeks RGBA piksel dengan replikasi tepi (edge clamping).
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {number} Offset indeks buffer
 */
export function ambilIndeksReplikasiTepi(x, y, width, height) {
  const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
  const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
  return (cy * width + cx) * 4;
}

/**
 * Konvolusi 2D Sejati (True Convolution) dengan Kernel Dibalik 180 Derajat.
 * Optimasi: Interior loop bebas pengecekan koordinat dan branching dengan precomputed tap offsets.
 * Rumus inti: g(x,y) = clamp(round(Σ_s Σ_t w(s,t) * f(x-s, y-t) / pembagi + offset))
 *
 * @param {object} citra { width, height, data }
 * @param {number[]} kernel Matriks kernel 1D berukuran K*K (K=3 atau K=5)
 * @param {number} ukuranUkuranK Ukuran kernel (3 atau 5)
 * @param {number} [pembagi] Pembagi bobot (jika null/0, gunakan total bobot kernel atau 1)
 * @param {number} [offset=0] Nilai bias offset
 * @param {Uint8ClampedArray} [bufferKeluar] Buffer keluaran pra-alokasi opsional
 * @returns {Uint8ClampedArray}
 */
export function konvolusi2DSejati(
  citra,
  kernel,
  ukuranUkuranK,
  pembagi,
  offset = 0,
  bufferKeluar
) {
  const { width, height, data: src } = citra;
  const dst = bufferKeluar || new Uint8ClampedArray(src.length);
  const radius = Math.floor(ukuranUkuranK / 2);

  // Hitung pembagi efektif: sum(kernel) jika > 0, selain itu 1
  let div = Number(pembagi);
  if (!Number.isFinite(div) || div === 0) {
    let sumBobot = 0;
    for (let i = 0; i < kernel.length; i++) sumBobot += kernel[i];
    div = sumBobot > 0 ? sumBobot : 1;
  }
  const invDiv = 1 / div;
  const bias = Number.isFinite(offset) ? offset : 0;

  // Jika dimensi citra lebih kecil dari atau sama dengan 2 * radius, tidak ada interior; seluruh piksel adalah border
  if (width <= radius * 2 || height <= radius * 2) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        prosesSatuPikselBorder(x, y);
      }
    }
    return dst;
  }

  // Siapkan tap bukan-nol untuk area interior (pembalikan 180° konvolusi sejati)
  const nonZeroWeights = [];
  const nonZeroOffsets = [];
  for (let ki = 0; ki < ukuranUkuranK; ki++) {
    for (let kj = 0; kj < ukuranUkuranK; kj++) {
      const idx = ki * ukuranUkuranK + kj;
      const bobot = kernel[idx];
      if (bobot !== 0) {
        nonZeroWeights.push(bobot);
        const dy = -(ki - radius);
        const dx = -(kj - radius);
        nonZeroOffsets.push((dy * width + dx) * 4);
      }
    }
  }
  const numTaps = nonZeroWeights.length;

  // 1. Proses Area Interior (x in [radius, width - radius), y in [radius, height - radius))
  const yEnd = height - radius;
  const xEnd = width - radius;

  for (let y = radius; y < yEnd; y++) {
    let dstIdx = (y * width + radius) * 4;
    let srcCenter = dstIdx;

    for (let x = radius; x < xEnd; x++) {
      let r = 0;
      let g = 0;
      let b = 0;

      for (let t = 0; t < numTaps; t++) {
        const p = srcCenter + nonZeroOffsets[t];
        const w = nonZeroWeights[t];
        r += src[p] * w;
        g += src[p + 1] * w;
        b += src[p + 2] * w;
      }

      dst[dstIdx] = clamp(Math.round(r * invDiv + bias));
      dst[dstIdx + 1] = clamp(Math.round(g * invDiv + bias));
      dst[dstIdx + 2] = clamp(Math.round(b * invDiv + bias));
      dst[dstIdx + 3] = src[srcCenter + 3];

      dstIdx += 4;
      srcCenter += 4;
    }
  }

  // 2. Proses Area Tepi (Border) dengan replikasi koordinat
  for (let y = 0; y < height; y++) {
    const isBorderY = y < radius || y >= yEnd;
    if (isBorderY) {
      for (let x = 0; x < width; x++) prosesSatuPikselBorder(x, y);
    } else {
      for (let x = 0; x < radius; x++) prosesSatuPikselBorder(x, y);
      for (let x = xEnd; x < width; x++) prosesSatuPikselBorder(x, y);
    }
  }

  function prosesSatuPikselBorder(x, y) {
    const dstIdx = (y * width + x) * 4;
    let r = 0;
    let g = 0;
    let b = 0;

    for (let ki = 0; ki < ukuranUkuranK; ki++) {
      const s = -(ki - radius);
      const srcY = y + s;
      const cy = srcY < 0 ? 0 : srcY >= height ? height - 1 : srcY;
      const cyOff = cy * width;

      for (let kj = 0; kj < ukuranUkuranK; kj++) {
        const bobot = kernel[ki * ukuranUkuranK + kj];
        if (bobot === 0) continue;

        const t = -(kj - radius);
        const srcX = x + t;
        const cx = srcX < 0 ? 0 : srcX >= width ? width - 1 : srcX;
        const srcIdx = (cyOff + cx) * 4;

        r += src[srcIdx] * bobot;
        g += src[srcIdx + 1] * bobot;
        b += src[srcIdx + 2] * bobot;
      }
    }

    dst[dstIdx] = clamp(Math.round(r * invDiv + bias));
    dst[dstIdx + 1] = clamp(Math.round(g * invDiv + bias));
    dst[dstIdx + 2] = clamp(Math.round(b * invDiv + bias));
    dst[dstIdx + 3] = src[dstIdx + 3];
  }

  return dst;
}

/**
 * Membangun kernel Gaussian 1D simetris ternormalisasi.
 * Rumus inti: G(x) = exp(-x^2 / (2*sigma^2))
 *
 * @param {number} sigma Standar deviasi penapis
 * @returns {{ kernel: Float32Array, radius: number }}
 */
export function bangunKernelGaussian1D(sigma) {
  const s = Math.max(0.1, sigma);
  const radius = Math.ceil(3 * s);
  const size = 2 * radius + 1;
  const kernel = new Float32Array(size);

  const duaSigmaKuadrat = 2 * s * s;
  let total = 0;

  for (let i = 0; i < size; i++) {
    const x = i - radius;
    const val = Math.exp(-(x * x) / duaSigmaKuadrat);
    kernel[i] = val;
    total += val;
  }

  // Normalisasi jumlah kernel = 1
  const invTotal = 1 / total;
  for (let i = 0; i < size; i++) {
    kernel[i] *= invTotal;
  }

  return { kernel, radius };
}

/**
 * Konvolusi Terpisah 2D (Separable Convolution) untuk Penapis Gaussian & Kotak.
 * Memproses lintasan horizontal (1D) lalu lintasan vertikal (1D) per kanal RGB.
 * Menggunakan satu buffer Float32Array kontinu untuk menghemat alokasi memori
 * serta perulangan berurutan ramah cache (row-major).
 *
 * @param {object} citra { width, height, data }
 * @param {Float32Array} kernel1D Bobot kernel ternormalisasi
 * @param {number} radius Radius kernel (ukuran = 2*radius + 1)
 * @returns {Uint8ClampedArray}
 */
export function konvolusiSeparable1D(citra, kernel1D, radius) {
  const { width, height, data: src } = citra;
  const totalPiksel = width * height;
  const dst = new Uint8ClampedArray(src.length);
  // Satu buffer Float32Array terinterleave RGB untuk meminimalkan beban alokasi memori
  const bufferRGB = new Float32Array(totalPiksel * 3);
  const kSize = 2 * radius + 1;

  // Lintasan 1: Horizontal
  for (let y = 0; y < height; y++) {
    const ySrcOff = y * width * 4;
    const yBufOff = y * width * 3;

    // Interior X
    const xEnd = width - radius;
    for (let x = radius; x < xEnd; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let sIdx = ySrcOff + (x - radius) * 4;
      for (let k = 0; k < kSize; k++) {
        const bobot = kernel1D[k];
        r += src[sIdx] * bobot;
        g += src[sIdx + 1] * bobot;
        b += src[sIdx + 2] * bobot;
        sIdx += 4;
      }
      const bIdx = yBufOff + x * 3;
      bufferRGB[bIdx] = r;
      bufferRGB[bIdx + 1] = g;
      bufferRGB[bIdx + 2] = b;
    }

    // Border X
    for (let x = 0; x < Math.min(radius, width); x++) {
      prosesBorderX(x, y, ySrcOff, yBufOff);
    }
    for (let x = Math.max(radius, width - radius); x < width; x++) {
      prosesBorderX(x, y, ySrcOff, yBufOff);
    }
  }

  function prosesBorderX(x, y, ySrcOff, yBufOff) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let k = 0; k < kSize; k++) {
      const bobot = kernel1D[k];
      const srcX = x + (k - radius);
      const cx = srcX < 0 ? 0 : srcX >= width ? width - 1 : srcX;
      const srcIdx = ySrcOff + cx * 4;
      r += src[srcIdx] * bobot;
      g += src[srcIdx + 1] * bobot;
      b += src[srcIdx + 2] * bobot;
    }
    const bIdx = yBufOff + x * 3;
    bufferRGB[bIdx] = r;
    bufferRGB[bIdx + 1] = g;
    bufferRGB[bIdx + 2] = b;
  }

  // Lintasan 2: Vertikal (Iterasi row-major ramah cache)
  const yEnd = height - radius;
  const stride = width * 3;

  for (let y = radius; y < yEnd; y++) {
    const dstRow = y * width * 4;
    const bufRowBase = (y - radius) * width * 3;

    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let bIdx = bufRowBase + x * 3;
      for (let k = 0; k < kSize; k++) {
        const bobot = kernel1D[k];
        r += bufferRGB[bIdx] * bobot;
        g += bufferRGB[bIdx + 1] * bobot;
        b += bufferRGB[bIdx + 2] * bobot;
        bIdx += stride;
      }
      const dstIdx = dstRow + x * 4;
      dst[dstIdx] = clamp(Math.round(r));
      dst[dstIdx + 1] = clamp(Math.round(g));
      dst[dstIdx + 2] = clamp(Math.round(b));
      dst[dstIdx + 3] = src[dstIdx + 3];
    }
  }

  // Border Y
  for (let y = 0; y < Math.min(radius, height); y++) prosesBorderY(y);
  for (let y = Math.max(radius, height - radius); y < height; y++) {
    prosesBorderY(y);
  }

  function prosesBorderY(y) {
    const dstRow = y * width * 4;
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < kSize; k++) {
        const bobot = kernel1D[k];
        const srcY = y + (k - radius);
        const cy = srcY < 0 ? 0 : srcY >= height ? height - 1 : srcY;
        const bIdx = cy * width * 3 + x * 3;
        r += bufferRGB[bIdx] * bobot;
        g += bufferRGB[bIdx + 1] * bobot;
        b += bufferRGB[bIdx + 2] * bobot;
      }
      const dstIdx = dstRow + x * 4;
      dst[dstIdx] = clamp(Math.round(r));
      dst[dstIdx + 1] = clamp(Math.round(g));
      dst[dstIdx + 2] = clamp(Math.round(b));
      dst[dstIdx + 3] = src[dstIdx + 3];
    }
  }

  return dst;
}

/**
 * Membangun Citra Integral 2D (Summed-Area Table) untuk komputasi jendela O(1).
 *
 * @param {Uint8ClampedArray|Uint8Array} srcData Buffer sumber
 * @param {number} width Lebar citra
 * @param {number} height Tinggi citra
 * @param {number} kanal Indeks kanal (-1 jika buffer 1D monokrom, 0=R, 1=G, 2=B)
 * @returns {Float64Array} Buffer citra integral berukuran (width + 1) * (height + 1)
 */
export function bangunCitraIntegral(srcData, width, height, kanal = -1) {
  const wInt = width + 1;
  const hInt = height + 1;
  const integral = new Float64Array(wInt * hInt);

  for (let y = 0; y < height; y++) {
    let barisSum = 0;
    const ySrc = y * width;
    const yInt = (y + 1) * wInt;
    const yIntPrev = y * wInt;

    for (let x = 0; x < width; x++) {
      const srcIdx = kanal === -1 ? ySrc + x : (ySrc + x) * 4 + kanal;
      barisSum += srcData[srcIdx];
      integral[yInt + (x + 1)] = integral[yIntPrev + (x + 1)] + barisSum;
    }
  }

  return integral;
}

/**
 * Mengambil jumlah nilai dalam jendela persegi [x1, y1] sampai [x2, y2] dari citra integral.
 * Rumus: I(x2, y2) - I(x1-1, y2) - I(x2, y1-1) + I(x1-1, y1-1)
 */
export function ambilJumlahJendelaIntegral(integral, wInt, x1, y1, x2, y2) {
  const A = integral[y1 * wInt + x1];
  const B = integral[y1 * wInt + (x2 + 1)];
  const C = integral[(y2 + 1) * wInt + x1];
  const D = integral[(y2 + 1) * wInt + (x2 + 1)];
  return D - B - C + A;
}

/**
 * Penapis Rata-Rata Berbasis Citra Integral (O(1) Box Filter).
 *
 * @param {object} citra { width, height, data }
 * @param {number} radius Radius jendela
 * @returns {Uint8ClampedArray}
 */
export function penapisMeanIntegral(citra, radius) {
  const { width, height, data: src } = citra;
  const dst = new Uint8ClampedArray(src.length);
  const r = Math.max(1, Math.round(radius));

  const intR = bangunCitraIntegral(src, width, height, 0);
  const intG = bangunCitraIntegral(src, width, height, 1);
  const intB = bangunCitraIntegral(src, width, height, 2);
  const wInt = width + 1;

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - r);
    const y2 = Math.min(height - 1, y + r);
    const yOffset = y * width;

    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - r);
      const x2 = Math.min(width - 1, x + r);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const invArea = 1 / area;

      const sumR = ambilJumlahJendelaIntegral(intR, wInt, x1, y1, x2, y2);
      const sumG = ambilJumlahJendelaIntegral(intG, wInt, x1, y1, x2, y2);
      const sumB = ambilJumlahJendelaIntegral(intB, wInt, x1, y1, x2, y2);

      const dstIdx = (yOffset + x) * 4;
      dst[dstIdx] = clamp(Math.round(sumR * invArea));
      dst[dstIdx + 1] = clamp(Math.round(sumG * invArea));
      dst[dstIdx + 2] = clamp(Math.round(sumB * invArea));
      dst[dstIdx + 3] = src[dstIdx + 3];
    }
  }

  return dst;
}

/**
 * Penapis Median (Median Filter) 3x3 dan 5x5 per kanal dengan replikasi tepi.
 * - Jendela 3x3: Jaringan SELEKSI median-of-9 (19 pembanding tanpa alokasi / closure).
 * - Jendela 5x5: Algoritma Huang Sliding Histogram (256-bin rolling histogram per baris).
 * Menghilangkan noise salt-and-pepper tanpa mengaburkan tepi tajam.
 *
 * @param {object} citra { width, height, data }
 * @param {number} ukuranUkuran 3 atau 5
 * @returns {Uint8ClampedArray}
 */
export function penapisMedian(citra, ukuranUkuran) {
  const { width, height, data: src } = citra;
  const dst = new Uint8ClampedArray(src.length);
  const k = ukuranUkuran === 5 ? 5 : 3;

  if (k === 3) {
    // ------------------------------------------------------------------------
    // MEDIAN 3x3: Jaringan Seleksi Median-of-9 (19 pembanding inlined)
    // ------------------------------------------------------------------------
    for (let y = 0; y < height; y++) {
      const isEdgeY = y === 0 || y === height - 1;
      const y0 = y === 0 ? 0 : y - 1;
      const y1 = y;
      const y2 = y === height - 1 ? height - 1 : y + 1;
      const r0 = y0 * width * 4;
      const r1 = y1 * width * 4;
      const r2 = y2 * width * 4;

      if (isEdgeY) {
        for (let x = 0; x < width; x++) {
          const x0 = (x === 0 ? 0 : x - 1) * 4;
          const x1 = x * 4;
          const x2 = (x === width - 1 ? width - 1 : x + 1) * 4;

          for (let ch = 0; ch < 3; ch++) {
            let p0 = src[r0 + x0 + ch],
              p1 = src[r0 + x1 + ch],
              p2 = src[r0 + x2 + ch];
            let p3 = src[r1 + x0 + ch],
              p4 = src[r1 + x1 + ch],
              p5 = src[r1 + x2 + ch];
            let p6 = src[r2 + x0 + ch],
              p7 = src[r2 + x1 + ch],
              p8 = src[r2 + x2 + ch];

            let tmp;
            if (p1 > p2) {
              tmp = p1;
              p1 = p2;
              p2 = tmp;
            }
            if (p4 > p5) {
              tmp = p4;
              p4 = p5;
              p5 = tmp;
            }
            if (p7 > p8) {
              tmp = p7;
              p7 = p8;
              p8 = tmp;
            }
            if (p0 > p1) {
              tmp = p0;
              p0 = p1;
              p1 = tmp;
            }
            if (p3 > p4) {
              tmp = p3;
              p3 = p4;
              p4 = tmp;
            }
            if (p6 > p7) {
              tmp = p6;
              p6 = p7;
              p7 = tmp;
            }
            if (p1 > p2) {
              tmp = p1;
              p1 = p2;
              p2 = tmp;
            }
            if (p4 > p5) {
              tmp = p4;
              p4 = p5;
              p5 = tmp;
            }
            if (p7 > p8) {
              tmp = p7;
              p7 = p8;
              p8 = tmp;
            }
            if (p0 > p3) {
              tmp = p0;
              p0 = p3;
              p3 = tmp;
            }
            if (p5 > p8) {
              tmp = p5;
              p5 = p8;
              p8 = tmp;
            }
            if (p4 > p7) {
              tmp = p4;
              p4 = p7;
              p7 = tmp;
            }
            if (p3 > p6) {
              tmp = p3;
              p3 = p6;
              p6 = tmp;
            }
            if (p1 > p4) {
              tmp = p1;
              p1 = p4;
              p4 = tmp;
            }
            if (p2 > p5) {
              tmp = p2;
              p2 = p5;
              p5 = tmp;
            }
            if (p4 > p7) {
              tmp = p4;
              p4 = p7;
              p7 = tmp;
            }
            if (p4 > p2) {
              tmp = p4;
              p4 = p2;
              p2 = tmp;
            }
            if (p6 > p4) {
              tmp = p6;
              p6 = p4;
              p4 = tmp;
            }
            if (p4 > p2) {
              tmp = p4;
              p4 = p2;
              p2 = tmp;
            }

            dst[r1 + x1 + ch] = p4;
          }
          dst[r1 + x1 + 3] = src[r1 + x1 + 3];
        }
      } else {
        // Border kiri (x = 0)
        {
          const x0 = 0,
            x1 = 0,
            x2 = 4;
          for (let ch = 0; ch < 3; ch++) {
            let p0 = src[r0 + x0 + ch],
              p1 = src[r0 + x1 + ch],
              p2 = src[r0 + x2 + ch];
            let p3 = src[r1 + x0 + ch],
              p4 = src[r1 + x1 + ch],
              p5 = src[r1 + x2 + ch];
            let p6 = src[r2 + x0 + ch],
              p7 = src[r2 + x1 + ch],
              p8 = src[r2 + x2 + ch];

            let tmp;
            if (p1 > p2) {
              tmp = p1;
              p1 = p2;
              p2 = tmp;
            }
            if (p4 > p5) {
              tmp = p4;
              p4 = p5;
              p5 = tmp;
            }
            if (p7 > p8) {
              tmp = p7;
              p7 = p8;
              p8 = tmp;
            }
            if (p0 > p1) {
              tmp = p0;
              p0 = p1;
              p1 = tmp;
            }
            if (p3 > p4) {
              tmp = p3;
              p3 = p4;
              p4 = tmp;
            }
            if (p6 > p7) {
              tmp = p6;
              p6 = p7;
              p7 = tmp;
            }
            if (p1 > p2) {
              tmp = p1;
              p1 = p2;
              p2 = tmp;
            }
            if (p4 > p5) {
              tmp = p4;
              p4 = p5;
              p5 = tmp;
            }
            if (p7 > p8) {
              tmp = p7;
              p7 = p8;
              p8 = tmp;
            }
            if (p0 > p3) {
              tmp = p0;
              p0 = p3;
              p3 = tmp;
            }
            if (p5 > p8) {
              tmp = p5;
              p5 = p8;
              p8 = tmp;
            }
            if (p4 > p7) {
              tmp = p4;
              p4 = p7;
              p7 = tmp;
            }
            if (p3 > p6) {
              tmp = p3;
              p3 = p6;
              p6 = tmp;
            }
            if (p1 > p4) {
              tmp = p1;
              p1 = p4;
              p4 = tmp;
            }
            if (p2 > p5) {
              tmp = p2;
              p2 = p5;
              p5 = tmp;
            }
            if (p4 > p7) {
              tmp = p4;
              p4 = p7;
              p7 = tmp;
            }
            if (p4 > p2) {
              tmp = p4;
              p4 = p2;
              p2 = tmp;
            }
            if (p6 > p4) {
              tmp = p6;
              p6 = p4;
              p4 = tmp;
            }
            if (p4 > p2) {
              tmp = p4;
              p4 = p2;
              p2 = tmp;
            }

            dst[r1 + x1 + ch] = p4;
          }
          dst[r1 + x1 + 3] = src[r1 + x1 + 3];
        }

        // Interior x in [1, width - 2]
        let pC = r1 + 4;
        let pT = r0 + 4;
        let pB = r2 + 4;

        for (let x = 1; x < width - 1; x++) {
          for (let ch = 0; ch < 3; ch++) {
            let p0 = src[pT - 4 + ch],
              p1 = src[pT + ch],
              p2 = src[pT + 4 + ch];
            let p3 = src[pC - 4 + ch],
              p4 = src[pC + ch],
              p5 = src[pC + 4 + ch];
            let p6 = src[pB - 4 + ch],
              p7 = src[pB + ch],
              p8 = src[pB + 4 + ch];

            let tmp;
            if (p1 > p2) {
              tmp = p1;
              p1 = p2;
              p2 = tmp;
            }
            if (p4 > p5) {
              tmp = p4;
              p4 = p5;
              p5 = tmp;
            }
            if (p7 > p8) {
              tmp = p7;
              p7 = p8;
              p8 = tmp;
            }
            if (p0 > p1) {
              tmp = p0;
              p0 = p1;
              p1 = tmp;
            }
            if (p3 > p4) {
              tmp = p3;
              p3 = p4;
              p4 = tmp;
            }
            if (p6 > p7) {
              tmp = p6;
              p6 = p7;
              p7 = tmp;
            }
            if (p1 > p2) {
              tmp = p1;
              p1 = p2;
              p2 = tmp;
            }
            if (p4 > p5) {
              tmp = p4;
              p4 = p5;
              p5 = tmp;
            }
            if (p7 > p8) {
              tmp = p7;
              p7 = p8;
              p8 = tmp;
            }
            if (p0 > p3) {
              tmp = p0;
              p0 = p3;
              p3 = tmp;
            }
            if (p5 > p8) {
              tmp = p5;
              p5 = p8;
              p8 = tmp;
            }
            if (p4 > p7) {
              tmp = p4;
              p4 = p7;
              p7 = tmp;
            }
            if (p3 > p6) {
              tmp = p3;
              p3 = p6;
              p6 = tmp;
            }
            if (p1 > p4) {
              tmp = p1;
              p1 = p4;
              p4 = tmp;
            }
            if (p2 > p5) {
              tmp = p2;
              p2 = p5;
              p5 = tmp;
            }
            if (p4 > p7) {
              tmp = p4;
              p4 = p7;
              p7 = tmp;
            }
            if (p4 > p2) {
              tmp = p4;
              p4 = p2;
              p2 = tmp;
            }
            if (p6 > p4) {
              tmp = p6;
              p6 = p4;
              p4 = tmp;
            }
            if (p4 > p2) {
              tmp = p4;
              p4 = p2;
              p2 = tmp;
            }

            dst[pC + ch] = p4;
          }
          dst[pC + 3] = src[pC + 3];
          pC += 4;
          pT += 4;
          pB += 4;
        }

        // Border kanan (x = width - 1)
        {
          const x0 = (width - 2) * 4,
            x1 = (width - 1) * 4,
            x2 = (width - 1) * 4;
          for (let ch = 0; ch < 3; ch++) {
            let p0 = src[r0 + x0 + ch],
              p1 = src[r0 + x1 + ch],
              p2 = src[r0 + x2 + ch];
            let p3 = src[r1 + x0 + ch],
              p4 = src[r1 + x1 + ch],
              p5 = src[r1 + x2 + ch];
            let p6 = src[r2 + x0 + ch],
              p7 = src[r2 + x1 + ch],
              p8 = src[r2 + x2 + ch];

            let tmp;
            if (p1 > p2) {
              tmp = p1;
              p1 = p2;
              p2 = tmp;
            }
            if (p4 > p5) {
              tmp = p4;
              p4 = p5;
              p5 = tmp;
            }
            if (p7 > p8) {
              tmp = p7;
              p7 = p8;
              p8 = tmp;
            }
            if (p0 > p1) {
              tmp = p0;
              p0 = p1;
              p1 = tmp;
            }
            if (p3 > p4) {
              tmp = p3;
              p3 = p4;
              p4 = tmp;
            }
            if (p6 > p7) {
              tmp = p6;
              p6 = p7;
              p7 = tmp;
            }
            if (p1 > p2) {
              tmp = p1;
              p1 = p2;
              p2 = tmp;
            }
            if (p4 > p5) {
              tmp = p4;
              p4 = p5;
              p5 = tmp;
            }
            if (p7 > p8) {
              tmp = p7;
              p7 = p8;
              p8 = tmp;
            }
            if (p0 > p3) {
              tmp = p0;
              p0 = p3;
              p3 = tmp;
            }
            if (p5 > p8) {
              tmp = p5;
              p5 = p8;
              p8 = tmp;
            }
            if (p4 > p7) {
              tmp = p4;
              p4 = p7;
              p7 = tmp;
            }
            if (p3 > p6) {
              tmp = p3;
              p3 = p6;
              p6 = tmp;
            }
            if (p1 > p4) {
              tmp = p1;
              p1 = p4;
              p4 = tmp;
            }
            if (p2 > p5) {
              tmp = p2;
              p2 = p5;
              p5 = tmp;
            }
            if (p4 > p7) {
              tmp = p4;
              p4 = p7;
              p7 = tmp;
            }
            if (p4 > p2) {
              tmp = p4;
              p4 = p2;
              p2 = tmp;
            }
            if (p6 > p4) {
              tmp = p6;
              p6 = p4;
              p4 = tmp;
            }
            if (p4 > p2) {
              tmp = p4;
              p4 = p2;
              p2 = tmp;
            }

            dst[r1 + x1 + ch] = p4;
          }
          dst[r1 + x1 + 3] = src[r1 + x1 + 3];
        }
      }
    }
  } else {
    // ------------------------------------------------------------------------
    // MEDIAN 5x5: Algoritma Huang Sliding Histogram
    // ------------------------------------------------------------------------
    const radius = 2;
    const targetRank = 13; // (25 + 1) / 2

    for (let ch = 0; ch < 3; ch++) {
      const hist = new Int32Array(256);

      for (let y = 0; y < height; y++) {
        hist.fill(0);
        const ym2 = y >= 2 ? y - 2 : 0;
        const ym1 = y >= 1 ? y - 1 : 0;
        const yp1 = y < height - 1 ? y + 1 : height - 1;
        const yp2 = y < height - 2 ? y + 2 : height - 1;

        const r0 = ym2 * width * 4 + ch;
        const r1 = ym1 * width * 4 + ch;
        const r2 = y * width * 4 + ch;
        const r3 = yp1 * width * 4 + ch;
        const r4 = yp2 * width * 4 + ch;

        // Inisialisasi histogram kolom -2..2
        for (let dx = -radius; dx <= radius; dx++) {
          const cx = dx < 0 ? 0 : dx >= width ? width - 1 : dx;
          const xOff = cx * 4;
          hist[src[r0 + xOff]]++;
          hist[src[r1 + xOff]]++;
          hist[src[r2 + xOff]]++;
          hist[src[r3 + xOff]]++;
          hist[src[r4 + xOff]]++;
        }

        let count = 0;
        let med = 0;
        while (med < 256) {
          count += hist[med];
          if (count >= targetRank) break;
          med++;
        }

        let dstIdx = y * width * 4 + ch;
        dst[dstIdx] = med;

        // Geser sepanjang baris X
        for (let x = 1; x < width; x++) {
          dstIdx += 4;
          const xOut = x - radius - 1;
          const cxOut = xOut < 0 ? 0 : xOut;
          const outOff = cxOut * 4;

          const pOut0 = src[r0 + outOff];
          const pOut1 = src[r1 + outOff];
          const pOut2 = src[r2 + outOff];
          const pOut3 = src[r3 + outOff];
          const pOut4 = src[r4 + outOff];

          hist[pOut0]--;
          if (pOut0 <= med) count--;
          hist[pOut1]--;
          if (pOut1 <= med) count--;
          hist[pOut2]--;
          if (pOut2 <= med) count--;
          hist[pOut3]--;
          if (pOut3 <= med) count--;
          hist[pOut4]--;
          if (pOut4 <= med) count--;

          const xIn = x + radius;
          const cxIn = xIn >= width ? width - 1 : xIn;
          const inOff = cxIn * 4;

          const pIn0 = src[r0 + inOff];
          const pIn1 = src[r1 + inOff];
          const pIn2 = src[r2 + inOff];
          const pIn3 = src[r3 + inOff];
          const pIn4 = src[r4 + inOff];

          hist[pIn0]++;
          if (pIn0 <= med) count++;
          hist[pIn1]++;
          if (pIn1 <= med) count++;
          hist[pIn2]++;
          if (pIn2 <= med) count++;
          hist[pIn3]++;
          if (pIn3 <= med) count++;
          hist[pIn4]++;
          if (pIn4 <= med) count++;

          if (count < targetRank) {
            while (count < targetRank && med < 255) {
              med++;
              count += hist[med];
            }
          } else {
            while (count - hist[med] >= targetRank && med > 0) {
              count -= hist[med];
              med--;
            }
          }
          dst[dstIdx] = med;
        }
      }
    }
  }

  // Pertahankan kanal alfa
  for (let i = 3; i < src.length; i += 4) {
    dst[i] = src[i];
  }

  return dst;
}

/**
 * Ekstraksi Luminans Rec.601 ke buffer 1D monokrom Uint8Array.
 * Y = round(0.299*R + 0.587*G + 0.114*B)
 *
 * @param {object} citra { width, height, data }
 * @returns {Uint8Array}
 */
export function ekstrakLuminansRec601(citra) {
  const { width, height, data: src } = citra;
  const total = width * height;
  const lum = new Uint8Array(total);

  for (let i = 0, j = 0; i < src.length; i += 4, j++) {
    lum[j] = hitungLuminansRec601(src[i], src[i + 1], src[i + 2]);
  }

  return lum;
}

/**
 * Mencari ambang optimal Otsu yang memaksimalkan varians antar-kelas σ_B^2(t).
 * σ_B^2(t) = ω_0(t) * ω_1(t) * [μ_0(t) - μ_1(t)]^2
 * Jika ada nilai seri, pilih t terkecil.
 *
 * @param {Uint8Array} luminansBuffer
 * @returns {number} Ambang T optimal (0..255)
 */
export function hitungAmbangOtsu(luminansBuffer) {
  const totalPiksel = luminansBuffer.length;
  if (totalPiksel === 0) return 128;

  const hist = new Uint32Array(256);
  for (let i = 0; i < totalPiksel; i++) {
    hist[luminansBuffer[i]]++;
  }

  let totalSum = 0;
  for (let i = 0; i < 256; i++) {
    totalSum += i * hist[i];
  }

  let sumB = 0;
  let wB = 0;
  let maksVarians = -1;
  let ambangOptimal = 0;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;

    const wF = totalPiksel - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (totalSum - sumB) / wF;

    const diff = mB - mF;
    const varians = wB * wF * diff * diff;

    // Jika varians lebih besar (jika seri, t terkecil tetap terpilih)
    if (varians > maksVarians) {
      maksVarians = varians;
      ambangOptimal = t;
    }
  }

  return ambangOptimal;
}
