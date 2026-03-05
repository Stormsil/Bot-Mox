from __future__ import annotations

from pathlib import Path
from typing import Dict, Iterable, Optional, Sequence

from toolkit.gitingest_adapter import maybe_resolve_token, run_ingest
from toolkit.patterns import merge_patterns


def run_ingest_passthrough(
    *,
    source: str,
    include_patterns: Sequence[str],
    exclude_patterns: Iterable[str],
    branch: Optional[str],
    out_root: Path,
    out_prefix: str,
    max_file_size: int,
) -> Dict[str, str]:
    out_dir = out_root / "ingest"
    out_dir.mkdir(parents=True, exist_ok=True)

    run = run_ingest(
        source,
        include_patterns=include_patterns,
        exclude_patterns=merge_patterns(exclude_patterns),
        branch=branch,
        max_file_size=max_file_size,
        token=maybe_resolve_token(),
    )

    summary_path = out_dir / f"{out_prefix}.summary.txt"
    tree_path = out_dir / f"{out_prefix}.tree.txt"
    content_path = out_dir / f"{out_prefix}.content.txt"
    combined_path = out_dir / f"{out_prefix}.combined.txt"

    summary_path.write_text(run.summary, encoding="utf-8")
    tree_path.write_text(run.tree, encoding="utf-8")
    content_path.write_text(run.content, encoding="utf-8")

    combined_path.write_text(
        "\n\n".join(
            [
                "# gitingest summary",
                run.summary,
                "# gitingest tree",
                run.tree,
                "# gitingest content",
                run.content,
            ]
        ),
        encoding="utf-8",
    )

    return {
        "summary": str(summary_path),
        "tree": str(tree_path),
        "content": str(content_path),
        "combined": str(combined_path),
        "files_analyzed": str(run.files_analyzed),
        "estimated_tokens": str(run.estimated_tokens),
    }
