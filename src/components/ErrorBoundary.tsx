import React from 'react';
import { createDiagnosticReport, recordDiagnosticError, showDiagnosticScreen } from '../utils/errorDiagnostics';

interface ErrorBoundaryState {
  hasError: boolean;
  errorReference: string;
  showLocalFallback: boolean;
  showReport: boolean;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorReference: '',
    showLocalFallback: false,
    showReport: false,
  };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true, showLocalFallback: false, showReport: false };
  }

  private getDiagnosticReport(): string {
    try {
      return createDiagnosticReport(this.state.errorReference || undefined);
    } catch {
      return 'The diagnostic report could not be prepared. Please share error reference ' + (this.state.errorReference || 'unavailable') + ' if you need help.';
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Never let a secondary diagnostic failure replace the original render error
    // or leave the user with a blank screen if the document-level UI is unavailable.
    let reference = 'unavailable';
    try {
      reference = recordDiagnosticError('react_render', error, info.componentStack);
    } catch {
      // Preserve the original error; the local fallback below still provides guidance.
    }

    let screenShown = false;
    try {
      screenShown = showDiagnosticScreen(reference);
    } catch {
      // showDiagnosticScreen is defensive, but keep this boundary defensive too.
    }

    this.setState({
      errorReference: reference,
      showLocalFallback: !screenShown,
      showReport: false,
    });
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (!this.state.showLocalFallback) return null;

    return (
      <main
        role="alert"
        aria-live="assertive"
        style={{
          minHeight: '100vh',
          boxSizing: 'border-box',
          padding: '32px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          background: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? '#101419' : '#F4F6F8',
          color: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? '#FAFAFA' : '#18212D',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Dugout Pulse needs to restart</h1>
        <p style={{ maxWidth: '480px', margin: 0, lineHeight: 1.6 }}>
          Something went wrong while displaying this screen. Please restart the app to try again.
          If the problem happens again, share the diagnostic report if it is available. Please keep
          the app installed and avoid clearing its data for now.
        </p>
        <p style={{ margin: 0, fontSize: '13px' }}>Error reference: {this.state.errorReference || 'unavailable'}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              borderRadius: '12px',
              padding: '12px 20px',
              background: '#00BFA5',
              color: '#18212D',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Restart app
          </button>
          <button
            type="button"
            aria-expanded={this.state.showReport}
            aria-controls="dugout-pulse-fallback-report"
            onClick={() => this.setState((state) => ({ showReport: !state.showReport }))}
            style={{
              border: '1px solid #64748B',
              borderRadius: '12px',
              padding: '12px 20px',
              background: 'transparent',
              color: 'inherit',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {this.state.showReport ? 'Hide diagnostic report' : 'Show diagnostic report'}
          </button>
        </div>
        {this.state.showReport && (
          <div id="dugout-pulse-fallback-report" style={{ width: '100%', maxWidth: '640px', textAlign: 'left' }}>
            <p style={{ fontSize: '13px', lineHeight: 1.5 }}>Review this report before sharing it. Select and copy the text if you need to send it for help.</p>
            <textarea
              aria-label="Sanitised diagnostic report"
              readOnly
              value={this.getDiagnosticReport()}
              rows={12}
              onFocus={(event) => event.currentTarget.select()}
              style={{ boxSizing: 'border-box', width: '100%', padding: '12px', border: '1px solid #64748B', borderRadius: '8px', background: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? '#1A2028' : '#FFFFFF', color: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? '#E2E8F0' : '#18212D', fontFamily: 'monospace', fontSize: '12px' }}
            />
          </div>
        )}
      </main>
    );
  }
}
