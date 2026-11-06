/**
 * Uji Unit Operasi Server & Integrasi Hibrida Tahap 6 (Vitest).
 */

import { describe, expect, it } from 'vitest';
import {
  bersihkanParameter,
  dapatkanOperasiBerdasarkanId,
  dapatkanSemuaOperasi,
  ekstrakNilaiAwalParameter,
} from '../mesin/katalogOperasi';
import { eksekusiPipelineAsinkron } from '../mesin/eksekutorPipeline';
import idJson from '../bahasa/id.json';
import enJson from '../bahasa/en.json';

describe('Operasi Server Tahap 6 (Canny, Kontur, Morfologi, Segmentasi, Noise, FFT)', () => {
  const DAFTAR_ID_SERVER = [
    'tepi_canny',
    'kontur_deteksi',
    'morfologi_matematika',
    'segmentasi_citra',
    'noise_reduksi',
    'frekuensi_fft',
  ];

  it('seluruh 6 operasi server terdaftar di katalog dengan atribut lokasi="server"', () => {
    const semua = dapatkanSemuaOperasi();
    for (const id of DAFTAR_ID_SERVER) {
      const op = semua.find((o) => o.id === id);
      expect(op, `Operasi ${id} harus terdaftar di katalog`).toBeDefined();
      expect(op.lokasi).toBe('server');
      expect(op.ruteServer).toBeDefined();
      expect(op.ruteServer.startsWith('/api/v1/')).toBe(true);
      expect(typeof op.terapkan).toBe('function');
    }
  });

  it('kartu belajar dan i18n dwibahasa (ID & EN) tersedia lengkap untuk seluruh operasi server', () => {
    for (const id of DAFTAR_ID_SERVER) {
      const kbId = idJson.kartuBelajar[id];
      const kbEn = enJson.kartuBelajar[id];

      expect(kbId, `Kartu belajar ID untuk ${id} harus ada`).toBeDefined();
      expect(kbEn, `Kartu belajar EN untuk ${id} harus ada`).toBeDefined();
      expect(kbId.tujuan).toBeTruthy();
      expect(kbId.rumus).toBeTruthy();
      expect(kbEn.tujuan).toBeTruthy();
      expect(kbEn.rumus).toBeTruthy();
    }
  });

  it('ekstrakNilaiAwalParameter dan bersihkanParameter bekerja aman pada operasi server', () => {
    for (const id of DAFTAR_ID_SERVER) {
      const op = dapatkanOperasiBerdasarkanId(id);
      const nilaiAwal = ekstrakNilaiAwalParameter(op);
      expect(nilaiAwal).toBeTypeOf('object');

      // Masukan kosong atau non-finite harus dibersihkan ke nilai default aman
      const bersihKosong = bersihkanParameter(op, {});
      expect(bersihKosong).toEqual(nilaiAwal);

      const masukanKotor = {
        ambang_bawah: NaN,
        ambang_atas: Infinity,
        ukuran_apertur: 999, // tidak valid
        k: -5, // di luar batas
        iterasi: 999,
      };
      const bersihKotor = bersihkanParameter(op, masukanKotor);
      expect(bersihKotor).toBeDefined();
    }
  });

  it('eksekutor pipeline asinkron mendukung alur langkah hibrida dengan prefix caching', async () => {
    const citraAwal = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255,
      ]),
    };

    // Buat langkah klien yang valid (kecerahan + negatif)
    const langkahKlien1 = {
      idOperasi: 'dasar_kecerahan',
      aktif: true,
      parameter: { kecerahan: 20 },
    };
    const langkahKlien2 = {
      idOperasi: 'dasar_negatif',
      aktif: true,
      parameter: {},
    };

    const hasil1 = await eksekusiPipelineAsinkron(
      [langkahKlien1, langkahKlien2],
      citraAwal
    );

    expect(hasil1.hasil.width).toBe(2);
    expect(hasil1.hasil.height).toBe(2);
    expect(hasil1.langkahDieksekusi).toBe(2);
    expect(hasil1.cacheBaru.length).toBe(2);

    // Verifikasi pemanfaatan cache prefix pada eksekusi berikutnya
    const langkahKlien3 = {
      idOperasi: 'dasar_kecerahan',
      aktif: true,
      parameter: { kecerahan: 10 },
    };
    const hasil2 = await eksekusiPipelineAsinkron(
      [langkahKlien1, langkahKlien2, langkahKlien3],
      citraAwal,
      { rasio: 1.0 },
      hasil1.cacheBaru
    );

    // Indeks mulai komputasi harus melompati 2 langkah awal yang tercache
    expect(hasil2.indeksMulaiKomputasi).toBe(2);
    expect(hasil2.langkahDieksekusi).toBe(1);
  });
});
