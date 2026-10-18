/**
 * Scoring validation engine for the single-player batting tracker.
 *
 * The tracker never sees a full two-team box score, so the official scoring decision (MLB Rule 9)
 * is rebuilt from a handful of lightweight facts: pre-play outs, which bases were occupied, and
 * four yes/no play modifiers. This module is deliberately pure (no React, no storage) so every
 * rule can be unit-tested and reused by the UI, the edit-play flow and any future import.
 *
 * Flow:   ScoringContext  ->  resolveScoringPlay()  ->  ScoringResolution
 *
 *  1. sanitize     – impossible/contradictory inputs are auto-cleared (with a message) or blocked.
 *  2. derive       – the "truth" outcome implied by the facts alone (what the scorer would rule).
 *  3. reconcile    – if the user *claimed* a stat (e.g. Sac Fly) that the facts don't support,
 *                    reclassify to the derived outcome and say why. If the user chose a plain Out
 *                    but the facts qualify for a sacrifice, keep their choice and *suggest* the SF/SH.
 *  4. statline     – map the final outcome to PA / AB / H / OBP / batting-average impact.
 */

import type { BattingPlayCode } from '../types/baseball';

// ───────────────────────────── Public types ─────────────────────────────

export type Outs = 0 | 1 | 2;

/** What physically happened first. Drives which context toggles the UI reveals. */
export type PrimaryAction = 'flyout' | 'groundout' | 'bunt' | 'strikeout' | 'hit' | 'walk';

/** The subset of play codes this engine can resolve to (all exist in BattingPlayCode). */
export type ScoringOutcome = Extract<
  BattingPlayCode,
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
  | 'fieldersChoice'
  | 'groundedIntoDoublePlay'
>;

export interface BaseRunners {
  first: boolean;
  second: boolean;
  third: boolean;
}

export interface ScoringContext {
  action: PrimaryAction;
  /**
   * The stat the user explicitly picked. `'auto'` lets the engine decide, so a parent never has to
   * know the official definition of a sacrifice or fielder's choice.
   */
  requested: 'auto' | ScoringOutcome;
  /** Outs BEFORE the pitch (0–2). */
  outs: Outs;
  /** Runners on base BEFORE the pitch. */
  runners: BaseRunners;

  // ── Play result modifiers ──
  /** A runner crossed the plate from 3rd base on this play. */
  runnerScoredFrom3rd: boolean;
  /** At least one runner advanced safely (any base, including scoring). */
  runnersAdvancedSafely: boolean;
  /** The lead runner was put out (thrown out / tagged / forced) on the play. */
  leadRunnerPutOut: boolean;
  /**
   * A fielder physically misplayed the ball (fumble, muff, wild/dropped throw) with ordinary effort
   * available. On a fly ball this means the ball was dropped and the batter reached.
   */
  defensiveError: boolean;

  /** Ground ball / bunt only: was the batter safe at 1st (true) or put out (false)? */
  batterSafeAtFirst?: boolean;
  /** `action === 'hit'` only. Defaults to a single. */
  hitType?: Extract<ScoringOutcome, 'single' | 'double' | 'triple' | 'homeRun'>;
  /** `action === 'walk'` only. Defaults to a walk. */
  walkType?: Extract<ScoringOutcome, 'walk' | 'intentionalWalk' | 'hbp'>;
}

export type IssueSeverity = 'error' | 'warn' | 'info';

export interface ScoringIssue {
  /** Stable machine id, handy for tests and analytics. */
  id: string;
  /**
   * `error`  – the selection contradicted the rules and was reclassified/cleared.
   * `warn`   – worth a second look, nothing was changed.
   * `info`   – the engine made an automatic decision for the user.
   */
  severity: IssueSeverity;
  message: string;
  /** Only the truly irreconcilable cases block saving. */
  blocking?: boolean;
}

export interface ScoringSuggestion {
  message: string;
  /** Accepting re-runs the engine with `requested = outcome`. */
  outcome: ScoringOutcome;
  acceptLabel: string;
}

