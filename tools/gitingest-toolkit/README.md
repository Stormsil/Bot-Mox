# gitingest-toolkit

Portable, autonomous toolkit for AI-oriented repository audits using [`gitingest`](https://pypi.org/project/gitingest/).

- No dependency on this repository's `scripts/*`.
- No dependency on root `package.json`.
- Does **not** modify `.gitignore`.
- Works with local folders and GitHub URLs.

## Layout

- `toolkit/cli.py` - unified CLI (`python -m toolkit.cli ...`)
- `toolkit/ingest_passthrough.py` - direct `gitingest`-style exports
- `toolkit/heatmap.py` - token heatmap by directories
- `toolkit/noise.py` - noise analysis + audit-ignore generation
- `toolkit/structure.py` - full structure index with folder/file summaries
- `toolkit/discover.py` - topic file discovery before bundle creation
- `toolkit/bundle.py` - topic bundle extraction (single TXT + JSON index)
- `profiles/base_excludes.txt` - reusable baseline excludes
- `profiles/topic_auth.json` - prebuilt auth profile

## Requirements

- Python 3.8+
- `gitingest==0.3.1`
- `eval_type_backport==0.3.1` (required on Python 3.8/3.9 for `gitingest` import compatibility)

Install:

```bash
cd tools/gitingest-toolkit
python -m pip install -r requirements.txt
```

## Commands

Run from repository root (recommended):

```bash
python -m toolkit.cli doctor
```

Or run from `tools/gitingest-toolkit`:

```bash
python -m toolkit.cli doctor
```

### 1) Heatmap

```bash
python -m toolkit.cli heatmap --source "E:/repo" --depth 3
```

Outputs:

- `out/heatmap/heatmap_dirs.csv` (`path,depth,tokens,share_percent,file_count`)
- `out/heatmap/heatmap_tree.md`

### 2) Noise breakdown

```bash
python -m toolkit.cli noise --source "E:/repo" --scope "apps/frontend"
```

Output:

- `out/noise/noise_breakdown.csv` (`bucket,tokens,share_percent,estimated_saving`)

### 3) Audit profile generation

```bash
python -m toolkit.cli profile --source "E:/repo" --scope "apps/frontend"
```

Outputs:

- `out/profiles/audit-ignore.generated.txt`
- `out/noise/noise_breakdown.csv`

### 4) Topic bundle (single TXT + index)

```bash
python -m toolkit.cli bundle \
  --source "E:/repo" \
  --topic auth \
  --scope "apps/backend" \
  --scope "apps/frontend" \
  --scope "apps/admin" \
  --scope "apps/agent" \
  --keyword "oauth" \
  --regex "Authorization\\s*:\\s*Bearer"
```

Optional budget compression:

```bash
python -m toolkit.cli bundle \
  --source "E:/repo" \
  --topic auth \
  --scope "apps/backend" \
  --scope "apps/frontend" \
  --target-tokens 300000
```

Outputs:

- `out/bundles/auth.txt`
- `out/bundles/auth.index.json`

### 5) Structure map (folders + files + summaries)

```bash
python -m toolkit.cli structure \
  --source "E:/repo" \
  --scope "apps"
```

Outputs:

- `out/structure/repo_structure.md`
- `out/structure/files_index.json`
- `out/structure/folders_index.json`
- `out/structure/files_index.csv`
- `out/structure/summary.txt`
- `out/structure/tree.txt`

### 6) Discover files for a domain (for example auth)

```bash
python -m toolkit.cli discover \
  --source "E:/repo" \
  --topic auth \
  --scope "apps/backend" \
  --scope "apps/frontend" \
  --scope "apps/admin" \
  --scope "apps/agent" \
  --top 200
```

Outputs:

- `out/discover/auth.files.json`
- `out/discover/auth.files.md`

### 7) Raw gitingest-like export (passthrough)

```bash
python -m toolkit.cli ingest \
  --source "E:/repo" \
  --include "apps/frontend/**" \
  --include "apps/backend/**" \
  --prefix "frontend-backend" \
  --use-base-excludes
```

Outputs:

- `out/ingest/frontend-backend.summary.txt`
- `out/ingest/frontend-backend.tree.txt`
- `out/ingest/frontend-backend.content.txt`
- `out/ingest/frontend-backend.combined.txt`

## Remote GitHub source

```bash
python -m toolkit.cli heatmap \
  --source "https://github.com/owner/repo" \
  --branch "feature/audit"
```

For private repos set `GITHUB_TOKEN`.

## Custom excludes

Pass an extra ignore file in gitingest glob format:

```bash
python -m toolkit.cli bundle \
  --source "E:/repo" \
  --topic auth \
  --scope "apps/backend" \
  --exclude-file "C:/tmp/my-extra-excludes.txt"
```

## Notes

- Toolkit uses fast token estimation for per-file/per-bucket operations.
- Directory heatmap uses repeated `gitingest` runs (baseline + include-pattern per directory).
- `structure` gives the global map an agent needs to quickly identify relevant files.
- `discover` is the fast pre-step before `bundle` when user asks: "find all files for auth/billing/etc".
- To reuse in another repo, copy the whole `tools/gitingest-toolkit` folder.
