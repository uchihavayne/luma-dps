import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SPEC = importlib.util.spec_from_file_location("luma_package", Path(__file__).resolve().parents[1] / "package.py")
package = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(package)


def write(root, name, content="public"):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def source_tree(root, version="0.9.3", engine="0.9.0"):
    for name in package.ROOT_FILES + package.CONFIG_FILES + ("engine/src/lib.rs", "engine/src/packets.rs", "ui/index.html", "ui/app.mjs", "src-tauri/src/main.rs"):
        write(root, name)
    write(root, "src-tauri/tauri.conf.json", json.dumps({"version": version}))
    write(root, "src-tauri/Cargo.toml", f'[package]\nname="luma-desktop"\nversion="{version}"\n')
    write(root, "engine/Cargo.toml", f'[package]\nname="luma-engine"\nversion="{engine}"\n')
    write(root, "engine/Cargo.lock", f'[[package]]\nname="luma-engine"\nversion="{engine}"\n')
    write(root, "src-tauri/Cargo.lock", f'[[package]]\nname="luma-desktop"\nversion="{version}"\n[[package]]\nname="luma-engine"\nversion="{engine}"\n')
    write(root, "dependency-notices/mapping.json", "{}")


def pe_binary(machine=0x8664, magic=0x20B):
    data = bytearray(512); data[:2] = b"MZ"
    struct.pack_into("<I", data, 60, 64); data[64:68] = b"PE\0\0"
    struct.pack_into("<H", data, 68, machine); struct.pack_into("<H", data, 84, 240)
    struct.pack_into("<H", data, 86, 2); struct.pack_into("<H", data, 88, magic)
    return bytes(data)


