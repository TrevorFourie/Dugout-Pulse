import React from 'react';
import { Check, ArrowLeft, ArrowRight, Trophy } from 'lucide-react';
import { PRESET_TOURNAMENTS } from '../setupScreenConstants';

type SetupStep = 1 | 2 | 3 | 4 | 5;

interface SetupTournamentStepProps {
  step: SetupStep;
  tournament: string;
  setTournament: (value: string) => void;
  customTournament: string;
  setCustomTournament: (value: string) => void;
  isCustomTournament: boolean;
  setIsCustomTournament: (value: boolean) => void;
  noTournament: boolean;
  setNoTournament: (value: boolean) => void;
  error: string | null;
  setError: (value: string | null) => void;
  setStep: (value: SetupStep) => void;
  handleNextFromTournament: () => void;
}

export const SetupTournamentStep: React.FC<SetupTournamentStepProps> = ({
  step,
  tournament,
  setTournament,
  customTournament,
  setCustomTournament,
  isCustomTournament,
  setIsCustomTournament,
  noTournament,
  setNoTournament,
  error,
  setError,
  setStep,
  handleNextFromTournament,
}) => (
  <>
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block mb-1">
                  Step 4 of 5
                </span>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-[#FAFAFA]">
                  Tournament or League Event
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">
                  Is this team playing in a specific tournament series or standard league play?
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESET_TOURNAMENTS.map((t) => {
                    const isSelected = !noTournament && !isCustomTournament && tournament === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setTournament(t);
                          setNoTournament(false);
                          setIsCustomTournament(false);
                          if (error) setError(null);
                        }}
                        className={`min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-transparent shadow-xs'
                            : 'bg-slate-50 dark:bg-[#252D38] text-slate-800 dark:text-[#D1D5DB] border-slate-200 dark:border-[#354050] hover:bg-slate-100 dark:hover:bg-[#2D3643]'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Trophy className="w-3.5 h-3.5 opacity-70 shrink-0 text-blue-500" />
                          <span className="truncate">{t}</span>
                        </span>
                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1 flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomTournament(!isCustomTournament);
                        setNoTournament(false);
                      }}
                      className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC] hover:underline"
                    >
                      {isCustomTournament ? 'Pick preset tournament' : '+ Enter custom tournament name'}
                    </button>
                  </div>

                  {isCustomTournament && (
                    <div className="animate-in fade-in duration-150">
                      <input
                        type="text"
                        autoFocus
                        placeholder="e.g. Memorial Day Classic, State Championship"
                        value={customTournament}
                        onChange={(e) => {
                          setCustomTournament(e.target.value);
                          if (error) setError(null);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-[#354050]">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep(3);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextFromTournament}
                  className="px-5 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] font-semibold text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <span>Continue to Team Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}


  </>
);
