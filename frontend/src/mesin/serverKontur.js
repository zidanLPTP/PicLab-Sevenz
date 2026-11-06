/**
 * Operasi Server: Deteksi & Visualisasi Kontur (spec.md bagian 4 & Tahap 6).
 */

import { kirimGambarKeServer } from '../layanan/api';
import { citraKeBlobPng, blobPngKeCitra } from '../utilitas/konversiCitraBlob';

export const operasiKontur = {
  id: 'kontur_deteksi',
  lokasi: 'server',
  kategori: 'kontur',
  kunciNama: 'operasi.kontur.nama',
  kunciDeskripsi: 'operasi.kontur.deskripsi',
  namaTeknis: 'Contour Boundary Tracing & Rendering (OpenCV)',
  ruteServer: '/api/v1/kontur',
  skemaParameter: [
    {
      id: 'metode',
      kunciLabel: 'parameter.metodeKontur',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'biner', label: 'Biner Manual' },
        { nilai: 'otsu', label: 'Biner Otsu' },
        { nilai: 'canny', label: 'Deteksi Canny' },
      ],
      nilaiAwal: 'biner',
    },
    {
      id: 'ambang',
      kunciLabel: 'parameter.ambang',
      tipe: 'slider',
      min: 0,
      max: 255,
      step: 1,
      nilaiAwal: 128,
    },
    {
      id: 'mode_retrieval',
      kunciLabel: 'parameter.modeRetrieval',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'tree', label: 'Hirarki Penuh (Tree)' },
        { nilai: 'external', label: 'Hanya Luar (External)' },
        { nilai: 'list', label: 'Daftar Rata (List)' },
      ],
      nilaiAwal: 'tree',
    },
    {
      id: 'luas_minimum',
      kunciLabel: 'parameter.luasMinimum',
      tipe: 'slider',
      min: 0,
      max: 500,
      step: 5,
      nilaiAwal: 10,
    },
    {
      id: 'ketebalan_garis',
      kunciLabel: 'parameter.ketebalanGaris',
      tipe: 'slider',
      min: 1,
      max: 10,
      step: 1,
      nilaiAwal: 2,
    },
    {
      id: 'tampilan',
      kunciLabel: 'parameter.tampilanKontur',
      tipe: 'pilihan',
      pilihan: [
        { nilai: 'overlay', label: 'Tumpuk Citra Asli (Overlay)' },
        { nilai: 'latar_hitam', label: 'Latar Belakang Hitam' },
        { nilai: 'latar_putih', label: 'Latar Belakang Putih' },
      ],
      nilaiAwal: 'overlay',
    },
    {
      id: 'warna_garis',
      kunciLabel: 'parameter.warnaGaris',
      tipe: 'pilihan',
      pilihan: [
        { nilai: '00ff00', label: 'Hijau Cerah' },
        { nilai: 'ff0000', label: 'Merah' },
        { nilai: '0000ff', label: 'Biru' },
        { nilai: 'ffff00', label: 'Kuning' },
        { nilai: '00ffff', label: 'Sian' },
        { nilai: 'ffffff', label: 'Putih' },
      ],
      nilaiAwal: '00ff00',
    },
  ],
  async terapkan(citra, parameter = {}, konteksSkala = { rasio: 1.0 }) {
    const blob = await citraKeBlobPng(citra);
    const kodeWarna = parameter.warna_garis || '00ff00';
    const warnaTerformat = String(kodeWarna).startsWith('#')
      ? kodeWarna
      : ['#', kodeWarna].join('');

    const parameterKirim = {
      ...parameter,
      warna_garis: warnaTerformat,
      rasio: konteksSkala?.rasio || 1.0,
    };

    const respons = await kirimGambarKeServer(
      '/api/v1/kontur',
      blob,
      parameterKirim,
      15000
    );
    if (!respons.sukses || !respons.blob) {
      const galat = new Error(respons.pesan || 'Operasi deteksi kontur gagal.');
      galat.kode = respons.kode || 'SERVER_TIDAK_TERSEDIA';
      throw galat;
    }
    return await blobPngKeCitra(respons.blob);
  },
};

export default operasiKontur;
