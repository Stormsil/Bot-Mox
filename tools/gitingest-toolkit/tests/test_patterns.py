from __future__ import annotations

import sys
from pathlib import Path
import unittest

TOOLKIT_ROOT = Path(__file__).resolve().parents[1]
if str(TOOLKIT_ROOT) not in sys.path:
    sys.path.insert(0, str(TOOLKIT_ROOT))

from toolkit.patterns import build_scope_include_patterns, classify_bucket


class PatternsTests(unittest.TestCase):
    def test_classify_bucket(self) -> None:
        self.assertEqual(classify_bucket("docs/guide.md"), "docs")
        self.assertEqual(classify_bucket("apps/frontend/tests/login.test.ts"), "tests")
        self.assertEqual(classify_bucket("node_modules/react/index.js"), "vendor-cache")
        self.assertEqual(classify_bucket("apps/backend/dist/index.js"), "generated")
        self.assertEqual(classify_bucket("apps/backend/src/auth.service.ts"), "code")

    def test_build_scope_include_patterns(self) -> None:
        patterns = build_scope_include_patterns(["apps/backend", "apps/frontend/src"])
        self.assertIn("apps/backend", patterns)
        self.assertIn("apps/backend/**", patterns)
        self.assertIn("apps/frontend/src", patterns)
        self.assertIn("apps/frontend/src/**", patterns)


if __name__ == "__main__":
    unittest.main()