export type BattingAverageImpact = 'increases' | 'decreases' | 'none';

export interface StatLine {
  pa: 0 | 1;
  ab: 0 | 1;
  h: 0 | 1;
  /** Total bases (for SLG). */
  tb: 0 | 1 | 2 | 3 | 4;
  /** Counts in the OBP numerator (H + BB + HBP). */
  onBase: boolean;
  /** Counts in the OBP denominator (AB + BB + HBP + SF). Sac flies sit here; sac bunts do not. */
  obpDenominator: boolean;
  baImpact: BattingAverageImpact;
  /** Plain-English line for the UI, e.g. "No at-bat — batting average protected". */
  summary: string;
}

export interface ScoringResolution {
  outcome: ScoringOutcome;
  label: string;
  shortLabel: string;
  stat: StatLine;

  batterReaches: boolean;
  /** Outs charged to the batter himself (0 or 1). */
  batterOuts: 0 | 1;
  /** Outs recorded on the play in total (batter + runners). */
  totalOuts: number;
  /**
   * Outs to store on the play record in addition to what the outcome code already implies
   * (`out`/`strikeout`/`sacFly`/`sacBunt` = 1, `groundedIntoDoublePlay` = 2). Use with {@link playOutCount}.
   */
  extraOuts: number;
  outsAfter: number;
  inningEnds: boolean;
  /** RBI to credit automatically (0 for hits/walks – those flows count RBI themselves). */
  rbi: number;

  /** The user's explicit selection was rejected and replaced. */
  autoCorrected: boolean;
  issues: ScoringIssue[];
  suggestion?: ScoringSuggestion;
  /** False only when an issue has `blocking: true`. */
  canConfirm: boolean;
  /** The context after impossible modifiers were cleared. */
  context: ScoringContext;
}

// ───────────────────────────── Constants & copy ─────────────────────────────

/** Exact wording requested for the rule violations / prompts. */
export const SCORING_MESSAGES = {
  sacFlyTwoOuts: 'Cannot record a Sacrifice Fly with 2 outs.',
  sacFlyNoRunnerScored: 'A runner must score from 3rd base for a Sacrifice Fly.',
  sacBuntRequirements: 'Sacrifice Bunt requires < 2 outs and runners on base.',
  suggestSacFly:
    "Runner scored from 3rd on a flyout with < 2 outs. Score as Sacrifice Fly (SF) to protect batter's average?",
  suggestSacBunt:
    "Runner advanced on a bunt with < 2 outs. Score as Sacrifice Bunt (SAC) to protect batter's average?",
} as const;

const OUTCOME_LABELS: Record<ScoringOutcome, { label: string; short: string }> = {
  single: { label: 'Single', short: '1B' },
  double: { label: 'Double', short: '2B' },
  triple: { label: 'Triple', short: '3B' },
  homeRun: { label: 'Home run', short: 'HR' },
  walk: { label: 'Walk', short: 'BB' },
  intentionalWalk: { label: 'Intentional walk', short: 'IBB' },
  hbp: { label: 'Hit by pitch', short: 'HBP' },
  strikeout: { label: 'Strikeout', short: 'K' },
  out: { label: 'Out', short: 'OUT' },
  sacFly: { label: 'Sacrifice fly', short: 'SF' },
  sacBunt: { label: 'Sacrifice bunt', short: 'SAC' },
  reachedOnError: { label: 'Reached on error', short: 'ROE' },
  fieldersChoice: { label: "Fielder's choice", short: 'FC' },
  groundedIntoDoublePlay: { label: 'Grounded into double play', short: 'GIDP' },
};

/** Outcomes where the batter is retired. */
const BATTER_OUT_OUTCOMES: ReadonlySet<ScoringOutcome> = new Set([
  'out',
  'strikeout',
  'sacFly',
  'sacBunt',
  'groundedIntoDoublePlay',
]);

