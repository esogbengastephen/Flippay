"use client";

import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, type RefObject } from "react";

type RefType = RefObject<HTMLElement | null>;

export function useClickAway(refs: RefType | RefType[], callback: () => void) {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const refsArray = Array.isArray(refs) ? refs : [refs];
      const isOutside = refsArray.every((ref) => {
        return ref.current && !ref.current.contains(event.target as Node);
      });
      if (isOutside) callback();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [refs, callback]);
}

export function useKeyPress(targetKey: string, callback: () => void) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === targetKey) callback();
    };
    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [targetKey, callback]);
}

interface DropdownProps {
  children: React.ReactNode;
  className?: string;
}

interface DropdownTriggerProps {
  children: React.ReactNode;
  className?: string;
}

interface DropdownContentProps {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "left" | "right";
  placement?: "top" | "bottom" | "auto";
  sideOffset?: number;
}

interface DropdownItemProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

interface DropdownSeparatorProps {
  className?: string;
}

type DropdownContextType = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
};

const DropdownContext = React.createContext<DropdownContextType | undefined>(
  undefined
);

const useDropdownContext = () => {
  const context = React.useContext(DropdownContext);
  if (!context) {
    throw new Error("Dropdown components must be used within a Dropdown component");
  }
  return context;
};

export function Dropdown({ children, className = "" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className={`relative inline-block text-left ${className}`}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownTrigger({
  children,
  className = "",
}: DropdownTriggerProps) {
  const { open, setOpen, triggerRef } = useDropdownContext();

  return (
    <div
      ref={triggerRef}
      onClick={() => setOpen(!open)}
      className={`inline-flex cursor-pointer ${className}`}
      aria-expanded={open}
      aria-haspopup="true"
    >
      {children}
    </div>
  );
}

export function DropdownContent({
  children,
  className = "",
  align = "start",
  side = "left",
  placement = "auto",
  sideOffset = 8,
}: DropdownContentProps) {
  const { open, setOpen, triggerRef, contentRef } = useDropdownContext();

  useClickAway([triggerRef, contentRef], () => {
    if (open) setOpen(false);
  });

  useKeyPress("Escape", () => {
    if (open) setOpen(false);
  });

  const [actualPlacement, setActualPlacement] = useState(placement);

  React.useEffect(() => {
    if (
      !open ||
      placement !== "auto" ||
      !triggerRef.current ||
      !contentRef.current
    )
      return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();
    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const contentHeight = contentRect.height;

    if (spaceBelow < contentHeight && spaceAbove > spaceBelow) {
      setActualPlacement("top");
    } else {
      setActualPlacement("bottom");
    }
  }, [open, placement, triggerRef, contentRef]);

  const alignmentClasses = {
    start: side === "left" ? "left-0" : "right-0",
    center: "left-1/2 -translate-x-1/2",
    end: side === "left" ? "right-0" : "left-0",
  }[align];

  const positionClasses =
    actualPlacement === "top" ? "bottom-full mb-2" : "top-full mt-2";

  const getTransformOrigin = () => {
    if (actualPlacement === "top") {
      if (align === "center") return "bottom center";
      if (
        (side === "left" && align === "start") ||
        (side === "right" && align === "end")
      )
        return "bottom left";
      return "bottom right";
    } else {
      if (align === "center") return "top center";
      if (
        (side === "left" && align === "start") ||
        (side === "right" && align === "end")
      )
        return "top left";
      return "top right";
    }
  };

  const dropdownVariants = React.useMemo(() => {
    const yOffset = actualPlacement === "top" ? 5 : -5;
    let xOffset = 0;
    if (align === "center") xOffset = 0;
    else if (align === "start") xOffset = side === "left" ? -5 : 5;
    else if (align === "end") xOffset = side === "left" ? 5 : -5;

    return {
      hidden: {
        opacity: 0,
        y: yOffset,
        x: xOffset,
        scale: 0.95,
        transition: {
          y: { type: "spring" as const, stiffness: 700, damping: 35 },
          x: { type: "spring" as const, stiffness: 700, damping: 35 },
          opacity: { duration: 0.1, ease: "easeInOut" as const },
          scale: { duration: 0.1, ease: "easeInOut" as const },
        },
      },
      visible: {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        transition: {
          y: { type: "spring" as const, stiffness: 700, damping: 35 },
          x: { type: "spring" as const, stiffness: 700, damping: 35 },
          opacity: { duration: 0.15, ease: "easeInOut" as const },
          scale: { duration: 0.1, ease: "easeInOut" as const },
        },
      },
      exit: {
        opacity: 0,
        y: yOffset,
        x: xOffset,
        scale: 0.95,
        transition: {
          y: { type: "spring" as const, stiffness: 500, damping: 25 },
          x: { type: "spring" as const, stiffness: 500, damping: 25 },
          opacity: { duration: 0.1, ease: "easeInOut" as const },
          scale: { duration: 0.1, ease: "easeInOut" as const },
        },
      },
    };
  }, [actualPlacement, side, align]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={contentRef}
          variants={dropdownVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ transformOrigin: getTransformOrigin() }}
          className={`absolute z-[9999] min-w-[8rem] overflow-hidden rounded-xl border border-secondary/10 bg-surface/95 backdrop-blur-[24px] p-1 shadow-2xl text-accent ${positionClasses} ${alignmentClasses} ${className}`}
          role="menu"
          aria-orientation="vertical"
          tabIndex={-1}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DropdownItem({
  children,
  className = "",
  onClick,
  disabled = false,
  destructive = false,
}: DropdownItemProps) {
  const { setOpen } = useDropdownContext();

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    setOpen(false);
  };

  return (
    <button
      className={`relative flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition-colors ${
        disabled
          ? "pointer-events-none opacity-50 text-accent/50"
          : destructive
            ? "text-error hover:bg-error/10 focus:bg-error/10"
            : "text-accent hover:bg-surface-highlight/80 focus:bg-surface-highlight/80"
      } ${className}`}
      onClick={handleClick}
      role="menuitem"
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function DropdownSeparator({ className = "" }: DropdownSeparatorProps) {
  return (
    <div
      className={`mx-1 my-1 h-px bg-accent/10 ${className}`}
      role="separator"
    />
  );
}
