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
});
