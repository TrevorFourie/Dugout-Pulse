import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { AppSettings, Game, PlayerProfile } from '../types/baseball';
import type { OppositionTeam } from '../context/gameContextTypes';
import type { TeamLogoItem } from '../utils/teamLogoLibrary';
import { STORAGE_KEYS } from '../context/gameContextDefaults';
import { initializeSQLiteDatabase, withSQLiteTransaction } from './sqliteDatabase';

const IMPORT_MARKER = 'legacy_storage_import_v1';

const ARRAY_LIST_KEYS = [
  STORAGE_KEYS.SAVED_OPPONENTS,
  STORAGE_KEYS.SAVED_TOURNAMENTS,
  STORAGE_KEYS.SAVED_AGE_GROUPS,
  STORAGE_KEYS.SAVED_SEASONS,
  STORAGE_KEYS.HIDDEN_TOURNAMENTS,
  STORAGE_KEYS.HIDDEN_AGE_GROUPS,
  STORAGE_KEYS.HIDDEN_SEASONS,
] as const;

const SINGLE_VALUE_KEYS = [
  STORAGE_KEYS.LIVE_GAME,
  STORAGE_KEYS.EDITING_GAME_ID,
  STORAGE_KEYS.REOPENED_GAME_ID,
  STORAGE_KEYS.SETTINGS,
  STORAGE_KEYS.SETUP_COMPLETED,
] as const;

const UPCOMING_GAMES_KEY = 'dugoutPulse.upcomingGames.v1';
const OPPOSITION_TEAMS_KEY = 'dugoutPulse.oppositionTeams.v1';
const LOGO_LIBRARY_KEY = 'dugoutPulse.logoLibrary.v1';

export interface LegacyStorageEntry {
  key: string;
  value: string;
}

export interface LegacyStorageAudit {
  sourceKeyCount: number;
  sourceCharacterCount: number;
  gameCount: number;
  playCount: number;
  profileCount: number;
  upcomingGameCount: number;
  oppositionTeamCount: number;
  logoCount: number;
  warnings: string[];
}

interface ValidatedSnapshot {
  entries: LegacyStorageEntry[];
  games: Game[];
  profiles: PlayerProfile[];
  settings: AppSettings | Record<string, unknown> | null;
  liveGame: Game | null;
  upcomingGames: Record<string, unknown>[];
  oppositionTeams: OppositionTeam[];
  logoLibrary: TeamLogoItem[];
  namedLists: Map<string, string[]>;
  appState: Map<string, unknown>;
  audit: LegacyStorageAudit;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseStoredJson(entry: LegacyStorageEntry): unknown {
  try {
    return JSON.parse(entry.value) as unknown;
  } catch {
    throw new Error(`Saved value "${entry.key}" is not valid JSON. The original data has been left untouched.`);
  }
}

function requireRecordArray<T extends { id: string }>(
  entry: LegacyStorageEntry | undefined,
  label: string,
  validate: (value: unknown) => value is T,
): T[] {
  if (!entry) return [];
  const parsed = parseStoredJson(entry);
  if (!Array.isArray(parsed) || !parsed.every(validate)) {
    throw new Error(`Saved ${label} could not be validated. The original data has been left untouched.`);
  }
  return parsed;
}

function isIdentifiedRecord(value: unknown): value is Record<string, unknown> & { id: string } {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0;
}

function isGame(value: unknown): value is Game {
  // Preserve older saved-game shapes as-is. Require only the stable identifier
  // plus basic checks for fields when present; do not "repair" history here.
  return isIdentifiedRecord(value) &&
    (value.date === undefined || typeof value.date === 'string') &&
    (value.teamName === undefined || typeof value.teamName === 'string') &&
    (value.innings === undefined || typeof value.innings === 'number') &&
    (value.plays === undefined || Array.isArray(value.plays));
}

function isProfile(value: unknown): value is PlayerProfile {
  // Historical profiles may omit fields introduced in later app versions.
  return isIdentifiedRecord(value) &&
    (value.playerName === undefined || typeof value.playerName === 'string') &&
    (value.teamName === undefined || typeof value.teamName === 'string');
}

function isOppositionTeam(value: unknown): value is OppositionTeam {
  return isIdentifiedRecord(value) && typeof value.name === 'string' &&
    (value.logo === undefined || typeof value.logo === 'string');
}

function isUpcomingGame(value: unknown): value is Record<string, unknown> & { id: string } {
  return isIdentifiedRecord(value) && typeof value.opponent === 'string' &&
    typeof value.date === 'string' && typeof value.isHome === 'boolean';
}

function isLogoItem(value: unknown): value is TeamLogoItem {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.name === 'string' && typeof value.fileName === 'string' &&
    typeof value.uri === 'string' && typeof value.sizeBytes === 'number' &&
    Number.isFinite(value.sizeBytes) && value.sizeBytes >= 0 &&
    (value.mimeType === undefined || typeof value.mimeType === 'string');
}

function readAllLocalStorage(): LegacyStorageEntry[] {
  const entries: LegacyStorageEntry[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key === null) continue;
    const value = localStorage.getItem(key);
    if (value !== null) entries.push({ key, value });
  }
  return entries.sort((left, right) => left.key.localeCompare(right.key));
}

