/**
 * Katalog & Registri Terpadu Operasi Citra PicLab Sevenz (spec.md bagian 3 & 4).
 * Registri statis otomatis yang mengimpor definisi operasi bawaan dan modular
 * tanpa eval/new Function (kepatuhan OWASP & Agent.md bagian 7).
 */

import { KONFIGURASI_SPASIAL } from '../utilitas/konfigurasiPipeline';

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
  operasiBalanceWarna,
  operasiHue,
  operasiPisahKanal,
  operasiRuangWarna,
  operasiSaturasi,
  operasiSepia,
} from './warna';
import {
  operasiEkualisasi,
  operasiGamma,
  operasiPereganganKontras,
} from './enhancement';
import {
  operasiBinerAdaptif,
  operasiBinerManual,
  operasiBinerOtsu,
} from './biner';
import {
  operasiHalusGaussian,
  operasiHalusMean,
  operasiHalusMedian,
} from './smoothing';
import {
  operasiTajamKernel,
  operasiTajamUnsharp,
} from './sharpening';
import { operasiKonvolusiKernel } from './konvolusi';
import {
  operasiTepiLaplacian,
  operasiTepiPrewitt,
  operasiTepiRoberts,
  operasiTepiSobel,
} from './tepi';

/**
 * Daftar kategori operasi citra (spec.md bagian 4).
 */
export const KATEGORI_OPERASI = [
  { id: 'dasar', kunciLabel: 'kategori.dasar' },
  { id: 'warna', kunciLabel: 'kategori.warna' },
  { id: 'enhancement', kunciLabel: 'kategori.enhancement' },
  { id: 'biner', kunciLabel: 'kategori.biner' },
  { id: 'smoothing', kunciLabel: 'kategori.smoothing' },
  { id: 'sharpening', kunciLabel: 'kategori.sharpening' },
  { id: 'konvolusi', kunciLabel: 'kategori.konvolusi' },
  { id: 'tepi', kunciLabel: 'kategori.tepi' },
];

/**
 * Registri internal operasi citra bawaan (30 operasi pada MVP Tahap 4).
 */
const REGISTRI_OPERASI = [
  // 1. Operasi Dasar (8)
  operasiKecerahan,
  operasiKontras,
  operasiNegatif,
  operasiGrayscale,
  operasiFlip,
  operasiRotasi,
  operasiCrop,
  operasiUbahUkuran,

  // 2. Operasi Warna (6)
  operasiPisahKanal,
  operasiRuangWarna,
  operasiSaturasi,
  operasiHue,
  operasiSepia,
  operasiBalanceWarna,

  // 3. Operasi Enhancement (3)
  operasiEkualisasi,
  operasiPereganganKontras,
  operasiGamma,

  // 4. Operasi Biner (3)
  operasiBinerManual,
  operasiBinerOtsu,
  operasiBinerAdaptif,

  // 5. Operasi Smoothing (3)
  operasiHalusMean,
  operasiHalusGaussian,
  operasiHalusMedian,

  // 6. Operasi Sharpening (2)
  operasiTajamUnsharp,
  operasiTajamKernel,

  // 7. Operasi Konvolusi (1)
  operasiKonvolusiKernel,

  // 8. Operasi Deteksi Tepi (4)
  operasiTepiSobel,
  operasiTepiPrewitt,
  operasiTepiRoberts,
  operasiTepiLaplacian,
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
    if (Array.isArray(skema.nilaiAwal)) {
      nilaiAwal[skema.id] = [...skema.nilaiAwal];
    } else {
      nilaiAwal[skema.id] = skema.nilaiAwal;
    }
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
    } else if (skema.tipe === 'sakelar') {
      if (valMasukan === undefined || valMasukan === null) {
        hasil[skema.id] = Boolean(skema.nilaiAwal);
      } else {
        hasil[skema.id] = Boolean(valMasukan);
      }
    } else if (skema.tipe === 'matriks') {
      let arr = valMasukan;
      if (Array.isArray(arr) && Array.isArray(arr[0])) {
        arr = arr.flat();
      }
      if (!Array.isArray(arr)) {
        hasil[skema.id] = Array.isArray(skema.nilaiAwal)
          ? [...skema.nilaiAwal]
          : [];
      } else {
        const panjangHarapan = arr.length === 25 ? 25 : 9;
        const aman = [];
        for (let i = 0; i < panjangHarapan; i++) {
          const v = Number(arr[i]);
          if (!Number.isFinite(v)) {
            aman.push(0);
          } else {
            aman.push(
              Math.max(
                KONFIGURASI_SPASIAL.NILAI_ELEMEN_MATRIKS_MIN,
                Math.min(KONFIGURASI_SPASIAL.NILAI_ELEMEN_MATRIKS_MAX, v)
              )
            );
          }
        }
        hasil[skema.id] = aman;
      }
    } else {
      hasil[skema.id] = valMasukan ?? skema.nilaiAwal;
    }
  }
  return hasil;
}
