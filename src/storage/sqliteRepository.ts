import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { AppSettings, Game, PlayerProfile } from '../types/baseball';
import type { OppositionTeam } from '../context/gameContextTypes';
import type { TeamLogoItem } from '../utils/teamLogoLibrary';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, PENDING_COMPLETED_GAME_SAVE_KEY, STORAGE_KEYS, withTeams } from '../context/gameContextDefaults';
import { sortGames } from '../utils/stats';
import { getSQLiteDatabase, initializeSQLiteDatabase, withSQLiteRead, withSQLiteTransaction } from './sqliteDatabase';

const SNAPSHOT_MARKER = 'legacy_storage_snapshot_v1';
const CUTOVER_MARKER = 'legacy_storage_import_v1';
const LIVE_STATE_MARKER = 'live_state_snapshot_v1';
const LOCAL_CUTOVER_MARKER = 'dugoutPulse.sqliteCutover.v1';

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

function serializeJson(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== 'string') {
    throw new Error('A saved value could not be serialised for SQLite.');
  }
  return serialized;
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
    typeof value.date === 'string' && (value.isHome === undefined || typeof value.isHome === 'boolean');
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
  return serializeJson(normalise(value));
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
      playCount: games.reduce((total, game) => total + (Array.isArray(game.plays) ? game.plays.length : 0), 0),
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
 * Transactionally copy the current localStorage snapshot into SQLite while the
 * legacy store remains authoritative. Every source string is retained exactly in
 * legacy_values; typed projections are verified before the snapshot marker is set.
 * Original localStorage keys are never removed or changed by this importer.
 *
 * The guarded startup path invokes this only before cutover, then separately verifies
 * the snapshot, creates a recovery checkpoint, and commits a complete live-state
 * snapshot with the cutover marker. Importing alone never switches authority.
 */
