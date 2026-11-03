import {
  Download,
  HardDrive,
  Image as ImageIcon,
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
 * Bilah aksi kontrol kanvas (informasi berkas, ganti citra, unduh).
 */
export default function BilahAksiKanvas({
  metadata,
  elemenCitra,
  saatGantiGambar,
}) {
  const { t } = useTranslation();
  const [formatPilihan, setFormatPilihan] = useState(
    BATASAN_BERKAS.FORMAT_UNDUHAN_DEFAULT
  );
  const [sedangMengunduh, setSedangMengunduh] = useState(false);

  // Fungsi unduh resolusi penuh menggunakan kanvas murni
  const unduhCitra = () => {
    if (!elemenCitra) return;
    setSedangMengunduh(true);

    try {
      const kanvas = document.createElement('canvas');
      kanvas.width = elemenCitra.naturalWidth;
      kanvas.height = elemenCitra.naturalHeight;
      const ctx = kanvas.getContext('2d');
      ctx.drawImage(elemenCitra, 0, 0);

      const mimeType =
        formatPilihan === 'jpeg' ? 'image/jpeg' : `image/${formatPilihan}`;

      kanvas.toBlob(
        (blob) => {
          if (!blob) {
            setSedangMengunduh(false);
            return;
          }
          const urlUnduhan = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const namaDasar = metadata?.nama
            ? metadata.nama.replace(/\.[^/.]+$/, '')
            : 'piclab-hasil';
          link.download = `${namaDasar}-piclab.${formatPilihan}`;
          link.href = urlUnduhan;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(urlUnduhan);
          setSedangMengunduh(false);
        },
        mimeType,
        formatPilihan === 'jpeg' || formatPilihan === 'webp' ? 0.95 : undefined
      );
    } catch {
      setSedangMengunduh(false);
    }
  };

  return (
    <footer className="h-14 border-t border-garis-panel bg-latar-panel px-4 flex items-center justify-between shrink-0 select-none text-xs">
      {/* Informasi Metadata Citra */}
      <div className="flex items-center gap-3 sm:gap-5 text-teks-sekunder overflow-hidden">
        {/* Nama Berkas (hanya tampil di UI) */}
        <div className="flex items-center gap-1.5 font-medium truncate max-w-[160px] sm:max-w-[220px]">
          <ImageIcon size={15} className="text-primer shrink-0 stroke-[1.75]" />
          <span className="truncate" title={metadata?.nama}>
            {metadata?.nama}
          </span>
        </div>

        {/* Dimensi */}
        <div className="hidden sm:flex items-center gap-1 text-teks-redup">
          <span className="font-semibold text-teks-utama">
            {metadata?.lebar} × {metadata?.tinggi}
          </span>
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
          onClick={unduhCitra}
          disabled={sedangMengunduh}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-primer hover:bg-primer-sorot rounded-md transition-colors shadow-sm focus:ring-2 focus:ring-primer focus:ring-offset-1 focus:outline-none cursor-pointer disabled:opacity-50"
        >
          <Download size={15} className="stroke-[2]" />
          <span>{t('bilahAksi.tombolUnduh')}</span>
        </button>
      </div>
    </footer>
  );
}
