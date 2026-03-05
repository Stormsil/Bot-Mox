from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
import unittest

TOOLKIT_ROOT = Path(__file__).resolve().parents[1]


class CliSmokeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp_dir = Path(tempfile.mkdtemp(prefix="gitingest-toolkit-smoke-"))
        self.repo_dir = self.tmp_dir / "repo"
        self.out_dir = self.tmp_dir / "out"
        self.repo_dir.mkdir(parents=True, exist_ok=True)

        (self.repo_dir / "apps/backend/src/modules/auth").mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "apps/frontend/src/pages/auth").mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "apps/admin/src/pages/auth").mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "apps/agent/src/auth").mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "docs").mkdir(parents=True, exist_ok=True)
        (self.repo_dir / "apps/frontend/tests").mkdir(parents=True, exist_ok=True)

        (self.repo_dir / "apps/backend/src/modules/auth/auth.service.ts").write_text(
            "export function verifyToken(token: string) { return token.length > 0; }\n",
            encoding="utf-8",
        )
        (self.repo_dir / "apps/frontend/src/pages/auth/LoginPage.tsx").write_text(
            "const header = 'Authorization: Bearer'; export default header;\n",
            encoding="utf-8",
        )
        (self.repo_dir / "apps/admin/src/pages/auth/AdminLogin.tsx").write_text(
            "export const role = 'admin';\n",
            encoding="utf-8",
        )
        (self.repo_dir / "apps/agent/src/auth/token.ts").write_text(
            "export const agent_token = 't';\n",
            encoding="utf-8",
        )
        (self.repo_dir / "apps/frontend/tests/auth.test.ts").write_text(
            "describe('auth', () => {})\n",
            encoding="utf-8",
        )
        (self.repo_dir / "docs/auth.md").write_text(
            "Authentication flow docs\n",
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def _run(self, args: list[str]) -> subprocess.CompletedProcess:
        env = dict(os.environ)
        env.setdefault("PYTHONUTF8", "1")
        process = subprocess.run(
            [sys.executable, "-m", "toolkit.cli", *args],
            cwd=str(TOOLKIT_ROOT),
            capture_output=True,
            text=True,
            env=env,
        )
        if process.returncode != 0:
            self.fail(
                f"Command failed: {' '.join(args)}\nstdout:\n{process.stdout}\nstderr:\n{process.stderr}"
            )
        return process

    def test_cli_end_to_end(self) -> None:
        self._run(
            [
                "heatmap",
                "--source",
                str(self.repo_dir),
                "--depth",
                "2",
                "--out",
                str(self.out_dir),
            ]
        )
        self.assertTrue((self.out_dir / "heatmap/heatmap_dirs.csv").exists())
        self.assertTrue((self.out_dir / "heatmap/heatmap_tree.md").exists())

        self._run(
            [
                "profile",
                "--source",
                str(self.repo_dir),
                "--scope",
                "apps/frontend",
                "--out",
                str(self.out_dir),
            ]
        )
        self.assertTrue((self.out_dir / "profiles/audit-ignore.generated.txt").exists())

        self._run(
            [
                "structure",
                "--source",
                str(self.repo_dir),
                "--scope",
                "apps",
                "--out",
                str(self.out_dir),
            ]
        )
        self.assertTrue((self.out_dir / "structure/repo_structure.md").exists())
        self.assertTrue((self.out_dir / "structure/files_index.json").exists())
        self.assertTrue((self.out_dir / "structure/folders_index.json").exists())

        self._run(
            [
                "discover",
                "--source",
                str(self.repo_dir),
                "--topic",
                "auth",
                "--scope",
                "apps/backend",
                "--scope",
                "apps/frontend",
                "--scope",
                "apps/admin",
                "--scope",
                "apps/agent",
                "--top",
                "10",
                "--out",
                str(self.out_dir),
            ]
        )
        self.assertTrue((self.out_dir / "discover/auth.files.json").exists())
        self.assertTrue((self.out_dir / "discover/auth.files.md").exists())
        discover_payload = json.loads(
            (self.out_dir / "discover/auth.files.json").read_text(encoding="utf-8")
        )
        discovered_paths = [item["path"] for item in discover_payload["files"]]
        self.assertIn("apps/backend/src/modules/auth/auth.service.ts", discovered_paths)

        self._run(
            [
                "ingest",
                "--source",
                str(self.repo_dir),
                "--include",
                "apps/backend/**",
                "--include",
                "apps/frontend/**",
                "--prefix",
                "auth-snapshot",
                "--out",
                str(self.out_dir),
            ]
        )
        self.assertTrue((self.out_dir / "ingest/auth-snapshot.summary.txt").exists())
        self.assertTrue((self.out_dir / "ingest/auth-snapshot.tree.txt").exists())
        self.assertTrue((self.out_dir / "ingest/auth-snapshot.content.txt").exists())
        self.assertTrue((self.out_dir / "ingest/auth-snapshot.combined.txt").exists())

        self._run(
            [
                "bundle",
                "--source",
                str(self.repo_dir),
                "--topic",
                "auth",
                "--scope",
                "apps/backend",
                "--scope",
                "apps/frontend",
                "--scope",
                "apps/admin",
                "--scope",
                "apps/agent",
                "--out-root",
                str(self.out_dir),
            ]
        )

        bundle_path = self.out_dir / "bundles/auth.txt"
        index_path = self.out_dir / "bundles/auth.index.json"
        self.assertTrue(bundle_path.exists())
        self.assertTrue(index_path.exists())

        payload = json.loads(index_path.read_text(encoding="utf-8"))
        self.assertGreater(payload["totals"]["selected_files"], 0)


if __name__ == "__main__":
    unittest.main()
