import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AreaKanvas from './komponen/AreaKanvas';
import AreaUnggah from './komponen/AreaUnggah';
import BilahAksiKanvas from './komponen/BilahAksiKanvas';
import BilahAtas from './komponen/BilahAtas';
import PanelOperasi from './komponen/PanelOperasi';
import PanelParameter from './komponen/PanelParameter';
import { ekstrakNilaiAwalParameter } from './mesin/katalogOperasi';
import {
  citraKeBlob,
  citraKeUrlBlob,
  ekstrakDataCitra,
  jalankanOperasi,
} from './pekerja/pengelolaPekerja';
import { validasiBerkasCitra } from './utilitas/validasiBerkas';

/**
 * Menghitung estimasi dimensi akhir citra pada resolusi penuh berdasarkan operasi aktif.
 */
function hitungDimensiSesudah(metadata, operasiAktif, parameter) {
  if (!operasiAktif || !metadata) return null;
  if (operasiAktif.id === 'dasar_rotasi') {
    const sudut = Number(parameter?.sudut) || 90;
    if (sudut === 90 || sudut === 270) {
      return { width: metadata.tinggi, height: metadata.lebar };
    }
    return { width: metadata.lebar, height: metadata.tinggi };
  }
  if (operasiAktif.id === 'dasar_ubah_ukuran') {
    return {
      width: Math.round(parameter?.lebarTarget || metadata.lebar),
      height: Math.round(parameter?.tinggiTarget || metadata.tinggi),
    };
  }
  if (operasiAktif.id === 'dasar_crop') {
    const startX = Math.max(
      0,
      Math.min(metadata.lebar - 1, Math.round(parameter?.x ?? 0))
    );
    const startY = Math.max(
      0,
      Math.min(metadata.tinggi - 1, Math.round(parameter?.y ?? 0))
    );
    const maxW = metadata.lebar - startX;
    const maxH = metadata.tinggi - startY;
    const cropW = Math.max(
      1,
      Math.min(maxW, Math.round(parameter?.lebar ?? maxW))
    );
    const cropH = Math.max(
      1,
      Math.min(maxH, Math.round(parameter?.tinggi ?? maxH))
    );
    return { width: cropW, height: cropH };
  }
  return null;
}

/**
 * Komponen utama antarmuka PicLab Sevenz (Tahap 2 — Mesin Operasi Klien).
 */
