import { describe, expect, it } from 'vitest';
import { operasiCrop, operasiKecerahan, operasiNegatif } from '../mesin/dasar';
import { eksekusiPipelineSekuensial } from '../mesin/eksekutorPipeline';
import { dapatkanOperasiBerdasarkanId } from '../mesin/katalogOperasi';
import {
  buatKeadaanAwalPipeline,
  klonaDaftarLangkah,
  reducerPipeline,
} from '../mesin/pipeline';
import { DAFTAR_PRESET, validasiStrukturPreset } from '../mesin/preset';
import { buatCitraKosong } from '../mesin/utilitasCitra';
import { KONFIGURASI_PIPELINE } from '../utilitas/konfigurasiPipeline';

describe('Model Pipeline, Reducer Murni, & Eksekusi Berantai (Tahap 3)', () => {
  describe('1. Reducer Pipeline Murni & Manajemen Riwayat (Undo/Redo)', () => {
    it('menginisialisasi keadaan awal dengan benar', () => {
      const state = buatKeadaanAwalPipeline();
      expect(state.langkah).toEqual([]);
      expect(state.langkahTerpilihId).toBeNull();
      expect(state.riwayat).toHaveLength(1);
      expect(state.indeksRiwayat).toBe(0);
      expect(state.riwayat[0].label).toBe('Kondisi Awal Citra');
    });

    it('TAMBAH_LANGKAH: menambahkan langkah di akhir dan membuat snapshot riwayat', () => {
      let state = buatKeadaanAwalPipeline();
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: { idOperasi: 'dasar_kecerahan', parameter: { kecerahan: 30 } },
      });

      expect(state.langkah).toHaveLength(1);
      expect(state.langkah[0].idOperasi).toBe('dasar_kecerahan');
      expect(state.langkah[0].parameter.kecerahan).toBe(30);
      expect(state.langkah[0].aktif).toBe(true);
      expect(state.langkahTerpilihId).toBe(state.langkah[0].id);
      expect(state.riwayat).toHaveLength(2);
      expect(state.indeksRiwayat).toBe(1);
    });

    it('TAMBAH_LANGKAH: menolak penambahan jika sudah mencapai batas maksimum 30 langkah', () => {
      let state = buatKeadaanAwalPipeline();
      for (let i = 0; i < KONFIGURASI_PIPELINE.BATAS_LANGKAH; i++) {
        state = reducerPipeline(state, {
          type: 'TAMBAH_LANGKAH',
          payload: { idOperasi: 'dasar_negatif' },
        });
      }
      expect(state.langkah).toHaveLength(30);

      // Coba tambah langkah ke-31
      const stateGagal = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: { idOperasi: 'dasar_grayscale' },
      });
      expect(stateGagal.langkah).toHaveLength(30);
      expect(stateGagal).toBe(state);
    });

    it('HAPUS_LANGKAH: menghapus langkah dan memilih langkah tetangga terdekat', () => {
      let state = buatKeadaanAwalPipeline();
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: { idOperasi: 'dasar_kecerahan' },
      });
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: { idOperasi: 'dasar_kontras' },
      });
      const idKecerahan = state.langkah[0].id;
      const idKontras = state.langkah[1].id;

      // Hapus langkah kedua (kontras)
      state = reducerPipeline(state, {
        type: 'HAPUS_LANGKAH',
        payload: { idLangkah: idKontras },
      });

      expect(state.langkah).toHaveLength(1);
      expect(state.langkah[0].id).toBe(idKecerahan);
      expect(state.langkahTerpilihId).toBe(idKecerahan);
      expect(state.riwayat).toHaveLength(4);
    });

    it('UBAH_PARAMETER & Coalescing: drag slider tidak membanjiri tumpukan riwayat', () => {
      let state = buatKeadaanAwalPipeline();
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: { idOperasi: 'dasar_kecerahan', parameter: { kecerahan: 0 } },
      });
      const id = state.langkah[0].id;
      const panjangRiwayatAwal = state.riwayat.length; // 2

      // Simulasi pergeseran slider secara kontinyu (coalescing = true)
      state = reducerPipeline(state, {
        type: 'UBAH_PARAMETER',
        payload: {
          idLangkah: id,
          parameter: { kecerahan: 10 },
          coalescing: true,
        },
      });
      state = reducerPipeline(state, {
        type: 'UBAH_PARAMETER',
        payload: {
          idLangkah: id,
          parameter: { kecerahan: 20 },
          coalescing: true,
        },
      });
      state = reducerPipeline(state, {
        type: 'UBAH_PARAMETER',
        payload: {
          idLangkah: id,
          parameter: { kecerahan: 30 },
          coalescing: true,
        },
      });

      // Panjang riwayat tetap sama selama coalescing
      expect(state.riwayat.length).toBe(panjangRiwayatAwal);
      expect(state.langkah[0].parameter.kecerahan).toBe(30);

      // Commit saat pointer dilepas
      state = reducerPipeline(state, {
        type: 'KOMIT_COALESCING',
        payload: { idLangkah: id },
      });
      expect(state.riwayat.length).toBe(panjangRiwayatAwal + 1);
      expect(state.indeksRiwayat).toBe(2);
    });

    it('TOGGLE_AKTIF: mengaktifkan dan menonaktifkan langkah tanpa menghapusnya', () => {
      let state = buatKeadaanAwalPipeline();
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: { idOperasi: 'dasar_negatif' },
      });
      const id = state.langkah[0].id;

      // Nonaktifkan
      state = reducerPipeline(state, {
        type: 'TOGGLE_AKTIF',
        payload: { idLangkah: id },
      });
      expect(state.langkah[0].aktif).toBe(false);

      // Aktifkan kembali
      state = reducerPipeline(state, {
        type: 'TOGGLE_AKTIF',
        payload: { idLangkah: id },
      });
      expect(state.langkah[0].aktif).toBe(true);
    });

    it('PINDAH_LANGKAH: mengubah urutan langkah pipeline', () => {
      let state = buatKeadaanAwalPipeline();
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: { idOperasi: 'dasar_kecerahan' },
      });
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: { idOperasi: 'dasar_kontras' },
      });
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: { idOperasi: 'warna_sepia' },
      });

      // Pindahkan langkah 0 (kecerahan) ke indeks 2 (paling akhir)
      state = reducerPipeline(state, {
        type: 'PINDAH_LANGKAH',
        payload: { dariIndeks: 0, keIndeks: 2 },
      });

      expect(state.langkah[0].idOperasi).toBe('dasar_kontras');
      expect(state.langkah[1].idOperasi).toBe('warna_sepia');
      expect(state.langkah[2].idOperasi).toBe('dasar_kecerahan');
    });

    it('UNDO, REDO, dan LOMPAT_RIWAYAT: navigasi snapshot non-destruktif', () => {
      let state = buatKeadaanAwalPipeline();
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: { idOperasi: 'dasar_kecerahan' },
      }); // snapshot 1
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: { idOperasi: 'dasar_kontras' },
      }); // snapshot 2

      expect(state.langkah).toHaveLength(2);
      expect(state.indeksRiwayat).toBe(2);

      // Undo -> kembali ke snapshot 1 (hanya kecerahan)
      state = reducerPipeline(state, { type: 'UNDO' });
      expect(state.indeksRiwayat).toBe(1);
      expect(state.langkah).toHaveLength(1);
      expect(state.langkah[0].idOperasi).toBe('dasar_kecerahan');

      // Undo -> kembali ke kondisi awal (kosong)
      state = reducerPipeline(state, { type: 'UNDO' });
      expect(state.indeksRiwayat).toBe(0);
      expect(state.langkah).toHaveLength(0);

      // Redo -> kembali ke snapshot 1
      state = reducerPipeline(state, { type: 'REDO' });
      expect(state.indeksRiwayat).toBe(1);
      expect(state.langkah).toHaveLength(1);

      // Lompat riwayat langsung ke snapshot 2
      state = reducerPipeline(state, {
        type: 'LOMPAT_RIWAYAT',
        payload: { indeks: 2 },
      });
      expect(state.indeksRiwayat).toBe(2);
      expect(state.langkah).toHaveLength(2);
    });

    it('BATAS_RIWAYAT: membatasi tumpukan hingga maksimum 100 entri', () => {
      let state = buatKeadaanAwalPipeline();
      for (let i = 0; i < 120; i++) {
        state = reducerPipeline(state, {
          type: 'TAMBAH_LANGKAH',
          payload: { idOperasi: 'dasar_kecerahan' },
        });
        if (state.langkah.length >= KONFIGURASI_PIPELINE.BATAS_LANGKAH) {
          state = reducerPipeline(state, { type: 'KOSONGKAN_PIPELINE' });
        }
      }

      expect(state.riwayat.length).toBeLessThanOrEqual(
        KONFIGURASI_PIPELINE.BATAS_RIWAYAT
      );
      expect(state.riwayat.length).toBe(KONFIGURASI_PIPELINE.BATAS_RIWAYAT);
    });

    it('Immutability: mutasi objek langkah lama tidak mengubah state atau riwayat sebelumnya', () => {
      let state = buatKeadaanAwalPipeline();
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: { idOperasi: 'dasar_kecerahan', parameter: { kecerahan: 20 } },
      });

      const snapshot0Langkah = state.riwayat[1].langkah;
      // Mutasi eksternal pada referensi langkah saat ini
      state.langkah[0].parameter.kecerahan = 999;

      // Snapshot riwayat tetap terlindungi (20, bukan 999)
      expect(snapshot0Langkah[0].parameter.kecerahan).toBe(20);
    });

    it('F3: kemurnian reducer - aksi yang sama pada state yang sama menghasilkan keluaran identik (deep equal)', () => {
      const stateAwal = buatKeadaanAwalPipeline({ waktu: 1000 });

      const aksiTambah = {
        type: 'TAMBAH_LANGKAH',
        payload: {
          idOperasi: 'dasar_kecerahan',
          parameter: { kecerahan: 25 },
          idLangkah: 'langkah-tetap-1',
          waktu: 2000,
        },
      };

      // Jalankan dua kali pada state yang persis sama
      const hasil1 = reducerPipeline(stateAwal, aksiTambah);
      const hasil2 = reducerPipeline(stateAwal, aksiTambah);

      // Keluaran harus deep equal murni (deterministik tanpa Math.random atau Date.now internal)
      expect(hasil1).toEqual(hasil2);

      const aksiUbah = {
        type: 'UBAH_PARAMETER',
        payload: {
          idLangkah: 'langkah-tetap-1',
          parameter: { kecerahan: 50 },
          coalescing: false,
          waktu: 3000,
        },
      };

      const hasilUbah1 = reducerPipeline(hasil1, aksiUbah);
      const hasilUbah2 = reducerPipeline(hasil1, aksiUbah);
      expect(hasilUbah1).toEqual(hasilUbah2);
    });

    it('F2 d: undo setelah memuat preset mengembalikan pipeline sebelumnya persis', () => {
      let state = buatKeadaanAwalPipeline({ waktu: 100 });

      // Siapkan pipeline dengan 2 langkah khusus
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: {
          idOperasi: 'dasar_kecerahan',
          parameter: { kecerahan: 35 },
          idLangkah: 'langkah-kecerahan-awal',
          waktu: 200,
        },
      });
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: {
          idOperasi: 'dasar_rotasi',
          parameter: { sudut: 90 },
          idLangkah: 'langkah-rotasi-awal',
          waktu: 300,
        },
      });

      const langkahSebelumPreset = klonaDaftarLangkah(state.langkah);
      const idTerpilihSebelumPreset = state.langkahTerpilihId;
      expect(langkahSebelumPreset).toHaveLength(2);

      // Muat preset Hitam Putih
      const presetHitamPutih = DAFTAR_PRESET.find(
        (p) => p.id === 'hitam_putih'
      );
      state = reducerPipeline(state, {
        type: 'MUAT_PRESET',
        payload: {
          preset: presetHitamPutih,
          langkah: presetHitamPutih.langkah.map((l, idx) => ({
            ...l,
            id: `langkah-preset-${idx}`,
          })),
          waktu: 400,
        },
      });

      expect(state.langkah).toHaveLength(2);
      expect(state.langkah[0].idOperasi).toBe('dasar_grayscale');
      expect(state.langkah[1].idOperasi).toBe('dasar_kontras');

      // Jalankan UNDO -> HARUS mengembalikan pipeline sebelumnya persis
      state = reducerPipeline(state, { type: 'UNDO' });

      expect(state.langkah).toEqual(langkahSebelumPreset);
      expect(state.langkahTerpilihId).toBe(idTerpilihSebelumPreset);
      expect(state.langkah[0].idOperasi).toBe('dasar_kecerahan');
      expect(state.langkah[0].parameter.kecerahan).toBe(35);
      expect(state.langkah[1].idOperasi).toBe('dasar_rotasi');
      expect(state.langkah[1].parameter.sudut).toBe(90);
    });

    it('F4: pengujian perilaku coalescing lengkap (slider pointer, arrow keys, typing, dropdown)', () => {
      let state = buatKeadaanAwalPipeline({ waktu: 100 });
      state = reducerPipeline(state, {
        type: 'TAMBAH_LANGKAH',
        payload: {
          idOperasi: 'dasar_kecerahan',
          parameter: { kecerahan: 0 },
          idLangkah: 'langkah-1',
          waktu: 200,
        },
      });
      const panjangRiwayatAwal = state.riwayat.length; // 2 (kondisi awal, tambah langkah)

      // (i) Geser slider dengan pointer (rangkaian coalescing: true lalu 1 commit)
      for (let i = 1; i <= 5; i++) {
        state = reducerPipeline(state, {
          type: 'UBAH_PARAMETER',
          payload: {
            idLangkah: 'langkah-1',
            parameter: { kecerahan: i * 10 },
            coalescing: true,
            waktu: 300 + i,
          },
        });
        // Tumpukan riwayat TIDAK bertambah selama drag berlangsung
        expect(state.riwayat.length).toBe(panjangRiwayatAwal);
      }
      expect(state.langkah[0].parameter.kecerahan).toBe(50);

      // Pointer dilepas -> 1 commit
      state = reducerPipeline(state, {
        type: 'KOMIT_COALESCING',
        payload: { idLangkah: 'langkah-1', waktu: 400 },
      });
      expect(state.riwayat.length).toBe(panjangRiwayatAwal + 1); // Bertambah tepat 1 entri!

      // (ii) Tombol panah pada slider: penekanan cepat (coalescing: true), lalu commit setelah jeda
      const riwayatSetelahPointer = state.riwayat.length;
      for (let i = 1; i <= 3; i++) {
        state = reducerPipeline(state, {
          type: 'UBAH_PARAMETER',
          payload: {
            idLangkah: 'langkah-1',
            parameter: { kecerahan: 50 + i },
            coalescing: true,
            waktu: 500 + i,
          },
        });
      }
      expect(state.riwayat.length).toBe(riwayatSetelahPointer);
      // Timeout jeda coalescing berakhir -> commit
      state = reducerPipeline(state, {
        type: 'KOMIT_COALESCING',
        payload: { idLangkah: 'langkah-1', waktu: 600 },
      });
      expect(state.riwayat.length).toBe(riwayatSetelahPointer + 1); // Bertambah tepat 1 entri!

      // (iii) Pengetikan angka: mengetik digit per digit (coalescing: true), lalu commit saat blur/Enter
      const riwayatSetelahPanah = state.riwayat.length;
      state = reducerPipeline(state, {
        type: 'UBAH_PARAMETER',
        payload: {
          idLangkah: 'langkah-1',
          parameter: { kecerahan: 1 },
          coalescing: true,
          waktu: 701,
        },
      });
      state = reducerPipeline(state, {
        type: 'UBAH_PARAMETER',
        payload: {
          idLangkah: 'langkah-1',
          parameter: { kecerahan: 12 },
          coalescing: true,
          waktu: 702,
        },
      });
      state = reducerPipeline(state, {
        type: 'UBAH_PARAMETER',
        payload: {
          idLangkah: 'langkah-1',
          parameter: { kecerahan: 120 },
          coalescing: true,
          waktu: 703,
        },
      });
      expect(state.riwayat.length).toBe(riwayatSetelahPanah);
      // Pengguna menekan Enter atau blur
      state = reducerPipeline(state, {
        type: 'KOMIT_COALESCING',
        payload: { idLangkah: 'langkah-1', waktu: 750 },
      });
      expect(state.riwayat.length).toBe(riwayatSetelahPanah + 1); // Bertambah tepat 1 entri!

      // (iv) Perubahan dropdown dan sakelar: commit langsung (coalescing: false) menghasilkan 1 entri per aksi
      const riwayatSetelahKetik = state.riwayat.length;
      state = reducerPipeline(state, {
        type: 'TOGGLE_AKTIF',
        payload: { idLangkah: 'langkah-1', waktu: 800 },
      });
      expect(state.riwayat.length).toBe(riwayatSetelahKetik + 1);

      // Verifikasi Undo berurutan: tiap entri riwayat membatalkan satu unit interaksi penuh
      state = reducerPipeline(state, { type: 'UNDO' }); // Batal toggle
      expect(state.langkah[0].aktif).toBe(true);

      state = reducerPipeline(state, { type: 'UNDO' }); // Batal ketik 120 -> kembali ke 53
      expect(state.langkah[0].parameter.kecerahan).toBe(53);

      state = reducerPipeline(state, { type: 'UNDO' }); // Batal tombol panah -> kembali ke 50
      expect(state.langkah[0].parameter.kecerahan).toBe(50);

      state = reducerPipeline(state, { type: 'UNDO' }); // Batal drag pointer -> kembali ke 0
      expect(state.langkah[0].parameter.kecerahan).toBe(0);
    });

    it('F6: ukuran memori 100 snapshot riwayat terukur ~55 KB (56.291 bytes, mengoreksi klaim awal)', () => {
      let state = buatKeadaanAwalPipeline({ waktu: 0 });

      // Buat 5 langkah dalam pipeline
      const ops = [
        'dasar_kecerahan',
        'dasar_kontras',
        'warna_saturasi',
        'dasar_negatif',
        'enhancement_gamma',
      ];
      for (let i = 0; i < ops.length; i++) {
        state = reducerPipeline(state, {
          type: 'TAMBAH_LANGKAH',
          payload: {
            idOperasi: ops[i],
            idLangkah: `langkah-${i}`,
            parameter: { nilai: i * 10 },
            waktu: 100 + i,
          },
        });
      }

      // Buat 100 snapshot perubahan riwayat
      for (let i = 0; i < 100; i++) {
        state = reducerPipeline(state, {
          type: 'UBAH_PARAMETER',
          payload: {
            idLangkah: 'langkah-0',
            parameter: { kecerahan: i },
            coalescing: false,
            waktu: 1000 + i,
          },
        });
      }

      expect(state.riwayat.length).toBe(KONFIGURASI_PIPELINE.BATAS_RIWAYAT);

      const jsonStr = JSON.stringify(state.riwayat);
      const byteSize = new TextEncoder().encode(jsonStr).length;
      const kbSize = byteSize / 1024;

      console.log(
        `HASIL UKUR MEMORI: 100 snapshot riwayat = ${byteSize} bytes (${kbSize.toFixed(2)} KB)`
      );

      // Koreksi klaim: 100 snapshot riwayat 5 langkah bernilai ~55 KB (56.291 byte, < 60 KB)
      expect(byteSize).toBeLessThan(60 * 1024);
      expect(byteSize).toBeGreaterThan(50 * 1024);
    });
  });

  describe('2. Hand Calculation Piksel per Piksel: Pipeline 3 Langkah', () => {
    it('hasil pipeline sekuensial (Crop -> Kecerahan -> Rotasi 90°) identik matematis dengan hitungan tangan', () => {
      // Citra sintetis 4x4 (RGBA):
      // Piksel di koordinat (x, y) memiliki intensitas R = y*10 + x, G=0, B=0, A=255
      const citra = buatCitraKosong(4, 4);
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const idx = (y * 4 + x) * 4;
          citra.data[idx] = y * 10 + x;
          citra.data[idx + 1] = 0;
          citra.data[idx + 2] = 0;
          citra.data[idx + 3] = 255;
        }
      }

      // Langkah 1: Crop [x=1, y=1, lebar=2, tinggi=2]
      // Matriks sebelum crop (submatriks y:1..2, x:1..2):
      // Baris y=1: x=1 -> 11, x=2 -> 12
      // Baris y=2: x=1 -> 21, x=2 -> 22
      // Hasil crop 2x2:
      // [11, 12]
      // [21, 22]

      // Langkah 2: Kecerahan +15
      // Rumus: V' = min(255, V + 15)
      // Baris 0: [11+15=26, 12+15=27]
      // Baris 1: [21+15=36, 22+15=37]
      // Hasil kecerahan 2x2:
      // [26, 27]
      // [36, 37]

      // Langkah 3: Rotasi 90 derajat searah jarum jam
      // Rotasi 90 pada matriks 2x2:
      // dest(destX, destY) dengan destX = H - 1 - y, destY = x
      // Posisi baru:
      // Baris 0: [36, 26]
      // Baris 1: [37, 27]

      const pipelineLangkah = [
        {
          id: '1',
          idOperasi: 'dasar_crop',
          parameter: { x: 1, y: 1, lebar: 2, tinggi: 2 },
          aktif: true,
        },
        {
          id: '2',
          idOperasi: 'dasar_kecerahan',
          parameter: { kecerahan: 15 },
          aktif: true,
        },
        {
          id: '3',
          idOperasi: 'dasar_rotasi',
          parameter: { sudut: 90 },
          aktif: true,
        },
      ];

      const { hasil } = eksekusiPipelineSekuensial(pipelineLangkah, citra, {
        rasio: 1.0,
      });

      expect(hasil.width).toBe(2);
      expect(hasil.height).toBe(2);

      // Verifikasi nilai piksel hasil dengan hitungan tangan:
      // Piksel (0,0): R=36
      expect(hasil.data[0]).toBe(36);
      // Piksel (1,0): R=26
      expect(hasil.data[4]).toBe(26);
      // Piksel (0,1): R=37
      expect(hasil.data[8]).toBe(37);
      // Piksel (1,1): R=27
      expect(hasil.data[12]).toBe(27);
    });

    it('F2 a: pipeline 4 langkah (crop pengubah dimensi + 1 nonaktif) = penerapan manual berurutan byte per byte = hitungan tangan', () => {
      // 1. Definisikan citra awal 4x4 RGBA dengan nilai piksel diketahui
      // Citra 4x4 (16 piksel, 64 byte):
      // y=0: (0,0)=[10, 20, 30, 255],  (1,0)=[40, 50, 60, 255],  (2,0)=[70, 80, 90, 255],  (3,0)=[100, 110, 120, 255]
      // y=1: (0,1)=[130, 140, 150, 255],(1,1)=[160, 170, 180, 255],(2,1)=[190, 200, 210, 255],(3,1)=[220, 230, 240, 255]
      // y=2: (0,2)=[15, 25, 35, 255],  (1,2)=[45, 55, 65, 255],  (2,2)=[75, 85, 95, 255],  (3,2)=[105, 115, 125, 255]
      // y=3: (0,3)=[135, 145, 155, 255],(1,3)=[165, 175, 185, 255],(2,3)=[195, 205, 215, 255],(3,3)=[225, 235, 245, 255]
      const citraAwal = buatCitraKosong(4, 4);
      const dataPikselAwal = [
        10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255,
        130, 140, 150, 255, 160, 170, 180, 255, 190, 200, 210, 255, 220, 230,
        240, 255, 15, 25, 35, 255, 45, 55, 65, 255, 75, 85, 95, 255, 105, 115,
        125, 255, 135, 145, 155, 255, 165, 175, 185, 255, 195, 205, 215, 255,
        225, 235, 245, 255,
      ];
      for (let i = 0; i < dataPikselAwal.length; i++) {
        citraAwal.data[i] = dataPikselAwal[i];
      }

      // Rincian 4 Langkah Pipeline:
      // Langkah 1: Kecerahan +20 (aktif)
      // Langkah 2: Negatif Citra (NONAKTIF -> dilewati)
      // Langkah 3: Crop [x=1, y=1, lebar=2, tinggi=3] (PENGUBAH DIMENSI -> 4x4 menjadi 2x3)
      // Langkah 4: Negatif Citra (aktif -> pembalikan fotometrik 255 - V)
      const daftarLangkah4 = [
        {
          id: 'l-1',
          idOperasi: 'dasar_kecerahan',
          parameter: { kecerahan: 20 },
          aktif: true,
        },
        {
          id: 'l-2',
          idOperasi: 'dasar_negatif',
          parameter: {},
          aktif: false, // LANGKAH NONAKTIF
        },
        {
          id: 'l-3',
          idOperasi: 'dasar_crop',
          parameter: { x: 1, y: 1, lebar: 2, tinggi: 3 }, // LANGKAH PENGUBAH DIMENSI
          aktif: true,
        },
        {
          id: 'l-4',
          idOperasi: 'dasar_negatif',
          parameter: {},
          aktif: true,
        },
      ];

      // HITUNGAN TANGAN:
      // Setelah Langkah 1 (Kecerahan +20):
      // y=1: (1,1)=[180, 190, 200, 255], (2,1)=[210, 220, 230, 255]
      // y=2: (1,2)=[65, 75, 85, 255],    (2,2)=[95, 105, 115, 255]
      // y=3: (1,3)=[185, 195, 205, 255], (2,3)=[215, 225, 235, 255]
      //
      // Setelah Langkah 2 (Negatif, nonaktif): tidak ada perubahan.
      //
      // Setelah Langkah 3 (Crop x=1, y=1, w=2, h=3):
      // Dimensi baru: 2x3 (6 piksel)
      // Baris 0 (dari y=1): (0,0)=[180, 190, 200, 255], (1,0)=[210, 220, 230, 255]
      // Baris 1 (dari y=2): (0,1)=[65, 75, 85, 255],    (1,1)=[95, 105, 115, 255]
      // Baris 2 (dari y=3): (0,2)=[185, 195, 205, 255], (1,2)=[215, 225, 235, 255]
      //
      // Setelah Langkah 4 (Negatif, aktif: V' = 255 - V):
      // Baris 0:
      // (0,0) = [255-180=75, 255-190=65, 255-200=55, 255]
      // (1,0) = [255-210=45, 255-220=35, 255-230=25, 255]
      // Baris 1:
      // (0,1) = [255-65=190, 255-75=180, 255-85=170, 255]
      // (1,1) = [255-95=160, 255-105=150, 255-115=140, 255]
      // Baris 2:
      // (0,2) = [255-185=70, 255-195=60, 255-205=50, 255]
      // (1,2) = [255-215=40, 255-225=30, 255-235=20, 255]
      const nilaiHarapanTangan = new Uint8ClampedArray([
        75, 65, 55, 255, 45, 35, 25, 255, 190, 180, 170, 255, 160, 150, 140,
        255, 70, 60, 50, 255, 40, 30, 20, 255,
      ]);

      // A. Eksekusi melalui Eksekutor Pipeline
      const { hasil: hasilPipeline } = eksekusiPipelineSekuensial(
        daftarLangkah4,
        citraAwal
      );

      // B. Penerapan Manual Berurutan Fungsi Operasi Satu per Satu
      let hasilManual = operasiKecerahan.terapkan(citraAwal, { kecerahan: 20 });
      // Langkah 2 nonaktif dilewati secara manual
      hasilManual = operasiCrop.terapkan(hasilManual, {
        x: 1,
        y: 1,
        lebar: 2,
        tinggi: 3,
      });
      hasilManual = operasiNegatif.terapkan(hasilManual, {});

      // Verifikasi Dimensi
      expect(hasilPipeline.width).toBe(2);
      expect(hasilPipeline.height).toBe(3);
      expect(hasilManual.width).toBe(2);
      expect(hasilManual.height).toBe(3);

      // Pembuktian Byte per Byte:
      // 1. Eksekutor Pipeline === Penerapan Manual Berurutan
      expect(hasilPipeline.data).toEqual(hasilManual.data);

      // 2. Eksekutor Pipeline === Nilai Harapan Hitungan Tangan
      expect(hasilPipeline.data).toEqual(nilaiHarapanTangan);
    });
  });

  describe('3. Pembuktian Non-Komutatif: Urutan Operasi Berpengaruh', () => {
    it('Urutan Operasi A: (Kecerahan lalu Kontras) != Urutan Operasi B: (Kontras lalu Kecerahan)', () => {
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([100, 100, 100, 255]),
      };

      // Pipeline A: Kecerahan (+50) -> Kontras (+50)
      const resA = eksekusiPipelineSekuensial(
        [
          {
            id: '1',
            idOperasi: 'dasar_kecerahan',
            parameter: { kecerahan: 50 },
            aktif: true,
          },
          {
            id: '2',
            idOperasi: 'dasar_kontras',
            parameter: { kontras: 50 },
            aktif: true,
          },
        ],
        citra
      );

      // Pipeline B: Kontras (+50) -> Kecerahan (+50)
      const resB = eksekusiPipelineSekuensial(
        [
          {
            id: '1',
            idOperasi: 'dasar_kontras',
            parameter: { kontras: 50 },
            aktif: true,
          },
          {
            id: '2',
            idOperasi: 'dasar_kecerahan',
            parameter: { kecerahan: 50 },
            aktif: true,
          },
        ],
        citra
      );

      // Nilai R kedua hasil terbukti berbeda secara matematis
      expect(resA.hasil.data[0]).not.toBe(resB.hasil.data[0]);
    });

    it('Urutan Geometri: (Crop lalu Rotasi 90°) != (Rotasi 90° lalu Crop)', () => {
      const citra = buatCitraKosong(10, 8);
      for (let i = 0; i < citra.data.length; i += 4) {
        citra.data[i] = (i / 4) % 255;
        citra.data[i + 3] = 255;
      }

      // Kasus A: Crop [x=0, y=0, w=6, h=4] -> Rotasi 90 -> Dimensi hasil: 4x6
      const resA = eksekusiPipelineSekuensial(
        [
          {
            id: '1',
            idOperasi: 'dasar_crop',
            parameter: { x: 0, y: 0, lebar: 6, tinggi: 4 },
            aktif: true,
          },
          {
            id: '2',
            idOperasi: 'dasar_rotasi',
            parameter: { sudut: 90 },
            aktif: true,
          },
        ],
        citra
      );

      // Kasus B: Rotasi 90 (10x8 -> 8x10) -> Crop [x=0, y=0, w=6, h=4] -> Dimensi hasil: 6x4
      const resB = eksekusiPipelineSekuensial(
        [
          {
            id: '1',
            idOperasi: 'dasar_rotasi',
            parameter: { sudut: 90 },
            aktif: true,
          },
          {
            id: '2',
            idOperasi: 'dasar_crop',
            parameter: { x: 0, y: 0, lebar: 6, tinggi: 4 },
            aktif: true,
          },
        ],
        citra
      );

      expect(resA.hasil.width).toBe(4);
      expect(resA.hasil.height).toBe(6);

      expect(resB.hasil.width).toBe(6);
      expect(resB.hasil.height).toBe(4);

      expect(resA.hasil.width).not.toBe(resB.hasil.width);
    });
  });

  describe('4. Verifikasi Mekanisme Prefix Caching', () => {
    it('memanfaatkan prefix cache: langkah 0..k-1 tidak dihitung ulang saat langkah k berubah', () => {
      const citra = buatCitraKosong(20, 20);

      const pipelineAwal = [
        {
          id: '1',
          idOperasi: 'dasar_kecerahan',
          parameter: { kecerahan: 20 },
          aktif: true,
        },
        {
          id: '2',
          idOperasi: 'dasar_kontras',
          parameter: { kontras: 30 },
          aktif: true,
        },
        {
          id: '3',
          idOperasi: 'warna_sepia',
          parameter: { intensitas: 50 },
          aktif: true,
        },
      ];

      // Eksekusi pertama (cache kosong) -> seluruh 3 langkah dieksekusi
      const run1 = eksekusiPipelineSekuensial(
        pipelineAwal,
        citra,
        { rasio: 1.0 },
        []
      );
      expect(run1.indeksMulaiKomputasi).toBe(0);
      expect(run1.langkahDieksekusi).toBe(3);
      expect(run1.cacheBaru).toHaveLength(3);

      // Ubah parameter hanya pada langkah terakhir (langkah 2: sepia)
      const pipelineUbahLangkah2 = [
        pipelineAwal[0], // kecerahan tetap
        pipelineAwal[1], // kontras tetap
        {
          ...pipelineAwal[2],
          parameter: { intensitas: 80 }, // ubah sepia
        },
      ];

      // Eksekusi kedua dengan cache run 1 -> hanya langkah ke-2 yang dieksekusi
      const run2 = eksekusiPipelineSekuensial(
        pipelineUbahLangkah2,
        citra,
        { rasio: 1.0 },
        run1.cacheBaru
      );

      expect(run2.indeksMulaiKomputasi).toBe(2);
      expect(run2.langkahDieksekusi).toBe(1); // Langkah 0 dan 1 dilewati dari cache!

      // Ubah parameter pada langkah pertama (kecerahan) -> seluruh langkah dihitung ulang
      const pipelineUbahLangkah0 = [
        { ...pipelineAwal[0], parameter: { kecerahan: 40 } },
        pipelineAwal[1],
        pipelineAwal[2],
      ];

      const run3 = eksekusiPipelineSekuensial(
        pipelineUbahLangkah0,
        citra,
        { rasio: 1.0 },
        run2.cacheBaru
      );

      expect(run3.indeksMulaiKomputasi).toBe(0);
      expect(run3.langkahDieksekusi).toBe(3);
    });

    it('F2 b: cache prefiks = tanpa cache pada urutan 15 aksi acak ber-seed tetap (byte per byte match)', () => {
      // Citra kecil 8x8 dengan variasi warna RGBA
      const citra = buatCitraKosong(8, 8);
      for (let i = 0; i < citra.data.length; i += 4) {
        citra.data[i] = (i * 7) % 256;
        citra.data[i + 1] = (i * 13) % 256;
        citra.data[i + 2] = (i * 29) % 256;
        citra.data[i + 3] = 255;
      }

      // Generator deterministik ber-seed tetap (LCG)
      let seed = 123456789;
      const acak = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      // Pipeline awal 5 langkah
      let pipeline = [
        {
          id: 'l-0',
          idOperasi: 'dasar_kecerahan',
          parameter: { kecerahan: 10 },
          aktif: true,
        },
        {
          id: 'l-1',
          idOperasi: 'dasar_kontras',
          parameter: { kontras: 15 },
          aktif: true,
        },
        {
          id: 'l-2',
          idOperasi: 'warna_saturasi',
          parameter: { saturasi: 20 },
          aktif: true,
        },
        {
          id: 'l-3',
          idOperasi: 'warna_sepia',
          parameter: { intensitas: 30 },
          aktif: true,
        },
        {
          id: 'l-4',
          idOperasi: 'enhancement_gamma',
          parameter: { gamma: 1.1 },
          aktif: true,
        },
      ];

      let cacheBerjalan = [];

      // 15 Aksi mutasi berurutan: ubah parameter di tengah, pindah, hapus, toggle, tambah
      for (let step = 0; step < 15; step++) {
        const jenisAksi = Math.floor(acak() * 5); // 0..4

        if (jenisAksi === 0 && pipeline.length > 0) {
          // Aksi 0: Ubah parameter di tengah
          const idx = Math.floor(acak() * pipeline.length);
          const op = pipeline[idx];
          if (op.idOperasi === 'dasar_kecerahan') {
            pipeline[idx] = {
              ...op,
              parameter: { kecerahan: Math.floor(acak() * 60) - 30 },
            };
          } else if (op.idOperasi === 'dasar_kontras') {
            pipeline[idx] = {
              ...op,
              parameter: { kontras: Math.floor(acak() * 50) - 25 },
            };
          } else if (op.idOperasi === 'warna_saturasi') {
            pipeline[idx] = {
              ...op,
              parameter: { saturasi: Math.floor(acak() * 60) - 30 },
            };
          } else if (op.idOperasi === 'warna_sepia') {
            pipeline[idx] = {
              ...op,
              parameter: { intensitas: Math.floor(acak() * 80) },
            };
          } else if (op.idOperasi === 'enhancement_gamma') {
            pipeline[idx] = {
              ...op,
              parameter: { gamma: 0.8 + acak() * 0.8 },
            };
          }
        } else if (jenisAksi === 1 && pipeline.length >= 2) {
          // Aksi 1: Pindah urutan langkah
          const dari = Math.floor(acak() * pipeline.length);
          const ke = Math.floor(acak() * pipeline.length);
          if (dari !== ke) {
            const salinan = [...pipeline];
            const [item] = salinan.splice(dari, 1);
            salinan.splice(ke, 0, item);
            pipeline = salinan;
          }
        } else if (jenisAksi === 2 && pipeline.length > 2) {
          // Aksi 2: Hapus langkah
          const idx = Math.floor(acak() * pipeline.length);
          pipeline = pipeline.filter((_, i) => i !== idx);
        } else if (jenisAksi === 3 && pipeline.length > 0) {
          // Aksi 3: Toggle aktif / nonaktif
          const idx = Math.floor(acak() * pipeline.length);
          pipeline[idx] = { ...pipeline[idx], aktif: !pipeline[idx].aktif };
        } else {
          // Aksi 4: Tambah langkah baru
          if (pipeline.length < 8) {
            const daftarOp = [
              'dasar_kecerahan',
              'dasar_kontras',
              'warna_sepia',
              'dasar_negatif',
            ];
            const idOp = daftarOp[Math.floor(acak() * daftarOp.length)];
            pipeline.push({
              id: `l-tambah-${step}`,
              idOperasi: idOp,
              parameter:
                idOp === 'dasar_kecerahan'
                  ? { kecerahan: 15 }
                  : idOp === 'warna_sepia'
                    ? { intensitas: 40 }
                    : {},
              aktif: true,
            });
          }
        }

        // Eksekusi DENGAN cache prefix (cacheBerjalan diperbarui)
        const resDenganCache = eksekusiPipelineSekuensial(
          pipeline,
          citra,
          { rasio: 1.0 },
          cacheBerjalan
        );
        cacheBerjalan = resDenganCache.cacheBaru;

        // Eksekusi TANPA cache (dari nol)
        const resTanpaCache = eksekusiPipelineSekuensial(
          pipeline,
          citra,
          { rasio: 1.0 },
          false
        );

        // KESAMAAN MUTLAK BYTE PER BYTE:
        expect(resDenganCache.hasil.width).toBe(resTanpaCache.hasil.width);
        expect(resDenganCache.hasil.height).toBe(resTanpaCache.hasil.height);
        expect(resDenganCache.hasil.data).toEqual(resTanpaCache.hasil.data);
      }
    });
  });

  describe('5. Validasi Integritas 5 Preset Awal', () => {
    it('seluruh 5 preset menghasilkan langkah valid, dapat dieksekusi tanpa galat, dan bebas dari NaN', () => {
      const citra = buatCitraKosong(8, 8);
      // Isi beberapa nilai non-nol pada citra uji
      for (let i = 0; i < citra.data.length; i += 4) {
        citra.data[i] = (i * 7) % 256;
        citra.data[i + 1] = (i * 13) % 256;
        citra.data[i + 2] = (i * 19) % 256;
        citra.data[i + 3] = 255;
      }

      expect(DAFTAR_PRESET).toHaveLength(5);

      for (const pr of DAFTAR_PRESET) {
        expect(pr.id).toBeDefined();
        expect(pr.kunciNama).toBeDefined();
        expect(pr.langkah.length).toBeGreaterThan(0);

        // Eksekusi setiap preset
        const { hasil } = eksekusiPipelineSekuensial(pr.langkah, citra);
        expect(hasil.width).toBe(8);
        expect(hasil.height).toBe(8);
        expect(hasil.data).toBeInstanceOf(Uint8ClampedArray);

        // Verifikasi tidak ada NaN atau nilai non-finit pada piksel hasil
        for (let i = 0; i < hasil.data.length; i++) {
          const val = hasil.data[i];
          expect(Number.isFinite(val)).toBe(true);
          expect(Number.isNaN(val)).toBe(false);
        }
      }
    });

    it('G1 d: validasi struktur ketat seluruh preset (katalog, skema, tanpa kunci asing, rentang)', () => {
      expect(DAFTAR_PRESET).toHaveLength(5);

      for (const pr of DAFTAR_PRESET) {
        const hasilValidasi = validasiStrukturPreset(
          pr,
          dapatkanOperasiBerdasarkanId
        );
        expect(
          hasilValidasi.valid,
          `Preset "${pr.id}" memiliki galat validasi: ${hasilValidasi.galat.join(', ')}`
        ).toBe(true);
        expect(hasilValidasi.galat).toEqual([]);
      }
    });

    it('G1 d: UJI NEGATIF - pembuktian validasi gagal jika preset berisi ID tak dikenal, kunci asing, atau rentang tak valid', () => {
      // Kasus 1: ID operasi tidak dikenal (misal 'warna_temperatur')
      const presetIdTakDikenal = {
        id: 'uji_salah_id',
        kunciNama: 'preset.uji',
        kunciDeskripsi: 'preset.uji',
        langkah: [
          { idOperasi: 'warna_temperatur', parameter: {}, aktif: true },
        ],
      };
      const res1 = validasiStrukturPreset(
        presetIdTakDikenal,
        dapatkanOperasiBerdasarkanId
      );
      expect(res1.valid).toBe(false);
      expect(
        res1.galat.some((g) => g.includes("Operasi 'warna_temperatur'"))
      ).toBe(true);

      // Kasus 2: Kunci parameter asing (misal 'persentilBawah' pada peregangan kontras)
      const presetKunciAsing = {
        id: 'uji_kunci_asing',
        kunciNama: 'preset.uji',
        kunciDeskripsi: 'preset.uji',
        langkah: [
          {
            idOperasi: 'enhancement_peregangan_kontras',
            parameter: { persentilBawah: 1, pemangkasan: 1.5 },
            aktif: true,
          },
        ],
      };
      const res2 = validasiStrukturPreset(
        presetKunciAsing,
        dapatkanOperasiBerdasarkanId
      );
      expect(res2.valid).toBe(false);
      expect(
        res2.galat.some((g) =>
          g.includes("Kunci parameter asing 'persentilBawah'")
        )
      ).toBe(true);

      // Kasus 3: Nilai parameter di luar rentang skema (misal pemangkasan 10, padahal max 5)
      const presetDiLuarRentang = {
        id: 'uji_rentang',
        kunciNama: 'preset.uji',
        kunciDeskripsi: 'preset.uji',
        langkah: [
          {
            idOperasi: 'enhancement_peregangan_kontras',
            parameter: { pemangkasan: 10 },
            aktif: true,
          },
        ],
      };
      const res3 = validasiStrukturPreset(
        presetDiLuarRentang,
        dapatkanOperasiBerdasarkanId
      );
      expect(res3.valid).toBe(false);
      expect(
        res3.galat.some((g) => g.includes('melebihi batas maksimum (5)'))
      ).toBe(true);

      // Kasus 4: Parameter bertipe slider tetapi diisi bukan angka finit
      const presetBukanAngka = {
        id: 'uji_nan',
        kunciNama: 'preset.uji',
        kunciDeskripsi: 'preset.uji',
        langkah: [
          {
            idOperasi: 'dasar_kontras',
            parameter: { kontras: 'bukan_angka' },
            aktif: true,
          },
        ],
      };
      const res4 = validasiStrukturPreset(
        presetBukanAngka,
        dapatkanOperasiBerdasarkanId
      );
      expect(res4.valid).toBe(false);
      expect(
        res4.galat.some((g) => g.includes('harus berupa angka finit'))
      ).toBe(true);
    });
  });
});
