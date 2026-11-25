"""HRT-WEB.2 (docs/product/SPEC-WEB-APP.md): the add-to-home-screen icons in public/icons/, from the app icons.
  icon-192.png, icon-512.png   app/assets/icon.png resized (purpose "any")
  icon-maskable-512.png        the part of app/assets/adaptive-icon.png Android shows (the central 72 of 108 dp),
                               set inside the central 78% on Paper #F7F7F4, so the outer 10% ring is solid Paper
                               and a circle crop never cuts the mark (WEB-APP-16)
Needs Pillow (already used by make-og-picture.py). Run again whenever an app icon changes:
  python3 scripts/make-web-icons.py"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets')
OUT = os.path.join(HERE, '..', 'public', 'icons')
PAPER = (0xF7, 0xF7, 0xF4, 255)

os.makedirs(OUT, exist_ok=True)
icon = Image.open(os.path.join(ASSETS, 'icon.png')).convert('RGB')
for size in (192, 512):
    icon.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, f'icon-{size}.png'), optimize=True)

fg = Image.open(os.path.join(ASSETS, 'adaptive-icon.png')).convert('RGBA')
w, h = fg.size
visible = fg.crop((round(w * 18 / 108), round(h * 18 / 108), round(w * 90 / 108), round(h * 90 / 108)))
inner = 400  # 78% of 512; the 10% ring is 51 px, so this leaves 5 px of plain Paper inside it
mark = Image.alpha_composite(Image.new('RGBA', visible.size, PAPER), visible).resize((inner, inner), Image.LANCZOS)
maskable = Image.new('RGBA', (512, 512), PAPER)
maskable.paste(mark, ((512 - inner) // 2, (512 - inner) // 2))
maskable.convert('RGB').save(os.path.join(OUT, 'icon-maskable-512.png'), optimize=True)
print(f'Wrote 3 icons to {os.path.normpath(OUT)}')
