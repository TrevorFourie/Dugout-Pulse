# Backup / recovery changes (copy the files in `src/` over your project's `src/`)

No package.json changes. No new dependencies.

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
