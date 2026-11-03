/**
 * Katalog dan Registri Operasi Citra PicLab Sevenz.
 * Menyediakan titik tunggal pendaftaran seluruh operasi mesin pengolah citra.
 * Menambah operasi baru cukup dengan mengekspor objek definisi operasi
 * dan mendaftarkannya di berkas ini.
 */

import {
  operasiCrop,
  operasiFlip,
  operasiGrayscale,
  operasiKecerahan,
  operasiKontras,
  operasiNegatif,
  operasiRotasi,
  operasiUbahUkuran,
} from './dasar';
import {
  operasiEkualisasi,
  operasiGamma,
  operasiPereganganKontras,
} from './enhancement';
import {
  operasiBalanceWarna,
  operasiHue,
  operasiPisahKanal,
  operasiRuangWarna,
  operasiSaturasi,
  operasiSepia,
} from './warna';

/**
 * Daftar kategori operasi yang didukung pada antarmuka.
 */
export const KATEGORI_OPERASI = [
  { id: 'dasar', kunciLabel: 'kategori.dasar' },
  { id: 'warna', kunciLabel: 'kategori.warna' },
  { id: 'enhancement', kunciLabel: 'kategori.enhancement' },
];

/**
 * Registri internal operasi citra yang terdaftar.
 */
const REGISTRI_OPERASI = [
  // 1. Operasi Dasar
  operasiKecerahan,
  operasiKontras,
  operasiNegatif,
  operasiGrayscale,
  operasiFlip,
  operasiRotasi,
  operasiCrop,
  operasiUbahUkuran,

  // 2. Operasi Warna
  operasiPisahKanal,
  operasiRuangWarna,
  operasiSaturasi,
  operasiHue,
  operasiSepia,
  operasiBalanceWarna,

  // 3. Operasi Enhancement
  operasiEkualisasi,
  operasiPereganganKontras,
  operasiGamma,
];

/**
 * Mendapatkan seluruh daftar operasi yang terdaftar.
 * @returns {Array<object>}
 */
export function dapatkanSemuaOperasi() {
  return [...REGISTRI_OPERASI];
}

/**
 * Mencari operasi berdasarkan ID unik.
 * @param {string} id
 * @returns {object|undefined}
 */
export function dapatkanOperasiBerdasarkanId(id) {
  return REGISTRI_OPERASI.find((op) => op.id === id);
}

/**
 * Mendaftarkan operasi citra baru secara dinamis ke dalam registri.
 * @param {object} operasiBaru
 */
export function daftarkanOperasiBaru(operasiBaru) {
  if (!operasiBaru || !operasiBaru.id) {
    throw new Error('Operasi harus memiliki ID yang unik.');
  }
  const indeks = REGISTRI_OPERASI.findIndex((op) => op.id === operasiBaru.id);
  if (indeks >= 0) {
    REGISTRI_OPERASI[indeks] = operasiBaru;
  } else {
    REGISTRI_OPERASI.push(operasiBaru);
  }
}

/**
 * Mengambil nilai awal seluruh parameter dari skema parameter sebuah operasi.
 * @param {object} operasi
 * @returns {Record<string, any>}
 */
export function ekstrakNilaiAwalParameter(operasi) {
  if (!operasi || !operasi.skemaParameter) return {};
  const nilaiAwal = {};
  for (const skema of operasi.skemaParameter) {
    nilaiAwal[skema.id] = skema.nilaiAwal;
  }
  return nilaiAwal;
}