const HIT_BASES = { single: 1, double: 2, triple: 3, homeRun: 4 } as const;

// ───────────────────────────── Small helpers ─────────────────────────────

export function outcomeLabel(outcome: ScoringOutcome, action?: PrimaryAction): string {
  // Context-aware names so the confirmation reads the way a parent would say it.
  if (action === 'flyout' && outcome === 'out') return 'Flyout';
  if (action === 'groundout' && outcome === 'out') return 'Groundout';
  if (action === 'bunt') {
    if (outcome === 'out') return 'Bunt out';
    if (outcome === 'single') return 'Bunt single (1B)';
    if (outcome === 'sacBunt') return 'Sacrifice bunt (SAC)';
  }
  if (outcome === 'sacFly') return 'Sacrifice fly (SF)';
  if (outcome === 'fieldersChoice') return "Fielder's choice (FC)";
  if (outcome === 'reachedOnError') return 'Reached on error (ROE)';
  return OUTCOME_LABELS[outcome].label;
}

export function outcomeShortLabel(outcome: ScoringOutcome): string {
  return OUTCOME_LABELS[outcome].short;
}

function runnerCount(r: BaseRunners): number {
  return Number(r.first) + Number(r.second) + Number(r.third);
}

/** Does this action leave the batter retired, absent an error? Used to spot a batter-made 3rd out. */
function batterRetiredByAction(ctx: ScoringContext): boolean {
  switch (ctx.action) {
    case 'strikeout':
      return true;
    case 'flyout':
      return !ctx.defensiveError;
    case 'groundout':
    case 'bunt':
      return !ctx.batterSafeAtFirst;
    default:
      return false;
  }
}

// ───────────────────────────── Stat mapping ─────────────────────────────

/** Table from the spec: validated outcome → PA / AB / H / OBP / BA impact. */
export function statLineFor(outcome: ScoringOutcome): StatLine {
  switch (outcome) {
    case 'single':
    case 'double':
    case 'triple':
    case 'homeRun':
      return {
        pa: 1,
        ab: 1,
        h: 1,
        tb: HIT_BASES[outcome],
        onBase: true,
        obpDenominator: true,
        baImpact: 'increases',
        summary: 'Hit — at-bat and hit charged, batting average goes up',
      };
    case 'walk':
    case 'intentionalWalk':
    case 'hbp':
      return {
        pa: 1,
        ab: 0,
        h: 0,
        tb: 0,
        onBase: true,
        obpDenominator: true,
        baImpact: 'none',
        summary: 'No at-bat — batting average unchanged, on-base % goes up',
      };
    case 'sacFly':
      return {
        pa: 1,
        ab: 0,
        h: 0,
        tb: 0,
        onBase: false,
        obpDenominator: true,
        baImpact: 'none',
        summary: 'No at-bat — batting average protected',
      };
    case 'sacBunt':
      return {
        pa: 1,
        ab: 0,
        h: 0,
        tb: 0,
        onBase: false,
        obpDenominator: false,
        baImpact: 'none',
        summary: 'No at-bat — batting average protected',
      };
    case 'fieldersChoice':
    case 'reachedOnError':
    case 'strikeout':
    case 'out':
    case 'groundedIntoDoublePlay':
      return {
        pa: 1,
        ab: 1,
        h: 0,
        tb: 0,
        onBase: false,
        obpDenominator: true,
        baImpact: 'decreases',
        summary: 'At-bat charged, no hit — batting average goes down',
      };
  }
}

/**
 * Outs implied by a stored batting play. Single source of truth for the inning out counter so that
 * sacrifices and fielder's-choice plays are no longer silently ignored.
 */
