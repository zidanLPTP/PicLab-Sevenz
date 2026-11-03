import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hitungHistogram } from '../mesin/utilitasCitra';

/**
 * Visualisasi histogram frekuensi piksel citra mandiri berbasis SVG murni.
 * Mendukung tampilan kanal Luminans, Merah, Hijau, Biru, serta perbandingan sebelum & sesudah.
 *
 * @param {object} props
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} props.citraSebelum
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} [props.citraSesudah]
 */
export default function HistogramCitra({ citraSebelum, citraSesudah }) {
  const { t } = useTranslation();
  const [terbuka, setTerbuka] = useState(true);
  const [kanalTerpilih, setKanalTerpilih] = useState('luminans'); // 'luminans', 'r', 'g', 'b'

  // Hitung histogram secara memoized
  const histSebelum = useMemo(() => {
    return citraSebelum ? hitungHistogram(citraSebelum) : null;
  }, [citraSebelum]);

  const histSesudah = useMemo(() => {
    if (!citraSesudah) return null;
    const tAwal = performance.now();
    const h = hitungHistogram(citraSesudah);
    if (typeof window !== 'undefined' && window.__catatanProfil) {
      window.__terakhirDurasiHistogram = performance.now() - tAwal;
    }
    return h;
  }, [citraSesudah]);

  // Mengubah data histogram 256 nilai ke titik-titik SVG path
  const buatJalurSvg = (dataHistogram, maks, lebar = 256, tinggi = 80) => {
    if (!dataHistogram || maks === 0) return '';
    let jalur = `M 0 ${tinggi}`;
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * lebar;
      const y = tinggi - (dataHistogram[i] / maks) * tinggi;
      jalur += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    jalur += ` L ${lebar} ${tinggi} Z`;
    return jalur;
  };

  const warnaKanal = {
    luminans: '#475569',
    r: '#dc2626',
    g: '#059669',
    b: '#2563eb',
  };

  const maksHistogram = Math.max(
    histSebelum?.nilaiMaksimum || 1,
    histSesudah?.nilaiMaksimum || 1
  );

  return (
    <div className="border border-garis-panel rounded-lg bg-white overflow-hidden text-xs shadow-xs">
      {/* Header Kolapsibel */}
      <button
        type="button"
        onClick={() => setTerbuka(!terbuka)}
        className="w-full p-2.5 flex items-center justify-between font-bold text-teks-sekunder hover:bg-slate-50 transition-colors cursor-pointer select-none"
        aria-expanded={terbuka}
      >
        <span className="font-semibold text-teks-utama">
          {t('panel.judulHistogram')}
        </span>
        {terbuka ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {terbuka && (
        <div className="p-3 border-t border-garis-panel space-y-3">
          {/* Tab Pemilih Kanal */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-[11px] font-medium">
            {[
              { id: 'luminans', label: 'Lum' },
              { id: 'r', label: 'R' },
              { id: 'g', label: 'G' },
              { id: 'b', label: 'B' },
            ].map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKanalTerpilih(k.id)}
                className={`flex-1 py-1 rounded transition-all cursor-pointer ${
                  kanalTerpilih === k.id
                    ? 'bg-white text-teks-utama font-bold shadow-xs'
                    : 'text-teks-redup hover:text-teks-utama'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          {/* Area Gambar Grafik Histogram SVG */}
          <div className="space-y-2">
            {/* Histogram Sebelum */}
            <div>
              <div className="flex justify-between text-[10px] text-teks-redup mb-1 font-semibold">
                <span>{t('kanvas.sebelum')}</span>
              </div>
              <div className="h-20 w-full bg-slate-50 border border-slate-200 rounded overflow-hidden">
                <svg
                  viewBox="0 0 256 80"
                  className="w-full h-full"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Visualisasi Histogram Citra Sebelum"
                >
                  <path
                    d={buatJalurSvg(
                      histSebelum?.[kanalTerpilih],
                      maksHistogram
                    )}
                    fill={warnaKanal[kanalTerpilih]}
                    fillOpacity="0.4"
                    stroke={warnaKanal[kanalTerpilih]}
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            </div>

            {/* Histogram Sesudah (Jika ada operasi) */}
            {histSesudah && (
              <div>
                <div className="flex justify-between text-[10px] text-teks-redup mb-1 font-semibold">
                  <span>{t('kanvas.sesudah')}</span>
                </div>
                <div className="h-20 w-full bg-slate-50 border border-slate-200 rounded overflow-hidden">
                  <svg
                    viewBox="0 0 256 80"
                    className="w-full h-full"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="Visualisasi Histogram Citra Sesudah"
                  >
                    <path
                      d={buatJalurSvg(
                        histSesudah?.[kanalTerpilih],
                        maksHistogram
                      )}
                      fill={warnaKanal[kanalTerpilih]}
                      fillOpacity="0.5"
                      stroke={warnaKanal[kanalTerpilih]}
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
