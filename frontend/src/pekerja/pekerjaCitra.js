/**
 * Web Worker untuk pemrosesan citra PicLab Sevenz di thread terpisah.
 * Menjamin antarmuka pengguna tidak membeku saat komputasi berlangsung.
 */

import {
  bersihkanParameter,
  daftarkanOperasiBaru,
  dapatkanOperasiBerdasarkanId,
} from '../mesin/katalogOperasi';

self.onmessage = function (e) {
  // Tangani pesan pendaftaran dinamis operasi baru (V6)
  if (e.data?.tipe === 'DAFTARKAN_OPERASI') {
    const { definisi } = e.data;
    try {
      if (!definisi || !definisi.id) {
        throw new Error('Definisi operasi tidak memiliki ID.');
      }
      let fnTerapkan;
      if (typeof definisi.terapkan === 'function') {
        fnTerapkan = definisi.terapkan;
      } else if (definisi.sumberFungsi) {
        let str = definisi.sumberFungsi.trim();
        if (
          !str.startsWith('function') &&
          !str.startsWith('(') &&
          !str.includes('=>')
        ) {
          str = 'function ' + str;
        }
        // eslint-disable-next-line no-new-func
        fnTerapkan = new Function('return (' + str + ')')();
      } else {
        throw new Error(
          'Fungsi terapkan tidak ditemukan pada definisi operasi.'
        );
      }

      daftarkanOperasiBaru({
        ...definisi,
        terapkan: fnTerapkan,
      });

      self.postMessage({
        tipe: 'DAFTARKAN_OPERASI_SUKSES',
        idOperasi: definisi.id,
      });
    } catch (err) {
      self.postMessage({
        tipe: 'DAFTARKAN_OPERASI_GAGAL',
        idOperasi: definisi?.id,
        pesanGalat: err.message,
      });
    }
    return;
  }

  const tWorkerMasuk = performance.now();
  const { idPermintaan, idOperasi, citra, parameter, tKirim } = e.data;

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

    // Bersihkan dan sanitasi parameter sesuai skema operasi
    const parameterBersih = bersihkanParameter(operasi, parameter);

    // Eksekusi fungsi murni
    const waktuAwal = performance.now();
    const hasil = operasi.terapkan(masukanCitra, parameterBersih);
    const tWorkerSelesai = performance.now();
    const durasi = tWorkerSelesai - waktuAwal;

    // Kirim hasil kembali ke thread utama dengan Transferable ArrayBuffer
    const bufferTransfer = hasil.data.buffer;

    self.postMessage(
      {
        idPermintaan,
        berhasil: true,
        durasi,
        waktuRinci: {
          tKirim: tKirim || 0,
          tWorkerMasuk,
          tWorkerSelesai,
          tWorkerKirim: performance.now(),
          durasiWorker: durasi,
        },
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
