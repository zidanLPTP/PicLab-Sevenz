/**
 * Operasi Server: Morfologi Matematika (spec.md bagian 4 & Tahap 6).
 */

import { kirimGambarKeServer } from '../layanan/api';
import { citraKeBlobPng, blobPngKeCitra } from '../utilitas/konversiCitraBlob';

export const operasiMorfologi = {
  id: 'morfologi_matematika',
  lokasi: 'server',
  kategori: 'morfologi',
  kunciNama: 'operasi.morfologi.nama',
  kunciDeskripsi: 'operasi.morfologi.deskripsi',
  namaTeknis: 'Mathematical Morphology Filtering (OpenCV)',
  ruteServer: '/api/v1/morfologi',
  skemaParameter: [
    {
      id: 'operasi',
      kunciLabel: 'parameter.jenisOperasiMorfologi',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'erosi', label: 'Erosi (Erode)' },
        { nilai: 'dilasi', label: 'Dilasi (Dilate)' },
        { nilai: 'opening', label: 'Opening (Buka)' },
        { nilai: 'closing', label: 'Closing (Tutup)' },
        { nilai: 'gradient', label: 'Gradien Morfologi' },
        { nilai: 'tophat', label: 'Top Hat' },
        { nilai: 'blackhat', label: 'Black Hat' },
      ],
      nilaiAwal: 'erosi',
    },
    {
      id: 'bentuk_elemen',
      kunciLabel: 'parameter.bentukElemen',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'persegi', label: 'Persegi (Rectangle)' },
        { nilai: 'silang', label: 'Silang (Cross)' },
        { nilai: 'elips', label: 'Elips / Lingkaran' },
      ],
      nilaiAwal: 'persegi',
    },
    {
      id: 'ukuran',
      kunciLabel: 'parameter.ukuranKernel',
      tipe: 'slider',
      min: 1,
      max: 25,
      step: 2,
      nilaiAwal: 3,
    },
    {
      id: 'iterasi',
      kunciLabel: 'parameter.iterasi',
      tipe: 'slider',
      min: 1,
      max: 5,
      step: 1,
      nilaiAwal: 1,
    },
  ],
  async terapkan(citra, parameter = {}) {
    const blob = await citraKeBlobPng(citra);
    const respons = await kirimGambarKeServer(
      '/api/v1/morfologi',
      blob,
      parameter,
      15000
    );
    if (!respons.sukses || !respons.blob) {
      throw new Error(respons.pesan || 'Operasi morfologi citra gagal.');
    }
    return await blobPngKeCitra(respons.blob);
  },
};

export default operasiMorfologi;
