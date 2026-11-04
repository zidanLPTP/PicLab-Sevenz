import { describe, expect, it } from 'vitest';
import { operasiCrop, operasiRotasi, operasiUbahUkuran } from '../mesin/dasar';
import { buatCitraKosong } from '../mesin/utilitasCitra';

describe('Konsistensi Eksekusi Preview vs Resolusi Penuh (0.4)', () => {
  // Buat citra penuh sintetis 400x300 dengan pola gradien koordinat
  function buatCitraGradien(width, height) {
    const citra = buatCitraKosong(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        citra.data[idx] = Math.round((x / width) * 255); // R
        citra.data[idx + 1] = Math.round((y / height) * 255); // G
        citra.data[idx + 2] = Math.round(((x + y) / (width + height)) * 255); // B
        citra.data[idx + 3] = 255;
      }
    }
    return citra;
  }

  const citraPenuh = buatCitraGradien(400, 300);
  const rasio = 0.25; // Preview berukuran 100x75
  const citraPreview = buatCitraGradien(100, 75);

  it('1. Pemotongan (Crop): hasil preview dengan rasio skala konsisten secara proporsional dengan resolusi penuh', () => {
    const parameterAsli = {
      x: 80,
      y: 40,
      lebar: 160,
      tinggi: 120,
    };

    // Eksekusi penuh (resolusi asli, rasio = 1.0)
    const hasilPenuh = operasiCrop.terapkan(citraPenuh, parameterAsli, {
      rasio: 1.0,
    });
    expect(hasilPenuh.width).toBe(160);
    expect(hasilPenuh.height).toBe(120);

    // Eksekusi preview (rasio = 0.25)
    const hasilPreview = operasiCrop.terapkan(citraPreview, parameterAsli, {
      rasio,
    });
    expect(hasilPreview.width).toBe(40); // 160 * 0.25 = 40
    expect(hasilPreview.height).toBe(30); // 120 * 0.25 = 30

    // Downscale hasil penuh ke ukuran preview untuk membandingkan piksel
    const penuhDiperkecil = operasiUbahUkuran.terapkan(hasilPenuh, {
      lebarBaru: 40,
      tinggiBaru: 30,
      metode: 'nearest',
    });

    // Toleransi kecil karena diskritisasi sampling koordinat
    let selisihMaks = 0;
    for (let i = 0; i < hasilPreview.data.length; i += 4) {
      selisihMaks = Math.max(
        selisihMaks,
        Math.abs(hasilPreview.data[i] - penuhDiperkecil.data[i]),
        Math.abs(hasilPreview.data[i + 1] - penuhDiperkecil.data[i + 1]),
        Math.abs(hasilPreview.data[i + 2] - penuhDiperkecil.data[i + 2])
      );
    }
    expect(selisihMaks).toBeLessThanOrEqual(15);
  });

  it('2. Ubah Ukuran (Resize): dimensi target diperskalakan secara akurat pada preview', () => {
    const parameterAsli = {
      lebarBaru: 200,
      tinggiBaru: 150,
      metode: 'bilinear',
    };

    const hasilPenuh = operasiUbahUkuran.terapkan(citraPenuh, parameterAsli, {
      rasio: 1.0,
    });
    expect(hasilPenuh.width).toBe(200);
    expect(hasilPenuh.height).toBe(150);

    const hasilPreview = operasiUbahUkuran.terapkan(
      citraPreview,
      parameterAsli,
      {
        rasio,
      }
    );
    expect(hasilPreview.width).toBe(50); // 200 * 0.25
    expect(hasilPreview.height).toBe(38); // Math.round(150 * 0.25) = 38
  });

  it('3. Rotasi (Rotate): orientasi sudut bebas skala dan dimensi bertransposisi secara tepat', () => {
    const hasilPenuh90 = operasiRotasi.terapkan(
      citraPenuh,
      { sudut: 90 },
      { rasio: 1.0 }
    );
    expect(hasilPenuh90.width).toBe(300);
    expect(hasilPenuh90.height).toBe(400);

    const hasilPreview90 = operasiRotasi.terapkan(
      citraPreview,
      { sudut: 90 },
      { rasio }
    );
    expect(hasilPreview90.width).toBe(75);
    expect(hasilPreview90.height).toBe(100);

    // Rasio aspek rotasi 90 preview vs penuh identik (75/100 == 300/400 == 0.75)
    expect(hasilPreview90.width / hasilPreview90.height).toBe(
      hasilPenuh90.width / hasilPenuh90.height
    );
  });
});
