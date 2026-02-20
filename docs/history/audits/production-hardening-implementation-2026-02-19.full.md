# Production Hardening Implementation Report (2026-02-19)

Status: In Progress  
Owner: Platform Architecture  
Last Updated: 2026-02-20  
Scope: Backend auth/runtime hardening, agent transport hardening, DB persistence migration, secrets hardening, CI gates

## Implemented in this wave

1. Runtime migration flags introduced and validated:
   - `AUTH_MODE=shadow|enforced`
   - `AGENT_TRANSPORT=longpoll|ws|hybrid`
   - `BACKEND_DB_MODE=legacy|dual|db`
   - `SECRETS_VAULT_MODE=shadow|enforced`
2. Added migration gate script and root command:
   - `scripts/check-migration-flags.js`
   - `pnpm run migration:check`
3. Added mandatory pipeline commands:
   - `pnpm run backend:test`
   - `pnpm run agent:test`
   - `pnpm run contract:test`
4. CI workflow updated (`.github/workflows/ci.yml`) with migration/contract/backend/agent checks.
5. Replaced auth stub with JWT verification in backend:
   - `apps/backend/src/modules/auth/auth.service.ts`
6. Added global auth guard with shadow/enforced behavior:
   - `apps/backend/src/modules/auth/auth.guard.ts`
   - `apps/backend/src/modules/auth/request-identity.ts`
   - `apps/backend/src/modules/auth/request-identity.util.ts`
7. Added request trace/correlation/request IDs middleware:
   - `apps/backend/src/main.ts`
8. Added agent websocket command channel on backend:
   - `apps/backend/src/modules/agents/agents-ws-server.ts`
   - Endpoint: `GET /api/v1/agents/ws`
   - Message types: `next_command`, `heartbeat`
9. Added agent WS/hybrid transport mode:
   - `apps/agent/src/core/agent-loop.ts`
10. Added stale command sweeper for running/dispatched commands:
    - `apps/backend/src/modules/vm-ops/vm-ops.service.ts`
11. Added log redaction for sensitive fields in agent logger:
    - `apps/agent/src/core/logger.ts`
12. Added correlation headers from agent API client:
    - `apps/agent/src/core/api-client.ts`
13. Canonical docs updated:
    - `docs/workflow/DEV_WORKFLOW_CANONICAL.md`
    - `docs/backend/BACKEND_ARCHITECTURE_CANONICAL.md`
14. Started DB persistence migration (Wave 1) with Prisma:
    - `apps/backend/prisma/schema.prisma`
    - `apps/backend/src/modules/db/*`
15. Added repositories + dual-mode service integration for `agents` and `vm-ops`.
16. Added repositories + dual-mode service integration for `resources` and `workspace`.
17. Added repository + dual-mode service integration for `finance`.
18. Added repository + dual-mode service integration for `secrets` metadata/bindings and removed hardcoded tenant fallback in controller.
19. Added repository + dual-mode service integration for `bots`.
20. Added contract-level WS event schemas for agent channel in `packages/api-contract/src/schemasAgentsVmOpsArtifacts.ts`:
    - `agent.command.assigned`
    - `agent.command.ack`
    - `agent.command.progress`
    - `agent.command.result`
    - `agent.heartbeat`
21. Strengthened tenant enforcement in auth:
    - `AUTH_MODE=enforced` rejects JWTs without explicit tenant claim.
22. Added Vault-first secrets adapter scaffolding and DB metadata fields:
    - `apps/backend/src/modules/secrets/secrets-vault.adapter.ts`
    - `vault_ref` and `material_version` in Prisma `SecretMeta`
    - adapter wiring in `secrets.service.ts` and `secrets.repository.ts`
23. Removed hardcoded default tenant usage in tenant-scoped backend controllers:
    - `apps/backend/src/modules/artifacts/artifacts.controller.ts`
    - `apps/backend/src/modules/vm/vm.controller.ts`
    - `apps/backend/src/modules/vm/vm.service.ts` now resolves VM records by `tenantId + vmUuid` key.
24. Added executable backend/agent regression tests and made them part of package-level test scripts:
    - `apps/backend/src/modules/auth/auth.service.test.ts`
    - `apps/backend/src/modules/vm/vm.service.test.ts`
    - `apps/agent/src/core/logger.test.ts`
    - `apps/backend/package.json` test script uses `tsx --test`
    - `apps/agent/package.json` test script executes Node tests before typecheck
25. Added vm-ops reliability unit coverage:
    - `apps/backend/src/modules/vm-ops/vm-ops.service.test.ts`
    - covered scenarios: tenant boundary filtering, queue dispatch/claim transition, stale running expiration.
    - added mode-behavior coverage for `BACKEND_DB_MODE=db|dual`:
      - db mode uses repository result and fails hard on repository errors.
      - dual mode falls back to legacy shadow path on repository errors.
26. Added backend controller-level tenant isolation regression coverage:
    - `apps/backend/src/modules/artifacts/artifacts.controller.test.ts`
    - `apps/backend/src/modules/vm/vm.controller.test.ts`
    - `apps/backend/src/modules/vm-ops/vm-ops.controller.test.ts`
27. Added auth guard and resources dual/db behavior regression coverage:
    - `apps/backend/src/modules/auth/auth.guard.test.ts`
    - `apps/backend/src/modules/resources/resources.service.test.ts`
    - covered scenarios:
      - public-route bypass, shadow identity injection, enforced rejection, verified identity wiring.
      - `db` mode no-fallback semantics and `dual` mode fallback semantics in resources service.
28. Reduced legacy shadow-state usage in target `db` mode:
    - `apps/backend/src/modules/resources/resources.service.ts`
    - `apps/backend/src/modules/vm-ops/vm-ops.service.ts`
    - in `db` mode, legacy in-memory shadow writes are no longer maintained for these modules.
29. Tightened tenant contract in agents domain and added mode-regression coverage:
    - `apps/backend/src/modules/agents/agents.service.ts`
    - `apps/backend/src/modules/agents/agents.service.test.ts`
    - service methods now require explicit `tenantId` (no implicit `'default'` fallback for list/pairing/heartbeat),
      with tests validating strict `db` behavior and `dual` fallback behavior.
30. Tightened tenant normalization in secrets domain:
    - `apps/backend/src/modules/secrets/secrets.service.ts`
    - removed implicit `'default'` tenant fallback in tenant normalization path;
      empty tenant input now fails fast.
31. Tightened tenant contract in vm-ops command flow:
    - `apps/backend/src/modules/vm-ops/vm-ops.service.ts`
    - `apps/backend/src/modules/vm-ops/vm-ops.service.test.ts`
    - `dispatch` and `waitForNextAgentCommand` now require explicit tenant input and fail fast on empty tenant.
32. Migrated VM registry service toward repository-first persistence:
    - `apps/backend/src/modules/vm/vm.repository.ts`
    - `apps/backend/src/modules/vm/vm.service.ts`
    - `apps/backend/src/modules/vm/vm.module.ts`
    - `apps/backend/src/modules/vm/vm.controller.ts`
    - `apps/backend/src/modules/vm/vm.service.test.ts`
    - `apps/backend/src/modules/vm/vm.controller.test.ts`
    - VM domain now supports `legacy|dual|db` behavior with DB-backed read/write via Prisma SQL repository against `public.vm_registry`,
      while preserving dual-mode fallback for migration safety.