export function playOutCount(play: { code: string; extraOuts?: number; droppedThirdStrikeSafe?: boolean }): number {
  if (play.code === 'strikeout' && play.droppedThirdStrikeSafe) return Math.max(0, play.extraOuts ?? 0);
  const base =
    play.code === 'groundedIntoDoublePlay'
      ? 2
      : play.code === 'out' ||
        play.code === 'strikeout' ||
        play.code === 'sacFly' ||
        play.code === 'sacBunt' ||
        play.code === 'runnerOut'
      ? 1
      : 0;
  return base + Math.max(0, play.extraOuts ?? 0);
}

// ───────────────────────────── Core resolution ─────────────────────────────

interface Derived {
  outcome: ScoringOutcome;
  /** Why a non-obvious outcome was chosen (shown as an info note when the user chose Auto). */
  note?: string;
}

/** What the facts alone say the scorer would rule. Expects a sanitized context. */
function deriveOutcome(ctx: ScoringContext): Derived {
  const hasRunners = runnerCount(ctx.runners) > 0;

  switch (ctx.action) {
    case 'hit':
      return { outcome: ctx.hitType ?? 'single' };
    case 'walk':
      return { outcome: ctx.walkType ?? 'walk' };
    case 'strikeout':
      return { outcome: 'strikeout' };

    case 'flyout': {
      if (ctx.defensiveError) {
        return { outcome: 'reachedOnError', note: 'Fly ball was misplayed and the batter reached.' };
      }
      if (ctx.outs < 2 && ctx.runnerScoredFrom3rd) {
        return {
          outcome: 'sacFly',
          note: 'Runner scored from 3rd on a caught fly with < 2 outs — scored as a Sacrifice Fly.',
        };
      }
      return { outcome: 'out' };
    }

    case 'groundout':
    case 'bunt': {
      const isBunt = ctx.action === 'bunt';
      if (!ctx.batterSafeAtFirst) {
        if (ctx.leadRunnerPutOut) {
          return {
            outcome: 'groundedIntoDoublePlay',
            note: 'Batter and a runner were both retired — scored as a double play.',
          };
        }
        if (isBunt && ctx.outs < 2 && hasRunners && ctx.runnersAdvancedSafely) {
          return {
            outcome: 'sacBunt',
            note: 'Batter out at 1st and a runner advanced with < 2 outs — scored as a Sacrifice Bunt.',
          };
        }
        return { outcome: 'out' };
      }
      // Batter safe at 1st
      if (ctx.leadRunnerPutOut) {
        return {
          outcome: 'fieldersChoice',
          note: "Batter reached while the defense retired a runner — scored as a Fielder's Choice.",
        };
      }
      if (ctx.defensiveError) {
        return { outcome: 'reachedOnError', note: 'Batter reached because of a defensive error.' };
      }
      return {
        outcome: 'single',
        note: isBunt
          ? 'Batter safe at 1st with no error and no runner retired — scored as a Bunt Single.'
          : 'Batter safe at 1st with no error and no runner retired — scored as a hit.',
      };
    }
  }
}

