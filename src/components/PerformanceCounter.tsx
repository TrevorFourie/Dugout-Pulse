import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ShieldCheck, Target } from 'lucide-react';
import type { Game } from '../types/baseball';
import { ThemedDropdown } from './ThemedDropdown';
import { calculateSeasonStats, formatRate, formatEraWhip } from '../utils/stats';

type Period = 'week' | 'month' | 'season' | 'all';
type MetricKey = 'avg' | 'obp' | 'ops' | 'strikePercentage' | 'fpct';

interface PerformanceCounterProps {
  games: Game[];
  liveGame: Game | null;
  inningsPerGame: number;
  defaultSeason?: string;
}

const METRICS: { value: MetricKey; label: string; group: 'batting' | 'pitching' | 'fielding'; max: number; format: (value: number | null) => string }[] = [
  { value: 'avg', label: 'Batting Average', group: 'batting', max: 0.500, format: formatRate },
  { value: 'obp', label: 'On-Base Percentage', group: 'batting', max: 0.600, format: formatRate },
  { value: 'ops', label: 'OPS', group: 'batting', max: 1.500, format: (v) => v == null || !Number.isFinite(v) ? '—' : v.toFixed(3) },
  { value: 'strikePercentage', label: 'Strike Percentage', group: 'pitching', max: 100, format: (v) => v == null ? '—' : `${Math.round(v)}%` },
  { value: 'fpct', label: 'Fielding Percentage', group: 'fielding', max: 1, format: formatRate },
];

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'season', label: 'This Season' },
  { value: 'all', label: 'All Time' },
];