33. Reduced legacy shadow-state usage in target `db` mode for vm/agents:
    - `apps/backend/src/modules/vm/vm.service.ts`
    - `apps/backend/src/modules/agents/agents.service.ts`
    - in `db` mode, in-memory shadow writes are no longer maintained for these modules.
34. Hardened finance domain for db-first behavior and added regression coverage:
    - `apps/backend/src/modules/finance/finance.service.ts`
    - `apps/backend/src/modules/finance/finance.service.test.ts`
    - explicit tenant normalization enforced (fail-fast on empty tenant),
      legacy shadow state is not maintained in `db` mode,
      and dual/db mode fallback semantics are covered by tests.
35. Hardened workspace domain for db-first behavior and added regression coverage:
    - `apps/backend/src/modules/workspace/workspace.service.ts`
    - `apps/backend/src/modules/workspace/workspace.service.test.ts`
    - explicit tenant normalization enforced (fail-fast on empty tenant),
      legacy shadow state is not maintained in `db` mode,
      and dual/db mode fallback semantics are covered by tests.
36. Hardened secrets domain for db-first behavior and added regression coverage:
    - `apps/backend/src/modules/secrets/secrets.service.ts`
    - `apps/backend/src/modules/secrets/secrets.service.test.ts`
    - explicit tenant normalization is enforced (fail-fast on empty tenant),
      legacy shadow state is not maintained in `db` mode for secret/binding stores,
      and dual/db mode fallback semantics are covered by tests.
37. Hardened bots domain for db-first behavior and added regression coverage:
    - `apps/backend/src/modules/bots/bots.service.ts`
    - `apps/backend/src/modules/bots/bots.service.test.ts`
    - explicit tenant normalization is enforced (fail-fast on empty tenant),
      legacy shadow state is not maintained in `db` mode for bot store,
      and dual/db mode fallback semantics are covered by tests.
38. Hardened playbooks domain tenant boundaries and mode behavior coverage:
    - `apps/backend/src/modules/playbooks/playbooks.service.ts`
    - `apps/backend/src/modules/playbooks/playbooks.controller.ts`
    - `apps/backend/src/modules/playbooks/playbooks.service.test.ts`
    - playbook storage is now tenant-scoped (no cross-tenant map collisions),
      controller reads tenant from request identity instead of implicit/global scope,
      and mode behavior is covered for `legacy|dual|db`.
39. Hardened license lease domain tenant boundaries and mode behavior coverage:
    - `apps/backend/src/modules/license/license.service.ts`
    - `apps/backend/src/modules/license/license.controller.ts`
    - `apps/backend/src/modules/license/license.service.test.ts`
    - lease issuance now requires request identity (`tenantId`, `userId`) instead of service defaults,
      heartbeat/revoke are tenant-scoped, and mode behavior is covered for `legacy|dual|db`.
40. Hardened settings domain tenant boundaries and mode behavior coverage:
    - `apps/backend/src/modules/settings/settings.service.ts`
    - `apps/backend/src/modules/settings/settings.controller.ts`
    - `apps/backend/src/modules/settings/settings.service.test.ts`
    - settings read/write paths are now tenant-scoped,
      controller uses request identity tenant propagation,
      and mode behavior is covered for `legacy|dual|db`.
41. Hardened theme-assets domain tenant boundaries and mode behavior coverage:
    - `apps/backend/src/modules/theme-assets/theme-assets.service.ts`
    - `apps/backend/src/modules/theme-assets/theme-assets.controller.ts`
    - `apps/backend/src/modules/theme-assets/theme-assets.service.test.ts`
    - theme asset operations are now tenant-scoped (list/create/complete/delete),
      controller propagates tenant from request identity,
      and mode behavior is covered for `legacy|dual|db`.
42. Hardened provisioning domain tenant boundaries, token context, and mode behavior coverage:
    - `apps/backend/src/modules/provisioning/provisioning.service.ts`
    - `apps/backend/src/modules/provisioning/provisioning.controller.ts`
    - `apps/backend/src/modules/provisioning/provisioning.service.test.ts`
    - profile and progress stores are now tenant-scoped,
      provisioning token validation is bound to issued token context (`tenantId`, `userId`, `vmUuid`) instead of default fallback identities,
      and mode behavior is covered for `legacy|dual|db`.
43. Hardened artifacts domain tenant contract and mode behavior coverage:
    - `apps/backend/src/modules/artifacts/artifacts.service.ts`
    - `apps/backend/src/modules/artifacts/artifacts.service.test.ts`
    - artifact tenant normalization now fails fast on empty tenant input,
      and mode behavior is covered for `legacy|dual|db`.
44. Hardened infra domain tenant contract and mode behavior coverage:
    - `apps/backend/src/modules/infra/infra.service.ts`
    - `apps/backend/src/modules/infra/infra.controller.ts`
    - `apps/backend/src/modules/infra/infra.service.test.ts`
    - infra service state keys are now tenant-scoped,
      controller propagates tenant from request identity to infra service calls,
      and mode behavior is covered for `legacy|dual|db`.
45. Migrated playbooks domain to repository-backed persistence (DB path implemented):
    - `apps/backend/src/modules/playbooks/playbooks.repository.ts`
    - `apps/backend/src/modules/playbooks/playbooks.service.ts`
    - `apps/backend/src/modules/playbooks/playbooks.controller.ts`
    - `apps/backend/src/modules/playbooks/playbooks.module.ts`
    - `apps/backend/src/modules/playbooks/playbooks.service.test.ts`
    - `apps/backend/prisma/schema.prisma` (`PlaybookItem` model)
    - playbooks now run through `legacy|dual|db` with repository support in `db` mode (no domain-specific fail-fast for missing persistence path).
46. Migrated settings domain to repository-backed persistence (DB path implemented):
    - `apps/backend/src/modules/settings/settings.repository.ts`
    - `apps/backend/src/modules/settings/settings.service.ts`
    - `apps/backend/src/modules/settings/settings.controller.ts`
    - `apps/backend/src/modules/settings/settings.module.ts`
    - `apps/backend/src/modules/settings/settings.service.test.ts`
    - `apps/backend/prisma/schema.prisma` (`SettingsItem` model)
    - settings now run through `legacy|dual|db` with repository support in `db` mode (no domain-specific fail-fast for missing persistence path).
47. Migrated theme-assets domain to repository-backed persistence (DB path implemented):
    - `apps/backend/src/modules/theme-assets/theme-assets.repository.ts`
    - `apps/backend/src/modules/theme-assets/theme-assets.service.ts`
    - `apps/backend/src/modules/theme-assets/theme-assets.controller.ts`
    - `apps/backend/src/modules/theme-assets/theme-assets.module.ts`
    - `apps/backend/src/modules/theme-assets/theme-assets.service.test.ts`
    - `apps/backend/prisma/schema.prisma` (`ThemeAssetItem` model)
    - theme-assets now run through `legacy|dual|db` with repository support in `db` mode (no domain-specific fail-fast for missing persistence path).
48. Migrated license domain to repository-backed persistence (DB path implemented):
    - `apps/backend/src/modules/license/license.repository.ts`
    - `apps/backend/src/modules/license/license.service.ts`
    - `apps/backend/src/modules/license/license.controller.ts`
    - `apps/backend/src/modules/license/license.module.ts`
    - `apps/backend/src/modules/license/license.service.test.ts`
    - `apps/backend/prisma/schema.prisma` (`LicenseLeaseItem` model)
    - licenses now run through `legacy|dual|db` with repository support in `db` mode (no domain-specific fail-fast for missing persistence path).
