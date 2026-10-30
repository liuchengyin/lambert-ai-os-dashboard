# 画master V1 · X6 isolated drawing canvas

## User request
- Keep original logistics knowledge canvas and every existing tab, dataset, saved draft, published version and branch metadata intact.
- Add a new tab named **画master** to experiment with mature AntV X6.
- DeepSeek Flash audit bounded to new pure model + regression.
- Preview only, no automatic production release.

## Architecture
- Read-only source: published data from existing logistics version envelope.
- The existing keys lambert_logistics_knowledge_v1 and lambert_logistics_versions_v1 must never be written by master.
- Separate owner-scoped local key: lambert_logistics_master_v1, used by window.LambertPrivateStorage.
- Master stores only XY positions, notes, speculative links and optional future presentation state, not duplicate business payloads.
- Existing actual business branches and exceptions are projections, not editable in master; array order is not proof of real trigger relationship.
- New manually created links have status hypothesis (待核实), never become real EDI or business links.
- Prevent overwriting unsaved master changes when legacy published source advances.
- Read-only inspector of operation, triggers, infrastructure, data sources, SLA and tasks.
- Version-pinned local AntV X6 2.18.1 UMD, with upstream license; no runtime CDN.
- No account migration, database/API writes or data reset.

## First pass
New tab 画master, real X6 drag/zoom/pan, module and stage headings, legacy normal/error branches, independent note cards and speculative links, panel for viewing node metadata, scope dropdown, isolated save, export, manual reset/refresh.

## Verification
- Pure model tests source immutability, stable IDs, stage/branch projection, malformed data fail-closed, isolated writes.
- Chromium E2E tests native X6 loaded locally, original process preserved, node/edge rendering, note persistence after refresh, raw old data bytes unchanged, old process navigation.
- DeepSeek Flash one bounded review with exact usage, actionable fixes.
- Preview PR; production untouched until explicit authorization.
