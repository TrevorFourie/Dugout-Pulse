import React, { useMemo, useState } from 'react';
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
  ArrowUpRight,
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
  onOpenPlayerProfile: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  onNavigateToScore,
  onNavigateToStats,
  onOpenHelp,
  onOpenPlayerProfile,
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

  const [performanceTab, setPerformanceTab] = useState<'snapshot' | 'personalBest' | 'milestones'>('snapshot');

  if (isLoading) {
    // Keep the first React frame visually aligned with the native splash while
    // SQLite is restored before the dashboard is rendered.
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
  const performanceTabs = [
    { id: 'snapshot', label: 'Snapshot' },
    { id: 'personalBest', label: 'Personal Best' },
    { id: 'milestones', label: 'Milestones' },
  ] as const;
  const handlePerformanceTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const currentIndex = performanceTabs.findIndex((tab) => tab.id === performanceTab);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? performanceTabs.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + performanceTabs.length) % performanceTabs.length;
    const nextTab = performanceTabs[nextIndex];
    setPerformanceTab(nextTab.id);
    document.getElementById(`dashboard-performance-tab-${nextTab.id}`)?.focus();
  };

  const playerNameDisplay = activeProfile.playerName
    ? `${activeProfile.playerName}`
    : "Your player";

  const activeTeam = (liveGame
    ? activeProfile.teams?.find((team) => team.name.trim().toLocaleLowerCase() === liveGame.teamName.trim().toLocaleLowerCase())
    : undefined) || activeProfile.teams?.find((team) => team.isDefault) || activeProfile.teams?.[0];
  const activeJerseyNumber = activeTeam?.jerseyNumber?.trim();
  const teamNameDisplay = activeProfile.teamName || 'Set team name in Settings';

  return (
    <div className="flex-1 overflow-y-auto pb-24 px-4 sm:px-6 pt-4 max-w-4xl mx-auto w-full space-y-5 animate-in fade-in duration-200">
      {/* App & Season Header */}
      <div className="bg-white dark:bg-[#252D38] rounded-2xl p-4 border border-slate-200/80 dark:border-[#354050] shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onOpenPlayerProfile}
            aria-label="Open Player Details settings"
            className="group relative flex w-full min-w-0 items-center gap-3 rounded-xl pr-7 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00BFA5]"
          >
            {/* Player profile image; TeamLogoImage falls back to TeamIcon when no image is selected. */}
            <div className="relative w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 shrink-0">
              <div className="w-full h-full rounded-lg overflow-hidden bg-[#18212D] dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] flex items-center justify-center shadow-xs group-hover:border-[#00BFA5]/50 transition-colors">
                <TeamLogoImage value={activeProfile.logo} alt="" className="w-full h-full object-contain p-1" />
              </div>
              {activeJerseyNumber && (
                <span
                  aria-label={`Jersey number ${activeJerseyNumber}`}
                  className="absolute -right-1.5 -bottom-1 z-10 rounded-md border border-white/80 dark:border-[#354050] bg-[#00BFA5] dark:bg-[#00D7BC] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[#18212D] shadow-sm"
                >
                  #{activeJerseyNumber}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 py-0 leading-tight">
              <span className="block text-[11px] sm:text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC]">One more game.</span>
              <span className="block text-sm sm:text-base font-semibold text-[#18212D] dark:text-[#FAFAFA]">One more opportunity.</span>
              <h1 className="mt-0.5 text-xl sm:text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA] tracking-tight">
                {playerNameDisplay}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-[#9CA3AF] flex items-center flex-wrap leading-tight">
                <span className="py-0.5 text-slate-700 dark:text-[#D1D5DB]">
                  {teamNameDisplay}
                </span>
                {activeProfile.defaultAgeGroup && (
                  <span className="text-slate-700 dark:text-[#D1D5DB] px-0.5"> · {activeProfile.defaultAgeGroup}</span>
                )}
              </p>
              {(activeProfile.fieldingPositions?.length || activeProfile.battingSide || activeProfile.throwingArm) && (
                <p className="mt-0.5 text-[11px] sm:text-xs font-medium text-slate-600 dark:text-[#B8C2CF] flex flex-wrap items-center gap-x-2 gap-y-0 leading-tight">
                  {activeProfile.fieldingPositions?.length ? (
                    <span>{activeProfile.fieldingPositions.map((position) => position === 'P' ? 'P' : position).join(', ')}</span>
                  ) : null}
                  {activeProfile.battingSide ? <span>Bats {activeProfile.battingSide === 'Right' ? 'R' : activeProfile.battingSide === 'Left' ? 'L' : 'R/L'}</span> : null}
                  {activeProfile.throwingArm ? <span>Throws {activeProfile.throwingArm === 'Right' ? 'R' : activeProfile.throwingArm === 'Left' ? 'L' : 'R/L'}</span> : null}
                </p>
              )}
            </div>
            <ArrowUpRight className="absolute right-0.5 top-0.5 h-5 w-5 shrink-0 text-[#007A6A] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-[#00D7BC]" aria-hidden="true" />
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

      {/* Player performance detail tabs */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs sm:p-4 dark:border-[#354050] dark:bg-[#252D38]">
        <div role="tablist" aria-label="Player performance details" className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200/80 bg-slate-100 p-1.5 dark:border-[#354050] dark:bg-[#1A2028]">
          {performanceTabs.map((tab) => {
            const selected = performanceTab === tab.id;
            const TabIcon = tab.id === 'snapshot' ? Activity : tab.id === 'personalBest' ? Award : Sparkles;
            return (
              <button
                key={tab.id}
                id={`dashboard-performance-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="dashboard-performance-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setPerformanceTab(tab.id)}
                onKeyDown={handlePerformanceTabKeyDown}
                className={`relative flex min-h-[3.25rem] min-w-0 items-center justify-center gap-1.5 rounded-lg border px-1.5 py-2 text-[11px] font-semibold transition-all duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00BFA5] sm:gap-2 sm:px-3 sm:text-sm ${
                  selected
                    ? 'border-[#00BFA5] bg-[#00BFA5] text-[#18212D] shadow-md shadow-teal-900/15 dark:border-[#00D7BC] dark:bg-[#00D7BC] dark:text-[#101419] dark:shadow-black/20'
                    : 'border-transparent bg-white text-slate-600 shadow-xs hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:bg-[#252D38] dark:text-[#B8C2CF] dark:hover:border-[#465160] dark:hover:bg-[#2D3643] dark:hover:text-[#FAFAFA]'
                }`}
              >
                <TabIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{tab.label}</span>
                {selected && <span className="ml-0.5 hidden h-1.5 w-1.5 shrink-0 rounded-full bg-[#18212D] sm:block" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <div id="dashboard-performance-panel" role="tabpanel" aria-labelledby={`dashboard-performance-tab-${performanceTab}`} className="p-4 sm:p-5">
          {performanceTab === 'snapshot' && (
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
                <div className="bg-slate-50 dark:bg-[#1A2028] rounded-xl p-4 border border-slate-200/80 dark:border-[#354050] flex flex-col justify-between">
                  <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-[#9CA3AF] tracking-wider">Games</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl sm:text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">{gameCount}</span>
                    <Activity className="w-4 h-4 text-slate-400 dark:text-[#6B7280]" />
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-[#1A2028] rounded-xl p-4 border border-slate-200/80 dark:border-[#354050] flex flex-col justify-between">
                  <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-[#9CA3AF] tracking-wider">Batting Avg</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl sm:text-2xl font-semibold text-[#007A6A] dark:text-[#00D7BC]">{formatRate(batting.avg)}</span>
                    <Award className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]/60" />
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-[#1A2028] rounded-xl p-4 border border-slate-200/80 dark:border-[#354050] flex flex-col justify-between">
                  <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-[#9CA3AF] tracking-wider">Hits</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl sm:text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">{batting.h}</span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF]">{batting.ab} AB</span>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-[#1A2028] rounded-xl p-4 border border-slate-200/80 dark:border-[#354050] flex flex-col justify-between">
                  <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-[#9CA3AF] tracking-wider">Last Game Hits</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl sm:text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">{lastGameHits !== null ? lastGameHits : '—'}</span>
                    <TrendingUp className="w-4 h-4 text-teal-500/60" />
                  </div>
                </div>
              </div>
            </div>
          )}
          {performanceTab === 'personalBest' && (
            <MilestoneTracker
              games={playerGames.filter((game) => !liveGame || game.id !== liveGame.id)}
              view="personalBest"
              onViewStats={onNavigateToStats}
            />
          )}
          {performanceTab === 'milestones' && (
            <MilestoneTracker
              games={playerGames.filter((game) => !liveGame || game.id !== liveGame.id)}
              view="milestones"
              onViewStats={onNavigateToStats}
            />
          )}
        </div>
      </section>

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