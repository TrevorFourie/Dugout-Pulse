import type {
  AppSettings,
  DefensivePosition,
  Game,
  HitLocation,
  PitcherHand,
  Play,
  PlayCode,
  PlayerProfile,
  PlayerTeam,
  PlayMode,
  PlayScoringContext,
  PositionChange,
  RunnerOutReason,
} from '../types/baseball';
import type { PlaySeed } from '../utils/pitchingFlow';

export interface OppositionTeam {
  id: string;
  name: string;
  logo?: string;
}

export interface GameContextType {
  games: Game[];
  liveGame: Game | null;
  editingGameId: string | null;
  profiles: PlayerProfile[];
  activeProfile: PlayerProfile;
  settings: AppSettings;
  isLoading: boolean;
  restoreFailed: boolean;
  resumePromptPending: boolean;
  dismissResumePrompt: () => void;

  // Actions
  startLiveGame: (details: {
    date: string;
    time?: string;
    opponent?: string;
    finalResult?: string;
    teamName?: string;
    tournament?: string;
    ageGroup?: string;
    season?: string;
    lineupSpot?: number;
    isHome?: boolean;
  }) => void;
  addPlay: (
    mode: PlayMode,
    code: PlayCode,
    options?: {
      pitcherHand?: PitcherHand;
      defensivePosition?: DefensivePosition;
      lineupSpot?: number;
      hitLocation?: HitLocation;
      isExtraOut?: boolean;
      partOfMultiOutPlay?: boolean;
      autoOutcome?: boolean;
      runnerFromBase?: 1 | 2 | 3;
      runnerToBase?: 1 | 2 | 3 | 4;
      runnerAdvanceCause?: Play['runnerAdvanceCause'];
      droppedThirdStrikeSafe?: Play['droppedThirdStrikeSafe'];
      runnerOutReason?: RunnerOutReason;
      outReason?: Play['outReason'];
      errorType?: Play['errorType'];
      extraOuts?: number;
      scoringContext?: PlayScoringContext;
      /** Explicit inning for historical corrections; defaults to the live inning. */
      targetInning?: number;
    }
  ) => Play | undefined;
  /** Append several plays produced by one button press as a single undoable group. */
  addPlays: (seeds: PlaySeed[], targetInning?: number) => Play[];
  undoLastPlay: () => void;
  deletePlay: (playId: string) => void;
  editPlay: (
    playId: string,
    newInning: number,
    newMode: PlayMode,
    newCode: PlayCode,
    newLineupSpot?: number,
    newHitLocation?: HitLocation | null,
    newThrowTo?: string
  ) => void;
  updatePlayHitLocation: (playId: string, hitLocation: HitLocation | undefined) => void;
  updatePlayOutcome: (playId: string, code: PlayCode, errorType?: Play['errorType']) => void;
  /** Set how many RBI plays are attached to a batting play (adds/removes 'rbi' plays right after it). */
  setPlayRbis: (playId: string, count: number) => void;
  /** Move a play one step earlier/later in the game (swaps it with its neighbour). */
  movePlay: (playId: string, direction: 'earlier' | 'later', sameModeOnly?: boolean) => void;
  /** Insert a brand-new play directly after an existing play. */
  /** Drop a play directly before/after another play (drag and drop). */
  movePlayTo: (playId: string, targetId: string, position: 'before' | 'after') => void;
  insertPlayAfter: (
    afterPlayId: string,
    inning: number,
    mode: PlayMode,
    code: PlayCode,
    hitLocation?: HitLocation | null
  ) => void;
  nextInning: () => void;
  prevInning: () => void;
  setInning: (inning: number) => void;
  // Opponents & Inning Lineup
  savedOpponents: string[];
  allOpponents: string[];
  recentOpponents: string[];
  saveOpponent: (opponent: string) => void;
  deleteOpponent: (opponent: string) => void;
  oppositionTeams: OppositionTeam[];
  addOppositionTeam: (name: string) => boolean;
  updateOppositionTeam: (teamId: string, updates: Partial<Pick<OppositionTeam, 'name' | 'logo'>>) => boolean;
  deleteOppositionTeam: (teamId: string) => boolean;

