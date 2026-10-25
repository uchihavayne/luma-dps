import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location("luma_fetch_icons", Path(__file__).resolve().parents[1] / "fetch_icons.py")
fetch_icons = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fetch_icons)


class IconTests(unittest.TestCase):
    def test_a_file_key_is_the_lowercase_asset_name_and_safe_anywhere(self):
        self.assertEqual(fetch_icons.key_of("/assets/Game/UI/Resource/Texture/Item/ETC/Icon_abysspoint.Icon_abysspoint"), "icon_abysspoint")
        self.assertEqual(fetch_icons.key_of("/assets/x/ICON_TE_SKILL_001.ICON_TE_SKILL_001"), "icon_te_skill_001")
        self.assertEqual(fetch_icons.key_of("/assets/x/Weird Name$.Weird Name$"), "weird_name_")

    def test_the_cdn_serves_an_asset_as_its_path_with_the_repeated_name_replaced_by_webp(self):
        self.assertEqual(
            fetch_icons.url_of("/assets/Game/UI/Resource/Texture/Item/ETC/Icon_abysspoint.Icon_abysspoint"),
            "https://cdn.questlog.gg/aion-2/assets/Game/UI/Resource/Texture/Item/ETC/Icon_abysspoint.webp",
        )

    def test_icons_are_collected_per_family_and_rows_without_a_usable_path_are_dropped(self):
        families = fetch_icons.collect(
            skills={"14090000": {"icon": "/assets/s/A.A"}, "5": {"icon": None}, "6": {"icon": "no-slash"}, "7": "x"},
            buffs={"100": {"icon": "/assets/b/B.B", "shown": False, "control": "stun"}, "101": {"icon": "/assets/b/C.C", "shown": False}, "102": {"icon": "/assets/b/D.D", "shown": True}},
            tickets={"3": {"icon": "/assets/t/T.T"}},
            items={"930100003": {"icon": "/assets/i/I.I"}, "5": {"icon": "/assets/i/J.J"}},
            wanted_items={930100003},
        )
        self.assertEqual(families["skills"], {14090000: "/assets/s/A.A"})
        self.assertEqual(sorted(families["buffs"]), [100, 102])
        self.assertEqual(families["tickets"], {3: "/assets/t/T.T"})
        self.assertEqual(families["items"], {930100003: "/assets/i/I.I"})

    def test_the_module_lists_each_file_once_and_maps_ids_to_their_position(self):
        families = {"skills": {2: "/assets/s/Zed.Zed", 1: "/assets/s/Abe.Abe"}, "buffs": {}, "tickets": {3: "/assets/t/Abe.Abe"}, "items": {}}
        text = fetch_icons.render(families, {"abe": "/assets/s/Abe.Abe", "zed": "/assets/s/Zed.Zed"})
        self.assertIn('export const ICONS = Object.freeze(["abe","zed"]);', text)
        self.assertIn("export const SKILLS_ICONS = Object.freeze({\n  1: 0,\n  2: 1,\n});", text)
        self.assertIn("export const TICKETS_ICONS = Object.freeze({\n  3: 0,\n});", text)
        self.assertIn("export const BUFFS_ICONS = Object.freeze({\n});", text)
        # An id whose file could not be downloaded is left out rather than pointing at nothing.
        partial = fetch_icons.render(families, {"abe": "/assets/s/Abe.Abe"})
        self.assertIn("export const SKILLS_ICONS = Object.freeze({\n  1: 0,\n});", partial)

    def test_extra_icons_are_listed_with_the_files_and_named_by_position(self):
        families = {"skills": {1: "/assets/s/Abe.Abe"}, "buffs": {}, "tickets": {}, "items": {}}
        text = fetch_icons.render(families, {"abe": "/assets/s/Abe.Abe"}, {"cube_gold": "/assets/c/G.G", "cube_red": "/assets/c/R.R"})
        self.assertIn('export const ICONS = Object.freeze(["abe","cube_gold","cube_red"]);', text)
        self.assertIn("export const EXTRA_ICONS = Object.freeze({\n  cube_gold: 1,\n  cube_red: 2,\n});", text)
        self.assertIn("export const EXTRA_ICONS = Object.freeze({\n});", fetch_icons.render(families, {"abe": "/assets/s/Abe.Abe"}))


if __name__ == "__main__":
    unittest.main()
