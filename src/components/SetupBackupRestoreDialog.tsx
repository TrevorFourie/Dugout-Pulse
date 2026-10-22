import React from 'react';
import { AlertTriangle, Upload, X } from 'lucide-react';

interface SetupBackupRestoreDialogProps {
  file: File | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const SetupBackupRestoreDialog: React.FC<SetupBackupRestoreDialogProps> = ({
  file,
  onCancel,
  onConfirm,
}) => {
  if (!file) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white dark:bg-[#1A2028] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#354050] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">
              Restore from backup?
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-[#9CA3AF] leading-relaxed">
            You're about to restore data from <strong className="text-slate-800 dark:text-[#D1D5DB]">{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB). This will replace your current data and skip the rest of setup.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors flex items-center justify-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restore</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
