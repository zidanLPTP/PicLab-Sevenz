import { Layers } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Panel kanan editor: Kerangka parameter dan riwayat operasi (Tahap 1).
 */
export default function PanelParameter() {
  const { t } = useTranslation();

  return (
    <aside
      className="w-80 shrink-0 border-l border-garis-panel bg-latar-panel flex flex-col h-full overflow-hidden select-none"
      aria-label={t('panel.judulParameter')}
    >
      <div className="p-3.5 border-b border-garis-panel flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-teks-sekunder">
          {t('panel.judulParameter')}
        </h2>
      </div>

      <div className="flex-1 p-4 flex flex-col items-center justify-center text-center text-teks-redup">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-teks-redup mb-3">
          <Layers size={20} className="stroke-[1.75]" />
        </div>
        <p className="text-xs leading-relaxed max-w-[220px]">
          {t('panel.kosongParameter')}
        </p>
      </div>
    </aside>
  );
}
