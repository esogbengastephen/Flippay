"use client";

import { useEffect, useState } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Log error for debugging
    console.error("Next.js error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    if (error.digest) {
      console.error("Error digest:", error.digest);
    }
  }, [error]);

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
          We encountered an unexpected error. Please try again.
        </p>

        {/* Show error details toggle for production debugging */}
        {isClient && (
          <div className="mb-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-secondary hover:text-secondary/80 transition-colors"
            >
              {showDetails ? "Hide" : "Show"} Error Details
            </button>
            {showDetails && (
              <div className="p-4 bg-primary/40 border border-accent/10 rounded-xl text-left mt-2">
                <p className="text-sm font-semibold text-white mb-2">Error Details:</p>
                <p className="text-xs text-accent/80 font-mono break-all mb-2">
                  {error.message || "Unknown error"}
                </p>
                {error.digest && (
                  <p className="text-xs text-accent/60 mb-2">Error ID: {error.digest}</p>
                )}
                {error.stack && (
                  <details className="mt-2">
                    <summary className="text-xs text-accent/70 cursor-pointer">Stack Trace</summary>
                    <pre className="text-xs text-accent/70 mt-2 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-secondary text-primary rounded-xl font-semibold shadow-[0_0_15px_rgba(19,236,90,0.3)] hover:bg-secondary/90 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/";
              }
            }}
            className="px-6 py-3 bg-primary/40 border border-accent/10 text-accent/80 rounded-xl font-semibold hover:bg-accent/10 hover:text-white transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
