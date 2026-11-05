import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import AreaKanvas from './komponen/AreaKanvas';
import AreaUnggah from './komponen/AreaUnggah';
import BilahAksiKanvas from './komponen/BilahAksiKanvas';
import BilahAtas from './komponen/BilahAtas';
import PanelOperasi from './komponen/PanelOperasi';
import PanelParameter from './komponen/PanelParameter';
import { useStatusServer } from './hook/useStatusServer';
import {
  bersihkanParameter,
  dapatkanOperasiBerdasarkanId,
  ekstrakNilaiAwalParameter,
} from './mesin/katalogOperasi';
import {
  buatIdLangkah,
  buatKeadaanAwalPipeline,
  reducerPipeline,
} from './mesin/pipeline';
import {
  bersihkanCacheWorker,
  citraKeBlob,
  ekstrakDataCitra,
  jalankanPipeline,
} from './pekerja/pengelolaPekerja';
import { validasiBerkasCitra } from './utilitas/validasiBerkas';

/**
 * Komponen utama antarmuka PicLab Sevenz (Tahap 3 — Pipeline & Riwayat).
 */
export default function Aplikasi() {
  const { t } = useTranslation();
  const statusServerHook = useStatusServer();

  // Reducer Pipeline & Riwayat Perubahan (Tahap 3)
  const [statePipeline, dispatchPipeline] = useReducer(
    reducerPipeline,
    undefined,
    buatKeadaanAwalPipeline
  );

  // Status Citra & Metadata
  const [gambarSrc, setGambarSrc] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [citraAsli, setCitraAsli] = useState(null);
  const [citraPreview, setCitraPreview] = useState(null);
  const [citraHasilPreview, setCitraHasilPreview] = useState(null);

  const tInputTerakhirRef = useRef(performance.now());

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
    };
  }, [gambarSrc]);

  // Menjalankan eksekusi pipeline preview di Web Worker dengan Prefix Caching
  const terapkanPreviewPipeline = useCallback(
    async (daftarLangkah, tInput = performance.now()) => {
      if (!citraPreview) return;

      if (!daftarLangkah || daftarLangkah.length === 0) {
        setCitraHasilPreview(citraPreview);
        return;
      }

      try {
        const rasio =
          citraAsli && citraAsli.width > 0
            ? citraPreview.width / citraAsli.width
            : 1.0;

        const tMulaiJalankan = performance.now();
        const respons = await jalankanPipeline(
          daftarLangkah,
          citraPreview,
          { rasio },
          true, // Aktifkan prefix caching untuk preview interaktif
          tInput
        );

        if (!respons || respons.usang || !respons.hasil) return;

        const { hasil, waktuRinci, indeksMulaiKomputasi, langkahDieksekusi } =
          respons;

        const tMulaiRenderReact = performance.now();
        hasil.__tInput = tInput;
        setCitraHasilPreview(hasil);

        if (typeof window !== 'undefined' && window.__catatanProfil) {
          window.__catatanProfil.push({
            tipe: 'PIPELINE',
            idOperasi:
              daftarLangkah[daftarLangkah.length - 1]?.idOperasi || 'pipeline',
            tInput,
            faseInputKeKirim: Math.max(0, tMulaiJalankan - tInput),
            faseKirimKeWorker: waktuRinci?.durasiKirimKeWorker || 0,
            faseKomputasiWorker: waktuRinci?.durasiKomputasiWorker || 0,
            faseTransferBalik: waktuRinci?.durasiKembaliKeMain || 0,
            faseRenderReact: Math.max(0, performance.now() - tMulaiRenderReact),
            indeksMulaiKomputasi: indeksMulaiKomputasi || 0,
            langkahDieksekusi: langkahDieksekusi || 0,
          });
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('Galat eksekusi pipeline preview:', err);
        }
      }
    },
    [citraPreview, citraAsli]
  );

  // Sinkronkan eksekusi preview setiap kali langkah pipeline diperbarui
  useEffect(() => {
    if (citraPreview) {
      terapkanPreviewPipeline(
        statePipeline.langkah,
        tInputTerakhirRef.current || performance.now()
      );
    }
  }, [statePipeline.langkah, citraPreview, terapkanPreviewPipeline]);

  // Pintasan Keyboard Global (Undo/Redo)
  useEffect(() => {
    const tanganiKeyDown = (e) => {
      // Nonaktifkan pintasan hanya saat fokus berada pada elemen masukan teks
      const tag = e.target.tagName;
      const isInputTeks =
        (tag === 'INPUT' &&
          ['text', 'number', 'search', 'password', 'email'].includes(
            e.target.type
          )) ||
        tag === 'TEXTAREA' ||
        e.target.isContentEditable;

      if (isInputTeks) {
        return;
      }

      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      if (ctrlOrCmd && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          // Ctrl+Shift+Z / Cmd+Shift+Z -> Redo
          e.preventDefault();
          dispatchPipeline({ type: 'REDO' });
        } else {
          // Ctrl+Z / Cmd+Z -> Undo
          e.preventDefault();
          dispatchPipeline({ type: 'UNDO' });
        }
      } else if (ctrlOrCmd && e.key.toLowerCase() === 'y') {
        // Ctrl+Y -> Redo
        e.preventDefault();
        dispatchPipeline({ type: 'REDO' });
      }
    };

    window.addEventListener('keydown', tanganiKeyDown);
    return () => window.removeEventListener('keydown', tanganiKeyDown);
  }, []);

  // Penanganan Aksi Pipeline (Deterministik: ID dan waktu dibangkitkan pada batas interaksi)
  const saatTambahOperasi = (idOperasi) => {
    dispatchPipeline({
      type: 'TAMBAH_LANGKAH',
      payload: {
        idOperasi,
        idLangkah: buatIdLangkah(),
        waktu: Date.now(),
      },
    });
  };

  const saatHapusLangkah = (idLangkah) => {
    dispatchPipeline({
      type: 'HAPUS_LANGKAH',
      payload: { idLangkah, waktu: Date.now() },
    });
  };

  const saatToggleAktif = (idLangkah) => {
    dispatchPipeline({
      type: 'TOGGLE_AKTIF',
      payload: { idLangkah, waktu: Date.now() },
    });
  };

  const saatPindahLangkah = (dariIndeks, keIndeks) => {
    dispatchPipeline({
      type: 'PINDAH_LANGKAH',
      payload: { dariIndeks, keIndeks, waktu: Date.now() },
    });
  };

  const saatKosongkanPipeline = () => {
    dispatchPipeline({
      type: 'KOSONGKAN_PIPELINE',
      payload: { waktu: Date.now() },
    });
  };

  const saatMuatPreset = (preset) => {
    const langkahDenganId = preset.langkah.map((l) => {
      const op = dapatkanOperasiBerdasarkanId(l.idOperasi);
      const paramDef = op ? ekstrakNilaiAwalParameter(op) : {};
      const paramBersih = op
        ? bersihkanParameter(op, { ...paramDef, ...(l.parameter || {}) })
        : { ...(l.parameter || {}) };

      return {
        id: buatIdLangkah(),
        idOperasi: l.idOperasi,
        parameter: paramBersih,
        aktif: l.aktif !== undefined ? Boolean(l.aktif) : true,
      };
    });

    dispatchPipeline({
      type: 'MUAT_PRESET',
      payload: {
        preset,
        langkah: langkahDenganId,
        waktu: Date.now(),
      },
    });
  };

  const saatPilihLangkah = (idLangkah) => {
    dispatchPipeline({
      type: 'PILIH_LANGKAH',
      payload: { idLangkah },
    });
  };

  const saatUbahParameter = (idLangkah, parameterBaru, coalescing = false) => {
    const tSekarang = performance.now();
    tInputTerakhirRef.current = tSekarang;
    if (typeof window !== 'undefined') {
      window.__tInputTerakhir = tSekarang;
    }
    dispatchPipeline({
      type: 'UBAH_PARAMETER',
      payload: {
        idLangkah,
        parameter: parameterBaru,
        coalescing,
        waktu: Date.now(),
      },
    });
  };

  const saatKomitParameter = (idLangkah) => {
    dispatchPipeline({
      type: 'KOMIT_COALESCING',
      payload: { idLangkah, waktu: Date.now() },
    });
  };

  const saatSetelUlangParameter = (idLangkah) => {
    const langkahItem = statePipeline.langkah.find((l) => l.id === idLangkah);
    if (!langkahItem) return;
    const op = dapatkanOperasiBerdasarkanId(langkahItem.idOperasi);
    if (!op) return;
    const paramAwal = ekstrakNilaiAwalParameter(op);
    const waktu = Date.now();
    dispatchPipeline({
      type: 'UBAH_PARAMETER',
      payload: {
        idLangkah,
        parameter: paramAwal,
        coalescing: false,
        waktu,
      },
      meta: {
        kunciLabel: 'panel.setelUlang',
        label: `Setel Ulang ${op.namaTeknis}`,
        waktu,
      },
    });
  };

  const saatUndo = () => {
    dispatchPipeline({ type: 'UNDO' });
  };

  const saatRedo = () => {
    dispatchPipeline({ type: 'REDO' });
  };

  const saatLompatRiwayat = (indeks) => {
    dispatchPipeline({
      type: 'LOMPAT_RIWAYAT',
      payload: { indeks },
    });
  };

  // Menangani pengunggahan berkas baru
  const prosesBerkas = async (berkas) => {
    setSedangMemuat(true);
    setKodeGalat(null);

    const hasilValidasi = await validasiBerkasCitra(berkas);

    if (!hasilValidasi.valid) {
      setSedangMemuat(false);
      setKodeGalat(hasilValidasi.kodeGalat || hasilValidasi.alasanGalat);
      return;
    }

    const { elemenCitra } = hasilValidasi;
    const murniAsli = ekstrakDataCitra(elemenCitra, false);
    const murniPreview = ekstrakDataCitra(elemenCitra, true);

    if (gambarSrc && gambarSrc.startsWith('blob:')) {
      URL.revokeObjectURL(gambarSrc);
    }
    const urlCitra = URL.createObjectURL(berkas);

    // Bersihkan cache Web Worker dan reset total pipeline saat citra baru diunggah
    bersihkanCacheWorker();
    dispatchPipeline({ type: 'RESET_TOTAL' });

    setGambarSrc(urlCitra);
    setMetadata(hasilValidasi.metadata);
    setCitraAsli(murniAsli);
    setCitraPreview(murniPreview);
    setCitraHasilPreview(murniPreview);
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
    bersihkanCacheWorker();
    dispatchPipeline({ type: 'RESET_TOTAL' });

    setGambarSrc(null);
    setMetadata(null);
    setCitraAsli(null);
    setCitraPreview(null);
    setCitraHasilPreview(null);
    setKodeGalat(null);
  };

  // Mengunduh citra hasil pada resolusi penuh
  const saatUnduh = async (format) => {
    if (!citraAsli) return;
    setSedangMemprosesPenuh(true);

    try {
      let citraSiapUnduh = citraAsli;

      // Eksekusi seluruh langkah pipeline pada resolusi penuh (zero caching untuk hemat memori)
      if (statePipeline.langkah.length > 0) {
        const { hasil } = await jalankanPipeline(
          statePipeline.langkah,
          citraAsli,
          { rasio: 1.0 },
          false // Zero cache intermediate untuk resolusi penuh
        );
        citraSiapUnduh = hasil;
      }

      const blobHasil = await citraKeBlob(citraSiapUnduh, format);
      const urlUnduh = URL.createObjectURL(blobHasil);

      const namaDasar = metadata?.nama
        ? metadata.nama.replace(/\.[^/.]+$/, '')
        : 'citra';
      let suffix = '';
      if (statePipeline.langkah.length === 1) {
        suffix = `-${statePipeline.langkah[0].idOperasi}`;
      } else if (statePipeline.langkah.length > 1) {
        suffix = `-pipeline-${statePipeline.langkah.length}langkah`;
      }
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

  // Evaluasi dimensi citra hasil sesudah seluruh langkah pipeline
  const dimensiSesudah = useMemo(() => {
    if (!citraHasilPreview || !metadata) return null;
    // Hitung dimensi aktual resolusi penuh bila ada perubahan rasio aspek / pemotongan
    const rasioPreviewKeAsli =
      citraPreview && citraPreview.width > 0
        ? citraAsli.width / citraPreview.width
        : 1.0;

    return {
      width: Math.round(citraHasilPreview.width * rasioPreviewKeAsli),
      height: Math.round(citraHasilPreview.height * rasioPreviewKeAsli),
    };
  }, [citraHasilPreview, citraPreview, citraAsli, metadata]);

  // Evaluasi langkah terpilih saat ini untuk panel operasi kiri
  const langkahTerpilihOperasiId = useMemo(() => {
    const l = statePipeline.langkah.find(
      (item) => item.id === statePipeline.langkahTerpilihId
    );
    return l ? l.idOperasi : null;
  }, [statePipeline.langkah, statePipeline.langkahTerpilihId]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-latar-aplikasi text-teks-utama">
      {/* 1. Bilah Navigasi Atas */}
      <BilahAtas statusServerHook={statusServerHook} />

      {/* 2. Layout Editor Tiga Area (Kiri, Tengah, Kanan) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Area Kiri: Katalog Operasi & Preset Awal */}
        <PanelOperasi
          langkahTerpilihOperasiId={langkahTerpilihOperasiId}
          saatTambahOperasi={saatTambahOperasi}
          saatMuatPreset={saatMuatPreset}
          jumlahLangkah={statePipeline.langkah.length}
          apakahServerTersedia={statusServerHook.apakahTersedia}
        />

        {/* Area Tengah: Kanvas / Keadaan Kosong Unggah */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-latar-kanvas">
          {gambarSrc && metadata ? (
            <>
              <AreaKanvas
                gambarSrc={gambarSrc}
                citraSebelum={citraPreview}
                citraSesudah={citraHasilPreview}
                metadata={metadata}
              />
              <BilahAksiKanvas
                metadata={metadata}
                dimensiSesudah={dimensiSesudah}
                saatUnduh={saatUnduh}
                saatGantiGambar={gantiGambar}
                sedangMemprosesPenuh={sedangMemprosesPenuh}
                bisaUndo={statePipeline.indeksRiwayat > 0}
                bisaRedo={
                  statePipeline.indeksRiwayat < statePipeline.riwayat.length - 1
                }
                saatUndo={saatUndo}
                saatRedo={saatRedo}
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

        {/* Area Kanan: Rangkaian Pipeline, Parameter, Histogram, & Riwayat */}
        <PanelParameter
          langkah={statePipeline.langkah}
          langkahTerpilihId={statePipeline.langkahTerpilihId}
          saatPilihLangkah={saatPilihLangkah}
          saatHapusLangkah={saatHapusLangkah}
          saatToggleAktif={saatToggleAktif}
          saatPindahLangkah={saatPindahLangkah}
          saatKosongkanPipeline={saatKosongkanPipeline}
          saatUbahParameter={saatUbahParameter}
          saatKomitParameter={saatKomitParameter}
          saatSetelUlangParameter={saatSetelUlangParameter}
          riwayat={statePipeline.riwayat}
          indeksRiwayat={statePipeline.indeksRiwayat}
          saatLompatRiwayat={saatLompatRiwayat}
          citraSebelum={citraPreview}
          citraSesudah={citraHasilPreview}
        />
      </div>
    </div>
  );
}
