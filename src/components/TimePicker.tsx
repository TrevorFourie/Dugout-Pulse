import React, { useEffect, useId, useRef, useState } from 'react';
import { Clock3, Minus, Plus, X } from 'lucide-react';

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
  allowClear?: boolean;
}

const parseTime = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null;
};

const formatTime = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  ariaLabel,
  className = '',
  placeholder = 'Select time',
  allowClear = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const initial = parseTime(value);
  const [hour, setHour] = useState(String(initial?.hour ?? new Date().getHours()).padStart(2, '0'));
  const [minute, setMinute] = useState(String(initial?.minute ?? new Date().getMinutes()).padStart(2, '0'));
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const minuteId = useId();
  const parsed = parseTime(`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
  const displayTime = parseTime(value) ? value : '';

  const closePicker = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const openPicker = () => {
    const current = parseTime(value) || { hour: new Date().getHours(), minute: new Date().getMinutes() };
    setHour(String(current.hour).padStart(2, '0'));
    setMinute(String(current.minute).padStart(2, '0'));
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    hourRef.current?.focus();
    hourRef.current?.select();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePicker();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const adjustHour = (amount: number) => {
    const current = Number(hour);
    const next = ((Number.isFinite(current) ? current : 0) + amount + 24) % 24;
    setHour(String(next).padStart(2, '0'));
  };

  const adjustMinute = (amount: number) => {
    const current = Number(minute);
    const next = ((Number.isFinite(current) ? current : 0) + amount + 60) % 60;
    setMinute(String(next).padStart(2, '0'));
  };

  const handleDigitChange = (raw: string, field: 'hour' | 'minute') => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    if (field === 'hour') setHour(digits);
    else setMinute(digits);
  };

  const confirmTime = () => {
    if (!parsed) return;
    onChange(formatTime(parsed.hour, parsed.minute));
    closePicker();
  };

  const digitInputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-center font-mono text-3xl font-semibold tabular-nums text-[#18212D] outline-none focus:border-[#00BFA5] focus:ring-2 focus:ring-[#00BFA5]/30 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#FAFAFA] dark:focus:border-[#00D7BC] dark:focus:ring-[#00D7BC]/30';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={displayTime ? `${ariaLabel}: ${displayTime}. Change time` : `${ariaLabel}: choose time`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={openPicker}
        className={`flex w-full min-w-0 items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:focus:ring-[#00D7BC] ${className}`}
      >
        <span className={displayTime ? 'truncate' : 'truncate text-slate-400 dark:text-[#9CA3AF]'}>{displayTime || placeholder}</span>
        <Clock3 className="h-4 w-4 shrink-0 text-slate-500 dark:text-[#9CA3AF]" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePicker();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="my-auto w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-[#354050] dark:bg-[#1A2028] sm:p-5"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC]">{ariaLabel}</p>
                <h2 id={titleId} className="mt-1 text-lg font-semibold text-[#18212D] dark:text-[#FAFAFA]">Choose a time</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">24-hour time</p>
              </div>
              <button type="button" aria-label="Close time picker" onClick={closePicker} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:text-[#D1D5DB] dark:hover:bg-[#252D38] dark:focus:ring-[#00D7BC]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="flex min-w-0 flex-col items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">Hour</span>
                <button type="button" aria-label="Increase hour" onClick={() => adjustHour(1)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:text-[#D1D5DB] dark:hover:bg-[#2D3643] dark:focus:ring-[#00D7BC]"><Plus className="h-4 w-4" /></button>
                <input
                  ref={hourRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="Hour, 00 to 23"
                  maxLength={2}
                  value={hour}
                  onChange={(event) => handleDigitChange(event.target.value, 'hour')}
                  onBlur={() => { if (hour !== '') setHour(String(Math.min(23, Number(hour))).padStart(2, '0')); }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp') { event.preventDefault(); adjustHour(1); }
                    else if (event.key === 'ArrowDown') { event.preventDefault(); adjustHour(-1); }
                    else if (event.key === 'ArrowRight') { event.preventDefault(); document.getElementById(minuteId)?.focus(); }
                  }}
                  className={digitInputClass}
                />
                <button type="button" aria-label="Decrease hour" onClick={() => adjustHour(-1)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:text-[#D1D5DB] dark:hover:bg-[#2D3643] dark:focus:ring-[#00D7BC]"><Minus className="h-4 w-4" /></button>
              </div>

              <span aria-hidden="true" className="pb-1 text-3xl font-semibold text-slate-400 dark:text-[#9CA3AF]">:</span>

              <div className="flex min-w-0 flex-col items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">Minute</span>
                <button type="button" aria-label="Increase minute" onClick={() => adjustMinute(1)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:text-[#D1D5DB] dark:hover:bg-[#2D3643] dark:focus:ring-[#00D7BC]"><Plus className="h-4 w-4" /></button>
                <input
                  id={minuteId}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="Minute, 00 to 59"
                  maxLength={2}
                  value={minute}
                  onChange={(event) => handleDigitChange(event.target.value, 'minute')}
                  onBlur={() => { if (minute !== '') setMinute(String(Math.min(59, Number(minute))).padStart(2, '0')); }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp') { event.preventDefault(); adjustMinute(1); }
                    else if (event.key === 'ArrowDown') { event.preventDefault(); adjustMinute(-1); }
                    else if (event.key === 'ArrowLeft') { event.preventDefault(); hourRef.current?.focus(); }
                  }}
                  className={digitInputClass}
                />
                <button type="button" aria-label="Decrease minute" onClick={() => adjustMinute(-1)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:text-[#D1D5DB] dark:hover:bg-[#2D3643] dark:focus:ring-[#00D7BC]"><Minus className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-center dark:bg-[#252D38]">
              <span className="font-mono text-2xl font-semibold tabular-nums text-[#18212D] dark:text-[#FAFAFA]">{hour || '––'}:{minute || '––'}</span>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              {allowClear ? (
                <button type="button" onClick={() => { onChange(''); closePicker(); }} className="rounded-xl px-3 py-2 text-xs font-semibold text-[#007A6A] hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:text-[#00D7BC] dark:hover:bg-[#252D38] dark:focus:ring-[#00D7BC]">Clear</button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={closePicker} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#252D38] dark:focus:ring-[#00D7BC]">Cancel</button>
                <button type="button" disabled={!parsed} onClick={confirmTime} className="rounded-xl bg-[#00BFA5] px-4 py-2 text-xs font-semibold text-[#18212D] hover:bg-[#00A892] focus:outline-none focus:ring-2 focus:ring-[#18212D] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#00D7BC] dark:text-[#101419] dark:hover:bg-[#00C4AB] dark:focus:ring-[#00D7BC]">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
