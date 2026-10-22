import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppSettings, Game, PlayerProfile } from '../types/baseball';
import { sortGames } from '../utils/stats';
import type { GameContextType, OppositionTeam } from './gameContextTypes';
export type { OppositionTeam } from './gameContextTypes';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, STORAGE_KEYS, withTeams } from './gameContextDefaults';
import { collectLocalLogoDataUrls, restoreLocalLogoReferences } from '../utils/logoBackup';
import { clearAppDataPreservingDiagnostics } from '../utils/errorDiagnostics';
import { useGamePersistence } from './useGamePersistence';
import { useGameRestore } from './useGameRestore';
import { useGamePresets } from './useGamePresets';
import { useGameOpponents } from './useGameOpponents';
import { usePlayerTeams } from './usePlayerTeams';
import { useGameProfiles } from './useGameProfiles';
import { useInningManagement } from './useInningManagement';
import { useGamePlayActions } from './useGamePlayActions';
import { useGameLifecycle } from './useGameLifecycle';

const GameContext = createContext<GameContextType | undefined>(undefined);

/**
 * Number of innings actually played. Trailing innings with no plays and no bench/rest entry
 * (e.g. an inning opened accidentally or after a shortened game) are not counted.
 */
export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [liveGame, setLiveGame] = useState<Game | null>(null);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [reopenedGameId, setReopenedGameId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<PlayerProfile[]>([DEFAULT_PROFILE]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savedOpponents, setSavedOpponents] = useState<string[]>([]);
  const [oppositionTeams, setOppositionTeams] = useState<OppositionTeam[]>([]);
  const [savedTournaments, setSavedTournaments] = useState<string[]>([]);
  const [savedAgeGroups, setSavedAgeGroups] = useState<string[]>([]);
  const [savedSeasons, setSavedSeasons] = useState<string[]>([]);
  const [hiddenTournaments, setHiddenTournaments] = useState<string[]>([]);
  const [hiddenAgeGroups, setHiddenAgeGroups] = useState<string[]>([]);
  const [hiddenSeasons, setHiddenSeasons] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resumePromptPending, setResumePromptPending] = useState(false);
  const dismissResumePrompt = useCallback(() => setResumePromptPending(false), []);

  // First time user detection: true if setup has not been completed and no profile is filled out
  const [isFirstTimeUser, setIsFirstTimeUser] = useState<boolean>(() => {
    try {
      const completed = localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETED);
      if (completed === 'true') return false;
      const storedProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (storedProfiles) {
        const parsed = JSON.parse(storedProfiles);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed[0]?.playerName?.trim() &&
          (parsed[0]?.teamName?.trim() || (parsed[0]?.teams && parsed[0]?.teams.length > 0))
        ) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  });

  // Initial restore is separate from ongoing persistence writes.
  useGameRestore({
    setGames,
    setLiveGame,
    setEditingGameId,
    setReopenedGameId,
    setProfiles,
    setSettings,
    setOppositionTeams,
    setSavedOpponents,
    setSavedTournaments,
    setSavedAgeGroups,
    setSavedSeasons,
    setHiddenTournaments,
    setHiddenAgeGroups,
    setHiddenSeasons,
    setIsLoading,
  });

  // Persistence writes are kept separate from the context's game and profile logic.
  useGamePersistence({
    isLoading,
    games,
    oppositionTeams,
    savedOpponents,
    savedTournaments,
    savedAgeGroups,
    savedSeasons,
    hiddenTournaments,
    hiddenAgeGroups,
    hiddenSeasons,
    liveGame,
    editingGameId,
    reopenedGameId,
    profiles,
    settings,
  });

  // Dark mode effect
  useEffect(() => {
    const root = document.documentElement;
    if (settings.darkMode === 'dark') {
      root.classList.add('dark');
    } else if (settings.darkMode === 'light') {
      root.classList.remove('dark');
    } else {
      // System
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (mediaQuery.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      const listener = (e: MediaQueryListEvent) => {
        if (settings.darkMode === 'system') {
          if (e.matches) root.classList.add('dark');
          else root.classList.remove('dark');
        }
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [settings.darkMode]);

  const activeProfile =
    profiles.find((p) => p.id === settings.activePlayerId) || profiles[0] || DEFAULT_PROFILE;

  // Trigger haptic vibration helper
  // Haptic vibration has been removed from the app
  const triggerHaptic = useCallback(() => {}, []);

  const {
    addOppositionTeam,
    updateOppositionTeam,
    deleteOppositionTeam,
    saveOpponent,
    deleteOpponent,
    allOpponents,
    recentOpponents,
  } = useGameOpponents({
    games,
    liveGame,
    oppositionTeams,
    setOppositionTeams,
    savedOpponents,
    setSavedOpponents,
  });

  const {
    restoreHiddenPresets,
    renamePreset,
    inUseTournaments,
    inUseAgeGroups,
    inUseSeasons,
    saveTournament,
    deleteTournament,
    allTournaments,
    saveAgeGroup,
    deleteAgeGroup,
    allAgeGroups,
    saveSeason,
    deleteSeason,
    allSeasons,
    allTeams,
  } = useGamePresets({
    games,
    activeProfile,
    setGames,
    setLiveGame,
    setProfiles,
    setSavedTournaments,
    setSavedAgeGroups,
    setSavedSeasons,
    setHiddenTournaments,
    setHiddenAgeGroups,
    setHiddenSeasons,
    triggerHaptic,
  });

  const { addPlayerTeam, updatePlayerTeam, deletePlayerTeam, setDefaultPlayerTeam } = usePlayerTeams({
    setProfiles,
    saveTournament,
    saveAgeGroup,
    saveSeason,
  });

  const {
    startLiveGame,
    updateLiveGameDetails,
    saveGame,
    discardLiveGame,
    startEditingSavedGame,
    reopenSavedGame,
    cancelEditing,
    deleteSavedGame,
  } = useGameLifecycle({
    activeProfile,
    games,
    liveGame,
    editingGameId,
    reopenedGameId,
    setGames,
    setLiveGame,
    setEditingGameId,
    setReopenedGameId,
    setResumePromptPending,
    saveTournament,
    saveAgeGroup,
    saveSeason,
    triggerHaptic,
  });

  const {
    addPlay,
    addPlays,
    undoLastPlay,
    deletePlay,
    updatePlayHitLocation,
    updatePlayOutcome,
    setPlayRbis,
    movePlay,
    movePlayTo,
    insertPlayAfter,
    editPlay,
  } = useGamePlayActions({ liveGame, setLiveGame, settings, triggerHaptic });

  const {
    nextInning,
    prevInning,
    setInning,
    setInningPosition,
    setInningLineupSpot,
    setLineupSpot,
    toggleBenchCurrentInning,
    changeInningPosition,
    removePositionChange,
    removeEmptyLastInning,
    setInningBench,
  } = useInningManagement({ liveGame, setLiveGame, triggerHaptic });

  const { updateActiveProfile, addProfile, setActiveProfileId, deleteProfile } = useGameProfiles({
    profiles,
    activeProfile,
    setProfiles,
    setSettings,
  });

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
        localStorage.setItem('dugoutPulse.upcomingGames.v1', JSON.stringify(data.upcomingGames));
      }
      if (data && Array.isArray(data.oppositionTeams)) {
        setOppositionTeams(data.oppositionTeams);
        localStorage.setItem('dugoutPulse.oppositionTeams.v1', JSON.stringify(data.oppositionTeams));
      }

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

  return (
    <GameContext.Provider
      value={{
        games,
        liveGame,
        editingGameId,
        profiles,
        activeProfile,
        settings,
        isLoading,
        resumePromptPending,
        dismissResumePrompt,
        savedOpponents,
        allOpponents,
        recentOpponents,
        saveOpponent,
        deleteOpponent,
        oppositionTeams,
        addOppositionTeam,
        updateOppositionTeam,
        deleteOppositionTeam,
        savedTournaments,
        allTournaments,
        saveTournament,
        deleteTournament,
        savedAgeGroups,
        allAgeGroups,
        saveAgeGroup,
        deleteAgeGroup,
        savedSeasons,
        allSeasons,
        saveSeason,
        deleteSeason,
        allTeams,
        hiddenTournaments,
        hiddenAgeGroups,
        hiddenSeasons,
        inUseTournaments,
        inUseAgeGroups,
        inUseSeasons,
        restoreHiddenPresets,
        renamePreset,
        addPlayerTeam,
        updatePlayerTeam,
        deletePlayerTeam,
        setDefaultPlayerTeam,
        startLiveGame,
        addPlay,
        addPlays,
        undoLastPlay,
        deletePlay,
        editPlay,
        updatePlayHitLocation,
        updatePlayOutcome,
        setPlayRbis,
        movePlay,
        movePlayTo,
        insertPlayAfter,
        nextInning,
        prevInning,
        setInning,
        setInningPosition,
        setInningLineupSpot,
        setLineupSpot,
        toggleBenchCurrentInning,
        removeEmptyLastInning,
        changeInningPosition,
        removePositionChange,
        setInningBench,
        saveGame,
        discardLiveGame,
        startEditingSavedGame,
        reopenSavedGame,
        cancelEditing,
        deleteSavedGame,
        updateLiveGameDetails,
        updateActiveProfile,
        addProfile,
        setActiveProfileId,
        deleteProfile,
        updateSettings,
        importJsonData,
        resetAllData,
        isFirstTimeUser,
        setIsFirstTimeUser,
        completeFirstTimeSetup,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};