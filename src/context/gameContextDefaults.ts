import type { AppSettings, Game, PlayerProfile } from '../types/baseball';

export const STORAGE_KEYS = {
  GAMES: 'baseball_hub_games_v1',
  LIVE_GAME: 'baseball_hub_live_game_v1',
  EDITING_GAME_ID: 'baseball_hub_editing_game_id_v1',
  REOPENED_GAME_ID: 'baseball_hub_reopened_game_id_v1',
  PROFILES: 'baseball_hub_profiles_v1',
  SETTINGS: 'baseball_hub_settings_v1',
  SAVED_OPPONENTS: 'baseball_hub_saved_opponents_v1',
  SAVED_TOURNAMENTS: 'baseball_hub_saved_tournaments_v1',
  SAVED_AGE_GROUPS: 'baseball_hub_saved_age_groups_v1',
  SAVED_SEASONS: 'baseball_hub_saved_seasons_v1',
  HIDDEN_TOURNAMENTS: 'baseball_hub_hidden_tournaments_v1',
  HIDDEN_AGE_GROUPS: 'baseball_hub_hidden_age_groups_v1',
  HIDDEN_SEASONS: 'baseball_hub_hidden_seasons_v1',
  SETUP_COMPLETED: 'baseball_hub_setup_completed_v1',
};

export const DEFAULT_AGE_GROUPS = [
  'U8',
  'U10',
  'U12',
  'U15',
  'U17',
  'U19',
  'U23',
  'Pro',
  'Adult',
  'Masters'
];

const currentYear = new Date().getFullYear();
export const DEFAULT_SEASONS = [
  `${currentYear} / ${currentYear + 1}`,
  `${currentYear}`,
];

export const DEFAULT_TOURNAMENTS = [
  'League',
  'NBC',
  'WBSC',
  'LLWS',
];

/**
 * Older profiles only have a teamName (+ default age group / season / tournament) and an empty
 * `teams` list. The UI showed that as a "virtual" team, but virtual teams can't be edited or
 * saved. This turns it into a real, persisted team so edits stick.
 */
const PRIMARY_TEAM_ID = 'primary-team';
export const withTeams = (p: PlayerProfile): PlayerProfile => {
  if (p.teams && p.teams.length > 0) return p;
  if (!p.teamName) return p;
  return {
    ...p,
    teams: [
      {
        id: PRIMARY_TEAM_ID,
        name: p.teamName,
        jerseyNumber: p.jerseyNumber || '',
        ageGroup: p.defaultAgeGroup || 'U12',
        season: p.defaultSeason || `${currentYear} / ${currentYear + 1}`,
        tournament: p.defaultTournament || '',
        isDefault: true,
      },
    ],
  };
};

export const DEFAULT_PROFILE: PlayerProfile = {
  id: 'default-player',
  playerName: '',
  teamName: '',
  jerseyNumber: '',
  isDefault: true,
  teams: [],
  defaultAgeGroup: 'U12',
  defaultSeason: `${currentYear} / ${currentYear + 1}`,
};

export const DEFAULT_SETTINGS: AppSettings = {
  inningsPerGame: 7,
  homeRunAddsRunAndRbi: true,
  darkMode: 'system',
  hapticsEnabled: true,
  activePlayerId: 'default-player',
  pitchCountLimit: 85,
  trackHitLocation: true,
  gameRemindersEnabled: false,
};

export function getInningsPlayed(game: Game): number {
  // The configured inning count is the scheduled/minimum game length, not proof that
  // every inning was actually played. Trim trailing empty innings when saving so
  // unfinished innings do not inflate game length or pitching/stat calculations.
  let innings = Math.max(1, game.innings);
  while (
    innings > 1 &&
    !game.plays.some((p) => p.inning === innings) &&
    !(game.benchInnings || []).includes(innings)
  ) {
    innings--;
  }
  return innings;
}

