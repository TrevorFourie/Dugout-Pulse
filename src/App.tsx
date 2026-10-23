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
import { BackupReminderBanner } from './components/BackupReminderBanner';
import { SetupScreen } from './components/SetupScreen';
import { PlayMode } from './types/baseball';
import { exportStatsPdf } from './utils/pdfReport';
import defaultLogoSrc from './assets/dugout-pulse-logo.png?inline';
import { checkGameNotificationPermission, syncStoredGameReminders } from './utils/gameNotifications';
import { NotificationBlockedModal } from './components/NotificationBlockedModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { StartGamePicker } from './components/StartGamePicker';
import { SettingsNavigationDrawer } from './components/SettingsNavigationDrawer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getRecoverySnapshotInfo, restoreRecoverySnapshot } from './context/gameStorageSafety';

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MainApp: React.FC = () => {
  const { isFirstTimeUser, setIsFirstTimeUser, dismissResumePrompt, resumePromptPending, liveGame, settings, isLoading, restoreFailed, games, activeProfile } = useGame();
  const recoverySnapshot = getRecoverySnapshotInfo();
  const [isRecoveryConfirmOpen, setIsRecoveryConfirmOpen] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

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
  const [restoreResult, setRestoreResult] = useState<{ message: string; partial: boolean } | null>(null);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [expandedMenuGroup, setExpandedMenuGroup] = useState<'profile' | 'matches' | 'setup' | 'preferences' | 'legal' | null>(null);
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
    // Notification synchronization writes reminder metadata to localStorage. Do not
    // mutate any storage while the main restore has been flagged as unsafe.
    if (restoreFailed) return;
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
  }, [settings.gameRemindersEnabled, restoreFailed]);

  // A data reset flips isFirstTimeUser back to true: leave Settings so the setup screen is what the user sees.
  useEffect(() => {
    if (!isFirstTimeUser) return;
    setIsSettingsOpen(false);
    setIsSettingsMenuOpen(false);
    setActiveTab('dashboard');
  }, [isFirstTimeUser]);

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

  // After a successful restore, leave Settings, land on the dashboard and confirm with a modal.
  const handleRestoreComplete = (message: string, partial: boolean) => {
    setIsSettingsOpen(false);
    setIsSettingsMenuOpen(false);
    setActiveTab('dashboard');
    setRestoreResult({ message, partial });
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
      {restoreFailed && (
        <div
          role="alert"
          className="shrink-0 border-b border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <strong>Saved data needs recovery.</strong> Automatic saving is paused to protect existing browser data. Do not reset app data or clear browser storage.
          {recoverySnapshot.available && recoverySnapshot.hasMeaningfulData ? (
            <div className="mt-2 flex flex-col items-start gap-2">
              <p className="text-xs">
                A local recovery snapshot from {recoverySnapshot.createdAt ? new Date(recoverySnapshot.createdAt).toLocaleString() : 'an earlier session'} contains {recoverySnapshot.gameCount} saved game(s), {recoverySnapshot.profileCount} non-empty profile(s), and {recoverySnapshot.upcomingGameCount} upcoming fixture(s).
              </p>
              <button
                type="button"
                className="rounded-lg border border-amber-700/40 px-3 py-2 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40"
                onClick={() => {
                  setRecoveryError(null);
                  setIsRecoveryConfirmOpen(true);
                }}
              >
                Restore local recovery snapshot
              </button>
              {recoveryError && (
                <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
                  {recoveryError}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs">
              {recoverySnapshot.available
                ? 'A local snapshot exists, but it does not contain a non-empty saved game, player/team profile, or upcoming-fixture list.'
                : 'No usable local recovery snapshot is available.'}
            </p>
          )}
        </div>
      )}
      <ConfirmationModal
        isOpen={isRecoveryConfirmOpen}
        title="Restore saved data?"
        message="The app will restore the local recovery snapshot. Your current browser data will first be retained in a separate recovery copy. The app will reload after restoration so the recovered data can be loaded cleanly."
        confirmLabel="Restore snapshot"
        cancelLabel="Cancel"
        variant="warning"
        onCancel={() => setIsRecoveryConfirmOpen(false)}
        onConfirm={() => {
          setIsRecoveryConfirmOpen(false);
          const restored = restoreRecoverySnapshot();
          if (restored) {
            window.location.reload();
          } else {
            setRecoveryError('The recovery snapshot could not be fully restored. Recovery copies were retained. Do not clear browser storage; the app has not reloaded.');
          }
        }}
      />
      <ConfirmationModal
        isOpen={restoreResult !== null}
        title={restoreResult?.partial ? 'Restore completed with a warning' : 'Restore successful'}
        message={restoreResult?.message ?? ''}
        confirmLabel="OK"
        showCancelButton={false}
        variant={restoreResult?.partial ? 'warning' : 'success'}
        onCancel={() => setRestoreResult(null)}
        onConfirm={() => setRestoreResult(null)}
      />
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
        {activeTab !== 'settings' && (
          <BackupReminderBanner
            hasData={games.length > 0}
            suppressed={Boolean(liveGame) || isFirstTimeUser}
            onBackUp={() => handleSelectSettingsSection('data')}
          />
        )}
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
            onRestoreComplete={handleRestoreComplete}
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

      <SettingsNavigationDrawer
        isSettingsMenuOpen={isSettingsMenuOpen}
        setIsSettingsMenuOpen={setIsSettingsMenuOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        expandedMenuGroup={expandedMenuGroup}
        setExpandedMenuGroup={setExpandedMenuGroup}
        handleSelectSettingsSection={handleSelectSettingsSection}
        gamesView={gamesView}
        setGamesView={setGamesView}
        handleStartGame={handleStartGame}
        isPdfBusy={isPdfBusy}
        handleExportReport={handleExportReport}
        games={games}
        activeProfile={activeProfile}
      />

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

      {((isFirstTimeUser || isManualSetupOpen) && !restoreFailed) && (
        <SetupScreen
          onRestoreComplete={(message, partial) => {
            setIsManualSetupOpen(false);
            setIsFirstTimeUser(false);
            handleRestoreComplete(message, partial);
          }}
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
    <ErrorBoundary>
      <GameProvider>
        <MainApp />
      </GameProvider>
    </ErrorBoundary>
  );
}