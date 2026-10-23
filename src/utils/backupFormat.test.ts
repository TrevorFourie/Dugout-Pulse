/**
 * Run with:  npx tsx --test src/utils/backupFormat.test.ts
 * (plain node:test + node:assert, same as scoringEngine.test.ts)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_FORMAT_VERSION, canonicalStringify, sealBackup, verifyBackup } from './backupFormat';
import { BACKUP_REMINDER_DAYS, describeBackupAge, getBackupStatus, LAST_BACKUP_KEY } from './backupReminder';

const sampleBackup = () => sealBackup({
  app: 'dugout-pulse',
  backupVersion: BACKUP_FORMAT_VERSION,
  games: [{ id: 'g1', opponent: 'Tigers' }],
  profiles: [{ id: 'p1', playerName: 'Sam' }],
  settings: { theme: 'dark' },
  extras: { savedTournaments: ['Cup'], hiddenSeasons: [] },
  logoLibrary: [{ id: 'logo_1', name: 'Logo', fileName: 'logo_1.png', uri: 'x', sizeBytes: 3 }],
  logoFiles: { 'logo_1.png': 'AAAA' },
  missingLogoFiles: [],
});

test('a freshly sealed backup verifies, and survives a JSON round trip', () => {
  const roundTripped = JSON.parse(JSON.stringify(sampleBackup()));
  const check = verifyBackup(roundTripped);
  assert.equal(check.ok, true);
  if (check.ok) assert.equal(check.verified, true);
});

test('key order does not affect the checksum', () => {
  const backup = sampleBackup() as Record<string, unknown>;
  const reordered = Object.fromEntries(Object.entries(backup).reverse());
  assert.equal(verifyBackup(reordered).ok, true);
  assert.equal(canonicalStringify({ b: 1, a: 2 }), canonicalStringify({ a: 2, b: 1 }));
});

test('an edited backup is rejected', () => {
  const backup = JSON.parse(JSON.stringify(sampleBackup()));
  backup.games[0].opponent = 'Lions';
  const check = verifyBackup(backup);
  assert.equal(check.ok, false);
});

test('a truncated or tampered logo image is rejected', () => {
  const backup = JSON.parse(JSON.stringify(sampleBackup()));
  backup.logoFiles['logo_1.png'] = 'AAAB';
  assert.equal(verifyBackup(backup).ok, false);
});

test('a v3 backup without an integrity block is rejected', () => {
  const backup = JSON.parse(JSON.stringify(sampleBackup()));
  delete backup.integrity;
  assert.equal(verifyBackup(backup).ok, false);
});

test('legacy v1/v2 backups are accepted but reported as unverified', () => {
  const legacy = { games: [], profiles: [{ id: 'p', playerName: 'A' }], settings: {}, backupVersion: 2 };
  const check = verifyBackup(legacy);
  assert.equal(check.ok, true);
  if (check.ok) assert.equal(check.verified, false);
  assert.equal(verifyBackup({ games: [] }).ok, true);
});

test('unrelated or newer files are rejected before anything changes', () => {
  assert.equal(verifyBackup(null).ok, false);
  assert.equal(verifyBackup([]).ok, false);
  assert.equal(verifyBackup({ hello: 'world' }).ok, false);
  assert.equal(verifyBackup({ games: [], backupVersion: BACKUP_FORMAT_VERSION + 1 }).ok, false);
});

test('unsafe logo file names are rejected', () => {
  const bad = sealBackup({
    games: [], backupVersion: BACKUP_FORMAT_VERSION,
    logoLibrary: [{ id: 'x', fileName: '../evil.png' }], logoFiles: { '../evil.png': 'AAAA' },
  });
  assert.equal(verifyBackup(bad).ok, false);
});

test('a library entry with no image is rejected unless declared missing at export time', () => {
  const undeclared = sealBackup({
    games: [], backupVersion: BACKUP_FORMAT_VERSION,
    logoLibrary: [{ id: 'x', fileName: 'x.png' }], logoFiles: {}, missingLogoFiles: [],
  });
  assert.equal(verifyBackup(undeclared).ok, false);
  const declared = sealBackup({
    games: [], backupVersion: BACKUP_FORMAT_VERSION,
    logoLibrary: [{ id: 'x', fileName: 'x.png' }], logoFiles: {}, missingLogoFiles: ['x.png'],
  });
  assert.equal(verifyBackup(declared).ok, true);
});

test('invalid preset lists are rejected', () => {
  const bad = sealBackup({ games: [], backupVersion: BACKUP_FORMAT_VERSION, extras: { savedSeasons: [1, 2] } });
  assert.equal(verifyBackup(bad).ok, false);
});

// --- reminder logic (uses an in-memory localStorage stand-in) ---
function installFakeStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as Storage;
  return store;
}

test('reminder is due when data exists and no backup was ever exported', () => {
  installFakeStorage();
  const status = getBackupStatus(true);
  assert.equal(status.due, true);
  assert.equal(describeBackupAge(status), 'You have never exported a backup.');
  assert.equal(getBackupStatus(false).due, false);
});

test('reminder is not due after a recent export and returns after the interval', () => {
  const store = installFakeStorage();
  const now = new Date('2026-10-23T08:00:00Z');
  store.set(LAST_BACKUP_KEY, new Date(now.getTime() - 2 * 86_400_000).toISOString());
  assert.equal(getBackupStatus(true, now).due, false);
  store.set(LAST_BACKUP_KEY, new Date(now.getTime() - (BACKUP_REMINDER_DAYS + 1) * 86_400_000).toISOString());
  assert.equal(getBackupStatus(true, now).due, true);
});

test('corrupt reminder metadata never throws', () => {
  const store = installFakeStorage();
  store.set(LAST_BACKUP_KEY, 'not a date');
  assert.doesNotThrow(() => getBackupStatus(true));
  assert.equal(getBackupStatus(true).lastExport, null);
});

// --- logo survival through export -> reset -> import ---
import { restoreLocalLogoReferences } from './logoBackup';

const INLINE = 'data:image/png;base64,iVBORw0KGgo=';

test('v3 import keeps inline data-URL logos and library references instead of dropping them', () => {
  const exported = JSON.parse(JSON.stringify(sealBackup({
    backupVersion: BACKUP_FORMAT_VERSION,
    profiles: [{ id: 'p1', playerName: 'Sam', logo: INLINE }],
    oppositionTeams: [{ id: 'o1', name: 'Tigers', logo: 'logo-ref-v1:logo_1' }],
  })));
  assert.equal(verifyBackup(exported).ok, true);
  // After a reset the library has been restored from the backup, so its ids are known locally.
  const local = new Map([['logo-ref-v1:logo_1', 'logo-ref-v1:logo_1']]);
  const { data, missingReferences } = restoreLocalLogoReferences(exported, local, { keepInlineImages: true });
  assert.equal((data as typeof exported).profiles[0].logo, INLINE);
  assert.equal((data as typeof exported).oppositionTeams[0].logo, 'logo-ref-v1:logo_1');
  assert.equal(missingReferences.size, 0);
});

test('legacy import still refuses inline images it cannot match locally', () => {
  const { data, missingReferences } = restoreLocalLogoReferences(
    { profiles: [{ logo: INLINE }] }, new Map(), { keepInlineImages: false });
  assert.equal((data as { profiles: { logo?: string }[] }).profiles[0].logo, undefined);
  assert.equal(missingReferences.size, 1);
});

test('only png/jpeg/webp data URLs are kept; other inline content is never trusted', () => {
  const { data } = restoreLocalLogoReferences(
    { profiles: [{ logo: 'data:text/html;base64,PHNjcmlwdD4=' }, { logo: 'javascript:alert(1)' }] },
    new Map(), { keepInlineImages: true });
  const profiles = (data as { profiles: { logo?: string }[] }).profiles;
  assert.equal(profiles[0].logo, undefined);
  assert.equal(profiles[1].logo, undefined);
});
