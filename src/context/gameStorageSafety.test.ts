/**
 * Run with: npx tsx --test src/context/gameStorageSafety.test.ts
 *
 * These tests exercise the local recovery-snapshot safety path without starting
 * the app or triggering a build.
 */
import test from 'node:test';
import { PENDING_COMPLETED_GAME_SAVE_KEY, PENDING_LIVE_GAME_WRITE_KEY, STORAGE_KEYS } from './gameContextDefaults';
import assert from 'node:assert/strict';
import {
  readPendingCompletedGameSaveFromStorage,
  readPendingLiveGameFromStorage,
  protectedStorageRemoveItem,
  protectedStorageSetItem,
  restoreRecoverySnapshot,
  snapshotBeforeGameWrite,
  RECOVERY_STORAGE_KEY,
} from './gameStorageSafety';

const values = new Map<string, string>();
let failNextSetForKey: string | null = null;
let failNextRemoveForKey: string | null = null;

(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem(key: string) {
    return values.has(key) ? values.get(key)! : null;
  },
  setItem(key: string, value: string) {
    if (failNextSetForKey === key) {
      failNextSetForKey = null;
      throw new Error('Simulated storage write failure');
    }
    values.set(key, String(value));
  },
  removeItem(key: string) {
    if (failNextRemoveForKey === key) {
      failNextRemoveForKey = null;
      throw new Error('Simulated storage removal failure');
    }
    values.delete(key);
  },
  clear() {
    values.clear();
  },
  key(index: number) {
    return [...values.keys()][index] ?? null;
  },
  get length() {
    return values.size;
  },
} as Storage;

test('recovery snapshot is verified and a failed restore rolls back the current state', () => {
  values.clear();
  values.set('baseball_hub_games_v1', JSON.stringify([{ id: 'original-game' }]));
  values.set(PENDING_LIVE_GAME_WRITE_KEY, 'pending');

  assert.equal(snapshotBeforeGameWrite(), true);
  const checkpointRaw = values.get(RECOVERY_STORAGE_KEY);
  assert.ok(checkpointRaw, 'the recovery snapshot is written');
  assert.equal(values.get(RECOVERY_STORAGE_KEY), checkpointRaw, 'the written snapshot remains readable');
  assert.equal(
    (JSON.parse(checkpointRaw!) as { values: Record<string, string> }).values[PENDING_LIVE_GAME_WRITE_KEY],
    undefined,
    'the transient scoring journal is not captured as recoverable app data',
  );

  assert.equal(protectedStorageSetItem('test-protected-key', 'saved-value'), true);
  assert.equal(values.get('test-protected-key'), 'saved-value');

  values.set('existing-value', 'keep-this-value');
  failNextSetForKey = 'existing-value';
  assert.equal(protectedStorageSetItem('existing-value', 'replacement-value'), false);
  assert.equal(values.get('existing-value'), 'keep-this-value', 'a failed write preserves the previous value');

  failNextRemoveForKey = 'existing-value';
  assert.equal(protectedStorageRemoveItem('existing-value'), false);
  assert.equal(values.get('existing-value'), 'keep-this-value', 'a failed removal preserves the previous value');

  // Simulate newer user data that must survive a failed recovery attempt.
  values.set('baseball_hub_games_v1', JSON.stringify([{ id: 'current-game' }]));
  values.set('user-preference', 'keep-current-value');

  // Fail once while applying the selected checkpoint. Rollback writes are then allowed.
  failNextSetForKey = 'baseball_hub_games_v1';
  assert.equal(restoreRecoverySnapshot(), false);
  assert.equal(values.get('baseball_hub_games_v1'), JSON.stringify([{ id: 'current-game' }]));
  assert.equal(values.get('user-preference'), 'keep-current-value');
  assert.equal(values.get('test-protected-key'), 'saved-value');
  assert.ok(values.has('dugoutPulse.beforeRecovery.v1'), 'the pre-restore safety copy remains available');
  assert.ok(values.has(RECOVERY_STORAGE_KEY), 'the original recovery snapshot remains available');

  // A later restore can proceed once storage works again.
  assert.equal(restoreRecoverySnapshot(), true);
  assert.equal(values.get('baseball_hub_games_v1'), JSON.stringify([{ id: 'original-game' }]));
  assert.equal(values.get(PENDING_LIVE_GAME_WRITE_KEY), 'pending', 'restoring an old snapshot does not replace the live scoring journal');
  assert.equal(values.has('user-preference'), false);
  assert.equal(values.has('test-protected-key'), false);
});


