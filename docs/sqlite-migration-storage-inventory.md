# SQLite Migration — CP1 Storage Inventory

Status: **audit in progress; not yet safe to switch the app to SQLite**.

This document records the actual persistence surfaces inspected on `main`. It is a migration checklist, not evidence that SQLite integration or runtime tests have passed.

## Platform and dependency compatibility

- App stack: React 19, TypeScript 7, Vite 8, Capacitor 7.
- Approved SQLite stack: `@capacitor-community/sqlite` 7.x, `jeep-sqlite` browser adapter, and `sql.js`.
- The plugin's current latest major is 8.x; do not install it into this Capacitor 7 app without a deliberate platform upgrade.
- Web setup requires the `jeep-sqlite` custom element, `initWebStore()`, persistence via `saveToStore()`, and the `sql-wasm.wasm` asset under `public/assets`. This needs verification in the actual Vite/Chrome runtime.
- No SQLite dependencies have been added yet. `package.json` and `package-lock.json` must be updated consistently; do not hand-edit only the root dependency list.

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

1. Install the Capacitor 7-compatible dependency set and update the lockfile with the package manager; do not switch runtime storage yet.
2. Build a typed SQLite repository with versioned schema and transaction boundaries.
3. Implement an idempotent importer that reads and validates every supported existing key, writes into a transaction, reads back and compares counts/content, and only then records a migration-complete marker. Do not delete legacy values.
4. Gate app startup on database initialization/migration before publishing GameContext state; if SQLite is unavailable or validation fails, show a recoverable error and retain source data rather than starting with empty defaults.
5. Migrate backup/import/reset, logos, recovery, and diagnostics as a coordinated set. Preserve the current recovery checkpoint requirement and the existing JSON backup format.
6. Test on Chrome with a copied browser profile or disposable test data first. Verify first import, reload persistence, live-game resume, scoring edits/undo, profile/settings changes, schedule/team/logo records, backup export/import, interrupted/failed migration, and old-key retention.
7. Only after Chrome evidence should native platform integration be considered complete.

## Baseline backup

The repository backup `Migrate-Data/dugout-pulse-backup-2026-10-23.json` was previously re-fetched and verified against its v3 FNV-1a checksum: length 246350, checksum `d4bb1475`. It contains 3 games, 93 plays, 1 profile, 2 upcoming games, 6 opposition teams, and 6 logo-library entries/files. This is a reference baseline, not a replacement for checking the user's actual local browser data.

## Current evidence level

- Source inspected: yes, for the paths listed above.
- Backup integrity: verified for the committed repository backup.
- SQLite code integrated: no.
- Dependency lock updated: no.
- Static checks: not run.
- Build: intentionally not run per repository rules.
- Chrome runtime/regression tests: not run.

Do not describe the migration as ready to test until the dependency lock, startup gating, safe importer, and persistence/backup/recovery integration are implemented and verified.
