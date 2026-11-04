import { BookOpen, ChevronDown, ChevronUp, Code2, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Kartu Belajar Operasi Citra (spec.md bagian 5 & Tahap 4).
 * Panel lipat (collapsible, default tertutup) di bilah kanan yang menyajikan:
 * - Nama teknis akademis
 * - Tujuan & kapan operasi ini dipakai
 * - Rumus matematika inti (notasi Unicode murni tanpa pustaka berat eksternal)
 * - Penjelasan parameter operasi
 */
export default function KartuBelajarOperasi({ operasi }) {
  const { t, i18n } = useTranslation();
  const [terbuka, setTerbuka] = useState(false);

  if (!operasi) return null;

  const idOperasi = operasi.id;
  const kunciAkar = `belajar.${idOperasi}`;

  const namaTeknis = operasi.namaTeknis || t(operasi.kunciNama);
  const tujuan = t(`${kunciAkar}.tujuan`, {
    defaultValue: t(operasi.kunciDeskripsi),
  });
  const rumus = t(`${kunciAkar}.rumus`, {
    defaultValue: '',
  });
  const penjelasanRumus = t(`${kunciAkar}.penjelasanRumus`, {
    defaultValue: '',
  });

  return (
    <div
      className="border border-garis-panel rounded-lg overflow-hidden bg-latar-subtil/50 transition-all"
      data-testid="kartu-belajar-operasi"
    >
      {/* Header Tombol Lipat */}
      <button
        type="button"
        onClick={() => setTerbuka(!terbuka)}
        aria-expanded={terbuka}
        aria-controls={`konten-belajar-${idOperasi}`}
        className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-latar-sorot transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-primer stroke-[2]" />
          <span className="text-xs font-bold text-teks-utama">
            {t('belajar.judulKartu')}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-teks-redup">
          <span>{terbuka ? t('belajar.tutup') : t('belajar.buka')}</span>
          {terbuka ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Konten Belajar Terlipat */}
      {terbuka && (
        <div
          id={`konten-belajar-${idOperasi}`}
          className="p-3 border-t border-garis-panel space-y-3 text-xs bg-white"
        >
          {/* 1. Nama Teknis & Konsep Akademis */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-teks-redup">
              {t('belajar.labelNamaTeknis')}
            </div>
            <div className="font-mono text-xs font-semibold text-teks-utama bg-latar-subtil px-2 py-1 rounded border border-garis-panel/70">
              {namaTeknis}
            </div>
          </div>

          {/* 2. Tujuan & Kapan Digunakan */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-teks-redup">
              {t('belajar.labelTujuan')}
            </div>
            <p className="text-teks-sekunder text-xs leading-relaxed">
              {tujuan}
            </p>
          </div>

          {/* 3. Rumus Matematika Inti (Unicode Murni) */}
          {rumus && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-teks-redup">
                {t('belajar.labelRumus')}
              </div>
              <div className="p-2 bg-latar-subtil/80 rounded border border-garis-panel font-mono text-[11px] text-teks-utama overflow-x-auto whitespace-pre-wrap select-all">
                {rumus}
              </div>
              {penjelasanRumus && (
                <p className="text-[11px] text-teks-redup leading-relaxed mt-1">
                  {penjelasanRumus}
                </p>
              )}
            </div>
          )}

          {/* 4. Arti Parameter */}
          {operasi.skemaParameter && operasi.skemaParameter.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-garis-panel/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-teks-redup">
                {t('belajar.labelParameter')}
              </div>
              <ul className="space-y-1 text-[11px]">
                {operasi.skemaParameter.map((sk) => {
                  const arti = t(`${kunciAkar}.parameter.${sk.id}`, {
                    defaultValue: `${t(sk.kunciLabel)} (${sk.tipe}${
                      sk.min !== undefined ? `, [${sk.min}..${sk.max}]` : ''
                    })`,
                  });
                  return (
                    <li key={sk.id} className="text-teks-sekunder">
                      <span className="font-semibold text-teks-utama font-mono">
                        {sk.id}
                      </span>
                      : {arti}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
