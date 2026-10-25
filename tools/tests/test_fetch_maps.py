import importlib.util
import re
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("luma_fetch_maps", ROOT / "tools" / "fetch_maps.py")
fetch_maps = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fetch_maps)


class MapTests(unittest.TestCase):
    def test_a_map_is_stored_under_its_lowercase_key(self):
        self.assertEqual(fetch_maps.file_name("World_L_A"), "world_l_a.webp")
        self.assertEqual(fetch_maps.file_name("Abyss_Reshanta_A"), "abyss_reshanta_a.webp")

    def test_the_tool_downloads_exactly_the_maps_the_world_table_names(self):
        table = (ROOT / "ui" / "maps.mjs").read_text(encoding="utf-8")
        named = {name for name in re.findall(r"world\('[^']+', '([a-z0-9_]+)'", table)}
        self.assertEqual(named, {fetch_maps.file_name(key)[:-5] for key in fetch_maps.KEYS})

    def test_every_listed_map_is_on_disk(self):
        for key in fetch_maps.KEYS:
            self.assertTrue((fetch_maps.FOLDER / fetch_maps.file_name(key)).exists(), key)


if __name__ == "__main__":
    unittest.main()
