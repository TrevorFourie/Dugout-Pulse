# SQLite Migration — CP1 Storage Inventory

Status: **Guarded SQLite startup hydration and cutover are source-committed; backup/reset/recovery coordination and runtime verification remain outstanding**.

This document records the actual persistence surfaces inspected on `main`. It is a migration checklist, not evidence that SQLite integration or runtime tests have passed.

## Platform and dependency compatibility

- App stack: React 19, TypeScript 7, Vite 8, Capacitor 7.
- Approved SQLite stack: `@capacitor-community/sqlite` 7.x, `jeep-sqlite` browser adapter, and `sql.js`.
- The plugin's current latest major is 8.x; do not install it into this Capacitor 7 app without a deliberate platform upgrade.
- Web setup requires the `jeep-sqlite` custom element, `initWebStore()`, persistence via `saveToStore()`, and the `sql-wasm.wasm` asset under `public/assets`. The actual Vite/Chrome runtime has passed schema initialization, write/read-back, reload persistence, and temporary-marker cleanup checks.
- Dependencies were installed locally and committed together in `package.json` and `package-lock.json` by commit `12bdff1` (`@capacitor-community/sqlite@7.0.3`, `jeep-sqlite@2.8.0`). The resolved `jeep-sqlite` version satisfies the plugin's `^2.7.2` dependency range.

## Existing storage surfaces

### GameContext state keys

From `src/context/gameContextDefaults.ts`:

- `baseball_hub_games_v1`
- `baseball_hub_live_game_v1`
- `baseball_hub_editing_game_id_v1`
- `baseball_hub_reopened_game_id_v1`
- `baseball_hub_profiles_v1`
- `baseball_hub_settings_v1`
- `baseball_hub_saved_opponents_v1`
- `baseball_hub_saved_tournaments_v1`
- `baseball_hub_saved_age_groups_v1`
- `baseball_hub_saved_seasons_v1`
- `baseball_hub_hidden_tournaments_v1`
- `baseball_hub_hidden_age_groups_v1`
- `baseball_hub_hidden_seasons_v1`
- `baseball_hub_setup_completed_v1`

### Additional app data

- `dugoutPulse.upcomingGames.v1` — scheduled games.
- `dugoutPulse.oppositionTeams.v1` — opposition team records.
- `dugoutPulse.logoLibrary.v1` plus image files in the app's file storage.
- `dugoutPulse.recoverySnapshot.v1`, `dugoutPulse.recoverySnapshot.previous.v1`, and `dugoutPulse.beforeRecovery.v1` — recovery data.
- `dugoutPulse.diagnostics.v1` and session fallback diagnostics — diagnostic data; startup HTML reads these before React is loaded.

### Existing write and restore safeguards

- `src/context/useGamePersistence.ts` takes a verified recovery checkpoint before each state write and blocks automatic persistence when checkpointing or writing fails.
- `src/context/useGameRestore.ts` merges legacy game/profile arrays by ID, retains legacy keys, validates scheduled games/opposition teams, and pauses writes on malformed data.
- `src/context/recoveryJournal.ts` uses Capacitor Filesystem and stores image files separately from metadata.
- `src/utils/fullBackup.ts`, `src/utils/backupFormat.ts`, and `src/context/useGameDataManagement.ts` implement backup, integrity verification, logo restoration, import, and reset.
- `index.html` reads the theme and startup diagnostics synchronously before the React entry module runs. This path cannot depend on an asynchronously opened database without redesigning startup.

## Required migration strategy

1. **Done (source/lockfile only):** install the Capacitor 7-compatible dependency set and commit the package-manager-generated lockfile. Do not switch runtime storage yet.
2. **Source implementation and first runtime checks complete:** add a typed SQLite repository and transactional snapshot importer with versioned schema, exact legacy-value retention, typed projections, read-back checks, and separate snapshot/cutover markers. The user's Chrome import and subsequent typed-projection integrity read both passed; localStorage remained unchanged. Do not delete legacy values.
3. **Source wired, not runtime verified:** GameContext waits for startup hydration; existing cutover reads SQLite, verifies live state, and repairs the compatibility mirror before app screens mount. First cutover is gated by snapshot verification, a recovery checkpoint, transactional state verification, and a pending/completed marker.
4. Integrate backup import/reset and recovery/diagnostic workflows with SQLite as a coordinated set. Preserve the current recovery checkpoint requirement and the existing JSON backup format.
6. Test on Chrome with a copied browser profile or disposable test data first. Verify first import, reload persistence, live-game resume, scoring edits/undo, profile/settings changes, schedule/team/logo records, backup export/import, interrupted/failed migration, and old-key retention.
7. Only after Chrome evidence should native platform integration be considered complete.

## Baseline backup

The repository backup `Migrate-Data/dugout-pulse-backup-2026-10-23.json` was previously re-fetched and verified against its v3 FNV-1a checksum: length 246350, checksum `d4bb1475`. It contains 3 games, 93 plays, 1 profile, 2 upcoming games, 6 opposition teams, and 6 logo-library entries/files. This is a reference baseline, not a replacement for checking the user's actual local browser data.

## Current evidence level

- Source inspected: yes, for the paths listed above; the repository-wide direct storage inventory remains incomplete.
- Backup integrity: verified for the committed repository backup.
- SQLite foundation: `src/storage/sqliteDatabase.ts` is committed. It defines the initial schema, single-connection lifecycle, transaction helper, and explicit web-store flush. It is not connected to GameContext.
- Repository/importer groundwork: `src/storage/sqliteRepository.ts` audits recognised localStorage values, validates before writing, copies every raw key/value to `legacy_values`, verifies typed projections, and keeps source-snapshot and live-cutover markers separate. `readVerifiedSQLiteSnapshot()` checks source fingerprint, exact source values, and typed projections. Changed pre-cutover source can only be refreshed after verifying the prior snapshot and confirming no live-state write has begun.
- Live persistence and startup wiring: `useGameRestore.ts` now attempts a verified snapshot import and first cutover when no cutover marker exists; after cutover, it reads SQLite state, verifies it, reconciles the local marker, and synchronises the compatibility mirror before GameContext children mount. `useGamePersistence.ts` writes one coherent state transaction after cutover. Scheduled-game and logo metadata writes use SQLite after cutover and report mirror failures without falsely claiming the primary write failed. These paths are source-committed but not typechecked or runtime-verified.
- Dependency lock updated: yes, by commit `12bdff1`.
- Browser WASM asset: present at `public/assets/sql-wasm.wasm`.
- Chrome runtime evidence: schema initialization and 10-table query passed; transaction write/read-back passed; the marker survived page reload; the temporary marker was then removed and verified absent.
- Static checks: not run. Build: intentionally not run per repository rules.
- Actual localStorage snapshot import: runtime call returned audit/import results, the source-key comparison was true, and the snapshot marker was present.
- Typed projection integrity: the user's subsequent `readVerifiedSQLiteSnapshot()` call returned `integrityVerified: true` and `localStorageUnchanged: true`. The console collapsed nested audit/count values, so exact counts were not independently reviewed from the returned output.
- Startup hydration/cutover and conditional write paths are source-committed but not runtime-verified. Backup import/reset coordination, recovery interactions, scoring regression, and native platform checks remain outstanding.

The next user test should wait until the startup gate, live persistence path, backup/recovery integration, and regression checks are implemented as one coherent milestone. Do not describe the migration as ready for normal use before those checks are complete.
