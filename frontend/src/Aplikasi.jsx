import React from 'react';

/**
 * Komponen utama antarmuka PicLab Sevenz (Tahap 0 Fondasi).
 */
export default function Aplikasi() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-6">
      <header className="max-w-xl w-full bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
          PicLab Sevenz
        </h1>
        <p className="text-slate-600 text-sm mb-6">
          Aplikasi Pengolahan Citra Digital berbasis web.
        </p>

        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 text-emerald-800 text-sm">
          <p className="font-semibold mb-1">Status Fondasi Repo:</p>
          <p>Frontend Vite, React, dan Tailwind CSS aktif.</p>
        </div>
      </header>
    </div>
  );
}
