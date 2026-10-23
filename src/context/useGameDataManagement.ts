import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings, Game, PlayerProfile, PlayerTeam } from '../types/baseball';
import { sortGames } from '../utils/stats';
import { collectLocalLogoDataUrls, restoreLocalLogoReferences } from '../utils/logoBackup';
import { readTeamLogoLibrary, readTeamLogoLibraryStrict } from '../utils/teamLogoLibrary';
import { clearAppDataPreservingDiagnostics, getLastDiagnosticReference, recordDiagnosticError } from '../utils/errorDiagnostics';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, STORAGE_KEYS, withTeams } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { protectedStorageSetItem, snapshotBeforeGameWrite } from './gameStorageSafety';
import { createVerifiedRecoveryCheckpoint } from './recoveryJournal';
import { asStringList, verifyBackup } from '../utils/backupFormat';
import { restoreLogosFromBackup } from '../utils/fullBackup';
import { explainFailure, reportFailure } from '../utils/userMessages';
import { isLegacyStorageImportComplete, saveLiveSQLiteState, type SQLiteLiveState } from '../storage/sqliteRepository';

type StateSetter<T> = Dispatch<SetStateAction<T>>;

function readUpcomingGamesForSQLite(): SQLiteLiveState['upcomingGames'] {
  const raw = localStorage.getItem('dugoutPulse.upcomingGames.v1');
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((value) =>
    !!value && typeof value === 'object' && !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { opponent?: unknown }).opponent === 'string' &&
    typeof (value as { date?: unknown }).date === 'string' &&
    ((value as { isHome?: unknown }).isHome === undefined || typeof (value as { isHome?: unknown }).isHome === 'boolean')
  )) {
    throw new Error('Scheduled games could not be validated before backup import.');
  }
  return parsed as SQLiteLiveState['upcomingGames'];
}

interface GameDataManagementOptions {
  games: Game[];
  liveGame: Game | null;
  editingGameId: string | null;
  reopenedGameId: string | null;
  profiles: PlayerProfile[];
  settings: AppSettings;
  oppositionTeams: OppositionTeam[];
  savedOpponents: string[];
  savedTournaments: string[];
  savedAgeGroups: string[];
  savedSeasons: string[];
  hiddenTournaments: string[];
  hiddenAgeGroups: string[];
  hiddenSeasons: string[];
  setGames: StateSetter<Game[]>;
  setLiveGame: StateSetter<Game | null>;
  setEditingGameId: StateSetter<string | null>;
  setReopenedGameId: StateSetter<string | null>;
  setProfiles: StateSetter<PlayerProfile[]>;
  setSettings: StateSetter<AppSettings>;
  setOppositionTeams: StateSetter<OppositionTeam[]>;
  setHiddenTournaments: StateSetter<string[]>;
  setHiddenAgeGroups: StateSetter<string[]>;
  setHiddenSeasons: StateSetter<string[]>;
  setIsFirstTimeUser: StateSetter<boolean>;
  setRestoreFailed: StateSetter<boolean>;
  /** Optional: lets a backup restore the saved-opponent name list. */
  setSavedOpponents?: StateSetter<string[]>;
  /** Optional: cleared on reset so saved lists are not written straight back to storage. */
  setSavedTournaments?: StateSetter<string[]>;
  setSavedAgeGroups?: StateSetter<string[]>;
  setSavedSeasons?: StateSetter<string[]>;
  saveTournament: (name: string) => void;
  saveAgeGroup: (name: string) => void;
  saveSeason: (name: string) => void;
  triggerHaptic: () => void;
}

