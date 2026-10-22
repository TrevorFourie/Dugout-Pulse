import { Directory, Filesystem } from '@capacitor/filesystem';

const RECOVERY_DIR = 'dugout-pulse-recovery';
const INDEX_FILE = RECOVERY_DIR + '/index.json';
const KEEP_RECENT = 10;
const DAILY_RETENTION_DAYS = 7;
const WEEKLY_RETENTION_WEEKS = 4;
const PRE_RECOVERY_PROTECTION_DAYS = 7;
const STORAGE_WARNING_BYTES = 25 * 1024 * 1024;
const INDEX_TEMP_FILE = RECOVERY_DIR + '/index.json.tmp';
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
  status?: 'verified' | 'failed' | 'pending';
  pinned?: boolean;
  protectedUntil?: string;
  protectionReason?: string;
  contentHash?: string;
  schemaVersion?: number;
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

async function writeIndexSafely(index: RecoveryIndex): Promise<void> {
  const content = JSON.stringify(index);
  await writeAndVerify(INDEX_TEMP_FILE, content);
  await Filesystem.rename({ from: INDEX_TEMP_FILE, to: INDEX_FILE, directory: Directory.Data });
  const result = await Filesystem.readFile({ path: INDEX_FILE, directory: Directory.Data, encoding: 'utf8' });
  if (result.data !== content) throw new Error('Recovery index verification failed after promotion.');
}

function checkpointTime(entry: Checkpoint): number {
  const value = Date.parse(entry.createdAt);
  return Number.isFinite(value) ? value : 0;
}

function retentionKeepSet(entries: Checkpoint[], now = new Date()): Set<string> {
  const valid = entries.filter((entry) => entry.status !== 'failed').sort((a, b) => checkpointTime(b) - checkpointTime(a));
  const keep = new Set<string>();
  const add = (entry: Checkpoint) => { if (entry?.id) keep.add(entry.id); };
  valid.slice(0, KEEP_RECENT).forEach(add);
  const verified = valid.filter((entry) => entry.status === 'verified');
  const localDay = (entry: Checkpoint) => {
    const date = new Date(checkpointTime(entry));
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  };
  const localWeek = (entry: Checkpoint) => {
    const date = new Date(checkpointTime(entry));
    const day = (date.getDay() + 6) % 7;
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - day);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  };
  const dailyStart = new Date(now);
  dailyStart.setHours(0, 0, 0, 0);
  dailyStart.setDate(dailyStart.getDate() - DAILY_RETENTION_DAYS + 1);
  const seenDays = new Set<string>();
  for (const entry of verified) {
    const time = checkpointTime(entry);
    if (time < dailyStart.getTime() || time > now.getTime()) continue;
    const bucket = localDay(entry);
    if (!seenDays.has(bucket)) { seenDays.add(bucket); add(entry); }
  }
  const weeklyStart = new Date(now);
  weeklyStart.setHours(0, 0, 0, 0);
  weeklyStart.setDate(weeklyStart.getDate() - WEEKLY_RETENTION_WEEKS * 7 + 1);
  const seenWeeks = new Set<string>();
  for (const entry of verified) {
    const time = checkpointTime(entry);
    if (time < weeklyStart.getTime() || time > now.getTime()) continue;
    const bucket = localWeek(entry);
    if (!seenWeeks.has(bucket)) { seenWeeks.add(bucket); add(entry); }
  }
  const newestVerified = verified[0];
  if (newestVerified) add(newestVerified);
  for (const entry of valid) {
    const reason = (entry.protectionReason || entry.reason || '').toLowerCase();
    const until = entry.protectedUntil ? Date.parse(entry.protectedUntil) : 0;
    if (entry.pinned || (/migration|schema|upgrade|version change/i.test(reason) && !/pre-startup state/i.test(reason)) || until > now.getTime()) add(entry);
  }
  return keep;
}

async function pruneCheckpoints(previous: RecoveryIndex, next: RecoveryIndex): Promise<void> {
  const keep = new Set(next.checkpoints.map((entry) => entry.id));
  for (const entry of previous.checkpoints) {
    if (keep.has(entry.id) || !entry.file.startsWith(RECOVERY_DIR + '/checkpoint-')) continue;
    try { await Filesystem.deleteFile({ path: entry.file, directory: Directory.Data }); }
    catch { /* Cleanup failure leaves an unindexed orphan; never removes an indexed recovery point. */ }
  }
}

