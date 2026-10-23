import React, { useCallback, useEffect, useState } from 'react';
import { explainFailure, reportFailure } from '../utils/userMessages';
import { getLastDiagnosticReference } from '../utils/errorDiagnostics';
import { createVerifiedRecoveryCheckpoint, listVerifiedRecoveryCheckpoints, restoreVerifiedRecoveryCheckpoint, type RecoveryCheckpointSummary } from '../context/recoveryJournal';

interface StartupRecoveryPanelProps {
  errorReference: string;
}

export const StartupRecoveryPanel: React.FC<StartupRecoveryPanelProps> = ({ errorReference }) => {
  const [checkpoints, setCheckpoints] = useState<RecoveryCheckpointSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [message, setMessage] = useState('Checking locally stored recovery points…');

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
      setMessage(reportFailure('recovery_restore', error, 'The app could not read its recovery points. Nothing was changed.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const createCheckpoint = async () => {
    if (busy || loading) return;
    setBusy(true);
    setMessage('Creating and verifying a checkpoint of the current saved data and custom logos…');
    try {
      const ok = await createVerifiedRecoveryCheckpoint('User-created checkpoint from startup recovery screen');
      await refresh();
      setMessage(ok
        ? 'Checkpoint created and verified. It is available in the recovery-point list.'
        : explainFailure('The app could not make a safety copy of your data. Nothing was changed.', getLastDiagnosticReference() || undefined));
    } catch (error) {
      setMessage(reportFailure('recovery_checkpoint', error, 'The app could not make a safety copy of your data. Nothing was changed.'));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!selectedId || busy || loading) return;
    const selected = checkpoints.find((item) => item.id === selectedId);
    if (!selected) {
      setMessage('That recovery point is no longer available. Refresh the list and select a verified point.');
      return;
    }
    setBusy(true);
    setMessage('Creating a safety checkpoint, then validating and restoring the selected saved data and custom logos…');
    try {
      const result = await restoreVerifiedRecoveryCheckpoint(selectedId);
      setMessage(result.message);
      setRestored(result.success);
      if (!result.success) {
        await refresh();
        setMessage(result.message);
      }
    } catch (error) {
      setMessage(reportFailure('recovery_restore', error, 'The recovery stopped unexpectedly. Your data was not intentionally changed. Please do not try again repeatedly.'));
      setRestored(false);
    } finally {
      setBusy(false);
    }
  };

  const selected = checkpoints.find((item) => item.id === selectedId);

  return (
    <main className="min-h-screen overflow-auto bg-[#121923] px-4 py-8 text-[#F8FAFC]" role="alert">
      <section className="mx-auto w-full max-w-xl space-y-5 rounded-2xl border border-[#354050] bg-[#1A2028] p-5 sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#00D7BC]">Dugout Pulse · Recovery</p>
          <h1 className="mt-2 text-2xl font-bold">The app couldn’t start correctly</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Settings may not be accessible while the app is failing. You can inspect verified recovery points here without opening Settings.
            No recovery point is applied unless you choose one and start the restore.
          </p>
          <p className="mt-2 text-xs text-slate-400">Error reference: {errorReference || 'unavailable'}</p>
        </div>

        <div className="rounded-xl border border-[#354050] bg-[#121923] p-4">
          <h2 className="font-semibold">What recovery restores</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            A selected checkpoint replaces the app’s saved local data with the verified snapshot from that time, including saved games, profiles, settings, scheduled games, team data, and custom logo files captured in that checkpoint. Changes made after that checkpoint may be replaced. The recovery process first creates a safety checkpoint of the current state and validates the restored data.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Do not close the app while recovery is running. After a successful restore, use the restart button to reload the app with the recovered data.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void refresh()} disabled={loading || busy} className="rounded-lg border border-slate-500 px-3 py-2 text-sm font-semibold disabled:opacity-50">
              {loading ? 'Checking recovery points…' : 'Refresh recovery status'}
            </button>
            <button type="button" onClick={() => void createCheckpoint()} disabled={loading || busy} className="rounded-lg bg-[#00D7BC] px-3 py-2 text-sm font-semibold text-[#101419] disabled:opacity-50">
              {busy ? 'Working…' : 'Create safety checkpoint'}
            </button>
          </div>

          <p className="text-xs text-slate-300" aria-live="polite">Verified recovery points: {checkpoints.length}</p>

          {checkpoints.length > 0 && (
            <div className="space-y-3 rounded-xl border border-[#354050] p-4">
              <label className="block text-sm font-semibold">
                Choose a verified recovery point
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={busy} className="mt-2 w-full rounded-lg border border-[#526071] bg-[#121923] px-3 py-2 text-sm font-normal text-white">
                  {checkpoints.map((item) => (
                    <option key={item.id} value={item.id}>
                      {new Date(item.createdAt).toLocaleString()} · {item.reason}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <div className="rounded-lg bg-[#252D38] p-3 text-xs leading-relaxed text-slate-200">
                  <p>Snapshot date: {new Date(selected.createdAt).toLocaleString()}</p>
                  <p>Completed games: {selected.gameCount} · Profiles: {selected.profileCount} · Scheduled games: {selected.upcomingGameCount}</p>
                  <p className="mt-1 break-all">Checkpoint ID: {selected.id}</p>
                </div>
              )}
              <button type="button" onClick={() => void restore()} disabled={!selectedId || busy || loading || restored} className="w-full rounded-lg bg-[#00D7BC] px-3 py-2.5 text-sm font-bold text-[#101419] disabled:opacity-50">
                {busy ? 'Recovering…' : restored ? 'Recovery completed' : 'Restore selected checkpoint'}
              </button>
            </div>
          )}

          {message && <p role="status" aria-live="polite" className="rounded-lg border border-[#354050] bg-[#121923] p-3 text-sm leading-relaxed text-slate-200">{message}</p>}

          {restored && (
            <button type="button" onClick={() => window.location.reload()} className="w-full rounded-lg border border-[#00D7BC] px-3 py-2.5 text-sm font-bold text-[#00D7BC]">
              Restart app with recovered data
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">Recovery data stays on this device. Nothing is sent automatically.</p>
      </section>
    </main>
  );
};
