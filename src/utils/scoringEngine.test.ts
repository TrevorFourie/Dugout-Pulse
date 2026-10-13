/**
 * Run with:  npx tsx --test src/utils/scoringEngine.test.ts
 * (plain node:test + node:assert, so no extra test framework is required)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SCORING_CONTEXT,
  SCORING_MESSAGES,
  playOutCount,
  resolveScoringPlay,
  statLineFor,
  type ScoringContext,
  type ScoringOutcome,
} from './scoringEngine';

const ctx = (over: Partial<ScoringContext> & { r?: 'first' | 'second' | 'third' | 'all' | 'none' }): ScoringContext => {
  const { r, ...rest } = over;
  const runners = {
    first: r === 'first' || r === 'all',
    second: r === 'second' || r === 'all',
    third: r === 'third' || r === 'all',
  };
  return { ...DEFAULT_SCORING_CONTEXT, runners, ...rest };
};
const msgs = (res: ReturnType<typeof resolveScoringPlay>) => res.issues.map((i) => i.message);

// ───────────── A. Flyout vs Sacrifice Fly ─────────────

test('SF requested with 2 outs → error + reclassified as flyout (+1 AB)', () => {
  const res = resolveScoringPlay(
    ctx({ action: 'flyout', requested: 'sacFly', outs: 2, r: 'third', runnerScoredFrom3rd: true })
  );
  assert.equal(res.outcome, 'out');
  assert.equal(res.label, 'Flyout');
  assert.equal(res.autoCorrected, true);
  assert.ok(msgs(res).includes(SCORING_MESSAGES.sacFlyTwoOuts));
  assert.equal(res.stat.ab, 1);
  assert.equal(res.inningEnds, true);
  assert.equal(res.rbi, 0);
});

test('SF requested but no runner scored from 3rd → error + flyout', () => {
  const res = resolveScoringPlay(ctx({ action: 'flyout', requested: 'sacFly', outs: 1, r: 'third' }));
  assert.equal(res.outcome, 'out');
  assert.ok(msgs(res).includes(SCORING_MESSAGES.sacFlyNoRunnerScored));
  assert.equal(res.stat.ab, 1);
});

test('advancing from 1st/2nd does not qualify as SF', () => {
  const res = resolveScoringPlay(
    ctx({ action: 'flyout', requested: 'sacFly', outs: 0, r: 'all', runnersAdvancedSafely: true })
  );
  assert.equal(res.outcome, 'out');
  assert.ok(msgs(res).includes(SCORING_MESSAGES.sacFlyNoRunnerScored));
});

test('valid SF: <2 outs, runner scored from 3rd → SF, AB 0, 1 RBI', () => {
  for (const outs of [0, 1] as const) {
    const res = resolveScoringPlay(
      ctx({ action: 'flyout', requested: 'sacFly', outs, r: 'third', runnerScoredFrom3rd: true })
    );
    assert.equal(res.outcome, 'sacFly');
    assert.equal(res.autoCorrected, false);
    assert.equal(res.issues.length, 0);
    assert.deepEqual([res.stat.pa, res.stat.ab, res.stat.h], [1, 0, 0]);
    assert.equal(res.rbi, 1);
    assert.equal(res.inningEnds, false);
  }
});

test('explicit Flyout + <2 outs + runner scored → keeps Flyout but SUGGESTS SF', () => {
  const res = resolveScoringPlay(
    ctx({ action: 'flyout', requested: 'out', outs: 1, r: 'third', runnerScoredFrom3rd: true })
  );
  assert.equal(res.outcome, 'out');
  assert.equal(res.suggestion?.message, SCORING_MESSAGES.suggestSacFly);
  assert.equal(res.suggestion?.outcome, 'sacFly');
  // accepting the suggestion re-runs the engine with requested = sacFly
  const accepted = resolveScoringPlay({ ...res.context, requested: res.suggestion!.outcome });
  assert.equal(accepted.outcome, 'sacFly');
  assert.equal(accepted.suggestion, undefined);
});

test('Auto + <2 outs + runner scored → resolves straight to SF', () => {
  const res = resolveScoringPlay(
    ctx({ action: 'flyout', requested: 'auto', outs: 0, r: 'third', runnerScoredFrom3rd: true })
  );
  assert.equal(res.outcome, 'sacFly');
  assert.equal(res.stat.ab, 0);
});

test('flyout with 2 outs and a "runner scored" claim → run cleared (batter made the 3rd out)', () => {
  const res = resolveScoringPlay(
    ctx({ action: 'flyout', requested: 'auto', outs: 2, r: 'third', runnerScoredFrom3rd: true })
  );
  assert.equal(res.outcome, 'out');
  assert.equal(res.context.runnerScoredFrom3rd, false);
  assert.equal(res.rbi, 0);
});

test('dropped fly (error) → ROE, never SF', () => {
  const res = resolveScoringPlay(
    ctx({ action: 'flyout', requested: 'sacFly', outs: 0, r: 'third', runnerScoredFrom3rd: true, defensiveError: true })
  );
  assert.equal(res.outcome, 'reachedOnError');
  assert.equal(res.batterReaches, true);
  assert.equal(res.stat.onBase, false);
});

test('runner claimed to score with nobody on 3rd → cleared with error', () => {
  const res = resolveScoringPlay(
    ctx({ action: 'flyout', requested: 'auto', outs: 0, r: 'first', runnerScoredFrom3rd: true })
  );
  assert.equal(res.outcome, 'out');
  assert.ok(res.issues.some((i) => i.id === 'NO_RUNNER_ON_THIRD'));
});

// ───────────── B. Bunts ─────────────

test('SAC requested with 2 outs → error + Bunt Out (+1 AB)', () => {
  const res = resolveScoringPlay(
    ctx({ action: 'bunt', requested: 'sacBunt', outs: 2, r: 'first', runnersAdvancedSafely: true })
  );
  assert.equal(res.outcome, 'out');
  assert.equal(res.label, 'Bunt out');
  assert.ok(msgs(res).includes(SCORING_MESSAGES.sacBuntRequirements));
  assert.equal(res.stat.ab, 1);
});

test('SAC requested with no runners → error + Bunt Out', () => {
  const res = resolveScoringPlay(ctx({ action: 'bunt', requested: 'sacBunt', outs: 0, r: 'none' }));
  assert.equal(res.outcome, 'out');
  assert.ok(msgs(res).includes(SCORING_MESSAGES.sacBuntRequirements));
});

test('SAC requested but no runner advanced → Bunt Out', () => {
  const res = resolveScoringPlay(ctx({ action: 'bunt', requested: 'sacBunt', outs: 0, r: 'first' }));
  assert.equal(res.outcome, 'out');
  assert.ok(res.issues.some((i) => i.id === 'SAC_NO_ADVANCE'));
});

test('valid SAC bunt: <2 outs, runner on, batter out, runner advanced', () => {
  const res = resolveScoringPlay(
    ctx({ action: 'bunt', requested: 'sacBunt', outs: 1, r: 'first', runnersAdvancedSafely: true })
  );
  assert.equal(res.outcome, 'sacBunt');
  assert.deepEqual([res.stat.pa, res.stat.ab, res.stat.h], [1, 0, 0]);
  assert.equal(res.stat.obpDenominator, false);
  assert.equal(res.totalOuts, 1);
});

test('Auto bunt with runner advancing → SAC; explicit Bunt Out → suggests SAC', () => {
  const base = ctx({ action: 'bunt', outs: 0, r: 'second', runnersAdvancedSafely: true });
  assert.equal(resolveScoringPlay({ ...base, requested: 'auto' }).outcome, 'sacBunt');
  const out = resolveScoringPlay({ ...base, requested: 'out' });
  assert.equal(out.outcome, 'out');
  assert.equal(out.suggestion?.outcome, 'sacBunt');
});

test('bunt + lead runner put out (batter safe) → Fielder\'s Choice, 0 hits', () => {
  const res = resolveScoringPlay(
    ctx({ action: 'bunt', requested: 'sacBunt', outs: 0, r: 'first', batterSafeAtFirst: true, leadRunnerPutOut: true })
  );
  assert.equal(res.outcome, 'fieldersChoice');
  assert.deepEqual([res.stat.pa, res.stat.ab, res.stat.h], [1, 1, 0]);
  assert.equal(res.extraOuts, 1);
  assert.equal(res.outsAfter, 1);
});

test('bunt + batter safe + no error → Bunt Single (+1 AB, +1 H)', () => {
  const res = resolveScoringPlay(ctx({ action: 'bunt', requested: 'auto', outs: 1, r: 'none', batterSafeAtFirst: true }));
  assert.equal(res.outcome, 'single');
  assert.equal(res.label, 'Bunt single (1B)');
  assert.deepEqual([res.stat.ab, res.stat.h], [1, 1]);
  assert.equal(res.stat.baImpact, 'increases');
});

test('bunt + batter safe + error → ROE', () => {
  const res = resolveScoringPlay(ctx({ action: 'bunt', outs: 0, r: 'first', batterSafeAtFirst: true, defensiveError: true }));
  assert.equal(res.outcome, 'reachedOnError');
  assert.equal(res.stat.h, 0);
});

test('bunt where batter is out AND runner is out → double play (not a sacrifice)', () => {
  const res = resolveScoringPlay(ctx({ action: 'bunt', outs: 0, r: 'first', leadRunnerPutOut: true, runnersAdvancedSafely: true }));
  assert.equal(res.outcome, 'groundedIntoDoublePlay');
  assert.equal(res.totalOuts, 2);
  assert.equal(res.extraOuts, 0); // the code itself already counts as 2 outs
  assert.equal(playOutCount({ code: res.outcome, extraOuts: res.extraOuts }), 2);
});

test('SAC requested but batter reached safely → reclassified, not a sacrifice', () => {
  const res = resolveScoringPlay(
    ctx({ action: 'bunt', requested: 'sacBunt', outs: 0, r: 'first', batterSafeAtFirst: true, runnersAdvancedSafely: true })
  );
  assert.equal(res.outcome, 'single');
  assert.ok(res.issues.some((i) => i.id === 'SAC_BATTER_SAFE'));
});

// ───────────── C. FC vs ROE vs standard out ─────────────

test('ground ball: batter safe + runner out → FC (+1 PA +1 AB, 0 H)', () => {
  const res = resolveScoringPlay(ctx({ action: 'groundout', outs: 0, r: 'first', batterSafeAtFirst: true, leadRunnerPutOut: true }));
  assert.equal(res.outcome, 'fieldersChoice');
  assert.deepEqual([res.stat.pa, res.stat.ab, res.stat.h, res.stat.onBase], [1, 1, 0, false]);
});

test('ground ball: runner out AND error flagged → FC wins (spec order) with explanation', () => {
  const res = resolveScoringPlay(
    ctx({ action: 'groundout', outs: 0, r: 'first', batterSafeAtFirst: true, leadRunnerPutOut: true, defensiveError: true })
  );
  assert.equal(res.outcome, 'fieldersChoice');
  assert.ok(res.issues.some((i) => i.id === 'FC_OVER_ROE'));
});

test('ground ball: error → ROE; ROE does not count toward OBP numerator but is an AB', () => {
  const res = resolveScoringPlay(ctx({ action: 'groundout', outs: 1, batterSafeAtFirst: true, defensiveError: true }));
  assert.equal(res.outcome, 'reachedOnError');
  assert.deepEqual([res.stat.pa, res.stat.ab, res.stat.h, res.stat.onBase], [1, 1, 0, false]);
});

test('ground ball: batter out, nothing else → standard out', () => {
  const res = resolveScoringPlay(ctx({ action: 'groundout', outs: 0, r: 'none' }));
  assert.equal(res.outcome, 'out');
  assert.equal(res.label, 'Groundout');
  assert.deepEqual([res.stat.pa, res.stat.ab, res.stat.h], [1, 1, 0]);
});

test('requesting FC / ROE without the facts reclassifies with a reason', () => {
  const fc = resolveScoringPlay(ctx({ action: 'groundout', requested: 'fieldersChoice', outs: 0, r: 'first' }));
  assert.equal(fc.outcome, 'out');
  assert.ok(fc.issues.some((i) => i.id === 'FC_REQUIREMENTS'));
  const roe = resolveScoringPlay(ctx({ action: 'groundout', requested: 'reachedOnError', outs: 0, batterSafeAtFirst: true }));
  assert.equal(roe.outcome, 'single'); // safe, no error, no runner out → scored as a hit
  assert.ok(roe.issues.some((i) => i.id === 'ROE_REQUIREMENTS'));
});

test('ground-out RBI: runner scores from 3rd with <2 outs earns an RBI; DP does not', () => {
  const out = resolveScoringPlay(ctx({ action: 'groundout', outs: 0, r: 'third', runnerScoredFrom3rd: true }));
  assert.equal(out.outcome, 'out');
  assert.equal(out.rbi, 1);
  const dp = resolveScoringPlay(
    ctx({ action: 'groundout', outs: 0, r: 'all', runnerScoredFrom3rd: true, leadRunnerPutOut: true })
  );
  assert.equal(dp.outcome, 'groundedIntoDoublePlay');
  assert.equal(dp.rbi, 0);
});

// ───────────── Outs arithmetic / guards ─────────────

test('flyout + a second runner doubled off → 2 outs recorded, stored as extraOuts', () => {
  const res = resolveScoringPlay(ctx({ action: 'flyout', outs: 0, r: 'first', leadRunnerPutOut: true }));
  assert.equal(res.outcome, 'out');
  assert.equal(res.totalOuts, 2);
  assert.equal(res.extraOuts, 1);
  assert.equal(playOutCount({ code: res.outcome, extraOuts: res.extraOuts }), 2);
});

test('more than 3 outs on a play is blocked', () => {
  const res = resolveScoringPlay(ctx({ action: 'flyout', outs: 2, r: 'first', leadRunnerPutOut: true }));
  assert.equal(res.canConfirm, false);
  assert.ok(res.issues.some((i) => i.id === 'TOO_MANY_OUTS' && i.blocking));
});

test('the only runner cannot both score and be put out', () => {
  const res = resolveScoringPlay(ctx({ action: 'flyout', outs: 0, r: 'third', runnerScoredFrom3rd: true, leadRunnerPutOut: true }));
  assert.equal(res.canConfirm, false);
});

test('FC at 2 outs ends the inning with the runner out', () => {
  const res = resolveScoringPlay(ctx({ action: 'groundout', outs: 2, r: 'first', batterSafeAtFirst: true, leadRunnerPutOut: true }));
  assert.equal(res.outcome, 'fieldersChoice');
  assert.equal(res.inningEnds, true);
  assert.equal(res.canConfirm, true);
});

test('modifiers with no runners on base are ignored with a warning', () => {
  const res = resolveScoringPlay(ctx({ action: 'groundout', outs: 0, r: 'none', runnersAdvancedSafely: true, leadRunnerPutOut: true }));
  assert.equal(res.outcome, 'out');
  assert.equal(res.canConfirm, true);
  assert.ok(res.issues.some((i) => i.id === 'NO_RUNNERS_TO_PUT_OUT'));
});

// ───────────── Stat table (spec §3) ─────────────

test('statLineFor matches the spec table for every outcome', () => {
  const table: Array<[ScoringOutcome, [number, number, number], boolean, string]> = [
    ['single', [1, 1, 1], true, 'increases'],
    ['double', [1, 1, 1], true, 'increases'],
    ['triple', [1, 1, 1], true, 'increases'],
    ['homeRun', [1, 1, 1], true, 'increases'],
    ['walk', [1, 0, 0], true, 'none'],
    ['intentionalWalk', [1, 0, 0], true, 'none'],
    ['hbp', [1, 0, 0], true, 'none'],
    ['sacFly', [1, 0, 0], false, 'none'],
    ['sacBunt', [1, 0, 0], false, 'none'],
    ['fieldersChoice', [1, 1, 0], false, 'decreases'],
    ['reachedOnError', [1, 1, 0], false, 'decreases'],
    ['strikeout', [1, 1, 0], false, 'decreases'],
    ['out', [1, 1, 0], false, 'decreases'],
    ['groundedIntoDoublePlay', [1, 1, 0], false, 'decreases'],
  ];
  for (const [code, [pa, ab, h], onBase, ba] of table) {
    const s = statLineFor(code);
    assert.deepEqual([s.pa, s.ab, s.h], [pa, ab, h], code);
    assert.equal(s.onBase, onBase, code + ' onBase');
    assert.equal(s.baImpact, ba, code + ' baImpact');
  }
});

test('hits keep the explicit sub-type (double stays a double)', () => {
  const res = resolveScoringPlay(ctx({ action: 'hit', requested: 'double', hitType: 'double', outs: 1 }));
  assert.equal(res.outcome, 'double');
  assert.equal(res.stat.tb, 2);
});

test('playOutCount counts sacrifices (previously ignored by the inning out counter)', () => {
  assert.equal(playOutCount({ code: 'sacFly' }), 1);
  assert.equal(playOutCount({ code: 'sacBunt' }), 1);
  assert.equal(playOutCount({ code: 'strikeout' }), 1);
  assert.equal(playOutCount({ code: 'groundedIntoDoublePlay' }), 2);
  assert.equal(playOutCount({ code: 'fieldersChoice', extraOuts: 1 }), 1);
  assert.equal(playOutCount({ code: 'single' }), 0);
});

// ───────────── Exhaustive invariants ─────────────

test('invariants hold across the whole input space', () => {
  const bools = [false, true];
  const actions = ['flyout', 'groundout', 'bunt', 'strikeout', 'hit', 'walk'] as const;
  const requests: Array<ScoringContext['requested']> = ['auto', 'out', 'sacFly', 'sacBunt', 'fieldersChoice', 'reachedOnError', 'single'];
  let n = 0;
  for (const action of actions)
    for (const requested of requests)
      for (const outs of [0, 1, 2] as const)
        for (let mask = 0; mask < 8; mask++)
          for (const scored of bools)
            for (const adv of bools)
              for (const lead of bools)
                for (const err of bools)
                  for (const safe of bools) {
                    const res = resolveScoringPlay({
                      ...DEFAULT_SCORING_CONTEXT,
                      action,
                      requested,
                      outs,
                      runners: { first: !!(mask & 1), second: !!(mask & 2), third: !!(mask & 4) },
                      runnerScoredFrom3rd: scored,
                      runnersAdvancedSafely: adv,
                      leadRunnerPutOut: lead,
                      defensiveError: err,
                      batterSafeAtFirst: safe,
                    });
                    n++;
                    const c = res.context;
                    const tag = JSON.stringify({ action, requested, outs, mask, scored, adv, lead, err, safe });
                    // Sacrifices never charge an AB, and are only ever awarded under the rules.
                    if (res.outcome === 'sacFly') {
                      assert.equal(res.stat.ab, 0, tag);
                      assert.ok(outs < 2 && c.runnerScoredFrom3rd && c.runners.third && action === 'flyout', tag);
                    }
                    if (res.outcome === 'sacBunt') {
                      assert.equal(res.stat.ab, 0, tag);
                      assert.ok(outs < 2 && action === 'bunt' && !c.leadRunnerPutOut && c.runnersAdvancedSafely, tag);
                      assert.ok(c.runners.first || c.runners.second || c.runners.third, tag);
                    }
                    // AB is 0 exactly for sacs / walks / HBP.
                    const noAb = ['sacFly', 'sacBunt', 'walk', 'intentionalWalk', 'hbp'].includes(res.outcome);
                    assert.equal(res.stat.ab, noAb ? 0 : 1, tag);
                    assert.equal(res.stat.pa, 1, tag);
                    // Hits are the only outcome with H.
                    assert.equal(res.stat.h, ['single', 'double', 'triple', 'homeRun'].includes(res.outcome) ? 1 : 0, tag);
                    // Outs bookkeeping is consistent with the stored-play counter.
                    assert.equal(playOutCount({ code: res.outcome, extraOuts: res.extraOuts }), res.totalOuts, tag);
                    assert.equal(res.canConfirm, !res.issues.some((i) => i.blocking), tag);
                    // A non-blocked play can never exceed 3 outs, and a run never scores on a batter-made 3rd out.
                    if (res.canConfirm) assert.ok(res.outsAfter <= 3, tag);
                    if (res.canConfirm && c.runnerScoredFrom3rd) {
                      assert.ok(!(res.batterOuts === 1 && outs === 2), tag);
                    }
                    // FC always has a runner retired and the batter on base.
                    if (res.outcome === 'fieldersChoice') assert.ok(c.leadRunnerPutOut && res.batterReaches, tag);
                    // ROE/FC/K/Out never produce a hit.
                    // Resolving the already-resolved context is a fixed point.
                    const again = resolveScoringPlay({ ...c, requested: res.outcome });
                    assert.equal(again.outcome, res.outcome, tag);
                  }
  assert.ok(n > 10000);
});
