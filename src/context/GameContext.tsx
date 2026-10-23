import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppSettings, Game, PlayerProfile } from '../types/baseball';
import type { GameContextType, OppositionTeam } from './gameContextTypes';
export type { OppositionTeam } from './gameContextTypes';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, STORAGE_KEYS } from './gameContextDefaults';
import { useGamePersistence } from './useGamePersistence';
import { useGameRestore } from './useGameRestore';
import { useGamePresets } from './useGamePresets';
import { useGameOpponents } from './useGameOpponents';
import { usePlayerTeams } from './usePlayerTeams';
import { useGameProfiles } from './useGameProfiles';
import { useInningManagement } from './useInningManagement';
import { useGamePlayActions } from './useGamePlayActions';
import { useGameLifecycle } from './useGameLifecycle';
import { useGameDataManagement } from './useGameDataManagement';
import { recordDiagnosticError } from '../utils/errorDiagnostics';

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
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [resumePromptPending, setResumePromptPending] = useState(false);
  const dismissResumePrompt = useCallback(() => setResumePromptPending(false), []);
  const handleStorageProtectionFailure = useCallback(() => setRestoreFailed(true), []);

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
    } catch (error) {
      recordDiagnosticError(error instanceof SyntaxError ? 'data_corruption' : 'storage_read', error, 'Initial setup/profile state could not be read from saved storage.');
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
    setResumePromptPending,
    setRestoreFailed,
    setIsFirstTimeUser,
  });

  // Persistence writes are kept separate from the context's game and profile logic.
  useGamePersistence({
    isLoading: isLoading || restoreFailed,
    onStorageProtectionFailure: handleStorageProtectionFailure,
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
    storageWritesBlocked: restoreFailed,
    onStorageProtectionFailure: handleStorageProtectionFailure,
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
    savedTournaments,
    savedAgeGroups,
    savedSeasons,
    hiddenTournaments,
    hiddenAgeGroups,
    hiddenSeasons,
    setSavedTournaments,
    setSavedAgeGroups,
    setSavedSeasons,
    setHiddenTournaments,
    setHiddenAgeGroups,
    setHiddenSeasons,
    triggerHaptic,
    storageWritesBlocked: restoreFailed,
    onStorageProtectionFailure: handleStorageProtectionFailure,
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
    storageWritesBlocked: restoreFailed,
    onStorageProtectionFailure: handleStorageProtectionFailure,
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
  } = useGamePlayActions({ liveGame, setLiveGame, settings, triggerHaptic, storageWritesBlocked: restoreFailed, onStorageProtectionFailure: handleStorageProtectionFailure });

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

  const {
    updateSettings,
    importJsonData,
    resetAllData,
    completeFirstTimeSetup,
  } = useGameDataManagement({
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
  });

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
        restoreFailed,
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
      {!isLoading ? children : null}
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