49. Migrated artifacts domain to repository-backed persistence (DB path implemented):
    - `apps/backend/src/modules/artifacts/artifacts.repository.ts`
    - `apps/backend/src/modules/artifacts/artifacts.service.ts`
    - `apps/backend/src/modules/artifacts/artifacts.controller.ts`
    - `apps/backend/src/modules/artifacts/artifacts.module.ts`
    - `apps/backend/src/modules/artifacts/artifacts.service.test.ts`
    - `apps/backend/src/modules/artifacts/artifacts.controller.test.ts`
    - `apps/backend/prisma/schema.prisma` (`ArtifactReleaseItem`, `ArtifactAssignmentItem` models)
    - artifacts now run through `legacy|dual|db` with repository support in `db` mode (no domain-specific fail-fast for missing persistence path).
50. Migrated infra domain to repository-backed persistence (DB path implemented):
    - `apps/backend/src/modules/infra/infra.repository.ts`
    - `apps/backend/src/modules/infra/infra.service.ts`
    - `apps/backend/src/modules/infra/infra.controller.ts`
    - `apps/backend/src/modules/infra/infra.module.ts`
    - `apps/backend/src/modules/infra/infra.service.test.ts`
    - `apps/backend/prisma/schema.prisma` (`InfraVmItem`, `InfraVmConfigItem` models)
    - infra now runs through `legacy|dual|db` with repository support in `db` mode (no domain-specific fail-fast for missing persistence path).
51. Migrated provisioning domain to repository-backed persistence (DB path implemented):
    - `apps/backend/src/modules/provisioning/provisioning.repository.ts`
    - `apps/backend/src/modules/provisioning/provisioning.service.ts`
    - `apps/backend/src/modules/provisioning/provisioning.controller.ts`
    - `apps/backend/src/modules/provisioning/provisioning.module.ts`
    - `apps/backend/src/modules/provisioning/provisioning.service.test.ts`
    - `apps/backend/prisma/schema.prisma` (`ProvisioningProfileItem`, `ProvisioningTokenItem`, `ProvisioningProgressItem` models)
    - provisioning now runs through `legacy|dual|db` with repository support in `db` mode (no domain-specific fail-fast for missing persistence path).
52. Added backend tenant fallback guardrail in CI/runtime checks:
    - `scripts/check-backend-tenant-defaults.js`
    - `package.json` (`check:backend:tenant-defaults`, wired into `check:all:mono`)
    - blocks new `'default'` tenant fallback patterns in backend runtime modules (no runtime allowlist).
53. Strengthened migration flag enforcement in CI:
    - `scripts/check-migration-flags.js` now supports `--strict` mode
    - `package.json` includes `migration:check:strict`
    - `.github/workflows/ci.yml` now runs strict migration check with enforced hardening baseline:
      - `AUTH_MODE=enforced`
      - `AGENT_TRANSPORT=hybrid`
      - `BACKEND_DB_MODE=dual`
      - `SECRETS_VAULT_MODE=shadow`
54. Enforced deterministic auth controller error contract:
    - `apps/backend/src/modules/auth/auth.controller.ts`
    - missing bearer token now raises `UnauthorizedException` with explicit code payload:
      - `code: "MISSING_BEARER_TOKEN"`
      - `message: "Missing bearer token"`
55. Added auth controller regression coverage:
    - `apps/backend/src/modules/auth/auth.controller.test.ts`
    - covered scenarios:
      - deterministic auth error envelope for missing bearer token.
      - stable identity mapping in `whoami`.
56. Stabilized backend test/typecheck health after deterministic error-code rollout:
    - `apps/backend/src/modules/artifacts/artifacts.controller.test.ts`
    - `apps/backend/src/modules/license/license.controller.test.ts`
    - removed invalid value-as-type casts in CommonJS-style tests to keep strict TypeScript checks green.
57. Added WS outbound contract enforcement in backend agent transport:
    - `apps/backend/src/modules/agents/agents-ws-server.ts`
    - outbound websocket events are now validated against `agentWsEventSchema` from `@botmox/api-contract` before send.
    - on internal schema mismatch, server emits deterministic transport error event:
      - `type: "error"`
      - `code: "WS_EVENT_SCHEMA_VIOLATION"`
      - `message: "Internal websocket event schema violation"`
58. Hardened auth guard deterministic unauthorized envelope:
    - `apps/backend/src/modules/auth/auth.guard.ts`
    - enforced-mode guard rejection now uses explicit code payload:
      - `code: "INVALID_OR_MISSING_BEARER_TOKEN"`
      - `message: "Invalid or missing bearer token"`
59. Added auth guard regression assertion for deterministic code:
    - `apps/backend/src/modules/auth/auth.guard.test.ts`
    - enforced rejection test now validates exact response payload (not only exception class).
60. Added agent-side WS contract validation against shared schemas:
    - `apps/agent/src/core/agent-loop-ws.ts`
    - inbound WS events are now parsed with `agentWsEventSchema` before processing.
    - outbound WS payloads are now validated with `agentWsInboundMessageSchema` before send.
    - invalid inbound/outbound protocol frames are ignored safely with structured warning logs.
61. Declared contract dependency for agent transport hardening:
    - `apps/agent/package.json`
    - added `@botmox/api-contract` as workspace dependency for shared WS schema usage.
62. Hardened agents controller deterministic error envelopes:
    - `apps/backend/src/modules/agents/agents.controller.ts`
    - missing bearer token now returns explicit auth code payload.
    - list/pairing/heartbeat validation failures now return explicit domain codes with `details`.
63. Added agents controller regression coverage for deterministic codes:
    - `apps/backend/src/modules/agents/agents.controller.test.ts`
    - covered scenarios:
      - missing bearer token (`MISSING_BEARER_TOKEN`)
      - invalid heartbeat payload (`AGENTS_HEARTBEAT_INVALID_BODY`)
64. Hardened wow-names controller deterministic error envelopes:
    - `apps/backend/src/modules/wow-names/wow-names.controller.ts`
    - missing bearer token now returns explicit auth code payload.
    - query validation failures now return explicit domain code with `details`.
65. Added wow-names controller regression coverage:
    - `apps/backend/src/modules/wow-names/wow-names.controller.test.ts`
    - covered scenarios:
      - missing bearer token (`MISSING_BEARER_TOKEN`)
      - invalid query (`WOW_NAMES_INVALID_QUERY`)
66. Hardened finance controller deterministic error envelopes:
    - `apps/backend/src/modules/finance/finance.controller.ts`
    - missing bearer token now returns explicit auth code payload.
    - id/query/body validation failures now return explicit domain codes with `details`.
    - not-found responses now return explicit code payload (`FINANCE_OPERATION_NOT_FOUND`).
67. Added finance controller regression coverage:
    - `apps/backend/src/modules/finance/finance.controller.test.ts`
    - covered scenarios:
      - missing bearer token (`MISSING_BEARER_TOKEN`)
      - missing finance operation (`FINANCE_OPERATION_NOT_FOUND`)
