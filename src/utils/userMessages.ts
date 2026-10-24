import { recordDiagnosticError } from './errorDiagnostics';

/**
 * An error whose message was written for the user on purpose (for example "Unsupported image format").
 * Its message is safe to show as-is; any other error is shown as a plain-language message instead,
 * and its true technical detail goes into the diagnostic report only.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Error';
  }
}

/** Short, plain-language hint for the most common root causes. Returns null when nothing useful can be said. */
function plainReason(error: unknown): string | null {
  const text = (error && typeof error === 'object'
    ? `${(error as { name?: unknown }).name ?? ''} ${(error as { message?: unknown }).message ?? ''}`
    : String(error ?? '')).toLowerCase();
  if (/quota|no space|enospc|not enough space|storage (is )?full|disk full/.test(text)) {
    return 'Your phone may be running low on storage space. Free up some space and try again.';
  }
  if (/permission|denied|eacces|eperm|not allowed|securityerror/.test(text)) {
    return 'The app was not allowed to use its storage.';
  }
  return null;
}

export const DIAGNOSTICS_HINT = 'If it happens again, open Settings → Data & About → Offline Diagnostics and share the report.';

/** Compose the user-facing text: what happened in plain words, a hint, and the reference to look up in the report. */
export function explainFailure(whatHappened: string, reference?: string, error?: unknown): string {
  const reason = error === undefined ? null : plainReason(error);
  return [whatHappened, reason, DIAGNOSTICS_HINT, reference ? `Reference: ${reference}` : null]
    .filter(Boolean)
    .join(' ');
}

/**
 * Record the TRUE error in the diagnostic report and return a friendly message for the user.
 * Deliberately user-facing errors (UserFacingError) are passed through unchanged and not recorded.
 */
export function reportFailure(category: string, error: unknown, whatHappened: string): string {
  if (error instanceof UserFacingError) return error.message;
  const reference = recordDiagnosticError(category, error);
  return explainFailure(whatHappened, reference, error);
}
