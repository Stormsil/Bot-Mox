from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional

from toolkit.patterns import classify_bucket, estimate_tokens_fast, to_posix


@dataclass
class IngestRunResult:
    source: str
    summary: str
    tree: str
    content: str
    files_analyzed: int
    estimated_tokens: int


@dataclass
class FileRecord:
    path: str
    content: str
    tokens_estimate: int
    bucket: str


def _import_gitingest_ingest():
    # Keep logs quiet in CLI output and tests.
    os.environ["LOG_LEVEL"] = os.getenv("GITINGEST_TOOLKIT_LOG_LEVEL", "ERROR")
    from gitingest import ingest

    return ingest


def _extract_int(value: str) -> int:
    digits = re.sub(r"[^0-9]", "", value)
    return int(digits) if digits else 0


def parse_summary(summary: str) -> dict:
    files_analyzed = 0
    estimated_tokens = 0

    files_match = re.search(r"Files analyzed:\s*([^\n\r]+)", summary, flags=re.IGNORECASE)
    if files_match:
        files_analyzed = _extract_int(files_match.group(1))

    tokens_match = re.search(r"Estimated tokens:\s*([^\n\r]+)", summary, flags=re.IGNORECASE)
    if tokens_match:
        estimated_tokens = _extract_int(tokens_match.group(1))

    return {
        "files_analyzed": files_analyzed,
        "estimated_tokens": estimated_tokens,
    }


_HEADER_RE = re.compile(r"=+\nFILE:\s*(.*?)\n=+\n", re.MULTILINE)


def parse_content_sections(content: str) -> List[FileRecord]:
    sections: List[FileRecord] = []
    matches = list(_HEADER_RE.finditer(content))

    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(content)
        body = content[start:end].strip("\n")
        path = to_posix(match.group(1).strip())
        sections.append(
            FileRecord(
                path=path,
                content=body,
                tokens_estimate=estimate_tokens_fast(body),
                bucket=classify_bucket(path),
            )
        )

    return sections


def run_ingest(
    source: str,
    *,
    include_patterns: Optional[Iterable[str]] = None,
    exclude_patterns: Optional[Iterable[str]] = None,
    branch: Optional[str] = None,
    max_file_size: int = 10 * 1024 * 1024,
    token: Optional[str] = None,
) -> IngestRunResult:
    ingest = _import_gitingest_ingest()

    include_arg = set(include_patterns or []) or None
    exclude_arg = set(exclude_patterns or []) or None

    summary, tree, content = ingest(
        source,
        include_patterns=include_arg,
        exclude_patterns=exclude_arg,
        branch=branch,
        include_gitignored=True,
        token=token,
        max_file_size=max_file_size,
    )

    parsed = parse_summary(summary)
    parsed_files = parse_content_sections(content)

    files_analyzed = parsed["files_analyzed"]
    if files_analyzed == 0:
        files_analyzed = len(parsed_files)

    estimated_tokens = parsed["estimated_tokens"]
    if estimated_tokens == 0:
        estimated_tokens = sum(item.tokens_estimate for item in parsed_files)

    return IngestRunResult(
        source=source,
        summary=summary,
        tree=tree,
        content=content,
        files_analyzed=files_analyzed,
        estimated_tokens=estimated_tokens,
    )


def ensure_local_source_exists(source: str) -> None:
    if source.startswith("http://") or source.startswith("https://"):
        return

    path = Path(source)
    if not path.exists():
        raise FileNotFoundError(f"Local source path does not exist: {source}")


def maybe_resolve_token(explicit_token: Optional[str] = None) -> Optional[str]:
    if explicit_token:
        return explicit_token
    token = os.getenv("GITHUB_TOKEN", "").strip()
    return token or None
