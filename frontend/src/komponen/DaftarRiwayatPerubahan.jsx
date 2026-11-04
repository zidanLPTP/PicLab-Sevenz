import { ChevronDown, ChevronRight, History } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Komponen Daftar Riwayat Perubahan (Undo/Redo Stack) PicLab Sevenz.
 * Mendukung lompatan langsung ke snapshot riwayat masa lalu/masa depan.
 * Dapat dilipat (collapsible) agar hemat ruang antarmuka.
 */
export default function DaftarRiwayatPerubahan({
  riwayat = [],
  indeksRiwayat = 0,
  saatLompatRiwayat,
}) {
  const { t } = useTranslation();
  const [terbuka, setTerbuka] = useState(false);

  return (
    <div className="border border-garis-panel rounded-lg overflow-hidden bg-latar-subtil">
      {/* Header Akordeon Riwayat */}
      <button
        type="button"
        onClick={() => setTerbuka(!terbuka)}
        className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-latar-kanvas/50 transition-colors cursor-pointer select-none"
        aria-expanded={terbuka}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-teks-utama">
          <History size={14} className="text-teks-sekunder" />
          <span>{t('riwayat.judul')}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-latar-kanvas text-teks-sekunder border border-garis-panel font-mono">
            {riwayat.length}
          </span>
        </div>
        {terbuka ? (
          <ChevronDown size={14} className="text-teks-redup" />
        ) : (
          <ChevronRight size={14} className="text-teks-redup" />
        )}
      </button>

      {/* Konten Daftar Riwayat yang Dapat Dilipat */}
      {terbuka && (
        <div className="p-2 border-t border-garis-panel space-y-1 max-h-48 overflow-y-auto">
          {riwayat.map((entri, idx) => {
            const aktifSaatIni = idx === indeksRiwayat;
            const labelTeks = entri.kunciLabel
              ? t(entri.kunciLabel, { defaultValue: entri.label })
              : entri.label;

            return (
              <button
                key={`riwayat_${idx}_${entri.waktu}`}
                type="button"
                onClick={() => saatLompatRiwayat(idx)}
                className={`w-full px-2.5 py-1.5 rounded text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  aktifSaatIni
                    ? 'bg-primer text-teks-terbalik font-bold shadow-sm'
                    : 'text-teks-sekunder hover:bg-latar-kanvas hover:text-teks-utama'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-mono text-[10px] opacity-75">
                    #{idx + 1}
                  </span>
                  <span className="truncate">{labelTeks}</span>
                </div>
                {aktifSaatIni && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-white/20 px-1 rounded ml-1 shrink-0">
                    {t('riwayat.entriAktif')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
