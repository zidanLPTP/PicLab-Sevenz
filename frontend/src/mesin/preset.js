/**
 * Definisi Preset Awal PicLab Sevenz (spec.md bagian 4 & Tahap 4).
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
      { idOperasi: 'warna_saturasi', parameter: { saturasi: 25 }, aktif: true },
    ],
  },
  {
    id: 'hangat_klasik',
    kunciNama: 'preset.hangatKlasik.nama',
    kunciDeskripsi: 'preset.hangatKlasik.deskripsi',
    langkah: [
      { idOperasi: 'warna_sepia', parameter: { intensitas: 30 }, aktif: true },
      {
        idOperasi: 'warna_balance',
        parameter: { merah: 15, hijau: 5, biru: -15 },
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
    ],
  },
  {
    id: 'negatif',
    kunciNama: 'preset.negatif.nama',
    kunciDeskripsi: 'preset.negatif.deskripsi',
    langkah: [{ idOperasi: 'dasar_negatif', parameter: {}, aktif: true }],
  },
  // Tahap 4: Preset Konvolusi & Spasial Baru
  {
    id: 'pertajam',
    kunciNama: 'preset.pertajam.nama',
    kunciDeskripsi: 'preset.pertajam.deskripsi',
    langkah: [
      {
        idOperasi: 'tajam_unsharp',
        parameter: { sigma: 1.5, jumlah: 1.5, ambang: 2 },
        aktif: true,
      },
    ],
  },
  {
    id: 'siluet_tepi',
    kunciNama: 'preset.siluetTepi.nama',
    kunciDeskripsi: 'preset.siluetTepi.deskripsi',
    langkah: [
      {
        idOperasi: 'tepi_sobel',
        parameter: { arah: 'gabungan', penguatan: 1.5, inversi: true },
        aktif: true,
      },
    ],
  },
  {
    id: 'hapus_noise',
    kunciNama: 'preset.hapusNoise.nama',
    kunciDeskripsi: 'preset.hapusNoise.deskripsi',
    langkah: [
      {
        idOperasi: 'halus_median',
        parameter: { ukuran: 3 },
        aktif: true,
      },
    ],
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

/**
 * Memvalidasi struktur, skema parameter, dan ketiadaan kunci asing pada sebuah preset.
 * @param {object} preset
 * @param {Function} cariOperasiFn Fungsi pencari operasi berdasarkan ID di katalog
 * @returns {{ valid: boolean, galat: string[] }}
 */
export function validasiStrukturPreset(preset, cariOperasiFn) {
  const galat = [];
  if (!preset || typeof preset !== 'object') {
    return { valid: false, galat: ['Preset harus berupa objek'] };
  }
  if (!preset.id || typeof preset.id !== 'string') {
    galat.push('ID preset tidak valid');
  }
  if (!preset.kunciNama || typeof preset.kunciNama !== 'string') {
    galat.push('kunciNama preset tidak valid');
  }
  if (!Array.isArray(preset.langkah) || preset.langkah.length === 0) {
    galat.push('Preset harus memiliki minimal 1 langkah');
    return { valid: false, galat };
  }

  for (const [idx, langkah] of preset.langkah.entries()) {
    if (!langkah.idOperasi) {
      galat.push(`Langkah indeks ${idx} tidak memiliki idOperasi`);
      continue;
    }
    const op = cariOperasiFn(langkah.idOperasi);
    if (!op) {
      galat.push(
        `Operasi '${langkah.idOperasi}' pada langkah ${idx} tidak terdaftar di katalog`
      );
      continue;
    }

    const skemaMap = new Map((op.skemaParameter || []).map((s) => [s.id, s]));
    const param = langkah.parameter || {};

    // 1. Periksa ketiadaan kunci asing
    for (const kunci of Object.keys(param)) {
      if (!skemaMap.has(kunci)) {
        galat.push(
          `Kunci parameter asing '${kunci}' pada operasi '${langkah.idOperasi}' (langkah ${idx})`
        );
      }
    }

    // 2. Periksa tipe dan rentang parameter
    for (const [kunci, skema] of skemaMap.entries()) {
      if (kunci in param) {
        const val = param[kunci];
        if (skema.tipe === 'slider' || skema.tipe === 'angka') {
          if (typeof val !== 'number' || !Number.isFinite(val)) {
            galat.push(
              `Parameter '${kunci}' pada '${langkah.idOperasi}' harus berupa angka finit, diterima: ${val}`
            );
          } else {
            if (skema.min !== undefined && val < skema.min) {
              galat.push(
                `Nilai parameter '${kunci}' (${val}) kurang dari batas minimum (${skema.min})`
              );
            }
            if (skema.max !== undefined && val > skema.max) {
              galat.push(
                `Nilai parameter '${kunci}' (${val}) melebihi batas maksimum (${skema.max})`
              );
            }
          }
        } else if (skema.tipe === 'pilihan') {
          const opsiValid = (skema.pilihan || []).map((p) => p.nilai);
          if (!opsiValid.includes(val)) {
            galat.push(
              `Nilai pilihan '${val}' untuk '${kunci}' tidak ada dalam daftar opsi valid`
            );
          }
        } else if (skema.tipe === 'sakelar') {
          if (typeof val !== 'boolean') {
            galat.push(
              `Parameter sakelar '${kunci}' pada '${langkah.idOperasi}' harus berupa boolean, diterima: ${val}`
            );
          }
        } else if (skema.tipe === 'matriks') {
          if (!Array.isArray(val)) {
            galat.push(
              `Parameter matriks '${kunci}' pada '${langkah.idOperasi}' harus berupa array`
            );
          }
        }
      }
    }
  }

  return { valid: galat.length === 0, galat };
}
