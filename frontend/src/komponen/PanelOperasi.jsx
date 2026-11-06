import { Plus, Search, Server, Sparkles, Wand2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  dapatkanSemuaOperasi,
  KATEGORI_OPERASI,
} from '../mesin/katalogOperasi';
import { DAFTAR_PRESET } from '../mesin/preset';
import { KONFIGURASI_PIPELINE } from '../utilitas/konfigurasiPipeline';

/**
 * Panel Kiri Editor: Katalog Operasi Citra Berdasarkan Kategori & Preset Awal.
 * Dilengkapi fitur penambahan ke pipeline dan preset komposisi non-destruktif.
 * Mendukung graceful degradation: operasi berlabel lokasi 'server' otomatis dinonaktifkan
 * jika backend sedang tidak tersedia tanpa mengganggu operasi klien lainnya.
 */
export default function PanelOperasi({
  langkahTerpilihOperasiId = null,
  saatTambahOperasi,
  saatMuatPreset,
  jumlahLangkah = 0,
  apakahServerTersedia = false,
}) {
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

  const batasMaksimumTercapai =
    jumlahLangkah >= KONFIGURASI_PIPELINE.BATAS_LANGKAH;

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

      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {/* Bagian Preset Awal (Tahap 3) */}
        {!kataKunci.trim() && (
          <div className="space-y-2 pb-2 border-b border-garis-panel">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teks-sekunder px-1">
              <Sparkles size={13} className="text-primer" />
              <span>{t('preset.judul')}</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {DAFTAR_PRESET.map((pr) => (
                <button
                  key={pr.id}
                  type="button"
                  data-testid={`tombol-preset-${pr.id}`}
                  onClick={() => saatMuatPreset(pr)}
                  className="w-full text-left px-2.5 py-2 rounded-lg border border-garis-panel bg-latar-subtil hover:border-primer hover:bg-latar-sorot transition-all cursor-pointer group flex items-center justify-between"
                  title={t(pr.kunciDeskripsi)}
                >
                  <div className="truncate pr-2">
                    <div className="text-xs font-bold text-teks-utama group-hover:text-primer transition-colors truncate">
                      {t(pr.kunciNama)}
                    </div>
                    <div className="text-[10px] text-teks-redup truncate mt-0.5">
                      {t(pr.kunciDeskripsi)}
                    </div>
                  </div>
                  <Wand2
                    size={13}
                    className="shrink-0 text-teks-redup group-hover:text-primer transition-colors"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Katalog Operasi Citra */}
        <div className="space-y-4">
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
                    const apakahDipilih = langkahTerpilihOperasiId === op.id;
                    const adalahOperasiServer = op.lokasi === 'server';
                    const serverTidakTersedia =
                      adalahOperasiServer && !apakahServerTersedia;
                    const tombolDinonaktifkan =
                      batasMaksimumTercapai || serverTidakTersedia;

                    let judulTooltip = t('pipeline.tambah');
                    if (serverTidakTersedia) {
                      judulTooltip = t('statusServer.operasiServerNonaktif');
                    } else if (batasMaksimumTercapai) {
                      judulTooltip = t('pipeline.batasTercapai');
                    }

                    return (
                      <button
                        key={op.id}
                        type="button"
                        data-testid={`tombol-tambah-operasi-${op.id}`}
                        data-lokasi={op.lokasi || 'klien'}
                        disabled={tombolDinonaktifkan}
                        onClick={() => saatTambahOperasi(op.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center justify-between border ${
                          tombolDinonaktifkan
                            ? 'opacity-50 cursor-not-allowed bg-latar-subtil border-garis-panel text-teks-redup'
                            : apakahDipilih
                              ? 'bg-primer-lembut border-primer text-primer font-bold shadow-xs cursor-pointer'
                              : 'bg-transparent border-transparent hover:bg-latar-sorot text-teks-utama cursor-pointer'
                        }`}
                        title={judulTooltip}
                      >
                        <div className="truncate pr-2">
                          <div className="font-semibold truncate flex items-center gap-1.5">
                            <span className="truncate">{t(op.kunciNama)}</span>
                            {adalahOperasiServer && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-primer-lembut text-teks-primer border border-garis-primer">
                                <Server size={9} />
                                Server
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-teks-redup truncate mt-0.5">
                            {serverTidakTersedia
                              ? t('statusServer.operasiServerNonaktif')
                              : t(op.kunciDeskripsi)}
                          </div>
                        </div>
                        <Plus
                          size={14}
                          className="shrink-0 text-teks-redup group-hover:text-primer ml-1 stroke-[2]"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
