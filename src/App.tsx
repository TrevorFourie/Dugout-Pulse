import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import mobileSplashSrc from '../splash-source/splash-mobile.jpg';
import tabletSplashSrc from '../splash-source/splash-tablet.jpg';
import largeSplashSrc from '../splash-source/splash-large.jpg';
import { GameProvider, useGame } from './context/GameContext';
import { DashboardTab } from './components/DashboardTab';
import { StatsTab } from './components/StatsTab';
import { ScoreTab } from './components/ScoreTab';
import { GamesTab } from './components/GamesTab';
import { Navigation, TabId } from './components/Navigation';
import { HelpModal } from './components/HelpModal';
import { SettingsModal, SettingsSectionId } from './components/SettingsModal';
import { SetupScreen } from './components/SetupScreen';
import { PlayMode } from './types/baseball';
import { X, LayoutDashboard, UserRound, SlidersHorizontal, CalendarDays, ChevronDown, FileText, Settings2, PlayCircle, History, Users, Shield, Trophy, UsersRound, MapPin, Bell, ClipboardList, Palette, Database, UserCog, CalendarRange } from 'lucide-react';
import { exportStatsPdf } from './utils/pdfReport';
import defaultLogoSrc from './assets/dugout-pulse-logo.png?inline';
import { AppLogo } from './components/AppLogo';
import { checkGameNotificationPermission, syncStoredGameReminders } from './utils/gameNotifications';
import { NotificationBlockedModal } from './components/NotificationBlockedModal';
import { StartGamePicker } from './components/StartGamePicker';

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MainApp: React.FC = () => {
  const { isFirstTimeUser, setIsFirstTimeUser, dismissResumePrompt, resumePromptPending, liveGame, settings, isLoading, games, activeProfile } = useGame();

  // On Android the full-screen splash artwork is the native launch window
  // background, visible through the transparent WebView from the first frame, so
  // there is no web splash image to wait for.
  const isNativeLaunch = Capacitor.isNativePlatform();

  // Browser only: wait for the web splash image to load.
  const [splashArtworkReady, setSplashArtworkReady] = useState(isNativeLaunch);

  // Do not let a fast localStorage restore reduce the splash to a flash: keep it
  // on screen for at least 1.2 seconds. On Android the native artwork has been
  // visible since the page started loading, so count from navigation start
  // rather than from mount.
  const [minimumSplashTimeElapsed, setMinimumSplashTimeElapsed] = useState(false);

  useEffect(() => {
    const minimumDisplayMs = 1200;
    const remainingMs = isNativeLaunch
      ? Math.max(0, minimumDisplayMs - performance.now())
      : minimumDisplayMs;
    const minimumDisplay = window.setTimeout(() => {
      setMinimumSplashTimeElapsed(true);
    }, remainingMs);
    return () => window.clearTimeout(minimumDisplay);
  }, [isNativeLaunch]);

  // Preload the 3D field code (three.js chunk) while the splash is still showing, so
  // opening the 3D view later doesn't wait on "Loading 3D field…". SprayChart and
  // HitLocationModal lazy-load the same module, so this just warms it up.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void import('./components/HitField3D').catch(() => {});
    }, 300);
    return () => window.clearTimeout(timer);
  }, []);

  const markSplashArtworkReady = () => setSplashArtworkReady(true);

  const showSplash = isLoading || !splashArtworkReady || !minimumSplashTimeElapsed;

  // Make the page opaque again (index.html) in the same frame as the app's first
  // paint, so the app directly replaces the native splash artwork.
  useLayoutEffect(() => {
    if (!showSplash) document.documentElement.classList.remove('native-launch');
  }, [showSplash]);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  // A recovered in-progress game must be shown immediately on app startup.
  useEffect(() => {
    if (resumePromptPending && liveGame) {
      setScoreView('score');
      setActiveTab('score');
    }
  }, [resumePromptPending, liveGame]);
  const [scoreView, setScoreView] = useState<'score' | 'plays'>('score');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpInitialMode, setHelpInitialMode] = useState<PlayMode>('batting');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [expandedMenuGroup, setExpandedMenuGroup] = useState<'profile' | 'matches' | 'setup' | 'preferences' | null>(null);
  const [gamesView, setGamesView] = useState<'schedule' | 'past'>('past');
  const [isPdfBusy, setIsPdfBusy] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSectionId>('playerDetails');
  const [isManualSetupOpen, setIsManualSetupOpen] = useState(false);
  const [isStartGamePickerOpen, setIsStartGamePickerOpen] = useState(false);
  const [startGameDate, setStartGameDate] = useState(getLocalDate);
  const [showBlocked, setShowBlocked] = useState(false);
  const blockedDismissed = useRef(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const lastBackPressRef = useRef(0);
  type ScreenSnapshot = { tab: TabId; gamesView: 'schedule' | 'past'; settingsSection: SettingsSectionId };
  const screenHistoryRef = useRef<ScreenSnapshot[]>([]);
  const currentScreenRef = useRef<ScreenSnapshot>({
    tab: 'dashboard',
    gamesView: 'past',
    settingsSection: 'playerDetails',
  });
  const backStateRef = useRef({
    isSettingsMenuOpen,
    isStartGamePickerOpen,
    isHelpOpen,
    isManualSetupOpen,
    isSettingsOpen,
    showBlocked,
    activeTab,
  });
  backStateRef.current = {
    isSettingsMenuOpen,
    isStartGamePickerOpen,
    isHelpOpen,
    isManualSetupOpen,
    isSettingsOpen,
    showBlocked,
    activeTab,
  };

  const navigateBackToPreviousScreen = () => {
    const previous = screenHistoryRef.current.pop();
    if (!previous) return false;
    currentScreenRef.current = previous;
    setActiveTab(previous.tab);
    setGamesView(previous.gamesView);
    setSettingsInitialSection(previous.settingsSection);
    setIsSettingsOpen(previous.tab === 'settings');
    setShowExitPrompt(false);
    lastBackPressRef.current = 0;
    return true;
  };

  const handleAndroidBack = () => {
    const current = backStateRef.current;
    if (current.isSettingsMenuOpen) {
      setIsSettingsMenuOpen(false);
      return;
    }
    if (current.isStartGamePickerOpen) {
      setIsStartGamePickerOpen(false);
      return;
    }
    if (current.isHelpOpen) {
      setIsHelpOpen(false);
      return;
    }
    if (current.isManualSetupOpen) {
      setIsManualSetupOpen(false);
      return;
    }
    if (current.showBlocked) {
      blockedDismissed.current = true;
      setShowBlocked(false);
      return;
    }
    if (current.isSettingsOpen && current.activeTab === 'settings') {
      if (!navigateBackToPreviousScreen()) {
        setIsSettingsOpen(false);
        setActiveTab('dashboard');
      }
      return;
    }
    if (navigateBackToPreviousScreen()) return;

    const now = Date.now();
    if (now - lastBackPressRef.current < 2000) {
      setShowExitPrompt(false);
      void CapacitorApp.exitApp();
      return;
    }
    lastBackPressRef.current = now;
    setShowExitPrompt(true);
    window.setTimeout(() => setShowExitPrompt(false), 2000);
  };

  useEffect(() => {
    const current: ScreenSnapshot = { tab: activeTab, gamesView, settingsSection: settingsInitialSection };
    const previous = currentScreenRef.current;
    if (current.tab !== previous.tab || current.gamesView !== previous.gamesView || current.settingsSection !== previous.settingsSection) {
      screenHistoryRef.current.push(previous);
      currentScreenRef.current = current;
    }
  }, [activeTab, gamesView, settingsInitialSection]);

  const handleAndroidBackRef = useRef(handleAndroidBack);
  handleAndroidBackRef.current = handleAndroidBack;
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let cancelled = false;
    let listener: { remove: () => Promise<void> } | undefined;
    void CapacitorApp.addListener('backButton', () => handleAndroidBackRef.current()).then((handle) => {
      if (cancelled) void handle.remove();
      else listener = handle;
    }).catch(() => {
      // Keep the web app usable if the native back-button plugin is unavailable.
    });
    return () => {
      cancelled = true;
      if (listener) void listener.remove();
    };
  }, []);

  // If reminders are on but Android blocks notifications, ask once per app start.
  // When the user returns from system settings, re-check and close the prompt if fixed.
  useEffect(() => {
    if (settings.gameRemindersEnabled !== true) {
      setShowBlocked(false);
      return;
    }
    let disposed = false;
    const check = async () => {
      const ok = await checkGameNotificationPermission();
      if (disposed) return;
      if (ok) setShowBlocked(false);
      else if (!blockedDismissed.current) setShowBlocked(true);
    };
    void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [settings.gameRemindersEnabled]);

  // Android may remove scheduled alarms when exact-alarm access changes. Rebuild
  // reminders on launch and whenever the app returns to the foreground.
  useEffect(() => {
    const syncReminders = () => {
      void syncStoredGameReminders(settings.gameRemindersEnabled === true).catch(() => {
        // The Notifications settings panel shows status and a test button for recovery.
      });
    };
    syncReminders();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncReminders();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [settings.gameRemindersEnabled]);

  // Keep the complete app shell hidden until persisted data has loaded. Rendering
  // Navigation/dashboard first and replacing them after localStorage loads caused
  // visible startup movement and layout shifts on slower Android WebViews.
  if (showSplash) {
    // Android: render nothing, so the native splash artwork stays visible.
    if (isNativeLaunch) return null;
    return (
      <div
        className="fixed inset-0 h-full w-full overflow-hidden"
        style={{ backgroundColor: '#121923' }}
        aria-label="Loading Dugout Pulse"
      >
        <picture className="block h-full w-full">
          <source media="(min-width: 1024px) and (min-height: 600px)" srcSet={largeSplashSrc} />
          <source media="(min-width: 600px) and (min-height: 600px)" srcSet={tabletSplashSrc} />
          <img
            src={mobileSplashSrc}
            alt="Dugout Pulse"
            className="block h-full w-full object-cover landscape:object-contain"
            fetchPriority="high"
            decoding="sync"
            onLoad={markSplashArtworkReady}
            onError={markSplashArtworkReady}
            draggable={false}
          />
        </picture>
      </div>
    );
  }

  // The app hamburger opens only the sliding drawer. A settings page is opened only after selection.
  const handleOpenSettings = () => {
    setExpandedMenuGroup(null);
    setIsSettingsMenuOpen(true);
  };

  const handleSelectSettingsSection = (section: SettingsSectionId) => {
    setSettingsInitialSection(section);
    setIsSettingsMenuOpen(false);
    setIsSettingsOpen(true);
    setActiveTab('settings');
  };

  const handleStartGame = () => {
    if (liveGame) {
      setScoreView('score');
      setActiveTab('score');
      return;
    }
    setIsStartGamePickerOpen(true);
  };

  const handleLoadGameManually = () => {
    setIsStartGamePickerOpen(false);
    setScoreView('score');
    setActiveTab('score');
  };

  const handleOpenHelp = (mode?: PlayMode) => {
    if (mode) setHelpInitialMode(mode);
    setIsHelpOpen(true);
  };

  const handleExportReport = async () => {
    const playerGames = games.filter((game) => !game.playerId || game.playerId === activeProfile.id);
    if (isPdfBusy || playerGames.length === 0) return;
    setIsPdfBusy(true);
    try {
      await exportStatsPdf({
        games: playerGames,
        profile: activeProfile,
        inningsPerGame: settings.inningsPerGame,
        filterLabel: 'All games',
        logoDataUrl: activeProfile.logo || defaultLogoSrc,
      });
    } finally {
      setIsPdfBusy(false);
    }
    setIsSettingsMenuOpen(false);
  };

  return (
      <div className="h-full overflow-hidden flex flex-col bg-[#F4F6F8] dark:bg-[#101419] text-[#18212D] dark:text-[#FAFAFA]">
      <NotificationBlockedModal
        isOpen={showBlocked}
        onClose={() => {
          blockedDismissed.current = true;
          setShowBlocked(false);
        }}
      />
      <>
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'score') setScoreView('score');
          setActiveTab(tab);
        }}
        onOpenHelp={() => handleOpenHelp('batting')}
        onOpenSettings={handleOpenSettings}
      />

      <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
        {activeTab === 'settings' && (
          <SettingsModal
            isOpen={isSettingsOpen}
            initialSection={settingsInitialSection}
            onClose={() => {
              if (!navigateBackToPreviousScreen()) {
                setIsSettingsOpen(false);
                setActiveTab('dashboard');
              }
            }}
            onOpenSetupWizard={() => setIsManualSetupOpen(true)}
          />
        )}
        {activeTab === 'dashboard' && (
          <DashboardTab
            onNavigateToScore={handleStartGame}
            onNavigateToStats={() => setActiveTab('stats')}
            onOpenHelp={() => handleOpenHelp('batting')}
            onOpenSettings={() => handleOpenSettings()}
          />
        )}
        {activeTab === 'stats' && (
          <StatsTab
            onOpenHelp={() => handleOpenHelp('batting')}
            onOpenSettings={() => handleOpenSettings()}
          />
        )}
        <div
          className="flex-1 min-h-0 min-w-0 flex-col"
          style={{ display: activeTab === 'score' ? 'flex' : 'none' }}
          aria-hidden={activeTab !== 'score'}
        >
          <ScoreTab
            startGameDate={startGameDate}
            onStartGameDateChange={setStartGameDate}
            onOpenHelp={(mode) => handleOpenHelp(mode)}
            onOpenSettings={() => handleOpenSettings()}
            onGameClosed={() => { setScoreView('score'); setActiveTab('dashboard'); }}
            onCancelResume={() => { dismissResumePrompt(); setScoreView('score'); setActiveTab('dashboard'); }}
            view={scoreView}
            onChangeView={setScoreView}
          />
        </div>
        {activeTab === 'games' && (
          <GamesTab view={gamesView} onNavigateToScore={() => { setScoreView('score'); setActiveTab('score'); }} />
        )}
      </main>
      </>

      <div className={`fixed inset-0 z-50 ${isSettingsMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!isSettingsMenuOpen}>
        <button
          type="button"
          tabIndex={isSettingsMenuOpen ? 0 : -1}
          aria-label="Close navigation menu"
          onClick={() => setIsSettingsMenuOpen(false)}
          className={`absolute inset-0 bg-black/45 transition-opacity duration-300 ${isSettingsMenuOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside className={`absolute inset-y-0 left-0 z-10 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-[#F4F6F8] shadow-xl transition-transform duration-300 ease-out dark:border-[#354050] dark:bg-[#1A2028] ${isSettingsMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-label="Main navigation">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-[#354050]">
            <button type="button" onClick={() => { setIsSettingsMenuOpen(false); setIsSettingsOpen(false); setActiveTab('dashboard'); }} className="flex min-w-0 items-center gap-3 text-left" aria-label="Dugout Pulse dashboard">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-[#18212D] dark:border-[#354050] dark:bg-[#252D38]">
                <AppLogo variant="icon" className="h-full w-full object-contain" />
              </div>
              <span className="min-w-0">
                <span className="block text-sm font-semibold tracking-tight text-[#18212D] dark:text-[#FAFAFA]">DUGOUT PULSE</span>
                <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">Play for the love of it!</span>
              </span>
            </button>
            <button type="button" onClick={() => setIsSettingsMenuOpen(false)} aria-label="Close navigation menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]"><X className="h-5 w-5" /></button>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
            <button
              type="button"
              onClick={() => { setIsSettingsMenuOpen(false); setIsSettingsOpen(false); setActiveTab('dashboard'); }}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${activeTab === 'dashboard' ? 'border-[#00BFA5] bg-[#E6FBF8] dark:border-[#00D7BC] dark:bg-[#252D38]' : 'border-slate-200 bg-white hover:border-[#00BFA5] hover:bg-slate-50 dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]'}`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">Dashboard</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Your season at a glance</span></span>
            </button>

            <button type="button" onClick={() => setExpandedMenuGroup((current) => current === 'profile' ? null : 'profile')} aria-expanded={expandedMenuGroup === 'profile'} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-[#00BFA5] dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]">
              <UserRound className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">Player Profile</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Player details, profiles and report</span></span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expandedMenuGroup === 'profile' ? 'rotate-180' : ''}`} />
            </button>
            {expandedMenuGroup === 'profile' && (
              <div className="ml-2 flex flex-col gap-1.5 rounded-xl border border-[#00BFA5]/20 bg-[#E8F8F5] p-2 shadow-inner dark:border-[#00D7BC]/20 dark:bg-[#172A2B]">
                <button type="button" onClick={() => handleSelectSettingsSection('playerDetails')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><UserCog className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Player Name &amp; Primary Team</button>
                <button type="button" onClick={() => handleSelectSettingsSection('players')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Users className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Other Profiles</button>
                <button type="button" disabled={isPdfBusy || !games.some((game) => !game.playerId || game.playerId === activeProfile.id)} onClick={() => void handleExportReport()} title={games.some((game) => !game.playerId || game.playerId === activeProfile.id) ? 'Export player statistics as a PDF' : 'Save a game before creating a report'} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><FileText className="h-3.5 w-3.5" />{isPdfBusy ? 'Creating Report…' : 'Export Report'}</button>
              </div>
            )}

            <button type="button" onClick={() => setExpandedMenuGroup((current) => current === 'matches' ? null : 'matches')} aria-expanded={expandedMenuGroup === 'matches'} className="mt-1 flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-[#00BFA5] dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]">
              <CalendarRange className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">Matches</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Schedule, manage and review games</span></span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expandedMenuGroup === 'matches' ? 'rotate-180' : ''}`} />
            </button>
            {expandedMenuGroup === 'matches' && (
              <div className="ml-2 flex flex-col gap-1.5 rounded-xl border border-[#00BFA5]/20 bg-[#E8F8F5] p-2 shadow-inner dark:border-[#00D7BC]/20 dark:bg-[#172A2B]">
                <button type="button" onClick={() => { setIsSettingsMenuOpen(false); setIsSettingsOpen(false); setGamesView('schedule'); setActiveTab('games'); }} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47] ${activeTab === 'games' && gamesView === 'schedule' ? 'border-[#00BFA5] bg-[#E6FBF8] text-[#006B5E] dark:border-[#00D7BC] dark:bg-[#252D38] dark:text-[#FAFAFA]' : 'border-slate-200/80 bg-white text-slate-700 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB]'}`}>
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Schedule
                </button>
                <button type="button" onClick={() => { setIsSettingsMenuOpen(false); setIsSettingsOpen(false); handleStartGame(); }} className="flex w-full items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]">
                  <PlayCircle className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Manage Matches
                </button>
                <button type="button" onClick={() => { setIsSettingsMenuOpen(false); setIsSettingsOpen(false); setGamesView('past'); setActiveTab('games'); }} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47] ${activeTab === 'games' && gamesView === 'past' ? 'border-[#00BFA5] bg-[#E6FBF8] text-[#006B5E] dark:border-[#00D7BC] dark:bg-[#252D38] dark:text-[#FAFAFA]' : 'border-slate-200/80 bg-white text-slate-700 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB]'}`}>
                  <History className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Past Matches
                </button>
              </div>
            )}

            <button type="button" onClick={() => setExpandedMenuGroup((current) => current === 'setup' ? null : 'setup')} aria-expanded={expandedMenuGroup === 'setup'} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-[#00BFA5] dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]">
              <Settings2 className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">Setup &amp; Settings</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Teams, opponents, seasons and venues</span></span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expandedMenuGroup === 'setup' ? 'rotate-180' : ''}`} />
            </button>
            {expandedMenuGroup === 'setup' && (
              <div className="ml-2 flex flex-col gap-1.5 rounded-xl border border-[#00BFA5]/20 bg-[#E8F8F5] p-2 shadow-inner dark:border-[#00D7BC]/20 dark:bg-[#172A2B]">
                <button type="button" onClick={() => handleSelectSettingsSection('teams')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Users className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Teams (Player)</button>
                <button type="button" onClick={() => handleSelectSettingsSection('oppositionTeams')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Shield className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Opposition Teams</button>
                <button type="button" onClick={() => handleSelectSettingsSection('seasons')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]" ><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Seasons</button>
                <button type="button" onClick={() => handleSelectSettingsSection('tournaments')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Trophy className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Tournaments &amp; Leagues</button>
                <button type="button" onClick={() => handleSelectSettingsSection('ageGroups')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><UsersRound className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Age Groups</button>
                <button type="button" onClick={() => handleSelectSettingsSection('venue')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Venues</button>
              </div>
            )}

            <button type="button" onClick={() => setExpandedMenuGroup((current) => current === 'preferences' ? null : 'preferences')} aria-expanded={expandedMenuGroup === 'preferences'} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-[#00BFA5] dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">App Preferences</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Notifications, scoring, display and data</span></span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expandedMenuGroup === 'preferences' ? 'rotate-180' : ''}`} />
            </button>
            {expandedMenuGroup === 'preferences' && (
              <div className="ml-2 flex flex-col gap-1.5 rounded-xl border border-[#00BFA5]/20 bg-[#E8F8F5] p-2 shadow-inner dark:border-[#00D7BC]/20 dark:bg-[#172A2B]">
                <button type="button" onClick={() => handleSelectSettingsSection('notifications')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Bell className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Notifications</button>
                <button type="button" onClick={() => handleSelectSettingsSection('scoring')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><ClipboardList className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Scoring Settings</button>
                <button type="button" onClick={() => handleSelectSettingsSection('displayTheme')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Palette className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Theme</button>
                <button type="button" onClick={() => handleSelectSettingsSection('data')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Database className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Data &amp; About</button>
              </div>
            )}

          </nav>

          <div className="shrink-0 border-t border-slate-200 px-4 py-3 text-center dark:border-[#354050]">
            <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF]">© 2026 Dugout Pulse. All rights reserved.</p>
            <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF] opacity-75">Offline Scorekeeper • Build {__BUILD_ID__}</p>
          </div>
        </aside>
      </div>

      {isStartGamePickerOpen && (
        <StartGamePicker
          gameDate={startGameDate}
          onClose={() => setIsStartGamePickerOpen(false)}
          onLoadManually={handleLoadGameManually}
          onGameSelected={() => {
            setScoreView('score');
            setActiveTab('score');
          }}
        />
      )}

      {showExitPrompt && (
        <div role="status" className="fixed bottom-20 left-1/2 z-[70] -translate-x-1/2 rounded-xl bg-[#18212D] px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-[#252D38]">
          Press back again to exit
        </div>
      )}

      <HelpModal
        isOpen={isHelpOpen}
        initialMode={helpInitialMode}
        onClose={() => setIsHelpOpen(false)}
      />

      {(isFirstTimeUser || isManualSetupOpen) && (
        <SetupScreen
          onComplete={() => {
            setIsManualSetupOpen(false);
            setIsFirstTimeUser(false);
            setActiveTab('score');
          }}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <GameProvider>
      <MainApp />
    </GameProvider>
  );
}