/** Owns settings updates, backup import/reset, and first-time setup completion. */
export function useGameDataManagement({
  games,
  liveGame,
  editingGameId,
  reopenedGameId,
  profiles,
  settings,
  oppositionTeams,
  savedOpponents,
  savedTournaments,
  savedAgeGroups,
  savedSeasons,
  hiddenTournaments,
  hiddenAgeGroups,
  hiddenSeasons,
  setGames,
  setLiveGame,
  setEditingGameId,
  setReopenedGameId,
  setProfiles,
  setSettings,
  setOppositionTeams,
  setHiddenTournaments,
  setHiddenAgeGroups,
  setHiddenSeasons,
  setIsFirstTimeUser,
  setRestoreFailed,
  setSavedOpponents,
  setSavedTournaments,
  setSavedAgeGroups,
  setSavedSeasons,
  saveTournament,
  saveAgeGroup,
  saveSeason,
  triggerHaptic,
}: GameDataManagementOptions) {
  // Update settings
  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  // Full backup import. Version 3+ backups embed the logo images and carry an integrity check;
  // older backups only hold logo references, which are resolved against images still on this device.
  const importJsonData = useCallback(async (jsonStr: string) => {
    let recoveryCheckpointCreated = false;
    let sqliteCutoverComplete = false;
    let originalSQLiteState: SQLiteLiveState | null = null;
    let sqliteStateMayHaveChanged = false;
    try {
      const parsedData = JSON.parse(jsonStr);
      // Validate before anything is changed: a damaged, truncated or unrelated file is rejected outright.
      const check = verifyBackup(parsedData);
      if (!check.ok) return { success: false, message: check.message };
      if (!(await createVerifiedRecoveryCheckpoint('Before importing a JSON backup'))) {
        return { success: false, message: explainFailure('The restore was not started because the app could not first make a safety copy of your current data. Nothing was changed.', getLastDiagnosticReference() || undefined) };
      }
      recoveryCheckpointCreated = true;
      try {
        sqliteCutoverComplete = await isLegacyStorageImportComplete();
      } catch (error) {
        const marker = localStorage.getItem('dugoutPulse.sqliteCutover.v1');
        if (marker === 'complete' || marker === 'pending') throw error;
        // Before cutover, localStorage remains authoritative.
      }
      if (sqliteCutoverComplete) {
        originalSQLiteState = {
          games,
          profiles,
          settings,
          liveGame,
          editingGameId,
          reopenedGameId,
          setupCompleted: localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETED) === 'true',
          savedOpponents,
          savedTournaments,
          savedAgeGroups,
          savedSeasons,
          hiddenTournaments,
          hiddenAgeGroups,
          hiddenSeasons,
          oppositionTeams,
          upcomingGames: readUpcomingGamesForSQLite(),
          logoLibrary: readTeamLogoLibraryStrict(),
        };
        // Drain any pending context edits before taking the rollback baseline.
        // This makes the recovery target match the state the user currently sees.
        await saveLiveSQLiteState(originalSQLiteState, { includeAuxiliary: true });
        // Logo-file restoration may update SQLite metadata before the full import
        // transaction. If anything later fails, the previous live state is restored.
        sqliteStateMayHaveChanged = true;
      }
      // Restore logo images + library first so logo references in games/profiles resolve below.
      const restoredLogoCount = await restoreLogosFromBackup(parsedData as Record<string, unknown>);
      const localLogos = new Map<string, string>();
      readTeamLogoLibrary().forEach((item) => localLogos.set('logo-ref-v1:' + item.id, 'logo-ref-v1:' + item.id));
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          collectLocalLogoDataUrls(JSON.parse(raw), localLogos);
        } catch {
          // Ignore unrelated non-JSON local storage values.
        }
      }
      const restored = restoreLocalLogoReferences(parsedData, localLogos, { keepInlineImages: check.version >= 3 });
      const data = restored.data as typeof parsedData;

      // Complete all direct local-storage writes before publishing imported state to React.
      // If a write fails, the current in-memory game/profile state remains intact.
      if (!sqliteCutoverComplete && data && Array.isArray(data.upcomingGames)) {
        if (!protectedStorageSetItem('dugoutPulse.upcomingGames.v1', JSON.stringify(data.upcomingGames))) {
          throw new Error('Could not protect storage before importing upcoming games');
        }
      }
      if (!sqliteCutoverComplete && data && Array.isArray(data.oppositionTeams)) {
        if (!protectedStorageSetItem('dugoutPulse.oppositionTeams.v1', JSON.stringify(data.oppositionTeams))) {
          throw new Error('Could not protect storage before importing opposition teams');
        }
      }

      const extras = (data && typeof data === 'object' ? (data as { extras?: Record<string, unknown> }).extras : undefined);
      if (!sqliteCutoverComplete && extras && typeof extras === 'object' &&
          extras.setupCompleted === true && Array.isArray(data.profiles) && data.profiles.length > 0) {
        // A failed setup-flag write must stop the import before the restored state is published.
        if (!protectedStorageSetItem(STORAGE_KEYS.SETUP_COMPLETED, 'true')) {
          throw new Error('Could not protect storage before saving setup completion');
        }
      }

      // When SQLite is authoritative, commit the complete imported state before
      // publishing success. Any earlier logo metadata writes are reconciled back to
      // the previous live snapshot if this operation fails.
      if (sqliteCutoverComplete) {
        const nextGames = data && Array.isArray(data.games) ? sortGames(data.games, 'oldestFirst') : games;
        const nextProfiles = data && Array.isArray(data.profiles) && data.profiles.length > 0
          ? (data.profiles as PlayerProfile[]).map(withTeams)
          : profiles;
        const nextSettings = data && data.settings ? { ...settings, ...data.settings } as AppSettings : settings;
        const nextOppositionTeams = data && Array.isArray(data.oppositionTeams)
          ? data.oppositionTeams as OppositionTeam[]
          : oppositionTeams;
        const extrasObject: Record<string, unknown> = extras && typeof extras === 'object' ? extras : {};
        const mergePresets = (saved: string[], hidden: string[], incoming: unknown) => {
          let nextSaved = [...saved];
          let nextHidden = [...hidden];
          for (const name of asStringList(incoming)) {
            const trimmed = name.trim();
            if (!trimmed) continue;
            if (!nextSaved.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
              nextSaved = [trimmed, ...nextSaved];
            }
            nextHidden = nextHidden.filter((item) => item.trim().toLowerCase() !== trimmed.toLowerCase());
          }
          return { saved: nextSaved, hidden: nextHidden };
        };
        const tournamentLists = mergePresets(savedTournaments, hiddenTournaments, extrasObject.savedTournaments);
        const ageGroupLists = mergePresets(savedAgeGroups, hiddenAgeGroups, extrasObject.savedAgeGroups);
        const seasonLists = mergePresets(savedSeasons, hiddenSeasons, extrasObject.savedSeasons);
        const incomingOpponents = asStringList(extrasObject.savedOpponents);
        const knownOpponents = new Set(savedOpponents.map((name) => name.trim().toLowerCase()));
        const nextSavedOpponents = incomingOpponents.length > 0
          ? [...savedOpponents, ...incomingOpponents.filter((name) => !knownOpponents.has(name.toLowerCase()))]
          : savedOpponents;
        const nextHiddenTournaments = Array.isArray(extrasObject.hiddenTournaments)
          ? asStringList(extrasObject.hiddenTournaments) : tournamentLists.hidden;
        const nextHiddenAgeGroups = Array.isArray(extrasObject.hiddenAgeGroups)
          ? asStringList(extrasObject.hiddenAgeGroups) : ageGroupLists.hidden;
        const nextHiddenSeasons = Array.isArray(extrasObject.hiddenSeasons)
          ? asStringList(extrasObject.hiddenSeasons) : seasonLists.hidden;
        const nextUpcomingGames = data && Array.isArray(data.upcomingGames)
          ? data.upcomingGames as SQLiteLiveState['upcomingGames']
          : originalSQLiteState?.upcomingGames || [];
        const setupCompleted = extrasObject.setupCompleted === true &&
          Array.isArray(data.profiles) && data.profiles.length > 0
          ? true
          : originalSQLiteState?.setupCompleted ?? false;
        const nextState: SQLiteLiveState = {
          games: nextGames,
          profiles: nextProfiles,
          settings: nextSettings,
          liveGame,
          editingGameId,
          reopenedGameId,
          setupCompleted,
          savedOpponents: nextSavedOpponents,
          savedTournaments: tournamentLists.saved,
          savedAgeGroups: ageGroupLists.saved,
          savedSeasons: seasonLists.saved,
          hiddenTournaments: nextHiddenTournaments,
          hiddenAgeGroups: nextHiddenAgeGroups,
          hiddenSeasons: nextHiddenSeasons,
          oppositionTeams: nextOppositionTeams,
          upcomingGames: nextUpcomingGames,
          logoLibrary: readTeamLogoLibraryStrict(),
        };
        await saveLiveSQLiteState(nextState, { includeAuxiliary: true });
        if (data && Array.isArray(data.upcomingGames) &&
            !protectedStorageSetItem('dugoutPulse.upcomingGames.v1', JSON.stringify(data.upcomingGames))) {
          throw new Error('SQLite import committed, but the scheduled-game compatibility copy could not be verified.');
        }
        if (data && Array.isArray(data.oppositionTeams) &&
            !protectedStorageSetItem('dugoutPulse.oppositionTeams.v1', JSON.stringify(data.oppositionTeams))) {
          throw new Error('SQLite import committed, but the opposition-team compatibility copy could not be verified.');
        }
        if (setupCompleted &&
            !protectedStorageSetItem(STORAGE_KEYS.SETUP_COMPLETED, 'true')) {
          throw new Error('SQLite import committed, but the setup-completed compatibility copy could not be verified.');
        }
      }

      // Publish the imported state only after the direct storage writes above have succeeded.
      if (data && Array.isArray(data.games)) {
        setGames(sortGames(data.games, 'oldestFirst'));
      }
      if (data && Array.isArray(data.profiles) && data.profiles.length > 0) {
        setProfiles((data.profiles as PlayerProfile[]).map(withTeams));
      }
      if (data && data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
      if (data && Array.isArray(data.oppositionTeams)) setOppositionTeams(data.oppositionTeams);

      if (extras && typeof extras === 'object') {
        // Saved lists first (these also un-hide), then the hidden lists so they win.
        asStringList(extras.savedTournaments).forEach(saveTournament);
        asStringList(extras.savedAgeGroups).forEach(saveAgeGroup);
        asStringList(extras.savedSeasons).forEach(saveSeason);
        if (setSavedOpponents) {
          const incoming = asStringList(extras.savedOpponents);
          if (incoming.length > 0) {
            setSavedOpponents((prev) => {
              const known = new Set(prev.map((name) => name.trim().toLowerCase()));
              return [...prev, ...incoming.filter((name) => !known.has(name.toLowerCase()))];
            });
          }
        }
        if (Array.isArray(extras.hiddenTournaments)) setHiddenTournaments(asStringList(extras.hiddenTournaments));
        if (Array.isArray(extras.hiddenAgeGroups)) setHiddenAgeGroups(asStringList(extras.hiddenAgeGroups));
        if (Array.isArray(extras.hiddenSeasons)) setHiddenSeasons(asStringList(extras.hiddenSeasons));
        if (extras.setupCompleted === true && Array.isArray(data.profiles) && data.profiles.length > 0) {
          setIsFirstTimeUser(false);
        }
      }

      setRestoreFailed(false);
      const logoNote = restoredLogoCount > 0 ? ` ${restoredLogoCount} logo image(s) restored.` : '';
      const unverifiedNote = check.verified ? '' : ' (This is an older backup without an integrity check.)';
      if (restored.missingReferences.size > 0) {
        const count = restored.missingReferences.size;
        return {
          success: true,
          partial: true,
          message: `Data restored, but ${count} custom logo image(s) could not be found on this device. Default logos will be used for those items.${logoNote}${unverifiedNote}`,
        };
      }
      return { success: true, message: `Season data successfully restored!${logoNote}${unverifiedNote}` };
    } catch (err: unknown) {
      // Logo restoration can touch SQLite metadata before the complete import commits.
      // Restore the previous verified live snapshot on failure; localStorage is
      // reconciled from SQLite on the next startup if any compatibility write failed.
      if (sqliteStateMayHaveChanged && originalSQLiteState) {
        try {
          await saveLiveSQLiteState(originalSQLiteState, { includeAuxiliary: true });
        } catch (rollbackError) {
          recordDiagnosticError('storage_write', rollbackError, 'Backup import failed and the previous SQLite state could not be restored automatically. The verified recovery checkpoint was retained.');
        }
      }
      // If any import mutation may have started, pause automatic persistence. The
      // verified pre-import checkpoint remains available for explicit recovery.
      if (recoveryCheckpointCreated) setRestoreFailed(true);
      const unreadable = err instanceof SyntaxError;
      const userMessage = recoveryCheckpointCreated
        ? 'The backup import did not complete. Automatic saving has been paused to protect your current state. Review the recovery tools and diagnostic report before trying again.'
        : unreadable
          ? 'The selected file could not be read as a valid Dugout Pulse backup. Choose a backup exported from this app.'
          : 'Dugout Pulse could not import this backup. Review the diagnostic report before trying again.';
      return {
        success: false,
        message: reportFailure('backup_import', err, userMessage),
      };
    }
  }, [
    games, liveGame, editingGameId, reopenedGameId, profiles, settings, oppositionTeams,
    savedOpponents, savedTournaments, savedAgeGroups, savedSeasons,
    hiddenTournaments, hiddenAgeGroups, hiddenSeasons,
    setGames, setLiveGame, setEditingGameId, setReopenedGameId, setProfiles, setSettings,
    setOppositionTeams, setHiddenTournaments, setHiddenAgeGroups, setHiddenSeasons,
    setIsFirstTimeUser, setRestoreFailed, setSavedOpponents, setSavedTournaments,
    setSavedAgeGroups, setSavedSeasons, saveTournament, saveAgeGroup, saveSeason,
  ]);

  // Resolves true only after a verified checkpoint exists and app-data removal is confirmed.
  const resetAllData = useCallback(async (): Promise<boolean> => {
      // Reset is destructive: require a verified private checkpoint immediately before it.
      if (!(await createVerifiedRecoveryCheckpoint('Before user-requested reset of app data'))) {
        setRestoreFailed(true);
        return false;
      }
      if (!snapshotBeforeGameWrite()) {
        setRestoreFailed(true);
        return false;
      }

      let sqliteCutoverComplete = false;
      try {
        sqliteCutoverComplete = await isLegacyStorageImportComplete();
      } catch (error) {
        const marker = localStorage.getItem('dugoutPulse.sqliteCutover.v1');
        if (marker === 'complete' || marker === 'pending') {
          setRestoreFailed(true);
          recordDiagnosticError('storage_write', error, 'Reset was stopped because the active SQLite store could not be checked safely.');
          return false;
        }
        // Before cutover, localStorage remains authoritative and reset can proceed.
      }
      const marker = localStorage.getItem('dugoutPulse.sqliteCutover.v1');
      if (marker === 'pending' || (marker === 'complete' && !sqliteCutoverComplete)) {
        setRestoreFailed(true);
        recordDiagnosticError('storage_write', new Error('SQLite cutover marker and database status disagree.'), 'Reset was stopped because storage authority needs reconciliation.');
        return false;
      }

      // Do not publish an empty in-memory state until the legacy keys have been
      // removed and, after cutover, the matching empty SQLite snapshot has committed.
      // The verified private checkpoint remains available if any step fails.
      if (!clearAppDataPreservingDiagnostics()) {
        setRestoreFailed(true);
        return false;
      }
      if (sqliteCutoverComplete) {
        try {
          await saveLiveSQLiteState({
            games: [],
            profiles: [DEFAULT_PROFILE],
            settings: DEFAULT_SETTINGS,
            liveGame: null,
            editingGameId: null,
            reopenedGameId: null,
            setupCompleted: false,
            savedOpponents: [],
            savedTournaments: [],
            savedAgeGroups: [],
            savedSeasons: [],
            hiddenTournaments: [],
            hiddenAgeGroups: [],
            hiddenSeasons: [],
            oppositionTeams: [],
            upcomingGames: [],
            logoLibrary: [],
          }, { includeAuxiliary: true });
        } catch (error) {
          setRestoreFailed(true);
          recordDiagnosticError('storage_write', error, 'Local app data was cleared, but the reset could not be committed to SQLite. The verified recovery checkpoint was retained; automatic saving is paused.');
          return false;
        }
      }
    setGames([]);
    setLiveGame(null);
    setEditingGameId(null);
    setReopenedGameId(null);
    setProfiles([DEFAULT_PROFILE]);
    setSettings(DEFAULT_SETTINGS);
    setOppositionTeams([]);
    setHiddenTournaments([]);
    setHiddenAgeGroups([]);
    setHiddenSeasons([]);
    setSavedOpponents?.([]);
    setSavedTournaments?.([]);
    setSavedAgeGroups?.([]);
    setSavedSeasons?.([]);
    // The first-time-user flag is only read at startup, so it must be set explicitly here;
    // App then closes Settings and shows the setup screen.
    setIsFirstTimeUser(true);
    return true;
  }, []);

  const completeFirstTimeSetup = useCallback(
    (setup: {
      playerName: string;
      ageGroup: string;
      season: string;
      tournament?: string;
      teamName: string;
      jerseyNumber?: string;
    }) => {
      const trimmedPlayer = setup.playerName.trim();
      const trimmedTeam = setup.teamName.trim();
      const trimmedAge = setup.ageGroup.trim();
      const trimmedSeason = setup.season.trim();
      const trimmedTourney = setup.tournament?.trim() || '';
      const trimmedJersey = setup.jerseyNumber?.trim() || '';

      const newTeamId = 'team_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const primaryTeam: PlayerTeam = {
        id: newTeamId,
        name: trimmedTeam,
        jerseyNumber: trimmedJersey || undefined,
        ageGroup: trimmedAge,
        season: trimmedSeason,
        tournament: trimmedTourney || undefined,
        isDefault: true,
      };

      setProfiles((prev) => {
        const current = prev[0] || DEFAULT_PROFILE;
        const updatedProfile: PlayerProfile = {
          ...current,
          playerName: trimmedPlayer,
          teamName: trimmedTeam,
          jerseyNumber: trimmedJersey || current.jerseyNumber || undefined,
          defaultAgeGroup: trimmedAge,
          defaultSeason: trimmedSeason,
          defaultTournament: trimmedTourney || undefined,
          teams: [primaryTeam],
          isDefault: true,
        };
        return [updatedProfile, ...prev.slice(1)];
      });

      if (trimmedTourney) saveTournament(trimmedTourney);
      if (trimmedAge) saveAgeGroup(trimmedAge);
      if (trimmedSeason) saveSeason(trimmedSeason);

      try {
        if (!protectedStorageSetItem(STORAGE_KEYS.SETUP_COMPLETED, 'true')) {
          throw new Error('Could not protect storage before saving setup completion');
        }
      } catch (err) {
        console.error('Failed to save setup completed flag:', err);
      }
      setIsFirstTimeUser(false);
      triggerHaptic();
    },
    [saveTournament, saveAgeGroup, saveSeason, triggerHaptic]
  );


  return { updateSettings, importJsonData, resetAllData, completeFirstTimeSetup };
}
