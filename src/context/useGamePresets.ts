import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Game, PlayerProfile, PlayerTeam } from '../types/baseball';
import {
  DEFAULT_AGE_GROUPS,
  DEFAULT_SEASONS,
  DEFAULT_TOURNAMENTS,
  STORAGE_KEYS,
} from './gameContextDefaults';

type StateSetter<T> = Dispatch<SetStateAction<T>>;

interface GamePresetsOptions {
  games: Game[];
  liveGame: Game | null;
  activeProfile: PlayerProfile;
  setGames: StateSetter<Game[]>;
  setLiveGame: StateSetter<Game | null>;
  setProfiles: StateSetter<PlayerProfile[]>;
  setSavedTournaments: StateSetter<string[]>;
  setSavedAgeGroups: StateSetter<string[]>;
  setSavedSeasons: StateSetter<string[]>;
  setHiddenTournaments: StateSetter<string[]>;
  setHiddenAgeGroups: StateSetter<string[]>;
  setHiddenSeasons: StateSetter<string[]>;
  triggerHaptic: () => void;
}

/** Owns preset lists, rename propagation, and the derived setup lists. */
export function useGamePresets({
  games,
  liveGame,
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
}: GamePresetsOptions) {
  // Helpers for removing / restoring built-in defaults
  const without = (list: string[], name: string) => {
    const lower = name.trim().toLowerCase();
    return list.some((x) => x.trim().toLowerCase() === lower)
      ? list.filter((x) => x.trim().toLowerCase() !== lower)
      : list;
  };
  const withName = (list: string[], name: string) =>
    list.some((x) => x.trim().toLowerCase() === name.trim().toLowerCase())
      ? list
      : [...list, name.trim()];
  const isDefaultName = (defaults: string[], name: string) =>
    defaults.some((d) => d.toLowerCase() === name.trim().toLowerCase());
  const notHidden = (defaults: string[], hidden: string[]) =>
    defaults.filter((d) => !hidden.some((h) => h.trim().toLowerCase() === d.toLowerCase()));

  const restoreHiddenPresets = useCallback((kind: 'tournaments' | 'ageGroups' | 'seasons') => {
    if (kind === 'tournaments') setHiddenTournaments([]);
    if (kind === 'ageGroups') setHiddenAgeGroups([]);
    if (kind === 'seasons') setHiddenSeasons([]);
  }, []);

  // Rename a season / tournament / age group across the whole app, including saved games.
  const renamePreset = useCallback(
    (kind: 'tournaments' | 'ageGroups' | 'seasons', oldName: string, newName: string) => {
      const from = oldName.trim().toLowerCase();
      const to = newName.trim();
      if (!from || !to || from === to.toLowerCase() && oldName.trim() === to) return;
      const matches = (v?: string) => Boolean(v) && v!.trim().toLowerCase() === from;
      const swap = (v?: string) => (matches(v) ? to : v);
      const fieldKey = kind === 'tournaments' ? 'tournament' : kind === 'ageGroups' ? 'ageGroup' : 'season';
      const defaultKey = kind === 'tournaments' ? 'defaultTournament' : kind === 'ageGroups' ? 'defaultAgeGroup' : 'defaultSeason';
      const defaults = kind === 'tournaments' ? DEFAULT_TOURNAMENTS : kind === 'ageGroups' ? DEFAULT_AGE_GROUPS : DEFAULT_SEASONS;
      const setSaved = kind === 'tournaments' ? setSavedTournaments : kind === 'ageGroups' ? setSavedAgeGroups : setSavedSeasons;
      const setHidden = kind === 'tournaments' ? setHiddenTournaments : kind === 'ageGroups' ? setHiddenAgeGroups : setHiddenSeasons;

      const renameInGame = (g: Game): Game =>
        matches((g as unknown as Record<string, string | undefined>)[fieldKey])
          ? ({ ...g, [fieldKey]: to } as Game)
          : g;

      setGames((prev) => prev.map(renameInGame));
      setLiveGame((prev) => {
        if (!prev) return prev;
        const next = renameInGame(prev);
        if (next !== prev) {
          try {
            localStorage.setItem(STORAGE_KEYS.LIVE_GAME, JSON.stringify(next));
          } catch (storageError) {
            console.error('Failed to persist live game locally:', storageError);
          }
        }
        return next;
      });
      setProfiles((prev) =>
        prev.map((pr) => ({
          ...pr,
          [defaultKey]: swap((pr as unknown as Record<string, string | undefined>)[defaultKey]),
          teams: pr.teams?.map((t) => ({
            ...t,
            [fieldKey]: swap((t as unknown as Record<string, string | undefined>)[fieldKey]),
          })),
        }))
      );
      // Master list: replace the old entry with the new name (no duplicates)
      setSaved((prev) => {
        const kept = prev.filter((x) => x.trim().toLowerCase() !== from && x.trim().toLowerCase() !== to.toLowerCase());
        return [to, ...kept];
      });
      setHidden((prev) => {
        let next = prev.filter((x) => x.trim().toLowerCase() !== to.toLowerCase());
        // A renamed built-in default must not reappear under its old name
        if (from !== to.toLowerCase() && defaults.some((d) => d.toLowerCase() === from) && !next.some((x) => x.trim().toLowerCase() === from)) {
          next = [...next, oldName.trim()];
        }
        return next;
      });
      triggerHaptic();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [triggerHaptic]
  );

  // Values still used by saved games or the active player's teams (these can't be removed)
  const collectInUse = (
    fromGame: (g: Game) => string | undefined,
    fromTeam: (t: PlayerTeam) => string | undefined
  ) => {
    const set = new Set<string>();
    games.forEach((gm) => {
      const v = fromGame(gm)?.trim().toLowerCase();
      if (v) set.add(v);
    });
    (activeProfile.teams || []).forEach((t) => {
      const v = fromTeam(t)?.trim().toLowerCase();
      if (v) set.add(v);
    });
    return Array.from(set);
  };
  const inUseTournaments = useMemo(
    () => collectInUse((x) => x.tournament, (t) => t.tournament),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [games, activeProfile.teams]
  );
  const inUseAgeGroups = useMemo(
    () => collectInUse((x) => x.ageGroup, (t) => t.ageGroup),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [games, activeProfile.teams]
  );
  const inUseSeasons = useMemo(
    () => collectInUse((x) => x.season, (t) => t.season),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [games, activeProfile.teams]
  );

  // Tournament management helpers
  const saveTournament = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setHiddenTournaments((prev) => without(prev, trimmed));
    setSavedTournaments((prev) => {
      if (prev.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [trimmed, ...prev];
    });
  }, []);

  const deleteTournament = useCallback((name: string) => {
    const trimmed = name.trim().toLowerCase();
    setSavedTournaments((prev) => prev.filter((t) => t.trim().toLowerCase() !== trimmed));
    if (isDefaultName(DEFAULT_TOURNAMENTS, name)) setHiddenTournaments((prev) => withName(prev, name));
  }, []);

  // Compute allTournaments
  const allTournaments = useMemo(() => {
    const map = new Map<string, string>();
    notHidden(DEFAULT_TOURNAMENTS, hiddenTournaments).forEach((t) => map.set(t.toLowerCase(), t));
    savedTournaments.forEach((t) => {
      const trimmed = t.trim();
      if (trimmed) map.set(trimmed.toLowerCase(), trimmed);
    });
    games.forEach((g) => {
      if (g.tournament && g.tournament.trim()) {
        const trimmed = g.tournament.trim();
        if (!map.has(trimmed.toLowerCase())) {
          map.set(trimmed.toLowerCase(), trimmed);
        }
      }
    });
    (activeProfile.teams || []).forEach((team) => {
      if (team.tournament && team.tournament.trim()) {
        const trimmed = team.tournament.trim();
        if (!map.has(trimmed.toLowerCase())) {
          map.set(trimmed.toLowerCase(), trimmed);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [savedTournaments, hiddenTournaments, games, activeProfile.teams]);

  // Age group helpers
  const saveAgeGroup = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setHiddenAgeGroups((prev) => without(prev, trimmed));
    setSavedAgeGroups((prev) => {
      if (prev.some((ag) => ag.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [trimmed, ...prev];
    });
  }, []);

  const deleteAgeGroup = useCallback((name: string) => {
    const trimmed = name.trim().toLowerCase();
    setSavedAgeGroups((prev) => prev.filter((ag) => ag.trim().toLowerCase() !== trimmed));
    if (isDefaultName(DEFAULT_AGE_GROUPS, name)) setHiddenAgeGroups((prev) => withName(prev, name));
  }, []);

  const allAgeGroups = useMemo(() => {
    const map = new Map<string, string>();
    notHidden(DEFAULT_AGE_GROUPS, hiddenAgeGroups).forEach((ag) => map.set(ag.toLowerCase(), ag));
    savedAgeGroups.forEach((ag) => {
      const trimmed = ag.trim();
      if (trimmed) map.set(trimmed.toLowerCase(), trimmed);
    });
    games.forEach((g) => {
      if (g.ageGroup && g.ageGroup.trim()) {
        const trimmed = g.ageGroup.trim();
        if (!map.has(trimmed.toLowerCase())) {
          map.set(trimmed.toLowerCase(), trimmed);
        }
      }
    });
    (activeProfile.teams || []).forEach((team) => {
      if (team.ageGroup && team.ageGroup.trim()) {
        const trimmed = team.ageGroup.trim();
        if (!map.has(trimmed.toLowerCase())) {
          map.set(trimmed.toLowerCase(), trimmed);
        }
      }
    });
    return Array.from(map.values());
  }, [savedAgeGroups, hiddenAgeGroups, games, activeProfile.teams]);

  // Season helpers
  const saveSeason = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setHiddenSeasons((prev) => without(prev, trimmed));
    setSavedSeasons((prev) => {
      if (prev.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [trimmed, ...prev];
    });
  }, []);

  const deleteSeason = useCallback((name: string) => {
    const trimmed = name.trim().toLowerCase();
    setSavedSeasons((prev) => prev.filter((s) => s.trim().toLowerCase() !== trimmed));
    if (isDefaultName(DEFAULT_SEASONS, name)) setHiddenSeasons((prev) => withName(prev, name));
  }, []);

  const allSeasons = useMemo(() => {
    const map = new Map<string, string>();
    notHidden(DEFAULT_SEASONS, hiddenSeasons).forEach((s) => map.set(s.toLowerCase(), s));
    savedSeasons.forEach((s) => {
      const trimmed = s.trim();
      if (trimmed) map.set(trimmed.toLowerCase(), trimmed);
    });
    games.forEach((g) => {
      if (g.season && g.season.trim()) {
        const trimmed = g.season.trim();
        if (!map.has(trimmed.toLowerCase())) {
          map.set(trimmed.toLowerCase(), trimmed);
        }
      }
    });
    (activeProfile.teams || []).forEach((team) => {
      if (team.season && team.season.trim()) {
        const trimmed = team.season.trim();
        if (!map.has(trimmed.toLowerCase())) {
          map.set(trimmed.toLowerCase(), trimmed);
        }
      }
    });
    return Array.from(map.values());
  }, [savedSeasons, hiddenSeasons, games, activeProfile.teams]);

  // All Teams
  const allTeams = useMemo(() => {
    const map = new Map<string, string>();
    if (activeProfile.teamName && activeProfile.teamName.trim()) {
      const t = activeProfile.teamName.trim();
      map.set(t.toLowerCase(), t);
    }
    (activeProfile.teams || []).forEach((team) => {
      if (team.name && team.name.trim()) {
        const t = team.name.trim();
        map.set(t.toLowerCase(), t);
      }
    });
    games.forEach((g) => {
      if (g.teamName && g.teamName.trim()) {
        const t = g.teamName.trim();
        if (!map.has(t.toLowerCase())) {
          map.set(t.toLowerCase(), t);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [activeProfile.teamName, activeProfile.teams, games]);


  return {
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
  };
}
