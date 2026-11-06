import { expect, test } from '@playwright/test';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

function cekPortAktif(port = 4173) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

test.describe('K7 b: Bukti Nol Permintaan ke Server pada Build Produksi (Mode Lokal)', () => {
  let prosesPreview = null;

  test.beforeAll(async () => {
    // Pastikan build produksi frontend/dist sudah ada sebelum menjalankan preview
    const jalurDist = path.resolve('frontend/dist');
    if (!fs.existsSync(jalurDist)) {
      execSync('npm run build', { cwd: 'frontend', stdio: 'ignore' });
    }

    // Jalankan vite preview pada folder dist produksi di port 4173 tanpa VITE_ALAMAT_API
    prosesPreview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
      cwd: 'frontend',
      shell: true,
      stdio: 'ignore',
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        VITE_ALAMAT_API: '', // K7 a: Tanpa alamat API (Mode Lokal)
      },
    });

    const mulai = Date.now();
    while (Date.now() - mulai < 15000) {
      if (await cekPortAktif(4173)) break;
      await new Promise((r) => setTimeout(r, 300));
    }
  });

  test.afterAll(async () => {
    if (prosesPreview && prosesPreview.pid) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(prosesPreview.pid), '/f', '/t']);
        } else {
          try {
            process.kill(-prosesPreview.pid, 'SIGKILL');
          } catch {
            process.kill(prosesPreview.pid, 'SIGKILL');
          }
        }
      } catch {
        // Abaikan jika sudah mati
      }
    }
  });

  test('Rekam lalu lintas jaringan: Buktikan 0 permintaan ke port backend 8000 dan bilah atas menampilkan Mode Lokal', async ({
    page,
  }) => {
    const permintaanJaringan = [];
    page.on('request', (req) => {
      permintaanJaringan.push(req.url());
    });

    // Buka aplikasi hasil build produksi
    await page.goto('http://localhost:4173/');
    await page.waitForLoadState('networkidle');

    // 1. Verifikasi Bilah Atas Menampilkan "Mode Lokal" (K7 a)
    const indikator = page.getByTestId('indikator-status-server');
    await expect(indikator).toBeVisible();
    await expect(indikator).toHaveAttribute('data-status', 'mode_lokal');
    await expect(indikator).toContainText(/Mode Lokal|Local Mode/);

    // 2. Jalankan alur pengolahan gambar lengkap di mode lokal
    const tombolContoh = page.getByRole('button', {
      name: /Gunakan Gambar Contoh|Use Sample Image/,
    });
    await expect(tombolContoh).toBeVisible();
    await tombolContoh.click();
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible();

    // Terapkan operasi
    await page.getByTestId('tombol-tambah-operasi-dasar_kecerahan').click();
    await page.getByTestId('tombol-tambah-operasi-warna_sepia').click();

    // Unduh hasil
    const unduhanPromise = page.waitForEvent('download');
    const tombolUnduh = page.getByRole('button', {
      name: /Unduh Hasil|Download Result/,
    });
    await tombolUnduh.click();
    const unduhan = await unduhanPromise;
    expect(unduhan.suggestedFilename()).toMatch(/\.png$/);

    // 3. Verifikasi Mutlak: Nol Permintaan ke Port 8000 (Backend)
    const permintaanKeBackend = permintaanJaringan.filter((url) =>
      url.includes(':8000') || url.includes('/kesehatan') || url.includes('/api/')
    );

    expect(permintaanKeBackend).toHaveLength(0);
    console.log(
      `Verifikasi K7 b Berhasil: ${permintaanJaringan.length} aset statis dimuat, 0 permintaan ke server backend!`
    );
  });
});
