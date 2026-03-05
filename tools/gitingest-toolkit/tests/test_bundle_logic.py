from __future__ import annotations

import sys
from pathlib import Path
import unittest

TOOLKIT_ROOT = Path(__file__).resolve().parents[1]
if str(TOOLKIT_ROOT) not in sys.path:
    sys.path.insert(0, str(TOOLKIT_ROOT))

from toolkit.bundle import compress_ranked_files, rank_files
from toolkit.gitingest_adapter import FileRecord


class BundleLogicTests(unittest.TestCase):
    def test_rank_files_prioritizes_auth_signals(self) -> None:
        files = [
            FileRecord(
                path="apps/backend/src/modules/auth/auth.service.ts",
                content="Authorization: Bearer token verify session",
                tokens_estimate=50,
                bucket="code",
            ),
            FileRecord(
                path="docs/auth-flow.md",
                content="Authentication docs",
                tokens_estimate=30,
                bucket="docs",
            ),
            FileRecord(
                path="apps/frontend/src/pages/dashboard.tsx",
                content="render dashboard",
                tokens_estimate=40,
                bucket="code",
            ),
        ]
        ranked, invalid = rank_files(
            files,
            keywords=["auth", "bearer"],
            path_hints=["auth"],
            regex_patterns=["Authorization\\s*:\\s*Bearer"],
        )
        self.assertEqual(invalid, [])
        self.assertEqual(ranked[0].path, "apps/backend/src/modules/auth/auth.service.ts")
        self.assertGreater(ranked[0].score, ranked[-1].score)

    def test_compress_ranked_files_drops_noise_first(self) -> None:
        files = [
            FileRecord(
                path="apps/backend/src/modules/auth/auth.service.ts",
                content="verify token jwt",
                tokens_estimate=120,
                bucket="code",
            ),
            FileRecord(
                path="docs/auth.md",
                content="documentation",
                tokens_estimate=80,
                bucket="docs",
            ),
            FileRecord(
                path="apps/frontend/tests/auth.test.ts",
                content="test coverage",
                tokens_estimate=70,
                bucket="tests",
            ),
        ]
        ranked, _ = rank_files(
            files,
            keywords=["auth"],
            path_hints=["auth"],
            regex_patterns=[],
        )
        kept, removed = compress_ranked_files(ranked, target_tokens=150)

        self.assertLessEqual(sum(item.tokens_estimate for item in kept), 150)
        self.assertGreaterEqual(len(removed), 1)
        self.assertIn(removed[0].bucket, {"docs", "tests"})


if __name__ == "__main__":
    unittest.main()
