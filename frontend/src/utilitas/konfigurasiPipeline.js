/**
 * Konfigurasi batas operasional Pipeline dan Riwayat PicLab Sevenz (spec.md Tahap 3).
 */

export const KONFIGURASI_PIPELINE = {
  /** Batas maksimum jumlah langkah operasi yang dapat ditampung dalam pipeline aktif */
  BATAS_LANGKAH: 30,

  /** Batas maksimum tumpukan riwayat (undo/redo snapshot) */
  BATAS_RIWAYAT: 100,

  /** Jeda coalescing (ms) untuk penggabungan peristiwa pergeseran slider */
  JEDA_COALESCING_MS: 200,
};
