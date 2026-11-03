import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import Aplikasi from '../Aplikasi';
import i18n from '../bahasa/i18n';

describe('Komponen Utama Aplikasi (Tahap 1 Kerangka Editor)', () => {
  beforeEach(() => {
    i18n.changeLanguage('id');
  });

  it('merender layout editor tiga area dan bilah atas dengan benar', () => {
    render(<Aplikasi />);

    // Logo dan deskripsi
    expect(screen.getByAltText(/logo piclab sevenz/i)).toBeInTheDocument();
    expect(
      screen.getByText(/aplikasi pengolahan citra digital/i)
    ).toBeInTheDocument();

    // Tautan Belajar (Nonaktif dengan penjelasan)
    const tombolBelajar = screen.getByRole('button', {
      name: /belajar \(tahap 9\)/i,
    });
    expect(tombolBelajar).toBeDisabled();

    // Tautan Privasi
    expect(
      screen.getByRole('button', { name: /privasi/i })
    ).toBeInTheDocument();

    // Panel Kiri dan Kanan (Kerangka rapi)
    expect(screen.getByText(/katalog operasi citra/i)).toBeInTheDocument();
    expect(screen.getByText(/parameter & riwayat/i)).toBeInTheDocument();

    // Keadaan kosong area unggah
    expect(
      screen.getByText(/unggah gambar untuk mulai mengolah/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /pilih gambar dari komputer/i })
    ).toBeInTheDocument();
  });

  it('dapat mengganti bahasa dari Indonesia ke Inggris tanpa memuat ulang', async () => {
    render(<Aplikasi />);

    // Bahasa awal ID
    expect(
      screen.getByText(/unggah gambar untuk mulai mengolah/i)
    ).toBeInTheDocument();

    // Klik tombol EN
    const tombolEn = screen.getByRole('button', { name: 'EN' });
    fireEvent.click(tombolEn);

    // Teks berubah ke bahasa Inggris
    expect(
      screen.getByText(/upload an image to start processing/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /select image from computer/i })
    ).toBeInTheDocument();

    // Klik tombol ID kembali
    const tombolId = screen.getByRole('button', { name: 'ID' });
    fireEvent.click(tombolId);

    // Teks kembali ke bahasa Indonesia
    expect(
      screen.getByText(/unggah gambar untuk mulai mengolah/i)
    ).toBeInTheDocument();
  });

  it('dapat membuka dan menutup dialog informasi privasi', () => {
    render(<Aplikasi />);

    // Klik tombol Privasi
    const tombolPrivasi = screen.getByRole('button', { name: /privasi/i });
    fireEvent.click(tombolPrivasi);

    // Modal dialog muncul
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByText(/privasi & keamanan data pengguna/i)
    ).toBeInTheDocument();

    // Klik tombol tutup
    const tombolTutup = screen.getByRole('button', {
      name: /mengerti dan tutup/i,
    });
    fireEvent.click(tombolTutup);

    // Modal dialog tertutup
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
