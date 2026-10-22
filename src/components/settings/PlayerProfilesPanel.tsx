import React, { useState } from 'react';
import { Check, Trash2, UserPlus } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { LINEUP_SPOTS } from '../../types/baseball';
import { ThemedDropdown } from '../ThemedDropdown';

interface PlayerProfilesPanelProps {
  isActive: boolean;
  onStatusMessage: (message: { text: string; isError: boolean }) => void;
}

export const PlayerProfilesPanel: React.FC<PlayerProfilesPanelProps> = ({ isActive, onStatusMessage }) => {
  const { profiles, activeProfile, addProfile, setActiveProfileId, deleteProfile } = useGame();
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newJersey, setNewJersey] = useState('');
  const [newDefaultLineupSpot, setNewDefaultLineupSpot] = useState<number | undefined>(undefined);
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    addProfile({
      playerName: newPlayerName.trim(),
      teamName: newTeamName.trim() || 'My Team',
      jerseyNumber: newJersey.trim(),
      defaultLineupSpot: newDefaultLineupSpot,
    });
    setNewPlayerName('');
    setNewTeamName('');
    setNewJersey('');
    setNewDefaultLineupSpot(undefined);
    setShowAddPlayer(false);
    onStatusMessage({ text: 'New player profile added!', isError: false });
  };

  if (!isActive) return null;

  return (
              <div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
                  Player Profiles ({profiles.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddPlayer(!showAddPlayer)}
                  className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC] hover:underline flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {showAddPlayer ? 'Cancel' : 'Add Player'}
                </button>
              </div>

              {showAddPlayer && (
                <form
                  onSubmit={handleAddPlayer}
                  className="p-3.5 mb-3 rounded-xl bg-slate-100 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] space-y-2.5"
                >
                  <div className="font-semibold text-xs text-slate-800 dark:text-[#D1D5DB]">
                    Add New Player
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Player Name (e.g. Jack) *"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      required
                      className="px-3 py-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs text-slate-900 dark:text-[#FAFAFA]"
                    />
                    <input
                      type="text"
                      placeholder="Team Name (e.g. Tigers)"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="px-3 py-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs text-slate-900 dark:text-[#FAFAFA]"
                    />
                    <input
                      type="text"
                      placeholder="Jersey # (e.g. 24)"
                      value={newJersey}
                      onChange={(e) => setNewJersey(e.target.value)}
                      className="px-3 py-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs text-slate-900 dark:text-[#FAFAFA]"
                    />
                    <ThemedDropdown<number>
                      value={newDefaultLineupSpot}
                      onChange={setNewDefaultLineupSpot}
                      options={LINEUP_SPOTS.map((s) => ({ value: s.spot, label: `#${s.spot} · ${s.label}` }))}
                      placeholder="Batting Spot (optional)"
                      ariaLabel="Batting spot (optional)"
                      allowClear={false}
                      className="w-full"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] font-semibold text-xs hover:bg-[#00A892] dark:hover:bg-[#00C4AB]"
                    >
                      Save Player
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {profiles.map((p) => {
                  const isActive = p.id === activeProfile.id;
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                        isActive
                          ? 'border-teal-400 bg-teal-50 dark:border-teal-700 dark:bg-teal-950/25'
                          : 'border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38]/30'
                      }`}
                    >
                      <div
                        onClick={() => setActiveProfileId(p.id)}
                        className="cursor-pointer flex-1 min-w-0"
                      >
                        <div className="font-semibold text-sm text-slate-900 dark:text-[#FAFAFA] flex items-center gap-2">
                          {p.playerName || 'Unnamed Player'}
                          {isActive && (
                            <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                          {p.teamName || 'No Team'}
                          {p.jerseyNumber ? ` · #${p.jerseyNumber}` : ''}
                          {p.defaultLineupSpot ? ` · Batting #${p.defaultLineupSpot}` : ''}
                        </div>
                      </div>

                      {profiles.length > 1 && !p.isDefault && (
                        <button
                          type="button"
                          onClick={() => deleteProfile(p.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-[#FF5252]/15"
                          title="Delete player"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

              </div>
  );
};
