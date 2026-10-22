import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { SetupBackupRestoreDialog } from './SetupBackupRestoreDialog';
import { SetupProgressHeader } from './SetupProgressHeader';
import { SetupPlayerStep } from './setup/SetupPlayerStep';
import { SetupAgeGroupStep } from './setup/SetupAgeGroupStep';
import { currentYear, PRESET_SEASONS, PRESET_TOURNAMENTS } from './setupScreenConstants';
import {
  Users,
  Calendar,
  Trophy,
  Shield,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Link,
  ChevronRight,
} from 'lucide-react';

interface SetupScreenProps {
  onComplete?: () => void;
}

type SetupStep = 1 | 2 | 3 | 4 | 5;

export const SetupScreen: React.FC<SetupScreenProps> = ({
  onComplete,
}) => {
  const { completeFirstTimeSetup, setIsFirstTimeUser, importJsonData } = useGame();

  const [step, setStep] = useState<SetupStep>(1);
  const [importMessage, setImportMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [pendingBackupFile, setPendingBackupFile] = useState<File | null>(null);

  // Form states in the exact requested order
  // 1. Player Name
  const [playerName, setPlayerName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');

  // 2. Age Group
  const [ageGroup, setAgeGroup] = useState('U12');
  const [customAgeGroup, setCustomAgeGroup] = useState('');
  const [isCustomAge, setIsCustomAge] = useState(false);

  // 3. Season
  const [season, setSeason] = useState(`Spring ${currentYear}`);
  const [customSeason, setCustomSeason] = useState('');
  const [isCustomSeason, setIsCustomSeason] = useState(false);

  // 4. Tournament
  const [tournament, setTournament] = useState('League / Regular Season');
  const [customTournament, setCustomTournament] = useState('');
  const [isCustomTournament, setIsCustomTournament] = useState(false);
  const [noTournament, setNoTournament] = useState(false);

  // 5. Team & Linking
  const [teamName, setTeamName] = useState('');

  // Validation errors
  const [error, setError] = useState<string | null>(null);

  const effectiveAgeGroup = isCustomAge ? customAgeGroup.trim() || 'U12' : ageGroup;
  const effectiveSeason = isCustomSeason ? customSeason.trim() || `${currentYear}` : season;
  const effectiveTournament = noTournament
    ? ''
    : isCustomTournament
      ? customTournament.trim()
      : tournament === 'League / Regular Season'
        ? ''
        : tournament;

  const handleNextFromPlayer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!playerName.trim()) {
      setError('Please enter your player’s name to continue');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleNextFromAge = () => {
    if (isCustomAge && !customAgeGroup.trim()) {
      setError('Please enter a custom age group or pick one from the list');
      return;
    }
    setError(null);
    setStep(3);
  };

  const handleNextFromSeason = () => {
    if (isCustomSeason && !customSeason.trim()) {
      setError('Please enter a custom season name or pick one from the list');
      return;
    }
    setError(null);
    setStep(4);
  };

  const handleNextFromTournament = () => {
    if (!noTournament && isCustomTournament && !customTournament.trim()) {
      setError('Please enter a tournament name or select an option');
      return;
    }
    setError(null);
    setStep(5);
  };

  const handleFinishSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setError('Please enter a team name to link your options');
      return;
    }

    completeFirstTimeSetup({
      playerName: playerName.trim(),
      ageGroup: effectiveAgeGroup,
      season: effectiveSeason,
      tournament: effectiveTournament || undefined,
      teamName: teamName.trim(),
      jerseyNumber: jerseyNumber.trim() || undefined,
    });

    if (onComplete) {
      onComplete();
    }
  };

  const handleConfirmImport = () => {
    if (!pendingBackupFile) return;
    const file = pendingBackupFile;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = importJsonData(content);
        if (result.success) {
          setImportMessage({ text: result.message, isError: false });
          setIsFirstTimeUser(false);
          if (result.message !== 'Season data successfully restored!') {
            // This screen closes after a successful restore, so surface recovery warnings first.
            window.alert(result.message);
          }
          if (onComplete) onComplete();
        } else {
          setImportMessage({ text: result.message, isError: true });
        }
      }
    };
    reader.readAsText(file);
    setPendingBackupFile(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0B132B]/85 backdrop-blur-md overflow-y-auto app-scroll">
      <div className="w-full max-w-lg bg-white dark:bg-[#1A2028] rounded-3xl shadow-2xl border border-slate-200/90 dark:border-[#354050] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <SetupProgressHeader step={step} />

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-[#FF5252]/15 border border-red-200 dark:border-[#86252D] text-xs font-semibold text-red-600 dark:text-[#F6DADD] flex items-center gap-2 animate-in fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5252]" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <SetupPlayerStep
              playerName={playerName}
              setPlayerName={setPlayerName}
              error={error}
              setError={setError}
              importMessage={importMessage}
              onSubmit={handleNextFromPlayer}
              onBackupFileSelected={setPendingBackupFile}
            />
          )}

          {/* STEP 2: AGE GROUP */}
          <SetupAgeGroupStep
            step={step}
            playerName={playerName}
            ageGroup={ageGroup}
            setAgeGroup={setAgeGroup}
            customAgeGroup={customAgeGroup}
            setCustomAgeGroup={setCustomAgeGroup}
            isCustomAge={isCustomAge}
            setIsCustomAge={setIsCustomAge}
            error={error}
            setError={setError}
            setStep={setStep}
            handleNextFromAge={handleNextFromAge}
          />

          {/* STEP 3: SEASON */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block mb-1">
                  Step 3 of 5
                </span>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-[#FAFAFA]">
                  Which season is this for?
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">
                  Seasons keep games organized so you can view your player’s progress across spring, summer, or fall campaigns.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESET_SEASONS.map((s) => {
                    const isSelected = !isCustomSeason && season === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setSeason(s);
                          setIsCustomSeason(false);
                          if (error) setError(null);
                        }}
                        className={`min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-transparent shadow-xs'
                            : 'bg-slate-50 dark:bg-[#252D38] text-slate-800 dark:text-[#D1D5DB] border-slate-200 dark:border-[#354050] hover:bg-slate-100 dark:hover:bg-[#2D3643]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 opacity-70" />
                          <span>{s}</span>
                        </span>
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCustomSeason(!isCustomSeason)}
                    className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC] hover:underline flex items-center gap-1"
                  >
                    <span>{isCustomSeason ? 'Use preset season' : '+ Or enter custom season (e.g. Winter Showcase 2026)'}</span>
                  </button>

                  {isCustomSeason && (
                    <div className="mt-2 animate-in fade-in duration-150">
                      <input
                        type="text"
                        autoFocus
                        placeholder="e.g. Winter Dome 2026, Summer Travel"
                        value={customSeason}
                        onChange={(e) => {
                          setCustomSeason(e.target.value);
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
                    setStep(2);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextFromSeason}
                  className="px-5 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] font-semibold text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <span>Continue to Tournament</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: TOURNAMENT */}
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

          {/* STEP 5: TEAM & LINK UP OPTIONS */}
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
                  Name the team. Your chosen age group, season, and tournament will be permanently linked to this team.
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
                  Jersey numbers are linked to each specific team because players often wear different numbers for school, travel, or tournament teams.
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
                    ✓ All games scored for this team will automatically default to these options. You can easily switch or add more teams later in Settings.
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
                  <span>Complete Setup & Start Scoring</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <SetupBackupRestoreDialog
        file={pendingBackupFile}
        onCancel={() => setPendingBackupFile(null)}
        onConfirm={handleConfirmImport}
      />
    </div>
  );
};
