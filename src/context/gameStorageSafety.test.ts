/**
 * Run with: npx tsx --test src/context/gameStorageSafety.test.ts
 *
 * These tests exercise the local recovery-snapshot safety path without starting
 * the app or triggering a build.
 */
import test from 'node:test';
import { PENDING_LIVE_GAME_WRITE_KEY } from './gameContextDefaults';
import assert from 'node:assert/strict';
import {
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
