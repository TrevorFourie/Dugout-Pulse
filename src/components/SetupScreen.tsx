import React, { useState, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { AppLogo } from './AppLogo';
import {
  User,
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
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';

interface SetupScreenProps {
  onComplete?: () => void;
}

type SetupStep = 1 | 2 | 3 | 4 | 5;

const PRESET_AGE_GROUPS = [
  'U8',
  'U10',
  'U12',
  'U14',
  'U15',
  'U17',
  'U19',
  'High School',
  'Adult',
  'Masters',
];

const currentYear = new Date().getFullYear();
const PRESET_SEASONS = [
  `Spring ${currentYear}`,
  `Summer ${currentYear}`,
  `Fall ${currentYear}`,
  `${currentYear} / ${currentYear + 1}`,
  `${currentYear}`,
];

const PRESET_TOURNAMENTS = [
  'League / Regular Season',
  'Club Play',
  'Triple Crown Classic',
  'NBC World Series',
  'LLWS (Little League)',
  'USSSA Tournament',
  'WBSC',
];

export const SetupScreen: React.FC<SetupScreenProps> = ({
  onComplete,
}) => {
  const { completeFirstTimeSetup, setIsFirstTimeUser, importJsonData } = useGame();

  const [step, setStep] = useState<SetupStep>(1);
  const [importMessage, setImportMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [pendingBackupFile, setPendingBackupFile] = useState<File | null>(null);
  const backupFileRef = useRef<HTMLInputElement>(null);

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

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingBackupFile(file);
    if (backupFileRef.current) backupFileRef.current.value = '';
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
          setImportMessage({ text: 'Backup restored successfully!', isError: false });
          setIsFirstTimeUser(false);
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
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-[#18212D] via-[#1E293B] to-[#18212D] dark:from-[#101419] dark:via-[#1A2028] dark:to-[#101419] text-white p-5 border-b border-slate-700/50 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] flex items-center justify-center shadow-md">
                <AppLogo variant="icon" className="w-6 h-6 object-contain" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#007A6A] block">
                  DUGOUT PULSE SETUP
                </span>
                <h1 className="text-lg font-semibold text-white tracking-tight">
                  Welcome to Fast Scorekeeping
                </h1>
              </div>
            </div>


          </div>

          {/* 5-Step Visual Progress Bar */}
          <div className="mt-4 pt-3 border-t border-slate-700/40">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1.5">
              <span>Step {step} of 5</span>
              <span className="text-white">
                {step === 1 && '1. Player Name'}
                {step === 2 && '2. Age Group'}
                {step === 3 && '3. Season'}
                {step === 4 && '4. Tournament'}
                {step === 5 && '5. Team & Link Options'}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 h-1.5 rounded-full overflow-hidden bg-slate-800">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-full rounded-full transition-all duration-300 ${
                    s <= step ? 'bg-[#00BFA5] dark:bg-[#00D7BC]' : 'bg-slate-700/60'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-[#FF5252]/15 border border-red-200 dark:border-[#86252D] text-xs font-semibold text-red-600 dark:text-[#F6DADD] flex items-center gap-2 animate-in fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5252]" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: PLAYER NAME */}
          {step === 1 && (
            <form onSubmit={handleNextFromPlayer} className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block mb-1">
                  Step 1 of 5
                </span>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-[#FAFAFA]">
                  Who are you scoring for?
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">
                  Enter your player’s name. All games, batting spray charts, and pitching rest will be recorded under this profile.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] mb-1.5 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]" />
                    Player Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Lucas Miller, Maya Chen"
                    value={playerName}
                    onChange={(e) => {
                      setPlayerName(e.target.value);
                      if (error) setError(null);
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-base font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-1.5">
                    Jersey numbers are linked to each team in Step 5, since players often wear different numbers on different teams.
                  </p>
                </div>
              </div>

              {/* Restore from backup option */}
              {importMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
                    importMessage.isError
                      ? 'bg-red-50 dark:bg-[#FF5252]/15 border border-red-200 dark:border-[#86252D] text-red-600 dark:text-[#F6DADD]'
                      : 'bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300'
                  }`}
                >
                  {importMessage.isError ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>{importMessage.text}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-[#354050]">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#252D38]/60 border border-dashed border-slate-300 dark:border-[#354050] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-[#FAFAFA]">
                      <Upload className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]" />
                      <span>Have a backup file?</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                      Restore your data from a previous export and skip setup entirely.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => backupFileRef.current?.click()}
                    className="shrink-0 px-3 py-2 rounded-xl border border-[#00BFA5]/40 dark:border-[#00D7BC]/50 text-[#007A6A] dark:text-[#00D7BC] text-xs font-semibold hover:bg-[#00BFA5]/10 dark:hover:bg-[#00D7BC]/15 transition-colors"
                  >
                    Upload Backup
                  </button>
                  <input
                    ref={backupFileRef}
                    type="file"
                    accept=".json"
                    onChange={handleRestoreBackup}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end border-t border-slate-200 dark:border-[#354050]">
                <button
                  type="submit"
                  disabled={!playerName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] disabled:opacity-50 text-[#18212D] dark:text-[#101419] font-semibold text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <span>Continue to Age Group</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: AGE GROUP */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block mb-1">
                  Step 2 of 5
                </span>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-[#FAFAFA]">
                  What age group does {playerName || 'your player'} play in?
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">
                  Select their division. This helps tailor pitch count rest guidelines and game stats.
                </p>
              </div>

              {/* Age Group Grid */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {PRESET_AGE_GROUPS.map((group) => {
                    const isSelected = !isCustomAge && ageGroup === group;
                    return (
                      <button
                        key={group}
                        type="button"
                        onClick={() => {
                          setAgeGroup(group);
                          setIsCustomAge(false);
                          if (error) setError(null);
                        }}
                        className={`min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-transparent shadow-xs'
                            : 'bg-slate-50 dark:bg-[#252D38] text-slate-800 dark:text-[#D1D5DB] border-slate-200 dark:border-[#354050] hover:bg-slate-100 dark:hover:bg-[#2D3643]'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        <span>{group}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Age Option */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCustomAge(!isCustomAge)}
                    className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC] hover:underline flex items-center gap-1"
                  >
                    <span>{isCustomAge ? 'Use preset age group' : '+ Or enter custom age group (e.g. 13U Major)'}</span>
                  </button>

                  {isCustomAge && (
                    <div className="mt-2 animate-in fade-in duration-150">
                      <input
                        type="text"
                        autoFocus
                        placeholder="e.g. 11U Travel, JV, 13U AAA"
                        value={customAgeGroup}
                        onChange={(e) => {
                          setCustomAgeGroup(e.target.value);
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
                    setStep(1);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextFromAge}
                  className="px-5 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] font-semibold text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <span>Continue to Season</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

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

      {/* Backup Upload Confirmation Dialog */}
      {pendingBackupFile && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#1A2028] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#354050] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">
                  Restore from backup?
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-[#9CA3AF] leading-relaxed">
                You're about to restore data from <strong className="text-slate-800 dark:text-[#D1D5DB]">{pendingBackupFile.name}</strong> ({(pendingBackupFile.size / 1024).toFixed(1)} KB). This will replace your current data and skip the rest of setup.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingBackupFile(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors flex items-center justify-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
