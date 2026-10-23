const STORAGE_KEY = 'dugoutPulse.diagnostics.v1';
const MAX_EVENTS = 40;
const MAX_STORAGE_CHARS = 48_000;
// The diagnostic report must show the TRUE error, so keep enough of it to be useful.
const MAX_MESSAGE_CHARS = 400;
const MAX_DETAIL_CHARS = 2400;
let lastReference = '';
let lastRecordedAt = 0;
let pendingReactHookDiagnostic: { time: number; details: string } | undefined;

declare const __BUILD_ID__: string;

export interface DiagnosticEvent {
  id: string;
  time: string;
  category: string;
  errorType?: string;
  errorMessage?: string;
  userMessage?: string;
  frames?: string[];
  details?: string;
  platform: 'Android' | 'iOS' | 'Web';
  build: string;
}

/** Plain-language user guidance; technical details stay in the opt-in report. */
export function friendlyErrorMessage(category: string): string {
  switch (safeCategory(category)) {
    case 'app_startup':
      return "Dugout Pulse couldn't start correctly. Don't reinstall or clear app data. Open recovery tools if needed, and share the diagnostic report.";
    case 'react_render':
      return "Dugout Pulse encountered a screen error and had to stop this view. Your saved data may still be on this device. Avoid clearing app data and share the diagnostic report.";
    case 'storage_load':
    case 'storage_read':
    case 'data_corruption':
      return "Dugout Pulse couldn't safely read some saved data. Don't reset or reinstall the app. Open recovery tools and check your recovery points.";
    case 'storage_write':
    case 'storage_write_opposition_teams':
    case 'storage_write_games':
    case 'storage_write_profiles':
      return "Dugout Pulse couldn't safely save a change. Pause further edits and check your recovery points before trying again.";
    case 'backup_import':
      return "Dugout Pulse couldn't safely import that backup. Don't reset the app. Review the diagnostic report before trying another import.";
    case 'recovery_checkpoint':
      return "Dugout Pulse couldn't verify a recovery point. Avoid resetting or reinstalling the app; check for another verified recovery point.";
    case 'recovery_restore':
      return "Dugout Pulse couldn't complete the restore. Do not clear app data or reinstall. Review the diagnostic report before another attempt.";
    case 'data_reset':
      return "Dugout Pulse couldn't complete the data reset safely. Do not repeat the reset yet. Review the diagnostic report and check your recovery points.";
    case 'window_error':
    case 'unhandled_rejection':
    case 'runtime_error':
    case 'native_failure':
    case 'app_lifecycle':
      return "Dugout Pulse encountered an unexpected technical problem. If the app is responsive, export the diagnostic report. Avoid clearing app data or reinstalling while the cause is unknown.";
    default:
      return "Dugout Pulse couldn't complete an operation because of an unexpected problem. Keep the app installed, avoid clearing app data, and review the diagnostic report or recovery tools.";
  }
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
  'runtime_error',
  'data_corruption',
  'storage_read',
  'app_lifecycle',
  'native_failure',
  'app_startup',
  'react_render',
  'storage_load',
  'storage_write',
  'storage_write_opposition_teams',
  'storage_write_games',
  'storage_write_profiles',
  'native_text_export',
  'browser_text_export',
  'native_binary_export',
  'browser_binary_export',
  'native_text_share',
  // Backup / recovery / reset / logo operations. The real error is recorded under these labels.
  'backup_export',
  'backup_import',
  'recovery_checkpoint',
  'recovery_restore',
  'data_reset',
  'logo_library',
  'team_logo_migration',
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
      // React component stacks can encode source locations inside a URL. Keep the
      // basename and line/column while removing origin, full path and Vite query.
      const sourceLocation = url.match(/\/([^/?#]+\.(?:tsx?|jsx?|mjs|cjs|json))(?:\?[^:]*)?:(\d+):(\d+)$/i);
      if (sourceLocation) return sourceLocation[1] + ':' + sourceLocation[2] + ':' + sourceLocation[3];
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
    .slice(0, MAX_MESSAGE_CHARS);
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
function safeDiagnosticDetail(value: string): string {
  return value
    .replace(/https?:\/\/[^\s)]+/gi, (url) => {
      // React component stacks can encode source locations inside a URL. Keep the
      // basename and line/column while removing origin, full path and Vite query.
      const sourceLocation = url.match(/\/([^/?#]+\.(?:tsx?|jsx?|mjs|cjs|json))(?:\?[^:]*)?:(\d+):(\d+)$/i);
      if (sourceLocation) return sourceLocation[1] + ':' + sourceLocation[2] + ':' + sourceLocation[3];
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
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_DETAIL_CHARS);
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
        const validTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.time);
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
            ? { errorMessage: item.errorMessage.replace(/[^\x20-\x7E]/g, ' ').slice(0, MAX_MESSAGE_CHARS) }
            : {}),
          userMessage: friendlyErrorMessage(safeCategory(item.category)),
          ...(cleanFrames?.length ? { frames: cleanFrames } : {}),
          ...(typeof item.details === 'string' && item.details.length
            ? { details: safeDiagnosticDetail(item.details) }
            : {}),
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
export function recordDiagnosticError(category: string, error: unknown, additionalDetails?: string): string {
  const normalisedCategory = safeCategory(category);
  const hookDiagnostic = pendingReactHookDiagnostic &&
    Date.now() - pendingReactHookDiagnostic.time <= 15000
    ? pendingReactHookDiagnostic.details
    : undefined;
  if (normalisedCategory === 'react_render') pendingReactHookDiagnostic = undefined;
  const errorStack = error && typeof error === 'object' && 'stack' in error && typeof error.stack === 'string'
    ? error.stack
    : '';
  const diagnosticDetails = [
    errorStack,
    normalisedCategory === 'react_render' ? hookDiagnostic : undefined,
    additionalDetails,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(safeDiagnosticDetail)
    .filter(Boolean)
    .join('\n\n');
  const event: DiagnosticEvent = {
    id: createReference(),
    // Preserve exact time to correlate diagnostics with the browser console.
    time: new Date().toISOString(),
    category: normalisedCategory,
    errorType: safeErrorType(error),
    errorMessage: safeErrorMessage(error),
    userMessage: friendlyErrorMessage(normalisedCategory),
    frames: safeStackFrames(error),
    ...(diagnosticDetails ? { details: diagnosticDetails } : {}),
    platform: getPlatform(),
    build: getBuild(),
  };
  persist(event);
  lastReference = event.id;
  lastRecordedAt = Date.now();
  return event.id;
}

/** Reference of the most recently recorded error (e.g. a checkpoint failure recorded deeper in the stack). */
export function getLastDiagnosticReference(): string {
  return lastReference;
}

export function recordDiagnosticEvent(category: string): void {
  persist({
    id: createReference(),
    time: new Date().toISOString(),
    category: safeCategory(category),
    platform: getPlatform(),
    build: getBuild(),
  });
}

export function getDiagnosticEvents(): DiagnosticEvent[] {
  return readEvents();
}

/** Return only the latest actionable error recorded by this exact app build. */
export function getCurrentBuildDiagnosticEvent(): DiagnosticEvent | undefined {
  const currentBuild = getBuild();
  return readEvents()
    .filter((event) => event.build === currentBuild && (event.errorType || event.errorMessage))
    .slice(-1)[0];
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
      // Preserve all recovery copies through a reset so a failed/partial recovery
      // cannot destroy the only remaining backup.
      if (key && key !== STORAGE_KEY && key !== 'dugoutPulse.recoverySnapshot.v1' &&
          key !== 'dugoutPulse.recoverySnapshot.previous.v1' && key !== 'dugoutPulse.beforeRecovery.v1') {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Reset is best-effort if the browser blocks local storage operations.
  }
}

export function createDiagnosticReport(reference?: string): string {
  const events = readEvents();
  const currentBuild = getBuild();
  // Reports are intentionally focused on the current build's latest actionable
  // error, not a pile of stale errors from earlier builds or earlier failures.
  const reportEvents = reference
    ? events.filter((event) => event.id === reference)
    : (() => {
        const latest = events
          .filter((event) => event.build === currentBuild && (event.errorType || event.errorMessage))
          .slice(-1)[0];
        return latest ? [latest] : [];
      })();
  return JSON.stringify({
    reportFormat: 2,
    app: 'Dugout Pulse',
    appVersion: '1.0.0',
    build: reportEvents[0]?.build || getBuild(),
    platform: reportEvents[0]?.platform || getPlatform(),
    privacy: 'Offline report. No name, account ID, game data, player/team names, full user-agent, network address, or full file path is intentionally collected. Error messages are sanitised and truncated; review before sharing. Exact timestamps are included to help correlate errors with logs. Review before sharing.',
    events: reportEvents,
  }, null, 2);
}

/** Prefer a nearby parser/compile error when a dynamic-import failure is only its symptom. */
function preferredDiagnosticReference(reference: string): string {
  const events = readEvents();
  const selected = events.find((event) => event.id === reference);
  if (!selected || !/Failed to fetch dynamically imported module/i.test(selected.errorMessage || '')) {
    return reference;
  }

  const selectedTime = Date.parse(selected.time);
  const rootCause = events.slice().reverse().find((event) => {
    if (
      event.category !== 'app_startup' ||
      event.errorType !== 'SyntaxError' ||
      !/^Vite compile error:/i.test(event.errorMessage || '')
    ) return false;
    const rootTime = Date.parse(event.time);
    return Number.isFinite(selectedTime) && Number.isFinite(rootTime) && Math.abs(selectedTime - rootTime) <= 10000;
  });
  return rootCause?.id || reference;
}

/** Route every user-visible failure through the single diagnostic screen in index.html. */
export function showDiagnosticScreen(reference: string): void {
  if (typeof window === 'undefined') return;
  const preferredReference = preferredDiagnosticReference(reference);
  const host = window as Window & {
    __dugoutPulseShowDiagnostic?: (errorReference: string) => void;
  };
  host.__dugoutPulseShowDiagnostic?.(preferredReference);
}

/** Install once at bootstrap, before React or the rest of the app is loaded. */
export function installGlobalDiagnosticHandlers(): void {
  if (typeof window === 'undefined') return;
  const marker = '__dugoutPulseDiagnosticsInstalled';
  const target = window as Window & { __dugoutPulseDiagnosticsInstalled?: boolean };
  if (target[marker]) return;
  target[marker] = true;

  const describeConsoleArgument = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.name + ': ' + value.message + (value.stack ? '\n' + value.stack : '');
    if (value === undefined) return 'undefined';
    if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
    try {
      const seen = new WeakSet<object>();
      return JSON.stringify(value, (_key, item: unknown) => {
        if (item && typeof item === 'object') {
          if (seen.has(item)) return '[Circular]';
          seen.add(item);
        }
        return item;
      }, 2) ?? String(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  };
  const formatConsoleArguments = (values: unknown[]): string => {
    if (!values.length) return '';
    if (typeof values[0] !== 'string') return values.map(describeConsoleArgument).join('\n');
    let argIndex = 1;
    const formatted = values[0].replace(/%([%sdifocO])/g, (match, token: string) => {
      if (token === '%') return '%';
      if (argIndex >= values.length) return match;
      const value = values[argIndex++];
      if (token === 'c') return '';
      if (token === 'd' || token === 'i' || token === 'f') {
        const number = Number(value);
        return Number.isFinite(number) ? String(number) : describeConsoleArgument(value);
      }
      return describeConsoleArgument(value);
    });
    return [formatted, ...values.slice(argIndex).map(describeConsoleArgument)].filter(Boolean).join('\n');
  };
  const captureHookOrderDiagnostic = (args: unknown[]): boolean => {
    const detail = formatConsoleArguments(args);
    if (!/change in the order of Hooks called|Rendered (?:more|fewer) hooks than during the previous render/i.test(detail)) return false;
    pendingReactHookDiagnostic = {
      time: Date.now(),
      details: safeDiagnosticDetail(detail),
    };
    return true;
  };
  const classifyConsoleFailure = (detail: string): string => {
    const value = detail.toLowerCase();
    if (/quota|storage is full|could not save|could not remove|local storage|storage write|setitem/.test(value)) return 'storage_write';
    if (/corrupt|invalid data|failed validation|integrity check|read-back verification|unexpected format|json parse|syntaxerror/.test(value)) return 'data_corruption';
    if (/restore|rollback/.test(value)) return 'recovery_restore';
    if (/recovery|checkpoint|snapshot/.test(value)) return 'recovery_checkpoint';
    if (/backup|import|export|share/.test(value)) return /import/.test(value) ? 'backup_import' : 'backup_export';
    if (/read storage|could not read|failed to read|storage could not be inspected/.test(value)) return 'storage_read';
    return 'runtime_error';
  };

  // React emits the Hook-by-Hook comparison through console.error before the
  // render exception reaches ErrorBoundary. Preserve that specific diagnostic
  // so the exported report contains the comparison, not just the final exception.
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const isHookOrderDiagnostic = captureHookOrderDiagnostic(args);
      const detail = formatConsoleArguments(args);
      // Catch handled failures that are only written to the console (storage,
      // recovery, import/export, and other caught errors) without forcing a modal
      // over an operation that already has its own user-facing handling.
      if (!isHookOrderDiagnostic && Date.now() - lastRecordedAt > 1500 &&
          /error|failed|failure|could not|unable|corrupt|invalid|denied|quota|exception|verification/i.test(detail)) {
        const errorArgument = args.find((arg): arg is Error => arg instanceof Error);
        recordDiagnosticError(classifyConsoleFailure(detail), errorArgument || new Error(detail.slice(0, MAX_MESSAGE_CHARS)), detail);
      }
    } catch { /* diagnostics must never affect rendering */ }
    originalConsoleError(...args);
  };
  const originalConsoleWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    try { captureHookOrderDiagnostic(args); } catch { /* diagnostics must never affect rendering */ }
    originalConsoleWarn(...args);
  };

  window.addEventListener('error', (event) => {
    // Ignore resource-loading events; index.html owns startup/module-load failures.
    if (event.target && event.target !== window) return;
    const reference = recordDiagnosticError('window_error', event.error ?? new Error(event.message || 'WindowError'));
    showDiagnosticScreen(reference);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reference = recordDiagnosticError('unhandled_rejection', event.reason);
    showDiagnosticScreen(reference);
  });
}
