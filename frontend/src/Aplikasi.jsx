import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AreaKanvas from './komponen/AreaKanvas';
import AreaUnggah from './komponen/AreaUnggah';
import BilahAksiKanvas from './komponen/BilahAksiKanvas';
import BilahAtas from './komponen/BilahAtas';
import PanelOperasi from './komponen/PanelOperasi';
import PanelParameter from './komponen/PanelParameter';
import { validasiBerkasCitra } from './utilitas/validasiBerkas';

/**
 * Komponen utama antarmuka PicLab Sevenz (Tahap 1 — Kerangka Editor & Sistem Desain).
 */
export default function Aplikasi() {
  const { t } = useTranslation();
  const [gambarSrc, setGambarSrc] = useState(null);
  const [elemenCitra, setElemenCitra] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [sedangMemuat, setSedangMemuat] = useState(false);
  const [kodeGalat, setKodeGalat] = useState(null);

  // Membersihkan Object URL saat komponen dilepas atau citra diganti (OWASP)
  useEffect(() => {
    return () => {
      if (gambarSrc && gambarSrc.startsWith('blob:')) {
        URL.revokeObjectURL(gambarSrc);
      }
    };
  }, [gambarSrc]);

  // Menangani pengunggahan berkas baru
  const prosesBerkas = async (berkas) => {
    setSedangMemuat(true);
    setKodeGalat(null);

    // Waktu mulai dekode untuk observasi performa
    const waktuMulai = performance.now();

    const hasilValidasi = await validasiBerkasCitra(berkas);

    const waktuSelesai = performance.now();
    // Catatan durasi (tanpa mencatat isi atau nama berkas privat)
    if (import.meta.env.DEV) {
      const durasi = Math.round(waktuSelesai - waktuMulai);
      // Durasi dekode aman diobservasi di dev
      void durasi;
    }

    if (!hasilValidasi.valid) {
      setSedangMemuat(false);
      setKodeGalat(hasilValidasi.kodeGalat);
      return;
    }

    // Jika sebelumnya ada object URL, bersihkan
    if (gambarSrc && gambarSrc.startsWith('blob:')) {
      URL.revokeObjectURL(gambarSrc);
    }

    const urlBaru = URL.createObjectURL(berkas);
    setGambarSrc(urlBaru);
    setElemenCitra(hasilValidasi.elemenCitra);
    setMetadata(hasilValidasi.metadata);
    setSedangMemuat(false);
  };

  // Memuat gambar contoh lokal
  const muatGambarContoh = async () => {
    try {
      setSedangMemuat(true);
      setKodeGalat(null);
      const respons = await fetch('/contoh/gambar-contoh.png');
      const blob = await respons.blob();
      const berkasContoh = new File([blob], 'lanskap-contoh.png', {
        type: 'image/png',
      });
      await prosesBerkas(berkasContoh);
    } catch {
      setSedangMemuat(false);
      setKodeGalat('GALAT_BERKAS_RUSAK');
    }
  };

  // Mengganti atau mereset citra saat ini
  const gantiGambar = () => {
    if (gambarSrc && gambarSrc.startsWith('blob:')) {
      URL.revokeObjectURL(gambarSrc);
    }
    setGambarSrc(null);
    setElemenCitra(null);
    setMetadata(null);
    setKodeGalat(null);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-latar-aplikasi text-teks-utama">
      {/* 1. Bilah Navigasi Atas */}
      <BilahAtas />

      {/* 2. Layout Editor Tiga Area (Kiri, Tengah, Kanan) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Area Kiri: Katalog Operasi & Preset */}
        <PanelOperasi />

        {/* Area Tengah: Kanvas / Keadaan Kosong Unggah */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-latar-kanvas">
          {gambarSrc && metadata ? (
            <>
              <AreaKanvas gambarSrc={gambarSrc} metadata={metadata} />
              <BilahAksiKanvas
                metadata={metadata}
                elemenCitra={elemenCitra}
                saatGantiGambar={gantiGambar}
              />
            </>
          ) : (
            <AreaUnggah
              saatPilihBerkas={prosesBerkas}
              saatPilihContoh={muatGambarContoh}
              sedangMemuat={sedangMemuat}
              pesanGalat={kodeGalat ? t(`galat.${kodeGalat}`) : null}
              saatResetGalat={() => setKodeGalat(null)}
            />
          )}
        </div>

        {/* Area Kanan: Parameter & Riwayat */}
        <PanelParameter />
      </div>
    </div>
  );
}
