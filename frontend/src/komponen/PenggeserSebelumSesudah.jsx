import { ChevronsLeftRight } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Komponen pembanding citra sebelum dan sesudah interaktif dengan bilah pemisah.
 * Mendukung rendering performa tinggi berbasis elemen <canvas> langsung (zero PNG encoding)
 * serta fallback tag <img> untuk kompatibilitas aksesibilitas penuh.
 *
 * @param {object} props
 * @param {string} props.gambarSebelum - URL sumber citra sebelum
 * @param {string} props.gambarSesudah - URL sumber citra sesudah
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} [props.citraSebelum]
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} [props.citraSesudah]
 * @param {string} [props.namaCitra] - Nama citra untuk atribut alt
 */
export default function PenggeserSebelumSesudah({
  gambarSebelum,
  gambarSesudah,
  citraSebelum,
  citraSesudah,
  namaCitra = 'Citra PicLab',
}) {
  const { t } = useTranslation();
  const [posisiPemisah, setPosisiPemisah] = useState(50); // Persentase 0 - 100
  const [sedangGeser, setSedangGeser] = useState(false);
  const kontainerRef = useRef(null);
  const kanvasSebelumRef = useRef(null);
  const kanvasSesudahRef = useRef(null);

  // Render langsung ke canvas sesudah menggunakan putImageData (P2: bebas encoding PNG)
  useEffect(() => {
    if (!kanvasSesudahRef.current || !citraSesudah) return;
    const kanvas = kanvasSesudahRef.current;
    if (
      kanvas.width !== citraSesudah.width ||
      kanvas.height !== citraSesudah.height
    ) {
      kanvas.width = citraSesudah.width;
      kanvas.height = citraSesudah.height;
    }
    const ctx = kanvas.getContext('2d');
    const imageData = new ImageData(
      new Uint8ClampedArray(citraSesudah.data),
      citraSesudah.width,
      citraSesudah.height
    );
    ctx.putImageData(imageData, 0, 0);

    // Tandai penyelesaian visual kanvas untuk pengukuran latensi presisi tinggi
    if (typeof window !== 'undefined') {
      window.__terakhirWaktuPutImageData = performance.now();
      requestAnimationFrame(() => {
        window.__terakhirRenderKanvas = performance.now();
        if (typeof window.__saatKanvasTerbarui === 'function') {
          window.__saatKanvasTerbarui();
        }
      });
    }
  }, [citraSesudah]);

  // Render langsung ke canvas sebelum menggunakan putImageData
  useEffect(() => {
    if (!kanvasSebelumRef.current || !citraSebelum) return;
    const kanvas = kanvasSebelumRef.current;
    if (
      kanvas.width !== citraSebelum.width ||
      kanvas.height !== citraSebelum.height
    ) {
      kanvas.width = citraSebelum.width;
      kanvas.height = citraSebelum.height;
    }
    const ctx = kanvas.getContext('2d');
    const imageData = new ImageData(
      new Uint8ClampedArray(citraSebelum.data),
      citraSebelum.width,
      citraSebelum.height
    );
    ctx.putImageData(imageData, 0, 0);
  }, [citraSebelum]);

  const perbaruiPosisi = useCallback((posisiX) => {
    if (!kontainerRef.current) return;
    const rect = kontainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(posisiX - rect.left, rect.width));
    const persentase = Math.round((x / rect.width) * 100);
    setPosisiPemisah(persentase);
  }, []);

  const mulaiGeserMouse = (e) => {
    e.preventDefault();
    setSedangGeser(true);

    const saatGeser = (event) => perbaruiPosisi(event.clientX);
    const selesaiGeser = () => {
      setSedangGeser(false);
      window.removeEventListener('mousemove', saatGeser);
      window.removeEventListener('mouseup', selesaiGeser);
    };

    window.addEventListener('mousemove', saatGeser);
    window.addEventListener('mouseup', selesaiGeser);
  };

  const mulaiGeserSentuh = (e) => {
    if (e.touches.length === 0) return;
    setSedangGeser(true);

    const saatSentuh = (event) => {
      if (event.touches.length > 0) {
        perbaruiPosisi(event.touches[0].clientX);
      }
    };
    const selesaiSentuh = () => {
      setSedangGeser(false);
      window.removeEventListener('touchmove', saatSentuh);
      window.removeEventListener('touchend', selesaiSentuh);
    };

    window.addEventListener('touchmove', saatSentuh);
    window.addEventListener('touchend', selesaiSentuh);
  };

  const tanganiKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPosisiPemisah((prev) => Math.max(0, prev - 2));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPosisiPemisah((prev) => Math.min(100, prev + 2));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setPosisiPemisah(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setPosisiPemisah(100);
    }
  };

  return (
    <div
      ref={kontainerRef}
      className="relative w-full h-full max-w-full max-h-full overflow-hidden select-none flex items-center justify-center cursor-ew-resize rounded-lg"
      onMouseDown={mulaiGeserMouse}
      onTouchStart={mulaiGeserSentuh}
    >
      {/* 1. Citra Sesudah (Latar Belakang Penuh) */}
      {citraSesudah ? (
        <canvas
          ref={kanvasSesudahRef}
          data-testid="kanvas-sesudah"
          className="max-w-full max-h-full object-contain pointer-events-none"
        />
      ) : null}
      <img
        src={gambarSesudah}
        alt={`${namaCitra} - ${t('kanvas.sesudah')}`}
        className={
          citraSesudah
            ? 'hidden'
            : 'max-w-full max-h-full object-contain pointer-events-none'
        }
        draggable={false}
      />

      {/* 2. Citra Sebelum (Dipotong sesuai posisi pemisah) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center"
        style={{
          clipPath: `polygon(0 0, ${posisiPemisah}% 0, ${posisiPemisah}% 100%, 0 100%)`,
        }}
      >
        {citraSebelum ? (
          <canvas
            ref={kanvasSebelumRef}
            data-testid="kanvas-sebelum"
            className="max-w-full max-h-full object-contain pointer-events-none"
          />
        ) : null}
        <img
          src={gambarSebelum}
          alt={`${namaCitra} - ${t('kanvas.sebelum')}`}
          className={
            citraSebelum
              ? 'hidden'
              : 'max-w-full max-h-full object-contain pointer-events-none'
          }
          draggable={false}
        />
      </div>

      {/* 3. Garis Pembagi & Handle Slider */}
      <div
        className="absolute top-0 bottom-0 z-20 pointer-events-none flex items-center justify-center"
        style={{ left: `${posisiPemisah}%`, transform: 'translateX(-50%)' }}
      >
        <div className="w-0.5 h-full bg-white shadow-md" />
        <div
          role="slider"
          tabIndex={0}
          aria-label={t('kanvas.labelSlider')}
          aria-valuenow={posisiPemisah}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={t('kanvas.posisiSlider', { nilai: posisiPemisah })}
          onKeyDown={tanganiKeyDown}
          className={`absolute w-8 h-8 rounded-full bg-white text-teks-utama border border-garis-panel shadow-lg flex items-center justify-center pointer-events-auto transition-transform focus:outline-none focus:ring-2 focus:ring-primer focus:ring-offset-2 ${
            sedangGeser ? 'scale-110 ring-2 ring-primer' : 'hover:scale-105'
          }`}
        >
          <ChevronsLeftRight size={16} className="text-primer stroke-[2]" />
        </div>
      </div>

      {/* 4. Label Penanda Sebelum & Sesudah */}
      <span className="absolute left-3 top-3 z-10 px-2 py-0.5 bg-latar-gelap/60 backdrop-blur-xs text-white text-[11px] font-semibold rounded pointer-events-none">
        {t('kanvas.sebelum')}
      </span>
      <span className="absolute right-3 top-3 z-10 px-2 py-0.5 bg-latar-gelap/60 backdrop-blur-xs text-white text-[11px] font-semibold rounded pointer-events-none">
        {t('kanvas.sesudah')}
      </span>
    </div>
  );
}
