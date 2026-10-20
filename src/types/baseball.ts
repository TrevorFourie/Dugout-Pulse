export type PlayMode = 'batting' | 'pitching' | 'fielding';

export type BattingPlayCode =
  | 'single'
  | 'double'
  | 'triple'
  | 'homeRun'
  | 'walk'
  | 'intentionalWalk'
  | 'hbp'
  | 'strikeout'
  | 'out'
  | 'sacFly'
  | 'sacBunt'
  | 'reachedOnError'
  | 'catchersInterference'
  | 'fieldersChoice'
  | 'groundedIntoDoublePlay'
  | 'rbi'
  | 'run'
  | 'stolenBase'
  | 'cs'
  | 'runnerAdvance'
  | 'runnerOut'
  | 'leftOnBase'
  | 'runnerHold'
  | 'runnerInjury';

export type PitchingPlayCode =
  | 'pitchOut'
  | 'strikeout'
  | 'hitAllowed'
  | 'homeRunAllowed'
  | 'walkAllowed'
  | 'intentionalWalkAllowed'
  | 'hitBatter'
  | 'runAllowed'
  | 'earnedRun'
  | 'wildPitch'
  | 'balk'
  | 'pitchBall'
  | 'pitchStrike'
  | 'pitchFoul'
  | 'pitchOther'
  | 'pickoffAttempt';

export type FieldingPlayCode =
  | 'putout'
  | 'assist'
  | 'error'
  | 'doublePlay'
  | 'triplePlay'
  | 'passedBall'
  | 'catcherGloveDeadBall'
  | 'caughtStealing'
  | 'stealAllowed'
  | 'catchersInterference'
  | 'pickoff'
  | 'droppedThirdStrike'
  | 'defensiveIndifference'
  | 'catcherObstruction'
  | 'catcherObstruction2'
  | 'pickoffCaughtStealing'
  | 'fieldersChoice'
  | 'outfieldAssist';

export type PlayCode = BattingPlayCode | PitchingPlayCode | FieldingPlayCode;

/** Why a baserunner was retired. 'caughtStealing' is the only reason that also counts as a CS. */
export type RunnerOutReason =
  | 'caughtStealing'
  | 'pickedOff'
  | 'thrownOut'
  | 'tagged'
  | 'forceOut'
  | 'passedRunner'
  | 'missedBase'
  | 'interference'
  | 'battedBall'
  | 'outOfBasePath'
  | 'abandonment'
  | 'coachAssistance'
  | 'other';

/** Official baseball rule (OBR) names for how a baserunner can be put out. */
export const RUNNER_OUT_REASONS: { code: RunnerOutReason; label: string; sub: string }[] = [
  { code: 'caughtStealing', label: 'Caught Stealing', sub: 'Tagged out on a steal · +1 CS' },
  { code: 'pickedOff', label: 'Pickoff', sub: 'Picked off a base' },
  { code: 'thrownOut', label: 'Tag Out on Extra-Base Attempt', sub: 'Hit, wild pitch, passed ball, error' },
  { code: 'tagged', label: 'Tag Out', sub: 'Off the base or in a rundown' },
  { code: 'forceOut', label: 'Force Out', sub: 'Forced to advance, base tagged first' },
  { code: 'passedRunner', label: 'Passing a Preceding Runner', sub: 'Passed the runner ahead' },
  { code: 'missedBase', label: 'Appeal: Missed / Retouch Base', sub: 'Missed a base or left early' },
  { code: 'interference', label: 'Runner Interference', sub: 'Hindered a fielder' },
  { code: 'battedBall', label: 'Struck by Batted Ball', sub: 'Hit by a fair ball' },
  { code: 'outOfBasePath', label: 'Out of the Base Path', sub: 'Ran out of the baseline' },
  { code: 'abandonment', label: 'Abandoning Base Path', sub: 'Left the bases, play live' },
  { code: 'coachAssistance', label: 'Base Coach Assistance', sub: 'Coach touched or helped runner' },
  { code: 'other', label: 'Other Out', sub: 'Any other reason' },
];

export type PitcherHand = 'R' | 'L';

export type DefensivePosition =
  | 'P'
  | 'C'
  | '1B'
  | '2B'
  | '3B'
  | 'SS'
  | 'LF'
  | 'CF'
  | 'RF'
  | 'DH'
  | 'BENCH';

export type HitTrajectory = 'grounder' | 'lineDrive' | 'flyBall' | 'popUp' | 'bunt';

export type HitFieldZone =
  | 'LF'
  | 'CF'
  | 'RF'
  | '3B'
  | 'SS'
  | '2B'
  | '1B'
  | 'P'
  | 'C';

export interface HitLocation {
  x: number; // 0 to 100 percentage of SVG field width
  y: number; // 0 to 100 percentage of SVG field height
  zone?: HitFieldZone;
  trajectory?: HitTrajectory;
  rbi?: boolean;
  rbiCount?: number;
}

