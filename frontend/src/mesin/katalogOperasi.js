/**
 * Katalog & Registri Terpadu Operasi Citra PicLab Sevenz (spec.md bagian 3 & 4).
 * Menyediakan antarmuka pendaftaran dinamis untuk menambahkan operasi baru
 * tanpa memodifikasi komponen antarmuka pengguna (UI).
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
 * Daftar kategori operasi citra.
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
 * Set penyimpan fungsi pendengar perubahan registri operasi.
 */
const pendengarRegistri = new Set();
let sinkronisasiPekerjaCallback = null;

/**
 * Mendaftarkan callback untuk sinkronisasi operasi ke Web Worker.
 * @param {(operasi: object) => void} cb
 */
export function setSinkronisasiPekerjaCallback(cb) {
  sinkronisasiPekerjaCallback = cb;
}

/**
 * Berlangganan terhadap penambahan atau perubahan registri operasi.
 * @param {(semuaOperasi: Array<object>) => void} cb
 * @returns {() => void} fungsi berhenti langganan
 */
export function langganRegistri(cb) {
  pendengarRegistri.add(cb);
  return () => pendengarRegistri.delete(cb);
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

  // Notifikasi seluruh pendengar antarmuka
  const semua = dapatkanSemuaOperasi();
  for (const cb of pendengarRegistri) {
    try {
      cb(semua);
    } catch (e) {
      console.error('Galat pendengar registri operasi:', e);
    }
  }

  // Sinkronkan ke Web Worker jika callback terpasang
  if (sinkronisasiPekerjaCallback) {
    sinkronisasiPekerjaCallback(operasiBaru);
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

/**
 * Memvalidasi dan membersihkan parameter berdasarkan skema operasi.
 * Nilai non-finite (NaN, Infinity, undefined, string non-numerik) diganti dengan nilai awal,
 * dan nilai di luar batas [min, max] dijepit (clamped).
 *
 * @param {object} operasi
 * @param {Record<string, any>} parameter
 * @returns {Record<string, any>}
 */
export function bersihkanParameter(operasi, parameter = {}) {
  if (!operasi || !operasi.skemaParameter) return {};
  const hasil = {};
  for (const skema of operasi.skemaParameter) {
    const valMasukan = parameter[skema.id];

    if (skema.tipe === 'slider' || skema.tipe === 'angka') {
      const num = Number(valMasukan);
      if (!Number.isFinite(num)) {
        hasil[skema.id] = skema.nilaiAwal;
      } else {
        let clamped = num;
        if (skema.min !== undefined) clamped = Math.max(skema.min, clamped);
        if (skema.max !== undefined) clamped = Math.min(skema.max, clamped);
        hasil[skema.id] = clamped;
      }
    } else if (skema.tipe === 'pilihan') {
      const opsiValid = (skema.pilihan || []).map((p) => p.nilai);
      if (opsiValid.length > 0 && !opsiValid.includes(valMasukan)) {
        hasil[skema.id] = skema.nilaiAwal;
      } else {
        hasil[skema.id] = valMasukan ?? skema.nilaiAwal;
      }
    } else {
      hasil[skema.id] = valMasukan ?? skema.nilaiAwal;
    }
  }
  return hasil;
}