/** Why `requested` is not supported by the facts, in the user's language. */
function explainMismatch(
  requested: ScoringOutcome,
  ctx: ScoringContext,
  derived: ScoringOutcome
): ScoringIssue[] {
  const issue = (id: string, message: string): ScoringIssue[] => [{ id, severity: 'error', message }];
  const hasRunners = runnerCount(ctx.runners) > 0;

  switch (requested) {
    case 'sacFly': {
      if (ctx.action !== 'flyout') return issue('SF_NOT_FLY', 'A Sacrifice Fly requires a fly ball caught for an out.');
      if (ctx.defensiveError) {
        return issue('SF_ERROR', 'The fly ball was misplayed (batter reached), so it cannot be a Sacrifice Fly.');
      }
      const out: ScoringIssue[] = [];
      if (ctx.outs === 2) out.push({ id: 'SF_TWO_OUTS', severity: 'error', message: SCORING_MESSAGES.sacFlyTwoOuts });
      if (ctx.outs < 2 && !ctx.runnerScoredFrom3rd) {
        out.push({ id: 'SF_NO_RUN', severity: 'error', message: SCORING_MESSAGES.sacFlyNoRunnerScored });
      }
      return out;
    }

    case 'sacBunt': {
      if (ctx.action !== 'bunt') return issue('SAC_NOT_BUNT', 'A Sacrifice Bunt requires a bunt.');
      if (ctx.outs === 2 || !hasRunners) {
        return issue('SAC_REQUIREMENTS', SCORING_MESSAGES.sacBuntRequirements);
      }
      if (ctx.batterSafeAtFirst) {
        return issue('SAC_BATTER_SAFE', 'A Sacrifice Bunt requires the batter to be put out at 1st.');
      }
      if (ctx.leadRunnerPutOut) {
        return issue('SAC_RUNNER_OUT', 'No sacrifice is credited when a runner is put out on the play.');
      }
      return issue('SAC_NO_ADVANCE', 'A Sacrifice Bunt requires at least one runner to advance safely.');
    }

    case 'fieldersChoice':
      return issue(
        'FC_REQUIREMENTS',
        ctx.batterSafeAtFirst || ctx.action === 'hit'
          ? "A Fielder's Choice requires a runner to be put out while the batter reaches base."
          : "A Fielder's Choice requires the batter to reach base safely."
      );

    case 'reachedOnError':
      return issue(
        'ROE_REQUIREMENTS',
        ctx.defensiveError
          ? 'Reached on Error requires the batter to reach base safely.'
          : 'Reached on Error requires a defensive physical error.'
      );

    case 'out':
      return issue(
        'OUT_MISMATCH',
        derived === 'single'
          ? 'The batter was safe at 1st with no error and no runner retired, so this is a hit, not an out.'
          : 'The batter reached base on this play, so it cannot be scored as a standard out.'
      );

    default:
      return issue(
        'REQUEST_MISMATCH',
        `${OUTCOME_LABELS[requested].label} doesn't match what happened on the play.`
      );
  }
}

