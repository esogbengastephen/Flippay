"use client";

interface FSpinnerProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  xs: { sizeClass: "h-4 w-4" },
  sm: { sizeClass: "h-5 w-5" },
  md: { sizeClass: "h-8 w-8" },
  lg: { sizeClass: "h-12 w-12" },
  xl: { sizeClass: "h-16 w-16" },
};

const GIF_SRC = "/asset/flippay-spinner.gif";
const FALLBACK_SRC = "/flippay-logo-white.png";

export default function FSpinner({ className = "", size = "md" }: FSpinnerProps) {
  const { sizeClass } = sizeMap[size];
  return (
    <div className={`inline-flex items-center justify-center ${sizeClass} ${className}`} role="status" aria-label="Loading">
      <img
        src={GIF_SRC}
        alt="Loading"
        className={`object-contain mix-blend-lighten ${sizeClass}`}
        onError={(e) => {
          (e.target as HTMLImageElement).src = FALLBACK_SRC;
        }}
      />
    </div>
  );
}
