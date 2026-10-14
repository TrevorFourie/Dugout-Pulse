import React, { useMemo } from 'react';
import {
  Activity,
  Award,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Flame,
  Footprints,
  Medal,
  Sparkles,
  Target,
  Trophy,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import type { Game } from '../types/baseball';
import {
  calculateBattingStats,
  calculateFieldingStats,
  calculatePitchingStats,
  sortGames,
} from '../utils/stats';

interface MilestoneTrackerProps {
  games: Game[];
  onViewStats?: () => void;
}

type MilestoneCategory = 'Batting' | 'Pitching' | 'Fielding';

interface Achievement {
  id: string;
  title: string;
  description: string;
  category: MilestoneCategory;
  icon: React.ElementType;
}

interface ProgressMilestone {
  label: string;
  current: number;
  target: number;
  unit: string;
  category: MilestoneCategory;
}

const HIT_CODES = ['single', 'double', 'triple', 'homeRun'];
const EXTRA_BASE_HIT_CODES = ['double', 'triple', 'homeRun'];
const HIT_TARGETS = [10, 25, 50, 100, 250, 500];
const STRIKEOUT_TARGETS = [10, 25, 50, 100, 250, 500];
const PUTOUT_TARGETS = [10, 25, 50, 100, 250, 500];

function getNextTarget(total: number, targets: number[]): number {
  return targets.find((target) => total < target) ?? total + 50;
}

function getGameAchievements(game: Game): Achievement[] {
  const batting = game.plays.filter((play) => play.mode === 'batting');
  const pitching = game.plays.filter((play) => play.mode === 'pitching');
  const fielding = game.plays.filter((play) => play.mode === 'fielding');

  const hits = batting.filter((play) => HIT_CODES.includes(play.code));
  const extraBaseHits = batting.filter((play) =>
    EXTRA_BASE_HIT_CODES.includes(play.code)
  ).length;
  const rbis = batting.filter((play) => play.code === 'rbi').length;
  const runs = batting.filter((play) => play.code === 'run').length;
  const stolenBases = batting.filter((play) => play.code === 'stolenBase').length;

  const pitchingStats = calculatePitchingStats(pitching, 1);
  const fieldingStats = calculateFieldingStats(fielding, 1);
  const achievements: Achievement[] = [];

  // Batting achievements
  if (
    hits.some((play) => play.code === 'single') &&
    hits.some((play) => play.code === 'double') &&
    hits.some((play) => play.code === 'triple') &&
    hits.some((play) => play.code === 'homeRun')
  ) {
    achievements.push({
      id: 'cycle',
      title: 'Hit for the Cycle',
      description: 'A single, double, triple and home run in one game.',
      category: 'Batting',
      icon: Trophy,
    });
  }

  // Only award a Grand Slam when the saved scoring context confirms the bases were loaded.
  const grandSlam = batting.some((play) => {
    if (play.code !== 'homeRun') return false;
    const runners = play.scoringContext?.runners;
    return Boolean(runners?.first && runners?.second && runners?.third);
  });

  if (grandSlam) {
    achievements.push({
      id: 'grand-slam',
      title: 'Grand Slam',
      description: 'A home run with the bases loaded.',
      category: 'Batting',
      icon: Zap,
    });
  }

  if (hits.length >= 4) {
    achievements.push({
      id: 'four-hit-game',
      title: 'Four-Hit Game',
      description: `${hits.length} hits recorded in one game.`,
      category: 'Batting',
      icon: Trophy,
    });
  } else if (hits.length >= 3) {
    achievements.push({
      id: 'three-hit-game',
      title: 'Multi-Hit Game',
      description: `${hits.length} hits recorded in one game.`,
      category: 'Batting',
      icon: Award,
    });
  }

  if (rbis >= 3) {
    achievements.push({
      id: 'multi-rbi',
      title: 'Run Producer',
      description: `${rbis} RBIs in one game.`,
      category: 'Batting',
      icon: Activity,
    });
  }

  if (extraBaseHits >= 2) {
    achievements.push({
      id: 'extra-base-damage',
      title: 'Extra-Base Power',
      description: `${extraBaseHits} extra-base hits in one game.`,
      category: 'Batting',
      icon: Zap,
    });
  }

  if (stolenBases >= 2) {
    achievements.push({
      id: 'base-stealer',
      title: stolenBases >= 3 ? 'Multi-Steal Threat' : 'Speed on the Bases',
      description: `${stolenBases} stolen bases in one game.`,
      category: 'Batting',
      icon: Footprints,
    });
  }

  if (runs >= 3) {
    achievements.push({
      id: 'run-machine',
      title: 'Run Machine',
      description: `${runs} runs scored in one game.`,
      category: 'Batting',
      icon: Flame,
    });
  }

  // Pitching achievements
  const strikeoutsByInning = new Map<number, number>();
  for (const play of pitching) {
    if (play.code === 'strikeout') {
      strikeoutsByInning.set(
        play.inning,
        (strikeoutsByInning.get(play.inning) ?? 0) + 1
      );
    }
  }

  const strikeoutTheSide = [...strikeoutsByInning.values()].some((count) => count >= 3);
  if (strikeoutTheSide) {
    achievements.push({
      id: 'strikeout-the-side',
      title: 'Three-Strikeout Inning',
      description: 'Recorded three or more strikeouts in one inning.',
      category: 'Pitching',
      icon: Zap,
    });
  }

  if (pitchingStats.k >= 5) {
    achievements.push({
      id: 'five-strikeout-game',
      title: 'Five-Strikeout Game',
      description: `${pitchingStats.k} strikeouts recorded in one game.`,
      category: 'Pitching',
      icon: Award,
    });
  } else if (pitchingStats.k >= 3) {
    achievements.push({
      id: 'three-strikeout-game',
      title: 'Three-Strikeout Game',
      description: `${pitchingStats.k} strikeouts recorded in one game.`,
      category: 'Pitching',
      icon: Activity,
    });
  }

  // Fielding achievements
  if (fieldingStats.tp > 0) {
    achievements.push({
      id: 'triple-play',
      title: 'Triple Play',
      description: 'Recorded a triple play on defense.',
      category: 'Fielding',
      icon: ShieldCheck,
    });
  } else if (fieldingStats.dp > 0) {
    achievements.push({
      id: 'double-play',
      title: 'Double Play',
      description: 'Recorded a double play on defense.',
      category: 'Fielding',
      icon: ShieldCheck,
    });
  }

  if (fieldingStats.po >= 3) {
    achievements.push({
      id: 'three-putouts',
      title: 'Defensive Anchor',
      description: `${fieldingStats.po} putouts recorded in one game.`,
      category: 'Fielding',
      icon: CircleDot,
    });
  }

  if (fieldingStats.a >= 3) {
    achievements.push({
      id: 'three-assists',
      title: 'Assist Leader',
      description: `${fieldingStats.a} assists recorded in one game.`,
      category: 'Fielding',
      icon: Activity,
    });
  }

  return achievements;
}

function getHittingStreak(games: Game[]): number {
  const orderedGames = sortGames(games, 'newestFirst');
  let streak = 0;

  for (const game of orderedGames) {
    const hits = game.plays.filter(
      (play) => play.mode === 'batting' && HIT_CODES.includes(play.code)
    ).length;

    if (hits === 0) break;
    streak++;
  }

  return streak;
}

function getDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ProgressCard({ milestone }: { milestone: ProgressMilestone }) {
  const progress = Math.min(
    100,
    Math.round((milestone.current / milestone.target) * 100)
  );
  const remaining = Math.max(0, milestone.target - milestone.current);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-[#354050] dark:bg-[#252D38]">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-[#007A6A] dark:text-[#00D7BC]" />
        <p className="text-xs font-semibold text-slate-600 dark:text-[#D1D5DB]">
          {milestone.category}
        </p>
      </div>
      <p className="mt-2 text-base font-semibold text-[#18212D] dark:text-[#FAFAFA]">
        {milestone.target} {milestone.unit}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-[#9CA3AF]">
        {remaining === 0
          ? 'Milestone reached!'
          : `${remaining} to go`}
      </p>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-[#354050]"
        role="progressbar"
        aria-label={`Progress toward ${milestone.target} ${milestone.unit}`}
        aria-valuemin={0}
        aria-valuemax={milestone.target}
        aria-valuenow={Math.min(milestone.current, milestone.target)}
      >
        <div
          className="h-full rounded-full bg-[#00BFA5] transition-all dark:bg-[#00D7BC]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-[11px] font-semibold tabular-nums text-[#007A6A] dark:text-[#00D7BC]">
        {milestone.current} / {milestone.target}
      </p>
    </div>
  );
}

export const MilestoneTracker: React.FC<MilestoneTrackerProps> = ({
  games,
  onViewStats,
}) => {
  const data = useMemo(() => {
    const orderedGames = sortGames(games, 'newestFirst');
    const allPlays = games.flatMap((game) => game.plays);

    const battingTotal = calculateBattingStats(allPlays, games.length);
    const pitchingTotal = calculatePitchingStats(allPlays, games.length);
    const fieldingTotal = calculateFieldingStats(allPlays, games.length);

    const recentAchievement = orderedGames
      .map((game) => ({
        game,
        achievement: getGameAchievements(game)[0],
      }))
      .find((entry) => entry.achievement);

    const personalBest = games.reduce(
      (best, game) => {
        const batting = calculateBattingStats(game.plays, 1);
        const pitching = calculatePitchingStats(game.plays, 1);
        const fielding = calculateFieldingStats(game.plays, 1);

        return {
          hits: Math.max(best.hits, batting.h),
          strikeouts: Math.max(best.strikeouts, pitching.k),
          putouts: Math.max(best.putouts, fielding.po),
          assists: Math.max(best.assists, fielding.a),
        };
      },
      { hits: 0, strikeouts: 0, putouts: 0, assists: 0 }
    );

    const progressMilestones: ProgressMilestone[] = [
      {
        category: 'Batting',
        label: 'Career hits',
        current: battingTotal.h,
        target: getNextTarget(battingTotal.h, HIT_TARGETS),
        unit: 'hits',
      },
      {
        category: 'Pitching',
        label: 'Career strikeouts',
        current: pitchingTotal.k,
        target: getNextTarget(pitchingTotal.k, STRIKEOUT_TARGETS),
        unit: 'strikeouts',
      },
      {
        category: 'Fielding',
        label: 'Career putouts',
        current: fieldingTotal.po,
        target: getNextTarget(fieldingTotal.po, PUTOUT_TARGETS),
        unit: 'putouts',
      },
    ];

    return {
      recentAchievement,
      progressMilestones,
      personalBest,
      hittingStreak: getHittingStreak(orderedGames),
      gameCount: games.length,
    };
  }, [games]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
            Milestones
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-[#D1D5DB]">
            Batting, pitching and fielding progress.
          </p>
        </div>

        {onViewStats && (
          <button
            type="button"
            onClick={onViewStats}
            className="flex items-center gap-1 text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC]"
          >
            Full stats <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Most recent recorded achievement across all three disciplines */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-[#354050] dark:bg-[#252D38]">
        <div className="border-b border-slate-200/80 bg-[#F4F6FA] p-4 dark:border-[#354050] dark:bg-[#202429]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#007A6A] dark:text-[#00D7BC]" />
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-[#D1D5DB]">
              Latest recorded achievement
            </span>
          </div>
        </div>

        <div className="p-4">
          {data.recentAchievement ? (
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#00BFA5]/10 text-[#007A6A] dark:bg-[#00D7BC]/10 dark:text-[#00D7BC]">
                {React.createElement(data.recentAchievement.achievement!.icon, {
                  className: 'h-6 w-6',
                })}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[#18212D] dark:text-[#FAFAFA]">
                    {data.recentAchievement.achievement!.title}
                  </h3>
                  <span className="rounded-full bg-[#00BFA5]/10 px-2 py-0.5 text-[10px] font-semibold text-[#007A6A] dark:bg-[#00D7BC]/10 dark:text-[#00D7BC]">
                    {data.recentAchievement.achievement!.category}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-[#D1D5DB]">
                  {data.recentAchievement.achievement!.description}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-[#9CA3AF]">
                  vs. {data.recentAchievement.game.opponent || 'Opponent'} ·{' '}
                  {getDateLabel(data.recentAchievement.game.date)}
                </p>
              </div>

              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#00BFA5] dark:text-[#00D7BC]" />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-[#354050] dark:text-[#D1D5DB]">
                <Medal className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-[#18212D] dark:text-[#FAFAFA]">
                  Every part of the game counts
                </h3>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-[#D1D5DB]">
                  Keep recording games to unlock batting, pitching and fielding highlights.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress toward a milestone in each discipline */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {data.progressMilestones.map((milestone) => (
          <ProgressCard key={milestone.category} milestone={milestone} />
        ))}
      </div>

      {/* Personal bests across batting, pitching and fielding */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-[#354050] dark:bg-[#252D38]">
          <Zap className="h-4 w-4 text-[#007A6A] dark:text-[#00D7BC]" />
          <p className="mt-2 text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">
            {data.personalBest.hits}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF]">
            Best hits / game
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-[#354050] dark:bg-[#252D38]">
          <Activity className="h-4 w-4 text-[#007A6A] dark:text-[#00D7BC]" />
          <p className="mt-2 text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">
            {data.personalBest.strikeouts}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF]">
            Best strikeouts / game
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-[#354050] dark:bg-[#252D38]">
          <CircleDot className="h-4 w-4 text-[#007A6A] dark:text-[#00D7BC]" />
          <p className="mt-2 text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">
            {data.personalBest.putouts}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF]">
            Best putouts / game
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-[#354050] dark:bg-[#252D38]">
          <ShieldCheck className="h-4 w-4 text-[#007A6A] dark:text-[#00D7BC]" />
          <p className="mt-2 text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">
            {data.personalBest.assists}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF]">
            Best assists / game
          </p>
        </div>
      </div>

      {/* Hitting streak */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-[#354050] dark:bg-[#252D38]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00BFA5]/10 text-[#007A6A] dark:bg-[#00D7BC]/10 dark:text-[#00D7BC]">
          <Flame className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#18212D] dark:text-[#FAFAFA]">
            {data.hittingStreak > 0
              ? `${data.hittingStreak}-game hitting streak`
              : 'Start a hitting streak'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-[#9CA3AF]">
            Consecutive recorded games with at least one hit
          </p>
        </div>
        <Activity className="h-5 w-5 text-slate-300 dark:text-[#6B7280]" />
      </div>
    </section>
  );
};
