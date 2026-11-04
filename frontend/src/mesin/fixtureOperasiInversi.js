/**
 * Fixture Operasi Kustom: Inversi Warna Tertarget (spec.md Tahap 2 & Revisi 3 V6).
 * Membuktikan prinsip "cukup lewat satu berkas definisi" (skema parameter + fungsi murni + metadata).
 */

export const operasiFixtureInversi = {
  id: 'dasar_inversi_kustom',
  kategori: 'dasar',
  kunciNama: 'operasi.dasar.inversiKustom.nama',
  kunciDeskripsi: 'operasi.dasar.inversiKustom.deskripsi',
  namaTeknis: 'Custom Intensity Color Inversion',
  skemaParameter: [
    {
      id: 'intensitas',
      kunciLabel: 'parameter.intensitas',
      tipe: 'slider',
      min: 0,
      max: 100,
      step: 1,
      nilaiAwal: 100,
      satuan: '%',
    },
  ],
  terapkan: function (citra, parameter = {}) {
    const rawVal = Number(parameter?.intensitas);
    const intensitas = (Number.isFinite(rawVal) ? rawVal : 100) / 100;

    const { width, height } = citra;
    const src = citra.data;
    const dst = new Uint8ClampedArray(src.length);

    for (let i = 0; i < src.length; i += 4) {
      dst[i] = Math.round(src[i] + (255 - 2 * src[i]) * intensitas);
      dst[i + 1] = Math.round(src[i + 1] + (255 - 2 * src[i + 1]) * intensitas);
      dst[i + 2] = Math.round(src[i + 2] + (255 - 2 * src[i + 2]) * intensitas);
      dst[i + 3] = src[i + 3]; // Kanal Alpha tidak diubah
    }

    return { data: dst, width, height };
  },
};
