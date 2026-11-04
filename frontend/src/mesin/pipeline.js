/**
 * Model Pipeline & Reducer Murni PicLab Sevenz (spec.md Tahap 3).
 * Mengelola tumpukan langkah operasi non-destruktif, urutan, sakelar aktif,
 * dan tumpukan snapshot riwayat (undo/redo) berbasis memori murni tanpa DOM.
 */

import { KONFIGURASI_PIPELINE } from '../utilitas/konfigurasiPipeline';
import {
  bersihkanParameter,
  dapatkanOperasiBerdasarkanId,
  ekstrakNilaiAwalParameter,
} from './katalogOperasi';

let penghitungId = 0;

/**
 * Menghasilkan ID unik untuk setiap langkah dalam pipeline.
 * @returns {string}
 */
export function buatIdLangkah() {
  penghitungId++;
  return `langkah_${Date.now()}_${penghitungId}`;
}

/**
 * Membuat salinan mendalam (deep clone) dari daftar langkah pipeline.
 * @param {Array<object>} langkah
 * @returns {Array<object>}
 */
export function klonaDaftarLangkah(langkah) {
  if (!Array.isArray(langkah)) return [];
  return langkah.map((item) => ({
    id: item.id,
    idOperasi: item.idOperasi,
    parameter: { ...item.parameter },
    aktif: Boolean(item.aktif),
  }));
}

/**
 * Membuat state awal model pipeline.
 * @param {object} [opsi={}] - Opsi inisialisasi state awal
 * @returns {object}
 */
export function buatKeadaanAwalPipeline(opsi = {}) {
  const langkahAwal = [];
  const snapshotAwal = {
    langkah: [],
    langkahTerpilihId: null,
    kunciLabel: 'riwayat.kondisiAwal',
    label: 'Kondisi Awal Citra',
    waktu: typeof opsi.waktu === 'number' ? opsi.waktu : 0,
  };

  return {
    langkah: langkahAwal,
    langkahTerpilihId: null,
    riwayat: [snapshotAwal],
    indeksRiwayat: 0,
  };
}

/**
 * Membantu pembuatan entri snapshot baru dan menyematkannya ke tumpukan riwayat.
 * Menghapus riwayat masa depan jika pengguna berada di tengah tumpukan (setelah undo),
 * serta menjepit ukuran tumpukan ke batas BATAS_RIWAYAT.
 */
function buatSnapshotRiwayat(state, langkahBaru, langkahTerpilihId, meta = {}) {
  const riwayatAktif = state.riwayat.slice(0, state.indeksRiwayat + 1);
  const entriBaru = {
    langkah: klonaDaftarLangkah(langkahBaru),
    langkahTerpilihId,
    kunciLabel: meta.kunciLabel || 'riwayat.perubahan',
    label: meta.label || 'Perubahan Pipeline',
    waktu: typeof meta.waktu === 'number' ? meta.waktu : 0,
  };

  const tumpukanDiperbarui = [...riwayatAktif, entriBaru];

  // Batasi tumpukan jika melebihi konfigurasi maksimum
  if (tumpukanDiperbarui.length > KONFIGURASI_PIPELINE.BATAS_RIWAYAT) {
    tumpukanDiperbarui.shift();
  }

  return {
    riwayat: tumpukanDiperbarui,
    indeksRiwayat: tumpukanDiperbarui.length - 1,
  };
}

/**
 * Reducer murni untuk manajemen state pipeline dan riwayat (spec.md bagian 7 & Tahap 3).
 *
 * @param {object} state - State pipeline saat ini
 * @param {object} action - Aksi yang dipicu
 * @returns {object} State baru hasil komputasi murni
 */
