import { DefensivePosition, Play, PlayCode, PlayMode } from '../types/baseball';

/**
 * Pitching flow state machine.
 *
 * Everything here is a pure function. The live game is event-sourced from its `plays`, so the
 * pitcher's state (count, pitch totals, batters faced, outs, earned-run context ...) is always
 * *derived* by folding the plays - never stored separately. That is what makes Undo, delete and
 * edit safe: remove a play and the state simply re-derives.
 *
 *   derivePitchingFlowState(plays, inning)  ->  state
 *   reducePitchingAction(state, action)     ->  { seeds, state, inningOver }
 *
 * A "seed" is a play that has not been stored yet. The UI appends the seeds as one group.
 */

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

export type PlaySeed = Pick<Play, 'mode' | 'code'> &
  Partial<
    Pick<
      Play,
      | 'isExtraOut'
      | 'autoOutcome'
      | 'defensivePosition'
      | 'pitchCounted'
      | 'hitBases'
      | 'pitcherAction'
      | 'throwTo'
      | 'assistBy'
      | 'pickoffKind'
      | 'droppedThirdStrikeSafe'
      | 'wildPitchPitchType'
      | 'wildPitchRunnerMovement'
    >
  >;

/** Minimal shape the fold needs; a stored Play satisfies it. */
type FoldablePlay = PlaySeed & { inning?: number };

export interface PitchingFlowState {
  inning: number;

  // Current batter
  balls: number;
  strikes: number;
  batterPitches: number;

  // Game totals (these match calculatePitchingStats for the same plays)
  pitches: number;
  ballsTotal: number;
  strikesTotal: number;
  bf: number; // batters faced
  totalOuts: number; // outs recorded by the pitcher in the whole game

  // Pickoff tracking
  pickoffAttempts: number;
  pickoffOuts: number;

  // Current inning
  outs: number; // outs recorded while pitching in this inning
  phantomOuts: number; // outs the defense would have made but for an error
  unearnedCredits: number; // runners who reached / advanced thanks to an error or passed ball

  // Run accounting
  r: number;
  er: number;
  ur: number;

  // Pitcher fielding (fielding plays recorded at 'P')
  po: number;
  a: number;
  pitcherErrors: number;
}

export type InPlayOutcome =
  | 'out'
  | 'hit'
  | 'fieldersChoice'
  | 'error'
  | 'hitBatter'
  | 'intentionalWalk';

export type PitcherFieldingAction = 'fielded' | 'covered' | 'caught';
export type ThrowTarget = 'unassisted' | '1B' | '2B' | '3B' | 'HOME';

export interface InPlaySelection {
  outcome: InPlayOutcome;
  /** 1 single, 2 double, 3 triple, 4 home run (hit outcome only). */
  hitBases?: 1 | 2 | 3 | 4;
  /** Runs that scored on the play. A home run always includes the batter. */
  runs?: number;
  /** Optional multi-out play (outcome 'out'). */
  extraOuts?: 'none' | 'doublePlay' | 'triplePlay';
  /** Step 2: was the pitcher directly involved in fielding / receiving the ball? */
  pitcherInvolved?: boolean;
  /** Step 3 */
  pitcherAction?: PitcherFieldingAction;
  /** Step 3, 'fielded': where the pitcher threw (or 'unassisted' if he made the out himself). */
  throwTo?: ThrowTarget;
  /** Step 3, 'covered': the fielder who threw to the covering pitcher (default 1B for a 3-1 play). */
  assistFrom?: DefensivePosition;
}

