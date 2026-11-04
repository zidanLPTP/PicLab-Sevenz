import os
import numpy as np
from PIL import Image

def bangkitkan_semua_citra_uji(target_dir="test-assets"):
    os.makedirs(target_dir, exist_ok=True)
    w, h = 4000, 3000

    path_sintetis = os.path.join(target_dir, "sintetis-4000x3000.png")
    path_acak = os.path.join(target_dir, "acak-4000x3000.png")

    if not os.path.exists(path_sintetis):
        print("Membangkitkan citra sintetis berwarna jenuh 4000x3000...")
        # 1. Gradien Hue horizontal dan vertikal
        x = np.linspace(0, 1, w, endpoint=False, dtype=np.float32)
        y = np.linspace(0, 1, h, endpoint=False, dtype=np.float32)
        xx, yy = np.meshgrid(x, y)

        # Pola warna kompleks: spektrum warna jenuh berbasis sinus/cosinus
        # R = sin(2*pi*xx), G = sin(2*pi*(xx + 1/3)), B = sin(2*pi*(xx + 2/3))
        r = (0.5 + 0.5 * np.sin(2 * np.pi * xx * 3 + yy * np.pi)) * 255
        g = (0.5 + 0.5 * np.sin(2 * np.pi * xx * 3 + 2 * np.pi / 3 + np.cos(yy * 4))) * 255
        b = (0.5 + 0.5 * np.sin(2 * np.pi * xx * 3 + 4 * np.pi / 3 + yy * 2)) * 255

        # Tambahkan lingkaran berwarna jenuh di tengah
        cx, cy = w // 2, h // 2
        dist_sq = (np.arange(w) - cx)**2 + (np.arange(h)[:, None] - cy)**2
        radius_sq = (min(w, h) // 3)**2
        topeng_lingkaran = dist_sq < radius_sq
        r[topeng_lingkaran] = (r[topeng_lingkaran] * 0.3 + 240).clip(0, 255)
        g[topeng_lingkaran] = (g[topeng_lingkaran] * 0.2 + 20).clip(0, 255)
        b[topeng_lingkaran] = (b[topeng_lingkaran] * 0.3 + 200).clip(0, 255)

        # Tambahkan sedikit derau deterministik (seed 42)
        np.random.seed(42)
        derau = np.random.randint(-15, 16, (h, w), dtype=np.int16)
        r = np.clip(r + derau, 0, 255).astype(np.uint8)
        g = np.clip(g + derau, 0, 255).astype(np.uint8)
        b = np.clip(b + derau, 0, 255).astype(np.uint8)

        arr_sintetis = np.stack([r, g, b], axis=-1)
        img_sintetis = Image.fromarray(arr_sintetis, "RGB")
        img_sintetis.save(path_sintetis, "PNG")
        print(f"Tersimpan: {path_sintetis}")

    if not os.path.exists(path_acak):
        print("Membangkitkan citra acak berwarna penuh 4000x3000 (seed 42)...")
        np.random.seed(42)
        arr_acak = np.random.randint(0, 256, (h, w, 3), dtype=np.uint8)
        img_acak = Image.fromarray(arr_acak, "RGB")
        img_acak.save(path_acak, "PNG")
        print(f"Tersimpan: {path_acak}")

if __name__ == "__main__":
    bangkitkan_semua_citra_uji()
