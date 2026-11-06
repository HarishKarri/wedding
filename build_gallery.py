#!/usr/bin/env python3
"""
Build the gallery from your original photos.

Put one folder per album inside "originals/", for example:

    originals/
      _cover.jpg                      (optional: big photo for the top of the home page)
      01 Rashmi Mehendi Pics/
      02 Decor/
      03 Engagement Couple Pics/
      04 Engagement Event Pics/
      05 Wedding/

Then run:

    pip install pillow
    python build_gallery.py

It creates web-sized copies in "photos/" and writes "albums.json".
The number at the start of a folder name sets the album order and is not shown.
Your originals are never changed. Running it again only processes new photos.
"""

import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageOps

# ---------- Edit these ----------
SITE = {
    "title": "Hari & Rashmi Wedding",
    "date": "May 2nd, 2026",
    "photographer": "",   # leave empty to show no photographer name anywhere
    "coverFocus": "50% 44%",  # which part of the cover photo stays in view: "x% y%" (raise y to show lower)
    "grid": "rows",       # "rows" = equal-height rows (like Pixieset); "uniform" = equal 2:3 cells; "natural" = columns
}
FULL_EDGE = 2000    # longest side of the full-size copy, in pixels
THUMB_EDGE = 1000   # longest side of the grid thumbnail
HERO_WIDTH = 2400   # width of the full-screen cover photo (tall photos are sized by width too)
FULL_QUALITY = 82
THUMB_QUALITY = 78
# --------------------------------

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "originals"
OUTPUT = ROOT / "photos"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def natural_key(text):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", text)]


def slugify(text):
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "album"


def album_title(folder_name):
    # "01 Rashmi Mehendi Pics" -> "Rashmi Mehendi Pics"
    return re.sub(r"^\s*\d+[\s._-]*", "", folder_name).strip() or folder_name


FORCE = False  # set to True in main() when the size settings changed since the last build


def is_stale(source, target):
    if FORCE:
        return True
    return not target.exists() or target.stat().st_mtime < source.stat().st_mtime


def save_resized(image, longest_edge, target, quality):
    copy = image.copy()
    copy.thumbnail((longest_edge, longest_edge), Image.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    copy.save(target, "JPEG", quality=quality, optimize=True, progressive=True)
    return copy.size


def process_photo(source, album_out, stem):
    full_path = album_out / "full" / f"{stem}.jpg"
    thumb_path = album_out / "thumb" / f"{stem}.jpg"

    if is_stale(source, full_path) or is_stale(source, thumb_path):
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
            width, height = save_resized(image, FULL_EDGE, full_path, FULL_QUALITY)
            save_resized(image, THUMB_EDGE, thumb_path, THUMB_QUALITY)
    else:
        with Image.open(full_path) as existing:
            width, height = existing.size

    return {
        "thumb": thumb_path.relative_to(ROOT).as_posix(),
        "full": full_path.relative_to(ROOT).as_posix(),
        "w": width,
        "h": height,
        "name": f"{source.stem}.jpg",
    }


def remove_leftovers(album_out, keep_stems):
    for kind in ("full", "thumb"):
        folder = album_out / kind
        if folder.exists():
            for file in folder.glob("*.jpg"):
                if file.stem not in keep_stems:
                    file.unlink()


def build_hero():
    for candidate in sorted(SOURCE.glob("_cover.*")):
        if candidate.suffix.lower() in EXTENSIONS:
            target = OUTPUT / "_cover.jpg"
            if is_stale(candidate, target):
                with Image.open(candidate) as opened:
                    image = ImageOps.exif_transpose(opened).convert("RGB")
                    if image.width > HERO_WIDTH:  # never enlarge a smaller photo
                        height = round(image.height * HERO_WIDTH / image.width)
                        image = image.resize((HERO_WIDTH, height), Image.LANCZOS)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    image.save(target, "JPEG", quality=80, optimize=True, progressive=True)
            return target.relative_to(ROOT).as_posix()
    return None


def main():
    if not SOURCE.is_dir():
        SOURCE.mkdir()
        print(f'Created the "{SOURCE.name}" folder. Add one folder per album inside it, then run this again.')
        return 0

    album_folders = sorted(
        (p for p in SOURCE.iterdir() if p.is_dir() and not p.name.startswith((".", "_"))),
        key=lambda p: natural_key(p.name),
    )
    if not album_folders:
        print(f'No album folders found in "{SOURCE.name}". Add one folder per album and run this again.')
        return 0

    # If the size settings changed since the last build, redo every photo.
    global FORCE
    settings = f"{FULL_EDGE},{THUMB_EDGE},{HERO_WIDTH},{FULL_QUALITY},{THUMB_QUALITY}"
    stamp = OUTPUT / ".settings"
    FORCE = not stamp.exists() or stamp.read_text() != settings

    albums = []
    used_slugs = set()

    for folder in album_folders:
        files = sorted(
            (p for p in folder.iterdir()
             if p.is_file() and p.suffix.lower() in EXTENSIONS and not p.name.startswith(".")),
            key=lambda p: natural_key(p.name),
        )
        if not files:
            print(f"Skipping {folder.name!r}: no photos found")
            continue

        title = album_title(folder.name)
        slug = slugify(title)
        base, n = slug, 2
        while slug in used_slugs:
            slug, n = f"{base}-{n}", n + 1
        used_slugs.add(slug)

        album_out = OUTPUT / slug
        photos, stems = [], set()
        for index, source in enumerate(files, start=1):
            stem = slugify(source.stem)
            while stem in stems:
                stem = f"{stem}-{index}"
            stems.add(stem)
            try:
                photos.append(process_photo(source, album_out, stem))
            except Exception as error:  # a damaged file should not stop the build
                stems.discard(stem)
                print(f"  Skipped {source.name}: {error}")
            if index % 25 == 0 or index == len(files):
                print(f"  {title}: {index}/{len(files)}")

        remove_leftovers(album_out, stems)
        if photos:
            albums.append({
                "slug": slug,
                "title": title,
                "cover": photos[0]["thumb"],
                "photos": photos,
            })

    site = dict(SITE)
    hero = build_hero()
    if hero:
        site["hero"] = hero

    (ROOT / "albums.json").write_text(
        json.dumps({"site": site, "albums": albums}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    OUTPUT.mkdir(exist_ok=True)
    stamp.write_text(settings)

    total = sum(len(a["photos"]) for a in albums)
    size_mb = sum(f.stat().st_size for f in OUTPUT.rglob("*") if f.is_file()) / 1_000_000
    print(f"\nDone: {len(albums)} albums, {total} photos, {size_mb:.0f} MB in the photos folder.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