/** The situation a batting out/reach was scored from (kept so the scoring decision can be audited or re-run). */
export interface PlayScoringContext {
  action: 'flyout' | 'groundout' | 'bunt' | 'strikeout' | 'hit' | 'walk';
  /** What the user asked for; 'auto' when the engine chose. */
  requested: string;
  outsBefore: 0 | 1 | 2;
  runners: { first: boolean; second: boolean; third: boolean };
  runnerScoredFrom3rd: boolean;
  runnersAdvancedSafely: boolean;
  leadRunnerPutOut: boolean;
  defensiveError: boolean;
  batterSafeAtFirst?: boolean;
  /** True when the engine replaced the user's selection because it contradicted the rules. */
  autoCorrected?: boolean;
}

export interface Play {
  id: string;
  inning: number;
  mode: PlayMode;
  code: PlayCode;
  timestamp?: number;
  pitcherHand?: PitcherHand; // Handedness of opposing pitcher when batting
  defensivePosition?: DefensivePosition; // Position played when fielding play occurred
  lineupSpot?: number; // Batting order position when this play occurred (1-10)
  hitLocation?: HitLocation; // Spray chart hit location & trajectory for batting plays
  extraOuts?: number; // Outs recorded on this play beyond what its code implies (e.g. a teammate retired on a fielder's choice)
  scoringContext?: PlayScoringContext; // Situation the smart-scoring engine used to validate this play
  errorType?: 'fielding' | 'throwing' | 'droppedCatch' | 'other'; // Detail for a reached-on-error batting play
  partOfMultiOutPlay?: boolean; // Player's putout/assist on a double play; its outs are already counted by the doublePlay play
  isExtraOut?: boolean; // For double/triple plays, marks secondary out so it doesn't count as an extra pitch
  multiOutPlayType?: 'doublePlay' | 'triplePlay'; // Identifies whether secondary outs belong to a DP or TP
  multiOutNumber?: 2 | 3; // The ordinal of this out within a multi-out play
  autoOutcome?: boolean; // For strikeout/walk auto-triggered by reaching 3 strikes / 4 balls
  runnerFromBase?: 1 | 2 | 3;
  runnerToBase?: 1 | 2 | 3 | 4;
  runnerAdvanceCause?: 'steal' | 'teammateHit' | 'balkPitchingError' | 'walk' | 'deadBall';
  runnerSubNumber?: string;
  runnerOutReason?: RunnerOutReason; // How a baserunner was retired (runnerOut plays)
  outReason?: 'batterRunnerInterference'; // Why the scored batter was recorded out
  // --- Pitching flow metadata (all optional so older saved games stay valid) ---
  groupId?: string; // plays created by one button press share a groupId so Undo removes them together
  pitchCounted?: boolean; // wild pitch / passed ball that already counts +1 pitch and +1 ball itself
  hitBases?: 1 | 2 | 3 | 4; // hit allowed: single / double / triple / home run
  pitcherAction?: 'fielded' | 'covered' | 'caught'; // how the pitcher was involved in the play
  throwTo?: string; // target base or unassisted if pitcher made throw
  assistBy?: DefensivePosition; // fielder who made the throw on a pitcher putout (e.g. 1B on a 3-1 play)
  pickoffKind?: 'pickoff' | 'caughtStealing'; // runner out recorded by the pitcher/catcher, no batter faced
  droppedThirdStrikeSafe?: boolean; // Uncaught 3rd strike where batter reached 1st base safely (K credited, no out recorded)
  wildPitchPitchType?: 'ball' | 'strike'; // Whether wild pitch was thrown as a ball or strike
  wildPitchRunnerMovement?: 'advanced' | 'scored' | 'out' | 'batterSafe1B'; // Runner movement result on wild pitch
}

/** A defensive position switch made part-way through an inning (e.g. CF to SS). */
export interface PositionChange {
  id: string;
  inning: number;
  from: DefensivePosition;
  to: DefensivePosition;
  timestamp: number;
}

export interface PlayerTeam {
  id: string;
  name: string;
  jerseyNumber?: string; // e.g. "24" or "7" (can change per team)
  ageGroup?: string; // e.g. "12U"
  season?: string; // e.g. "Spring 2026"
  tournament?: string; // e.g. "Triple Crown Classic"
  logo?: string; // Team logo, separate from the player's profile logo
  isDefault?: boolean;
}

export interface HalfInningStatus {
  battingCompleted?: boolean;
  fieldingCompleted?: boolean;
}

export interface Game {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  opponent?: string;
  finalResult?: string;
  teamName: string;
  isHome?: boolean; // true for Home team, false for Away team
  tournament?: string; // Tournament name or empty for league game
  ageGroup?: string; // e.g. "12U"
  season?: string; // e.g. "Spring 2026"
  innings: number; // The inning currently being scored
  maxInning?: number; // Furthest inning reached so far (the inning chevron cannot go past it)
  inningsManual?: boolean; // true when the innings count was set by hand (skips auto-trim on save)
  benchInnings: number[];
  fieldingPositions?: Record<number, DefensivePosition>; // Inning -> position currently held (latest if it changed mid-inning)
  positionChanges?: PositionChange[]; // Mid-inning position switches, in the order they happened
  lineupSpot?: number; // 1 to 10 (or 0 for sub)
  inningLineupSpots?: Record<number, number>; // Inning -> Batting Order Spot
  plays: Play[];
  playerId?: string;
  halfInningStatus?: Record<number, HalfInningStatus>;
}

