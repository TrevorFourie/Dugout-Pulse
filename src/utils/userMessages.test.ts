/**
 * Run with:  npx tsx --test src/utils/userMessages.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { reportFailure, explainFailure, UserFacingError, DIAGNOSTICS_HINT } from './userMessages';
import { createDiagnosticReport, getDiagnosticEvents, getLastDiagnosticReference, clearDiagnosticLogs } from './errorDiagnostics';

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;


const TRUE_ERROR = 'Recovery checkpoint verification failed after writing.';

test('the user sees plain language + a reference; the report holds the TRUE error', () => {
  clearDiagnosticLogs();
  const shown = reportFailure('backup_import', new Error(TRUE_ERROR), 'We could not finish restoring from this backup.');
  // user-facing text: friendly, no technical wording, has a reference and where to look
  assert.ok(shown.startsWith('We could not finish restoring from this backup.'));
  assert.ok(!shown.includes(TRUE_ERROR));
  assert.ok(!/verification failed|Error:|undefined|stack/i.test(shown));
  assert.ok(shown.includes(DIAGNOSTICS_HINT));
  const ref = /Reference: (DP-[A-Z2-9]{6})/.exec(shown)?.[1];
  assert.ok(ref, 'message carries a reference');
  // diagnostic report: true error, real category (not "unknown"), same reference
  const report = createDiagnosticReport(ref);
  assert.ok(report.includes(TRUE_ERROR), 'report contains the true error message');
  assert.ok(report.includes('backup_import'));
  assert.ok(!report.includes('"unknown"') || !report.includes('category": "unknown'));
  assert.equal(getLastDiagnosticReference(), ref);
});

test('every new operation label is recorded under its own category, not "unknown"', () => {
  clearDiagnosticLogs();
  const labels = ['backup_export', 'backup_import', 'recovery_checkpoint', 'recovery_restore', 'data_reset', 'logo_library', 'team_logo_migration', 'storage_write'];
  for (const label of labels) reportFailure(label, new Error('boom ' + label), 'x');
  const categories = getDiagnosticEvents().map((e) => e.category);
  assert.deepEqual(categories, labels);
});

test('deliberately user-facing errors pass through unchanged and are not logged as failures', () => {
  clearDiagnosticLogs();
  const shown = reportFailure('logo_library', new UserFacingError('Unsupported image format. Choose PNG, JPG, JPEG, or WebP.'), 'We could not save that logo.');
  assert.equal(shown, 'Unsupported image format. Choose PNG, JPG, JPEG, or WebP.');
  assert.equal(getDiagnosticEvents().length, 0);
});

test('common root causes get a plain-language hint', () => {
  const quota = explainFailure('We could not save.', 'DP-ABCDEF', Object.assign(new Error('The quota has been exceeded'), { name: 'QuotaExceededError' }));
  assert.ok(/low on storage space/i.test(quota));
  const noSpace = explainFailure('We could not save.', 'DP-ABCDEF', new Error('write failed: ENOSPC no space left on device'));
  assert.ok(/low on storage space/i.test(noSpace));
  const denied = explainFailure('We could not save.', 'DP-ABCDEF', new Error('Permission denied'));
  assert.ok(/not allowed to use its storage/i.test(denied));
  const generic = explainFailure('We could not save.', 'DP-ABCDEF', new Error('weird internal thing'));
  assert.ok(!/weird internal thing/.test(generic));
});

test('long true errors are kept (up to 400 chars) so the report is actually useful', () => {
  clearDiagnosticLogs();
  const long = 'Custom logo "logo_123.png" is missing or unreadable; refusing to create an incomplete checkpoint. ' + 'detail '.repeat(30);
  const shown = reportFailure('recovery_checkpoint', new Error(long), 'We could not make a safety copy.');
  const ref = /Reference: (DP-[A-Z2-9]{6})/.exec(shown)![1];
  const event = getDiagnosticEvents().find((e) => e.id === ref)!;
  assert.ok((event.errorMessage ?? '').length > 240 && (event.errorMessage ?? '').length <= 400);
  assert.ok((event.errorMessage ?? '').startsWith('Custom logo "logo_123.png" is missing'));
});

test('private details are still stripped from the report', () => {
  clearDiagnosticLogs();
  reportFailure('backup_export', new Error('failed for sam@example.com at https://x.test/a/b/c?token=abc'), 'x');
  const report = createDiagnosticReport();
  assert.ok(!report.includes('sam@example.com'));
  assert.ok(!report.includes('token=abc'));
});
