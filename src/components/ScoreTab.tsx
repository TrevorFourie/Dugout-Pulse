import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import {
  DefensivePosition,
  FieldingPlayCode,
  HalfInningStatus,
  HitLocation,
  PitcherHand,
  Play,
  PlayCode,
  PlayMode,
  PositionChange,
  RunnerOutReason,
  RUNNER_OUT_REASONS,
  LINEUP_SPOTS,
} from '../types/baseball';
import { getFieldingPlaysForPosition, getPlaysForMode, PLAY_DEFINITIONS } from '../utils/playDefinitions';
import { calculateGameStats, calculatePitchingStats, formatRate } from '../utils/stats';
import { usePlayFlow } from '../hooks/usePlayFlow';
import { usePlayDragReorder } from '../hooks/usePlayDragReorder';
import { ConfirmationModal } from './ConfirmationModal';
import { EditPlayModal } from './EditPlayModal';
import { PitcherOutModal, PitcherOutSelection } from './PitcherOutModal';
import { HitLocationModal } from './HitLocationModal';
import { SprayChart } from './SprayChart';
import { isBattedBallPlay, isHitPlay, getTrajectoryLabel, getZoneLabel, resolveZone } from '../utils/sprayChart';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Save,
  Trash2,
  Edit2,
  Calendar,
  Clock,
  Shield,
  Play as PlayIcon,
  XCircle,
  Activity,
  ListOrdered,
  Trophy,
  Users,
  Plus,
  Check,
  CheckCircle2,
  Crosshair,
  MapPin,
  X,
  Filter,
  Zap,
  Home,
  Plane,
  Footprints,
  CircleDot,
  AlertTriangle,
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { ThemedDropdown } from './ThemedDropdown';
import { OpponentCombobox } from './OpponentCombobox';
import { ValueCombobox } from './ValueCombobox';
import { RunnerLockdownModal } from './RunnerLockdownModal';
import { ScoringValidationModal } from './ScoringValidationModal';
import { playOutCount, type ScoringResolution } from '../utils/scoringEngine';
import { PitchingBoard } from './PitchingBoard';
import { derivePitchingFlowState, reducePitchingAction, PitchingAction } from '../utils/pitchingFlow';
import {
  createRunnerLifecycle,
  getRunnerBaseForPrimary,
  RunnerAdvanceCause,
  RunnerLifecycleState,
  transitionRunner,
} from '../utils/runnerLifecycle';

const DEFENSIVE_POSITIONS: { code: DefensivePosition; label: string }[] = [
  { code: 'P', label: 'Pitcher (P)' },
  { code: 'C', label: 'Catcher (C)' },
  { code: '1B', label: '1st Base (1B)' },
  { code: '2B', label: '2nd Base (2B)' },
  { code: '3B', label: '3rd Base (3B)' },
  { code: 'SS', label: 'Shortstop (SS)' },
  { code: 'LF', label: 'Left Field (LF)' },
  { code: 'CF', label: 'Center Field (CF)' },
  { code: 'RF', label: 'Right Field (RF)' },
  { code: 'DH', label: 'Designated Hitter (DH)' },
  { code: 'BENCH', label: 'Bench / Rest' },
];

const PITCHING_TERMINAL_CODES = new Set<PlayCode>([
  'strikeout',
  'walkAllowed',
  'intentionalWalkAllowed',
  'hitBatter',
  'hitAllowed',
  'homeRunAllowed',
  'pitchOut',
]);

interface ScoreTabProps {
  onOpenHelp?: (mode: PlayMode) => void;
  onOpenSettings?: () => void;
  onGameClosed?: () => void;
  onCancelResume?: () => void;
  view?: 'score' | 'plays';
  onChangeView?: (view: 'score' | 'plays') => void;
}

// Wrapper: remount the inner component whenever a live game starts/ends. The inner component
// returns early when there is no live game and declares more hooks afterwards, so without a
// remount, React sees a changed hook count on game start and the screen goes blank.
// Plain-English names so the Plays list never shows position or stat abbreviations.
const POSITION_NAMES: Record<string, string> = {
  P: 'Pitcher',
  C: 'Catcher',
  '1B': 'First base',
  '2B': 'Second base',
  '3B': 'Third base',
  SS: 'Shortstop',
  LF: 'Left field',
  CF: 'Center field',
  RF: 'Right field',
  DH: 'Designated hitter',
  BENCH: 'Bench',
  HOME: 'Home plate',
};
const positionName = (code?: string): string => (code ? POSITION_NAMES[code] || code : '');

const RESUME_UI_STORAGE_KEY = 'dugout_pulse_resume_ui_v1';
const RUNNER_WORKFLOW_STORAGE_KEY = 'dugout_pulse_runner_workflow_v1';
type PersistedScoreUi = Record<string, { viewedInning?: number; activeMode?: PlayMode; pitcherHand?: PitcherHand }>;
type PersistedRunnerWorkflow = {
  runnerSessions: Record<string, RunnerLifecycleState | null>;
  runnerHistories: Record<string, { state: RunnerLifecycleState; playIds: string[] }[]>;
  activeRunnerChips: Record<string, { inning: number; base: 1 | 2 | 3; sb: number; cause: RunnerAdvanceCause; subNumber?: string }>;
};
const readLocalJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback as object, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
};
const ordinal = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'}`;
};

export const ScoreTab: React.FC<ScoreTabProps> = (props) => {
  const { liveGame } = useGame();
  return <ScoreTabInner key={liveGame ? `game-${liveGame.id}` : 'no-game'} {...props} />;
};

type MultiOutPlayAction = 'catch' | 'tag' | 'step' | 'throw';

const DOUBLE_PLAY_ACTIONS: { action: MultiOutPlayAction; title: string; description: string }[] = [
  { action: 'catch', title: 'Caught the ball', description: 'Caught a fly ball or line drive for an out (Putout)' },
  { action: 'step', title: 'Stepped on a base / tagged a runner', description: 'Recorded an out by force, tag, or doubling off a runner (Putout)' },
  { action: 'throw', title: 'Threw to a base', description: 'Made a throw that helped complete the play (Assist)' },
];

// Keep actions general rather than naming bases or runner destinations, so this covers
// different triple-play sequences without assuming a specific starting situation.
const TRIPLE_PLAY_ACTIONS: { action: MultiOutPlayAction; title: string; description: string }[] = [
  { action: 'catch', title: 'Caught the ball', description: 'Caught a fly ball or line drive for an out (Putout)' },
  { action: 'tag', title: 'Tagged a runner', description: 'Recorded an out by tagging a runner (Putout)' },
  { action: 'step', title: 'Stepped on a base', description: 'Recorded an out by touching a base, including a force or appeal play (Putout)' },
  { action: 'throw', title: 'Threw the ball', description: 'Made a throw that helped complete the play (Assist)' },
];

