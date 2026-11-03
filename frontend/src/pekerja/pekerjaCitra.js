/**
 * Web Worker untuk pemrosesan citra PicLab Sevenz di thread terpisah.
 * Menjamin antarmuka pengguna tidak membeku saat komputasi berlangsung.
 */

import { dapatkanOperasiBerdasarkanId } from '../mesin/katalogOperasi';

self.onmessage = function (e) {
  const { idPermintaan, idOperasi, citra, parameter } = e.data;

  try {
    const operasi = dapatkanOperasiBerdasarkanId(idOperasi);
    if (!operasi) {
      throw new Error(`Operasi dengan ID "${idOperasi}" tidak ditemukan.`);
    }

    // Pastikan citra.data berupa Uint8ClampedArray
    const dataClamped =
      citra.data instanceof Uint8ClampedArray
        ? citra.data
        : new Uint8ClampedArray(citra.data);

    const masukanCitra = {
      data: dataClamped,
      width: citra.width,
      height: citra.height,
    };

    // Eksekusi fungsi murni
    const waktuAwal = performance.now();
    const hasil = operasi.terapkan(masukanCitra, parameter);
    const durasi = performance.now() - waktuAwal;

    // Kirim hasil kembali ke thread utama dengan Transferable ArrayBuffer
    const bufferTransfer = hasil.data.buffer;

    self.postMessage(
      {
        idPermintaan,
        berhasil: true,
        durasi,
        hasil: {
          data: hasil.data,
          width: hasil.width,
          height: hasil.height,
        },
      },
      [bufferTransfer]
    );
  } catch (err) {
    self.postMessage({
      idPermintaan,
      berhasil: false,
      pesanGalat: err.message || 'Galat tidak diketahui di Web Worker',
    });
  }
};
