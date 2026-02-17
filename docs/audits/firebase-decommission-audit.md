# Firebase Decommission Audit

Auto-generated file. Do not edit manually.

Last updated (UTC): **2026-02-17T00:32:25.875Z**

## Scope

- Goal: keep Firebase/RTDB fully decommissioned from active runtime/tooling paths.
- Runtime target: Supabase-only backend + Supabase-only operational workflow.
- Historical references are allowed only in `docs/history/*` and planning archives.

## Snapshot

- Runtime refs (proxy-server/src + bot-mox/src + agent/src): **0**
- Legacy files still present: **0**
- Package manifests with firebase deps: **0**
- Firebase root config files present: **0**
- Active docs risk refs: **0**
- Open blockers: **0**
- Completed blockers: **5**

## Blockers

| ID | Status | Area | Item | Next action |
| --- | --- | --- | --- | --- |
| RUNTIME-01 | DONE | runtime code | active code still references Firebase/RTDB | remove remaining code/comment/log references in runtime packages |
| TOOLING-01 | DONE | legacy files | legacy Firebase/RTDB files still exist in active paths | delete or archive remaining legacy files |
| DEP-01 | DONE | dependencies | package manifests still include firebase deps | remove firebase/firebase-admin dependencies from package manifests |
| CONFIG-01 | DONE | config | Firebase project config/rules files still exist in repo root | remove obsolete firebase config/rules files after migration completion |
| DOC-01 | DONE | documentation | active docs still reference removed legacy paths or RTDB fallback mode | keep legacy references only in docs/history and update active docs |

## Evidence: Runtime Refs

- none

## Evidence: Legacy Files Still Present

- none

## Evidence: Packages With Firebase Deps

- none

## Evidence: Firebase Root Config Files

- none

## Evidence: Active Docs Risk Refs

- none

## Update Procedure

Run after every architecture or dependency change:

```bash
npm run audit:firebase:decommission
```

