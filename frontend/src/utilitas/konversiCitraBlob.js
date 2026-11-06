/**
 * Utilitas konversi antara piksel citra memori { data, width, height } dan Blob PNG/WebP.
 * Mendukung thread utama (document.createElement) dan Web Worker (OffscreenCanvas).
 * Dilengkapi fallback otomatis ke WebP lossless jika ukuran PNG melebihi 9.5 MB (batas aman 10 MB).
 * Melempar galat BERKAS_TERLALU_BESAR jika setelah kompresi lossless ukuran tetap > 10 MB (M4 c).
 */

export const BATAS_AMAN_PNG_BYTE = 9.5 * 1024 * 1024; // 9.5 MB
export const BATAS_MUTLAK_MAKS_BYTE = 10 * 1024 * 1024; // 10 MB

/**
 * Mengonversi citra piksel { data, width, height } ke Blob format PNG atau WebP lossless.
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra
 * @returns {Promise<Blob>}
 */
export async function citraKeBlobPng(citra) {
  let blobHasil = null;

  if (typeof OffscreenCanvas !== 'undefined') {
    const kanvas = new OffscreenCanvas(citra.width, citra.height);
    const ctx = kanvas.getContext('2d');
    const imageData = new ImageData(
      new Uint8ClampedArray(citra.data),
      citra.width,
      citra.height
    );
    ctx.putImageData(imageData, 0, 0);

    const blobPng = await kanvas.convertToBlob({ type: 'image/png' });
    blobHasil = blobPng;

    if (blobPng.size > BATAS_AMAN_PNG_BYTE) {
      try {
        const blobWebp = await kanvas.convertToBlob({
          type: 'image/webp',
          quality: 1.0,
        });
        if (blobWebp && blobWebp.size < blobPng.size) {
          blobHasil = blobWebp;
        }
      } catch {
        // Abaikan jika WebP tidak didukung, pertahankan blobPng
      }
    }
  } else if (typeof document !== 'undefined' && document.createElement) {
    const kanvas = document.createElement('canvas');
    kanvas.width = citra.width;
    kanvas.height = citra.height;
    const ctx = kanvas.getContext('2d');
    const imageData = new ImageData(
      new Uint8ClampedArray(citra.data),
      citra.width,
      citra.height
    );
    ctx.putImageData(imageData, 0, 0);

    const blobPng = await new Promise((resolve) =>
      kanvas.toBlob(resolve, 'image/png')
    );
    blobHasil = blobPng;

    if (blobPng && blobPng.size > BATAS_AMAN_PNG_BYTE) {
      try {
        const blobWebp = await new Promise((resolve) =>
          kanvas.toBlob(resolve, 'image/webp', 1.0)
        );
        if (blobWebp && blobWebp.size < blobPng.size) {
          blobHasil = blobWebp;
        }
      } catch {
        // Fallback ke PNG
      }
    }
  } else {
    throw new Error(
      'Lingkungan eksekusi tidak mendukung pembuatan Blob citra.'
    );
  }

  if (!blobHasil) {
    throw new Error('Gagal menghasilkan buffer Blob dari kanvas citra.');
  }

  // Verifikasi batas mutlak 10 MB sebelum mengirim ke jaringan (M4 c)
  if (blobHasil.size > BATAS_MUTLAK_MAKS_BYTE) {
    const galat = new Error(
      'Ukuran data citra melebihi batas maksimum 10 MB meskipun telah dikompresi.'
    );
    galat.kode = 'BERKAS_TERLALU_BESAR';
    throw galat;
  }

  return blobHasil;
}

/**
 * Mengonversi Blob PNG atau WebP keluaran backend kembali ke objek { data: Uint8ClampedArray, width: number, height: number }.
 * @param {Blob} blob
 * @returns {Promise<{ data: Uint8ClampedArray, width: number, height: number }>}
 */
export async function blobPngKeCitra(blob) {
  const imgBitmap = await createImageBitmap(blob);
  const lebar = imgBitmap.width;
  const tinggi = imgBitmap.height;

  if (typeof OffscreenCanvas !== 'undefined') {
    const kanvas = new OffscreenCanvas(lebar, tinggi);
    const ctx = kanvas.getContext('2d');
    ctx.drawImage(imgBitmap, 0, 0);
    const dataHasil = ctx.getImageData(0, 0, lebar, tinggi);
    return {
      data: dataHasil.data,
      width: lebar,
      height: tinggi,
    };
  }

  if (typeof document !== 'undefined' && document.createElement) {
    const kanvas = document.createElement('canvas');
    kanvas.width = lebar;
    kanvas.height = tinggi;
    const ctx = kanvas.getContext('2d');
    ctx.drawImage(imgBitmap, 0, 0);
    const dataHasil = ctx.getImageData(0, 0, lebar, tinggi);
    return {
      data: dataHasil.data,
      width: lebar,
      height: tinggi,
    };
  }

  throw new Error('Lingkungan eksekusi tidak mendukung dekode Blob citra.');
}