async function reconcileRecoveryJournal(): Promise<void> {
  const index = await readIndex();
  const known = new Map(index.checkpoints.map((entry) => [entry.file, entry]));
  const discovered: Checkpoint[] = [...index.checkpoints];
  // Recover valid checkpoint files that were written before a crash interrupted the
  // index update. Invalid/unrecognized files are left untouched for manual diagnosis.
  try {
    const listing = await Filesystem.readdir({ path: RECOVERY_DIR, directory: Directory.Data });
    for (const fileEntry of listing.files || []) {
      const name = fileEntry.name;
      if (!name.startsWith('checkpoint-') || !name.endsWith('.json')) continue;
      const path = RECOVERY_DIR + '/' + name;
      if (known.has(path)) continue;
      try {
        const result = await Filesystem.readFile({ path, directory: Directory.Data, encoding: 'utf8' });
        const raw = result.data as string;
        const parsed: unknown = JSON.parse(raw);
        if (!validateCheckpointPayload(parsed)) continue;
        const payload = parsed as RecoveryPayload;
        // Reuse the same structural and referenced-logo validation as user-selected restore.
        const required = (() => { try { const items: unknown = JSON.parse(payload.values['dugoutPulse.logoLibrary.v1'] || '[]'); return Array.isArray(items) ? items : []; } catch { return []; } })();
        if (required.some((item) => item && typeof item === 'object' &&
          typeof (item as { fileName?: unknown }).fileName === 'string' &&
          !payload.logoFiles?.[(item as { fileName: string }).fileName])) continue;
        const id = name.slice('checkpoint-'.length, -'.json'.length);
        discovered.push({
          id, createdAt: payload.createdAt, reason: payload.reason, file: path,
          byteLength: raw.length, checksum: checksum(raw), status: 'verified',
          pinned: false, contentHash: checksum(JSON.stringify({ values: payload.values, logoFiles: payload.logoFiles || {} })),
          schemaVersion: 1,
        });
      } catch { /* Keep unrecognized orphan files rather than deleting possible recovery data. */ }
    }
  } catch {
    // A missing/unreadable directory is not permission to prune existing checkpoint files.
  }
  const checked: Checkpoint[] = [];
  for (const entry of discovered) {
    try { await readVerifiedCheckpoint(entry); checked.push({ ...entry, status: 'verified' }); }
    catch { checked.push({ ...entry, status: 'failed' }); }
  }
  const keep = retentionKeepSet(checked);
  const retained = checked.filter((entry) => keep.has(entry.id));
  if (!retained.some((entry) => entry.status === 'verified')) return;
  const next: RecoveryIndex = { version: 1, checkpoints: retained };
  await writeIndexSafely(next);
  await pruneCheckpoints({ version: 1, checkpoints: [...index.checkpoints, ...discovered.filter((entry) => !known.has(entry.file))] }, next);
}

export async function getRecoveryJournalStorageInfo(): Promise<{ checkpointCount: number; verifiedCount: number; estimatedBytes: number; warning: boolean }> {
  const index = await readIndex();
  let estimatedBytes = 0;
  let verifiedCount = 0;
  for (const entry of index.checkpoints) {
    estimatedBytes += entry.byteLength || 0;
    try { await readVerifiedCheckpoint(entry); verifiedCount += 1; } catch { /* Not a verified point. */ }
  }
  return { checkpointCount: index.checkpoints.length, verifiedCount, estimatedBytes, warning: estimatedBytes >= STORAGE_WARNING_BYTES };
}

