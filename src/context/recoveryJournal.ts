import { Directory, Filesystem } from '@capacitor/filesystem';

const RECOVERY_DIR = 'dugout-pulse-recovery';
const INDEX_FILE = RECOVERY_DIR + '/index.json';
const MAX_CHECKPOINTS = 40;
const EXCLUDED_KEYS = new Set([
  'dugoutPulse.recoverySnapshot.v1',
  'dugoutPulse.recoverySnapshot.previous.v1',
  'dugoutPulse.beforeRecovery.v1',
  'dugoutPulse.diagnostics.v1',
]);

type Checkpoint = {
  id: string;
  createdAt: string;
  reason: string;
  file: string;
  byteLength: number;
  checksum: string;
};

type RecoveryIndex = { version: 1; checkpoints: Checkpoint[] };

const checksum = (value: string): string => {
  // FNV-1a is an integrity check against incomplete/corrupt writes, not a cryptographic signature.
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

function captureStorage(): Record<string, string> {
  const values: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || EXCLUDED_KEYS.has(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return values;
}

async function readIndex(): Promise<RecoveryIndex> {
  try {
    const result = await Filesystem.readFile({ path: INDEX_FILE, directory: Directory.Data, encoding: 'utf8' });
    const parsed = JSON.parse(result.data as string) as RecoveryIndex;
    if (parsed.version === 1 && Array.isArray(parsed.checkpoints)) return parsed;
  } catch {
    // A missing or invalid index is treated as absent; individual checkpoint files remain untouched.
  }
  return { version: 1, checkpoints: [] };
}

async function writeAndVerify(path: string, content: string): Promise<void> {
  await Filesystem.writeFile({ path, data: content, directory: Directory.Data, encoding: 'utf8', recursive: true });
  const result = await Filesystem.readFile({ path, directory: Directory.Data, encoding: 'utf8' });
  if (result.data !== content) throw new Error('Recovery checkpoint verification failed after writing.');
}

/**
 * Write an immutable full-state checkpoint before the next app-storage mutation.
 * The checkpoint file is verified before the index is advanced. Files live in the
 * app's private data directory and are not part of JSON user exports or app bundles.
 */
async function createCheckpointSerially(reason: string): Promise<boolean> {
  try {
    const values = captureStorage();
    const payload = JSON.stringify({ version: 1, createdAt: new Date().toISOString(), reason, values });
    const id = Date.now().toString(36) + '-' + checksum(payload);
    const file = RECOVERY_DIR + '/checkpoint-' + id + '.json';
    await writeAndVerify(file, payload);

    const index = await readIndex();
    const checkpoint: Checkpoint = {
      id,
      createdAt: new Date().toISOString(),
      reason,
      file,
      byteLength: payload.length,
      checksum: checksum(payload),
    };
    const next: RecoveryIndex = {
      version: 1,
      checkpoints: [...index.checkpoints, checkpoint].slice(-MAX_CHECKPOINTS),
    };
    const indexText = JSON.stringify(next);
    await writeAndVerify(INDEX_FILE, indexText);
    return true;
  } catch (error) {
    console.error('Could not create and verify the private recovery checkpoint.', error);
    return false;
  }
}

/**
 * Serialize journal writes. Persistence effects can fire together after React state
 * changes; serializing prevents concurrent index read/modify/write races from
 * dropping references to otherwise verified checkpoint files.
 */
let checkpointQueue: Promise<boolean> = Promise.resolve(true);
export function createVerifiedRecoveryCheckpoint(reason: string): Promise<boolean> {
  const next = checkpointQueue.then(() => createCheckpointSerially(reason), () => createCheckpointSerially(reason));
  checkpointQueue = next;
  return next;
}

/** Called before initial restore; establishes a durable baseline before app code mutates stored state. */
export async function ensureRecoveryBaseline(): Promise<boolean> {
  try {
    // Preserve the current pre-restore state on every launch/update, not only on
    // first install. The journal keeps older immutable checkpoint files as history.
    return await createVerifiedRecoveryCheckpoint('Pre-startup state before restore or migration');
  } catch (error) {
    console.error('Could not establish a private recovery baseline.', error);
    return false;
  }
}

export async function getRecoveryJournalStatus(): Promise<{ available: boolean; count: number; latest?: string }> {
  const index = await readIndex();
  for (const entry of [...index.checkpoints].reverse()) {
    try {
      const result = await Filesystem.readFile({ path: entry.file, directory: Directory.Data, encoding: 'utf8' });
      const raw = result.data as string;
      if (raw.length === entry.byteLength && checksum(raw) === entry.checksum) {
        return { available: true, count: index.checkpoints.length, latest: entry.createdAt };
      }
    } catch {
      // Report the newest readable, verified checkpoint.
    }
  }
  return { available: false, count: 0 };
}

export type RecoveryCheckpointSummary = {
  id: string;
  createdAt: string;
  reason: string;
  gameCount: number;
  profileCount: number;
  upcomingGameCount: number;
};

type RecoveryPayload = { version: 1; createdAt: string; reason: string; values: Record<string, string> };

function validateRecoveryValues(values: unknown): values is Record<string, string> {
  if (!values || typeof values !== 'object' || Array.isArray(values) ||
      !Object.values(values).every((value) => typeof value === 'string')) return false;
  const record = values as Record<string, string>;
  const validateArray = (key: string, validator: (item: unknown) => boolean) => {
    if (!(key in record)) return true;
    try {
      const parsed: unknown = JSON.parse(record[key]);
      return Array.isArray(parsed) && parsed.every(validator);
    } catch { return false; }
  };
  const hasId = (item: unknown) => !!item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string';
  if (!validateArray('baseball_hub_games_v1', hasId) ||
      !validateArray('dugoutPulse.games.v1', hasId) ||
      !validateArray('dugoutPulse.savedGames.v1', hasId) ||
      !validateArray('baseball_hub_profiles_v1', (item) => hasId(item) && typeof (item as { playerName?: unknown }).playerName === 'string') ||
      !validateArray('dugoutPulse.profiles.v1', (item) => hasId(item) && typeof (item as { playerName?: unknown }).playerName === 'string') ||
      !validateArray('dugoutPulse.upcomingGames.v1', (item) => hasId(item) && typeof (item as { date?: unknown }).date === 'string' && typeof (item as { opponent?: unknown }).opponent === 'string') ||
      !validateArray('dugoutPulse.oppositionTeams.v1', (item) => hasId(item) && typeof (item as { name?: unknown }).name === 'string')) return false;
  for (const key of ['baseball_hub_settings_v1']) {
    if (key in record) {
      try { const parsed: unknown = JSON.parse(record[key]); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false; }
      catch { return false; }
    }
  }
  return true;
}

async function readVerifiedCheckpoint(entry: Checkpoint): Promise<RecoveryPayload> {
  const result = await Filesystem.readFile({ path: entry.file, directory: Directory.Data, encoding: 'utf8' });
  const raw = result.data as string;
  if (raw.length !== entry.byteLength || checksum(raw) !== entry.checksum) throw new Error('Checkpoint integrity check failed.');
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('Checkpoint payload is invalid.');
  const payload = parsed as Partial<RecoveryPayload>;
  if (payload.version !== 1 || typeof payload.createdAt !== 'string' || typeof payload.reason !== 'string' ||
      !validateRecoveryValues(payload.values)) throw new Error('Checkpoint data failed validation.');
  return payload as RecoveryPayload;
}

function storageCounts(values: Record<string, string>) {
  const count = (key: string) => {
    try { const parsed: unknown = JSON.parse(values[key] || '[]'); return Array.isArray(parsed) ? parsed.length : 0; }
    catch { return 0; }
  };
  return {
    gameCount: count('baseball_hub_games_v1') || count('dugoutPulse.games.v1') || count('dugoutPulse.savedGames.v1'),
    profileCount: count('baseball_hub_profiles_v1') || count('dugoutPulse.profiles.v1'),
    upcomingGameCount: count('dugoutPulse.upcomingGames.v1'),
  };
}

/** List only checkpoints whose file integrity and saved-data structure both validate. */
export async function listVerifiedRecoveryCheckpoints(): Promise<RecoveryCheckpointSummary[]> {
  const index = await readIndex();
  const summaries: RecoveryCheckpointSummary[] = [];
  for (const entry of [...index.checkpoints].reverse()) {
    try {
      const payload = await readVerifiedCheckpoint(entry);
      summaries.push({ id: entry.id, createdAt: payload.createdAt, reason: payload.reason, ...storageCounts(payload.values) });
    } catch {
      // Invalid checkpoints are excluded from the selectable list, never deleted.
    }
  }
  return summaries;
}

/**
 * Restore one verified journal checkpoint. The current state is checkpointed first;
 * candidate values are validated before any live key is changed. A failed application
 * rolls back from the in-memory pre-restore state and leaves both journal files intact.
 */
export async function restoreVerifiedRecoveryCheckpoint(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const index = await readIndex();
    const entry = index.checkpoints.find((candidate) => candidate.id === id);
    if (!entry) return { success: false, message: 'That recovery checkpoint is no longer available.' };
    const payload = await readVerifiedCheckpoint(entry);
    if (!validateRecoveryValues(payload.values)) return { success: false, message: 'The checkpoint contains data that failed validation.' };

    if (!(await createVerifiedRecoveryCheckpoint('Before restoring checkpoint ' + id))) {
      return { success: false, message: 'The current state could not be safely checkpointed. Nothing was restored.' };
    }

    const before: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || EXCLUDED_KEYS.has(key)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) before[key] = value;
    }
    const preserved = new Set(EXCLUDED_KEYS);
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key && !preserved.has(key) && !(key in payload.values)) localStorage.removeItem(key);
      }
      for (const [key, value] of Object.entries(payload.values)) {
        if (!preserved.has(key)) localStorage.setItem(key, value);
      }
      const after: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || preserved.has(key)) continue;
        const value = localStorage.getItem(key);
        if (value !== null) after[key] = value;
      }
      const expectedKeys = Object.keys(payload.values);
      const actualKeys = Object.keys(after);
      if (expectedKeys.length !== actualKeys.length || expectedKeys.some((key) => after[key] !== payload.values[key])) {
        throw new Error('Restored values failed read-back verification.');
      }
      if (!validateRecoveryValues(after)) throw new Error('Restored values failed post-write validation.');
      return { success: true, message: 'Recovery completed and verified. The app will reload to apply the restored data.' };
    } catch (restoreError) {
      // Best-effort rollback. The pre-restore checkpoint remains in the journal even if rollback fails.
      try {
        for (let i = localStorage.length - 1; i >= 0; i -= 1) {
          const key = localStorage.key(i);
          if (key && !preserved.has(key) && !(key in before)) localStorage.removeItem(key);
        }
        for (const [key, value] of Object.entries(before)) if (!preserved.has(key)) localStorage.setItem(key, value);
      } catch (rollbackError) {
        console.error('Recovery rollback failed; pre-restore journal checkpoint is retained.', rollbackError);
      }
      throw restoreError;
    }
  } catch (error) {
    console.error('Private journal recovery failed; recovery checkpoints were retained.', error);
    return { success: false, message: 'Recovery could not be completed. The original recovery checkpoint and the pre-recovery checkpoint were retained. No further changes should be made until the data is reviewed.' };
  }
}
