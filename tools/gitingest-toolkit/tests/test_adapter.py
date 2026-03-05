from __future__ import annotations

import sys
from pathlib import Path
import unittest

TOOLKIT_ROOT = Path(__file__).resolve().parents[1]
if str(TOOLKIT_ROOT) not in sys.path:
    sys.path.insert(0, str(TOOLKIT_ROOT))

from toolkit.gitingest_adapter import parse_content_sections, parse_summary


class AdapterParsingTests(unittest.TestCase):
    def test_parse_summary_extracts_tokens_and_files(self) -> None:
        summary = """Directory: /tmp/example\nFiles analyzed: 42\n\nEstimated tokens: 12,345\n"""
        parsed = parse_summary(summary)
        self.assertEqual(parsed["files_analyzed"], 42)
        self.assertEqual(parsed["estimated_tokens"], 12345)

    def test_parse_content_sections_extracts_multiple_files(self) -> None:
        content = (
            "================================================\n"
            "FILE: apps/backend/src/auth.ts\n"
            "================================================\n"
            "export const x = 1;\n\n"
            "================================================\n"
            "FILE: apps/frontend/src/login.tsx\n"
            "================================================\n"
            "export const y = 2;\n"
        )
        sections = parse_content_sections(content)
        self.assertEqual(len(sections), 2)
        self.assertEqual(sections[0].path, "apps/backend/src/auth.ts")
        self.assertIn("export const x", sections[0].content)
        self.assertGreater(sections[0].tokens_estimate, 0)


if __name__ == "__main__":
    unittest.main()
