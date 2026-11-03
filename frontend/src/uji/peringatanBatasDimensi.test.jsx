import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import PanelParameter from '../komponen/PanelParameter';
import { operasiCrop, operasiUbahUkuran } from '../mesin/dasar';

describe('P6. Pengujian Unit Penjepitan Dimensi Terlihat', () => {
  it('menampilkan peringatan batas aman ketika parameter ubah ukuran melampaui 4096 px', () => {
    render(
      <PanelParameter
        operasiAktif={operasiUbahUkuran}
        parameter={{ lebarBaru: 5000, tinggiBaru: 2000, metode: 'bilinear' }}
        saatUbahParameter={vi.fn()}
        saatSetelUlangParameter={vi.fn()}
      />
    );

    const alertBanner = screen.getByRole('alert');
    expect(alertBanner).toBeInTheDocument();
    expect(alertBanner).toHaveTextContent(/batas dimensi/i);
    expect(alertBanner).toHaveTextContent(/4096/);
  });

  it('tidak menampilkan peringatan ketika dimensi berada dalam rentang aman', () => {
    render(
      <PanelParameter
        operasiAktif={operasiUbahUkuran}
        parameter={{ lebarBaru: 1920, tinggiBaru: 1080, metode: 'bilinear' }}
        saatUbahParameter={vi.fn()}
        saatSetelUlangParameter={vi.fn()}
      />
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('menampilkan peringatan batas aman ketika parameter crop melampaui 4096 px', () => {
    render(
      <PanelParameter
        operasiAktif={operasiCrop}
        parameter={{ x: 0, y: 0, lebar: 6000, tinggi: 4000 }}
        saatUbahParameter={vi.fn()}
        saatSetelUlangParameter={vi.fn()}
      />
    );

    const alertBanner = screen.getByRole('alert');
    expect(alertBanner).toBeInTheDocument();
    expect(alertBanner).toHaveTextContent(/4096/);
  });
});