export type PitchingAction =
  | { type: 'BALL' }
  | { type: 'STRIKE' }
  | { type: 'THIRD_STRIKE'; result: 'out' | 'droppedSafe' }
  | { type: 'FOUL' }
  | {
      type: 'WILD_PITCH';
      pitchType?: 'ball' | 'strike';
      runnerMovement?: 'advanced' | 'scored' | 'out' | 'batterSafe1B';
      modifier?: 'standard' | 'runScored' | 'runnerOut';
      runs?: number;
      outs?: number;
      droppedThirdStrikeSafe?: boolean;
    }
  | { type: 'PASSED_BALL' }
  | { type: 'BALK' }
  | { type: 'PICKOFF'; result: 'out' | 'safe'; kind?: 'pickoff' | 'caughtStealing'; throwTo?: string }
  | { type: 'IN_PLAY'; selection: InPlaySelection }
  | { type: 'RUN'; runs: number; forceUnearned?: boolean; runType?: 'earned' | 'unearned' };

export interface PitchingReduction {
  seeds: PlaySeed[];
  state: PitchingFlowState;
  /** The pitcher's third out was recorded; the caller should offer / start the next inning. */
  inningOver: boolean;
  /** The inning ended on a runner out (pickoff / caught stealing): the batter did NOT complete a PA. */
  endedOnRunnerOut: boolean;
}

// ---------------------------------------------------------------------------------------------
// State fold
// ---------------------------------------------------------------------------------------------

export function createPitchingFlowState(inning = 1): PitchingFlowState {
  return {
    inning,
    balls: 0,
    strikes: 0,
    batterPitches: 0,
    pitches: 0,
    ballsTotal: 0,
    strikesTotal: 0,
    bf: 0,
    totalOuts: 0,
    pickoffAttempts: 0,
    pickoffOuts: 0,
    outs: 0,
    phantomOuts: 0,
    unearnedCredits: 0,
    r: 0,
    er: 0,
    ur: 0,
    po: 0,
    a: 0,
    pitcherErrors: 0,
  };
}

/** Move to a new inning: inning-level context and the batter's count reset. */
function rollToInning(state: PitchingFlowState, inning: number): PitchingFlowState {
  if (state.inning === inning) return state;
  return {
    ...state,
    inning,
    balls: 0,
    strikes: 0,
    batterPitches: 0,
    outs: 0,
    phantomOuts: 0,
    unearnedCredits: 0,
  };
}

/** The plate appearance is over: a fresh batter steps in with an 0-0 count. */
function endPlateAppearance(state: PitchingFlowState): PitchingFlowState {
  return { ...state, balls: 0, strikes: 0, batterPitches: 0, bf: state.bf + 1 };
}

