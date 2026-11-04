/**
 * Katalog & Registri Terpadu Operasi Citra PicLab Sevenz (spec.md bagian 3 & 4).
 * Registri statis otomatis yang mengimpor definisi operasi bawaan dan modular
 * tanpa eval/new Function (kepatuhan OWASP & Agent.md bagian 7).
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
 * Registri internal operasi citra bawaan.
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

// Temukan modul operasi kustom secara statis jika ada (ekstensibilitas modular)
const modulKustom = import.meta.glob('./operasiKustom/*.js', { eager: true });
for (const path in modulKustom) {
  const modul = modulKustom[path];
  const definisi = modul.default || Object.values(modul)[0];
  if (
    definisi &&
    definisi.id &&
    !REGISTRI_OPERASI.some((op) => op.id === definisi.id)
  ) {
    REGISTRI_OPERASI.push(definisi);
  }
}

// Muat fixture khusus lingkungan uji jika berada pada mode test atau VITE_MEMUAT_FIXTURE_UJI aktif
if (
  import.meta.env.VITE_MEMUAT_FIXTURE_UJI === 'true' ||
  import.meta.env.MODE === 'test'
) {
  const modulFixture = import.meta.glob('./uji_fixture/*.js', { eager: true });
  for (const path in modulFixture) {
    const modul = modulFixture[path];
    const definisi = modul.default || Object.values(modul)[0];
    if (
      definisi &&
      definisi.id &&
      !REGISTRI_OPERASI.some((op) => op.id === definisi.id)
    ) {
      REGISTRI_OPERASI.push(definisi);
    }
  }
}

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
