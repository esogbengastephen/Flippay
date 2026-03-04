# FlipPay Component Library Documentation

## Component Categories

### 1. Foundation Components
These are the building blocks for all other components.

#### Layout Components
- **Container**: Responsive container with max-width constraints
- **Grid**: Flexible grid system for layouts
- **Flex**: Flexbox utility components
- **Spacer**: Consistent spacing elements

#### Typography Components
- **Heading**: Consistent heading hierarchy (H1-H6)
- **Text**: Body text with size and weight variants
- **Label**: Form labels and metadata text
- **Caption**: Supporting text and fine print

### 2. UI Components
Reusable interface elements used throughout the application.

#### Buttons
- **PrimaryButton**: Main action buttons
- **SecondaryButton**: Supporting action buttons
- **IconButton**: Icon-only buttons
- **ButtonGroup**: Grouped buttons with consistent spacing

#### Form Elements
- **Input**: Text input fields with validation states
- **Select**: Dropdown selection components
- **Checkbox**: Checkbox input with custom styling
- **Radio**: Radio button groups
- **Textarea**: Multi-line text input
- **FormLabel**: Associated form labels
- **FormError**: Error message display

#### Feedback Components
- **Toast**: Notification messages (success, error, warning, info)
- **Alert**: Prominent notification banners
- **Tooltip**: Contextual help text
- **Popover**: Content overlays
- **Modal**: Dialog windows
- **Loader**: Loading state indicators

#### Data Display
- **Card**: Content containers with consistent styling
- **Badge**: Status indicators and tags
- **Avatar**: User profile images
- **Progress**: Progress bars and indicators
- **Table**: Data table components
- **List**: Ordered and unordered lists

### 3. Navigation Components
Components for site navigation and user flow.

#### Primary Navigation
- **Header**: Main application header
- **Navbar**: Navigation bar with menu items
- **Sidebar**: Collapsible side navigation
- **BottomNavigation**: Mobile-friendly bottom navigation

#### Secondary Navigation
- **Tabs**: Tabbed interface components
- **Breadcrumbs**: Navigation path indicators
- **Pagination**: Page navigation controls
- **Stepper**: Multi-step process indicators

### 4. Domain-Specific Components
Components specific to the FlipPay fintech platform.

#### Authentication
- **AuthForm**: Login/signup form wrapper
- **PasskeyButton**: Passkey authentication button
- **OTPInput**: One-time password input field
- **SocialLogin**: Social authentication options

#### Wallet & Payments
- **WalletCard**: Wallet information display
- **BalanceDisplay**: Cryptocurrency balance components
- **TransactionItem**: Individual transaction display
- **PaymentForm**: Payment processing interface
- **CurrencySelector**: Currency selection dropdown
- **QRCodeDisplay**: QR code generation and display

#### Financial Data
- **ChartContainer**: Data visualization wrapper
- **StatCard**: Key metric displays
- **PriceTicker**: Real-time price information
- **ExchangeRate**: Currency conversion display

## Component API Standards

### Props Interface
All components should follow consistent prop naming conventions:

```typescript
interface ComponentProps {
  // Core props
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  
  // State props
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  
  // Size variants
  size?: 'sm' | 'md' | 'lg';
  
  // Color variants
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  
  // Event handlers
  onClick?: (event: React.MouseEvent) => void;
  onChange?: (value: any) => void;
  onFocus?: (event: React.FocusEvent) => void;
  onBlur?: (event: React.FocusEvent) => void;
}
```

### Styling Approach
- Use Tailwind CSS utility classes
- Leverage design system tokens
- Support dark mode variants
- Maintain consistent spacing and sizing
- Follow accessibility guidelines

### Accessibility Requirements
- Proper ARIA attributes
- Keyboard navigation support
- Screen reader compatibility
- Sufficient color contrast
- Focus management

## Component Development Guidelines

### File Structure
```
components/
  ├── ui/
  │   ├── Button/
  │   │   ├── Button.tsx
  │   │   ├── Button.types.ts
  │   │   └── Button.stories.tsx
  │   └── Input/
  │       ├── Input.tsx
  │       ├── Input.types.ts
  │       └── Input.stories.tsx
  ├── layout/
  │   └── Container.tsx
  └── domain/
      └── WalletCard.tsx
```

### Component Composition
- Favor composition over configuration
- Use compound components for complex UIs
- Implement proper prop drilling
- Maintain consistent API patterns

### Testing Strategy
- Unit tests for core functionality
- Integration tests for component interactions
- Visual regression tests for UI changes
- Accessibility testing

## Current Component Status

### Existing Components (Needs Audit)
- AuthGuard.tsx - Route protection wrapper
- AdminAuthGuard.tsx - Admin route protection
- BottomNavigation.tsx - Mobile navigation
- DarkModeToggle.tsx - Theme switcher
- ErrorBoundary.tsx - Error handling
- Modal.tsx - Modal dialog
- NotificationBell.tsx - Notification system
- PaymentForm.tsx - Payment processing
- PoweredBySEND.tsx - Branding
- ServiceButton.tsx - Action buttons
- SplashScreen.tsx - Loading screen
- ThemeToggle.tsx - Theme toggle
- Toast.tsx - Notifications
- UserDashboard.tsx - Main dashboard
- UtilityForm.tsx - Utility services
- WagmiProvider.tsx - Web3 provider
- WalletCard.tsx - Wallet display
- WalletConnect.tsx - Wallet connection

### Priority for Refactoring
1. **High Priority**: Auth components, Dashboard, Payment forms
2. **Medium Priority**: Navigation, UI components, Utility forms
3. **Low Priority**: Supporting components, Providers

## Implementation Roadmap

### Phase 1: Foundation (Current)
- [x] Design system audit complete
- [x] Enhanced design tokens implemented
- [ ] Component inventory and categorization
- [ ] Documentation structure established

### Phase 2: Authentication Components
- [ ] AuthForm component
- [ ] Passkey authentication components
- [ ] OTP input components
- [ ] Error handling improvements

### Phase 3: Core UI Components
- [ ] Button component library
- [ ] Form component library
- [ ] Card and layout components
- [ ] Feedback and notification components

### Phase 4: Domain Components
- [ ] Wallet-specific components
- [ ] Payment flow components
- [ ] Transaction display components
- [ ] Financial data visualization

### Phase 5: Integration & Polish
- [ ] Component consistency audit
- [ ] Performance optimization
- [ ] Accessibility compliance
- [ ] Documentation completion