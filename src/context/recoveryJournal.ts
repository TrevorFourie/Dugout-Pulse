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
export async function createVerifiedRecoveryCheckpoint(reason: string): Promise<boolean> {
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
