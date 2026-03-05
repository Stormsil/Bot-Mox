from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import tempfile
import urllib.request
from pathlib import Path
from typing import List

from toolkit.bundle import build_bundle
from toolkit.gitingest_adapter import ensure_local_source_exists
from toolkit.discover import discover_files
from toolkit.heatmap import generate_heatmap
from toolkit.ingest_passthrough import run_ingest_passthrough
from toolkit.noise import analyze_noise, generate_profile
from toolkit.patterns import DEFAULT_BASE_EXCLUDES, load_patterns_from_file, merge_patterns
from toolkit.structure import build_structure_index

TOOLKIT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT_ROOT = TOOLKIT_ROOT / "out"
DEFAULT_PROFILES_DIR = TOOLKIT_ROOT / "profiles"
os.environ.setdefault("LOG_LEVEL", os.getenv("GITINGEST_TOOLKIT_LOG_LEVEL", "ERROR"))


def _parse_common_excludes(args: argparse.Namespace) -> List[str]:
    extra = []
    if getattr(args, "exclude_file", None):
        extra = load_patterns_from_file(args.exclude_file)
    return extra


def _load_base_excludes() -> List[str]:
    profile_file = DEFAULT_PROFILES_DIR / "base_excludes.txt"
    if profile_file.exists():
        return merge_patterns(DEFAULT_BASE_EXCLUDES, load_patterns_from_file(str(profile_file)))
    return list(DEFAULT_BASE_EXCLUDES)


def _print_json(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def cmd_heatmap(args: argparse.Namespace) -> int:
    ensure_local_source_exists(args.source)
    extra_excludes = _parse_common_excludes(args)
    base_excludes = _load_base_excludes()
    result = generate_heatmap(
        source=args.source,
        depth=args.depth,
        branch=args.branch,
        base_excludes=base_excludes,
        extra_excludes=extra_excludes,
        out_root=Path(args.out),
        max_file_size=args.max_file_size,
    )
    _print_json(result)
    return 0


def cmd_noise(args: argparse.Namespace) -> int:
    ensure_local_source_exists(args.source)
    extra_excludes = _parse_common_excludes(args)
    base_excludes = _load_base_excludes()
    result = analyze_noise(
        source=args.source,
        scope=args.scope,
        branch=args.branch,
        base_excludes=base_excludes,
        extra_excludes=extra_excludes,
        out_root=Path(args.out),
        max_file_size=args.max_file_size,
    )
    _print_json(
        {
            "csv": result["csv"],
            "total_tokens": result["total_tokens"],
            "files_analyzed": result["files_analyzed"],
        }
    )
    return 0


def cmd_profile(args: argparse.Namespace) -> int:
    ensure_local_source_exists(args.source)
    extra_excludes = _parse_common_excludes(args)
    base_excludes = _load_base_excludes()
    result = generate_profile(
        source=args.source,
        scope=args.scope,
        branch=args.branch,
        base_excludes=base_excludes,
        extra_excludes=extra_excludes,
        out_root=Path(args.out),
        max_file_size=args.max_file_size,
    )
    _print_json(result)
    return 0


def cmd_bundle(args: argparse.Namespace) -> int:
    ensure_local_source_exists(args.source)
    extra_excludes = _parse_common_excludes(args)
    base_excludes = _load_base_excludes()
    result = build_bundle(
        source=args.source,
        topic=args.topic,
        scopes=args.scope,
        user_keywords=args.keyword,
        user_regex=args.regex,
        branch=args.branch,
        target_tokens=args.target_tokens,
        base_excludes=base_excludes,
        extra_excludes=extra_excludes,
        profiles_dir=DEFAULT_PROFILES_DIR,
        out_root=Path(args.out_root),
        out_arg=args.out,
        max_file_size=args.max_file_size,
    )
    _print_json(result)
    return 0


def cmd_structure(args: argparse.Namespace) -> int:
    ensure_local_source_exists(args.source)
    extra_excludes = _parse_common_excludes(args)
    base_excludes = _load_base_excludes()
    result = build_structure_index(
        source=args.source,
        scopes=args.scope,
        branch=args.branch,
        base_excludes=base_excludes,
        extra_excludes=extra_excludes,
        out_root=Path(args.out),
        max_file_size=args.max_file_size,
    )
    _print_json(result)
    return 0


def cmd_discover(args: argparse.Namespace) -> int:
    ensure_local_source_exists(args.source)
    extra_excludes = _parse_common_excludes(args)
    base_excludes = _load_base_excludes()
    result = discover_files(
        source=args.source,
        topic=args.topic,
        scopes=args.scope,
        user_keywords=args.keyword,
        user_regex=args.regex,
        branch=args.branch,
        top=args.top,
        base_excludes=base_excludes,
        extra_excludes=extra_excludes,
        profiles_dir=DEFAULT_PROFILES_DIR,
        out_root=Path(args.out),
        max_file_size=args.max_file_size,
    )
    _print_json(result)
    return 0


def cmd_ingest(args: argparse.Namespace) -> int:
    ensure_local_source_exists(args.source)
    extra_excludes = _parse_common_excludes(args)
    base_excludes = _load_base_excludes() if args.use_base_excludes else []
    merged_excludes = merge_patterns(base_excludes, args.exclude, extra_excludes)
    result = run_ingest_passthrough(
        source=args.source,
        include_patterns=args.include,
        exclude_patterns=merged_excludes,
        branch=args.branch,
        out_root=Path(args.out),
        out_prefix=args.prefix,
        max_file_size=args.max_file_size,
    )
    _print_json(result)
    return 0


def _doctor_network_check() -> dict:
    url = "https://github.com"
    try:
        with urllib.request.urlopen(url, timeout=5) as response:  # nosec B310
            return {"ok": True, "status": response.status, "url": url}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "url": url}


