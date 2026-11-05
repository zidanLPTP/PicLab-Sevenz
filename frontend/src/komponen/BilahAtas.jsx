import {
  BookOpen,
  Globe,
  Info,
  Loader2,
  Server,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ModalPrivasi from './ModalPrivasi';

/**
 * Bilah navigasi atas PicLab Sevenz.
 * Menampilkan identitas, status server backend, akses dialog privasi, panduan belajar, dan pemilih bahasa.
 */
export default function BilahAtas({ statusServerHook = null }) {
  const { t, i18n } = useTranslation();
  const [modalPrivasiTerbuka, setModalPrivasiTerbuka] = useState(false);
  const tombolPrivasiRef = useRef(null);

  function ubahBahasa(bahasa) {
    i18n.changeLanguage(bahasa);
  }

  const bahasaSaatIni = i18n.language || 'id';

  const status = statusServerHook?.statusServer || 'tidak_tersedia';
  const apakahTersedia = status === 'tersedia';
  const apakahMemeriksa = status === 'memeriksa';

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
          {/* Indikator Status Server Backend (Tahap 5) */}
          <div className="relative group">
            <button
              type="button"
              data-testid="indikator-status-server"
              data-status={status}
              onClick={() => statusServerHook?.periksaManual?.()}
              aria-label={`${t('statusServer.judul')}: ${t(
                apakahMemeriksa
                  ? 'statusServer.memeriksa'
                  : apakahTersedia
                    ? 'statusServer.tersedia'
                    : 'statusServer.tidakTersedia'
              )}`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-md transition-colors cursor-pointer focus:ring-2 focus:ring-primer focus:outline-none ${
                apakahMemeriksa
                  ? 'bg-latar-subtil text-teks-redup border-garis-panel'
                  : apakahTersedia
                    ? 'bg-primer-lembut text-teks-primer border-garis-primer hover:bg-latar-subtil'
                    : 'bg-latar-galat text-teks-galat border-garis-galat hover:bg-latar-subtil'
              }`}
            >
              {apakahMemeriksa ? (
                <Loader2 size={14} className="animate-spin text-teks-redup" />
              ) : apakahTersedia ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-sukses opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-status-sukses" />
                  </span>
                  <Server size={14} className="stroke-[1.75]" />
                </>
              ) : (
                <>
                  <span className="inline-flex rounded-full h-2 w-2 bg-status-galat" />
                  <WifiOff size={14} className="stroke-[1.75]" />
                </>
              )}
              <span className="hidden sm:inline font-semibold">
                {t(
                  apakahMemeriksa
                    ? 'statusServer.memeriksa'
                    : apakahTersedia
                      ? 'statusServer.tersedia'
                      : 'statusServer.tidakTersedia'
                )}
              </span>
            </button>

            {/* Tooltip Keterangan Status Server */}
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover:flex flex-col gap-1 bg-latar-gelap text-teks-terbalik text-[11px] p-2 rounded shadow-lg whitespace-nowrap z-30 pointer-events-none">
              <div className="font-semibold flex items-center gap-1">
                <span>{t('statusServer.judul')}:</span>
                <span
                  className={
                    apakahTersedia ? 'text-garis-primer' : 'text-garis-galat'
                  }
                >
                  {t(
                    apakahMemeriksa
                      ? 'statusServer.memeriksa'
                      : apakahTersedia
                        ? 'statusServer.tersedia'
                        : 'statusServer.tidakTersedia'
                  )}
                </span>
              </div>
              <p className="text-teks-redup text-[10px] max-w-xs whitespace-normal">
                {t(
                  apakahMemeriksa
                    ? 'statusServer.keteranganMemeriksa'
                    : apakahTersedia
                      ? 'statusServer.keteranganTersedia'
                      : 'statusServer.keteranganTidakTersedia'
                )}
              </p>
              <span className="text-[9px] text-teks-redup pt-0.5 border-t border-garis-subtil/30">
                {t('statusServer.tombolPeriksa')}
              </span>
            </div>
          </div>

          {/* Tautan Belajar (Nonaktif dengan keterangan jujur dan ramah pengguna) */}
          <div className="relative group">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teks-redup bg-latar-subtil border border-garis-panel rounded-md cursor-not-allowed opacity-75"
            >
              <BookOpen size={16} className="stroke-[1.75]" />
              <span>{t('navigasi.tautanBelajar')}</span>
            </button>
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover:flex items-center gap-1 bg-latar-gelap text-teks-terbalik text-[11px] px-2.5 py-1 rounded shadow-md whitespace-nowrap z-30 pointer-events-none">
              <Info size={12} />
              <span>{t('navigasi.keteranganBelajar')}</span>
            </div>
          </div>

          {/* Tautan Privasi (Membuka dialog) */}
          <button
            ref={tombolPrivasiRef}
            type="button"
            onClick={() => setModalPrivasiTerbuka(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teks-sekunder hover:text-primer hover:bg-latar-subtil border border-transparent hover:border-garis-panel rounded-md transition-colors focus:ring-2 focus:ring-primer focus:outline-none cursor-pointer"
          >
            <ShieldCheck size={16} className="stroke-[1.75]" />
            <span>{t('navigasi.tautanPrivasi')}</span>
          </button>

          {/* Pemilih Bahasa (ID / EN) */}
          <div
            className="flex items-center bg-latar-sorot p-0.5 rounded-md border border-garis-panel text-xs"
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
                  ? 'bg-latar-panel text-primer font-bold shadow-sm'
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
                  ? 'bg-latar-panel text-primer font-bold shadow-sm'
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
        elemenPemicuRef={tombolPrivasiRef}
      />
    </>
  );
}
