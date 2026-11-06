/**
 * Operasi Server: Pemfilteran Domain Frekuensi FFT (spec.md bagian 4 & Tahap 6).
 */

import { kirimGambarKeServer } from '../layanan/api';
import { citraKeBlobPng, blobPngKeCitra } from '../utilitas/konversiCitraBlob';

export const operasiFrekuensi = {
  id: 'frekuensi_fft',
  lokasi: 'server',
  kategori: 'frekuensi',
  kunciNama: 'operasi.frekuensi.nama',
  kunciDeskripsi: 'operasi.frekuensi.deskripsi',
  namaTeknis: '2D Fast Fourier Transform Frequency Filtering (NumPy FFT)',
  ruteServer: '/api/v1/frekuensi',
  skemaParameter: [
    {
      id: 'jenis_filter',
      kunciLabel: 'parameter.jenisFilterFrekuensi',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'ideal', label: 'Ideal Filter' },
        { nilai: 'gaussian', label: 'Gaussian Filter' },
        { nilai: 'butterworth', label: 'Butterworth Filter' },
      ],
      nilaiAwal: 'ideal',
    },
    {
      id: 'tipe_filter',
      kunciLabel: 'parameter.tipeFilterFrekuensi',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'lowpass', label: 'Lolos-Rendah (Low-Pass)' },
        { nilai: 'highpass', label: 'Lolos-Tinggi (High-Pass)' },
      ],
      nilaiAwal: 'lowpass',
    },
    {
      id: 'frekuensi_cut_off',
      kunciLabel: 'parameter.frekuensiCutOff',
      tipe: 'slider',
      min: 5,
      max: 200,
      step: 5,
      nilaiAwal: 30,
    },
    {
      id: 'orde',
      kunciLabel: 'parameter.ordeButterworth',
      tipe: 'slider',
      min: 1,
      max: 6,
      step: 1,
      nilaiAwal: 2,
    },
    {
      id: 'mode_keluaran',
      kunciLabel: 'parameter.modeKeluaranFft',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'gambar_terfilter', label: 'Citra Rekonstruksi Spasial' },
        {
          nilai: 'spektrum_magnitudo',
          label: 'Visualisasi Spektrum Frekuensi',
        },
      ],
      nilaiAwal: 'gambar_terfilter',
    },
  ],
  async terapkan(citra, parameter = {}) {
    const blob = await citraKeBlobPng(citra);
    const respons = await kirimGambarKeServer(
      '/api/v1/frekuensi',
      blob,
      parameter,
      15000
    );
    if (!respons.sukses || !respons.blob) {
      throw new Error(respons.pesan || 'Operasi domain frekuensi FFT gagal.');
    }
    return await blobPngKeCitra(respons.blob);
  },
};

export default operasiFrekuensi;
