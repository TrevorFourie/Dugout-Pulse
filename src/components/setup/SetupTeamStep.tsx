import React from 'react';
import { ArrowLeft, Check, Link, Shield, Trophy } from 'lucide-react';

type SetupStep = 1 | 2 | 3 | 4 | 5;

interface SetupTeamStepProps {
  step: SetupStep;
  playerName: string;
  teamName: string;
  setTeamName: (value: string) => void;
  jerseyNumber: string;
  setJerseyNumber: (value: string) => void;
  effectiveAgeGroup: string;
  effectiveSeason: string;
  effectiveTournament: string;
  error: string | null;
  setError: (value: string | null) => void;
  setStep: (value: SetupStep) => void;
  handleFinishSetup: (event: React.FormEvent) => void;
}

/** Final setup step: team details and the linked configuration summary. */
export const SetupTeamStep: React.FC<SetupTeamStepProps> = ({
  step,
  playerName,
  teamName,
  setTeamName,
  jerseyNumber,
  setJerseyNumber,
  effectiveAgeGroup,
  effectiveSeason,
  effectiveTournament,
  error,
  setError,
  setStep,
  handleFinishSetup,
}) => (
  <>
          {step === 5 && (
            <form onSubmit={handleFinishSetup} className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block mb-1">
                  Step 5 of 5 · Final Step
                </span>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-[#FAFAFA]">
                  Team Name & Link Options
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">
                  Give this team a name. The age group, season and tournament you've chosen will stay linked to it.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] mb-1.5 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]" />
                      Team Name *
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. Eastside Thunder, Hawks Travel"
                      value={teamName}
                      onChange={(e) => {
                        setTeamName(e.target.value);
                        if (error) setError(null);
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-base font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] mb-1.5 flex items-center gap-1.5">
                      <span>Jersey # on this Team</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 24"
                      value={jerseyNumber}
                      onChange={(e) => setJerseyNumber(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-base font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                  A player can wear a different number for each team, so jersey numbers are saved separately.
                </p>

                {/* THE LINKED CONFIGURATION CARD */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#252D38]/80 border-2 border-dashed border-[#00BFA5]/40 dark:border-[#00D7BC]/50 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC]">
                    <Link className="w-4 h-4" />
                    <span>Linked Team Configuration</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#1A2028] border border-slate-200 dark:border-[#354050]">
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">Player</span>
                      <strong className="text-slate-900 dark:text-[#FAFAFA] text-sm">
                        {playerName || 'Player'}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#1A2028] border border-slate-200 dark:border-[#354050]">
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">Team & Jersey</span>
                      <strong className="text-slate-900 dark:text-[#FAFAFA] text-sm truncate block">
                        {teamName || 'Your Team'} {jerseyNumber ? `· #${jerseyNumber}` : ''}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#1A2028] border border-slate-200 dark:border-[#354050]">
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">Age Division</span>
                      <span className="font-semibold text-slate-800 dark:text-[#D1D5DB]">
                        {effectiveAgeGroup}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#1A2028] border border-slate-200 dark:border-[#354050]">
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">Season</span>
                      <span className="font-semibold text-slate-800 dark:text-[#D1D5DB]">
                        {effectiveSeason}
                      </span>
                    </div>

                    {effectiveTournament && (
                      <div className="sm:col-span-2 p-2.5 rounded-xl bg-white dark:bg-[#1A2028] border border-slate-200 dark:border-[#354050]">
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase">Tournament</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5" />
                          <span>{effectiveTournament}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] leading-relaxed">
                    Games for this team will start with these details. You can change them or add another team anytime in Settings.
                  </p>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-[#354050]">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep(4);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={!teamName.trim()}
                  className="px-6 py-3 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] disabled:opacity-50 text-[#18212D] dark:text-[#101419] font-semibold text-sm flex items-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Finish Setup & Start Scoring</span>
                </button>
              </div>
            </form>
          )}

  </>
);
