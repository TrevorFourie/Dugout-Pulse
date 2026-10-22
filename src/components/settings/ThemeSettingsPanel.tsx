import React from 'react';
import { Sun, Moon } from 'lucide-react';
import type { AppSettings } from '../../types/baseball';

interface ThemeSettingsPanelProps {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
}

export const ThemeSettingsPanel: React.FC<ThemeSettingsPanelProps> = ({ settings, updateSettings }) => (
              <div className="space-y-6">
              {/* Appearance */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-3 flex items-center gap-2">
                  <Sun className="w-4 h-4 text-blue-500" />
                  Theme
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'dark', label: 'Dark', icon: Moon },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = settings.darkMode === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          updateSettings({
                            darkMode: item.id as 'system' | 'light' | 'dark',
                          })
                        }
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-[#00BFA5] shadow-md dark:border-[#00D7BC]'
                            : 'bg-slate-50 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border-slate-200 dark:border-[#354050]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
  
              
  
                </div>
);
