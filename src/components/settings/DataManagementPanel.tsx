import React, { useCallback, useEffect, useState } from 'react';
import { Download, Upload, AlertOctagon, ShieldCheck } from 'lucide-react';
import { DiagnosticsPanel } from '../DiagnosticsPanel';
import { createVerifiedRecoveryCheckpoint, getRecoveryJournalStorageInfo, listVerifiedRecoveryCheckpoints, restoreVerifiedRecoveryCheckpoint, setRecoveryCheckpointPinned, type RecoveryCheckpointSummary } from '../../context/recoveryJournal';

interface DataManagementPanelProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onExportBackup: () => void | Promise<void>;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenResetConfirm: () => void;
}

const RecoveryJournalPanel: React.FC = () => {
  const [checkpoints, setCheckpoints] = useState<RecoveryCheckpointSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [journalInfo, setJournalInfo] = useState<{ checkpointCount: number; verifiedCount: number; estimatedBytes: number; warning: boolean } | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [items, info] = await Promise.all([listVerifiedRecoveryCheckpoints(), getRecoveryJournalStorageInfo()]);
      setCheckpoints(items);
      setJournalInfo(info);
      setSelectedId((current) => items.some((item) => item.id === current) ? current : items[0]?.id || '');
      setMessage(items.length ? '' : 'No verified private recovery checkpoints are available.');
    } catch {
      setMessage('Could not read the private recovery journal. Your saved data has not been changed.');
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
      const created = await createVerifiedRecoveryCheckpoint('User-created manual checkpoint');
      await refresh();
      setMessage(created
        ? 'Checkpoint created and verified. It is now available in the recovery-point list.'
        : 'Checkpoint creation failed. No existing checkpoint was intentionally deleted; check whether saved custom logos are missing or unreadable, then review diagnostics.');
    } catch {
      setMessage('Checkpoint creation failed. Your saved data has not been intentionally changed.');
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    if (!selectedId || busy) return;
    setBusy(true);
    setMessage('Creating a safety checkpoint and validating the selected recovery point…');
    try {
      const result = await restoreVerifiedRecoveryCheckpoint(selectedId);
      if (result.success) {
        setMessage(result.message);
        window.location.reload();
        return;
      }
      // Refreshing the list also updates the status line, so do it first and
      // set the restore result last; otherwise the useful error flashes away.
      await refresh();
      setMessage(result.message);
    } catch (error) {
      await refresh();
      setMessage(error instanceof Error && error.message
        ? 'Recovery stopped: ' + error.message + ' Your saved data has not been intentionally reset. Do not retry until this message has been reviewed.'
        : 'Recovery stopped unexpectedly. Your saved data has not been intentionally reset. Do not retry until diagnostics have been reviewed.');
    } finally {
      setBusy(false);
    }
  };
  const selected = checkpoints.find((item) => item.id === selectedId);
  const togglePin = async () => {
    if (!selected || busy) return;
    setBusy(true);
    const ok = await setRecoveryCheckpointPinned(selected.id, !selected.pinned);
    setMessage(ok ? (selected.pinned ? 'Checkpoint unpinned.' : 'Checkpoint pinned; retention will preserve it.') : 'Could not update checkpoint protection. No checkpoint files were deleted.');
    await refresh();
    setBusy(false);
  };
  return (
    <section className="space-y-3 border-t border-slate-200 pt-5 dark:border-[#354050]">
      <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
        <ShieldCheck className="h-4 w-4 text-teal-600" /> Private Recovery Journal
      </h3>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#354050] dark:bg-[#252D38]/50">
        <p className="text-xs leading-relaxed text-slate-600 dark:text-[#D1D5DB]">
          Checkpoints are stored in this app’s private data directory. Only checkpoints that pass integrity and data-structure checks are selectable. Restoring first creates a checkpoint of the current state. Do not close the app while recovery is running.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void createCheckpoint()} disabled={loading || busy} className="rounded-lg bg-[#00BFA5] px-3 py-2 text-xs font-semibold text-[#18212D] disabled:opacity-50 dark:bg-[#00D7BC]">
            {busy ? 'Working…' : 'Create checkpoint now'}
          </button>
          <button type="button" onClick={() => void refresh()} disabled={loading || busy} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-[#354050]">
            {loading ? 'Checking checkpoints…' : 'Refresh checkpoints'}
          </button>
        </div>
        {journalInfo && <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">Verified recovery points: {journalInfo.verifiedCount} · Journal size: {(journalInfo.estimatedBytes / (1024 * 1024)).toFixed(1)} MB</p>}
        {journalInfo?.warning && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">The private recovery journal is using more than 25 MB. Review retained checkpoints and available device storage. No recovery files will be automatically deleted just to meet a storage limit.</p>}
        {checkpoints.length > 0 && (
          <>
            <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-[#D1D5DB]">
              Verified recovery point
              <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={busy} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA]">
                {checkpoints.map((item) => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString()} · {item.reason}</option>)}
              </select>
            </label>
            {selected && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-600 dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#D1D5DB]">
                <p>Completed games: {selected.gameCount} · Profiles: {selected.profileCount} · Scheduled games: {selected.upcomingGameCount}</p>
                <p className="mt-1 break-words">Checkpoint: {selected.id}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void togglePin()} disabled={!selectedId || busy || loading} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-[#354050]">
                {selected?.pinned ? 'Unpin checkpoint' : 'Pin checkpoint'}
              </button>
              <button type="button" onClick={() => void restore()} disabled={!selectedId || busy || loading} className="rounded-lg bg-[#00BFA5] px-3 py-2 text-xs font-semibold text-[#18212D] disabled:opacity-50 dark:bg-[#00D7BC]">
                {busy ? 'Recovering…' : 'Restore selected checkpoint'}
              </button>
            </div>
          </>
        )}
        {message && <p role="status" aria-live="polite" className="text-xs leading-relaxed text-slate-700 dark:text-[#D1D5DB]">{message}</p>}
      </div>
    </section>
  );
};

export const DataManagementPanel: React.FC<DataManagementPanelProps> = ({
  fileInputRef, onExportBackup, onImportFile, onOpenResetConfirm,
}) => (
              <div className="space-y-6">
            {/* Backup & Restore */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-3 flex items-center gap-2">
                <Download className="w-4 h-4 text-teal-600" />
                Data Backup & Restore
              </h3>

              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onExportBackup}
                  className="p-3 rounded-xl border border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38] hover:bg-slate-100 dark:hover:bg-[#2D3643] text-left flex flex-col gap-1 transition-colors"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-900 dark:text-[#FAFAFA]">
                    <Download className="w-4 h-4 text-blue-600" />
                    Export Full JSON
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                    Saves games, profiles and settings. Custom logo images stay on this device; the JSON stores references only.
                  </div>
                </button>

                <label className="p-3 rounded-xl border border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38] hover:bg-slate-100 dark:hover:bg-[#2D3643] text-left flex flex-col gap-1 cursor-pointer transition-colors">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-900 dark:text-[#FAFAFA]">
                    <Upload className="w-4 h-4 text-teal-600" />
                    Restore From JSON
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                    Upload a previously exported backup file.
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={onImportFile}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-[#9CA3AF]">
                Dugout Pulse works offline. Custom logos are kept locally and are lost if you reset app data or uninstall the app. JSON backups contain logo references, not the images themselves; a logo can be restored only if its matching image is still available on this device.
              </p>
            </div>

            {/* Danger Zone */}
            <div className="pt-2 border-t border-slate-200 dark:border-[#354050]">
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-[#FF5252]/15 border border-red-200 dark:border-[#86252D] flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-xs text-red-900 dark:text-[#D4626D] flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-red-600" />
                    Reset All Local Data
                  </div>
                  <div className="text-[11px] text-red-700 dark:text-[#D4626D]">
                    Deletes all saved data and custom logos from this device.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenResetConfirm}
                  className="px-3 py-1.5 rounded-md bg-red-600 text-white font-semibold text-xs hover:bg-[#A82E38] shrink-0"
                >
                  Reset
                </button>
              </div>
            </div>
            <RecoveryJournalPanel />
            <DiagnosticsPanel />
            </div>
);
