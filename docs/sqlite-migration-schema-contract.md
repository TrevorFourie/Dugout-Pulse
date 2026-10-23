# SQLite schema and migration contract

Status: design prepared; implementation and runtime verification remain outstanding.

## Compatibility pin

Use `@capacitor-community/sqlite@7.0.3` with the app's existing Capacitor 7 line. The upstream 7.0.3 package declares peer compatibility with `@capacitor/core >=7.0.0` and depends on `jeep-sqlite ^2.7.2`. Do not use plugin 8.x unless Capacitor is deliberately upgraded in a separate approved task.

The app must use the same repository API on Chrome/Vite and native Capacitor platforms. The browser implementation uses `jeep-sqlite` and its IndexedDB-backed store. Native platforms use the plugin's native implementation. A single repository module should own initialization and connection lifecycle; components/hooks must not each open connections independently.

## Proposed schema

Use a versioned schema and retain original serialized JSON for each domain record during the first migration. The goal of the first pass is storage-engine migration, not data-model redesign.

- `app_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)` — schema version, migration state, source fingerprint, completion timestamp.
- `app_state(key TEXT PRIMARY KEY, value_json TEXT NOT NULL)` — singleton state values such as settings, live-game state, edit/reopen IDs, and setup-completed state.
- `games(id TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT)` — saved games; retain the full current game payload, including play history, so scoring history is not flattened or reinterpreted.
- `profiles(id TEXT PRIMARY KEY, value_json TEXT NOT NULL)` — profiles and their nested teams as currently represented.
- `named_lists(key TEXT PRIMARY KEY, value_json TEXT NOT NULL)` — saved/hidden tournaments, age groups, seasons, and opponent-name lists.
- `opposition_teams(id TEXT PRIMARY KEY, value_json TEXT NOT NULL)` — opposition-team records.
- `upcoming_games(id TEXT PRIMARY KEY, value_json TEXT NOT NULL)` — scheduled games.
- `logo_library(id TEXT PRIMARY KEY, value_json TEXT NOT NULL)` — logo metadata; image bytes remain in the existing Capacitor Filesystem paths in the initial release.
- `legacy_values(key TEXT PRIMARY KEY, value TEXT NOT NULL)` — exact original string values for every imported source key, retained as a compatibility/recovery copy.
- `diagnostics(id TEXT PRIMARY KEY, value_json TEXT NOT NULL)` — only if the existing diagnostics flow is deliberately integrated; never merge diagnostic state into game data.

IDs must be derived from validated existing records. Records without a valid stable ID must remain in `legacy_values` and trigger a migration warning; never invent an ID that could merge unrelated historical records.

## Import contract

1. Initialize the adapter and open the database; apply schema changes in a transaction.
2. Read source keys without deleting or rewriting them. Parse and validate each known domain. Preserve unknown app keys as raw values.
3. Write every source value and its typed projection within one database transaction. Use bound SQL parameters for values.
4. Read back all rows and compare canonical serialized payloads and per-domain counts with the source. Check games and play counts, profiles, schedules, opposition teams, logo metadata, live-game state, and settings.
5. Persist the migration marker only after validation succeeds and the web store save succeeds on web.
6. Keep the old localStorage values indefinitely during the first test release. Do not enable destructive cleanup in this migration.
7. On any error, roll back, do not mark migration complete, keep legacy data untouched, block writes to the new repository, and surface an actionable failure instead of silently falling back to empty defaults.
8. Make reruns idempotent. If a previous attempt wrote some rows but did not complete, a retry must validate/reconcile from the preserved source values rather than duplicate records.

## Startup and write ordering

- Startup must await database initialization/migration before GameContext restores domain state or enables persistence.
- The synchronous first-time setup read in GameContext and synchronous pre-React theme/diagnostics reads in `index.html` are existing early-start paths. Do not casually convert them to async reads; either keep their legacy read path until a separately verified handoff exists, or deliberately redesign and test their startup ordering.
- Every domain write should be committed transactionally, then flushed to the web store on Chrome. Do not report persistence success before both steps resolve.
- Do not run the existing localStorage persistence writer and a new SQLite writer concurrently as independent authorities; that risks split-brain state. Define a single cutover gate.
- JSON backup format v3 and checksum behavior remain unchanged for this first migration. Export must read a consistent repository snapshot and include logo bytes using the current backup contract. Import must validate the full backup and create the existing verified recovery checkpoint before changing either database or logo files.
- Recovery journal files and logo image files remain under the current Capacitor Filesystem design initially; moving them is a separate migration with its own verification.

## Chrome first-test acceptance

- Clean test profile: app starts and creates schema without touching any unrelated IndexedDB database.
- Existing-data profile: source backup/legacy state is imported once, counts and payloads compare exactly, and old keys remain present.
- Reload: saved games, live-game resume prompt/state, settings, profiles, schedules, opponents, and logo metadata persist.
- Scoring regression: add/edit/delete/undo/reorder plays and save/reopen a game; check score and historical plays before/after reload.
- Backup: export and verify v3 checksum; import a copy; reject a damaged checksum without mutating current data.
- Failure injection/manual simulation: failed database open, failed transaction, failed web-store flush, and invalid legacy JSON never set migration-complete or clear source keys.
- Native integration is not certified by Chrome testing and requires a later device pass.

## Current implementation status and blocker

- Dependency commit: `12bdff1` added `@capacitor-community/sqlite@7.0.3` and `jeep-sqlite@2.8.0` with the locally generated lockfile.
- Source foundation: `src/storage/sqliteDatabase.ts` is committed. It creates the initial tables transactionally, checks the schema version, holds one shared connection, and flushes web transactions through `saveToStore`.
- The SQLite module is intentionally not connected to GameContext yet. Existing localStorage remains authoritative; no user data is imported, changed, or removed by this module.
- The web adapter requires `sql-wasm.wasm` at `public/assets/sql-wasm.wasm`. This asset has not yet been copied into the repository.
- Static checks and browser/native open-write-close-reopen smoke tests remain unverified. The assistant cannot run npm or the app in the user's local checkout, and builds must not be triggered.

Next gate: pull the source commit on the user's local `main`, copy the installed `sql.js` WASM asset to `public/assets/sql-wasm.wasm`, run the approved non-build TypeScript check, then perform a dedicated browser smoke test before beginning the legacy-data importer. Do not claim the app is ready for normal Chrome testing until these checks and the startup/migration safeguards are in place.