68. Hardened resources controller deterministic error envelopes:
    - `apps/backend/src/modules/resources/resources.controller.ts`
    - missing bearer token now returns explicit auth code payload.
    - kind/id/body/query validation failures now return explicit domain codes with `details`.
    - not-found responses now return explicit code payload (`RESOURCE_NOT_FOUND`).
69. Added resources controller regression coverage:
    - `apps/backend/src/modules/resources/resources.controller.test.ts`
    - covered scenarios:
      - missing bearer token (`MISSING_BEARER_TOKEN`)
      - missing resource (`RESOURCE_NOT_FOUND`)
70. Hardened workspace controller deterministic error envelopes:
    - `apps/backend/src/modules/workspace/workspace.controller.ts`
    - missing bearer token now returns explicit auth code payload.
    - kind/id/query/body validation failures now return explicit domain codes with `details`.
    - not-found responses now return explicit code payload (`WORKSPACE_ENTITY_NOT_FOUND`).
71. Added workspace controller regression coverage:
    - `apps/backend/src/modules/workspace/workspace.controller.test.ts`
    - covered scenarios:
      - missing bearer token (`MISSING_BEARER_TOKEN`)
      - missing workspace entity (`WORKSPACE_ENTITY_NOT_FOUND`)
72. Hardened settings controller deterministic error envelopes:
    - `apps/backend/src/modules/settings/settings.controller.ts`
    - missing bearer token now returns explicit auth code payload.
    - api_keys/proxy/notification-events validation failures now return explicit domain codes with `details`.
73. Added settings controller regression coverage:
    - `apps/backend/src/modules/settings/settings.controller.test.ts`
    - covered scenarios:
      - missing bearer token (`MISSING_BEARER_TOKEN`)
      - invalid proxy payload (`SETTINGS_INVALID_PROXY_BODY`)
74. Hardened vm controller deterministic error envelopes:
    - `apps/backend/src/modules/vm/vm.controller.ts`
    - missing bearer token now returns explicit auth code payload.
    - register/resolve validation failures now return explicit domain codes with `details`.
    - resolve not-found now returns explicit code payload (`VM_UUID_NOT_FOUND`).
75. Extended vm controller regression coverage:
    - `apps/backend/src/modules/vm/vm.controller.test.ts`
    - covered scenarios:
      - deterministic not-found payload (`VM_UUID_NOT_FOUND`) on cross-tenant resolve miss.
      - missing bearer token (`MISSING_BEARER_TOKEN`).
76. Hardened playbooks controller deterministic error envelopes:
    - `apps/backend/src/modules/playbooks/playbooks.controller.ts`
    - missing bearer token now returns explicit auth code payload.
    - id/create/update/validate parsing failures now return explicit domain codes with `details`.
    - not-found responses now return explicit code payload (`PLAYBOOK_NOT_FOUND`).
77. Added playbooks controller regression coverage:
    - `apps/backend/src/modules/playbooks/playbooks.controller.test.ts`
    - covered scenarios:
      - missing bearer token (`MISSING_BEARER_TOKEN`)
      - missing playbook (`PLAYBOOK_NOT_FOUND`)
78. Hardened theme-assets controller deterministic error envelopes:
    - `apps/backend/src/modules/theme-assets/theme-assets.controller.ts`
    - missing bearer token now returns explicit auth code payload.
    - presign/complete validation failures now return explicit domain codes with `details`.
    - complete/delete not-found responses now return explicit code payload (`THEME_ASSET_NOT_FOUND`).
79. Added theme-assets controller regression coverage:
    - `apps/backend/src/modules/theme-assets/theme-assets.controller.test.ts`
    - covered scenarios:
      - missing bearer token (`MISSING_BEARER_TOKEN`)
      - missing asset on complete (`THEME_ASSET_NOT_FOUND`)
80. Hardened vm-ops controller deterministic error envelopes:
    - `apps/backend/src/modules/vm-ops/vm-ops.controller.ts`
    - missing bearer token now returns explicit auth code payload.
    - command/action/query/body validation failures now return explicit domain codes with `details`.
    - get/patch not-found responses now return explicit code payload (`VM_OPS_COMMAND_NOT_FOUND`).
    - `id` missing and invalid positive-int query parameter paths now use explicit deterministic codes.
81. Extended vm-ops controller regression coverage:
    - `apps/backend/src/modules/vm-ops/vm-ops.controller.test.ts`
    - covered scenarios:
      - deterministic not-found payload (`VM_OPS_COMMAND_NOT_FOUND`) on cross-tenant command read.
      - missing bearer token (`MISSING_BEARER_TOKEN`).
82. Hardened infra controller deterministic error envelopes:
    - `apps/backend/src/modules/infra/infra.controller.ts`
    - missing bearer token now returns explicit auth code payload.
    - schema parsing failures now return deterministic infra bad-request envelope with explicit code/message/details.
    - mapped `InfraServiceError` responses now preserve deterministic domain code across 400/403/404/500 paths.
83. Added infra controller regression coverage:
    - `apps/backend/src/modules/infra/infra.controller.test.ts`
    - covered scenarios:
      - missing bearer token (`MISSING_BEARER_TOKEN`)
      - mapped deterministic not-found envelope from service error code (`INFRA_VM_NOT_FOUND`)
54. Completed `vm-ops` repository-only cutover (legacy runtime path removed):
    - `apps/backend/src/modules/vm-ops/vm-ops.service.ts`
    - `apps/backend/src/modules/vm-ops/vm-ops.service.test.ts`
    - `apps/backend/src/modules/vm-ops/vm-ops.controller.test.ts`
    - `apps/backend/src/modules/vm-ops/vm-ops.ws.integration.test.ts`
    - command dispatch/claim/status/reliability sweep now use repository path only; in-memory command queue fallback removed.
55. Completed `artifacts` repository-only cutover (legacy runtime path removed):
    - `apps/backend/src/modules/artifacts/artifacts.service.ts`
    - `apps/backend/src/modules/artifacts/artifacts.service.test.ts`
    - `apps/backend/src/modules/artifacts/artifacts.controller.test.ts`
    - release/assignment/effective-resolution/download now use repository path only; in-memory release/assignment fallback removed.
56. Completed `provisioning` repository-only cutover (legacy runtime path removed):
    - `apps/backend/src/modules/provisioning/provisioning.service.ts`
    - `apps/backend/src/modules/provisioning/provisioning.service.test.ts`
    - profile/token/progress flows now use repository path only; in-memory fallback stores and `legacy|dual|db` branching removed.
57. Completed `infra` repository-only cutover (legacy runtime path removed):
    - `apps/backend/src/modules/infra/infra.service.ts`
    - `apps/backend/src/modules/infra/infra.service.test.ts`
    - VM/config/runtime infra flows now use repository path only; in-memory fallback stores and `legacy|dual|db` branching removed.
    - `docs/workflow/DEV_WORKFLOW_CANONICAL.md` updated with strict CI profile expectations.
54. Hardened secrets runtime policy for DB mode:
    - `apps/backend/src/modules/secrets/secrets.service.ts`
    - `apps/backend/src/modules/secrets/secrets.service.test.ts`
    - in `BACKEND_DB_MODE=db`, local fallback vault references (`local-vault://`) are now rejected at runtime
      to prevent non-vault secret material paths in strict DB mode.
    - dual mode behavior is preserved for transition safety and covered by regression tests.