export function resolveScoringPlay(input: ScoringContext): ScoringResolution {
  const issues: ScoringIssue[] = [];
  const ctx: ScoringContext = {
    ...input,
    runners: { ...input.runners },
    batterSafeAtFirst: input.action === 'groundout' || input.action === 'bunt' ? !!input.batterSafeAtFirst : undefined,
  };
  const runnersOn = runnerCount(ctx.runners);

  // ── 1. Sanitize ───────────────────────────────────────────────────────────────

  if (ctx.runnerScoredFrom3rd && !ctx.runners.third) {
    issues.push({
      id: 'NO_RUNNER_ON_THIRD',
      severity: 'error',
      message: 'No runner was on 3rd base, so no runner could score from 3rd.',
    });
    ctx.runnerScoredFrom3rd = false;
  }
  if (ctx.runnerScoredFrom3rd && batterRetiredByAction(ctx) && ctx.outs === 2) {
    issues.push({
      id: 'RUN_ON_THIRD_OUT',
      severity: 'error',
      message: "A run can't score on a play where the batter makes the 3rd out, so no run is credited.",
    });
    ctx.runnerScoredFrom3rd = false;
  }
  if (runnersOn === 0 && ctx.runnersAdvancedSafely) {
    issues.push({
      id: 'NO_RUNNERS_TO_ADVANCE',
      severity: 'warn',
      message: 'There were no runners on base, so "runners advanced" was ignored.',
    });
    ctx.runnersAdvancedSafely = false;
  }
  // A runner who scored obviously advanced.
  if (ctx.runnerScoredFrom3rd && !ctx.runnersAdvancedSafely) ctx.runnersAdvancedSafely = true;

  if (runnersOn === 0 && ctx.leadRunnerPutOut) {
    issues.push({
      id: 'NO_RUNNERS_TO_PUT_OUT',
      severity: 'warn',
      message: 'There were no runners on base, so "runner put out" was ignored.',
    });
    ctx.leadRunnerPutOut = false;
  }

  let blocked = false;
  if (ctx.leadRunnerPutOut && ctx.runnerScoredFrom3rd && runnersOn === 1) {
    issues.push({
      id: 'SAME_RUNNER_SCORED_AND_OUT',
      severity: 'error',
      blocking: true,
      message: 'The only runner on base cannot both score and be put out. Change one of the two answers.',
    });
    blocked = true;
  }

  // Error flag only matters when the batter reaches (or the fly is dropped).
  const errorIsRelevant =
    ctx.action === 'flyout' ||
    ((ctx.action === 'groundout' || ctx.action === 'bunt') && ctx.batterSafeAtFirst);
  if (ctx.defensiveError && !errorIsRelevant && ctx.action !== 'hit' && ctx.action !== 'walk') {
    issues.push({
      id: 'ERROR_NO_EFFECT',
      severity: 'info',
      message: "An error on a play where the batter was out or struck out doesn't change the batter's line.",
    });
  }

  // ── 2. Derive ────────────────────────────────────────────────────────────────

  const derived = deriveOutcome(ctx);
  let outcome = derived.outcome;
  let autoCorrected = false;
  let suggestion: ScoringSuggestion | undefined;

  // ── 3. Reconcile with an explicit request ───────────────────────────────────

  const requested = ctx.requested;
  if (requested !== 'auto' && requested !== derived.outcome) {
    const sacDerived = derived.outcome === 'sacFly' || derived.outcome === 'sacBunt';
    const requestedPlainOut = requested === 'out' && sacDerived;
    const requestedHitInstead =
      (ctx.action === 'hit' || ctx.action === 'walk') &&
      (requested === 'single' || requested === 'double' || requested === 'triple' || requested === 'homeRun' ||
        requested === 'walk' || requested === 'intentionalWalk' || requested === 'hbp');

    if (requestedHitInstead) {
      // On a hit/walk the explicit sub-type *is* the answer (single vs double etc.).
      outcome = requested;
    } else if (requestedPlainOut) {
      // The user deliberately scored an out; the facts qualify for a sacrifice. Keep their choice, ask.
      outcome = 'out';
      suggestion =
        derived.outcome === 'sacFly'
          ? { message: SCORING_MESSAGES.suggestSacFly, outcome: 'sacFly', acceptLabel: 'Yes, score as Sac Fly' }
          : { message: SCORING_MESSAGES.suggestSacBunt, outcome: 'sacBunt', acceptLabel: 'Yes, score as Sac Bunt' };
    } else {
      autoCorrected = true;
      issues.push(...explainMismatch(requested, ctx, derived.outcome));
    }
  } else if (requested === 'auto' && derived.note) {
    issues.push({ id: 'AUTO_' + derived.outcome.toUpperCase(), severity: 'info', message: derived.note });
  }

  // Both ROE and FC apply → spec precedence is FC; tell the user the error flag was set aside.
  if (
    outcome === 'fieldersChoice' &&
    ctx.defensiveError &&
    (ctx.action === 'groundout' || ctx.action === 'bunt')
  ) {
    issues.push({
      id: 'FC_OVER_ROE',
      severity: 'info',
      message: "A runner was retired as well, so this is scored as a Fielder's Choice rather than an error.",
    });
  }

  // ── 4. Outs, RBI, stat line ─────────────────────────────────────────────────

  const batterOuts: 0 | 1 = BATTER_OUT_OUTCOMES.has(outcome) ? 1 : 0;
  // GIDP's second out *is* the lead runner, so it must not be counted twice.
  const runnerOuts = ctx.leadRunnerPutOut ? 1 : 0;
  const totalOuts = batterOuts + runnerOuts;
  const extraOuts = outcome === 'groundedIntoDoublePlay' ? 0 : runnerOuts;
  const outsAfter = ctx.outs + totalOuts;

  if (outsAfter > 3) {
    issues.push({
      id: 'TOO_MANY_OUTS',
      severity: 'error',
      blocking: true,
      message: `That play would make ${outsAfter} outs in the inning. Only ${3 - ctx.outs} out${
        3 - ctx.outs === 1 ? '' : 's'
      } remain — check the outs count or the runner-out answer.`,
    });
    blocked = true;
  }

  if (ctx.runnerScoredFrom3rd && outsAfter >= 3 && !BATTER_OUT_OUTCOMES.has(outcome) && ctx.leadRunnerPutOut) {
    issues.push({
      id: 'TIME_PLAY',
      severity: 'warn',
      message: "Third out was made on a runner. The run only counts if it crossed the plate first and the out wasn't a force play.",
    });
  }

  // RBI: automatic only where the play itself decides it. Hit/walk flows already ask for RBI count.
  let rbi = 0;
  const runCounts = ctx.runnerScoredFrom3rd && !(outsAfter >= 3 && ctx.leadRunnerPutOut);
  if (runCounts) {
    if (outcome === 'sacFly' || outcome === 'sacBunt' || outcome === 'fieldersChoice') rbi = 1;
    else if (outcome === 'out' && ctx.action !== 'flyout' && ctx.outs < 2) rbi = 1; // ground-out RBI
    else if (outcome === 'single' && (ctx.action === 'groundout' || ctx.action === 'bunt')) rbi = 1;
    // GIDP & ROE: no RBI by rule 9.04(b)
  }

  const stat = statLineFor(outcome);
  const batterReaches = !BATTER_OUT_OUTCOMES.has(outcome);

  return {
    outcome,
    label: outcomeLabel(outcome, ctx.action),
    shortLabel: outcomeShortLabel(outcome),
    stat,
    batterReaches,
    batterOuts,
    totalOuts,
    extraOuts,
    outsAfter,
    inningEnds: outsAfter >= 3,
    rbi,
    autoCorrected,
    issues,
    suggestion,
    canConfirm: !blocked,
    context: ctx,
  };
}