/** Fold one play (stored or seed) into the state. */
export function applyPlayToState(prev: PitchingFlowState, play: FoldablePlay): PitchingFlowState {
  let s = play.inning !== undefined ? rollToInning(prev, play.inning) : prev;

  // Pitcher fielding credits (fielding plays recorded at the pitcher position)
  if (play.mode === 'fielding') {
    if (play.defensivePosition !== 'P') return s;
    if (play.code === 'putout') return { ...s, po: s.po + 1 };
    if (play.code === 'assist') return { ...s, a: s.a + 1 };
    if (play.code === 'error') return { ...s, pitcherErrors: s.pitcherErrors + 1 };
    return s;
  }
  if (play.mode !== 'pitching') return s;

  const withPitch = (isBall: boolean, isStrike: boolean): PitchingFlowState => ({
    ...s,
    pitches: s.pitches + 1,
    ballsTotal: s.ballsTotal + (isBall ? 1 : 0),
    strikesTotal: s.strikesTotal + (isStrike ? 1 : 0),
    batterPitches: s.batterPitches + 1,
  });

  // A pitch that is put in play (hit, out, error, fielder's choice) is a pitch thrown, but it is
  // not recorded as a called / swinging strike: it moves pitches and batterPitches only.
  const withInPlayPitch = (): PitchingFlowState => withPitch(false, false);

  switch (play.code) {
    case 'pitchBall':
      s = withPitch(true, false);
      return { ...s, balls: Math.min(4, s.balls + 1) };
    case 'pitchStrike':
      s = withPitch(false, true);
      return { ...s, strikes: Math.min(3, s.strikes + 1) };
    case 'pitchFoul':
      s = withPitch(false, true);
      return { ...s, strikes: Math.min(2, s.strikes + 1) };
    case 'pitchOther':
      return withPitch(false, false);

    case 'wildPitch':
      if (!play.pitchCounted) return s; // legacy: the ball was entered separately
      if (play.wildPitchPitchType === 'strike') {
        s = withPitch(false, true);
        return { ...s, strikes: Math.min(3, s.strikes + 1) };
      }
      s = withPitch(true, false);
      return { ...s, balls: Math.min(4, s.balls + 1) };
    case 'passedBall':
      // A passed ball is a runner-advancement event on a pitch, not a called ball: it adds the
      // pitch (pitches, batterPitches) but leaves the batter's count and ballsTotal untouched.
      s = withPitch(false, false);
      // The runner moved because of a defensive fault -> the run is not earned.
      return { ...s, unearnedCredits: s.unearnedCredits + 1 };

    case 'strikeout':
      // autoOutcome: strike three was already counted by the pitchStrike / wildPitch that triggered it, so this
      // seed only ends the plate appearance (count reset, +1 batter faced) and records the out (unless dropped 3rd strike safe).
      if (!play.autoOutcome) s = withPitch(false, true);
      s = endPlateAppearance(s);
      if (play.droppedThirdStrikeSafe) {
        // Catcher dropped 3rd strike; batter reached 1st safely.
        // K is credited (via stats calculation), but NO out is credited.
        return { ...s, unearnedCredits: s.unearnedCredits + 1 };
      }
      return { ...s, outs: s.outs + 1, totalOuts: s.totalOuts + 1 };
    case 'walkAllowed':
      // autoOutcome: ball four was already counted by the pitchBall that triggered it, so this
      // seed only ends the plate appearance. It never adds a second pitch or ball.
      if (play.autoOutcome) return endPlateAppearance(s);
      return endPlateAppearance(withPitch(true, false));
    case 'intentionalWalkAllowed':
      return endPlateAppearance(s); // no pitches thrown
    case 'hitBatter':
      s = withPitch(true, false);
      return endPlateAppearance(s);

    case 'hitAllowed':
    case 'homeRunAllowed':
      s = withInPlayPitch();
      return endPlateAppearance(s);
    case 'reachedOnError':
      s = withInPlayPitch();
      s = endPlateAppearance(s);
      // The batter would have been out: the inning is "extended" and his run is unearned.
      return { ...s, phantomOuts: s.phantomOuts + 1, unearnedCredits: s.unearnedCredits + 1 };
    case 'fieldersChoice':
      s = withInPlayPitch();
      return endPlateAppearance(s); // the out itself is a separate pitchOut / isExtraOut play

    case 'pickoffAttempt':
      return { ...s, pickoffAttempts: s.pickoffAttempts + 1 };

    case 'pitchOut':
      if (play.isExtraOut) {
        // Secondary out (double / triple play), pickoff or caught stealing: no pitch, no batter.
        const isPickoff = play.pickoffKind === 'pickoff';
        return {
          ...s,
          outs: s.outs + 1,
          totalOuts: s.totalOuts + 1,
          pickoffAttempts: isPickoff ? s.pickoffAttempts + 1 : s.pickoffAttempts,
          pickoffOuts: isPickoff ? s.pickoffOuts + 1 : s.pickoffOuts,
        };
      }
      s = withInPlayPitch(); // a batted ball fielded for an out: a pitch, not a strike
      s = endPlateAppearance(s);
      return { ...s, outs: s.outs + 1, totalOuts: s.totalOuts + 1 };

    case 'runAllowed': // unearned run
      return {
        ...s,
        r: s.r + 1,
        ur: s.ur + 1,
        unearnedCredits: Math.max(0, s.unearnedCredits - 1),
      };
    case 'earnedRun':
      return { ...s, r: s.r + 1, er: s.er + 1 };
    default:
      return s; // balk, etc.: no count / pitch change
  }
}

