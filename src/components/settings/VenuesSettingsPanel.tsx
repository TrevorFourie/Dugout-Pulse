import React, { useState } from 'react';
import { Check, Edit2, MapPin, Plus, Trash2, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';

interface VenuesSettingsPanelProps {
  isActive: boolean;
  onStatusMessage: (message: { text: string; isError: boolean }) => void;
}

export const VenuesSettingsPanel: React.FC<VenuesSettingsPanelProps> = ({ isActive, onStatusMessage }) => {
  const { settings, updateSettings } = useGame();
  const [newVenueInput, setNewVenueInput] = useState('');
  const [editingVenue, setEditingVenue] = useState<string | null>(null);
  const [editingVenueValue, setEditingVenueValue] = useState('');
  if (!isActive) return null;

  return (
              <div className="space-y-5">
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
                    <MapPin className="h-4 w-4 text-[#007A6A] dark:text-[#00D7BC]" />
                    Venues
                  </h3>
                  <p className="mb-4 text-xs text-slate-500 dark:text-[#9CA3AF]">
                    Save the ballparks and fields where your team plays. You can manage this list here for use in game scheduling.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const venue = newVenueInput.trim();
                      if (!venue) return;
                      const currentVenues = settings.venues || [];
                      if (currentVenues.some((item) => item.toLowerCase() === venue.toLowerCase())) {
                        onStatusMessage({ text: 'That venue is already in your list.', isError: true });
                        return;
                      }
                      updateSettings({ venues: [...currentVenues, venue] });
                      setNewVenueInput('');
                      onStatusMessage({ text: `Venue "${venue}" added.`, isError: false });
                    }}
                    className="flex flex-col gap-2 sm:flex-row"
                  >
                    <input
                      type="text"
                      value={newVenueInput}
                      onChange={(e) => setNewVenueInput(e.target.value)}
                      placeholder="Venue or field name"
                      aria-label="Venue or field name"
                      className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA]"
                    />
                    <button
                      type="submit"
                      disabled={!newVenueInput.trim()}
                      className="flex shrink-0 items-center justify-center gap-1 rounded-xl bg-[#00BFA5] px-3.5 py-2.5 text-xs font-semibold text-[#18212D] shadow-xs hover:bg-[#00AD96] disabled:opacity-50 dark:bg-[#00D7BC] dark:text-[#101419]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Venue
                    </button>
                  </form>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF]">
                    Saved Venues ({(settings.venues || []).length})
                  </div>
                  {(settings.venues || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500 dark:border-[#354050] dark:text-[#9CA3AF]">
                      No venues saved yet. Add your first venue above.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(settings.venues || []).map((venue) => {
                        const isEditingVenue = editingVenue === venue;
                        const saveVenueEdit = () => {
                          const renamedVenue = editingVenueValue.trim();
                          if (!renamedVenue) {
                            onStatusMessage({ text: 'Venue name cannot be empty.', isError: true });
                            return;
                          }
                          if ((settings.venues || []).some((item) => item !== venue && item.toLowerCase() === renamedVenue.toLowerCase())) {
                            onStatusMessage({ text: 'A venue with that name already exists.', isError: true });
                            return;
                          }
                          if (renamedVenue !== venue) {
                            const updatedVenues = (settings.venues || []).map((item) => item === venue ? renamedVenue : item);
                            updateSettings({ venues: updatedVenues });
                            // Keep previously scheduled games in sync with the renamed master venue.
                            try {
                              const upcomingGamesKey = 'dugoutPulse.upcomingGames.v1';
                              const storedGames = localStorage.getItem(upcomingGamesKey);
                              if (storedGames) {
                                const parsedGames = JSON.parse(storedGames);
                                if (Array.isArray(parsedGames)) {
                                  const updatedGames = parsedGames.map((game) =>
                                    game && typeof game.venue === 'string' && game.venue.trim().toLocaleLowerCase() === venue.trim().toLocaleLowerCase()
                                      ? { ...game, venue: renamedVenue }
                                      : game
                                  );
                                  localStorage.setItem(upcomingGamesKey, JSON.stringify(updatedGames));
                                }
                              }
                              window.dispatchEvent(new CustomEvent('dugout-pulse-venue-renamed', {
                                detail: { oldName: venue, newName: renamedVenue },
                              }));
                              onStatusMessage({ text: `Venue "${venue}" renamed to "${renamedVenue}" across saved venues and scheduled games.`, isError: false });
                            } catch {
                              onStatusMessage({ text: 'Venue name updated, but scheduled games could not be synchronized on this device. Please reopen Upcoming Games and check them.', isError: true });
                            }
                          }
                          setEditingVenue(null);
                          setEditingVenueValue('');
                        };
                        return (
                          <div key={venue} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-[#354050] dark:bg-[#252D38]/40">
                            <MapPin className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
                            {isEditingVenue ? (
                              <>
                                <input
                                  autoFocus
                                  type="text"
                                  value={editingVenueValue}
                                  onChange={(e) => setEditingVenueValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      saveVenueEdit();
                                    } else if (e.key === 'Escape') {
                                      setEditingVenue(null);
                                      setEditingVenueValue('');
                                    }
                                  }}
                                  aria-label={`Edit venue name ${venue}`}
                                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-semibold text-slate-900 dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA]"
                                />
                                <button
                                  type="button"
                                  onClick={saveVenueEdit}
                                  aria-label={`Save venue name ${venue}`}
                                  title="Save venue name"
                                  className="rounded-lg p-2 text-teal-600 hover:bg-teal-50 dark:text-[#00D7BC] dark:hover:bg-teal-950/40"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingVenue(null); setEditingVenueValue(''); }}
                                  aria-label="Cancel venue edit"
                                  title="Cancel"
                                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#354050]"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">{venue}</span>
                                <button
                                  type="button"
                                  onClick={() => { setEditingVenue(venue); setEditingVenueValue(venue); }}
                                  aria-label={`Edit ${venue}`}
                                  title="Edit venue"
                                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#007A6A] dark:text-[#9CA3AF] dark:hover:bg-[#354050] dark:hover:text-[#00D7BC]"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateSettings({ venues: (settings.venues || []).filter((item) => item !== venue) });
                                    if (editingVenue === venue) { setEditingVenue(null); setEditingVenueValue(''); }
                                    onStatusMessage({ text: `Venue "${venue}" removed.`, isError: false });
                                  }}
                                  aria-label={`Remove ${venue}`}
                                  title="Remove venue"
                                  className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-[#FF5252]/15"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
  );
};
