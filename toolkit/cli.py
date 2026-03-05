from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import List, Optional


def _load_internal_cli_module():
    repo_root = Path(__file__).resolve().parents[1]
    package_root = repo_root / "tools" / "gitingest-toolkit"
    cli_path = package_root / "toolkit" / "cli.py"

    if not cli_path.exists():
        raise ModuleNotFoundError(
            f"Internal toolkit CLI not found at: {cli_path}. "
            "Expected tools/gitingest-toolkit to be present."
        )

    # Make internal package importable (toolkit.* modules inside tools/gitingest-toolkit).
    package_root_str = str(package_root)
    if package_root_str not in sys.path:
        sys.path.insert(0, package_root_str)

    spec = importlib.util.spec_from_file_location("_gitingest_toolkit_cli", str(cli_path))
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to load module spec from {cli_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main(argv: Optional[List[str]] = None) -> int:
    module = _load_internal_cli_module()
    return int(module.main(argv))


if __name__ == "__main__":
    raise SystemExit(main())

