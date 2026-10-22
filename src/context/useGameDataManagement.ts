import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings, Game, PlayerProfile, PlayerTeam } from '../types/baseball';
import { sortGames } from '../utils/stats';
import { collectLocalLogoDataUrls, restoreLocalLogoReferences } from '../utils/logoBackup';
import { clearAppDataPreservingDiagnostics } from '../utils/errorDiagnostics';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, STORAGE_KEYS, withTeams } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { protectedStorageSetItem, snapshotBeforeGameWrite } from './gameStorageSafety';

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
  saveTournament,
  saveAgeGroup,
  saveSeason,
  triggerHaptic,
}: GameDataManagementOptions) {
  // Update settings
  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  // Full backup import. Logo images are intentionally not embedded in JSON backups:
  // references are resolved against images that still exist in this app's local data.
  const importJsonData = useCallback((jsonStr: string) => {
    try {
      const parsedData = JSON.parse(jsonStr);
      const localLogos = new Map<string, string>();
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
      const restored = restoreLocalLogoReferences(parsedData, localLogos);
      const data = restored.data as typeof parsedData;

      if (data && Array.isArray(data.games)) {
        setGames(sortGames(data.games, 'oldestFirst'));
      }
      if (data && Array.isArray(data.profiles) && data.profiles.length > 0) {
        setProfiles((data.profiles as PlayerProfile[]).map(withTeams));
      }
      if (data && data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
      if (data && Array.isArray(data.upcomingGames)) {
        if (!protectedStorageSetItem('dugoutPulse.upcomingGames.v1', JSON.stringify(data.upcomingGames))) {
          throw new Error('Could not protect storage before importing upcoming games');
        }
      }
      if (data && Array.isArray(data.oppositionTeams)) {
        setOppositionTeams(data.oppositionTeams);
        if (!protectedStorageSetItem('dugoutPulse.oppositionTeams.v1', JSON.stringify(data.oppositionTeams))) {
          throw new Error('Could not protect storage before importing opposition teams');
        }
      }

      setRestoreFailed(false);
      if (restored.missingReferences.size > 0) {
        const count = restored.missingReferences.size;
        return {
          success: true,
          message: `Data restored, but ${count} custom logo image(s) could not be found on this device. Default logos will be used for those items. Logo images are not included in JSON backups.`,
        };
      }
      return { success: true, message: 'Season data successfully restored!' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid JSON file';
      return { success: false, message: `Failed to import backup: ${message}` };
    }
  }, []);

  const resetAllData = useCallback(() => {
    if (!snapshotBeforeGameWrite()) return;
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
    clearAppDataPreservingDiagnostics();
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
        localStorage.setItem(STORAGE_KEYS.SETUP_COMPLETED, 'true');
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
