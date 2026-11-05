/**
 * Kustom Hook useStatusServer (spec.md bagian 5, 9 & Tahap 5).
 * Memantau status ketersediaan backend FastAPI secara berkala dan reaktif.
 * Fitur:
 * - Pemeriksaan awal saat komponen dipasang
 * - Polling berkala (default 30 detik)
 * - Berhenti saat dokumen/tab tersembunyi (visibilitychange)
 * - Exponential backoff saat server tidak tersedia untuk menghemat sumber daya
 * - Fungsi periksaUlang untuk pemicu manual
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { periksaKesehatan } from '../layanan/api';

export const STATUS_SERVER = {
  MEMERIKSA: 'memeriksa',
  TERSEDIA: 'tersedia',
  TIDAK_TERSEDIA: 'tidak_tersedia',
};

const INTERVAL_NORMAL_MS = 30000; // 30 detik saat server sehat
const JEDA_AWAL_GAGAL_MS = 5000; // 5 detik awal saat gagal
const JEDA_MAKS_GAGAL_MS = 60000; // Maksimal backoff 60 detik

export function useStatusServer(intervalKustomMs = INTERVAL_NORMAL_MS) {
  const [statusServer, setStatusServer] = useState(STATUS_SERVER.MEMERIKSA);
  const [infoServer, setInfoServer] = useState(null);
  const timerRef = useRef(null);
  const jedaGagalRef = useRef(JEDA_AWAL_GAGAL_MS);
  const sedangMemeriksaRef = useRef(false);

  const jalankanPemeriksaan = useCallback(async () => {
    if (sedangMemeriksaRef.current) return;
    sedangMemeriksaRef.current = true;

    const hasil = await periksaKesehatan(4000);
    sedangMemeriksaRef.current = false;

    if (hasil.sukses) {
      setStatusServer(STATUS_SERVER.TERSEDIA);
      setInfoServer(hasil.data || null);
      jedaGagalRef.current = JEDA_AWAL_GAGAL_MS; // Reset backoff
    } else {
      setStatusServer(STATUS_SERVER.TIDAK_TERSEDIA);
      setInfoServer(null);
      // Gandakan jeda backoff hingga batas maksimum
      jedaGagalRef.current = Math.min(
        jedaGagalRef.current * 2,
        JEDA_MAKS_GAGAL_MS
      );
    }
  }, []);

  const jadwalkanPemeriksaanBerikutnya = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Jangan jadwalkan jika tab peramban sedang disembunyikan
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    const durasiTunggu =
      statusServer === STATUS_SERVER.TERSEDIA
        ? intervalKustomMs
        : jedaGagalRef.current;

    timerRef.current = setTimeout(async () => {
      await jalankanPemeriksaan();
      jadwalkanPemeriksaanBerikutnya();
    }, durasiTunggu);
  }, [intervalKustomMs, jalankanPemeriksaan, statusServer]);

  // Efek inisialisasi & pemantauan visibilitas tab
  useEffect(() => {
    jalankanPemeriksaan().then(() => {
      jadwalkanPemeriksaanBerikutnya();
    });

    const tanganiPerubahanVisibilitas = () => {
      if (!document.hidden) {
        // Tab aktif kembali: segera periksa dan mulai lagi penjadwalan
        jalankanPemeriksaan().then(() => {
          jadwalkanPemeriksaanBerikutnya();
        });
      } else {
        // Tab disembunyikan: batalkan timer aktif
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', tanganiPerubahanVisibilitas);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      document.removeEventListener(
        'visibilitychange',
        tanganiPerubahanVisibilitas
      );
    };
  }, [jadwalkanPemeriksaanBerikutnya, jalankanPemeriksaan]);

  const periksaManual = useCallback(async () => {
    setStatusServer(STATUS_SERVER.MEMERIKSA);
    await jalankanPemeriksaan();
    jadwalkanPemeriksaanBerikutnya();
  }, [jadwalkanPemeriksaanBerikutnya, jalankanPemeriksaan]);

  return {
    statusServer,
    apakahTersedia: statusServer === STATUS_SERVER.TERSEDIA,
    apakahMemeriksa: statusServer === STATUS_SERVER.MEMERIKSA,
    infoServer,
    periksaManual,
  };
}
