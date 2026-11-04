import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * Pembangkit Citra Uji Deterministik Murni Node.js (Tanpa Ketergantungan Python/Pillow).
 * Menggunakan zlib standar dan pembentukan berkas PNG biner murni.
 */

// Tabel CRC-32 standar IEEE 802.3
const tabelCrc32 = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  tabelCrc32[n] = c;
}

function hitungCrc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = tabelCrc32[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buatChunk(tipe, data) {
  const panjang = data.length;
  const chunk = Buffer.alloc(8 + panjang + 4);
  chunk.writeUInt32BE(panjang, 0);
  chunk.write(tipe, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const dataCrc = chunk.subarray(4, 8 + panjang);
  chunk.writeUInt32BE(hitungCrc32(dataCrc), 8 + panjang);
  return chunk;
}

/**
 * Meng-encode raw RGBA Buffer ke berkas PNG standar.
 * @param {number} width
 * @param {number} height
 * @param {Buffer|Uint8ClampedArray} rgbaBuffer
 * @returns {Buffer}
 */
export function encodePng(width, height, rgbaBuffer) {
  const header = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  // Chunk IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit depth
  ihdrData[9] = 6; // RGBA color type
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // No interlace
  const ihdrChunk = buatChunk('IHDR', ihdrData);

  // Scanlines dengan filter byte 0 di awal setiap baris
  const barisByte = width * 4;
  const rawData = Buffer.alloc(height * (barisByte + 1));
  for (let y = 0; y < height; y++) {
    rawData[y * (barisByte + 1)] = 0; // Filter: None
    const offsetSrc = y * barisByte;
    const offsetDst = y * (barisByte + 1) + 1;
    Buffer.from(
      rgbaBuffer.buffer,
      rgbaBuffer.byteOffset + offsetSrc,
      barisByte
    ).copy(rawData, offsetDst);
  }

  const idatCompressed = zlib.deflateSync(rawData);
  const idatChunk = buatChunk('IDAT', idatCompressed);
  const iendChunk = buatChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Pembangkit angka acak ber-seed LCG (Linear Congruential Generator)
 */
export function buatLcg(seed = 42) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s & 255;
  };
}

/**
 * Menghasilkan citra sintetis gradien jenuh resolusi tertentu
 */
export function bangkitkanCitraSintetis(width, height) {
  const total = width * height * 4;
  const buffer = Buffer.alloc(total);
  for (let y = 0; y < height; y++) {
    const fy = y / height;
    for (let x = 0; x < width; x++) {
      const fx = x / width;
      const idx = (y * width + x) * 4;
      buffer[idx] = Math.round(fx * 255); // R
      buffer[idx + 1] = Math.round(fy * 255); // G
      buffer[idx + 2] = Math.round((1 - fx) * 255); // B
      buffer[idx + 3] = 255; // A
    }
  }
  return buffer;
}

/**
 * Menghasilkan citra tangga kontras vertikal hitam-putih untuk pengujian Otsu dan Sobel
 */
export function bangkitkanCitraTangga(width, height) {
  const total = width * height * 4;
  const buffer = Buffer.alloc(total);
  const tengahX = Math.floor(width / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const v = x < tengahX ? 40 : 220;
      buffer[idx] = v;
      buffer[idx + 1] = v;
      buffer[idx + 2] = v;
      buffer[idx + 3] = 255;
    }
  }
  return buffer;
}

/**
 * Menghasilkan citra acak warna penuh deterministik
 */
export function bangkitkanCitraAcak(width, height, seed = 42) {
  const lcg = buatLcg(seed);
  const total = width * height * 4;
  const buffer = Buffer.alloc(total);
  for (let i = 0; i < total; i += 4) {
    buffer[i] = lcg();
    buffer[i + 1] = lcg();
    buffer[i + 2] = lcg();
    buffer[i + 3] = 255;
  }
  return buffer;
}

/**
 * Membangkitkan seluruh aset uji ke folder test-assets jika dipanggil langsung
 */
export function bangkitkanSemuaAsetUji(targetDir = 'test-assets') {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. Citra sintetis kecil 40x30
  const buffer40x30 = bangkitkanCitraSintetis(40, 30);
  const png40x30 = encodePng(40, 30, buffer40x30);
  fs.writeFileSync(path.join(targetDir, 'uji-40x30.png'), png40x30);

  // 2. Citra tangga kontras 100x100 (Tahap 4)
  const bufferTangga = bangkitkanCitraTangga(100, 100);
  const pngTangga = encodePng(100, 100, bufferTangga);
  fs.writeFileSync(path.join(targetDir, 'tangga-100x100.png'), pngTangga);

  // 3. Citra sintetis 12 MP (4000x3000)
  const buffer4000x3000 = bangkitkanCitraSintetis(4000, 3000);
  const png4000x3000 = encodePng(4000, 3000, buffer4000x3000);
  fs.writeFileSync(path.join(targetDir, 'sintetis-4000x3000.png'), png4000x3000);

  // 4. Citra acak 12 MP (4000x3000)
  const bufferAcak = bangkitkanCitraAcak(4000, 3000, 42);
  const pngAcak = encodePng(4000, 3000, bufferAcak);
  fs.writeFileSync(path.join(targetDir, 'acak-4000x3000.png'), pngAcak);

  console.log(
    'Seluruh aset uji citra deterministik berhasil dibangkitkan via Node.js!'
  );
}

// Jalankan jika dieksekusi langsung
if (process.argv[1] && process.argv[1].endsWith('bangkitkanCitraUji.js')) {
  bangkitkanSemuaAsetUji();
}
