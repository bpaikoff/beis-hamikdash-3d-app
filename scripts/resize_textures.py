#!/usr/bin/env python3
"""Resize character textures for scripts/fetch_assets.mjs --characters (needs Pillow).

Reads a JSON list on stdin: [{src, dst, size, quality, channel}, ...]. Each src PNG is
resized to size x size (Lanczos) and written to dst: a .jpg output is RGB (or a single
channel of the source, `channel` in "RGBA", written as greyscale) at `quality`; a .png
output keeps the source mode, alpha included. Prints one line per file.
"""
import json
import sys

from PIL import Image

jobs = json.load(sys.stdin)
for job in jobs:
    im = Image.open(job["src"])
    if job.get("channel"):
        im = im.getchannel(job["channel"])
    im = im.resize((job["size"], job["size"]), Image.LANCZOS)
    dst = job["dst"]
    if dst.lower().endswith(".jpg"):
        if im.mode not in ("L", "RGB"):
            im = im.convert("RGB")
        im.save(dst, "JPEG", quality=int(job.get("quality", 85)), optimize=True)
    else:
        im.save(dst, "PNG", optimize=True)
    print(f"{job['src'].rsplit('/', 1)[-1]} {im.mode} -> {dst.rsplit('/', 1)[-1]} {job['size']}", file=sys.stderr)
