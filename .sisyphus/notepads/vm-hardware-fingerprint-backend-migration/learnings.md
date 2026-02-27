## 2026-02-26T23:08:30Z Task: initialization
- VM backend route conventions use zod safeParse plus `{ success: true, data }` envelope.
- Frontend runtime generator usages are concentrated in `VMConfigPreview.tsx` and `patcher.ts`/queue call chain.
- Queue flow is sequential and cancellation-sensitive; fetch injection point should be pre-patch in `configureVmItem`.

## 2026-02-26T23:15:18Z Task: backend hardware generator module/service
- Migrated MAC, SSD serial, SMBIOS generator logic plus platform/RAM datasets into `apps/backend/src/modules/vm/hardware-generator/*` with pure helper split.
- Added injectable `VmHardwareService.generateFingerprint()` returning `{ mac, ssdSerial, smbiosArgs, meta }` where `meta` currently carries `brand`, `product`, and `cpu` for preview/queue compatibility.
- Kept SMBIOS args composition compatible with existing frontend format (type 0/1/2/3/4/11 + dual type 17 entries + trailing VNC placeholder).
- Backend VM targeted tests pass with the new service test included.

## 2026-02-27 Task: contract checkbox 1
- Added VM-prefixed contract schemas for hardware fingerprint query/meta/response in `packages/api-contract/src/schemasAgentsVmOpsArtifacts.ts`.
- Registered `GET /api/v1/vm/hardware-fingerprint` in `packages/api-contract/src/contractRoutesVmRegistry.ts` with `successEnvelopeSchema(vmHardwareFingerprintResponseSchema)`.
- Kept payload limited to `mac`, `ssdSerial`, `smbiosArgs`, and `meta` to avoid exposing internal SMBIOS datasets.

## 2026-02-27 Task: checkbox 3 endpoint + DI wiring
- Added `GET /vm/hardware-fingerprint` in `apps/backend/src/modules/vm/vm.controller.ts` with existing VM auth guard behavior (`Authorization` header required), contract-backed query parsing, and `{ success: true, data }` envelope.
- Wired endpoint generation through existing DI by injecting `VmHardwareService` into `VmController`; `VmModule` provider registration already covered this dependency.
- Added controller tests for success envelope and strict query validation in `apps/backend/src/modules/vm/vm.controller.test.ts`.
- Aligned contract meta key naming from `manufacturer` to `brand` in `packages/api-contract/src/schemasAgentsVmOpsArtifacts.ts` to match backend hardware service output.
- Verified with `pnpm --filter @botmox/backend test -- src/modules/vm/**/*.test.ts` and `pnpm --filter @botmox/backend build`.

## 2026-02-27 Task: checkbox 4 frontend vm api client + query primitives
- Added provider client `apps/frontend/src/providers/vm-hardware-fingerprint-client.ts` using contract runtime client `client.vmHardwareFingerprint(...)` with explicit non-200 contract error mapping.
- Introduced normalized typed payload `{ mac, ssdSerial, smbiosArgs, meta }` and exposed both envelope and direct data helpers for future preview/queue integration.
- Extended VM query keys with `fingerprint()` namespace and `hardwareFingerprint()` key, then added `useVmHardwareFingerprintMutation()` for button-triggered mutation flow.
- Routed access through VM facade/runtime layers via `vmHardwareFingerprintFacade.ts` and `vmRuntimeFacade.ts` to preserve entity->provider boundaries.

## 2026-02-27T00:00:00Z Task: queue integration contract + retry/cancel policy
- Added explicit pre-patch hardware fingerprint fetch boundary in `configureVmItem` so network fetch happens before `patchConfig` and before any mutable Proxmox patch apply.
- Retry policy is now deterministic and bounded to 3 attempts with fixed backoff intervals (`800ms`, `1600ms`) and explicit per-attempt logs.
- Cancellation checks are now explicit before/after each fingerprint fetch await and before/after retry backoff await; cancellation exits fail-fast for the current queue item.
- Added `hardwareFingerprint.ts` helper with strict payload-shape validation (`mac`, `ssdSerial`, `smbiosArgs`, `meta`) to keep queue contract handling centralized and minimal.

