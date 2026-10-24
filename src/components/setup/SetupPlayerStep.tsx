import React, { useRef } from 'react';
import { User, ArrowRight, Upload, CheckCircle2 } from 'lucide-react';

interface SetupPlayerStepProps {
  playerName: string;
  setPlayerName: (value: string) => void;
  error: string | null;
  setError: (value: string | null) => void;
  importMessage: { text: string; isError: boolean } | null;
  onSubmit: (event: React.FormEvent) => void;
  onBackupFileSelected: (file: File) => void;
}

/** First setup step: player identity and optional backup restoration. */
export const SetupPlayerStep: React.FC<SetupPlayerStepProps> = ({
  playerName,
  setPlayerName,
  error,
  setError,
  importMessage,
  onSubmit,
  onBackupFileSelected,
}) => {
  const backupFileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onBackupFileSelected(file);
    event.currentTarget.value = '';
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block mb-1">
          Step 1 of 5
        </span>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-[#FAFAFA]">
          Who are you scoring for?
        </h2>
        <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">
          Enter your player’s name. All games, batting spray charts, and pitching rest will be recorded under this profile.
        </p>
      </div>

      <div className="space-y-3 pt-1">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] mb-1.5 flex items-center gap-1.5">
            <User className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]" />
            Player Name *
          </label>
          <input
            type="text"
            required
            autoFocus
            placeholder="e.g. Lucas Miller, Maya Chen"
            value={playerName}
            onChange={(event) => {
              setPlayerName(event.target.value);
              if (error) setError(null);
            }}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-base font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]"
          />
          <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-1.5">
            Jersey numbers are saved per team, since a player may wear a different number for each one.
          </p>
        </div>
      </div>

      {importMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
            importMessage.isError
              ? 'bg-red-50 dark:bg-[#FF5252]/15 border border-red-200 dark:border-[#86252D] text-red-600 dark:text-[#F6DADD]'
              : 'bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300'
          }`}
        >
          {importMessage.isError ? (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{importMessage.text}</span>
        </div>
      )}

      <div className="pt-3 border-t border-slate-200 dark:border-[#354050]">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#252D38]/60 border border-dashed border-slate-300 dark:border-[#354050] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-[#FAFAFA]">
              <Upload className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]" />
              <span>Have a backup file?</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-0.5">
              Restore your data from a previous export and skip setup entirely.
            </p>
          </div>
          <button
            type="button"
            onClick={() => backupFileRef.current?.click()}
            className="shrink-0 px-3 py-2 rounded-xl border border-[#00BFA5]/40 dark:border-[#00D7BC]/50 text-[#007A6A] dark:text-[#00D7BC] text-xs font-semibold hover:bg-[#00BFA5]/10 dark:hover:bg-[#00D7BC]/15 transition-colors"
          >
            Upload Backup
          </button>
          <input
            ref={backupFileRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      <div className="pt-3 flex items-center justify-end border-t border-slate-200 dark:border-[#354050]">
        <button
          type="submit"
          disabled={!playerName.trim()}
          className="px-5 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] disabled:opacity-50 text-[#18212D] dark:text-[#101419] font-semibold text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
        >
          <span>Next: Age Group</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
};
