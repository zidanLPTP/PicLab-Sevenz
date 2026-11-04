/**
 * Utilitas Matematika Pemrosesan Citra Spasial & Konvolusi (spec.md bagian 4 & Tahap 4).
 * Seluruh fungsi berkarakter murni (pure functions) dengan replikasi piksel tepi,
 * alokasi memori minimal, zero-allocation di dalam loop per piksel, dan penjagaan alfa.
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

  // Hitung pembagi efektif
  let div = Number(pembagi);
  if (!Number.isFinite(div) || div === 0) {
    let sumBobot = 0;
    for (let i = 0; i < kernel.length; i++) sumBobot += kernel[i];
    div = sumBobot > 0 ? sumBobot : 1;
  }
  const invDiv = 1 / div;
  const bias = Number.isFinite(offset) ? offset : 0;

  // Lakukan konvolusi sejati: kernel dibalik 180°
  // w(s,t) pada posisi kernel (ki, kj) berinteraksi dengan f(x-s, y-t)
  // Untuk kernel 1D indeks ki*K + kj dengan ki, kj in [0..K-1]:
  // offset koordinat relatif adalah s = ki - radius, t = kj - radius
  // f(x - s, y - t) = f(x - (ki - radius), y - (kj - radius))
  const len = kernel.length;
  const sOffset = new Int32Array(len);
  const tOffset = new Int32Array(len);
  for (let ki = 0; ki < ukuranUkuranK; ki++) {
    for (let kj = 0; kj < ukuranUkuranK; kj++) {
      const idx = ki * ukuranUkuranK + kj;
      sOffset[idx] = -(ki - radius); // Pembalikan 180° (konvolusi sejati)
      tOffset[idx] = -(kj - radius);
    }
  }

  for (let y = 0; y < height; y++) {
    const yOffset = y * width;
    for (let x = 0; x < width; x++) {
      const dstIdx = (yOffset + x) * 4;

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;

      for (let k = 0; k < len; k++) {
        const bobot = kernel[k];
        if (bobot === 0) continue;

        const srcX = x + tOffset[k];
        const srcY = y + sOffset[k];

        const cx = srcX < 0 ? 0 : srcX >= width ? width - 1 : srcX;
        const cy = srcY < 0 ? 0 : srcY >= height ? height - 1 : srcY;
        const srcIdx = (cy * width + cx) * 4;

        rSum += src[srcIdx] * bobot;
        gSum += src[srcIdx + 1] * bobot;
        bSum += src[srcIdx + 2] * bobot;
      }

      dst[dstIdx] = clamp(Math.round(rSum * invDiv + bias));
      dst[dstIdx + 1] = clamp(Math.round(gSum * invDiv + bias));
      dst[dstIdx + 2] = clamp(Math.round(bSum * invDiv + bias));
      dst[dstIdx + 3] = src[dstIdx + 3]; // Kanal alfa dipertahankan utuh
    }
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
 * Kompleksitas: O(2 * K * W * H).
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

  // Buffer sementara Float32 untuk hasil lintasan horizontal
  // Hanya menyimpan 3 kanal (R, G, B) untuk menghemat RAM
  const bufferR = new Float32Array(totalPiksel);
  const bufferG = new Float32Array(totalPiksel);
  const bufferB = new Float32Array(totalPiksel);

  const kSize = 2 * radius + 1;

  // Lintasan 1: Horizontal (Sumbu X)
  for (let y = 0; y < height; y++) {
    const yOffset = y * width;
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;

      for (let k = 0; k < kSize; k++) {
        const bobot = kernel1D[k];
        const srcX = x + (k - radius);
        const cx = srcX < 0 ? 0 : srcX >= width ? width - 1 : srcX;
        const srcIdx = (yOffset + cx) * 4;

        r += src[srcIdx] * bobot;
        g += src[srcIdx + 1] * bobot;
        b += src[srcIdx + 2] * bobot;
      }

      const bufIdx = yOffset + x;
      bufferR[bufIdx] = r;
      bufferG[bufIdx] = g;
      bufferB[bufIdx] = b;
    }
  }

  // Lintasan 2: Vertikal (Sumbu Y)
  for (let y = 0; y < height; y++) {
    const yOffset = y * width;
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;

      for (let k = 0; k < kSize; k++) {
        const bobot = kernel1D[k];
        const srcY = y + (k - radius);
        const cy = srcY < 0 ? 0 : srcY >= height ? height - 1 : srcY;
        const bufIdx = cy * width + x;

        r += bufferR[bufIdx] * bobot;
        g += bufferG[bufIdx] * bobot;
        b += bufferB[bufIdx] * bobot;
      }

      const dstIdx = (yOffset + x) * 4;
      dst[dstIdx] = clamp(Math.round(r));
      dst[dstIdx + 1] = clamp(Math.round(g));
      dst[dstIdx + 2] = clamp(Math.round(b));
      dst[dstIdx + 3] = src[dstIdx + 3]; // Alfa dipertahankan
    }
  }

  return dst;
}

/**
 * Membangun Citra Integral 2D (Summed-Area Table) untuk kanal tertentu atau luminans.
 * I(x, y) = Σ_{i=0}^{x-1} Σ_{j=0}^{y-1} f(i, j)
 *
 * @param {Uint8ClampedArray|Uint8Array} dataBuffer Buffer data piksel
 * @param {number} width
 * @param {number} height
 * @param {number} [kanal=0] Offset kanal (0=R, 1=G, 2=B, atau -1 jika buffer 1D monokrom)
 * @returns {Float64Array} Buffer integral berukuran (width + 1) * (height + 1)
 */
