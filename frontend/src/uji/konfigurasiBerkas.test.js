import { describe, expect, it } from 'vitest';
import {
  BATASAN_BERKAS,
  KODE_GALAT_BERKAS,
} from '../utilitas/konfigurasiBerkas';

describe('Konfigurasi Batasan Berkas (spec.md bagian 8)', () => {
  it('memiliki batasan ukuran berkas maksimum 10 MB', () => {
    expect(BATASAN_BERKAS.UKURAN_MAKS_MB).toBe(10);
    expect(BATASAN_BERKAS.UKURAN_MAKS_BYTE).toBe(10 * 1024 * 1024);
  });

  it('memiliki batasan dimensi sisi terpanjang 4096 px dan total 16 juta piksel', () => {
    expect(BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL).toBe(4096);
    expect(BATASAN_BERKAS.TOTAL_PIKSEL_MAKS).toBe(16_000_000);
  });

  it('mendukung format masukan JPG, PNG, WebP, dan BMP', () => {
    expect(BATASAN_BERKAS.TIPE_MIME_DIIZINKAN).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/bmp',
    ]);
  });

  it('mendukung format unduhan PNG (default), JPG, dan WebP', () => {
    expect(BATASAN_BERKAS.FORMAT_UNDUHAN).toContain('png');
    expect(BATASAN_BERKAS.FORMAT_UNDUHAN).toContain('jpeg');
    expect(BATASAN_BERKAS.FORMAT_UNDUHAN).toContain('webp');
    expect(BATASAN_BERKAS.FORMAT_UNDUHAN_DEFAULT).toBe('png');
  });

  it('memiliki seluruh definisi kode galat yang terstandarisasi', () => {
    expect(KODE_GALAT_BERKAS.UKURAN_MELEBIHI_BATAS).toBe(
      'GALAT_UKURAN_MELEBIHI_BATAS'
    );
    expect(KODE_GALAT_BERKAS.FORMAT_TIDAK_DIDUKUNG).toBe(
      'GALAT_FORMAT_TIDAK_DIDUKUNG'
    );
    expect(KODE_GALAT_BERKAS.DIMENSI_MELEBIHI_BATAS).toBe(
      'GALAT_DIMENSI_MELEBIHI_BATAS'
    );
    expect(KODE_GALAT_BERKAS.TOTAL_PIKSEL_MELEBIHI_BATAS).toBe(
      'GALAT_TOTAL_PIKSEL_MELEBIHI_BATAS'
    );
    expect(KODE_GALAT_BERKAS.BERKAS_RUSAK).toBe('GALAT_BERKAS_RUSAK');
    expect(KODE_GALAT_BERKAS.SVG_DITOLAK).toBe('GALAT_SVG_DITOLAK');
  });
});
