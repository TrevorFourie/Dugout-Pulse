import React, { useMemo, useState } from 'react';
import { Activity, CircleDot, ShieldCheck, Target, TrendingUp } from 'lucide-react';
import type { Game } from '../types/baseball';
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

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  return start;
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
    const weekStart = startOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const latestSeason = defaultSeason || [...allGames].sort((a, b) => b.date.localeCompare(a.date))[0]?.season;
    return allGames.filter((game) => {
      if (period === 'week') return new Date(`${game.date}T00:00:00`) >= weekStart;
      if (period === 'month') return new Date(`${game.date}T00:00:00`) >= monthStart;
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
  const progress = hasMetricData ? Math.max(0, Math.min(1, value! / metric.max)) : 0;
  const circumference = Math.PI * 104;
  const dashOffset = circumference * (1 - progress);

  const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : period === 'season' ? 'This Season' : 'All Time';
  const battingSummary = stats.batting;
  const pitchingSummary = stats.pitching;
  const fieldingSummary = stats.fielding;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-[#354050] dark:bg-[#252D38] sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#007A6A] dark:text-[#00D7BC]">Performance Counter</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">Your player's recorded performance</p>
        </div>
        <select
          aria-label="Performance time period"
          value={period}
          onChange={(event) => setPeriod(event.target.value as Period)}
          className="max-w-[140px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-[#18212D] outline-none focus:border-[#00BFA5] dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA]"
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="season">This Season</option>
          <option value="all">All Time</option>
        </select>
      </div>

      <div className="mx-auto w-full max-w-[420px]">
        <div className="relative">
          <svg viewBox="0 0 240 142" role="img" aria-label={hasMetricData ? `${metric.label}: ${metric.format(value)}` : `${metric.label}: not enough data yet`} className="block w-full overflow-visible">
            <defs>
              <linearGradient id="performance-counter-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00D7BC" />
                <stop offset="100%" stopColor="#3478FF" />
              </linearGradient>
            </defs>
            <path d="M 16 124 A 104 104 0 0 1 224 124" fill="none" stroke="currentColor" className="text-slate-200 dark:text-[#354050]" strokeWidth="14" strokeLinecap="round" pathLength="100" />
            {hasMetricData && <path d="M 16 124 A 104 104 0 0 1 224 124" fill="none" stroke="url(#performance-counter-gradient)" strokeWidth="14" strokeLinecap="round" pathLength="100" strokeDasharray={`${progress * 100} 100`} />}
            {hasMetricData && <circle cx={120 - 104 * Math.cos(Math.PI * progress)} cy={124 - 104 * Math.sin(Math.PI * progress)} r="5.5" fill="#FAFAFA" stroke="#3478FF" strokeWidth="3" />}
            {Array.from({ length: 17 }, (_, index) => {
              const angle = Math.PI + (Math.PI * index) / 16;
              const x1 = 120 + 91 * Math.cos(angle);
              const y1 = 124 + 91 * Math.sin(angle);
              const x2 = 120 + 99 * Math.cos(angle);
              const y2 = 124 + 99 * Math.sin(angle);
              return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" className="text-slate-400 dark:text-[#6B7280]" strokeWidth="1.5" />;
            })}
          </svg>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
            <span className="text-3xl font-bold tracking-tight text-[#18212D] dark:text-[#FAFAFA] sm:text-4xl">
              {hasMetricData ? metric.format(value) : '—'}
            </span>
            <span className="mt-1 text-xs font-medium text-slate-500 dark:text-[#9CA3AF]">{metric.label}</span>
          </div>
        </div>
        <div className="mt-2 flex justify-center">
          <select
            aria-label="Performance metric"
            value={metricKey}
            onChange={(event) => setMetricKey(event.target.value as MetricKey)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-[#18212D] outline-none focus:border-[#00BFA5] dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA]"
          >
            {METRICS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
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
