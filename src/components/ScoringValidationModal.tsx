import React, { useEffect, useMemo, useReducer, useRef } from 'react';
import { AlertTriangle, Check, ChevronLeft, Info, Minus, TrendingDown, TrendingUp, X } from 'lucide-react';
import {
  DEFAULT_SCORING_CONTEXT,
  resolveScoringPlay,
  visibleFields,
  type Outs,
  type PrimaryAction,
  type ScoringContext,
  type ScoringIssue,
  type ScoringResolution,
} from '../utils/scoringEngine';

/**
 * Interactive scoring state machine.
 *
 *   PICK_ACTION ──select──▶ CONTEXT ──confirm──▶ onConfirm(resolution)
 *        ▲                    │
 *        └────────back────────┘
 *
 * In CONTEXT the questions shown depend on the chosen action and on which bases are occupied
 * (e.g. "Runner scored from 3rd?" only exists when a runner is on 3rd). Every change re-runs the
 * pure engine, so the outcome card, AB/PA/H chips and any rule warnings are always live.
 */

type Step = 'PICK_ACTION' | 'CONTEXT';

interface State {
  step: Step;
  ctx: ScoringContext;
}

type Event =
  | { type: 'SELECT_ACTION'; action: PrimaryAction }
  | { type: 'BACK' }
  | { type: 'SET_OUTS'; outs: Outs }
  | { type: 'TOGGLE_RUNNER'; base: 'first' | 'second' | 'third' }
  | {
      type: 'SET_FLAG';
      flag: 'runnerScoredFrom3rd' | 'runnersAdvancedSafely' | 'leadRunnerPutOut' | 'defensiveError' | 'batterSafeAtFirst';
      value: boolean;
    }
  ;

function reducer(state: State, event: Event): State {
  switch (event.type) {
    case 'SELECT_ACTION': {
      // A fresh action starts from a clean slate (keeping outs + bases, which are game facts).
      return {
        step: 'CONTEXT',
        ctx: {
          ...DEFAULT_SCORING_CONTEXT,
          outs: state.ctx.outs,
          runners: state.ctx.runners,
          action: event.action,
          runnerScoredFrom3rd: false,
        },
      };
    }
    case 'BACK':
      return { ...state, step: 'PICK_ACTION' };
    case 'SET_OUTS':
      return { ...state, ctx: { ...state.ctx, outs: event.outs } };
    case 'TOGGLE_RUNNER': {
      const runners = { ...state.ctx.runners, [event.base]: !state.ctx.runners[event.base] };
      const any = runners.first || runners.second || runners.third;
      return {
        ...state,
        ctx: {
          ...state.ctx,
          runners,
          // Dependent answers disappear with the runner they depended on.
          runnerScoredFrom3rd: runners.third ? state.ctx.runnerScoredFrom3rd : false,
          runnersAdvancedSafely: any ? state.ctx.runnersAdvancedSafely : false,
          leadRunnerPutOut: any ? state.ctx.leadRunnerPutOut : false,
        },
      };
    }
    case 'SET_FLAG': {
      const next: ScoringContext = { ...state.ctx, [event.flag]: event.value };
      // Scoring from 3rd means a runner advanced.
      if (event.flag === 'runnerScoredFrom3rd' && event.value) next.runnersAdvancedSafely = true;
      // The error question only exists when the batter reached.
      if (event.flag === 'batterSafeAtFirst' && !event.value && next.action !== 'flyout') next.defensiveError = false;
      return { ...state, ctx: next };
    }
  }
}

// ─────────────────────────── small presentational pieces ───────────────────────────

const ACTIONS: Array<{ action: PrimaryAction; title: string; hint: string }> = [
  { action: 'flyout', title: 'Flyout', hint: 'Fly ball, pop-up or line drive in the air' },
  { action: 'groundout', title: 'Ground ball', hint: 'Grounder fielded by the defense' },
  { action: 'bunt', title: 'Bunt', hint: 'Sacrifice, bunt single or bunt out' },
  { action: 'strikeout', title: 'Strikeout', hint: 'Three strikes' },
];

