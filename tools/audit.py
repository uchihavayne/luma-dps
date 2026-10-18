"""Run the automated release gate and save a local, reviewable result."""
from pathlib import Path
from html.parser import HTMLParser
import argparse
import ast
import datetime as dt
import hashlib
import json
import os
import re
import runpy
import signal
import subprocess
import sys
import time
import tomllib

ROOT = Path(__file__).resolve().parents[1]


class EntryHtml(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.assets = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        if tag == "script" and attrs.get("src"):
            self.assets.append(attrs["src"])
            self.scripts.append((attrs["src"], attrs.get("type", "")))
        if tag == "link" and attrs.get("rel") == "stylesheet" and attrs.get("href"):
            self.assets.append(attrs["href"])


def frontend_contract(root):
    """Check the real entry point, module graph and preview asset allowlist."""
    ui = (Path(root) / "ui").resolve()
    errors = []

    def local(value, origin):
        path = (origin.parent / value.split("?", 1)[0].split("#", 1)[0]).resolve()
        if not path.is_relative_to(ui) or not path.is_file():
            errors.append(f"{origin.name}: missing or outside-UI asset {value}")
            return None
        return path

    entry = EntryHtml()
    entry.feed((ui / "index.html").read_text(encoding="utf-8"))
    if not any(src.endswith(".mjs") and kind == "module" for src, kind in entry.scripts):
        errors.append("index.html: no module entry point")
    for src, kind in entry.scripts:
        if src.endswith(".mjs") and kind != "module":
            errors.append(f"index.html: module script requires type=module: {src}")
    for name in sorted(set(entry.ids)):
        if entry.ids.count(name) > 1:
            errors.append(f"index.html: duplicate id {name}")
    required, queue = set(), []
    for asset in entry.assets:
        path = local(asset, ui / "index.html")
        if path:
            required.add(path.name)
            if path.suffix == ".mjs":
                queue.append(path)
    visited = set()
    imports = re.compile(r"(?:\bfrom\s*|\bimport\s*\(?\s*)['\"](\.{1,2}/[^'\"\n]+)['\"]")
    while queue:
        module = queue.pop()
        if module in visited:
            continue
        visited.add(module)
        for value in imports.findall(module.read_text(encoding="utf-8")):
            path = local(value, module)
            if path:
                required.add(path.relative_to(ui).as_posix())
                if path.suffix == ".mjs":
                    queue.append(path)
    sources = "\n".join(path.read_text(encoding="utf-8") for path in visited)
    generated_ids = set(re.findall(r"\bid=['\"]([\w-]+)['\"]", sources))
    known = set(entry.ids) | generated_ids
    for _, reference in re.findall(r"\$\(\s*(['\"])#([\w-]+)\1\s*\)", sources):
        if reference not in known:
            errors.append(f"frontend: unresolved literal ID #{reference}")
    server = (ui / "serve.mjs").read_text(encoding="utf-8")
    match = re.search(r"new Set\((\[[\s\S]*?\])\)", server)
    try:
        allowed = set(ast.literal_eval(match.group(1))) if match else set()
        if not all(isinstance(name, str) for name in allowed):
            raise ValueError("Non-string preview asset")
    except (ValueError, SyntaxError, TypeError):
        allowed = set()
        errors.append("serve.mjs: unreadable preview asset allowlist")
    for name in sorted(required - allowed):
        errors.append(f"serve.mjs: required asset is not served: {name}")
    for name in sorted(allowed):
        local(name, ui / "serve.mjs")
    return sorted(set(errors))


def fingerprint_files(files):
    digest = hashlib.sha256()
    for name, content in sorted(files.items()):
        digest.update(name.encode("utf-8") + b"\0")
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(hashlib.sha256(content).digest())
    return digest.hexdigest()


def source_fingerprint(root):
    package = runpy.run_path(str(Path(root) / "tools/package.py"))
    return fingerprint_files(package["sources"](root))


def source_stability(before, after):
    passed = before is not None and after is not None and before == after
    return {"name": "source-stability", "status": "passed" if passed else "failed",
            "reason": "unchanged" if passed else "public-source-changed-or-unreadable"}


def write_report(path, report):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + "." + report["run_id"] + ".tmp")
    temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def test_counts(output, framework):
    if framework == "rust":
        rows = re.findall(r"test result: ok\. (\d+) passed; \d+ failed; (\d+) ignored", output)
        return sum(int(row[0]) for row in rows), sum(int(row[1]) for row in rows)
    if framework == "node":
        tests = re.findall(r"(?:#|ℹ) tests (\d+)", output)
        skips = re.findall(r"(?:#|ℹ) skipped (\d+)", output)
        return sum(map(int, tests)), sum(map(int, skips))
    if framework == "python":
        counts = re.findall(r"Ran (\d+) tests? in", output)
        skipped = re.findall(r"skipped=(\d+)", output)
        return sum(map(int, counts)), sum(map(int, skipped))
    return None, None


def stop_process(process):
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       creationflags=subprocess.CREATE_NO_WINDOW, check=False)
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    if process.poll() is None:
        process.kill()
    process.wait()