export function reducerPipeline(state = buatKeadaanAwalPipeline(), action) {
  if (!action || !action.type) return state;

  const waktuAksi = action.payload?.waktu ?? action.meta?.waktu ?? 0;

  switch (action.type) {
    case 'TAMBAH_LANGKAH': {
      const { idOperasi, parameter, aktif, sisipSetelahId, idLangkah } =
        action.payload || {};
      if (!idOperasi) return state;

      // Tolak jika pipeline sudah mencapai batas maksimum
      if (state.langkah.length >= KONFIGURASI_PIPELINE.BATAS_LANGKAH) {
        return state;
      }

      const operasi = dapatkanOperasiBerdasarkanId(idOperasi);
      const paramDefault = operasi ? ekstrakNilaiAwalParameter(operasi) : {};
      const paramBersih = operasi
        ? bersihkanParameter(operasi, { ...paramDefault, ...(parameter || {}) })
        : { ...(parameter || {}) };

      const langkahBaruItem = {
        id: idLangkah || buatIdLangkah(),
        idOperasi,
        parameter: paramBersih,
        aktif: aktif !== undefined ? Boolean(aktif) : true,
      };

      let daftarLangkahBaru;
      if (sisipSetelahId) {
        const idx = state.langkah.findIndex((l) => l.id === sisipSetelahId);
        if (idx >= 0) {
          daftarLangkahBaru = [
            ...state.langkah.slice(0, idx + 1),
            langkahBaruItem,
            ...state.langkah.slice(idx + 1),
          ];
        } else {
          daftarLangkahBaru = [...state.langkah, langkahBaruItem];
        }
      } else {
        daftarLangkahBaru = [...state.langkah, langkahBaruItem];
      }

      const riwayatData = buatSnapshotRiwayat(
        state,
        daftarLangkahBaru,
        langkahBaruItem.id,
        {
          ...(action.meta || {}),
          kunciLabel: action.meta?.kunciLabel || 'riwayat.tambahLangkah',
          label:
            action.meta?.label || `Tambah ${operasi?.namaTeknis || idOperasi}`,
          waktu: waktuAksi,
        }
      );

      return {
        ...state,
        langkah: daftarLangkahBaru,
        langkahTerpilihId: langkahBaruItem.id,
        ...riwayatData,
      };
    }

    case 'HAPUS_LANGKAH': {
      const { idLangkah } = action.payload || {};
      if (!idLangkah) return state;

      const idx = state.langkah.findIndex((l) => l.id === idLangkah);
      if (idx === -1) return state;

      const opDihapus = state.langkah[idx];
      const daftarLangkahBaru = state.langkah.filter((l) => l.id !== idLangkah);

      // Tentukan ID langkah terpilih berikutnya
      let terpilihBaru = state.langkahTerpilihId;
      if (state.langkahTerpilihId === idLangkah) {
        if (daftarLangkahBaru.length === 0) {
          terpilihBaru = null;
        } else {
          const idxBaru = Math.min(idx, daftarLangkahBaru.length - 1);
          terpilihBaru = daftarLangkahBaru[idxBaru].id;
        }
      }

      const riwayatData = buatSnapshotRiwayat(
        state,
        daftarLangkahBaru,
        terpilihBaru,
        {
          ...(action.meta || {}),
          kunciLabel: action.meta?.kunciLabel || 'riwayat.hapusLangkah',
          label: action.meta?.label || `Hapus ${opDihapus.idOperasi}`,
          waktu: waktuAksi,
        }
      );

      return {
        ...state,
        langkah: daftarLangkahBaru,
        langkahTerpilihId: terpilihBaru,
        ...riwayatData,
      };
    }

    case 'UBAH_PARAMETER': {
      const { idLangkah, parameter, coalescing } = action.payload || {};
      if (!idLangkah || !parameter) return state;

      const idx = state.langkah.findIndex((l) => l.id === idLangkah);
      if (idx === -1) return state;

      const opLama = state.langkah[idx];
      const opDef = dapatkanOperasiBerdasarkanId(opLama.idOperasi);

      const langkahDiperbarui = {
        ...opLama,
        parameter: { ...parameter },
      };

      const daftarLangkahBaru = [
        ...state.langkah.slice(0, idx),
        langkahDiperbarui,
        ...state.langkah.slice(idx + 1),
      ];

      // Jika dalam mode coalescing (misal saat pointer masih ditekan pada slider atau ketikan keyboard):
      // perbarui daftar langkah secara instan untuk preview, TETAPI tumpukan riwayat tidak disentuh
      // agar baseline riwayat sebelum interaksi tetap utuh untuk operasi undo.
      if (coalescing) {
        return {
          ...state,
          langkah: daftarLangkahBaru,
        };
      }

      // Input telah selesai (commit/pointer up/blur) -> buat entri riwayat resmi
      const riwayatData = buatSnapshotRiwayat(
        state,
        daftarLangkahBaru,
        idLangkah,
        {
          ...(action.meta || {}),
          kunciLabel: action.meta?.kunciLabel || 'riwayat.ubahParameter',
          label:
            action.meta?.label ||
            `Ubah ${opDef?.namaTeknis || opLama.idOperasi}`,
          waktu: waktuAksi,
        }
      );

      return {
        ...state,
        langkah: daftarLangkahBaru,
        ...riwayatData,
      };
    }

    case 'KOMIT_COALESCING': {
      // Mengunci perubahan slider/input yang sebelumnya berstatus coalescing ke tumpukan riwayat
      const { idLangkah } = action.payload || {};
      const snapshotSaatIni = state.riwayat[state.indeksRiwayat];

      // Jika konfigurasi langkah saat ini identik dengan snapshot riwayat aktif, tidak perlu duplikasi
      const apakahSama =
        JSON.stringify(state.langkah) ===
        JSON.stringify(snapshotSaatIni?.langkah);
      if (apakahSama) {
        return state;
      }

      const opLama = state.langkah.find((l) => l.id === idLangkah);
      const opDef = opLama
        ? dapatkanOperasiBerdasarkanId(opLama.idOperasi)
        : null;

      const riwayatData = buatSnapshotRiwayat(
        state,
        state.langkah,
        idLangkah || state.langkahTerpilihId,
        {
          ...(action.meta || {}),
          kunciLabel: action.meta?.kunciLabel || 'riwayat.ubahParameter',
          label:
            action.meta?.label ||
            `Ubah ${opDef?.namaTeknis || opLama?.idOperasi || 'Parameter'}`,
          waktu: waktuAksi,
        }
      );

      return {
        ...state,
        ...riwayatData,
      };
    }

    case 'TOGGLE_AKTIF': {
      const { idLangkah } = action.payload || {};
      if (!idLangkah) return state;

      const idx = state.langkah.findIndex((l) => l.id === idLangkah);
      if (idx === -1) return state;

      const target = state.langkah[idx];
      const statusBaru = !target.aktif;

      const langkahDiperbarui = {
        ...target,
        aktif: statusBaru,
      };

      const daftarLangkahBaru = [
        ...state.langkah.slice(0, idx),
        langkahDiperbarui,
        ...state.langkah.slice(idx + 1),
      ];

      const riwayatData = buatSnapshotRiwayat(
        state,
        daftarLangkahBaru,
        idLangkah,
        {
          ...(action.meta || {}),
          kunciLabel: statusBaru
            ? 'riwayat.aktifkanLangkah'
            : 'riwayat.nonaktifkanLangkah',
          label: `${statusBaru ? 'Aktifkan' : 'Nonaktifkan'} ${target.idOperasi}`,
          waktu: waktuAksi,
        }
      );

      return {
        ...state,
        langkah: daftarLangkahBaru,
        ...riwayatData,
      };
    }

    case 'PINDAH_LANGKAH': {
      const { dariIndeks, keIndeks } = action.payload || {};
      if (
        dariIndeks === undefined ||
        keIndeks === undefined ||
        dariIndeks === keIndeks ||
        dariIndeks < 0 ||
        dariIndeks >= state.langkah.length ||
        keIndeks < 0 ||
        keIndeks >= state.langkah.length
      ) {
        return state;
      }

      const daftarLangkahBaru = [...state.langkah];
      const [itemDipindah] = daftarLangkahBaru.splice(dariIndeks, 1);
      daftarLangkahBaru.splice(keIndeks, 0, itemDipindah);

      const riwayatData = buatSnapshotRiwayat(
        state,
        daftarLangkahBaru,
        itemDipindah.id,
        {
          ...(action.meta || {}),
          kunciLabel: action.meta?.kunciLabel || 'riwayat.pindahUrutan',
          label:
            action.meta?.label ||
            `Pindah ${itemDipindah.idOperasi} (${dariIndeks + 1} -> ${keIndeks + 1})`,
          waktu: waktuAksi,
        }
      );

      return {
        ...state,
        langkah: daftarLangkahBaru,
        langkahTerpilihId: itemDipindah.id,
        ...riwayatData,
      };
    }

    case 'MUAT_PRESET': {
      const { preset, langkah: langkahDariPayload } = action.payload || {};
      if (!preset || !Array.isArray(preset.langkah)) return state;

      // Petakan langkah preset: utamakan langkah yang sudah diberi ID deterministik dari payload
      let daftarLangkahBaru;
      if (
        Array.isArray(langkahDariPayload) &&
        langkahDariPayload.length === preset.langkah.length
      ) {
        daftarLangkahBaru = langkahDariPayload.map((l) => ({
          id: l.id || buatIdLangkah(),
          idOperasi: l.idOperasi,
          parameter: { ...l.parameter },
          aktif: l.aktif !== undefined ? Boolean(l.aktif) : true,
        }));
      } else {
        daftarLangkahBaru = preset.langkah.map((l) => {
          const op = dapatkanOperasiBerdasarkanId(l.idOperasi);
          const paramDef = op ? ekstrakNilaiAwalParameter(op) : {};
          const paramBersih = op
            ? bersihkanParameter(op, { ...paramDef, ...(l.parameter || {}) })
            : { ...(l.parameter || {}) };

          return {
            id: buatIdLangkah(),
            idOperasi: l.idOperasi,
            parameter: paramBersih,
            aktif: l.aktif !== undefined ? Boolean(l.aktif) : true,
          };
        });
      }

      const terpilihId =
        daftarLangkahBaru.length > 0 ? daftarLangkahBaru[0].id : null;

      const riwayatData = buatSnapshotRiwayat(
        state,
        daftarLangkahBaru,
        terpilihId,
        {
          ...(action.meta || {}),
          kunciLabel: preset.kunciNama || 'riwayat.muatPreset',
          label: `Muat Preset ${preset.id}`,
          waktu: waktuAksi,
        }
      );

      return {
        ...state,
        langkah: daftarLangkahBaru,
        langkahTerpilihId: terpilihId,
        ...riwayatData,
      };
    }

    case 'KOSONGKAN_PIPELINE': {
      if (state.langkah.length === 0) return state;

      const daftarLangkahBaru = [];
      const riwayatData = buatSnapshotRiwayat(state, daftarLangkahBaru, null, {
        ...(action.meta || {}),
        kunciLabel: action.meta?.kunciLabel || 'riwayat.kosongkanPipeline',
        label: action.meta?.label || 'Kosongkan Pipeline',
        waktu: waktuAksi,
      });

      return {
        ...state,
        langkah: daftarLangkahBaru,
        langkahTerpilihId: null,
        ...riwayatData,
      };
    }

    case 'PILIH_LANGKAH': {
      const { idLangkah } = action.payload || {};
      return {
        ...state,
        langkahTerpilihId: idLangkah ?? null,
      };
    }

    case 'UNDO': {
      if (state.indeksRiwayat <= 0) return state;
      const targetIndeks = state.indeksRiwayat - 1;
      const snapshot = state.riwayat[targetIndeks];

      return {
        ...state,
        langkah: klonaDaftarLangkah(snapshot.langkah),
        langkahTerpilihId: snapshot.langkahTerpilihId,
        indeksRiwayat: targetIndeks,
      };
    }

    case 'REDO': {
      if (state.indeksRiwayat >= state.riwayat.length - 1) return state;
      const targetIndeks = state.indeksRiwayat + 1;
      const snapshot = state.riwayat[targetIndeks];

      return {
        ...state,
        langkah: klonaDaftarLangkah(snapshot.langkah),
        langkahTerpilihId: snapshot.langkahTerpilihId,
        indeksRiwayat: targetIndeks,
      };
    }

    case 'LOMPAT_RIWAYAT': {
      const { indeks } = action.payload || {};
      if (
        indeks === undefined ||
        indeks < 0 ||
        indeks >= state.riwayat.length ||
        indeks === state.indeksRiwayat
      ) {
        return state;
      }

      const snapshot = state.riwayat[indeks];
      return {
        ...state,
        langkah: klonaDaftarLangkah(snapshot.langkah),
        langkahTerpilihId: snapshot.langkahTerpilihId,
        indeksRiwayat: indeks,
      };
    }

    case 'RESET_TOTAL': {
      return buatKeadaanAwalPipeline();
    }

    default:
      return state;
  }
}
