import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { TOKEN_TEMA } from '../tema/token';

/**
 * Mengumpulkan seluruh berkas (.jsx, .js, .css) di bawah sebuah direktori secara rekursif.
 */
function kumpulkanBerkasSumber(direktori) {
  let daftarBerkas = [];
  const entri = fs.readdirSync(direktori, { withFileTypes: true });

  for (const item of entri) {
    const jalurPenuh = path.join(direktori, item.name);
    if (item.isDirectory()) {
      daftarBerkas = daftarBerkas.concat(kumpulkanBerkasSumber(jalurPenuh));
    } else if (
      item.isFile() &&
      /\.(jsx?|css)$/.test(item.name) &&
      item.name !== 'token.js' &&
      item.name !== 'tokenDesain.test.js'
    ) {
      daftarBerkas.push(jalurPenuh);
    }
  }

  return daftarBerkas;
}

describe('Penegakan Sistem Desain & Token Warna (styleguide.md bagian 6 & 9)', () => {
  it('semua nilai warna dalam TOKEN_TEMA valid (format HEX atau RGBA)', () => {
    const periksaNilaiWarna = (obj) => {
      for (const [kunci, nilai] of Object.entries(obj)) {
        if (typeof nilai === 'object' && nilai !== null) {
          periksaNilaiWarna(nilai);
        } else if (typeof nilai === 'string') {
          const isValidColor =
            /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(nilai) ||
            /^rgba?\([^)]+\)$/.test(nilai);
          expect(
            isValidColor,
            `Warna token ${kunci} bernilai '${nilai}' tidak valid`
          ).toBe(true);
        }
      }
    };
    periksaNilaiWarna(TOKEN_TEMA.warna);
  });

  it('tidak ada kelas warna bawaan Tailwind (slate-, amber-, rose-, teal-, dll) di SELURUH frontend/src', () => {
    const polaWarnaLiar =
      /\b(amber|rose|teal|emerald|slate|zinc|gray|red|blue|green|yellow|orange|purple|indigo|violet|cyan|sky)-\d{2,3}\b/g;

    const direktoriSrc = path.resolve(__dirname, '..');
    const semuaBerkas = kumpulkanBerkasSumber(direktoriSrc);

    const pelanggaran = [];

    for (const jalur of semuaBerkas) {
      const namaRelatif = path.relative(direktoriSrc, jalur);
      const isi = fs.readFileSync(jalur, 'utf-8');
      const kecocokan = isi.match(polaWarnaLiar);
      if (kecocokan) {
        pelanggaran.push({ berkas: namaRelatif, kecocokan });
      }
    }

    expect(
      pelanggaran,
      `Ditemukan kelas warna bawaan Tailwind di berkas frontend/src: ${JSON.stringify(pelanggaran)}`
    ).toEqual([]);
  });

  it('tidak ada kode heksadesimal warna mentah (#...) di SELURUH berkas frontend/src (wajib melalui TOKEN_TEMA)', () => {
    const polaHexMentah = /#[0-9a-fA-F]{3,8}\b/g;

    const direktoriSrc = path.resolve(__dirname, '..');
    const semuaBerkas = kumpulkanBerkasSumber(direktoriSrc);

    const pelanggaran = [];

    for (const jalur of semuaBerkas) {
      const namaRelatif = path.relative(direktoriSrc, jalur);
      const isi = fs.readFileSync(jalur, 'utf-8');
      const kecocokan = isi.match(polaHexMentah);
      if (kecocokan) {
        pelanggaran.push({ berkas: namaRelatif, kecocokan });
      }
    }

    expect(
      pelanggaran,
      `Ditemukan kode HEX mentah di berkas frontend/src: ${JSON.stringify(pelanggaran)}`
    ).toEqual([]);
  });

  it('G3: semua kelas utilitas warna (bg-, text-, border-, ring-) di frontend/src terdaftar di konfigurasi tema TOKEN_TEMA', () => {
    // 1. Ekstrak seluruh token warna yang valid dari TOKEN_TEMA
    const daftarTokenWarnaValid = new Set();

    // Utilitas bawaan Tailwind yang diizinkan
    const utilitasBawaanTailwind = new Set([
      'transparent',
      'white',
      'black',
      'current',
      'inherit',
      // Text sizing & alignment
      'xs',
      'sm',
      'base',
      'lg',
      'xl',
      '2xl',
      '3xl',
      'left',
      'center',
      'right',
      'justify',
      // Border widths & styles
      '0',
      '2',
      '4',
      '8',
      't',
      'b',
      'l',
      'r',
      'x',
      'y',
      'solid',
      'dashed',
      'dotted',
      'double',
      'none',
      // Ring utilities
      'inset',
      'offset-0',
      'offset-1',
      'offset-2',
      'offset-4',
    ]);

    for (const [kelompok, nilai] of Object.entries(TOKEN_TEMA.warna)) {
      if (typeof nilai === 'object' && nilai !== null) {
        for (const [subKunci] of Object.entries(nilai)) {
          if (subKunci === 'DEFAULT') {
            daftarTokenWarnaValid.add(kelompok);
          } else {
            daftarTokenWarnaValid.add(`${kelompok}-${subKunci}`);
          }
        }
      } else {
        daftarTokenWarnaValid.add(kelompok);
      }
    }

    const direktoriSrc = path.resolve(__dirname, '..');
    const semuaBerkas = kumpulkanBerkasSumber(direktoriSrc);

    // Pola mencocokkan: (prefix:)*(bg|text|border|ring)-(namaToken[/opasitas]?)
    const polaKelas =
      /\b(?:[a-zA-Z0-9_-]+:)*(bg|text|border|ring)-([a-zA-Z0-9_-]+)(?:\/[0-9]+)?\b/g;

    const kelasTakTerdaftar = [];

    for (const jalur of semuaBerkas) {
      const namaRelatif = path.relative(direktoriSrc, jalur);
      const isi = fs.readFileSync(jalur, 'utf-8');

      let match;
      while ((match = polaKelas.exec(isi)) !== null) {
        const [, prefix, namaToken] = match;

        // Lewati jika merupakan utilitas layout/ukuran bawaan Tailwind
        if (utilitasBawaanTailwind.has(namaToken)) {
          continue;
        }

        // Khusus ring: ring-1, ring-2, dll adalah utilitas bawaan
        if (prefix === 'ring' && /^[0-9]+$/.test(namaToken)) {
          continue;
        }

        // Periksa apakah namaToken ada di daftar token tema yang terdefinisi
        if (!daftarTokenWarnaValid.has(namaToken)) {
          kelasTakTerdaftar.push({
            berkas: namaRelatif,
            kelasLengkap: match[0],
            token: namaToken,
          });
        }
      }
    }

    expect(
      kelasTakTerdaftar,
      `Ditemukan kelas warna tak dikenal di frontend/src yang tidak ada di TOKEN_TEMA: ${JSON.stringify(kelasTakTerdaftar, null, 2)}`
    ).toEqual([]);
  });
});