def execute(name, commands, root, log, timeout, framework=None):
    started = time.monotonic()
    result = {"name": name, "status": "passed", "exit_code": 0, "tests": None, "skipped": None}
    if not commands:
        Path(log).write_text("No commands selected\n", encoding="utf-8")
        return {**result, "status": "failed", "reason": "empty-command-group", "seconds": 0}
    try:
        with Path(log).open("wb") as output:
            for command in commands:
                remaining = timeout - (time.monotonic() - started)
                if remaining <= 0:
                    raise subprocess.TimeoutExpired(command, timeout)
                flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
                process = subprocess.Popen(command, cwd=root, stdout=output, stderr=subprocess.STDOUT,
                                           start_new_session=os.name != "nt", creationflags=flags)
                try:
                    code = process.wait(timeout=remaining)
                except (subprocess.TimeoutExpired, KeyboardInterrupt):
                    stop_process(process)
                    raise
                if code:
                    result.update(status="failed", exit_code=code, reason="command-failed")
                    break
    except subprocess.TimeoutExpired:
        result.update(status="failed", exit_code=None, reason="timeout")
    except OSError:
        result.update(status="failed", exit_code=None, reason="command-unavailable")
    if framework and result["status"] == "passed":
        count, skipped = test_counts(Path(log).read_text(encoding="utf-8", errors="replace"), framework)
        result.update(tests=count, skipped=skipped)
        if not count or framework != "rust" and count <= skipped:
            result.update(status="failed", reason="no-tests-discovered")
    result["seconds"] = round(time.monotonic() - started, 3)
    return result


def steps(root):
    root = Path(root)
    def node_tests(folder):
        files = [str(path) for path in sorted((root / folder).glob("*.test.mjs"))]
        return [["node", "--test", *files]] if files else []
    return [
        ("source-package", [[sys.executable, "tools/package.py", "--check-source"]], None),
        ("engine-format", [["cargo", "fmt", "--manifest-path", "engine/Cargo.toml", "--", "--check"]], None),
        ("desktop-format", [["cargo", "fmt", "--manifest-path", "src-tauri/Cargo.toml", "--", "--check"]], None),
        ("frontend-syntax", [["node", "--check", str(path)] for path in sorted((root / "ui").rglob("*.mjs"))], None),
        ("packaging-tests", [[sys.executable, "-m", "unittest", "discover", "-s", "tools/tests", "-p", "test_*.py"]], "python"),
        ("engine-tests", [["cargo", "test", "--manifest-path", "engine/Cargo.toml", "--locked"]], "rust"),
        ("desktop-tests", [["cargo", "test", "--manifest-path", "src-tauri/Cargo.toml", "--locked"]], "rust"),
        ("frontend-tests", node_tests("ui/tests"), "node"),
        ("community-tests", node_tests("community/lib"), "node"),
    ]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--static-only", action="store_true", help="Only inspect frontend contracts; this does not pass the full gate")
    parser.add_argument("--report", type=Path, default=Path(".cache/audit/report.json"))
    parser.add_argument("--timeout", type=int, default=1200, help="Maximum seconds for each command group")
    args = parser.parse_args(argv)
    if not 1 <= args.timeout <= 3600:
        parser.error("timeout must be between 1 and 3600 seconds")
    report_path = args.report.resolve()
    run_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S") + f"-{os.getpid()}"
    write_report(report_path, {"schema_version": 1, "run_id": run_id, "status": "running",
                              "automated_gate_passed": False, "live_game_validation": "not_run",
                              "publication_performed": False})
    logs = report_path.parent / ("logs-" + run_id)
    logs.mkdir(parents=True, exist_ok=False)
    try:
        before = source_fingerprint(ROOT)
    except (OSError, ValueError, KeyError, SyntaxError):
        before = None
    try:
        errors = frontend_contract(ROOT)
    except (OSError, UnicodeError, ValueError) as error:
        errors = [f"Frontend contract could not be read ({type(error).__name__})"]
    checks = [{"name": "frontend-contract", "status": "failed" if errors else "passed", "errors": errors}]
    print(f"{'FAIL' if errors else 'PASS'} frontend-contract", flush=True)
    if not args.static_only:
        for name, commands, framework in steps(ROOT):
            result = execute(name, commands, ROOT, logs / (name + ".log"), args.timeout, framework)
            result["log"] = f"{logs.name}/{name}.log"
            checks.append(result)
            print(f"{'PASS' if result['status'] == 'passed' else 'FAIL'} {name} ({result['seconds']}s)", flush=True)
    try:
        after = source_fingerprint(ROOT)
    except (OSError, ValueError, KeyError, SyntaxError):
        after = None
    stability = source_stability(before, after)
    checks.append(stability)
    print(f"{'PASS' if stability['status'] == 'passed' else 'FAIL'} source-stability", flush=True)
    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, stderr=subprocess.DEVNULL, text=True).strip()
        dirty = bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, stderr=subprocess.DEVNULL, text=True).strip())
    except (OSError, subprocess.CalledProcessError):
        commit = None
        dirty = None
    try:
        desktop = tomllib.loads((ROOT / "src-tauri/Cargo.toml").read_text(encoding="utf-8"))["package"]["version"]
    except (OSError, ValueError, KeyError):
        desktop = None
        checks.append({"name": "release-metadata", "status": "failed", "reason": "unreadable-version"})
    passed = all(check["status"] == "passed" for check in checks)
    report = {"schema_version": 1, "version": desktop, "commit": commit, "working_tree_dirty": dirty,
              "public_source_sha256": after, "run_id": run_id,
              "mode": "static" if args.static_only else "full", "status": "passed" if passed else "failed",
              "automated_gate_passed": passed and not args.static_only, "checks": checks,
              "live_game_validation": "not_run", "publication_performed": False}
    write_report(report_path, report)
    print(f"Report: {args.report}", flush=True)
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
