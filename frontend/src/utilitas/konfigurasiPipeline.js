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

/**
 * Batas keamanan konfigurasi parameter operasi spasial dan konvolusi (Tahap 4, kepatuhan OWASP).
 */
export const KONFIGURASI_SPASIAL = {
  /** Batasan nilai elemen matriks kernel konvolusi */
  NILAI_ELEMEN_MATRIKS_MIN: -100,
  NILAI_ELEMEN_MATRIKS_MAX: 100,

  /** Batasan radius penapis mean */
  RADIUS_MEAN_MIN: 1,
  RADIUS_MEAN_MAX: 50,

  /** Batasan sigma penapis Gaussian */
  SIGMA_GAUSSIAN_MIN: 0.1,
  SIGMA_GAUSSIAN_MAX: 30.0,

  /** Batasan ukuran jendela penapis adaptif (ganjil) */
  JENDELA_ADAPTIF_MIN: 3,
  JENDELA_ADAPTIF_MAX: 151,

  /** Batasan penguatan penapis deteksi tepi */
  PENGUATAN_TEPI_MIN: 0.1,
  PENGUATAN_TEPI_MAX: 10.0,
};
