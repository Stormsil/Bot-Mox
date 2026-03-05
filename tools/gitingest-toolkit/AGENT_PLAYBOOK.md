# AGENT_PLAYBOOK

This playbook is for AI agents that need to prepare focused LLM audit context from a large repository.

## Goal

Produce high-signal context with minimal noise:

1. map token hotspots,
2. inspect structure with folder/file summaries,
3. discover topic-relevant files,
4. identify non-code noise,
5. generate an audit ignore profile,
6. export topic-focused bundles (for example: auth).

## Execution order

1. Health check:

```bash
python -m toolkit.cli doctor
```

2. Global hotspot scan:

```bash
python -m toolkit.cli heatmap --source "<repo_path_or_url>" --depth 3
```

3. Build structure index (important for file selection decisions):

```bash
python -m toolkit.cli structure --source "<repo_path_or_url>" --scope "apps"
```

4. Discover auth-related files (before full bundle):

```bash
python -m toolkit.cli discover \
  --source "<repo_path_or_url>" \
  --topic auth \
  --scope "apps/backend" \
  --scope "apps/frontend" \
  --scope "apps/admin" \
  --scope "apps/agent" \
  --top 200
```

5. Scope noise scan (example frontend):

```bash
python -m toolkit.cli noise --source "<repo_path_or_url>" --scope "apps/frontend"
```

6. Generate reusable audit profile:

```bash
python -m toolkit.cli profile --source "<repo_path_or_url>" --scope "apps/frontend"
```

7. Optional raw passthrough (if user wants plain gitingest artifacts):

```bash
python -m toolkit.cli ingest \
  --source "<repo_path_or_url>" \
  --include "apps/backend/**" \
  --include "apps/frontend/**" \
  --prefix "auth-snapshot" \
  --use-base-excludes
```

8. Build topic bundle (cross-stack):

```bash
python -m toolkit.cli bundle \
  --source "<repo_path_or_url>" \
  --topic auth \
  --scope "apps/backend" \
  --scope "apps/frontend" \
  --scope "apps/admin" \
  --scope "apps/agent"
```

## Output contracts

- `out/heatmap/heatmap_dirs.csv`
- `out/heatmap/heatmap_tree.md`
- `out/structure/repo_structure.md`
- `out/structure/files_index.json`
- `out/structure/folders_index.json`
- `out/discover/<topic>.files.json`
- `out/discover/<topic>.files.md`
- `out/noise/noise_breakdown.csv`
- `out/profiles/audit-ignore.generated.txt`
- `out/ingest/<prefix>.summary.txt`
- `out/ingest/<prefix>.tree.txt`
- `out/ingest/<prefix>.content.txt`
- `out/bundles/<topic>.txt`
- `out/bundles/<topic>.index.json`

## Budget strategy

- If a bundle is too large, rerun with `--target-tokens <N>`.
- Compression is iterative: noise buckets first, then lowest-relevance files.
- If no target is set, check `*.index.json` recommendations to reduce size.

## Safety

- Toolkit does not edit `.gitignore`.
- Toolkit writes artifacts only under `tools/gitingest-toolkit/out/**` unless explicit output path is provided.