/** Derive the pitcher state from the plays of the game, positioned at `currentInning`. */
export function derivePitchingFlowState(plays: Play[], currentInning: number): PitchingFlowState {
  let state = createPitchingFlowState(plays.length > 0 ? plays[0].inning : currentInning);
  for (const play of plays) state = applyPlayToState(state, play);
  return rollToInning(state, currentInning);
}

/** Balls/strikes of the batter currently at the plate, derived from the plays. */
export function deriveBatterCount(plays: Play[], currentInning: number): { balls: number; strikes: number } {
  const s = derivePitchingFlowState(plays, currentInning);
  return { balls: s.balls, strikes: s.strikes };
}

// ---------------------------------------------------------------------------------------------
// Earned / unearned classification
// ---------------------------------------------------------------------------------------------

/**
 * Decide whether the next run charged to the pitcher is earned.
 *
 * Simplified "reconstruct the inning without the errors" rule (OBR 9.16). We do not track
 * individual runners, so:
 *  - once outs + outs-that-an-error-denied reaches 3, the inning should already be over, so any
 *    further run is unearned (this includes a home run batter's own run); and
 *  - a run by a runner already on base is unearned while a runner who reached (or advanced) on an
 *    error / passed ball is still owed ("unearnedCredits").
 *
 * `batterHomeRun` marks the batter's OWN run on a home run. The batter reached on his own swing,
 * not on a defensive fault, so a pending unearned credit (which belongs to a runner already on
 * base) is never spent on him.
 */
export function classifyRun(
  state: PitchingFlowState,
  opts: { batterHomeRun?: boolean } = {}
): 'earned' | 'unearned' {
  if (state.outs + state.phantomOuts >= 3) return 'unearned';
  if (opts.batterHomeRun) return 'earned';
  if (state.unearnedCredits > 0) return 'unearned';
  return 'earned';
}

// ---------------------------------------------------------------------------------------------
// Action -> seeds
// ---------------------------------------------------------------------------------------------

const pitching = (code: PlayCode, extra: Partial<PlaySeed> = {}): PlaySeed => ({ mode: 'pitching', code, ...extra });
const fielding = (code: PlayCode, extra: Partial<PlaySeed> = {}): PlaySeed => ({
  mode: 'fielding' as PlayMode,
  code,
  defensivePosition: 'P',
  ...extra,
});

/** Run the seeds through the state, injecting auto walk / strikeout when the count requires it. */
function foldSeeds(start: PitchingFlowState, inputSeeds: PlaySeed[]): { seeds: PlaySeed[]; state: PitchingFlowState } {
  const seeds: PlaySeed[] = [];
  let state = start;
  const push = (seed: PlaySeed) => {
    seeds.push(seed);
    state = applyPlayToState(state, seed);
  };
  for (const seed of inputSeeds) {
    push(seed);
    // Ball four / strike three end the plate appearance automatically: no extra tap needed.
    // (A passed ball no longer adds a ball to the count, so it can never trigger a walk by itself.)
    const isBallPitch = seed.mode === 'pitching' && (seed.code === 'pitchBall' || (seed.code === 'wildPitch' && seed.wildPitchPitchType !== 'strike'));
    const isStrikePitch = seed.mode === 'pitching' && (seed.code === 'pitchStrike' || (seed.code === 'wildPitch' && seed.wildPitchPitchType === 'strike'));

    if (isBallPitch && state.balls >= 4) {
      if (!inputSeeds.some((s) => s.code === 'walkAllowed')) {
        push(pitching('walkAllowed', { autoOutcome: true }));
      }
    } else if (isStrikePitch && state.strikes >= 3) {
      const hasExplicitStrikeout = inputSeeds.some((s) => s.code === 'strikeout');
      if (!hasExplicitStrikeout) {
        push(pitching('strikeout', { autoOutcome: true }));
      }
    }
  }
  return { seeds, state };
}

