import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings, PlayerProfile } from '../types/baseball';
import { withTeams } from './gameContextDefaults';

type StateSetter<T> = Dispatch<SetStateAction<T>>;

interface GameProfilesOptions {
  profiles: PlayerProfile[];
  activeProfile: PlayerProfile;
  setProfiles: StateSetter<PlayerProfile[]>;
  setSettings: StateSetter<AppSettings>;
}

/** Owns player profile changes and active-profile selection. */
export function useGameProfiles({
  profiles,
  activeProfile,
  setProfiles,
  setSettings,
}: GameProfilesOptions) {
  // Profile management
  const updateActiveProfile = useCallback(
    (updates: Partial<PlayerProfile>) => {
      setProfiles((prev) =>
        prev.map((profile) => {
          if (profile.id !== activeProfile.id) return profile;
          let next = { ...profile, ...updates };
          if (updates.teamName !== undefined && updates.teamName.trim()) {
            next = withTeams(next);
            next = {
              ...next,
              teams: (next.teams || []).map((t) =>
                t.isDefault ? { ...t, name: updates.teamName as string } : t
              ),
            };
          }
          if (updates.jerseyNumber !== undefined) {
            next = withTeams(next);
            next = {
              ...next,
              teams: (next.teams || []).map((t) =>
                t.isDefault ? { ...t, jerseyNumber: updates.jerseyNumber as string } : t
              ),
            };
          }
          return next;
        })
      );
    },
    [activeProfile.id]
  );

  const addProfile = useCallback(
    (profile: Omit<PlayerProfile, 'id'>): PlayerProfile => {
      const newProfile: PlayerProfile = {
        ...profile,
        id: 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      };
      setProfiles((prev) => [...prev, newProfile]);
      setSettings((prev) => ({ ...prev, activePlayerId: newProfile.id }));
      return newProfile;
    },
    []
  );

  const setActiveProfileId = useCallback((id: string) => {
    setSettings((prev) => ({ ...prev, activePlayerId: id }));
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setProfiles((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((p) => p.id !== id);
      return filtered;
    });
    setSettings((prev) => {
      if (prev.activePlayerId === id) {
        return { ...prev, activePlayerId: profiles[0]?.id || 'default-player' };
      }
      return prev;
    });
  }, [profiles]);


  return { updateActiveProfile, addProfile, setActiveProfileId, deleteProfile };
}
