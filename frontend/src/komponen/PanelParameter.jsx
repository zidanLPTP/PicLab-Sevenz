import { AlertTriangle, Info, RotateCcw, Sliders } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BATASAN_BERKAS } from '../utilitas/konfigurasiBerkas';
import HistogramCitra from './HistogramCitra';

/**
 * Panel Kanan Editor: Pengatur Parameter Operasi Terpilih & Visualisasi Histogram.
 * Merender kontrol secara dinamis berdasarkan skema parameter operasi.
 */
export default function PanelParameter({
  operasiAktif,
  parameter,
  saatUbahParameter,
  saatSetelUlangParameter,
  citraSebelum,
  citraSesudah,
}) {
  const { t } = useTranslation();

  // Evaluasi apakah parameter dimensi melampaui batas aman (P6: penjepitan terlihat)
  const melebihiBatasDimensi = useMemo(() => {
    if (!operasiAktif) return null;
    if (operasiAktif.id === 'dasar_ubah_ukuran') {
      const w = Number(parameter.lebarBaru);
      const h = Number(parameter.tinggiBaru);
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
    } else if (operasiAktif.id === 'dasar_crop') {
      const w = Number(parameter.lebar);
      const h = Number(parameter.tinggi);
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
  }, [operasiAktif, parameter]);

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
        {operasiAktif && operasiAktif.skemaParameter?.length > 0 && (
          <button
            type="button"
            onClick={saatSetelUlangParameter}
            className="flex items-center gap-1 text-[11px] font-semibold text-teks-redup hover:text-primer transition-colors cursor-pointer"
            title={t('panel.setelUlang')}
          >
            <RotateCcw size={12} className="stroke-[2]" />
            <span>{t('panel.setelUlang')}</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {operasiAktif ? (
          <>
            {/* Kartu Informasi Operasi Aktif */}
            <div className="p-3 bg-latar-subtil border border-garis-panel rounded-lg space-y-1">
              <div className="font-bold text-sm text-teks-utama">
                {t(operasiAktif.kunciNama)}
              </div>
              <div className="text-xs text-teks-redup leading-relaxed">
                {t(operasiAktif.kunciDeskripsi)}
              </div>
              <div className="pt-1.5 flex items-center gap-1 text-[11px] text-teks-primer font-mono">
                <span className="font-semibold">{operasiAktif.namaTeknis}</span>
              </div>
            </div>

            {/* Banner Penjelasan Satu Operasi Aktif */}
            <div className="p-2.5 bg-latar-peringatan border border-garis-peringatan rounded-lg text-teks-peringatan text-[11px] flex items-start gap-1.5 leading-snug">
              <Info size={14} className="shrink-0 mt-0.5" />
              <span>{t('panel.infoSatuOperasi')}</span>
            </div>

            {/* Banner Peringatan Batas Dimensi (P6: Penjepitan Terlihat) */}
            {melebihiBatasDimensi && (
              <div
                role="alert"
                data-testid="peringatan-batas-dimensi"
                className="p-2.5 bg-latar-bahaya border border-garis-bahaya rounded-lg text-teks-bahaya text-xs space-y-1"
              >
                <div className="flex items-center gap-1.5 font-bold text-teks-bahaya">
                  <AlertTriangle
                    size={15}
                    className="shrink-0 text-status-bahaya"
                  />
                  <span>{t('panel.peringatanBatasDimensiJudul')}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-teks-bahaya-terang">
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
            {operasiAktif.skemaParameter?.length > 0 ? (
              <div className="space-y-4 pt-1">
                {operasiAktif.skemaParameter.map((skema) => {
                  const nilaiSaatIni =
                    parameter[skema.id] !== undefined
                      ? parameter[skema.id]
                      : skema.nilaiAwal;

                  // 1. Tipe Slider + Input Angka Sinkron
                  if (skema.tipe === 'slider') {
                    return (
                      <div key={skema.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <label
                            htmlFor={`param-${skema.id}`}
                            className="font-medium text-teks-sekunder"
                          >
                            {t(skema.kunciLabel)}
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={skema.min}
                              max={skema.max}
                              step={skema.step || 1}
                              value={nilaiSaatIni}
                              onChange={(e) =>
                                saatUbahParameter(
                                  skema.id,
                                  Number(e.target.value)
                                )
                              }
                              className="w-16 px-1.5 py-0.5 text-right text-xs font-mono font-bold bg-latar-subtil border border-garis-panel rounded focus:ring-1 focus:ring-primer focus:outline-none"
                            />
                            {skema.satuan && (
                              <span className="text-teks-redup text-[11px]">
                                {skema.satuan}
                              </span>
                            )}
                          </div>
                        </div>

                        <input
                          id={`param-${skema.id}`}
                          type="range"
                          min={skema.min}
                          max={skema.max}
                          step={skema.step || 1}
                          value={nilaiSaatIni}
                          onChange={(e) =>
                            saatUbahParameter(skema.id, Number(e.target.value))
                          }
                          aria-label={t(skema.kunciLabel)}
                          aria-valuenow={nilaiSaatIni}
                          className="w-full accent-primer cursor-pointer"
                        />
                      </div>
                    );
                  }

                  // 2. Tipe Input Angka Saja
                  if (skema.tipe === 'angka') {
                    return (
                      <div
                        key={skema.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <label
                          htmlFor={`param-${skema.id}`}
                          className="font-medium text-teks-sekunder"
                        >
                          {t(skema.kunciLabel)}
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            id={`param-${skema.id}`}
                            type="number"
                            min={skema.min}
                            max={skema.max}
                            step={skema.step || 1}
                            value={nilaiSaatIni}
                            onChange={(e) =>
                              saatUbahParameter(
                                skema.id,
                                Number(e.target.value)
                              )
                            }
                            className="w-20 px-2 py-1 text-right text-xs font-mono font-bold bg-latar-subtil border border-garis-panel rounded focus:ring-1 focus:ring-primer focus:outline-none"
                          />
                          {skema.satuan && (
                            <span className="text-teks-redup text-[11px]">
                              {skema.satuan}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // 3. Tipe Pilihan (Dropdown / Select)
                  if (skema.tipe === 'pilihan') {
                    return (
                      <div key={skema.id} className="space-y-1.5 text-xs">
                        <label
                          htmlFor={`param-${skema.id}`}
                          className="font-medium text-teks-sekunder block"
                        >
                          {t(skema.kunciLabel)}
                        </label>
                        <select
                          id={`param-${skema.id}`}
                          value={nilaiSaatIni}
                          onChange={(e) =>
                            saatUbahParameter(skema.id, e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 bg-latar-subtil border border-garis-panel rounded-md text-xs font-medium text-teks-utama focus:ring-2 focus:ring-primer focus:outline-none cursor-pointer"
                        >
                          {skema.pilihan?.map((pil) => (
                            <option key={pil.nilai} value={pil.nilai}>
                              {t(pil.kunciLabel)}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            ) : (
              <div className="py-2 text-xs text-teks-redup text-center">
                <p>Operasi ini bekerja langsung tanpa parameter tambahan.</p>
              </div>
            )}

            {/* Bagian Histogram Citra */}
            <div className="pt-2">
              <HistogramCitra
                citraSebelum={citraSebelum}
                citraSesudah={citraSesudah}
              />
            </div>
          </>
        ) : (
          /* Keadaan Belum Ada Operasi Terpilih */
          <div className="flex flex-col items-center justify-center text-center text-teks-redup py-12">
            <div className="w-12 h-12 rounded-full bg-latar-sorot flex items-center justify-center text-teks-redup mb-3">
              <Sliders size={24} className="stroke-[1.75]" />
            </div>
            <p className="text-xs leading-relaxed max-w-[200px]">
              {t('panel.kosongParameter')}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
