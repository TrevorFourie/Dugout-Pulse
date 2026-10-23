import React, { useState } from 'react';
import { Bug, Download, Trash2, ShieldCheck } from 'lucide-react';
import { clearDiagnosticLogs, createDiagnosticReport, getCurrentBuildDiagnosticEvent } from '../utils/errorDiagnostics';
import { saveTextFile } from '../utils/saveFile';
import { ConfirmationModal } from './ConfirmationModal';

export const DiagnosticsPanel: React.FC = () => {
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const currentError = getCurrentBuildDiagnosticEvent();
  const events = currentError ? [currentError] : [];
  void refresh;

  const exportReport = async () => {
    const report = createDiagnosticReport();
    const today = new Date().toISOString().slice(0, 10);
    const ok = await saveTextFile(`dugout-pulse-diagnostics-${today}.json`, report, 'application/json');
    setMessage(ok ? 'Diagnostic report is ready to save or share.' : 'Could not export the report. You can review and copy the preview below.');
    if (!ok) setShowPreview(true);
  };

  const clearLogs = () => {
    clearDiagnosticLogs();
    setIsClearConfirmOpen(false);
    setRefresh((value) => value + 1);
    setMessage('Diagnostic log cleared. Your game data was not changed.');
    setShowPreview(false);
  };

  return (
    <section className="space-y-3 border-t border-slate-200 dark:border-[#354050] pt-5">
      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] flex items-center gap-2">
        <Bug className="w-4 h-4 text-teal-600" />
        Offline Diagnostics
      </h3>
      <div className="rounded-xl border border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38]/50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-5 h-5 shrink-0 text-teal-600 dark:text-[#00D7BC]" />
          <p className="text-xs leading-relaxed text-slate-600 dark:text-[#D1D5DB]">
            Diagnostics stay on this device. Nothing is sent automatically. The report records technical error types, app build, platform, exact timestamps, sanitised source locations and relevant technical diagnostics—not game contents, player/team names, account details, full device identifiers or full file paths. Resetting game data keeps this log; clearing browser/app storage or uninstalling the app deletes it. Review the report before choosing to share it.
          </p>
        </div>
        <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
          {currentError ? 'Showing the latest error for the current build only.' : 'No error has been recorded for the current build.'}
        </p>
        {currentError && (
          <div className="rounded-lg border border-red-200 dark:border-[#86252D] bg-white dark:bg-[#101419] p-3 space-y-1">
            <p className="text-xs font-semibold text-slate-700 dark:text-[#D1D5DB]">
              {currentError.errorType || 'Error'} · {currentError.category} · build {currentError.build}
            </p>
            <p className="text-xs leading-relaxed text-red-700 dark:text-red-300 break-words">
              {currentError.errorMessage || 'No error message was captured.'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF]">{currentError.time}</p>
            {currentError.frames?.length ? (
              <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF]">{currentError.frames.join(' · ')}</p>
            ) : null}
            {currentError.details ? (
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-100 dark:bg-[#1A2028] p-2 text-[10px] leading-relaxed text-slate-700 dark:text-[#D1D5DB]">{currentError.details}</pre>
            ) : null}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void exportReport()} className="inline-flex items-center gap-2 rounded-lg bg-[#00BFA5] dark:bg-[#00D7BC] px-3 py-2 text-xs font-semibold text-[#18212D]">
            <Download className="w-4 h-4" /> Export report
          </button>
          <button type="button" onClick={() => setShowPreview((value) => !value)} className="rounded-lg border border-slate-300 dark:border-[#354050] px-3 py-2 text-xs font-semibold">
            {showPreview ? 'Hide preview' : 'Review report'}
          </button>
          <button type="button" onClick={() => setIsClearConfirmOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-[#86252D] px-3 py-2 text-xs font-semibold text-red-700 dark:text-[#D4626D]">
            <Trash2 className="w-3.5 h-3.5" /> Clear log
          </button>
        </div>
        {message && <p role="status" className="text-xs text-slate-600 dark:text-[#D1D5DB]">{message}</p>}
        {showPreview && (
          <div className="space-y-1.5">
            <label htmlFor="diagnostic-report-preview" className="block text-xs font-semibold">Diagnostic report preview (select and copy if needed)</label>
            <textarea id="diagnostic-report-preview" readOnly value={createDiagnosticReport()} rows={10} className="w-full rounded-lg border border-slate-300 dark:border-[#354050] bg-white dark:bg-[#101419] p-2 font-mono text-[10px] leading-relaxed text-slate-800 dark:text-[#D1D5DB]" onFocus={(event) => event.currentTarget.select()} />
          </div>
        )}
      </div>
      <ConfirmationModal
        isOpen={isClearConfirmOpen}
        title="Clear diagnostic log?"
        message="This clears the diagnostic log on this device only. Games, profiles, and settings will not be deleted."
        confirmLabel="Clear log"
        variant="danger"
        onConfirm={clearLogs}
        onCancel={() => setIsClearConfirmOpen(false)}
      />
    </section>
  );
};
