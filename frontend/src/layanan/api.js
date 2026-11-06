/**
 * Layanan Klien API PicLab Sevenz (spec.md bagian 9, Tahap 5, & Tahap 6).
 * Menyediakan penghubung komunikasi jaringan antara frontend React dan backend FastAPI.
 * Mengimplementasikan:
 * - Dukungan deployment statis murni tanpa backend (Mode Lokal, 0 health check request)
 * - Pembatalan permintaan usang otomatis (latest-wins AbortController)
 * - Pemetaan kode galat standar (JARINGAN_GAGAL, SERVER_TIDAK_TERSEDIA, BATAS_WAKTU_HABIS)
 * - Privasi penuh: nama berkas generik citra.png (tanpa nama asli) dan bebas log konsol citra
 */

import { BATASAN_BERKAS } from '../utilitas/konfigurasiBerkas';

export const KODE_GALAT_KLIEN_API = {
  JARINGAN_GAGAL: 'JARINGAN_GAGAL',
  SERVER_TIDAK_TERSEDIA: 'SERVER_TIDAK_TERSEDIA',
  BATAS_WAKTU_HABIS: 'BATAS_WAKTU_HABIS',
  DIBATALKAN: 'DIBATALKAN',
  BERKAS_MELEBIHI_BATAS: 'BERKAS_TERLALU_BESAR',
  PIKSEL_TERLALU_BANYAK_UNTUK_OPERASI: 'PIKSEL_TERLALU_BANYAK_UNTUK_OPERASI',
  MODE_LOKAL: 'MODE_LOKAL',
  GALAT_INTERNAL: 'GALAT_INTERNAL',
};

// Map untuk melacak AbortController per rute endpoint (Latest-Wins Gating)
const pengontrolAktifPerRute = new Map();

/**
 * Mendapatkan URL basis API dari variabel lingkungan Vite.
 * Jika VITE_ALAMAT_API tidak diatur atau kosong, mengembalikan string kosong (Mode Lokal).
 */
export function dapatkanAlamatApi() {
  const envUrl = import.meta.env.VITE_ALAMAT_API;
  if (!envUrl || envUrl.trim() === '') {
    return '';
  }
  return envUrl.trim().replace(/\/+$/, '');
}

/**
 * Memeriksa apakah aplikasi berjalan dalam mode statis lokal murni tanpa backend.
 */
export function apakahModeLokal() {
  return dapatkanAlamatApi() === '';
}

/**
 * Memeriksa status kesehatan server backend.
 * Jika dalam Mode Lokal (VITE_ALAMAT_API tidak diatur), TIDAK melakukan pemanggilan jaringan sama sekali.
 *
 * @param {number} [batasWaktuMs=5000] - Batas waktu timeout dalam milidetik
 * @returns {Promise<{ sukses: boolean, data?: object, kode?: string }>}
 */
