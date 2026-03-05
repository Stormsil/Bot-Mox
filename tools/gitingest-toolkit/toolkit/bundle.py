from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Pattern, Sequence, Tuple

from toolkit.gitingest_adapter import FileRecord, maybe_resolve_token, parse_content_sections, run_ingest
from toolkit.patterns import (
    build_scope_include_patterns,
    load_topic_profile,
    merge_patterns,
    summarize_bucket_tokens,
)


NOISE_BUCKETS = {"docs", "tests", "assets", "generated", "lockfiles", "vendor-cache"}


@dataclass
class RankedFile:
    path: str
    content: str
    bucket: str
    tokens_estimate: int
    score: float
    reasons: List[str]


@dataclass
class RemovedFile:
    path: str
    bucket: str
    tokens_estimate: int
    score: float
    reason: str


def _dedupe_lower(values: Sequence[str]) -> List[str]:
    seen = set()
    result: List[str] = []
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


def _compile_regexes(patterns: Sequence[str]) -> Tuple[List[Pattern[str]], List[str]]:
    compiled: List[Pattern[str]] = []
    invalid: List[str] = []
    for pattern in patterns:
        try:
            compiled.append(re.compile(pattern, re.IGNORECASE | re.MULTILINE))
        except re.error:
            invalid.append(pattern)
    return compiled, invalid


def score_file_relevance(
    file_record: FileRecord,
    *,
    keywords: Sequence[str],
    path_hints: Sequence[str],
    regexes: Sequence[Pattern[str]],
) -> Tuple[float, List[str]]:
    path_lower = file_record.path.lower()
    content_lower = file_record.content.lower()

    score = 0.0
    reasons: List[str] = []

    for hint in path_hints:
        hint_lower = hint.lower()
        if hint_lower and hint_lower in path_lower:
            score += 6.0
            reasons.append(f"path_hint:{hint}")

    for keyword in keywords:
        keyword_lower = keyword.lower()
        if not keyword_lower:
            continue

        path_hits = path_lower.count(keyword_lower)
        if path_hits:
            score += min(path_hits, 2) * 4.0
            reasons.append(f"path_keyword:{keyword}")

        content_hits = content_lower.count(keyword_lower)
        if content_hits:
            score += min(content_hits, 10) * 1.0
            reasons.append(f"content_keyword:{keyword}")

    for regex in regexes:
        if regex.search(file_record.path) or regex.search(file_record.content):
            score += 8.0
            reasons.append(f"regex:{regex.pattern}")

    if file_record.bucket in NOISE_BUCKETS:
        score -= 2.0
        reasons.append(f"bucket_penalty:{file_record.bucket}")

    return score, reasons


def rank_files(
    file_records: Sequence[FileRecord],
    *,
    keywords: Sequence[str],
    path_hints: Sequence[str],
    regex_patterns: Sequence[str],
) -> Tuple[List[RankedFile], List[str]]:
    regexes, invalid_regexes = _compile_regexes(regex_patterns)
    ranked: List[RankedFile] = []

    for file_record in file_records:
        score, reasons = score_file_relevance(
            file_record,
            keywords=keywords,
            path_hints=path_hints,
            regexes=regexes,
        )
        ranked.append(
            RankedFile(
                path=file_record.path,
                content=file_record.content,
                bucket=file_record.bucket,
                tokens_estimate=file_record.tokens_estimate,
                score=score,
                reasons=reasons,
            )
        )

    ranked.sort(key=lambda item: (-item.score, -item.tokens_estimate, item.path))
    return ranked, invalid_regexes


