# VM Realtime & Scalability Audit

Last updated (UTC): **2026-02-14T23:50:21Z**

## Objective

- Prevent API/rate-limit collapse right after pairing/connect.
- Ensure VM operations and UI state updates are event-driven (not blind polling loops).
- Keep architecture workable for high concurrency (many users, many VM tasks).

## Implemented

- `apps/frontend/src/services/vmOpsService.ts`
  - Added shared terminal wait map by `commandId` (`inFlightCommandWaits`) to stop repeated `GET /commands/:id` storms for the same deduped command.
- `apps/backend-legacy/src/modules/v1/vm-ops.routes.js`
  - Added `GET /api/v1/vm-ops/commands/next` (agent-only long-poll) for near-realtime command delivery.
- `apps/backend-legacy/src/modules/vm-ops/service.js`
  - Added `waitForNextAgentCommand(...)` using event-bus subscription + timeout fallback.
  - Added stale queue hygiene in long-poll path: expired queued commands are auto-marked as `failed` to prevent endless re-delivery loops.
- `apps/backend-legacy/src/bootstrap/http-middleware.js`
  - Exempted `GET /v1/vm-ops/commands/next` from user API rate-limit bucket.
- `agent/src/core/agent-loop.ts`
  - Replaced periodic queue polling with long-poll command loop (`/commands/next`) + separate heartbeat interval.
  - Expired commands are now explicitly reported as `failed` (not silently skipped), keeping queue state clean.
- `agent/src/executors/proxmox.ts`
  - Added agent-side wait actions to reduce command-bus chatter:
    - `proxmox.wait-task`
    - `proxmox.wait-vm-status`
    - `proxmox.wait-vm-presence`
- `apps/frontend/src/services/vmService.ts`
  - Added wrappers: `waitForTask`, `waitForVmStatus`, `waitForVmPresence`.
  - Updated internal start-and-send-key flow to use agent-side waits.
- `apps/frontend/src/hooks/vm/queue/processor.ts`
  - Replaced repeated task-status/list-vms polling loops with single wait commands where applicable.
- `apps/frontend/src/hooks/useProxmox.ts`
  - Avoids false disconnect flips on transient non-connectivity errors.
- `apps/frontend/src/components/vm/VMList.tsx`
  - Removed delayed timer refresh after start/stop.
- `agent/src/executors/ssh.ts` + `agent/src/executors/proxmox.ts`
  - Added real SSH transport via `ssh2` (password/key) for VM-side operations.
  - Added `proxmox.ssh-status` and backward-compatible alias `proxmox.ssh-test`.
  - Added SSH-only command handling through agent:
    - `proxmox.ssh-read-config`
    - `proxmox.ssh-write-config`
    - `proxmox.ssh-exec` (allowlisted by default)
  - Added explicit SSH error codes for gating and UX (`SSH_REQUIRED`, `SSH_AUTH_FAILED`, `SSH_UNREACHABLE`, `SSH_COMMAND_FORBIDDEN`).
- `agent/src/executors/index.ts`
  - `proxmox.list-targets` now returns per-computer `sshConfigured` to support UI-level gating/status.
- `apps/frontend/src/services/vmService.ts`
  - Replaced pseudo-SSH check with real command-bus check via `proxmox.ssh-status`.
  - Added typed SSH status model (`connected/configured/code/message/...`) for safe feature gating.
  - Added pre-dispatch SSH gate for SSH-only operations (`readVMConfig`, `writeVMConfig`, `executeSSH`):
    - auto-checks SSH status,
    - blocks operation locally when SSH is missing/unreachable,
    - returns explicit API-style errors (`SSH_REQUIRED`, `SSH_UNREACHABLE`, etc.).
- `apps/frontend/src/services/vmOpsService.ts`
  - Improved command failure mapping: tagged agent errors (`CODE: message`) now surface as structured `ApiClientError` with `code`.
- `apps/frontend/src/hooks/useProxmox.ts` + `apps/frontend/src/pages/vms/VMsPage.tsx`
  - Added continuous SSH capability state (`sshConfigured`, `sshConnected`, `sshStatusCode`) and visible UI lock indicators:
    - if SSH not configured/unreachable, SSH-only features are explicitly marked as disabled.
- `apps/frontend/src/components/vm/VMSettingsForm.tsx`
  - Removed legacy sections from VM Generator Settings modal:
    - Proxmox Connection,
    - SSH Connection,
    - Service URLs,
    - Test Connections status row.
  - Left only generator-relevant settings (template/storage/resources) for cleaner workflow.
- `apps/frontend/src/services/vmOpsService.ts` + `apps/backend-legacy/src/modules/vm-ops/service.js`
  - Added read-only dedupe support for `proxmox.ssh-status` and `proxmox.list-targets` to cut duplicate command traffic.
- `apps/frontend/src/hooks/vm/useVMQueue.ts` + `apps/frontend/src/hooks/useVMKeyboardShortcuts.ts`
  - Added queue processing mutex and keyboard auto-repeat guard to prevent accidental double-start of VM queue (duplicate clone dispatch on same VMID).
- `apps/frontend/src/hooks/vm/queue/processor.ts`
  - Added fallback task finalization in top-level processor error path so task entries do not remain stuck in `running` after unexpected abort.
- `apps/frontend/src/hooks/useVMLog.ts` + `apps/frontend/src/components/vm/VMOperationLog.tsx` + `apps/frontend/src/pages/vms/VMsPage.tsx`
  - Added manual cancellation for `running` tasks from Task Viewer (`Cancel Task` action).
  - Added automatic timeout sweep for stale `running` tasks (10 minutes) with auto-finalization to `error` and timeout reason in task details.
  - Cancel action now also triggers queue cancellation signal to stop active VM processing loop.

## Current Findings

- Backend `409 AGENT_OFFLINE` still appears when no heartbeat is currently fresh for the selected agent.
- This is not Firebase-related and not an API schema error; it is command dispatch protection in `vm-ops` service.
- Existing old/stale clients may still generate noisy request patterns until restarted/reloaded.

## Validation Performed

- Frontend build: `npm --prefix botmox run build` ✅
- Agent typecheck: `npm --prefix agent run typecheck` ✅
- Backend syntax checks (`node --check`) ✅
- Agent dependency update (`ssh2`, `@types/ssh2`) and lockfile refresh ✅

## Pending / Next Validation

- Restart desktop agent from updated source/build and confirm:
  - `last_seen_at` updates continuously.
  - `409 AGENT_OFFLINE` disappears under normal operation.
  - no burst of repeated `GET /api/v1/vm-ops/commands/:id` for same command id.
- Run an end-to-end stress batch (e.g., 20 VM clone jobs) and record command volume baseline.