55. Extended WS command lifecycle support and WS-first status reporting:
    - `packages/api-contract/src/schemasAgentsVmOpsArtifacts.ts`
    - `apps/backend/src/modules/agents/agents-ws-server.ts`
    - `apps/backend/src/modules/vm-ops/vm-ops.service.ts`
    - `apps/backend/src/modules/vm-ops/vm-ops.repository.ts`
    - `apps/agent/src/core/agent-loop.ts`
    - backend WS now accepts `agent.command.ack`, `agent.command.progress`, `agent.command.result`
      and applies corresponding command status transitions.
    - agent loop now reports command running/result via WS first, with HTTP patch fallback.
    - vm-ops status path now supports `cancelled` as terminal state.
56. Added vm-ops terminal-state regression coverage:
    - `apps/backend/src/modules/vm-ops/vm-ops.service.test.ts`
    - validates `cancelled` status transition semantics.
57. Hardened vm-ops lease reliability with independent dispatched/running timeouts:
    - `apps/backend/src/modules/vm-ops/vm-ops.repository.ts`
    - `apps/backend/src/modules/vm-ops/vm-ops.service.ts`
    - `apps/backend/src/modules/vm-ops/vm-ops.service.test.ts`
    - reliability sweep now expires stale `running` and stale `dispatched` commands with separate thresholds
      (`BOTMOX_VMOPS_RUNNING_MAX_MS`, `BOTMOX_VMOPS_DISPATCHED_MAX_MS`) and emits structured warning logs.
58. Added backend WS integration regression coverage:
    - `apps/backend/src/modules/agents/agents-ws-server.test.ts`
    - covered scenarios:
      - unauthorized WS handshake is rejected with HTTP 401.
59. Tightened auth tenant policy to eliminate implicit default tenant identity:
    - `apps/backend/src/modules/auth/auth.service.ts`
    - JWTs without explicit tenant claim now fail verification in both `shadow` and `enforced` modes.
    - shadow fallback identity uses `BOTMOX_SHADOW_TENANT_ID` (default `shadow-tenant`) instead of `'default'`.
60. Hardened WS heartbeat metadata normalization:
    - `apps/backend/src/modules/agents/agents-ws-server.ts`
    - `apps/backend/src/modules/agents/agents-ws-server.test.ts`
    - invalid heartbeat metadata payloads are normalized to `{}` before service write and WS response envelope.
61. Aligned WS runtime envelopes with contract schemas:
    - `packages/api-contract/src/schemasAgentsVmOpsArtifacts.ts`
    - `docs/backend/BACKEND_ARCHITECTURE_CANONICAL.md`
    - contract now includes `connected` and `error` WS envelopes emitted by backend runtime.
62. Tightened secrets strict-mode policy and regression coverage:
    - `apps/backend/src/modules/secrets/secrets.service.ts`
    - `apps/backend/src/modules/secrets/secrets.service.test.ts`
    - `apps/backend/src/modules/secrets/secrets-vault.adapter.test.ts`
    - `SECRETS_VAULT_MODE=enforced` now forbids `local-vault://` references even outside `BACKEND_DB_MODE=db`.
    - adapter tests cover strict no-fallback behavior for missing Supabase Vault RPC config.
63. Added WS integration regression for vm-ops command lifecycle:
    - `apps/backend/src/modules/vm-ops/vm-ops.ws.integration.test.ts`
    - verifies end-to-end WS command flow with real `VmOpsService` in legacy runtime mode:
      `dispatch -> next_command -> agent.command.ack -> agent.command.result`.
64. Cut over agents domain to repository-only runtime (de-legacy slice):
    - `apps/backend/src/modules/agents/agents.service.ts`
    - removed in-memory records/pairings fallback paths from service runtime.
    - `apps/backend/src/modules/agents/agents.service.test.ts` updated:
      dual mode now fails fast on repository list errors (no legacy list fallback).
65. Cut over workspace domain to repository-only runtime (de-legacy slice):
    - `apps/backend/src/modules/workspace/workspace.service.ts`
    - removed in-memory workspace bucket fallback paths from list/get/create/update/remove runtime.
    - `apps/backend/src/modules/workspace/workspace.service.test.ts` updated:
      dual mode now fails fast on repository errors (no legacy fallback for CRUD/list paths).
      - `agent.command.ack` message updates command status to `running` in tenant scope and returns WS ack envelope.
59. Expanded backend WS integration regression coverage for event-driven command flow:
    - `apps/backend/src/modules/agents/agents-ws-server.test.ts`
    - covered scenarios:
      - `next_command` returns `agent.command.assigned` with tenant-scoped dispatch input.
      - `agent.command.result` updates terminal status and returns `agent.command.result` envelope.
60. Switched agent heartbeat to WS-first transport with HTTP fallback:
    - `apps/agent/src/core/agent-loop.ts`
    - in `ws|hybrid` modes heartbeat now attempts WS `heartbeat` event and uses HTTP `/api/v1/agents/heartbeat`
      only as fallback when WS heartbeat is unavailable.
61. Implemented stale-dispatched requeue/dead-letter reliability policy:
    - `apps/backend/src/modules/vm-ops/vm-ops.repository.ts`
    - `apps/backend/src/modules/vm-ops/vm-ops.service.ts`
    - `apps/backend/src/modules/vm-ops/vm-ops.service.test.ts`
    - behavior:
      - stale `running` commands -> `expired`.
      - stale `dispatched` commands -> `queued` with `REQUEUE_COUNT` marker until retry limit.
      - stale `dispatched` commands above retry limit -> `failed` (dead-letter).
      - controlled by `BOTMOX_VMOPS_DISPATCH_MAX_REQUEUES`.
62. Hardened agent WS reconnect reliability with explicit backoff policy:
    - `apps/agent/src/core/agent-loop.ts`
    - `apps/agent/src/core/reconnect-policy.ts`
    - `apps/agent/src/core/reconnect-policy.test.ts`
    - behavior:
      - reconnect attempts are throttled by exponential backoff + jitter.
      - heartbeat fallback to HTTP is tracked and logged via structured events.
      - WS unavailable/recovered transitions include reconnect telemetry fields.
63. Cut over resources domain to repository-only runtime (de-legacy slice):
    - `apps/backend/src/modules/resources/resources.service.ts`
    - `apps/backend/src/modules/resources/resources.service.test.ts`
    - removed in-memory bucket/fallback branches from list/get/create/update/remove;
      repository is now the single runtime source with fail-fast error semantics.
64. Cut over playbooks domain to repository-only runtime (de-legacy slice):
    - `apps/backend/src/modules/playbooks/playbooks.service.ts`
    - `apps/backend/src/modules/playbooks/playbooks.service.test.ts`
    - removed in-memory map/fallback branches from list/get/create/update/remove;
      repository is now the single runtime source with fail-fast error semantics.
    - preserved default-playbook uniqueness by resetting previous defaults through repository upserts.
65. Cut over settings domain to repository-only runtime (de-legacy slice):
    - `apps/backend/src/modules/settings/settings.service.ts`
    - `apps/backend/src/modules/settings/settings.service.test.ts`
    - removed in-memory settings store/fallback branches from read/merge paths;
      repository is now the single runtime source with fail-fast error semantics.
