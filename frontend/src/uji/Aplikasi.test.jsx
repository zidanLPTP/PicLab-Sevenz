import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import Aplikasi from '../Aplikasi';

describe('Komponen Aplikasi', () => {
  it('merender judul aplikasi PicLab Sevenz dengan benar', () => {
    render(<Aplikasi />);
    const judul = screen.getByRole('heading', { name: /piclab sevenz/i });
    expect(judul).toBeInTheDocument();
  });

  it('menampilkan status fondasi repo yang aktif', () => {
    render(<Aplikasi />);
    expect(
      screen.getByText(/Frontend Vite, React, dan Tailwind CSS aktif/i)
    ).toBeInTheDocument();
  });
});
