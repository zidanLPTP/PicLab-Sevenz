/**
 * Operasi Server: Deteksi Tepi Canny (spec.md bagian 4 & Tahap 6).
 */

import { kirimGambarKeServer } from '../layanan/api';
import { citraKeBlobPng, blobPngKeCitra } from '../utilitas/konversiCitraBlob';

export const operasiTepiCanny = {
  id: 'tepi_canny',
  lokasi: 'server',
  kategori: 'tepi',
  kunciNama: 'operasi.tepiCanny.nama',
  kunciDeskripsi: 'operasi.tepiCanny.deskripsi',
  namaTeknis: 'Canny Multi-Stage Edge Detector (OpenCV)',
  ruteServer: '/api/v1/tepi/canny',
  skemaParameter: [
    {
      id: 'ambang_bawah',
      kunciLabel: 'parameter.ambangBawah',
      tipe: 'slider',
      min: 0,
      max: 255,
      step: 1,
      nilaiAwal: 50,
    },
    {
      id: 'ambang_atas',
      kunciLabel: 'parameter.ambangAtas',
      tipe: 'slider',
      min: 0,
      max: 255,
      step: 1,
      nilaiAwal: 150,
    },
    {
      id: 'ukuran_apertur',
      kunciLabel: 'parameter.ukuranApertur',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 3, label: '3x3' },
        { nilai: 5, label: '5x5' },
        { nilai: 7, label: '7x7' },
      ],
      nilaiAwal: 3,
    },
    {
      id: 'l2_gradient',
      kunciLabel: 'parameter.l2Gradient',
      tipe: 'sakelar',
      nilaiAwal: false,
    },
    {
      id: 'blur_awal',
      kunciLabel: 'parameter.blurAwal',
      tipe: 'sakelar',
      nilaiAwal: true,
    },
    {
      id: 'inversi',
      kunciLabel: 'parameter.inversi',
      tipe: 'sakelar',
      nilaiAwal: false,
    },
  ],
  async terapkan(citra, parameter = {}) {
    const blob = await citraKeBlobPng(citra);
    const respons = await kirimGambarKeServer(
      '/api/v1/tepi/canny',
      blob,
      parameter,
      15000
    );
    if (!respons.sukses || !respons.blob) {
      throw new Error(respons.pesan || 'Operasi deteksi tepi Canny gagal.');
    }
    return await blobPngKeCitra(respons.blob);
  },
};

export default operasiTepiCanny;
