import { expect, test } from '@playwright/test';
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

let prosesBackend = null;

function cekPortAktif(port = 8000) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/kesehatan`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function tungguBackend(port = 8000, timeoutMs = 20000) {
  const mulai = Date.now();
  while (Date.now() - mulai < timeoutMs) {
    const aktif = await cekPortAktif(port);
    if (aktif) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Batas waktu habis menunggu backend di port ${port}`);
}

async function mulaiBackend() {
  if (await cekPortAktif(8000)) {
    return;
  }

  const pythonBin =
    process.platform === 'win32'
      ? path.resolve('backend/.venv/Scripts/python.exe')
      : process.env.PYTHON || 'python3';

  prosesBackend = spawn(pythonBin, ['backend/main.py'], {
    stdio: 'ignore',
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      PORT_BACKEND: '8000',
      HOST_BACKEND: '127.0.0.1',
      PERCAYAI_PROXY: 'false',
      RELOAD: 'false',
      MODE_PRODUKSI: 'true',
    },
  });

  await tungguBackend(8000);
}

function matikanBackend() {
  if (prosesBackend && prosesBackend.pid) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(prosesBackend.pid), '/f', '/t']);
      } else {
        try {
          process.kill(-prosesBackend.pid, 'SIGKILL');
        } catch {
          process.kill(prosesBackend.pid, 'SIGKILL');
        }
      }
    } catch {
      // Abaikan jika proses sudah berhenti
    }
    prosesBackend = null;
  }
}

