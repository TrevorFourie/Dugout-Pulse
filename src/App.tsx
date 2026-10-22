import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
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
import { X, LayoutDashboard, UserRound, SlidersHorizontal, CalendarDays, ChevronDown, FileText, Settings2 } from 'lucide-react';
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
  const [expandedMenuGroup, setExpandedMenuGroup] = useState<'profile' | 'setup' | 'preferences' | null>(null);
  const [isPdfBusy, setIsPdfBusy] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSectionId>('playerDetails');
  const [isManualSetupOpen, setIsManualSetupOpen] = useState(false);
  const [isStartGamePickerOpen, setIsStartGamePickerOpen] = useState(false);
  const [startGameDate, setStartGameDate] = useState(getLocalDate);
  const [showBlocked, setShowBlocked] = useState(false);
  const blockedDismissed = useRef(false);

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
  const handleOpenSettings = () => setIsSettingsMenuOpen(true);

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
              setIsSettingsOpen(false);
              setActiveTab('dashboard');
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
          <GamesTab onNavigateToScore={() => { setScoreView('score'); setActiveTab('score'); }} />
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
              <div className="ml-3 flex flex-col gap-1 border-l-2 border-[#00BFA5]/40 pl-3 dark:border-[#00D7BC]/40">
                <button type="button" onClick={() => handleSelectSettingsSection('playerDetails')} className="rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">Player Name &amp; Primary Team</button>
                <button type="button" onClick={() => handleSelectSettingsSection('players')} className="rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">Other Profiles</button>
                <button type="button" disabled={isPdfBusy || !games.some((game) => !game.playerId || game.playerId === activeProfile.id)} onClick={() => void handleExportReport()} title={games.some((game) => !game.playerId || game.playerId === activeProfile.id) ? 'Export player statistics as a PDF' : 'Save a game before creating a report'} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]"><FileText className="h-3.5 w-3.5" />{isPdfBusy ? 'Creating Report…' : 'Export Report'}</button>
              </div>
            )}

            <button type="button" onClick={() => { setIsSettingsMenuOpen(false); setIsSettingsOpen(false); setActiveTab('games'); }} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${activeTab === 'games' ? 'border-[#00BFA5] bg-[#E6FBF8] dark:border-[#00D7BC] dark:bg-[#252D38]' : 'border-slate-200 bg-white hover:border-[#00BFA5] hover:bg-slate-50 dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]'}`}>
              <CalendarDays className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">Matches / Schedule</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Manage upcoming matches and game history</span></span>
            </button>

            <button type="button" onClick={() => setExpandedMenuGroup((current) => current === 'setup' ? null : 'setup')} aria-expanded={expandedMenuGroup === 'setup'} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-[#00BFA5] dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]">
              <Settings2 className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">Setup &amp; Settings</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Teams, opponents, seasons and venues</span></span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expandedMenuGroup === 'setup' ? 'rotate-180' : ''}`} />
            </button>
            {expandedMenuGroup === 'setup' && (
              <div className="ml-3 flex flex-col gap-1 border-l-2 border-[#00BFA5]/40 pl-3 dark:border-[#00D7BC]/40">
                <button type="button" onClick={() => handleSelectSettingsSection('teams')} className="rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">Teams (Player)</button>
                <button type="button" onClick={() => handleSelectSettingsSection('oppositionTeams')} className="rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">Opposition Teams</button>
                <button type="button" onClick={() => handleSelectSettingsSection('teamLists')} className="rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">Seasons, Tournaments &amp; Age Groups</button>
                <button type="button" onClick={() => handleSelectSettingsSection('venue')} className="rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">Venues</button>
              </div>
            )}

            <button type="button" onClick={() => setExpandedMenuGroup((current) => current === 'preferences' ? null : 'preferences')} aria-expanded={expandedMenuGroup === 'preferences'} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-[#00BFA5] dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">App Preferences</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Notifications, scoring, display and data</span></span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expandedMenuGroup === 'preferences' ? 'rotate-180' : ''}`} />
            </button>
            {expandedMenuGroup === 'preferences' && (
              <div className="ml-3 flex flex-col gap-1 border-l-2 border-[#00BFA5]/40 pl-3 dark:border-[#00D7BC]/40">
                <button type="button" onClick={() => handleSelectSettingsSection('notifications')} className="rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">Notifications</button>
                <button type="button" onClick={() => handleSelectSettingsSection('scoring')} className="rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">Scoring Settings</button>
                <button type="button" onClick={() => handleSelectSettingsSection('displayTheme')} className="rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">Display</button>
                <button type="button" onClick={() => handleSelectSettingsSection('data')} className="rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">Data &amp; About</button>
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