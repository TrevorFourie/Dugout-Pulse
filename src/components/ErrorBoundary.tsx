import React from 'react';
import { recordDiagnosticError, showDiagnosticScreen } from '../utils/errorDiagnostics';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    const reference = recordDiagnosticError('react_render', error);
    // The HTML bootstrap owns the only error-screen implementation, including
    // its source details, report format, reference, and restart action.
    showDiagnosticScreen(reference);
  }

  render(): React.ReactNode {
    // Avoid rendering a second, competing error UI. The shared screen is mounted
    // directly by the HTML bootstrap and remains available even if React failed.
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
