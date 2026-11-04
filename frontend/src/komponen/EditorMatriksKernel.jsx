import { AlertCircle, Calculator, RotateCcw } from 'lucide-react';
import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRESET_KERNEL } from '../mesin/konvolusi';
import { KONFIGURASI_SPASIAL } from '../utilitas/konfigurasiPipeline';

/**
 * Editor Matriks Kernel Konvolusi Interaktif (Tahap 4).
 * Mendukung ukuran 3x3 dan 5x5, preset kernel standar, navigasi keyboard lengkap (panah & Tab),
 * normalisasi pembagi, bias offset, dan umpan balik kesalahan non-warna (OWASP & Aksesibilitas).
 */
export default function EditorMatriksKernel({
  parameter = {},
  saatUbahParameter,
  saatKomitParameter,
}) {
  const { t } = useTranslation();
  const idUnik = useId();
  const inputRefs = useRef([]);

  const ukuran = Number(parameter.ukuran) === 5 ? 5 : 3;
  const matriks = useMemo(() => {
    const raw = parameter.matriks;
    const targetLen = ukuran * ukuran;
    if (Array.isArray(raw) && raw.length === targetLen) {
      return raw.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
    }
    // Fallback identitas
    const fallback = new Array(targetLen).fill(0);
    const center = Math.floor(ukuran / 2) * ukuran + Math.floor(ukuran / 2);
    fallback[center] = 1;
    return fallback;
  }, [parameter.matriks, ukuran]);

  const pembagi =
    parameter.pembagi !== undefined && parameter.pembagi !== null
      ? parameter.pembagi
      : 1;
  const offset =
    parameter.offset !== undefined && parameter.offset !== null
      ? parameter.offset
      : 0;

  // State kesalahan input per sel (untuk mendeteksi string non-angka atau di luar batas)
  const [pesanGalat, setPesanGalat] = useState('');
  const [selGalat, setSelGalat] = useState(new Set());

  // Hitung jumlah bobot kernel saat ini
  const jumlahBobot = useMemo(() => {
    return matriks.reduce((acc, val) => acc + (Number(val) || 0), 0);
  }, [matriks]);

  // Penanganan perubahan nilai satu sel matriks
  const ubahNilaiSel = useCallback(
    (indeks, nilaiString) => {
      const salinan = [...matriks];
      const valNum = Number(nilaiString);

      const selGalatBaru = new Set(selGalat);
      if (
        nilaiString.trim() === '' ||
        !Number.isFinite(valNum) ||
        valNum < KONFIGURASI_SPASIAL.NILAI_ELEMEN_MATRIKS_MIN ||
        valNum > KONFIGURASI_SPASIAL.NILAI_ELEMEN_MATRIKS_MAX
      ) {
        selGalatBaru.add(indeks);
        setPesanGalat(
          t('parameter.galatRentangMatriks', {
            min: KONFIGURASI_SPASIAL.NILAI_ELEMEN_MATRIKS_MIN,
            max: KONFIGURASI_SPASIAL.NILAI_ELEMEN_MATRIKS_MAX,
          })
        );
      } else {
        selGalatBaru.delete(indeks);
        if (selGalatBaru.size === 0) setPesanGalat('');
      }
      setSelGalat(selGalatBaru);

      salinan[indeks] = Number.isFinite(valNum)
        ? Math.max(
            KONFIGURASI_SPASIAL.NILAI_ELEMEN_MATRIKS_MIN,
            Math.min(KONFIGURASI_SPASIAL.NILAI_ELEMEN_MATRIKS_MAX, valNum)
          )
        : 0;

      saatUbahParameter(
        {
          ...parameter,
          matriks: salinan,
        },
        true // Coalescing saat mengedit sel
      );
    },
    [matriks, parameter, saatUbahParameter, selGalat, t]
  );

  // Navigasi keyboard kisi 2D (ArrowUp, ArrowDown, ArrowLeft, ArrowRight)
  const tanganiKeyDown = useCallback(
    (e, r, c) => {
      let targetR = r;
      let targetC = c;

      if (e.key === 'ArrowUp') {
        targetR = Math.max(0, r - 1);
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        targetR = Math.min(ukuran - 1, r + 1);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        targetC = Math.max(0, c - 1);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        targetC = Math.min(ukuran - 1, c + 1);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        saatKomitParameter();
        return;
      } else {
        return;
      }

      const targetIdx = targetR * ukuran + targetC;
      if (inputRefs.current[targetIdx]) {
        inputRefs.current[targetIdx].focus();
        inputRefs.current[targetIdx].select();
      }
    },
    [ukuran, saatKomitParameter]
  );

  // Beralih ukuran matriks (3x3 <-> 5x5) dengan mempertahankan titik tengah
  const gantiUkuranMatriks = useCallback(
    (ukuranBaru) => {
      if (ukuranBaru === ukuran) return;
      let matriksBaru;

      if (ukuranBaru === 5) {
        // Ekstensi 3x3 ke 5x5: tempatkan 3x3 di tengah 5x5 dengan padding 0
        matriksBaru = new Array(25).fill(0);
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            matriksBaru[(r + 1) * 5 + (c + 1)] = matriks[r * 3 + c];
          }
        }
      } else {
        // Pemangkasan 5x5 ke 3x3: ambil submatriks 3x3 di pusat 5x5
        matriksBaru = new Array(9).fill(0);
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            matriksBaru[r * 3 + c] = matriks[(r + 1) * 5 + (c + 1)];
          }
        }
      }

      setSelGalat(new Set());
      setPesanGalat('');
      saatUbahParameter({
        ...parameter,
        ukuran: ukuranBaru,
        matriks: matriksBaru,
      });
      saatKomitParameter();
    },
    [ukuran, matriks, parameter, saatUbahParameter, saatKomitParameter]
  );

  // Menerapkan Preset Kernel
  const pilihPreset = useCallback(
    (kunciPreset) => {
      const preset = PRESET_KERNEL[kunciPreset];
      if (!preset) return;

      setSelGalat(new Set());
      setPesanGalat('');
      saatUbahParameter({
        ...parameter,
        ukuran: preset.ukuran,
        matriks: [...preset.matriks],
        pembagi: preset.pembagi,
        offset: preset.offset,
      });
      saatKomitParameter();
    },
    [parameter, saatUbahParameter, saatKomitParameter]
  );

  // Auto-hitung pembagi dari jumlah bobot (fallback ke 1 jika sum <= 0)
  const otomatiskanPembagi = useCallback(() => {
    const pembagiAman = jumlahBobot > 0 ? jumlahBobot : 1;
    saatUbahParameter({
      ...parameter,
      pembagi: pembagiAman,
    });
    saatKomitParameter();
  }, [jumlahBobot, parameter, saatUbahParameter, saatKomitParameter]);

  // Setel ulang ke kernel identitas
  const setelUlangIdentitas = useCallback(() => {
    const identitas = PRESET_KERNEL.identitas;
    setSelGalat(new Set());
    setPesanGalat('');
    saatUbahParameter({
      ...parameter,
      ukuran: identitas.ukuran,
      matriks: [...identitas.matriks],
      pembagi: identitas.pembagi,
      offset: identitas.offset,
    });
    saatKomitParameter();
  }, [parameter, saatUbahParameter, saatKomitParameter]);

  return (
    <div
      className="space-y-3 pt-1 border-t border-garis-panel/60"
      data-testid="editor-matriks-kernel"
    >
      {/* 1. Baris Kontrol: Pilihan Ukuran & Preset Dropdown */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-latar-subtil p-0.5 rounded-lg border border-garis-panel">
          <button
            type="button"
            onClick={() => gantiUkuranMatriks(3)}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
              ukuran === 3
                ? 'bg-white shadow-xs text-primer font-bold'
                : 'text-teks-redup hover:text-teks-utama'
            }`}
          >
            3×3
          </button>
          <button
            type="button"
            onClick={() => gantiUkuranMatriks(5)}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
              ukuran === 5
                ? 'bg-white shadow-xs text-primer font-bold'
                : 'text-teks-redup hover:text-teks-utama'
            }`}
          >
            5×5
          </button>
        </div>

        {/* Preset Dropdown */}
        <select
          aria-label={t('parameter.pilihPresetKernel')}
          onChange={(e) => pilihPreset(e.target.value)}
          defaultValue=""
          className="px-2 py-1 bg-latar-subtil border border-garis-panel rounded-md text-xs text-teks-utama focus:outline-none focus:ring-1 focus:ring-primer font-medium cursor-pointer"
        >
          <option value="" disabled>
            {t('parameter.presetKernelPlaceholder')}
          </option>
          {Object.entries(PRESET_KERNEL)
            .filter(([, val]) => val.ukuran === ukuran)
            .map(([kunci, val]) => (
              <option key={kunci} value={kunci}>
                {t(val.kunciLabel)}
              </option>
            ))}
        </select>

        {/* Tombol Reset */}
        <button
          type="button"
          onClick={setelUlangIdentitas}
          title={t('parameter.setelUlangKernel')}
          className="p-1 rounded-md text-teks-redup hover:text-teks-utama hover:bg-latar-sorot transition-colors cursor-pointer"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* 2. Kisi Matriks Interaktif */}
      <div className="space-y-1">
        <div
          className={`grid gap-1 p-2 bg-latar-subtil rounded-lg border border-garis-panel ${
            ukuran === 5 ? 'grid-cols-5' : 'grid-cols-3'
          }`}
          role="grid"
          aria-label={t('parameter.labelMatriks', { ukuran })}
        >
          {Array.from({ length: ukuran }).map((_, r) =>
            Array.from({ length: ukuran }).map((_, c) => {
              const idx = r * ukuran + c;
              const val = matriks[idx] !== undefined ? matriks[idx] : 0;
              const isError = selGalat.has(idx);

              return (
                <div key={idx} role="gridcell" className="relative">
                  <input
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    value={val}
                    onChange={(e) => ubahNilaiSel(idx, e.target.value)}
                    onBlur={() => saatKomitParameter()}
                    onKeyDown={(e) => tanganiKeyDown(e, r, c)}
                    aria-label={t('parameter.selMatriks', {
                      baris: r + 1,
                      kolom: c + 1,
                    })}
                    aria-invalid={isError ? 'true' : 'false'}
                    className={`w-full h-8 px-1 text-center font-mono text-xs rounded border transition-colors focus:outline-none focus:ring-1 ${
                      isError
                        ? 'border-garis-galat bg-latar-galat text-teks-galat focus:ring-status-galat font-bold'
                        : 'border-garis-panel bg-white text-teks-utama focus:ring-primer focus:border-primer'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Umpan Balik Kesalahan Non-Warna (Teks + Ikon) */}
        {pesanGalat && (
          <div
            className="flex items-center gap-1.5 p-2 bg-latar-galat border border-garis-galat rounded-md text-teks-galat text-[11px]"
            role="alert"
          >
            <AlertCircle size={13} className="shrink-0" />
            <span>{pesanGalat}</span>
          </div>
        )}
      </div>

      {/* 3. Pengaturan Pembagi & Bias Offset */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor={`${idUnik}-pembagi`}
              className="font-semibold text-teks-utama text-[11px]"
            >
              {t('parameter.pembagi')}
            </label>
            <button
              type="button"
              onClick={otomatiskanPembagi}
              className="text-[10px] text-primer hover:underline flex items-center gap-0.5 cursor-pointer"
              title={t('parameter.hitungJumlahBobot', { jumlah: jumlahBobot })}
            >
              <Calculator size={10} />
              <span>Σ={jumlahBobot}</span>
            </button>
          </div>
          <input
            id={`${idUnik}-pembagi`}
            type="number"
            step="any"
            value={pembagi}
            onChange={(e) =>
              saatUbahParameter(
                {
                  ...parameter,
                  pembagi: Number(e.target.value) || 1,
                },
                true
              )
            }
            onBlur={() => saatKomitParameter()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saatKomitParameter();
            }}
            className="w-full px-2 py-1 bg-latar-subtil border border-garis-panel rounded text-xs font-mono text-teks-utama focus:outline-none focus:ring-1 focus:ring-primer"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`${idUnik}-offset`}
            className="font-semibold text-teks-utama text-[11px]"
          >
            {t('parameter.offsetBias')}
          </label>
          <input
            id={`${idUnik}-offset`}
            type="number"
            min="-255"
            max="255"
            value={offset}
            onChange={(e) =>
              saatUbahParameter(
                {
                  ...parameter,
                  offset: Number(e.target.value) || 0,
                },
                true
              )
            }
            onBlur={() => saatKomitParameter()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saatKomitParameter();
            }}
            className="w-full px-2 py-1 bg-latar-subtil border border-garis-panel rounded text-xs font-mono text-teks-utama focus:outline-none focus:ring-1 focus:ring-primer"
          />
        </div>
      </div>
    </div>
  );
}
