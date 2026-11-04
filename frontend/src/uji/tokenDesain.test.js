import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { TOKEN_TEMA } from '../tema/token';

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

  it('tidak ada kelas warna bawaan Tailwind (slate-, amber-, rose-, teal-, dll) di dalam kode komponen', () => {
    const polaWarnaLiar =
      /\b(amber|rose|teal|emerald|slate|zinc|gray|red|blue|green|yellow|orange|purple|indigo|violet|cyan|sky)-\d{2,3}\b/g;

    const direktoriKomponen = path.resolve(__dirname, '../komponen');
    const berkasKomponen = fs
      .readdirSync(direktoriKomponen)
      .filter((b) => b.endsWith('.jsx') || b.endsWith('.js'));

    const pelanggaran = [];

    for (const berkas of berkasKomponen) {
      const jalur = path.join(direktoriKomponen, berkas);
      const isi = fs.readFileSync(jalur, 'utf-8');
      const kecocokan = isi.match(polaWarnaLiar);
      if (kecocokan) {
        pelanggaran.push({ berkas, kecocokan });
      }
    }

    expect(
      pelanggaran,
      `Ditemukan kelas warna bawaan Tailwind di komponen: ${JSON.stringify(pelanggaran)}`
    ).toEqual([]);
  });

  it('tidak ada kode heksadesimal warna mentah (#...) di berkas komponen (wajib melalui TOKEN_TEMA)', () => {
    const polaHexMentah = /#[0-9a-fA-F]{3,8}\b/g;

    const direktoriKomponen = path.resolve(__dirname, '../komponen');
    const berkasKomponen = fs
      .readdirSync(direktoriKomponen)
      .filter((b) => b.endsWith('.jsx') || b.endsWith('.js'));

    const pelanggaran = [];

    for (const berkas of berkasKomponen) {
      const jalur = path.join(direktoriKomponen, berkas);
      const isi = fs.readFileSync(jalur, 'utf-8');
      const kecocokan = isi.match(polaHexMentah);
      if (kecocokan) {
        pelanggaran.push({ berkas, kecocokan });
      }
    }

    expect(
      pelanggaran,
      `Ditemukan kode HEX mentah di komponen: ${JSON.stringify(pelanggaran)}`
    ).toEqual([]);
  });
});
