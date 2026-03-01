# Task 6 Edge Behavior Notes - /vms Operation Console

Date: 2026-03-01

## Method

- Browser QA executed with Playwright fallback (`pnpm --filter @botmox/frontend exec node -`) because `skills/dev-browser` runtime is unavailable in this workspace.
- `/vms` was exercised with deterministic API stubs and seeded running tasks to validate operation-log flows without backend availability dependency.

## Checked flows

1. Open `/vms` and verify `Operation Console` visible.
2. Trigger toolbar `Copy` and verify clipboard readback contains task content.
3. Cancel running task with valid queue-link key and verify status transitions to `Cancelled`.
4. Cancel running task with malformed queue-link key (`key: "vm:   "`) and verify graceful behavior:
   - status still transitions to `Cancelled`
   - no runtime page errors
   - no console error exceptions
5. Trigger `Clear` with confirmation and verify empty-state render (`No tasks yet.`) and persisted empty snapshot.

## Observed results

- `pageLoaded`: true
- `copyActionWorks`: true
- `cancelRunningValidTask`: true
- `cancelMalformedKeyTaskGraceful`: true
- `clearConfirmed`: true
- `runtimeNoPageErrors`: true
- `runtimeNoConsoleErrors`: true
- `putCallCount`: 3 (valid cancel snapshot, malformed cancel snapshot, clear snapshot)

## Artifact

- Screenshot: `.sisyphus/evidence/task-6-regression-gate-edge.png`

## Conclusion

Targeted operation-log behavior parity for copy/clear/cancel and malformed key cancel path is preserved after store ownership cutover.
