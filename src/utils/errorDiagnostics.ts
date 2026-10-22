const STORAGE_KEY = 'dugoutPulse.diagnostics.v1';
const MAX_EVENTS = 40;
const MAX_STORAGE_CHARS = 48_000;

declare const __BUILD_ID__: string;

export interface DiagnosticEvent {
  id: string;
  time: string;
  category: string;
  errorType?: string;
  frames?: string[];
  platform: 'Android' | 'iOS' | 'Web';
  build: string;
}

function createReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = '';
  try {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) value += alphabet[byte % alphabet.length];
  } catch {
    for (let i = 0; i < 6; i++) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `DP-${value}`;
}

function getPlatform(): DiagnosticEvent['platform'] {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/Android/i.test(agent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(agent)) return 'iOS';
  return 'Web';
}

function getBuild(): string {
  try {
    return typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'unknown';
  } catch {
    return 'unknown';
  }
}

function safeCategory(value: string): string {
  // Categories must be fixed technical labels, never user-entered text.
  return value.toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 48) || 'unknown';
}

function safeErrorType(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string') {
    const name = error.name.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40);
    return name || 'Error';
  }
  return error === null ? 'NullError' : `${typeof error}Rejection`.slice(0, 40);
}

function safeStackFrames(error: unknown): string[] {
  if (!error || typeof error !== 'object' || !('stack' in error) || typeof error.stack !== 'string') return [];
  return error.stack
    .split('\n')
    .slice(1, 13)
    .map((line) => {
      // Keep only a function label and source basename/line/column. Never retain full
      // local paths, URLs, query strings, or the exception message (which may contain data).
      const location = line.match(/([^/\\()?#]+\.(?:tsx?|jsx?|mjs|cjs):\d+:\d+)\)?\s*$/i)?.[1];
      if (!location) return '';
      const match = location.match(/^(.+?\.(?:tsx?|jsx?|mjs|cjs)):(\d+):(\d+)$/i);
      if (!match) return '';
      const file = match[1].split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9_.-]/g, '') || 'source';
      const functionMatch = line.match(/^\s*at\s+([^ (]+)(?:\s+\(|$)/);
      const rawFunctionName = functionMatch?.[1] || '';
      const functionName = /^(?:https?|file|capacitor):/i.test(rawFunctionName)
        ? ''
        : rawFunctionName.replace(/[^a-zA-Z0-9_.$<>-]/g, '').slice(0, 60);
      return `${functionName ? functionName + ' ' : ''}${file}:${match[2]}:${match[3]}`;
    })
    .filter(Boolean)
    .slice(0, 8);
}

function readEvents(): DiagnosticEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is DiagnosticEvent =>
      Boolean(item && typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.time === 'string' &&
        typeof item.category === 'string' &&
        ['Android', 'iOS', 'Web'].includes(item.platform)),
    ).slice(-MAX_EVENTS);
  } catch {
    return [];
  }
}

function persist(event: DiagnosticEvent): void {
  try {
    const events = [...readEvents(), event].slice(-MAX_EVENTS);
    let serialized = JSON.stringify(events);
    while (serialized.length > MAX_STORAGE_CHARS && events.length > 1) {
      events.shift();
      serialized = JSON.stringify(events);
    }
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Diagnostics must never interrupt the app, especially when storage is full/unavailable.
  }
}

/** Record only a fixed operation label, error class and sanitised source locations. */
export function recordDiagnosticError(category: string, error: unknown): string {
  const event: DiagnosticEvent = {
    id: createReference(),
    // Rounded to 15 minutes to reduce precision while still helping correlate reports.
    time: new Date(Math.round(Date.now() / 900_000) * 900_000).toISOString(),
    category: safeCategory(category),
    errorType: safeErrorType(error),
    frames: safeStackFrames(error),
    platform: getPlatform(),
    build: getBuild(),
  };
  persist(event);
  return event.id;
}

export function recordDiagnosticEvent(category: string): void {
  persist({
    id: createReference(),
    time: new Date(Math.round(Date.now() / 900_000) * 900_000).toISOString(),
    category: safeCategory(category),
    platform: getPlatform(),
    build: getBuild(),
  });
}

export function getDiagnosticEvents(): DiagnosticEvent[] {
  return readEvents();
}

export function clearDiagnosticLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The user can still continue using the app if browser storage is unavailable.
  }
}

/** Clear app/game storage while keeping diagnostics separate from game data. */
export function clearAppDataPreservingDiagnostics(): void {
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key && key !== STORAGE_KEY) localStorage.removeItem(key);
    }
  } catch {
    // Reset is best-effort if the browser blocks local storage operations.
  }
}

export function createDiagnosticReport(): string {
  return JSON.stringify({
    reportFormat: 1,
    app: 'Dugout Pulse',
    appVersion: '1.0.0',
    build: getBuild(),
    platform: getPlatform(),
    privacy: 'Offline report. No name, account ID, game data, player/team names, full user-agent, network address, or full file path is intentionally collected. Times are rounded to 15 minutes. Review before sharing.',
    events: readEvents(),
  }, null, 2);
}

/** Install once at bootstrap, before React or the rest of the app is loaded. */
export function installGlobalDiagnosticHandlers(): void {
  if (typeof window === 'undefined') return;
  const marker = '__dugoutPulseDiagnosticsInstalled';
  const target = window as Window & { __dugoutPulseDiagnosticsInstalled?: boolean };
  if (target[marker]) return;
  target[marker] = true;

  window.addEventListener('error', (event) => {
    recordDiagnosticError('window_error', event.error ?? new Error('WindowError'));
  });
  window.addEventListener('unhandledrejection', (event) => {
    recordDiagnosticError('unhandled_rejection', event.reason);
  });
}
