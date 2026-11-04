import { ShieldCheck, X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Modal dialog informasi privasi dan transparansi pemrosesan citra PicLab Sevenz.
 * Memenuhi spesifikasi WAI-ARIA Dialog (Modal):
 * - role="dialog", aria-modal="true", aria-labelledby
 * - Menutup dengan tombol Escape
 * - Penguncian fokus (focus trap) di dalam dialog
 * - Mengembalikan fokus ke elemen pemicu saat dialog ditutup
 */
export default function ModalPrivasi({ terbuka, saatTutup, elemenPemicuRef }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const tombolTutupAtasRef = useRef(null);
  const elemenTerfokusSebelumnyaRef = useRef(null);

  useEffect(() => {
    if (terbuka) {
      // Simpan elemen yang aktif sebelum modal dibuka
      elemenTerfokusSebelumnyaRef.current =
        elemenPemicuRef?.current || document.activeElement;

      // Fokuskan elemen pertama yang dapat diinteraksi di modal
      const timer = setTimeout(() => {
        tombolTutupAtasRef.current?.focus();
      }, 50);

      // Handler keyboard: Escape untuk menutup, Tab untuk focus trap
      const tanganiKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          saatTutup();
          return;
        }

        if (e.key === 'Tab' && dialogRef.current) {
          const elemenFokus = dialogRef.current.querySelectorAll(
            'button:not([disabled]), [tabindex="0"], a[href]'
          );
          if (elemenFokus.length === 0) return;

          const pertama = elemenFokus[0];
          const terakhir = elemenFokus[elemenFokus.length - 1];

          if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === pertama) {
              e.preventDefault();
              terakhir.focus();
            }
          } else {
            // Tab biasa
            if (document.activeElement === terakhir) {
              e.preventDefault();
              pertama.focus();
            }
          }
        }
      };

      window.addEventListener('keydown', tanganiKeyDown);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', tanganiKeyDown);
        // Kembalikan fokus ke elemen pemicu saat ditutup
        if (elemenTerfokusSebelumnyaRef.current) {
          elemenTerfokusSebelumnyaRef.current.focus?.();
        }
      };
    }
  }, [terbuka, saatTutup, elemenPemicuRef]);

  if (!terbuka) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-latar-overlay backdrop-blur-xs p-4 animate-fade-in"
      onClick={saatTutup}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-modal-privasi"
        tabIndex={-1}
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
            ref={tombolTutupAtasRef}
            type="button"
            onClick={saatTutup}
            aria-label="Tutup"
            className="p-1 rounded-md text-teks-redup hover:text-teks-utama hover:bg-latar-sorot transition-colors focus:ring-2 focus:ring-primer focus:outline-none cursor-pointer"
          >
            <X size={20} className="stroke-[1.75]" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-teks-sekunder leading-relaxed mb-6">
          <div className="p-3 bg-primer-lembut border border-garis-primer rounded-lg text-teks-primer-gelap">
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
