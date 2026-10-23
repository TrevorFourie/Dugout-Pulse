const STORAGE_KEY = 'dugoutPulse.diagnostics.v1';
const SESSION_STORAGE_KEY = 'dugoutPulse.diagnostics.session.v1';
const MAX_EVENTS = 40;
const MAX_STORAGE_CHARS = 48_000;
// The diagnostic report must show the TRUE error, so keep enough of it to be useful.
const MAX_MESSAGE_CHARS = 400;
const MAX_DETAIL_CHARS = 12000;
let lastReference = '';
let lastRecordedAt = 0;
let lastRecordedErrorObject: object | undefined;
let volatileEvents: DiagnosticEvent[] = [];
let recentConsoleFailures: Array<{ fingerprint: string; time: number }> = [];
let recentRecordedErrors: Array<{ fingerprint: string; time: number; reference: string }> = [];
const networkErrorReferences = new WeakMap<object, string>();
let recordedErrorReferences = new WeakMap<object, { reference: string; time: number }>();
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
      return "Dugout Pulse ran into a problem while starting. Please restart the app to try again. If it still cannot start, share the diagnostic report so the problem can be investigated. Please keep the app installed and avoid clearing its data while we look into this.";
    case 'react_render':
      return "Dugout Pulse had trouble displaying this screen. Please restart the app to try again. If the problem happens again, please share the diagnostic report so we can investigate. For now, please keep the app installed and avoid clearing its data.";
    case 'storage_load':
    case 'storage_read':
    case 'data_corruption':
      return "Dugout Pulse had trouble reading some saved data. Please open the recovery tools to review your available recovery points. If you need help, the diagnostic report can provide more detail. Please keep the app installed and avoid clearing its data.";
    case 'storage_write':
    case 'storage_write_opposition_teams':
    case 'storage_write_games':
    case 'storage_write_profiles':
      return "Dugout Pulse had trouble saving that change. It may not have been saved, so please check the saved information before trying again. If the problem continues, share the diagnostic report so it can be investigated.";
    case 'backup_import':
      return "Dugout Pulse couldn't complete the backup import. Please keep the app installed and avoid clearing its data. If the problem continues, share the diagnostic report before trying another import.";
    case 'recovery_checkpoint':
      return "Dugout Pulse couldn't verify that recovery point. Please check whether another verified recovery point is available. Keep the app installed and avoid clearing its data while you review your options.";
    case 'recovery_restore':
      return "Dugout Pulse couldn't complete the restore. Please review the available recovery points and diagnostic report before trying again. Keep the app installed and avoid clearing its data for now.";
    case 'data_reset':
      return "Dugout Pulse couldn't complete the data reset. Please check the recovery tools and diagnostic report before trying again, so you can review the available options first.";
    case 'network_failure':
      return "Dugout Pulse couldn't complete a request. This can happen while you're offline. If the action didn't finish as expected, please check its result and share the diagnostic report if you need help.";
    case 'window_error':
    case 'unhandled_rejection':
      return "Dugout Pulse ran into an unexpected problem. Please restart the app to try again. If it happens again, share the diagnostic report so the problem can be investigated. Please keep the app installed and avoid clearing its data for now.";
    case 'module_load_failure':
      return "One part of Dugout Pulse couldn't load. Other features may still be available. If something isn't working as expected, please share the diagnostic report so the issue can be investigated.";
    case 'runtime_error':
    case 'native_failure':
    case 'app_lifecycle':
      return "Dugout Pulse ran into an unexpected problem. If you can still use the app, please export the diagnostic report to help identify the cause. Please keep the app installed and avoid clearing its data while the issue is being investigated.";
    default:
      return "Dugout Pulse couldn't complete that action. If it happens again, please share the diagnostic report so the problem can be investigated. Please keep the app installed and avoid clearing its data for now.";
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
  'network_failure',
  'module_load_failure',
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