// ───────────────────────────── UI helpers ─────────────────────────────

export const DEFAULT_SCORING_CONTEXT: ScoringContext = {
  action: 'flyout',
  requested: 'auto',
  outs: 0,
  runners: { first: false, second: false, third: false },
  runnerScoredFrom3rd: false,
  runnersAdvancedSafely: false,
  leadRunnerPutOut: false,
  defensiveError: false,
  batterSafeAtFirst: false,
};

/** Which "Score it as…" choices make sense for each action. `auto` is always first. */
export const REQUESTABLE_OUTCOMES: Record<PrimaryAction, ScoringOutcome[]> = {
  flyout: ['out', 'sacFly'],
  groundout: ['out', 'fieldersChoice', 'reachedOnError'],
  bunt: ['out', 'sacBunt', 'fieldersChoice', 'reachedOnError', 'single'],
  strikeout: [],
  hit: [],
  walk: [],
};

/** Which context questions to reveal for an action — drives the interactive state machine. */
export interface ContextFields {
  runners: boolean;
  runnerScored: boolean;
  runnersAdvanced: boolean;
  leadRunnerOut: boolean;
  defensiveError: boolean;
  batterSafe: boolean;
}

export function visibleFields(ctx: Pick<ScoringContext, 'action' | 'runners' | 'batterSafeAtFirst'>): ContextFields {
  const anyRunner = ctx.runners.first || ctx.runners.second || ctx.runners.third;
  const batterBat = ctx.action === 'groundout' || ctx.action === 'bunt';
  return {
    runners: true,
    batterSafe: batterBat,
    runnerScored: ctx.runners.third && ctx.action !== 'walk',
    runnersAdvanced: anyRunner && (ctx.action === 'bunt' || ctx.action === 'groundout' || ctx.action === 'flyout'),
    leadRunnerOut: anyRunner,
    defensiveError:
      ctx.action === 'flyout' || ((ctx.action === 'groundout' || ctx.action === 'bunt') && !!ctx.batterSafeAtFirst),
  };
}