class PackageTests(unittest.TestCase):
    def setUp(self):
        fixture_directory = (package.ROOT / ".cache/package-tests").resolve()
        if not fixture_directory.is_relative_to(package.ROOT.resolve()):
            raise ValueError("Test fixtures must stay inside the source workspace")
        fixture_directory.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(prefix="test-", dir=fixture_directory)
        self.root = Path(self.temporary.name)
        if not self.root.resolve().is_relative_to(fixture_directory):
            raise ValueError("Temporary fixture path escaped its directory")
        self.addCleanup(self.temporary.cleanup)
        source_tree(self.root)

    def test_desktop_configuration_and_both_locks_are_checked_without_bumping_engine(self):
        self.assertEqual(package.validate_versions(self.root), {"version": "0.9.3", "engine_version": "0.9.0"})
        write(self.root, "src-tauri/tauri.conf.json", '{"version":"0.9.2"}')
        with self.assertRaisesRegex(ValueError, "disagree"):
            package.validate_versions(self.root)
        source_tree(self.root)
        write(self.root, "src-tauri/Cargo.lock", '[[package]]\nname="luma-desktop"\nversion="0.9.2"\n[[package]]\nname="luma-engine"\nversion="0.9.0"\n')
        with self.assertRaisesRegex(ValueError, "Stale"):
            package.validate_versions(self.root)
        source_tree(self.root)
        write(self.root, "engine/Cargo.lock", '[[package]]\nname="luma-engine"\nversion="0.8.0"\n')
        with self.assertRaisesRegex(ValueError, "Stale"):
            package.validate_versions(self.root)

    def test_numeric_version_and_compiled_file_and_product_resources_must_match(self):
        for invalid in ("0.9.3-beta", "../release", "1.2", "01.2.3", "65536.0.0", None):
            with self.assertRaises(ValueError):
                package.version_parts(invalid)
        package.validate_binary_versions("0.9.3", {"file": (0, 9, 3, 0), "product": (0, 9, 3, 0)})
        for resources in ({"file": (0, 9, 2, 0), "product": (0, 9, 3, 0)}, {"file": (0, 9, 3, 0), "product": (0, 9, 2, 0)}, {}):
            with self.assertRaisesRegex(ValueError, "rebuild"):
                package.validate_binary_versions("0.9.3", resources)

    def test_x64_executable_validation_rejects_truncated_fake_x86_and_arm64_headers(self):
        package.validate_pe(pe_binary())
        for binary in (b"MZ", pe_binary()[:100], pe_binary(machine=0x14C), pe_binary(machine=0xAA64), pe_binary(magic=0x10B)):
            with self.assertRaises(ValueError):
                package.validate_pe(binary)

    def test_private_captures_runtime_data_and_caches_are_never_selected_as_source(self):
        private = ("ui/preferences.json", "ui/native-probe.json", "ui/history.json", "ui/session.etl", "docs/trial.pcapng", "docs/local-report.json", "ui/.cache/private.mjs", "ui/logs/private.mjs", "tools/__pycache__/package.pyc", "engine/target/private.rs", "ui/exports/private.html", "release/private.md")
        for name in private:
            write(self.root, name, "PRIVATE")
        write(self.root, "ui/tests/view.test.mjs", "test")
        selected = package.sources(self.root)
        self.assertTrue(set(private).isdisjoint(selected))
        self.assertIn("ui/tests/view.test.mjs", selected)
        self.assertNotIn(b"PRIVATE", selected.values())
        (self.root / "LICENSE").unlink()
        with self.assertRaisesRegex(ValueError, "Missing source"):
            package.sources(self.root)

    def test_a_source_link_is_rejected_before_reading_its_contents(self):
        link = self.root / "ui/linked.mjs"
        try:
            link.symlink_to(self.root / "LICENSE")
        except OSError:
            self.skipTest("Host does not permit creating a symbolic link")
        with self.assertRaisesRegex(ValueError, "Source link"):
            package.sources(self.root)

    def test_source_edit_after_build_is_rejected_but_document_edits_are_allowed(self):
        selected = package.sources(self.root)
        binary = write(self.root, "src-tauri/target/release/luma-desktop.exe")
        built = binary.stat().st_mtime_ns
        os.utime(self.root / "README.md", ns=(built + 10_000_000, built + 10_000_000))
        package.validate_build_freshness(binary, selected, self.root)
        os.utime(self.root / "ui/app.mjs", ns=(built + 20_000_000, built + 20_000_000))
        with self.assertRaisesRegex(ValueError, "after the executable"):
            package.validate_build_freshness(binary, selected, self.root)

    def test_archives_are_deterministic_and_reject_unsafe_paths_without_replacing_a_file(self):
        a, b = self.root / "a.zip", self.root / "b.zip"
        files = {"folder/app.js": b"app", "LICENSE": b"license"}
        package.archive(a, files); package.archive(b, files)
        self.assertEqual(a.read_bytes(), b.read_bytes())
        before = a.read_bytes()
        for unsafe in ("../secret", "/secret", "C:/secret", "folder\\secret", "folder//secret"):
            with self.assertRaises(ValueError):
                package.archive(a, {unsafe: b"bad"})
            self.assertEqual(a.read_bytes(), before)
        with self.assertRaises(ValueError):
            package.archive(a, {"file": b"a", "FILE": b"b"})
        self.assertEqual(list(self.root.glob("*.tmp")), [])

    def test_full_package_contains_current_binary_public_docs_hashes_and_notices_only(self):
        write(self.root, "ui/preferences.json", "PRIVATE")
        write(self.root, "docs/events-sources.md", "clocks")
        binary = self.root / "src-tauri/target/release/luma-desktop.exe"
        binary.parent.mkdir(parents=True); binary.write_bytes(pe_binary())
        notices = {"licenses/dependency/LICENSE": b"license", "licenses/dependencies.json": b"[]"}
        with patch.object(package, "ROOT", self.root), patch.object(package, "OUT", self.root / "release"), patch.object(package, "dependency_notices", return_value=notices), patch.object(package, "executable_versions", return_value={"file": (0, 9, 3, 0), "product": (0, 9, 3, 0)}), patch.object(package, "execution_level", return_value={"level": "requireAdministrator", "uiAccess": "false"}), patch("sys.argv", ["package.py"]), contextlib.redirect_stdout(io.StringIO()):
            package.main()
        prefix = "Luma-DPS-0.9.3-independent-preview"
        source_path = self.root / f"release/{prefix}-source.zip"
        with zipfile.ZipFile(source_path) as archive:
            self.assertNotIn("ui/preferences.json", archive.namelist())
            manifest = json.loads(archive.read("SOURCE_MANIFEST.json"))
            self.assertEqual(manifest["engine_version"], "0.9.0")
            self.assertEqual(manifest["executable"]["sha256"], package.digest(binary.read_bytes()))
            for record in manifest["files"]:
                self.assertEqual(record["sha256"], package.digest(archive.read(record["path"])))
            self.assertIn("licenses/dependency/LICENSE", {row["path"] for row in manifest["files"]})
        with zipfile.ZipFile(self.root / f"release/{prefix}-windows-x64.zip") as archive:
            self.assertEqual(archive.read(f"{prefix}/Luma-DPS.exe"), pe_binary())
            self.assertIn(f"{prefix}/docs/events-sources.md", archive.namelist())
            self.assertIn(f"{prefix}/SOURCE_MANIFEST.json", archive.namelist())
        checksum = (self.root / "release/SHA256SUMS.txt").read_text()
        self.assertIn(package.digest(source_path.read_bytes()), checksum)

    def test_check_source_does_not_read_or_execute_a_binary_or_query_cargo(self):
        with patch.object(package, "ROOT", self.root), patch.object(package, "dependency_notices", side_effect=AssertionError("Cargo must not be queried")), patch.object(package, "executable_versions", side_effect=AssertionError("Binary must not be read")), patch("sys.argv", ["package.py", "--check-source"]), contextlib.redirect_stdout(io.StringIO()) as output:
            package.main()
        self.assertIn("desktop 0.9.3; engine 0.9.0", output.getvalue())


if __name__ == "__main__":
    unittest.main()
