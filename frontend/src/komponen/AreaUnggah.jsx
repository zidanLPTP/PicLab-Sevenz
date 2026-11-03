import { AlertTriangle, FileImage, Loader2, UploadCloud } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BATASAN_BERKAS } from '../utilitas/konfigurasiBerkas';

/**
 * Komponen Area Unggah Citra (Keadaan Kosong Editor).
 * Mendukung seret-lepas (drag and drop), pilih berkas, dan penggunaan gambar contoh.
 */
export default function AreaUnggah({
  saatPilihBerkas,
  saatPilihContoh,
  sedangMemuat,
  pesanGalat,
  saatResetGalat,
}) {
  const { t } = useTranslation();
  const [sedangDrag, setSedangDrag] = useState(false);
  const inputBerkasRef = useRef(null);

  const tanganiDragOver = (e) => {
    e.preventDefault();
    setSedangDrag(true);
  };

  const tanganiDragLeave = (e) => {
    e.preventDefault();
    setSedangDrag(false);
  };

  const tanganiDrop = (e) => {
    e.preventDefault();
    setSedangDrag(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      saatPilihBerkas(e.dataTransfer.files[0]);
    }
  };

  const tanganiInputUbah = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      saatPilihBerkas(e.target.files[0]);
    }
  };

  return (
    <div className="flex-1 h-full bg-latar-kanvas flex items-center justify-center p-6 select-none">
      <div className="max-w-xl w-full">
        {/* Tampilan Galat Jika Validasi Gagal */}
        {pesanGalat && (
          <div
            className="mb-6 p-4 bg-latar-galat border border-red-200 rounded-lg text-status-galat shadow-sm animate-fade-in"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="font-bold">{t('galat.judul')}</p>
                <p className="mt-1 text-red-700">{pesanGalat}</p>
                <button
                  type="button"
                  onClick={saatResetGalat}
                  className="mt-3 text-xs font-semibold text-red-800 underline hover:text-red-900 cursor-pointer"
                >
                  {t('galat.tombolCobaLagi')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wadah Seret-Lepas / Unggah Utama */}
        <div
          onDragOver={tanganiDragOver}
          onDragLeave={tanganiDragLeave}
          onDrop={tanganiDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all bg-white ${
            sedangDrag
              ? 'border-primer bg-primer-lembut/60 scale-[1.01] shadow-md'
              : 'border-garis-panel hover:border-slate-300 shadow-sm'
          }`}
        >
          {/* Input Berkas Tersembunyi */}
          <input
            ref={inputBerkasRef}
            type="file"
            accept={BATASAN_BERKAS.EKSTENSI_DIIZINKAN.join(',')}
            onChange={tanganiInputUbah}
            className="hidden"
            id="input-citra-unggah"
          />

          {sedangMemuat ? (
            /* Keadaan Memuat Dekode */
            <div className="flex flex-col items-center justify-center py-6">
              <Loader2 size={36} className="text-primer animate-spin mb-3" />
              <p className="text-sm font-semibold text-teks-utama">
                {t('unggah.sedangMemuat')}
              </p>
            </div>
          ) : (
            /* Keadaan Kosong Normal */
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-primer mb-4">
                <UploadCloud size={32} className="stroke-[1.75]" />
              </div>

              <h2 className="text-lg font-bold text-teks-utama mb-1.5">
                {t('unggah.ajakan')}
              </h2>
              <p className="text-sm text-teks-redup mb-6 max-w-sm">
                {t('unggah.petunjukSeret')}
              </p>

              {/* Tombol Pilih Berkas */}
              <button
                type="button"
                onClick={() => inputBerkasRef.current?.click()}
                className="px-5 py-2.5 bg-primer hover:bg-primer-sorot text-white font-semibold text-sm rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-primer focus:ring-offset-2 focus:outline-none cursor-pointer mb-6"
              >
                {t('unggah.tombolPilih')}
              </button>

              {/* Info Batasan Format & Ukuran */}
              <p className="text-[11px] text-teks-redup border-t border-garis-panel pt-4 w-full">
                {t('unggah.infoBatas')}
              </p>

              {/* Tautan Opsi Gambar Contoh */}
              <div className="mt-5 pt-3 flex items-center justify-center gap-2 text-xs">
                <span className="text-teks-redup">{t('unggah.atauCoba')}</span>
                <button
                  type="button"
                  onClick={saatPilihContoh}
                  className="inline-flex items-center gap-1 font-bold text-primer hover:text-primer-sorot underline cursor-pointer"
                >
                  <FileImage size={14} className="stroke-[2]" />
                  <span>{t('unggah.tombolContoh')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
