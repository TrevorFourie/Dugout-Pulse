const STORAGE_KEY = 'dugoutPulse.diagnostics.v1';
const MAX_EVENTS = 40;
const MAX_STORAGE_CHARS = 48_000;

declare const __BUILD_ID__: string;

export interface DiagnosticEvent {
  id: string;
  time: string;
  category: string;
  errorType?: string;
  errorMessage?: string;
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

const ALLOWED_CATEGORIES = new Set([
  'window_error',
  'unhandled_rejection',
  'app_startup',
  'react_render',
  'storage_load',
  'storage_write_opposition_teams',
  'native_text_export',
  'browser_text_export',
  'native_binary_export',
  'browser_binary_export',
  'native_text_share',
]);

const ALLOWED_ERROR_TYPES = new Set([
  'Error', 'TypeError', 'SyntaxError', 'RangeError', 'ReferenceError',
  'URIError', 'EvalError', 'QuotaExceededError', 'SecurityError',
  'AbortError', 'NotFoundError', 'NetworkError', 'InvalidStateError',
  'DataError', 'OperationError', 'TimeoutError', 'UnknownError', 'NullError',
]);

function safeCategory(value: string): string {
  // Only allow code-defined labels, never user-entered text from storage.
  const category = value.toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 48);
  return ALLOWED_CATEGORIES.has(category) ? category : 'unknown';
}

function safeErrorType(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string') {
    return ALLOWED_ERROR_TYPES.has(error.name) ? error.name : 'Error';
  }
  return error === null ? 'NullError' : `${typeof error}Rejection`.slice(0, 40);
}

function safeErrorMessage(error: unknown): string | undefined {
  let message = '';
  if (error instanceof Error) message = error.message;
  else if (typeof error === 'string') message = error;
  else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') message = error.message;
  if (!message) return undefined;

  // Preserve actionable details while stripping query strings, full paths, and likely personal data.
  message = message
    .replace(/https?:\/\/[^\s)]+/gi, (url) => {
      try {
        const parsed = new URL(url);
        return parsed.origin + '/' + parsed.pathname.split('/').slice(-2).join('/');
      } catch {
        return '[url]';
      }
    })
    .replace(/(?:[A-Z]:)?[\\/](?:[^\s:'"<>]+[\\/])+([^\s\\/'"<>]+\.(?:tsx?|jsx?|mjs|cjs|json))/gi, '$1')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b(?:token|password|authorization)\s*[:=]\s*[^\s,;]+/gi, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
  return message || undefined;
}

function safeStackFrames(error: unknown): string[] {
  if (!error || typeof error !== 'object' || !('stack' in error) || typeof error.stack !== 'string') return [];
  return error.stack
    .split('\n')
    .slice(1, 16)
    .map((line) => {
      // Vite stack locations may contain URL paths and ?t= query strings before line:column.
      const match = line.match(/([^/\\()\s?#]+\.(?:tsx?|jsx?|mjs|cjs))(?:\?[^:\s)]*)?:(\d+):(\d+)/i);
      if (!match) return '';
      const file = match[1].split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9_.-]/g, '') || 'source';
      return `${file}:${match[2]}:${match[3]}`;
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
    return parsed
      .filter((item): item is DiagnosticEvent =>
        Boolean(item && typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.time === 'string' &&
          typeof item.category === 'string' &&
          ['Android', 'iOS', 'Web'].includes(item.platform)),
      )
      .slice(-MAX_EVENTS)
      // Rebuild each event from an allowlist. Never export arbitrary extra localStorage fields.
      .map((item) => {
        const validTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(item.time);
        const cleanFrames = Array.isArray(item.frames)
          ? item.frames
              .filter((frame): frame is string =>
                typeof frame === 'string' &&
                /^[a-zA-Z0-9_.-]+\.(?:tsx?|jsx?|mjs|cjs):\d{1,6}:\d{1,6}$/.test(frame),
              )
              .slice(0, 8)
          : undefined;
        const cleanType = typeof item.errorType === 'string' &&
          (ALLOWED_ERROR_TYPES.has(item.errorType) || /^(?:string|number|boolean|undefined|object|function|symbol|bigint)Rejection$/.test(item.errorType))
          ? item.errorType
          : undefined;
        return {
          id: /^DP-[A-Z2-9]{6}$/.test(item.id) ? item.id : createReference(),
          time: validTime ? item.time : 'unknown',
          category: safeCategory(item.category),
          ...(cleanType ? { errorType: cleanType } : {}),
          ...(typeof item.errorMessage === 'string' && item.errorMessage.length
            ? { errorMessage: item.errorMessage.replace(/[^\x20-\x7E]/g, ' ').slice(0, 240) }
            : {}),
          ...(cleanFrames?.length ? { frames: cleanFrames } : {}),
          platform: item.platform,
          build: typeof item.build === 'string' ? item.build.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 32) : 'unknown',
        };
      });
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
    errorMessage: safeErrorMessage(error),
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

export function createDiagnosticReport(reference?: string): string {
  const events = readEvents();
  // Crash screens should show only the error that triggered this boundary.
  // Other callers can omit the reference to retain the full offline log export.
  const reportEvents = reference
    ? events.filter((event) => event.id === reference && event.build === getBuild())
    : events;
  return JSON.stringify({
    reportFormat: 2,
    app: 'Dugout Pulse',
    appVersion: '1.0.0',
    build: getBuild(),
    platform: getPlatform(),
    privacy: 'Offline report. No name, account ID, game data, player/team names, full user-agent, network address, or full file path is intentionally collected. Error messages are sanitised and truncated; review before sharing. Times are rounded to 15 minutes. Review before sharing.',
    events: reportEvents,
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
