import { AlertTriangle, Info, RotateCcw } from 'lucide-react';
import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { dapatkanOperasiBerdasarkanId } from '../mesin/katalogOperasi';
import { BATASAN_BERKAS } from '../utilitas/konfigurasiBerkas';
import { KONFIGURASI_PIPELINE } from '../utilitas/konfigurasiPipeline';
import DaftarLangkahPipeline from './DaftarLangkahPipeline';
import DaftarRiwayatPerubahan from './DaftarRiwayatPerubahan';
import EditorMatriksKernel from './EditorMatriksKernel';
import HistogramCitra from './HistogramCitra';
import KartuBelajarOperasi from './KartuBelajarOperasi';

/**
 * Panel Kanan Editor: Pengatur Rangkaian Pipeline, Parameter Langkah Terpilih,
 * Editor Matriks Kernel, Kartu Belajar Konsep, Visualisasi Histogram, dan Riwayat (Tahap 4).
 */
export default function PanelParameter({
  langkah = [],
  langkahTerpilihId = null,
  operasiAktif = null,
  parameter = {},
  saatPilihLangkah,
  saatHapusLangkah,
  saatToggleAktif,
  saatPindahLangkah,
  saatKosongkanPipeline,
  saatUbahParameter,
  saatKomitParameter,
  saatSetelUlangParameter,
  riwayat = [],
  indeksRiwayat = 0,
  saatLompatRiwayat,
  citraSebelum,
  citraSesudah,
}) {
  const { t } = useTranslation();
  const timerDebounceKeyboardRef = useRef(null);

  // Temukan objek langkah yang sedang dipilih untuk penyuntingan parameter
  // Mendukung fallback ke operasiAktif & parameter untuk kompatibilitas uji Tahap 1/2
  const langkahTerpilih = useMemo(() => {
    if (langkah && langkah.length > 0) {
      return langkah.find((l) => l.id === langkahTerpilihId) || null;
    }
    if (operasiAktif) {
      return {
        id: 'langkah_tunggal',
        idOperasi: operasiAktif.id,
        parameter: parameter || {},
        aktif: true,
      };
    }
    return null;
  }, [langkah, langkahTerpilihId, operasiAktif, parameter]);

  const operasiTerpilih = useMemo(() => {
    if (operasiAktif) return operasiAktif;
    if (!langkahTerpilih) return null;
    return dapatkanOperasiBerdasarkanId(langkahTerpilih.idOperasi);
  }, [langkahTerpilih, operasiAktif]);

  // Evaluasi apakah parameter dimensi melampaui batas aman (P6: penjepitan terlihat)
  const melebihiBatasDimensi = useMemo(() => {
    if (!langkahTerpilih || !operasiTerpilih) return null;
    const param = langkahTerpilih.parameter || {};

    if (operasiTerpilih.id === 'dasar_ubah_ukuran') {
      const w = Number(param.lebarBaru);
      const h = Number(param.tinggiBaru);
      if (
        w > BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL ||
        h > BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL ||
        w * h > BATASAN_BERKAS.TOTAL_PIKSEL_MAKS
      ) {
        let targetW = Math.min(
          BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL,
          Math.max(1, w)
        );
        let targetH = Math.min(
          BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL,
          Math.max(1, h)
        );
        const totalPiksel = targetW * targetH;
        if (totalPiksel > BATASAN_BERKAS.TOTAL_PIKSEL_MAKS) {
          const faktorSkala = Math.sqrt(
            BATASAN_BERKAS.TOTAL_PIKSEL_MAKS / totalPiksel
          );
          targetW = Math.max(1, Math.floor(targetW * faktorSkala));
          targetH = Math.max(1, Math.floor(targetH * faktorSkala));
        }
        return { lebarDijepit: targetW, tinggiDijepit: targetH };
      }
    } else if (operasiTerpilih.id === 'dasar_crop') {
      const w = Number(param.lebar);
      const h = Number(param.tinggi);
      if (
        w > BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL ||
        h > BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL
      ) {
        return {
          lebarDijepit: Math.min(
            BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL,
            Math.max(1, w)
          ),
          tinggiDijepit: Math.min(
            BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL,
            Math.max(1, h)
          ),
        };
      }
    }
    return null;
  }, [langkahTerpilih, operasiTerpilih]);

  return (
    <aside
      className="w-80 shrink-0 border-l border-garis-panel bg-latar-panel flex flex-col h-full overflow-hidden select-none"
      aria-label={t('panel.judulParameter')}
    >
      {/* Header Panel */}
      <div className="p-3.5 border-b border-garis-panel flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-teks-sekunder">
          {t('panel.judulParameter')}
        </h2>
        {langkahTerpilih && operasiTerpilih?.skemaParameter?.length > 0 && (
          <button
            type="button"
            onClick={() => saatSetelUlangParameter(langkahTerpilih.id)}
            className="flex items-center gap-1 text-[11px] font-semibold text-teks-redup hover:text-primer transition-colors cursor-pointer"
            title={t('panel.setelUlang')}
          >
            <RotateCcw size={12} className="stroke-[2]" />
            <span>{t('panel.setelUlang')}</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* 1. Rangkaian Operasi Pipeline */}
        <DaftarLangkahPipeline
          langkah={langkah}
          langkahTerpilihId={langkahTerpilihId}
          saatPilihLangkah={saatPilihLangkah}
          saatHapusLangkah={saatHapusLangkah}
          saatToggleAktif={saatToggleAktif}
          saatPindahLangkah={saatPindahLangkah}
          saatKosongkanPipeline={saatKosongkanPipeline}
        />

        {/* 2. Pengatur Parameter Langkah Terpilih */}
        {langkahTerpilih && operasiTerpilih && (
          <div className="space-y-4 pt-3 border-t border-garis-panel">
            {/* Header Langkah Terpilih */}
            <div className="p-3 bg-latar-subtil border border-garis-panel rounded-lg space-y-1">
              <div className="font-bold text-xs text-teks-utama flex items-center justify-between">
                <span>{t(operasiTerpilih.kunciNama)}</span>
                <span className="text-[10px] font-normal text-teks-redup">
                  {operasiTerpilih.namaTeknis || t('pipeline.langkahTerpilih')}
                </span>
              </div>
              <div className="text-[11px] text-teks-sekunder leading-relaxed">
                {t(operasiTerpilih.kunciDeskripsi)}
              </div>
            </div>

            {/* Banner Peringatan Batas Dimensi (P6) */}
            {melebihiBatasDimensi && (
              <div
                role="alert"
                data-testid="peringatan-batas-dimensi"
                className="p-3 rounded-lg bg-latar-peringatan border border-garis-peringatan text-teks-peringatan text-xs space-y-1.5"
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{t('panel.peringatanBatasDimensiJudul')}</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {t('panel.peringatanBatasDimensiDeskripsi', {
                    maksSisi: BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL,
                    maksTotal: '16 MP',
                    lebar: melebihiBatasDimensi.lebarDijepit,
                    tinggi: melebihiBatasDimensi.tinggiDijepit,
                  })}
                </p>
              </div>
            )}

            {/* Kontrol Parameter Dinamis */}
            {operasiTerpilih.skemaParameter &&
            operasiTerpilih.skemaParameter.length > 0 ? (
              <div className="space-y-4">
                {operasiTerpilih.skemaParameter.map((skema) => {
                  const nilai =
                    langkahTerpilih.parameter?.[skema.id] ?? skema.nilaiAwal;

                  // Kontrol Khusus Matriks Kernel (Konvolusi)
                  if (skema.tipe === 'matriks') {
                    return (
                      <div key={skema.id} className="space-y-1">
                        <label className="font-semibold text-teks-utama text-xs block">
                          {t(skema.kunciLabel)}
                        </label>
                        <EditorMatriksKernel
                          parameter={langkahTerpilih.parameter || {}}
                          saatUbahParameter={(paramBaru, isCoalescing) =>
                            saatUbahParameter(
                              langkahTerpilih.id,
                              paramBaru,
                              isCoalescing
                            )
                          }
                          saatKomitParameter={() =>
                            saatKomitParameter(langkahTerpilih.id)
                          }
                        />
                      </div>
                    );
                  }

                  // Kontrol Khusus Sakelar (Boolean Toggle)
                  if (skema.tipe === 'sakelar') {
                    return (
                      <div
                        key={skema.id}
                        className="flex items-center justify-between py-1"
                      >
                        <label
                          htmlFor={`param-${skema.id}`}
                          className="font-semibold text-teks-utama text-xs cursor-pointer select-none"
                        >
                          {t(skema.kunciLabel)}
                        </label>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(nilai)}
                          id={`param-${skema.id}`}
                          data-testid={`sakelar-${skema.id}`}
                          onClick={() => {
                            const valBaru = !nilai;
                            saatUbahParameter(
                              langkahTerpilih.id,
                              {
                                ...langkahTerpilih.parameter,
                                [skema.id]: valBaru,
                              },
                              false
                            );
                            saatKomitParameter(langkahTerpilih.id);
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primer focus:ring-offset-2 ${
                            nilai ? 'bg-primer' : 'bg-garis-panel'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              nilai ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  }

                  // Jangan render kontrol ukuran jika sudah dikelola di dalam EditorMatriksKernel
                  if (
                    operasiTerpilih.id === 'konvolusi_kernel' &&
                    (skema.id === 'ukuran' ||
                      skema.id === 'pembagi' ||
                      skema.id === 'offset')
                  ) {
                    return null;
                  }

                  return (
                    <div key={skema.id} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <label
                          htmlFor={`param-${skema.id}`}
                          className="font-semibold text-teks-utama cursor-pointer"
                        >
                          {t(skema.kunciLabel)}
                        </label>
                        {skema.tipe === 'slider' && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={skema.min}
                              max={skema.max}
                              step={skema.step || 1}
                              value={nilai}
                              onChange={(e) =>
                                saatUbahParameter(
                                  langkahTerpilih.id,
                                  {
                                    ...langkahTerpilih.parameter,
                                    [skema.id]: Number(e.target.value),
                                  },
                                  true // Coalescing saat pengetikan angka
                                )
                              }
                              onBlur={() =>
                                saatKomitParameter(langkahTerpilih.id)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saatKomitParameter(langkahTerpilih.id);
                                }
                              }}
                              className="w-16 px-1.5 py-0.5 text-right bg-latar-subtil border border-garis-panel rounded text-[11px] font-mono text-teks-utama focus:outline-none focus:ring-1 focus:ring-primer"
                            />
                            <span className="text-teks-redup font-mono text-[10px] w-4">
                              {skema.satuan || ''}
                            </span>
                          </div>
                        )}
                        {skema.tipe === 'angka' && (
                          <span className="text-teks-redup font-mono text-[11px]">
                            {nilai} {skema.satuan || ''}
                          </span>
                        )}
                      </div>

                      {/* Kontrol Slider */}
                      {skema.tipe === 'slider' && (
                        <div className="space-y-1">
                          <input
                            id={`param-${skema.id}`}
                            type="range"
                            min={skema.min}
                            max={skema.max}
                            step={skema.step || 1}
                            value={nilai}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              saatUbahParameter(
                                langkahTerpilih.id,
                                {
                                  ...langkahTerpilih.parameter,
                                  [skema.id]: val,
                                },
                                true // Mode coalescing selama interaksi slider berlangsung
                              );

                              // Debounce komit untuk rangkaian penekanan tombol panah keyboard
                              if (timerDebounceKeyboardRef.current) {
                                clearTimeout(timerDebounceKeyboardRef.current);
                              }
                              timerDebounceKeyboardRef.current = setTimeout(
                                () => {
                                  saatKomitParameter(langkahTerpilih.id);
                                  timerDebounceKeyboardRef.current = null;
                                },
                                KONFIGURASI_PIPELINE.JEDA_COALESCING_MS
                              );
                            }}
                            onPointerUp={() => {
                              if (timerDebounceKeyboardRef.current) {
                                clearTimeout(timerDebounceKeyboardRef.current);
                                timerDebounceKeyboardRef.current = null;
                              }
                              saatKomitParameter(langkahTerpilih.id);
                            }}
                            onBlur={() => {
                              if (timerDebounceKeyboardRef.current) {
                                clearTimeout(timerDebounceKeyboardRef.current);
                                timerDebounceKeyboardRef.current = null;
                                saatKomitParameter(langkahTerpilih.id);
                              }
                            }}
                            className="w-full h-1.5 bg-garis-panel rounded-lg appearance-none cursor-pointer accent-primer focus:outline-none focus:ring-2 focus:ring-primer/30"
                          />
                          <div className="flex justify-between text-[10px] text-teks-redup font-mono">
                            <span>{skema.min}</span>
                            <span>{skema.max}</span>
                          </div>
                        </div>
                      )}

                      {/* Kontrol Angka (Number Input) */}
                      {skema.tipe === 'angka' && (
                        <input
                          id={`param-${skema.id}`}
                          type="number"
                          min={skema.min}
                          max={skema.max}
                          step={skema.step || 1}
                          value={nilai}
                          onChange={(e) =>
                            saatUbahParameter(
                              langkahTerpilih.id,
                              {
                                ...langkahTerpilih.parameter,
                                [skema.id]: Number(e.target.value),
                              },
                              true // Coalescing saat pengetikan angka
                            )
                          }
                          onBlur={() => saatKomitParameter(langkahTerpilih.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              saatKomitParameter(langkahTerpilih.id);
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-latar-subtil border border-garis-panel rounded-md text-xs text-teks-utama focus:outline-none focus:ring-2 focus:ring-primer focus:bg-white font-mono"
                        />
                      )}

                      {/* Kontrol Pilihan (Select) */}
                      {skema.tipe === 'pilihan' && (
                        <select
                          id={`param-${skema.id}`}
                          value={nilai}
                          onChange={(e) =>
                            saatUbahParameter(
                              langkahTerpilih.id,
                              {
                                ...langkahTerpilih.parameter,
                                [skema.id]: e.target.value,
                              },
                              false
                            )
                          }
                          className="w-full px-3 py-1.5 bg-latar-subtil border border-garis-panel rounded-md text-xs text-teks-utama focus:outline-none focus:ring-2 focus:ring-primer focus:bg-white cursor-pointer font-medium"
                        >
                          {(skema.pilihan || []).map((opsi) => (
                            <option key={opsi.nilai} value={opsi.nilai}>
                              {t(opsi.kunciLabel)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-latar-subtil border border-garis-panel rounded-lg text-xs text-teks-redup">
                <Info size={14} className="shrink-0" />
                <span>{t('panel.tanpaParameter')}</span>
              </div>
            )}

            {/* Catatan Keterbatasan Pratinjau untuk Operasi Berkernel Tetap (H5) */}
            {[
              'konvolusi_kernel',
              'tepi_sobel',
              'tepi_prewitt',
              'tepi_roberts',
              'tepi_laplacian',
              'halus_median',
            ].includes(operasiTerpilih.id) && (
              <div
                className="flex items-start gap-1.5 p-2 bg-latar-subtil/80 border border-garis-panel/80 rounded-md text-[11px] text-teks-redup leading-relaxed"
                data-testid="catatan-kernel-tetap"
              >
                <Info size={13} className="shrink-0 mt-0.5 text-primer" />
                <span>{t('parameter.catatanKernelTetap')}</span>
              </div>
            )}

            {/* Kartu Belajar Konsep & Rumus Operasi Terpilih (Tahap 4) */}
            <div className="pt-2">
              <KartuBelajarOperasi operasi={operasiTerpilih} />
            </div>
          </div>
        )}

        {/* 3. Visualisasi Histogram Citra Terpisah */}
        <div className="pt-3 border-t border-garis-panel">
          <HistogramCitra
            citraSebelum={citraSebelum}
            citraSesudah={citraSesudah}
          />
        </div>

        {/* 4. Daftar Riwayat Perubahan (Collapsible Undo/Redo Stack) */}
        <div className="pt-3 border-t border-garis-panel">
          <DaftarRiwayatPerubahan
            riwayat={riwayat}
            indeksRiwayat={indeksRiwayat}
            saatLompatRiwayat={saatLompatRiwayat}
          />
        </div>
      </div>
    </aside>
  );
}