function startOfWeek(date: Date) {
  // Use a Sunday-to-Saturday calendar week so weekend games are included in
  // "This Week" when viewing the dashboard at the start of a new week.
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

function getLocalGameDate(dateValue: string): Date | null {
  // Game dates are stored as date-only strings (YYYY-MM-DD). Parse the calendar
  // parts locally instead of relying on browser parsing/time-zone conversion.
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})/.exec(dateValue || '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ── Gauge geometry (viewBox 280 x 160) ─────────────────────────────────────
const CX = 140;
const CY = 112;
const RADIUS = 100;
const STROKE = 14;
const START_DEG = 160; // lower-left
const SWEEP_DEG = 220; // clockwise over the top to lower-right
const TICK_COUNT = 45;

function polar(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function arcPath(sweepDeg: number) {
  const start = polar(START_DEG, RADIUS);
  const end = polar(START_DEG + sweepDeg, RADIUS);
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${RADIUS} ${RADIUS} 0 ${sweepDeg > 180 ? 1 : 0} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

const TRACK_PATH = arcPath(SWEEP_DEG);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Tweens a number toward `target` on every animation frame, always starting from
 * wherever it currently is, so a new target animates forwards OR backwards from
 * the current position and never restarts from zero. When `snapKey` changes
 * (e.g. the number's units change) the value jumps straight to the new target.
 */
function useAnimatedNumber(target: number, snapKey = '', duration = 900) {
  const [shown, setShown] = useState(0);
  const current = useRef({ key: snapKey, value: 0 });

  useEffect(() => {
    const from = current.current.key === snapKey ? current.current.value : target;
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || from === target) {
      current.current = { key: snapKey, value: target };
      setShown(target);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      current.current = { key: snapKey, value: from + (target - from) * easeInOutCubic(t) };
      setShown(current.current.value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, snapKey, duration]);

  return shown;
}

function getMetricValue(stats: ReturnType<typeof calculateSeasonStats>, key: MetricKey): number | null {
  if (key === 'avg') return stats.batting.avg;
  if (key === 'obp') return stats.batting.obp;
  if (key === 'ops') return stats.batting.ops;
  if (key === 'strikePercentage') return stats.pitching.strikePercentage;
  return stats.fielding.fpct;
}

export const PerformanceCounter: React.FC<PerformanceCounterProps> = ({
  games,
  liveGame,
  inningsPerGame,
  defaultSeason,
}) => {
  const [period, setPeriod] = useState<Period>('season');
  const [metricKey, setMetricKey] = useState<MetricKey>('avg');

  const allGames = useMemo(() => {
    const savedLiveCopy = Boolean(liveGame && games.some((game) => game.id === liveGame.id));
    return liveGame && !savedLiveCopy ? [...games, liveGame] : games;
  }, [games, liveGame]);

  const filteredGames = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = startOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const latestSeason = defaultSeason || [...allGames].sort((a, b) => b.date.localeCompare(a.date))[0]?.season;
    return allGames.filter((game) => {
      const gameDate = getLocalGameDate(game.date);
      if (period === 'week') return Boolean(gameDate && gameDate >= weekStart && gameDate <= today);
      if (period === 'month') return Boolean(gameDate && gameDate >= monthStart && gameDate <= today);
      if (period === 'season' && latestSeason) return game.season === latestSeason;
      return true;
    });
  }, [allGames, period, defaultSeason]);

  const stats = useMemo(
    () => calculateSeasonStats(filteredGames, inningsPerGame),
    [filteredGames, inningsPerGame]
  );
  const metric = METRICS.find((item) => item.value === metricKey) || METRICS[0];
  const value = getMetricValue(stats, metricKey);
  const hasMetricData = value !== null && Number.isFinite(value);
  const targetProgress = hasMetricData ? Math.max(0, Math.min(1, value! / metric.max)) : 0;
  const progress = useAnimatedNumber(targetProgress);
  const animatedValue = useAnimatedNumber(hasMetricData ? value! : 0, metricKey);
  const sweep = SWEEP_DEG * progress;
  const thumb = polar(START_DEG + sweep, RADIUS);

  const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : period === 'season' ? 'This Season' : 'All Time';
  const battingSummary = stats.batting;
  const pitchingSummary = stats.pitching;
  const fieldingSummary = stats.fielding;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-[#354050] dark:bg-[#252D38] sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-[#AEB8C6]">Player Performance</p>
        <div className="h-px flex-1 bg-slate-200 dark:bg-[#354050]" />
        <ThemedDropdown<Period>
          ariaLabel="Performance time period"
          value={period}
          placeholder="This Season"
          allowClear={false}
          onChange={(next) => next && setPeriod(next)}
          options={PERIODS}
          className="w-[130px] shrink-0"
          menuClassName="left-auto right-0 w-[150px]"
        />
      </div>

      <div className="mx-auto w-full max-w-[420px]">
        <div className="relative">
          <svg viewBox="0 0 280 160" role="img" aria-label={hasMetricData ? `${metric.label}: ${metric.format(value)}` : `${metric.label}: not enough data yet`} className="block w-full overflow-visible">
            <defs>
              <linearGradient id="performance-counter-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00D1D6" />
                <stop offset="100%" stopColor="#3478FF" />
              </linearGradient>
              <filter id="performance-counter-thumb-shadow" x="-60%" y="-60%" width="220%" height="220%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#3478FF" floodOpacity="0.55" />
              </filter>
            </defs>

            {/* Unfilled track: radial tick marks that fade out as the gauge fills past them */}
            {Array.from({ length: TICK_COUNT }, (_, index) => {
              const fraction = index / (TICK_COUNT - 1);
              const deg = START_DEG + SWEEP_DEG * fraction;
              const inner = polar(deg, RADIUS - STROKE / 2);
              const outer = polar(deg, RADIUS + STROKE / 2);
              const opacity = progress <= 0.001 ? 1 : Math.max(0, Math.min(1, (fraction - progress) / 0.03));
              return (
                <line
                  key={index}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="currentColor"
                  className="text-slate-300 dark:text-[#3E495A]"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  opacity={opacity}
                />
              );
            })}

            {/* Filled progress arc */}
            {progress > 0.001 && (
              <path d={arcPath(sweep)} fill="none" stroke="url(#performance-counter-gradient)" strokeWidth={STROKE} strokeLinecap="round" />
            )}

            {/* Thumb */}
            {hasMetricData && (
              <circle cx={thumb.x} cy={thumb.y} r="7" fill="#FFFFFF" stroke="#3478FF" strokeWidth="3.5" filter="url(#performance-counter-thumb-shadow)" />
            )}
          </svg>

          <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center text-center" style={{ top: '46%' }}>
            <span className="text-5xl font-bold leading-none tracking-tight text-[#18212D] tabular-nums dark:text-[#FAFAFA] sm:text-6xl">
              {hasMetricData ? metric.format(animatedValue) : '—'}
            </span>
            <span className="mt-2 text-[13px] font-medium tracking-wide text-slate-500 dark:text-[#9CA3AF]">{metric.label}</span>
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <ThemedDropdown<MetricKey>
            ariaLabel="Performance metric"
            value={metricKey}
            placeholder="Batting Average"
            allowClear={false}
            onChange={(next) => next && setMetricKey(next)}
            options={METRICS.map((item) => ({ value: item.value, label: item.label }))}
            className="w-full max-w-[220px]"
          />
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-[#9CA3AF]">
          Gauge fills against a reference scale for the selected statistic; it updates as scored plays change.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#354050] dark:bg-[#1A2028]">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#9CA3AF]"><Activity className="h-3.5 w-3.5 text-[#00BFA5]" /> Batting</div>
          <p className="mt-2 truncate text-xl font-bold text-[#18212D] dark:text-[#FAFAFA]">{formatRate(battingSummary.avg)}</p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-[#9CA3AF]">{battingSummary.h} hits · {battingSummary.ab} AB</p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#354050] dark:bg-[#1A2028]">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#9CA3AF]"><Target className="h-3.5 w-3.5 text-[#3478FF]" /> Pitching</div>
          <p className="mt-2 truncate text-xl font-bold text-[#18212D] dark:text-[#FAFAFA]">{formatEraWhip(pitchingSummary.era)}</p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-[#9CA3AF]">{pitchingSummary.k} K · {pitchingSummary.ipDisplay} IP</p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#354050] dark:bg-[#1A2028]">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#9CA3AF]"><ShieldCheck className="h-3.5 w-3.5 text-[#00BFA5]" /> Fielding</div>
          <p className="mt-2 truncate text-xl font-bold text-[#18212D] dark:text-[#FAFAFA]">{formatRate(fieldingSummary.fpct)}</p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-[#9CA3AF]">{fieldingSummary.e} errors · {fieldingSummary.chances} chances</p>
        </div>
      </div>

      {filteredGames.length === 0 && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500 dark:bg-[#1A2028] dark:text-[#9CA3AF]">
          No games found for {periodLabel.toLowerCase()}. Record or select another period to see performance.
        </div>
      )}
      {filteredGames.length > 0 && !hasMetricData && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500 dark:bg-[#1A2028] dark:text-[#9CA3AF]">
          This statistic will appear when enough relevant plays have been recorded.
        </div>
      )}
    </section>
  );
};  