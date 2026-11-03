import { ShieldCheck, X } from 'lucide-react';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Modal dialog informasi privasi dan transparansi pemrosesan citra PicLab Sevenz.
 */
export default function ModalPrivasi({ terbuka, saatTutup }) {
  const { t } = useTranslation();

  // Menutup modal dengan tombol Escape
  useEffect(() => {
    function tanganiKeyDown(e) {
      if (e.key === 'Escape' && terbuka) {
        saatTutup();
      }
    }
    window.addEventListener('keydown', tanganiKeyDown);
    return () => window.removeEventListener('keydown', tanganiKeyDown);
  }, [terbuka, saatTutup]);

  if (!terbuka) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-modal-privasi"
      onClick={saatTutup}
    >
      <div
        className="w-full max-w-lg bg-latar-panel rounded-xl shadow-xl border border-garis-panel p-6 overflow-hidden text-teks-utama focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-garis-panel mb-4">
          <div className="flex items-center gap-2 text-primer">
            <ShieldCheck size={22} className="stroke-[1.75]" />
            <h2
              id="judul-modal-privasi"
              className="text-lg font-bold text-teks-utama"
            >
              {t('privasi.judul')}
            </h2>
          </div>
          <button
            type="button"
            onClick={saatTutup}
            aria-label="Tutup"
            className="p-1 rounded-md text-teks-redup hover:text-teks-utama hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-primer focus:outline-none"
          >
            <X size={20} className="stroke-[1.75]" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-teks-sekunder leading-relaxed mb-6">
          <div className="p-3 bg-primer-lembut border border-teal-200 rounded-lg text-teal-900">
            <p className="font-medium">{t('privasi.poin1')}</p>
          </div>
          <p>{t('privasi.poin2')}</p>
          <p>{t('privasi.poin3')}</p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={saatTutup}
            className="px-4 py-2 bg-primer hover:bg-primer-sorot text-white font-medium text-sm rounded-md transition-colors shadow-sm focus:ring-2 focus:ring-primer focus:ring-offset-2 focus:outline-none cursor-pointer"
          >
            {t('privasi.tombolTutup')}
          </button>
        </div>
      </div>
    </div>
  );
}
