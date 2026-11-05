import { describe, expect, it } from 'vitest';
import en from '../bahasa/en.json';
import id from '../bahasa/id.json';

describe('Konsistensi Kamus Terjemahan Galat & Status Server (Tahap 5)', () => {
  const KODE_GALAT_WAJIB = [
    'BERKAS_TERLALU_BESAR',
    'FORMAT_TIDAK_DIDUKUNG',
    'BERKAS_RUSAK',
    'DIMENSI_TERLALU_BESAR',
    'PIKSEL_TERLALU_BANYAK',
    'TERLALU_BANYAK_PERMINTAAN',
    'PARAMETER_TIDAK_VALID',
    'SERVER_SIBUK',
    'BATAS_WAKTU_HABIS',
    'RUTE_TIDAK_DITEMUKAN',
    'METODE_TIDAK_DIIZINKAN',
    'JARINGAN_GAGAL',
    'SERVER_TIDAK_TERSEDIA',
    'DIBATALKAN',
    'GALAT_INTERNAL',
  ];

  it('semua kode galat wajib didefinisikan pada kamus bahasa Indonesia (id.json)', () => {
    expect(id.galatServer).toBeDefined();
    for (const kode of KODE_GALAT_WAJIB) {
      expect(
        id.galatServer[kode],
        `Kamus id.json kehilangan terjemahan untuk kode galat: ${kode}`
      ).toBeDefined();
      expect(typeof id.galatServer[kode]).toBe('string');
      expect(id.galatServer[kode].length).toBeGreaterThan(0);
    }
  });

  it('semua kode galat wajib didefinisikan pada kamus bahasa Inggris (en.json)', () => {
    expect(en.galatServer).toBeDefined();
    for (const kode of KODE_GALAT_WAJIB) {
      expect(
        en.galatServer[kode],
        `Kamus en.json kehilangan terjemahan untuk kode galat: ${kode}`
      ).toBeDefined();
      expect(typeof en.galatServer[kode]).toBe('string');
      expect(en.galatServer[kode].length).toBeGreaterThan(0);
    }
  });

  it('statusServer memiliki seluruh kunci UI di id.json dan en.json', () => {
    const KUNCI_STATUS = [
      'judul',
      'tersedia',
      'tidakTersedia',
      'memeriksa',
      'keteranganTersedia',
      'keteranganTidakTersedia',
      'keteranganMemeriksa',
      'tombolPeriksa',
      'operasiServerNonaktif',
    ];

    for (const kunci of KUNCI_STATUS) {
      expect(id.statusServer[kunci]).toBeDefined();
      expect(en.statusServer[kunci]).toBeDefined();
    }
  });

  it('memuat dialog privasi poin 4 tentang transparansi log server di id dan en', () => {
    expect(id.privasi.poin4).toBeDefined();
    expect(en.privasi.poin4).toBeDefined();
    expect(id.privasi.poin4.length).toBeGreaterThan(10);
    expect(en.privasi.poin4.length).toBeGreaterThan(10);
  });
});
