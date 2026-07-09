import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportRuntimeError } from "../lib/telemetry";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    failed: false
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportRuntimeError({ error, componentStack: info.componentStack });
  }

  render() {
    if (this.state.failed) {
      return <div className="fatal">Weblua hit an unexpected error.</div>;
    }

    return this.props.children;
  }
}
