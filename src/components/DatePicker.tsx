import React, { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
}

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fromIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const shiftMonth = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1);

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  ariaLabel,
  className = '',
  placeholder = 'Select date',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(value);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initial = fromIsoDate(value) || new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const [focusedDate, setFocusedDate] = useState(value || toIsoDate(new Date()));
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusedDayRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDate = fromIsoDate(value);
  const draftParsed = fromIsoDate(draftDate);
  const monthLabel = visibleMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(1 - firstDay.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
  const displayValue = selectedDate
    ? selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const closePicker = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const openPicker = () => {
    const initial = fromIsoDate(value) || new Date();
    const initialIso = toIsoDate(initial);
    setDraftDate(initialIso);
    setFocusedDate(initialIso);
    setVisibleMonth(new Date(initial.getFullYear(), initial.getMonth(), 1));
    setIsOpen(true);
  };

  const confirmDate = () => {
    if (draftParsed) onChange(toIsoDate(draftParsed));
    closePicker();
  };

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    (focusedDayRef.current || dialog?.querySelector<HTMLButtonElement>('button'))?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePicker();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])'));
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

  useEffect(() => {
    if (isOpen) focusedDayRef.current?.focus();
  }, [focusedDate, visibleMonth, isOpen]);

  const moveFocus = (amount: number) => {
    const current = fromIsoDate(focusedDate) || new Date();
    const next = new Date(current);
    next.setDate(next.getDate() + amount);
    const nextIso = toIsoDate(next);
    setFocusedDate(nextIso);
    setDraftDate(nextIso);
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={displayValue ? `${ariaLabel}: ${displayValue}. Change date` : `${ariaLabel}: choose date`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={openPicker}
        className={`flex w-full min-w-0 items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:focus:ring-[#00D7BC] ${className}`}
      >
        <span className={displayValue ? 'truncate' : 'truncate text-slate-400 dark:text-[#9CA3AF]'}>
          {displayValue || placeholder}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-500 dark:text-[#9CA3AF]" aria-hidden="true" />
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
            className="my-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-[#354050] dark:bg-[#1A2028] sm:p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC]">{ariaLabel}</p>
                <h2 id={titleId} className="mt-1 text-lg font-semibold text-[#18212D] dark:text-[#FAFAFA]">Choose a date</h2>
              </div>
              <button type="button" aria-label="Close date picker" onClick={closePicker} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:text-[#D1D5DB] dark:hover:bg-[#252D38] dark:focus:ring-[#00D7BC]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 flex items-center justify-between gap-2">
              <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))} className="rounded-xl border border-slate-200 p-2.5 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#2D3643] dark:focus:ring-[#00D7BC]">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-semibold text-[#18212D] dark:text-[#FAFAFA]" aria-live="polite">{monthLabel}</h3>
              <button type="button" aria-label="Next month" onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))} className="rounded-xl border border-slate-200 p-2.5 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#2D3643] dark:focus:ring-[#00D7BC]">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div role="grid" aria-label={monthLabel} className="grid grid-cols-7 gap-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((weekday) => (
                <div key={weekday} role="columnheader" className="py-2 text-center text-[10px] font-semibold uppercase text-slate-500 dark:text-[#9CA3AF]">{weekday}</div>
              ))}
              {days.map((day) => {
                const iso = toIsoDate(day);
                const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
                const isSelected = draftDate === iso;
                const isToday = sameDay(day, today);
                const isFocused = focusedDate === iso;
                return (
                  <button
                    key={iso}
                    ref={isFocused ? focusedDayRef : undefined}
                    type="button"
                    aria-label={day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    aria-pressed={isSelected}
                    tabIndex={isFocused ? 0 : -1}
                    onClick={() => { setDraftDate(iso); setFocusedDate(iso); }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowLeft') { event.preventDefault(); moveFocus(-1); }
                      else if (event.key === 'ArrowRight') { event.preventDefault(); moveFocus(1); }
                      else if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(-7); }
                      else if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(7); }
                      else if (event.key === 'PageUp') { event.preventDefault(); setVisibleMonth((month) => shiftMonth(month, event.shiftKey ? -12 : -1)); }
                      else if (event.key === 'PageDown') { event.preventDefault(); setVisibleMonth((month) => shiftMonth(month, event.shiftKey ? 12 : 1)); }
                      else if (event.key === 'Home') { event.preventDefault(); moveFocus(-day.getDay()); }
                      else if (event.key === 'End') { event.preventDefault(); moveFocus(6 - day.getDay()); }
                    }}
                    className={`flex aspect-square min-h-9 items-center justify-center rounded-xl text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:focus:ring-[#00D7BC] ${isSelected ? 'bg-[#00BFA5] text-[#18212D] dark:bg-[#00D7BC] dark:text-[#101419]' : isToday ? 'border border-[#00BFA5] text-[#007A6A] dark:border-[#00D7BC] dark:text-[#00D7BC]' : isCurrentMonth ? 'text-slate-700 hover:bg-slate-100 dark:text-[#D1D5DB] dark:hover:bg-[#2D3643]' : 'text-slate-300 hover:bg-slate-50 dark:text-[#6B7280] dark:hover:bg-[#252D38]'}`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button type="button" onClick={() => { const iso = toIsoDate(today); setDraftDate(iso); setFocusedDate(iso); setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1)); }} className="rounded-xl px-3 py-2 text-xs font-semibold text-[#007A6A] hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:text-[#00D7BC] dark:hover:bg-[#252D38] dark:focus:ring-[#00D7BC]">Today</button>
              <div className="flex gap-2">
                <button type="button" onClick={closePicker} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#252D38] dark:focus:ring-[#00D7BC]">Cancel</button>
                <button type="button" disabled={!draftParsed} onClick={confirmDate} className="rounded-xl bg-[#00BFA5] px-4 py-2 text-xs font-semibold text-[#18212D] hover:bg-[#00A892] focus:outline-none focus:ring-2 focus:ring-[#18212D] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#00D7BC] dark:text-[#101419] dark:hover:bg-[#00C4AB] dark:focus:ring-[#00D7BC]">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
