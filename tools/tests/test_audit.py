import importlib.util
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("luma_audit", Path(__file__).resolve().parents[1] / "audit.py")
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.ui = self.root / "ui"
        self.ui.mkdir()
        (self.ui / "index.html").write_text('<main id="meter"></main><script type="module" src="app.mjs"></script>', encoding="utf-8")
        (self.ui / "app.mjs").write_text("import './dependency.mjs'; $('#meter');", encoding="utf-8")
        (self.ui / "dependency.mjs").write_text("export const ok = true;", encoding="utf-8")
        (self.ui / "serve.mjs").write_text("const files = new Set(['index.html','app.mjs','dependency.mjs']);", encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def execute(self, script, **kwargs):
        return audit.execute("fixture", [[sys.executable, "-c", script]], self.root, self.root / "result.log", kwargs.pop("timeout", 10), **kwargs)

    def test_graph_follows_transitive_dependencies_without_executing_them(self):
        (self.ui / "dependency.mjs").write_text("import './nested.mjs'; throw new Error('must never execute')", encoding="utf-8")
        self.assertIn("dependency.mjs: missing or outside-UI asset ./nested.mjs", audit.frontend_contract(self.root))

    def test_preview_must_serve_the_real_module_graph(self):
        self.assertEqual(audit.frontend_contract(self.root), [])
        (self.ui / "serve.mjs").write_text("const files = new Set(['index.html','app.mjs']);", encoding="utf-8")
        self.assertIn("serve.mjs: required asset is not served: dependency.mjs", audit.frontend_contract(self.root))

    def test_module_entry_cannot_silently_become_a_classic_script(self):
        path = self.ui / "index.html"
        path.write_text(path.read_text().replace('type="module" ', ''), encoding="utf-8")
        self.assertIn("index.html: module script requires type=module: app.mjs", audit.frontend_contract(self.root))

    def test_changed_source_during_checks_and_unreadable_source_fail_the_gate(self):
        before = audit.fingerprint_files({"ui/app.mjs": (self.ui / "app.mjs").read_bytes()})
        self.execute("from pathlib import Path; Path('ui/app.mjs').write_text('changed')")
        after = audit.fingerprint_files({"ui/app.mjs": (self.ui / "app.mjs").read_bytes()})
        self.assertEqual(audit.source_stability(before, after)["status"], "failed")
        self.assertEqual(audit.source_stability(before, None)["status"], "failed")
        self.assertEqual(audit.source_stability(before, before)["status"], "passed")
        self.assertNotEqual(audit.fingerprint_files({"a": b"same"}), audit.fingerprint_files({"b": b"same"}))

    def test_duplicate_and_unresolved_literal_controls_fail_but_generated_ids_are_valid(self):
        with (self.ui / "index.html").open("a", encoding="utf-8") as output:
            output.write('<aside id="meter"></aside>')
        with (self.ui / "app.mjs").open("a", encoding="utf-8") as output:
            output.write(" $('#missing'); const html = '<div id=\"generated\"></div>'; $('#generated');")
        errors = audit.frontend_contract(self.root)
        self.assertIn("index.html: duplicate id meter", errors)
        self.assertIn("frontend: unresolved literal ID #missing", errors)
        self.assertFalse(any("#generated" in error for error in errors))

    def test_dependency_cannot_escape_public_frontend(self):
        (self.root / "private.mjs").write_text("export const secret = 1", encoding="utf-8")
        (self.ui / "app.mjs").write_text("import '../private.mjs'", encoding="utf-8")
        self.assertTrue(any("outside-UI" in error for error in audit.frontend_contract(self.root)))

    def test_nonzero_command_fails_and_keeps_local_diagnostic_log(self):
        result = self.execute("print('bounded fixture'); raise SystemExit(7)")
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["exit_code"], 7)
        self.assertIn("bounded fixture", (self.root / "result.log").read_text())

    def test_timeout_fails_and_stops_the_started_process(self):
        result = self.execute("import time; time.sleep(30)", timeout=.2)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["reason"], "timeout")
        self.assertLess(result["seconds"], 10)

    def test_missing_tool_and_empty_command_group_cannot_pass(self):
        missing = audit.execute("missing", [[str(self.root / "does-not-exist")]], self.root, self.root / "missing.log", 5)
        self.assertEqual(missing["status"], "failed")
        empty = audit.execute("empty", [], self.root, self.root / "empty.log", 5, "node")
        self.assertEqual(empty["status"], "failed")
        self.assertEqual(next(step for step in audit.steps(self.root) if step[0] == "frontend-tests")[1], [])

    def test_successful_exit_without_any_tests_is_a_failure(self):
        for framework in ["node", "rust", "python"]:
            self.assertEqual(self.execute("print('nothing ran')", framework=framework)["status"], "failed")
        self.assertEqual(self.execute("print('# tests 2\\n# skipped 2')", framework="node")["status"], "failed")

    def test_counts_keep_ignored_tests_visible_and_sum_rust_suites(self):
        self.assertEqual(audit.test_counts('test result: ok. 3 passed; 0 failed; 1 ignored\ntest result: ok. 2 passed; 0 failed; 0 ignored', 'rust'), (5, 1))
        self.assertEqual(audit.test_counts('ℹ tests 9\nℹ skipped 1', 'node'), (9, 1))
        self.assertEqual(audit.test_counts('Ran 6 tests in 1.5s\nOK (skipped=1)', 'python'), (6, 1))

    def test_a_crashed_new_run_cannot_leave_the_old_success_report(self):
        path = self.root / "report.json"
        path.write_text(json.dumps({"run_id": "old", "status": "passed", "automated_gate_passed": True}))
        with patch.object(audit, "ROOT", self.root), patch.object(audit, "frontend_contract", side_effect=RuntimeError("fixture")), patch.object(audit, "source_fingerprint", return_value="a" * 64):
            with self.assertRaises(RuntimeError):
                audit.main(["--static-only", "--report", str(path)])
        report = json.loads(path.read_text())
        self.assertNotEqual(report["run_id"], "old")
        self.assertEqual(report["status"], "running")
        self.assertFalse(report["automated_gate_passed"])

    def test_invalid_release_metadata_gets_a_current_failed_report(self):
        path = self.root / "report.json"
        folder = self.root / "src-tauri"
        folder.mkdir()
        (folder / "Cargo.toml").write_text("invalid toml = [")
        with patch.object(audit, "ROOT", self.root), patch.object(audit, "source_fingerprint", return_value="a" * 64), contextlib.redirect_stdout(io.StringIO()):
            code = audit.main(["--static-only", "--report", str(path)])
        self.assertEqual(code, 1)
        report = json.loads(path.read_text())
        self.assertEqual(report["status"], "failed")
        self.assertFalse(report["automated_gate_passed"])
        self.assertEqual(report["checks"][-1]["name"], "release-metadata")


if __name__ == "__main__":
    unittest.main()
