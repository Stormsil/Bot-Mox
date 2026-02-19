# Ownership Map

Status: Active
Owner: Platform Architecture
Last Updated: 2026-02-19
Applies To: Active docs and architecture governance
Non-goals: HR ownership structure
Related Checks: `docs:check`, `check:all:mono`

## Domain Ownership Roles

1. Frontend architecture owner: responsible for FSD boundaries, styling system, query/model hygiene.
2. Backend architecture owner: responsible for Nest module boundaries, DI rigor, contract compliance.
3. Docs owner: responsible for canonical docs freshness, metadata, and anti-drift process.
4. Platform owner: responsible for CI gates, quality scripts, and enforcement automation.

## Update Cadence

1. Canonical docs: update in every architecture-impacting PR.
2. Governance docs (standards/workflow): monthly review.
3. Baseline hygiene audit: quarterly refresh minimum.

## RU Notes

1. За каждый слой есть ответственный role-owner; без владельца документ не считается актуальным.
