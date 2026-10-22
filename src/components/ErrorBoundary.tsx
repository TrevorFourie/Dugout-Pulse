import React from 'react';
import { recordDiagnosticError } from '../utils/errorDiagnostics';

interface ErrorBoundaryState {
  hasError: boolean;
  reference: string | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, reference: null };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    const reference = recordDiagnosticError('react_render', error);
    this.setState({ reference });
  }

  private retry = (): void => {
    this.setState({ hasError: false, reference: null });
  };

  private reload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <main className="min-h-full h-full overflow-auto flex items-center justify-center bg-[#F4F6F8] dark:bg-[#101419] px-5 py-10 text-[#18212D] dark:text-[#FAFAFA]">
          <section className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#354050] bg-white dark:bg-[#1A2028] p-6 shadow-lg" role="alert">
            <div className="text-xs font-bold uppercase tracking-widest text-[#007A6A] dark:text-[#00D7BC]">Dugout Pulse</div>
            <h1 className="mt-2 text-xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-[#D1D5DB]">
              The app hit a problem and could not display this screen. Your data has not been intentionally deleted. Try again or restart the app.
            </p>
            {this.state.reference && (
              <p className="mt-3 text-xs text-slate-500 dark:text-[#9CA3AF]">Error reference: {this.state.reference}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={this.retry} className="rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] px-4 py-2.5 text-sm font-semibold text-[#18212D]">Try again</button>
              <button type="button" onClick={this.reload} className="rounded-xl border border-slate-300 dark:border-[#354050] px-4 py-2.5 text-sm font-semibold">Restart app</button>
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-[#9CA3AF]">If the problem continues, open Settings → Data &amp; About → Diagnostics and export the report. It stays on this device until you choose to share it.</p>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
