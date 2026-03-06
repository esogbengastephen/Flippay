"use client";

import FSpinner from "./FSpinner";

interface PageLoadingSpinnerProps {
  message?: string;
  /** Background class - defaults to bg-background-dark */
  bgClass?: string;
}

/**
 * Full-page centered loading spinner. Use for page-level loading states.
 * Always positioned at viewport center via fixed inset-0.
 */
export default function PageLoadingSpinner({ message = "Loading...", bgClass = "bg-background-dark" }: PageLoadingSpinnerProps) {
  return (
    <div className={`fixed inset-0 flex items-center justify-center z-[100] ${bgClass}`}>
      <div className="flex flex-col items-center justify-center gap-4">
        <FSpinner size="page" />
        {message && <p className="text-accent/80 text-sm">{message}</p>}
      </div>
    </div>
  );
}
