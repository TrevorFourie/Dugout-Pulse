import type { DefensivePosition, PlayCode, PlayMode, PitcherHand } from '../../types/baseball';
import type { RunnerAdvanceCause, RunnerLifecycleState } from '../../utils/runnerLifecycle';
import { recordDiagnosticError } from '../../utils/errorDiagnostics';

export const DEFENSIVE_POSITIONS: { code: DefensivePosition; label: string }[] = [
  { code: 'P', label: 'Pitcher (P)' },
  { code: 'C', label: 'Catcher (C)' },
  { code: '1B', label: '1st Base (1B)' },
  { code: '2B', label: '2nd Base (2B)' },
  { code: '3B', label: '3rd Base (3B)' },
  { code: 'SS', label: 'Shortstop (SS)' },
  { code: 'LF', label: 'Left Field (LF)' },
  { code: 'CF', label: 'Center Field (CF)' },
  { code: 'RF', label: 'Right Field (RF)' },
  { code: 'DH', label: 'Designated Hitter (DH)' },
  { code: 'BENCH', label: 'Bench / Rest' },
];

export const PRIMARY_BATTING_CODES: PlayCode[] = [
  'single', 'double', 'triple', 'homeRun', 'walk', 'hbp', 'out', 'catchersInterference',
];

export const CATCHER_FIELDING_CODES: PlayCode[] = [
  'passedBall', 'catcherGloveDeadBall', 'caughtStealing', 'stealAllowed',
  'catchersInterference', 'pickoff', 'droppedThirdStrike', 'defensiveIndifference',
  'catcherObstruction', 'catcherObstruction2', 'pickoffCaughtStealing', 'wildPitch', 'balk',
];

export const RUNNER_ON_CODES = new Set<PlayCode>([
  'single', 'double', 'triple', 'walk', 'intentionalWalk', 'hbp', 'reachedOnError', 'fieldersChoice', 'runnerAdvance',
]);
export const NON_PRIMARY_BATTING = new Set<PlayCode>([
  'rbi', 'run', 'stolenBase', 'cs', 'runnerAdvance', 'runnerOut', 'leftOnBase', 'runnerHold', 'runnerInjury',
]);

export const PITCHING_TERMINAL_CODES = new Set<PlayCode>([
  'strikeout',
  'walkAllowed',
  'intentionalWalkAllowed',
  'hitBatter',
  'hitAllowed',
  'homeRunAllowed',
  'pitchOut',
]);

const POSITION_NAMES: Record<string, string> = {
  P: 'Pitcher',
  C: 'Catcher',
  '1B': 'First base',
  '2B': 'Second base',
  '3B': 'Third base',
  SS: 'Shortstop',
  LF: 'Left field',
  CF: 'Center field',
  RF: 'Right field',
  DH: 'Designated hitter',
  BENCH: 'Bench',
  HOME: 'Home plate',
};
export const positionName = (code?: string): string => (code ? POSITION_NAMES[code] || code : '');

export const RESUME_UI_STORAGE_KEY = 'dugout_pulse_resume_ui_v1';

export const RUNNER_WORKFLOW_STORAGE_KEY = 'dugout_pulse_runner_workflow_v1';
export type PersistedScoreUi = Record<string, { viewedInning?: number; activeMode?: PlayMode; pitcherHand?: PitcherHand }>;
export type PersistedRunnerWorkflow = {
  runnerSessions: Record<string, RunnerLifecycleState | null>;
  runnerHistories: Record<string, { state: RunnerLifecycleState; playIds: string[] }[]>;
  activeRunnerChips: Record<string, { inning: number; base: 1 | 2 | 3; sb: number; cause: RunnerAdvanceCause; subNumber?: string }>;
};
export const readLocalJson = <T,>(key: string, fallback: T): T => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (error) {
    try {
      recordDiagnosticError('storage_read', error, 'Saved score UI data could not be read. The original stored value was left untouched.');
    } catch {
      // Keep the fallback available even if diagnostic recording is unavailable.
    }
    return fallback;
  }
  if (!raw) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Saved score UI data had an unexpected format.');
    }
    return { ...fallback as object, ...parsed } as T;
  } catch (error) {
    try {
      recordDiagnosticError('data_corruption', error, 'Saved score UI data could not be parsed or had an unexpected format. The original stored value was left untouched; a fallback was used only for this read.');
    } catch {
      // Keep the fallback available even if diagnostic recording is unavailable.
    }
    return fallback;
  }
};
export const ordinal = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'}`;
};

export type MultiOutPlayAction = 'catch' | 'tag' | 'step' | 'throw';

export const DOUBLE_PLAY_ACTIONS: { action: MultiOutPlayAction; title: string; description: string }[] = [
  { action: 'catch', title: 'Caught the ball', description: 'Caught a fly ball or line drive for an out (Putout)' },
  { action: 'step', title: 'Stepped on a base / tagged a runner', description: 'Recorded an out by force, tag, or doubling off a runner (Putout)' },
  { action: 'throw', title: 'Threw to a base', description: 'Made a throw that helped complete the play (Assist)' },
];

// Keep actions general rather than naming bases or runner destinations, so this covers
// different triple-play sequences without assuming a specific starting situation.
export const TRIPLE_PLAY_ACTIONS: { action: MultiOutPlayAction; title: string; description: string }[] = [
  { action: 'catch', title: 'Caught the ball', description: 'Caught a fly ball or line drive for an out (Putout)' },
  { action: 'tag', title: 'Tagged a runner', description: 'Recorded an out by tagging a runner (Putout)' },
  { action: 'step', title: 'Stepped on a base', description: 'Recorded an out by touching a base, including a force or appeal play (Putout)' },
  { action: 'throw', title: 'Threw the ball', description: 'Made a throw that helped complete the play (Assist)' },
];
