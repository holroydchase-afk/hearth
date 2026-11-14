"""DEMO-META-1: the link-preview picture for the public demo (public/og-hearth.png, 1200x630).
A title and tagline on the left, the demo's phone screen on the right. Needs Pillow and a phone-width
screenshot of the demo's Photos screen (390x844 at 2x), made by the caller.
Run: python3 scripts/make-og-picture.py SHOT.png"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(__file__)
FONTS = os.path.join(HERE, '..', 'node_modules', '@expo-google-fonts', 'atkinson-hyperlegible-next')
def font(weight, size):
    return ImageFont.truetype(os.path.join(FONTS, weight, f'AtkinsonHyperlegibleNext_{weight}.ttf'), size)

BG, INK, MUTED, EMBER, LINE = (250, 246, 240), (34, 28, 24), (98, 88, 80), (168, 62, 26), (226, 216, 204)
im = Image.new('RGB', (1200, 630), BG); d = ImageDraw.Draw(im)
d.text((72, 92), 'Hearth', font=font('600SemiBold', 76), fill=EMBER)
y = 196
for line in ['A private photo app for', 'split families']:
    d.text((72, y), line, font=font('600SemiBold', 46), fill=INK); y += 58
y += 18
for line in ['Every photo goes only to the people', 'you pick, by name. Built for grandparents', 'who stay off social media.']:
    d.text((72, y), line, font=font('400Regular', 27), fill=MUTED); y += 38
x, y = 72, y + 26
for pill in ['Private by name', 'Stored in the US', 'No ads, no AI training']:
    f = font('500Medium', 20); w = d.textlength(pill, font=f) + 28
    if x + w > 740: x, y = 72, y + 54
    d.rounded_rectangle([x, y, x + w, y + 40], 20, fill=(255, 255, 255), outline=LINE, width=2)
    d.text((x + 14, y + 8), pill, font=f, fill=INK); x += w + 12
d.text((72, 548), 'Try the demo at chaseholroyd.com/hearth', font=font('500Medium', 24), fill=EMBER)

shot = Image.open(sys.argv[1]).convert('RGB')
pw = 330; ph = int(shot.height * pw / shot.width)
CH = 505  # the top of Photos: the New for you card and its button
shot = shot.resize((pw, ph), Image.LANCZOS).crop((0, 0, pw, CH))
px, py = 800, (630 - CH) // 2
mask = Image.new('L', (pw, CH), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw - 1, CH - 1], 28, fill=255)
d.rounded_rectangle([px - 6, py - 6, px + pw + 6, py + CH + 6], 34, fill=(214, 202, 190))
im.paste(shot, (px, py), mask)
im.save(os.path.join(HERE, '..', 'public', 'og-hearth.png'), optimize=True)
print('public/og-hearth.png')
