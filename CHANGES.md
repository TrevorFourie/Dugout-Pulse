# Backup / recovery changes (copy the files in `src/` over your project's `src/`)

No package.json changes. No new dependencies.

## Update 5 (friendly errors for users, TRUE errors in the diagnostic report)
Rule applied everywhere below: the user sees plain language + "Reference: DP-XXXXXX" + where to
find the report (Settings > Data & About > Offline Diagnostics). The real technical error is
recorded in the diagnostic report under that same reference.
- New utils/userMessages.ts: reportFailure() (records true error, returns friendly text),
  explainFailure(), UserFacingError (messages written for users, e.g. "Unsupported image format").
  Adds plain hints for low storage space / permission problems.
- errorDiagnostics: new categories (backup_export, backup_import, recovery_checkpoint,
  recovery_restore, data_reset, logo_library, team_logo_migration, storage_write). Before,
  anything not whitelisted was labelled "unknown" (this included existing 'storage_write'
  events). True message length kept up to 400 chars (was 240). getLastDiagnosticReference() added.
- recoveryJournal: checkpoint failures were swallowed (return false, console only); the true
  error is now recorded. Restore failures no longer show raw error text to the user.
- Export, import, reset-blocked, logo add/delete/migrate, settings recovery and the startup
  recovery screen (whose catch blocks recorded nothing) now use friendly text + reference.
- Tests: utils/userMessages.test.ts (6 tests). 56 pass in total.

## Update 4 (reset -> setup screen)
- FIXED: "Reset All Local Data" never returned the user to the setup screen. isFirstTimeUser was
  only read at startup, so after a reset it stayed false. resetAllData now sets it back to true,
  and App closes Settings so the setup screen shows.
- FIXED: saved tournaments/seasons/age groups/opponents stayed in memory after a reset and were
  written straight back to storage; they are now cleared too.
- resetAllData now returns Promise<boolean>; Settings shows "Reset was not applied..." if the
  safety checkpoint could not be created (previously it always said "All data has been reset").
- Reset confirmation text updated (backups now include logos).
- Not changed: logo image files are still left on the phone after a reset (the library entries are cleared).

## Update 3 (restore modal + crash fixes)
- After a successful restore (Settings OR first-run setup screen) the app goes to the
  Dashboard and shows a "Restore successful" modal (amber "completed with a warning" if
  something could not be restored, e.g. a missing logo). ConfirmationModal gained a
  'success' variant.
- FIXED crash: TeamsSettingsPanel used 5 undeclared edit-state variables (editing a team crashed).
- FIXED crash: VenuesSettingsPanel used `X` without importing it.
- FIXED: recoveryJournal passed 'utf8' strings where Capacitor's Encoding enum is expected.
- FIXED: SetupScreen (first-run "restore backup") called the async importJsonData without
  `await`, so it read success/message from a pending Promise and showed a blank error even
  though the import ran in the background.
- FIXED crashes: missing lucide imports - `Shield` in OpponentCombobox and SetupTeamStep,
  `Calendar` in SetupSeasonStep (ReferenceError when those screens rendered).
- Not changed: GameDetailsModal type mismatch (setLineupSpot typed number-only; type-only).

## Update 2 (logo fix)
Fixed: inline (data-URL) logos were being replaced by a hash and their image lost on
export, and dropped again on import. v3 export now keeps inline logos inside the data,
and v3 import keeps them (png/jpeg/webp data URLs only). Also modified: utils/logoBackup.ts.
Tests: 50 total pass (16 in backupFormat.test.ts).

## What changed
- Export (backup format v3) now contains EVERYTHING needed to rebuild after a wipe:
  games, profiles, settings, upcoming games, opposition teams, saved/hidden
  tournaments/seasons/age groups, saved opponents, setup-completed flag,
  the logo library AND the actual logo images (base64), plus an integrity block
  (length + FNV-1a checksum over the whole file).
- Import validates BEFORE changing anything: rejects damaged/truncated/edited v3
  files, unrelated files, newer-format files, unsafe logo file names, and
  backups missing images they refer to. Legacy v1/v2 files still import
  (reported as "older backup without an integrity check").
- Import restores logo images (written then read back and compared), merges the
  logo library (local logos not in the backup are kept), restores preset lists,
  and marks setup complete so the first-run screen cannot overwrite a restored profile.
- Export no longer claims success it cannot know: a dismissed share sheet is
  reported as "not saved"; success wording tells the user to save the file
  outside the app. "Last backup" is recorded only when the file was handed off.
- Reminders: Settings > Data shows last-backup age (amber when due), and a
  dismissible banner (snoozes 3 days) appears after 14 days / never exported.
  Hidden during a live game and first-time setup.

## Files
New:      utils/backupFormat.ts, utils/fullBackup.ts, utils/backupReminder.ts,
          utils/backupFormat.test.ts, components/BackupReminderBanner.tsx
Modified: utils/logoBackup.ts, utils/backup.ts, utils/saveFile.ts, context/useGameDataManagement.ts,
          context/GameContext.tsx (passes setSavedOpponents), context/recoveryJournal.ts
          (only added `export` to readLogoFileAsBase64 / writeLogoFiles),
          components/SettingsModal.tsx, components/settings/DataManagementPanel.tsx, App.tsx

## Tests
npx tsx --test src/utils/backupFormat.test.ts   (13 tests, all pass)
Existing scoringEngine tests still pass (47 total).
