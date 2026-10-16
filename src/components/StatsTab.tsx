import React, { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import {
  calculateSeasonStats,
  calculateGroupedStats,
  filterGames,
  formatRate,
  formatEraWhip,
} from '../utils/stats';
import { Play as GamePlay } from '../types/baseball';
import {
  Award,
  Shield,
  Activity,
  Trophy,
  Calendar,
  Layers,
  BarChart3,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { SprayChart } from './SprayChart';
import { isHitPlay } from '../utils/sprayChart';

interface StatsTabProps {
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}

export const StatsTab: React.FC<StatsTabProps> = ({
  onOpenSettings,
}) => {
  const {
    games,
    liveGame,
    activeProfile,
    settings,
    isLoading,
  } = useGame();

  const [activeStatGroup, setActiveStatGroup] = useState<'batting' | 'pitching' | 'fielding'>('batting');

  // Filters
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL');
  const [selectedSeason, setSelectedSeason] = useState<string>('ALL');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('ALL');
  const [selectedTournament, setSelectedTournament] = useState<string>('ALL');

  // Breakdown View
  const [activeBreakdownGroup, setActiveBreakdownGroup] = useState<'tournament' | 'season' | 'ageGroup' | 'teamName'>('tournament');
  const [breakdownStatType, setBreakdownStatType] = useState<'batting' | 'pitching' | 'fielding'>('batting');

  // All games for this player
  const playerGames = useMemo(() => {
    return games.filter((g) => !g.playerId || g.playerId === activeProfile.id);
  }, [games, activeProfile.id]);

  // Filtered games based on active filters
  const filteredGames = useMemo(() => {
    return filterGames(playerGames, {
      teamName: selectedTeam,
      season: selectedSeason,
      ageGroup: selectedAgeGroup,
      tournament: selectedTournament,
    });
  }, [playerGames, selectedTeam, selectedSeason, selectedAgeGroup, selectedTournament]);

  // Distinct filter options
  const availableTeams = useMemo(() => {
    const set = new Set<string>();
    if (activeProfile.teamName) set.add(activeProfile.teamName);
    (activeProfile.teams || []).forEach((t) => {
      if (t.name) set.add(t.name);
    });
    playerGames.forEach((g) => {
      if (g.teamName) set.add(g.teamName);
    });
    return Array.from(set).sort();
  }, [activeProfile, playerGames]);

  const availableSeasons = useMemo(() => {
    const set = new Set<string>();
    playerGames.forEach((g) => {
      if (g.season) set.add(g.season);
    });
    (activeProfile.teams || []).forEach((t) => {
      if (t.season) set.add(t.season);
    });
    return Array.from(set).sort();
  }, [playerGames, activeProfile.teams]);

  const availableAgeGroups = useMemo(() => {
    const set = new Set<string>();
    playerGames.forEach((g) => {
      if (g.ageGroup) set.add(g.ageGroup);
    });
    (activeProfile.teams || []).forEach((t) => {
      if (t.ageGroup) set.add(t.ageGroup);
    });
    return Array.from(set).sort();
  }, [playerGames, activeProfile.teams]);

  const availableTournaments = useMemo(() => {
    const set = new Set<string>();
    playerGames.forEach((g) => {
      if (g.tournament) set.add(g.tournament);
    });
    return Array.from(set).sort();
  }, [playerGames]);

  const isFilterActive =
    selectedTeam !== 'ALL' ||
    selectedSeason !== 'ALL' ||
    selectedAgeGroup !== 'ALL' ||
    selectedTournament !== 'ALL';

  const handleResetFilters = () => {
    setSelectedTeam('ALL');
    setSelectedSeason('ALL');
    setSelectedAgeGroup('ALL');
    setSelectedTournament('ALL');
  };

  // Grouped stats breakdown
  const groupedBreakdown = useMemo(() => {
    return calculateGroupedStats(
      isFilterActive ? filteredGames : playerGames,
      activeBreakdownGroup,
      settings.inningsPerGame
    );
  }, [filteredGames, playerGames, isFilterActive, activeBreakdownGroup, settings.inningsPerGame]);

  const allSeasonPlays: GamePlay[] = useMemo(() => {
    const list: GamePlay[] = [];
    const liveIsSavedCopy = Boolean(liveGame && playerGames.some((g) => g.id === liveGame.id));
    filteredGames.forEach((g) => {
      if (liveGame && g.id === liveGame.id) return;
      if (g.plays) {
        list.push(...g.plays);
      }
    });
    if (liveGame && liveGame.plays) {
      const liveVisible = !liveIsSavedCopy || filteredGames.some((g) => g.id === liveGame.id);
      if (liveVisible) list.push(...liveGame.plays);
    }
    return list;
  }, [filteredGames, playerGames, liveGame]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <div className="w-10 h-10 border-3 border-[#18212D] dark:border-[#354050] border-t-[#00BFA5] rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600 dark:text-[#9CA3AF]">
            Loading your stats…
          </p>
        </div>
      </div>
    );
  }

  const seasonStats = calculateSeasonStats(filteredGames, settings.inningsPerGame, activeProfile.id);
  const { batting, pitching, fielding } = seasonStats;

  return (
    <div className="flex-1 overflow-y-auto pb-24 px-4 sm:px-6 pt-4 max-w-4xl mx-auto w-full space-y-5 animate-in fade-in duration-200">
      {/* Title Header */}
      <div className="bg-white dark:bg-[#252D38] rounded-2xl p-5 border border-slate-200/80 dark:border-[#354050] shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#007A6A] dark:text-[#00D7BC]">
            PERFORMANCE ANALYTICS
          </span>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA] tracking-tight mt-0.5">
            Full Player Statistics & Breakdowns
          </h1>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#1A2028] text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050]"
        >
          Player Settings
        </button>
      </div>

      {/* Interactive Filters Bar */}
      <div className="bg-white dark:bg-[#252D38] rounded-2xl p-4 border border-slate-200/80 dark:border-[#354050] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-[#FAFAFA]">
              Filter Stats
            </span>
            {isFilterActive && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-[#00D7BC]/15 text-[#007A6A] dark:text-[#00D7BC]">
                Filtered: {filteredGames.length} of {playerGames.length} games
              </span>
            )}
          </div>
          {isFilterActive && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-[#D1D5DB] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Team</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]"
            >
              <option value="ALL">All Teams ({availableTeams.length || 1})</option>
              {availableTeams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Season</label>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]"
            >
              <option value="ALL">All Seasons</option>
              {availableSeasons.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Age Group</label>
            <select
              value={selectedAgeGroup}
              onChange={(e) => setSelectedAgeGroup(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]"
            >
              <option value="ALL">All Age Groups</option>
              {availableAgeGroups.map((ag) => <option key={ag} value={ag}>{ag}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Tournament</label>
            <select
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]"
            >
              <option value="ALL">All Games</option>
              <option value="__TOURNAMENTS_ONLY__">Tournaments Only</option>
              <option value="__LEAGUE_ONLY__">Regular League Only</option>
              {availableTournaments.map((tourney) => <option key={tourney} value={tourney}>{tourney}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Player Statistics Card */}
      <div className="bg-white dark:bg-[#252D38] rounded-2xl border border-slate-200/80 dark:border-[#354050] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#354050] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 dark:bg-[#1A2028]/60">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block">
              Player Statistics
            </span>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA]">
              Calculated Season Totals
            </h3>
          </div>

          <div className="flex p-1 rounded-xl bg-slate-200/80 dark:bg-[#252D38]">
            {(['batting', 'pitching', 'fielding'] as const).map((group) => (
              <button
                key={group}
                onClick={() => setActiveStatGroup(group)}
                className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-all ${
                  activeStatGroup === group
                    ? 'bg-white dark:bg-[#354050] text-[#18212D] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {activeStatGroup === 'batting' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 dark:bg-[#252D38]/40 p-3 rounded-xl border border-slate-200 dark:border-[#354050]">
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">AVG</div>
                  <div className="text-lg sm:text-xl font-semibold text-[#007A6A] dark:text-[#00D7BC]">{formatRate(batting.avg)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">OBP</div>
                  <div className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-[#FAFAFA]">{formatRate(batting.obp)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">SLG</div>
                  <div className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-[#FAFAFA]">{formatRate(batting.slg)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">OPS</div>
                  <div className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-[#FAFAFA]">{formatRate(batting.ops)}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">H (Hits)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.h}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">HR (Home Runs)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.hr}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">2B (Doubles)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.doubles}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">3B (Triples)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.triples}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">RBI</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.rbi}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">R (Runs)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.r}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">BB (Walks)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.bb}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">IBB</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.ibb}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">SO (Strikeouts)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.so}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">SB (Stolen Bases)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.sb}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">CS (Caught Stealing)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.cs}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">PA (Appearances)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.pa}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">AB (At Bats)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.ab}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">SH (Sac Bunts)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.sh}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">TB</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.tb}</div>
                </div>
              </div>

              {/* Handedness Splits */}
              <div className="pt-2 border-t border-slate-200 dark:border-[#354050] space-y-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] block">
                  Pitcher Handedness Splits
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-[#354050] text-[10px] font-extrabold uppercase text-slate-400">
                        <th className="py-2 pr-3">Split</th>
                        <th className="py-2 px-2 text-center">PA</th>
                        <th className="py-2 px-2 text-center">AB</th>
                        <th className="py-2 px-2 text-center">H</th>
                        <th className="py-2 px-2 text-center text-[#007A6A] dark:text-[#00D7BC]">AVG</th>
                        <th className="py-2 px-2 text-center">OBP</th>
                        <th className="py-2 px-2 text-center">SLG</th>
                        <th className="py-2 px-2 text-center">OPS</th>
                        <th className="py-2 px-2 text-center">HR</th>
                        <th className="py-2 pl-2 text-center">SO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#354050] font-semibold">
                      <tr>
                        <td className="py-2 pr-3 text-slate-900 dark:text-[#FAFAFA] font-extrabold">vs Righties (RHP)</td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsRHP.pa}</td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsRHP.ab}</td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsRHP.h}</td>
                        <td className="py-2 px-2 text-center text-[#007A6A] dark:text-[#00D7BC] font-semibold">{formatRate(seasonStats.splits.vsRHP.avg)}</td>
                        <td className="py-2 px-2 text-center">{formatRate(seasonStats.splits.vsRHP.obp)}</td>
                        <td className="py-2 px-2 text-center">{formatRate(seasonStats.splits.vsRHP.slg)}</td>
                        <td className="py-2 px-2 text-center">{formatRate(seasonStats.splits.vsRHP.ops)}</td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsRHP.hr}</td>
                        <td className="py-2 pl-2 text-center">{seasonStats.splits.vsRHP.so}</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-3 text-slate-900 dark:text-[#FAFAFA] font-extrabold">vs Lefties (LHP)</td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsLHP.pa}</td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsLHP.ab}</td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsLHP.h}</td>
                        <td className="py-2 px-2 text-center text-[#007A6A] dark:text-[#00D7BC] font-semibold">{formatRate(seasonStats.splits.vsLHP.avg)}</td>
                        <td className="py-2 px-2 text-center">{formatRate(seasonStats.splits.vsLHP.obp)}</td>
                        <td className="py-2 px-2 text-center">{formatRate(seasonStats.splits.vsLHP.slg)}</td>
                        <td className="py-2 px-2 text-center">{formatRate(seasonStats.splits.vsLHP.ops)}</td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsLHP.hr}</td>
                        <td className="py-2 pl-2 text-center">{seasonStats.splits.vsLHP.so}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Spray Chart */}
              <div className="pt-3 border-t border-slate-200 dark:border-[#354050] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] block">
                    Batting Spray Chart & Hit Direction
                  </span>
                </div>
                <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#252D38]/40 border border-slate-200 dark:border-[#354050]">
                  <SprayChart
                    plays={allSeasonPlays}
                    heightClass="h-72 sm:h-80"
                    showFilters={true}
                    showStats={true}
                    showLegend={true}
                    defaultView="zones"
                    showViewToggle={true}
                    enable3DReplay={true}
                    title="Batting Spray Chart Analysis"
                  />
                </div>
              </div>
            </div>
          )}

          {activeStatGroup === 'pitching' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 dark:bg-[#252D38]/40 p-3 rounded-xl border border-slate-200 dark:border-[#354050]">
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">IP</div>
                  <div className="text-lg sm:text-xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">{pitching.ipDisplay}</div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">ERA ({settings.inningsPerGame} Inn)</div>
                  <div className="text-lg sm:text-xl font-semibold text-[#007A6A] dark:text-[#00D7BC]">{formatEraWhip(pitching.era)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">WHIP</div>
                  <div className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-[#FAFAFA]">{formatEraWhip(pitching.whip)}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">K (Strikeouts)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.k}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">H (Hits Allowed)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.h}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">BB (Walks)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.bb}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">ER (Earned Runs)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.er}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">Pitches</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.pitches}</div>
                </div>
              </div>
            </div>
          )}

          {activeStatGroup === 'fielding' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-center bg-slate-50 dark:bg-[#252D38]/40 p-3 rounded-xl border border-slate-200 dark:border-[#354050]">
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">Fielding % (FPCT)</div>
                  <div className="text-lg sm:text-xl font-semibold text-[#007A6A] dark:text-[#00D7BC]">{formatRate(fielding.fpct)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">Total Chances</div>
                  <div className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-[#FAFAFA]">{fielding.chances}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">PO (Putouts)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{fielding.po}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">A (Assists)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{fielding.a}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">E (Errors)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{fielding.e}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">DP (Double Plays)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{fielding.dp}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deep Dive Breakdowns Card */}
      <div className="bg-white dark:bg-[#252D38] rounded-2xl border border-slate-200/80 dark:border-[#354050] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#354050] bg-slate-50/70 dark:bg-[#1A2028]/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block">
                Deep Dive Breakdowns
              </span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA] mt-0.5">
              Stats by Tournament, Season, Age & Team
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-slate-200/80 dark:bg-[#252D38] w-full md:w-auto">
            {[
              { id: 'tournament', label: 'By Tournament', icon: Trophy, color: 'text-blue-500' },
              { id: 'season', label: 'By Season', icon: Calendar, color: 'text-teal-500' },
              { id: 'ageGroup', label: 'By Age Group', icon: Layers, color: 'text-blue-500' },
              { id: 'teamName', label: 'By Team', icon: Shield, color: 'text-[#007A6A] dark:text-[#00D7BC]' },
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveBreakdownGroup(tab.id as any)}
                  className={`px-2.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap truncate text-center transition-all flex items-center justify-center gap-1.5 ${
                    activeBreakdownGroup === tab.id
                      ? 'bg-white dark:bg-[#354050] text-[#18212D] dark:text-[#FAFAFA] shadow-xs'
                      : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  <IconComponent className={`w-3.5 h-3.5 shrink-0 ${tab.color}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Breakdowns Table */}
        <div className="p-4 sm:p-5">
          {groupedBreakdown.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-[#252D38]/30 rounded-xl border border-dashed border-slate-200 dark:border-[#354050] space-y-2">
              <Trophy className="w-8 h-8 text-slate-300 dark:text-[#6B7280] mx-auto" />
              <div className="text-sm font-semibold text-slate-700 dark:text-[#D1D5DB]">
                No breakdown data available yet
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#354050] text-[10px] font-extrabold uppercase text-slate-400">
                    <th className="py-2.5 pr-4">Group</th>
                    <th className="py-2.5 px-2 text-center">Games</th>
                    <th className="py-2.5 px-2 text-center">H</th>
                    <th className="py-2.5 px-2 text-center">HR</th>
                    <th className="py-2.5 px-2 text-center">RBI</th>
                    <th className="py-2.5 px-2 text-center text-[#007A6A] dark:text-[#00D7BC]">AVG</th>
                    <th className="py-2.5 pl-2 text-center">OPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#354050] font-semibold">
                  {groupedBreakdown.map((group) => {
                    const b = group.batting;
                    return (
                      <tr key={group.groupKey} className="hover:bg-slate-50 dark:hover:bg-[#252D38]/50 transition-colors">
                        <td className="py-3 pr-4 text-slate-900 dark:text-[#FAFAFA] font-extrabold flex items-center gap-2">
                          <span className="truncate max-w-[180px] sm:max-w-xs">{group.groupLabel}</span>
                        </td>
                        <td className="py-3 px-2 text-center">{group.gameCount}</td>
                        <td className="py-3 px-2 text-center">{b.h}</td>
                        <td className="py-3 px-2 text-center">{b.hr}</td>
                        <td className="py-3 px-2 text-center">{b.rbi}</td>
                        <td className="py-3 px-2 text-center text-[#007A6A] dark:text-[#00D7BC]">{formatRate(b.avg)}</td>
                        <td className="py-3 pl-2 text-center">{formatRate(b.ops)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};