import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ========== FLIPPAY BRAND PALETTE ==========
        
        // Primary Brand Colors (Dark Forest Green theme)
        primary: {
          DEFAULT: "#11281A",
          hover: "#0E2316",
          active: "#05110B",
          50: "#23423E",
          100: "#1a352f",
          200: "#11281A",
          300: "#0E2316",
          400: "#0a1a12",
          500: "#05110B",
        },
        secondary: "#13EC5A",
        accent: "#E2E8F0",
        "surface-highlight": "#23423E",
        "background-dark": "#05110B",
        
        // Background Colors
        background: {
          primary: "var(--color-bg-primary)",
          secondary: "var(--color-bg-secondary)",
          tertiary: "var(--color-bg-tertiary)",
          overlay: "var(--color-bg-overlay)",
        },
        
        // Surface Colors
        surface: {
          DEFAULT: "#0E2316",
          card: "var(--color-surface-card)",
          elevated: "var(--color-surface-elevated)",
          muted: "var(--color-surface-muted)",
          strong: "var(--color-surface-strong)", // Legacy
          soft: "var(--color-surface-soft)",     // Legacy
        },
        
        // Border Colors
        border: {
          primary: "var(--color-border-primary)",
          secondary: "var(--color-border-secondary)",
          focus: "var(--color-border-focus)",
          DEFAULT: "var(--color-border)", // Legacy
        },
        
        // Text Colors
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          inverse: "var(--color-text-inverse)",
          DEFAULT: "var(--text-primary)",     // Legacy
          muted: "var(--text-muted)",         // Legacy
        },
        
        // Status Colors
        success: {
          DEFAULT: "var(--color-success)",
          50: "#F0FDF4",
          100: "#DCFCE7",
          200: "#BBF7D0",
          300: "#86EFAC",
          400: "#4ADE80",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
          800: "#065F46",
          900: "#064E3B",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
        },
        error: {
          DEFAULT: "var(--color-error)",
          50: "#FEF2F2",
          100: "#FEE2E2",
          200: "#FECACA",
          300: "#FCA5A5",
          400: "#F87171",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
          800: "#991B1B",
          900: "#7F1D1D",
        },
        info: {
          DEFAULT: "var(--color-info)",
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
        
        // Dark Mode Colors
        dark: {
          bg: "var(--color-dark-bg)",
          surface: "var(--color-dark-surface)",
          card: "var(--color-dark-card)",
          text: "var(--color-dark-text)",
          "text-secondary": "var(--color-dark-text-secondary)",
          // Legacy dark colors
          "ds-bg": "var(--dark-bg)",
          "ds-surface": "var(--dark-surface)",
          "ds-surface-soft": "var(--dark-surface-soft)",
        },
        
        // Legacy Colors (for backward compatibility)
        "background-light": "#FFFFFF",
        "card-dark": "#011931",
        "card-light": "#FFFFFF",
        "light-blue": "#D3E0EF",
        "light-grey": "#D1D3D4",
        "medium-grey": "#A7A9AC",
        black: "#000000",
        white: "#FFFFFF",
        "accent-green": "#13EC5A",
        "text-primary-dark": "#FFFFFF",
        
        // Design System Tokens (CSS vars for light/dark)
        "ds-primary": "var(--color-primary)",
        "ds-surface-strong": "var(--color-surface-strong)",
        "ds-surface-soft": "var(--color-surface-soft)",
        "ds-bg-light": "var(--color-bg-light)",
        "ds-border": "var(--color-border)",
        "ds-text-primary": "var(--text-primary)",
        "ds-text-secondary": "var(--text-secondary)",
        "ds-text-muted": "var(--text-muted)",
      },
      fontFamily: {
        sans: ["Montserrat", "var(--font-family-sans)", "sans-serif"],
        display: ["Montserrat", "var(--font-family-sans)", "sans-serif"],
        mono: ["var(--font-family-mono)", "monospace"],
      },
      borderRadius: {
        none: "var(--radius-none)",
        sm: "var(--radius-sm)",
        DEFAULT: "0.5rem",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
        full: "var(--radius-full)",
        // Legacy design system tokens
        "ds-sm": "var(--radius-sm)",
        "ds-md": "var(--radius-md)",
        "ds-lg": "var(--radius-lg)",
        "ds-xl": "var(--radius-xl)",
        // Legacy values
        "old-sm": "var(--radius-old-sm)",
        "old-md": "var(--radius-old-md)",
        "old-lg": "var(--radius-old-lg)",
        "old-xl": "var(--radius-old-xl)",
      },
      boxShadow: {
        none: "var(--shadow-none)",
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
        // Legacy design system tokens
        "ds-soft": "var(--shadow-soft)",
        "ds-base": "var(--shadow-base)",
      },
      spacing: {
        0: "var(--space-0)",
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        7: "var(--space-7)",
        8: "var(--space-8)",
        9: "var(--space-9)",
        10: "var(--space-10)",
        12: "var(--space-12)",
        16: "var(--space-16)",
        // Legacy design system tokens
        "ds-2": "var(--space-2)",
        "ds-3": "var(--space-3)",
        "ds-4": "var(--space-4)",
        "ds-5": "var(--space-5)",
        "ds-6": "var(--space-6)",
        "ds-7": "var(--space-7)",
        "ds-8": "var(--space-8)",
        // Legacy spacing values
        "old-2": "var(--space-old-2)",
        "old-3": "var(--space-old-3)",
        "old-4": "var(--space-old-4)",
        "old-5": "var(--space-old-5)",
        "old-6": "var(--space-old-6)",
        "old-7": "var(--space-old-7)",
        "old-8": "var(--space-old-8)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
        slower: "var(--duration-slower)",
        // Legacy motion tokens
        "motion-fast": "var(--motion-fast)",
        "motion-base": "var(--motion-base)",
        "motion-slow": "var(--motion-slow)",
      },
      transitionTimingFunction: {
        "ease-in": "var(--ease-in)",
        "ease-out": "var(--ease-out)",
        "ease-in-out": "var(--ease-in-out)",
        "ease-standard": "var(--ease-standard)",
        "ease-emphasized": "var(--ease-emphasized)",
        "ease-exit": "var(--ease-exit)",
      },
      fontSize: {
        xs: ["var(--text-xs)", { lineHeight: "var(--line-height-normal)" }],
        sm: ["var(--text-sm)", { lineHeight: "var(--line-height-normal)" }],
        base: ["var(--text-base)", { lineHeight: "var(--line-height-normal)" }],
        lg: ["var(--text-lg)", { lineHeight: "var(--line-height-normal)" }],
        xl: ["var(--text-xl)", { lineHeight: "var(--line-height-tight)" }],
        "2xl": ["var(--text-2xl)", { lineHeight: "var(--line-height-tight)" }],
        "3xl": ["var(--text-3xl)", { lineHeight: "var(--line-height-tight)" }],
        "4xl": ["var(--text-4xl)", { lineHeight: "var(--line-height-tight)" }],
      },
      fontWeight: {
        regular: "var(--font-weight-regular)",
        medium: "var(--font-weight-medium)",
        semibold: "var(--font-weight-semibold)",
        bold: "var(--font-weight-bold)",
        extrabold: "var(--font-weight-extrabold)",
      },
      lineHeight: {
        tight: "var(--line-height-tight)",
        snug: "var(--line-height-snug)",
        normal: "var(--line-height-normal)",
        relaxed: "var(--line-height-relaxed)",
        loose: "var(--line-height-loose)",
      },
      zIndex: {
        dropdown: "var(--z-dropdown)",
        sticky: "var(--z-sticky)",
        fixed: "var(--z-fixed)",
        "modal-backdrop": "var(--z-modal-backdrop)",
        modal: "var(--z-modal)",
        popover: "var(--z-popover)",
        tooltip: "var(--z-tooltip)",
      },
      keyframes: {
        popIn: {
          "0%": { transform: "translateY(-50%) scale(0.8)" },
          "50%": { transform: "translateY(-50%) scale(1.1)" },
          "100%": { transform: "translateY(-50%) scale(1)" },
        },
        "card-enter": {
          "0%": { transform: "translateY(6px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        popIn: "popIn 0.3s ease-out",
        "card-enter": "card-enter 180ms cubic-bezier(0.2, 0, 0.2, 1)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
export default config;