export default function Aplikasi() {
  const { t } = useTranslation();

  // Status Citra & Metadata
  const [gambarSrc, setGambarSrc] = useState(null);
  const [gambarHasilSrc, setGambarHasilSrc] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [citraAsli, setCitraAsli] = useState(null);
  const [citraPreview, setCitraPreview] = useState(null);
  const [citraHasilPreview, setCitraHasilPreview] = useState(null);

  // Status Operasi Aktif & Parameter
  const [operasiAktif, setOperasiAktif] = useState(null);
  const [parameter, setParameter] = useState({});

  // Status Loading & Galat
  const [sedangMemuat, setSedangMemuat] = useState(false);
  const [sedangMemprosesPenuh, setSedangMemprosesPenuh] = useState(false);
  const [kodeGalat, setKodeGalat] = useState(null);

  // Membersihkan Object URL saat komponen dilepas atau citra diganti (OWASP)
  useEffect(() => {
    return () => {
      if (gambarSrc && gambarSrc.startsWith('blob:')) {
        URL.revokeObjectURL(gambarSrc);
      }
      if (gambarHasilSrc && gambarHasilSrc.startsWith('blob:')) {
        URL.revokeObjectURL(gambarHasilSrc);
      }
    };
  }, [gambarSrc, gambarHasilSrc]);

  // Menjalankan operasi preview di Web Worker
  const terapkanPreview = async (op, param) => {
    if (!citraPreview || !op) return;
    try {
      const { hasil } = await jalankanOperasi(op.id, citraPreview, param);
      const urlBlob = await citraKeUrlBlob(hasil);

      if (gambarHasilSrc && gambarHasilSrc.startsWith('blob:')) {
        URL.revokeObjectURL(gambarHasilSrc);
      }
      setGambarHasilSrc(urlBlob);
      setCitraHasilPreview(hasil);
    } catch (err) {
      // Galat operasi ditangkap tanpa menghentikan thread UI
      if (import.meta.env.DEV) {
        console.error('Galat eksekusi worker:', err);
      }
    }
  };

  // Menangani pemilihan operasi dari panel kiri
  const saatPilihOperasi = (op) => {
    setOperasiAktif(op);
    const paramAwal = ekstrakNilaiAwalParameter(op);

    // Inisialisasi parameter khusus seperti ukuran awal crop/ubah ukuran berdasarkan metadata
    if (op.id === 'dasar_crop' && metadata) {
      paramAwal.lebar = metadata.lebar;
      paramAwal.tinggi = metadata.tinggi;
    } else if (op.id === 'dasar_ubah_ukuran' && metadata) {
      paramAwal.lebarTarget = metadata.lebar;
      paramAwal.tinggiTarget = metadata.tinggi;
    }

    setParameter(paramAwal);
    terapkanPreview(op, paramAwal);
  };

  // Menangani perubahan parameter dari panel kanan
  const saatUbahParameter = (idParam, nilaiBaru) => {
    const paramBaru = { ...parameter, [idParam]: nilaiBaru };
    setParameter(paramBaru);
    if (operasiAktif) {
      terapkanPreview(operasiAktif, paramBaru);
    }
  };

  // Mereset parameter operasi aktif ke nilai awal
  const saatSetelUlangParameter = () => {
    if (!operasiAktif) return;
    const paramAwal = ekstrakNilaiAwalParameter(operasiAktif);
    if (operasiAktif.id === 'dasar_crop' && metadata) {
      paramAwal.lebar = metadata.lebar;
      paramAwal.tinggi = metadata.tinggi;
    } else if (operasiAktif.id === 'dasar_ubah_ukuran' && metadata) {
      paramAwal.lebarTarget = metadata.lebar;
      paramAwal.tinggiTarget = metadata.tinggi;
    }
    setParameter(paramAwal);
    terapkanPreview(operasiAktif, paramAwal);
  };

  // Menangani pengunggahan berkas baru
  const prosesBerkas = async (berkas) => {
    setSedangMemuat(true);
    setKodeGalat(null);

    const hasilValidasi = await validasiBerkasCitra(berkas);

    if (!hasilValidasi.valid) {
      setSedangMemuat(false);
      setKodeGalat(hasilValidasi.kodeGalat);
      return;
    }

    // Bersihkan URL blob lama
    if (gambarSrc && gambarSrc.startsWith('blob:')) {
      URL.revokeObjectURL(gambarSrc);
    }
    if (gambarHasilSrc && gambarHasilSrc.startsWith('blob:')) {
      URL.revokeObjectURL(gambarHasilSrc);
    }

    const urlBaru = URL.createObjectURL(berkas);
    const murniAsli = ekstrakDataCitra(hasilValidasi.elemenCitra, false);
    const murniPreview = ekstrakDataCitra(hasilValidasi.elemenCitra, true);

    setGambarSrc(urlBaru);
    setGambarHasilSrc(null);
    setMetadata(hasilValidasi.metadata);
    setCitraAsli(murniAsli);
    setCitraPreview(murniPreview);
    setCitraHasilPreview(murniPreview);
    setOperasiAktif(null);
    setParameter({});
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
    if (gambarHasilSrc && gambarHasilSrc.startsWith('blob:')) {
      URL.revokeObjectURL(gambarHasilSrc);
    }
    setGambarSrc(null);
    setGambarHasilSrc(null);
    setMetadata(null);
    setCitraAsli(null);
    setCitraPreview(null);
    setCitraHasilPreview(null);
    setOperasiAktif(null);
    setParameter({});
    setKodeGalat(null);
  };

  // Mengunduh citra hasil pada resolusi penuh
  const saatUnduh = async (format) => {
    if (!citraAsli) return;
    setSedangMemprosesPenuh(true);

    try {
      let citraSiapUnduh = citraAsli;
      if (operasiAktif) {
        const { hasil } = await jalankanOperasi(
          operasiAktif.id,
          citraAsli,
          parameter
        );
        citraSiapUnduh = hasil;
      }

      const blobHasil = await citraKeBlob(citraSiapUnduh, format);
      const urlUnduh = URL.createObjectURL(blobHasil);

      const namaDasar = metadata?.nama
        ? metadata.nama.replace(/\.[^/.]+$/, '')
        : 'citra';
      const suffix = operasiAktif ? `-${operasiAktif.id}` : '';
      const namaBerkas = `${namaDasar}-piclab${suffix}.${format}`;

      const tautan = document.createElement('a');
      tautan.href = urlUnduh;
      tautan.download = namaBerkas;
      document.body.appendChild(tautan);
      tautan.click();
      document.body.removeChild(tautan);

      setTimeout(() => URL.revokeObjectURL(urlUnduh), 2000);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Galat saat mengunduh citra:', err);
      }
    } finally {
      setSedangMemprosesPenuh(false);
    }
  };

  // Dimensi sesudah bila operasi aktif mengubah geometri
  const dimensiSesudah = useMemo(
    () => hitungDimensiSesudah(metadata, operasiAktif, parameter),
    [metadata, operasiAktif, parameter]
  );

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-latar-aplikasi text-teks-utama">
      {/* 1. Bilah Navigasi Atas */}
      <BilahAtas />

      {/* 2. Layout Editor Tiga Area (Kiri, Tengah, Kanan) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Area Kiri: Katalog Operasi & Preset */}
        <PanelOperasi
          operasiAktif={operasiAktif}
          saatPilihOperasi={saatPilihOperasi}
        />

        {/* Area Tengah: Kanvas / Keadaan Kosong Unggah */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-latar-kanvas">
          {gambarSrc && metadata ? (
            <>
              <AreaKanvas
                gambarSrc={gambarSrc}
                gambarSesudahSrc={gambarHasilSrc}
                metadata={metadata}
              />
              <BilahAksiKanvas
                metadata={metadata}
                dimensiSesudah={dimensiSesudah}
                saatUnduh={saatUnduh}
                saatGantiGambar={gantiGambar}
                sedangMemprosesPenuh={sedangMemprosesPenuh}
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

        {/* Area Kanan: Parameter & Visualisasi Histogram */}
        <PanelParameter
          operasiAktif={operasiAktif}
          parameter={parameter}
          saatUbahParameter={saatUbahParameter}
          saatSetelUlangParameter={saatSetelUlangParameter}
          citraSebelum={citraPreview}
          citraSesudah={citraHasilPreview}
        />
      </div>
    </div>
  );
}
