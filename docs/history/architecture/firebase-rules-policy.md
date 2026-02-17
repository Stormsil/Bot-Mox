# Firebase Security Rules Policy (Legacy Reference)

## Scope
- Realtime Database rules file: `database.rules.json`
- Firestore rules file: `firestore.rules`
- Deployment config: `firebase.json`

## Current enforced baseline
- Firestore is fully closed:
  - `allow read, write: if false;`
- Realtime Database is role-gated:
  - read: authenticated users only (`auth != null`)
  - write: admin claim required (`auth.token.admin === true`)

## Environment policy
1. `development`:
- Keep current rules for local integration and internal QA.
- Use emulator where possible for destructive tests.

2. `staging`:
- Same as development baseline, but with production-like auth claims.
- No broadening of write access without explicit ADR.

3. `production`:
- Firestore remains closed unless an approved migration requires specific paths.
- RTDB write access remains admin-claim-only.
- Any exceptions must be path-scoped and documented in `docs/architecture/` with rollback notes.

## Operational checks
- Validate rules before deploy:
  - `firebase emulators:start --only database,firestore`
  - `firebase deploy --only database,firestore --project <project-id>`
- Keep backend mutation routes token-protected and role-gated (`/api/v1/*`).
- Do not expose service-account credentials in repo-tracked files.

## Change control
- Any rules change must include:
  - threat note (what attack surface changes),
  - impacted paths,
  - test cases (allowed + denied),
  - rollback command/commit reference.
