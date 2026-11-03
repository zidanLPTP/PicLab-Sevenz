import { BATASAN_BERKAS, KODE_GALAT_BERKAS } from './konfigurasiBerkas';

/**
 * Memeriksa tanda tangan biner (magic bytes) berkas untuk memastikan keaslian tipe format citra.
 * Mencegah pemalsuan ekstensi atau berkas berbahaya (OWASP).
 *
 * @param {ArrayBuffer} buffer - Buffer biner dari berkas
 * @returns {string|null} Tipe format yang terdeteksi atau null jika tidak valid
 */
export function deteksiFormatDariMagicBytes(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) return null;

  // Deteksi penolakan eksplisit SVG / XML (teks ASCII '<svg' atau '<?xml')
  const teksAwal = String.fromCharCode(...bytes.slice(0, 8)).toLowerCase();
  if (teksAwal.includes('<svg') || teksAwal.includes('<?xml')) {
    return 'svg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP: RIFF .... WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // BMP: 42 4D ('BM')
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }

  return null;
}

/**
 * Melakukan validasi menyeluruh pada berkas citra masukan:
 * 1. Batas ukuran berkas (maks 10 MB).
 * 2. Tanda tangan biner (magic bytes).
 * 3. Keberhasilan penguraian (decoding) citra.
 * 4. Batas dimensi sisi terpanjang (maks 4096 px).
 * 5. Batas total piksel (maks 16 juta piksel).
 *
 * @param {File} berkas - Berkas citra yang diunggah pengguna
 * @returns {Promise<{ valid: boolean, kodeGalat?: string, metadata?: object, elemenCitra?: HTMLImageElement }>}
 */
export async function validasiBerkasCitra(berkas) {
  // 1. Validasi keberadaan berkas
  if (!berkas) {
    return { valid: false, kodeGalat: KODE_GALAT_BERKAS.BERKAS_RUSAK };
  }

  // 2. Validasi ukuran berkas
  if (berkas.size > BATASAN_BERKAS.UKURAN_MAKS_BYTE) {
    return { valid: false, kodeGalat: KODE_GALAT_BERKAS.UKURAN_MELEBIHI_BATAS };
  }

  // 3. Validasi tanda tangan biner (magic bytes)
  try {
    let potonganBuffer;
    if (typeof berkas.arrayBuffer === 'function') {
      const bufferPenuh = await berkas.arrayBuffer();
      potonganBuffer = bufferPenuh.slice(0, 16);
    } else {
      potonganBuffer = await new Promise((resolve, reject) => {
        const pembaca = new FileReader();
        pembaca.onload = () => resolve(pembaca.result);
        pembaca.onerror = reject;
        pembaca.readAsArrayBuffer(berkas.slice(0, 16));
      });
    }

    const tipeTerdeteksi = deteksiFormatDariMagicBytes(potonganBuffer);

    if (tipeTerdeteksi === 'svg') {
      return { valid: false, kodeGalat: KODE_GALAT_BERKAS.SVG_DITOLAK };
    }

    if (
      !tipeTerdeteksi ||
      !BATASAN_BERKAS.TIPE_MIME_DIIZINKAN.includes(tipeTerdeteksi)
    ) {
      return {
        valid: false,
        kodeGalat: KODE_GALAT_BERKAS.FORMAT_TIDAK_DIDUKUNG,
      };
    }
  } catch {
    return { valid: false, kodeGalat: KODE_GALAT_BERKAS.BERKAS_RUSAK };
  }

  // 4. Validasi decode citra, dimensi, dan total piksel
  return new Promise((resolve) => {
    const urlObjek = URL.createObjectURL(berkas);
    const citra = new Image();

    citra.onload = () => {
      // Pastikan revoke object URL selalu dijalankan (OWASP)
      URL.revokeObjectURL(urlObjek);

      const lebar = citra.naturalWidth;
      const tinggi = citra.naturalHeight;
      const totalPiksel = lebar * tinggi;
      const sisiTerpanjang = Math.max(lebar, tinggi);

      // Cek batas dimensi sisi terpanjang
      if (sisiTerpanjang > BATASAN_BERKAS.DIMENSI_SISI_MAKS_PIKSEL) {
        resolve({
          valid: false,
          kodeGalat: KODE_GALAT_BERKAS.DIMENSI_MELEBIHI_BATAS,
        });
        return;
      }

      // Cek batas total piksel (mencegah decompression bomb)
      if (totalPiksel > BATASAN_BERKAS.TOTAL_PIKSEL_MAKS) {
        resolve({
          valid: false,
          kodeGalat: KODE_GALAT_BERKAS.TOTAL_PIKSEL_MELEBIHI_BATAS,
        });
        return;
      }

      // Validasi berhasil
      resolve({
        valid: true,
        metadata: {
          nama: berkas.name,
          ukuranByte: berkas.size,
          lebar,
          tinggi,
          totalPiksel,
          tipeMime: berkas.type,
        },
        elemenCitra: citra,
      });
    };

    citra.onerror = () => {
      URL.revokeObjectURL(urlObjek);
      resolve({ valid: false, kodeGalat: KODE_GALAT_BERKAS.BERKAS_RUSAK });
    };

    citra.src = urlObjek;
  });
}
