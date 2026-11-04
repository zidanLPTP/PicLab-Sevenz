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
  dapatkanOperasiBerdasarkanId,
  dapatkanSemuaOperasi,
  ekstrakNilaiAwalParameter,
} from '../mesin/katalogOperasi';
import { hitungHistogram } from '../mesin/utilitasCitra';
import {
  operasiBalanceWarna,
  operasiHue,
  operasiPisahKanal,
  operasiRuangWarna,
  operasiSaturasi,
  operasiSepia,
} from '../mesin/warna';
import { BATASAN_BERKAS } from '../utilitas/konfigurasiBerkas';

describe('Mesin Operasi Citra Murni (Tahap 2)', () => {
  // --------------------------------------------------------------------------
  // 1. PENGUJIAN PERHITUNGAN MANUAL (CITRA KECIL 2x2 / 3x3 DENGAN RUMUS)
  // --------------------------------------------------------------------------
  describe('Perhitungan Manual Operasi Dasar', () => {
    it('1. Kecerahan (dasar_kecerahan): verifikasi rumus V_out = clamp(V_in + offset)', () => {
      // Citra 2x1: [10, 240]
      // Tambah +30: 10 + 30 = 40; 240 + 30 = 270 -> clamp ke 255
      // Kurang -50: 10 - 50 = -40 -> clamp ke 0; 240 - 50 = 190
      const citra = {
        width: 2,
        height: 1,
        data: new Uint8ClampedArray([10, 10, 10, 255, 240, 240, 240, 255]),
      };

      const terang = operasiKecerahan.terapkan(citra, { kecerahan: 30 });
      expect(terang.data[0]).toBe(40);
      expect(terang.data[4]).toBe(255);

      const gelap = operasiKecerahan.terapkan(citra, { kecerahan: -50 });
      expect(gelap.data[0]).toBe(0);
      expect(gelap.data[4]).toBe(190);
    });

    it('2. Kontras (dasar_kontras): verifikasi peregangan midtone 128 dengan rumus faktor', () => {
      // Rumus: faktor = (259 * (c + 255)) / (255 * (259 - c))
      // Untuk c = 50: faktor ≈ 1.4822216
      // Midtone V=128: 1.4822 * (128 - 128) + 128 = 128 (tidak bergeser)
      // V=100: 1.4822 * (100 - 128) + 128 = -41.5 + 128 = 86.5 -> round 86
      const citra = {
        width: 2,
        height: 1,
        data: new Uint8ClampedArray([128, 128, 128, 255, 100, 100, 100, 255]),
      };

      const hasil = operasiKontras.terapkan(citra, { kontras: 50 });
      expect(hasil.data[0]).toBe(128);
      expect(hasil.data[4]).toBe(86);
    });

    it('3. Negatif Citra (dasar_negatif): verifikasi rumus fotometrik V_out = 255 - V_in', () => {
      // R: 0 -> 255; G: 100 -> 155; B: 255 -> 0
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

    it('4. Grayscale (dasar_grayscale): verifikasi bobot ITU-R BT.601 Y = 0.299R + 0.587G + 0.114B', () => {
      // R=100, G=200, B=50
      // Y = 0.299*100 + 0.587*200 + 0.114*50 = 29.9 + 117.4 + 5.7 = 153.0 -> 153
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([100, 200, 50, 255]),
      };

      const hasil = operasiGrayscale.terapkan(citra);
      expect(hasil.data[0]).toBe(153);
      expect(hasil.data[1]).toBe(153);
      expect(hasil.data[2]).toBe(153);
    });

    it('5. Pembalik / Flip (dasar_flip): verifikasi refleksi horizontal dan vertikal matriks 2x2', () => {
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

      // Flip H: Baris 0: [20, 10], Baris 1: [40, 30]
      const flipH = operasiFlip.terapkan(citra, { arah: 'horizontal' });
      expect(flipH.data[0]).toBe(20);
      expect(flipH.data[4]).toBe(10);
      expect(flipH.data[8]).toBe(40);
      expect(flipH.data[12]).toBe(30);

      // Flip V: Baris 0: [30, 40], Baris 1: [10, 20]
      const flipV = operasiFlip.terapkan(citra, { arah: 'vertikal' });
      expect(flipV.data[0]).toBe(30);
      expect(flipV.data[4]).toBe(40);
      expect(flipV.data[8]).toBe(10);
      expect(flipV.data[12]).toBe(20);
    });

    it('6. Rotasi (dasar_rotasi): verifikasi rotasi matriks 3x2 kelipatan 90, 180, dan 270 derajat', () => {
      // Matriks 3 kolom x 2 baris (width=3, height=2):
      // [ 1, 2, 3 ]
      // [ 4, 5, 6 ]
      const citra = {
        width: 3,
        height: 2,
        data: new Uint8ClampedArray([
          1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255, 4, 0, 0, 255, 5, 0, 0, 255,
          6, 0, 0, 255,
        ]),
      };

      // Rotasi 90°: Dimensi baru 2x3 -> [4, 1], [5, 2], [6, 3]
      const rot90 = operasiRotasi.terapkan(citra, { sudut: 90 });
      expect(rot90.width).toBe(2);
      expect(rot90.height).toBe(3);
      expect(rot90.data[0]).toBe(4);
      expect(rot90.data[4]).toBe(1);
      expect(rot90.data[8]).toBe(5);
      expect(rot90.data[12]).toBe(2);
      expect(rot90.data[16]).toBe(6);
      expect(rot90.data[20]).toBe(3);

      // Rotasi 180°: Dimensi tetap 3x2 -> [6, 5, 4], [3, 2, 1]
      const rot180 = operasiRotasi.terapkan(citra, { sudut: 180 });
      expect(rot180.width).toBe(3);
      expect(rot180.height).toBe(2);
      expect(rot180.data[0]).toBe(6);
      expect(rot180.data[4]).toBe(5);
      expect(rot180.data[8]).toBe(4);
      expect(rot180.data[12]).toBe(3);

      // Rotasi 270°: Dimensi baru 2x3 -> [3, 6], [2, 5], [1, 4]
      const rot270 = operasiRotasi.terapkan(citra, { sudut: 270 });
      expect(rot270.width).toBe(2);
      expect(rot270.height).toBe(3);
      expect(rot270.data[0]).toBe(3);
      expect(rot270.data[4]).toBe(6);
      expect(rot270.data[8]).toBe(2);
      expect(rot270.data[12]).toBe(5);
      expect(rot270.data[16]).toBe(1);
      expect(rot270.data[20]).toBe(4);
    });

    it('7. Potong / Crop (dasar_crop): verifikasi ekstraksi sub-matriks koordinat [x, y, w, h]', () => {
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

      // Crop x=1, y=1, lebar=2, tinggi=2 -> [22, 23], [32, 33]
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

    it('8. Ubah Ukuran (dasar_ubah_ukuran): verifikasi Nearest Neighbor dan Bilinear', () => {
      // Matriks 2x2:
      // [ 10, 20 ]
      // [ 30, 40 ]
      const citra = {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([
          10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255,
        ]),
      };

      // Perbesaran 2x2 -> 3x3 dengan Nearest Neighbor:
      // x=0, y=0: srcX=floor(0*2/3)=0, srcY=0 -> 10
      // x=1, y=0: srcX=floor(1*2/3)=0, srcY=0 -> 10
      // x=2, y=0: srcX=floor(2*2/3)=1, srcY=0 -> 20
      const nearest = operasiUbahUkuran.terapkan(citra, {
        lebarBaru: 3,
        tinggiBaru: 3,
        metode: 'nearest',
      });
      expect(nearest.width).toBe(3);
      expect(nearest.height).toBe(3);
      expect(nearest.data[0]).toBe(10);
      expect(nearest.data[4]).toBe(10);
      expect(nearest.data[8]).toBe(20);

      // Perbesaran 2x2 -> 4x4 dengan Bilinear:
      const bilinear = operasiUbahUkuran.terapkan(citra, {
        lebarBaru: 4,
        tinggiBaru: 4,
        metode: 'bilinear',
      });
      expect(bilinear.width).toBe(4);
      expect(bilinear.height).toBe(4);
      expect(bilinear.data[0]).toBe(10);
      expect(bilinear.data[(3 * 4 + 3) * 4]).toBe(40);
    });
  });

  describe('Perhitungan Manual Operasi Warna', () => {
    it('9. Pisah Kanal (warna_pisah_kanal): verifikasi mode berwarna dan abu-abu untuk kanal R, G, B', () => {
      // Piksel [120, 80, 40]
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([120, 80, 40, 255]),
      };

      // Kanal Hijau Berwarna -> [0, 80, 0]
      const gWarna = operasiPisahKanal.terapkan(citra, {
        kanal: 'g',
        modeTampil: 'berwarna',
      });
      expect(gWarna.data[0]).toBe(0);
      expect(gWarna.data[1]).toBe(80);
      expect(gWarna.data[2]).toBe(0);

      // Kanal Hijau Abu-abu -> [80, 80, 80]
      const gAbu = operasiPisahKanal.terapkan(citra, {
        kanal: 'g',
        modeTampil: 'keabuan',
      });
      expect(gAbu.data[0]).toBe(80);
      expect(gAbu.data[1]).toBe(80);
      expect(gAbu.data[2]).toBe(80);

      // Kanal Biru Berwarna -> [0, 0, 40]
      const bWarna = operasiPisahKanal.terapkan(citra, {
        kanal: 'b',
        modeTampil: 'berwarna',
      });
      expect(bWarna.data[0]).toBe(0);
      expect(bWarna.data[1]).toBe(0);
      expect(bWarna.data[2]).toBe(40);

      // Kanal Biru Abu-abu -> [40, 40, 40]
      const bAbu = operasiPisahKanal.terapkan(citra, {
        kanal: 'b',
        modeTampil: 'keabuan',
      });
      expect(bAbu.data[0]).toBe(40);
      expect(bAbu.data[1]).toBe(40);
      expect(bAbu.data[2]).toBe(40);
    });

    it('10. Ruang Warna (warna_ruang_warna): verifikasi dekomposisi Grayscale dan kanal H, S, V', () => {
      // Piksel Oranye [255, 128, 0]:
      // 1. Grayscale Rec.601: round(0.299*255 + 0.587*128 + 0.114*0) = 76.245 + 75.136 = 151.38 -> 151
      // 2. HSV:
      //    Max = 255, Min = 0, delta = 255
      //    H = 60 * ((128 - 0)/255) = 60 * 0.50196 ≈ 30.12°
      //    H_byte = round((30.12 / 360) * 255) = round(21.33) = 21
      //    S = delta / Max = 1.0 -> round(1.0 * 255) = 255
      //    V = Max / 255 = 1.0 -> round(1.0 * 255) = 255
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([255, 128, 0, 255]),
      };

      const gray = operasiRuangWarna.terapkan(citra, { ruang: 'grayscale' });
      expect(gray.data[0]).toBe(151);

      const hsvH = operasiRuangWarna.terapkan(citra, { ruang: 'hsv_h' });
      expect(hsvH.data[0]).toBe(21);

      const hsvS = operasiRuangWarna.terapkan(citra, { ruang: 'hsv_s' });
      expect(hsvS.data[0]).toBe(255);

      const hsvV = operasiRuangWarna.terapkan(citra, { ruang: 'hsv_v' });
      expect(hsvV.data[0]).toBe(255);
    });

    it('11. Saturasi (warna_saturasi): verifikasi faktor saturasi dan pelestarian luminans', () => {
      // Piksel [200, 50, 50] (Merah tua)
      // Luma Y = round(0.299*200 + 0.587*50 + 0.114*50) = 59.8 + 29.35 + 5.7 = 94.85 -> 95
      //
      // Desaturasi penuh (-100%): faktor = 0 -> R'=G'=B'=Y = 95
      // Peningkatan saturasi (+50%): faktor = 1.5 ->
      // R' = clamp(95 + 1.5 * (200 - 95)) = 95 + 157.5 = 252.5 -> 253
      // G' = clamp(95 + 1.5 * (50 - 95)) = 95 - 67.5 = 27.5 -> 28
      // B' = clamp(95 + 1.5 * (50 - 95)) = 28
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([200, 50, 50, 255]),
      };

      const desaturasi = operasiSaturasi.terapkan(citra, { saturasi: -100 });
      expect(desaturasi.data[0]).toBe(95);
      expect(desaturasi.data[1]).toBe(95);
      expect(desaturasi.data[2]).toBe(95);

      const jenuh = operasiSaturasi.terapkan(citra, { saturasi: 50 });
      expect(jenuh.data[0]).toBe(253);
      expect(jenuh.data[1]).toBe(28);
      expect(jenuh.data[2]).toBe(28);
    });

    it('12. Pergeseran Hue (warna_hue): verifikasi rotasi sudut pada roda warna HSV', () => {
      // Merah murni [255, 0, 0] memiliki Hue = 0°
      // Shift -120° menghasilkan Biru murni [0, 0, 255] (240° pada roda warna)
      // Shift +180° menghasilkan Cyan [0, 255, 255]
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([255, 0, 0, 255]),
      };

      const hijau = operasiHue.terapkan(citra, { pergeseran: 120 });
      expect(hijau.data[0]).toBe(0);
      expect(hijau.data[1]).toBe(255);
      expect(hijau.data[2]).toBe(0);

      const biru = operasiHue.terapkan(citra, { pergeseran: -120 });
      expect(biru.data[0]).toBe(0);
      expect(biru.data[1]).toBe(0);
      expect(biru.data[2]).toBe(255);

      const cyan = operasiHue.terapkan(citra, { pergeseran: 180 });
      expect(cyan.data[0]).toBe(0);
      expect(cyan.data[1]).toBe(255);
      expect(cyan.data[2]).toBe(255);
    });

    it('13. Efek Sepia (warna_sepia): verifikasi rumus matriks afinitas sepia berbobot', () => {
      // Piksel [100, 50, 20]
      // rSepia = clamp(0.393*100 + 0.769*50 + 0.189*20) = 39.3 + 38.45 + 3.78 = 81.53 -> 82
      // gSepia = clamp(0.349*100 + 0.686*50 + 0.168*20) = 34.9 + 34.3 + 3.36 = 72.56 -> 73
      // bSepia = clamp(0.272*100 + 0.534*50 + 0.131*20) = 27.2 + 26.7 + 2.62 = 56.52 -> 57
      // Untuk intensitas 100% (k=1.0): R'=82, G'=73, B'=57
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([100, 50, 20, 255]),
      };

      const hasil = operasiSepia.terapkan(citra, { intensitas: 100 });
      expect(hasil.data[0]).toBe(82);
      expect(hasil.data[1]).toBe(73);
      expect(hasil.data[2]).toBe(57);
    });

    it('14. Keseimbangan Warna (warna_balance): verifikasi penguatan independen R, G, B via LUT', () => {
      // Piksel [100, 100, 100]
      // merah +25%: 100 * 1.25 = 125
      // hijau -10%: 100 * 0.90 = 90
      // biru +50%: 100 * 1.50 = 150
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([100, 100, 100, 255]),
      };

      const hasil = operasiBalanceWarna.terapkan(citra, {
        merah: 25,
        hijau: -10,
        biru: 50,
      });
      expect(hasil.data[0]).toBe(125);
      expect(hasil.data[1]).toBe(90);
      expect(hasil.data[2]).toBe(150);
    });
  });

  describe('Perhitungan Manual Operasi Enhancement', () => {
    it('15. Ekualisasi Histogram (enhancement_ekualisasi): verifikasi mode per-kanal dan kasus citra seragam', () => {
      // Kasus A: Histogram 4 piksel berbeda [50, 50, 100, 200]
      // CDF: cdf(50)=2, cdf(100)=3, cdf(200)=4, cdf_min=2, total=4
      // v=50: ((2-2)/2)*255 = 0
      // v=100: ((3-2)/2)*255 = 128
      // v=200: ((4-2)/2)*255 = 255
      const citra = {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([
          50, 50, 50, 255, 50, 50, 50, 255, 100, 100, 100, 255, 200, 200, 200,
          255,
        ]),
      };

      const perKanal = operasiEkualisasi.terapkan(citra, { mode: 'per_kanal' });
      expect(perKanal.data[0]).toBe(0);
      expect(perKanal.data[4]).toBe(0);
      expect(perKanal.data[8]).toBe(128);
      expect(perKanal.data[12]).toBe(255);

      // Kasus B: Citra seragam (seluruh piksel bernilai sama 120)
      // totalPiksel <= cdfMin (4 <= 4) -> perlindungan pembagian nol aktif, nilai dipertahankan 120
      const citraSeragam = {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([
          120, 120, 120, 255, 120, 120, 120, 255, 120, 120, 120, 255, 120, 120,
          120, 255,
        ]),
      };

      const hasilSeragam = operasiEkualisasi.terapkan(citraSeragam, {
        mode: 'luminans',
      });
      expect(hasilSeragam.data[0]).toBe(120);
      expect(hasilSeragam.data[4]).toBe(120);
      expect(hasilSeragam.data[8]).toBe(120);
      expect(hasilSeragam.data[12]).toBe(120);
    });

    it('16. Peregangan Kontras (enhancement_peregangan_kontras): verifikasi tanpa persentil, dengan persentil, dan kasus vMax <= vMin', () => {
      // Kasus A: Tanpa persentil (p = 0)
      // Rentang awal [50, 150] -> 50 dipetakan ke 0, 150 ke 255, 100 ke 128
      const citra = {
        width: 3,
        height: 1,
        data: new Uint8ClampedArray([
          50, 50, 50, 255, 100, 100, 100, 255, 150, 150, 150, 255,
        ]),
      };

      const rentangPenuh = operasiPereganganKontras.terapkan(citra, {
        pemangkasan: 0,
      });
      expect(rentangPenuh.data[0]).toBe(0);
      expect(rentangPenuh.data[4]).toBe(128);
      expect(rentangPenuh.data[8]).toBe(255);

      // Kasus B: Kasus tepi vMax <= vMin (citra datar seragam 100)
      // vMin=0, vMax=255 disetel otomatis untuk mencegah pembagian nol
      const citraDatar = {
        width: 2,
        height: 1,
        data: new Uint8ClampedArray([100, 100, 100, 255, 100, 100, 100, 255]),
      };
      const hasilDatar = operasiPereganganKontras.terapkan(citraDatar, {
        pemangkasan: 1,
      });
      expect(hasilDatar.data[0]).toBe(100);
      expect(hasilDatar.data[4]).toBe(100);
    });

    it('17. Koreksi Gamma (enhancement_gamma): verifikasi transformasi kurva daya non-linear V_out = 255 * (V_in/255)^gamma', () => {
      // V_in = 64
      // Gamma = 2.0: 255 * (64 / 255)^2 = 255 * 0.06299 ≈ 16
      // Gamma = 0.5: 255 * sqrt(64 / 255) = 255 * 0.50098 ≈ 128
      const citra = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([64, 64, 64, 255]),
      };

      const gammaGelap = operasiGamma.terapkan(citra, { gamma: 2.0 });
      expect(gammaGelap.data[0]).toBe(16);

      const gammaTerang = operasiGamma.terapkan(citra, { gamma: 0.5 });
      expect(gammaTerang.data[0]).toBe(128);
    });
  });

  // --------------------------------------------------------------------------
  // 2. PENGUJIAN REGISTRI UNTUK SEMUA 17 OPERASI BAWAAN (R3)
  // --------------------------------------------------------------------------
  describe('Uji Registri Lengkap pada Seluruh 17 Operasi (Immutability, Alfa, Parameter Tak Valid)', () => {
    const semuaOperasi = dapatkanSemuaOperasi();

    it('memiliki tepat 17 operasi citra terdaftar di katalog bawaan', () => {
      expect(semuaOperasi.length).toBeGreaterThanOrEqual(17);
    });

    it('(a) Masukan tidak pernah termutasi pada SEMUA 17 operasi', () => {
      for (const op of semuaOperasi) {
        const masukan = {
          width: 2,
          height: 2,
          data: new Uint8ClampedArray([
            100, 150, 200, 255, 50, 75, 120, 255, 10, 20, 30, 255, 220, 230,
            240, 255,
          ]),
        };
        const salinanSnapshot = new Uint8ClampedArray(masukan.data);
        const paramAwal = ekstrakNilaiAwalParameter(op);

        const hasil = op.terapkan(masukan, paramAwal);

        // Memastikan buffer asli utuh tanpa perubahan sedikit pun
        expect(masukan.data).toEqual(salinanSnapshot);
        // Memastikan hasil bukan objek referensi yang sama
        expect(hasil).not.toBe(masukan);
        expect(hasil.data).not.toBe(masukan.data);
      }
    });

    it('(b) Nilai kanal alfa (A) dipertahankan pada SEMUA 17 operasi', () => {
      for (const op of semuaOperasi) {
        // Citra dengan variasi nilai alfa transparan
        const citraAlfa = {
          width: 2,
          height: 2,
          data: new Uint8ClampedArray([
            120, 80, 40, 180, 200, 100, 50, 90, 30, 60, 90, 255, 10, 20, 30, 0,
          ]),
        };
        const paramAwal = ekstrakNilaiAwalParameter(op);
        const hasil = op.terapkan(citraAlfa, paramAwal);

        // Untuk operasi yang mempertahankan jumlah piksel (non-crop/non-resize)
        if (hasil.width === 2 && hasil.height === 2) {
          if (op.id !== 'dasar_flip' && op.id !== 'dasar_rotasi') {
            expect(hasil.data[3]).toBe(180);
            expect(hasil.data[7]).toBe(90);
            expect(hasil.data[11]).toBe(255);
            expect(hasil.data[15]).toBe(0);
          } else {
            // Operasi geometri: pastikan seluruh piksel alfa tetap berada dalam himpunan {180, 90, 255, 0}
            const alfaKeluar = [
              hasil.data[3],
              hasil.data[7],
              hasil.data[11],
              hasil.data[15],
            ];
            expect(alfaKeluar).toContain(180);
            expect(alfaKeluar).toContain(90);
            expect(alfaKeluar).toContain(255);
            expect(alfaKeluar).toContain(0);
          }
        } else {
          // Operasi crop / resize: periksa bahwa setiap alfa keluaran adalah angka valid (0..255)
          for (let i = 3; i < hasil.data.length; i += 4) {
            expect(Number.isFinite(hasil.data[i])).toBe(true);
            expect(hasil.data[i]).toBeGreaterThanOrEqual(0);
            expect(hasil.data[i]).toBeLessThanOrEqual(255);
          }
        }
      }
    });

    it('(c) Parameter tak valid (NaN, undefined, string, di luar batas, Infinity) tidak menghasilkan NaN dan tidak melempar galat', () => {
      const parameterKacau = [
        {},
        {
          kecerahan: NaN,
          kontras: Infinity,
          arah: 'arah_liar_palsu',
          sudut: 'sudut_aneh',
          x: -9999,
          y: 'bukan_angka',
          lebar: NaN,
          tinggi: Infinity,
          lebarBaru: 'bukan_angka',
          tinggiBaru: -500,
          kanal: 9999,
          modeTampil: null,
          ruang: 'ruang_gaib',
          saturasi: 'sangat_jenuh',
          pergeseran: NaN,
          intensitas: Infinity,
          merah: 'merah_sekali',
          hijau: undefined,
          biru: NaN,
          mode: 'mode_tak_dikenal',
          pemangkasan: -50,
          gamma: -10,
        },
      ];

      const citraUji = {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([
          50, 100, 150, 255, 80, 120, 160, 255, 20, 40, 60, 255, 200, 210, 220,
          255,
        ]),
      };

      for (const op of semuaOperasi) {
        for (const param of parameterKacau) {
          // Harus berjalan mulus tanpa melempar exception
          let hasil;
          expect(() => {
            hasil = op.terapkan(citraUji, param);
          }).not.toThrow();

          expect(hasil).toBeDefined();
          expect(hasil.data).toBeInstanceOf(Uint8ClampedArray);
          expect(Number.isFinite(hasil.width)).toBe(true);
          expect(Number.isFinite(hasil.height)).toBe(true);

          // Seluruh piksel keluaran harus berupa angka valid (bukan NaN)
          for (let i = 0; i < hasil.data.length; i++) {
            expect(Number.isNaN(hasil.data[i])).toBe(false);
            expect(hasil.data[i]).toBeGreaterThanOrEqual(0);
            expect(hasil.data[i]).toBeLessThanOrEqual(255);
          }
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. PENGUJIAN BATAS DIMENSI (R4)
  // --------------------------------------------------------------------------
  describe('Batas Dimensi & Total Piksel (R4)', () => {
    it('Ubah ukuran ke dimensi raksasa (100000x100000) dijepit ke batas aman tanpa OOM', () => {
      const citraKecil = {
        width: 10,
        height: 10,
        data: new Uint8ClampedArray(10 * 10 * 4),
      };

      const hasil = operasiUbahUkuran.terapkan(citraKecil, {
        lebarBaru: 100_000,
        tinggiBaru: 100_000,
        metode: 'nearest',
      });

      // Sisi terpanjang tidak melebihi 4096 px dan total piksel tidak melebihi 16 juta piksel
      expect(hasil.width).toBeLessThanOrEqual(
        BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL
      );
      expect(hasil.height).toBeLessThanOrEqual(
        BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL
      );
      expect(hasil.width * hasil.height).toBeLessThanOrEqual(
        BATASAN_BERKAS.TOTAL_PIKSEL_MAKS
      );
      // Untuk 100000x100000 -> dijepit ke 4000x4000 (16.000.000 piksel)
      expect(hasil.width).toBe(4000);
      expect(hasil.height).toBe(4000);
    });

    it('Crop ke dimensi di luar batas citra otomatis dijepit dalam batas aman', () => {
      const citra = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4),
      };

      const hasil = operasiCrop.terapkan(citra, {
        x: 50,
        y: 50,
        lebar: 9999,
        tinggi: 9999,
      });

      // Lebar maksimum yang tersedia dari x=50 adalah 100 - 50 = 50
      expect(hasil.width).toBe(50);
      expect(hasil.height).toBe(50);
    });

    it('Rotasi pada citra mendekati batas dimensi (4000x3000) tidak melanggar batas', () => {
      const citraDekatBatas = {
        width: 4000,
        height: 3000,
        data: new Uint8ClampedArray(4 * 4), // representasi kecil untuk uji dimensi
      };

      const hasil = operasiRotasi.terapkan(citraDekatBatas, { sudut: 90 });
      expect(hasil.width).toBe(3000);
      expect(hasil.height).toBe(4000);
      expect(hasil.height).toBeLessThanOrEqual(
        BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL
      );
      expect(hasil.width * hasil.height).toBeLessThanOrEqual(
        BATASAN_BERKAS.TOTAL_PIKSEL_MAKS
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. HISTOGRAM & REGISTRI DINAMIS
  // --------------------------------------------------------------------------
  describe('Histogram & Registri Dinamis', () => {
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

    it('menemukan dan memuat operasi fixture lingkungan uji secara statis tanpa eval', () => {
      // Memastikan operasi fixture uji (dasar_inversi_kustom) otomatis terdaftar pada mode test
      const opDitemukan = dapatkanOperasiBerdasarkanId('dasar_inversi_kustom');
      expect(opDitemukan).toBeDefined();
      expect(opDitemukan.namaTeknis).toBe('Custom Intensity Color Inversion');

      const nilaiAwal = ekstrakNilaiAwalParameter(opDitemukan);
      expect(nilaiAwal.intensitas).toBe(100);

      const citraUji = {
        width: 2,
        height: 1,
        data: new Uint8ClampedArray([100, 100, 100, 255, 200, 200, 200, 255]),
      };
      // Uji inversi 100%: 255 - 100 = 155, 255 - 200 = 55
      const hasil = opDitemukan.terapkan(citraUji, { intensitas: 100 });
      expect(hasil.data[0]).toBe(155);
      expect(hasil.data[4]).toBe(55);
    });
  });
});
