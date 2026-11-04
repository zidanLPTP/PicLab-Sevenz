import { Search, Sparkles } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  dapatkanSemuaOperasi,
  KATEGORI_OPERASI,
} from '../mesin/katalogOperasi';

/**
 * Panel Kiri Editor: Katalog Operasi Citra Berdasarkan Kategori.
 * Dilengkapi fitur pencarian nama operasi ramah awam.
 */
export default function PanelOperasi({ operasiAktif, saatPilihOperasi }) {
  const { t } = useTranslation();
  const [kataKunci, setKataKunci] = useState('');

  const semuaOperasi = useMemo(() => dapatkanSemuaOperasi(), []);

  // Filter operasi berdasarkan kata kunci pencarian
  const operasiTersaring = useMemo(() => {
    if (!kataKunci.trim()) return semuaOperasi;
    const q = kataKunci.toLowerCase();
    return semuaOperasi.filter((op) => {
      const nama = t(op.kunciNama).toLowerCase();
      const deskripsi = t(op.kunciDeskripsi).toLowerCase();
      const teknis = (op.namaTeknis || '').toLowerCase();
      return nama.includes(q) || deskripsi.includes(q) || teknis.includes(q);
    });
  }, [semuaOperasi, kataKunci, t]);

  return (
    <aside
      className="w-72 shrink-0 border-r border-garis-panel bg-latar-panel flex flex-col h-full overflow-hidden select-none"
      aria-label={t('panel.judulOperasi')}
    >
      {/* Header & Kotak Pencarian */}
      <div className="p-3.5 border-b border-garis-panel space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-teks-sekunder">
            {t('panel.judulOperasi')}
          </h2>
          <span className="text-[11px] font-semibold px-2 py-0.5 bg-latar-sorot text-teks-redup rounded-full">
            {semuaOperasi.length}
          </span>
        </div>

        {/* Input Pencarian */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-teks-redup stroke-[1.75]"
          />
          <input
            type="text"
            value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
            placeholder={t('panel.cariOperasiPlaceholder')}
            className="w-full pl-8 pr-3 py-1.5 bg-latar-subtil border border-garis-panel rounded-md text-xs text-teks-utama placeholder:text-teks-redup focus:outline-none focus:ring-2 focus:ring-primer focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Daftar Operasi Berkelompok */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {KATEGORI_OPERASI.map((kat) => {
          const opsDalamKategori = operasiTersaring.filter(
            (op) => op.kategori === kat.id
          );
          if (opsDalamKategori.length === 0) return null;

          return (
            <div key={kat.id} className="space-y-1">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-teks-redup px-2 py-1">
                {t(kat.kunciLabel)}
              </h3>
              <div className="space-y-1">
                {opsDalamKategori.map((op) => {
                  const apakahAktif = operasiAktif?.id === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => saatPilihOperasi(op)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-between border ${
                        apakahAktif
                          ? 'bg-primer-lembut border-primer text-primer font-bold shadow-xs'
                          : 'bg-transparent border-transparent hover:bg-latar-sorot text-teks-utama'
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-semibold truncate">
                          {t(op.kunciNama)}
                        </div>
                        <div className="text-[10px] text-teks-redup truncate mt-0.5">
                          {t(op.kunciDeskripsi)}
                        </div>
                      </div>
                      {apakahAktif && (
                        <Sparkles
                          size={14}
                          className="shrink-0 text-primer ml-1 stroke-[2]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {operasiTersaring.length === 0 && (
          <div className="py-8 text-center text-teks-redup text-xs">
            <p>Tidak ada operasi yang cocok dengan kata kunci.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
