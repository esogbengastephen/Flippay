# Enhanced FlipPay Design System

## Design Tokens v2.0

### Color Palette

#### Primary Brand Colors
```css
--color-primary: #00BFFF;        /* Vibrant Sky Blue - Main brand color */
--color-primary-hover: #00A8E6;  /* Slightly darker for hover states */
--color-primary-active: #008FCF; /* Even darker for active states */
--color-secondary: #FFFFFF;      /* Pure white for contrast */
```

#### Background Colors
```css
--color-bg-primary: #FFFFFF;     /* Main background */
--color-bg-secondary: #F8FCFF;   /* Subtle background */
--color-bg-tertiary: #E6F7FF;    /* Card backgrounds */
--color-bg-overlay: rgba(1, 25, 49, 0.8); /* Dark overlay */
```

#### Surface Colors
```css
--color-surface-card: #FFFFFF;   /* Card surfaces */
--color-surface-elevated: #FFFFFF; /* Elevated surfaces */
--color-surface-muted: #F1F9FF;  /* Muted surfaces */
```

#### Border Colors
```css
--color-border-primary: #D9EEF9; /* Main borders */
--color-border-secondary: #EDF7FF; /* Subtle borders */
--color-border-focus: #00BFFF;   /* Focus states */
```

#### Text Colors
```css
--color-text-primary: #0A2540;   /* Main text */
--color-text-secondary: #5E7A8A; /* Secondary text */
--color-text-tertiary: #9FB7C5;  /* Muted text */
--color-text-inverse: #FFFFFF;   /* Text on dark backgrounds */
```

#### Status Colors
```css
--color-success: #10B981;        /* Success states */
--color-warning: #F59E0B;        /* Warning states */
--color-error: #EF4444;          /* Error states */
--color-info: #3B82F6;           /* Information states */
```

#### Dark Mode Variants
```css
--color-dark-bg: #011931;        /* Dark background */
--color-dark-surface: #072544;   /* Dark surfaces */
--color-dark-card: #0A3055;      /* Dark cards */
--color-dark-text: #E0F2FE;      /* Dark mode text */
--color-dark-text-secondary: #B0D7F0; /* Dark mode secondary text */
```

### Typography System

#### Font Family
```css
--font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-family-mono: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
```

#### Font Sizes
```css
--text-xs: 0.75rem;    /* 12px - Captions, fine print */
--text-sm: 0.875rem;   /* 14px - Secondary text, labels */
--text-base: 1rem;     /* 16px - Body text */
--text-lg: 1.125rem;   /* 18px - Lead text */
--text-xl: 1.25rem;    /* 20px - Subheadings */
--text-2xl: 1.5rem;    /* 24px - Headings */
--text-3xl: 1.875rem;  /* 30px - Large headings */
--text-4xl: 2.25rem;   /* 36px - Display headings */
```

#### Font Weights
```css
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
--font-weight-extrabold: 800;
```

#### Line Heights
```css
--line-height-tight: 1.25;
--line-height-snug: 1.375;
--line-height-normal: 1.5;
--line-height-relaxed: 1.625;
--line-height-loose: 2;
```

### Spacing System (8pt Grid)
```css
--space-0: 0;
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.5rem;   /* 24px */
--space-6: 2rem;     /* 32px */
--space-7: 2.5rem;   /* 40px */
--space-8: 3rem;     /* 48px */
--space-9: 4rem;     /* 64px */
--space-10: 5rem;    /* 80px */
--space-12: 6rem;    /* 96px */
--space-16: 8rem;    /* 128px */
```

### Border Radius Scale
```css
--radius-none: 0;
--radius-sm: 0.5rem;   /* 8px */
--radius-md: 0.75rem;  /* 12px */
--radius-lg: 1rem;     /* 16px */
--radius-xl: 1.5rem;   /* 24px */
--radius-2xl: 2rem;    /* 32px */
--radius-3xl: 2.5rem;  /* 40px */
--radius-full: 9999px; /* Circular */
```

### Shadow System
```css
--shadow-none: 0 0 #0000;
--shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

### Z-Index Scale
```css
--z-dropdown: 1000;
--z-sticky: 1020;
--z-fixed: 1030;
--z-modal-backdrop: 1040;
--z-modal: 1050;
--z-popover: 1060;
--z-tooltip: 1070;
```

### Breakpoints
```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

### Animation & Motion
```css
--duration-fast: 120ms;
--duration-base: 180ms;
--duration-slow: 260ms;
--duration-slower: 400ms;

--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-standard: cubic-bezier(0.2, 0, 0.2, 1);
--ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
```

### Component-Specific Tokens

#### Buttons
```css
--button-height-sm: 2rem;      /* 32px */
--button-height-md: 2.5rem;    /* 40px */
--button-height-lg: 3rem;      /* 48px */
--button-padding-x-sm: 0.75rem;
--button-padding-x-md: 1rem;
--button-padding-x-lg: 1.25rem;
```

#### Forms
```css
--input-height-sm: 2rem;       /* 32px */
--input-height-md: 2.5rem;     /* 40px */
--input-height-lg: 3rem;       /* 48px */
--input-padding-x: 1rem;
--input-padding-y: 0.5rem;
```

#### Cards
```css
--card-padding-sm: 1rem;
--card-padding-md: 1.5rem;
--card-padding-lg: 2rem;
```

## Component Categories

### 1. Foundation Components
- Layout primitives
- Grid systems
- Spacing utilities
- Typography components

### 2. UI Components
- Buttons
- Inputs
- Forms
- Cards
- Modals
- Toasts
- Loaders

### 3. Navigation Components
- Header/Navigation bars
- Side navigation
- Breadcrumbs
- Pagination
- Bottom navigation

### 4. Data Display Components
- Tables
- Lists
- Charts
- Progress indicators
- Badges

### 5. Feedback Components
- Alerts
- Toast notifications
- Tooltips
- Popovers
- Dialogs

### 6. Domain-Specific Components
- Wallet components
- Payment forms
- Transaction displays
- Authentication flows

## Usage Guidelines

### Color Usage
- Primary: Main actions, brand elements
- Secondary: Supporting elements, backgrounds
- Success: Positive actions, confirmations
- Warning: Cautionary information
- Error: Destructive actions, errors
- Text: Readability hierarchy

### Typography Hierarchy
- Display: Page titles, major headings
- Headings: Section titles, card headers
- Body: Main content, descriptions
- Labels: Form labels, metadata
- Captions: Supporting text, fine print

### Spacing Principles
- Use 8pt grid for consistent spacing
- Maintain vertical rhythm
- Apply appropriate whitespace for content grouping
- Consider touch targets (minimum 44px)

### Component Composition
- Favor composition over configuration
- Use consistent prop interfaces
- Implement proper accessibility attributes
- Follow established patterns for similar components