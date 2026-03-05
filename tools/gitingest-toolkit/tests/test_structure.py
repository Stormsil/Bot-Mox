from __future__ import annotations

import sys
from pathlib import Path
import unittest

TOOLKIT_ROOT = Path(__file__).resolve().parents[1]
if str(TOOLKIT_ROOT) not in sys.path:
    sys.path.insert(0, str(TOOLKIT_ROOT))

from toolkit.gitingest_adapter import FileRecord
from toolkit.structure import _build_folder_summaries, _infer_file_summary


class StructureLogicTests(unittest.TestCase):
    def test_infer_file_summary_prefers_heading(self) -> None:
        record = FileRecord(
            path="docs/auth.md",
            content="# Authentication\n\nDetails",
            tokens_estimate=20,
            bucket="docs",
        )
        summary = _infer_file_summary(record)
        self.assertIn("Authentication", summary)

    def test_build_folder_summaries_aggregates_tokens(self) -> None:
        from toolkit.structure import FileSummary

        files = [
            FileSummary(
                path="apps/backend/src/auth.ts",
                folder="apps/backend/src",
                extension=".ts",
                bucket="code",
                tokens_estimate=100,
                summary="export function verifyToken",
            ),
            FileSummary(
                path="apps/backend/src/session.ts",
                folder="apps/backend/src",
                extension=".ts",
                bucket="code",
                tokens_estimate=50,
                summary="export function refreshSession",
            ),
        ]

        folders = _build_folder_summaries(files)
        self.assertEqual(len(folders), 1)
        self.assertEqual(folders[0].tokens, 150)
        self.assertEqual(folders[0].file_count, 2)


if __name__ == "__main__":
    unittest.main()
