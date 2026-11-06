/**
 * Pengelola Web Worker Pemrosesan Citra PicLab Sevenz.
 * Mengimplementasikan satu slot tertunda (latest-wins gating) untuk mencegah
 * antrean komputasi menumpuk di Web Worker selama interaksi slider cepat.
 * Kepatuhan OWASP & Agent.md: Registri statis murni tanpa eval atau serialisasi fungsi.
 * Mendukung eksekusi sekuensial pipeline dan prefix caching (Tahap 3).
 */

import { eksekusiPipelineSekuensial } from '../mesin/eksekutorPipeline';
import {
  bersihkanParameter,
  dapatkanOperasiBerdasarkanId,
} from '../mesin/katalogOperasi';
import { BATASAN_BERKAS } from '../utilitas/konfigurasiBerkas';

let instansPekerja = null;
let idPermintaanBerjalan = 0;
let sedangMemproses = false;
let penanganAktif = null;
let slotTertunda = null;

/**
 * Statistik antrean worker untuk verifikasi dan audit latensi interaktif (J1 a & J1 d).
 */
export const statistikPekerja = {
  totalPermintaanMasuk: 0,
  totalPermintaanDilewati: 0,
  totalKomputasiWorkerMulai: 0,
  totalKomputasiWorkerSelesai: 0,
  totalHasilUsangDibuang: 0,
};

/**
 * Mengembalikan true jika worker sedang tidak memproses dan tidak ada antrean di slot tertunda.
 */
export function apakahPekerjaIdle() {
  return !sedangMemproses && slotTertunda === null;
}

if (typeof window !== 'undefined') {
  window.__statistikPekerja = statistikPekerja;
  window.__apakahPekerjaIdle = apakahPekerjaIdle;
}

/**
 * Mereset counter statistik antrean worker untuk keperluan benchmark dan pengujian.
 */
export function resetStatistikPekerja() {
  statistikPekerja.totalPermintaanMasuk = 0;
  statistikPekerja.totalPermintaanDilewati = 0;
  statistikPekerja.totalKomputasiWorkerMulai = 0;
  statistikPekerja.totalKomputasiWorkerSelesai = 0;
  statistikPekerja.totalHasilUsangDibuang = 0;
}

function kirimTugasKeWorker(tugas) {
  sedangMemproses = true;
  penanganAktif = tugas;
  statistikPekerja.totalKomputasiWorkerMulai++;
  const pekerja = dapatkanPekerja();
  pekerja.postMessage(tugas.pesan, tugas.transferList);
}