export async function setRecoveryCheckpointPinned(id: string, pinned: boolean): Promise<boolean> {
  const index = await readIndex();
  const entry = index.checkpoints.find((item) => item.id === id);
  if (!entry) return false;
  try {
    await readVerifiedCheckpoint(entry);
    const next = { version: 1 as const, checkpoints: index.checkpoints.map((item) => item.id === id ? { ...item, status: 'verified' as const, pinned } : item) };
    await writeIndexSafely(next);
    return true;
  } catch { return false; }
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
    const logoFiles = await captureLogoFiles(values);
    const logoItems: unknown = (() => { try { return JSON.parse(values['dugoutPulse.logoLibrary.v1'] || '[]'); } catch { return []; } })();
    if (Array.isArray(logoItems) && logoItems.some((item) => item && typeof item === 'object' &&
      typeof (item as { fileName?: unknown }).fileName === 'string' && !logoFiles[(item as { fileName: string }).fileName])) {
      throw new Error('A referenced custom logo is missing; refusing to create an incomplete recovery checkpoint.');
    }
    const contentHash = checksum(JSON.stringify({ values, logoFiles }));
    const payload = JSON.stringify({ version: 1, createdAt: new Date().toISOString(), reason, values, logoFiles });
    const index = await readIndex();
    const newest = [...index.checkpoints].reverse().find((entry) => entry.status !== 'failed');
    const isProtectedOperation = /before restoring checkpoint|before.*(migration|schema|upgrade|version change)/i.test(reason);
    if (!isProtectedOperation && newest?.contentHash === contentHash) {
      try { await readVerifiedCheckpoint(newest); return true; } catch { /* Create a fresh point if the prior one is damaged. */ }
    }
    if (!isProtectedOperation && newest && !newest.contentHash) {
      try {
        const prior = await readVerifiedCheckpoint(newest);
        if (JSON.stringify(prior.values) === JSON.stringify(values) && JSON.stringify(prior.logoFiles || {}) === JSON.stringify(logoFiles)) return true;
      } catch { /* Damaged prior point must not block a fresh checkpoint. */ }
    }
    const createdAt = new Date().toISOString();
    const id = Date.now().toString(36) + '-' + contentHash;
    const file = RECOVERY_DIR + '/checkpoint-' + id + '.json';
    await writeAndVerify(file, payload);
    const isPreRecovery = /before restoring checkpoint/i.test(reason);
    const checkpoint: Checkpoint = {
      id, createdAt, reason, file, byteLength: payload.length, checksum: checksum(payload),
      status: 'verified', pinned: false, contentHash, schemaVersion: 1,
      ...(isPreRecovery ? {
        protectedUntil: new Date(Date.now() + PRE_RECOVERY_PROTECTION_DAYS * 86400000).toISOString(),
        protectionReason: reason,
      } : {}),
      ...(/migration|schema|upgrade|version change/i.test(reason) && !/pre-startup state/i.test(reason) ? { protectionReason: reason } : {}),
    };
    const verifiedExisting: Checkpoint[] = [];
    for (const entry of index.checkpoints) {
      try { await readVerifiedCheckpoint(entry); verifiedExisting.push({ ...entry, status: 'verified' }); }
      catch { verifiedExisting.push({ ...entry, status: 'failed' }); }
    }
    const nextAll = [...verifiedExisting, checkpoint];
    const keep = retentionKeepSet(nextAll);
    const next: RecoveryIndex = { version: 1, checkpoints: nextAll.filter((entry) => keep.has(entry.id)) };
    await writeIndexSafely(next);
    await pruneCheckpoints(index, next);
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
    await reconcileRecoveryJournal();
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
      if (raw.length === entry.byteLength && checksum(raw) === entry.checksum && validateCheckpointPayload(JSON.parse(raw))) {
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
  pinned?: boolean;
  protectionReason?: string;
};

type RecoveryPayload = { version: 1; createdAt: string; reason: string; values: Record<string, string>; logoFiles?: Record<string, string> };

async function captureLogoFiles(values: Record<string, string>): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  let items: unknown;
  try { items = JSON.parse(values['dugoutPulse.logoLibrary.v1'] || '[]'); } catch { return files; }
  if (!Array.isArray(items)) return files;
  for (const item of items) {
    if (!item || typeof item !== 'object' || typeof (item as { fileName?: unknown }).fileName !== 'string') continue;
    const fileName = (item as { fileName: string }).fileName;
    if (!/^[a-zA-Z0-9_.-]+$/.test(fileName) || fileName.includes('..')) continue;
    try {
      const result = await Filesystem.readFile({ path: 'team-logos/' + fileName, directory: Directory.Data, encoding: 'base64' });
      if (typeof result.data === 'string' && result.data.length) files[fileName] = result.data;
    } catch {
      // Missing logo bytes are not silently represented as recoverable; the checkpoint
      // is still useful for non-logo data, but validation below will report the missing file.
    }
  }
  return files;
}

function validateCheckpointPayload(value: unknown): value is RecoveryPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<RecoveryPayload>;
  if (payload.version !== 1 || typeof payload.createdAt !== 'string' || typeof payload.reason !== 'string' ||
      !validateRecoveryValues(payload.values)) return false;
  if (payload.logoFiles !== undefined && (!payload.logoFiles || typeof payload.logoFiles !== 'object' || Array.isArray(payload.logoFiles) ||
      !Object.entries(payload.logoFiles).every(([name, bytes]) => /^[a-zA-Z0-9_.-]+$/.test(name) && !name.includes('..') && typeof bytes === 'string'))) return false;
  return true;
}

async function writeLogoFiles(files: Record<string, string>): Promise<void> {
  if (Object.keys(files).length) await Filesystem.mkdir({ path: 'team-logos', directory: Directory.Data, recursive: true }).catch(() => undefined);
  for (const [fileName, base64] of Object.entries(files)) {
    await Filesystem.writeFile({ path: 'team-logos/' + fileName, data: base64, directory: Directory.Data, encoding: 'base64', recursive: true });
    const verify = await Filesystem.readFile({ path: 'team-logos/' + fileName, directory: Directory.Data, encoding: 'base64' });
    if (verify.data !== base64) throw new Error('Custom logo verification failed during recovery.');
  }
}

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
  if (!validateCheckpointPayload(parsed)) throw new Error('Checkpoint data failed validation.');
  const payload = parsed as RecoveryPayload;
  const requiredLogos = (() => {
    try { const items: unknown = JSON.parse(payload.values['dugoutPulse.logoLibrary.v1'] || '[]'); return Array.isArray(items) ? items : []; }
    catch { return []; }
  })();
  for (const item of requiredLogos) {
    if (!item || typeof item !== 'object' || typeof (item as { fileName?: unknown }).fileName !== 'string') continue;
    const fileName = (item as { fileName: string }).fileName;
    if (!payload.logoFiles?.[fileName]) throw new Error('Checkpoint is missing a required custom logo file.');
  }
  return payload;
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
      summaries.push({ id: entry.id, createdAt: payload.createdAt, reason: payload.reason, pinned: entry.pinned === true, protectionReason: entry.protectionReason, ...storageCounts(payload.values) });
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
    const beforeLogoFiles = await captureLogoFiles(before);
    try {
      await writeLogoFiles(payload.logoFiles || {});
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
        await writeLogoFiles(beforeLogoFiles);
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
