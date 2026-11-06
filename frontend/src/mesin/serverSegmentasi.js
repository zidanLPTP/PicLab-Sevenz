/**
 * Operasi Server: Segmentasi Citra K-Means & Multi-Otsu (spec.md bagian 4 & Tahap 6).
 */

import { kirimGambarKeServer } from '../layanan/api';
import { citraKeBlobPng, blobPngKeCitra } from '../utilitas/konversiCitraBlob';

export const operasiSegmentasi = {
  id: 'segmentasi_citra',
  lokasi: 'server',
  kategori: 'segmentasi',
  kunciNama: 'operasi.segmentasi.nama',
  kunciDeskripsi: 'operasi.segmentasi.deskripsi',
  namaTeknis: 'Color Quantization K-Means & Multi-Otsu (OpenCV)',
  ruteServer: '/api/v1/segmentasi',
  skemaParameter: [
    {
      id: 'metode',
      kunciLabel: 'parameter.metodeSegmentasi',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'kmeans', label: 'K-Means Kuantisasi Warna' },
        { nilai: 'multi_otsu', label: 'Multi-Level Otsu Thresholding' },
      ],
      nilaiAwal: 'kmeans',
    },
    {
      id: 'k',
      kunciLabel: 'parameter.jumlahKlasterK',
      tipe: 'slider',
      min: 2,
      max: 12,
      step: 1,
      nilaiAwal: 4,
    },
    {
      id: 'kelas',
      kunciLabel: 'parameter.jumlahKelasOtsu',
      tipe: 'slider',
      min: 2,
      max: 5,
      step: 1,
      nilaiAwal: 3,
    },
  ],
  async terapkan(citra, parameter = {}) {
    const blob = await citraKeBlobPng(citra);
    const respons = await kirimGambarKeServer(
      '/api/v1/segmentasi',
      blob,
      parameter,
      15000
    );
    if (!respons.sukses || !respons.blob) {
      throw new Error(respons.pesan || 'Operasi segmentasi citra gagal.');
    }
    return await blobPngKeCitra(respons.blob);
  },
};

export default operasiSegmentasi;
