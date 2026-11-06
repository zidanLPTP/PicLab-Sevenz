/**
 * Eksekutor Pipeline Sekuensial PicLab Sevenz (spec.md Tahap 3 & Tahap 5).
 * Mengimplementasikan pemrosesan berantai berkinerja tinggi,
 * propagasi dimensi geometris (crop/resize/rotate), prefix caching,
 * serta dukungan operasi sinkron (klien) dan asinkron (server).
 */

import {
  bersihkanParameter,
  dapatkanOperasiBerdasarkanId,
} from './katalogOperasi';

/**
 * Menghasilkan signature unik untuk sebuah langkah pipeline guna deteksi prefix cache.
 * @param {object} langkah
 * @returns {string}
 */
export function hitungSignatureLangkah(langkah) {
  if (!langkah || !langkah.aktif) return 'NONAKTIF';
  const param = langkah.parameter || {};
  const kunciTerurut = Object.keys(param).sort();
  const pasangan = kunciTerurut.map((k) => `${k}:${param[k]}`).join(',');
  return `${langkah.idOperasi}|${pasangan}`;
}

/**
 * Menyalin objek citra murni { data, width, height } dengan aman.
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
export function salinObjekCitra(citra) {
  return {
    data: new Uint8ClampedArray(citra.data),
    width: citra.width,
    height: citra.height,
  };
}

/**
 * Menjalankan rangkaian langkah pipeline secara sekuensial (sinkron).
 *
 * @param {Array<object>} daftarLangkah - Tumpukan langkah pipeline
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citraAwal - Citra awal masukan
 * @param {{ rasio: number }} [konteksSkala={ rasio: 1.0 }] - Konteks skala untuk operasi geometris
 * @param {Array<object>|false|null} [cacheLama=null] - Cache prefix dari eksekusi sebelumnya (false jika nonaktif)
 * @returns {{ hasil: object, cacheBaru: Array<object>|null, indeksMulaiKomputasi: number, langkahDieksekusi: number }}
 */
export function eksekusiPipelineSekuensial(
  daftarLangkah = [],
  citraAwal,
  konteksSkala = { rasio: 1.0 },
  cacheLama = null
) {
  if (!citraAwal || !citraAwal.data) {
    throw new Error('Citra awal masukan tidak valid untuk eksekusi pipeline.');
  }

  // Jika pipeline kosong, langsung kembalikan salinan citra awal
  if (!daftarLangkah || daftarLangkah.length === 0) {
    return {
      hasil: salinObjekCitra(citraAwal),
      cacheBaru: cacheLama === false ? null : [],
      indeksMulaiKomputasi: 0,
      langkahDieksekusi: 0,
    };
  }

  const gunakanCache = cacheLama !== false && Array.isArray(cacheLama);
  let indeksMulai = 0;

  // Evaluasi prefix cache: temukan langkah pertama yang berbeda atau belum tercache
  if (gunakanCache && cacheLama.length > 0) {
    const minLen = Math.min(daftarLangkah.length, cacheLama.length);
    for (let i = 0; i < minLen; i++) {
      const sigLangkah = hitungSignatureLangkah(daftarLangkah[i]);
      if (cacheLama[i] && cacheLama[i].signature === sigLangkah) {
        indeksMulai = i + 1;
      } else {
        break;
      }
    }
  }

  let citraSaatIni;
  let cacheBaru = null;

  if (cacheLama !== false) {
    cacheBaru =
      gunakanCache && indeksMulai > 0 ? cacheLama.slice(0, indeksMulai) : [];
  }

  // Ambil citra basis dari cache prefix atau citra awal
  if (indeksMulai > 0 && gunakanCache && cacheLama[indeksMulai - 1]?.citra) {
    citraSaatIni = salinObjekCitra(cacheLama[indeksMulai - 1].citra);
  } else {
    citraSaatIni = salinObjekCitra(citraAwal);
    indeksMulai = 0;
  }

  let langkahDieksekusi = 0;

  // Eksekusi sekuensial dari indeksMulai hingga akhir pipeline
  for (let i = indeksMulai; i < daftarLangkah.length; i++) {
    const langkah = daftarLangkah[i];

    if (langkah.aktif) {
      const op = dapatkanOperasiBerdasarkanId(langkah.idOperasi);
      if (!op) {
        throw new Error(
          `Operasi dengan ID "${langkah.idOperasi}" pada langkah ke-${i + 1} tidak ditemukan.`
        );
      }

      const paramBersih = bersihkanParameter(op, langkah.parameter);
      // Eksekusi operasi murni: citraSaatIni diperbarui dengan hasil baru
      citraSaatIni = op.terapkan(citraSaatIni, paramBersih, konteksSkala);
      langkahDieksekusi++;
    }

    // Perbarui cache prefix jika caching diaktifkan
    if (cacheBaru !== null) {
      cacheBaru[i] = {
        signature: hitungSignatureLangkah(langkah),
        citra: salinObjekCitra(citraSaatIni),
      };
    }
  }

  return {
    hasil: citraSaatIni,
    cacheBaru,
    indeksMulaiKomputasi: indeksMulai,
    langkahDieksekusi,
  };
}

