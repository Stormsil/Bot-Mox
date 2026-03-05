from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

from toolkit.gitingest_adapter import FileRecord, maybe_resolve_token, parse_content_sections, run_ingest
from toolkit.patterns import build_scope_include_patterns, merge_patterns

_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "file",
    "module",
    "index",
    "page",
    "component",
    "service",
    "utils",
    "helper",
    "test",
    "spec",
    "auth",
}


@dataclass
class FolderSummary:
    path: str
    depth: int
    file_count: int
    tokens: int
    top_extensions: List[str]
    top_terms: List[str]
    summary: str


@dataclass
class FileSummary:
    path: str
    folder: str
    extension: str
    bucket: str
    tokens_estimate: int
    summary: str


def _safe_folder(path_value: str) -> str:
    parts = path_value.split("/")
    if len(parts) <= 1:
        return "."
    return "/".join(parts[:-1])


def _infer_file_summary(record: FileRecord) -> str:
    lines = [line.strip() for line in record.content.splitlines() if line.strip()]
    if not lines:
        return "Empty or binary-like content after ingest filtering."

    extension = Path(record.path).suffix.lower()
    if extension == ".md":
        for line in lines[:20]:
            if line.startswith("#"):
                return line.lstrip("# ").strip()[:180]

    code_markers = (
        "class ",
        "function ",
        "def ",
        "export ",
        "interface ",
        "type ",
        "const ",
        "async ",
        "router.",
        "app.",
    )
    for line in lines[:40]:
        lower = line.lower()
        if any(marker in lower for marker in code_markers):
            return line[:180]

    return lines[0][:180]


def _extract_terms(path_value: str, summary: str) -> List[str]:
    raw = f"{path_value} {summary}".lower()
    terms = re.findall(r"[a-z][a-z0-9_\-]{2,}", raw)
    cleaned: List[str] = []
    for term in terms:
        normalized = term.strip("_-")
        if not normalized or normalized in _STOPWORDS:
            continue
        if normalized.isdigit():
            continue
        cleaned.append(normalized)
    return cleaned


def _build_folder_summaries(file_summaries: Sequence[FileSummary]) -> List[FolderSummary]:
    grouped: Dict[str, List[FileSummary]] = defaultdict(list)
    for file_summary in file_summaries:
        grouped[file_summary.folder].append(file_summary)

    result: List[FolderSummary] = []
    for folder, files in grouped.items():
        tokens = sum(item.tokens_estimate for item in files)
        ext_counter = Counter(item.extension or "<noext>" for item in files)
        term_counter = Counter()
        for item in files:
            for term in _extract_terms(item.path, item.summary):
                term_counter[term] += 1

        top_ext = [f"{ext}:{count}" for ext, count in ext_counter.most_common(4)]
        top_terms = [term for term, _ in term_counter.most_common(6)]
        summary = (
            f"{len(files)} files, ~{tokens} tokens; "
            f"types: {', '.join(top_ext) if top_ext else 'n/a'}; "
            f"themes: {', '.join(top_terms[:4]) if top_terms else 'n/a'}"
        )

        depth = 0 if folder == "." else folder.count("/") + 1
        result.append(
            FolderSummary(
                path=folder,
                depth=depth,
                file_count=len(files),
                tokens=tokens,
                top_extensions=top_ext,
                top_terms=top_terms,
                summary=summary,
            )
        )

    result.sort(key=lambda item: (-item.tokens, item.path))
    return result


def _render_structure_markdown(
    *,
    source: str,
    scopes: Sequence[str],
    run_summary: str,
    run_tree: str,
    folder_summaries: Sequence[FolderSummary],
    file_summaries: Sequence[FileSummary],
) -> str:
    generated_at = datetime.now(timezone.utc).isoformat()
    lines = [
        "# Repository Structure Index",
        "",
        f"- Source: `{source}`",
        f"- Scope: `{', '.join(scopes) if scopes else '<all>'}`",
        f"- Generated (UTC): `{generated_at}`",
        "",
        "## gitingest summary",
        "```text",
        run_summary.strip(),
        "```",
        "",
        "## gitingest tree",
        "```text",
        run_tree.strip(),
        "```",
        "",
        "## Top folders by tokens",
    ]

    for item in folder_summaries[:60]:
        lines.append(
            f"- `{item.path}` - {item.tokens} tokens, {item.file_count} files, {item.summary}"
        )

    lines.append("")
    lines.append("## Top files by tokens")
    for item in sorted(file_summaries, key=lambda row: (-row.tokens_estimate, row.path))[:120]:
        lines.append(
            f"- `{item.path}` - {item.tokens_estimate} tokens, bucket={item.bucket}; {item.summary}"
        )

    lines.append("")
    return "\n".join(lines)


def build_structure_index(
    *,
    source: str,
    scopes: Sequence[str],
    branch: Optional[str],
    base_excludes: Iterable[str],
    extra_excludes: Iterable[str],
    out_root: Path,
    max_file_size: int,
) -> Dict[str, str]:
    out_dir = out_root / "structure"
    out_dir.mkdir(parents=True, exist_ok=True)

    include_patterns = build_scope_include_patterns(scopes)
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
    file_summaries: List[FileSummary] = []
    for record in file_records:
        extension = Path(record.path).suffix.lower()
        folder = _safe_folder(record.path)
        file_summaries.append(
            FileSummary(
                path=record.path,
                folder=folder,
                extension=extension,
                bucket=record.bucket,
                tokens_estimate=record.tokens_estimate,
                summary=_infer_file_summary(record),
            )
        )

    folder_summaries = _build_folder_summaries(file_summaries)

    files_json_path = out_dir / "files_index.json"
    files_json_path.write_text(
        json.dumps([asdict(item) for item in file_summaries], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    folders_json_path = out_dir / "folders_index.json"
    folders_json_path.write_text(
        json.dumps([asdict(item) for item in folder_summaries], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    files_csv_path = out_dir / "files_index.csv"
    with files_csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["path", "folder", "extension", "bucket", "tokens_estimate", "summary"])
        for item in sorted(file_summaries, key=lambda row: (-row.tokens_estimate, row.path)):
            writer.writerow(
                [
                    item.path,
                    item.folder,
                    item.extension,
                    item.bucket,
                    item.tokens_estimate,
                    item.summary,
                ]
            )

    structure_md_path = out_dir / "repo_structure.md"
    structure_md_path.write_text(
        _render_structure_markdown(
            source=source,
            scopes=scopes,
            run_summary=run.summary,
            run_tree=run.tree,
            folder_summaries=folder_summaries,
            file_summaries=file_summaries,
        ),
        encoding="utf-8",
    )

    summary_txt_path = out_dir / "summary.txt"
    summary_txt_path.write_text(run.summary, encoding="utf-8")

    tree_txt_path = out_dir / "tree.txt"
    tree_txt_path.write_text(run.tree, encoding="utf-8")

    return {
        "repo_structure": str(structure_md_path),
        "files_index_json": str(files_json_path),
        "folders_index_json": str(folders_json_path),
        "files_index_csv": str(files_csv_path),
        "summary_txt": str(summary_txt_path),
        "tree_txt": str(tree_txt_path),
        "files_analyzed": str(run.files_analyzed),
        "estimated_tokens": str(run.estimated_tokens),
    }
