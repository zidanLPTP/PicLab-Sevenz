/**
 * Definisi operasi citra percobaan sisi server (Tahap 5).
 * Hanya aktif pada mode pengujian / pengembangan (VITE_MODE_SERVER_UJI === 'true' atau test).
 * Mencontohkan skema operasi server (lokasi: 'server') untuk fondasi Tahap 6.
 */

import { kirimGambarKeServer } from '../../layanan/api';

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
   * Mengirim citra ke endpoint backend dan mengembalikan hasil citra.
   *
   * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra
   * @param {Record<string, any>} parameter
   * @returns {Promise<{ data: Uint8ClampedArray, width: number, height: number }>}
   */
  async terapkan(citra, parameter = {}) {
    // Penanganan khusus lingkungan headless/uji unit tanpa kanvas browser DOM
    if (
      typeof document === 'undefined' ||
      typeof ImageData === 'undefined' ||
      !document.createElement
    ) {
      const dataBaru = new Uint8ClampedArray(citra.data);
      if (parameter.balik_horizontal ?? true) {
        for (let y = 0; y < citra.height; y++) {
          for (let x = 0; x < Math.floor(citra.width / 2); x++) {
            const idx1 = (y * citra.width + x) * 4;
            const idx2 = (y * citra.width + (citra.width - 1 - x)) * 4;
            for (let c = 0; c < 4; c++) {
              const temp = dataBaru[idx1 + c];
              dataBaru[idx1 + c] = dataBaru[idx2 + c];
              dataBaru[idx2 + c] = temp;
            }
          }
        }
      }
      return {
        data: dataBaru,
        width: citra.width,
        height: citra.height,
      };
    }

    // 1. Ubah citra memori ke Blob PNG di browser
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

    const blob = await new Promise((resolve) =>
      kanvas.toBlob(resolve, 'image/png')
    );

    // 2. Kirim ke backend melalui layanan API
    const respons = await kirimGambarKeServer(
      '/api/uji/gema',
      blob,
      { balik_horizontal: parameter.balik_horizontal ?? true },
      10000
    );

    if (!respons.sukses || !respons.blob) {
      throw new Error(respons.pesan || 'Operasi server gagal.');
    }

    // 3. Dekode kembali blob keluaran PNG dari server ke citra piksel murni
    const imgBitmap = await createImageBitmap(respons.blob);
    kanvas.width = imgBitmap.width;
    kanvas.height = imgBitmap.height;
    ctx.drawImage(imgBitmap, 0, 0);
    const dataHasil = ctx.getImageData(0, 0, kanvas.width, kanvas.height);

    return {
      data: dataHasil.data,
      width: kanvas.width,
      height: kanvas.height,
    };
  },
};

export default operasiServerUjiGema;