/** Run seeds for runs scoring, classifying each as earned / unearned against the live state. */
function runSeeds(
  state: PitchingFlowState,
  runs: number,
  forceUnearned = false,
  forceEarned = false
): { seeds: PlaySeed[]; state: PitchingFlowState } {
  const seeds: PlaySeed[] = [];
  let s = state;
  for (let i = 0; i < Math.max(0, Math.floor(runs)); i++) {
    const kind = forceEarned ? 'earned' : forceUnearned ? 'unearned' : classifyRun(s);
    const seed = pitching(kind === 'earned' ? 'earnedRun' : 'runAllowed');
    seeds.push(seed);
    s = applyPlayToState(s, seed);
  }
  return { seeds, state: s };
}

/**
 * Pitcher fielding credits for a play in which an out (or error) was made.
 *
 *  - fielded + threw to a base  -> Assist (A) to the pitcher; the putout belongs to the receiver
 *  - fielded + made the play himself (tag / step on the bag) -> Putout (PO)
 *  - covered a base (3-1 play)  -> Putout (PO) to the pitcher, the Assist goes to the thrower
 *  - caught a fly / popup       -> Putout (PO), unassisted
 *  - on an error, the pitcher is charged with the error instead of a putout / assist
 */
export function pitcherFieldingSeeds(sel: InPlaySelection): PlaySeed[] {
  if (!sel.pitcherInvolved || !sel.pitcherAction) return [];
  if (sel.outcome !== 'out' && sel.outcome !== 'fieldersChoice' && sel.outcome !== 'error') return [];

  if (sel.outcome === 'error') {
    return [fielding('error', { pitcherAction: sel.pitcherAction })];
  }

  const out: PlaySeed[] = [];
  switch (sel.pitcherAction) {
    case 'caught':
      out.push(fielding('putout', { pitcherAction: 'caught' }));
      break;
    case 'covered':
      out.push(fielding('putout', { pitcherAction: 'covered', assistBy: sel.assistFrom ?? '1B' }));
      break;
    case 'fielded': {
      const target = sel.throwTo ?? 'unassisted';
      if (target === 'unassisted') out.push(fielding('putout', { pitcherAction: 'fielded' }));
      else out.push(fielding('assist', { pitcherAction: 'fielded' }));
      break;
    }
  }
  if (sel.outcome === 'out') {
    if (sel.extraOuts === 'doublePlay') out.push(fielding('doublePlay'));
    if (sel.extraOuts === 'triplePlay') out.push(fielding('triplePlay'));
  }
  return out;
}

function inPlaySeeds(state: PitchingFlowState, sel: InPlaySelection): { seeds: PlaySeed[]; state: PitchingFlowState } {
  const batted: PlaySeed[] = [];
  let runs = sel.runs ?? 0;

  switch (sel.outcome) {
    case 'out': {
      batted.push(
        pitching('pitchOut', {
          pitcherAction: sel.pitcherAction,
          throwTo: sel.throwTo,
          assistBy: sel.assistFrom,
        })
      );
      const extra = sel.extraOuts === 'triplePlay' ? 2 : sel.extraOuts === 'doublePlay' ? 1 : 0;
      for (let i = 0; i < extra; i++) batted.push(pitching('pitchOut', { isExtraOut: true }));
      break;
    }
    case 'hit': {
      const bases = sel.hitBases ?? 1;
      batted.push(pitching(bases === 4 ? 'homeRunAllowed' : 'hitAllowed', { hitBases: bases }));
      if (bases === 4) runs = Math.max(1, runs); // the batter always scores on a home run
      break;
    }
    case 'fieldersChoice':
      // Batter reaches, the defense retires another runner.
      batted.push(pitching('fieldersChoice'));
      batted.push(pitching('pitchOut', { isExtraOut: true }));
      break;
    case 'error':
      batted.push(pitching('reachedOnError'));
      break;
    case 'hitBatter':
      batted.push(pitching('hitBatter'));
      break;
    case 'intentionalWalk':
      batted.push(pitching('intentionalWalkAllowed'));
      break;
  }

  const all: PlaySeed[] = [...batted, ...pitcherFieldingSeeds(sel)];
  const folded = foldSeeds(state, all);

  const isHomeRun = sel.outcome === 'hit' && (sel.hitBases ?? 1) === 4;
  if (!isHomeRun) {
    const ran = runSeeds(folded.state, runs);
    return { seeds: [...folded.seeds, ...ran.seeds], state: ran.state };
  }

  // Home run: the runners already on base are classified against the live state (so a runner who
  // reached on an error stays unearned), then the batter's own run is charged on its own merit.
  const runners = runSeeds(folded.state, Math.max(0, runs - 1));
  const batterKind = classifyRun(runners.state, { batterHomeRun: true });
  const batterSeed = pitching(batterKind === 'earned' ? 'earnedRun' : 'runAllowed');
  return {
    seeds: [...folded.seeds, ...runners.seeds, batterSeed],
    state: applyPlayToState(runners.state, batterSeed),
  };
}

