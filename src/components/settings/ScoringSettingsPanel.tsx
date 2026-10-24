import React from 'react';
import { Sliders } from 'lucide-react';
import type { AppSettings } from '../../types/baseball';
import { CustomNumberInput } from './CustomNumberInput';

interface ScoringSettingsPanelProps {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
}

export const ScoringSettingsPanel: React.FC<ScoringSettingsPanelProps> = ({ settings, updateSettings }) => (
                <div className="space-y-6">
              {/* Scoring rules */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-3 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#18212D] dark:text-blue-400" />
                  Scoring & Formula Rules
                </h3>
  
                <div className="space-y-3 bg-slate-50 dark:bg-[#252D38]/40 p-4 rounded-xl border border-slate-200 dark:border-[#354050]">
                  {/* Home run auto Run + RBI */}
                  <div className="flex items-center justify-between">
                    <div className="pr-4">
                      <label className="text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] block">
                        Home run also records Run & RBI
                      </label>
                      <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                        With this on, a home run adds a run and an RBI automatically.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateSettings({
                          homeRunAddsRunAndRbi: !settings.homeRunAddsRunAndRbi,
                        })
                      }
                      className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                        settings.homeRunAddsRunAndRbi
                          ? 'bg-[#00BFA5] dark:bg-[#00D7BC]'
                          : 'bg-slate-300 dark:bg-[#354050]'
                      }`}
                    >
                      <div
                        className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                          settings.homeRunAddsRunAndRbi ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
  
                  <hr className="border-slate-200 dark:border-[#354050]" />
  
                  {/* Innings per game for ERA */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-x-2 mb-1.5">
                      <label className="text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">
                        Innings per game (for ERA formula)
                      </label>
                      <span className="font-extrabold text-sm text-[#007A6A] dark:text-[#00D7BC]">
                        {settings.inningsPerGame} innings
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mb-2">
                      Standard youth baseball is 6 or 7 innings; high school/pro is 9.
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {[6, 7, 8, 9].map((inn) => (
                        <button
                          key={inn}
                          type="button"
                          onClick={() => updateSettings({ inningsPerGame: inn })}
                          className={`py-2 rounded-md text-xs font-semibold transition-all ${
                            settings.inningsPerGame === inn
                              ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                              : 'bg-white dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050]'
                          }`}
                        >
                          {inn}<span className="hidden min-[400px]:inline"> Innings</span>
                        </button>
                      ))}
                    </div>
                    <CustomNumberInput
                      value={settings.inningsPerGame}
                      presets={[6, 7, 8, 9]}
                      min={1}
                      max={20}
                      label="Custom innings per game"
                      onChange={(n) => updateSettings({ inningsPerGame: n })}
                    />
                  </div>
  
                  <hr className="border-slate-200 dark:border-[#354050]" />
  
                  {/* Pitch Count Daily Limit */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-x-2 mb-1.5">
                      <label className="text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">
                        Pitch Count Daily Limit
                      </label>
                      <span className="font-extrabold text-sm text-blue-600 dark:text-blue-400">
                        {settings.pitchCountLimit || 85} pitches max
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mb-2">
                      Official Little League / USA Baseball Pitch Smart maximum daily threshold.
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {[50, 75, 85, 95].map((limit) => (
                        <button
                          key={limit}
                          type="button"
                          onClick={() => updateSettings({ pitchCountLimit: limit })}
                          className={`py-2 rounded-md text-xs font-semibold transition-all ${
                            (settings.pitchCountLimit || 85) === limit
                              ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                              : 'bg-white dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050]'
                          }`}
                        >
                          {limit}<span className="hidden min-[400px]:inline"> Pitches</span>
                        </button>
                      ))}
                    </div>
                    <CustomNumberInput
                      value={settings.pitchCountLimit || 85}
                      presets={[50, 75, 85, 95]}
                      min={1}
                      max={200}
                      label="Custom pitch count limit"
                      onChange={(n) => updateSettings({ pitchCountLimit: n })}
                    />
                  </div>
  
                  <hr className="border-slate-200 dark:border-[#354050]" />
  
                  {/* Hit Direction Tapper Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="pr-4">
                      <label className="text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] block">
                        Spray Chart & Hit Direction Tapper
                      </label>
                      <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                        Show the field after a ball is hit so you can mark where it landed and its trajectory.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateSettings({
                          trackHitLocation: !(settings.trackHitLocation ?? true),
                        })
                      }
                      className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                        (settings.trackHitLocation ?? true)
                          ? 'bg-[#00BFA5] dark:bg-[#00D7BC]'
                          : 'bg-slate-300 dark:bg-[#354050]'
                      }`}
                    >
                      <div
                        className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                          (settings.trackHitLocation ?? true) ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
  
                </div>
              </div>
  
              </div>
);
