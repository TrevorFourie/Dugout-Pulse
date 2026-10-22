import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { SetupBackupRestoreDialog } from './SetupBackupRestoreDialog';
import { SetupProgressHeader } from './SetupProgressHeader';
import { SetupPlayerStep } from './setup/SetupPlayerStep';
import { SetupAgeGroupStep } from './setup/SetupAgeGroupStep';
import { SetupSeasonStep } from './setup/SetupSeasonStep';
import { SetupTournamentStep } from './setup/SetupTournamentStep';
import { SetupTeamStep } from './setup/SetupTeamStep';
import { currentYear } from './setupScreenConstants';
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
          <SetupSeasonStep
            step={step}
            season={season}
            setSeason={setSeason}
            customSeason={customSeason}
            setCustomSeason={setCustomSeason}
            isCustomSeason={isCustomSeason}
            setIsCustomSeason={setIsCustomSeason}
            error={error}
            setError={setError}
            setStep={setStep}
            handleNextFromSeason={handleNextFromSeason}
          />

          {/* STEP 4: TOURNAMENT */}
          <SetupTournamentStep
            step={step}
            tournament={tournament}
            setTournament={setTournament}
            customTournament={customTournament}
            setCustomTournament={setCustomTournament}
            isCustomTournament={isCustomTournament}
            setIsCustomTournament={setIsCustomTournament}
            noTournament={noTournament}
            setNoTournament={setNoTournament}
            error={error}
            setError={setError}
            setStep={setStep}
            handleNextFromTournament={handleNextFromTournament}
          />

          {/* STEP 5: TEAM & LINK UP OPTIONS */}
          <SetupTeamStep
            step={step}
            playerName={playerName}
            teamName={teamName}
            setTeamName={setTeamName}
            jerseyNumber={jerseyNumber}
            setJerseyNumber={setJerseyNumber}
            effectiveAgeGroup={effectiveAgeGroup}
            effectiveSeason={effectiveSeason}
            effectiveTournament={effectiveTournament}
            error={error}
            setError={setError}
            setStep={setStep}
            handleFinishSetup={handleFinishSetup}
          />
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
