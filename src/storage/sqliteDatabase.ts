import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { defineCustomElements } from 'jeep-sqlite/loader';

const DATABASE_NAME = 'dugoutPulse';
const SCHEMA_VERSION = 1;

let sqliteConnection: SQLiteConnection | null = null;
let databaseConnection: SQLiteDBConnection | null = null;
let initialization: Promise<SQLiteDBConnection> | null = null;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS named_lists (
    key TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS opposition_teams (
    id TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS upcoming_games (
    id TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS logo_library (
    id TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS legacy_values (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS diagnostics (
    id TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL
  )`,
] as const;

function isWebPlatform(): boolean {
  return Capacitor.getPlatform() === 'web';
}

async function prepareWebAdapter(): Promise<void> {
  if (!isWebPlatform()) return;

  defineCustomElements(window);
  await customElements.whenDefined('jeep-sqlite');

  let element = document.querySelector('jeep-sqlite');
  if (!element) {
    element = document.createElement('jeep-sqlite');
    document.body.appendChild(element);
  }

  if (!sqliteConnection) {
    sqliteConnection = new SQLiteConnection(CapacitorSQLite);
  }
  await sqliteConnection.initWebStore();
}

async function createAndOpenConnection(): Promise<SQLiteDBConnection> {
  if (!sqliteConnection) {
    sqliteConnection = new SQLiteConnection(CapacitorSQLite);
  }

  await prepareWebAdapter();

  const exists = await sqliteConnection.isConnection(DATABASE_NAME, false);
  const connection = exists.result
    ? await sqliteConnection.retrieveConnection(DATABASE_NAME, false)
    : await sqliteConnection.createConnection(
        DATABASE_NAME,
        false,
        'no-encryption',
        SCHEMA_VERSION,
        false,
      );

  const isOpen = await connection.isDBOpen();
  if (!isOpen.result) {
    await connection.open();
  }
  databaseConnection = connection;
  return connection;
}

async function applySchema(database: SQLiteDBConnection): Promise<void> {
  await database.beginTransaction();
  let committed = false;

  try {
    for (const statement of SCHEMA_STATEMENTS) {
      await database.execute(statement);
    }

    const versionResult = await database.query(
      "SELECT value FROM app_meta WHERE key = 'schema_version'",
    );
    const versionRow = versionResult.values?.[0] as
      | { value?: unknown }
      | undefined;
    const existingVersion =
      versionRow && typeof versionRow.value === 'string'
        ? Number(versionRow.value)
        : 0;

    if (
      !Number.isInteger(existingVersion) ||
      existingVersion < 0 ||
      existingVersion > SCHEMA_VERSION
    ) {
      throw new Error(
        'The Dugout Pulse database schema version is not supported by this app version.',
      );
    }

    await database.run(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['schema_version', String(SCHEMA_VERSION)],
    );
    await database.commitTransaction();
    committed = true;

    // jeep-sqlite holds the database in memory until it is explicitly saved.
    // Native SQLite persists through its native database implementation.
    if (isWebPlatform() && sqliteConnection) {
      await sqliteConnection.saveToStore(DATABASE_NAME);
    }
  } catch (error) {
    if (!committed) {
      try {
        await database.rollbackTransaction();
      } catch {
        // Keep the original schema/transaction error for diagnostics.
      }
    }
    throw error;
  }
}

/**
 * Opens the single application database and applies the initial schema.
 *
 * This foundation is deliberately not connected to GameContext yet. Existing
 * localStorage reads/writes remain authoritative until the complete importer,
 * read-back verification, recovery integration, and startup gate are ready.
 */
export function initializeSQLiteDatabase(): Promise<SQLiteDBConnection> {
  if (databaseConnection) return Promise.resolve(databaseConnection);
  if (initialization) return initialization;

  initialization = (async () => {
    const database = await createAndOpenConnection();
    await applySchema(database);
    return database;
  })().catch((error: unknown) => {
    initialization = null;
    databaseConnection = null;
    throw error;
  });

  return initialization;
}

/** Returns the open database only after successful initialization. */
export function getSQLiteDatabase(): SQLiteDBConnection {
  if (!databaseConnection) {
    throw new Error(
      'The Dugout Pulse SQLite database has not been initialized.',
    );
  }
  return databaseConnection;
}

/**
 * Executes a database transaction and flushes it to IndexedDB on web before
 * reporting success. A web-store flush failure is propagated to the caller.
 */
export async function withSQLiteTransaction<T>(
  operation: (database: SQLiteDBConnection) => Promise<T>,
): Promise<T> {
  const database = await initializeSQLiteDatabase();
  await database.beginTransaction();
  let committed = false;

  try {
    const result = await operation(database);
    await database.commitTransaction();
    committed = true;

    if (isWebPlatform() && sqliteConnection) {
      await sqliteConnection.saveToStore(DATABASE_NAME);
    }

    return result;
  } catch (error) {
    if (!committed) {
      try {
        await database.rollbackTransaction();
      } catch {
        // Keep the original transaction error for diagnostics.
      }
    }
    throw error;
  }
}

/** Closes the connection cleanly; web data is saved before the connection closes. */
export async function closeSQLiteDatabase(): Promise<void> {
  if (!sqliteConnection || !databaseConnection) return;

  if (isWebPlatform()) {
    await sqliteConnection.saveToStore(DATABASE_NAME);
  }
  await sqliteConnection.closeConnection(DATABASE_NAME, false);
  databaseConnection = null;
  initialization = null;
}