def _doctor_gitingest_smoke() -> dict:
    temp_dir = Path(tempfile.mkdtemp(prefix="gitingest-toolkit-doctor-"))
    try:
        sample = temp_dir / "sample.txt"
        sample.write_text("doctor check\n", encoding="utf-8")

        from toolkit.gitingest_adapter import run_ingest

        run = run_ingest(str(temp_dir), include_patterns=["sample.txt"], exclude_patterns=[])
        return {
            "ok": True,
            "files_analyzed": run.files_analyzed,
            "estimated_tokens": run.estimated_tokens,
        }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
    finally:
        for child in temp_dir.rglob("*"):
            if child.is_file():
                child.unlink(missing_ok=True)
        for child in sorted(temp_dir.rglob("*"), reverse=True):
            if child.is_dir():
                child.rmdir()
        temp_dir.rmdir()


def cmd_doctor(_: argparse.Namespace) -> int:
    checks = {
        "python": {
            "ok": sys.version_info >= (3, 8),
            "version": platform.python_version(),
            "required": ">=3.8",
        },
        "gitingest_import": {"ok": False},
        "eval_type_backport": {"ok": False},
        "network_github": {"ok": False},
        "gitingest_smoke": {"ok": False},
    }

    try:
        import gitingest  # type: ignore

        checks["gitingest_import"] = {
            "ok": True,
            "version": getattr(gitingest, "__version__", "unknown"),
        }
    except Exception as exc:  # noqa: BLE001
        checks["gitingest_import"] = {"ok": False, "error": str(exc)}

    try:
        import eval_type_backport  # type: ignore  # noqa: F401

        checks["eval_type_backport"] = {"ok": True}
    except Exception as exc:  # noqa: BLE001
        checks["eval_type_backport"] = {
            "ok": False,
            "error": str(exc),
            "hint": "Install eval_type_backport when using Python 3.8/3.9 with gitingest 0.3.x",
        }

    checks["network_github"] = _doctor_network_check()

    if checks["gitingest_import"]["ok"]:
        checks["gitingest_smoke"] = _doctor_gitingest_smoke()

    all_ok = all(check.get("ok", False) for check in checks.values())
    payload = {
        "ok": all_ok,
        "toolkit_root": str(TOOLKIT_ROOT),
        "checks": checks,
        "notes": [
            "Toolkit is autonomous and does not mutate .gitignore.",
            "Use GITHUB_TOKEN for private remote repositories.",
        ],
    }
    _print_json(payload)
    return 0 if all_ok else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m toolkit.cli",
        description="Portable gitingest-based audit toolkit",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    heatmap = subparsers.add_parser("heatmap", help="Build directory token heatmap")
    heatmap.add_argument("--source", required=True)
    heatmap.add_argument("--branch")
    heatmap.add_argument("--depth", type=int, default=3)
    heatmap.add_argument("--exclude-file")
    heatmap.add_argument("--max-file-size", type=int, default=10 * 1024 * 1024)
    heatmap.add_argument("--out", default=str(DEFAULT_OUT_ROOT))
    heatmap.set_defaults(func=cmd_heatmap)

    noise = subparsers.add_parser("noise", help="Analyze token noise by bucket")
    noise.add_argument("--source", required=True)
    noise.add_argument("--scope", required=True)
    noise.add_argument("--branch")
    noise.add_argument("--exclude-file")
    noise.add_argument("--max-file-size", type=int, default=10 * 1024 * 1024)
    noise.add_argument("--out", default=str(DEFAULT_OUT_ROOT))
    noise.set_defaults(func=cmd_noise)

    profile = subparsers.add_parser("profile", help="Generate audit-ignore profile")
    profile.add_argument("--source", required=True)
    profile.add_argument("--scope")
    profile.add_argument("--branch")
    profile.add_argument("--exclude-file")
    profile.add_argument("--max-file-size", type=int, default=10 * 1024 * 1024)
    profile.add_argument("--out", default=str(DEFAULT_OUT_ROOT))
    profile.set_defaults(func=cmd_profile)

    bundle = subparsers.add_parser("bundle", help="Build topic bundle for LLM audit")
    bundle.add_argument("--source", required=True)
    bundle.add_argument("--topic", required=True)
    bundle.add_argument("--scope", action="append", required=True)
    bundle.add_argument("--keyword", action="append", default=[])
    bundle.add_argument("--regex", action="append", default=[])
    bundle.add_argument("--branch")
    bundle.add_argument("--target-tokens", type=int)
    bundle.add_argument("--exclude-file")
    bundle.add_argument("--max-file-size", type=int, default=10 * 1024 * 1024)
    bundle.add_argument("--out", help="Output txt file path, or output directory")
    bundle.add_argument("--out-root", default=str(DEFAULT_OUT_ROOT))
    bundle.set_defaults(func=cmd_bundle)

    structure = subparsers.add_parser(
        "structure",
        help="Build repository structure map with file/folder summaries",
    )
    structure.add_argument("--source", required=True)
    structure.add_argument("--scope", action="append", default=[])
    structure.add_argument("--branch")
    structure.add_argument("--exclude-file")
    structure.add_argument("--max-file-size", type=int, default=10 * 1024 * 1024)
    structure.add_argument("--out", default=str(DEFAULT_OUT_ROOT))
    structure.set_defaults(func=cmd_structure)

    discover = subparsers.add_parser(
        "discover",
        help="Discover ranked files for a topic (without full bundle export)",
    )
    discover.add_argument("--source", required=True)
    discover.add_argument("--topic", required=True)
    discover.add_argument("--scope", action="append", default=[])
    discover.add_argument("--keyword", action="append", default=[])
    discover.add_argument("--regex", action="append", default=[])
    discover.add_argument("--top", type=int, default=120)
    discover.add_argument("--branch")
    discover.add_argument("--exclude-file")
    discover.add_argument("--max-file-size", type=int, default=10 * 1024 * 1024)
    discover.add_argument("--out", default=str(DEFAULT_OUT_ROOT))
    discover.set_defaults(func=cmd_discover)

    ingest = subparsers.add_parser(
        "ingest",
        help="Direct gitingest passthrough export (summary/tree/content)",
    )
    ingest.add_argument("--source", required=True)
    ingest.add_argument("--include", action="append", default=[])
    ingest.add_argument("--exclude", action="append", default=[])
    ingest.add_argument("--exclude-file")
    ingest.add_argument("--branch")
    ingest.add_argument("--prefix", default="snapshot")
    ingest.add_argument("--use-base-excludes", action="store_true")
    ingest.add_argument("--max-file-size", type=int, default=10 * 1024 * 1024)
    ingest.add_argument("--out", default=str(DEFAULT_OUT_ROOT))
    ingest.set_defaults(func=cmd_ingest)

    doctor = subparsers.add_parser("doctor", help="Check runtime prerequisites")
    doctor.set_defaults(func=cmd_doctor)

    return parser


def main(argv: List[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
