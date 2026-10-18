import type { RunnerOutReason } from '../types/baseball';

export type RunnerBase = 1 | 2 | 3;
export type RunnerAdvanceCause = 'steal' | 'teammateHit' | 'balkPitchingError' | 'walk' | 'deadBall';
export type RunnerLifecycleStatus = 'ON_BASE' | 'CLEARED';

/**
 * Deterministic runner FSM: the only legal forward movement is one base at a time.
 * A cleared runner cannot be advanced, scored, or outed again.
 */

export interface RunnerLifecycleState {
  status: RunnerLifecycleStatus;
  base: RunnerBase;
  sb: number;
  advanceCause: RunnerAdvanceCause;
  actionCount: number;
}

export type RunnerLifecycleAction =
  | { type: 'ADVANCE'; cause?: RunnerAdvanceCause }
  | { type: 'OUT'; reason?: RunnerOutReason }
  | { type: 'SCORE'; cause?: RunnerAdvanceCause }
  | { type: 'THIRD_OUT' }
  | { type: 'UNDO'; previous: RunnerLifecycleState };

export interface RunnerLifecycleEffect {
  type:
    | 'STOLEN_BASE'
    | 'RUNNER_ADVANCE'
    | 'RUN'
    | 'RUNNER_OUT'
    | 'LEFT_ON_BASE';
  fromBase?: RunnerBase;
  toBase?: RunnerBase;
  cause?: RunnerAdvanceCause;
  reason?: RunnerOutReason;
}

export interface RunnerLifecycleTransition {
  state: RunnerLifecycleState;
  effect?: RunnerLifecycleEffect;
  valid: boolean;
}

export function createRunnerLifecycle(base: RunnerBase, cause: RunnerAdvanceCause = 'steal'): RunnerLifecycleState {
  return { status: 'ON_BASE', base, sb: 0, advanceCause: cause, actionCount: 0 };
}

export function transitionRunner(
  state: RunnerLifecycleState,
  action: RunnerLifecycleAction
): RunnerLifecycleTransition {
  if (state.status === 'CLEARED' && action.type !== 'UNDO') {
    return { state, valid: false };
  }

  switch (action.type) {
    case 'ADVANCE': {
      if (state.base >= 3) return { state, valid: false };
      const cause = action.cause ?? state.advanceCause;
      const nextBase = (state.base + 1) as RunnerBase;
      return {
        valid: true,
        state: {
          ...state,
          base: nextBase,
          sb: state.sb + (cause === 'steal' ? 1 : 0),
          advanceCause: cause,
          actionCount: state.actionCount + 1,
        },
        effect:
          cause === 'steal'
            ? { type: 'STOLEN_BASE', fromBase: state.base, toBase: nextBase, cause }
            : { type: 'RUNNER_ADVANCE', fromBase: state.base, toBase: nextBase, cause },
      };
    }
    case 'OUT':
      return {
        valid: true,
        state: { ...state, status: 'CLEARED', actionCount: state.actionCount + 1 },
        effect: { type: 'RUNNER_OUT', fromBase: state.base, cause: state.advanceCause, reason: action.reason ?? 'other' },
      };
    case 'SCORE': {
      if (state.base !== 3) return { state, valid: false };
      const cause = action.cause ?? state.advanceCause;
      return {
        valid: true,
        state: {
          ...state,
          status: 'CLEARED',
          sb: state.sb + (cause === 'steal' ? 1 : 0),
          advanceCause: cause,
          actionCount: state.actionCount + 1,
        },
        effect: { type: 'RUN', fromBase: 3, cause },
      };
    }
    case 'THIRD_OUT':
      return {
        valid: true,
        state: { ...state, status: 'CLEARED', actionCount: state.actionCount + 1 },
        effect: { type: 'LEFT_ON_BASE', fromBase: state.base, cause: state.advanceCause },
      };
    case 'UNDO':
      return {
        valid: true,
        state: { ...action.previous },
      };
  }
}

export function getRunnerBaseForPrimary(code: string): RunnerBase | null {
  switch (code) {
    case 'double':
      return 2;
    case 'triple':
      return 3;
    case 'single':
    case 'walk':
    case 'intentionalWalk':
    case 'hbp':
    case 'reachedOnError':
    case 'fieldersChoice':
      return 1;
    default:
      return null;
  }
}

export function getRunnerBaseLabel(base: RunnerBase): string {
  return base === 1 ? '1B' : base === 2 ? '2B' : '3B';
}