def compress_ranked_files(
    ranked_files: Sequence[RankedFile],
    *,
    target_tokens: Optional[int],
) -> Tuple[List[RankedFile], List[RemovedFile]]:
    kept = list(ranked_files)
    removed: List[RemovedFile] = []

    if not kept or target_tokens is None or target_tokens <= 0:
        return kept, removed

    total_tokens = sum(item.tokens_estimate for item in kept)
    if total_tokens <= target_tokens:
        return kept, removed

    ordered = sorted(
        kept,
        key=lambda item: (
            0 if item.bucket in NOISE_BUCKETS else 1,
            item.score,
            -item.tokens_estimate,
            item.path,
        ),
    )

    for candidate in ordered:
        if total_tokens <= target_tokens:
            break
        if len(kept) <= 1:
            break

        if candidate not in kept:
            continue

        kept.remove(candidate)
        total_tokens -= candidate.tokens_estimate
        removed.append(
            RemovedFile(
                path=candidate.path,
                bucket=candidate.bucket,
                tokens_estimate=candidate.tokens_estimate,
                score=candidate.score,
                reason=(
                    "noise-first-trim" if candidate.bucket in NOISE_BUCKETS else "low-relevance-trim"
                ),
            )
        )

    kept.sort(key=lambda item: (-item.score, -item.tokens_estimate, item.path))
    return kept, removed


def _bundle_recommendations(
    ranked_files: Sequence[RankedFile],
    *,
    scopes: Sequence[str],
    selected_tokens: int,
) -> List[Dict[str, object]]:
    recommendations: List[Dict[str, object]] = []

    noise_tokens = sum(item.tokens_estimate for item in ranked_files if item.bucket in NOISE_BUCKETS)
    if noise_tokens > 0:
        recommendations.append(
            {
                "type": "exclude_noise",
                "message": "Exclude docs/tests/assets/generated first.",
                "estimated_saved_tokens": noise_tokens,
                "estimated_result_tokens": max(selected_tokens - noise_tokens, 0),
            }
        )

    if ranked_files:
        sorted_by_score = sorted(ranked_files, key=lambda item: (item.score, -item.tokens_estimate, item.path))
        bottom_count = max(1, int(len(sorted_by_score) * 0.2))
        bottom_tokens = sum(item.tokens_estimate for item in sorted_by_score[:bottom_count])
        recommendations.append(
            {
                "type": "drop_bottom_20_percent",
                "message": "Trim lowest relevance 20% files.",
                "estimated_saved_tokens": bottom_tokens,
                "estimated_result_tokens": max(selected_tokens - bottom_tokens, 0),
            }
        )

    if scopes and len(scopes) > 1:
        recommendations.append(
            {
                "type": "narrow_scope",
                "message": "Narrow to one or two scopes if context is still too large.",
                "estimated_saved_tokens": None,
                "estimated_result_tokens": None,
            }
        )

    return recommendations[:3]


def _resolve_bundle_output(topic: str, out_root: Path, out_arg: Optional[str]) -> Path:
    if out_arg:
        output_path = Path(out_arg)
        if output_path.suffix.lower() == ".txt":
            return output_path
        return output_path / f"{topic}.txt"

    return out_root / "bundles" / f"{topic}.txt"


def _render_bundle_text(
    *,
    topic: str,
    source: str,
    scopes: Sequence[str],
    selected_files: Sequence[RankedFile],
    selected_tokens: int,
    query_keywords: Sequence[str],
    query_regex: Sequence[str],
) -> str:
    lines = [
        "# gitingest-toolkit bundle",
        f"# topic: {topic}",
        f"# source: {source}",
        f"# scopes: {', '.join(scopes) if scopes else '<all>'}",
        f"# selected_files: {len(selected_files)}",
        f"# selected_tokens_estimate: {selected_tokens}",
        f"# keywords: {', '.join(query_keywords) if query_keywords else '<none>'}",
        f"# regex: {', '.join(query_regex) if query_regex else '<none>'}",
        "",
        "## Included files",
    ]

    for item in selected_files:
        lines.append(
            f"- {item.path} | tokens~{item.tokens_estimate} | bucket={item.bucket} | score={item.score:.2f}"
        )

    lines.append("")

    for item in selected_files:
        lines.append("=" * 48)
        lines.append(f"FILE: {item.path}")
        lines.append("=" * 48)
        lines.append(item.content)
        lines.append("")

    return "\n".join(lines)