export async function importLegacyStorageSnapshot(): Promise<LegacyStorageAudit> {
  const snapshot = validateSnapshot(readAllLocalStorage());
  const fingerprint = sourceFingerprint(snapshot.entries);
  await initializeSQLiteDatabase();

  // Before cutover, localStorage remains authoritative. If it changed since the
  // last import, only refresh after proving the prior SQLite snapshot itself is
  // intact and confirming no live-state writer has begun using the typed tables.
  const priorMarker = await getSQLiteDatabase().query(
    'SELECT value FROM app_meta WHERE key = ?',
    [SNAPSHOT_MARKER],
  );
  const priorFingerprint = priorMarker.values?.[0]?.value;
  let verifiedPriorFingerprint: string | null = null;
  if (typeof priorFingerprint === 'string' && priorFingerprint !== fingerprint) {
    const cutover = await getSQLiteDatabase().query(
      'SELECT value FROM app_meta WHERE key = ?',
      [CUTOVER_MARKER],
    );
    const liveState = await getSQLiteDatabase().query(
      'SELECT value FROM app_meta WHERE key = ?',
      [LIVE_STATE_MARKER],
    );
    if (cutover.values?.[0]?.value === 'complete' || liveState.values?.[0]?.value === '1') {
      throw new Error(
        'The SQLite snapshot differs from local storage after live-state persistence began. Import stopped without changing either copy.',
      );
    }
    await readVerifiedSQLiteSnapshot({ requireCurrentSourceMatch: false });
    verifiedPriorFingerprint = priorFingerprint;
  }

  await withSQLiteTransaction(async (database) => {
    const cutover = await database.query(
      'SELECT value FROM app_meta WHERE key = ?',
      [CUTOVER_MARKER],
    );
    if (cutover.values?.[0]?.value === 'complete') {
      throw new Error(
        'SQLite is already marked as the live storage. The legacy snapshot importer is disabled to protect newer SQLite data.',
      );
    }

    const marker = await database.query(
      'SELECT value FROM app_meta WHERE key = ?',
      [SNAPSHOT_MARKER],
    );
    const existingFingerprint = marker.values?.[0]?.value;
    if (typeof existingFingerprint === 'string') {
      if (existingFingerprint === fingerprint) {
        // The prior transaction verified every projection before recording this exact
        // fingerprint. A retry is a no-op, including after a web-store flush error.
        return;
      }
      if (!verifiedPriorFingerprint || existingFingerprint !== verifiedPriorFingerprint) {
        throw new Error(
          'A SQLite legacy snapshot already exists, but its previous contents could not be safely reconciled. No data was changed.',
        );
      }
      const liveState = await database.query(
        'SELECT value FROM app_meta WHERE key = ?',
        [LIVE_STATE_MARKER],
      );
      if (liveState.values?.[0]?.value === '1') {
        throw new Error('SQLite live-state persistence has begun; the legacy snapshot cannot be refreshed.');
      }
    }

    const verifiedRefresh = typeof existingFingerprint === 'string' &&
      existingFingerprint === verifiedPriorFingerprint &&
      existingFingerprint !== fingerprint;

    if (verifiedRefresh) {
      // The prior snapshot and every typed projection were verified before entering
      // this transaction, and live-state persistence has not begun. Replace only
      // these migration-owned tables atomically; preserve app_meta and diagnostics.
      for (const table of [
        'games', 'profiles', 'named_lists', 'opposition_teams',
        'upcoming_games', 'logo_library', 'app_state', 'legacy_values',
      ]) {
        await database.run(`DELETE FROM ${table}`, [], false);
      }
    } else {
      // Never clear rows from an unmarked database: they may be data from a partial
      // earlier attempt or another supported code path that needs explicit reconciliation.
      for (const table of [
        'games', 'profiles', 'named_lists', 'opposition_teams',
        'upcoming_games', 'logo_library', 'app_state', 'legacy_values',
      ]) {
        const countResult = await database.query(`SELECT COUNT(*) AS count FROM ${table}`);
        const count = countResult.values?.[0]?.count;
        if (typeof count === 'number' ? count > 0 : Number(count) > 0) {
          throw new Error(
            `SQLite table ${table} already contains data but has no verified legacy snapshot marker. Import stopped without changing existing rows.`,
          );
        }
      }
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
      const json = serializeJson(game);
      await database.run(
        'INSERT INTO games (id, value_json, updated_at) VALUES (?, ?, ?)',
        [game.id, json, typeof game.date === 'string' ? game.date : null],
        false,
      );
      gameExpected.set(game.id, json);
    }

    const profileExpected = new Map<string, string>();
    for (const profile of snapshot.profiles) {
      const json = serializeJson(profile);
      await database.run(
        'INSERT INTO profiles (id, value_json) VALUES (?, ?)',
        [profile.id, json],
        false,
      );
      profileExpected.set(profile.id, json);
    }

    const namedListExpected = new Map<string, string>();
    for (const [key, list] of snapshot.namedLists) {
      const json = serializeJson(list);
      await database.run(
        'INSERT INTO named_lists (key, value_json) VALUES (?, ?)',
        [key, json],
        false,
      );
      namedListExpected.set(key, json);
    }

    const oppositionExpected = new Map<string, string>();
    for (const team of snapshot.oppositionTeams) {
      const json = serializeJson(team);
      await database.run(
        'INSERT INTO opposition_teams (id, value_json) VALUES (?, ?)',
        [team.id, json],
        false,
      );
      oppositionExpected.set(team.id, json);
    }

    const upcomingExpected = new Map<string, string>();
    for (const game of snapshot.upcomingGames) {
      const json = serializeJson(game);
      await database.run(
        'INSERT INTO upcoming_games (id, value_json) VALUES (?, ?)',
        [String(game.id), json],
        false,
      );
      upcomingExpected.set(String(game.id), json);
    }

    const logoExpected = new Map<string, string>();
    for (const logo of snapshot.logoLibrary) {
      const json = serializeJson(logo);
      await database.run(
        'INSERT INTO logo_library (id, value_json) VALUES (?, ?)',
        [logo.id, json],
        false,
      );
      logoExpected.set(logo.id, json);
    }

    const appStateExpected = new Map<string, string>();
    for (const [key, value] of snapshot.appState) {
      const json = serializeJson(value);
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

    // localStorage is the live source until coordinated cutover. Abort if it
    // changed while this async transaction was in progress; SQLite rolls back.
    const latestFingerprint = sourceFingerprint(readAllLocalStorage());
    if (latestFingerprint !== fingerprint) {
      throw new Error(
        'Local storage changed while the SQLite snapshot was being imported. The transaction was rolled back; retry after the app is idle.',
      );
    }

    await database.run(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [SNAPSHOT_MARKER, fingerprint],
      false,
    );
  });

  return snapshot.audit;
}

/** True only after the coordinated startup path has transactionally marked SQLite authoritative. */
export async function isLegacyStorageImportComplete(): Promise<boolean> {
  const database = await initializeSQLiteDatabase();
  const result = await database.query(
    'SELECT value FROM app_meta WHERE key = ?',
    [CUTOVER_MARKER],
  );
  return result.values?.[0]?.value === 'complete';
}

/** Exported marker name for coordinated startup, reset, and recovery checks. */
export const LEGACY_STORAGE_IMPORT_MARKER = CUTOVER_MARKER;


export interface VerifiedSQLiteSnapshot {
  audit: LegacyStorageAudit;
  games: Game[];
  profiles: PlayerProfile[];
  settings: AppSettings | Record<string, unknown> | null;
  liveGame: Game | null;
  upcomingGames: Record<string, unknown>[];
  oppositionTeams: OppositionTeam[];
  logoLibrary: TeamLogoItem[];
  namedLists: Record<string, string[]>;
  appState: Record<string, unknown>;
  legacyValues: LegacyStorageEntry[];
}

/**
 * Reads a previously imported snapshot and verifies that every typed projection
 * still matches its preserved source values. This read-only pre-cutover check does
 * not make SQLite authoritative or mutate localStorage.
 */
export async function readVerifiedSQLiteSnapshot(
  options: { requireCurrentSourceMatch?: boolean } = {},
): Promise<VerifiedSQLiteSnapshot> {
  const database = await initializeSQLiteDatabase();
  const marker = await database.query(
    'SELECT value FROM app_meta WHERE key = ?',
    [SNAPSHOT_MARKER],
  );
  if (typeof marker.values?.[0]?.value !== 'string' || marker.values[0].value.length === 0) {
    throw new Error('No verified legacy storage snapshot exists in SQLite yet.');
  }

  const legacyRows = await readRows(database, 'SELECT key, value FROM legacy_values');
  const legacyValues: LegacyStorageEntry[] = legacyRows.map((row) => {
    if (typeof row.key !== 'string' || typeof row.value !== 'string') {
      throw new Error('SQLite legacy snapshot contains a malformed source row.');
    }
    return { key: row.key, value: row.value };
  }).sort((left, right) => left.key.localeCompare(right.key));

  const fingerprint = sourceFingerprint(legacyValues);
  if (marker.values[0].value !== fingerprint) {
    throw new Error('SQLite legacy source values no longer match the recorded snapshot fingerprint.');
  }
  if (options.requireCurrentSourceMatch !== false) {
    const currentSource = readAllLocalStorage();
    if (sourceFingerprint(currentSource) !== fingerprint ||
        canonicalStringify(currentSource) !== canonicalStringify(legacyValues)) {
      throw new Error('Current local storage differs from the imported SQLite snapshot. Cutover is blocked to protect changes made after import.');
    }
  }

  const snapshot = validateSnapshot(legacyValues);
  const gameExpected = new Map(snapshot.games.map((game) => [game.id, serializeJson(game)]));
  const profileExpected = new Map(snapshot.profiles.map((profile) => [profile.id, serializeJson(profile)]));
  const namedListExpected = new Map(Array.from(snapshot.namedLists, ([key, list]) => [key, serializeJson(list)]));
  const oppositionExpected = new Map(snapshot.oppositionTeams.map((team) => [team.id, serializeJson(team)]));
  const upcomingExpected = new Map(snapshot.upcomingGames.map((game) => [game.id, serializeJson(game)]));
  const logoExpected = new Map(snapshot.logoLibrary.map((logo) => [logo.id, serializeJson(logo)]));
  const appStateExpected = new Map(Array.from(snapshot.appState, ([key, value]) => [key, serializeJson(value)]));

  await verifyRows(database, 'games', 'id', 'value_json', gameExpected);
  await verifyRows(database, 'profiles', 'id', 'value_json', profileExpected);
  await verifyRows(database, 'named_lists', 'key', 'value_json', namedListExpected);
  await verifyRows(database, 'opposition_teams', 'id', 'value_json', oppositionExpected);
  await verifyRows(database, 'upcoming_games', 'id', 'value_json', upcomingExpected);
  await verifyRows(database, 'logo_library', 'id', 'value_json', logoExpected);
  await verifyRows(database, 'app_state', 'key', 'value_json', appStateExpected);

  const namedLists = Object.fromEntries(snapshot.namedLists.entries());
  const appState = Object.fromEntries(snapshot.appState.entries());
  return {
    audit: snapshot.audit,
    games: snapshot.games,
    profiles: snapshot.profiles,
    settings: snapshot.settings,
    liveGame: snapshot.liveGame,
    upcomingGames: snapshot.upcomingGames,
    oppositionTeams: snapshot.oppositionTeams,
    logoLibrary: snapshot.logoLibrary,
    namedLists,
    appState,
    legacyValues,
  };
}


export interface SQLiteLiveState {
  games: Game[];
  profiles: PlayerProfile[];
  settings: AppSettings;
  liveGame: Game | null;
  editingGameId: string | null;
  reopenedGameId: string | null;
  setupCompleted: boolean;
  savedOpponents: string[];
  savedTournaments: string[];
  savedAgeGroups: string[];
  savedSeasons: string[];
  hiddenTournaments: string[];
  hiddenAgeGroups: string[];
  hiddenSeasons: string[];
  oppositionTeams: OppositionTeam[];
  upcomingGames: (Record<string, unknown> & { id: string })[];
  logoLibrary: TeamLogoItem[];
}

/**
 * Persists core GameContext state in one SQLite transaction. The separate scheduled-
 * game and logo-library tables are included only for initial cutover or explicit
 * whole-state operations, so routine context writes cannot overwrite their own
 * independently serialized write paths.
 *
 * The legacy_values table preserves the exact source snapshot used for cutover; it
 * is not rewritten by live-state operations. Callers must create the established
 * recovery checkpoint before invoking this.
 */
export async function saveLiveSQLiteState(
  state: SQLiteLiveState,
  options: { completeCutover?: boolean; includeAuxiliary?: boolean } = {},
): Promise<void> {
  if (!Array.isArray(state.games) || !state.games.every(isGame)) {
    throw new Error('SQLite save stopped because saved games failed validation.');
  }
  if (!Array.isArray(state.profiles) || !state.profiles.every(isProfile)) {
    throw new Error('SQLite save stopped because player profiles failed validation.');
  }
  if (!isRecord(state.settings)) {
    throw new Error('SQLite save stopped because app settings failed validation.');
  }
  if (state.liveGame !== null && !isGame(state.liveGame)) {
    throw new Error('SQLite save stopped because the live game failed validation.');
  }
  if (state.editingGameId !== null && typeof state.editingGameId !== 'string') {
    throw new Error('SQLite save stopped because the editing-game reference failed validation.');
  }
  if (state.reopenedGameId !== null && typeof state.reopenedGameId !== 'string') {
    throw new Error('SQLite save stopped because the reopened-game reference failed validation.');
  }
  if (typeof state.setupCompleted !== 'boolean') {
    throw new Error('SQLite save stopped because the setup flag failed validation.');
  }
  const lists: [string, string[]][] = [
    [STORAGE_KEYS.SAVED_OPPONENTS, state.savedOpponents],
    [STORAGE_KEYS.SAVED_TOURNAMENTS, state.savedTournaments],
    [STORAGE_KEYS.SAVED_AGE_GROUPS, state.savedAgeGroups],
    [STORAGE_KEYS.SAVED_SEASONS, state.savedSeasons],
    [STORAGE_KEYS.HIDDEN_TOURNAMENTS, state.hiddenTournaments],
    [STORAGE_KEYS.HIDDEN_AGE_GROUPS, state.hiddenAgeGroups],
    [STORAGE_KEYS.HIDDEN_SEASONS, state.hiddenSeasons],
  ];
  if (lists.some(([, values]) => !Array.isArray(values) || !values.every((value) => typeof value === 'string'))) {
    throw new Error('SQLite save stopped because a saved preset list failed validation.');
  }
  if (!Array.isArray(state.oppositionTeams) || !state.oppositionTeams.every(isOppositionTeam)) {
    throw new Error('SQLite save stopped because opposition teams failed validation.');
  }
  const includeAuxiliary = options.completeCutover === true || options.includeAuxiliary === true;
  if (includeAuxiliary && (!Array.isArray(state.upcomingGames) || !state.upcomingGames.every(isUpcomingGame))) {
    throw new Error('SQLite save stopped because scheduled games failed validation.');
  }
  if (includeAuxiliary && (!Array.isArray(state.logoLibrary) || !state.logoLibrary.every(isLogoItem))) {
    throw new Error('SQLite save stopped because the logo library failed validation.');
  }

  const appState: [string, unknown][] = [
    [STORAGE_KEYS.SETTINGS, state.settings],
    [STORAGE_KEYS.LIVE_GAME, state.liveGame],
    [STORAGE_KEYS.EDITING_GAME_ID, state.editingGameId],
    [STORAGE_KEYS.REOPENED_GAME_ID, state.reopenedGameId],
    [STORAGE_KEYS.SETUP_COMPLETED, state.setupCompleted],
  ];

  // Write a durable local "pending" signal before the database transaction. If the
  // database commit succeeds but the web-store flush or final marker mirror fails,
  // the next startup must fail closed and reconcile rather than treating localStorage
  // as authoritative and overwriting newer SQLite state.
  if (options.completeCutover === true) {
    try {
      localStorage.setItem(LOCAL_CUTOVER_MARKER, 'pending');
      if (localStorage.getItem(LOCAL_CUTOVER_MARKER) !== 'pending') {
        throw new Error('The pending SQLite cutover marker failed read-back verification.');
      }
    } catch (error) {
      throw new Error('SQLite cutover was not started because its safety marker could not be verified. ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  try {
    await withSQLiteTransaction(async (database) => {
      const imported = await database.query(
        'SELECT value FROM app_meta WHERE key = ?',
        [SNAPSHOT_MARKER],
      );
      if (typeof imported.values?.[0]?.value !== 'string') {
        throw new Error('SQLite live-state write was blocked because no verified legacy snapshot exists yet.');
      }
      if (options.completeCutover === true) {
        const existingCutover = await database.query(
          'SELECT value FROM app_meta WHERE key = ?',
          [CUTOVER_MARKER],
        );
        if (existingCutover.values?.[0]?.value === 'complete') {
          throw new Error('SQLite cutover was already completed elsewhere. Startup must read the existing live state instead of overwriting it.');
        }
      }

      const tables = [
      'games', 'profiles', 'named_lists', 'opposition_teams', 'app_state',
      ...(includeAuxiliary ? ['upcoming_games', 'logo_library'] : []),
    ];
    for (const table of tables) {
      await database.run(`DELETE FROM ${table}`, [], false);
    }

    const expectedGames = new Map<string, string>();
    for (const game of state.games) {
      const value = serializeJson(game);
      await database.run(
        'INSERT INTO games (id, value_json, updated_at) VALUES (?, ?, ?)',
        [game.id, value, typeof game.date === 'string' ? game.date : null],
        false,
      );
      expectedGames.set(game.id, value);
    }

    const expectedProfiles = new Map<string, string>();
    for (const profile of state.profiles) {
      const value = serializeJson(profile);
      await database.run('INSERT INTO profiles (id, value_json) VALUES (?, ?)', [profile.id, value], false);
      expectedProfiles.set(profile.id, value);
    }

    const expectedLists = new Map<string, string>();
    for (const [key, list] of lists) {
      const value = serializeJson(list);
      await database.run('INSERT INTO named_lists (key, value_json) VALUES (?, ?)', [key, value], false);
      expectedLists.set(key, value);
    }

    const expectedOpposition = new Map<string, string>();
    for (const team of state.oppositionTeams) {
      const value = serializeJson(team);
      await database.run('INSERT INTO opposition_teams (id, value_json) VALUES (?, ?)', [team.id, value], false);
      expectedOpposition.set(team.id, value);
    }

    if (includeAuxiliary) {
      const expectedUpcoming = new Map<string, string>();
      for (const game of state.upcomingGames) {
        const value = serializeJson(game);
        await database.run('INSERT INTO upcoming_games (id, value_json) VALUES (?, ?)', [game.id, value], false);
        expectedUpcoming.set(game.id, value);
      }
      await verifyRows(database, 'upcoming_games', 'id', 'value_json', expectedUpcoming);

      const expectedLogos = new Map<string, string>();
      for (const logo of state.logoLibrary) {
        const value = serializeJson(logo);
        await database.run('INSERT INTO logo_library (id, value_json) VALUES (?, ?)', [logo.id, value], false);
        expectedLogos.set(logo.id, value);
      }
      await verifyRows(database, 'logo_library', 'id', 'value_json', expectedLogos);
    }

    const expectedAppState = new Map<string, string>();
    for (const [key, value] of appState) {
      const serialized = serializeJson(value);
      await database.run('INSERT INTO app_state (key, value_json) VALUES (?, ?)', [key, serialized], false);
      expectedAppState.set(key, serialized);
    }

    await verifyRows(database, 'games', 'id', 'value_json', expectedGames);
    await verifyRows(database, 'profiles', 'id', 'value_json', expectedProfiles);
    await verifyRows(database, 'named_lists', 'key', 'value_json', expectedLists);
    await verifyRows(database, 'opposition_teams', 'id', 'value_json', expectedOpposition);
    await verifyRows(database, 'app_state', 'key', 'value_json', expectedAppState);

    await database.run(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [LIVE_STATE_MARKER, '1'],
      false,
    );
      if (options.completeCutover === true) {
        await database.run(
          'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          [CUTOVER_MARKER, 'complete'],
          false,
        );
      }
    });
  } catch (error) {
    if (options.completeCutover === true) {
      // Clear "pending" only when SQLite definitively did not commit cutover.
      // If the database cannot be inspected, keep it so startup stops safely.
      try {
        if (!(await isLegacyStorageImportComplete())) {
          localStorage.removeItem(LOCAL_CUTOVER_MARKER);
          if (localStorage.getItem(LOCAL_CUTOVER_MARKER) !== null) {
            throw new Error('The pending SQLite cutover marker could not be cleared after a failed transaction.');
          }
        }
      } catch {
        // Retaining "pending" is the safe outcome when transaction status is uncertain.
      }
    }
    throw error;
  }

  if (options.completeCutover === true) {
    try {
      localStorage.setItem(LOCAL_CUTOVER_MARKER, 'complete');
      if (localStorage.getItem(LOCAL_CUTOVER_MARKER) !== 'complete') {
        throw new Error('SQLite cutover marker mirror failed read-back verification.');
      }
    } catch (error) {
      throw new Error('SQLite was committed for cutover, but the local cutover marker could not be verified. Startup must reconcile storage before continuing. ' + (error instanceof Error ? error.message : String(error)));
    }
  }
}

function parseLiveRows<T>(
  rows: Record<string, unknown>[],
  table: string,
  validate: (value: unknown) => value is T,
  keyColumn?: string,
): T[] {
  return rows.map((row) => {
    if (typeof row.value_json !== 'string') {
      throw new Error(`SQLite live state in ${table} contains a malformed row.`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value_json) as unknown;
    } catch {
      throw new Error(`SQLite live state in ${table} contains invalid JSON.`);
    }
    if (!validate(parsed)) {
      throw new Error(`SQLite live state in ${table} failed validation.`);
    }
    if (keyColumn) {
      const rowKey = row[keyColumn];
      const recordKey = parsed && typeof parsed === 'object' && 'id' in parsed
        ? (parsed as { id?: unknown }).id
        : undefined;
      if (typeof rowKey !== 'string' || rowKey !== recordKey) {
        throw new Error(`SQLite live state in ${table} has a mismatched record ID.`);
      }
    }
    return parsed;
  });
}

/** Reads the last complete live-state transaction; never falls back to empty defaults. */
export async function readLiveSQLiteState(): Promise<SQLiteLiveState> {
  return withSQLiteRead(async (database) => {
  const marker = await database.query(
    'SELECT value FROM app_meta WHERE key = ?',
    [LIVE_STATE_MARKER],
  );
  if (marker.values?.[0]?.value !== '1') {
    throw new Error('No complete live SQLite state snapshot is available yet.');
  }

  const [gameRows, profileRows, listRows, oppositionRows, upcomingRows, logoRows, appStateRows] = await Promise.all([
    readRows(database, 'SELECT id, value_json FROM games'),
    readRows(database, 'SELECT id, value_json FROM profiles'),
    readRows(database, 'SELECT key, value_json FROM named_lists'),
    readRows(database, 'SELECT id, value_json FROM opposition_teams'),
    readRows(database, 'SELECT id, value_json FROM upcoming_games'),
    readRows(database, 'SELECT id, value_json FROM logo_library'),
    readRows(database, 'SELECT key, value_json FROM app_state'),
  ]);

  const games = parseLiveRows(gameRows, 'games', isGame, 'id');
  const profiles = parseLiveRows(profileRows, 'profiles', isProfile, 'id');
  const oppositionTeams = parseLiveRows(oppositionRows, 'opposition_teams', isOppositionTeam, 'id');
  const upcomingGames = parseLiveRows(upcomingRows, 'upcoming_games', isUpcomingGame, 'id');
  const logoLibrary = parseLiveRows(logoRows, 'logo_library', isLogoItem, 'id');

  const namedLists = new Map<string, string[]>();
  for (const row of listRows) {
    if (typeof row.key !== 'string' || typeof row.value_json !== 'string') {
      throw new Error('SQLite live state in named_lists contains a malformed row.');
    }
    const value: unknown = JSON.parse(row.value_json);
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
      throw new Error('SQLite live state in named_lists failed validation.');
    }
    namedLists.set(row.key, value);
  }

  const appState = new Map<string, unknown>();
  for (const row of appStateRows) {
    if (typeof row.key !== 'string' || typeof row.value_json !== 'string') {
      throw new Error('SQLite live state in app_state contains a malformed row.');
    }
    appState.set(row.key, JSON.parse(row.value_json) as unknown);
  }

  const settings = appState.get(STORAGE_KEYS.SETTINGS);
  const liveGame = appState.get(STORAGE_KEYS.LIVE_GAME);
  const editingGameId = appState.get(STORAGE_KEYS.EDITING_GAME_ID);
  const reopenedGameId = appState.get(STORAGE_KEYS.REOPENED_GAME_ID);
  const setupCompleted = appState.get(STORAGE_KEYS.SETUP_COMPLETED);
  if (!isRecord(settings) || (liveGame !== null && !isGame(liveGame)) ||
      (editingGameId !== null && typeof editingGameId !== 'string') ||
      (reopenedGameId !== null && typeof reopenedGameId !== 'string') ||
      typeof setupCompleted !== 'boolean') {
    throw new Error('SQLite live app state is incomplete or failed validation.');
  }

  const getList = (key: string): string[] => {
    const value = namedLists.get(key);
    if (!value) throw new Error(`SQLite live state is missing the saved list ${key}.`);
    return value;
  };

  return {
    games,
    profiles,
    settings: settings as AppSettings,
    liveGame: liveGame as Game | null,
    editingGameId: editingGameId as string | null,
    reopenedGameId: reopenedGameId as string | null,
    setupCompleted,
    savedOpponents: getList(STORAGE_KEYS.SAVED_OPPONENTS),
    savedTournaments: getList(STORAGE_KEYS.SAVED_TOURNAMENTS),
    savedAgeGroups: getList(STORAGE_KEYS.SAVED_AGE_GROUPS),
    savedSeasons: getList(STORAGE_KEYS.SAVED_SEASONS),
    hiddenTournaments: getList(STORAGE_KEYS.HIDDEN_TOURNAMENTS),
    hiddenAgeGroups: getList(STORAGE_KEYS.HIDDEN_AGE_GROUPS),
    hiddenSeasons: getList(STORAGE_KEYS.HIDDEN_SEASONS),
    oppositionTeams,
    upcomingGames,
    logoLibrary,
  };
  });
}



/**
 * Convert a fully restored, validated compatibility store into the live SQLite
 * shape. Used by the recovery journal only after it has verified every restored
 * key and logo file; legacy_values remains the exact source snapshot captured at cutover.
 */
export async function saveLiveSQLiteStateFromCurrentLocalStorage(): Promise<void> {
  if (!(await isLegacyStorageImportComplete())) {
    throw new Error('SQLite recovery restore was blocked because SQLite is not the active storage store.');
  }
  const snapshot = validateSnapshot(readAllLocalStorage());
  const appState = snapshot.appState;
  const setupCompleted = appState.get(STORAGE_KEYS.SETUP_COMPLETED) === true;
  const editingGameId = appState.get(STORAGE_KEYS.EDITING_GAME_ID);
  const reopenedGameId = appState.get(STORAGE_KEYS.REOPENED_GAME_ID);
  const settings = snapshot.settings;
  await saveLiveSQLiteState({
    games: sortGames(snapshot.games, 'oldestFirst'),
    profiles: snapshot.profiles.length > 0 ? snapshot.profiles.map(withTeams) : [DEFAULT_PROFILE],
    settings: { ...DEFAULT_SETTINGS, ...(settings || {}) } as AppSettings,
    liveGame: snapshot.liveGame,
    editingGameId: typeof editingGameId === 'string' ? editingGameId : null,
    reopenedGameId: typeof reopenedGameId === 'string' ? reopenedGameId : null,
    setupCompleted,
    savedOpponents: snapshot.namedLists.get(STORAGE_KEYS.SAVED_OPPONENTS) || [],
    savedTournaments: snapshot.namedLists.get(STORAGE_KEYS.SAVED_TOURNAMENTS) || [],
    savedAgeGroups: snapshot.namedLists.get(STORAGE_KEYS.SAVED_AGE_GROUPS) || [],
    savedSeasons: snapshot.namedLists.get(STORAGE_KEYS.SAVED_SEASONS) || [],
    hiddenTournaments: snapshot.namedLists.get(STORAGE_KEYS.HIDDEN_TOURNAMENTS) || [],
    hiddenAgeGroups: snapshot.namedLists.get(STORAGE_KEYS.HIDDEN_AGE_GROUPS) || [],
    hiddenSeasons: snapshot.namedLists.get(STORAGE_KEYS.HIDDEN_SEASONS) || [],
    oppositionTeams: snapshot.oppositionTeams,
    upcomingGames: snapshot.upcomingGames as SQLiteLiveState['upcomingGames'],
    logoLibrary: snapshot.logoLibrary,
  }, { includeAuxiliary: true });
}


const SQLITE_UI_STATE_KEYS = new Set([
  'dugout_pulse_resume_ui_v1',
  'dugout_pulse_runner_workflow_v1',
]);

/** Read durable scoring-screen preferences from SQLite app_state. */
export async function readSQLiteAppStateValue<T>(key: string, fallback: T): Promise<T> {
  if (!SQLITE_UI_STATE_KEYS.has(key)) throw new Error('The requested SQLite app-state key is not an approved UI-state key.');
  if (!(await isLegacyStorageImportComplete())) throw new Error('SQLite is not yet authoritative for scoring UI state.');
  return withSQLiteRead(async (database) => {
    const result = await database.query('SELECT value_json FROM app_state WHERE key = ?', [key]);
    const raw = result.values?.[0]?.value_json;
    if (typeof raw !== 'string') return fallback;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new Error(`SQLite scoring UI state for "${key}" contains invalid JSON.`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`SQLite scoring UI state for "${key}" failed validation.`);
    }
    return parsed as T;
  });
}

/** Persist durable scoring-screen preferences in SQLite, never in localStorage. */
export async function saveSQLiteAppStateValue(key: string, value: unknown): Promise<void> {
  if (!SQLITE_UI_STATE_KEYS.has(key)) throw new Error('The requested SQLite app-state key is not an approved UI-state key.');
  if (localStorage.getItem(LOCAL_CUTOVER_MARKER) !== 'complete') {
    throw new Error('SQLite is not authoritative yet; scoring UI state was not saved.');
  }
  const serialized = serializeJson(value);
  await withSQLiteTransaction(async (database) => {
    const cutover = await database.query('SELECT value FROM app_meta WHERE key = ?', [CUTOVER_MARKER]);
    const liveState = await database.query('SELECT value FROM app_meta WHERE key = ?', [LIVE_STATE_MARKER]);
    if (cutover.values?.[0]?.value !== 'complete' || liveState.values?.[0]?.value !== '1') {
      throw new Error('Scoring UI state was not saved because SQLite cutover/live-state verification failed.');
    }
    await database.run(
      'INSERT INTO app_state (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json',
      [key, serialized],
      false,
    );
    const verified = await database.query('SELECT value_json FROM app_state WHERE key = ?', [key]);
    if (verified.values?.[0]?.value_json !== serialized) {
      throw new Error('SQLite scoring UI state failed read-back verification.');
    }
  });
}

/** Read independently managed auxiliary tables without reloading the entire app state. */
export async function readSQLiteAuxiliaryState(): Promise<Pick<SQLiteLiveState, 'upcomingGames' | 'logoLibrary'>> {
  if (!(await isLegacyStorageImportComplete())) {
    throw new Error('SQLite is not yet authoritative for auxiliary application data.');
  }
  return withSQLiteRead(async (database) => {
    const [upcomingRows, logoRows] = await Promise.all([
      readRows(database, 'SELECT id, value_json FROM upcoming_games'),
      readRows(database, 'SELECT id, value_json FROM logo_library'),
    ]);
    return {
      upcomingGames: parseLiveRows(upcomingRows, 'upcoming_games', isUpcomingGame, 'id'),
      logoLibrary: parseLiveRows(logoRows, 'logo_library', isLogoItem, 'id'),
    };
  });
}

/** Read scheduled games from the authoritative SQLite table after cutover. */
export async function readSQLiteUpcomingGames(): Promise<(Record<string, unknown> & { id: string })[]> {
  if (!(await isLegacyStorageImportComplete())) {
    throw new Error('SQLite is not yet authoritative for scheduled games.');
  }
  return withSQLiteRead(async (database) => {
    const rows = await readRows(database, 'SELECT id, value_json FROM upcoming_games');
    return parseLiveRows(rows, 'upcoming_games', isUpcomingGame, 'id');
  });
}

/** Read custom-logo metadata from SQLite; image bytes remain in Capacitor Filesystem. */
export async function readSQLiteLogoLibrary(): Promise<TeamLogoItem[]> {
  if (!(await isLegacyStorageImportComplete())) {
    throw new Error('SQLite is not yet authoritative for the custom-logo library.');
  }
  return withSQLiteRead(async (database) => {
    const rows = await readRows(database, 'SELECT id, value_json FROM logo_library');
    return parseLiveRows(rows, 'logo_library', isLogoItem, 'id');
  });
}

/** Updates scheduled games transactionally in the authoritative SQLite store. */
export async function saveSQLiteUpcomingGames(
  games: (Record<string, unknown> & { id: string })[],
): Promise<void> {
  if (!Array.isArray(games) || !games.every(isUpcomingGame)) {
    throw new Error('SQLite save stopped because scheduled games failed validation.');
  }
  if (localStorage.getItem(LOCAL_CUTOVER_MARKER) !== 'complete') {
    throw new Error('SQLite is not authoritative yet; scheduled-game changes were not saved.');
  }
  await withSQLiteTransaction(async (database) => {
    const cutover = await database.query(
      'SELECT value FROM app_meta WHERE key = ?',
      [CUTOVER_MARKER],
    );
    if (cutover.values?.[0]?.value !== 'complete') {
      throw new Error('Scheduled games were not saved because the SQLite cutover marker is missing.');
    }
    await database.run('DELETE FROM upcoming_games', [], false);
    const expected = new Map<string, string>();
    for (const game of games) {
      const value = serializeJson(game);
      await database.run('INSERT INTO upcoming_games (id, value_json) VALUES (?, ?)', [game.id, value], false);
      expected.set(game.id, value);
    }
    await verifyRows(database, 'upcoming_games', 'id', 'value_json', expected);
  });
}

/** Updates logo metadata transactionally after cutover; image bytes remain in Capacitor Filesystem. */
export async function saveSQLiteLogoLibrary(library: TeamLogoItem[]): Promise<void> {
  if (!Array.isArray(library) || !library.every(isLogoItem)) {
    throw new Error('SQLite save stopped because the logo library failed validation.');
  }
  if (localStorage.getItem(LOCAL_CUTOVER_MARKER) !== 'complete') {
    throw new Error('SQLite is not authoritative yet; custom-logo metadata was not saved.');
  }
  await withSQLiteTransaction(async (database) => {
    const cutover = await database.query(
      'SELECT value FROM app_meta WHERE key = ?',
      [CUTOVER_MARKER],
    );
    if (cutover.values?.[0]?.value !== 'complete') {
      throw new Error('Logo metadata was not saved because the SQLite cutover marker is missing.');
    }
    await database.run('DELETE FROM logo_library', [], false);
    const expected = new Map<string, string>();
    for (const logo of library) {
      const value = serializeJson(logo);
      await database.run('INSERT INTO logo_library (id, value_json) VALUES (?, ?)', [logo.id, value], false);
      expected.set(logo.id, value);
    }
    await verifyRows(database, 'logo_library', 'id', 'value_json', expected);
  });
}

/**
 * Persist a scoring action's live-game snapshot immediately after its verified
 * write-ahead mirror. The shared SQLite transaction queue preserves action order
 * relative to complete GameContext snapshots. Returns false before cutover, when
 * localStorage is still the authoritative store.
 */
/**
 * Commit a completed game and clear its live/editing references in one transaction.
 * Returns false while localStorage is still the pre-cutover authoritative store.
 */
export async function saveCompletedSQLiteGame(game: Game): Promise<boolean> {
  if (!isGame(game)) {
    throw new Error('SQLite completed-game write was blocked because the game failed validation.');
  }

  const localCutover = localStorage.getItem(LOCAL_CUTOVER_MARKER);
  if (localCutover !== 'complete' && localCutover !== 'pending') return false;

  const serializedGame = serializeJson(game);
  const pendingSave = serializeJson({ version: 1, game });
  try {
    const existingPendingSave = localStorage.getItem(PENDING_COMPLETED_GAME_SAVE_KEY);
    if (existingPendingSave !== null && existingPendingSave !== pendingSave) {
      throw new Error('Another completed-game save is awaiting recovery; the new save was stopped to protect saved data.');
    }
    if (existingPendingSave === null) {
      localStorage.setItem(PENDING_COMPLETED_GAME_SAVE_KEY, pendingSave);
    }
    if (localStorage.getItem(PENDING_COMPLETED_GAME_SAVE_KEY) !== pendingSave) {
      throw new Error('The completed-game recovery marker failed read-back verification.');
    }
  } catch (error) {
    throw new Error('The completed game was not changed because its recovery marker could not be verified. ' + (error instanceof Error ? error.message : String(error)));
  }

  return withSQLiteTransaction(async (database) => {
    const cutover = await database.query(
      'SELECT value FROM app_meta WHERE key = ?',
      [CUTOVER_MARKER],
    );
    if (cutover.values?.[0]?.value !== 'complete') {
      if (localStorage.getItem(LOCAL_CUTOVER_MARKER) !== null) {
        throw new Error('SQLite and local storage disagree about cutover; the completed game was not changed.');
      }
      return false;
    }

    const liveState = await database.query(
      'SELECT value FROM app_meta WHERE key = ?',
      [LIVE_STATE_MARKER],
    );
    if (liveState.values?.[0]?.value !== '1') {
      throw new Error('SQLite completed-game write was blocked because no complete live-state snapshot is available.');
    }

    await database.run(
      'INSERT INTO games (id, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at',
      [game.id, serializedGame, typeof game.date === 'string' ? game.date : null],
      false,
    );
    const clearedState: [string, string][] = [
      [STORAGE_KEYS.LIVE_GAME, 'null'],
      [STORAGE_KEYS.EDITING_GAME_ID, 'null'],
      [STORAGE_KEYS.REOPENED_GAME_ID, 'null'],
    ];
    for (const [key, value] of clearedState) {
      await database.run(
        'INSERT INTO app_state (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json',
        [key, value],
        false,
      );
    }

    const saved = await database.query(
      'SELECT value_json FROM games WHERE id = ?',
      [game.id],
    );
    if (saved.values?.[0]?.value_json !== serializedGame) {
      throw new Error('SQLite completed-game write failed read-back verification.');
    }
    for (const [key, expected] of clearedState) {
      const result = await database.query(
        'SELECT value_json FROM app_state WHERE key = ?',
        [key],
      );
      if (result.values?.[0]?.value_json !== expected) {
        throw new Error('SQLite could not verify the completed-game live-state transition.');
      }
    }
    return true;
  });
}

export async function saveSQLiteLiveGame(game: Game | null): Promise<boolean> {
  // Do not initialize/open SQLite for ordinary scoring before cutover. Until the
  // local authority marker is present, the legacy store remains the intended writer.
  // "pending" is not accepted as authority; it is inspected below and fails closed
  // if the database does not independently confirm a completed cutover.
  const localCutover = localStorage.getItem(LOCAL_CUTOVER_MARKER);
  if (localCutover !== 'complete' && localCutover !== 'pending') return false;

  if (game !== null && !isGame(game)) {
    throw new Error('SQLite live-game write was blocked because the game failed validation.');
  }
  const value = serializeJson(game);
  return withSQLiteTransaction(async (database) => {
    const cutover = await database.query(
      'SELECT value FROM app_meta WHERE key = ?',
      [CUTOVER_MARKER],
    );
    if (cutover.values?.[0]?.value !== 'complete') {
      // Before cutover, localStorage is intentionally authoritative. Once a local
      // cutover signal exists, a missing database marker is a split-brain condition;
      // fail closed and retain the scoring journal for startup reconciliation.
      if (localStorage.getItem(LOCAL_CUTOVER_MARKER) !== null) {
        throw new Error('SQLite and local storage disagree about cutover; the live-game write was stopped for recovery.');
      }
      return false;
    }

    const liveState = await database.query(
      'SELECT value FROM app_meta WHERE key = ?',
      [LIVE_STATE_MARKER],
    );
    if (liveState.values?.[0]?.value !== '1') {
      throw new Error('SQLite live-game write was blocked because no complete live-state snapshot is available.');
    }

    await database.run(
      'INSERT INTO app_state (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json',
      [STORAGE_KEYS.LIVE_GAME, value],
      false,
    );
    const verified = await database.query(
      'SELECT value_json FROM app_state WHERE key = ?',
      [STORAGE_KEYS.LIVE_GAME],
    );
    if (verified.values?.[0]?.value_json !== value) {
      throw new Error('SQLite live-game write failed read-back verification.');
    }
    return true;
  });
}

