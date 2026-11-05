import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KODE_GALAT_KLIEN_API,
  dapatkanAlamatApi,
  kirimGambarKeServer,
  periksaKesehatan,
} from '../layanan/api';

describe('Layanan Klien API (Tahap 5 — api.js)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('dapatkanAlamatApi', () => {
    it('mengembalikan URL basis default atau dari environment', () => {
      const alamat = dapatkanAlamatApi();
      expect(alamat).toBeDefined();
      expect(typeof alamat).toBe('string');
      expect(alamat.startsWith('http')).toBe(true);
    });
  });

  describe('periksaKesehatan', () => {
    it('mengembalikan sukses true saat server merespons 200 OK dengan payload kesehatan', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'sehat', versi: '0.1.0' }),
      });

      const hasil = await periksaKesehatan();
      expect(hasil.sukses).toBe(true);
      expect(hasil.data).toEqual({ status: 'sehat', versi: '0.1.0' });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/kesehatan'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('mengembalikan SERVER_TIDAK_TERSEDIA saat respons server status non-200', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const hasil = await periksaKesehatan();
      expect(hasil.sukses).toBe(false);
      expect(hasil.kode).toBe(KODE_GALAT_KLIEN_API.SERVER_TIDAK_TERSEDIA);
    });

    it('mengembalikan SERVER_TIDAK_TERSEDIA saat jaringan gagal atau server mati', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error('Network connection failed'));

      const hasil = await periksaKesehatan();
      expect(hasil.sukses).toBe(false);
      expect(hasil.kode).toBe(KODE_GALAT_KLIEN_API.SERVER_TIDAK_TERSEDIA);
    });

    it('mengembalikan BATAS_WAKTU_HABIS saat permintaan kesehatan mengalami timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = vi.fn().mockRejectedValue(abortError);

      const hasil = await periksaKesehatan(10);
      expect(hasil.sukses).toBe(false);
      expect(hasil.kode).toBe(KODE_GALAT_KLIEN_API.BATAS_WAKTU_HABIS);
    });
  });

  describe('kirimGambarKeServer', () => {
    it('menolak pengiriman di sisi klien jika berkas kosong tanpa memanggil jaringan', async () => {
      const spyFetch = vi.fn();
      global.fetch = spyFetch;

      const hasil = await kirimGambarKeServer('/api/uji/gema', null);
      expect(hasil.sukses).toBe(false);
      expect(hasil.kode).toBe('BERKAS_RUSAK');
      expect(spyFetch).not.toHaveBeenCalled();
    });

    it('menolak pengiriman di sisi klien jika ukuran berkas > 10 MB tanpa memanggil jaringan', async () => {
      const spyFetch = vi.fn();
      global.fetch = spyFetch;

      const blobBesar = new Blob([new Uint8Array(10 * 1024 * 1024 + 10)], {
        type: 'image/png',
      });
      const hasil = await kirimGambarKeServer('/api/uji/gema', blobBesar);

      expect(hasil.sukses).toBe(false);
      expect(hasil.kode).toBe(KODE_GALAT_KLIEN_API.BERKAS_MELEBIHI_BATAS);
      expect(spyFetch).not.toHaveBeenCalled();
    });

    it('berhasil mengirim FormData dan menerima blob hasil serta header x-lebar/x-tinggi', async () => {
      const mockBlobKeluar = new Blob(['hasil-citra-png'], {
        type: 'image/png',
      });
      const mockHeaders = new Headers();
      mockHeaders.set('x-lebar', '400');
      mockHeaders.set('x-tinggi', '300');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => mockBlobKeluar,
        headers: mockHeaders,
      });

      const blobMasuk = new Blob(['masukan-citra'], { type: 'image/png' });
      const hasil = await kirimGambarKeServer('/api/uji/gema', blobMasuk, {
        balik_horizontal: true,
      });

      expect(hasil.sukses).toBe(true);
      expect(hasil.blob).toBe(mockBlobKeluar);
      expect(hasil.lebar).toBe(400);
      expect(hasil.tinggi).toBe(300);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/uji/gema'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });

    it('mengembalikan galat terstruktur server saat respons 4xx/5xx dengan payload JSON baku', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 413,
        json: async () => ({
          kode: 'BERKAS_TERLALU_BESAR',
          pesan: 'Ukuran berkas melebihi batas 10 MB.',
        }),
      });

      const blob = new Blob(['dummy'], { type: 'image/png' });
      const hasil = await kirimGambarKeServer('/api/uji/gema', blob);

      expect(hasil.sukses).toBe(false);
      expect(hasil.kode).toBe('BERKAS_TERLALU_BESAR');
      expect(hasil.pesan).toBe('Ukuran berkas melebihi batas 10 MB.');
    });

    it('membatalkan permintaan pertama saat permintaan kedua dikirim ke rute yang sama (Latest-Wins)', async () => {
      global.fetch = vi.fn().mockImplementation((url, opsi) => {
        const sinyal = opsi?.signal;
        return new Promise((resolve, reject) => {
          sinyal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      const blob = new Blob(['dummy'], { type: 'image/png' });

      // Permintaan 1 dikirim
      const p1 = kirimGambarKeServer('/api/uji/gema', blob);

      // Permintaan 2 dikirim ke rute yang sama persis untuk membatalkan permintaan 1
      kirimGambarKeServer('/api/uji/gema', blob);

      const hasil1 = await p1;
      expect(hasil1.sukses).toBe(false);
      expect(hasil1.kode).toBe(KODE_GALAT_KLIEN_API.DIBATALKAN);
    });
  });
});
