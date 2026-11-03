import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KODE_GALAT_BERKAS } from '../utilitas/konfigurasiBerkas';
import {
  deteksiFormatDariMagicBytes,
  validasiBerkasCitra,
} from '../utilitas/validasiBerkas';

describe('Validasi Berkas Citra Klien (spec.md bagian 8 & OWASP)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Pemeriksaan Tanda Tangan Biner (Magic Bytes)', () => {
    it('mendeteksi berkas PNG dengan benar', () => {
      const buffer = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]).buffer;
      expect(deteksiFormatDariMagicBytes(buffer)).toBe('image/png');
    });

    it('mendeteksi berkas JPEG dengan benar', () => {
      const buffer = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ]).buffer;
      expect(deteksiFormatDariMagicBytes(buffer)).toBe('image/jpeg');
    });

    it('mendeteksi berkas WebP dengan benar', () => {
      const buffer = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]).buffer;
      expect(deteksiFormatDariMagicBytes(buffer)).toBe('image/webp');
    });

    it('mendeteksi berkas BMP dengan benar', () => {
      const buffer = new Uint8Array([
        0x42, 0x4d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]).buffer;
      expect(deteksiFormatDariMagicBytes(buffer)).toBe('image/bmp');
    });

    it('menolak secara eksplisit berkas SVG (OWASP)', () => {
      const svgText = '<svg xmlns="http://www.w3.org/2000/svg">';
      const buffer = new TextEncoder().encode(svgText).buffer;
      expect(deteksiFormatDariMagicBytes(buffer)).toBe('svg');
    });

    it('mengembalikan null untuk format yang tidak dikenal', () => {
      const buffer = new Uint8Array([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
      ]).buffer;
      expect(deteksiFormatDariMagicBytes(buffer)).toBeNull();
    });
  });

  describe('Validasi Menyeluruh (validasiBerkasCitra)', () => {
    it('menolak jika berkas kosong / null', async () => {
      const hasil = await validasiBerkasCitra(null);
      expect(hasil.valid).toBe(false);
      expect(hasil.kodeGalat).toBe(KODE_GALAT_BERKAS.BERKAS_RUSAK);
    });

    it('menolak berkas yang melebihi ukuran batas 10 MB', async () => {
      const berkasBesar = new File([''], 'gambar-raksasa.png', {
        type: 'image/png',
      });
      Object.defineProperty(berkasBesar, 'size', {
        value: 11 * 1024 * 1024,
      });

      const hasil = await validasiBerkasCitra(berkasBesar);
      expect(hasil.valid).toBe(false);
      expect(hasil.kodeGalat).toBe(KODE_GALAT_BERKAS.UKURAN_MELEBIHI_BATAS);
    });

    it('menolak berkas SVG demi keamanan aplikasi (OWASP)', async () => {
      const berkasSvg = new File(
        ['<svg viewBox="0 0 10 10"></svg>'],
        'vektor.svg',
        {
          type: 'image/svg+xml',
        }
      );

      const hasil = await validasiBerkasCitra(berkasSvg);
      expect(hasil.valid).toBe(false);
      expect(hasil.kodeGalat).toBe(KODE_GALAT_BERKAS.SVG_DITOLAK);
    });

    it('menolak format yang tidak didukung (misalnya PDF atau teks)', async () => {
      const berkasTeks = new File(['konten berkas sembarang'], 'catatan.txt', {
        type: 'text/plain',
      });

      const hasil = await validasiBerkasCitra(berkasTeks);
      expect(hasil.valid).toBe(false);
      expect(hasil.kodeGalat).toBe(KODE_GALAT_BERKAS.FORMAT_TIDAK_DIDUKUNG);
    });
  });
});