test('pending scoring journal fails closed when the live-game mirror is missing', () => {
  values.clear();
  values.set(PENDING_LIVE_GAME_WRITE_KEY, 'pending');
  assert.throws(
    () => readPendingLiveGameFromStorage(),
    /no recoverable game value/,
    'a pending write with no mirror must not be mistaken for a completed clear',
  );
  assert.equal(values.get(PENDING_LIVE_GAME_WRITE_KEY), 'pending', 'the ambiguous journal remains available for recovery');
});

test('pending scoring journal returns the validated mirrored live game', () => {
  values.clear();
  const game = { id: 'live-game-1', date: '2026-10-23', teamName: 'Home', innings: 2, plays: [] };
  values.set(PENDING_LIVE_GAME_WRITE_KEY, 'pending');
  values.set('baseball_hub_live_game_v1', JSON.stringify(game));
  assert.deepEqual(readPendingLiveGameFromStorage(), game);
});

test('legacy full-game scoring marker remains readable', () => {
  values.clear();
  const game = { id: 'legacy-live-game', innings: 1, plays: [] };
  values.set(PENDING_LIVE_GAME_WRITE_KEY, JSON.stringify(game));
  assert.deepEqual(readPendingLiveGameFromStorage(), game);
});


test('pending completed-game save returns the validated completed game', () => {
  values.clear();
  const game = { id: 'completed-game-1', date: '2026-10-23', teamName: 'Home', innings: 2, plays: [], finalResult: 'W 3-1' };
  values.set(PENDING_COMPLETED_GAME_SAVE_KEY, JSON.stringify({ version: 1, game }));
  assert.deepEqual(readPendingCompletedGameSaveFromStorage(), game);
});

test('malformed completed-game save journal fails closed and remains available', () => {
  values.clear();
  values.set(PENDING_COMPLETED_GAME_SAVE_KEY, JSON.stringify({ version: 1, game: { plays: [] } }));
  assert.throws(readPendingCompletedGameSaveFromStorage, /failed validation/);
  assert.ok(values.has(PENDING_COMPLETED_GAME_SAVE_KEY), 'the invalid journal remains available for diagnosis');
});


test('local recovery restore fails closed while a completed-game save is pending', () => {
  values.clear();
  values.set('baseball_hub_games_v1', JSON.stringify([{ id: 'current-game' }]));
  values.set(PENDING_COMPLETED_GAME_SAVE_KEY, JSON.stringify({
    version: 1,
    game: { id: 'completed-game', innings: 1, plays: [], finalResult: 'W 2-1' },
  }));
  assert.equal(restoreRecoverySnapshot(), false);
  assert.equal(values.get('baseball_hub_games_v1'), JSON.stringify([{ id: 'current-game' }]));
  assert.ok(values.has(PENDING_COMPLETED_GAME_SAVE_KEY), 'the completed-game journal remains available for startup recovery');
});


test('legacy application-data writes and local recovery restore are blocked after SQLite cutover', () => {
  values.clear();
  values.set('dugoutPulse.sqliteCutover.v1', 'complete');
  values.set(STORAGE_KEYS.GAMES, JSON.stringify([{ id: 'sqlite-authoritative-game' }]));
  assert.equal(protectedStorageSetItem(STORAGE_KEYS.GAMES, JSON.stringify([])), false);
  assert.equal(values.get(STORAGE_KEYS.GAMES), JSON.stringify([{ id: 'sqlite-authoritative-game' }]));
  assert.equal(protectedStorageRemoveItem(STORAGE_KEYS.GAMES), false);
  assert.equal(values.get(STORAGE_KEYS.GAMES), JSON.stringify([{ id: 'sqlite-authoritative-game' }]));
  assert.equal(restoreRecoverySnapshot(), false);
  assert.equal(values.get(STORAGE_KEYS.GAMES), JSON.stringify([{ id: 'sqlite-authoritative-game' }]));
});
