import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATUS_SERVER, useStatusServer } from '../hook/useStatusServer';
import * as apiModule from '../layanan/api';

describe('Hook useStatusServer (Tahap 5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('menginisialisasi keadaan dengan status MEMERIKSA dan bertransisi ke TERSEDIA saat API sehat', async () => {
    vi.spyOn(apiModule, 'periksaKesehatan').mockResolvedValue({
      sukses: true,
      data: { status: 'sehat', versi: '0.1.0' },
    });

    const { result } = renderHook(() => useStatusServer(10000));

    await waitFor(() => {
      expect(result.current.statusServer).toBe(STATUS_SERVER.TERSEDIA);
    });

    expect(result.current.apakahTersedia).toBe(true);
    expect(result.current.infoServer).toEqual({
      status: 'sehat',
      versi: '0.1.0',
    });
  });

  it('bertransisi ke TIDAK_TERSEDIA saat API gagal atau tidak terjangkau', async () => {
    vi.spyOn(apiModule, 'periksaKesehatan').mockResolvedValue({
      sukses: false,
      kode: 'SERVER_TIDAK_TERSEDIA',
    });

    const { result } = renderHook(() => useStatusServer(10000));

    await waitFor(() => {
      expect(result.current.statusServer).toBe(STATUS_SERVER.TIDAK_TERSEDIA);
    });

    expect(result.current.apakahTersedia).toBe(false);
    expect(result.current.infoServer).toBeNull();
  });

  it('memungkinkan pemicu manual periksaManual untuk memperbarui status seketika', async () => {
    const mockKesehatan = vi
      .spyOn(apiModule, 'periksaKesehatan')
      .mockResolvedValue({
        sukses: false,
        kode: 'SERVER_TIDAK_TERSEDIA',
      });

    const { result } = renderHook(() => useStatusServer(10000));

    await waitFor(() => {
      expect(result.current.statusServer).toBe(STATUS_SERVER.TIDAK_TERSEDIA);
    });

    // Server kembali online
    mockKesehatan.mockResolvedValue({
      sukses: true,
      data: { status: 'sehat' },
    });

    // Pemicu manual periksa ulang
    await act(async () => {
      await result.current.periksaManual();
    });

    await waitFor(() => {
      expect(result.current.statusServer).toBe(STATUS_SERVER.TERSEDIA);
    });
    expect(result.current.apakahTersedia).toBe(true);
  });
});
