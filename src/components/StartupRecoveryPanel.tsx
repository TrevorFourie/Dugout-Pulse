import React, { useCallback, useEffect, useState } from 'react';
import { explainFailure, reportFailure } from '../utils/userMessages';
import { createDiagnosticReport, getLastDiagnosticReference } from '../utils/errorDiagnostics';
import { saveTextFileDetailed } from '../utils/saveFile';
import { createVerifiedRecoveryCheckpoint, listVerifiedRecoveryCheckpoints, restoreVerifiedRecoveryCheckpoint, type RecoveryCheckpointSummary } from '../context/recoveryJournal';
import { ConfirmationModal } from './ConfirmationModal';
import { ThemedDropdown } from './ThemedDropdown';

interface StartupRecoveryPanelProps {
  errorReference: string;
}

type RecoveryAlert = {
  title: string;
  message: string;
  variant: 'danger' | 'warning';
};

export const StartupRecoveryPanel: React.FC<StartupRecoveryPanelProps> = ({ errorReference }) => {
  const [checkpoints, setCheckpoints] = useState<RecoveryCheckpointSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [message, setMessage] = useState('Checking locally stored recovery points…');
  const [recoveryAlert, setRecoveryAlert] = useState<RecoveryAlert | null>(null);
  const [reportPreview, setReportPreview] = useState('');

  const showFailure = useCallback((title: string, failureMessage: string, variant: RecoveryAlert['variant'] = 'danger') => {
    setMessage('');
    setRecoveryAlert({ title, message: failureMessage, variant });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listVerifiedRecoveryCheckpoints();
      setCheckpoints(items);
      setSelectedId((current) => items.some((item) => item.id === current) ? current : items[0]?.id || '');
      setMessage(items.length
        ? 'Recovery journal checked. Only checkpoints that pass integrity and saved-data validation are listed.'
        : 'No verified recovery checkpoints are available. No recovery operation was started.');
    } catch (error) {
      setCheckpoints([]);
      setSelectedId('');
      showFailure('Could not read recovery points', reportFailure('recovery_restore', error, 'The app could not read its recovery points. Nothing was changed.'));
    } finally {
      setLoading(false);
    }
  }, [showFailure]);

  useEffect(() => { void refresh(); }, [refresh]);

  const createCheckpoint = async () => {
    if (busy || loading) return;
    setBusy(true);
    setMessage('Creating and verifying a checkpoint of the current saved data and custom logos…');
    try {
      const ok = await createVerifiedRecoveryCheckpoint('User-created checkpoint from startup recovery screen');
      await refresh();
      if (ok) {
        setMessage('Checkpoint created and verified. It is available in the recovery-point list.');
      } else {
        showFailure(
          'Safety checkpoint could not be created',
          explainFailure('The app could not make a safety copy of your data. Nothing was changed.', getLastDiagnosticReference() || undefined),
        );
      }
    } catch (error) {
      showFailure('Safety checkpoint could not be created', reportFailure('recovery_checkpoint', error, 'The app could not make a safety copy of your data. Nothing was changed.'));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!selectedId || busy || loading) return;
    const selected = checkpoints.find((item) => item.id === selectedId);
    if (!selected) {
      showFailure('Recovery point unavailable', 'That recovery point is no longer available. Refresh the list and select a verified point.', 'warning');
      return;
    }
    setBusy(true);
    setMessage('Creating a safety checkpoint, then validating and restoring the selected saved data and custom logos…');
    try {
      const result = await restoreVerifiedRecoveryCheckpoint(selectedId);
      setRestored(result.success);
      if (result.success) {
        setMessage(result.message);
      } else {
        await refresh();
        showFailure('Restore could not be completed', result.message);
      }
    } catch (error) {
      showFailure('Restore could not be completed', reportFailure('recovery_restore', error, 'The recovery stopped unexpectedly. Your data was not intentionally changed. Please do not try again repeatedly.'));
      setRestored(false);
    } finally {
      setBusy(false);
    }
  };

  const selected = checkpoints.find((item) => item.id === selectedId);
  const visibleErrorReference = getLastDiagnosticReference() || errorReference;

  const exportDiagnostics = async () => {
    const report = createDiagnosticReport();
    const filename = 'dugout-pulse-diagnostics-' + new Date().toISOString().slice(0, 10) + '.json';
    try {
      const outcome = await saveTextFileDetailed(filename, report, 'application/json');
      if (outcome === 'handed-off') {
        setMessage('The diagnostic report was handed to the browser or share sheet. Confirm that you saved it somewhere you can find.');
      } else if (outcome === 'cancelled') {
        setMessage('The report share sheet was dismissed. The app cannot confirm that the report was saved.');
      } else {
        setReportPreview(report);
        showFailure('Could not export diagnostic report', 'Dugout Pulse could not export the diagnostic file. The report preview is shown below so you can copy it manually.', 'warning');
      }
    } catch (error) {
      setReportPreview(report);
      showFailure('Could not export diagnostic report', reportFailure('runtime_error', error, 'The diagnostic report could not be exported. The preview is available below.'), 'warning');
    }
  };

  return (
    <main className="min-h-screen overflow-auto bg-[#F4F6F8] px-4 py-8 text-[#18212D] dark:bg-[#101419] dark:text-[#FAFAFA]">
      <section className="mx-auto w-full max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-[#354050] dark:bg-[#1A2028] sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#007A6A] dark:text-[#00D7BC]">Dugout Pulse · Recovery</p>
          <h1 className="mt-2 text-2xl font-bold">The app couldn’t start correctly</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Settings may not be accessible while the app is failing. You can inspect verified recovery points here without opening Settings.
            No recovery point is applied unless you choose one and start the restore.
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Error reference: {visibleErrorReference || 'unavailable'}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#354050] dark:bg-[#121923]">
          <h2 className="font-semibold">What recovery restores</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            A selected checkpoint replaces the app’s saved local data with the verified snapshot from that time, including saved games, profiles, settings, scheduled games, team data, and custom logo files captured in that checkpoint. Changes made after that checkpoint may be replaced. The recovery process first creates a safety checkpoint of the current state and validates the restored data.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Do not close the app while recovery is running. After a successful restore, use the restart button to reload the app with the recovered data.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void refresh()} disabled={loading || busy} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">
              {loading ? 'Checking recovery points…' : 'Refresh recovery status'}
            </button>
            <button type="button" onClick={() => void createCheckpoint()} disabled={loading || busy} className="rounded-xl bg-[#00BFA5] px-3 py-2 text-sm font-semibold text-[#18212D] transition-colors hover:bg-[#00A892] disabled:opacity-50 dark:bg-[#00D7BC] dark:text-[#101419] dark:hover:bg-[#00C4AB]">
              {busy ? 'Working…' : 'Create safety checkpoint'}
            </button>
            <button type="button" onClick={() => void exportDiagnostics()} disabled={busy} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">
              Export diagnostic report
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-300" aria-live="polite">Verified recovery points: {checkpoints.length}</p>

          {checkpoints.length > 0 && (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-[#354050]">
              <label className="block text-sm font-semibold">
                Choose a verified recovery point
                <ThemedDropdown<string>
                  ariaLabel="Choose a verified recovery point"
                  value={selectedId}
                  onChange={(next) => { if (next) setSelectedId(next); }}
                  options={checkpoints.map((item) => ({
                    value: item.id,
                    label: new Date(item.createdAt).toLocaleString() + ' · ' + item.reason,
                  }))}
                  placeholder="Select a recovery point"
                  allowClear={false}
                  disabled={busy || loading}
                  className="mt-2 w-full"
                />
              </label>
              {selected && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:border-[#354050] dark:bg-[#252D38] dark:text-slate-200">
                  <p>Snapshot date: {new Date(selected.createdAt).toLocaleString()}</p>
                  <p>Completed games: {selected.gameCount} · Profiles: {selected.profileCount} · Scheduled games: {selected.upcomingGameCount}</p>
                  <p className="mt-1 break-all">Checkpoint ID: {selected.id}</p>
                </div>
              )}
              <button type="button" onClick={() => void restore()} disabled={!selectedId || busy || loading || restored} className="w-full rounded-xl bg-[#00BFA5] px-3 py-2.5 text-sm font-bold text-[#18212D] transition-colors hover:bg-[#00A892] disabled:opacity-50 dark:bg-[#00D7BC] dark:text-[#101419] dark:hover:bg-[#00C4AB]">
                {busy ? 'Recovering…' : restored ? 'Recovery completed' : 'Restore selected checkpoint'}
              </button>
            </div>
          )}

          {message && <p role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:border-[#354050] dark:bg-[#121923] dark:text-slate-200">{message}</p>}
          {reportPreview && (
            <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-[#354050]">
              <label htmlFor="startup-diagnostic-report" className="block text-sm font-semibold">Diagnostic report preview</label>
              <textarea id="startup-diagnostic-report" readOnly value={reportPreview} rows={10} className="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs text-slate-800 dark:border-[#354050] dark:bg-[#101419] dark:text-slate-200" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Review the report before sharing it. It contains technical diagnostic details.</p>
            </div>
          )}

          {restored && (
            <button type="button" onClick={() => window.location.reload()} className="w-full rounded-xl border border-[#007A6A] px-3 py-2.5 text-sm font-bold text-[#007A6A] dark:border-[#00D7BC] dark:text-[#00D7BC]">
              Restart app with recovered data
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Recovery data stays on this device. Nothing is sent automatically.</p>
      </section>
      <ConfirmationModal
        isOpen={recoveryAlert !== null}
        title={recoveryAlert?.title ?? 'Recovery issue'}
        message={recoveryAlert?.message ?? ''}
        confirmLabel="OK"
        showCancelButton={false}
        closeOnBackdrop={false}
        variant={recoveryAlert?.variant ?? 'danger'}
        onCancel={() => setRecoveryAlert(null)}
        onConfirm={() => setRecoveryAlert(null)}
      />
    </main>
  );
};
