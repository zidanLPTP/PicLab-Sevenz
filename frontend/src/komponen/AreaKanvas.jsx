import { Maximize, Minimize, ZoomIn, ZoomOut } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PenggeserSebelumSesudah from './PenggeserSebelumSesudah';

/**
 * Area kerja kanvas interaktif dengan kemampuan zoom dan geser (pan).
 */
export default function AreaKanvas({ gambarSrc, gambarSesudahSrc, metadata }) {
  const { t } = useTranslation();
  const [skala, setSkala] = useState(1); // 1 = 100%
  const [posisiGeser, setPosisiGeser] = useState({ x: 0, y: 0 });
  const [sedangPan, setSedangPan] = useState(false);
  const titikAwalRef = useRef({ x: 0, y: 0 });
  const kanvasWadahRef = useRef(null);

  // Fungsi Zoom
  const perbesar = () =>
    setSkala((prev) => Math.min(5, +(prev + 0.25).toFixed(2)));
  const perkecil = () =>
    setSkala((prev) => Math.max(0.25, +(prev - 0.25).toFixed(2)));
  const reset100 = () => {
    setSkala(1);
    setPosisiGeser({ x: 0, y: 0 });
  };
  const pasLayar = () => {
    setSkala(0.85);
    setPosisiGeser({ x: 0, y: 0 });
  };

  // Zoom dengan roda mouse (Ctrl/Cmd + wheel atau wheel langsung)
  const tanganiWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      perbesar();
    } else {
      perkecil();
    }
  };

  // Keyboard navigation untuk Zoom
  useEffect(() => {
    function tanganiKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        perbesar();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        perkecil();
      } else if (e.key === '0') {
        e.preventDefault();
        pasLayar();
      } else if (e.key === '1') {
        e.preventDefault();
        reset100();
      }
    }

    window.addEventListener('keydown', tanganiKeyDown);
    return () => window.removeEventListener('keydown', tanganiKeyDown);
  }, []);

  // Pan / Geser kanvas dengan mouse
  const mulaiPan = (e) => {
    // Hanya pan jika klik tengah atau klik dengan tombol Alt/Space ditekan
    if (e.button === 1 || e.altKey || e.shiftKey) {
      e.preventDefault();
      setSedangPan(true);
      titikAwalRef.current = {
        x: e.clientX - posisiGeser.x,
        y: e.clientY - posisiGeser.y,
      };

      const saatPan = (event) => {
        setPosisiGeser({
          x: event.clientX - titikAwalRef.current.x,
          y: event.clientY - titikAwalRef.current.y,
        });
      };

      const selesaiPan = () => {
        setSedangPan(false);
        window.removeEventListener('mousemove', saatPan);
        window.removeEventListener('mouseup', selesaiPan);
      };

      window.addEventListener('mousemove', saatPan);
      window.addEventListener('mouseup', selesaiPan);
    }
  };

  return (
    <main
      ref={kanvasWadahRef}
      onWheel={tanganiWheel}
      onMouseDown={mulaiPan}
      className={`relative flex-1 h-full bg-latar-kanvas overflow-hidden flex items-center justify-center p-4 select-none ${
        sedangPan ? 'cursor-grabbing' : 'cursor-default'
      }`}
      tabIndex={0}
      aria-label="Area Kanvas Citra"
    >
      {/* Pola Latar Kotak Transparansi (Checkerboard) */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
        }}
      />

      {/* Kontainer Transformasi Citra (Zoom & Pan) */}
      <div
        className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-75 ease-out shadow-2xl rounded-lg bg-white overflow-hidden"
        style={{
          transform: `translate(${posisiGeser.x}px, ${posisiGeser.y}px) scale(${skala})`,
        }}
      >
        <PenggeserSebelumSesudah
          gambarSebelum={gambarSrc}
          gambarSesudah={gambarSesudahSrc || gambarSrc}
          namaCitra={metadata?.nama}
        />
      </div>

      {/* Floating Toolbar Kontrol Zoom */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white/90 backdrop-blur-md px-2 py-1.5 rounded-lg border border-garis-panel shadow-panel text-xs text-teks-utama"
        role="toolbar"
        aria-label="Kontrol Perbesaran Kanvas"
      >
        <button
          type="button"
          onClick={perkecil}
          aria-label={t('kanvas.perkecil')}
          className="p-1 rounded hover:bg-slate-100 text-teks-sekunder hover:text-teks-utama transition-colors focus:ring-1 focus:ring-primer focus:outline-none cursor-pointer"
        >
          <ZoomOut size={16} className="stroke-[1.75]" />
        </button>

        <span className="px-2 font-mono font-semibold text-[11px] min-w-[42px] text-center">
          {Math.round(skala * 100)}%
        </span>

        <button
          type="button"
          onClick={perbesar}
          aria-label={t('kanvas.perbesar')}
          className="p-1 rounded hover:bg-slate-100 text-teks-sekunder hover:text-teks-utama transition-colors focus:ring-1 focus:ring-primer focus:outline-none cursor-pointer"
        >
          <ZoomIn size={16} className="stroke-[1.75]" />
        </button>

        <div className="w-[1px] h-4 bg-garis-panel mx-1" />

        <button
          type="button"
          onClick={pasLayar}
          aria-label={t('kanvas.pasLayar')}
          className="p-1 rounded hover:bg-slate-100 text-teks-sekunder hover:text-teks-utama transition-colors focus:ring-1 focus:ring-primer focus:outline-none cursor-pointer"
          title={t('kanvas.pasLayar')}
        >
          <Minimize size={16} className="stroke-[1.75]" />
        </button>

        <button
          type="button"
          onClick={reset100}
          aria-label={t('kanvas.skala100')}
          className="p-1 rounded hover:bg-slate-100 text-teks-sekunder hover:text-teks-utama transition-colors focus:ring-1 focus:ring-primer focus:outline-none cursor-pointer"
          title={t('kanvas.skala100')}
        >
          <Maximize size={16} className="stroke-[1.75]" />
        </button>
      </div>
    </main>
  );
}
