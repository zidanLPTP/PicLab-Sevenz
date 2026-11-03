import {
  ArrowRight,
  Download,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
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
 * Bilah aksi kontrol kanvas (informasi berkas, dimensi sebelum->sesudah, ganti citra, unduh).
 */
export default function BilahAksiKanvas({
  metadata,
  dimensiSesudah,
  saatUnduh,
  saatGantiGambar,
  sedangMemprosesPenuh,
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
        {/* Nama Berkas (hanya tampil di UI) */}
        <div className="flex items-center gap-1.5 font-medium truncate max-w-[150px] sm:max-w-[200px]">
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

      {/* Kontrol Aksi: Ganti Gambar & Unduh */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Tombol Ganti / Unggah Ulang */}
        <button
          type="button"
          onClick={saatGantiGambar}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teks-sekunder hover:text-teks-utama bg-slate-100 hover:bg-slate-200 border border-garis-panel rounded-md transition-colors focus:ring-2 focus:ring-primer focus:outline-none cursor-pointer"
        >
          <RefreshCw size={14} className="stroke-[1.75]" />
          <span className="hidden sm:inline">{t('bilahAksi.tombolGanti')}</span>
        </button>

        {/* Pemilih Format Unduhan */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-garis-panel rounded-md px-2 py-1">
          <label htmlFor="pilih-format" className="text-teks-redup text-[11px]">
            {t('bilahAksi.formatUnduh')}
          </label>
          <select
            id="pilih-format"
            value={formatPilihan}
            onChange={(e) => setFormatPilihan(e.target.value)}
            className="bg-transparent text-xs font-bold text-teks-utama focus:outline-none cursor-pointer"
          >
            {BATASAN_BERKAS.FORMAT_UNDUHAN.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Tombol Unduh Resolusi Penuh */}
        <button
          type="button"
          onClick={tanganiKlikUnduh}
          disabled={sedangMemprosesPenuh}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-primer hover:bg-primer-sorot rounded-md transition-colors shadow-sm focus:ring-2 focus:ring-primer focus:ring-offset-1 focus:outline-none cursor-pointer disabled:opacity-50"
        >
          {sedangMemprosesPenuh ? (
            <Loader2 size={15} className="animate-spin stroke-[2]" />
          ) : (
            <Download size={15} className="stroke-[2]" />
          )}
          <span>{t('bilahAksi.tombolUnduh')}</span>
        </button>
      </div>
    </footer>
  );
}
