import React, { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import backgroundImage from '../assets/Pitcher.png';
import {
  calculateSeasonStats,
  formatRate,
} from '../utils/stats';
import {
  Play,
  PlayCircle,
  HelpCircle,
  Award,
  Activity,
  ChevronRight,
  Sparkles,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { TeamLogoImage } from './TeamLogoImage';
import { MilestoneTracker } from './MilestoneTracker';
import { PerformanceCounter } from './PerformanceCounter';
import { UpcomingGames } from './UpcomingGames';

interface DashboardTabProps {
  onNavigateToScore: () => void;
  onNavigateToStats: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  onNavigateToScore,
  onNavigateToStats,
  onOpenHelp,
  onOpenSettings,
}) => {
  const {
    games,
    liveGame,
    activeProfile,
    settings,
    isLoading,
  } = useGame();

  // All saved games for the active player.
  const playerGames = useMemo(() => {
    return games.filter((g) => !g.playerId || g.playerId === activeProfile.id);
  }, [games, activeProfile.id]);

  if (isLoading) {
    // Keep the first React frame visually aligned with the native splash while
    // localStorage is read; do not flash a separate spinner screen on startup.
    return (
      <div
        className="flex-1 min-h-0 flex items-center justify-center"
        style={{ backgroundColor: '#121923' }}
        aria-label="Loading Dugout Pulse"
      >
        <AppLogo variant="logo" className="w-40 h-40 object-contain" />
      </div>
    );
  }

  const seasonStats = calculateSeasonStats(playerGames, settings.inningsPerGame, activeProfile.id);
  const { gameCount, batting, lastGameHits } = seasonStats;

  const playerNameDisplay = activeProfile.playerName
    ? `${activeProfile.playerName}`
    : "Your player";

  const teamNameDisplay = activeProfile.teamName || 'Set team name in Settings';

  return (
    <div className="flex-1 overflow-y-auto pb-24 px-4 sm:px-6 pt-4 max-w-4xl mx-auto w-full space-y-5 animate-in fade-in duration-200">
      {/* App & Season Header */}
      <div className="bg-white dark:bg-[#252D38] rounded-2xl p-4 border border-slate-200/80 dark:border-[#354050] shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open Player Details settings"
            className="group flex min-w-0 items-center gap-3.5 rounded-xl text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00BFA5] sm:gap-2"
          >
            {/* Player profile image; TeamLogoImage falls back to TeamIcon when no image is selected. */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-slate-100 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] flex items-center justify-center shrink-0 shadow-xs group-hover:border-[#00BFA5]/50 transition-colors">
              <TeamLogoImage value={activeProfile.logo} alt="" className="w-full h-full object-contain p-1" />
            </div>

            <div className="py-0">
              <span className="py-0 text-[11px] font-semibold uppercase tracking-widest text-[#007A6A] dark:text-[#00D7BC]">GAME DAY SCORING</span>
              <h1 className="text-xl sm:text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA] tracking-tight">
                {playerNameDisplay}
                {activeProfile.jerseyNumber && (
                  <span className="py-0.5 text-slate-700 dark:text-[#D1D5DB] px-0.5"> · #{activeProfile.jerseyNumber}</span>
                )}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-[#9CA3AF] flex items-center flex-wrap">
                <span className="py-0.5 text-slate-700 dark:text-[#D1D5DB]">
                  {teamNameDisplay}
                </span>
                {activeProfile.defaultAgeGroup && (
                  <span className="py-0.5 text-slate-700 dark:text-[#D1D5DB] px-0.5"> · {activeProfile.defaultAgeGroup}</span>
                )}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Hero Card */}

      <div
        className="overflow-hidden rounded-2xl text-white p-5 sm:p-6 shadow-xl relative border border-slate-700/40"
        style={{
          backgroundImage: `
            linear-gradient(
              to bottom right,
              rgba(24, 33, 45, 0.90),
              rgba(32, 43, 58, 0.80),
              rgba(18, 25, 35, 0.90)
            ),
            url(${backgroundImage})
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="space-y-1.5 max-w-md">
            {liveGame ? (
              <>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                  GAME IN PROGRESS
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  Inning {liveGame.innings} · vs {liveGame.opponent || 'Opponent'}
                </h2>
                <p className="text-xs text-slate-300">
                  {liveGame.plays.length} plays recorded so far. Continue live scoring right from the stands.
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  READY FOR NEXT GAME
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  Start Game Scoring
                </h2>
                <p className="text-xs text-slate-300">
                  Tap big buttons one-handed as plays happen. All stats calculate automatically.
                </p>
              </>
            )}
          </div>

          <button
            onClick={onNavigateToScore}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] font-semibold text-sm tracking-wide shadow-lg shadow-teal-900/40 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            {liveGame ? (
              <>
                <PlayCircle className="w-5 h-5" />
                Continue Scoring
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                Start a Live Game
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scheduled fixtures are separate from completed-game stats */}
      <UpcomingGames compact nextOnly />

      {/* Adaptive single-player Performance Counter */}
      <PerformanceCounter
        games={playerGames}
        liveGame={liveGame}
        inningsPerGame={settings.inningsPerGame}
        defaultSeason={activeProfile.defaultSeason}
      />

      {/* Batting, pitching and fielding milestones */}
      <MilestoneTracker
        games={playerGames.filter((game) => !liveGame || game.id !== liveGame.id)}
        onViewStats={onNavigateToStats}
      />

      {/* Season Snapshot (4 Tiles) */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
            Season Snapshot Overview
          </span>
          <span className="text-xs font-semibold text-slate-600 dark:text-[#D1D5DB]">
            {gameCount} {gameCount === 1 ? 'Game' : 'Games'} Logged
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-[#252D38] rounded-xl p-4 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Games</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">{gameCount}</span>
              <Activity className="w-4 h-4 text-slate-300 dark:text-[#6B7280]" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#252D38] rounded-xl p-4 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Batting Avg</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-semibold text-[#007A6A] dark:text-[#00D7BC]">{formatRate(batting.avg)}</span>
              <Award className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]/40" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#252D38] rounded-xl p-4 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Hits</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">{batting.h}</span>
              <span className="text-[11px] font-semibold text-slate-400">{batting.ab} AB</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#252D38] rounded-xl p-4 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Last Game Hits</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">
                {lastGameHits !== null ? lastGameHits : '—'}
              </span>
              <TrendingUp className="w-4 h-4 text-teal-500/60" />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Card to Full Stats Tab */}
      <button
        onClick={onNavigateToStats}
        className="w-full p-5 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/10 dark:from-[#00D7BC]/10 dark:to-teal-950/40 border border-teal-200 dark:border-[#00D7BC]/30 text-left flex items-center justify-between group transition-all hover:shadow-md"
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] group-hover:scale-105 transition-transform">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="font-medium text-sm text-slate-900 dark:text-[#FAFAFA]">
              View Full Player Statistics & Deep Dive Breakdowns
            </div>
            <div className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-0.5">
              Explore complete batting slash lines, pitching splits, fielding positions, and tournament breakdowns.
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#007A6A] dark:text-[#00D7BC] group-hover:translate-x-1 transition-transform" />
      </button>

      {/* Help Link Footer */}
      <button
        onClick={onOpenHelp}
        className="w-full p-5 rounded-2xl bg-gradient-to-r from-blue-50/70 via-emerald-500/10 to-blue-50/10 dark:from-[#00D7BC]/10 dark:to-teal-950/40 border border-teal-200 dark:border-[#00D7BC]/30 text-left flex items-center justify-between group transition-all hover:shadow-md"
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] group-hover:scale-105 transition-transform">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="font-medium text-sm text-slate-900 dark:text-[#FAFAFA]">
              New to scorekeeping?
            </div>
            <div className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                            Open the quick guide to see what every scoring button means with real examples.

            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#007A6A] dark:text-[#00D7BC] group-hover:translate-x-1 transition-transform" />
      </button>

    </div>
  );
};