function canonicalStringify(value: unknown): string {
  const normalise = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalise);
    if (isRecord(input)) {
      const result: Record<string, unknown> = {};
      Object.keys(input).sort().forEach((key) => {
        if (input[key] !== undefined) result[key] = normalise(input[key]);
      });
      return result;
    }
    return input;
  };
  return JSON.stringify(normalise(value));
}

function sourceFingerprint(entries: LegacyStorageEntry[]): string {
  const source = canonicalStringify(entries);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${entries.length}:${source.length}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function validateSnapshot(entries: LegacyStorageEntry[]): ValidatedSnapshot {
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const games = requireRecordArray(byKey.get(STORAGE_KEYS.GAMES), 'saved games', isGame);
  const profiles = requireRecordArray(byKey.get(STORAGE_KEYS.PROFILES), 'player profiles', isProfile);
  const upcomingGames = requireRecordArray(byKey.get(UPCOMING_GAMES_KEY), 'scheduled games', isUpcomingGame);
  const oppositionTeams = requireRecordArray(byKey.get(OPPOSITION_TEAMS_KEY), 'opposition teams', isOppositionTeam);
  const logoLibrary = requireRecordArray(byKey.get(LOGO_LIBRARY_KEY), 'custom logo library', isLogoItem);

  const namedLists = new Map<string, string[]>();
  for (const key of ARRAY_LIST_KEYS) {
    const entry = byKey.get(key);
    if (!entry) continue;
    const parsed = parseStoredJson(entry);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new Error(`Saved list "${key}" could not be validated. The original data has been left untouched.`);
    }
    namedLists.set(key, parsed);
  }

  const appState = new Map<string, unknown>();
  let settings: AppSettings | Record<string, unknown> | null = null;
  let liveGame: Game | null = null;
  for (const key of SINGLE_VALUE_KEYS) {
    const entry = byKey.get(key);
    if (!entry) continue;
    const parsed = parseStoredJson(entry);
    if (key === STORAGE_KEYS.SETTINGS) {
      if (!isRecord(parsed)) throw new Error('Saved settings could not be validated. The original data has been left untouched.');
      settings = parsed as AppSettings | Record<string, unknown>;
    } else if (key === STORAGE_KEYS.LIVE_GAME) {
      if (parsed !== null && !isGame(parsed)) {
        throw new Error('The saved live game could not be validated. The original data has been left untouched.');
      }
      liveGame = parsed as Game | null;
    } else if (
      (key === STORAGE_KEYS.EDITING_GAME_ID || key === STORAGE_KEYS.REOPENED_GAME_ID) &&
      parsed !== null && typeof parsed !== 'string'
    ) {
      throw new Error(`Saved game reference "${key}" could not be validated. The original data has been left untouched.`);
    } else if (key === STORAGE_KEYS.SETUP_COMPLETED && typeof parsed !== 'boolean') {
      throw new Error('The saved setup-completed flag could not be validated. The original data has been left untouched.');
    }
    appState.set(key, parsed);
  }

  const warnings: string[] = [];
  const knownKeys = new Set<string>([
    STORAGE_KEYS.GAMES, STORAGE_KEYS.PROFILES, ...SINGLE_VALUE_KEYS, ...ARRAY_LIST_KEYS,
    UPCOMING_GAMES_KEY, OPPOSITION_TEAMS_KEY, LOGO_LIBRARY_KEY,
  ]);
  const unsupportedKnown = entries.filter((entry) => knownKeys.has(entry.key) && entry.value.length === 0);
  if (unsupportedKnown.length) {
    warnings.push('One or more recognised storage keys contain empty values; their exact values will be retained in the legacy copy.');
  }

  return {
    entries, games, profiles, settings, liveGame, upcomingGames, oppositionTeams, logoLibrary,
    namedLists, appState,
    audit: {
      sourceKeyCount: entries.length,
      sourceCharacterCount: entries.reduce((total, entry) => total + entry.value.length, 0),
      gameCount: games.length,
      playCount: games.reduce((total, game) => total + game.plays.length, 0),
      profileCount: profiles.length,
      upcomingGameCount: upcomingGames.length,
      oppositionTeamCount: oppositionTeams.length,
      logoCount: logoLibrary.length,
      warnings,
    },
  };
}