/**
 * Menjalankan rangkaian langkah pipeline secara sekuensial dengan dukungan operasi asinkron (sisi server).
 *
 * @param {Array<object>} daftarLangkah - Tumpukan langkah pipeline
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citraAwal - Citra awal masukan
 * @param {{ rasio: number }} [konteksSkala={ rasio: 1.0 }] - Konteks skala untuk operasi geometris
 * @param {Array<object>|false|null} [cacheLama=null] - Cache prefix dari eksekusi sebelumnya
 * @returns {Promise<{ hasil: object, cacheBaru: Array<object>|null, indeksMulaiKomputasi: number, langkahDieksekusi: number }>}
 */
export async function eksekusiPipelineAsinkron(
  daftarLangkah = [],
  citraAwal,
  konteksSkala = { rasio: 1.0 },
  cacheLama = null
) {
  if (!citraAwal || !citraAwal.data) {
    throw new Error('Citra awal masukan tidak valid untuk eksekusi pipeline.');
  }

  if (!daftarLangkah || daftarLangkah.length === 0) {
    return {
      hasil: salinObjekCitra(citraAwal),
      cacheBaru: cacheLama === false ? null : [],
      indeksMulaiKomputasi: 0,
      langkahDieksekusi: 0,
    };
  }

  const gunakanCache = cacheLama !== false && Array.isArray(cacheLama);
  let indeksMulai = 0;

  if (gunakanCache && cacheLama.length > 0) {
    const minLen = Math.min(daftarLangkah.length, cacheLama.length);
    for (let i = 0; i < minLen; i++) {
      const sigLangkah = hitungSignatureLangkah(daftarLangkah[i]);
      if (cacheLama[i] && cacheLama[i].signature === sigLangkah) {
        indeksMulai = i + 1;
      } else {
        break;
      }
    }
  }

  let citraSaatIni;
  let cacheBaru = null;

  if (cacheLama !== false) {
    cacheBaru =
      gunakanCache && indeksMulai > 0 ? cacheLama.slice(0, indeksMulai) : [];
  }

  if (indeksMulai > 0 && gunakanCache && cacheLama[indeksMulai - 1]?.citra) {
    citraSaatIni = salinObjekCitra(cacheLama[indeksMulai - 1].citra);
  } else {
    citraSaatIni = salinObjekCitra(citraAwal);
    indeksMulai = 0;
  }

  let langkahDieksekusi = 0;

  for (let i = indeksMulai; i < daftarLangkah.length; i++) {
    const langkah = daftarLangkah[i];

    if (langkah.aktif) {
      const op = dapatkanOperasiBerdasarkanId(langkah.idOperasi);
      if (!op) {
        throw new Error(
          `Operasi dengan ID "${langkah.idOperasi}" pada langkah ke-${i + 1} tidak ditemukan.`
        );
      }

      const paramBersih = bersihkanParameter(op, langkah.parameter);
      citraSaatIni = await op.terapkan(citraSaatIni, paramBersih, konteksSkala);
      langkahDieksekusi++;
    }

    if (cacheBaru !== null) {
      cacheBaru[i] = {
        signature: hitungSignatureLangkah(langkah),
        citra: salinObjekCitra(citraSaatIni),
      };
    }
  }

  return {
    hasil: citraSaatIni,
    cacheBaru,
    indeksMulaiKomputasi: indeksMulai,
    langkahDieksekusi,
  };
}