  // Tournaments, Age Groups, Seasons, Teams
  savedTournaments: string[];
  allTournaments: string[];
  saveTournament: (tournament: string) => void;
  deleteTournament: (tournament: string) => void;
  savedAgeGroups: string[];
  allAgeGroups: string[];
  saveAgeGroup: (ageGroup: string) => void;
  deleteAgeGroup: (ageGroup: string) => void;
  savedSeasons: string[];
  allSeasons: string[];
  saveSeason: (season: string) => void;
  deleteSeason: (season: string) => void;
  allTeams: string[];
  // Built-in defaults the user has removed, and values still used by a team/game (lower-case)
  hiddenTournaments: string[];
  hiddenAgeGroups: string[];
  hiddenSeasons: string[];
  inUseTournaments: string[];
  inUseAgeGroups: string[];
  inUseSeasons: string[];
  restoreHiddenPresets: (kind: 'tournaments' | 'ageGroups' | 'seasons') => void;
  /** Rename a season / tournament / age group everywhere it is used (games, teams, profiles, lists). */
  renamePreset: (kind: 'tournaments' | 'ageGroups' | 'seasons', oldName: string, newName: string) => void;

  // Player Teams
  addPlayerTeam: (profileId: string, team: Omit<PlayerTeam, 'id'>) => PlayerTeam;
  updatePlayerTeam: (profileId: string, teamId: string, updates: Partial<PlayerTeam>) => void;
  deletePlayerTeam: (profileId: string, teamId: string) => void;
  setDefaultPlayerTeam: (profileId: string, teamId: string) => void;

  setInningPosition: (inning: number, position: DefensivePosition) => void;
  setInningLineupSpot: (inning: number, spot: number | undefined) => void;
  setLineupSpot: (spot: number | undefined) => void;
  toggleBenchCurrentInning: () => void;
  /**
   * Switch position within an inning that already has one.
   * 'record' keeps the earlier part of the inning at the old position and logs a mid-inning change;
   * 'correct' replaces the position for the whole inning (fixing a wrong selection).
   */
  changeInningPosition: (inning: number, to: DefensivePosition, mode: 'record' | 'correct') => void;
  /** Undo a recorded mid-inning position change. */
  removePositionChange: (changeId: string) => void;
  /** Remove the furthest inning again, only if nothing was recorded in it (undo "Add Another Inning"). */
  removeEmptyLastInning: () => boolean;
  /** Bench or un-bench any inning (not just the current one). */
  setInningBench: (inning: number, benched: boolean) => void;
  saveGame: (finalResult: string) => void;
  discardLiveGame: () => void;
  startEditingSavedGame: (gameId: string) => boolean;
  /** Resume a completed game in normal live-scoring mode, without entering historical edit mode. */
  reopenSavedGame: (gameId: string) => boolean;
  cancelEditing: () => void;
  deleteSavedGame: (gameId: string) => void;
  updateLiveGameDetails: (
    details: Partial<
      Pick<
        Game,
        | 'date'
        | 'time'
        | 'opponent'
        | 'finalResult'
        | 'teamName'
        | 'isHome'
        | 'tournament'
        | 'ageGroup'
        | 'season'
        | 'lineupSpot'
        | 'fieldingPositions'
        | 'inningLineupSpots'
        | 'innings'
        | 'inningsManual'
        | 'halfInningStatus'
      >
    >
  ) => void;

  // Profiles & Settings
  updateActiveProfile: (updates: Partial<PlayerProfile>) => void;
  addProfile: (profile: Omit<PlayerProfile, 'id'>) => PlayerProfile;
  setActiveProfileId: (id: string) => void;
  deleteProfile: (id: string) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  importJsonData: (jsonStr: string) => Promise<{ success: boolean; message: string }>;
  resetAllData: () => void;

  // First time user setup
  isFirstTimeUser: boolean;
  setIsFirstTimeUser: (val: boolean) => void;
  completeFirstTimeSetup: (setup: {
    playerName: string;
    ageGroup: string;
    season: string;
    tournament?: string;
    teamName: string;
    jerseyNumber?: string;
  }) => void;
}
