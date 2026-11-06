/**
 * Kustom Hook useStatusServer (spec.md bagian 5, 9, Tahap 5, & K7).
 * Memantau status ketersediaan backend FastAPI secara berkala dan reaktif.
 * Fitur:
 * - Dukungan Mode Lokal: Jika VITE_ALAMAT_API tidak diatur, 0 permintaan kesehatan dikirim
 * - Pemeriksaan awal saat komponen dipasang
 * - Polling berkala (default 30 detik saat server sehat)
 * - Berhenti saat dokumen/tab tersembunyi (visibilitychange)
 * - Exponential backoff (5s hingga 60s) saat server tidak tersedia untuk menghemat sumber daya
 * - Fungsi periksaManual untuk pemicu verifikasi pengguna
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apakahModeLokal, periksaKesehatan } from '../layanan/api';

export const STATUS_SERVER = {
  MEMERIKSA: 'memeriksa',
  TERSEDIA: 'tersedia',
  TIDAK_TERSEDIA: 'tidak_tersedia',
  MODE_LOKAL: 'mode_lokal',
};

const INTERVAL_NORMAL_MS = 30000; // 30 detik saat server sehat
const JEDA_AWAL_GAGAL_MS = 5000; // 5 detik awal saat gagal
const JEDA_MAKS_GAGAL_MS = 60000; // Maksimal backoff 60 detik

export function useStatusServer(intervalKustomMs = INTERVAL_NORMAL_MS) {
  const modeLokalAktif = apakahModeLokal();

  const [statusServer, setStatusServer] = useState(() => {
    if (modeLokalAktif) return STATUS_SERVER.MODE_LOKAL;
    if (import.meta.env.VITE_STATUS_SERVER_OTOMATIS === 'false') {
      return STATUS_SERVER.TIDAK_TERSEDIA;
    }
    return STATUS_SERVER.MEMERIKSA;
  });
  const [infoServer, setInfoServer] = useState(null);

  const statusServerRef = useRef(statusServer);
  const intervalKustomRef = useRef(intervalKustomMs);
  intervalKustomRef.current = intervalKustomMs;

  const timerRef = useRef(null);
  const jedaGagalRef = useRef(JEDA_AWAL_GAGAL_MS);
  const sedangMemeriksaRef = useRef(false);

  const perbaruiStatus = useCallback((statusBaru, info = null) => {
    statusServerRef.current = statusBaru;
    setStatusServer(statusBaru);
    setInfoServer(info);
  }, []);

  const jalankanPemeriksaan = useCallback(async () => {
    if (modeLokalAktif) {
      perbaruiStatus(STATUS_SERVER.MODE_LOKAL, null);
      return;
    }

    if (sedangMemeriksaRef.current) return;
    sedangMemeriksaRef.current = true;

    const hasil = await periksaKesehatan(4000);
    sedangMemeriksaRef.current = false;

    if (hasil.sukses) {
      perbaruiStatus(STATUS_SERVER.TERSEDIA, hasil.data || null);
      jedaGagalRef.current = JEDA_AWAL_GAGAL_MS; // Reset backoff
    } else {
      perbaruiStatus(STATUS_SERVER.TIDAK_TERSEDIA, null);
      // Gandakan jeda backoff hingga batas maksimum
      jedaGagalRef.current = Math.min(
        jedaGagalRef.current * 2,
        JEDA_MAKS_GAGAL_MS
      );
    }
  }, [modeLokalAktif, perbaruiStatus]);

  const jadwalkanPemeriksaanBerikutnya = useCallback(() => {
    if (modeLokalAktif) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Jangan jadwalkan jika polling otomatis dinonaktifkan
    if (import.meta.env.VITE_STATUS_SERVER_OTOMATIS === 'false') {
      return;
    }

    // Jangan jadwalkan jika tab peramban sedang disembunyikan
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    const durasiTunggu =
      statusServerRef.current === STATUS_SERVER.TERSEDIA
        ? intervalKustomRef.current
        : jedaGagalRef.current;

    timerRef.current = setTimeout(async () => {
      await jalankanPemeriksaan();
      jadwalkanPemeriksaanBerikutnya();
    }, durasiTunggu);
  }, [jalankanPemeriksaan, modeLokalAktif]);

  // Efek inisialisasi & pemantauan visibilitas tab
  useEffect(() => {
    if (modeLokalAktif) {
      perbaruiStatus(STATUS_SERVER.MODE_LOKAL, null);
      return;
    }

    if (import.meta.env.VITE_STATUS_SERVER_OTOMATIS === 'false') {
      return;
    }

    jalankanPemeriksaan().then(() => {
      jadwalkanPemeriksaanBerikutnya();
    });

    const tanganiPerubahanVisibilitas = () => {
      if (!document.hidden) {
        jalankanPemeriksaan().then(() => {
          jadwalkanPemeriksaanBerikutnya();
        });
      } else {
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
  }, [jadwalkanPemeriksaanBerikutnya, jalankanPemeriksaan, modeLokalAktif, perbaruiStatus]);

  const periksaManual = useCallback(async () => {
    if (modeLokalAktif) return;
    sedangMemeriksaRef.current = false;
    perbaruiStatus(STATUS_SERVER.MEMERIKSA, null);
    await jalankanPemeriksaan();
    jadwalkanPemeriksaanBerikutnya();
  }, [jadwalkanPemeriksaanBerikutnya, jalankanPemeriksaan, modeLokalAktif, perbaruiStatus]);

  return {
    statusServer,
    apakahTersedia: statusServer === STATUS_SERVER.TERSEDIA,
    apakahMemeriksa: statusServer === STATUS_SERVER.MEMERIKSA,
    apakahModeLokal: statusServer === STATUS_SERVER.MODE_LOKAL,
    infoServer,
    periksaManual,
  };
}
