"""Create a reviewable portable preview and its corresponding source snapshot."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import re
import struct
import subprocess
import tempfile
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "release"
ROOT_FILES = ("README.md", "LICENSE", ".gitignore", ".gitattributes", "CHANGELOG.md", "RELEASING.md", "SECURITY.md", "tools/package.py", "tools/sign_update.py", "tools/audit.py", "tools/fetch_catalog.py", "tools/fetch_icons.py", "tools/fetch_maps.py")
CONFIG_FILES = ("engine/Cargo.toml", "engine/Cargo.lock", "engine/src/npc_names.json", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock", "src-tauri/build.rs", "src-tauri/windows-app-manifest.xml", "src-tauri/tauri.conf.json", "src-tauri/NATIVE_CAPTURE.md", "src-tauri/src/cube_reference.json", "dependency-notices/mapping.json")
COMMUNITY_SHARED_FILES = (
    "app/layout.tsx", "app/globals.css", "app/page.tsx", "app/ui.tsx",
    "app/r/[id]/page.tsx", "app/r/[id]/report.tsx", "app/v1/[...path]/route.ts",
    "lib/community.mjs", "lib/community.test.mjs", "lib/rooms.mjs", "lib/rooms.test.mjs", "db/schema.ts",
    "drizzle/0000_nebulous_lockheed.sql", "drizzle/0001_remarkable_doorman.sql", "drizzle/0002_futuristic_rafael_vega.sql", "drizzle/meta/0002_snapshot.json", "drizzle/meta/_journal.json", "drizzle/meta/0000_snapshot.json", "drizzle/meta/0001_snapshot.json",
    "public/favicon.svg", "tsconfig.json", "next.config.ts", "postcss.config.mjs",
    "drizzle.config.ts", "cloudflare-env.d.ts",
)
COMMUNITY_PORTABLE_FILES = (
    "README.md", ".gitignore", "package.json", "package-lock.json", "vite.config.ts",
    "worker.ts", "wrangler.jsonc", "eslint.config.mjs",
)
COMMUNITY_FILES = tuple(f"community/{name}" for name in COMMUNITY_SHARED_FILES + COMMUNITY_PORTABLE_FILES + ("SOURCE_FILES.json",))
PUBLIC_TREES = {
    ".github/workflows": {".yml", ".yaml"}, "engine/src": {".rs"}, "engine/tests": {".rs"},
    "ui/assets/classes": {".png"},
    "ui/assets/icons": {".webp"}, "ui/assets/maps": {".webp"},
    "ui": {".mjs", ".css", ".html", ".md"}, "docs": {".md"},
    "src-tauri/src": {".rs", ".js", ".css", ".html"}, "src-tauri/icons": {".png", ".ico"},
    "src-tauri/capabilities": {".json"}, "tools/tests": {".py"},
}
PRIVATE_PARTS = {"target", ".cache", "node_modules", "release", ".git", "__pycache__", "captures", "exports", "logs", ".sites-runtime", ".openai", ".wrangler", ".next", "dist"}
PRIVATE_NAMES = {"preferences.json", "history.json", "native-probe.json", "event-schedule-cache.json", "event-calendars.json", "community-shares.json", "cube-reference.json", ".env"}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def public_path(path, root):
    relative = path.relative_to(root)
    return not any(part.lower() in PRIVATE_PARTS for part in relative.parts) and path.name.lower() not in PRIVATE_NAMES and not path.name.lower().startswith((".env", ".dev.vars")) and path.suffix.lower() not in {".etl", ".pcap", ".pcapng", ".pyc", ".pfx", ".pem", ".key", ".wav", ".m4a", ".npy", ".db", ".sqlite", ".sqlite3"}


def validate_community(files):
    try:
        manifest = json.loads(files["community/SOURCE_FILES.json"])
    except (KeyError, ValueError, TypeError) as error:
        raise ValueError("Community source manifest is missing or invalid") from error
    if not isinstance(manifest, dict) or set(manifest) != {"schema_version", "shared_files", "portable_files"} or manifest["schema_version"] != 1 or not isinstance(manifest["shared_files"], list) or not isinstance(manifest["portable_files"], list):
        raise ValueError("Unsupported community source manifest")
    names = set()
    for row in manifest["shared_files"]:
        if not isinstance(row, dict) or set(row) != {"path", "bytes", "sha256"} or row["path"] not in COMMUNITY_SHARED_FILES or row["path"] in names:
            raise ValueError("Community source manifest contains an unreviewed path")
        names.add(row["path"])
        data = files[f"community/{row['path']}"]
        if row["bytes"] != len(data) or row["sha256"] != digest(data):
            raise ValueError(f"Community shared source changed after review: {row['path']}")
    if names != set(COMMUNITY_SHARED_FILES) or any(not isinstance(name, str) for name in manifest["portable_files"]) or set(manifest["portable_files"]) != set(COMMUNITY_PORTABLE_FILES) or len(manifest["portable_files"]) != len(COMMUNITY_PORTABLE_FILES):
        raise ValueError("Community source manifest does not match the reviewed file list")

    def check_config(value):
        if isinstance(value, dict):
            for key, item in value.items():
                normalized = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", key).casefold().replace("-", "_")
                if normalized in {"token", "secret", "password", "credentials", "private_key", "api_key", "authorization", "auth_bypass", "preview_bypass"} or normalized.endswith(("_token", "_secret", "_password", "_credentials", "_private_key", "_api_key")):
                    raise ValueError("Community configuration contains a private credential field")
                check_config(item)
        elif isinstance(value, list):
            for item in value:
                check_config(item)
        elif isinstance(value, str) and re.match(r"https?://[^/]*@", value, flags=re.IGNORECASE):
            raise ValueError("Community configuration contains a credential-bearing URL")

    for name in ("community/package.json", "community/package-lock.json", "community/wrangler.jsonc"):
        try:
            document = json.loads(files[name])
        except (ValueError, TypeError) as error:
            raise ValueError(f"Invalid portable community configuration: {name}") from error
        if not isinstance(document, dict):
            raise ValueError(f"Invalid portable community configuration: {name}")
        check_config(document)


def sources(root=None):
    root = Path(root or ROOT).resolve()
    paths = {root / name for name in ROOT_FILES + CONFIG_FILES + COMMUNITY_FILES}
    for directory, suffixes in PUBLIC_TREES.items():
        paths.update(path for path in (root / directory).rglob("*") if path.is_file() and path.suffix.lower() in suffixes and public_path(path, root))
    # This directory contains reviewed library notices, never runtime records.
    paths.update(path for path in (root / "dependency-notices").rglob("*") if path.is_file() and public_path(path, root))
    result = {}
    for path in sorted(paths):
        relative = path.relative_to(root).as_posix()
        if path.is_file():
            if path.is_symlink() or not path.resolve().is_relative_to(root):
                raise ValueError(f"Source link escapes the reviewed tree: {relative}")
            result[relative] = path.read_bytes()
    for required in ROOT_FILES + CONFIG_FILES + COMMUNITY_FILES + ("engine/src/lib.rs", "engine/src/packets.rs", "ui/index.html", "ui/app.mjs", "src-tauri/src/main.rs"):
        if required not in result:
            raise ValueError(f"Missing source: {required}")
    validate_community(result)
    return result


def version_parts(value):
    if not isinstance(value, str) or not re.fullmatch(r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)", value):
        raise ValueError("Release version must be a numeric major.minor.patch")
    parts = tuple(map(int, value.split("."))) + (0,)
    if any(part > 65535 for part in parts):
        raise ValueError("Release version exceeds the Windows resource limit")
    return parts


def validate_versions(root=None):
    root = Path(root or ROOT)
    config = json.loads((root / "src-tauri/tauri.conf.json").read_text(encoding="utf-8"))
    desktop = tomllib.loads((root / "src-tauri/Cargo.toml").read_text(encoding="utf-8"))["package"]
    engine = tomllib.loads((root / "engine/Cargo.toml").read_text(encoding="utf-8"))["package"]
    version_parts(config["version"]); version_parts(engine["version"])
    if desktop["name"] != "luma-desktop" or engine["name"] != "luma-engine" or config["version"] != desktop["version"]:
        raise ValueError("Desktop Cargo and Tauri configuration versions disagree")
    expected = {"luma-desktop": desktop["version"], "luma-engine": engine["version"]}
    for name, packages in (("engine/Cargo.lock", ["luma-engine"]), ("src-tauri/Cargo.lock", list(expected))):
        lock = tomllib.loads((root / name).read_text(encoding="utf-8"))
        for package in packages:
            entries = [entry for entry in lock.get("package", []) if entry.get("name") == package and not entry.get("source")]
            if len(entries) != 1 or entries[0].get("version") != expected[package]:
                raise ValueError(f"Stale local package version in {name}: {package}")
    return {"version": desktop["version"], "engine_version": engine["version"]}


def validate_pe(executable):
    if len(executable) < 64 or executable[:2] != b"MZ":
        raise ValueError("A compiled Windows x64 binary is required")
    offset = struct.unpack_from("<I", executable, 60)[0]
    if offset < 64 or offset + 26 > len(executable) or executable[offset:offset + 4] != b"PE\x00\x00":
        raise ValueError("Invalid Windows executable header")
    machine = struct.unpack_from("<H", executable, offset + 4)[0]
    optional_size = struct.unpack_from("<H", executable, offset + 20)[0]
    characteristics = struct.unpack_from("<H", executable, offset + 22)[0]
    magic = struct.unpack_from("<H", executable, offset + 24)[0]
    if machine != 0x8664 or magic != 0x20B or optional_size < 112 or offset + 24 + optional_size > len(executable) or not characteristics & 2 or characteristics & 0x2000:
        raise ValueError("Portable release must be Windows x64 (PE32+)")


def validate_binary_versions(version, resource_versions):
    expected = version_parts(version)
    if resource_versions.get("file") != expected or resource_versions.get("product") != expected:
        raise ValueError("Compiled executable version differs from the source release; rebuild it")


def validate_build_freshness(binary, original, root=None):
    root = Path(root or ROOT)
    binary_time = binary.stat().st_mtime_ns
    inputs = [name for name in original if name.startswith(("engine/src/", "src-tauri/src/", "ui/", "src-tauri/icons/", "src-tauri/capabilities/")) or name in {"engine/Cargo.toml", "engine/Cargo.lock", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock", "src-tauri/build.rs", "src-tauri/windows-app-manifest.xml", "src-tauri/tauri.conf.json"}]
    newer = [name for name in inputs if (root / name).stat().st_mtime_ns > binary_time]
    if newer:
        raise ValueError(f"Source was edited after the executable was built; rebuild it ({newer[0]})")


def dependency_notices():
    process = subprocess.run(["cargo", "metadata", "--manifest-path", str(ROOT / "src-tauri/Cargo.toml"), "--offline", "--locked", "--filter-platform", "x86_64-pc-windows-msvc", "--format-version", "1"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True)
    metadata = json.loads(process.stdout)
    files = {}
    index = []
    overrides_path = ROOT / "dependency-notices/mapping.json"
    overrides = json.loads(overrides_path.read_text(encoding="utf-8")) if overrides_path.exists() else {}
    nodes = {node["id"]: node for node in metadata["resolve"]["nodes"]}
    pending = [metadata["resolve"]["root"]]
    reachable = set()
    while pending:
        package_id = pending.pop()
        if package_id in reachable:
            continue
        reachable.add(package_id)
        pending.extend(nodes[package_id]["dependencies"])
    for package in sorted(metadata["packages"], key=lambda package: (package["name"], package["version"])):
        if package.get("source") is None or package["id"] not in reachable:
            continue
        directory = Path(package["manifest_path"]).parent
        label = f"{package['name']}-{package['version']}"
        record = {"name": package["name"], "version": package["version"], "license": package.get("license"), "repository": package.get("repository"), "notices": []}
        candidates = set()
        for pattern in ("LICENSE*", "LICENCE*", "COPYING*", "NOTICE*", "COPYRIGHT*", "license*", "licence*"):
            candidates.update(directory.glob(pattern))
        candidates.update((directory / "licenses").glob("*"))
        if package.get("license_file"):
            candidates.add(directory / package["license_file"])
        for path in sorted(candidates):
            if path.is_file() and path.stat().st_size <= 2_097_152:
                name = f"licenses/{label}/{path.relative_to(directory).as_posix()}"
                files[name] = path.read_bytes()
                record["notices"].append(name)
        if not record["notices"] and package["name"] in overrides:
            entry = overrides[package["name"]]
            group = (ROOT / "dependency-notices" / entry["folder"]).resolve()
            if not group.is_relative_to((ROOT / "dependency-notices").resolve()):
                raise ValueError("Dependency notice path escapes its directory")
            for path in sorted(group.rglob("*")):
                if path.is_file():
                    name = f"licenses/{label}/{path.relative_to(group).as_posix()}"
                    files[name] = path.read_bytes()
                    record["notices"].append(name)
            record["upstream_notices"] = entry
        record["published_source"] = f"https://crates.io/api/v1/crates/{package['name']}/{package['version']}/download"
        if not record["notices"]:
            record["notice_missing"] = True
        index.append(record)
    files["licenses/dependencies.json"] = json.dumps(index, ensure_ascii=False, indent=2).encode("utf-8")
    missing = [record["name"] for record in index if record.get("notice_missing")]
    if missing:
        raise ValueError(f"Dependency license text not found: {', '.join(missing)}")
    return files


def archive(path, files):
    path = Path(path)
    folded = set()
    for name in files:
        if not name or "\\" in name or ":" in name or name.startswith("/") or any(part in {"", ".", ".."} for part in name.split("/")) or name.casefold() in folded:
            raise ValueError(f"Unsafe or duplicate archive path: {name}")
        folded.add(name.casefold())
    descriptor, temporary = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    os.close(descriptor)
    temporary = Path(temporary)
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
            for name, data in sorted(files.items()):
                entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                entry.compress_type = zipfile.ZIP_DEFLATED
                entry.create_system = 3
                entry.external_attr = 0o100644 << 16
                bundle.writestr(entry, data, compresslevel=9)
        with zipfile.ZipFile(temporary) as bundle:
            if bundle.testzip() is not None or set(bundle.namelist()) != set(files):
                raise ValueError(f"Archive integrity failed: {path.name}")
            for name, expected in files.items():
                if bundle.read(name) != expected:
                    raise ValueError(f"Archive content mismatch: {name}")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def executable_versions(binary):
    """Read fixed Windows version resources without executing or elevating it."""
    import ctypes
    from ctypes import wintypes

    class FixedInfo(ctypes.Structure):
        _fields_ = [(name, wintypes.DWORD) for name in ("signature", "structure", "file_ms", "file_ls", "product_ms", "product_ls", "flags_mask", "flags", "os", "file_type", "subtype", "date_ms", "date_ls")]

    library = ctypes.WinDLL("version", use_last_error=True, winmode=0x800)
    library.GetFileVersionInfoSizeW.argtypes = [wintypes.LPCWSTR, ctypes.POINTER(wintypes.DWORD)]
    library.GetFileVersionInfoSizeW.restype = wintypes.DWORD
    library.GetFileVersionInfoW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID]
    library.GetFileVersionInfoW.restype = wintypes.BOOL
    library.VerQueryValueW.argtypes = [wintypes.LPCVOID, wintypes.LPCWSTR, ctypes.POINTER(ctypes.c_void_p), ctypes.POINTER(wintypes.UINT)]
    library.VerQueryValueW.restype = wintypes.BOOL
    handle = wintypes.DWORD()
    size = library.GetFileVersionInfoSizeW(str(binary), ctypes.byref(handle))
    if not 0 < size <= 2_097_152:
        raise ValueError("Executable has no valid Windows version resource")
    buffer = ctypes.create_string_buffer(size)
    if not library.GetFileVersionInfoW(str(binary), 0, size, buffer):
        raise ValueError("Cannot read executable version resource")
    pointer, length = ctypes.c_void_p(), wintypes.UINT()
    if not library.VerQueryValueW(buffer, "\\", ctypes.byref(pointer), ctypes.byref(length)) or not pointer.value or length.value < ctypes.sizeof(FixedInfo):
        raise ValueError("Executable fixed version resource is missing")
    info = ctypes.cast(pointer, ctypes.POINTER(FixedInfo)).contents
    if info.signature != 0xFEEF04BD:
        raise ValueError("Executable version resource signature is invalid")
    parts = lambda high, low: (high >> 16, high & 65535, low >> 16, low & 65535)
    return {"file": parts(info.file_ms, info.file_ls), "product": parts(info.product_ms, info.product_ls)}


def execution_level(binary):
    import ctypes
    from ctypes import wintypes
    import xml.etree.ElementTree as xml
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.LoadLibraryExW.argtypes = [wintypes.LPCWSTR, wintypes.HANDLE, wintypes.DWORD]
    kernel.LoadLibraryExW.restype = wintypes.HMODULE
    kernel.FindResourceW.argtypes = [wintypes.HMODULE, wintypes.LPCWSTR, wintypes.LPCWSTR]
    kernel.FindResourceW.restype = wintypes.HANDLE
    kernel.LoadResource.argtypes = [wintypes.HMODULE, wintypes.HANDLE]
    kernel.LoadResource.restype = wintypes.HANDLE
    kernel.SizeofResource.argtypes = [wintypes.HMODULE, wintypes.HANDLE]
    kernel.SizeofResource.restype = wintypes.DWORD
    kernel.LockResource.argtypes = [wintypes.HANDLE]
    kernel.LockResource.restype = ctypes.c_void_p
    kernel.FreeLibrary.argtypes = [wintypes.HMODULE]
    # Read resources without running the executable or requesting elevation.
    module = kernel.LoadLibraryExW(str(binary), None, 0x2 | 0x20)
    if not module:
        raise ValueError(f"Cannot inspect Windows executable resources: {ctypes.get_last_error()}")
    try:
        identifier = ctypes.cast(ctypes.c_void_p(1), wintypes.LPCWSTR)
        resource_type = ctypes.cast(ctypes.c_void_p(24), wintypes.LPCWSTR)
        resource = kernel.FindResourceW(module, identifier, resource_type)
        if not resource:
            raise ValueError("Executable has no Windows application manifest")
        size = kernel.SizeofResource(module, resource)
        data = kernel.LockResource(kernel.LoadResource(module, resource))
        if not data or not 0 < size <= 65536:
            raise ValueError("Executable manifest resource is invalid")
        manifest = xml.fromstring(ctypes.string_at(data, size).rstrip(b"\x00"))
        node = next((node for node in manifest.iter() if node.tag.endswith("requestedExecutionLevel")), None)
        return node.attrib if node is not None else {}
    finally:
        kernel.FreeLibrary(module)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-source", action="store_true", help="validate source files and versions without reading or building an executable")
    arguments = parser.parse_args()
    versions = validate_versions()
    original = sources()
    if arguments.check_source:
        print(f"Source ready: desktop {versions['version']}; engine {versions['engine_version']}; {len(original)} public files")
        return
    version = versions["version"]
    binary = ROOT / "src-tauri/target/release/luma-desktop.exe"
    executable = binary.read_bytes()
    validate_pe(executable)
    validate_binary_versions(version, executable_versions(binary))
    validate_build_freshness(binary, original)
    if execution_level(binary) != {"level": "requireAdministrator", "uiAccess": "false"}:
        raise ValueError("The shipped executable must request standard Windows administrator approval")
    OUT.mkdir(exist_ok=True)
    prefix = f"Luma-DPS-{version}-independent-preview"
    notices = dependency_notices()
    manifest = {"schema_version": 1, **versions, "preview": True, "architecture": "windows-x64", "executable": {"path": "Luma-DPS.exe", "bytes": len(executable), "sha256": digest(executable)}, "files": [{"path": name, "bytes": len(data), "sha256": digest(data)} for name, data in sorted((original | notices).items())]}
    original["SOURCE_MANIFEST.json"] = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
    source_path = OUT / f"{prefix}-source.zip"
    archive(source_path, original | notices)
    documents = {name: data for name, data in original.items() if name in {"README.md", "LICENSE", "CHANGELOG.md", "RELEASING.md", "SECURITY.md", "SOURCE_MANIFEST.json", "ui/README.md", "src-tauri/NATIVE_CAPTURE.md"} or name.startswith("docs/")}
    portable = {f"{prefix}/Luma-DPS.exe": executable}
    portable.update({f"{prefix}/{name}": data for name, data in documents.items()})
    portable.update({f"{prefix}/{name}": data for name, data in notices.items()})
    portable_path = OUT / f"{prefix}-windows-x64.zip"
    archive(portable_path, portable)
    checksums = "".join(f"{digest(path.read_bytes())}  {path.name}\n" for path in (portable_path, source_path))
    (OUT / "SHA256SUMS.txt").write_text(checksums, encoding="utf-8")
    for path in (portable_path, source_path):
        print(f"{path.name}: {path.stat().st_size / 1048576:.2f} MB")
    print(f"{len(original) - 1} application source files; {len(manifest['files'])} reviewed source/notice files")


if __name__ == "__main__":
    main()
