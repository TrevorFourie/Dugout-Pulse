/**
 * Pure (no Capacitor / DOM) helpers for the JSON backup file format.
 * Kept free of platform imports so they can be unit tested directly.
 *
 * Format versions:
 *   1/2 (legacy) - games, profiles, settings, upcomingGames, oppositionTeams; logos as references only.
 *   3            - adds extras (preset lists, setup flag), the logo library + embedded logo image
 *                  files, and an integrity block (length + FNV-1a checksum) over the whole file.
 */

export const BACKUP_FORMAT_VERSION = 3;
export const BACKUP_APP_ID = 'dugout-pulse';
const SAFE_FILE_NAME = /^[a-zA-Z0-9_.-]+$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export interface BackupExtras {
  savedTournaments: string[];
  savedAgeGroups: string[];
  savedSeasons: string[];
  savedOpponents: string[];
  hiddenTournaments: string[];
  hiddenAgeGroups: string[];
  hiddenSeasons: string[];
  setupCompleted: boolean;
}

export const EMPTY_EXTRAS: BackupExtras = {
  savedTournaments: [],
  savedAgeGroups: [],
  savedSeasons: [],
  savedOpponents: [],
  hiddenTournaments: [],
  hiddenAgeGroups: [],
  hiddenSeasons: [],
  setupCompleted: false,
};

/** JSON.stringify with recursively sorted object keys, so the checksum does not depend on key order. */
export function canonicalStringify(value: unknown): string {
  const normalise = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalise);
    if (input && typeof input === 'object') {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(input as Record<string, unknown>).sort()) {
        const child = (input as Record<string, unknown>)[key];
        if (child !== undefined) out[key] = normalise(child);
      }
      return out;
    }
    return input;
  };
  return JSON.stringify(normalise(value));
}

/** FNV-1a: detects truncation / accidental corruption / hand edits. Not a security signature. */
export function backupChecksum(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function integrityFor(payload: Record<string, unknown>) {
  const body = canonicalStringify(payload);
  return { algorithm: 'fnv1a-32', length: body.length, checksum: backupChecksum(body) };
}

/** Adds the integrity block. Call this last, after every other field is set. */
export function sealBackup(payload: Record<string, unknown>): Record<string, unknown> {
  const { integrity: _ignored, ...rest } = payload;
  void _ignored;
  return { ...rest, integrity: integrityFor(rest) };
}

export type BackupCheck =
  | { ok: true; version: number; verified: boolean }
  | { ok: false; message: string };

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** Returns an error message, or null when the logo library and embedded files are consistent. */
export function validateLogoSection(library: unknown, files: unknown): string | null {
  if (library === undefined && files === undefined) return null;
  if (!Array.isArray(library)) return 'The backup\'s logo library is invalid.';
  if (!files || typeof files !== 'object' || Array.isArray(files)) return 'The backup\'s logo images are invalid.';
  const fileMap = files as Record<string, unknown>;
  for (const [name, bytes] of Object.entries(fileMap)) {
    if (!SAFE_FILE_NAME.test(name) || name.includes('..')) return 'The backup contains an invalid logo file name.';
    if (typeof bytes !== 'string' || !BASE64.test(bytes)) return 'The backup contains a damaged logo image.';
  }
  for (const item of library) {
    if (!item || typeof item !== 'object') return 'The backup\'s logo library is invalid.';
    const entry = item as { id?: unknown; fileName?: unknown };
    if (typeof entry.id !== 'string' || typeof entry.fileName !== 'string') return 'The backup\'s logo library is invalid.';
    if (!SAFE_FILE_NAME.test(entry.fileName) || entry.fileName.includes('..')) return 'The backup contains an invalid logo file name.';
  }
  return null;
}

/**
 * Validate a parsed backup BEFORE anything is changed.
 * - v3+ files must carry a matching integrity block, otherwise they are rejected as damaged.
 * - Legacy v1/v2 files have no checksum; they are accepted but reported as unverified.
 */
export function verifyBackup(parsed: unknown): BackupCheck {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, message: 'This file is not a Dugout Pulse backup.' };
  }
  const data = parsed as Record<string, unknown>;
  const looksLikeBackup = Array.isArray(data.games) || Array.isArray(data.profiles) ||
    Array.isArray(data.upcomingGames) || Array.isArray(data.oppositionTeams) ||
    (!!data.settings && typeof data.settings === 'object');
  if (!looksLikeBackup) return { ok: false, message: 'This file does not contain any Dugout Pulse data.' };

  const version = typeof data.backupVersion === 'number' ? data.backupVersion : 1;
  if (version > BACKUP_FORMAT_VERSION) {
    return { ok: false, message: 'This backup was made by a newer version of the app. Update the app, then try again.' };
  }

  let verified = false;
  if (version >= 3) {
    const integrity = data.integrity as { length?: unknown; checksum?: unknown } | undefined;
    if (!integrity || typeof integrity !== 'object' || typeof integrity.checksum !== 'string' || typeof integrity.length !== 'number') {
      return { ok: false, message: 'This backup is missing its integrity check, so it may be incomplete or edited. Nothing was changed.' };
    }
    const { integrity: _ignored, ...rest } = data;
    void _ignored;
    const actual = integrityFor(rest);
    if (actual.length !== integrity.length || actual.checksum !== integrity.checksum) {
      return { ok: false, message: 'This backup file is damaged, incomplete or has been edited, so it was not imported. Nothing was changed.' };
    }
    verified = true;
  }

  if (data.extras !== undefined) {
    const extras = data.extras as Record<string, unknown>;
    if (!extras || typeof extras !== 'object' || Array.isArray(extras)) return { ok: false, message: 'The backup\'s preset lists are invalid.' };
    for (const key of ['savedTournaments', 'savedAgeGroups', 'savedSeasons', 'savedOpponents', 'hiddenTournaments', 'hiddenAgeGroups', 'hiddenSeasons']) {
      if (extras[key] !== undefined && !isStringArray(extras[key])) return { ok: false, message: 'The backup\'s preset lists are invalid.' };
    }
  }

  const logoProblem = validateLogoSection(data.logoLibrary, data.logoFiles);
  if (logoProblem) return { ok: false, message: logoProblem };
  if (Array.isArray(data.logoLibrary) && data.logoFiles && typeof data.logoFiles === 'object') {
    const files = data.logoFiles as Record<string, unknown>;
    const missing = (data.logoLibrary as { fileName: string }[]).filter((entry) => !files[entry.fileName]);
    // Missing images are tolerated only if the exporter recorded them as unreadable at export time.
    const declared = new Set(Array.isArray(data.missingLogoFiles) ? (data.missingLogoFiles as unknown[]) : []);
    if (missing.some((entry) => !declared.has(entry.fileName))) {
      return { ok: false, message: 'The backup is missing some logo images it refers to. Nothing was changed.' };
    }
  }
  return { ok: true, version, verified };
}

/** Reads a list of strings out of an unknown value; anything else becomes an empty list. */
export const asStringList = (value: unknown): string[] =>
  isStringArray(value) ? value.map((item) => item.trim()).filter(Boolean) : [];
