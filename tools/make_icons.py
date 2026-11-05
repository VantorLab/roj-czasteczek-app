"""Draw the app icon: a glowing particle swarm on the abyss background."""
import math, random, pathlib
from PIL import Image, ImageDraw, ImageFilter
ROOT = pathlib.Path(__file__).resolve().parent.parent
out = ROOT / 'app' / 'icons'; out.mkdir(parents=True, exist_ok=True)
S = 1024
random.seed(7)
bg = Image.new('RGB', (S, S), (4, 18, 26))
g = Image.new('RGB', (S, S), (0, 0, 0)); d = ImageDraw.Draw(g)
for _ in range(9000):  # a spiral swarm: teal outside, warm gold inside
    t = random.random(); a = t * 9.5 + random.gauss(0, .25); r = 60 + t * 330 + random.gauss(0, 18)
    x, y = S / 2 + math.cos(a) * r, S / 2 + math.sin(a) * r * .92
    c = (int(143 + (255 - 143) * (1 - t)), int(243 - (243 - 190) * (1 - t)), int(230 - (230 - 110) * (1 - t)))
    s = random.choice([1, 1, 2, 2, 3])
    d.ellipse((x - s, y - s, x + s, y + s), fill=c)
glow = g.filter(ImageFilter.GaussianBlur(14))
img = Image.blend(bg, glow, .55)
img = Image.composite(g, img, g.convert('L').point(lambda v: 255 if v > 40 else 0))
mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, S, S), 220, fill=255)
rounded = Image.new('RGBA', (S, S)); rounded.paste(img, (0, 0), mask)
rounded.save(out / 'icon-1024.png')
img.resize((512, 512), Image.LANCZOS).save(out / 'icon-maskable-512.png')   # full-bleed for maskable
for n in (512, 192): rounded.resize((n, n), Image.LANCZOS).save(out / f'icon-{n}.png')
img.resize((180, 180), Image.LANCZOS).save(out / 'apple-touch-icon.png')       # iOS rounds it itself
print('icons ok')
