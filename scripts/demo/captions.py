#!/usr/bin/env python3
"""Render caption strip PNGs for the demo recording (macOS, needs Pillow).

Sized for the 900x680 logical recording produced by record.sh.
Note: SF Pro lacks U+21B5 (return symbol), so the word "Enter" is used.
"""
import sys
from PIL import Image, ImageDraw, ImageFont

CAPS = [
    ("cap1", "⌘⇧X   open the palette"),
    ("cap2", "type “wiki”   filter sites"),
    ("cap3", "→   choose action: Group tabs"),
    ("cap4", "Enter   wikipedia tabs become a tab group"),
    ("cap5", "/   slash commands"),
    ("cap6", "/dedupe + Enter   close duplicated tabs"),
    ("cap7", "type “hacker”  ↓   pick a tab"),
    ("cap8", "Enter   switch to that tab"),
    ("cap9", "⌘⇧X   reopen"),
    ("cap10", "“wiki” + Enter   close all wikipedia tabs"),
]

W, H = 900, 64
outdir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/nmt-caps"
font = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 27)

for name, text in CAPS:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad = 22
    bw = tw + pad * 2
    x0 = (W - bw) // 2
    d.rounded_rectangle([x0, 0, x0 + bw, H - 1], radius=13, fill=(15, 15, 18, 215))
    d.text(
        ((W - tw) // 2 - bbox[0], (H - th) // 2 - bbox[1]),
        text,
        font=font,
        fill=(255, 255, 255, 255),
    )
    img.save(f"{outdir}/{name}.png")

print(f"rendered {len(CAPS)} captions to {outdir}")
