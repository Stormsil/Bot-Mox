from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Dict, Iterable, Optional, Sequence

from toolkit.bundle import rank_files
from toolkit.gitingest_adapter import maybe_resolve_token, parse_content_sections, run_ingest
from toolkit.patterns import build_scope_include_patterns, load_topic_profile, merge_patterns


def _dedupe(values: Sequence[str]) -> list[str]:
    seen = set()
    result: list[str] = []
    for value in values:
        normalized = value.strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result


def discover_files(
    *,
    source: str,
    topic: str,
    scopes: Sequence[str],
    user_keywords: Sequence[str],
    user_regex: Sequence[str],
    branch: Optional[str],
    top: int,
    base_excludes: Iterable[str],
    extra_excludes: Iterable[str],
    profiles_dir: Path,
    out_root: Path,
    max_file_size: int,
) -> Dict[str, str]:
    out_dir = out_root / "discover"
    out_dir.mkdir(parents=True, exist_ok=True)

    topic_profile = load_topic_profile(profiles_dir, topic=topic)
    keywords = _dedupe([*topic_profile.get("keywords", []), *list(user_keywords)])
    regex_patterns = _dedupe([*topic_profile.get("regex", []), *list(user_regex)])
    path_hints = _dedupe([*topic_profile.get("path_hints", []), *list(scopes)])

    include_patterns = build_scope_include_patterns(scopes)
    exclude_patterns = merge_patterns(base_excludes, topic_profile.get("exclude_patterns", []), extra_excludes)

    run = run_ingest(
        source,
        include_patterns=include_patterns,
        exclude_patterns=exclude_patterns,
        branch=branch,
        max_file_size=max_file_size,
        token=maybe_resolve_token(),
    )

    file_records = parse_content_sections(run.content)
    ranked, invalid_regex = rank_files(
        file_records,
        keywords=keywords,
        path_hints=path_hints,
        regex_patterns=regex_patterns,
    )

    relevant = [item for item in ranked if item.score > 0]
    if not relevant:
        relevant = ranked

    selected = relevant[: max(1, top)]

    payload = {
        "topic": topic,
        "source": source,
        "branch": branch,
        "scopes": list(scopes),
        "query": {
            "keywords": keywords,
            "regex": regex_patterns,
            "path_hints": path_hints,
            "invalid_regex": invalid_regex,
        },
        "totals": {
            "files_analyzed": run.files_analyzed,
            "ingested_tokens": run.estimated_tokens,
            "relevant_files": len(relevant),
            "selected_files": len(selected),
        },
        "files": [
            {
                "path": item.path,
                "score": round(item.score, 3),
                "tokens_estimate": item.tokens_estimate,
                "bucket": item.bucket,
                "reasons": item.reasons,
            }
            for item in selected
        ],
    }

    json_path = out_dir / f"{topic}.files.json"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    md_path = out_dir / f"{topic}.files.md"
    lines = [
        f"# File discovery: {topic}",
        "",
        f"- Source: `{source}`",
        f"- Scope: `{', '.join(scopes) if scopes else '<all>'}`",
        f"- Files analyzed: `{run.files_analyzed}`",
        f"- Relevant files: `{len(relevant)}`",
        f"- Selected files: `{len(selected)}`",
        "",
        "## Ranked files",
    ]
    for item in selected:
        lines.append(
            f"- `{item.path}` | score={item.score:.2f} | tokens~{item.tokens_estimate} | bucket={item.bucket}"
        )
        if item.reasons:
            lines.append(f"  reasons: {', '.join(item.reasons[:6])}")

    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    return {
        "discover_json": str(json_path),
        "discover_md": str(md_path),
        "selected_files": str(len(selected)),
        "relevant_files": str(len(relevant)),
    }
