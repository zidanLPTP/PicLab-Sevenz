/**
 * Web Worker untuk pemrosesan citra PicLab Sevenz di thread terpisah.
 * Menjamin antarmuka pengguna tidak membeku saat komputasi berlangsung.
 * Kepatuhan OWASP & Agent.md: Registri statis murni tanpa eval atau new Function.
 * Mendukung eksekusi sekuensial pipeline non-destruktif dan prefix caching.
 */

import { eksekusiPipelineSekuensial } from '../mesin/eksekutorPipeline';
import {
  bersihkanParameter,
  dapatkanOperasiBerdasarkanId,
} from '../mesin/katalogOperasi';

// Memori cache prefix sekuensial tingkat worker (hanya untuk preview interaktif)
let cachePrefixWorker = [];

self.onmessage = function (e) {
  const dataPesan = e.data || {};

  // Perintah pembersihan cache saat citra utama diganti
  if (dataPesan.tipe === 'BERSIHKAN_CACHE') {
    cachePrefixWorker = [];
    return;
  }

  const tWorkerMasuk = performance.now();

  // Eksekusi Pipeline Sekuensial (Tahap 3)
  if (dataPesan.tipe === 'EKSEKUSI_PIPELINE') {
    const {
      idPermintaan,
      daftarLangkah,
      citra,
      konteksSkala,
      gunakanPrefixCache,
      tKirim,
    } = dataPesan;

    try {
      const dataClamped =
        citra.data instanceof Uint8ClampedArray
          ? citra.data
          : new Uint8ClampedArray(citra.data);

      const masukanCitra = {
        data: dataClamped,
        width: citra.width,
        height: citra.height,
      };

      const cacheMasukan = gunakanPrefixCache ? cachePrefixWorker : false;
      const waktuAwal = performance.now();

      const hasilEksekusi = eksekusiPipelineSekuensial(
        daftarLangkah || [],
        masukanCitra,
        konteksSkala || { rasio: 1.0 },
        cacheMasukan
      );

      const tWorkerSelesai = performance.now();
      const durasi = tWorkerSelesai - waktuAwal;

      // Simpan pembaruan prefix cache jika diaktifkan
      if (gunakanPrefixCache && hasilEksekusi.cacheBaru) {
        cachePrefixWorker = hasilEksekusi.cacheBaru;
      }

      const bufferTransfer = hasilEksekusi.hasil.data.buffer;

      self.postMessage(
        {
          idPermintaan,
          berhasil: true,
          durasi,
          indeksMulaiKomputasi: hasilEksekusi.indeksMulaiKomputasi,
          langkahDieksekusi: hasilEksekusi.langkahDieksekusi,
          waktuRinci: {
            tKirim: tKirim || 0,
            tWorkerMasuk,
            tWorkerSelesai,
            tWorkerKirim: performance.now(),
            durasiWorker: durasi,
          },
          hasil: {
            data: hasilEksekusi.hasil.data,
            width: hasilEksekusi.hasil.width,
            height: hasilEksekusi.hasil.height,
          },
        },
        [bufferTransfer]
      );
    } catch (err) {
      self.postMessage({
        idPermintaan,
        berhasil: false,
        pesanGalat: err.message || 'Galat eksekusi pipeline di Web Worker',
      });
    }
    return;
  }

  // Eksekusi Operasi Tunggal (Kompatibilitas Tahap 2)
  const { idPermintaan, idOperasi, citra, parameter, konteksSkala, tKirim } =
    dataPesan;

  try {
    const operasi = dapatkanOperasiBerdasarkanId(idOperasi);
    if (!operasi) {
      throw new Error(`Operasi dengan ID "${idOperasi}" tidak ditemukan.`);
    }

    const dataClamped =
      citra.data instanceof Uint8ClampedArray
        ? citra.data
        : new Uint8ClampedArray(citra.data);

    const masukanCitra = {
      data: dataClamped,
      width: citra.width,
      height: citra.height,
    };

    const parameterBersih = bersihkanParameter(operasi, parameter);
    const waktuAwal = performance.now();
    const hasil = operasi.terapkan(
      masukanCitra,
      parameterBersih,
      konteksSkala || { rasio: 1.0 }
    );
    const tWorkerSelesai = performance.now();
    const durasi = tWorkerSelesai - waktuAwal;

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
