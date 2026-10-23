import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings, Game, PlayerProfile, PlayerTeam } from '../types/baseball';
import { sortGames } from '../utils/stats';
import { collectLocalLogoDataUrls, restoreLocalLogoReferences } from '../utils/logoBackup';
import { readTeamLogoLibrary } from '../utils/teamLogoLibrary';
import { clearAppDataPreservingDiagnostics } from '../utils/errorDiagnostics';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, STORAGE_KEYS, withTeams } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { protectedStorageSetItem, snapshotBeforeGameWrite } from './gameStorageSafety';
import { createVerifiedRecoveryCheckpoint } from './recoveryJournal';
import { asStringList, verifyBackup } from '../utils/backupFormat';
import { restoreLogosFromBackup } from '../utils/fullBackup';
import { getLastDiagnosticReference } from '../utils/errorDiagnostics';
import { explainFailure, reportFailure } from '../utils/userMessages';

type StateSetter<T> = Dispatch<SetStateAction<T>>;

interface GameDataManagementOptions {
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
    try {
      const parsedData = JSON.parse(jsonStr);
      // Validate before anything is changed: a damaged, truncated or unrelated file is rejected outright.
      const check = verifyBackup(parsedData);
      if (!check.ok) return { success: false, message: check.message };
      if (!(await createVerifiedRecoveryCheckpoint('Before importing a JSON backup'))) {
        return { success: false, message: explainFailure('The restore was not started because the app could not first make a safety copy of your current data. Nothing was changed.', getLastDiagnosticReference() || undefined) };
      }
      recoveryCheckpointCreated = true;
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
      if (data && Array.isArray(data.upcomingGames)) {
        if (!protectedStorageSetItem('dugoutPulse.upcomingGames.v1', JSON.stringify(data.upcomingGames))) {
          throw new Error('Could not protect storage before importing upcoming games');
        }
      }
      if (data && Array.isArray(data.oppositionTeams)) {
        if (!protectedStorageSetItem('dugoutPulse.oppositionTeams.v1', JSON.stringify(data.oppositionTeams))) {
          throw new Error('Could not protect storage before importing opposition teams');
        }
      }

      const extras = (data && typeof data === 'object' ? (data as { extras?: Record<string, unknown> }).extras : undefined);
      if (extras && typeof extras === 'object' &&
          extras.setupCompleted === true && Array.isArray(data.profiles) && data.profiles.length > 0) {
        // A failed setup-flag write must stop the import before the restored state is published.
        if (!protectedStorageSetItem(STORAGE_KEYS.SETUP_COMPLETED, 'true')) {
          throw new Error('Could not protect storage before saving setup completion');
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
  }, []);

  // Resolves true once the reset has been applied, false when it was blocked (no verified checkpoint).
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
    // Do not publish an empty in-memory state until every app-data key has been
    // removed and read back as absent. The verified private checkpoint remains intact.
    if (!clearAppDataPreservingDiagnostics()) {
      setRestoreFailed(true);
      return false;
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
