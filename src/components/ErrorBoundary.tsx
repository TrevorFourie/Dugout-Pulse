import React from 'react';
import { recordDiagnosticError, showDiagnosticScreen } from '../utils/errorDiagnostics';

interface ErrorBoundaryState {
  hasError: boolean;
  errorReference: string;
  showLocalFallback: boolean;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorReference: '',
    showLocalFallback: false,
  };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true, showLocalFallback: false };
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
          background: '#F4F6F8',
          color: '#18212D',
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
      </main>
    );
  }
}
