/**
 * Definisi operasi citra percobaan sisi server (Tahap 5).
 * Hanya aktif pada mode pengujian / pengembangan (VITE_MODE_SERVER_UJI === 'true').
 * Mencontohkan skema operasi server (lokasi: 'server') untuk fondasi Tahap 6.
 */

import { kirimGambarKeServer } from '../../layanan/api';

/**
 * Mengonversi piksel RGBA ke Blob PNG di browser maupun Web Worker.
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra
 * @returns {Promise<Blob>}
 */
async function citraKeBlobPng(citra) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const kanvas = new OffscreenCanvas(citra.width, citra.height);
    const ctx = kanvas.getContext('2d');
    const imageData = new ImageData(
      new Uint8ClampedArray(citra.data),
      citra.width,
      citra.height
    );
    ctx.putImageData(imageData, 0, 0);
    return await kanvas.convertToBlob({ type: 'image/png' });
  }

  if (typeof document !== 'undefined' && document.createElement) {
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
    return await new Promise((resolve) => kanvas.toBlob(resolve, 'image/png'));
  }

  throw new Error('Lingkungan eksekusi tidak mendukung pembuatan Blob citra.');
}

/**
 * Mengonversi Blob PNG dari respons backend kembali ke objek ImageData { data, width, height }.
 * @param {Blob} blob
 * @returns {Promise<{ data: Uint8ClampedArray, width: number, height: number }>}
 */
async function blobPngKeCitra(blob) {
  const imgBitmap = await createImageBitmap(blob);
  const lebar = imgBitmap.width;
  const tinggi = imgBitmap.height;

  if (typeof OffscreenCanvas !== 'undefined') {
    const kanvas = new OffscreenCanvas(lebar, tinggi);
    const ctx = kanvas.getContext('2d');
    ctx.drawImage(imgBitmap, 0, 0);
    const dataHasil = ctx.getImageData(0, 0, lebar, tinggi);
    return {
      data: dataHasil.data,
      width: lebar,
      height: tinggi,
    };
  }

  if (typeof document !== 'undefined' && document.createElement) {
    const kanvas = document.createElement('canvas');
    kanvas.width = lebar;
    kanvas.height = tinggi;
    const ctx = kanvas.getContext('2d');
    ctx.drawImage(imgBitmap, 0, 0);
    const dataHasil = ctx.getImageData(0, 0, lebar, tinggi);
    return {
      data: dataHasil.data,
      width: lebar,
      height: tinggi,
    };
  }

  throw new Error('Lingkungan eksekusi tidak mendukung dekode Blob citra.');
}

export const operasiServerUjiGema = {
  id: 'server_uji_gema',
  lokasi: 'server', // Skema penentu eksekusi: 'server' vs 'klien' (spec.md bagian 3)
  kategori: 'dasar',
  kunciNama: 'operasi.serverUji.nama',
  kunciDeskripsi: 'operasi.serverUji.deskripsi',
  namaTeknis: 'Backend Echo Horizontal Flip via FastAPI',
  ruteServer: '/api/uji/gema',
  skemaParameter: [
    {
      id: 'balik_horizontal',
      kunciLabel: 'parameter.balikHorizontal',
      tipe: 'boolean',
      nilaiAwal: true,
    },
  ],
  /**
   * Mengirim citra ke endpoint backend sungguhan dan mengembalikan citra hasil.
   *
   * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra
   * @param {Record<string, any>} parameter
   * @returns {Promise<{ data: Uint8ClampedArray, width: number, height: number }>}
   */
  async terapkan(citra, parameter = {}) {
    // 1. Ubah citra memori ke Blob PNG
    const blob = await citraKeBlobPng(citra);

    // 2. Kirim ke backend melalui layanan API (koneksi HTTP sungguhan)
    const respons = await kirimGambarKeServer(
      '/api/uji/gema',
      blob,
      { balik_horizontal: parameter.balik_horizontal ?? true },
      10000
    );

    if (!respons.sukses || !respons.blob) {
      throw new Error(respons.pesan || 'Operasi server gagal diproses.');
    }

    // 3. Dekode kembali blob keluaran PNG dari server ke piksel murni
    return await blobPngKeCitra(respons.blob);
  },
};

export default operasiServerUjiGema;