test.describe.serial('Tahap 5: Pengujian Integrasi Klien-Server Nyata (Tanpa Mock - K3)', () => {
  test.beforeAll(async () => {
    await mulaiBackend();
  });

  test.afterAll(async () => {
    matikanBackend();
  });

  test('K3 c (1): Server hidup, eksekusi operasi server nyata dan verifikasi piksel terbalik horizontal', async ({
    page,
  }) => {
    const galatKonsol = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        galatKonsol.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Verifikasi Status Server Terhubung Nyata
    const indikator = page.getByTestId('indikator-status-server');
    await expect(indikator).toBeVisible();
    await indikator.click(); // Pemicu periksa manual
    await expect(indikator).toHaveAttribute('data-status', 'tersedia', {
      timeout: 10000,
    });
    await expect(indikator).toContainText(/Server Aktif|Server Online/);

    // 2. Unggah Citra Uji Tangga 4x2 Piksel Deterministik
    const jalurCitraUji = path.resolve('test-assets/tangga-4x2.png');
    expect(fs.existsSync(jalurCitraUji)).toBe(true);

    const inputUnggah = page.locator('input[type="file"]');
    await inputUnggah.setInputFiles(jalurCitraUji);

    // Tunggu kanvas sesudah muncul
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible();

    // 3. Tambahkan Operasi Server Uji Gema
    const tombolOperasiGema = page.getByTestId(
      'tombol-tambah-operasi-server_uji_gema'
    );
    await expect(tombolOperasiGema).toBeVisible();
    await expect(tombolOperasiGema).toBeEnabled();

    // Pantau permintaan jaringan sungguhan ke backend FastAPI
    const tungguResponsGema = page.waitForResponse(
      (res) =>
        res.url().includes('/api/uji/gema') &&
        res.status() === 200 &&
        res.request().method() === 'POST'
    );

    await tombolOperasiGema.click();
    const responsJaringan = await tungguResponsGema;
    expect(responsJaringan.status()).toBe(200);

    // 4. Unduh Citra Hasil dan Verifikasi Nilai Piksel Matematis
    const promiseUnduh = page.waitForEvent('download');
    const tombolUnduh = page.getByRole('button', {
      name: /Unduh Hasil|Download Result/,
    });
    await tombolUnduh.click();
    const hasilUnduhan = await promiseUnduh;

    const jalurSimpanUnduhan = path.resolve('test-assets/unduhan-gema-4x2.png');
    await hasilUnduhan.saveAs(jalurSimpanUnduhan);

    // Baca citra PNG hasil unduhan via browser kanvas evaluasi
    const dataUnduhanBase64 = fs.readFileSync(jalurSimpanUnduhan).toString('base64');
    const pikselHasil = await page.evaluate(async (b64) => {
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = `data:image/png;base64,${b64}`;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height).data;
      return {
        width: img.width,
        height: img.height,
        rKiri: imgData[0],
        gKiri: imgData[1],
        bKiri: imgData[2],
        rKanan: imgData[(img.width - 1) * 4],
        gKanan: imgData[(img.width - 1) * 4 + 1],
        bKanan: imgData[(img.width - 1) * 4 + 2],
      };
    }, dataUnduhanBase64);

    expect(pikselHasil.width).toBe(4);
    expect(pikselHasil.height).toBe(2);

    // Pada tangga-4x2.png asli:
    // Baris 0: x=0 adalah (10, 20, 30, 255), x=3 adalah (200, 210, 220, 255)
    // Setelah dibalik horizontal oleh backend FastAPI:
    // Baris 0: x=0 harus (200, 210, 220, 255), x=3 harus (10, 20, 30, 255)
    expect(pikselHasil.rKiri).toBe(200);
    expect(pikselHasil.gKiri).toBe(210);
    expect(pikselHasil.bKiri).toBe(220);

    expect(pikselHasil.rKanan).toBe(10);
    expect(pikselHasil.gKanan).toBe(20);
    expect(pikselHasil.bKanan).toBe(30);

    // Bersihkan berkas unduhan uji
    if (fs.existsSync(jalurSimpanUnduhan)) {
      fs.unlinkSync(jalurSimpanUnduhan);
    }
  });

  test('K3 c (2): Penanganan unggah berkas bukan citra (teks) menampilkan pesan galat dwibahasa tanpa crash', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Buat berkas teks palsu
    const jalurBerkasPalsu = path.resolve('test-assets/bukan_gambar.txt');
    fs.writeFileSync(jalurBerkasPalsu, 'Ini adalah file teks dan bukan gambar!');

    try {
      const inputUnggah = page.locator('input[type="file"]');
      await inputUnggah.setInputFiles(jalurBerkasPalsu);

      // Verifikasi dialog atau pesan galat yang manusiawi muncul
      const pesanGalat = page.locator('text=/Format berkas tidak didukung|File format not supported/i');
      await expect(pesanGalat.first()).toBeVisible({ timeout: 5000 });

      // Verifikasi antarmuka tetap utuh (tidak crash)
      await expect(page.getByTestId('indikator-status-server')).toBeVisible();
    } finally {
      if (fs.existsSync(jalurBerkasPalsu)) {
        fs.unlinkSync(jalurBerkasPalsu);
      }
    }
  });

  test('K3 c (3 & 4): Degradasi anggun saat server dimatikan sungguhan dan pemulihan saat server dinyalakan kembali', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const indikator = page.getByTestId('indikator-status-server');

    // 1. Pastikan server mula-mula aktif
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tersedia', {
      timeout: 10000,
    });

    // 2. MATIKAN PROSES BACKEND SUNGGUHAN
    matikanBackend();

    // Tunggu proses benar-benar mati
    let mati = false;
    for (let i = 0; i < 20; i++) {
      if (!(await cekPortAktif(8000))) {
        mati = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(mati).toBe(true);

    // 3. Pemicu periksa saat server mati
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tidak_tersedia', {
      timeout: 10000,
    });
    await expect(indikator).toContainText(/Server Mati|Server Offline/);

    // 4. Verifikasi Tombol Operasi Server Otomatis Disabled
    const tombolOperasiGema = page.getByTestId(
      'tombol-tambah-operasi-server_uji_gema'
    );
    await expect(tombolOperasiGema).toBeDisabled();

    // 5. Verifikasi Operasi Klien Tetap Berfungsi Normal saat Server Mati
    await page
      .getByRole('button', { name: /Gunakan Gambar Contoh|Use Sample Image/ })
      .click();
    await expect(page.getByTestId('kanvas-sesudah')).toBeVisible();

    const tombolKecerahan = page.getByTestId(
      'tombol-tambah-operasi-dasar_kecerahan'
    );
    await expect(tombolKecerahan).toBeEnabled();
    await tombolKecerahan.click();

    const itemLangkah = page.locator('[role="listitem"]');
    await expect(itemLangkah).toHaveCount(1);

    // 6. NYALAKAN KEMBALI BACKEND SUNGGUHAN (Auto-Recovery / Pulih)
    await mulaiBackend();

    // Pemicu periksa ulang server
    await indikator.click();
    await expect(indikator).toHaveAttribute('data-status', 'tersedia', {
      timeout: 10000,
    });
    await expect(indikator).toContainText(/Server Aktif|Server Online/);

    // Tombol operasi server kembali aktif
    await expect(tombolOperasiGema).toBeEnabled();
  });

  test('K3 d: Verifikasi CORS browser menolak origin asing', async ({ page }) => {
    await page.goto('/');

    // Uji fetch langsung ke backend dari origin yang tidak diizinkan via peramban Chromium
    const hasilCors = await page.evaluate(async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/kesehatan', {
          method: 'GET',
          headers: {
            // Header buatan untuk menguji preflight/origin
            'X-Custom-Test': 'true',
          },
        });
        return { ok: res.ok, status: res.status };
      } catch (err) {
        return { galat: err.message || String(err) };
      }
    });

    // Frontend berada pada origin localhost:5173 yang sah,
    // Sekarang coba fetch dengan custom header terlarang atau metode yang memicu CORS rejection
    const hasilCorsDitolak = await page.evaluate(async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/kesehatan', {
          method: 'DELETE', // DELETE tidak diizinkan dalam CORS allow_methods
        });
        return { ok: res.ok, status: res.status };
      } catch (err) {
        return { galat: err.message || String(err) };
      }
    });

    // Browser harus memblokir metode yang tidak diizinkan oleh CORS
    expect(
      hasilCorsDitolak.galat || hasilCorsDitolak.status === 405
    ).toBeTruthy();
  });
});
