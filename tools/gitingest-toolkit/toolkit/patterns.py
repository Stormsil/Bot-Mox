from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Dict, Iterable, List, Optional

DEFAULT_BASE_EXCLUDES = [
    "**/.git/**",
    "**/node_modules/**",
    "**/.pnpm-store/**",
    "**/.cache/**",
    "**/.turbo/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/test-results/**",
    "**/playwright-report/**",
    "**/.next/**",
    "**/.nuxt/**",
    "**/.venv/**",
    "**/venv/**",
    "**/__pycache__/**",
    "**/.mypy_cache/**",
    "**/.pytest_cache/**",
    "**/*.min.js",
    "**/*.min.css",
    "**/*.map",
    "**/*.png",
    "**/*.jpg",
    "**/*.jpeg",
    "**/*.gif",
    "**/*.webp",
    "**/*.ico",
    "**/*.pdf",
    "**/*.zip",
    "**/*.tar",
    "**/*.gz",
    "**/*.7z",
    "**/*.mp4",
    "**/*.mp3",
    "**/*.woff",
    "**/*.woff2",
    "**/*.ttf",
    "**/*.eot",
]

TEXT_CODE_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".kt",
    ".go",
    ".rs",
    ".cs",
    ".cpp",
    ".c",
    ".h",
    ".hpp",
    ".swift",
    ".php",
    ".rb",
    ".scala",
    ".sql",
    ".sh",
    ".ps1",
    ".yml",
    ".yaml",
    ".json",
    ".toml",
    ".ini",
    ".env",
    ".prisma",
    ".xml",
    ".html",
    ".css",
    ".scss",
    ".sass",
    ".less",
}

ASSET_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".pdf",
    ".mp4",
    ".mov",
    ".avi",
    ".mp3",
    ".wav",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
}


def to_posix(path_value: str) -> str:
    return path_value.replace("\\", "/").strip("/")


def estimate_tokens_fast(text: str) -> int:
    if not text:
        return 0
    return int(math.ceil(len(text) / 4.0))


def load_patterns_from_file(path: Optional[str]) -> List[str]:
    if not path:
        return []

    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Pattern file not found: {file_path}")

    patterns: List[str] = []
    for line in file_path.read_text(encoding="utf-8").splitlines():
        value = line.strip()
        if not value or value.startswith("#"):
            continue
        patterns.append(value)
    return patterns


def merge_patterns(*pattern_sets: Iterable[str]) -> List[str]:
    merged: List[str] = []
    seen = set()
    for pattern_set in pattern_sets:
        for raw_pattern in pattern_set:
            pattern = raw_pattern.strip()
            if not pattern or pattern in seen:
                continue
            seen.add(pattern)
            merged.append(pattern)
    return merged


def build_scope_include_patterns(scopes: Optional[Iterable[str]]) -> List[str]:
    if not scopes:
        return []

    includes: List[str] = []
    for scope in scopes:
        normalized = to_posix(scope)
        if not normalized:
            continue
        includes.append(normalized)
        if not normalized.endswith("/**"):
            includes.append(f"{normalized}/**")
    return merge_patterns(includes)


def classify_bucket(path_value: str) -> str:
    normalized = to_posix(path_value).lower()
    parts = normalized.split("/") if normalized else []
    suffix = Path(normalized).suffix.lower()

    if any(part in {"node_modules", "vendor", ".cache", ".pnpm-store", ".turbo"} for part in parts):
        return "vendor-cache"

    if any(part in {"dist", "build", "out", "target", "_generated", "generated"} for part in parts):
        return "generated"

    if normalized.endswith("pnpm-lock.yaml") or normalized.endswith("package-lock.json") or normalized.endswith("yarn.lock"):
        return "lockfiles"

    if any(part in {"docs", "doc", "documentation"} for part in parts) or suffix == ".md":
        return "docs"

    if any(part in {"test", "tests", "__tests__", "e2e", "spec"} for part in parts):
        return "tests"

    if suffix in ASSET_EXTENSIONS:
        return "assets"

    if suffix in TEXT_CODE_EXTENSIONS or suffix:
        return "code"

    return "code"


def load_topic_profile(profiles_dir: Path, topic: str) -> Dict[str, List[str]]:
    profile_path = profiles_dir / f"topic_{topic.strip().lower()}.json"
    if not profile_path.exists():
        return {
            "keywords": [],
            "path_hints": [],
            "regex": [],
            "exclude_patterns": [],
        }

    parsed = json.loads(profile_path.read_text(encoding="utf-8"))
    return {
        "keywords": [str(item).strip() for item in parsed.get("keywords", []) if str(item).strip()],
        "path_hints": [str(item).strip() for item in parsed.get("path_hints", []) if str(item).strip()],
        "regex": [str(item).strip() for item in parsed.get("regex", []) if str(item).strip()],
        "exclude_patterns": [
            str(item).strip() for item in parsed.get("exclude_patterns", []) if str(item).strip()
        ],
    }


def summarize_bucket_tokens(file_records: Iterable[dict]) -> Dict[str, int]:
    summary: Dict[str, int] = {}
    for record in file_records:
        bucket = str(record.get("bucket", "code"))
        tokens = int(record.get("tokens_estimate", 0))
        summary[bucket] = summary.get(bucket, 0) + tokens
    return summary


def bucket_to_default_patterns(bucket: str) -> List[str]:
    bucket = bucket.strip().lower()
    if bucket == "tests":
        return ["**/test/**", "**/tests/**", "**/__tests__/**", "**/e2e/**", "**/*.test.*", "**/*.spec.*"]
    if bucket == "docs":
        return ["docs/**", "**/docs/**", "**/*.md"]
    if bucket == "assets":
        return [
            "**/*.png",
            "**/*.jpg",
            "**/*.jpeg",
            "**/*.gif",
            "**/*.webp",
            "**/*.svg",
            "**/*.pdf",
            "**/*.mp4",
            "**/*.mp3",
        ]
    if bucket == "generated":
        return ["**/_generated/**", "**/generated/**", "**/dist/**", "**/build/**", "**/*.gen.*", "**/*.generated.*"]
    if bucket == "lockfiles":
        return ["pnpm-lock.yaml", "**/package-lock.json", "**/yarn.lock"]
    if bucket == "vendor-cache":
        return ["**/node_modules/**", "**/vendor/**", "**/.cache/**", "**/.pnpm-store/**", "**/.turbo/**"]
    return []