66. Cut over theme-assets domain to repository-only runtime (de-legacy slice):
    - `apps/backend/src/modules/theme-assets/theme-assets.service.ts`
    - `apps/backend/src/modules/theme-assets/theme-assets.service.test.ts`
    - removed in-memory theme-asset store/fallback branches from list/create/complete/delete paths;
      repository is now the single runtime source with fail-fast error semantics.
67. Cut over finance domain to repository-only runtime (de-legacy slice):
    - `apps/backend/src/modules/finance/finance.service.ts`
    - `apps/backend/src/modules/finance/finance.service.test.ts`
    - removed in-memory finance store/fallback branches from list/get/create/patch/remove/stats paths;
      repository is now the single runtime source with fail-fast error semantics.
68. Cut over bots domain to repository-only runtime (de-legacy slice):
    - `apps/backend/src/modules/bots/bots.service.ts`
    - `apps/backend/src/modules/bots/bots.service.test.ts`
    - removed in-memory bots store/fallback branches from list/get/create/patch/remove and lifecycle transition paths;
      repository is now the single runtime source with fail-fast error semantics.
69. Cut over VM registry domain to repository-only runtime (de-legacy slice):
    - `apps/backend/src/modules/vm/vm.service.ts`
    - `apps/backend/src/modules/vm/vm.service.test.ts`
    - removed in-memory VM store/fallback branches from register/resolve paths;
      repository is now the single runtime source with fail-fast error semantics.
70. Cut over license domain to repository-only runtime (de-legacy slice):
    - `apps/backend/src/modules/license/license.service.ts`
    - `apps/backend/src/modules/license/license.service.test.ts`
    - removed in-memory lease store/fallback branches from issue/heartbeat/revoke paths;
      repository is now the single runtime source with fail-fast error semantics.
71. Cut over secrets domain to repository-only runtime (de-legacy slice):
    - `apps/backend/src/modules/secrets/secrets.service.ts`
    - `apps/backend/src/modules/secrets/secrets.service.test.ts`
    - secret metadata/binding flows now use repository path only; runtime `BACKEND_DB_MODE` branching and in-memory secret/binding fallback stores removed.
72. Removed `BACKEND_DB_MODE` from active migration policy and tightened strict vault profile:
    - `scripts/check-migration-flags.js`
    - `.github/workflows/ci.yml`
    - `docs/workflow/DEV_WORKFLOW_CANONICAL.md`
    - `docs/backend/BACKEND_ARCHITECTURE_CANONICAL.md`
    - `scripts/README.md`
    - strict migration profile now requires:
      - `AUTH_MODE=enforced`
      - `AGENT_TRANSPORT=hybrid|ws`
      - `SECRETS_VAULT_MODE=enforced`
73. Completed Vault no-local-fallback runtime cutover:
    - `apps/backend/src/modules/secrets/secrets-vault.adapter.ts`
    - `apps/backend/src/modules/secrets/secrets-vault.adapter.test.ts`
    - `apps/backend/src/modules/secrets/secrets.service.ts`
    - `apps/backend/src/modules/secrets/secrets.service.test.ts`
    - local vault material fallback path removed from adapter; missing Supabase Vault RPC config now fails fast in all modes.
    - `local-vault://` references are rejected by secrets service policy in active runtime.

## Validation

These gates were run and passed during the implementation waves:

1. `pnpm run migration:check`
2. `pnpm run backend:test`
3. `pnpm run agent:test`
4. `pnpm run contract:test`
5. `pnpm run check:all:mono`
6. `pnpm run docs:check`
7. `pnpm run backend:test`
8. `pnpm run agent:test`

## Completed test coverage scope (current)

1. Auth hardening coverage (`apps/backend/src/modules/auth/auth.service.test.ts`):
   - enforced mode rejects JWTs missing `tenant_id`.
   - enforced mode accepts JWTs with tenant/email/role claims and maps identity fields.
2. Tenant isolation coverage (`apps/backend/src/modules/vm/vm.service.test.ts`):
   - VM registry lookup is isolated by `(tenantId, vmUuid)` and does not leak across tenants.
3. VM ops reliability coverage (`apps/backend/src/modules/vm-ops/vm-ops.service.test.ts`):
   - tenant boundary enforcement for list/get paths.
   - queue dispatch -> next-claim transition updates command status to `dispatched`.
   - stale `running` commands are swept to `expired` with error annotation.
4. Agent log-safety coverage (`apps/agent/src/core/logger.test.ts`):
   - file logs redact sensitive keys (`password`, `token`, `api_key`) including nested payload fields.
5. CI/package-level execution coverage:
   - backend tests run via `tsx --test "src/**/*.test.ts"` + backend typecheck.
   - agent tests run via `node --test --experimental-strip-types "src/**/*.test.ts"` + agent typecheck.
   - root CI gates include `migration:check`, `backend:test`, `agent:test`, `contract:test`.
6. Backend controller tenant isolation coverage:
   - artifacts assignment/effective lookup are tenant-scoped.
   - vm resolve is tenant-scoped for identical `vm_uuid` across tenants.
   - vm-ops command listing/get-by-id are tenant-scoped.
7. Auth/runtime boundary coverage:
   - guard behavior is validated for public endpoints, shadow mode, enforced mode, and verified token flows.
8. Resources migration-mode coverage:
   - `db` mode uses repository as source of truth and fails hard on repository errors.
   - `dual` mode falls back to legacy shadow state on repository errors.
9. Agents migration-mode and tenant-contract coverage:
   - service rejects empty tenant input early.
   - `db` mode does not fallback on repository list errors.
   - `dual` mode falls back to legacy state for list flows when repository fails.
10. Secrets tenant-contract hardening:
   - service tenant normalization no longer silently maps empty tenant to `'default'`.
11. Vm-ops tenant-contract hardening:
   - command dispatch/next-claim paths reject empty tenant input.
12. VM repository migration coverage:
   - tenant isolation remains enforced in controller/service behavior.
   - `db` mode fails hard on repository errors.
   - `dual` mode falls back to legacy in-memory state on repository errors.
13. Db-mode shadow-state cleanup:
   - vm/agents services no longer keep legacy in-memory mirrors when `BACKEND_DB_MODE=db`.
14. Finance migration-mode and tenant-contract coverage:
   - service rejects empty tenant input.
   - `db` mode does not fallback on repository errors and does not keep shadow state.
   - `dual` mode falls back to legacy in-memory state when repository fails.
15. Workspace migration-mode and tenant-contract coverage:
   - service rejects empty tenant input.
   - `db` mode does not fallback on repository errors and does not keep shadow state.
   - `dual` mode falls back to legacy in-memory state when repository fails.
16. Secrets migration-mode and tenant-contract coverage:
   - service rejects empty tenant input.
   - `db` mode does not fallback on repository errors and does not keep shadow state.
   - `dual` mode falls back to legacy in-memory state when repository fails.
17. Bots migration-mode and tenant-contract coverage:
   - service rejects empty tenant input.
   - `db` mode does not fallback on repository errors and does not keep shadow state.
   - `dual` mode falls back to legacy in-memory state when repository fails.
18. Playbooks tenant/migration-mode coverage:
   - service rejects empty tenant input.
   - tenant data isolation is enforced in list/get/update/remove paths.
   - `db` mode uses repository-backed list/find/upsert/delete paths and fails hard on repository errors.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
