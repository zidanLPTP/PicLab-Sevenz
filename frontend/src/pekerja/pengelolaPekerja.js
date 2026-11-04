/**
 * Pengelola Web Worker Pemrosesan Citra PicLab Sevenz.
 * Mengimplementasikan pola "permintaan terbaru menang" (latest request wins)
 * dan fallback otomatis ke eksekusi thread utama saat berada di lingkungan uji/tanpa Worker.
 * Kepatuhan OWASP & Agent.md: Registri statis murni tanpa eval atau serialisasi fungsi.
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
        const tWorkerKembali = performance.now();
        const {
          idPermintaan,
          berhasil,
          hasil,
          pesanGalat,
          durasi,
          waktuRinci,
        } = e.data;
        const penangan = penanganTertunda.get(idPermintaan);

        if (!penangan) return; // Permintaan basi yang sudah dibuang
        penanganTertunda.delete(idPermintaan);

        // Abaikan respons jika ada permintaan yang lebih baru ("permintaan terbaru menang")
        if (idPermintaan < idPermintaanBerjalan) {
          return;
        }

        if (berhasil) {
          const detailWaktu = {
            tKirim: waktuRinci?.tKirim || penangan.tKirim || 0,
            tWorkerMasuk: waktuRinci?.tWorkerMasuk || 0,
            tWorkerSelesai: waktuRinci?.tWorkerSelesai || 0,
            tWorkerKirim: waktuRinci?.tWorkerKirim || 0,
            tWorkerKembali,
            durasiKirimKeWorker:
              (waktuRinci?.tWorkerMasuk || 0) -
              (waktuRinci?.tKirim || penangan.tKirim || 0),
            durasiKomputasiWorker:
              waktuRinci?.durasiWorker ||
              (waktuRinci?.tWorkerSelesai || 0) -
                (waktuRinci?.tWorkerMasuk || 0),
            durasiKembaliKeMain:
              tWorkerKembali - (waktuRinci?.tWorkerKirim || 0),
            durasiTotalSiklus:
              tWorkerKembali - (waktuRinci?.tKirim || penangan.tKirim || 0),
          };

          penangan.resolve({
            hasil: {
              data: new Uint8ClampedArray(hasil.data),
              width: hasil.width,
              height: hasil.height,
            },
            durasi,
            waktuRinci: detailWaktu,
            detailWaktu,
          });
        } else {
          penangan.reject(new Error(pesanGalat || 'Komputasi worker gagal'));
        }
      };

      instansPekerja.onerror = function (err) {
        console.error('Galat fatal Web Worker:', err);
        for (const [, p] of penanganTertunda) {
          p.reject(err);
        }
        penanganTertunda.clear();
      };
    } catch (e) {
      console.warn(
        'Gagal menginisialisasi Web Worker, beralih ke fallback sinkron:',
        e
      );
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
 * @param {{ rasio: number }} [konteksSkala] - Rasio skala untuk operasi geometris
 * @returns {Promise<{ hasil: { data: Uint8ClampedArray, width: number, height: number }, durasi: number }>}
 */
export async function jalankanOperasi(
  idOperasi,
  citra,
  parameter = {},
  konteksSkala = { rasio: 1.0 }
) {
  const pekerja = dapatkanPekerja();
  idPermintaanBerjalan++;
  const idSaatIni = idPermintaanBerjalan;

  // Bersihkan penangan lama yang sudah kadaluarsa
  penanganTertunda.clear();

  // Jika Web Worker tersedia, serahkan komputasi ke worker
  if (pekerja) {
    return new Promise((resolve, reject) => {
      const tKirim = performance.now();
      penanganTertunda.set(idSaatIni, { resolve, reject, tKirim });

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
          konteksSkala,
          tKirim,
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
  const hasil = operasi.terapkan(citra, paramBersih, konteksSkala);
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
 * Digunakan untuk unduhan berkas resolusi penuh.
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

/**
 * Menghitung histogram citra per kanal (R, G, B, Luminans) dari Uint8ClampedArray.
 * Komputasi thread utama yang dioptimasi dan terpisah dari siklus render kanvas.
 *
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra
 * @returns {{ r: Uint32Array, g: Uint32Array, b: Uint32Array, l: Uint32Array, maks: number }}
 */
export function hitungHistogramKanal(citra) {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const l = new Uint32Array(256);

  if (!citra || !citra.data) {
    return { r, g, b, l, maks: 0 };
  }

  const data = citra.data;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    const vr = data[i];
    const vg = data[i + 1];
    const vb = data[i + 2];
    const vl = Math.round(0.299 * vr + 0.587 * vg + 0.114 * vb);

    r[vr]++;
    g[vg]++;
    b[vb]++;
    l[vl]++;
  }

  let maks = 0;
  for (let i = 0; i < 256; i++) {
    if (r[i] > maks) maks = r[i];
    if (g[i] > maks) maks = g[i];
    if (b[i] > maks) maks = b[i];
    if (l[i] > maks) maks = l[i];
  }

  return { r, g, b, l, maks };
}
