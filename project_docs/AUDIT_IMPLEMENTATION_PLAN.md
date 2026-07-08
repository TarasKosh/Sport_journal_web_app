# Audit Implementation Plan

Branch: `feat/audit-plan-implementation`  
Source: multi-aspect audit (2026-07-08)

## Goals

Fix multi-device data integrity and wire incomplete settings so the product matches the domain model.

## Review loop (code-reviewer)

| Round | Overall | All ≥ 8? |
|-------|---------|----------|
| 1 | 7/10 | No |
| 2 (after fixes) | **8/10** | **Yes** |

---

## Plan items

### P0 — Data integrity (sync-safe)

| # | Item | Status |
|---|------|--------|
| 1 | Soft-delete helpers + cascade delete service | **done** |
| 2 | Replace hard deletes in UI with soft-delete | **done** |
| 3 | Filter `!deletedAt` in all live queries / stats | **done** |
| 4 | Settings LWW merge (`updatedAt` on settings) | **done** |
| 5 | Snapshot schema validation on import/pull | **done** |
| 6 | ConflictLog write on LWW overwrite | **done** |

### P1 — Product completeness

| # | Item | Status |
|---|------|--------|
| 7 | Apply theme (dark / light / system) | **done** |
| 8 | massUnit + weightStep in set entry UI | **done** |
| 9 | defaultRPEType (RPE/RIR) wired in SetItem + Settings | **done** |
| 10 | Toast notifications instead of alert where practical | **done** |

### P2 — Quality

| # | Item | Status |
|---|------|--------|
| 11 | Unit tests: filters, mass, snapshot validation | **done** |
| 12 | CI: run `npm test` | **done** |

---

## Design notes

### Soft-delete

- Set `deletedAt = Date.now()` and `updatedAt = Date.now()`.
- Never hard-delete user entities except full DB reset (`db.delete()`).
- Cascade: workout → workoutExercises → sets (all soft).
- Sync merge keeps remote if newer `updatedAt`; soft-deleted records propagate via LWW.
- Snapshots still include soft-deleted rows so peers receive deletions.

### Settings

- `updatedAt` on `Settings`.
- Merge: keep newer by `updatedAt`; missing treated as `0`.

### Snapshot validation

- Require `schemaVersion === 3`, `deviceId`, `exportedAt`, `data` with required arrays.
- Reject invalid JSON shape before merge (File import + Drive pull).

### Key files

- `src/services/data/softDelete.ts`
- `src/services/sync/validateSnapshot.ts`
- `src/services/sync/SyncManager.ts`
- `src/hooks/useTheme.ts`, `useSettings.ts`
- `src/utils/mass.ts`, `entityFilters.ts`
- `src/components/common/Toast.tsx`
