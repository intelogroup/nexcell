import React, { Component, type ReactNode } from 'react';

// Helper to safely stringify objects with circular references
function getCircularReplacer() {
  const seen = new WeakSet();
  return function (_key: string, value: any) {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Something went wrong
                </h2>
                <p className="text-sm text-gray-600">
                  An unexpected error occurred in the application
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-gray-50 rounded p-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Error Details:
                </h3>
                <pre className="text-xs text-red-600 overflow-x-auto">
                  {typeof this.state.error === 'string'
                    ? this.state.error
                    : this.state.error instanceof Error
                    ? this.state.error.toString()
                    : JSON.stringify(this.state.error, getCircularReplacer(), 2)}
                </pre>
              </div>
            )}

            {this.state.errorInfo && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  Component Stack
                </summary>
                <pre className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-4 overflow-x-auto">
                  {typeof this.state.errorInfo === 'string'
                    ? this.state.errorInfo
                    : this.state.errorInfo.componentStack
                      ? this.state.errorInfo.componentStack
                      : JSON.stringify(this.state.errorInfo, getCircularReplacer(), 2)}
                </pre>
              </details>
            )}

            {/* end helper usage */}

            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Try Again
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded">
              <p className="text-xs text-gray-600">
                <strong>Tip:</strong> If this error persists, try clearing your browser cache
                or opening the browser console (F12) for more details.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