async function readRows(
  database: SQLiteDBConnection,
  sql: string,
  values: (string | number | null)[] = [],
): Promise<Record<string, unknown>[]> {
  const result = await database.query(sql, values);
  return (result.values ?? []) as Record<string, unknown>[];
}

async function verifyRows(
  database: SQLiteDBConnection,
  table: string,
  keyColumn: string,
  valueColumn: string,
  expected: Map<string, string>,
): Promise<void> {
  const rows = await readRows(database, `SELECT ${keyColumn}, ${valueColumn} FROM ${table}`);
  if (rows.length !== expected.size) throw new Error(`SQLite verification failed for ${table}: row count differs from source.`);
  for (const row of rows) {
    const key = row[keyColumn];
    const value = row[valueColumn];
    if (typeof key !== 'string' || typeof value !== 'string' || expected.get(key) !== value) {
      throw new Error(`SQLite verification failed for ${table}: saved content differs from source.`);
    }
  }
}

/**
 * Read-only preflight for the legacy localStorage importer. It validates recognised
 * data and returns counts without writing to either storage system.
 */
export function auditLegacyStorage(): LegacyStorageAudit {
  return validateSnapshot(readAllLocalStorage()).audit;
}

/**
 * One-time, transactional copy of the current localStorage snapshot into SQLite.
 * Every source string is retained exactly in legacy_values. Recognised records are
 * also projected into typed tables, verified before the marker is written, and the
 * original localStorage keys are never removed or changed.
 *
 * This function is intentionally not called by GameContext until the coordinated
 * read/write cutover is ready; calling it manually does not switch the live store.
 */