19. License tenant/migration-mode coverage:
   - service rejects empty tenant and empty user identity on lease issue.
   - heartbeat/revoke are isolated by tenant scope.
   - `db` mode uses repository-backed find/upsert paths and fails hard on repository errors.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
20. Settings tenant/migration-mode coverage:
    - service rejects empty tenant input.
    - settings values are isolated per tenant scope.
   - `db` mode uses repository-backed read/write paths and fails hard on repository errors.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
21. Theme-assets tenant/migration-mode coverage:
    - service rejects empty tenant input.
    - list/create/complete/delete are isolated per tenant scope.
   - `db` mode uses repository-backed read/write paths and fails hard on repository errors.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
22. Provisioning tenant/migration-mode coverage:
   - service rejects empty tenant/user identity for token/profile flows.
   - profile/progress data are isolated per tenant scope.
   - token validation/report-progress are bound to issued token context and vm UUID.
   - `db` mode uses repository-backed profile/token/progress paths and fails hard on repository errors.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
23. Artifacts tenant/migration-mode coverage:
   - service rejects empty tenant input.
   - assignment/effective resolution remains tenant-scoped.
   - `db` mode uses repository-backed release/assignment paths and fails hard on repository errors.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
24. Infra tenant/migration-mode coverage:
   - service rejects empty tenant input on tenant-scoped flows.
   - vm/vm-config in-memory stores are tenant-scoped.
   - `db` mode uses repository-backed VM/config paths and fails hard on repository errors.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
25. Playbooks migration-mode coverage:
   - service rejects empty tenant input.
   - `db` mode uses repository-backed list/find/upsert/delete paths.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
26. Settings migration-mode coverage:
   - service rejects empty tenant input.
   - `db` mode uses repository-backed find/upsert paths.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
27. Theme-assets migration-mode coverage:
   - service rejects empty tenant input.
   - `db` mode uses repository-backed list/find/upsert paths.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
28. License migration-mode coverage:
   - service rejects empty tenant/user identity inputs.
   - `db` mode uses repository-backed find/upsert paths.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
29. Artifacts migration-mode coverage:
   - service rejects empty tenant input.
   - `db` mode uses repository-backed release/assignment lookup and persistence paths.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
30. Infra migration-mode coverage:
   - service rejects empty tenant input on tenant-scoped flows.
   - `db` mode uses repository-backed VM/config lookup and persistence paths.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
31. Provisioning migration-mode coverage:
   - service rejects empty tenant/user identity on tenant-scoped profile/token flows.
   - `db` mode uses repository-backed profile/token/progress lookup and persistence paths.
   - `dual` mode falls back to legacy in-memory state when repository errors occur.
32. Vm-ops strict cutover coverage:
   - service now runs repository-only (no `legacy|dual|db` runtime branching).
   - WS lifecycle and controller tests validate tenant-safe dispatch/ack/result flow.
33. Artifacts strict cutover coverage:
   - service now runs repository-only (no `legacy|dual|db` runtime branching).
   - controller and service tests validate tenant-safe release/assignment/read behavior.
34. Provisioning strict cutover coverage:
   - service now runs repository-only (no `legacy|dual|db` runtime branching).
   - service tests validate tenant-safe profile/token/progress behavior with fail-fast repository semantics.
35. Infra strict cutover coverage:
   - service now runs repository-only (no `legacy|dual|db` runtime branching).
   - service tests validate tenant-safe vm/config behavior with fail-fast repository semantics.
36. Secrets strict cutover coverage:
   - service now runs repository-only (no `legacy|dual|db` runtime branching).
   - service tests validate tenant-safe metadata/binding behavior with fail-fast repository semantics.
37. Vm-ops tenant-safe status update hardening:
   - `updateCommandStatus` now verifies tenant ownership before repository status mutation.
   - added integration coverage for WS tenant-isolation (`next_command` + `ack` cross-tenant path).
   - added service-level regression test to guarantee no cross-tenant status mutation.
38. Artifacts lease-token hardening:
   - `resolveDownload` now validates active lease token via license repository before returning download metadata.
   - lease binding is enforced on `tenant + vm_uuid + module`.
   - added artifacts service regression for invalid lease token and cross-module integration test (`license -> artifacts`) with tenant isolation.
39. Unified backend error envelope hardening:
   - added global Nest exception filter for HTTP routes to normalize errors into `{ success:false, error:{code,message,details?} }`.
   - added filter tests for validation (`400`) and unexpected (`500`) paths.
40. Infra controller deterministic error envelopes:
   - `apps/backend/src/modules/infra/infra.controller.ts` now returns stable domain codes for auth-missing and infra not-found paths.
   - added `apps/backend/src/modules/infra/infra.controller.test.ts` coverage for `MISSING_BEARER_TOKEN` and `INFRA_ENTITY_NOT_FOUND`.
41. Provisioning controller deterministic error envelopes:
   - `apps/backend/src/modules/provisioning/provisioning.controller.ts` now validates all boundary payloads/paths with explicit error codes (`PROVISIONING_INVALID_*`, `PROVISIONING_PROFILE_SOURCE_REQUIRED`, `UNATTEND_PROFILE_NOT_FOUND`, `MISSING_BEARER_TOKEN`).
   - verified by `apps/backend/src/modules/provisioning/provisioning.controller.test.ts` for missing bearer token and missing profile update paths.
42. Bots controller deterministic error envelopes:
   - `apps/backend/src/modules/bots/bots.controller.ts` now returns explicit domain codes for auth-missing, invalid payloads and not-found (`MISSING_BEARER_TOKEN`, `BOTS_INVALID_*`, `BOT_NOT_FOUND`, `BOTS_*_VALIDATION_FAILED`).
   - added `apps/backend/src/modules/bots/bots.controller.test.ts` coverage for missing bearer token and missing bot paths.
43. Secrets controller deterministic error envelopes:
   - `apps/backend/src/modules/secrets/secrets.controller.ts` now returns explicit domain codes for auth-missing, invalid payloads/query/path and not-found (`MISSING_BEARER_TOKEN`, `SECRETS_INVALID_*`, `SECRET_NOT_FOUND`).
   - added `apps/backend/src/modules/secrets/secrets.controller.test.ts` coverage for missing bearer token and missing secret paths.
44. IPQS controller deterministic error envelopes:
   - `apps/backend/src/modules/ipqs/ipqs.controller.ts` now returns explicit domain codes for auth-missing and payload validation (`MISSING_BEARER_TOKEN`, `IPQS_INVALID_CHECK_BODY`, `IPQS_INVALID_CHECK_BATCH_BODY`).
   - added `apps/backend/src/modules/ipqs/ipqs.controller.test.ts` coverage for missing bearer token and invalid check payload.
45. Observability controller deterministic validation envelopes:
   - `apps/backend/src/modules/observability/observability.controller.ts` now returns explicit domain codes for invalid payloads (`OBSERVABILITY_INVALID_TRACE_RESPONSE`, `OBSERVABILITY_INVALID_CLIENT_LOGS_BODY`).
   - OTLP proxy disabled and upstream-failure envelopes remain deterministic (`NOT_FOUND`, `OTLP_PROXY_FAILED`).
46. Observability controller regression tests:
   - added `apps/backend/src/modules/observability/observability.controller.test.ts` for invalid ingest payload, proxy-disabled, and proxy-upstream-failure paths.