function jadwalkanTugasWorker(
  pesan,
  transferList,
  idPermintaan,
  tKirim,
  tipe,
  tInput = performance.now()
) {
  statistikPekerja.totalPermintaanMasuk++;

  return new Promise((resolve, reject) => {
    const tugasBaru = {
      idPermintaan,
      pesan,
      transferList,
      tKirim,
      tipe,
      tInput,
      resolve,
      reject,
    };

    if (!sedangMemproses) {
      kirimTugasKeWorker(tugasBaru);
    } else {
      // Worker sedang menghitung: simpan HANYA permintaan terbaru di slot tertunda (latest-wins).
      // Bila sudah ada permintaan di slot tertunda yang belum dikirim, buang permintaan lama tersebut.
      if (slotTertunda) {
        statistikPekerja.totalPermintaanDilewati++;
        const tugasUsang = slotTertunda;
        slotTertunda = null;
        tugasUsang.resolve({
          usang: true,
          dibatalkan: true,
          durasi: 0,
          hasil: null,
        });
      }
      slotTertunda = tugasBaru;
    }
  });
}

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
          kode,
          hasil,
          pesanGalat,
          durasi,
          indeksMulaiKomputasi,
          langkahDieksekusi,
          waktuRinci,
        } = e.data;

        statistikPekerja.totalKomputasiWorkerSelesai++;
        sedangMemproses = false;
        const tugasSelesai = penanganAktif;
        penanganAktif = null;

        const adaPermintaanTertunda = slotTertunda !== null;

        if (tugasSelesai && tugasSelesai.idPermintaan === idPermintaan) {
          if (adaPermintaanTertunda) {
            // Hasil komputasi ini sudah usang karena ada permintaan lebih baru yang menunggu.
            // Buang hasil dan jangan dirender ke UI.
            statistikPekerja.totalHasilUsangDibuang++;
            tugasSelesai.resolve({
              usang: true,
              dibatalkan: true,
              durasi,
              hasil: null,
            });
          } else {
            // Hasil terkini (tidak ada permintaan lebih baru yang menunggu). Nilai final wajib tampil!
            if (berhasil) {
              const detailWaktu = {
                tKirim: waktuRinci?.tKirim || tugasSelesai.tKirim || 0,
                tWorkerMasuk: waktuRinci?.tWorkerMasuk || 0,
                tWorkerSelesai: waktuRinci?.tWorkerSelesai || 0,
                tWorkerKirim: waktuRinci?.tWorkerKirim || 0,
                tWorkerKembali,
                durasiKirimKeWorker:
                  (waktuRinci?.tWorkerMasuk || 0) -
                  (waktuRinci?.tKirim || tugasSelesai.tKirim || 0),
                durasiKomputasiWorker:
                  waktuRinci?.durasiWorker ||
                  (waktuRinci?.tWorkerSelesai || 0) -
                    (waktuRinci?.tWorkerMasuk || 0),
                durasiKembaliKeMain:
                  tWorkerKembali - (waktuRinci?.tWorkerKirim || 0),
                durasiTotalSiklus:
                  tWorkerKembali -
                  (waktuRinci?.tKirim || tugasSelesai.tKirim || 0),
              };

              tugasSelesai.resolve({
                usang: false,
                hasil: {
                  data: new Uint8ClampedArray(hasil.data),
                  width: hasil.width,
                  height: hasil.height,
                  __tInput: tugasSelesai.tInput || 0,
                },
                durasi,
                indeksMulaiKomputasi,
                langkahDieksekusi,
                waktuRinci: detailWaktu,
                detailWaktu,
              });
            } else {
              const galat = new Error(pesanGalat || 'Komputasi worker gagal');
              if (kode) {
                galat.kode = kode;
              }
              tugasSelesai.reject(galat);
            }
          }
        }

        // Jika ada permintaan tertunda di slot, segera kirim ke worker!
        if (slotTertunda) {
          const tugasBerikutnya = slotTertunda;
          slotTertunda = null;
          kirimTugasKeWorker(tugasBerikutnya);
        }
      };

      instansPekerja.onerror = function (err) {
        console.error('Galat fatal Web Worker:', err);
        sedangMemproses = false;
        if (penanganAktif) {
          penanganAktif.reject(err);
          penanganAktif = null;
        }
        if (slotTertunda) {
          slotTertunda.reject(err);
          slotTertunda = null;
        }
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
 * Membersihkan prefix cache di Web Worker saat gambar diganti.
 */
export function bersihkanCacheWorker() {
  const pekerja = dapatkanPekerja();
  if (slotTertunda) {
    slotTertunda.resolve({
      usang: true,
      dibatalkan: true,
      durasi: 0,
      hasil: null,
    });
    slotTertunda = null;
  }
  if (pekerja) {
    pekerja.postMessage({ tipe: 'BERSIHKAN_CACHE' });
  }
}

/**
 * Menjalankan rangkaian pipeline non-destruktif via Web Worker (atau fallback lokal jika tanpa worker).
 *
 * @param {Array<object>} daftarLangkah - Tumpukan langkah pipeline
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra - Citra masukan
 * @param {{ rasio: number }} [konteksSkala={ rasio: 1.0 }] - Konteks skala geometris
 * @param {boolean} [gunakanPrefixCache=true] - Aktifkan prefix caching untuk preview responsif
 * @returns {Promise<{ hasil: { data: Uint8ClampedArray, width: number, height: number }, durasi: number, usang?: boolean, dibatalkan?: boolean, indeksMulaiKomputasi?: number, langkahDieksekusi?: number, waktuRinci?: object }>}
 */
export async function jalankanPipeline(
  daftarLangkah,
  citra,
  konteksSkala = { rasio: 1.0 },
  gunakanPrefixCache = true,
  tInput = performance.now()
) {
  const pekerja = dapatkanPekerja();
  idPermintaanBerjalan++;
  const idSaatIni = idPermintaanBerjalan;

  if (pekerja) {
    const tKirim = performance.now();
    const salinanBuffer = citra.data.slice().buffer;
    return jadwalkanTugasWorker(
      {
        tipe: 'EKSEKUSI_PIPELINE',
        idPermintaan: idSaatIni,
        daftarLangkah,
        citra: {
          data: salinanBuffer,
          width: citra.width,
          height: citra.height,
        },
        konteksSkala,
        gunakanPrefixCache,
        tKirim,
      },
      [salinanBuffer],
      idSaatIni,
      tKirim,
      'PIPELINE',
      tInput
    );
  }

  // Fallback sinkron untuk lingkungan Vitest / Node / peramban tanpa worker
  const waktuMulai = performance.now();
  const hasilEksekusi = eksekusiPipelineSekuensial(
    daftarLangkah,
    citra,
    konteksSkala,
    gunakanPrefixCache ? null : false
  );
  const durasi = performance.now() - waktuMulai;

  return {
    usang: false,
    hasil: hasilEksekusi.hasil,
    durasi,
    indeksMulaiKomputasi: hasilEksekusi.indeksMulaiKomputasi,
    langkahDieksekusi: hasilEksekusi.langkahDieksekusi,
  };
}

/**
 * Menjalankan operasi citra tunggal via Web Worker (kompatibilitas Tahap 2).
 *
 * @param {string} idOperasi - ID unik operasi dari katalog
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra - Citra masukan
 * @param {Record<string, any>} parameter - Parameter operasi
 * @param {{ rasio: number }} [konteksSkala] - Rasio skala untuk operasi geometris
 * @returns {Promise<{ hasil: { data: Uint8ClampedArray, width: number, height: number }, durasi: number, usang?: boolean, dibatalkan?: boolean }>}
 */
export async function jalankanOperasi(
  idOperasi,
  citra,
  parameter = {},
  konteksSkala = { rasio: 1.0 },
  tInput = performance.now()
) {
  const pekerja = dapatkanPekerja();
  idPermintaanBerjalan++;
  const idSaatIni = idPermintaanBerjalan;

  // Jika Web Worker tersedia, serahkan komputasi ke worker melalui mekanisme gating
  if (pekerja) {
    const tKirim = performance.now();
    const salinanBuffer = citra.data.slice().buffer;
    return jadwalkanTugasWorker(
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
      [salinanBuffer],
      idSaatIni,
      tKirim,
      'OPERASI',
      tInput
    );
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

  return { usang: false, hasil, durasi };
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
