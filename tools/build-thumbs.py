"""Square WebP thumbnails for the tree and board rows.

Rows show photos at 54-72 px, so loading the full 1024 px photo there wastes
200-600 KB per bird. This writes a 160x160 centre crop (the same crop the rows
already show with object-fit: cover) for every local photo:

  assets/photos/great-tit.jpg            -> assets/thumbs/photos/great-tit.webp
  assets/bird-photos/Acanthis_flammea.jpg -> assets/thumbs/bird-photos/Acanthis_flammea.webp

Run from the repository root: python3 tools/build-thumbs.py
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SIZE = 160
SOURCES = ["photos", "bird-photos"]


def main():
    made = skipped = 0
    for folder in SOURCES:
        src_dir = ROOT / "assets" / folder
        out_dir = ROOT / "assets" / "thumbs" / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        for src in sorted(src_dir.iterdir()):
            if src.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                continue
            out = out_dir / (src.stem + ".webp")
            if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
                skipped += 1
                continue
            with Image.open(src) as im:
                im = ImageOps.exif_transpose(im).convert("RGB")
                thumb = ImageOps.fit(im, (SIZE, SIZE), Image.LANCZOS, centering=(0.5, 0.5))
                thumb.save(out, "WEBP", quality=74, method=6)
            made += 1
    print(f"thumbnails: {made} written, {skipped} up to date")


if __name__ == "__main__":
    main()
