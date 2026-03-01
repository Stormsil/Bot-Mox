# Task 4 QA Evidence - action-only useVMLog API on /vms

Date: 2026-03-01

## Scope

- Verification-only smoke on VM page flows after Task 4 action-only `useVMLog` API wiring.
- Focus checks:
  1. `/vms` page loads and renders.
  2. No runtime crash on open.
  3. Operation Console `Copy` action works.
  4. Operation Console `Clear` action works.
  5. `Cancel Task` path remains callable (or degrades gracefully if no running task).

## Environment and method

- Frontend dev server already reachable at `http://127.0.0.1:5173` (`STATUS 200` on `/vms`).
- Browser automation executed with Playwright script via `pnpm --filter @botmox/frontend exec node -`.
- API layer mocked in-script to provide deterministic auth/session and seeded `task_logs` with one running task.
  - Note: `skills/dev-browser` runtime path was unavailable in this workspace, so Playwright was used for hands-on UI interaction fallback.

## Verification results

- [x] `/vms` page loads and renders
  - Observed `Operation Console` visible.
  - Seeded task row `Provision VM 101` rendered.

- [x] No console crash on open
  - `pageerror`: none.
  - Non-warning `console.error`: none.
  - One compatibility warning observed: `antd v5 support React is 16 ~ 18` (non-blocking; known warning signature).

- [x] `Copy` action works
  - Opened `Task Viewer`, clicked modal `Copy`.
  - Clipboard readback contained task content (`Provision VM 101` / `Task started`).

- [x] `Clear` action works
  - Opened Operation Console clear confirmation (`Clear operation history?`).
  - Confirmed clear.
  - Observed persisted empty payload to `PUT /api/v1/settings/vmgenerator/task_logs`.

- [x] `Cancel Task` callable or graceful
  - Running task was present, `Cancel Task` button rendered.
  - Confirmation path executed.
  - Task status changed to `Cancelled` in `Task Viewer`.

## Captured artifacts

- Screenshot: `.sisyphus/evidence/task-4-action-only-api-ui-smoke.png`

## Verification command summary

1. Reachability check:
   - `node -e "fetch('http://127.0.0.1:5173/vms')..."`
   - Result: `STATUS 200`

2. Main UI smoke (final pass run):
   - `pnpm --filter @botmox/frontend exec node - <<'EOF' ... EOF`
   - Final result payload:
     - `pageLoadRendered: true`
     - `noConsoleCrashOnOpen: true`
     - `copyActionWorks: true`
     - `clearActionWorks: true`
     - `cancelActionCallableOrGraceful: true`
     - `taskLogsPutCount: 2` (cancel update + clear empty snapshot)

## Conclusion

Task 4 action-only `useVMLog` API wiring passes VM page UI smoke for the requested user-facing flows.
