/**
 * Operasi Server: Reduksi Noise Bilateral, NLM, & Median (spec.md bagian 4 & Tahap 6).
 */

import { kirimGambarKeServer } from '../layanan/api';
import { citraKeBlobPng, blobPngKeCitra } from '../utilitas/konversiCitraBlob';

export const operasiNoise = {
  id: 'noise_reduksi',
  lokasi: 'server',
  kategori: 'noise',
  kunciNama: 'operasi.noise.nama',
  kunciDeskripsi: 'operasi.noise.deskripsi',
  namaTeknis: 'Advanced Noise Reduction (Bilateral, NLM, Median)',
  ruteServer: '/api/v1/noise/reduksi',
  skemaParameter: [
    {
      id: 'metode',
      kunciLabel: 'parameter.metodeNoise',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'bilateral', label: 'Bilateral Filter (Jaga Tepi)' },
        { nilai: 'nlm', label: 'Non-Local Means (NLM Tekstur)' },
        { nilai: 'median', label: 'Median Denoising' },
      ],
      nilaiAwal: 'bilateral',
    },
    {
      id: 'diameter',
      kunciLabel: 'parameter.diameterBilateral',
      tipe: 'slider',
      min: 1,
      max: 21,
      step: 2,
      nilaiAwal: 9,
    },
    {
      id: 'sigma_warna',
      kunciLabel: 'parameter.sigmaWarna',
      tipe: 'slider',
      min: 10,
      max: 200,
      step: 5,
      nilaiAwal: 75,
    },
    {
      id: 'sigma_ruang',
      kunciLabel: 'parameter.sigmaRuang',
      tipe: 'slider',
      min: 10,
      max: 200,
      step: 5,
      nilaiAwal: 75,
    },
    {
      id: 'kekuatan_filter',
      kunciLabel: 'parameter.kekuatanNlm',
      tipe: 'slider',
      min: 1,
      max: 30,
      step: 1,
      nilaiAwal: 10,
    },
    {
      id: 'ukuran_kernel',
      kunciLabel: 'parameter.ukuranKernelMedian',
      tipe: 'slider',
      min: 3,
      max: 21,
      step: 2,
      nilaiAwal: 5,
    },
  ],
  async terapkan(citra, parameter = {}) {
    const blob = await citraKeBlobPng(citra);
    const respons = await kirimGambarKeServer(
      '/api/v1/noise/reduksi',
      blob,
      parameter,
      15000
    );
    if (!respons.sukses || !respons.blob) {
      throw new Error(respons.pesan || 'Operasi reduksi noise gagal.');
    }
    return await blobPngKeCitra(respons.blob);
  },
};

export default operasiNoise;
