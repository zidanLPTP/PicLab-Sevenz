import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import PenggeserSebelumSesudah from '../komponen/PenggeserSebelumSesudah';

describe('Komponen PenggeserSebelumSesudah (spec.md Tahap 1)', () => {
  const gambarA = 'data:image/png;base64,sebelum';
  const gambarB = 'data:image/png;base64,sesudah';

  it('merender dua gambar berbeda untuk perbandingan sebelum dan sesudah', () => {
    render(
      <PenggeserSebelumSesudah
        gambarSebelum={gambarA}
        gambarSesudah={gambarB}
        namaCitra="Lanskap Uji"
      />
    );

    const citraSebelum = screen.getByAltText(/lanskap uji - sebelum/i);
    const citraSesudah = screen.getByAltText(/lanskap uji - sesudah/i);

    expect(citraSebelum).toBeInTheDocument();
    expect(citraSesudah).toBeInTheDocument();
    expect(citraSebelum).toHaveAttribute('src', gambarA);
    expect(citraSesudah).toHaveAttribute('src', gambarB);
  });

  it('memiliki atribut aksesibilitas ARIA slider yang lengkap', () => {
    render(
      <PenggeserSebelumSesudah
        gambarSebelum={gambarA}
        gambarSesudah={gambarB}
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute(
      'aria-label',
      'Penggeser perbandingan citra sebelum dan sesudah'
    );
  });

  it('dapat dikontrol melalui keyboard (ArrowLeft, ArrowRight, Home, End)', () => {
    render(
      <PenggeserSebelumSesudah
        gambarSebelum={gambarA}
        gambarSesudah={gambarB}
      />
    );

    const slider = screen.getByRole('slider');

    // Tekan ArrowLeft untuk mengurangi posisi pemisah
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '48');

    // Tekan ArrowRight untuk menambah posisi pemisah
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '50');

    // Tekan Home untuk melompat ke 0%
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');

    // Tekan End untuk melompat ke 100%
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
  });
});
