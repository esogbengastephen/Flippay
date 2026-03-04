"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
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

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console for debugging
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // You can also log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // Clear any problematic localStorage data
    try {
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        // Optionally clear specific items that might be causing issues
        // localStorage.clear(); // Uncomment if needed
      }
    } catch (e) {
      console.warn("Error clearing localStorage:", e);
    }
    
    // Reload the page
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface p-4">
          <div className="max-w-md sm:max-w-lg w-full bg-surface/60 backdrop-blur-[16px] border border-accent/10 rounded-[2.5rem] p-5 sm:p-6 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto bg-amber-500/20 rounded-2xl flex items-center justify-center">
                <span className="material-icons-outlined text-4xl text-amber-400">warning</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-accent/70 mb-6">
              We encountered an unexpected error. Please try refreshing the page.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mb-4 p-4 bg-primary/40 border border-accent/10 rounded-xl text-left">
                <p className="text-sm font-semibold text-white mb-2">Error Details (Development Only):</p>
                <p className="text-xs text-accent/80 font-mono break-all">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-accent/70 cursor-pointer hover:text-white">
                      Stack Trace
                    </summary>
                    <pre className="text-xs text-accent/80 mt-2 overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-3 bg-secondary text-primary rounded-xl font-semibold shadow-[0_0_15px_rgba(19,236,90,0.3)] hover:bg-secondary/90 transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = "/auth";
                  }
                }}
                className="px-6 py-3 bg-primary/40 border border-accent/10 text-accent/80 rounded-xl font-semibold hover:bg-accent/10 hover:text-white transition-colors"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
