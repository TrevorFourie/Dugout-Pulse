import React from 'react';
import { Download, Upload, AlertOctagon } from 'lucide-react';
import { DiagnosticsPanel } from '../DiagnosticsPanel';

interface DataManagementPanelProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  onExportBackup: () => void | Promise<void>;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenResetConfirm: () => void;
}

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
            <DiagnosticsPanel />
            </div>
);
