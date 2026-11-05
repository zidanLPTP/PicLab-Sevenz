import { bangkitkanSemuaAsetUji } from './utilitas/bangkitkanCitraUji.js';

/**
 * Global Setup Playwright: Dijalankan tepat SATU KALI sebelum semua worker pengujian dimulai.
 * Mencegah race condition antar-worker saat membangkitkan aset citra uji deterministik.
 */
export default async function globalSetup() {
  bangkitkanSemuaAsetUji('test-assets');
}
