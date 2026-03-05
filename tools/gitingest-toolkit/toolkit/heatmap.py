from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from toolkit.gitingest_adapter import FileRecord, maybe_resolve_token, parse_content_sections, run_ingest
from toolkit.patterns import build_scope_include_patterns, merge_patterns


@dataclass
class HeatmapRow:
    path: str
    depth: int
    tokens: int
    share_percent: float
    file_count: int


def _collect_directories(file_records: Iterable[FileRecord], depth: int) -> List[str]:
    directories = set()
    for record in file_records:
        parts = [part for part in record.path.split("/") if part]
        # Only directories, not the file name.
        for current_depth in range(1, min(depth, max(len(parts) - 1, 0)) + 1):
            directories.add("/".join(parts[:current_depth]))
    return sorted(directories)


def _row_to_csv(row: HeatmapRow) -> List[str]:
    return [
        row.path,
        str(row.depth),
        str(row.tokens),
        f"{row.share_percent:.4f}",
        str(row.file_count),
    ]


def _build_tree_markdown(rows: List[HeatmapRow], total_tokens: int, source: str, depth: int) -> str:
    generated_at = datetime.now(timezone.utc).isoformat()
    lines = [
        "# Repository Token Heatmap",
        "",
        f"- Source: `{source}`",
        f"- Generated (UTC): `{generated_at}`",
        f"- Max depth: `{depth}`",
        f"- Total estimated tokens: `{total_tokens}`",
        "",
        "## Tree",
    ]

    for row in sorted(rows, key=lambda item: (item.depth, item.path)):
        indent = "  " * max(row.depth - 1, 0)
        label = "<root>" if row.path == "." else row.path
        lines.append(
            f"{indent}- `{label}` - {row.tokens} tokens ({row.share_percent:.2f}%), {row.file_count} files"
        )

    lines.append("")
    return "\n".join(lines)


def generate_heatmap(
    *,
    source: str,
    depth: int,
    branch: Optional[str],
    base_excludes: Iterable[str],
    extra_excludes: Iterable[str],
    out_root: Path,
    max_file_size: int,
) -> Dict[str, str]:
    out_dir = out_root / "heatmap"
    out_dir.mkdir(parents=True, exist_ok=True)

    exclude_patterns = merge_patterns(base_excludes, extra_excludes)
    token = maybe_resolve_token()

    baseline = run_ingest(
        source,
        exclude_patterns=exclude_patterns,
        branch=branch,
        max_file_size=max_file_size,
        token=token,
    )
    baseline_files = parse_content_sections(baseline.content)
    baseline_tokens = max(baseline.estimated_tokens, 1)

    rows: List[HeatmapRow] = [
        HeatmapRow(path=".", depth=0, tokens=baseline.estimated_tokens, share_percent=100.0, file_count=baseline.files_analyzed)
    ]

    directory_paths = _collect_directories(baseline_files, depth=depth)
    for directory_path in directory_paths:
        include_patterns = build_scope_include_patterns([directory_path])
        run = run_ingest(
            source,
            include_patterns=include_patterns,
            exclude_patterns=exclude_patterns,
            branch=branch,
            max_file_size=max_file_size,
            token=token,
        )

        row_depth = directory_path.count("/") + 1 if directory_path else 0
        share = (run.estimated_tokens / baseline_tokens) * 100.0
        rows.append(
            HeatmapRow(
                path=directory_path,
                depth=row_depth,
                tokens=run.estimated_tokens,
                share_percent=share,
                file_count=run.files_analyzed,
            )
        )

    csv_path = out_dir / "heatmap_dirs.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["path", "depth", "tokens", "share_percent", "file_count"])
        for row in sorted(rows, key=lambda item: (-item.tokens, item.path)):
            writer.writerow(_row_to_csv(row))

    tree_path = out_dir / "heatmap_tree.md"
    tree_path.write_text(
        _build_tree_markdown(rows, total_tokens=baseline.estimated_tokens, source=source, depth=depth),
        encoding="utf-8",
    )

    return {
        "csv": str(csv_path),
        "tree": str(tree_path),
        "directories_analyzed": str(len(directory_paths)),
        "total_tokens": str(baseline.estimated_tokens),
    }