const ACTION_TITLES: Record<PrimaryAction, string> = {
  flyout: 'Flyout',
  groundout: 'Ground ball',
  bunt: 'Bunt',
  strikeout: 'Strikeout',
  hit: 'Hit',
  walk: 'Walk',
};

// One button style for every choice in this modal (outs, bases, yes/no, batter result) and for the footer actions.
const BTN_BASE =
  'w-full min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold text-center transition-colors active:scale-[0.97] cursor-pointer';
const BTN_ON = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-[#00BFA5] dark:border-[#00D7BC]';
const BTN_OFF =
  'bg-white dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border-slate-300 dark:border-[#354050] hover:bg-slate-100 dark:hover:bg-[#354050]/70';

const Question: React.FC<{ label: string; help?: string; children: React.ReactNode }> = ({ label, help, children }) => (
  <div className="space-y-1.5">
    <div className="text-[13px] font-semibold text-slate-900 dark:text-[#FAFAFA]">{label}</div>
    {help && <div className="text-xs text-slate-500 dark:text-[#9CA3AF] -mt-0.5">{help}</div>}
    {children}
  </div>
);

interface ChoiceOption<T extends string | number | boolean> {
  value: T;
  label: string;
}

/** Equal-width, single-select button row. `multi` rows (bases) use aria-pressed toggles instead. */
function ChoiceGroup<T extends string | number | boolean>({
  label,
  help,
  options,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <Question label={label} help={help}>
      <div
        className={`grid gap-2 ${options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`${BTN_BASE} ${value === o.value ? BTN_ON : BTN_OFF}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Question>
  );
}

const YES_NO: ChoiceOption<boolean>[] = [
  { value: false, label: 'No' },
  { value: true, label: 'Yes' },
];

const IssueRow: React.FC<{ issue: ScoringIssue }> = ({ issue }) => {
  const tone =
    issue.severity === 'error'
      ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200'
      : issue.severity === 'warn'
      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200'
      : 'bg-slate-50 dark:bg-[#252D38] border-slate-200 dark:border-[#354050] text-slate-700 dark:text-[#D1D5DB]';
  const Icon = issue.severity === 'info' ? Info : AlertTriangle;
  return (
    <div role={issue.severity === 'error' ? 'alert' : 'status'} className={`flex gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${tone}`}>
      <Icon className="w-4 h-4 shrink-0 mt-px" aria-hidden />
      <span>{issue.message}</span>
    </div>
  );
};

const StatChip: React.FC<{ label: string; value: string; emphasis?: 'up' | 'down' | 'flat' }> = ({ label, value, emphasis }) => (
  <div className="rounded-xl bg-white/70 dark:bg-[#1A2028] border border-slate-200 dark:border-[#354050] px-2.5 py-1.5 text-center min-w-[56px]">
    <div className="text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF]">{label}</div>
    <div
      className={`text-sm font-semibold ${
        emphasis === 'up'
          ? 'text-teal-600 dark:text-teal-400'
          : emphasis === 'down'
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-slate-900 dark:text-[#FAFAFA]'
      }`}
    >
      {value}
    </div>
  </div>
);

const OutcomeCard: React.FC<{ res: ScoringResolution }> = ({ res }) => {
  const { stat } = res;
  const BaIcon = stat.baImpact === 'increases' ? TrendingUp : stat.baImpact === 'decreases' ? TrendingDown : Minus;
  const baText = stat.baImpact === 'increases' ? 'AVG up' : stat.baImpact === 'decreases' ? 'AVG down' : 'AVG same';
  return (
    <div
      className="rounded-2xl border border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38] p-3.5 space-y-2.5"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF]">Will be scored as</div>
          <div className="text-lg font-semibold text-slate-950 dark:text-[#FAFAFA] leading-tight">{res.label}</div>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] ">
          {res.shortLabel}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatChip label="PA" value={`+${stat.pa}`} />
        <StatChip label="AB" value={stat.ab ? '+1' : '0'} emphasis={stat.ab ? undefined : 'up'} />
        <StatChip label="H" value={stat.h ? '+1' : '0'} />
        {res.rbi > 0 && <StatChip label="RBI" value={`+${res.rbi}`} />}
        <StatChip label="On base" value={stat.onBase ? 'Yes' : 'No'} />
        <div
          className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold ${
            stat.baImpact === 'increases'
              ? 'bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
              : stat.baImpact === 'decreases'
              ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
              : 'bg-slate-200 dark:bg-[#354050] text-slate-700 dark:text-[#D1D5DB]'
          }`}
        >
          <BaIcon className="w-3.5 h-3.5" aria-hidden />
          {baText}
        </div>
      </div>
      <div className="text-xs font-medium text-slate-600 dark:text-[#9CA3AF]">{stat.summary}</div>
      <div className="text-xs font-semibold text-slate-700 dark:text-[#D1D5DB]">
        {res.inningEnds
          ? 'Makes the 3rd out — inning over.'
          : `${res.outsAfter} out${res.outsAfter === 1 ? '' : 's'} after this play`}
        {res.totalOuts > 1 ? ` (${res.totalOuts} outs on the play)` : ''}
      </div>
    </div>
  );
};

// ─────────────────────────── the modal ───────────────────────────

interface ScoringValidationModalProps {
  playerName: string;
  /** Outs before this plate appearance, from the game log. The user can still correct it. */
  initialOuts: number;
  onConfirm: (resolution: ScoringResolution) => void;
  onCancel: () => void;
}

export const ScoringValidationModal: React.FC<ScoringValidationModalProps> = ({
  playerName,
  initialOuts,
  onConfirm,
  onCancel,
}) => {
  const [state, dispatch] = useReducer(reducer, undefined, (): State => ({
    step: 'PICK_ACTION',
    ctx: { ...DEFAULT_SCORING_CONTEXT, outs: Math.max(0, Math.min(2, Math.floor(initialOuts))) as Outs },
  }));
  const { ctx, step } = state;

  const resolution = useMemo(() => resolveScoringPlay(ctx), [ctx]);
  const fields = visibleFields(ctx);
  const blockingIssue = resolution.issues.find((i) => i.blocking);

  // Rule warnings and the SF/SAC prompt appear below the questions; bring them into view when they change
  // so a phone user never misses why their selection was corrected.
  const resultRef = useRef<HTMLDivElement>(null);
  const attentionKey = `${resolution.outcome}|${resolution.issues.map((i) => i.id).join(',')}`;
  useEffect(() => {
    const needsAttention = resolution.issues.some((i) => i.severity !== 'info');
    if (step === 'CONTEXT' && needsAttention) {
      resultRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attentionKey, step]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scoring-title"
        className="w-full max-w-md max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-[#1A2028] shadow-2xl border border-slate-200 dark:border-[#354050] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-200 dark:border-[#354050]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00BFA5] dark:bg-[#00D7BC]" />
              <div className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC]">Smart scoring</div>
            </div>
            <h2 id="scoring-title" className="mt-1 text-lg font-semibold text-slate-950 dark:text-[#FAFAFA] truncate">
              {step === 'PICK_ACTION'
                ? `What happened to ${playerName || 'the batter'}?`
                : `${ACTION_TITLES[ctx.action]} — a few details`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252D38] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {step === 'PICK_ACTION' && (
            <>
              <p className="text-xs font-medium text-slate-500 dark:text-[#9CA3AF]">
                Pick what the ball did. We'll work out the official stat from the situation, so you don't need to know the scoring rules.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {ACTIONS.map((a) => (
                  <button
                    key={a.action}
                    type="button"
                    onClick={() => dispatch({ type: 'SELECT_ACTION', action: a.action })}
                    className="rounded-2xl border border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38] p-3.5 text-left hover:bg-slate-100 dark:hover:bg-[#354050]/70 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <div className="font-semibold text-sm text-slate-950 dark:text-[#FAFAFA]">{a.title}</div>
                    <div className="text-xs font-medium text-slate-500 dark:text-[#9CA3AF] mt-0.5">{a.hint}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'CONTEXT' && (
            <>
              {/* Situation: outs + bases */}
              <ChoiceGroup<Outs>
                label="Outs before this at-bat"
                help="Filled in from your game — change it if the count is off."
                options={[
                  { value: 0, label: '0 outs' },
                  { value: 1, label: '1 out' },
                  { value: 2, label: '2 outs' },
                ]}
                value={ctx.outs}
                onChange={(outs) => dispatch({ type: 'SET_OUTS', outs })}
              />

              <Question label="Teammates on base before the pitch" help="Tap every base that had a runner.">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['first', '1st'],
                      ['second', '2nd'],
                      ['third', '3rd'],
                    ] as const
                  ).map(([base, label]) => (
                    <button
                      key={base}
                      type="button"
                      aria-pressed={ctx.runners[base]}
                      onClick={() => dispatch({ type: 'TOGGLE_RUNNER', base })}
                      className={`${BTN_BASE} ${ctx.runners[base] ? BTN_ON : BTN_OFF}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Question>

              {/* Conditional play-result questions */}
              {fields.batterSafe && (
                <ChoiceGroup<boolean>
                  label="Was the batter safe at 1st?"
                  options={[
                    { value: false, label: 'No — thrown out' },
                    { value: true, label: 'Yes — safe' },
                  ]}
                  value={!!ctx.batterSafeAtFirst}
                  onChange={(value) => dispatch({ type: 'SET_FLAG', flag: 'batterSafeAtFirst', value })}
                />
              )}
              {fields.runnerScored && (
                <ChoiceGroup<boolean>
                  label="Did the runner on 3rd score?"
                  options={YES_NO}
                  value={ctx.runnerScoredFrom3rd}
                  onChange={(value) => dispatch({ type: 'SET_FLAG', flag: 'runnerScoredFrom3rd', value })}
                />
              )}
              {fields.runnersAdvanced && (
                <ChoiceGroup<boolean>
                  label="Did any runner advance safely?"
                  options={YES_NO}
                  value={ctx.runnersAdvancedSafely}
                  onChange={(value) => dispatch({ type: 'SET_FLAG', flag: 'runnersAdvancedSafely', value })}
                />
              )}
              {fields.leadRunnerOut && (
                <ChoiceGroup<boolean>
                  label="Was a runner put out?"
                  help="Thrown out, tagged out or forced out on the play."
                  options={YES_NO}
                  value={ctx.leadRunnerPutOut}
                  onChange={(value) => dispatch({ type: 'SET_FLAG', flag: 'leadRunnerPutOut', value })}
                />
              )}
              {fields.defensiveError && (
                <ChoiceGroup<boolean>
                  label="Did a fielder make an error?"
                  help={
                    ctx.action === 'flyout'
                      ? 'Dropped or muffed the fly ball, so the batter reached.'
                      : 'Fumbled the ball or made a bad throw on an ordinary play.'
                  }
                  options={YES_NO}
                  value={ctx.defensiveError}
                  onChange={(value) => dispatch({ type: 'SET_FLAG', flag: 'defensiveError', value })}
                />
              )}

              {/* Live result: the official stat is always decided by the engine from the answers above */}
              <div ref={resultRef} className="space-y-2 pt-1 scroll-mb-2">
                <OutcomeCard res={resolution} />
                {resolution.issues.map((issue, i) => (
                  <IssueRow key={issue.id + i} issue={issue} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-[#354050] grid grid-cols-[auto_1fr] gap-2 bg-slate-50 dark:bg-[#1A2028]">
          {step === 'CONTEXT' ? (
            <>
              <button
                type="button"
                onClick={() => dispatch({ type: 'BACK' })}
                className={`${BTN_BASE} ${BTN_OFF} inline-flex items-center justify-center gap-1 !w-auto`}
              >
                <ChevronLeft className="w-4 h-4" aria-hidden /> Back
              </button>
              <button
                type="button"
                disabled={!resolution.canConfirm}
                onClick={() => resolution.canConfirm && onConfirm(resolution)}
                title={blockingIssue?.message}
                className={`${BTN_BASE} inline-flex items-center justify-center gap-1.5 bg-[#00BFA5] dark:bg-[#00D7BC] border-[#00BFA5] text-[#18212D] dark:text-[#101419] disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90`}
              >
                <Check className="w-4 h-4" aria-hidden /> Record {resolution.shortLabel}
              </button>
            </>
          ) : (
            <button type="button" onClick={onCancel} className={`${BTN_BASE} ${BTN_OFF} col-span-2`}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
