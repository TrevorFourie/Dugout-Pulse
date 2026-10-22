import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { ThemedDropdown } from './ThemedDropdown';

interface StatsFiltersPanelProps {
  isFilterActive: boolean;
  filteredGameCount: number;
  playerGameCount: number;
  selectedTeam: string;
  setSelectedTeam: React.Dispatch<React.SetStateAction<string>>;
  selectedSeason: string;
  setSelectedSeason: React.Dispatch<React.SetStateAction<string>>;
  selectedAgeGroup: string;
  setSelectedAgeGroup: React.Dispatch<React.SetStateAction<string>>;
  selectedTournament: string;
  setSelectedTournament: React.Dispatch<React.SetStateAction<string>>;
  availableTeams: string[];
  availableSeasons: string[];
  availableAgeGroups: string[];
  availableTournaments: string[];
  handleResetFilters: () => void;
}

export const StatsFiltersPanel: React.FC<StatsFiltersPanelProps> = ({
  isFilterActive, filteredGameCount, playerGameCount,
  selectedTeam, setSelectedTeam, selectedSeason, setSelectedSeason,
  selectedAgeGroup, setSelectedAgeGroup, selectedTournament, setSelectedTournament,
  availableTeams, availableSeasons, availableAgeGroups, availableTournaments,
  handleResetFilters,
}) => (
  <>
      {/* Interactive Filters Bar */}
      <div className="bg-white dark:bg-[#252D38] rounded-2xl p-4 border border-slate-200/80 dark:border-[#354050] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]" />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-900 dark:text-[#FAFAFA]">
              Filter Stats
            </span>
            {isFilterActive && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-[#00D7BC]/15 text-[#007A6A] dark:text-[#00D7BC]">
                Filtered: {filteredGameCount} of {playerGameCount} games
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
          <div className="min-w-0">
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Team</label>
            <ThemedDropdown<string>
              ariaLabel="Filter stats by team"
              value={selectedTeam}
              placeholder="All Teams"
              allowClear={false}
              onChange={(next) => next && setSelectedTeam(next)}
              options={[
                { value: 'ALL', label: `All Teams (${availableTeams.length || 1})` },
                ...availableTeams.map((team) => ({ value: team, label: team })),
              ]}
              className="w-full"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Season</label>
            <ThemedDropdown<string>
              ariaLabel="Filter stats by season"
              value={selectedSeason}
              placeholder="All Seasons"
              allowClear={false}
              onChange={(next) => next && setSelectedSeason(next)}
              options={[
                { value: 'ALL', label: 'All Seasons' },
                ...availableSeasons.map((season) => ({ value: season, label: season })),
              ]}
              className="w-full"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Age Group</label>
            <ThemedDropdown<string>
              ariaLabel="Filter stats by age group"
              value={selectedAgeGroup}
              placeholder="All Age Groups"
              allowClear={false}
              onChange={(next) => next && setSelectedAgeGroup(next)}
              options={[
                { value: 'ALL', label: 'All Age Groups' },
                ...availableAgeGroups.map((ageGroup) => ({ value: ageGroup, label: ageGroup })),
              ]}
              className="w-full"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Tournament</label>
            <ThemedDropdown<string>
              ariaLabel="Filter stats by tournament"
              value={selectedTournament}
              placeholder="All Games"
              allowClear={false}
              onChange={(next) => next && setSelectedTournament(next)}
              options={[
                { value: 'ALL', label: 'All Games' },
                { value: '__TOURNAMENTS_ONLY__', label: 'Tournaments Only' },
                { value: '__LEAGUE_ONLY__', label: 'Regular League Only' },
                ...availableTournaments.map((tournament) => ({ value: tournament, label: tournament })),
              ]}
              className="w-full"
            />
          </div>
        </div>
      </div>
  </>
);
