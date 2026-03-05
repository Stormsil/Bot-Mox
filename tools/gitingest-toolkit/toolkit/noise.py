from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from toolkit.gitingest_adapter import FileRecord, maybe_resolve_token, parse_content_sections, run_ingest
from toolkit.patterns import (
    bucket_to_default_patterns,
    build_scope_include_patterns,
    classify_bucket,
    merge_patterns,
    summarize_bucket_tokens,
)


@dataclass
class NoiseRow:
    bucket: str
    tokens: int
    share_percent: float
    estimated_saving: int


def _build_noise_rows(bucket_tokens: Dict[str, int], total_tokens: int) -> List[NoiseRow]:
    rows: List[NoiseRow] = []
    total = max(total_tokens, 1)
    for bucket, tokens in bucket_tokens.items():
        saving = 0 if bucket == "code" else tokens
        rows.append(
            NoiseRow(
                bucket=bucket,
                tokens=tokens,
                share_percent=(tokens / total) * 100.0,
                estimated_saving=saving,
            )
        )
    rows.sort(key=lambda item: (-item.tokens, item.bucket))
    return rows


def analyze_noise(
    *,
    source: str,
    scope: Optional[str],
    branch: Optional[str],
    base_excludes: Iterable[str],
    extra_excludes: Iterable[str],
    out_root: Path,
    max_file_size: int,
) -> Dict[str, object]:
    out_dir = out_root / "noise"
    out_dir.mkdir(parents=True, exist_ok=True)

    include_patterns = build_scope_include_patterns([scope] if scope else None)
    exclude_patterns = merge_patterns(base_excludes, extra_excludes)

    run = run_ingest(
        source,
        include_patterns=include_patterns,
        exclude_patterns=exclude_patterns,
        branch=branch,
        max_file_size=max_file_size,
        token=maybe_resolve_token(),
    )
    file_records = parse_content_sections(run.content)

    for record in file_records:
        if not record.bucket:
            record.bucket = classify_bucket(record.path)

    bucket_tokens = summarize_bucket_tokens([record.__dict__ for record in file_records])
    rows = _build_noise_rows(bucket_tokens, total_tokens=run.estimated_tokens)

    csv_path = out_dir / "noise_breakdown.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["bucket", "tokens", "share_percent", "estimated_saving"])
        for row in rows:
            writer.writerow([row.bucket, row.tokens, f"{row.share_percent:.4f}", row.estimated_saving])

    return {
        "csv": str(csv_path),
        "rows": rows,
        "file_records": file_records,
        "total_tokens": run.estimated_tokens,
        "files_analyzed": run.files_analyzed,
    }


def _extract_anchor(path_value: str, bucket: str) -> Optional[str]:
    parts = [part for part in path_value.split("/") if part]
    if len(parts) < 2:
        return None

    markers = {
        "docs",
        "doc",
        "tests",
        "test",
        "__tests__",
        "e2e",
        "generated",
        "_generated",
        "dist",
        "build",
        "assets",
        "images",
        "fixtures",
    }
    for index, part in enumerate(parts[:-1]):
        if part.lower() in markers:
            return "/".join(parts[: index + 1]) + "/**"

    if bucket in {"docs", "tests"} and len(parts) >= 2:
        return "/".join(parts[:-1]) + "/**"

    return None


def _dynamic_patterns_from_files(file_records: List[FileRecord], total_tokens: int) -> List[Tuple[str, int, str]]:
    aggregate: Dict[str, int] = {}
    for record in file_records:
        if record.bucket == "code":
            continue
        anchor = _extract_anchor(record.path, record.bucket)
        if not anchor:
            continue
        aggregate[anchor] = aggregate.get(anchor, 0) + record.tokens_estimate

    threshold = max(int(total_tokens * 0.01), 200)
    scored = [(pattern, saved) for pattern, saved in aggregate.items() if saved >= threshold]
    scored.sort(key=lambda item: (-item[1], item[0]))

    return [(pattern, saved, "directory hotspot") for pattern, saved in scored[:30]]


def generate_profile(
    *,
    source: str,
    scope: Optional[str],
    branch: Optional[str],
    base_excludes: Iterable[str],
    extra_excludes: Iterable[str],
    out_root: Path,
    max_file_size: int,
) -> Dict[str, str]:
    analysis = analyze_noise(
        source=source,
        scope=scope,
        branch=branch,
        base_excludes=base_excludes,
        extra_excludes=extra_excludes,
        out_root=out_root,
        max_file_size=max_file_size,
    )

    rows: List[NoiseRow] = analysis["rows"]  # type: ignore[assignment]
    file_records: List[FileRecord] = analysis["file_records"]  # type: ignore[assignment]
    total_tokens = int(analysis["total_tokens"])

    recommended: List[Tuple[str, int, str]] = []
    for row in rows:
        if row.bucket == "code" or row.tokens <= 0:
            continue
        for pattern in bucket_to_default_patterns(row.bucket):
            recommended.append((pattern, row.tokens, f"bucket:{row.bucket}"))

    recommended.extend(_dynamic_patterns_from_files(file_records, total_tokens=total_tokens))

    merged_patterns = merge_patterns(base_excludes, [item[0] for item in recommended], extra_excludes)

    profile_dir = out_root / "profiles"
    profile_dir.mkdir(parents=True, exist_ok=True)
    profile_path = profile_dir / "audit-ignore.generated.txt"

    lines = [
        "# Generated by gitingest-toolkit",
        "# Safe audit profile: excludes high-noise artifacts for LLM code audits.",
        f"# Source: {source}",
        f"# Scope: {scope or '<all>'}",
        f"# Total estimated tokens analyzed: {total_tokens}",
        "#",
        "# Top removable buckets:",
    ]

    for row in rows:
        if row.bucket == "code":
            continue
        lines.append(f"# - {row.bucket}: ~{row.tokens} tokens ({row.share_percent:.2f}%)")

    lines.append("#")
    lines.append("# Suggested patterns (ordered, deduplicated):")

    top_reco = sorted(recommended, key=lambda item: (-item[1], item[0]))[:20]
    for pattern, saved, reason in top_reco:
        lines.append(f"# {pattern}  (~{saved} tokens, {reason})")

    lines.append("")
    lines.extend(merged_patterns)
    lines.append("")

    profile_path.write_text("\n".join(lines), encoding="utf-8")

    return {
        "profile": str(profile_path),
        "noise_csv": str(analysis["csv"]),
        "total_tokens": str(total_tokens),
        "patterns": str(len(merged_patterns)),
    }
