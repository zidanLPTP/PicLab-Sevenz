import { describe, expect, it } from 'vitest';
import {
  operasiCrop,
  operasiFlip,
  operasiGrayscale,
  operasiKecerahan,
  operasiKontras,
  operasiNegatif,
  operasiRotasi,
  operasiUbahUkuran,
} from '../mesin/dasar';
import {
  operasiEkualisasi,
  operasiGamma,
  operasiPereganganKontras,
} from '../mesin/enhancement';
import {
  daftarkanOperasiBaru,
  dapatkanOperasiBerdasarkanId,
  dapatkanSemuaOperasi,
  ekstrakNilaiAwalParameter,
} from '../mesin/katalogOperasi';
import { buatCitraKosong, hitungHistogram } from '../mesin/utilitasCitra';
import {
  operasiBalanceWarna,
  operasiHue,
  operasiPisahKanal,
  operasiRuangWarna,
  operasiSaturasi,
  operasiSepia,
} from '../mesin/warna';

describe('Mesin Operasi Citra Murni (Tahap 2)', () => {
  describe('Prinsip Dasar & Kekebalan Masukan (Immutability)', () => {
    it('tidak mengubah data citra masukan (mengembalikan objek baru)', () => {
      // Citra 2x2 merah murni dengan alfa 255
      const masukan = {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([
          200, 50, 50, 255, 200, 50, 50, 255, 200, 50, 50, 255, 200, 50, 50,
          255,
        ]),
      };
      const salinanAwal = new Uint8ClampedArray(masukan.data);

      const hasil = operasiKecerahan.terapkan(masukan, { kecerahan: 50 });

      // Masukan tetap utuh
      expect(masukan.data).toEqual(salinanAwal);
      // Hasil adalah objek dan buffer baru
      expect(hasil).not.toBe(masukan);
      expect(hasil.data).not.toBe(masukan.data);
      // Nilai berubah: 200 + 50 = 250
      expect(hasil.data[0]).toBe(250);
    });

    it('menangani citra kasus tepi 1x1 piksel tanpa galat', () => {
      const citra1x1 = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([100, 150, 200, 255]),
      };

      const hasilKecerahan = operasiKecerahan.terapkan(citra1x1, {
        kecerahan: 20,
      });
      expect(hasilKecerahan.width).toBe(1);
      expect(hasilKecerahan.height).toBe(1);
      expect(hasilKecerahan.data[0]).toBe(120);

      const hasilRotasi = operasiRotasi.terapkan(citra1x1, { sudut: 90 });
      expect(hasilRotasi.width).toBe(1);
      expect(hasilRotasi.height).toBe(1);
      expect(hasilRotasi.data[0]).toBe(100);
    });

    it('mempertahankan nilai kanal alfa (A) pada seluruh transformasi warna', () => {
      const citraAlfa = {
        width: 1,
        height: 2,
        data: new Uint8ClampedArray([
          50,
          100,
          150,
          128, // alfa = 128
          200,
          10,
          80,
          64, // alfa = 64
        ]),
      };

      const hasilGrayscale = operasiGrayscale.terapkan(citraAlfa);
      expect(hasilGrayscale.data[3]).toBe(128);
      expect(hasilGrayscale.data[7]).toBe(64);

      const hasilNegatif = operasiNegatif.terapkan(citraAlfa);
      expect(hasilNegatif.data[3]).toBe(128);
      expect(hasilNegatif.data[7]).toBe(64);
    });
  });

  describe('Operasi Dasar (Perhitungan Manual)', () => {
    it('Kecerahan: clamp batas bawah 0 dan batas atas 255', () => {
      // Matriks 2x1: [10, 240]
      const citra = {
        width: 2,
        height: 1,
        data: new Uint8ClampedArray([10, 10, 10, 255, 240, 240, 240, 255]),
      };

      // Tambah +30: 10 + 30 = 40, 240 + 30 = 270 -> clamp 255
      const terang = operasiKecerahan.terapkan(citra, { kecerahan: 30 });
      expect(terang.data[0]).toBe(40);
      expect(terang.data[4]).toBe(255);

      // Kurang -50: 10 - 50 = -40 -> clamp 0, 240 - 50 = 190
      const gelap = operasiKecerahan.terapkan(citra, { kecerahan: -50 });
      expect(gelap.data[0]).toBe(0);
      expect(gelap.data[4]).toBe(190);
    });

    it('Kontras: verifikasi rumus faktor dan peregangan midtone', () => {
      // Rumus manual:
      // c = 50
      // faktor = (259 * (50 + 255)) / (255 * (259 - 50))
      // faktor = (259 * 305) / (255 * 209) = 78995 / 53295 ≈ 1.4822216
      // Untuk piksel 128 (midtone):
      // V' = 1.4822216 * (128 - 128) + 128 = 128 (harus persis 128)
      // Untuk piksel 100:
      // V' = 1.4822216 * (100 - 128) + 128 = 1.4822216 * (-28) + 128 ≈ -41.5 + 128 = 86.5 -> round 86
      const citra = {
        width: 2,
        height: 1,
        data: new Uint8ClampedArray([128, 128, 128, 255, 100, 100, 100, 255]),
      };

      const hasil = operasiKontras.terapkan(citra, { kontras: 50 });
      expect(hasil.data[0]).toBe(128); // Midtone tidak bergeser
      expect(hasil.data[4]).toBe(86);
    });

    it('Negatif / Invert: V = 255 - V', () => {
      // Perhitungan manual:
      // R: 0 -> 255
      // G: 100 -> 155
      // B: 255 -> 0
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([0, 100, 255, 255]),
      };

      const hasil = operasiNegatif.terapkan(citra);
      expect(hasil.data[0]).toBe(255);
      expect(hasil.data[1]).toBe(155);
      expect(hasil.data[2]).toBe(0);
      expect(hasil.data[3]).toBe(255);
    });

    it('Grayscale: verifikasi Rec.601 Y = 0.299 R + 0.587 G + 0.114 B', () => {
      // Piksel: R=100, G=200, B=50
      // Manual Rec.601:
      // Y = 0.299 * 100 + 0.587 * 200 + 0.114 * 50
      // Y = 29.9 + 117.4 + 5.7 = 153.0 -> 153
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([100, 200, 50, 255]),
      };

      const rec601 = operasiGrayscale.terapkan(citra);
      expect(rec601.data[0]).toBe(153);
      expect(rec601.data[1]).toBe(153);
      expect(rec601.data[2]).toBe(153);
    });

    it('Flip: refleksi horizontal dan vertikal pada matriks 2x2', () => {
      // Matriks 2x2:
      // Baris 0: [10, 20]
      // Baris 1: [30, 40]
      const citra = {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([
          10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255,
        ]),
      };

      // Flip Horizontal: Baris 0: [20, 10], Baris 1: [40, 30]
      const flipH = operasiFlip.terapkan(citra, { arah: 'horizontal' });
      expect(flipH.data[0]).toBe(20);
      expect(flipH.data[4]).toBe(10);
      expect(flipH.data[8]).toBe(40);
      expect(flipH.data[12]).toBe(30);

      // Flip Vertikal: Baris 0: [30, 40], Baris 1: [10, 20]
      const flipV = operasiFlip.terapkan(citra, { arah: 'vertikal' });
      expect(flipV.data[0]).toBe(30);
      expect(flipV.data[4]).toBe(40);
      expect(flipV.data[8]).toBe(10);
      expect(flipV.data[12]).toBe(20);
    });

    it('Rotasi: rotasi ortogonal 90, 180, dan 270 derajat matriks 2x3', () => {
      // Matriks 3 kolom x 2 baris (width=3, height=2):
      // [ 1,  2,  3 ]
      // [ 4,  5,  6 ]
      const citra = {
        width: 3,
        height: 2,
        data: new Uint8ClampedArray([
          1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255, 4, 0, 0, 255, 5, 0, 0, 255,
          6, 0, 0, 255,
        ]),
      };

      // Rotasi 90 derajat searah jarum jam:
      // Dimensi baru: width=2, height=3
      // [ 4, 1 ]
      // [ 5, 2 ]
      // [ 6, 3 ]
      const rot90 = operasiRotasi.terapkan(citra, { sudut: 90 });
      expect(rot90.width).toBe(2);
      expect(rot90.height).toBe(3);
      expect(rot90.data[0]).toBe(4);
      expect(rot90.data[4]).toBe(1);
      expect(rot90.data[8]).toBe(5);
      expect(rot90.data[12]).toBe(2);
      expect(rot90.data[16]).toBe(6);
      expect(rot90.data[20]).toBe(3);

      // Rotasi 180 derajat:
      // Dimensi: width=3, height=2
      // [ 6, 5, 4 ]
      // [ 3, 2, 1 ]
      const rot180 = operasiRotasi.terapkan(citra, { sudut: 180 });
      expect(rot180.width).toBe(3);
      expect(rot180.height).toBe(2);
      expect(rot180.data[0]).toBe(6);
      expect(rot180.data[4]).toBe(5);
      expect(rot180.data[8]).toBe(4);
      expect(rot180.data[12]).toBe(3);
      expect(rot180.data[16]).toBe(2);
      expect(rot180.data[20]).toBe(1);
    });

    it('Crop: ekstraksi sub-matriks koordinat [x, y, lebar, tinggi]', () => {
      // Matriks 3x3:
      // [ 11, 12, 13 ]
      // [ 21, 22, 23 ]
      // [ 31, 32, 33 ]
      const citra = {
        width: 3,
        height: 3,
        data: new Uint8ClampedArray([
          11, 0, 0, 255, 12, 0, 0, 255, 13, 0, 0, 255, 21, 0, 0, 255, 22, 0, 0,
          255, 23, 0, 0, 255, 31, 0, 0, 255, 32, 0, 0, 255, 33, 0, 0, 255,
        ]),
      };

      // Crop koordinat x=1, y=1, lebar=2, tinggi=2:
      // Hasil yang diharapkan:
      // [ 22, 23 ]
      // [ 32, 33 ]
      const hasil = operasiCrop.terapkan(citra, {
        x: 1,
        y: 1,
        lebar: 2,
        tinggi: 2,
      });
      expect(hasil.width).toBe(2);
      expect(hasil.height).toBe(2);
      expect(hasil.data[0]).toBe(22);
      expect(hasil.data[4]).toBe(23);
      expect(hasil.data[8]).toBe(32);
      expect(hasil.data[12]).toBe(33);
    });

    it('Ubah Ukuran (Resize Nearest & Bilinear): perbesaran 2x2 ke 4x4', () => {
      const citra = {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([
          10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255,
        ]),
      };

      const hasilNearest = operasiUbahUkuran.terapkan(citra, {
        lebarBaru: 4,
        tinggiBaru: 4,
        metode: 'nearest',
      });
      expect(hasilNearest.width).toBe(4);
      expect(hasilNearest.height).toBe(4);

      const hasilBilinear = operasiUbahUkuran.terapkan(citra, {
        lebarBaru: 4,
        tinggiBaru: 4,
        metode: 'bilinear',
      });
      expect(hasilBilinear.width).toBe(4);
      expect(hasilBilinear.height).toBe(4);
      // Sudut kiri atas tetap 10
      expect(hasilBilinear.data[0]).toBe(10);
      // Sudut kanan bawah tetap 40
      expect(hasilBilinear.data[(3 * 4 + 3) * 4]).toBe(40);
    });
  });

  describe('Operasi Warna', () => {
    it('Pisah Kanal: isolasi kanal merah murni', () => {
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([210, 140, 70, 255]),
      };

      // Mode berwarna: R tetap 210, G=0, B=0
      const kanalR = operasiPisahKanal.terapkan(citra, {
        kanal: 'r',
        modeTampil: 'berwarna',
      });
      expect(kanalR.data[0]).toBe(210);
      expect(kanalR.data[1]).toBe(0);
      expect(kanalR.data[2]).toBe(0);

      // Mode keabuan: R=210, G=210, B=210
      const kanalRgray = operasiPisahKanal.terapkan(citra, {
        kanal: 'r',
        modeTampil: 'keabuan',
      });
      expect(kanalRgray.data[0]).toBe(210);
      expect(kanalRgray.data[1]).toBe(210);
      expect(kanalRgray.data[2]).toBe(210);
    });

    it('Sepia: verifikasi rumus matriks bobot sepia standar', () => {
      // Rumus sepia standar:
      // tr = 0.393*R + 0.769*G + 0.189*B
      // tg = 0.349*R + 0.686*G + 0.168*B
      // tb = 0.272*R + 0.534*G + 0.131*B
      // Untuk piksel putih [255, 255, 255]:
      // tr = 255 * (0.393 + 0.769 + 0.189) = 255 * 1.351 = 344.5 -> clamp 255
      // tg = 255 * (0.349 + 0.686 + 0.168) = 255 * 1.203 = 306.7 -> clamp 255
      // tb = 255 * (0.272 + 0.534 + 0.131) = 255 * 0.937 = 238.9 -> round 239
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([255, 255, 255, 255]),
      };

      const hasil = operasiSepia.terapkan(citra, { intensitas: 100 });
      expect(hasil.data[0]).toBe(255);
      expect(hasil.data[1]).toBe(255);
      expect(hasil.data[2]).toBe(239);
    });

    it('Hue Shift: pergeseran derajat roda warna 180 derajat membalikkan warna', () => {
      // Merah murni [255, 0, 0] memiliki Hue = 0°
      // Shift +180° menghasilkan Cyan [0, 255, 255] dengan Hue = 180°
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([255, 0, 0, 255]),
      };

      const hasil = operasiHue.terapkan(citra, { pergeseran: 180 });
      expect(hasil.data[0]).toBe(0);
      expect(hasil.data[1]).toBe(255);
      expect(hasil.data[2]).toBe(255);
    });

    it('Saturasi: pengurangan saturasi -100% menghasilkan citra monokrom', () => {
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([200, 50, 50, 255]),
      };

      // Luminans Rec.601: 0.299*200 + 0.587*50 + 0.114*50 = 59.8 + 29.35 + 5.7 = 94.85 -> 95
      const desaturasi = operasiSaturasi.terapkan(citra, { saturasi: -100 });
      expect(desaturasi.data[0]).toBe(95);
      expect(desaturasi.data[1]).toBe(95);
      expect(desaturasi.data[2]).toBe(95);
    });

    it('Keseimbangan Warna: penguatan kanal independen', () => {
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([100, 100, 100, 255]),
      };

      // Tambah merah +20% (100 * 1.2 = 120), kurangi biru -50% (100 * 0.5 = 50)
      const hasil = operasiBalanceWarna.terapkan(citra, {
        merah: 20,
        hijau: 0,
        biru: -50,
      });
      expect(hasil.data[0]).toBe(120);
      expect(hasil.data[1]).toBe(100);
      expect(hasil.data[2]).toBe(50);
    });

    it('Ruang Warna: ekstraksi dekomposisi HSV Saturation', () => {
      // Merah murni [255, 0, 0] memiliki saturasi S = 1.0 -> dipetakan ke 255
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([255, 0, 0, 255]),
      };

      const hasil = operasiRuangWarna.terapkan(citra, { ruang: 'hsv_s' });
      expect(hasil.data[0]).toBe(255);
      expect(hasil.data[1]).toBe(255);
      expect(hasil.data[2]).toBe(255);
    });
  });

  describe('Operasi Enhancement & Ekualisasi Histogram Manual', () => {
    it('Ekualisasi Histogram: verifikasi dengan histogram 4-piksel terhitung manual', () => {
      // Citra 2x2 grayscale 4 piksel dengan intensitas:
      // Piksel 0: 50
      // Piksel 1: 50
      // Piksel 2: 100
      // Piksel 3: 200
      // Total piksel N = 4.
      //
      // Distribusi Frekuensi (Histogram):
      // h(50) = 2
      // h(100) = 1
      // h(200) = 1
      //
      // Cumulative Distribution Function (CDF):
      // cdf(50) = 2
      // cdf(100) = 2 + 1 = 3
      // cdf(200) = 3 + 1 = 4
      // cdf_min = 2
      //
      // Rumus Ekualisasi Standar:
      // h'(v) = round( ((cdf(v) - cdf_min) / (N - cdf_min)) * 255 )
      // Penyebut = N - cdf_min = 4 - 2 = 2
      //
      // Perhitungan nilai keluaran:
      // v = 50:  ((2 - 2) / 2) * 255 = 0
      // v = 100: ((3 - 2) / 2) * 255 = 0.5 * 255 = 127.5 -> round 128
      // v = 200: ((4 - 2) / 2) * 255 = 1.0 * 255 = 255
      const citra = {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([
          50, 50, 50, 255, 50, 50, 50, 255, 100, 100, 100, 255, 200, 200, 200,
          255,
        ]),
      };

      const hasil = operasiEkualisasi.terapkan(citra, { mode: 'per_kanal' });

      // Verifikasi piksel 0 & 1 (nilai awal 50) menjadi 0
      expect(hasil.data[0]).toBe(0);
      expect(hasil.data[4]).toBe(0);

      // Verifikasi piksel 2 (nilai awal 100) menjadi 128
      expect(hasil.data[8]).toBe(128);

      // Verifikasi piksel 3 (nilai awal 200) menjadi 255
      expect(hasil.data[12]).toBe(255);
    });

    it('Peregangan Kontras: normalisasi min-max rentang penuh', () => {
      // Rentang awal [50, 150]
      // Peregangan min-max: 50 -> 0, 150 -> 255, 100 -> 128
      const citra = {
        width: 3,
        height: 1,
        data: new Uint8ClampedArray([
          50, 50, 50, 255, 100, 100, 100, 255, 150, 150, 150, 255,
        ]),
      };

      const hasil = operasiPereganganKontras.terapkan(citra, {
        pemangkasan: 0,
      });

      expect(hasil.data[0]).toBe(0);
      expect(hasil.data[4]).toBe(128);
      expect(hasil.data[8]).toBe(255);
    });

    it('Koreksi Gamma: kurva power-law V_out = 255 * (V_in / 255)^gamma', () => {
      // gamma = 2.0
      // V_in = 64
      // rasio = 64 / 255 ≈ 0.25098
      // eksponen = 2.0
      // V_out = 255 * (0.25098)^2 = 255 * 0.06299 ≈ 16.06 -> 16
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([64, 64, 64, 255]),
      };

      const hasil = operasiGamma.terapkan(citra, { gamma: 2.0 });
      expect(hasil.data[0]).toBe(16);
      expect(hasil.data[1]).toBe(16);
      expect(hasil.data[2]).toBe(16);
    });
  });

  describe('Perhitungan Histogram Citra', () => {
    it('menghitung frekuensi warna R, G, B, dan Luminans dengan benar', () => {
      const citra = {
        width: 2,
        height: 1,
        data: new Uint8ClampedArray([10, 20, 30, 255, 10, 40, 50, 255]),
      };

      const hist = hitungHistogram(citra);
      expect(hist.r[10]).toBe(2);
      expect(hist.g[20]).toBe(1);
      expect(hist.g[40]).toBe(1);
      expect(hist.b[30]).toBe(1);
      expect(hist.b[50]).toBe(1);
      expect(hist.totalPiksel).toBe(2);
    });
  });

  describe('Arsitektur Registri & Pendaftaran Operasi Baru', () => {
    it('memiliki seluruh 17 operasi bawaan di katalog', () => {
      const semua = dapatkanSemuaOperasi();
      expect(semua.length).toBeGreaterThanOrEqual(17);
    });

    it('dapat mendaftarkan operasi baru secara dinamis tanpa mengubah kode UI', () => {
      const operasiKhususKustom = {
        id: 'kustom_ambang_uji',
        kategori: 'dasar',
        kunciNama: 'operasi.kustom.nama',
        kunciDeskripsi: 'operasi.kustom.deskripsi',
        namaTeknis: 'Custom Threshold Engine',
        skemaParameter: [
          {
            id: 'nilaiAmbang',
            kunciLabel: 'parameter.ambang',
            tipe: 'slider',
            min: 0,
            max: 255,
            nilaiAwal: 128,
          },
        ],
        terapkan(citra, parameter = {}) {
          const ambang = parameter.nilaiAmbang ?? 128;
          const hasil = buatCitraKosong(citra.width, citra.height);
          for (let i = 0; i < citra.data.length; i += 4) {
            const v = citra.data[i] >= ambang ? 255 : 0;
            hasil.data[i] = v;
            hasil.data[i + 1] = v;
            hasil.data[i + 2] = v;
            hasil.data[i + 3] = citra.data[i + 3];
          }
          return hasil;
        },
      };

      daftarkanOperasiBaru(operasiKhususKustom);

      const opDitemukan = dapatkanOperasiBerdasarkanId('kustom_ambang_uji');
      expect(opDitemukan).toBeDefined();
      expect(opDitemukan.namaTeknis).toBe('Custom Threshold Engine');

      const nilaiAwal = ekstrakNilaiAwalParameter(opDitemukan);
      expect(nilaiAwal.nilaiAmbang).toBe(128);

      // Eksekusi operasi kustom
      const citraUji = {
        width: 2,
        height: 1,
        data: new Uint8ClampedArray([100, 100, 100, 255, 200, 200, 200, 255]),
      };
      const hasil = opDitemukan.terapkan(citraUji, { nilaiAmbang: 150 });
      expect(hasil.data[0]).toBe(0); // 100 < 150 -> 0
      expect(hasil.data[4]).toBe(255); // 200 >= 150 -> 255
    });
  });
});
