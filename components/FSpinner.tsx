"use client";

import Image from "next/image";

interface FSpinnerProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  xs: { sizeClass: "h-4 w-4", px: 16 },
  sm: { sizeClass: "h-5 w-5", px: 20 },
  md: { sizeClass: "h-8 w-8", px: 32 },
  lg: { sizeClass: "h-12 w-12", px: 48 },
  xl: { sizeClass: "h-16 w-16", px: 64 },
};

export default function FSpinner({ className = "", size = "md" }: FSpinnerProps) {
  const { sizeClass, px } = sizeMap[size];
  return (
    <div className={`inline-flex items-center justify-center ${sizeClass} ${className}`} role="status" aria-label="Loading">
      <Image
        src="/flippay-logo-white.png"
        alt="Loading"
        width={px}
        height={px}
        className={`animate-spin object-contain mix-blend-lighten ${sizeClass}`}
      />
    </div>
  );
}