function redactLikelyUserValues(value: string): string {
  return value
    // Quoted free-form values may contain player, team, venue or other user-entered names.
    // Keep obvious technical tokens and module/source paths so compiler diagnostics remain useful.
    .replace(/(["'])([^"'\r\n]{1,100})\1/g, (match, _quote: string, inner: string) => {
      const token = inner.trim();
      if (
        token.includes('/') ||
        token.includes('\\') ||
        token.includes('@') ||
        /\.(?:tsx?|jsx?|mjs|cjs|json|css|svg|png|jpe?g|webp)$/i.test(token) ||
        /^(?:\{|\}|\(|\)|\[|\]|\.|,|:|;|!|\?)$/.test(token) ||
        /^(?:undefined|null|NaN|true|false|length|map|filter|find|then|catch|default|useState|useEffect|useMemo|useCallback|useRef|useContext|useReducer|useLayoutEffect)$/i.test(token)
      ) return match;
      return '[redacted value]';
    })
    .replace(/\b(player|team|opponent|venue|profile|game|account|user|device|installation|serial|uuid|ip|mac|network)(?:name|id|identifier|address|serial|uuid|record|data)?\s*[:=]\s*[^,;\n]+/gi, '$1: [redacted]')
    .replace(/\b(player|team|opponent|venue|profile|game|account|user)\s+(?:name\s+)?([A-Z][A-Za-z0-9'’.-]*(?:\s+[A-Z][A-Za-z0-9'’.-]*){0,4})\b/g, '$1 [redacted]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[identifier]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[address]')
    .replace(/\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/gi, '[identifier]');
}

