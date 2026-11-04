/**
 * Definisi Preset Awal PicLab Sevenz (spec.md Tahap 3).
 * Dibangun murni dari komposisi operasi citra yang telah teruji dan terdaftar.
 */

export const DAFTAR_PRESET = [
  {
    id: 'hitam_putih',
    kunciNama: 'preset.hitamPutih.nama',
    kunciDeskripsi: 'preset.hitamPutih.deskripsi',
    langkah: [
      { idOperasi: 'dasar_grayscale', parameter: {}, aktif: true },
      { idOperasi: 'dasar_kontras', parameter: { kontras: 20 }, aktif: true },
    ],
  },
  {
    id: 'kontras_tinggi',
    kunciNama: 'preset.kontrasTinggi.nama',
    kunciDeskripsi: 'preset.kontrasTinggi.deskripsi',
    langkah: [
      { idOperasi: 'dasar_kontras', parameter: { kontras: 40 }, aktif: true },
      {
        idOperasi: 'dasar_kecerahan',
        parameter: { kecerahan: 10 },
        aktif: true,
      },
      { idOperasi: 'warna_saturasi', parameter: { saturasi: 20 }, aktif: true },
    ],
  },
  {
    id: 'hangat_klasik',
    kunciNama: 'preset.hangatKlasik.nama',
    kunciDeskripsi: 'preset.hangatKlasik.deskripsi',
    langkah: [
      { idOperasi: 'warna_sepia', parameter: { intensitas: 40 }, aktif: true },
      {
        idOperasi: 'warna_balance',
        parameter: { merah: 15, hijau: 5, biru: -15 },
        aktif: true,
      },
      {
        idOperasi: 'enhancement_gamma',
        parameter: { gamma: 1.1 },
        aktif: true,
      },
    ],
  },
  {
    id: 'perbaiki_otomatis',
    kunciNama: 'preset.perbaikiOtomatis.nama',
    kunciDeskripsi: 'preset.perbaikiOtomatis.deskripsi',
    langkah: [
      {
        idOperasi: 'enhancement_peregangan_kontras',
        parameter: { pemangkasan: 1.5 },
        aktif: true,
      },
      { idOperasi: 'warna_saturasi', parameter: { saturasi: 15 }, aktif: true },
      { idOperasi: 'dasar_kontras', parameter: { kontras: 10 }, aktif: true },
    ],
  },
  {
    id: 'negatif',
    kunciNama: 'preset.negatif.nama',
    kunciDeskripsi: 'preset.negatif.deskripsi',
    langkah: [{ idOperasi: 'dasar_negatif', parameter: {}, aktif: true }],
  },
];

/**
 * Mencari preset berdasarkan ID.
 * @param {string} id
 * @returns {object|undefined}
 */
export function dapatkanPresetBerdasarkanId(id) {
  return DAFTAR_PRESET.find((p) => p.id === id);
}
