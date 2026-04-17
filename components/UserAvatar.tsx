"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export type UserAvatarProps = {
  photoUrl?: string | null;
  /** Used for initial fallback and alt text */
  displayName?: string;
  /** Intrinsic size for Next/Image; use `className` to override rendered size (e.g. responsive). */
  size?: number;
  className?: string;
};

/**
 * Shared circular avatar: green ring (`border-secondary/40`), `object-cover`, consistent fallbacks.
 */
export default function UserAvatar({
  photoUrl,
  displayName = "",
  size = 32,
  className,
}: UserAvatarProps) {
  const initial = displayName.trim().charAt(0).toUpperCase();
  const showInitial = initial.length > 0;

  const ring =
    "rounded-full overflow-hidden border-2 border-secondary/40 flex-shrink-0 bg-primary/40";

  const initialTextClass =
    size >= 64 ? "text-3xl sm:text-5xl" : size >= 48 ? "text-xl" : size >= 32 ? "text-sm" : "text-[10px]";

  const iconClass =
    size >= 48
      ? "material-icons-outlined text-accent/40 text-4xl sm:text-6xl leading-none"
      : "material-icons-round text-sm leading-none";

  if (photoUrl) {
    return (
      <div className={cn(ring, className)}>
        <Image
          src={photoUrl}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        ring,
        "flex items-center justify-center text-secondary",
        className
      )}
    >
      {showInitial ? (
        <span className={cn("font-bold leading-none", initialTextClass)}>{initial}</span>
      ) : size >= 48 ? (
        <span className={cn(iconClass)}>face</span>
      ) : (
        <span className={cn(iconClass)}>person</span>
      )}
    </div>
  );
}
