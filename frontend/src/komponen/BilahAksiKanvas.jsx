import {
  ArrowRight,
  Download,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  Redo2,
  RefreshCw,
  Undo2,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BATASAN_BERKAS } from '../utilitas/konfigurasiBerkas';

/**
 * Memformat ukuran byte ke satuan yang mudah dibaca (KB / MB).
 */
function formatUkuran(byte) {
  if (!byte) return '0 B';
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(1)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Bilah aksi kontrol kanvas (informasi berkas, dimensi, Undo/Redo, ganti citra, unduh).
 */
export default function BilahAksiKanvas({
  metadata,
  dimensiSesudah,
  saatUnduh,
  saatGantiGambar,
  sedangMemprosesPenuh,
  bisaUndo = false,
  bisaRedo = false,
  saatUndo,
  saatRedo,
}) {
  const { t } = useTranslation();
  const [formatPilihan, setFormatPilihan] = useState(
    BATASAN_BERKAS.FORMAT_UNDUHAN_DEFAULT
  );

  const dimensiBerubah =
    dimensiSesudah &&
    (dimensiSesudah.width !== metadata?.lebar ||
      dimensiSesudah.height !== metadata?.tinggi);

  const tanganiKlikUnduh = () => {
    saatUnduh(formatPilihan);
  };

  return (
    <footer className="h-14 border-t border-garis-panel bg-latar-panel px-4 flex items-center justify-between shrink-0 select-none text-xs">
      {/* Informasi Metadata Citra */}
      <div className="flex items-center gap-3 sm:gap-5 text-teks-sekunder overflow-hidden">
        {/* Nama Berkas */}
        <div className="flex items-center gap-1.5 font-medium truncate max-w-[130px] sm:max-w-[180px]">
          <ImageIcon size={15} className="text-primer shrink-0 stroke-[1.75]" />
          <span className="truncate" title={metadata?.nama}>
            {metadata?.nama}
          </span>
        </div>

        {/* Dimensi (Sebelum -> Sesudah jika dimensi berubah) */}
        <div className="hidden sm:flex items-center gap-1.5 text-teks-redup font-mono">
          <span className="text-teks-utama font-semibold">
            {metadata?.lebar} × {metadata?.tinggi}
          </span>
          {dimensiBerubah && (
            <>
              <ArrowRight size={12} className="text-primer shrink-0" />
              <span className="text-primer font-bold">
                {dimensiSesudah.width} × {dimensiSesudah.height}
              </span>
            </>
          )}
          <span>px</span>
        </div>

        {/* Ukuran Berkas */}
        <div className="hidden md:flex items-center gap-1 text-teks-redup">
          <HardDrive size={13} className="shrink-0" />
          <span>{formatUkuran(metadata?.ukuranByte)}</span>
        </div>
      </div>

      {/* Kontrol Aksi: Undo/Redo & Ganti Gambar & Unduh */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Kontrol Undo & Redo (Tahap 3) */}
        <div className="flex items-center gap-0.5 border-r border-garis-panel pr-2 sm:pr-3">
          <button
            type="button"
            onClick={saatUndo}
            disabled={!bisaUndo}
            className="p-1.5 rounded-md text-teks-sekunder hover:text-teks-utama hover:bg-latar-sorot disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title={`${t('bilahAksi.undo')} (Ctrl+Z)`}
            aria-label={t('bilahAksi.undo')}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            onClick={saatRedo}
            disabled={!bisaRedo}
            className="p-1.5 rounded-md text-teks-sekunder hover:text-teks-utama hover:bg-latar-sorot disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title={`${t('bilahAksi.redo')} (Ctrl+Shift+Z)`}
            aria-label={t('bilahAksi.redo')}
          >
            <Redo2 size={16} />
          </button>
        </div>

        {/* Tombol Ganti / Unggah Ulang */}
        <button
          type="button"
          onClick={saatGantiGambar}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-teks-sekunder hover:text-teks-utama bg-latar-sorot hover:bg-latar-sorot-sedang border border-garis-panel rounded-md transition-colors focus:ring-2 focus:ring-primer focus:outline-none cursor-pointer"
        >
          <RefreshCw size={14} className="stroke-[1.75]" />
          <span className="hidden sm:inline">{t('bilahAksi.tombolGanti')}</span>
        </button>

        {/* Pemilih Format Unduhan */}
        <div className="hidden sm:flex items-center gap-1.5 bg-latar-subtil border border-garis-panel rounded-md px-2 py-1">
          <label htmlFor="pilih-format" className="text-teks-redup text-[11px]">
            {t('bilahAksi.formatUnduh')}
          </label>
          <select
            id="pilih-format"
            value={formatPilihan}
            onChange={(e) => setFormatPilihan(e.target.value)}
            className="bg-transparent text-teks-utama font-semibold text-xs focus:outline-none cursor-pointer"
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPG</option>
            <option value="webp">WebP</option>
          </select>
        </div>

        {/* Tombol Unduh */}
        <button
          type="button"
          onClick={tanganiKlikUnduh}
          disabled={sedangMemprosesPenuh}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs font-bold text-teks-terbalik bg-primer hover:bg-primer-sorot rounded-md shadow-xs transition-colors focus:ring-2 focus:ring-primer focus:ring-offset-1 focus:outline-none cursor-pointer disabled:opacity-60"
        >
          {sedangMemprosesPenuh ? (
            <>
              <Loader2 size={14} className="animate-spin stroke-[2.25]" />
              <span className="hidden sm:inline">Memproses...</span>
            </>
          ) : (
            <>
              <Download size={14} className="stroke-[2.25]" />
              <span>{t('bilahAksi.tombolUnduh')}</span>
            </>
          )}
        </button>
      </div>
    </footer>
  );
}
