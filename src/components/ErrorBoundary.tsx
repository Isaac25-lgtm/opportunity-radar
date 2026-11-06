import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { error: Error | null };

/** Last-resort boundary: shows a recoverable message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center" role="alert">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 max-w-md text-ink-500">
          This page could not be loaded. Check your connection and reload. Your saved work is not affected.
        </p>
        <button className="btn btn-md btn-primary mt-6" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
