/**
 * Konfigurasi batas berkas dan format citra PicLab Sevenz (spec.md bagian 8).
 * Seluruh batasan didefinisikan terpusat di sini dan tidak ditulis berulang di tempat lain.
 */
export const BATASAN_BERKAS = {
  // Format masukan yang didukung
  TIPE_MIME_DIIZINKAN: ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'],
  EKSTENSI_DIIZINKAN: ['.jpg', '.jpeg', '.png', '.webp', '.bmp'],

  // Batasan ukuran berkas
  UKURAN_MAKS_BYTE: 10 * 1024 * 1024, // 10 MB
  UKURAN_MAKS_MB: 10,

  // Batasan dimensi citra
  DIMENSI_SISI_MAKS_PIKSEL: 4096, // 4096 px sisi terpanjang
  TOTAL_PIKSEL_MAKS: 16_000_000, // 16 juta piksel

  // Format unduhan yang didukung
  FORMAT_UNDUHAN: ['png', 'jpeg', 'webp'],
  FORMAT_UNDUHAN_DEFAULT: 'png',
};

/**
 * Kode galat validasi berkas untuk integrasi i18n.
 */
export const KODE_GALAT_BERKAS = {
  UKURAN_MELEBIHI_BATAS: 'GALAT_UKURAN_MELEBIHI_BATAS',
  FORMAT_TIDAK_DIDUKUNG: 'GALAT_FORMAT_TIDAK_DIDUKUNG',
  DIMENSI_MELEBIHI_BATAS: 'GALAT_DIMENSI_MELEBIHI_BATAS',
  TOTAL_PIKSEL_MELEBIHI_BATAS: 'GALAT_TOTAL_PIKSEL_MELEBIHI_BATAS',
  BERKAS_RUSAK: 'GALAT_BERKAS_RUSAK',
  SVG_DITOLAK: 'GALAT_SVG_DITOLAK',
};