const ScoreTabInner: React.FC<ScoreTabProps> = ({ onOpenHelp, onOpenSettings, onGameClosed, onCancelResume, view = 'score', onChangeView }) => {
  const {
    games,
    liveGame,
    editingGameId,
    activeProfile,
    allOpponents,
    recentOpponents,
    deleteOpponent,
    allTournaments,
    saveTournament,
    deleteTournament,
    allAgeGroups,
    saveAgeGroup,
    deleteAgeGroup,
    allSeasons,
    saveSeason,
    deleteSeason,
    allTeams,
    addPlayerTeam,
    startLiveGame,
    addPlay,
    addPlays,
    undoLastPlay,
    deletePlay,
    editPlay,
    updatePlayHitLocation,
    updatePlayOutcome,
    setPlayRbis,
    movePlay,
    movePlayTo,
    insertPlayAfter,
    nextInning,
    prevInning,
    setInning,
    setInningPosition,
    setInningLineupSpot,
    setLineupSpot,
    toggleBenchCurrentInning,
    removeEmptyLastInning,
    changeInningPosition,
    removePositionChange,
    setInningBench,
    saveGame,
    discardLiveGame,
    cancelEditing,
    updateLiveGameDetails,
    settings,
    resumePromptPending,
    dismissResumePrompt,
  } = useGame();

  // Normalize list of teams for the active player profile
  const playerTeams = React.useMemo(() => {
    if (activeProfile.teams && activeProfile.teams.length > 0) {
      return activeProfile.teams;
    }
    if (activeProfile.teamName) {
      return [
        {
          id: 'primary-team',
          name: activeProfile.teamName,
          ageGroup: activeProfile.defaultAgeGroup || 'U12',
          season: activeProfile.defaultSeason || 'Spring 2026',
          tournament: activeProfile.defaultTournament || '',
          isDefault: true,
        },
      ];
    }
    return [];
  }, [activeProfile]);

  // New game form state
  const [newGameDate, setNewGameDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newGameTime, setNewGameTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [newGameOpponent, setNewGameOpponent] = useState('');
  const [newGameFormError, setNewGameFormError] = useState('');
  const [newGameIsHome, setNewGameIsHome] = useState<boolean>(true);
  const initialTeam = playerTeams.find((t) => t.isDefault) || playerTeams[0];
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => initialTeam?.id || '');
  const [newGameTeam, setNewGameTeam] = useState(() => initialTeam?.name || activeProfile.teamName || 'My Team');
  const [newGameTournament, setNewGameTournament] = useState(() => initialTeam?.tournament || '');
  const [newGameAgeGroup, setNewGameAgeGroup] = useState(() => initialTeam?.ageGroup || '');
  const [newGameSeason, setNewGameSeason] = useState(() => initialTeam?.season || '');
  const [tournamentEditing, setTournamentEditing] = useState(false);

  const selectedTeam = playerTeams.find((t) => t.id === selectedTeamId) || initialTeam;
  const ageLocked = Boolean(selectedTeam?.ageGroup);
  const seasonLocked = Boolean(selectedTeam?.season);
  const tournamentLocked = Boolean(selectedTeam?.tournament);

  // Inline Quick-Add Team state
  const [showAddTeamInline, setShowAddTeamInline] = useState(false);
  const [inlineTeamName, setInlineTeamName] = useState('');
  const [inlineJerseyNumber, setInlineJerseyNumber] = useState('');
  const [inlineAgeGroup, setInlineAgeGroup] = useState('U12');
  const [inlineSeason, setInlineSeason] = useState('Spring 2026');
  const [inlineTournament, setInlineTournament] = useState('');

  // Active scoring mode
  const [activeMode, setActiveMode] = useState<PlayMode>(() => {
    const savedMode = liveGame ? readLocalJson<PersistedScoreUi>(RESUME_UI_STORAGE_KEY, {})[liveGame.id]?.activeMode : undefined;
    if (savedMode) return savedMode;
    if (!liveGame) return 'batting';
    const isHome = liveGame.isHome !== false;
    const curInn = liveGame.innings || 1;
    const hasBat = liveGame.plays.some((p) => p.inning === curInn && p.mode === 'batting') || Boolean(liveGame.halfInningStatus?.[curInn]?.battingCompleted);
    const hasDef = liveGame.plays.some((p) => p.inning === curInn && (p.mode === 'fielding' || p.mode === 'pitching')) || Boolean(liveGame.halfInningStatus?.[curInn]?.fieldingCompleted);
    const innPos = liveGame.fieldingPositions?.[curInn] || (liveGame.benchInnings.includes(curInn) ? 'BENCH' : 'CF');

    if (isHome) {
      if (!hasDef && !hasBat) return innPos === 'P' ? 'pitching' : 'fielding';
      if (hasDef && !hasBat) return 'batting';
      return innPos === 'P' ? 'pitching' : 'fielding';
    } else {
      if (!hasBat && !hasDef) return 'batting';
      if (hasBat && !hasDef) return innPos === 'P' ? 'pitching' : 'fielding';
      return 'batting';
    }
  });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // The inning being viewed is separate from the authoritative live inning.
  const [viewedInning, setViewedInning] = useState(() => {
    const savedInning = liveGame ? readLocalJson<PersistedScoreUi>(RESUME_UI_STORAGE_KEY, {})[liveGame.id]?.viewedInning : undefined;
    return savedInning && savedInning > 0 ? savedInning : liveGame?.innings ?? 1;
  });
  const previousLiveInningRef = useRef(liveGame?.innings);
  useEffect(() => {
    if (liveGame && previousLiveInningRef.current !== liveGame.innings) {
      setViewedInning(liveGame.innings);
    }
    previousLiveInningRef.current = liveGame?.innings;
  }, [liveGame?.id, liveGame?.innings]);

  // Inning / half-inning change notice banner
  const [inningNotice, setInningNotice] = useState<{
    id: number;
    title: string;
    subtitle: string;
  } | null>(null);

  // Pitcher Handedness Split toggle ('R' or 'L')
  const [pitcherHand, setPitcherHand] = useState<PitcherHand>(() => {
    const savedHand = liveGame ? readLocalJson<PersistedScoreUi>(RESUME_UI_STORAGE_KEY, {})[liveGame.id]?.pitcherHand : undefined;
    return savedHand === 'L' || savedHand === 'R' ? savedHand : 'R';
  });
  useEffect(() => {
    if (!liveGame) return;
    try {
      const stored = readLocalJson<PersistedScoreUi>(RESUME_UI_STORAGE_KEY, {});
      localStorage.setItem(RESUME_UI_STORAGE_KEY, JSON.stringify({
        ...stored,
        [liveGame.id]: { ...stored[liveGame.id], viewedInning, activeMode, pitcherHand },
      }));
    } catch (error) {
      console.error('Failed to persist scoring screen state:', error);
    }
  }, [liveGame?.id, viewedInning, activeMode, pitcherHand]);

  // Modal states
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [isAbandonResumeModalOpen, setIsAbandonResumeModalOpen] = useState(false);
  const [isPitcherOutModalOpen, setIsPitcherOutModalOpen] = useState(false);
  const [isNextBatterModalOpen, setIsNextBatterModalOpen] = useState(false);
  const promptedTerminalPlayIdsRef = useRef<Set<string>>(new Set());
  const [teamFinalScore, setTeamFinalScore] = useState('');
  const [opponentFinalScore, setOpponentFinalScore] = useState('');
  const [selectedPlayForEdit, setSelectedPlayForEdit] = useState<Play | null>(null);
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [playFeedFilter, setPlayFeedFilter] = useState<'all' | 'batting' | 'pitching' | 'fielding'>('batting');
  const [isPlaysModalOpen, setIsPlaysModalOpen] = useState(false);

  // Hit Direction Tapper and Spray Chart states
  const [hitTapperEnabled, setHitTapperEnabled] = useState<boolean>(() => settings.trackHitLocation ?? true);
  const [pendingHitPlay, setPendingHitPlay] = useState<{ playId: string; code: PlayCode } | null>(null);
  const [isGameSprayModalOpen, setIsGameSprayModalOpen] = useState(false);
  const [isDirectTapperOpen, setIsDirectTapperOpen] = useState(false);
  const [isOutLocationFirstOpen, setIsOutLocationFirstOpen] = useState(false);
  const [isFoulTapperOpen, setIsFoulTapperOpen] = useState(false);
  const pendingHitLocationRef = useRef<HitLocation | null>(null);
  const skipOutLocationPromptRef = useRef(false);
  // Smart-scoring metadata (extra outs, validated context) waiting to be attached to the next primary batting play.
  const pendingScoringMetaRef = useRef<{
    code: PlayCode;
    extraOuts: number;
    scoringContext: Play['scoringContext'];
  } | null>(null);
  // When the hit-location prompt is active, the runner lockdown must wait until the
  // location is saved/skipped. Otherwise the z-[100] runner modal covers the hit-location modal.
  const pendingRunnerAfterHitRef = useRef<PlayCode | null>(null);
  // Smart-scoring outs must finish their batter/inning transition only after Hit Location is saved or skipped.
  const pendingOutCompletionRef = useRef<'thirdOut' | 'nextBatter' | null>(null);
  // The primary batting play that opened the runner lockdown. This is the play the
  // user must be able to undo while the lockdown modal is covering the scoring board.
  const pendingRunnerPrimaryPlayIdRef = useRef<string | null>(null);

  // Bench confirmation modal state
  const [benchConfirmInning, setBenchConfirmInning] = useState<number | null>(null);
  // Position change awaiting the scorer's confirmation (mid-inning switch vs. correcting a mistake)
  const [pendingPositionChange, setPendingPositionChange] = useState<{ inning: number; from: DefensivePosition; to: DefensivePosition } | null>(null);
  type RunnerHistoryEntry = { state: RunnerLifecycleState; playIds: string[] };
  type ActiveRunnerChip = { inning: number; base: 1 | 2 | 3; sb: number; cause: RunnerAdvanceCause; subNumber?: string };
  const [runnerSessions, setRunnerSessions] = useState<Record<string, RunnerLifecycleState | null>>(() => readLocalJson<PersistedRunnerWorkflow>(RUNNER_WORKFLOW_STORAGE_KEY, { runnerSessions: {}, runnerHistories: {}, activeRunnerChips: {} }).runnerSessions);
  const [runnerHistories, setRunnerHistories] = useState<Record<string, RunnerHistoryEntry[]>>(() => readLocalJson<PersistedRunnerWorkflow>(RUNNER_WORKFLOW_STORAGE_KEY, { runnerSessions: {}, runnerHistories: {}, activeRunnerChips: {} }).runnerHistories);
  const [activeRunnerChips, setActiveRunnerChips] = useState<Record<string, ActiveRunnerChip>>(() => readLocalJson<PersistedRunnerWorkflow>(RUNNER_WORKFLOW_STORAGE_KEY, { runnerSessions: {}, runnerHistories: {}, activeRunnerChips: {} }).activeRunnerChips);
  useEffect(() => {
    try {
      localStorage.setItem(RUNNER_WORKFLOW_STORAGE_KEY, JSON.stringify({ runnerSessions, runnerHistories, activeRunnerChips }));
    } catch (error) {
      console.error('Failed to persist runner workflow state:', error);
    }
  }, [runnerSessions, runnerHistories, activeRunnerChips]);

  // All transient runner workflow state is scoped to the inning being viewed. Ending or
  // correcting one inning must not clear the runner workflow for another inning.
  const setRunnerSession = (next: RunnerLifecycleState | null | ((current: RunnerLifecycleState | null) => RunnerLifecycleState | null)) => {
    setRunnerSessions((previous) => {
      const current = previous[`${liveGame?.id ?? '__no-game__'}:${viewedInning}`] ?? null;
      const resolved = typeof next === 'function' ? next(current) : next;
      if (resolved === current) return previous;
      return { ...previous, [`${liveGame?.id ?? '__no-game__'}:${viewedInning}`]: resolved };
    });
  };
  const setRunnerHistory = (next: RunnerHistoryEntry[] | ((current: RunnerHistoryEntry[]) => RunnerHistoryEntry[])) => {
    setRunnerHistories((previous) => {
      const current = previous[`${liveGame?.id ?? '__no-game__'}:${viewedInning}`] ?? [];
      const resolved = typeof next === 'function' ? next(current) : next;
      if (resolved === current) return previous;
      return { ...previous, [`${liveGame?.id ?? '__no-game__'}:${viewedInning}`]: resolved };
    });
  };
  const setActiveRunnerChip = (next: ActiveRunnerChip | null | ((current: ActiveRunnerChip | null) => ActiveRunnerChip | null)) => {
    setActiveRunnerChips((previous) => {
      const current = previous[`${liveGame?.id ?? '__no-game__'}:${viewedInning}`] ?? null;
      const resolved = typeof next === 'function' ? next(current) : next;
      if (resolved === current) return previous;
      if (resolved === null) {
        const key = `${liveGame?.id ?? '__no-game__'}:${viewedInning}`;
        if (!(key in previous)) return previous;
        const updated = { ...previous };
        delete updated[key];
        return updated;
      }
      return { ...previous, [`${liveGame?.id ?? '__no-game__'}:${viewedInning}`]: { ...resolved, inning: viewedInning } };
    });
  };
  const [outResolutionOpen, setOutResolutionOpen] = useState(false);
  // Batter-side pitch count is deliberately separate from pitching statistics.
  const [batterBalls, setBatterBalls] = useState(0);
  const [batterStrikes, setBatterStrikes] = useState(0);
  const [isBatterStrikeoutModalOpen, setIsBatterStrikeoutModalOpen] = useState(false);
  const [lineupSpotPromptOpen, setLineupSpotPromptOpen] = useState(false);
  const [roeModalOpen, setRoeModalOpen] = useState(false);
  const [roeDecisionModalOpen, setRoeDecisionModalOpen] = useState(false);
  const [roeDecisionMode, setRoeDecisionMode] = useState<'roe' | 'extraBases'>('roe');
  const [pendingRoeDecision, setPendingRoeDecision] = useState<{
    playId: string;
    originalCode: PlayCode;
    runnerCode: PlayCode | null;
    rbiEarned: number;
  } | null>(null);

  // Double Play follow-up: asks what the scored player did on the play. `endsHalfInning` is true when the
  // play made the third out, in which case the half-inning ends once the modal is confirmed or skipped.
  const [fieldingChain, setFieldingChain] = useState<{ endsHalfInning: boolean; playType: 'doublePlay' | 'triplePlay' } | null>(null);
  const [dpActions, setDpActions] = useState<MultiOutPlayAction[]>([]);

  const playFlow = usePlayFlow({
    onEvent: (mode, code, eventOptions) => {
      if (mode === 'batting') {
        const preselectedLoc = pendingHitLocationRef.current || undefined;
        pendingHitLocationRef.current = null;
        const scoringMeta = pendingScoringMetaRef.current?.code === code ? pendingScoringMetaRef.current : null;
        if (scoringMeta) pendingScoringMetaRef.current = null;
        const errorType = undefined;
        const createdPlay = addPlay('batting', code, {
          pitcherHand,
          lineupSpot: liveGame?.lineupSpot,
          hitLocation: preselectedLoc,
          targetInning: viewedInning,
          extraOuts: scoringMeta?.extraOuts,
          scoringContext: scoringMeta?.scoringContext,
          errorType,
        });
        if (createdPlay && getRunnerBaseForPrimary(code)) {
          pendingRunnerPrimaryPlayIdRef.current = createdPlay.id;
        }
        const locationTrackableOutCodes: PlayCode[] = ['out', 'sacFly', 'sacBunt', 'groundedIntoDoublePlay'];
        if (!preselectedLoc && hitTapperEnabled && (isHitPlay(code) || locationTrackableOutCodes.includes(code)) && createdPlay) {
          // Only base hits need RBI handling in the location modal; outs are mapped for contact location only.
          pendingRunnerAfterHitRef.current = getRunnerBaseForPrimary(code) ? code : null;
          setPendingHitPlay({ playId: createdPlay.id, code });
        }
      } else if (mode === 'fielding') {
        const inningPosition = liveGame
          ? liveGame.fieldingPositions?.[viewedInning] ||
            (liveGame.benchInnings.includes(viewedInning) ? 'BENCH' : 'CF')
          : undefined;
        addPlay('fielding', code, { defensivePosition: inningPosition, targetInning: viewedInning });
      } else {
        addPlay('pitching', code, {
          autoOutcome: eventOptions?.autoOutcome,
          isExtraOut: eventOptions?.isExtraOut,
          targetInning: viewedInning,
        });
      }
    },
    activePosition: liveGame
      ? liveGame.fieldingPositions?.[viewedInning] ||
        (liveGame.benchInnings.includes(viewedInning) ? 'BENCH' : 'CF')
      : undefined,
    flowKey: liveGame ? `${liveGame.id}:inning-${viewedInning}` : null,
    homeRunAddsRunAndRbi: !settings.homeRunAddsRunAndRbi,
  });

  // Hold a play and drag it to reorder. The feed lists the newest play first, so dropping a play
  // above another one places it later in the game.
  const { getDragProps } = usePlayDragReorder((dragId, targetId, placement) => {
    // Reordering is allowed only within the same inning.
    const draggedPlay = liveGame?.plays.find((play) => play.id === dragId);
    const targetPlay = liveGame?.plays.find((play) => play.id === targetId);
    if (!draggedPlay || !targetPlay || draggedPlay.inning !== targetPlay.inning) return;
    movePlayTo(dragId, targetId, placement === 'above' ? 'after' : 'before');
  });

  // Plays feed & grouped inning derivations (unconditionally declared before early returns to satisfy React Hook rules)
  const liveGamePlays = liveGame?.plays;

  const filteredPlays = React.useMemo(() => {
    if (!liveGamePlays) return [];
    const list = [...liveGamePlays].reverse();
    if (playFeedFilter === 'all') return list;
    return list.filter((p) => p.mode === playFeedFilter);
  }, [liveGamePlays, playFeedFilter]);

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    const found = playerTeams.find((t) => t.id === teamId);
    if (found) {
      setNewGameTeam(found.name);
      setNewGameAgeGroup(found.ageGroup || '');
      setNewGameSeason(found.season || '');
      setNewGameTournament(found.tournament || '');
      setTournamentEditing(false);
    }
  };

  const handleSaveInlineTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineTeamName.trim()) return;

    const created = addPlayerTeam(activeProfile.id, {
      name: inlineTeamName.trim(),
      jerseyNumber: inlineJerseyNumber.trim() || undefined,
      ageGroup: inlineAgeGroup.trim(),
      season: inlineSeason.trim(),
      tournament: inlineTournament.trim(),
      isDefault: playerTeams.length === 0,
    });

    setNewGameTeam(created.name);
    setNewGameAgeGroup(created.ageGroup || '');
    setNewGameSeason(created.season || '');
    setNewGameTournament(created.tournament || '');
    setTournamentEditing(false);
    setSelectedTeamId(created.id);
    setInlineTeamName('');
    setInlineJerseyNumber('');
    setInlineTournament('');
    setShowAddTeamInline(false);
  };

  // Helper function to process benched state & clear plays
  const applyBenchForInning = (inningToBench: number) => {
    if (!liveGame) return;

    // 1. Remove all plays captured in this inning
    const playsInInning = liveGame.plays.filter((p) => p.inning === inningToBench);
    playsInInning.forEach((play) => deletePlay(play.id));

    // 2. Bench/rest is independent from the defensive position.
    if (!liveGame.benchInnings.includes(inningToBench)) {
      setInningBench(inningToBench, true);
    }

    // 3. Stay on this inning. The scorer moves on with "Start Next Inning" when ready.
  };


  // If no live game is active, render Start New Game form
  if (!liveGame) {
    const handleStartGame = (e: React.FormEvent) => {
      e.preventDefault();
      setNewGameFormError('');

      const gameAgeGroup = (ageLocked ? selectedTeam?.ageGroup : newGameAgeGroup)?.trim() || '';
      const gameSeason = (seasonLocked ? selectedTeam?.season : newGameSeason)?.trim() || '';
      const gameTournament = (
        tournamentEditing && newGameTournament ? newGameTournament : (selectedTeam?.tournament || newGameTournament)
      ).trim();
      const gameTeamName = (selectedTeam?.name || newGameTeam || activeProfile.teamName).trim();
      const missingFields = [
        !newGameDate.trim() && 'game date',
        !newGameTime.trim() && 'game time',
        !newGameOpponent.trim() && 'opponent',
        !gameTeamName && 'team',
        !gameAgeGroup && 'age group',
        !gameSeason && 'season',
      ].filter(Boolean);

      if (missingFields.length > 0) {
        setNewGameFormError(
          `Please complete these required fields:\n${missingFields.map((field) => `• ${field}`).join('\n')}`
        );
        return;
      }

      if (!selectedTeam?.tournament || tournamentEditing) {
        if (gameTournament) saveTournament(gameTournament);
      }
      if (!ageLocked && gameAgeGroup) saveAgeGroup(gameAgeGroup);
      if (!seasonLocked && gameSeason) saveSeason(gameSeason);

      startLiveGame({
        date: newGameDate,
        time: newGameTime,
        opponent: newGameOpponent.trim(),
        teamName: gameTeamName,
        tournament: gameTournament || undefined,
        ageGroup: gameAgeGroup || undefined,
        season: gameSeason || undefined,
        isHome: newGameIsHome,
      });
    };

    return (
      <>
      <div className="flex-1 overflow-y-auto pb-24 px-4 sm:px-6 pt-4 max-w-xl mx-auto w-full animate-in fade-in duration-200">

        <div className="bg-white dark:bg-[#252D38] rounded-md p-6 border border-slate-200/80 dark:border-[#354050] shadow-md">
          <div className="mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#007A6A] dark:text-[#00D7BC]">
              LIVE SCOREKEEPING
            </span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-[#FAFAFA]">
            Start a New Game
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1 mb-5">
            Scoring for <strong className="text-slate-700 dark:text-[#D1D5DB]">{activeProfile.playerName || 'your player'}</strong>.
          </p>

          <form onSubmit={handleStartGame} noValidate className="space-y-4">
            <div className="p-3.5 rounded-md bg-slate-50 dark:bg-[#1A2028] border border-slate-200 dark:border-[#354050] space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#18212D] dark:text-[#D1D5DB]" />
                      Playing for Team *
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddTeamInline(!showAddTeamInline)}
                  className="text-xs font-semibold text-[#007A6A] hover:text-[#007A6A] dark:text-[#00D7BC] dark:hover:text-[#CCF7F1] flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showAddTeamInline ? 'Cancel' : 'Add Another Team'}
                </button>
              </div>

              {showAddTeamInline && (
                <div className="p-3 bg-white dark:bg-[#252D38] rounded-md border border-teal-200 dark:border-[#00D7BC]/40 shadow-xs space-y-2.5 animate-in fade-in duration-150">
                  <div className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC] flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Add Another Team for {activeProfile.playerName || 'Player'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] mb-1">
                        Team Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Thunderbolts Travel, East High Varsity"
                        value={inlineTeamName}
                        onChange={(e) => setInlineTeamName(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] mb-1">
                        Jersey #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 24"
                        value={inlineJerseyNumber}
                        onChange={(e) => setInlineJerseyNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] mb-1">
                        Age Group (Select or type)
                      </label>
                      <ValueCombobox value={inlineAgeGroup} onChange={setInlineAgeGroup} options={allAgeGroups} placeholder="e.g. U12, U14" ariaLabel="e.g. U12, U14" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] mb-1">
                        Season (Select or type)
                      </label>
                      <ValueCombobox value={inlineSeason} onChange={setInlineSeason} options={allSeasons} placeholder="e.g. Spring 2026" ariaLabel="e.g. Spring 2026" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] mb-1">
                      Default Tournament (Select or type, optional)
                    </label>
                    <ValueCombobox value={inlineTournament} onChange={setInlineTournament} options={allTournaments} placeholder="e.g. Triple Crown Classic" ariaLabel="e.g. Triple Crown Classic" />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddTeamInline(false)}
                      className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-[#465160] text-xs font-semibold text-slate-600 dark:text-[#D1D5DB] hover:dark:bg-[#2D3643]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveInlineTeam}
                      disabled={!inlineTeamName.trim()}
                      className="px-3.5 py-1.5 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] dark:border-t dark:border-[#00D7BC] dark:border-b-2 dark:border-[#00D7BC]/40 disabled:opacity-50 text-[#18212D] dark:text-[#101419] text-xs font-semibold flex items-center gap-1 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Add Team
                    </button>
                  </div>
                </div>
              )}

              {playerTeams.length > 0 ? (
                <div className="space-y-1.5">
                  <ThemedDropdown
                    value={selectedTeamId}
                    onChange={(id) => {
                      if (id) handleSelectTeam(String(id));
                    }}
                    placeholder="Select a team"
                    ariaLabel="Playing for team"
                    allowClear={false}
                    className="w-full"
                    buttonClassName="py-2.5 text-sm font-medium"
                    options={playerTeams.map((team) => ({
                      value: team.id,
                      label: `${team.name}${team.jerseyNumber ? ` (#${team.jerseyNumber})` : ''}${team.ageGroup ? ` (${team.ageGroup})` : ''}${team.season ? ` · ${team.season}` : ''}`,
                    }))}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Enter team name"
                  required
                  value={newGameTeam}
                  onChange={(e) => setNewGameTeam(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-white dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]"
                />
              )}

              {selectedTeam && (selectedTeam.jerseyNumber || ageLocked || seasonLocked || tournamentLocked) && (
                <div className="pt-1 space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTeam.jerseyNumber && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#121923] dark:bg-[#00D7BC]/50 text-white border border-slate-300 dark:border-[#354050]">
                        <Shield className="w-3 h-3" />
                        #{selectedTeam.jerseyNumber}
                      </span>
                    )}
                    {ageLocked && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#121923] dark:bg-[#00D7BC]/50 text-white border border-slate-300 dark:border-[#354050]">
                        <Users className="w-3 h-3" />
                        {selectedTeam.ageGroup}
                      </span>
                    )}
                    {seasonLocked && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#121923] dark:bg-[#00D7BC]/50 text-white border border-slate-300 dark:border-[#354050]">
                        <Calendar className="w-3 h-3" />
                        {selectedTeam.season}
                      </span>
                    )}
                    {tournamentLocked && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#121923] dark:bg-[#00D7BC]/50 text-white border border-slate-300 dark:border-[#354050] max-w-full">
                        <Trophy className="w-3 h-3 shrink-0" />
                        <span className="truncate">{newGameTournament || selectedTeam.tournament}</span>
                      </span>
                    )}
                  </div>
                  {tournamentEditing && (
                    <div className="pt-2 flex items-center gap-2 animate-in fade-in duration-150">
                      <ValueCombobox value={newGameTournament} onChange={setNewGameTournament} options={allTournaments} placeholder="Type or select tournament for today" ariaLabel="Type or select tournament for today" className="flex-1" />
                      <button
                        type="button"
                        onClick={() => setTournamentEditing(false)}
                        className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-[#252D38] text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] border border-slate-300 dark:border-[#354050]"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Game Date
                </label>
                <input
                  type="date"
                  required
                  value={newGameDate}
                  onChange={(e) => setNewGameDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-md bg-slate-50 dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#18212D] dark:focus:ring-[#00D7BC] dark:[&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Game Time
                </label>
                <input
                type="time"
                required
                value={newGameTime}
                onChange={(e) => setNewGameTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-md bg-slate-50 dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#18212D] dark:focus:ring-[#00D7BC] 
                dark:[&::-webkit-calendar-picker-indicator]:invert"
              />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  Opponent *
                </span>
              </label>
              <OpponentCombobox
                value={newGameOpponent}
                onChange={setNewGameOpponent}
                required
                allOpponents={allOpponents}
                onDeleteOpponent={deleteOpponent}
                placeholder="Type team name or select remembered opponent"
              />
            </div>

            {/* Team Designation: Home Team vs Away Team */}
            <div className="p-3.5 rounded-md bg-slate-50 dark:bg-[#252D38]/50 border border-slate-200 dark:border-[#354050] space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#007A6A] dark:text-[#00D7BC]" />
                  Team Role
                </label>
                <span className="text-[12px] font-semibold text-slate-500 dark:text-[#FFFFFF]">
                  Away Teams Bat First
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-1 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200 dark:border-[#354050] shadow-2xs">
                <button
                  type="button"
                  onClick={() => setNewGameIsHome(true)}
                  className={`py-2 px-3 rounded-md text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    newGameIsHome
                      ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                      : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Home className="w-4 h-4" />
                    <span>Home</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewGameIsHome(false)}
                  className={`py-2 px-3 rounded-md text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    !newGameIsHome
                      ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                      : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Plane className="w-4 h-4" />
                    <span>Away</span>
                  </span>
                </button>
              </div>
            </div>

            {(!ageLocked || !seasonLocked) && (
              <div
                className={`grid grid-cols-1 gap-3 ${!ageLocked && !seasonLocked ? 'sm:grid-cols-2' : ''}`}
              >
                {!ageLocked && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-300" />
                        Age Group *
                      </label>
                      <span className="text-xs text-slate-400 font-semibold">
                        {allAgeGroups.length} in list
                      </span>
                    </div>
                    <ValueCombobox
                      value={newGameAgeGroup}
                      onChange={setNewGameAgeGroup}
                      required
                      options={allAgeGroups}
                      quickPills={allAgeGroups.slice(0, 6)}
                      onDeleteOption={deleteAgeGroup}
                      placeholder="Select age group (e.g. U12)"
                    />
                  </div>
                )}
                {!seasonLocked && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        Season *
                      </label>
                      <span className="text-xs text-slate-400 font-semibold">
                        {allSeasons.length} in list
                      </span>
                    </div>
                    <ValueCombobox
                      value={newGameSeason}
                      onChange={setNewGameSeason}
                      required
                      options={allSeasons}
                      quickPills={allSeasons.slice(0, 5)}
                      onDeleteOption={deleteSeason}
                      placeholder="Select season (e.g. Spring 2026)"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="pt-3">
              <button
                type="submit"
                className="w-full py-4 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] font-semibold text-sm shadow-lg shadow-teal-900/30 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <PlayIcon className="w-5 h-5 fill-current" />
                Start Scoring
              </button>
            </div>
          </form>
        </div>
      </div>
      <ConfirmationModal
        isOpen={Boolean(newGameFormError)}
        title="Complete Game Details"
        message={newGameFormError}
        confirmLabel="Got It"
        variant="warning"
        onConfirm={() => setNewGameFormError('')}
        onCancel={() => setNewGameFormError('')}
      />
      </>
    );
  }

  // Active Live Game View
  const isEditing = Boolean(editingGameId);
  const currentInning = viewedInning;
  const runnerStateKey = `${liveGame.id}:${currentInning}`;
  const runnerSession = runnerSessions[runnerStateKey] ?? null;
  const runnerHistory = runnerHistories[runnerStateKey] ?? [];
  const activeRunnerChip = activeRunnerChips[runnerStateKey] ?? null;
  const currentInningPosition: DefensivePosition =
    liveGame.fieldingPositions?.[currentInning] || (liveGame.benchInnings.includes(currentInning) ? 'BENCH' : 'CF');

  const selectedInningPosition: DefensivePosition | '' =
    liveGame.benchInnings.includes(currentInning)
      ? 'BENCH'
      : (liveGame.fieldingPositions?.[currentInning] || '');

  const isBenchedCurrentInning = liveGame.benchInnings.includes(currentInning);

  const currentInningLineupSpot = liveGame.inningLineupSpots?.[currentInning] ?? liveGame.lineupSpot;


  const stats = calculateGameStats(liveGame, settings.inningsPerGame);
  const { batting, pitching } = stats;
  const previousSameDayPitchingPlays = games
    .filter(
      (game) =>
        game.id !== liveGame.id &&
        game.date === liveGame.date &&
        (!game.playerId || game.playerId === activeProfile.id)
    )
    .flatMap((game) => game.plays.filter((play) => play.mode === 'pitching'));
  const dailyPitching = calculatePitchingStats(
    [...previousSameDayPitchingPlays, ...liveGame.plays],
    1,
    settings.inningsPerGame,
    liveGame.date
  );

  // Pitching flow: the count, pitch totals, batters faced, outs and earned-run context are all
  // derived from the plays, so Undo / delete / edit always leave the board consistent.
  const pitchFlowState = derivePitchingFlowState(liveGame.plays, viewedInning);
  const lastPitchingPlayThisInning = [...liveGame.plays]
    .reverse()
    .find((p) => p.mode === 'pitching' && p.inning === viewedInning);
  const inningEndedOnRunnerOut = pitchFlowState.outs >= 3 && Boolean(lastPitchingPlayThisInning?.pickoffKind);

  // Prompt once when a pitching event completes the current batter's plate appearance.
  // Do not interrupt game-resume or saved-game edit flows with a new-batter prompt.
  useEffect(() => {
    if (resumePromptPending || editingGameId) {
      setIsNextBatterModalOpen(false);
      return;
    }

    const terminalPlay = lastPitchingPlayThisInning && PITCHING_TERMINAL_CODES.has(lastPitchingPlayThisInning.code)
      ? lastPitchingPlayThisInning
      : null;

    if (!terminalPlay) {
      setIsNextBatterModalOpen(false);
      return;
    }

    if (activeMode === 'pitching' && !promptedTerminalPlayIdsRef.current.has(terminalPlay.id)) {
      promptedTerminalPlayIdsRef.current.add(terminalPlay.id);
      setIsNextBatterModalOpen(true);
    }
  }, [activeMode, editingGameId, resumePromptPending, lastPitchingPlayThisInning?.id, lastPitchingPlayThisInning?.code]);

  const handlePitchingAction = (action: PitchingAction) => {
    const result = reducePitchingAction(pitchFlowState, action);
    if (result.seeds.length > 0) addPlays(result.seeds, viewedInning);
  };

  // Dynamic positional button array based on the active "Fielding Position" selection:
  // - All Positions (Universal Core): PO, A, E, DP, TP
  // - Catcher (C): Universal Core + PB, CS, SB, CI, PK, D3S, DI
  // - Infielders (1B, 2B, 3B, SS): Universal Core + FC
  // - Outfielders (LF, CF, RF): Universal Core + OFA
  // - Pitcher (P): Universal Core + PK
  const currentPlaysForMode = React.useMemo(() => {
    if (activeMode === 'fielding') {
      return getFieldingPlaysForPosition(currentInningPosition);
    }
    return getPlaysForMode(activeMode);
  }, [activeMode, currentInningPosition]);

  const battingPlaysCount = liveGame.plays.filter((p) => p.mode === 'batting').length;
  const pitchingPlaysCount = liveGame.plays.filter((p) => p.mode === 'pitching').length;

  const getPlayBadgeStyle = (play: Play) => {
    if (play.mode === 'batting') {
      if (['single', 'double', 'triple', 'homeRun'].includes(play.code)) {
        return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-[#00A892] shadow-2xs';
      }
      if (['walk', 'intentionalWalk', 'hbp'].includes(play.code)) {
        return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-300 shadow-2xs';
      }
      if (['rbi', 'run', 'stolenBase'].includes(play.code)) {
        return 'bg-slate-200 text-white border-slate-300 shadow-2xs';
      }
      return 'bg-slate-700 dark:bg-[#465160] text-white border-slate-700 shadow-2xs';
    }
    if (play.mode === 'pitching') {
      if (['hitAllowed', 'homeRunAllowed'].includes(play.code)) {
        return 'bg-slate-600 text-white border-slate-700 shadow-2xs';
      }
      if (['pitchOut', 'strikeout'].includes(play.code)) {
        if (play.code === 'strikeout' && play.droppedThirdStrikeSafe) {
          return 'bg-blue-600 text-white border-blue-700 shadow-2xs';
        }
        return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-300 shadow-2xs';
      }
      if (['walkAllowed', 'intentionalWalkAllowed', 'hitBatter'].includes(play.code)) {
        return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-300 shadow-2xs';
      }
      if (play.code === 'pitchStrike' || play.code === 'pitchFoul') {
        return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-300 shadow-2xs';
      }
      if (play.code === 'pitchBall') {
        return 'bg-slate-600 text-white border-slate-700 shadow-2xs';
      }
      return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-300 shadow-2xs';
    }
    return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-300 shadow-2xs';
  };

  // Derive dynamic pitch numbering and user-friendly event descriptions.
  // Re-evaluates whenever plays are re-ordered (drag-and-drop), added, or removed.
  const playPitchMetaMap = React.useMemo(() => {
    const map = new Map<
      string,
      {
        pitchNumber: number | null;
        whatHappened: string;
        whatHappenedDetail?: string;
        shortBadge: string;
        badgeStyle: string;
      }
    >();

    let cumulativePitches = 0;

    for (let i = 0; i < liveGame.plays.length; i++) {
      const play = liveGame.plays[i];
      const prevPlay = i > 0 ? liveGame.plays[i - 1] : null;

      if (play.mode !== 'pitching') {
        const def = PLAY_DEFINITIONS[play.code];
        let title = def?.fullLabel || play.code;
        let badge = def?.shortLabel || play.code;
        let detail: string | undefined = undefined;

        if (play.mode === 'batting') {
          if (play.code === 'out') {
            if (play.outReason === 'batterRunnerInterference') {
              title = 'Batter-runner interference';
            } else {
              const traj = play.hitLocation?.trajectory;
              if (traj === 'grounder') title = 'Groundout';
              else if (traj === 'flyBall') title = 'Flyout';
              else if (traj === 'popUp') title = 'Pop Out';
              else if (traj === 'lineDrive') title = 'Lineout';
              else if (traj === 'bunt') title = 'Bunt Out';
              else title = 'Out';
            }
          } else if (play.code === 'strikeout') {
            title = 'Strikeout';
          } else if (play.code === 'single') {
            title = 'Single';
          } else if (play.code === 'double') {
            title = 'Double';
          } else if (play.code === 'triple') {
            title = 'Triple';
          } else if (play.code === 'homeRun') {
            title = 'Home run';
          } else if (play.code === 'walk') {
            title = 'Walk';
          } else if (play.code === 'intentionalWalk') {
            title = 'Intentional walk';
          } else if (play.code === 'hbp') {
            title = 'Hit by pitch';
          } else if (play.code === 'runnerOut') {
            const reasonLabel = RUNNER_OUT_REASONS.find((r) => r.code === play.runnerOutReason)?.label;
            const baseLabel = play.runnerFromBase
              ? ` (from ${play.runnerFromBase === 1 ? '1st' : play.runnerFromBase === 2 ? '2nd' : '3rd'})`
              : '';
            title = reasonLabel ? `Runner Out: ${reasonLabel}${baseLabel}` : play.runnerFromBase
              ? `Runner Out at ${play.runnerFromBase === 1 ? '1st' : play.runnerFromBase === 2 ? '2nd' : '3rd'}`
              : 'Runner Out';
          }
        } else if (play.mode === 'fielding') {
          if (play.code === 'fieldersChoice') {
            title = "Fielder's Choice";
            badge = 'FC';
          }
          if (play.defensivePosition) {
            detail = `Position: ${play.defensivePosition}`;
          }
        }

        map.set(play.id, {
          pitchNumber: null,
          whatHappened: title,
          whatHappenedDetail: detail,
          shortBadge: badge,
          badgeStyle: getPlayBadgeStyle(play),
        });
        continue;
      }

      // PITCHING MODE
      let isPitch = false;
      switch (play.code) {
        case 'pitchBall':
        case 'pitchStrike':
        case 'pitchFoul':
        case 'pitchOther':
          isPitch = true;
          break;
        case 'wildPitch':
          isPitch = play.pitchCounted !== false;
          break;
        case 'passedBall':
        case 'hitBatter':
        case 'hitAllowed':
        case 'homeRunAllowed':
        case 'reachedOnError':
        case 'fieldersChoice':
          isPitch = true;
          break;
        case 'pitchOut':
          isPitch = !play.isExtraOut && play.pickoffKind !== 'pickoff';
          break;
        case 'strikeout': {
          const isAuto =
            play.autoOutcome ||
            (prevPlay?.code === 'pitchStrike' &&
              Math.abs((play.timestamp || 0) - (prevPlay.timestamp || 0)) < 150);
          isPitch = !isAuto;
          break;
        }
        case 'walkAllowed': {
          const isAuto =
            play.autoOutcome ||
            (prevPlay?.code === 'pitchBall' &&
              Math.abs((play.timestamp || 0) - (prevPlay.timestamp || 0)) < 150);
          isPitch = !isAuto;
          break;
        }
        default:
          isPitch = false;
          break;
      }

      let currentPitchNumber: number | null = null;
      if (isPitch) {
        cumulativePitches++;
        currentPitchNumber = cumulativePitches;
      }

      let whatHappened = '';
      let whatHappenedDetail: string | undefined = undefined;
      let shortBadge = '';
      let badgeStyle = getPlayBadgeStyle(play);

      switch (play.code) {
        case 'pitchBall':
          whatHappened = 'Ball';
          shortBadge = 'BALL';
          badgeStyle = 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-[#252D38] dark:text-[#D1D5DB] dark:border-[#354050] shadow-2xs';
          break;
        case 'pitchStrike':
          whatHappened = 'Strike';
          shortBadge = 'STRIKE';
          badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          break;
        case 'pitchFoul':
          whatHappened = 'Foul Ball';
          shortBadge = 'FOUL';
          badgeStyle = 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-[#252D38] dark:text-[#D1D5DB] dark:border-[#354050] shadow-2xs';
          break;
        case 'pitchOther':
          whatHappened = 'In Play';
          shortBadge = 'IN PLAY';
          badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          break;
        case 'wildPitch': {
          const isStrike = play.wildPitchPitchType === 'strike';
          whatHappened = isStrike ? 'Wild Pitch (Swinging Strike)' : 'Wild Pitch (Ball)';
          if (play.wildPitchRunnerMovement === 'scored') {
            whatHappenedDetail = `Pitch got past catcher (${isStrike ? 'swinging strike' : 'ball'}); run scored`;
          } else if (play.wildPitchRunnerMovement === 'out') {
            whatHappenedDetail = `Pitch got past catcher (${isStrike ? 'swinging strike' : 'ball'}); runner thrown out`;
          } else if (play.wildPitchRunnerMovement === 'batterSafe1B') {
            whatHappenedDetail = `Uncaught 3rd strike on wild pitch; batter reached 1st base safely`;
          } else {
            whatHappenedDetail = `Pitch got past catcher (${isStrike ? 'swinging strike' : 'ball'}); runners advanced`;
          }
          shortBadge = isStrike ? 'WP (STR)' : 'WP';
          badgeStyle = 'bg-blue-600 text-white border-blue-700 shadow-2xs';
          break;
        }
        case 'passedBall':
          whatHappened = 'Passed Ball';
          whatHappenedDetail = 'Catcher misplay; runners advanced';
          shortBadge = 'PB';
          badgeStyle = 'bg-blue-600 text-white border-blue-700 shadow-2xs';
          break;
        case 'balk':
          whatHappened = 'Balk';
          whatHappenedDetail = 'Illegal pitch; runners advanced';
          shortBadge = 'BALK';
          badgeStyle = 'bg-blue-700 text-white border-blue-800 shadow-2xs';
          break;
        case 'pickoffAttempt': {
          const base = play.throwTo && play.throwTo !== 'unassisted' ? play.throwTo : '1B';
          whatHappened = `Pickoff attempt: runner safe at ${positionName(base).toLowerCase()}`;
          whatHappenedDetail = `Pitcher threw to ${positionName(base).toLowerCase()}; the runner got back safely`;
          shortBadge = 'PICKOFF';
          badgeStyle = 'bg-slate-700 text-white border-slate-800 shadow-2xs';
          break;
        }
        case 'strikeout':
          if (play.droppedThirdStrikeSafe) {
            whatHappened = 'Dropped 3rd Strike — Safe at 1st';
            whatHappenedDetail = 'Catcher dropped 3rd strike; batter reached 1st safely (K credited, no out recorded)';
            shortBadge = 'K (SAFE)';
            badgeStyle = 'bg-blue-600 text-white border-blue-700 shadow-2xs';
          } else {
            whatHappened = 'Strikeout';
            shortBadge = 'K';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          }
          break;
        case 'pitchOut': {
          if (play.pickoffKind === 'pickoff') {
            const base = play.throwTo && play.throwTo !== 'unassisted' ? play.throwTo : '1B';
            whatHappened = `Runner picked off at ${positionName(base).toLowerCase()}`;
            whatHappenedDetail = 'Pitcher threw to the base and got the runner out';
            shortBadge = 'PICKOFF OUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else if (play.pickoffKind === 'caughtStealing') {
            const base = play.throwTo && play.throwTo !== 'unassisted' ? play.throwTo : '2B';
            whatHappened = `Runner caught stealing ${positionName(base).toLowerCase()}`;
            whatHappenedDetail = 'Runner was thrown out trying to steal';
            shortBadge = 'CS OUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else if (play.isExtraOut) {
            const isTriplePlayOut = play.multiOutPlayType === 'triplePlay';
            const outNumber = play.multiOutNumber ?? 2;
            const playLabel = isTriplePlayOut ? 'Triple play' : 'Double play';
            const ordinal = outNumber === 3 ? 'third' : 'second';
            whatHappened = `${playLabel}: ${ordinal} out`;
            whatHappenedDetail = `The ${ordinal} out was recorded as part of the same ${isTriplePlayOut ? 'triple' : 'double'} play`;
            shortBadge = isTriplePlayOut ? 'TP OUT' : 'DP OUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else if (play.pitcherAction === 'caught') {
            whatHappened = 'Flyout caught by the pitcher';
            whatHappenedDetail = 'Pitcher caught the ball in the air for the out';
            shortBadge = 'FLYOUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else if (play.pitcherAction === 'covered') {
            whatHappened = 'Groundout: pitcher covered first base';
            whatHappenedDetail = play.assistBy
              ? `Pitcher covered first base for the out; ${positionName(play.assistBy).toLowerCase()} made the throw`
              : 'Pitcher covered first base for the out';
            shortBadge = 'GROUNDOUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else if (play.pitcherAction === 'fielded') {
            const target = play.throwTo && play.throwTo !== 'unassisted' ? play.throwTo : '';
            whatHappened = target ? `Groundout: pitcher threw to ${positionName(target).toLowerCase()}` : 'Groundout: pitcher fielded it unassisted';
            whatHappenedDetail = 'Pitcher fielded the ground ball';
            shortBadge = 'GROUNDOUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else if (play.hitLocation?.trajectory) {
            const traj = play.hitLocation.trajectory;
            if (traj === 'grounder') whatHappened = 'Groundout';
            else if (traj === 'flyBall') whatHappened = 'Flyout';
            else if (traj === 'popUp') whatHappened = 'Pop Out';
            else if (traj === 'lineDrive') whatHappened = 'Lineout';
            else if (traj === 'bunt') whatHappened = 'Bunt Out';
            else whatHappened = 'Out';
            shortBadge = 'OUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else {
            whatHappened = 'Out';
            whatHappenedDetail = 'Batted ball retired for out';
            shortBadge = 'OUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          }
          break;
        }
        case 'hitAllowed':
          if (play.hitBases === 4) {
            whatHappened = 'Home Run Allowed';
            shortBadge = 'HR';
            badgeStyle = 'bg-slate-600 text-white border-slate-700 shadow-2xs';
          } else if (play.hitBases === 3) {
            whatHappened = 'Triple Allowed';
            shortBadge = '3B';
            badgeStyle = 'bg-slate-600 text-white border-slate-700 shadow-2xs';
          } else if (play.hitBases === 2) {
            whatHappened = 'Double Allowed';
            shortBadge = '2B';
            badgeStyle = 'bg-slate-600 text-white border-slate-700 shadow-2xs';
          } else {
            whatHappened = 'Single Allowed';
            shortBadge = '1B';
            badgeStyle = 'bg-slate-600 text-white border-slate-700 shadow-2xs';
          }
          break;
        case 'homeRunAllowed':
          whatHappened = 'Home Run Allowed';
          shortBadge = 'HR';
          badgeStyle = 'bg-slate-600 text-white border-slate-700 shadow-2xs';
          break;
        case 'walkAllowed':
          whatHappened = 'Walk';
          whatHappenedDetail = 'Batter awarded first base after four balls';
          shortBadge = 'WALK';
          badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          break;
        case 'intentionalWalkAllowed':
          whatHappened = 'Intentional walk';
          whatHappenedDetail = 'Batter awarded first base; no pitches counted';
          shortBadge = 'IBB';
          badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          break;
        case 'hitBatter':
          whatHappened = 'Hit batter';
          whatHappenedDetail = 'Pitch hit the batter; batter awarded first base';
          shortBadge = 'HBP';
          badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          break;
        case 'reachedOnError':
          whatHappened = 'Reached on Error';
          whatHappenedDetail = 'Defensive error; batter safe';
          shortBadge = 'ERROR';
          badgeStyle = 'bg-blue-600 text-white border-blue-700 shadow-2xs';
          break;
        case 'fieldersChoice':
          whatHappened = "Fielder's Choice";
          whatHappenedDetail = 'Lead runner retired; batter safe';
          shortBadge = 'FC';
          badgeStyle = 'bg-slate-700 text-white border-slate-800 shadow-2xs';
          break;
        case 'earnedRun':
          whatHappened = 'Earned run (+1)';
          whatHappenedDetail = 'Run scored against pitcher';
          shortBadge = 'ER';
          badgeStyle = 'bg-slate-700 text-white border-slate-800 shadow-2xs';
          break;
        case 'runAllowed':
          whatHappened = 'Unearned run (+1)';
          whatHappenedDetail = 'Run scored because of an error or passed ball';
          shortBadge = 'RUN';
          badgeStyle = 'bg-slate-600 text-white border-slate-700 shadow-2xs';
          break;
        default:
          whatHappened = PLAY_DEFINITIONS[play.code]?.fullLabel || play.code;
          shortBadge = PLAY_DEFINITIONS[play.code]?.shortLabel || play.code;
          break;
      }

      map.set(play.id, {
        pitchNumber: currentPitchNumber,
        whatHappened,
        whatHappenedDetail,
        shortBadge,
        badgeStyle,
      });
    }

    return map;
  }, [liveGame.plays]);

  // Pitch number within the inning, shown as "inning.pitch" (e.g. 4.2 = 2nd pitch of the 4th inning).
  const inningPitchLabelMap = React.useMemo(() => {
    const map = new Map<string, string>();
    let lastPitchNumber = 0;
    let baseForInning = 0;
    let currentInningSeen: number | null = null;
    for (const play of liveGame.plays) {
      if (play.mode !== 'pitching') continue;
      const n = playPitchMetaMap.get(play.id)?.pitchNumber;
      if (n === null || n === undefined) continue;
      if (play.inning !== currentInningSeen) {
        baseForInning = lastPitchNumber;
        currentInningSeen = play.inning;
      }
      map.set(play.id, `${play.inning}.${n - baseForInning}`);
      lastPitchNumber = n;
    }
    return map;
  }, [liveGame.plays, playPitchMetaMap]);

  const renderPlayCard = (play: Play) => {
    const { extraClass: dragClass, style: dragStyle, ...dragHandlers } = getDragProps(play.id);
    const isPitching = play.mode === 'pitching';
    const meta = playPitchMetaMap.get(play.id) || {
      pitchNumber: null,
      whatHappened: PLAY_DEFINITIONS[play.code]?.fullLabel || play.code,
      shortBadge: PLAY_DEFINITIONS[play.code]?.shortLabel || play.code,
      badgeStyle: getPlayBadgeStyle(play),
    };
    return (
      <div
        key={play.id}
        {...dragHandlers}
        style={dragStyle}
        className={`p-2.5 sm:p-3 rounded-md border border-l-[5px] border-l-[#18212D] border-slate-300 bg-white shadow-2xs transition-all text-xs space-y-1.5 dark:border-[#354050] dark:border-l-[#18212D] dark:bg-[#252D38] ${dragClass}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
            {/* Innings */}
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050] shrink-0">
              Inning {play.inning}
            </span>

            {/* Pitch count for pitching mode (dynamically recalculates when drag-and-drop reorders plays) */}
            {isPitching && (
              meta.pitchNumber !== null ? (
                <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border border-[#00BFA5] dark:border-[#00D7BC] shrink-0 tabular-nums">
                  {inningPitchLabelMap.get(play.id) ?? `#${meta.pitchNumber}`}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-[#252D38] text-slate-500 dark:text-[#9CA3AF] border border-slate-200 dark:border-[#354050] shrink-0">
                  No pitch
                </span>
              )
            )}

            {/* What happened badge - single clean label, zero duplicate values */}
            <span
              className={`px-2.5 py-0.5 rounded-md text-xs font-semibold tracking-tight shrink-0 border ${meta.badgeStyle}`}
            >
              {meta.whatHappened}
            </span>
          </div>

          {/* Action buttons: Edit & Delete */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedPlayForEdit(play)}
              className="p-1 sm:p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-[#FAFAFA] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors"
              title="Edit play"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleDeletePlay(play.id)}
              className="p-1 sm:p-1.5 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-[#00D7BC]/15 transition-colors"
              title="Delete play"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Second row: details & context */}
        {(meta.whatHappenedDetail || play.pitcherHand || play.lineupSpot || play.defensivePosition || play.hitLocation || play.errorType) && (
          <div className="flex items-center gap-2 flex-wrap text-[13px] text-slate-500 dark:text-[#9CA3AF] pl-0.5">
            {meta.whatHappenedDetail && (
              <span className="text-slate-600 dark:text-[#D1D5DB] font-medium">
                {meta.whatHappenedDetail}
              </span>
            )}
            {play.pitcherHand && (
              <span className="font-semibold inline-flex items-center gap-1">
                Facing a <strong className="text-slate-700 dark:text-[#D1D5DB]">{play.pitcherHand === 'L' ? 'left-handed' : 'right-handed'}</strong> pitcher
              </span>
            )}
            {play.errorType && (
              <span className="font-semibold inline-flex items-center gap-1">
                • Error type: <strong className="text-slate-700 dark:text-[#D1D5DB]">{play.errorType === 'fielding' ? 'Fielding error' : play.errorType === 'throwing' ? 'Throwing error' : play.errorType === 'droppedCatch' ? 'Dropped catch' : 'Other error'}</strong>
              </span>
            )}
            {play.lineupSpot && (
              <span className="font-semibold inline-flex items-center gap-1 text-[#18212D] dark:text-[#D1D5DB]">
                • Batting <strong className="text-[#18212D] dark:text-[#D1D5DB]">{ordinal(Number(play.lineupSpot))}</strong> in the lineup
              </span>
            )}
            {play.defensivePosition && (
              <span className="font-semibold inline-flex items-center gap-1">
                • Position: <strong className="text-slate-700 dark:text-[#D1D5DB]">{positionName(play.defensivePosition)}</strong>
              </span>
            )}
            {play.hitLocation && (
              <button
                type="button"
                onClick={() => setSelectedPlayForEdit(play)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#252D38]/40 border border-slate-300 dark:border-[#354050] text-xs font-semibold text-[#18212D] dark:text-[#D1D5DB] hover:bg-slate-100 transition-colors"
                title="Click to view/edit hit location on field"
              >
                <Crosshair className="w-3 h-3" />
                <span>{positionName(resolveZone(play.hitLocation))}</span>
                {play.hitLocation.trajectory && (
                  <span className="opacity-80">· {getTrajectoryLabel(play.hitLocation.trajectory)}</span>
                )}
              </button>
            )}
            {!play.hitLocation && play.mode === 'batting' &&
              (isHitPlay(play.code) || ['out', 'sacFly', 'sacBunt', 'groundedIntoDoublePlay'].includes(play.code)) && (
              <button
                type="button"
                onClick={() => setPendingHitPlay({ playId: play.id, code: play.code })}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-dashed text-xs font-semibold transition-colors ${isHitPlay(play.code) ? 'border-slate-300 dark:border-[#354050] text-slate-500 hover:text-[#007A6A] dark:hover:text-[#00D7BC] hover:border-[#00BFA5]' : 'border-red-300 dark:border-red-900/70 text-red-600 dark:text-red-400 hover:border-red-500 hover:text-red-700'}`}
                title="Map hit location"
              >
                <Crosshair className="w-3 h-3" />
                <span>{isHitPlay(play.code) ? 'Map Hit Spray' : 'Map Contact'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // A mid-inning switch of defensive position, shown in the same card format as a play.
  const renderPositionChangeCard = (change: PositionChange) => (
    <div
      key={change.id}
      className="p-2.5 sm:p-3 rounded-md border border-l-[5px] border-l-[#18212D] border-slate-300 bg-white shadow-2xs text-xs dark:border-[#354050] dark:border-l-[#18212D] dark:bg-[#252D38]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050] shrink-0">
            Inning {change.inning}
          </span>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold tracking-tight shrink-0 border bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-[#00BFA5] dark:border-[#00D7BC]">
            Position Change: {change.from} → {change.to}
          </span>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={() => removePositionChange(change.id)}
            className="p-1 sm:p-1.5 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-[#00D7BC]/15 transition-colors"
            title="Remove position change"
            aria-label={`Remove position change ${change.from} to ${change.to}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  // Every inning of the game gets a divider (newest first). Innings with plays list them; the rest say
  // why they are empty: benched / resting, or the player simply did not bat or pitch.
  const renderPlaysWithInningDividers = (plays: Play[]) => {
    const allPlays = liveGame.plays;
    const benched = liveGame.benchInnings || [];
    const lastInning = Math.max(currentInning, 1, liveGame.maxInning ?? 0, ...allPlays.map((p) => p.inning), ...benched);
    const tabLabel = playFeedFilter === 'pitching' ? 'pitching' : playFeedFilter === 'fielding' ? 'fielding' : 'batting';

    return (
      <div className="space-y-2">
        {Array.from({ length: lastInning }, (_, i) => lastInning - i).map((inning, index) => {
          const tabPlays = plays.filter((p) => p.inning === inning);
          const isBenched = benched.includes(inning);
          const batOrPitchCount = allPlays.filter(
            (p) => p.inning === inning && (p.mode === 'batting' || p.mode === 'pitching')
          ).length;

          let status: { text: string; tone: 'bench' | 'none' | 'info' } | null = null;
          if (isBenched) {
            status = { text: 'Benched / Resting this inning', tone: 'bench' };
          } else if (batOrPitchCount === 0) {
            status =
              inning === currentInning
                ? { text: 'No plays yet this inning', tone: 'info' }
                : { text: 'No plays made', tone: 'none' };
          } else if (tabPlays.length === 0) {
            status = { text: `No ${tabLabel} plays this inning`, tone: 'info' };
          }

          return (
            <React.Fragment key={inning}>
              <div className={`flex items-center gap-2 px-0.5 ${index === 0 ? 'pb-1' : 'pt-3 pb-1'}`}>
                <div className="h-px flex-1 bg-slate-300 dark:bg-[#354050]" />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-800 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB]">
                  Inning {inning}
                  {tabPlays.length > 0 && (
                    <span className="font-medium text-slate-500 dark:text-[#9CA3AF]">
                      · {tabPlays.length} {tabPlays.length === 1 ? 'play' : 'plays'}
                    </span>
                  )}
                </span>
                <div className="h-px flex-1 bg-slate-300 dark:bg-[#354050]" />
              </div>

              {status && status.tone === 'bench' && (
                /* Same card layout as a play: inning chip, badge, delete icon */
                <div className="p-2.5 sm:p-3 rounded-md border border-l-[5px] border-l-[#18212D] border-slate-300 bg-white shadow-2xs text-xs dark:border-[#354050] dark:border-l-[#18212D] dark:bg-[#252D38]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050] shrink-0">
                        Inning {inning}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold tracking-tight shrink-0 border bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-[#00BFA5] dark:border-[#00D7BC]">
                        Benched / Resting
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setInningBench(inning, false)}
                        className="p-1 sm:p-1.5 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-[#00D7BC]/15 transition-colors"
                        title="Remove bench / rest"
                        aria-label={`Remove bench / rest from inning ${inning}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {status && status.tone !== 'bench' && (
                /* Same card layout as a play: inning chip + badge */
                <div className="p-2.5 sm:p-3 rounded-md border border-l-[5px] border-l-[#18212D] border-slate-300 bg-white shadow-2xs text-xs dark:border-[#354050] dark:border-l-[#18212D] dark:bg-[#252D38]">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050] shrink-0">
                      Inning {inning}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold tracking-tight shrink-0 border bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#252D38] dark:text-[#D1D5DB] dark:border-[#354050]">
                      {status.text}
                    </span>
                  </div>
                  {inning === currentInning &&
                    inning > 1 &&
                    inning === reachedInning &&
                    !isBenched &&
                    !allPlays.some((p) => p.inning === inning) && (
                      <button
                        type="button"
                        onClick={undoEmptyCurrentInning}
                        className="mt-2 rounded-md border border-slate-300 dark:border-[#354050] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors"
                      >
                        Undo empty inning &amp; return to Inning {inning - 1}
                      </button>
                    )}
                </div>
              )}

              {/* Plays newest first, with position changes slotted in where they happened */}
              {(() => {
                const changes = (liveGame.positionChanges || [])
                  .filter((c) => {
                    if (c.inning !== inning) return false;

                    // Position changes never belong in Batting.
                    if (playFeedFilter === 'batting') return false;

                    // Fielding shows every defensive position change.
                    if (playFeedFilter === 'fielding') return true;

                    // Pitching only also shows transitions into or out of Pitcher (P).
                    return playFeedFilter === 'pitching' && (c.from === 'P' || c.to === 'P');
                  })
                  .sort((a, b) => b.timestamp - a.timestamp);
                const items: React.ReactNode[] = [];
                let next = 0;
                tabPlays.forEach((play) => {
                  while (next < changes.length && changes[next].timestamp > (play.timestamp ?? 0)) {
                    items.push(renderPositionChangeCard(changes[next]));
                    next += 1;
                  }
                  items.push(renderPlayCard(play));
                });
                while (next < changes.length) {
                  items.push(renderPositionChangeCard(changes[next]));
                  next += 1;
                }
                return items;
              })()}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const isHomeTeam = liveGame.isHome !== false;
  const opponentDisplay = liveGame.opponent
    ? (isHomeTeam ? `vs ${liveGame.opponent}` : `@ ${liveGame.opponent}`)
    : (isHomeTeam ? 'vs Opponent' : '@ Opponent');

  const getButtonStyles = (code: PlayCode) => {
    switch (code) {
      case 'homeRun':
        return 'bg-gradient-to-br from-[#00D7BC] to-[#00A892] text-[#18212D] shadow-md shadow-teal-500/20 border-[#00A892]';
      case 'single':
      case 'double':
      case 'triple':
        return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs border-[#00BFA5] dark:border-[#00D7BC]';
      case 'walk':
      case 'hbp':
        return 'bg-[#246BFD] dark:bg-[#3478FF] text-white shadow-xs border-slate-300';
      case 'rbi':
      case 'run':
      case 'stolenBase':
        return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs border-slate-300';
      case 'strikeout':
      case 'out':
      case 'cs':
      case 'error':
      case 'passedBall':
        return 'bg-slate-100 dark:bg-[#252D38] text-slate-800 dark:text-[#D1D5DB] border-slate-300 dark:border-[#354050]';
      default:
        return 'bg-slate-50 dark:bg-[#252D38] text-slate-800 dark:text-[#D1D5DB] border-slate-200 dark:border-[#354050]';
    }
  };

  const PRIMARY_BATTING_CODES: PlayCode[] = [
    'single',
    'double',
    'triple',
    'homeRun',
    'walk',
    'hbp',
    'out',
    'catchersInterference',
  ];

  const showInningNotice = useCallback((title: string, subtitle: string) => {
    setInningNotice({ id: Date.now(), title, subtitle });
  }, []);

  useEffect(() => {
    if (!inningNotice) return;
    const timer = window.setTimeout(() => {
      setInningNotice(null);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [inningNotice]);

  const getBattingOutCount = useCallback(
    (inning: number) => {
      return liveGame.plays
        .filter((p) => p.inning === inning && p.mode === 'batting')
        // playOutCount also covers sacrifices (previously uncounted) and teammates retired on a fielder's choice.
        .reduce((count, play) => count + playOutCount(play), 0);
    },
    [liveGame.plays]
  );

  const getDefenseOutCount = useCallback(
    (inning: number) => {
      const pitchingState = derivePitchingFlowState(liveGame.plays, inning);
      let outs = pitchingState.outs;

      const nonPitcherFieldingPlays = liveGame.plays.filter(
        (p) => p.inning === inning && p.mode === 'fielding' && p.defensivePosition !== 'P'
      );
      for (const play of nonPitcherFieldingPlays) {
        // Putouts/assists logged for the player on a double play are already part of its 2 outs.
        if (play.partOfMultiOutPlay) continue;
        if (play.code === 'putout' || play.code === 'caughtStealing') outs += 1;
        else if (play.code === 'doublePlay') outs += 2;
        else if (play.code === 'triplePlay') outs += 3;
      }
      return outs;
    },
    [liveGame.plays]
  );

  // Backward-compatible alias for existing call sites that want batting outs
  const getInningOutCount = getBattingOutCount;

  const hasBattedThisInning = useCallback(
    (inning: number) => {
      if (liveGame.halfInningStatus?.[inning]?.battingCompleted) return true;
      return liveGame.plays.some((p) => p.inning === inning && p.mode === 'batting');
    },
    [liveGame.halfInningStatus, liveGame.plays]
  );

  const hasFieldedThisInning = useCallback(
    (inning: number) => {
      if (liveGame.halfInningStatus?.[inning]?.fieldingCompleted) return true;
      return liveGame.plays.some(
        (p) => p.inning === inning && (p.mode === 'fielding' || p.mode === 'pitching')
      );
    },
    [liveGame.halfInningStatus, liveGame.plays]
  );

  const canAdvanceToNextInning = useCallback(
    (fromMode: PlayMode, inning = currentInning) => {
      const isBatting = fromMode === 'batting';
      const isDefense = fromMode === 'pitching' || fromMode === 'fielding';

      const battedDone = isBatting || hasBattedThisInning(inning);
      const fieldedDone = isDefense || hasFieldedThisInning(inning);

      return Boolean(battedDone && fieldedDone);
    },
    [currentInning, hasBattedThisInning, hasFieldedThisInning]
  );

  const handleThirdOut = useCallback(
    (fromMode: PlayMode, opts?: { allowExtraInning?: boolean }) => {
      if (typeof window !== 'undefined' && window.navigator?.vibrate) {
        try {
          window.navigator.vibrate(20);
        } catch {
          // ignore
        }
      }

      // Clear any pending runner session, active runner chip, and hit tapper
      setRunnerSession(null);
      setRunnerHistory([]);
      // Ending a historical inning must not erase a runner saved for the live inning.
      setActiveRunnerChip((runner) => (runner?.inning === currentInning ? null : runner));
      setPendingHitPlay(null);
      pendingRunnerPrimaryPlayIdRef.current = null;
      pendingRunnerAfterHitRef.current = null;

      // Reset batter and pitcher-batter states
      playFlow.nextPlateAppearance();
      playFlow.nextPitcherBatter();

      const isBatting = fromMode === 'batting';
      const isDefense = fromMode === 'pitching' || fromMode === 'fielding';
      // Scoring from the Fielding tab must never switch tabs.
      const switchMode = (mode: PlayMode) => {
        if (fromMode !== 'fielding') setActiveMode(mode);
      };

      // Record half-inning status
      const existingStatus = liveGame.halfInningStatus?.[currentInning] || {};
      const updatedStatus: HalfInningStatus = {
        ...existingStatus,
        ...(isBatting ? { battingCompleted: true } : {}),
        ...(isDefense ? { fieldingCompleted: true } : {}),
      };

      const updatedHalfStatusMap = {
        ...(liveGame.halfInningStatus || {}),
        [currentInning]: updatedStatus,
      };

      const battedDone = isBatting || hasBattedThisInning(currentInning);
      const fieldedDone = isDefense || hasFieldedThisInning(currentInning);
      const bothConditionsMet = battedDone && fieldedDone;

      if (bothConditionsMet && currentInning >= settings.inningsPerGame && !opts?.allowExtraInning) {
        // The scheduled innings are done. Never roll into an extra inning automatically:
        // the scorer chooses End Game or Add Another Inning.
        updateLiveGameDetails({ halfInningStatus: updatedHalfStatusMap });
        showInningNotice(
          `Inning ${currentInning} complete`,
          'All scheduled innings are done. Choose End Game or Add Another Inning.'
        );
      } else if (bothConditionsMet && currentInning !== liveGame.innings) {
        // Correcting a historical inning must never advance the authoritative live inning.
        updateLiveGameDetails({ halfInningStatus: updatedHalfStatusMap });
        showInningNotice(
          `Inning ${currentInning} updated`,
          `Historical inning complete. Live scoring remains on Inning ${liveGame.innings}.`
        );
      } else if (bothConditionsMet) {
        // Both fielded and batted are complete for the live inning.
        // Move on to the next inning ONLY now!
        updateLiveGameDetails({ halfInningStatus: updatedHalfStatusMap });
        nextInning(); // changes liveGame.innings to currentInning + 1

        const nextInn = currentInning + 1;
        const nextInnPosition =
          liveGame.fieldingPositions?.[nextInn] ||
          (liveGame.benchInnings.includes(nextInn)
            ? 'BENCH'
            : liveGame.fieldingPositions?.[currentInning] || 'CF');

        // Based on Home or Away Team status:
        if (!isHomeTeam) {
          // Away team bats first at top of next inning
          switchMode('batting');
          showInningNotice(
            `Inning ${currentInning} complete!`,
            `Both fielded and batted completed. Starting Inning ${nextInn} (▲ Top · Away Batting).`
          );
        } else {
          // Home team fields first at top of next inning
          const nextDefMode: PlayMode = nextInnPosition === 'P' ? 'pitching' : 'fielding';
          switchMode(nextDefMode);
          showInningNotice(
            `Inning ${currentInning} complete!`,
            `Both fielded and batted completed. Starting Inning ${nextInn} (▲ Top · Home Defense).`
          );
        }
      } else {
        // Conditions are NOT met! Remain on current inning!
        updateLiveGameDetails({ halfInningStatus: updatedHalfStatusMap });

        if (isBatting) {
          // Batting ended, team must now field/pitch in the current inning
          const defMode: PlayMode = currentInningPosition === 'P' ? 'pitching' : 'fielding';
          switchMode(defMode);
          showInningNotice(
            `3rd out recorded · Inning ${currentInning}`,
            `Batting half complete. Remaining on Inning ${currentInning} to field (▼ Bottom · Defense).`
          );
        } else {
          // Defense ended, team must now bat in the current inning
          switchMode('batting');
          showInningNotice(
            `3rd out recorded · Inning ${currentInning}`,
            `Defense half complete. Remaining on Inning ${currentInning} to bat (▼ Bottom · Batting).`
          );
        }
      }
    },
    [
      currentInning,
      currentInningPosition,
      hasBattedThisInning,
      hasFieldedThisInning,
      isHomeTeam,
      liveGame.benchInnings,
      liveGame.fieldingPositions,
      liveGame.halfInningStatus,
      liveGame.innings,
      nextInning,
      playFlow,
      settings.inningsPerGame,
      showInningNotice,
      updateLiveGameDetails,
    ]
  );

  const startRunnerSession = (code: PlayCode) => {
    const base = getRunnerBaseForPrimary(code);
    if (!base) return;
    setRunnerHistory([]);
    setRunnerSession(createRunnerLifecycle(base));
  };

  const recordBatterStrikeout = (droppedThirdStrikeSafe: boolean) => {
    setIsBatterStrikeoutModalOpen(false);
    const outsBefore = getBattingOutCount(currentInning);
    setBatterBalls(0);
    setBatterStrikes(0);
    const strikeoutPlay = addPlay('batting', 'strikeout', {
      pitcherHand,
      lineupSpot: currentInningLineupSpot,
      targetInning: viewedInning,
      droppedThirdStrikeSafe,
    });
    if (droppedThirdStrikeSafe) {
      if (strikeoutPlay) pendingRunnerPrimaryPlayIdRef.current = strikeoutPlay.id;
      startRunnerSession('walk');
      return;
    }
    if (outsBefore + 1 >= 3) handleThirdOut('batting');
    else playFlow.nextPlateAppearance();
  };

  const handleBatterBall = () => {
    if (playFlow.isPrimaryEventDisabled) return;
    addPlay('batting', 'pitchBall', {
      pitcherHand,
      lineupSpot: currentInningLineupSpot,
      targetInning: viewedInning,
    });
    const nextCount = batterBalls + 1;
    if (nextCount >= 4) {
      setBatterBalls(0);
      setBatterStrikes(0);
      handleScoringPlay('walk');
    } else {
      setBatterBalls(nextCount);
    }
  };

  const handleBatterStrike = () => {
    if (playFlow.isPrimaryEventDisabled) return;
    addPlay('batting', 'pitchStrike', {
      pitcherHand,
      lineupSpot: currentInningLineupSpot,
      targetInning: viewedInning,
    });
    const nextCount = batterStrikes + 1;
    if (nextCount >= 3) {
      setBatterBalls(0);
      setBatterStrikes(0);
      const firstBaseOccupied =
        (activeRunnerChip?.inning === currentInning && activeRunnerChip.base === 1) ||
        runnerSession?.base === 1;
      const outsBefore = getBattingOutCount(currentInning);
      if (!firstBaseOccupied || outsBefore >= 2) setIsBatterStrikeoutModalOpen(true);
      else recordBatterStrikeout(false);
    } else {
      setBatterStrikes(nextCount);
    }
  };

  const handleScoringPlay = (code: PlayCode) => {
    if (activeMode === 'batting') {
      if (['single', 'double', 'triple', 'homeRun', 'walk', 'hbp', 'out', 'catchersInterference'].includes(code)) {
        setBatterBalls(0);
        setBatterStrikes(0);
      }
      const requiresLineupSpot = ['single', 'double', 'triple', 'homeRun', 'walk', 'hbp', 'out', 'catchersInterference'].includes(code);
      if (requiresLineupSpot && !currentInningLineupSpot) {
        setLineupSpotPromptOpen(true);
        return;
      }
      // Internal helpers (spray-chart RBI, legacy edit paths) remain supported but are not
      // rendered on the primary parent-facing scoring board.
      if (code === 'rbi') {
        playFlow.handleRbi();
        return;
      }
      if (code === 'run') {
        playFlow.handleRun();
        return;
      }
      if (code === 'stolenBase' || code === 'cs') {
        playFlow.handleBaserunningEvent(code);
        return;
      }
      if (code === 'out') {
        // Resolve the kind of out first. Strikeouts have no batted-ball location;
        // the validated outcome flow requests Hit Location only for batted-ball outs
        // (groundouts, flyouts, bunts, and double-play ground balls).
        setOutResolutionOpen(true);
        return;
      }
      if (code === 'catchersInterference') {
        const ciPlay = addPlay('batting', 'catchersInterference', {
          pitcherHand,
          lineupSpot: currentInningLineupSpot,
          targetInning: viewedInning,
        });
        if (ciPlay) pendingRunnerPrimaryPlayIdRef.current = ciPlay.id;
        playFlow.nextPlateAppearance();
        startRunnerSession('walk');
        return;
      }
      if (getRunnerBaseForPrimary(code)) {
        playFlow.handlePrimaryBattingEvent(code as Parameters<typeof playFlow.handlePrimaryBattingEvent>[0]);
        // If the field tapper is enabled, the runner lockdown is deliberately deferred
        // until Hit Location has been saved/skipped. Without this, both full-screen
        // modals open together and the runner modal hides Hit Location.
        if (!(hitTapperEnabled && isHitPlay(code))) {
          startRunnerSession(code);
        }
        return;
      }
      playFlow.handlePrimaryBattingEvent(code as Parameters<typeof playFlow.handlePrimaryBattingEvent>[0]);
      if (code === 'homeRun') playFlow.nextPlateAppearance();
    } else if (activeMode === 'fielding') {
      const outsBefore = getDefenseOutCount(currentInning);
      const playOuts =
        code === 'triplePlay'
          ? 3
          : code === 'doublePlay'
          ? 2
          : code === 'putout' || code === 'caughtStealing' || code === 'pickoffCaughtStealing' || code === 'pickoff' || code === 'fieldersChoice'
          ? 1
          : 0;

      const CATCHER_FIELDING_CODES: PlayCode[] = [
        'passedBall',
        'catcherGloveDeadBall',
        'caughtStealing',
        'stealAllowed',
        'catchersInterference',
        'pickoff',
        'droppedThirdStrike',
        'defensiveIndifference',
        'catcherObstruction',
        'catcherObstruction2',
        'pickoffCaughtStealing',
        'wildPitch',
        'balk',
      ];

      if (currentInningPosition === 'C' && CATCHER_FIELDING_CODES.includes(code)) {
        playFlow.handleCatcherEvent(code as any);
        if (code === 'catcherGloveDeadBall') advanceTrackedRunnerForAward('deadBall');
      } else {
        playFlow.handleFieldingEvent(code as any);
      }

      // A Double Play asks what the player did on it (catch / step on base / throw) in a modal. When the
      // play ends the half-inning, the third-out handling waits until that modal is confirmed or skipped.
      const endsHalfInning = playOuts > 0 && outsBefore + playOuts >= 3;
      if (code === 'doublePlay' || code === 'triplePlay') {
        setDpActions([]);
        setFieldingChain({ endsHalfInning, playType: code });
      } else if (endsHalfInning) {
        handleThirdOut('fielding');
      }
    } else {
      if (code === 'pitchBall') playFlow.handlePitchBall();
      else if (code === 'pitchStrike') playFlow.handlePitchStrike();
      else if (code === 'pitchFoul') playFlow.handlePitchFoul();
      else if (code === 'pitchOther' || code === 'balk' || code === 'wildPitch' || code === 'earnedRun' || code === 'runAllowed') {
        playFlow.handlePitchingIndependentEvent(code);
      } else {
        playFlow.handlePitchingTerminal(code as Parameters<typeof playFlow.handlePitchingTerminal>[0]);
      }
    }
  };

  // Every selected action represents one contribution to one of the outs in the play.
  // Limit ALL contributions, including throws/assists, to the number of outs in the play.
  const maxMultiOutActions = fieldingChain?.playType === 'triplePlay' ? 3 : 2;

  const addDpAction = (action: MultiOutPlayAction) => {
    setDpActions((prev) => {
      if (prev.length >= maxMultiOutActions) return prev;
      return [...prev, action];
    });
  };

  const removeDpAction = (action: MultiOutPlayAction) => {
    setDpActions((prev) => {
      const index = prev.lastIndexOf(action);
      if (index === -1) return prev;
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  // Confirm the double play follow-up: log the player's putout(s) / assist, then end the half-inning if needed.
  const handleConfirmDoublePlay = () => {
    if (!fieldingChain) return;
    const endsHalfInning = fieldingChain.endsHalfInning;
    // Final safety guard: never record more contributions than outs in the play,
    // regardless of how the modal state was populated.
    const boundedActions = dpActions.slice(0, maxMultiOutActions);
    for (const action of boundedActions) {
      addPlay('fielding', action === 'throw' ? 'assist' : 'putout', {
        defensivePosition: currentInningPosition,
        partOfMultiOutPlay: true,
        targetInning: viewedInning,
      });
    }
    setFieldingChain(null);
    setDpActions([]);
    if (endsHalfInning) handleThirdOut('fielding');
  };

  // Skip: keep the double play only, still ending the half-inning if the play did.
  const handleDismissFieldingChain = () => {
    if (!fieldingChain) return;
    const endsHalfInning = fieldingChain.endsHalfInning;
    setFieldingChain(null);
    setDpActions([]);
    if (endsHalfInning) handleThirdOut('fielding');
  };

  // Record the RBIs chosen in the hit tapper. A home run already auto-adds the batter's own
  // RBI (when the setting is on), so only the remaining RBIs need to be added for it.
  const recordHitRbis = (code: PlayCode, totalRbis: number) => {
    const alreadyRecorded = code === 'homeRun' && settings.homeRunAddsRunAndRbi ? 1 : 0;
    const extra = Math.max(0, totalRbis - alreadyRecorded);
    for (let i = 0; i < extra; i++) handleScoringPlay('rbi');
  };

  // Commit a validated smart-scoring resolution: the batter's play, any auto RBI, and the inning/out bookkeeping.
  const handleScoringResolution = (res: ScoringResolution) => {
    setOutResolutionOpen(false);
    const code = res.outcome;
    const c = res.context;
    const scoringContext: Play['scoringContext'] = {
      action: c.action,
      requested: c.requested,
      outsBefore: c.outs,
      runners: c.runners,
      runnerScoredFrom3rd: c.runnerScoredFrom3rd,
      runnersAdvancedSafely: c.runnersAdvancedSafely,
      leadRunnerPutOut: c.leadRunnerPutOut,
      defensiveError: c.defensiveError,
      batterSafeAtFirst: c.batterSafeAtFirst,
      autoCorrected: res.autoCorrected || undefined,
    };
    const preselectedLoc = pendingHitLocationRef.current || undefined;
    pendingHitLocationRef.current = null;
    const locationWasSkipped = skipOutLocationPromptRef.current;
    skipOutLocationPromptRef.current = false;
    const playOptions = {
      pitcherHand,
      lineupSpot: currentInningLineupSpot,
      hitLocation: preselectedLoc,
      extraOuts: res.extraOuts,
      scoringContext,
    };
    // A bunt/ground-ball single opens the hit tapper (which asks for RBIs itself) when it is enabled.
    const rbiHandledByTapper = code === 'single' && hitTapperEnabled && !res.inningEnds;
    const addAutoRbis = () => {
      if (rbiHandledByTapper) return;
      for (let i = 0; i < res.rbi; i += 1) {
        addPlay('batting', 'rbi', { pitcherHand, lineupSpot: currentInningLineupSpot });
      }
    };

    if (res.batterReaches && !res.inningEnds) {
      // Batter is on base and the inning continues: use the normal primary-play flow so the
      // runner modal / hit tapper behave exactly like a tapped 1B / ROE / FC. Carry the
      // location already captured before OUT resolution through that flow; otherwise its
      // onEvent handler sees no location and opens the Hit Location modal a second time.
      pendingHitLocationRef.current = preselectedLoc ?? null;
      pendingScoringMetaRef.current = { code, extraOuts: res.extraOuts, scoringContext };
      handleScoringPlay(code);
      addAutoRbis();
      return;
    }

    const createdPlay = addPlay('batting', code, playOptions);
    addAutoRbis();

    // The smart-scoring OUT flow records plays directly rather than going through usePlayFlow's
    // onEvent callback. Explicitly open Hit Location for batted-ball outs here as well, and
    // defer the batter/inning transition so it doesn't clear or cover the location modal.
    const locationTrackableOutCodes: PlayCode[] = ['out', 'sacFly', 'sacBunt', 'groundedIntoDoublePlay'];
    // Hit Location is only relevant when the batter put the ball in play (groundout,
    // flyout, or bunt). A strikeout is an OUT, but there is no batted-ball location.
    const isBattedBallOut =
      c.action === 'groundout' || c.action === 'flyout' || c.action === 'bunt';
    if (createdPlay && isBattedBallOut && !preselectedLoc && !locationWasSkipped && hitTapperEnabled && locationTrackableOutCodes.includes(code)) {
      pendingRunnerAfterHitRef.current = null;
      pendingOutCompletionRef.current = res.inningEnds ? 'thirdOut' : 'nextBatter';
      setPendingHitPlay({ playId: createdPlay.id, code });
      return;
    }

    if (res.inningEnds) {
      handleThirdOut('batting');
    } else {
      playFlow.nextPlateAppearance();
    }
  };

  const closeRunnerSession = () => {
    setRunnerSession(null);
    setRunnerHistory([]);
  };

  const applyRunnerAction = (action: Parameters<typeof transitionRunner>[1]) => {
    if (!runnerSession) return;
    const transition = transitionRunner(runnerSession, action);
    if (!transition.valid) return;

    let terminal = false;
    const actionPlayIds: string[] = [];
    const record = (play: Play | undefined) => {
      if (play) actionPlayIds.push(play.id);
    };

    if (transition.effect) {
      const effect = transition.effect;
      if (effect.type === 'STOLEN_BASE') {
        record(addPlay('batting', 'stolenBase', {
          lineupSpot: currentInningLineupSpot,
          runnerFromBase: effect.fromBase,
          runnerToBase: effect.toBase,
          runnerAdvanceCause: effect.cause,
        }));
      } else if (effect.type === 'RUNNER_ADVANCE') {
        record(addPlay('batting', 'runnerAdvance', {
          lineupSpot: currentInningLineupSpot,
          runnerFromBase: effect.fromBase,
          runnerToBase: effect.toBase,
          runnerAdvanceCause: effect.cause,
        }));
      } else if (effect.type === 'RUN') {
        if (effect.cause === 'steal') {
          record(addPlay('batting', 'stolenBase', {
            lineupSpot: currentInningLineupSpot,
            runnerFromBase: 3,
            runnerToBase: 4,
            runnerAdvanceCause: 'steal',
          }));
        }
        record(addPlay('batting', 'run', {
          lineupSpot: currentInningLineupSpot,
          runnerFromBase: 3,
          runnerToBase: 4,
          runnerAdvanceCause: effect.cause,
        }));
        setActiveRunnerChip(null);
        pendingRunnerPrimaryPlayIdRef.current = null;
        closeRunnerSession();
        playFlow.nextPlateAppearance();
        terminal = true;
      } else if (effect.type === 'RUNNER_OUT') {
        // The scorer picks the reason; only a caught-stealing counts as a CS.
        if (effect.reason === 'caughtStealing') {
          record(addPlay('batting', 'cs', {
            lineupSpot: currentInningLineupSpot,
            runnerFromBase: effect.fromBase,
            runnerAdvanceCause: 'steal',
          }));
        }
        record(addPlay('batting', 'runnerOut', {
          lineupSpot: currentInningLineupSpot,
          runnerFromBase: effect.fromBase,
          runnerAdvanceCause: effect.cause,
          runnerOutReason: effect.reason,
        }));
        setActiveRunnerChip(null);
        pendingRunnerPrimaryPlayIdRef.current = null;
        const outsAfter = getBattingOutCount(currentInning) + 1;
        closeRunnerSession();
        terminal = true;
        if (outsAfter >= 3) {
          handleThirdOut('batting');
        } else {
          playFlow.nextPlateAppearance();
        }
      } else if (effect.type === 'LEFT_ON_BASE') {
        record(addPlay('batting', 'leftOnBase', {
          lineupSpot: currentInningLineupSpot,
          runnerFromBase: effect.fromBase,
          runnerAdvanceCause: effect.cause,
        }));
        setActiveRunnerChip(null);
        pendingRunnerPrimaryPlayIdRef.current = null;
        closeRunnerSession();
        terminal = true;
        handleThirdOut('batting');
      }
    }

    if (!terminal) {
      setRunnerHistory((prev) => [...prev, { state: runnerSession, playIds: actionPlayIds }]);
      setRunnerSession(transition.state);
    }
  };

  const handleRunnerAdvance = (cause: RunnerAdvanceCause) => applyRunnerAction({ type: 'ADVANCE', cause });

  // Apply a forced one-base award to the tracked runner for a walk/HBP or a
  // catcher-glove deflection into dead-ball territory.
  const advanceTrackedRunnerForAward = (cause: RunnerAdvanceCause) => {
    if (runnerSession?.status === 'ON_BASE') {
      if (runnerSession.base === 3) applyRunnerAction({ type: 'SCORE', cause });
      else applyRunnerAction({ type: 'ADVANCE', cause });
      return;
    }

    if (!activeRunnerChip || activeRunnerChip.inning !== currentInning) return;
    const base = activeRunnerChip.base;
    if (base === 3) {
      addPlay('batting', 'run', {
        lineupSpot: currentInningLineupSpot,
        runnerFromBase: 3,
        runnerToBase: 4,
        runnerAdvanceCause: cause,
        targetInning: currentInning,
      });
      setActiveRunnerChip(null);
      playFlow.nextPlateAppearance();
      return;
    }

    const nextBase = (base + 1) as 2 | 3;
    addPlay('batting', 'runnerAdvance', {
      lineupSpot: currentInningLineupSpot,
      runnerFromBase: base,
      runnerToBase: nextBase,
      runnerAdvanceCause: cause,
      targetInning: currentInning,
    });
    setActiveRunnerChip({ ...activeRunnerChip, base: nextBase, cause });
  };

  const handleRunnerOut = (reason: RunnerOutReason) => applyRunnerAction({ type: 'OUT', reason });
  const handleRunnerScore = (cause?: RunnerAdvanceCause) => applyRunnerAction({ type: 'SCORE', cause });
  const handleHoldRunnerOnBase = () => {
    if (!runnerSession) return;
    setActiveRunnerChip({
      inning: currentInning,
      base: runnerSession.base,
      sb: runnerSession.sb,
      cause: runnerSession.advanceCause,
    });
    setRunnerSession(null);
  };

  const handleUndoPrimaryRunnerPlay = () => {
    const primaryPlayId = pendingRunnerPrimaryPlayIdRef.current;
    if (!primaryPlayId) return;
    pendingRunnerPrimaryPlayIdRef.current = null;
    pendingRunnerAfterHitRef.current = null;
    setPendingHitPlay(null);
    setRunnerSession(null);
    setRunnerHistory([]);
    setActiveRunnerChip(null);
    const runnerActionIds = runnerHistory.flatMap((entry) => entry.playIds);
    runnerActionIds.forEach((playId) => deletePlay(playId));
    deletePlay(primaryPlayId);
    playFlow.reopenBatter(false);
  };
  const handleRunnerThirdOut = () => applyRunnerAction({ type: 'THIRD_OUT' });

  const handleRunnerUndo = () => {
    if (!runnerSession || runnerHistory.length === 0) return;
    const previous = runnerHistory[runnerHistory.length - 1];
    const transition = transitionRunner(runnerSession, { type: 'UNDO', previous: previous.state });
    if (!transition.valid) return;
    previous.playIds.forEach((playId) => deletePlay(playId));
    setRunnerHistory((prev) => prev.slice(0, -1));
    setRunnerSession(transition.state);
  };

  const handleUnifiedRunnerUndo = () => {
    if (runnerHistory.length > 0) {
      handleRunnerUndo();
    } else {
      handleUndoPrimaryRunnerPlay();
    }
  };

  const handleRunnerInjurySub = () => {
    if (!runnerSession) return;
    addPlay('batting', 'runnerInjury', {
      lineupSpot: currentInningLineupSpot,
      runnerFromBase: runnerSession.base,
    });
    setActiveRunnerChip({
      inning: currentInning,
      base: runnerSession.base,
      sb: runnerSession.sb,
      cause: runnerSession.advanceCause,
      subNumber: 'SUB',
    });
    setRunnerSession(null);
    setRunnerHistory([]);
  };


  const handlePitcherOutSelection = ({ fielding, extra }: PitcherOutSelection) => {
    playFlow.handlePitchingTerminal('pitchOut');

    const additionalOuts = extra === 'doublePlay' ? 1 : extra === 'triplePlay' ? 2 : 0;
    for (let outIndex = 0; outIndex < additionalOuts; outIndex += 1) {
      addPlay('pitching', 'pitchOut', { isExtraOut: true });
    }

    if (fielding === 'putout') addPlay('fielding', 'putout', { defensivePosition: 'P', targetInning: viewedInning });
    if (fielding === 'assist') addPlay('fielding', 'assist', { defensivePosition: 'P', targetInning: viewedInning });

    if (extra === 'doublePlay') addPlay('fielding', 'doublePlay', { defensivePosition: 'P', targetInning: viewedInning });
    if (extra === 'triplePlay') addPlay('fielding', 'triplePlay', { defensivePosition: 'P', targetInning: viewedInning });
  };

  const handleNextInning = (opts?: { allowExtraInning?: boolean }) => {
    if (activeRunnerChip?.inning === currentInning) {
      addPlay('batting', 'leftOnBase', {
        lineupSpot: currentInningLineupSpot,
        runnerFromBase: activeRunnerChip.base,
        runnerAdvanceCause: activeRunnerChip.cause,
      });
    }
    handleThirdOut(activeMode, opts);
  };

  // Furthest inning reached so far; the inning chevron can browse up to it but never add one.
  const reachedInning = Math.max(
    liveGame.maxInning ?? 0,
    currentInning,
    ...liveGame.plays.map((p) => p.inning),
    ...(liveGame.benchInnings || [])
  );

  const openSaveGameModal = () => {
    const match = liveGame?.finalResult?.match(/(\d+)\s*[-\u2013]\s*(\d+)/);
    setTeamFinalScore(match ? match[1] : '');
    setOpponentFinalScore(match ? match[2] : '');
    setIsSaveModalOpen(true);
  };

  // Any accidentally opened trailing inning can be undone, including one that is still
  // within the configured game length. This is separate from intentionally adding extra innings.
  const canRemoveExtraInning =
    currentInning > 1 &&
    currentInning === reachedInning &&
    !isBenchedCurrentInning &&
    !liveGame.plays.some((p) => p.inning === currentInning);

  const undoEmptyCurrentInning = () => {
    if (canRemoveExtraInning && removeEmptyLastInning()) {
      setViewedInning(Math.max(1, currentInning - 1));
    }
  };

  // At (or past) the scheduled number of innings, moving on becomes End Game / Add Another Inning.
  const showEndGameChoice =
    currentInning >= settings.inningsPerGame &&
    (isBenchedCurrentInning || canAdvanceToNextInning(activeMode));

  const RUNNER_ON_CODES = new Set<PlayCode>([
    'single', 'double', 'triple', 'walk', 'intentionalWalk', 'hbp', 'reachedOnError', 'fieldersChoice', 'runnerAdvance',
  ]);
  const NON_PRIMARY_BATTING = new Set<PlayCode>(['rbi', 'run', 'stolenBase', 'cs', 'runnerAdvance', 'runnerOut', 'leftOnBase', 'runnerHold', 'runnerInjury']);

  // Re-sync the UI from the plays that remain. A primary batting play owns the plate appearance;
  // runner actions that happened after it must never prevent that batter from being reopened when
  // the primary play itself is deleted/undone.
  const syncFlowAfterRemoval = (removed: Play | undefined, remaining: Play[]) => {
    if (!removed) return;

    if (removed.mode === 'pitching') {
      const inningPlays = remaining.filter((p) => p.mode === 'pitching' && p.inning === removed.inning);
      let lastTerminalIndex = -1;
      for (let i = inningPlays.length - 1; i >= 0; i--) {
        if (PITCHING_TERMINAL_CODES.has(inningPlays[i].code)) {
          lastTerminalIndex = i;
          break;
        }
      }
      const playsOnBatter = lastTerminalIndex === -1 ? inningPlays : inningPlays.slice(lastTerminalIndex + 1);
      let restoredBalls = 0;
      let restoredStrikes = 0;
      for (const p of playsOnBatter) {
        if (p.code === 'pitchBall' || (p.code === 'wildPitch' && p.wildPitchPitchType !== 'strike')) {
          restoredBalls = Math.min(3, restoredBalls + 1);
        } else if (p.code === 'pitchStrike' || p.code === 'pitchFoul' || (p.code === 'wildPitch' && p.wildPitchPitchType === 'strike')) {
          restoredStrikes = Math.min(2, restoredStrikes + 1);
        }
      }
      if (PITCHING_TERMINAL_CODES.has(removed.code)) playFlow.reopenPitcherBatter(restoredBalls, restoredStrikes);
      else playFlow.syncPitcherCount(restoredBalls, restoredStrikes);
      return;
    }

    if (removed.mode !== 'batting') return;

    // If there is no primary batting play left for this inning, there is no active
    // runner/plate appearance to reconstruct. This is also what makes deleting the
    // final play reliably return the primary batting board.
    const remainingPrimaryPlays = remaining.filter(
      (p) => p.mode === 'batting' && p.inning === removed.inning && !NON_PRIMARY_BATTING.has(p.code)
    );
    if (remainingPrimaryPlays.length === 0) {
      setPendingHitPlay(null);
      pendingRunnerAfterHitRef.current = null;
      pendingRunnerPrimaryPlayIdRef.current = null;
      setRunnerSession(null);
      setRunnerHistory([]);
      setActiveRunnerChip(null);
      playFlow.reopenBatter(false);
      return;
    }

    // Removing a primary batting play must always put the batter back at the primary buttons.
    // Do not compare timestamps: runner actions are deliberately recorded after the primary play.
    if (!NON_PRIMARY_BATTING.has(removed.code)) {
      const remainingPrimary = remaining.filter(
        (p) => p.mode === 'batting' && p.inning === removed.inning && !NON_PRIMARY_BATTING.has(p.code)
      );

      // If the removed play was the latest primary PA, that PA is now open again.
      const latestRemainingPrimary = remainingPrimary[remainingPrimary.length - 1];
      const removedWasLatestPrimary = !latestRemainingPrimary || (removed.timestamp ?? 0) >= (latestRemainingPrimary.timestamp ?? 0);

      if (removedWasLatestPrimary) {
        setPendingHitPlay(null);
        pendingRunnerAfterHitRef.current = null;
        setRunnerSession(null);
        setRunnerHistory([]);
        setActiveRunnerChip(null);
        playFlow.reopenBatter(false);
        return;
      }
    }

    // For a runner-only removal, keep the batter PA state intact and reconstruct only the runner state.
    let runner = false;
    const inningPlays = remaining.filter((p) => p.mode === 'batting' && p.inning === removed.inning);
    for (const p of inningPlays) {
      if (RUNNER_ON_CODES.has(p.code)) runner = true;
      else if (['homeRun', 'run', 'cs', 'runnerOut', 'leftOnBase', 'runnerInjury'].includes(p.code)) runner = false;
    }
    playFlow.restoreRunner(runner);
  };

  const handleUndoLastPlay = () => {
    const lastPlay = liveGame.plays[liveGame.plays.length - 1];
    const remaining = liveGame.plays.slice(0, -1);

    // Close transient scoring UI before changing the authoritative play list.
    setPendingHitPlay(null);
    pendingRunnerAfterHitRef.current = null;
    pendingRunnerPrimaryPlayIdRef.current = null;
    setRunnerSession(null);
    setRunnerHistory([]);
    setActiveRunnerChip(null);

    undoLastPlay();
    syncFlowAfterRemoval(lastPlay, remaining);
  };

  const handleDeletePlay = (playId: string) => {
    const play = liveGame.plays.find((recordedPlay) => recordedPlay.id === playId);
    const remaining = liveGame.plays.filter((p) => p.id !== playId);

    // Deleting a primary PA must also clear any transient runner/location UI created from it.
    if (play?.mode === 'batting' && !NON_PRIMARY_BATTING.has(play.code)) {
      setPendingHitPlay(null);
      pendingRunnerAfterHitRef.current = null;
      setRunnerSession(null);
      setRunnerHistory([]);
      setActiveRunnerChip(null);
    }

    deletePlay(playId);
    syncFlowAfterRemoval(play, remaining);
  };

  // The split feed (and any filtered feed) lists each category on its own, so "move" there means
  // relative to the neighbouring play of the same category.
  const sameCategoryFeed = playFeedFilter !== 'all';
  const canMovePlay = (playId: string, step: 1 | -1) => {
    const plays = liveGame.plays;
    const i = plays.findIndex((p) => p.id === playId);
    if (i === -1) return false;
    const inning = plays[i].inning;
    let j = i + step;
    while (j >= 0 && j < plays.length) {
      // Never offer a move that would cross an inning boundary.
      if (plays[j].inning !== inning) return false;
      if (!sameCategoryFeed || plays[j].mode === plays[i].mode) return true;
      j += step;
    }
    return false;
  };


  const handleSaveGameWithScore = () => {
    const teamScore = Number(teamFinalScore);
    const opponentScore = Number(opponentFinalScore);
    if (
      teamFinalScore.trim() === '' ||
      opponentFinalScore.trim() === '' ||
      !Number.isInteger(teamScore) ||
      !Number.isInteger(opponentScore) ||
      teamScore < 0 ||
      opponentScore < 0
    ) {
      return;
    }

    const outcome = teamScore > opponentScore ? 'W' : teamScore < opponentScore ? 'L' : 'D';
    // Close all transient scoring UI before committing the game.
    setPendingHitPlay(null);
    pendingRunnerAfterHitRef.current = null;
    pendingRunnerPrimaryPlayIdRef.current = null;
    setRunnerSession(null);
    setRunnerHistory([]);
    setActiveRunnerChip(null);
    setIsSaveModalOpen(false);
    saveGame(`${outcome} ${teamScore}-${opponentScore}`);
    onGameClosed?.();
  };

  const pitchLimit = settings.pitchCountLimit || 85;
  const pitchProgressPct = Math.min(100, Math.round((dailyPitching.pitches / pitchLimit) * 100));

  const handleScoreTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('[data-score-swipe-ignore]')) {
      touchStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleScoreTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

    const modes: PlayMode[] = ['batting', 'pitching', 'fielding'];
    const currentIndex = modes.indexOf(activeMode);
    const nextIndex = Math.max(0, Math.min(modes.length - 1, currentIndex + (deltaX < 0 ? 1 : -1)));
    if (nextIndex !== currentIndex) {
      event.preventDefault();
      setActiveMode(modes[nextIndex]);
    }
  };

  return (
    <div
      className="font-score flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain pb-44 px-3 sm:px-4 pt-2 max-w-2xl mx-auto w-full space-y-3 animate-in fade-in duration-200"
      onTouchStart={handleScoreTouchStart}
      onTouchEnd={handleScoreTouchEnd}
      onTouchCancel={() => {
        touchStartRef.current = null;
      }}
    >
      {resumePromptPending && liveGame && (
        <div className={`fixed inset-0 ${isAbandonResumeModalOpen ? "z-40" : "z-[200]"} flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm`}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="resume-game-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#354050] dark:bg-[#1A2028]"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#00BFA5]/15 text-[#008F7C] dark:bg-[#00D7BC]/15 dark:text-[#00D7BC]">
              <PlayIcon className="h-6 w-6" />
            </div>
            <h2 id="resume-game-title" className="text-center text-xl font-bold text-slate-900 dark:text-[#FAFAFA]">
              Continue Where you left off
            </h2>
            <p className="mt-2 text-center text-sm leading-relaxed text-slate-600 dark:text-[#D1D5DB]">
              You have a game in progress{liveGame.opponent ? ` against ${liveGame.opponent}` : ''}. Your saved plays and scoring state are ready to resume.
            </p>
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-[#354050] dark:bg-[#252D38]">
              <p className="text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">{liveGame.teamName || 'Your team'}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">Inning {viewedInning} of {liveGame.innings}</p>
            </div>
            <button
              type="button"
              onClick={dismissResumePrompt}
              className="mt-5 w-full rounded-xl bg-[#00BFA5] px-5 py-3 text-sm font-semibold text-[#18212D] shadow-md transition-all hover:bg-[#00A892] active:scale-[0.99] dark:bg-[#00D7BC] dark:text-[#101419] dark:hover:bg-[#00C4AB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BFA5] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1A2028]"
            >
              Continue Game
            </button>
            <button
              type="button"
              onClick={() => {
                dismissResumePrompt();
                onCancelResume?.();
              }}
              className="mt-2 w-full rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#252D38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1A2028]"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => setIsAbandonResumeModalOpen(true)}
              className="mt-3 w-full rounded-xl border-2 border-[#FF5252] bg-[#FF5252] px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-[#A82E38] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5252] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1A2028]"
            >
              {isEditing ? 'Discard Edits' : 'Discard Game'}
            </button>
          </section>
        </div>
      )}

      {lineupSpotPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="lineup-spot-prompt-title"
            className="w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#354050] dark:bg-[#1A2028]"
          >
            <h2 id="lineup-spot-prompt-title" className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA]">
              Select batting lineup spot
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-[#9CA3AF]">
              Choose the player&apos;s spot before recording a batting play.
            </p>
            <select
              autoFocus
              value={currentInningLineupSpot ?? ''}
              onChange={(e) => setLineupSpot(e.target.value ? Number(e.target.value) : undefined)}
              className="mt-5 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#FAFAFA]"
            >
              <option value="">Select lineup spot</option>
              {LINEUP_SPOTS.map((s) => (
                <option key={s.spot} value={s.spot}>
                  #{s.spot} · {s.label}
                </option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLineupSpotPromptOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-[#354050] dark:text-[#D1D5DB]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!currentInningLineupSpot}
                onClick={() => setLineupSpotPromptOpen(false)}
                className="rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] px-4 py-2.5 text-sm font-semibold text-[#18212D] dark:text-[#101419] shadow-md disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Game & Lineup Details Modal Sheet (Opens cleanly without pushing live scoring down) */}
      {showEditDetails && (
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
                onClick={() => setShowEditDetails(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-[#D1D5DB]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
                <input
                  type="date"
                  value={liveGame.date}
                  onChange={(e) => updateLiveGameDetails({ date: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-xs text-slate-900 dark:text-[#FAFAFA]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Opponent</label>
                <OpponentCombobox
                  value={liveGame.opponent || ''}
                  onChange={(val) => updateLiveGameDetails({ opponent: val })}
                  allOpponents={allOpponents}
                  recentOpponents={recentOpponents}
                  onDeleteOpponent={deleteOpponent}
                  placeholder="Opponent name"
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
                <select
                  value={liveGame.lineupSpot ?? ''}
                  onChange={(e) => {
                    const spot = e.target.value ? Number(e.target.value) : undefined;
                    updateLiveGameDetails({ lineupSpot: spot });
                    setLineupSpot(spot);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] cursor-pointer"
                >
                  <option value="">Not assigned</option>
                  {LINEUP_SPOTS.map((s) => (
                    <option key={s.spot} value={s.spot}>
                      #{s.spot} · {s.label}
                    </option>
                  ))}
                </select>
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
                onClick={() => setShowEditDetails(false)}
                className="w-full h-12 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] font-semibold text-sm transition-colors shadow-xs cursor-pointer"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditDetails(false);
                  setIsDiscardModalOpen(true);
                }}
                className="w-full h-11 rounded-md border-2 border-[#FF5252] bg-[#FF5252] hover:bg-[#A82E38] text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5252] focus-visible:ring-offset-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isEditing ? 'Cancel edit' : 'Discard this game'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'score' && (
      <>
      {/* Compact scoreboard: game, inning and live numbers. Kept short so the scoring keys stay the focus. */}
      <section className="rounded-md overflow-hidden text-white">
        <div className="flex items-start gap-2 pl-4 pr-2 pt-3 pb-3 bg-[#00BFA5] dark:bg-[#252D38]">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg leading-tight font-semibold tracking-tight truncate">
              {isEditing ? `Edit ${opponentDisplay}` : opponentDisplay}
            </h2>
            <p className="truncate text-[13px] text-white">
              {liveGame.teamName || activeProfile.teamName || 'Dugout Pulse'} · {isHomeTeam ? 'Home' : 'Away'}
              {currentInningLineupSpot ? ` · Batting #${currentInningLineupSpot}` : ''}
            </p>
            {/* Age group, season, tournament. A missing value is a tappable prompt. */}
            <p className="truncate text-[13px] text-white">
              {liveGame.ageGroup } | { liveGame.date} | {liveGame.tournament }
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowEditDetails(true)}
            aria-label="Edit game details"
            className="shrink-0 w-10 h-10 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 active:bg-white/15 flex items-center justify-center cursor-pointer transition-colors"
          >
            <Edit2 className="w-[18px] h-[18px] text-white" />
          </button>

          
          <button
            type="button"
            onClick={() => {
              setShowEditDetails(false);
              setIsDiscardModalOpen(true);
            }}
            aria-label={isEditing ? 'Cancel editing this game' : 'Discard this game'}
            title={isEditing ? 'Cancel Edit' : 'Discard Game'}
            className="shrink-0 w-10 h-10 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
          >
            {isEditing ? <X className="w-[18px] h-[18px] text-white" /> : <Trash2 className="w-[18px] h-[18px] text-white" />}
          </button>
        </div>

        {/* One row: inning stepper on the left, live numbers on the right */}
        {(() => {
          const cells: Array<{ label: string; value: React.ReactNode }> =
            activeMode === 'batting'
              ? [
                  { label: 'Hits/AB', value: `${batting.h}-${batting.ab}` },
                  { label: 'RBI', value: batting.rbi },
                  { label: 'Runs', value: batting.r },
                ]
              : activeMode === 'pitching'
              ? [
                  {
                    label: 'Pitches',
                    value: (
                      <>
                        {dailyPitching.pitches}
                        <span className="text-[13px] text-slate-300 font-normal">/{pitchLimit}</span>
                      </>
                    ),
                  },
                  { label: 'Strikes', value: dailyPitching.strikePercentage ? `${dailyPitching.strikePercentage.toFixed(0)}%` : '—' },
                  { label: 'Strikeouts', value: dailyPitching.k },
                ]
              : [
                  { label: 'Position', value: currentInningPosition },
                  { label: 'Outs', value: `${getDefenseOutCount(currentInning)}` },
                  {
                    label: 'Plays',
                    value: liveGame.plays.filter((p) => p.inning === currentInning && p.mode === 'fielding').length,
                  },
                ];
          return (
            <div className="flex items-stretch border-t border-white/10 bg-black/15">
              <div className="flex items-center shrink-0 pl-1  bg-[#18212D] dark:bg-[#252D38] ">
                <button
                  type="button"
                  onClick={() => setViewedInning((inning) => Math.max(1, inning - 1))}
                  disabled={currentInning <= 1}
                  aria-label="Previous inning"
                  className="w-10 h-11 flex items-center justify-center text-white disabled:text-white/25 active:bg-white/10 rounded-md"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <span className="text-sm font-semibold tracking-tight whitespace-nowrap">Inning {currentInning} of {Math.max(settings.inningsPerGame, currentInning)}</span>
                <button
                  type="button"
                  onClick={() => setViewedInning((inning) => Math.min(reachedInning, inning + 1))}
                  disabled={currentInning >= reachedInning}
                  aria-label="Next inning"
                  className="w-10 h-11 flex items-center justify-center text-white disabled:text-white/25 active:bg-white/10 rounded-md"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 grid border-l border-white/10" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
                {cells.map((cell) => (
                  <div key={cell.label} className="px-1 py-1.5 text-center min-w-0  bg-[#18212D] dark:bg-[#252D38] ">
                    <div className="font-display text-[20px] leading-none font-semibold tabular-nums text-white">{cell.value}</div>
                    <div className="mt-0.5 text-[12px] text-slate-300 truncate">{cell.label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </section>

      {/* Half-Inning / Inning Transition Toast Notice */}
      {inningNotice && (
        <div className="rounded-md border border-slate-300 dark:border-[#354050] bg-slate-100 dark:bg-[#252D38]/40 p-2.5 shadow-2xs flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#00BFA5] dark:bg-[#00D7BC] animate-pulse shrink-0" />
            <div className="text-xs font-semibold text-[#18212D] dark:text-[#D1D5DB] truncate">
              <span className="font-semibold mr-1">{inningNotice.title}</span>
              <span className="text-[#18212D] dark:text-[#D1D5DB] font-medium">{inningNotice.subtitle}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setInningNotice(null)}
            className="text-[#18212D] dark:text-[#D1D5DB] hover:text-[#18212D] text-xs font-semibold px-1.5 py-0.5 shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sticky mode tabs */}
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-0 pb-2">
        {/* Mode tabs: sentence case, weight only on the active one */}
        <div className="flex rounded-sm bg-slate-200/80 dark:bg-[#1A2028] border border-slate-300/40 dark:border-[#354050] p-1 gap-1">
          {(['batting', 'pitching', 'fielding'] as PlayMode[]).map((mode) => {
            const playsInThisModeAndInning = liveGame.plays.filter((p) => p.mode === mode).length;
            const isActive = activeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setActiveMode(mode)}
                aria-pressed={isActive}
                className={`flex-1 h-10 text-[15px] rounded-sm transition-colors flex items-center justify-center gap-1.5 capitalize ${
                  isActive
                    ? 'bg-[#00BFA5]/60 dark:bg-[#252D38] text-[#FAFAFA] dark:text-[#FAFAFA] font-medium border-t-3 border-[#00BFA5] dark:border-[#465160]'
                    : 'bg-white/40 text-slate-900 dark:text-[#9CA3AF] font-medium hover:bg-white/60 dark:hover:bg-[#252D38]/70 border-t-3 border-white/60'
                }`}
              >
                <span>{mode}</span>
                {playsInThisModeAndInning > 0 && (
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-medium leading-none ${
                      isActive
                        ? 'bg-[#18212D] dark:bg-[#00D7BC] text-white dark:text-[#101419]'
                        : 'bg-[#00BFA5] dark:bg-[#1A2028] text-white dark:text-[#D1D5DB]'
                    }`}
                  >
                    <span className={playsInThisModeAndInning === 1 ? '-translate-x-[0.5px] -translate-y-[0.5px]' : ''}>
                      {playsInThisModeAndInning}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>



      {/* PRIMARY ACTION BOARD (No scrolling needed!) */}
      {activeMode === 'batting' ? (
        isBenchedCurrentInning ? (
          <div className="rounded-md border border-slate-300 dark:border-[#354050] bg-slate-100/70 dark:bg-[#252D38]/20 p-5 text-center space-y-2.5 shadow-2xs">
            <div className="inline-flex px-3 py-0.5 rounded-full text-[13px] font-semibold bg-slate-100/80 dark:bg-[#252D38]/60 text-[#18212D] dark:text-[#D1D5DB]">
              Bench / Resting for Inning {currentInning}
            </div>
            <h3 className="font-semibold text-base text-slate-900 dark:text-[#FAFAFA]">
              {activeProfile.playerName || 'Player'} is on Bench / Resting
            </h3>
            <p className="text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] max-w-sm mx-auto">
              Player batting appearance is paused.
            </p>
            <button
              type="button"
              onClick={() => {
                if (liveGame.benchInnings.includes(currentInning)) setInningBench(currentInning, false);
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] active:scale-95 text-[#18212D] dark:text-[#101419] text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Back in Game
            </button>
          </div>
        ) : activeRunnerChip?.inning === currentInning ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setRunnerHistory([]);
                setRunnerSession({
                  status: 'ON_BASE',
                  base: activeRunnerChip.base,
                  sb: activeRunnerChip.sb,
                  advanceCause: activeRunnerChip.cause,
                  actionCount: 0,
                });
                setActiveRunnerChip(null);
              }}
              className="w-full rounded-lg border border-[#00BFA5]/70 dark:border-[#00D7BC]/60 bg-white dark:bg-[#252D38] p-3.5 text-left shadow-sm hover:border-[#00BFA5] dark:hover:border-[#00D7BC] hover:shadow-md transition-all active:scale-[0.99] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#246BFD] dark:focus-visible:ring-[#3478FF]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[#18212D] dark:text-[#D1D5DB] bg-[#00BFA5]/20  dark:bg-[#00D7BC]/40 py-1.5 px-3 rounded-xl">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#00BFA5] dark:bg-[#00D7BC]" />
                  <span className="font-medium flex">Play in Progress</span>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] px-3 py-2 text-xs font-bold text-[#18212D] dark:text-[#101419] shadow-sm">
                  <Footprints className="h-4 w-4" />
                  Manage Runner
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 font-semibold text-slate-950 dark:text-[#FAFAFA] text-sm sm:text-base flex items-center gap-2">
                <Footprints className="w-5 h-5 text-[#246BFD] dark:text-[#3478FF] shrink-0" />
                <span>{activeProfile.playerName || 'Player'} safe on {activeRunnerChip.base === 1 ? '1st' : activeRunnerChip.base === 2 ? '2nd' : '3rd'} Base</span>
              </div>
            </button>

          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5 pb-1">
            {PRIMARY_BATTING_CODES.map((code) => {
              const labels: Record<string, [string, string]> = {
                single: ['Single', '1B'],
                double: ['Double', '2B'],
                triple: ['Triple', '3B'],
                homeRun: ['Home Run', 'HR'],
                walk: ['Walk', 'BB'],
                hbp: ['Hit Batter', 'HBP'],
                out: ['Out', 'OUT'],
                catchersInterference: ['Catcher Int.', 'CI'],
              };
              const [label, subtitle] = labels[code];

              // Neutral scoring cards keep the action grid calm; the code carries the brand accent.
              const buttonColor = 'h-[72px] min-h-[72px] max-h-[72px] box-border rounded-lg p-1.5 flex flex-col items-center justify-center text-center transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-slate-300/90 dark:border-[#354050] bg-white dark:bg-[#252D38] text-[#18212D] dark:text-[#FAFAFA] hover:border-[#00BFA5]/70 dark:hover:border-[#00D7BC]/70 hover:bg-slate-50 dark:hover:bg-[#2D3643] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#246BFD] dark:focus-visible:ring-[#3478FF]';


              return (
                <div key={code} className="relative">
                  <button
                    type="button"
                    onClick={() => handleScoringPlay(code)}
                    disabled={playFlow.isPrimaryEventDisabled}
                    className={`w-full h-[72px] min-h-[72px] max-h-[72px] box-border rounded-md p-1.5 text-center flex flex-col items-center justify-center transition-[transform,filter] active:scale-[0.97] active:brightness-90 disabled:opacity-40 cursor-pointer ${buttonColor}`}
                  >
                    <span className="text-[14px] sm:text-[15px] font-semibold leading-tight tracking-tight text-[#18212D] dark:text-[#FAFAFA]">{label}</span>
                    <span className="mt-1 text-[10px] sm:text-[11px] font-semibold tracking-wide text-slate-600 dark:text-[#D1D5DB]">{subtitle}</span>
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={handleBatterStrike}
              disabled={playFlow.isPrimaryEventDisabled}
              className="h-[72px] min-h-[72px] max-h-[72px] box-border rounded-md border border-slate-300/90 dark:border-[#354050] bg-white dark:bg-[#252D38] p-1.5 text-center flex flex-col items-center justify-center transition-colors hover:border-[#00BFA5]/70 dark:hover:border-[#00D7BC]/70 hover:bg-slate-50 dark:hover:bg-[#2D3643] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              title="Record a strike seen by the batter; does not affect pitching or fielding statistics"
            >
              <span className="text-[14px] sm:text-[15px] font-semibold leading-tight text-[#18212D] dark:text-[#FAFAFA]">Strike</span>
              <span className="mt-1 text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">K</span>
            </button>
            <button
              type="button"
              onClick={handleBatterBall}
              disabled={playFlow.isPrimaryEventDisabled}
              className="h-[72px] min-h-[72px] max-h-[72px] box-border rounded-md border border-slate-300/90 dark:border-[#354050] bg-white dark:bg-[#252D38] p-1.5 text-center flex flex-col items-center justify-center transition-colors hover:border-[#00BFA5]/70 dark:hover:border-[#00D7BC]/70 hover:bg-slate-50 dark:hover:bg-[#2D3643] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              title="Record a ball received by the batter; does not affect pitching or fielding statistics"
            >
              <span className="text-[14px] sm:text-[15px] font-semibold leading-tight text-[#18212D] dark:text-[#FAFAFA]">Ball</span>
              <span className="mt-1 text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">B</span>
            </button>
            <button
              type="button"
              onClick={() => setIsFoulTapperOpen(true)}
              disabled={playFlow.isPrimaryEventDisabled}
              className="h-[72px] min-h-[72px] max-h-[72px] box-border rounded-md border border-slate-300/90 dark:border-[#354050] bg-white dark:bg-[#252D38] p-1.5 text-center flex flex-col items-center justify-center transition-colors hover:border-[#00BFA5]/70 dark:hover:border-[#00D7BC]/70 hover:bg-slate-50 dark:hover:bg-[#2D3643] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              title="Record a foul ball and map where it went without ending the plate appearance"
            >
              <span className="text-[14px] sm:text-[15px] font-semibold leading-tight text-[#18212D] dark:text-[#FAFAFA]">Foul</span>
              <span className="mt-1 text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">F</span>
            </button>
          </div>
        )
      ) : activeMode === 'pitching' ? (
        isBenchedCurrentInning ? (
          <div className="rounded-md border border-slate-300 dark:border-[#354050] bg-slate-100/70 dark:bg-[#252D38]/20 p-5 text-center space-y-2.5 shadow-2xs">
            <div className="inline-flex px-3 py-0.5 rounded-full text-[13px] font-semibold bg-slate-100/80 dark:bg-[#252D38]/60 text-[#18212D] dark:text-[#D1D5DB]">
              Bench / Resting for Inning {currentInning}
            </div>
            <h3 className="font-semibold text-base text-slate-900 dark:text-[#FAFAFA]">
              {activeProfile.playerName || 'Player'} is on Bench / Resting
            </h3>
            <p className="text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] max-w-sm mx-auto">
              Player pitching appearance is paused.
            </p>
            <button
              type="button"
              onClick={() => {
                if (liveGame.benchInnings.includes(currentInning)) setInningBench(currentInning, false);
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] active:scale-95 text-[#18212D] dark:text-[#101419] text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Back in Game
            </button>
          </div>
        ) : (
          <>


            <PitchingBoard
              state={pitchFlowState}
              pitchLimit={pitchLimit}
              dailyPitches={dailyPitching.pitches}
              onAction={handlePitchingAction}
              endedOnRunnerOut={inningEndedOnRunnerOut}
            />
          </>
        )
      ) : (
        isBenchedCurrentInning ? (
          <div className="rounded-md border border-slate-300 dark:border-[#354050] bg-slate-100/70 dark:bg-[#252D38]/20 p-5 text-center space-y-2.5 shadow-2xs">
            <div className="inline-flex px-3 py-0.5 rounded-full text-[13px] font-semibold bg-slate-100/80 dark:bg-[#252D38]/60 text-[#18212D] dark:text-[#D1D5DB]">
              Bench / Resting for Inning {currentInning}
            </div>
            <h3 className="font-semibold text-base text-slate-900 dark:text-[#FAFAFA]">
              {activeProfile.playerName || 'Player'} is on Bench / Resting
            </h3>
            <p className="text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] max-w-sm mx-auto">
              Player fielding appearance is paused.
            </p>
            <button
              type="button"
              onClick={() => {
                if (liveGame.benchInnings.includes(currentInning)) setInningBench(currentInning, false);
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] active:scale-95 text-[#18212D] dark:text-[#101419] text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Back in Game
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Dynamic Button Grid based on Active Position */}
            <div className="grid grid-cols-4 gap-1.5">
              {currentPlaysForMode.map((def) => {
                return (
                  <button
                    key={def.code}
                    type="button"
                    onClick={() => handleScoringPlay(def.code)}
                    className="h-[72px] min-h-[72px] max-h-[72px] box-border rounded-lg p-1.5 flex flex-col items-center justify-center text-center transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-slate-300/90 dark:border-[#354050] bg-white dark:bg-[#252D38] text-[#18212D] dark:text-[#FAFAFA] hover:border-[#00BFA5]/70 dark:hover:border-[#00D7BC]/70 hover:bg-slate-50 dark:hover:bg-[#2D3643] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#246BFD] dark:focus-visible:ring-[#3478FF]"
                  >
                    <span className="text-[13px] sm:text-[14px] font-semibold leading-tight tracking-tight text-[#18212D] dark:text-[#FAFAFA]">{def.fullLabel}</span>
                    <span className="text-[10px] sm:text-[11px] font-semibold leading-tight text-center mt-1 text-slate-600 dark:text-[#D1D5DB]">{def.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )
      )}


      {/* End of Inning / End Half Button (two lines: action, then what happens next) */}
      {canRemoveExtraInning && (
        <button
          type="button"
          onClick={undoEmptyCurrentInning}
          className="w-full rounded-md border border-slate-300 dark:border-[#354050] bg-white dark:bg-[#1A2028] py-2.5 text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors cursor-pointer shadow-2xs"
        >
          Undo Empty Inning {currentInning} &amp; Return to Inning {currentInning - 1}
        </button>
      )}

      {/* Final scheduled inning finished: End Game, or keep going with an extra inning */}
      {showEndGameChoice ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={openSaveGameModal}
            className="min-h-[92px] rounded-md p-3 flex flex-col items-center justify-center text-center transition-all active:scale-[0.97] cursor-pointer border-[#00BFA5] dark:border-[#00D7BC] bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] hover:bg-[#00BFA5]/90 ring-2 ring-inset ring-[#efefef] dark:ring-[#354050]"
          >
            <span className="font-semibold text-xl">End Game</span>
            <span className="text-[13px] font-normal text-white">Enter final score &amp; save</span>
          </button>
          <button
            type="button"
            onClick={isBenchedCurrentInning ? () => setInning(currentInning + 1) : () => handleNextInning({ allowExtraInning: true })}
            className="min-h-[92px] rounded-md p-3 flex flex-col items-center justify-center text-center transition-all active:scale-[0.97] cursor-pointer border-[#00BFA5] dark:border-[#00D7BC] bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] ring-2 ring-inset ring-[#efefef] dark:ring-[#354050]"
          >
            <span className="font-semibold text-xl">Add Another Inning</span>
            <span className="text-[13px] font-normal text-white">Next: Inning {currentInning + 1}</span>
          </button>
        </div>
      ) : (
          <button
            type="button"
            onClick={isBenchedCurrentInning ? () => setInning(currentInning + 1) : () => handleNextInning()}
            className="w-full min-h-[92px] shadow-sm rounded-md p-2 text-center flex flex-col items-center justify-center transition-[transform,filter] active:scale-[0.97] active:brightness-90 disabled:opacity-40 cursor-pointer min-h-[92px] rounded-md p-3 flex flex-col items-center justify-center text-center transition-all active:scale-[0.97] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-[#00BFA5] dark:border-[#00D7BC] bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] hover:bg-[#00BFA5]/90 dark:hover:bg-[#00D7BC]/90"          >
            {isBenchedCurrentInning ? (
              <>
                <span className="font-semibold text-xl text-white">Start Next Inning</span>
                <span className="text-[13px] font-normal text-white">Next: Inning {currentInning + 1}</span>
              </>
            ) : canAdvanceToNextInning(activeMode) ? (
              <>
                <span className="font-semibold text-xl text-white">End Inning {currentInning}</span>
                <span className="text-[13px] font-normal text-white">Next: Inning {currentInning + 1}</span>
              </>
            ) : activeMode === 'batting' ? (
              <>
                <span className="font-semibold text-xl text-white">End Batting Half</span>
                <span className="text-[13px] font-normal text-white dark:text-[#9CA3AF]">Next: switch to defense, Inning {currentInning}</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-xl text-white">End Defense Half</span>
                <span className="text-[13px] font-normal text-white dark:text-[#9CA3AF]">Next: switch to batting, Inning {currentInning}</span>
              </>
            )}
          </button>
      )}

      {/* Pitch Count Tracker & Rest-Day Indicator (Pitching Mode) */}
      {activeMode === 'pitching' && !isBenchedCurrentInning && (
        <div className="bg-slate-900 text-white rounded-md p-3 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-300" />
              <span className="font-semibold text-slate-300">Pitch count</span>
            </div>
            <span className="text-[13px] font-semibold text-slate-300 flex items-center">
              Limit: {pitchLimit} pitches · Rest: <span className="text-slate-300 font-semibold">{dailyPitching.restDaysRequired === 0 ? '0 Days' : `${dailyPitching.restDaysRequired} Day(s)`}</span>
              {pitching.pitches >= pitchLimit && (
               <span className="flex items-center p-1"> · 
                <span className="text-[#FF5252] px-1 ">[LIMIT REACHED - <span className="font-display text-[16px] leading-none font-semibold tabular-nums">{pitching.pitches}</span>/ {pitchLimit}]</span>
                </span>
              )}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                pitchProgressPct > 85 ? 'bg-[#FF5252]' : pitchProgressPct > 65 ? 'bg-[#FF6F00]' : 'bg-[#00BFA5]'
              }`}
              style={{ width: `${pitchProgressPct}%` }}
            />
          </div>
          {playFlow.pitchingState === 'BATTER_RESOLVED' && (
            <button
              type="button"
              onClick={playFlow.nextPitcherBatter}
              className="w-full py-2.5 rounded-md bg-slate-200 hover:bg-slate-200 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              Next Batter
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

{/* Scoring category cards — only items applicable to the active mode, side by side on wider screens, stacked on mobile */}
{activeMode === 'batting' && !isBenchedCurrentInning && (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
    {/* Batting Lineup Spot Card */}
    <div className="bg-white dark:bg-[#252D38] rounded-md px-3.5 py-3 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-center gap-2 min-h-[48px]">
      {currentInningLineupSpot ? (
        <>
          <span className="text-[13px] font-semibold text-slate-800 dark:text-[#FAFAFA]"> Batting Lineup Spot</span>
          <div className="flex items-center justify-between gap-2 min-h-8">
            <span className="text-[13px] font-semibold text-slate-800 dark:text-[#FAFAFA]">
              #{currentInningLineupSpot} · {LINEUP_SPOTS.find((spot) => spot.spot === currentInningLineupSpot)?.label || 'Selected'}
            </span>
            <button
              type="button"
              onClick={() => setLineupSpotPromptOpen(true)}
              className="shrink-0 rounded-md border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#2D3643]"
            >
              Change
            </button>
          </div>
          </>
      ) : (
        <>
          <label htmlFor="batting-lineup-spot" className="block text-[13px] font-semibold text-slate-800 dark:text-[#FAFAFA]">
            Batting Lineup Spot
          </label>
          <ThemedDropdown<number>
            value={undefined}
            onChange={(value) => { if (value !== undefined) setLineupSpot(value); }}
            placeholder="Select batting lineup spot"
            ariaLabel="Batting lineup spot"
            allowClear={false}
            className="w-full"
            buttonClassName="h-10"
            options={LINEUP_SPOTS.map((spot) => ({
              value: spot.spot,
              label: `#${spot.spot} · ${spot.label}`,
            }))}
          />
        </>
      )}
    </div>


{/* Pitcher Hand Selector */}
<div className="bg-white dark:bg-[#252D38] rounded-md px-3.5 py-3 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-center gap-2 min-h-[48px]">
  <span className="text-[13px] font-semibold text-slate-800 dark:text-[#FAFAFA]">
    Pitcher
  </span>

  <div className="flex p-0.5 bg-slate-100 dark:bg-[#1A2028] rounded-md border border-slate-200 dark:border-[#354050]">
    {(
      [
        ['R', 'Right'],
        ['L', 'Left'],
      ] as const
    ).map(([hand, label]) => (
      <button
        key={hand}
        type="button"
        onClick={() => setPitcherHand(hand)}
        aria-pressed={pitcherHand === hand}
        className={`h-8 flex-1 rounded-md text-xs font-semibold transition-all ${
          pitcherHand === hand
            ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
            : 'text-slate-600 dark:text-[#D1D5DB]'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
</div>

{/* Enable Hit Location Switch */}
<div className="bg-white dark:bg-[#252D38] rounded-md px-3.5 py-3 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-center gap-2 min-h-[48px]">
  <span className="text-[13px] font-semibold text-slate-800 dark:text-[#FAFAFA]">
    Hit Location
  </span>

  <div className="flex items-center justify-between gap-2 min-h-8">
    <span className="text-xs font-medium text-slate-600 dark:text-[#D1D5DB]">
      Enable / Disable
    </span>

    <button
      type="button"
      role="switch"
      aria-label="Enable / Disable Hit Location"
      aria-checked={hitTapperEnabled}
      onClick={() => setHitTapperEnabled(!hitTapperEnabled)}
      className="cursor-pointer select-none shrink-0"
    >
      <span
        aria-hidden="true"
        className={`relative block w-10 h-6 rounded-full transition-colors ${
          hitTapperEnabled
            ? 'bg-[#00BFA5] dark:bg-[#00D7BC]'
            : 'bg-slate-300 dark:bg-[#465160]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            hitTapperEnabled ? 'translate-x-4' : ''
          }`}
        />
      </span>
    </button>
  </div>
</div>
  </div>
)}

{activeMode === 'fielding' && (
  <div className="grid grid-cols-1 text-xs">
    {/* Fielding Position Card */}
    <div className="bg-white dark:bg-[#252D38] rounded-lg px-3.5 py-3 border border-slate-200 dark:border-[#354050] shadow-sm space-y-2">
      <label htmlFor="fielding-position" className="block text-[13px] font-semibold text-slate-800 dark:text-[#FAFAFA]">
        Fielding Position
      </label>
      <ThemedDropdown<DefensivePosition>
        value={selectedInningPosition || undefined}
        ariaLabel="Fielding Position"
        placeholder="Select fielding position"
        className="w-full"
        buttonClassName="h-10"
        allowClear={false}
        options={DEFENSIVE_POSITIONS.map((position) => ({
          value: position.code,
          label: position.code === 'BENCH' ? 'Bench' : `${position.code} - ${position.label.split('(')[0].trim()}`,
        }))}
        onChange={(value) => {
          if (!value) return;
          const val = value;
          if (val === 'BENCH') {
            const existingPlaysInInning = liveGame.plays.filter((p) => p.inning === currentInning);
            if (existingPlaysInInning.length > 0) {
              setBenchConfirmInning(currentInning);
              return;
            }
            applyBenchForInning(currentInning);
          } else {
            const heldPosition = liveGame.fieldingPositions?.[currentInning];
            if (liveGame.benchInnings.includes(currentInning)) {
              setInningBench(currentInning, false);
              setInningPosition(currentInning, val);
              // Only exception to staying on Fielding: becoming the Pitcher opens the Pitching tab.
              if (val === 'P') setActiveMode('pitching');
            } else if (heldPosition && heldPosition !== 'BENCH' && heldPosition !== val) {
              setPendingPositionChange({ inning: currentInning, from: heldPosition, to: val });
            } else if (!heldPosition) {
              setInningPosition(currentInning, val);
              if (val === 'P') setActiveMode('pitching');
            }
          }
        }}
      />
    </div>
  </div>
)}

      

      {/* Sticky action bar (thumb zone, sits just above the bottom nav): the ONLY Undo / Plays / Save */}
      <div
        className="fixed inset-x-0 z-20 bg-[#F4F6F8]/95 dark:bg-[#101419]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#354050]"
        style={{ bottom: 'calc(4.2rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-2xl mx-auto px-3 py-2 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleUndoLastPlay}
            disabled={liveGame.plays.length === 0}
            aria-label="Undo last play"
            className={`h-12 px-2 rounded-md border text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              liveGame.plays.length === 0
                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#6B7280]'
                : 'border-slate-300 bg-white text-slate-700 shadow-2xs active:bg-slate-100 dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#D1D5DB]'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPlaysModalOpen(true)}
            className="h-12 px-2 rounded-md border border-slate-300 dark:border-[#354050] bg-white dark:bg-[#1A2028] text-slate-700 dark:text-[#D1D5DB] text-sm font-semibold flex items-center justify-center gap-1.5 shadow-2xs active:bg-slate-100 dark:active:bg-[#252D38] transition-colors cursor-pointer"
          >
            <span>Plays</span>
            <span className="min-w-5 h-5 px-1 rounded-full bg-slate-200 dark:bg-[#252D38] text-[13px] font-semibold inline-flex items-center justify-center">
              {liveGame.plays.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              const match = liveGame?.finalResult?.match(/(\d+)\s*[-\u2013]\s*(\d+)/);
              setTeamFinalScore(match ? match[1] : '');
              setOpponentFinalScore(match ? match[2] : '');
              setIsSaveModalOpen(true);
            }}
            className="h-12 px-2 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] active:bg-[#00A892] dark:active:bg-[#2D3643] text-[#18212D] dark:text-[#101419] text-sm font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isEditing ? 'Save edits' : 'Save game'}</span>
          </button>
          
        </div>
      </div>
      </>
      )}
      {isPlaysModalOpen && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={() => setIsPlaysModalOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="plays-modal-title"
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-[#354050] bg-[#F4F6F8] dark:bg-[#101419] shadow-2xl"
        >
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-[#354050] bg-white dark:bg-[#1A2028]">
            <h2 id="plays-modal-title" className="text-base font-semibold text-[#18212D] dark:text-[#FAFAFA]">Plays</h2>
            <button
              type="button"
              onClick={() => setIsPlaysModalOpen(false)}
              aria-label="Close plays"
              className="p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#18212D] dark:text-[#9CA3AF] dark:hover:bg-[#252D38] dark:hover:text-[#FAFAFA]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
      {/* Recent Plays Feed */}
      <div className="bg-white dark:bg-[#252D38] rounded-md p-4 sm:p-5 border border-slate-200/80 dark:border-[#354050] shadow-xs space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-xs text-slate-700 dark:text-[#D1D5DB]">
              Plays in This Game
            </span>
            <span className="px-2 py-0.5 rounded-full text-[13px] font-semibold bg-slate-100 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050]">
              {liveGame.plays.length}
            </span>

          </div>

        </div>

        {/* Filter Segmented Control: Batting / Pitching */}
        {liveGame.plays.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#252D38]/80 rounded-md border border-slate-200/80 dark:border-[#354050]">
            <button
              type="button"
              onClick={() => setPlayFeedFilter('batting')}
              className={`flex-1 min-w-[85px] py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                playFeedFilter === 'batting'
                  ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                  : 'text-slate-600 dark:text-[#9CA3AF] hover:text-[#18212D] dark:hover:text-[#D1D5DB]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Batting</span>
              <span className={`text-xs font-semibold ${playFeedFilter === 'batting' ? 'text-white/90' : 'text-slate-500'}`}>
                ({battingPlaysCount})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPlayFeedFilter('pitching')}
              className={`flex-1 min-w-[90px] py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                playFeedFilter === 'pitching'
                  ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                  : 'text-slate-600 dark:text-[#9CA3AF] hover:text-[#18212D] dark:hover:text-[#D1D5DB]'
              }`}
            >
              <CircleDot className="w-3.5 h-3.5" />
              <span>Pitching</span>
              <span className={`text-xs font-semibold ${playFeedFilter === 'pitching' ? 'text-white/90' : 'text-slate-500'}`}>
                ({pitchingPlaysCount})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPlayFeedFilter('fielding')}
              className={`flex-1 min-w-[90px] py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                playFeedFilter === 'fielding'
                  ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                  : 'text-slate-600 dark:text-[#9CA3AF] hover:text-[#18212D] dark:hover:text-[#D1D5DB]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Fielding</span>
              <span className={`text-xs font-semibold ${playFeedFilter === 'fielding' ? 'text-white/90' : 'text-slate-500'}`}>
                ({liveGame.plays.filter((p) => p.mode === 'fielding').length})
              </span>
            </button>

          </div>
        )}

        {/* Plays Rendering */}
        {liveGame.plays.length === 0 && liveGame.benchInnings.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 font-medium">
            No plays recorded yet. Tap any play button above to begin.
          </div>
        ) : (
          /* Plays for the selected tab, always all of them, split by inning */
          <div className="space-y-3">
            {/* Filter Mode Header Banner */}
            <div className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-md border border-slate-200/80 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38]/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border border-slate-200 dark:border-[#354050] bg-white dark:bg-[#354050]">
                  {playFeedFilter === 'batting' ? (
                    <Zap className="w-4 h-4 text-blue-500" />
                  ) : playFeedFilter === 'pitching' ? (
                    <CircleDot className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Shield className="w-4 h-4 text-blue-500" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-[#D1D5DB]">
                    {playFeedFilter === 'batting'
                      ? `All Batting Plays (${filteredPlays.length})`
                      : playFeedFilter === 'pitching'
                      ? `All Pitching Plays (${filteredPlays.length})`
                      : `All Fielding Plays (${filteredPlays.length})`}
                  </h4>
                  <p className="text-[13px] font-semibold text-slate-500 dark:text-[#9CA3AF]">
                    {(() => {
                      const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
                      if (playFeedFilter === 'batting') {
                        return [
                          `${n(batting.h, 'hit', 'hits')} in ${n(batting.ab, 'at-bat', 'at-bats')}`,
                          ...(batting.hr > 0 ? [n(batting.hr, 'home run', 'home runs')] : []),
                          ...(batting.rbi > 0 ? [n(batting.rbi, 'run batted in', 'runs batted in')] : []),
                          ...(batting.r > 0 ? [n(batting.r, 'run scored', 'runs scored')] : []),
                        ].join(' · ');
                      }
                      if (playFeedFilter === 'pitching') {
                        return [
                          `${pitching.ipDisplay} innings pitched`,
                          `${n(pitching.pitches, 'pitch', 'pitches')} (${n(pitching.strikes, 'strike', 'strikes')}, ${n(pitching.balls, 'ball', 'balls')})`,
                          n(pitching.k, 'strikeout', 'strikeouts'),
                        ].join(' · ');
                      }
                      return 'All defensive fielding plays';
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {/* All plays for this tab, newest first, with a divider between innings */}
            {renderPlaysWithInningDividers(filteredPlays)}
          </div>
        )}
        </div>

          <div className="shrink-0 p-3 border-t border-slate-200 dark:border-[#354050] bg-white dark:bg-[#1A2028] flex justify-end">
            <button
              type="button"
              onClick={() => setIsPlaysModalOpen(false)}
              className="px-5 py-2 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] text-sm font-semibold hover:bg-[#00A892] dark:hover:bg-[#00C4AB]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
      </div>
      )}

      {/* Confirmation Modals */}
      <PitcherOutModal
        isOpen={isPitcherOutModalOpen}
        onClose={() => setIsPitcherOutModalOpen(false)}
        onSelect={handlePitcherOutSelection}
      />

      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-game-score-title"
            className="w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#354050] dark:bg-[#1A2028]"
          >
            <h2 id="save-game-score-title" className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA]">
              {isEditing ? 'Update Final Score' : 'Enter Final Score'}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">
              The scores determine the game result recorded in Game History.
            </p>

            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-3">
              <label htmlFor="team-final-score" className="min-w-0 truncate text-sm font-semibold text-slate-700 dark:text-[#D1D5DB]">
                {liveGame.teamName || activeProfile.teamName || 'My Team'}
              </label>
              <input
                id="team-final-score"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={teamFinalScore}
                onChange={(event) => setTeamFinalScore(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-center text-lg font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#18212D] dark:focus:ring-[#00D7BC] dark:border-[#354050] dark:bg-[#252D38] dark:text-[#FAFAFA]"
                aria-label={`${liveGame.teamName || activeProfile.teamName || 'My Team'} final score`}
                autoFocus
              />
              <label htmlFor="opponent-final-score" className="min-w-0 truncate text-sm font-semibold text-slate-700 dark:text-[#D1D5DB]">
                {liveGame.opponent || 'Opponent'}
              </label>
              <input
                id="opponent-final-score"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={opponentFinalScore}
                onChange={(event) => setOpponentFinalScore(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-center text-lg font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#18212D] dark:focus:ring-[#00D7BC] dark:border-[#354050] dark:bg-[#252D38] dark:text-[#FAFAFA]"
                aria-label={`${liveGame.opponent || 'Opponent'} final score`}
              />
            </div>

            <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:bg-[#252D38] dark:text-[#D1D5DB]">
              {teamFinalScore.trim() !== '' && opponentFinalScore.trim() !== '' &&
              Number.isInteger(Number(teamFinalScore)) && Number.isInteger(Number(opponentFinalScore))
                ? `${Number(teamFinalScore) > Number(opponentFinalScore) ? 'Win' : Number(teamFinalScore) < Number(opponentFinalScore) ? 'Loss' : 'Draw'} · ${teamFinalScore}-${opponentFinalScore}`
                : 'Enter both final scores'}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#252D38]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGameWithScore}
                disabled={
                  teamFinalScore.trim() === '' ||
                  opponentFinalScore.trim() === '' ||
                  !Number.isInteger(Number(teamFinalScore)) ||
                  !Number.isInteger(Number(opponentFinalScore)) ||
                  Number(teamFinalScore) < 0 ||
                  Number(opponentFinalScore) < 0
                }
                className="rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] px-4 py-2.5 text-sm font-semibold text-[#18212D] dark:text-[#101419] shadow-md hover:bg-[#00A892] dark:hover:bg-[#00C4AB] disabled:cursor-not-allowed disabled:opacity-40 "
              >
                {isEditing ? 'Save Score & Changes' : 'Save Score & Game'}
              </button>
            </div>
          </section>
        </div>
      )}

      {lineupSpotPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="lineup-spot-prompt-title"
            className="w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#354050] dark:bg-[#1A2028]"
          >
            <h2 id="lineup-spot-prompt-title" className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA]">
              Select batting lineup spot
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">
              Choose the batter's position in the lineup before recording this play.
            </p>
            <div className="mt-4">
              <ThemedDropdown<number>
                value={currentInningLineupSpot}
                onChange={(value) => {
                  if (value === undefined) return;
                  setLineupSpot(value);
                  setLineupSpotPromptOpen(false);
                }}
                placeholder="Select batting lineup spot"
                ariaLabel="Batting lineup spot"
                allowClear={false}
                className="w-full"
                buttonClassName="h-11"
                options={LINEUP_SPOTS.map((spot) => ({
                  value: spot.spot,
                  label: `#${spot.spot} · ${spot.label}`,
                }))}
              />
            </div>
            <button
              type="button"
              onClick={() => setLineupSpotPromptOpen(false)}
              className="mt-4 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-[#9CA3AF] dark:hover:bg-[#252D38]"
            >
              Cancel
            </button>
          </section>
        </div>
      )}

      {pendingPositionChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white dark:bg-[#1A2028] rounded-md shadow-2xl border border-slate-200 dark:border-[#354050] p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="position-change-title"
          >
            <div className="flex items-start gap-2">
              <div className="p-3 rounded-md shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="position-change-title" className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA] leading-tight">
                  Change position in Inning {pendingPositionChange.inning}?
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-[#D1D5DB] leading-relaxed">
                  {activeProfile.playerName || 'The player'} is at <strong>{pendingPositionChange.from}</strong> and you picked{' '}
                  <strong>{pendingPositionChange.to}</strong>. How should this be recorded?
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  changeInningPosition(pendingPositionChange.inning, pendingPositionChange.to, 'record');
                  if (pendingPositionChange.to === 'P') setActiveMode('pitching');
                  setPendingPositionChange(null);
                }}
                className="w-full rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] px-4 py-3 text-left text-[#18212D] dark:text-[#101419] shadow-md active:scale-[0.99] transition-all cursor-pointer"
              >
                <span className="block text-sm font-semibold">Switched during the inning</span>
                <span className="block text-xs font-normal opacity-80">
                  Keeps {pendingPositionChange.from} for plays so far and uses {pendingPositionChange.to} from now on. Both positions get the inning.
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  changeInningPosition(pendingPositionChange.inning, pendingPositionChange.to, 'correct');
                  if (pendingPositionChange.to === 'P') setActiveMode('pitching');
                  setPendingPositionChange(null);
                }}
                className="w-full rounded-md border border-slate-300 dark:border-[#354050] px-4 py-3 text-left text-slate-800 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] active:scale-[0.99] transition-all cursor-pointer"
              >
                <span className="block text-sm font-semibold">I picked the wrong position</span>
                <span className="block text-xs font-normal opacity-80">
                  Replaces {pendingPositionChange.from} with {pendingPositionChange.to} for the whole inning, including plays already recorded.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPendingPositionChange(null)}
                className="w-full rounded-md px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {fieldingChain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white dark:bg-[#1A2028] rounded-md shadow-2xl border border-slate-200 dark:border-[#354050] p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="multi-out-play-title"
          >
            <div className="flex items-start gap-2">
              <div className="p-3 rounded-md shrink-0 bg-teal-100 text-[#00BFA5] dark:bg-[#00D7BC]/15 dark:text-[#00D7BC]">
                <Zap className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="multi-out-play-title" className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA] leading-tight">
                  {fieldingChain.playType === 'triplePlay' ? 'Triple Play' : 'Double Play'}: what did {activeProfile.playerName || 'the player'} do?
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-[#D1D5DB] leading-relaxed">
                  Select everything that applies.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              {(fieldingChain.playType === 'triplePlay' ? TRIPLE_PLAY_ACTIONS : DOUBLE_PLAY_ACTIONS).map((opt) => {
                const count = dpActions.filter((action) => action === opt.action).length;
                return (
                  <div
                    key={opt.action}
                    className={`w-full rounded-md border px-3 py-3 transition-all ${
                      count > 0
                        ? 'border-[#00BFA5] dark:border-[#00D7BC] bg-[#00BFA5]/10 dark:bg-[#00D7BC]/10'
                        : 'border-slate-300 dark:border-[#354050]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">{opt.title}</span>
                        <span className="block text-xs text-slate-600 dark:text-[#D1D5DB]">{opt.description}</span>
                        {count > 0 && (
                          <span className="mt-1 block text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC]">
                            Selected {count} {count === 1 ? 'time' : 'times'}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeDpAction(opt.action)}
                          disabled={count === 0}
                          aria-label={`Remove one: ${opt.title}`}
                          className="h-9 w-9 rounded-md border border-slate-300 dark:border-[#465160] text-lg font-semibold text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-bold tabular-nums text-slate-900 dark:text-[#FAFAFA]" aria-label={`${count} selected`}>
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={() => addDpAction(opt.action)}
                          disabled={dpActions.length >= maxMultiOutActions}
                          aria-label={`Add one: ${opt.title}`}
                          className="h-9 w-9 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] text-lg font-semibold hover:bg-[#00A892] dark:hover:bg-[#00C4AB] disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={handleConfirmDoublePlay}
                disabled={dpActions.length === 0}
                className="w-full rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] px-4 py-3 text-sm font-semibold text-[#18212D] dark:text-[#101419] shadow-md active:scale-[0.99] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={handleDismissFieldingChain}
                className="w-full rounded-md px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors cursor-pointer"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isAbandonResumeModalOpen}
        title={isEditing ? 'Discard Edits?' : 'Discard This Game?'}
        message={
          isEditing
            ? 'Are you sure you want to discard these edits? Your original saved game will remain unchanged.'
            : 'Are you sure you want to discard this game? All recorded plays and scoring progress from this session will be permanently deleted.'
        }
        confirmLabel={isEditing ? 'Yes, Discard Edits' : 'Yes, Discard Game'}
        cancelLabel={isEditing ? 'Keep Editing' : 'Keep Playing'}
        variant="danger"
        onConfirm={() => {
          setPendingHitPlay(null);
          pendingRunnerAfterHitRef.current = null;
          pendingRunnerPrimaryPlayIdRef.current = null;
          setRunnerSession(null);
          setRunnerHistory([]);
          setActiveRunnerChip(null);
          if (isEditing) {
            cancelEditing();
          } else {
            discardLiveGame();
            onGameClosed?.();
          }
          dismissResumePrompt();
          setIsAbandonResumeModalOpen(false);
        }}
        onCancel={() => setIsAbandonResumeModalOpen(false)}
      />

      <ConfirmationModal
        isOpen={isDiscardModalOpen}
        title={isEditing ? 'Cancel Editing?' : 'Discard This Game?'}
        message={
          isEditing
            ? 'Are you sure you want to cancel? Any changes made during this edit session will be lost and the saved game will remain unchanged.'
            : 'Are you sure you want to discard this live game? All recorded plays from this session will be permanently deleted.'
        }
        confirmLabel={isEditing ? 'Yes, Cancel Edit' : 'Yes, Discard'}
        variant="danger"
        onConfirm={() => {
          setNewGameFormError('');
          if (isEditing) {
            cancelEditing();
          } else {
            setPendingHitPlay(null);
            pendingRunnerAfterHitRef.current = null;
            pendingRunnerPrimaryPlayIdRef.current = null;
            setRunnerSession(null);
            setRunnerHistory([]);
            setActiveRunnerChip(null);
            discardLiveGame();
            onGameClosed?.();
          }
          setIsDiscardModalOpen(false);
        }}
        onCancel={() => setIsDiscardModalOpen(false)}
      />

      {/* Bench Play Clear Alert Modal matching app style */}
      <ConfirmationModal
        isOpen={benchConfirmInning !== null}
        title={`Clear Inning ${benchConfirmInning} Plays?`}
        message={`Changing Inning ${benchConfirmInning} to Bench / Rest will remove all ${
          benchConfirmInning !== null
            ? liveGame.plays.filter((p) => p.inning === benchConfirmInning).length
            : 0
        } play(s) recorded in this inning. Are you sure you want to proceed?`}
        confirmLabel="Clear Plays & Set Bench"
        variant="danger"
        onConfirm={() => {
          if (benchConfirmInning !== null) {
            applyBenchForInning(benchConfirmInning);
            setBenchConfirmInning(null);
          }
        }}
        onCancel={() => setBenchConfirmInning(null)}
      />

      {/* Edit Individual Play Modal */}
      {selectedPlayForEdit && (
        <EditPlayModal
          play={selectedPlayForEdit}
          maxInnings={liveGame.innings}
          allPlays={liveGame.plays}
          onSetRbis={setPlayRbis}
          onSave={(playId, inning, mode, code, lineupSpot, hitLocation, throwTo) =>
            editPlay(playId, inning, mode, code, lineupSpot, hitLocation, throwTo)
          }
          onDelete={handleDeletePlay}
          onMove={movePlay}
          moveWithinCategory={sameCategoryFeed}
          onInsertAfter={insertPlayAfter}
          canMoveEarlier={canMovePlay(selectedPlayForEdit.id, -1)}
          canMoveLater={canMovePlay(selectedPlayForEdit.id, 1)}
          onClose={() => setSelectedPlayForEdit(null)}
        />
      )}

      {/* Hit Location Modal (auto-prompt for base hits and selected batted-ball outs) */}
      {pendingHitPlay && (
        <HitLocationModal
          isOpen={Boolean(pendingHitPlay)}
          playCode={pendingHitPlay.code}
          initialLocation={
            liveGame.plays.find((p) => p.id === pendingHitPlay.playId)?.hitLocation
          }
          allowPlayChange={false}
          allowSkip={!hitTapperEnabled || !isHitPlay(pendingHitPlay.code)}
          showFieldViewToggle={!hitTapperEnabled}
          onSave={(loc, _code, rbiEarned) => {
            const runnerCode = pendingRunnerAfterHitRef.current;
            pendingRunnerAfterHitRef.current = null;
            updatePlayHitLocation(pendingHitPlay.playId, loc);
            if (isHitPlay(pendingHitPlay.code) && pendingHitPlay.code !== 'homeRun') {
              // Judge possible ROE only after the contact location has been saved. A home run cannot be scored as ROE.
              // Keep the existing play ID/location and defer RBI + runner workflow until the decision.
              setPendingRoeDecision({
                playId: pendingHitPlay.playId,
                originalCode: pendingHitPlay.code,
                runnerCode,
                rbiEarned,
              });
              setPendingHitPlay(null);
              setRoeDecisionModalOpen(true);
              return;
            }
            setPendingHitPlay(null);
            const outCompletion = pendingOutCompletionRef.current;
            pendingOutCompletionRef.current = null;
            if (outCompletion === 'thirdOut') handleThirdOut('batting');
            else if (outCompletion === 'nextBatter') playFlow.nextPlateAppearance();
            else if (runnerCode) startRunnerSession(runnerCode);
          }}
          onSkip={() => {
            const runnerCode = pendingRunnerAfterHitRef.current;
            pendingRunnerAfterHitRef.current = null;
            setPendingHitPlay(null);
            const outCompletion = pendingOutCompletionRef.current;
            pendingOutCompletionRef.current = null;
            if (outCompletion === 'thirdOut') handleThirdOut('batting');
            else if (outCompletion === 'nextBatter') playFlow.nextPlateAppearance();
            else if (runnerCode) startRunnerSession(runnerCode);
          }}
          onClose={() => {
            const runnerCode = pendingRunnerAfterHitRef.current;
            pendingRunnerAfterHitRef.current = null;
            setPendingHitPlay(null);
            const outCompletion = pendingOutCompletionRef.current;
            pendingOutCompletionRef.current = null;
            if (outCompletion === 'thirdOut') handleThirdOut('batting');
            else if (outCompletion === 'nextBatter') playFlow.nextPlateAppearance();
            else if (runnerCode) startRunnerSession(runnerCode);
          }}
        />
      )}

      {/* A hit is judged for a defensive error only after its location has been recorded. */}
      {roeDecisionModalOpen && pendingRoeDecision && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="roe-decision-title" className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#354050] bg-white dark:bg-[#1A2028] shadow-2xl p-5 space-y-4">
            <div>
              <h2 id="roe-decision-title" className="text-lg font-bold text-[#18212D] dark:text-[#FAFAFA]">Did a defensive error change the play?</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-[#D1D5DB]">Consider whether an average effort would have got the batter out. A fielder misplaying the ball does not automatically make this an error for the batter.</p>
            </div>
            <div className="grid gap-2">
              <button type="button" onClick={() => {
                recordHitRbis(pendingRoeDecision.originalCode, pendingRoeDecision.rbiEarned);
                const runnerCode = pendingRoeDecision.runnerCode;
                setRoeDecisionModalOpen(false);
                setPendingRoeDecision(null);
                if (runnerCode) startRunnerSession(runnerCode);
              }} className="w-full rounded-lg border border-slate-300 dark:border-[#354050] bg-white dark:bg-[#252D38] p-3 text-left hover:border-[#00BFA5] dark:hover:border-[#00D7BC] transition-colors">
                <span className="block font-semibold text-[#18212D] dark:text-[#FAFAFA]">No — keep the hit</span>
                <span className="mt-0.5 block text-xs text-slate-600 dark:text-[#D1D5DB]">The batter would likely have reached safely anyway.</span>
              </button>
              <button type="button" onClick={() => {
                setRoeDecisionModalOpen(false);
                setRoeModalOpen(true);
              }} className="w-full rounded-lg border border-slate-300 dark:border-[#354050] bg-white dark:bg-[#252D38] p-3 text-left hover:border-[#00BFA5] dark:hover:border-[#00D7BC] transition-colors">
                <span className="block font-semibold text-[#18212D] dark:text-[#FAFAFA]">Yes — score Reached on Error</span>
                <span className="mt-0.5 block text-xs text-slate-600 dark:text-[#D1D5DB]">Use only when the batter likely would have been out without the misplay.</span>
              </button>
              <button type="button" onClick={() => {
                setRoeDecisionMode('extraBases');
                setRoeDecisionModalOpen(false);
                setRoeModalOpen(true);
              }} className="w-full rounded-lg border border-slate-300 dark:border-[#354050] bg-white dark:bg-[#252D38] p-3 text-left hover:border-[#00BFA5] dark:hover:border-[#00D7BC] transition-colors">
                <span className="block font-semibold text-[#18212D] dark:text-[#FAFAFA]">Hit stands — error only allowed extra bases</span>
                <span className="mt-0.5 block text-xs text-slate-600 dark:text-[#D1D5DB]">Keep the hit, record the error detail, then handle the runner’s advancement.</span>
              </button>
            </div>
            <button type="button" onClick={() => {
              setRoeDecisionModalOpen(false);
              setPendingRoeDecision(null);
              recordHitRbis(pendingRoeDecision.originalCode, pendingRoeDecision.rbiEarned);
              if (pendingRoeDecision.runnerCode) startRunnerSession(pendingRoeDecision.runnerCode);
            }} className="w-full rounded-lg border border-slate-300 dark:border-[#354050] px-4 py-2.5 font-semibold text-[#18212D] dark:text-[#FAFAFA] hover:bg-slate-50 dark:hover:bg-[#252D38]">Keep hit for now (can correct later)</button>
          </div>
        </div>
      )}

      {roeModalOpen && pendingRoeDecision && (
        <div className="fixed inset-0 z-[111] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="roe-error-title" className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#354050] bg-white dark:bg-[#1A2028] shadow-2xl p-5 space-y-4">
            <div>
              <h2 id="roe-error-title" className="text-lg font-bold text-[#18212D] dark:text-[#FAFAFA]">What type of error?</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-[#D1D5DB]">{roeDecisionMode === 'roe' ? 'The hit location will be kept, but the play will count as ROE instead of a hit.' : 'The hit remains a hit. This records the defensive error detail without removing the hit from the batter’s stats.'}</p>
            </div>
            <div className="grid gap-2">
              {([
                ['fielding', 'Fielding error', 'The fielder mishandled or bobbled the ball'],
                ['throwing', 'Throwing error', 'An inaccurate throw allowed the batter to reach'],
                ['droppedCatch', 'Dropped catch', 'A catchable ball was dropped'],
                ['other', 'Other error', 'Another defensive misplay'],
              ] as const).map(([value, label, description]) => (
                <button key={value} type="button" onClick={() => {
                  const pending = pendingRoeDecision;
                  const isRoe = roeDecisionMode === 'roe';
                  updatePlayOutcome(pending.playId, isRoe ? 'reachedOnError' : pending.originalCode, value);
                  setRoeModalOpen(false);
                  setPendingRoeDecision(null);
                  // ROE means the batter-runner is credited with reaching first, not the selected hit base.
                  if (pending.runnerCode) startRunnerSession(isRoe ? 'single' : pending.runnerCode);
                }} className="w-full rounded-lg border border-slate-300 dark:border-[#354050] bg-white dark:bg-[#252D38] p-3 text-left hover:border-[#00BFA5] dark:hover:border-[#00D7BC] transition-colors">
                  <span className="block font-semibold text-[#18212D] dark:text-[#FAFAFA]">{label}</span>
                  <span className="mt-0.5 block text-xs text-slate-600 dark:text-[#D1D5DB]">{description}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => {
              setRoeModalOpen(false);
              setRoeDecisionMode('roe');
              setRoeDecisionModalOpen(true);
            }} className="w-full rounded-lg border border-slate-300 dark:border-[#354050] px-4 py-2.5 font-semibold text-[#18212D] dark:text-[#FAFAFA] hover:bg-slate-50 dark:hover:bg-[#252D38]">Back</button>
          </div>
        </div>
      )}

      {isNextBatterModalOpen && activeMode === 'pitching' && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="next-batter-title"
            aria-describedby="next-batter-description"
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 dark:border-[#354050] bg-white dark:bg-[#1A2028] shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="px-5 pt-6 pb-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-[#252D38]">
                <Zap className="h-6 w-6 text-[#246BFD] dark:text-[#3478FF]" />
              </div>
              <h3 id="next-batter-title" className="text-lg font-semibold text-[#18212D] dark:text-[#FAFAFA]">
                Next Batter Up
              </h3>
              <p id="next-batter-description" className="mt-2 text-sm text-slate-600 dark:text-[#D1D5DB]">
                Start the new batter's pitch count.
              </p>
            </div>
            <div className="border-t border-slate-200 dark:border-[#354050] p-4">
              <button
                type="button"
                onClick={() => {
                  playFlow.nextPitcherBatter();
                  setIsNextBatterModalOpen(false);
                }}
                className="w-full rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] px-4 py-3 text-sm font-semibold text-[#18212D] dark:text-[#101419] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] active:scale-[0.98] transition-all"
              >
                Start New Batter's Pitch Count
              </button>
            </div>
          </div>
        </div>
      )}

      {isFoulTapperOpen && (
        <HitLocationModal
          isOpen={isFoulTapperOpen}
          playCode="pitchFoul"
          allowPlayChange={false}
          onSave={(loc) => {
            addPlay('batting', 'pitchFoul', {
              lineupSpot: currentInningLineupSpot,
              hitLocation: loc,
              targetInning: viewedInning,
            });
            // A foul adds a strike only until the batter already has two strikes.
            setBatterStrikes((count) => Math.min(2, count + 1));
            setIsFoulTapperOpen(false);
          }}
          onSkip={() => setIsFoulTapperOpen(false)}
          onClose={() => setIsFoulTapperOpen(false)}
        />
      )}

      {/* Capture batted-ball location before entering the OUT resolution flow. */}
      {isOutLocationFirstOpen && (
        <HitLocationModal
          isOpen={isOutLocationFirstOpen}
          playCode="out"
          allowPlayChange={false}
          onSave={(loc) => {
            setIsOutLocationFirstOpen(false);
            pendingHitLocationRef.current = loc;
            handleScoringPlay('out');
          }}
          onSkip={() => {
            setIsOutLocationFirstOpen(false);
            skipOutLocationPromptRef.current = true;
            handleScoringPlay('out');
          }}
          onClose={() => {
            setIsOutLocationFirstOpen(false);
            skipOutLocationPromptRef.current = true;
            handleScoringPlay('out');
          }}
        />
      )}

      {/* Direct Hit Direction Tapper Modal (tap field first, then select play) */}
      {isDirectTapperOpen && (
        <HitLocationModal
          isOpen={isDirectTapperOpen}
          playCode="single"
          allowPlayChange={true}
          allowSkip={!hitTapperEnabled}
          showFieldViewToggle={!hitTapperEnabled}
          requirePlaySelection={true}
          requireTrajectorySelection={true}
          onSave={(loc, chosenCode, rbiEarned) => {
            setIsDirectTapperOpen(false);
            pendingHitLocationRef.current = loc;
            handleScoringPlay(chosenCode);
            recordHitRbis(chosenCode, rbiEarned);
          }}
          onSkip={() => setIsDirectTapperOpen(false)}
          onClose={() => setIsDirectTapperOpen(false)}
        />
      )}

      {isBatterStrikeoutModalOpen && (
        <ConfirmationModal
          isOpen={isBatterStrikeoutModalOpen}
          title="Third strike — what happened?"
          message="The batter may be safe at first on a dropped third strike because first base is unoccupied or there are two outs. Choose the result that happened."
          confirmLabel="Safe at 1st (D3S)"
          cancelLabel="Strikeout"
          onConfirm={() => recordBatterStrikeout(true)}
          onCancel={() => recordBatterStrikeout(false)}
        />
      )}

      {outResolutionOpen && (
        <ScoringValidationModal
          playerName={activeProfile.playerName || 'the batter'}
          initialOuts={getBattingOutCount(currentInning)}
          onConfirm={handleScoringResolution}
          onBatterRunnerInterference={() => {
            setOutResolutionOpen(false);
            skipOutLocationPromptRef.current = false;
            pendingHitLocationRef.current = null;
            addPlay('batting', 'out', {
              pitcherHand,
              lineupSpot: currentInningLineupSpot,
              outReason: 'batterRunnerInterference',
            });
            if (getBattingOutCount(currentInning) + 1 >= 3) {
              handleThirdOut('batting');
            } else {
              playFlow.nextPlateAppearance();
            }
          }}
          onCancel={() => {
            setOutResolutionOpen(false);
            skipOutLocationPromptRef.current = false;
            pendingHitLocationRef.current = null;
          }}
        />
      )}

      {runnerSession && (
        <RunnerLockdownModal
          playerName={activeProfile.playerName || 'Player'}
          jerseyNumber={activeProfile.jerseyNumber}
          state={runnerSession}
          historyCount={runnerHistory.length}
          inningOuts={getInningOutCount(currentInning)}
          onAdvance={handleRunnerAdvance}
          onOut={handleRunnerOut}
          onScore={handleRunnerScore}
          onWalkHbp={() => advanceTrackedRunnerForAward('walk')}
          onThirdOut={handleRunnerThirdOut}
          onUndo={handleUnifiedRunnerUndo}
          onHoldOnBase={handleHoldRunnerOnBase}
          onInjurySub={handleRunnerInjurySub}
        />
      )}

      {/* Live Game Spray Chart Modal */}
      {isGameSprayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-[#1A2028] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#354050] overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-spray-title"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#354050] flex items-center justify-between bg-slate-50 dark:bg-[#252D38]/60">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00BFA5] dark:bg-[#00D7BC]" />
                <h3 id="game-spray-title" className="font-semibold text-sm text-slate-900 dark:text-[#FAFAFA]">
                  Game Spray Chart
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGameSprayModalOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-[#D1D5DB]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              <SprayChart
                plays={liveGame.plays}
                heightClass="h-64 sm:h-72"
                showFilters={true}
                showStats={true}
                showLegend={true}
                title={`Plays in Game (${liveGame.opponent ? `vs ${liveGame.opponent}` : liveGame.date})`}
              />
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38]/60 flex justify-end">
              <button
                type="button"
                onClick={() => setIsGameSprayModalOpen(false)}
                className="px-5 py-2 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] text-xs font-semibold hover:bg-[#00A892] dark:hover:bg-[#00C4AB] "
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};