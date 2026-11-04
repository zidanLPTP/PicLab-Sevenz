import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Trash2,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dapatkanOperasiBerdasarkanId } from '../mesin/katalogOperasi';

/**
 * Komponen Rangkaian Operasi Pipeline PicLab Sevenz (spec.md Tahap 3).
 * Menyajikan daftar langkah operasi non-destruktif dengan kontrol urutan
 * drag-and-drop & tombol naik/turun ramah aksesibilitas keyboard (ARIA live).
 */
export default function DaftarLangkahPipeline({
  langkah = [],
  langkahTerpilihId = null,
  saatPilihLangkah,
  saatHapusLangkah,
  saatToggleAktif,
  saatPindahLangkah,
  saatKosongkanPipeline,
}) {
  const { t } = useTranslation();
  const [indeksSeret, setIndeksSeret] = useState(null);
  const [pesanAria, setPesanAria] = useState('');

  // Tangani drag and drop HTML5 murni
  const tanganiDragStart = (e, idx) => {
    setIndeksSeret(idx);
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
  };

  const tanganiDrop = (e, keIndeks) => {
    e.preventDefault();
    const dariIndeks = Number(e.dataTransfer.getData('text/plain'));
    if (!Number.isNaN(dariIndeks) && dariIndeks !== keIndeks) {
      saatPindahLangkah(dariIndeks, keIndeks);
      const op = dapatkanOperasiBerdasarkanId(langkah[dariIndeks]?.idOperasi);
      const nama = op ? t(op.kunciNama) : 'Langkah';
      setPesanAria(
        t('pipeline.pemberitahuanPindah', {
          nama,
          dari: dariIndeks + 1,
          ke: keIndeks + 1,
        })
      );
    }
    setIndeksSeret(null);
  };

  // Tangani perpindahan via tombol keyboard untuk aksesibilitas
  const tanganiGeserTombol = (e, dariIndeks, keIndeks) => {
    e.stopPropagation();
    if (keIndeks >= 0 && keIndeks < langkah.length) {
      saatPindahLangkah(dariIndeks, keIndeks);
      const op = dapatkanOperasiBerdasarkanId(langkah[dariIndeks]?.idOperasi);
      const nama = op ? t(op.kunciNama) : 'Langkah';
      setPesanAria(
        t('pipeline.pemberitahuanPindah', {
          nama,
          dari: dariIndeks + 1,
          ke: keIndeks + 1,
        })
      );
    }
  };

  return (
    <div className="space-y-3">
      {/* Pengumuman Aksesibilitas ARIA Live */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="aria-pengumuman-pipeline"
      >
        {pesanAria}
      </div>

      {/* Header Rangkaian */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teks-sekunder">
          <Layers size={13} />
          <span>{t('pipeline.judul')}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-latar-subtil text-teks-sekunder border border-garis-panel font-mono">
            {langkah.length}/30
          </span>
        </div>

        {langkah.length > 0 && (
          <button
            type="button"
            onClick={saatKosongkanPipeline}
            className="text-[11px] font-semibold text-teks-bahaya hover:underline cursor-pointer flex items-center gap-1"
            title={t('pipeline.resetSemua')}
          >
            <Trash2 size={11} />
            <span>{t('pipeline.resetSemua')}</span>
          </button>
        )}
      </div>

      {/* Keadaan Kosong (Empty State) */}
      {langkah.length === 0 ? (
        <div className="p-4 bg-latar-subtil border border-dashed border-garis-panel rounded-lg text-center space-y-2">
          <div className="w-8 h-8 rounded-full bg-latar-panel border border-garis-panel flex items-center justify-center mx-auto text-teks-redup">
            <Layers size={16} />
          </div>
          <p className="text-xs text-teks-sekunder leading-relaxed">
            {t('pipeline.kosong')}
          </p>
        </div>
      ) : (
        /* Daftar Langkah Terisi */
        <div
          className="space-y-1.5"
          role="list"
          aria-label={t('pipeline.judul')}
        >
          {langkah.map((item, idx) => {
            const op = dapatkanOperasiBerdasarkanId(item.idOperasi);
            const namaOp = op ? t(op.kunciNama) : item.idOperasi;
            const terpilih = item.id === langkahTerpilihId;
            const sedangDiseret = indeksSeret === idx;

            return (
              <div
                key={item.id}
                role="listitem"
                draggable
                onDragStart={(e) => tanganiDragStart(e, idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => tanganiDrop(e, idx)}
                onClick={() => saatPilihLangkah(item.id)}
                className={`group flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer select-none ${
                  terpilih
                    ? 'border-primer bg-primer/5 ring-1 ring-primer shadow-xs'
                    : 'border-garis-panel bg-latar-subtil hover:border-teks-redup'
                } ${!item.aktif ? 'opacity-60 bg-latar-panel/40' : ''} ${
                  sedangDiseret ? 'opacity-40 border-dashed border-primer' : ''
                }`}
              >
                {/* Gagang Seret / Nomor Urut */}
                <div
                  className="flex items-center text-teks-redup group-hover:text-teks-sekunder cursor-grab"
                  title="Seret untuk mengubah urutan"
                >
                  <GripVertical size={14} className="shrink-0" />
                  <span className="font-mono text-[11px] font-bold w-4 text-center">
                    {idx + 1}
                  </span>
                </div>

                {/* Nama Operasi */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-teks-utama truncate">
                    {namaOp}
                  </div>
                  {!item.aktif && (
                    <span className="text-[10px] text-teks-redup italic">
                      ({t('pipeline.nonaktif')})
                    </span>
                  )}
                </div>

                {/* Tombol Aksi: Sakelar Aktif, Naik, Turun, Hapus */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Sakelar Aktif/Nonaktif */}
                  <button
                    type="button"
                    data-testid="tombol-toggle-langkah"
                    onClick={(e) => {
                      e.stopPropagation();
                      saatToggleAktif(item.id);
                    }}
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      item.aktif
                        ? 'text-primer hover:bg-primer/10'
                        : 'text-teks-redup hover:bg-latar-kanvas'
                    }`}
                    title={
                      item.aktif ? t('pipeline.nonaktif') : t('pipeline.aktif')
                    }
                    aria-label={`${item.aktif ? t('pipeline.nonaktif') : t('pipeline.aktif')} ${namaOp}`}
                  >
                    {item.aktif ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>

                  {/* Tombol Naik (Keyboard Accessible) */}
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={(e) => tanganiGeserTombol(e, idx, idx - 1)}
                    className="p-1 rounded text-teks-redup hover:text-teks-utama hover:bg-latar-kanvas disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    title={t('pipeline.naik')}
                    aria-label={`${t('pipeline.naik')} ${namaOp}`}
                  >
                    <ChevronUp size={13} />
                  </button>

                  {/* Tombol Turun (Keyboard Accessible) */}
                  <button
                    type="button"
                    disabled={idx === langkah.length - 1}
                    onClick={(e) => tanganiGeserTombol(e, idx, idx + 1)}
                    className="p-1 rounded text-teks-redup hover:text-teks-utama hover:bg-latar-kanvas disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    title={t('pipeline.turun')}
                    aria-label={`${t('pipeline.turun')} ${namaOp}`}
                  >
                    <ChevronDown size={13} />
                  </button>

                  {/* Tombol Hapus */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      saatHapusLangkah(item.id);
                    }}
                    className="p-1 rounded text-teks-redup hover:text-teks-bahaya hover:bg-latar-bahaya transition-colors cursor-pointer"
                    title={t('pipeline.hapus')}
                    aria-label={`${t('pipeline.hapus')} ${namaOp}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