export async function importLegacyStorageSnapshot(): Promise<LegacyStorageAudit> {
  const snapshot = validateSnapshot(readAllLocalStorage());
  const fingerprint = sourceFingerprint(snapshot.entries);
  await initializeSQLiteDatabase();

  await withSQLiteTransaction(async (database) => {
    const marker = await database.query(
      'SELECT value FROM app_meta WHERE key = ?',
      [IMPORT_MARKER],
    );
    const existingFingerprint = marker.values?.[0]?.value;
    if (typeof existingFingerprint === 'string') {
      if (existingFingerprint !== fingerprint) {
        throw new Error(
          'A SQLite legacy snapshot already exists, but the current local storage has changed. No data was changed; an explicit recovery/reconciliation decision is required before retrying.',
        );
      }
      // The prior transaction verified every projection before recording this exact
      // fingerprint. A retry is a no-op, including after a web-store flush error.
      return;
    }

    for (const table of [
      'games', 'profiles', 'named_lists', 'opposition_teams',
      'upcoming_games', 'logo_library', 'app_state', 'legacy_values',
    ]) {
      await database.run(`DELETE FROM ${table}`, [], false);
    }

    for (const entry of snapshot.entries) {
      await database.run(
        'INSERT INTO legacy_values (key, value) VALUES (?, ?)',
        [entry.key, entry.value],
        false,
      );
    }

    const gameExpected = new Map<string, string>();
    for (const game of snapshot.games) {
      const json = JSON.stringify(game);
      await database.run(
        'INSERT INTO games (id, value_json, updated_at) VALUES (?, ?, ?)',
        [game.id, json, typeof game.date === 'string' ? game.date : null],
        false,
      );
      gameExpected.set(game.id, json);
    }

    const profileExpected = new Map<string, string>();
    for (const profile of snapshot.profiles) {
      const json = JSON.stringify(profile);
      await database.run(
        'INSERT INTO profiles (id, value_json) VALUES (?, ?)',
        [profile.id, json],
        false,
      );
      profileExpected.set(profile.id, json);
    }

    const namedListExpected = new Map<string, string>();
    for (const [key, list] of snapshot.namedLists) {
      const json = JSON.stringify(list);
      await database.run(
        'INSERT INTO named_lists (key, value_json) VALUES (?, ?)',
        [key, json],
        false,
      );
      namedListExpected.set(key, json);
    }

    const oppositionExpected = new Map<string, string>();
    for (const team of snapshot.oppositionTeams) {
      const json = JSON.stringify(team);
      await database.run(
        'INSERT INTO opposition_teams (id, value_json) VALUES (?, ?)',
        [team.id, json],
        false,
      );
      oppositionExpected.set(team.id, json);
    }

    const upcomingExpected = new Map<string, string>();
    for (const game of snapshot.upcomingGames) {
      const json = JSON.stringify(game);
      await database.run(
        'INSERT INTO upcoming_games (id, value_json) VALUES (?, ?)',
        [String(game.id), json],
        false,
      );
      upcomingExpected.set(String(game.id), json);
    }

    const logoExpected = new Map<string, string>();
    for (const logo of snapshot.logoLibrary) {
      const json = JSON.stringify(logo);
      await database.run(
        'INSERT INTO logo_library (id, value_json) VALUES (?, ?)',
        [logo.id, json],
        false,
      );
      logoExpected.set(logo.id, json);
    }

    const appStateExpected = new Map<string, string>();
    for (const [key, value] of snapshot.appState) {
      const json = JSON.stringify(value);
      await database.run(
        'INSERT INTO app_state (key, value_json) VALUES (?, ?)',
        [key, json],
        false,
      );
      appStateExpected.set(key, json);
    }

    await verifyRows(database, 'games', 'id', 'value_json', gameExpected);
    await verifyRows(database, 'profiles', 'id', 'value_json', profileExpected);
    await verifyRows(database, 'named_lists', 'key', 'value_json', namedListExpected);
    await verifyRows(database, 'opposition_teams', 'id', 'value_json', oppositionExpected);
    await verifyRows(database, 'upcoming_games', 'id', 'value_json', upcomingExpected);
    await verifyRows(database, 'logo_library', 'id', 'value_json', logoExpected);
    await verifyRows(database, 'app_state', 'key', 'value_json', appStateExpected);

    const sourceRows = await readRows(database, 'SELECT key, value FROM legacy_values');
    if (sourceRows.length !== snapshot.entries.length) {
      throw new Error('SQLite verification failed: not all original storage keys were copied.');
    }
    const sourceMap = new Map(snapshot.entries.map((entry) => [entry.key, entry.value]));
    for (const row of sourceRows) {
      if (typeof row.key !== 'string' || typeof row.value !== 'string' || sourceMap.get(row.key) !== row.value) {
        throw new Error('SQLite verification failed: an original storage value changed during import.');
      }
    }

    await database.run(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [IMPORT_MARKER, fingerprint],
      false,
    );
  });

  return snapshot.audit;
}

/** True only after the import transaction and web-store flush have completed. */
export async function isLegacyStorageImportComplete(): Promise<boolean> {
  const database = await initializeSQLiteDatabase();
  const result = await database.query(
    'SELECT value FROM app_meta WHERE key = ?',
    [IMPORT_MARKER],
  );
  return typeof result.values?.[0]?.value === 'string' && result.values[0].value.length > 0;
}

/** Exposed for a future startup gate to make the marker name stable and explicit. */
export const LEGACY_STORAGE_IMPORT_MARKER = IMPORT_MARKER;