/**
 * The pitching state machine. Every pitch-outcome action implicitly adds its pitch(es), so the
 * scorer never has to tap a separate "+1 Pitch".
 *
 *  BALL / STRIKE / FOUL  +1 pitch; ball 4 -> walk, strike 3 -> strikeout, both automatic
 *  WILD_PITCH            +1 pitch, +1 ball, counts a wild pitch
 *  PASSED_BALL           +1 pitch, NOT a ball in the count, NOT charged to the pitcher, following runs unearned
 *  BALK                  +0 pitches
 *  PICKOFF attempt/out   +0 pitches; safe adds attempt seed; out adds extra out (+ assist if pickoff)
 *  IN_PLAY               +1 pitch included in the resulting outcome (out, hit, FC, error, HBP);
 *                        a batted ball adds the pitch but is not counted as a strike
 *  RUN                   run(s) scored on a non-batted play (WP, PB, BK, steal ...)
 */
export function reducePitchingAction(prev: PitchingFlowState, action: PitchingAction): PitchingReduction {
  let result: { seeds: PlaySeed[]; state: PitchingFlowState };
  let endedOnRunnerOut = false;

  switch (action.type) {
    case 'BALL':
      result = foldSeeds(prev, [pitching('pitchBall')]);
      break;
    case 'STRIKE':
      result = foldSeeds(prev, [pitching('pitchStrike')]);
      break;
    case 'THIRD_STRIKE': {
      const isSafe = action.result === 'droppedSafe';
      result = foldSeeds(prev, [
        pitching('pitchStrike'),
        pitching('strikeout', { autoOutcome: true, droppedThirdStrikeSafe: isSafe }),
      ]);
      break;
    }
    case 'FOUL':
      result = foldSeeds(prev, [pitching('pitchFoul')]);
      break;
    case 'WILD_PITCH': {
      const pitchType = action.pitchType ?? 'ball';
      const isStrike = pitchType === 'strike';
      const modifier = action.modifier ?? (action.runnerMovement === 'scored' ? 'runScored' : action.runnerMovement === 'out' ? 'runnerOut' : 'standard');
      const isThrownOut = modifier === 'runnerOut' || action.runnerMovement === 'out';

      // Rule 9.13 Exception:
      // If a runner is thrown out attempting to advance, NO Wild Pitch is charged (-1 WP net shift back to 0).
      // Pitcher is credited with pitch thrown (ball or strike) and the out (+1 Out recorded / +0.1 IP).
      if (isThrownOut) {
        const outCount = Math.max(1, Math.min(2, action.outs ?? 1));
        const outSeeds: PlaySeed[] = [];
        if (isStrike && prev.strikes >= 2) {
          // Batter swung at 3rd strike and was thrown out at 1st base (+1 K, +1 Out, 0 WP)
          outSeeds.push(
            pitching('pitchStrike'),
            pitching('strikeout', { autoOutcome: true, droppedThirdStrikeSafe: false })
          );
          if (outCount >= 2) {
            outSeeds.push(pitching('pitchOut', { isExtraOut: true }));
          }
          result = foldSeeds(prev, outSeeds);
        } else {
          // Standard pitch + runner(s) thrown out (+1 Ball or +1 Strike, +1 or +2 Outs, 0 WP)
          const pitchSeed = isStrike ? pitching('pitchStrike') : pitching('pitchBall');
          outSeeds.push(pitchSeed);
          for (let i = 0; i < outCount; i++) {
            outSeeds.push(pitching('pitchOut', { isExtraOut: true }));
          }
          result = foldSeeds(prev, outSeeds);
        }
      } else {
        // Standard Wild Pitch (+1 WP credited)
        const isRunScored = modifier === 'runScored' || action.runnerMovement === 'scored';
        const runnerMovement = isRunScored ? 'scored' : (action.runnerMovement ?? 'advanced');

        const wpSeed = pitching('wildPitch', {
          pitchCounted: true,
          wildPitchPitchType: pitchType,
          wildPitchRunnerMovement: runnerMovement,
        });

        const initialSeeds: PlaySeed[] = [wpSeed];

        // If wild pitch was on strike 3, add strikeout (batter safe OR out at 1st base)
        if (isStrike && prev.strikes >= 2) {
          const isSafe = action.droppedThirdStrikeSafe !== false;
          initialSeeds.push(
            pitching('strikeout', { autoOutcome: true, droppedThirdStrikeSafe: isSafe })
          );
        }

        const folded = foldSeeds(prev, initialSeeds);

        if (isStrike && folded.state.strikes >= 3) {
          const hasExplicitStrikeout = folded.seeds.some((s) => s.code === 'strikeout');
          if (!hasExplicitStrikeout) {
            const isSafe = action.droppedThirdStrikeSafe !== false;
            const strikeoutSeed = pitching('strikeout', { autoOutcome: true, droppedThirdStrikeSafe: isSafe });
            
            // Append the strikeout seed and re-evaluate state
            folded.seeds.push(strikeoutSeed);
            folded.state = applyPlayToState(folded.state, strikeoutSeed);
          }
        }

        if (isRunScored) {
          const runs = action.runs ?? 1;
          const ran = runSeeds(folded.state, runs);
          result = {
            seeds: [...folded.seeds, ...ran.seeds],
            state: ran.state,
          };
        } else {
          result = folded;
        }
      }
      break;
    }
    case 'PASSED_BALL':
      result = foldSeeds(prev, [pitching('passedBall')]);
      break;
    case 'BALK':
      result = foldSeeds(prev, [pitching('balk')]);
      break;
    case 'PICKOFF': {
      const kind = action.kind ?? 'pickoff';
      const throwTo = action.throwTo || '1B';
      if (action.result === 'safe') {
        result = foldSeeds(prev, [pitching('pickoffAttempt', { pickoffKind: kind, throwTo })]);
        break;
      }
      const seeds: PlaySeed[] = [pitching('pitchOut', { isExtraOut: true, pickoffKind: kind, throwTo })];
      // The pitcher's throw on a pickoff is an assist; the receiving fielder gets the putout.
      if (kind === 'pickoff') seeds.push(fielding('assist'));
      result = foldSeeds(prev, seeds);
      endedOnRunnerOut = result.state.outs >= 3;
      break;
    }
    case 'IN_PLAY':
      result = inPlaySeeds(prev, action.selection);
      break;
    case 'RUN':
      result = runSeeds(
        prev,
        action.runs,
        action.runType ? action.runType === 'unearned' : Boolean(action.forceUnearned),
        action.runType === 'earned'
      );
      break;
  }

  // 3rd out by a runner (pickoff / CS): the count resets for the next inning's lead-off batter
  // (rollToInning does that) and no plate appearance / batter faced was recorded.
  return {
    seeds: result.seeds,
    state: result.state,
    inningOver: result.state.outs >= 3,
    endedOnRunnerOut,
  };
}

/** Human readable preview of a run that is about to be charged (used in the UI). */
export function describeNextRun(state: PitchingFlowState): string {
  return classifyRun(state) === 'earned' ? 'Earned run (ER)' : 'Unearned run (R)';
}