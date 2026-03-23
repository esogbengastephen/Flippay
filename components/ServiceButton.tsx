"use client";

import React from "react";

interface ServiceButtonProps {
  icon: string;
  label: string;
  onClick?: () => void;
  useCustomIcon?: boolean;
  comingSoon?: boolean;
}

/**
 * Service card styled like portfolio balance cards (bg-primary, white icons).
 * Flippay branding: primary #11281A, secondary #13EC5A, accent #E2E8F0.
 */
export const ServiceButton: React.FC<ServiceButtonProps> = ({
  icon,
  label,
  onClick,
  useCustomIcon = false,
  comingSoon = false,
}) => {
  return (
    <button
      type="button"
      onClick={comingSoon ? undefined : onClick}
      disabled={comingSoon}
      className={`flex flex-col items-center justify-center gap-1 sm:gap-2 p-3 sm:p-5 rounded-2xl bg-primary border border-accent/10 text-white w-full h-[92px] sm:h-[110px] group transition-all ${
        comingSoon
          ? "cursor-not-allowed opacity-60"
          : "hover:border-secondary/30 hover:shadow-[0_0_20px_rgba(19,236,90,0.15)] active:scale-[0.98]"
      }`}
    >
      <span className="material-icons-outlined text-2xl sm:text-3xl text-white opacity-90">
        {icon}
      </span>
      <span className="text-[10px] font-bold text-center leading-tight text-white/90 font-display whitespace-pre-wrap">
        {label}
      </span>
    </button>
  );
};
