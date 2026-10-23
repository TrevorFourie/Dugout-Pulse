import React from 'react';
import { recordDiagnosticError, showDiagnosticScreen } from '../utils/errorDiagnostics';

interface ErrorBoundaryState {
  hasError: boolean;
  errorReference: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorReference: '' };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // React's component stack is separate from Error.stack and is essential for
    // locating render failures in the component tree on mobile devices.
    const reference = recordDiagnosticError('react_render', error, info.componentStack);
    this.setState({ errorReference: reference });
    showDiagnosticScreen(reference);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Keep the React tree unmounted while the document-level diagnostic screen is visible.
      // Recovery tools remain available from that screen, but are not the automatic error fallback.
      return null;
    }
    return this.props.children;
  }
}
