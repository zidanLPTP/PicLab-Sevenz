/**
 * Pengelola Web Worker Pemrosesan Citra PicLab Sevenz.
 * Mengimplementasikan pola "permintaan terbaru menang" (latest request wins)
 * dan fallback otomatis ke eksekusi thread utama saat berada di lingkungan uji/tanpa Worker.
 */

import {
  bersihkanParameter,
  dapatkanOperasiBerdasarkanId,
} from '../mesin/katalogOperasi';
import { BATASAN_BERKAS } from '../utilitas/konfigurasiBerkas';

let instansPekerja = null;
let idPermintaanBerjalan = 0;
const penanganTertunda = new Map();

/**
 * Menginisialisasi Web Worker jika didukung peramban.
 */
function dapatkanPekerja() {
  if (typeof window === 'undefined' || typeof window.Worker === 'undefined') {
    return null;
  }

  if (!instansPekerja) {
    try {
      instansPekerja = new Worker(
        new URL('./pekerjaCitra.js', import.meta.url),
        {
          type: 'module',
        }
      );

      instansPekerja.onmessage = function (e) {
        const { idPermintaan, berhasil, hasil, pesanGalat, durasi } = e.data;
        const penangan = penanganTertunda.get(idPermintaan);

        if (!penangan) return; // Permintaan basi yang sudah dibuang
        penanganTertunda.delete(idPermintaan);

        // Abaikan respons jika ada permintaan yang lebih baru ("permintaan terbaru menang")
        if (idPermintaan < idPermintaanBerjalan) {
          return;
        }

        if (berhasil) {
          penangan.resolve({ hasil, durasi });
        } else {
          penangan.reject(new Error(pesanGalat));
        }
      };

      instansPekerja.onerror = function (err) {
        for (const [, penangan] of penanganTertunda) {
          penangan.reject(err);
        }
        penanganTertunda.clear();
      };
    } catch {
      instansPekerja = null;
    }
  }

  return instansPekerja;
}

/**
 * Menjalankan operasi citra via Web Worker (atau fallback lokal jika tanpa worker).
 *
 * @param {string} idOperasi - ID unik operasi dari katalog
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra - Citra masukan
 * @param {Record<string, any>} parameter - Parameter operasi
 * @returns {Promise<{ hasil: { data: Uint8ClampedArray, width: number, height: number }, durasi: number }>}
 */
export async function jalankanOperasi(idOperasi, citra, parameter = {}) {
  const pekerja = dapatkanPekerja();
  idPermintaanBerjalan++;
  const idSaatIni = idPermintaanBerjalan;

  // Bersihkan penangan lama yang sudah kadaluarsa
  penanganTertunda.clear();

  // Jika Web Worker tersedia, serahkan komputasi ke worker
  if (pekerja) {
    return new Promise((resolve, reject) => {
      penanganTertunda.set(idSaatIni, { resolve, reject });

      // Salin data buffer agar tidak merusak data citra asli di thread utama
      const salinanBuffer = citra.data.slice().buffer;

      pekerja.postMessage(
        {
          idPermintaan: idSaatIni,
          idOperasi,
          citra: {
            data: salinanBuffer,
            width: citra.width,
            height: citra.height,
          },
          parameter,
        },
        [salinanBuffer]
      );
    });
  }

  // Fallback sinkron untuk lingkungan Vitest / Node / peramban tanpa worker
  const operasi = dapatkanOperasiBerdasarkanId(idOperasi);
  if (!operasi) {
    throw new Error(`Operasi dengan ID "${idOperasi}" tidak ditemukan.`);
  }

  const waktuMulai = performance.now();
  const paramBersih = bersihkanParameter(operasi, parameter);
  const hasil = operasi.terapkan(citra, paramBersih);
  const durasi = performance.now() - waktuMulai;

  return { hasil, durasi };
}

/**
 * Mengekstrak objek citra murni { data, width, height } dari elemen HTMLImageElement.
 * Opsi pengecilan (downscale) digunakan untuk membuat preview interaktif responsif.
 *
 * @param {HTMLImageElement} elemenCitra
 * @param {boolean} [hanyaPreview=false] - Jika true, diperkecil ke batas DIMENSI_MAKS_PREVIEW
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
export function ekstrakDataCitra(elemenCitra, hanyaPreview = false) {
  const lebarAsli = elemenCitra.naturalWidth;
  const tinggiAsli = elemenCitra.naturalHeight;

  let targetW = lebarAsli;
  let targetH = tinggiAsli;

  if (hanyaPreview) {
    const sisiMaks = BATASAN_BERKAS.DIMENSI_MAKS_PREVIEW;
    const sisiTerpanjang = Math.max(lebarAsli, tinggiAsli);
    if (sisiTerpanjang > sisiMaks) {
      const skala = sisiMaks / sisiTerpanjang;
      targetW = Math.max(1, Math.round(lebarAsli * skala));
      targetH = Math.max(1, Math.round(tinggiAsli * skala));
    }
  }

  const kanvas = document.createElement('canvas');
  kanvas.width = targetW;
  kanvas.height = targetH;
  const ctx = kanvas.getContext('2d');
  ctx.drawImage(elemenCitra, 0, 0, targetW, targetH);

  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  return {
    data: new Uint8ClampedArray(imageData.data),
    width: targetW,
    height: targetH,
  };
}

/**
 * Mengonversi objek citra murni { data, width, height } ke URL citra (Blob URL).
 *
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra
 * @returns {Promise<string>} Blob URL yang dapat ditampilkan di tag <img>
 */
export function citraKeUrlBlob(citra) {
  return new Promise((resolve, reject) => {
    try {
      const kanvas = document.createElement('canvas');
      kanvas.width = citra.width;
      kanvas.height = citra.height;
      const ctx = kanvas.getContext('2d');

      const imageData = new ImageData(
        new Uint8ClampedArray(citra.data),
        citra.width,
        citra.height
      );
      ctx.putImageData(imageData, 0, 0);

      kanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Gagal mengonversi kanvas ke blob'));
          return;
        }
        resolve(URL.createObjectURL(blob));
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Mengonversi objek citra murni ke Blob berkas dengan format pilihan (png, jpeg, webp).
 *
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra
 * @param {string} [format='png'] - 'png' | 'jpeg' | 'webp'
 * @returns {Promise<Blob>}
 */
export function citraKeBlob(citra, format = 'png') {
  return new Promise((resolve, reject) => {
    try {
      const kanvas = document.createElement('canvas');
      kanvas.width = citra.width;
      kanvas.height = citra.height;
      const ctx = kanvas.getContext('2d');

      const imageData = new ImageData(
        new Uint8ClampedArray(citra.data),
        citra.width,
        citra.height
      );
      ctx.putImageData(imageData, 0, 0);

      const tipeMime =
        format === 'jpeg'
          ? 'image/jpeg'
          : format === 'webp'
            ? 'image/webp'
            : 'image/png';

      kanvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Gagal mengonversi kanvas ke blob'));
            return;
          }
          resolve(blob);
        },
        tipeMime,
        0.92
      );
    } catch (err) {
      reject(err);
    }
  });
}