export async function periksaKesehatan(batasWaktuMs = 5000) {
  const alamat = dapatkanAlamatApi();
  if (!alamat) {
    return {
      sukses: false,
      kode: KODE_GALAT_KLIEN_API.MODE_LOKAL,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), batasWaktuMs);

  try {
    const respons = await fetch(`${alamat}/kesehatan`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    clearTimeout(timer);

    if (respons.ok) {
      const data = await respons.json();
      return { sukses: true, data };
    }
    return {
      sukses: false,
      kode: KODE_GALAT_KLIEN_API.SERVER_TIDAK_TERSEDIA,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      sukses: false,
      kode:
        err.name === 'AbortError'
          ? KODE_GALAT_KLIEN_API.BATAS_WAKTU_HABIS
          : KODE_GALAT_KLIEN_API.SERVER_TIDAK_TERSEDIA,
    };
  }
}

/**
 * Mengirim berkas citra dan parameter ke endpoint server backend.
 * Menerapkan pembatalan otomatis jika ada permintaan baru ke rute yang sama (Latest-Wins).
 *
 * @param {string} rute - Jalur rute endpoint (mis. '/api/v1/tepi/canny')
 * @param {Blob|File} berkasBlob - Data citra dalam bentuk Blob
 * @param {Record<string, any>} [parameter={}] - Parameter operasi tambahan
 * @param {number} [batasWaktuMs=15000] - Batas waktu timeout pemrosesan
 * @returns {Promise<{ sukses: boolean, blob?: Blob, lebar?: number, tinggi?: number, infoOperasi?: string, kode?: string, pesan?: string }>}
 */
export async function kirimGambarKeServer(
  rute,
  berkasBlob,
  parameter = {},
  batasWaktuMs = 15000
) {
  const alamat = dapatkanAlamatApi();
  if (!alamat) {
    return {
      sukses: false,
      kode: KODE_GALAT_KLIEN_API.MODE_LOKAL,
      pesan: 'Operasi server tidak tersedia dalam deployment mode lokal.',
    };
  }

  // 1. Validasi Klien: Periksa ukuran sebelum mengirim ke jaringan
  if (!berkasBlob || berkasBlob.size === 0) {
    return {
      sukses: false,
      kode: 'BERKAS_RUSAK',
      pesan: 'Berkas citra kosong atau tidak valid.',
    };
  }

  if (berkasBlob.size > BATASAN_BERKAS.UKURAN_MAKS_BYTE) {
    return {
      sukses: false,
      kode: KODE_GALAT_KLIEN_API.BERKAS_MELEBIHI_BATAS,
      pesan: 'Ukuran citra melebihi batas maksimum 10 MB.',
    };
  }

  // 2. Pembatalan Permintaan Sebelumnya di Rute yang Sama (Latest-Wins)
  if (pengontrolAktifPerRute.has(rute)) {
    const pengontrolLama = pengontrolAktifPerRute.get(rute);
    pengontrolLama.abort('DIBATALKAN_KARENA_PERMINTAAN_BARU');
  }

  const pengontrolBaru = new AbortController();
  pengontrolAktifPerRute.set(rute, pengontrolBaru);

  let apakahTimeout = false;
  const timer = setTimeout(() => {
    apakahTimeout = true;
    pengontrolBaru.abort('TIMEOUT');
  }, batasWaktuMs);

  try {
    const urlLengkap = `${alamat}${rute.startsWith('/') ? rute : `/${rute}`}`;

    // 3. Susun Multipart Form Data dengan nama berkas generik (Privasi OWASP)
    const formData = new FormData();
    formData.append('gambar', berkasBlob, 'citra.png');

    // Lampirkan string JSON parameter terstruktur (untuk endpoint FastAPI Tahap 6)
    formData.append('parameter', JSON.stringify(parameter));

    // Lampirkan juga key individual untuk kompatibilitas endpoint lain (mis. /api/uji/gema)
    for (const [kunci, nilai] of Object.entries(parameter)) {
      if (kunci !== 'parameter' && nilai !== undefined && nilai !== null) {
        formData.append(kunci, String(nilai));
      }
    }

    const respons = await fetch(urlLengkap, {
      method: 'POST',
      body: formData,
      signal: pengontrolBaru.signal,
    });

    clearTimeout(timer);
    pengontrolAktifPerRute.delete(rute);

    // 4. Tangani Respons Berhasil (200 OK)
    if (respons.ok) {
      const blobHasil = await respons.blob();
      const lebar = Number(respons.headers.get('x-lebar')) || 0;
      const tinggi = Number(respons.headers.get('x-tinggi')) || 0;
      const infoOperasi = respons.headers.get('x-info-operasi') || '';

      return {
        sukses: true,
        blob: blobHasil,
        lebar,
        tinggi,
        infoOperasi,
      };
    }

    // 5. Tangani Respons Galat Terstruktur Server (4xx, 5xx)
    try {
      const dataGalat = await respons.json();
      return {
        sukses: false,
        kode: dataGalat.kode || KODE_GALAT_KLIEN_API.GALAT_INTERNAL,
        pesan: dataGalat.pesan || 'Terjadi kesalahan pada server.',
      };
    } catch {
      return {
        sukses: false,
        kode: KODE_GALAT_KLIEN_API.GALAT_INTERNAL,
        pesan: `Galat server dengan status ${respons.status}.`,
      };
    }
  } catch (err) {
    clearTimeout(timer);
    pengontrolAktifPerRute.delete(rute);

    if (err.name === 'AbortError') {
      if (apakahTimeout) {
        return {
          sukses: false,
          kode: KODE_GALAT_KLIEN_API.BATAS_WAKTU_HABIS,
          pesan: 'Batas waktu pemrosesan permintaan telah terlampaui.',
        };
      }
      return {
        sukses: false,
        kode: KODE_GALAT_KLIEN_API.DIBATALKAN,
        pesan:
          'Permintaan dibatalkan karena ada aksi pengguna yang lebih baru.',
      };
    }

    // Galat Jaringan Murni (Server mati, koneksi putus, CORS error)
    return {
      sukses: false,
      kode: KODE_GALAT_KLIEN_API.SERVER_TIDAK_TERSEDIA,
      pesan: 'Tidak dapat terhubung ke server backend.',
    };
  }
}
