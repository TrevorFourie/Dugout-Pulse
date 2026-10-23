# Dugout Pulse SQLite Migration — CP0 Baseline

Status: source inventory started; runtime behaviour not yet verified.
Target branch: `main`.
Migration order: CP0 → CP1 → CP2 → CP3 → CP4 → CP5 → CP6 → CP7.
Build policy: do not trigger builds; the maintainer performs local build/runtime testing.

## Guardrails

- Keep the original `Migrate-Data/dugout-pulse-backup-2026-10-23.json` unchanged.
- Do not replace the app's current persistence until browser and native SQLite adapters, import verification, and recovery safeguards have been proven.
- Preserve IDs, play order, game/player/team relationships, settings, scheduled games, opposition teams, saved/hidden lists, setup completion, logo library entries and image bytes.
- Do not clear or reinterpret legacy `localStorage` keys during migration.
- A failed database open, migration, import, or write must not silently display empty data or claim a save succeeded.
- Keep Chrome/Vite as the browser test path; no native build is required for Chrome testing.
- All source changes are made directly on `main`; no branch creation or switching.

## Stack and initial platform decision

The repository currently uses React 19, TypeScript, Vite 8 and Capacitor 7. The agreed direction is `@capacitor-community/sqlite` with the `jeep-sqlite` browser adapter, using a shared application repository API. Browser storage is backed by IndexedDB through jeep-sqlite; writes must use the plugin's explicit persistence/close mechanisms as documented by the plugin. Native Android uses the plugin's native SQLite implementation.

Official reference documentation:
- https://github.com/capacitor-community/sqlite
- https://github.com/capacitor-community/sqlite/blob/master/docs/Web-Usage.md
- https://github.com/capacitor-community/sqlite/blob/master/docs/API.md

Dependency versions must match Capacitor 7 and be added with a reproducible lockfile. Do not select the latest major version blindly.

## Persistence surfaces identified in source

### Main GameContext state

`src/context/gameContextDefaults.ts` defines these current keys:

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

Primary flow:
- `src/context/GameContext.tsx` owns React state and first-time setup detection.
- `src/context/useGameRestore.ts` loads persisted state, performs legacy-array reconciliation, and coordinates recovery readiness.
- `src/context/useGamePersistence.ts` persists state changes after recovery checkpoints.
- `src/context/gameStorageSafety.ts` provides protected storage writes and pre-mutation snapshots.
- `src/context/useGameDataManagement.ts` handles JSON import and destructive reset safeguards.

### Additional persistent surfaces requiring separate decisions

- `src/context/recoveryJournal.ts`: Capacitor Filesystem recovery checkpoints, index, logo file handling and retention. This must not be treated as ordinary application data or casually redirected into browser storage.
- `src/utils/fullBackup.ts`: full JSON backup reads main keys plus extras and logo library/image data.
- `src/utils/backupFormat.ts`: version-3 integrity/checksum validation; keep format compatibility.
- `src/utils/teamLogoLibrary.ts`: logo library persistence and references.
- `src/utils/errorDiagnostics.ts`: diagnostic events currently use their own local/session storage paths and must remain available if the primary database fails.
- `src/context/useGameRestore.ts`: legacy keys are merged by ID and deliberately not deleted. Preserve this non-destructive behaviour until a separately verified migration is implemented.
- Additional direct storage users still need a complete repository-wide search and classification before CP0 can be marked complete.

## Source-confirmed risks / constraints

1. The current write path creates a verified recovery checkpoint before each persisted state transition. SQLite migration must replace this with transaction-aware recovery; simply swapping `localStorage.setItem` for SQL would break the intended safety contract.
2. Backup import currently writes some data to storage and then publishes state. It also imports logo images and keeps automatic persistence paused after a partial mutation failure. This sequencing needs a database transaction plus a preserved pre-import recovery point.
3. Backup export reads storage directly. Until export is routed through the repository, it could export stale or incomplete data after the primary-store switch.
4. First-time-user detection reads `localStorage` synchronously during React state initialization. Database readiness is asynchronous, so startup gating must be designed explicitly rather than adding an asynchronous call inside that initializer.
5. Logo library and recovery code use Capacitor Filesystem. Browser and Android paths differ; logo identity and data must be preserved while platform-specific file URIs remain valid.
6. The browser adapter's SQLite changes are persisted to IndexedDB by explicit store/close operations. Test committed writes across page reload and full Chrome restart, not only React re-render.

## Backup baseline from the migration tracker

Expected source backup contents to verify against the actual supplied file during CP0/CP3:
- 3 games
- 93 recorded plays
- 1 profile containing 1 team
- 2 upcoming games
- 6 opposition teams
- 6 logo library entries
- 6 embedded logo files
- Version 3 format and valid integrity checksum
- No live-game record in this supplied backup

Counts alone are not sufficient. Compare stable IDs, play order, relationships, settings, extras, and logo references. The source JSON must remain unchanged.

## Acceptance gates

- CP0 closes only after all persistent read/write paths, key schemas, platform APIs and affected consumers have been inventoried, and the source backup has been checked without modification.
- CP1 closes only after compatible dependency versions and a common repository contract are committed, and browser/native database open-write-close-reopen smoke tests have evidence.
- CP2/CP3 must pass schema, transaction, complete import and read-back comparisons before CP4 switches app persistence.
- CP4 must preserve normal scoring, resume/reopen flows, profiles, teams, settings, schedules and saved lists.
- CP5 must preserve complete JSON export/restore, logos, recovery, reset safeguards and diagnostics.
- CP6 Chrome checks are performed by the maintainer; do not mark any runtime test as passed based on source inspection.
- CP7 requires final diff review, committed-file read-back and an explicit rollback procedure.

## Evidence status at this commit

- Repository instructions read: yes.
- Main storage hooks and related backup/recovery/logo/diagnostic entry points inspected: partial; full call-site inventory still required.
- Source backup verified in this work session: not yet.
- Dependencies changed: no.
- App persistence changed: no.
- Build triggered: no.
- Chrome runtime test: not run.
- Native runtime test: not run.
