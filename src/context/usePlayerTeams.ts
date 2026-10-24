import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PlayerProfile, PlayerTeam } from '../types/baseball';
import { withTeams } from './gameContextDefaults';

type StateSetter<T> = Dispatch<SetStateAction<T>>;

interface PlayerTeamsOptions {
  setProfiles: StateSetter<PlayerProfile[]>;
  saveTournament: (name: string) => void;
  saveAgeGroup: (name: string) => void;
  saveSeason: (name: string) => void;
}

/** Owns edits to the teams attached to player profiles. */
export function usePlayerTeams({
  setProfiles,
  saveTournament,
  saveAgeGroup,
  saveSeason,
}: PlayerTeamsOptions) {
  // Player Teams management
  const addPlayerTeam = useCallback(
    (profileId: string, teamData: Omit<PlayerTeam, 'id'>): PlayerTeam => {
      const newTeam: PlayerTeam = {
        id: 'team_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: teamData.name.trim(),
        jerseyNumber: teamData.jerseyNumber?.trim(),
        ageGroup: teamData.ageGroup?.trim(),
        season: teamData.season?.trim(),
        tournament: teamData.tournament?.trim(),
        logo: teamData.logo,
        isDefault: Boolean(teamData.isDefault),
      };

      setProfiles((prev) =>
        prev.map((profile) => {
          if (profile.id !== profileId) return profile;
          const p = withTeams(profile);
          const currentTeams = p.teams || [];
          let updatedTeams = [...currentTeams];
          if (newTeam.isDefault) {
            updatedTeams = updatedTeams.map((t) => ({ ...t, isDefault: false }));
          }
          updatedTeams.push(newTeam);
          return {
            ...p,
            teamName: newTeam.isDefault || !p.teamName ? newTeam.name : p.teamName,
            teams: updatedTeams,
            defaultAgeGroup: newTeam.ageGroup || p.defaultAgeGroup,
            defaultSeason: newTeam.season || p.defaultSeason,
            defaultTournament: newTeam.tournament || p.defaultTournament,
          };
        })
      );

      if (teamData.tournament?.trim()) saveTournament(teamData.tournament.trim());
      if (teamData.ageGroup?.trim()) saveAgeGroup(teamData.ageGroup.trim());
      if (teamData.season?.trim()) saveSeason(teamData.season.trim());

      return newTeam;
    },
    [saveTournament, saveAgeGroup, saveSeason]
  );

  const updatePlayerTeam = useCallback(
    (profileId: string, teamId: string, updates: Partial<PlayerTeam>) => {
      setProfiles((prev) =>
        prev.map((profile) => {
          if (profile.id !== profileId) return profile;
          const p = withTeams(profile);
          const updated = (p.teams || []).map((t) => (t.id === teamId ? { ...t, ...updates } : t));
          const edited = updated.find((t) => t.id === teamId);
          const isPrimary = Boolean(edited?.isDefault);
          return {
            ...p,
            teams: updated,
            // Keep the profile-level primary team fields in step with the primary team
            teamName: isPrimary && edited ? edited.name : p.teamName,
            defaultAgeGroup: isPrimary && edited ? edited.ageGroup || undefined : p.defaultAgeGroup,
            defaultSeason: isPrimary && edited ? edited.season || undefined : p.defaultSeason,
            defaultTournament: isPrimary && edited ? edited.tournament || undefined : p.defaultTournament,
          };
        })
      );

      // Make anything typed here available in the master lists / dropdowns
      if (updates.tournament?.trim()) saveTournament(updates.tournament.trim());
      if (updates.ageGroup?.trim()) saveAgeGroup(updates.ageGroup.trim());
      if (updates.season?.trim()) saveSeason(updates.season.trim());
    },
    [saveTournament, saveAgeGroup, saveSeason]
  );

  const deletePlayerTeam = useCallback((profileId: string, teamId: string) => {
    setProfiles((prev) =>
      prev.map((profile) => {
        if (profile.id !== profileId) return profile;
        const p = withTeams(profile);
        const filtered = (p.teams || []).filter((t) => t.id !== teamId);
        return {
          ...p,
          teams: filtered,
        };
      })
    );
  }, []);

  const setDefaultPlayerTeam = useCallback((profileId: string, teamId: string) => {
    setProfiles((prev) =>
      prev.map((profile) => {
        if (profile.id !== profileId) return profile;
        const p = withTeams(profile);
        const targetTeam = (p.teams || []).find((t) => t.id === teamId);
        const updated = (p.teams || []).map((t) => ({ ...t, isDefault: t.id === teamId }));
        return {
          ...p,
          teamName: targetTeam ? targetTeam.name : p.teamName,
          teams: updated,
          defaultAgeGroup: targetTeam?.ageGroup || p.defaultAgeGroup,
          defaultSeason: targetTeam?.season || p.defaultSeason,
          defaultTournament: targetTeam?.tournament || p.defaultTournament,
        };
      })
    );
  }, []);


  return { addPlayerTeam, updatePlayerTeam, deletePlayerTeam, setDefaultPlayerTeam };
}