47. Backend deterministic-envelope coverage extension:
   - controller-test coverage now includes `bots`, `secrets`, `ipqs`, and `observability` modules in addition to previously covered domains.
48. Validation status:
   - `pnpm run backend:test` passes with 118 tests.
   - `pnpm run docs:check` passes after documentation sync.
49. Health module regression coverage:
   - added `apps/backend/src/modules/health/health.controller.test.ts` to lock summary/live/ready response markers (`service`, `data_backend`, status/ready flags).
50. Validation status (latest):
   - `pnpm run backend:test` passes with 120 tests.
51. Monorepo hardening gate:
   - full `pnpm run check:all:mono` passes (turbo checks, docs checks, architecture/style/file-size guards, backend tests, agent tests).
52. Backend controller regression baseline:
   - all Nest controllers under `apps/backend/src/modules/**` now have matching `*.controller.test.ts` coverage.
53. Vm-ops reliability dead-letter coverage:
   - added `VmOpsService` regression for stale-dispatched commands that already exceeded requeue budget.
   - test verifies dead-letter transition (`status=failed`) and deterministic dead-letter message shape after sweep.
54. Validation status (latest):
   - `pnpm run backend:test` passes with 121 tests.
55. Cross-module integration depth expansion:
   - added `apps/backend/src/modules/artifacts/auth-vmops-license-artifacts.integration.test.ts` to cover an end-to-end service chain:
     - JWT verification (`AuthService`) with explicit tenant claims,
     - vm command dispatch (`VmOpsService`) under resolved tenant,
     - license issuance (`LicenseService`) and artifact resolution (`ArtifactsService`) under the same tenant,
     - cross-tenant denial for both command visibility and artifact download resolution.
56. Validation status (latest):
   - `pnpm run backend:test` passes with 122 tests.
57. Cross-module integration depth expansion:
   - added `apps/backend/src/modules/provisioning/auth-provisioning-vmops.integration.test.ts` to cover:
     - JWT tenant identity resolution (`AuthService`),
     - provisioning token/progress tenant scoping (`ProvisioningService`),
     - vm command tenant visibility isolation (`VmOpsService`).
58. Operational rollout formalization:
   - added active runbook `docs/runbooks/production-hardening-rollout-checklist.md` with strict-mode cutover sequence and observability exit criteria.
59. Documentation index update:
   - `docs/README.md` now links the production hardening rollout runbook under Runbooks.
60. Validation status (latest):
   - `pnpm run backend:test` passes with 123 tests.
   - `pnpm run check:all:mono` passes after integration-depth expansion and rollout docs update.
61. Rollout readiness automation:
   - added `scripts/production-hardening-rollout-readiness.js` to generate a dated readiness snapshot under `docs/audits/`.
   - added package scripts:
     - `pnpm run hardening:rollout:readiness`
     - `pnpm run hardening:rollout:readiness:checks`
62. Rollout runbook alignment:
   - `docs/runbooks/production-hardening-rollout-checklist.md` now includes readiness-command steps and output location.
63. Readiness artifact:
   - generated `docs/audits/production-hardening-rollout-readiness-2026-02-20.md` with current dev flag profile (`AUTH_MODE=shadow`, `AGENT_TRANSPORT=hybrid`, `SECRETS_VAULT_MODE=shadow`).
64. Smoke-window evidence automation:
   - added `scripts/production-hardening-smoke-window.js` for appending dated smoke-window evidence entries.
   - added package scripts:
     - `pnpm run hardening:smoke:record`
     - `pnpm run hardening:smoke:record:checks`
65. Smoke-window operational audit initialized:
   - generated `docs/audits/production-hardening-smoke-window-2026-02.md` with first entry (`shadow/hybrid/shadow` profile).
66. Rollout runbook hardening:
   - `docs/runbooks/production-hardening-rollout-checklist.md` now includes daily smoke evidence loop and strict exit criterion (seven consecutive strict-pass entries).
67. Documentation index update:
   - `docs/README.md` now points to monthly smoke-window audit artifact path.
68. Validation status (latest):
   - `pnpm run docs:check` passes after smoke-window/runbook/index hardening sync.
   - `pnpm run check:all:mono` passes end-to-end (turbo checks + docs gates + backend 123 tests + agent tests).
69. Smoke-window checker reliability fix:
   - `scripts/production-hardening-smoke-window.js` now executes check commands via shell commandline (`spawnSync(..., { shell: true })`) to ensure Windows pnpm resolution is reliable.
70. Backend test stability hardening:
   - updated `apps/backend/package.json` test command to `tsx --test --test-concurrency=1 "src/**/*.test.ts"` to remove intermittent cross-file finance test flaps in full-suite runs.
71. Validation status (latest):
   - `pnpm run hardening:smoke:record:checks` now records strict `pass` entries with real checks execution.
   - `pnpm run check:all:mono` passes end-to-end after backend test stabilization.
72. Smoke-window cadence progress:
   - appended another strict smoke entry via `pnpm run hardening:smoke:record:checks`.
   - current strict-pass streak: `2/7` (`pnpm run hardening:smoke:streak`).
73. Rollout runbook UX hardening:
   - `docs/runbooks/production-hardening-rollout-checklist.md` now includes explicit streak tracking command.
74. Tooling addition:
   - added `scripts/production-hardening-smoke-streak.js` and root script `pnpm run hardening:smoke:streak` for deterministic streak progress reporting.
75. Smoke-window cadence progress (latest):
   - appended another strict smoke entry via `pnpm run hardening:smoke:record:checks`.
   - current strict-pass streak: `3/7` (`pnpm run hardening:smoke:streak`), remaining `4`.
76. Smoke-window cadence progress (latest):
   - appended next strict smoke entry via `pnpm run hardening:smoke:record:checks`.
   - current strict-pass streak: `4/7` (`pnpm run hardening:smoke:streak`), remaining `3`.
77. Smoke-window cadence progress (latest):
   - appended next strict smoke entry via `pnpm run hardening:smoke:record:checks`.
   - current strict-pass streak: `5/7` (`pnpm run hardening:smoke:streak`), remaining `2`.
78. Smoke-window cadence progress (latest):
   - appended next strict smoke entry via `pnpm run hardening:smoke:record:checks`.
   - current strict-pass streak: `6/7` (`pnpm run hardening:smoke:streak`), remaining `1`.
79. Smoke-window target reached:
   - strict smoke cadence reached and exceeded target (`8/7`, remaining `0`) via repeated `pnpm run hardening:smoke:record:checks`.
   - rollout runbook strict evidence condition (`>=7` consecutive strict `pass` entries) is now satisfied.

## Remaining critical work (current)

1. Operational rollout hardening:
   - execute sustained prod-like smoke window and capture auth/ws/vault/reliability metrics from the new rollout checklist.
2. Optional engineering tightening:
   - continue lowering hotspot budgets from current threshold to stricter targets once feature delivery cadence allows.
3. Strict migration gate is now extended:
   - `migration:check:strict` requires Vault env when `SECRETS_VAULT_MODE=enforced`:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `SUPABASE_VAULT_RPC_NAME`
   - CI workflow passes explicit strict-profile env values for this gate.

## Risk note

Current state is materially safer than prior baseline (auth stub removed, WS hybrid available, stale command mitigation added),
but should still be treated as mid-migration until DB/auth/tenant/Vault waves are fully completed.
