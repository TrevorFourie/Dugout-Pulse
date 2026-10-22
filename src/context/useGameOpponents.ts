import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Game } from '../types/baseball';
import type { OppositionTeam } from './gameContextTypes';
import { protectedStorageSetItem } from './gameStorageSafety';

type StateSetter<T> = Dispatch<SetStateAction<T>>;

interface GameOpponentOptions {
  games: Game[];
  liveGame: Game | null;
  oppositionTeams: OppositionTeam[];
  setOppositionTeams: StateSetter<OppositionTeam[]>;
  savedOpponents: string[];
  setSavedOpponents: StateSetter<string[]>;
  storageWritesBlocked: boolean;
  onStorageProtectionFailure: () => void;
}

/** Owns saved opponents and the canonical opponent-team list. */
export function useGameOpponents({
  games,
  liveGame,
  oppositionTeams,
  setOppositionTeams,
  savedOpponents,
  setSavedOpponents,
  storageWritesBlocked,
  onStorageProtectionFailure,
}: GameOpponentOptions) {
  // Opposition Teams are the canonical list used by scoring and Settings.
  const addOppositionTeam = useCallback((name: string): boolean => {
    if (storageWritesBlocked) return false;
    const trimmed = name.trim();
    if (!trimmed || oppositionTeams.some((team) => team.name.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      return false;
    }
    const next = [
      { id: `opponent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: trimmed },
      ...oppositionTeams,
    ];
    try {
      if (!protectedStorageSetItem('dugoutPulse.oppositionTeams.v1', JSON.stringify(next))) {
        onStorageProtectionFailure();
        return false;
      }
    } catch {
      return false;
    }
    setOppositionTeams(next);
    return true;
  }, [oppositionTeams, storageWritesBlocked, onStorageProtectionFailure]);

  const updateOppositionTeam = useCallback((teamId: string, updates: Partial<Pick<OppositionTeam, 'name' | 'logo'>>): boolean => {
    if (storageWritesBlocked) return false;
    const target = oppositionTeams.find((team) => team.id === teamId);
    if (!target) return false;
    const trimmedName = updates.name?.trim();
    if (updates.name !== undefined && (!trimmedName || oppositionTeams.some((team) => team.id !== teamId && team.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase()))) {
      return false;
    }
    const next = oppositionTeams.map((team) => team.id === teamId
      ? { ...team, ...updates, ...(trimmedName ? { name: trimmedName } : {}) }
      : team);
    try {
      if (!protectedStorageSetItem('dugoutPulse.oppositionTeams.v1', JSON.stringify(next))) {
        onStorageProtectionFailure();
        return false;
      }
    } catch {
      return false;
    }
    setOppositionTeams(next);
    return true;
  }, [oppositionTeams, storageWritesBlocked, onStorageProtectionFailure]);

  const deleteOppositionTeam = useCallback((teamId: string): boolean => {
    if (storageWritesBlocked) return false;
    const next = oppositionTeams.filter((team) => team.id !== teamId);
    if (next.length === oppositionTeams.length) return false;
    try {
      if (!protectedStorageSetItem('dugoutPulse.oppositionTeams.v1', JSON.stringify(next))) {
        onStorageProtectionFailure();
        return false;
      }
    } catch {
      return false;
    }
    setOppositionTeams(next);
    return true;
  }, [oppositionTeams, storageWritesBlocked, onStorageProtectionFailure]);

  // Legacy remembered-opponent helpers remain available for old data, but scoring no longer writes to this list.
  // Opponent management helpers
  const saveOpponent = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavedOpponents((prev) => {
      if (prev.some((o) => o.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [trimmed, ...prev];
    });
  }, []);

  const deleteOpponent = useCallback((name: string) => {
    const trimmed = name.trim().toLowerCase();
    setSavedOpponents((prev) => prev.filter((o) => o.trim().toLowerCase() !== trimmed));
  }, []);

  // Compute allOpponents (case-insensitive deduplicated, sorted alphabetically)
  const allOpponents = useMemo(() => {
    const map = new Map<string, string>();
    // Saved opponents first
    savedOpponents.forEach((op) => {
      const trimmed = op.trim();
      if (trimmed) map.set(trimmed.toLowerCase(), trimmed);
    });
    // Opponents from saved games
    games.forEach((g) => {
      if (g.opponent && g.opponent.trim()) {
        const trimmed = g.opponent.trim();
        if (!map.has(trimmed.toLowerCase())) {
          map.set(trimmed.toLowerCase(), trimmed);
        }
      }
    });
    // Opponent from live game if active
    if (liveGame?.opponent && liveGame.opponent.trim()) {
      const trimmed = liveGame.opponent.trim();
      if (!map.has(trimmed.toLowerCase())) {
        map.set(trimmed.toLowerCase(), trimmed);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [savedOpponents, games, liveGame?.opponent]);

  // Compute recentOpponents (most recently played opponents first)
  const recentOpponents = useMemo(() => {
    const recents: string[] = [];
    const seen = new Set<string>();
    const sorted = [...games].sort((a, b) => b.date.localeCompare(a.date));
    for (const g of sorted) {
      if (g.opponent && g.opponent.trim()) {
        const trimmed = g.opponent.trim();
        const lower = trimmed.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          recents.push(trimmed);
        }
      }
      if (recents.length >= 6) break;
    }
    for (const op of savedOpponents) {
      if (recents.length >= 6) break;
      const trimmed = op.trim();
      const lower = trimmed.toLowerCase();
      if (trimmed && !seen.has(lower)) {
        seen.add(lower);
        recents.push(trimmed);
      }
    }
    return recents;
  }, [games, savedOpponents]);


  return {
    addOppositionTeam,
    updateOppositionTeam,
    deleteOppositionTeam,
    saveOpponent,
    deleteOpponent,
    allOpponents,
    recentOpponents,
  };
}
