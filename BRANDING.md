# FlipPay Brand Guidelines

## Brand Color Palette

Official FlipPay brand colors for consistent application across all touchpoints.

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| **Primary** | Dark Forest Green | `#11281A` | Main brand color, primary actions, key UI elements |
| **Secondary** | Neon Green | `#13EC5A` | Accent highlights, CTAs, success states, interactive elements |
| **Accent** | Light Gray/White | `#E2E8F0` | Text on dark backgrounds, borders, subtle contrast |
| **Surface** | Darker Forest Green | `#0E2316` | Card backgrounds, elevated surfaces |
| **Surface Highlight** | Lighter Green | `#23423E` | Hover states, highlighted surfaces |
| **Background Dark** | Deepest Green/Black | `#05110B` | Main dark background, deepest layer |

### CSS Custom Properties (Reference)

```css
--color-brand-primary: #11281A;           /* Dark Forest Green */
--color-brand-secondary: #13EC5A;        /* Neon Green */
--color-brand-accent: #E2E8F0;           /* Light Gray/White */
--color-brand-surface: #0E2316;          /* Darker Forest Green */
--color-brand-surface-highlight: #23423E; /* Lighter Green */
--color-brand-bg-dark: #05110B;          /* Deepest Green/Black */
```

### Quick Reference

- **Primary (Dark Forest Green):** `#11281A`
- **Secondary (Neon Green):** `#13EC5A`
- **Accent (Light Gray/White):** `#E2E8F0`
- **Surface (Darker Forest Green):** `#0E2316`
- **Surface Highlight (Lighter Green):** `#23423E`
- **Background Dark (Deepest Green/Black):** `#05110B`

## Compact Selector Card

Use for network/crypto selection (e.g. Crypto to Naira, Naira to Crypto).

| Element | Classes / Spec |
|---------|----------------|
| **Card** | `max-w-sm`, `rounded-xl`, `p-4`, `bg-surface/95`, `backdrop-blur-[24px]`, `border border-secondary/10` |
| **Title** | `text-base font-bold` |
| **Subtitle** | `text-xs text-accent/70 mb-3` |
| **Options spacing** | `space-y-2` |
| **Option button** | `p-3 rounded-lg`, `bg-primary/40`, `border border-accent/10` |
| **Option icon** | `w-9 h-9 rounded-lg` container, `w-5 h-5` image |
| **Option label** | `text-sm font-semibold uppercase` |