## 2026-02-27 Task: checkbox 6 vm preview migration
- Replaced `VMConfigPreview` local fingerprint generators with button-triggered `useVmHardwareFingerprintMutation()` so preview values now come from backend payload (`mac`, `ssdSerial`, `smbiosArgs`, `meta`).
- Kept preview UX flow intact (manual Generate button + Copy Args), and added mutation pending/error handling without introducing auto-fetch behavior.
- Updated frontend payload meta normalization to prioritize `meta.brand` and gracefully derive `brand` from `meta.manufacturer` when only manufacturer is present.

## 2026-02-27T00:20:00Z Task: checkbox 7 queue patch flow migration
- Refactored `patchConfig` in `apps/frontend/src/utils/vm/patcher.ts` to accept explicit injected hardware input `{ mac, ssdSerial, smbiosArgs }` and removed direct imports/usages of `generateMac`, `generateSmbios`, and `generateSsdSerial`.
- Kept IP/bridge/VNC derivation logic inside patcher unchanged (vm number derivation, `vmbr` mapping, SMBIOS type 11 IP injection, and VNC port rewrite still run in patch phase).
- Updated queue callsite in `apps/frontend/src/hooks/vm/queue/configureVmItem.ts` to pass pre-fetched `hardwareFingerprint` into `patchConfig`, preserving fetch-before-patch sequencing and generated-params log shape.

## 2026-02-27 Task: checkbox 8 frontend generator file removal
- Removed legacy frontend VM generator files (`generateMac.ts`, `generateSmbios.ts`, `generateSsdSerial.ts`, `smbiosPlatformGroups.ts`, `smbiosRamDb.ts`, `generators.ts`) after confirming no remaining frontend imports/usages.
- Pruned `apps/frontend/src/utils/vm/index.ts` to patcher-only exports (`PatchChange`, `PatchResult`, `extractVmNumber`, `patchConfig`) so no generator symbols remain in the public VM util surface.
- Post-delete reference sweep confirms no frontend references to `generateMac`, `generateSmbios`, `generateSsdSerial`, platform/RAM DB symbols, or `generators` import paths.

## 2026-02-27 Task: checkbox 9 verification/regression/docs sync
- Added backend regression coverage in `apps/backend/src/modules/vm/vm.controller.test.ts` for hardware-fingerprint auth guard (`MISSING_BEARER_TOKEN`) and invalid generated payload rejection (`VM_HARDWARE_FINGERPRINT_INVALID_RESPONSE`).
- Added frontend e2e regression scenario in `apps/frontend/e2e/authenticated-shell.spec.ts` that exercises VM Settings -> Generate Preview and asserts `/api/v1/vm/hardware-fingerprint` request plus rendered preview fields.
- Synced manual API docs in `docs/api/openapi.yaml` by adding `VmHardwareFingerprintMeta`/`VmHardwareFingerprintResponse` schemas and `GET /api/v1/vm/hardware-fingerprint` path entry.
- Verification run: `pnpm run backend:test` passed; `pnpm --filter @botmox/frontend test:e2e` failed in this environment due baseline login/shell tests not finding expected app UI; fallback verification `pnpm --filter @botmox/frontend exec tsc -b --pretty false` passed.

## 2026-02-27 Task: checkbox 9 e2e regression fix pass
- Root cause for prior e2e failures was Playwright targeting/reusing a non-target app instance on `:5173` (admin login UI), not the VM frontend under test.
- Updated Playwright harness in `apps/frontend/playwright.config.ts` to boot isolated frontend server via `pnpm exec vite --port 4173 --strictPort` and disable server reuse for deterministic suite target.
- Updated login assertions in `apps/frontend/e2e/smoke.spec.ts` and `apps/frontend/e2e/authenticated-shell.spec.ts` to assert login route/form intent (heading with Bot-Mox branding + sign-in controls) rather than stale exact heading text.
- Frontend e2e now passes end-to-end including VM preview regression (`/api/v1/vm/hardware-fingerprint` request + rendered brand/mac/serial): `pnpm --filter @botmox/frontend test:e2e` -> 4 passed.