def build_bundle(
    *,
    source: str,
    topic: str,
    scopes: Sequence[str],
    user_keywords: Sequence[str],
    user_regex: Sequence[str],
    branch: Optional[str],
    target_tokens: Optional[int],
    base_excludes: Iterable[str],
    extra_excludes: Iterable[str],
    profiles_dir: Path,
    out_root: Path,
    out_arg: Optional[str],
    max_file_size: int,
) -> Dict[str, str]:
    profile = load_topic_profile(profiles_dir, topic=topic)

    keywords = _dedupe_lower([*profile.get("keywords", []), *list(user_keywords)])
    path_hints = _dedupe_lower([*profile.get("path_hints", []), *list(scopes)])
    regex_patterns = _dedupe_lower([*profile.get("regex", []), *list(user_regex)])

    include_patterns = build_scope_include_patterns(scopes)
    exclude_patterns = merge_patterns(base_excludes, profile.get("exclude_patterns", []), extra_excludes)

    run = run_ingest(
        source,
        include_patterns=include_patterns,
        exclude_patterns=exclude_patterns,
        branch=branch,
        max_file_size=max_file_size,
        token=maybe_resolve_token(),
    )

    file_records = parse_content_sections(run.content)
    ranked, invalid_regexes = rank_files(
        file_records,
        keywords=keywords,
        path_hints=path_hints,
        regex_patterns=regex_patterns,
    )

    # If there is query intent (keywords/regex/path hints), keep only relevant records.
    has_query_intent = bool(keywords or regex_patterns)
    if has_query_intent:
        ranked = [item for item in ranked if item.score > 0]

    if not ranked:
        ranked = sorted(
            [
                RankedFile(
                    path=item.path,
                    content=item.content,
                    bucket=item.bucket,
                    tokens_estimate=item.tokens_estimate,
                    score=0.0,
                    reasons=["fallback:empty-query-result"],
                )
                for item in file_records
            ],
            key=lambda item: (-item.tokens_estimate, item.path),
        )

    selected_files, removed_files = compress_ranked_files(ranked, target_tokens=target_tokens)

    selected_tokens = sum(item.tokens_estimate for item in selected_files)
    selected_bucket_tokens = summarize_bucket_tokens([asdict(item) for item in selected_files])

    bundle_path = _resolve_bundle_output(topic=topic, out_root=out_root, out_arg=out_arg)
    bundle_path.parent.mkdir(parents=True, exist_ok=True)

    bundle_text = _render_bundle_text(
        topic=topic,
        source=source,
        scopes=scopes,
        selected_files=selected_files,
        selected_tokens=selected_tokens,
        query_keywords=keywords,
        query_regex=regex_patterns,
    )
    bundle_path.write_text(bundle_text, encoding="utf-8")

    index_path = bundle_path.with_suffix(".index.json")
    index_payload = {
        "topic": topic,
        "source": source,
        "branch": branch,
        "scopes": list(scopes),
        "query": {
            "keywords": keywords,
            "path_hints": path_hints,
            "regex": regex_patterns,
            "invalid_regex": invalid_regexes,
        },
        "totals": {
            "ingested_tokens": run.estimated_tokens,
            "selected_tokens": selected_tokens,
            "files_analyzed": run.files_analyzed,
            "selected_files": len(selected_files),
            "removed_files": len(removed_files),
            "target_tokens": target_tokens,
        },
        "bucket_tokens": selected_bucket_tokens,
        "included": [
            {
                "path": item.path,
                "bucket": item.bucket,
                "tokens_estimate": item.tokens_estimate,
                "score": round(item.score, 3),
                "reasons": item.reasons,
            }
            for item in selected_files
        ],
        "removed": [asdict(item) for item in removed_files],
        "recommendations": _bundle_recommendations(
            ranked_files=selected_files,
            scopes=scopes,
            selected_tokens=selected_tokens,
        ),
    }
    index_path.write_text(json.dumps(index_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "bundle": str(bundle_path),
        "index": str(index_path),
        "selected_tokens": str(selected_tokens),
        "selected_files": str(len(selected_files)),
    }
