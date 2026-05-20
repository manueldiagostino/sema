"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Global error boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="max-w-md rounded-lg border border-red-300 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
            <h2 className="mb-2 text-xl font-semibold text-red-700 dark:text-red-300">
              Something went wrong
            </h2>
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">
              An unexpected error occurred. Please refresh the page or try again later.
            </p>
            {this.state.error && (
              <pre className="mb-4 max-h-40 overflow-auto rounded bg-red-100 p-3 text-left text-xs text-red-800 dark:bg-red-900 dark:text-red-200">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-secondary"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
