"""Download the seven open-world maps once and shrink them into ui/assets/maps.

The map pictures are the game's own (NCSOFT's), as served by the CDN of the public game database that
Questlog's desktop app and website use. Luma never fetches a map while it runs. The world table in
ui/maps.mjs (where each map's corners are in game coordinates) comes from the same source's map
definition; see docs/reference-data.md for provenance and the note that its terms were not reviewed.

    python tools/fetch_maps.py            # download what is missing
    python tools/fetch_maps.py --refresh  # download everything again
"""
import argparse
import io
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / "ui" / "assets" / "maps"
CDN = "https://cdn.questlog.gg/aion-2/map/v3"
KEYS = ("World_L_Starter", "World_L_A", "World_L_B", "World_D_Starter", "World_D_A", "World_D_B", "Abyss_Reshanta_A")
SIZE = 2048


def file_name(key):
    return key.lower() + ".webp"


def fetch(key):
    from PIL import Image  # Pillow, only needed here

    request = urllib.request.Request(f"{CDN}/{key}.webp", headers={"User-Agent": "luma-dps map refresh (+local)"})
    with urllib.request.urlopen(request, timeout=120) as response:
        picture = Image.open(io.BytesIO(response.read())).convert("RGB")
    picture.thumbnail((SIZE, SIZE), Image.LANCZOS)
    out = io.BytesIO()
    picture.save(out, "WEBP", quality=72, method=6)
    return out.getvalue()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    refresh = parser.parse_args().refresh
    FOLDER.mkdir(parents=True, exist_ok=True)
    for key in KEYS:
        target = FOLDER / file_name(key)
        if refresh or not target.exists():
            target.write_bytes(fetch(key))
        print(f"{target.name}: {target.stat().st_size} bytes")


if __name__ == "__main__":
    main()