export interface PlayerProfile {
  id: string;
  playerName: string;
  teamName: string;
  jerseyNumber?: string;
  isDefault?: boolean;
  teams?: PlayerTeam[]; // Multiple teams this player plays for
  defaultAgeGroup?: string;
  defaultSeason?: string;
  defaultTournament?: string;
  defaultLineupSpot?: number; // Default batting position / lineup spot (1-12)
  logo?: string; // Custom team logo (small PNG data URL). Falls back to the default logo when empty
}

export interface LineupSpotOption {
  spot: number;
  label: string;
  shortLabel: string;
}

export const LINEUP_SPOTS: LineupSpotOption[] = [
  { spot: 1, label: '1st · Leadoff', shortLabel: '#1' },
  { spot: 2, label: '2nd Spot', shortLabel: '#2' },
  { spot: 3, label: '3rd Spot', shortLabel: '#3' },
  { spot: 4, label: '4th · Clean-up', shortLabel: '#4' },
  { spot: 5, label: '5th Spot', shortLabel: '#5' },
  { spot: 6, label: '6th Spot', shortLabel: '#6' },
  { spot: 7, label: '7th Spot', shortLabel: '#7' },
  { spot: 8, label: '8th Spot', shortLabel: '#8' },
  { spot: 9, label: '9th Spot', shortLabel: '#9' },
  { spot: 10, label: '10th Spot', shortLabel: '#10' },
  { spot: 11, label: '11th Spot', shortLabel: '#11' },
  { spot: 12, label: '12th Spot', shortLabel: '#12' },
];

export interface GroupedStats {
  groupKey: string;
  groupLabel: string;
  gameCount: number;
  batting: BattingStats;
  pitching: PitchingStats;
  fielding: FieldingStats;
}

export interface AppSettings {
  inningsPerGame: number; // default 7
  homeRunAddsRunAndRbi: boolean; // default true
  darkMode: 'system' | 'light' | 'dark';
  hapticsEnabled: boolean;
  activePlayerId: string;
  pitchCountLimit: number; // default 85 (youth/highschool limit)
  trackHitLocation?: boolean; // default true - enables hit direction tapper prompt during batting
  gameRemindersEnabled?: boolean; // master switch for local upcoming-game notifications; defaults off
  venues?: string[]; // saved ballparks and fields managed in Settings
}

export interface BattingStats {
  games: number;
  pa: number; // Plate appearances
  ab: number; // At bats
  h: number; // Hits
  singles: number;
  doubles: number;
  triples: number;
  hr: number; // Home runs
  rbi: number; // Runs batted in
  r: number; // Runs scored
  bb: number; // Walks
  ibb: number; // Intentional walks
  so: number; // Strikeouts
  hbp: number; // Hit by pitch
  sf: number; // Sac flies
  sh: number; // Sacrifice bunts
  roe: number; // Reached on error
  fc: number; // Fielder's choice
  gidp: number; // Grounded into double play
  sb: number; // Stolen bases
  cs: number; // Caught stealing
  tb: number; // Total bases
  avg: number | null; // Batting average
  obp: number | null; // On-base percentage
  slg: number | null; // Slugging percentage
  ops: number | null; // OPS
}

export interface PitchingStats {
  games: number;
  outs: number;
  ipDisplay: string; // e.g. "2.1"
  era: number | null;
  whip: number | null;
  k: number; // strikeouts
  h: number; // hits allowed
  bb: number; // walks allowed
  ibb: number; // intentional walks allowed
  r: number; // runs allowed
  er: number; // earned runs
  hr: number; // home runs allowed
  hbp: number; // hit batters
  wp: number; // wild pitches
  bk: number; // balks
  pitchOuts: number;
  pickoffAttempts: number;
  pickoffOuts: number;
  pickoffSuccessRate: number | null;
  bf?: number; // batters faced
  // Pitch count & rest tracking
  pitches: number;
  balls: number;
  strikes: number;
  strikePercentage: number | null;
  restDaysRequired: number;
  nextEligibleDate?: string;
}

export interface FieldingStats {
  games: number;
  chances: number;
  po: number; // putouts
  a: number; // assists
  e: number; // errors
  dp: number; // double plays
  tp: number; // triple plays
  pb: number; // passed balls
  cs: number; // caught stealing
  sbAllowed: number; // steal allowed
  fpct: number | null; // Fielding percentage
}

export interface FieldingPositionStats {
  position: DefensivePosition;
  innings: number;
  chances: number;
  po: number;
  a: number;
  e: number;
  fpct: number | null;
}

export interface LineupSpotStats {
  spot: number;
  games: number;
  batting: BattingStats;
}

export interface PlayDefinition {
  code: PlayCode;
  mode: PlayMode;
  shortLabel: string;
  fullLabel: string;
  description: string;
  example: string;
  categoryColor: 'hit' | 'out' | 'walk' | 'run' | 'defense' | 'pitch' | 'neutral';
}