import { BookOpen, Globe, Info, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ModalPrivasi from './ModalPrivasi';

/**
 * Bilah navigasi atas PicLab Sevenz.
 */
export default function BilahAtas() {
  const { t, i18n } = useTranslation();
  const [modalPrivasiTerbuka, setModalPrivasiTerbuka] = useState(false);

  function ubahBahasa(bahasa) {
    i18n.changeLanguage(bahasa);
  }

  const bahasaSaatIni = i18n.language || 'id';

  return (
    <>
      <header className="h-14 border-b border-garis-panel bg-latar-panel px-4 flex items-center justify-between shrink-0 shadow-panel select-none">
        {/* Identitas Logo & Judul */}
        <div className="flex items-center gap-3">
          <img
            src="/logo-piclab.svg"
            alt="Logo PicLab Sevenz"
            className="h-8 w-auto"
          />
          <span className="hidden md:inline-block text-xs font-medium text-teks-redup border-l border-garis-panel pl-3">
            {t('navigasi.deskripsiAplikasi')}
          </span>
        </div>

        {/* Menu Navigasi & Kontrol Kanan */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Tautan Belajar (Nonaktif dengan keterangan jujur) */}
          <div className="relative group">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teks-redup bg-slate-50 border border-garis-panel rounded-md cursor-not-allowed opacity-75"
            >
              <BookOpen size={16} className="stroke-[1.75]" />
              <span>{t('navigasi.tautanBelajar')}</span>
            </button>
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover:flex items-center gap-1 bg-slate-800 text-white text-[11px] px-2.5 py-1 rounded shadow-md whitespace-nowrap z-30 pointer-events-none">
              <Info size={12} />
              <span>{t('navigasi.keteranganBelajar')}</span>
            </div>
          </div>

          {/* Tautan Privasi (Membuka dialog) */}
          <button
            type="button"
            onClick={() => setModalPrivasiTerbuka(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teks-sekunder hover:text-primer hover:bg-slate-50 border border-transparent hover:border-garis-panel rounded-md transition-colors focus:ring-2 focus:ring-primer focus:outline-none cursor-pointer"
          >
            <ShieldCheck size={16} className="stroke-[1.75]" />
            <span>{t('navigasi.tautanPrivasi')}</span>
          </button>

          {/* Pemilih Bahasa (ID / EN) */}
          <div
            className="flex items-center bg-slate-100 p-0.5 rounded-md border border-garis-panel text-xs"
            role="group"
            aria-label={t('navigasi.pilihBahasa')}
          >
            <Globe
              size={14}
              className="ml-1.5 mr-1 text-teks-redup stroke-[1.75]"
            />
            <button
              type="button"
              onClick={() => ubahBahasa('id')}
              className={`px-2 py-1 rounded font-medium transition-all cursor-pointer ${
                bahasaSaatIni === 'id'
                  ? 'bg-white text-primer font-bold shadow-sm'
                  : 'text-teks-redup hover:text-teks-utama'
              }`}
              aria-pressed={bahasaSaatIni === 'id'}
            >
              ID
            </button>
            <button
              type="button"
              onClick={() => ubahBahasa('en')}
              className={`px-2 py-1 rounded font-medium transition-all cursor-pointer ${
                bahasaSaatIni === 'en'
                  ? 'bg-white text-primer font-bold shadow-sm'
                  : 'text-teks-redup hover:text-teks-utama'
              }`}
              aria-pressed={bahasaSaatIni === 'en'}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {/* Modal Dialog Privasi */}
      <ModalPrivasi
        terbuka={modalPrivasiTerbuka}
        saatTutup={() => setModalPrivasiTerbuka(false)}
      />
    </>
  );
}