export function bangunCitraIntegral(dataBuffer, width, height, kanal = -1) {
  const strideX = kanal >= 0 ? 4 : 1;
  const offsetKanal = kanal >= 0 ? kanal : 0;
  const wInt = width + 1;
  const hInt = height + 1;
  const integral = new Float64Array(wInt * hInt);

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const yIntOffset = (y + 1) * wInt;
    const yPrevOffset = y * wInt;
    const ySrcOffset = y * width;

    for (let x = 0; x < width; x++) {
      const srcIdx = (ySrcOffset + x) * strideX + offsetKanal;
      rowSum += dataBuffer[srcIdx];
      integral[yIntOffset + (x + 1)] = integral[yPrevOffset + (x + 1)] + rowSum;
    }
  }

  return integral;
}

/**
 * Mengambil jumlah nilai dalam jendela persegi panjang [x1, y1]..[x2, y2] dari citra integral.
 * O(1) konstan per jendela.
 *
 * @param {Float64Array} integral
 * @param {number} wInt Lebar citra integral (width + 1)
 * @param {number} x1 Koordinat kiri
 * @param {number} y1 Koordinat atas
 * @param {number} x2 Koordinat kanan (inklusif)
 * @param {number} y2 Koordinat bawah (inklusif)
 * @returns {number}
 */
export function ambilJumlahJendelaIntegral(integral, wInt, x1, y1, x2, y2) {
  const rx2 = x2 + 1;
  const ry2 = y2 + 1;
  const rx1 = x1;
  const ry1 = y1;

  const a = integral[ry2 * wInt + rx2];
  const b = integral[ry1 * wInt + rx2];
  const c = integral[ry2 * wInt + rx1];
  const d = integral[ry1 * wInt + rx1];

  return a - b - c + d;
}

/**
 * Penapis Mean (Box Blur) menggunakan citra integral untuk kinerja tinggi O(1) per piksel.
 *
 * @param {object} citra { width, height, data }
 * @param {number} radius Radius jendela kotak (ukuran = 2*radius + 1)
 * @returns {Uint8ClampedArray}
 */
export function penapisMeanIntegral(citra, radius) {
  const { width, height, data: src } = citra;
  const r = Math.max(1, Math.round(radius));
  const dst = new Uint8ClampedArray(src.length);

  // Bangun citra integral untuk 3 kanal RGB
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
 * Sorting network 9 elemen untuk mencari nilai median 3x3 secara cepat tanpa alokasi memori.
 * @param {Uint8Array} arr Array 9 elemen
 * @returns {number} Nilai median (elemen indeks 4 setelah terurut)
 */
function median9(arr) {
  const swap = (i, j) => {
    if (arr[i] > arr[j]) {
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  };
  swap(1, 2);
  swap(4, 5);
  swap(7, 8);
  swap(0, 1);
  swap(3, 4);
  swap(6, 7);
  swap(1, 2);
  swap(4, 5);
  swap(7, 8);
  swap(0, 3);
  swap(5, 8);
  swap(4, 7);
  swap(3, 6);
  swap(1, 4);
  swap(2, 5);
  swap(4, 7);
  swap(4, 2);
  swap(6, 4);
  swap(4, 2);
  return arr[4];
}

/**
 * Penapis Median (Median Filter) 3x3 dan 5x5 per kanal dengan replikasi tepi.
 * Menghilangkan noise bintik (salt-and-pepper) tanpa mengaburkan tepi tajam.
 *
 * @param {object} citra { width, height, data }
 * @param {number} ukuranUkuran 3 atau 5
 * @returns {Uint8ClampedArray}
 */
export function penapisMedian(citra, ukuranUkuran) {
  const { width, height, data: src } = citra;
  const dst = new Uint8ClampedArray(src.length);
  const k = ukuranUkuran === 5 ? 5 : 3;
  const radius = Math.floor(k / 2);
  const totalElemen = k * k;
  const medianIdx = Math.floor(totalElemen / 2);

  // Buffer lokal tetap untuk menghindari alokasi per piksel
  const jendelaR = new Uint8Array(totalElemen);
  const jendelaG = new Uint8Array(totalElemen);
  const jendelaB = new Uint8Array(totalElemen);

  for (let y = 0; y < height; y++) {
    const yOffset = y * width;
    for (let x = 0; x < width; x++) {
      let count = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        const cy = y + dy < 0 ? 0 : y + dy >= height ? height - 1 : y + dy;
        const cyOffset = cy * width;

        for (let dx = -radius; dx <= radius; dx++) {
          const cx = x + dx < 0 ? 0 : x + dx >= width ? width - 1 : x + dx;
          const srcIdx = (cyOffset + cx) * 4;

          jendelaR[count] = src[srcIdx];
          jendelaG[count] = src[srcIdx + 1];
          jendelaB[count] = src[srcIdx + 2];
          count++;
        }
      }

      let medR, medG, medB;
      if (k === 3) {
        medR = median9(jendelaR);
        medG = median9(jendelaG);
        medB = median9(jendelaB);
      } else {
        // Insertion sort lokal untuk 25 elemen (efisien untuk n kecil)
        const sort25 = (arr) => {
          for (let i = 1; i < 25; i++) {
            const key = arr[i];
            let j = i - 1;
            while (j >= 0 && arr[j] > key) {
              arr[j + 1] = arr[j];
              j--;
            }
            arr[j + 1] = key;
          }
          return arr[medianIdx];
        };
        medR = sort25(jendelaR);
        medG = sort25(jendelaG);
        medB = sort25(jendelaB);
      }

      const dstIdx = (yOffset + x) * 4;
      dst[dstIdx] = medR;
      dst[dstIdx + 1] = medG;
      dst[dstIdx + 2] = medB;
      dst[dstIdx + 3] = src[dstIdx + 3];
    }
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
  const len = width * height;
  const lum = new Uint8Array(len);

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
