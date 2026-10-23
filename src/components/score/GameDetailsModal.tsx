import React from 'react';
import { Home, Plane, Trash2, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { LINEUP_SPOTS } from '../../types/baseball';
import { OpponentCombobox } from '../OpponentCombobox';
import { ThemedDropdown } from '../ThemedDropdown';
import { ValueCombobox } from '../ValueCombobox';
import { DatePicker } from '../DatePicker';

interface GameDetailsModalProps {
  isOpen: boolean;
  isEditing: boolean;
  onClose: () => void;
  onDiscard: () => void;
  setLineupSpot: (spot: number) => void;
}

export const GameDetailsModal: React.FC<GameDetailsModalProps> = ({ isOpen, isEditing, onClose, onDiscard, setLineupSpot }) => {
  const { liveGame, updateLiveGameDetails, oppositionTeams, addOppositionTeam, allTournaments, deleteTournament, allAgeGroups, deleteAgeGroup, allSeasons, deleteSeason } = useGame();
  if (!isOpen || !liveGame) return null;
  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#1A2028] p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-[#354050] space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#354050]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00BFA5] dark:bg-[#00D7BC]" />
                <h3 className="font-semibold text-sm text-slate-900 dark:text-[#FAFAFA]">
                  Game & Lineup Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onClose()}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-[#D1D5DB]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
                <DatePicker value={liveGame.date} onChange={(date) => updateLiveGameDetails({ date })} ariaLabel="Game date" className="px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-xs text-slate-900 dark:text-[#FAFAFA]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Opponent</label>
                <OpponentCombobox
                  value={liveGame.opponent || ''}
                  onChange={(val) => updateLiveGameDetails({ opponent: val })}
                  oppositionTeams={oppositionTeams}
                  onAddTeam={addOppositionTeam}
                  placeholder="Search or select an opposition team"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Team Name</label>
                <input
                  type="text"
                  value={liveGame.teamName}
                  onChange={(e) => updateLiveGameDetails({ teamName: e.target.value })}
                  placeholder="e.g. Thunderbolts"
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-xs text-slate-900 dark:text-[#FAFAFA]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Final Result (Optional)</label>
                <input
                  type="text"
                  value={liveGame.finalResult || ''}
                  onChange={(e) => updateLiveGameDetails({ finalResult: e.target.value.trim() || undefined })}
                  placeholder="e.g. W 8-3 or Lost 2-5"
                  maxLength={40}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-xs text-slate-900 dark:text-[#FAFAFA]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Innings Played</label>
                <div className="flex items-center justify-between w-full px-1.5 py-1 rounded-md bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050]">
                  <button
                    type="button"
                    aria-label="Fewer innings"
                    disabled={liveGame.innings <= Math.max(1, ...liveGame.plays.map((p) => p.inning))}
                    onClick={() => updateLiveGameDetails({ innings: liveGame.innings - 1, inningsManual: true })}
                    className="w-8 h-7 rounded-md bg-white dark:bg-[#354050] border border-slate-300 dark:border-[#465160] text-sm font-semibold text-slate-700 dark:text-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <span className="text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]">{liveGame.innings}</span>
                  <button
                    type="button"
                    aria-label="More innings"
                    disabled={liveGame.innings >= 20}
                    onClick={() => updateLiveGameDetails({ innings: liveGame.innings + 1, inningsManual: true })}
                    className="w-8 h-7 rounded-md bg-white dark:bg-[#354050] border border-slate-300 dark:border-[#465160] text-sm font-semibold text-slate-700 dark:text-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Batting Position (Lineup Spot)</label>
                <ThemedDropdown<number>
                  value={liveGame.lineupSpot}
                  onChange={(spot) => {
                    updateLiveGameDetails({ lineupSpot: spot });
                    setLineupSpot(spot);
                  }}
                  options={LINEUP_SPOTS.map((s) => ({ value: s.spot, label: `#${s.spot} · ${s.label}` }))}
                  placeholder="Not assigned"
                  ariaLabel="Batting position (lineup spot)"
                  allowClear={false}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Team Role</label>
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-[#252D38] rounded-md border border-slate-300 dark:border-[#354050]">
                  <button
                    type="button"
                    onClick={() => updateLiveGameDetails({ isHome: true })}
                    className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
                      liveGame.isHome !== false
                        ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                        : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    <Home className="w-3.5 h-3.5 inline mr-1" />
                    <span>Home (vs)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLiveGameDetails({ isHome: false })}
                    className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
                      liveGame.isHome === false
                        ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                        : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    <Plane className="w-3.5 h-3.5 inline mr-1" />
                    <span>Away (@)</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tournament</label>
                <ValueCombobox
                  value={liveGame.tournament || ''}
                  onChange={(val) => updateLiveGameDetails({ tournament: val })}
                  options={allTournaments}
                  quickPills={allTournaments.slice(0, 4)}
                  onDeleteOption={deleteTournament}
                  placeholder="Tournament (optional)"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Age Group</label>
                <ValueCombobox
                  value={liveGame.ageGroup || ''}
                  onChange={(val) => updateLiveGameDetails({ ageGroup: val })}
                  options={allAgeGroups}
                  quickPills={allAgeGroups.slice(0, 5)}
                  onDeleteOption={deleteAgeGroup}
                  placeholder="Age group (e.g. U12)"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Season</label>
                <ValueCombobox
                  value={liveGame.season || ''}
                  onChange={(val) => updateLiveGameDetails({ season: val })}
                  options={allSeasons}
                  quickPills={allSeasons.slice(0, 4)}
                  onDeleteOption={deleteSeason}
                  placeholder="Season (e.g. Spring 2026)"
                />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => onClose()}
                className="w-full h-12 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] font-semibold text-sm transition-colors shadow-xs cursor-pointer"
              >
                Done
              </button>
              <button
                type="button"
                onClick={onDiscard}
                className="w-full h-11 rounded-md border-2 border-[#FF5252] bg-[#FF5252] hover:bg-[#A82E38] text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5252] focus-visible:ring-offset-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isEditing ? 'Cancel edit' : 'Discard this game'}</span>
              </button>
            </div>
          </div>
        </div>
  );
};