function safeErrorMessage(error: unknown): string | undefined {
  let message = '';
  if (error instanceof Error) message = error.message;
  else if (typeof error === 'string') message = error;
  else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') message = error.message;
  if (!message) return undefined;

  // Preserve actionable technical details while stripping identifiers and user-entered values.
  message = message
    .replace(/https?:\/\/[^\s)]+/gi, (url) => {
      const sourceLocation = url.match(/\/([^/?#]+\.(?:tsx?|jsx?|mjs|cjs|json))(?:\?[^:]*)?:(\d+):(\d+)$/i);
      if (sourceLocation) return sourceLocation[1] + ':' + sourceLocation[2] + ':' + sourceLocation[3];
      try {
        const parsed = new URL(url);
        return parsed.pathname.split('/').filter(Boolean).slice(-1)[0] || '[url]';
      } catch {
        return '[url]';
      }
    })
    .replace(/(?:[A-Z]:)?[\\/](?:[^\s:'"<>]+[\\/])+([^\s\\/'"<>]+\.(?:tsx?|jsx?|mjs|cjs|json))/gi, '$1')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b(?:token|password|authorization)\s*[:=]\s*[^\s,;]+/gi, '[redacted]');
  message = redactLikelyUserValues(message)
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
  const sanitised = value
    .replace(/https?:\/\/[^\s)]+/gi, (url) => {
      const sourceLocation = url.match(/\/([^/?#]+\.(?:tsx?|jsx?|mjs|cjs|json))(?:\?[^:]*)?:(\d+):(\d+)$/i);
      if (sourceLocation) return sourceLocation[1] + ':' + sourceLocation[2] + ':' + sourceLocation[3];
      try {
        const parsed = new URL(url);
        return parsed.pathname.split('/').filter(Boolean).slice(-1)[0] || '[url]';
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
    .join('\n');
  return redactLikelyUserValues(sanitised).slice(0, MAX_DETAIL_CHARS);
}

function readEvents(): DiagnosticEvent[] {
  let primary: unknown[] = [];
  let fallback: unknown[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) primary = parsed;
    }
  } catch {
    // Continue with fallback diagnostics if persistent storage is blocked or corrupt.
  }
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) fallback = parsed;
    }
  } catch {
    // Session storage may also be unavailable in restricted browser contexts.
  }
  const combined = [...primary, ...fallback, ...volatileEvents];
  const unique = new Map<string, unknown>();
  for (const item of combined) {
    if (item && typeof item === 'object' && 'id' in item && typeof item.id === 'string') {
      unique.set(item.id, item);
    }
  }
  const parsed = [...unique.values()];
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
            ? { errorMessage: safeDiagnosticDetail(item.errorMessage).replace(/[^\x20-\x7E]/g, ' ').slice(0, MAX_MESSAGE_CHARS) }
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
}

function persist(event: DiagnosticEvent): void {
  const events = [...readEvents(), event].slice(-MAX_EVENTS);
  let serialized = JSON.stringify(events);
  while (serialized.length > MAX_STORAGE_CHARS && events.length > 1) {
    events.shift();
    serialized = JSON.stringify(events);
  }
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
    volatileEvents = [];
    try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch { /* optional fallback cleanup */ }
  } catch {
    // Preserve diagnostics for export during this session if persistent storage is blocked or full.
    volatileEvents = events;
    try { sessionStorage.setItem(SESSION_STORAGE_KEY, serialized); } catch {
      // In-memory diagnostics remain available even when all browser storage is unavailable.
    }
  }
}


function replacePersistedEvent(updated: DiagnosticEvent): void {
  const events = readEvents();
  const index = events.findIndex((event) => event.id === updated.id);
  if (index < 0) return;
  events[index] = updated;
  const retained = events.slice(-MAX_EVENTS);
  let serialized = JSON.stringify(retained);
  while (serialized.length > MAX_STORAGE_CHARS && retained.length > 1) {
    retained.shift();
    serialized = JSON.stringify(retained);
  }
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
    volatileEvents = [];
    try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch { /* optional fallback cleanup */ }
  } catch {
    volatileEvents = retained;
    try { sessionStorage.setItem(SESSION_STORAGE_KEY, serialized); } catch {
      // The updated context remains available in memory even when all storage is unavailable.
    }
  }
}

/** Record only a fixed operation label, error class and sanitised source locations. */
export function recordDiagnosticError(category: string, error: unknown, additionalDetails?: string): string {
  const normalisedCategory = safeCategory(category);
  const errorObject = error && (typeof error === 'object' || typeof error === 'function') ? error as object : undefined;
  const existingCapture = errorObject ? recordedErrorReferences.get(errorObject) : undefined;
  if (existingCapture && Date.now() - existingCapture.time <= 10000) {
    // A global storage wrapper may see the same exception before the operation-specific catch.
    // Keep one event but enrich it with the more precise context supplied by the caller.
    if (additionalDetails) {
      const extra = safeDiagnosticDetail(additionalDetails);
      const existingEvent = readEvents().find((event) => event.id === existingCapture.reference);
      if (existingEvent && extra && !(existingEvent.details || '').includes(extra)) {
        const mergedDetails = [existingEvent.details, extra].filter(Boolean).join('\n\n').slice(0, MAX_DETAIL_CHARS);
        replacePersistedEvent({ ...existingEvent, details: mergedDetails });
      }
    }
    lastReference = existingCapture.reference;
    lastRecordedAt = Date.now();
    lastRecordedErrorObject = errorObject;
    return existingCapture.reference;
  }
  const hookDiagnostic = pendingReactHookDiagnostic &&
    Date.now() - pendingReactHookDiagnostic.time <= 15000
    ? pendingReactHookDiagnostic.details
    : undefined;
  if (normalisedCategory === 'react_render') pendingReactHookDiagnostic = undefined;
  const errorStack = error && typeof error === 'object' && 'stack' in error && typeof error.stack === 'string'
    ? error.stack
    : '';
  // The Hook comparison is the root-cause evidence. Keep it before the repetitive
  // React exception stack so it cannot be truncated out of the exported report.
  const diagnosticDetails = [
    normalisedCategory === 'react_render' ? hookDiagnostic : undefined,
    additionalDetails,
    errorStack,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(safeDiagnosticDetail)
    .filter(Boolean)
    .join('\n\n');
  const fingerprint = JSON.stringify([
    normalisedCategory,
    safeErrorType(error),
    safeErrorMessage(error) || '',
    safeStackFrames(error).join('|'),
    diagnosticDetails,
  ]);
  const now = Date.now();
  recentRecordedErrors = recentRecordedErrors.filter((entry) => now - entry.time <= 10000);
  const duplicate = recentRecordedErrors.find((entry) => entry.fingerprint === fingerprint);
  if (duplicate) {
    lastReference = duplicate.reference;
    lastRecordedAt = now;
    lastRecordedErrorObject = errorObject;
    if (errorObject) recordedErrorReferences.set(errorObject, { reference: duplicate.reference, time: now });
    return duplicate.reference;
  }
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
  recentRecordedErrors.push({ fingerprint, time: Date.now(), reference: event.id });
  if (errorObject) recordedErrorReferences.set(errorObject, { reference: event.id, time: Date.now() });
  lastReference = event.id;
  lastRecordedAt = Date.now();
  lastRecordedErrorObject = errorObject;
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
  volatileEvents = [];
  recentConsoleFailures = [];
  recentRecordedErrors = [];
  pendingReactHookDiagnostic = undefined;
  lastReference = '';
  lastRecordedAt = 0;
  lastRecordedErrorObject = undefined;
  recordedErrorReferences = new WeakMap<object, { reference: string; time: number }>();
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
  try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
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
export function showDiagnosticScreen(reference: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const preferredReference = preferredDiagnosticReference(reference);
    const host = window as Window & {
      __dugoutPulseShowDiagnostic?: (errorReference: string) => void;
    };
    if (typeof host.__dugoutPulseShowDiagnostic !== 'function') return false;
    host.__dugoutPulseShowDiagnostic(preferredReference);
    return true;
  } catch {
    // The diagnostic UI must not replace or compound the original application error.
    return false;
  }
}

/** Install once at bootstrap, before React or the rest of the app is loaded. */
export function installGlobalDiagnosticHandlers(): void {
  if (typeof window === 'undefined') return;
  // Observe native Storage failures centrally so direct callers cannot silently lose read/write errors.
  // The guard prevents diagnostic persistence from recursively reporting its own storage failures.
  let capturingStorageFailure = false;
  if (typeof Storage !== 'undefined') {
    type StorageMethod = 'getItem' | 'setItem' | 'removeItem' | 'clear';
    const storagePrototype = Storage.prototype as unknown as Record<StorageMethod, (...args: string[]) => unknown>;
    const wrapStorageMethod = (methodName: StorageMethod, category: 'storage_read' | 'storage_write') => {
      try {
        const original = storagePrototype[methodName];
        storagePrototype[methodName] = function (this: Storage, ...args: string[]): unknown {
          try {
            return original.apply(this, args);
          } catch (error) {
            if (!capturingStorageFailure) {
              capturingStorageFailure = true;
              try {
                recordDiagnosticError(category, error, 'A browser storage operation failed. The original operation was not altered or retried.');
              } catch {
                // Storage diagnostics must never replace the original storage exception.
              } finally {
                capturingStorageFailure = false;
              }
            }
            throw error;
          }
        };
      } catch {
        // Some WebViews may disallow prototype overrides; other diagnostic handlers still remain active.
      }
    };
    wrapStorageMethod('getItem', 'storage_read');
    wrapStorageMethod('setItem', 'storage_write');
    wrapStorageMethod('removeItem', 'storage_write');
    wrapStorageMethod('clear', 'storage_write');
  }

  const marker = '__dugoutPulseDiagnosticsInstalled';
  const target = window as Window & { __dugoutPulseDiagnosticsInstalled?: boolean };
  if (target[marker]) return;
  target[marker] = true;

  const describeConsoleArgument = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.name + ': ' + value.message + (value.stack ? '\n' + value.stack : '');
    if (value === undefined) return 'undefined';
    if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
    // Never serialise arbitrary console objects: they can contain game records,
    // player/team names, account details or device-specific information.
    if (typeof value === 'function') return '[Function]';
    const objectType = Object.prototype.toString.call(value).slice(8, -1);
    return '[' + (objectType || 'Object') + ']';
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
    const isHookComparison = /React has detected a change in the order of Hooks called|change in the order of Hooks called/i.test(detail)
      && /Previous render[\s\S]*Next render/i.test(detail);
    const isGenericHookException = /Rendered (?:more|fewer) hooks than during the previous render/i.test(detail);
    if (!isHookComparison && !isGenericHookException) return false;

    // React logs the useful previous/next Hook table first, then emits a much
    // shorter caught-exception message. Never let that follow-up overwrite the
    // table that explains which Hook changed.
    const existingHasComparison = Boolean(
      pendingReactHookDiagnostic &&
      Date.now() - pendingReactHookDiagnostic.time <= 15000 &&
      /Previous render[\s\S]*Next render/i.test(pendingReactHookDiagnostic.details)
    );
    if (isHookComparison || !existingHasComparison) {
      pendingReactHookDiagnostic = {
        time: Date.now(),
        details: safeDiagnosticDetail(detail),
      };
    }
    return true;
  };
  const classifyConsoleFailure = (detail: string): string => {
    const value = detail.toLowerCase();
    if (/quota|storage is full|could not save|could not remove|local storage|storage write|setitem|persist|failed to save|save setup/.test(value)) return 'storage_write';
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
      const isReactCaughtRenderError =
        /The above error occurred in the <[^>]+> component/i.test(detail) ||
        /Rendered (?:more|fewer) hooks than during the previous render/i.test(detail) ||
        /React has detected a change in the order of Hooks called/i.test(detail) ||
        /useGame must be used within a GameProvider/i.test(detail);
      const now = Date.now();
      const normalizedDetail = detail.toLowerCase().replace(/\s+/g, ' ').trim();
      const fingerprint = normalizedDetail.slice(0, 1200);
      recentConsoleFailures = recentConsoleFailures.filter((entry) => now - entry.time <= 2500);
      const repeatedConsoleFailure = recentConsoleFailures.some((entry) => entry.fingerprint === fingerprint);
      const errorArgument = args.find((arg): arg is Error => arg instanceof Error);
      const duplicateOfExplicitCapture = now - lastRecordedAt <= 1500 &&
        Boolean(errorArgument && lastRecordedErrorObject && errorArgument === lastRecordedErrorObject);
      if (!isHookOrderDiagnostic && !isReactCaughtRenderError && !repeatedConsoleFailure && !duplicateOfExplicitCapture &&
          /error|failed|failure|could not|unable|corrupt|invalid|denied|quota|exception|verification/i.test(detail)) {
        recentConsoleFailures.push({ fingerprint, time: now });
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

  // Capture fetch failures even when callers handle the rejected promise.
  // Request URLs are deliberately excluded because they may contain private paths or query values.
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isDiagnosticFetch = requestUrl.includes('/src/App.tsx?diagnostic=');
    let request: Promise<Response>;
    try {
      request = originalFetch(input, init);
    } catch (error) {
      if (!isDiagnosticFetch && !(error instanceof DOMException && error.name === 'AbortError')) {
        recordDiagnosticError('network_failure', error, 'A fetch request failed before a response was received.');
      }
      throw error;
    }
    return request.then((response) => {
      if (!isDiagnosticFetch && !response.ok) {
        recordDiagnosticError('network_failure', new Error('HTTP ' + response.status + ' response'),
          'A fetch request returned HTTP status ' + response.status + '.');
      }
      return response;
    }, (error: unknown) => {
      if (!isDiagnosticFetch && !(error instanceof DOMException && error.name === 'AbortError')) {
        const reference = recordDiagnosticError('network_failure', error, 'A fetch request failed before a response was received.');
        if (error && (typeof error === 'object' || typeof error === 'function')) {
          networkErrorReferences.set(error as object, reference);
        }
      }
      throw error;
    });
  }) as typeof window.fetch;

  window.addEventListener('error', (event) => {
    // Resource errors do not bubble, so listen in capture phase. Record failed
    // resources without putting a disruptive modal over recoverable image failures.
    if (event.target && event.target !== window) {
      const target = event.target as Element;
      const tagName = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : 'RESOURCE';
      // index.html already owns failed script/module startup presentation.
      if (tagName !== 'SCRIPT') {
        recordDiagnosticError('runtime_error', new Error('An app resource failed to load (' + tagName + ').'));
      }
      return;
    }
    const alreadyCaptured = event.error && (typeof event.error === 'object' || typeof event.error === 'function') &&
      event.error === lastRecordedErrorObject && Date.now() - lastRecordedAt <= 1500;
    const reference = alreadyCaptured
      ? lastReference
      : recordDiagnosticError('window_error', event.error ?? new Error(event.message || 'WindowError'));
    showDiagnosticScreen(reference);
  }, true);
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    // Aborted fetches are expected during cancellation/unmount and are not app failures.
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    const networkReference = reason && (typeof reason === 'object' || typeof reason === 'function')
      ? networkErrorReferences.get(reason as object)
      : undefined;
    // Reuse a fetch failure event if this same rejection later becomes unhandled.
    const alreadyCaptured = reason && (typeof reason === 'object' || typeof reason === 'function') &&
      reason === lastRecordedErrorObject && Date.now() - lastRecordedAt <= 1500;
    const reference = networkReference || (alreadyCaptured ? lastReference : recordDiagnosticError('unhandled_rejection', reason));
    showDiagnosticScreen(reference);
  });
}
