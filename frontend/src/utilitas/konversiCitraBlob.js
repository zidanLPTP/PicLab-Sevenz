/**
 * Utilitas konversi antara piksel citra memori { data, width, height } dan Blob PNG/WebP.
 * Mendukung thread utama (document.createElement) dan Web Worker (OffscreenCanvas).
 * Dilengkapi fallback otomatis ke WebP lossless jika ukuran PNG melebihi 9.5 MB (batas aman 10 MB).
 */

const BATAS_AMAN_PNG_BYTE = 9.5 * 1024 * 1024; // 9.5 MB

/**
 * Mengonversi citra piksel { data, width, height } ke Blob format PNG atau WebP.
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} citra
 * @returns {Promise<Blob>}
 */
export async function citraKeBlobPng(citra) {
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
    if (blobPng.size > BATAS_AMAN_PNG_BYTE) {
      try {
        const blobWebp = await kanvas.convertToBlob({
          type: 'image/webp',
          quality: 1.0,
        });
        if (blobWebp && blobWebp.size < blobPng.size) {
          return blobWebp;
        }
      } catch {
        // Abaikan jika WebP tidak didukung, gunakan blobPng
      }
    }
    return blobPng;
  }

  if (typeof document !== 'undefined' && document.createElement) {
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
    if (blobPng && blobPng.size > BATAS_AMAN_PNG_BYTE) {
      try {
        const blobWebp = await new Promise((resolve) =>
          kanvas.toBlob(resolve, 'image/webp', 1.0)
        );
        if (blobWebp && blobWebp.size < blobPng.size) {
          return blobWebp;
        }
      } catch {
        // Fallback ke PNG
      }
    }
    return blobPng;
  }

  throw new Error('Lingkungan eksekusi tidak mendukung pembuatan Blob citra.');
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
