"""Root launcher package for gitingest-toolkit CLI.

This package extends its import path so that internal modules from
``tools/gitingest-toolkit/toolkit`` are available as ``toolkit.*``.
"""

from __future__ import annotations

from pathlib import Path

_PACKAGE_DIR = Path(__file__).resolve().parent
_INTERNAL_TOOLKIT_DIR = _PACKAGE_DIR.parent / "tools" / "gitingest-toolkit" / "toolkit"

if _INTERNAL_TOOLKIT_DIR.exists():
    __path__.append(str(_INTERNAL_TOOLKIT_DIR))  # type: ignore[name-defined]
