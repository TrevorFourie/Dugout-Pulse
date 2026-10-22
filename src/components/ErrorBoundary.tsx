import React from 'react';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import { StartupRecoveryPanel } from './StartupRecoveryPanel';

interface ErrorBoundaryState {
  hasError: boolean;
  errorReference: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorReference: '' };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    const reference = recordDiagnosticError('react_render', error);
    this.setState({ errorReference: reference });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <StartupRecoveryPanel errorReference={this.state.errorReference} />;
    }
    return this.props.children;
  }
}
