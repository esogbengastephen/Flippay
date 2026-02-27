# Send Xino — Frontend Documentation

This document explains **what the Send Xino (FlipPay) frontend does, how it is structured, and how to work on it**.  
It is written for engineers joining the project so you can get productive quickly.

---

## 1. What this frontend is

- **Product**: A multi‑chain, fiat on/off‑ramp and payments app for SEND / USDC and NGN.
- **Roles**:
  - **End‑users**: Create an account, set up passkeys, manage wallets, buy/sell/swap, view history, off‑ramp to Nigerian bank accounts, pay and issue invoices.
  - **Admins**: Manage promotional banners and monitor invoices/transactions from an admin UI.
- **Architecture**:
  - This repo is a **Next.js 16 app**, talking to a separate backend via HTTP.
  - Authentication is **email + one‑time code** with **WebAuthn passkeys** as a secure second step.
  - User session is stored client‑side and verified on each protected page.

If you are a new frontend dev, this repo is your main workspace.

---

## 2. Tech stack (at a glance)

- **Framework**: Next.js 16 (App Router, React Server Components compatible)
- **Language**: TypeScript + React 19 (`"type": "module"`)
- **Styling & UI**:
  - Tailwind CSS 3 (`tailwind.config`, utility classes everywhere)
  - Custom components for navigation, dark mode, banners, etc.
- **State & data**:
  - React hooks for local/UI state
  - `fetch` + `getApiUrl` for HTTP calls to the backend
  - `@tanstack/react-query` is available for server state (where needed)
- **Crypto / wallets** (used across wallet & swap flows):
  - Coinbase: `@coinbase/cdp-sdk`, `@coinbase/coinbase-sdk`, `@coinbase/onchainkit`
  - EVM: `wagmi`, `viem`, `ethers`, `@walletconnect/ethereum-provider`, `@web3modal/*`
  - Solana: `@solana/web3.js`, `@solana/spl-token`
  - Sui: `@mysten/sui`, `@mysten/sui.js`
  - Bitcoin & keys: `bip32`, `bip39`, `bitcoinjs-lib`, `tiny-secp256k1`, `ed25519-hd-key`
- **Utilities**:
  - `date-fns` for dates
  - `recharts` for charts
  - `browser-image-compression`, `react-easy-crop`, `html2canvas`, `jspdf` for media/exports

You do **not** need to know every library on day 1. Focus first on routing, auth, and basic data fetching.

---

## 3. Project layout (this repo)

High‑level structure:

- `app/`
  - Next.js **App Router** pages.
  - Each folder under `app/` is a route. Examples:
    - `app/auth/page.tsx` – authentication (email + passkey).
    - `app/history/page.tsx` – user transaction history.
    - `app/offramp/page.tsx` – off‑ramp flow to Nigerian bank accounts.
    - `app/invoice/page.tsx` & `app/invoice/[invoiceNumber]/page.tsx` – invoice creation/viewing.
    - `app/payment/callback/page.tsx` – handles payment provider callbacks.
    - `app/admin/banners/page.tsx` – admin banner management.
    - `app/admin/invoices/page.tsx` – admin invoices view.
    - `app/admin/transactions/page.tsx` – admin transactions view.
- `components/`
  - Reusable UI + layout components.
  - Examples (non‑exhaustive):
    - `AuthGuard` – wraps protected areas and enforces login + passkey setup.
    - `BottomNavigation` – mobile‑style bottom nav for main user flows.
    - `DarkModeToggle`, `PoweredBySEND`, modals, buttons, inputs, etc.
- `lib/`
  - Client‑side utilities and integration helpers.
  - `apiBase.ts` – builds backend URLs:
    - `getApiBase()` uses `process.env.NEXT_PUBLIC_API_URL ?? ""`.
    - `getApiUrl(path)` prefixes paths like `/api/…` with that base.
  - `passkey.ts` – WebAuthn / passkey helpers (used by auth and setup flows).
  - `session.ts` – helpers for checking if a user is logged in and reading/writing user data in storage.
  - Other helpers (e.g. bank lists, formatting).
- `public/`
  - Static assets (logos, icons, images) served directly by Next.js.
- Config files (at repo root):
  - `package.json` – scripts and dependencies.
  - `next-env.d.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`.
  - `.env.example` – sample env vars for the frontend build.

---

## 4. Running the frontend locally

### 4.1 Prerequisites

- **Node.js**: 18+ (Node 20 LTS recommended).
- **npm**: latest stable (or `pnpm`/`yarn` if you adapt the commands).
- A running instance of the **backend API**, or an accessible staging/production API URL.

### 4.2 Install dependencies

```bash
npm install
```

(Run from the repo root, i.e. the folder containing `package.json`.)

### 4.3 Configure environment variables

The frontend uses a single key environment variable for talking to the backend:

- `NEXT_PUBLIC_API_URL`
  - Example (local backend on port 3001): `http://localhost:3001`
  - Example (deployed backend): `https://flippayback.vercel.app`

Steps:

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and set:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```
3. If the frontend and backend are deployed **together** (same origin), you can leave this empty; calls will go to the same host.

This value is read by `getApiBase()` in `lib/apiBase.ts` and used everywhere for API calls.

### 4.4 Start the dev server

```bash
npm run dev
```

- Default: `http://localhost:3000`
- Alt script: `npm run dev:80` (if you need port 80 for some reason).

### 4.5 Build, start, and lint

```bash
# Production build
npm run build

# Run built app locally
npm run start

# Lint with Next.js ESLint config
npm run lint
```

---

## 5. Routing & navigation model

The app uses the **App Router** (folders under `app/`). Key routes:

| Route                               | File                                   | Description |
|-------------------------------------|----------------------------------------|-------------|
| `/auth`                             | `app/auth/page.tsx`                    | Email login/signup, code verification, passkey detection and login. |
| `/passkey-setup`                    | `app/passkey-setup/page.tsx`          | Flow for creating and registering WebAuthn passkeys. |
| `/history`                          | `app/history/page.tsx`                 | Transaction list + filters + details modal. |
| `/offramp`                          | `app/offramp/page.tsx`                 | SEND/crypto → NGN to Nigerian bank account. |
| `/invoice`                          | `app/invoice/page.tsx`                 | Create/manage invoices as a user. |
| `/invoice/[invoiceNumber]`         | `app/invoice/[invoiceNumber]/page.tsx` | Public/recipient view of an invoice. |
| `/payment/callback`                 | `app/payment/callback/page.tsx`        | Handles payment provider callback/redirect. |
| `/admin/banners`                    | `app/admin/banners/page.tsx`           | CRUD for promotional banners. |
| `/admin/invoices`                   | `app/admin/invoices/page.tsx`          | Admin invoices dashboard. |
| `/admin/transactions`               | `app/admin/transactions/page.tsx`      | Admin transaction overview. |

On mobile, primary user flows (auth, history, off‑ramp, etc.) are linked via the `BottomNavigation` component.

---

## 6. Authentication & session model

### 6.1 High‑level flow

1. **User opens `/auth`** (`app/auth/page.tsx`).
2. They enter their **email** (and on signup, also referral code & phone number).
3. The frontend requests:
   - A **login code** (email OTP) for login, _or_
   - A **signup code** for new users.
4. After code verification, the backend returns user info + session data.
5. The frontend **stores** user data in client‑side storage (see `lib/session.ts`).
6. For subsequent visits, the app:
   - Checks local storage (`isUserLoggedIn`, `getUserFromStorage`).
   - Validates that the user still exists and is allowed, using `AuthGuard`.
   - Ensures passkey setup is complete, otherwise redirects to `/passkey-setup`.

### 6.2 `AuthPage` (`app/auth/page.tsx`)

Key behaviors (simplified):

- Maintains UI state for:
  - `mode`: `"login" | "signup" | "verify"`.
  - Email, code, referral code, phone number.
  - Loading/error/success messages.
  - Passkey‑related state (`hasPasskey`, `passkeyUserId`, `passkeyUser`, etc.).
- Uses `getApiUrl` to call backend endpoints such as:
  - `/api/auth/request-code`
  - `/api/auth/verify-code`
  - `/api/auth/passkey-login`
- Checks if a user **already has a passkey**:
  - Debounces email input.
  - Calls `/api/auth/passkey-login` to detect existing passkeys.
  - If a passkey is found, shows a “Sign in with passkey” path.
- Uses helpers from `lib/passkey.ts` (`authenticateWithPasskey`, `isPasskeySupported`) to perform WebAuthn flows in the browser.

### 6.3 `AuthGuard` component

- File: `components/AuthGuard.tsx`
- Typical usage:
  - Wrap protected layouts/pages so only logged‑in, valid users can access them.
- Responsibilities:
  1. **Check local session**:
     - Uses `isUserLoggedIn()` and `getUserFromStorage()` from `lib/session`.
     - If not logged in, redirects to `/auth`.
  2. **Verify user still exists on backend**:
     - Calls `/api/auth/verify-user` via `getApiUrl`.
     - If user does not exist, clears session and redirects to `/auth`.
  3. **Enforce passkey setup**:
     - Calls `/api/user/check-passkey?userId=…`.
     - If `needsPasskeySetup` is true, redirects to `/passkey-setup`.

When adding new protected pages, **wrap them in `AuthGuard`** or reuse its checks to ensure consistent behavior.

---

## 7. Working with backend APIs

All frontend API calls should go through `getApiUrl`:

- File: `lib/apiBase.ts`
- Functions:
  - `getApiBase()`:
    - Returns `process.env.NEXT_PUBLIC_API_URL ?? ""`.
    - If env is empty, the frontend assumes the backend is on the same origin.
  - `getApiUrl(path: string)`:
    - Concatenates `getApiBase()` and `path`.
    - Example: `getApiUrl("/api/user/transactions")`.

**Pattern for fetch calls**:

```ts
const response = await fetch(getApiUrl("/api/user/transactions?userId=..."));
const data = await response.json();

if (data.success) {
  // handle data
} else {
  // handle error state (show message, etc.)
}
```

Most backend responses follow a `success: boolean` convention; check this flag before assuming the payload is valid.

---

## 8. Key feature flows (frontend perspective)

### 8.1 Transaction history (`/history`)

- File: `app/history/page.tsx`
- Core behaviors:
  - Guarded by `isUserLoggedIn()`; unauthenticated users are redirected to `/auth`.
  - Reads current user from storage, then calls:
    - `GET /api/user/transactions?userId=…&limit=100`
  - Supports:
    - Filter by transaction type (e.g. `all`, `naira_to_crypto`, `crypto_to_naira`, `invoice`, etc.).
    - Viewing transaction details in a modal.
    - Deep linking to a specific transaction via URL params:
      - `?tx=<transactionId>&type=<type>`

### 8.2 Off‑ramp to bank account (`/offramp`)

- File: `app/offramp/page.tsx`
- Core behaviors:
  - Requires login via `isUserLoggedIn` / `getUserFromStorage`.
  - Preloads any **pending off‑ramp** for the user by calling:
    - `GET /api/offramp/pending?userEmail=<email>`
  - Manages:
    - Bank account details (number + selected bank).
    - Wallet deposit address for sending SEND/crypto.
    - Minimum amount for off‑ramp (`minimumOfframpSEND`).
    - Sell rate (`sellRate`) to convert SEND → NGN.
  - Uses `NIGERIAN_BANKS` from `lib/nigerian-banks` to populate a searchable bank list.
  - Provides status updates for:
    - Verifying account name.
    - Detecting deposited SEND.
    - Processing payouts and handling “taking long” scenarios.
    - Cancelling or refreshing pending off‑ramp requests.

### 8.3 Admin banners (`/admin/banners`)

- File: `app/admin/banners/page.tsx`
- Core behaviors:
  - Fetches existing banners from:
    - `GET /api/admin/banners`
  - Allows admins to:
    - **Create** banners:
      - `POST /api/banners`
    - **Update** banners:
      - `PUT /api/banners/:id`
    - **Delete** banners:
      - `DELETE /api/banners/:id`
  - Each banner has:
    - `title`, `image_url`, `link_url`, `display_order`, `is_active`, `click_count`, timestamps.
  - UI:
    - Table/grid of existing banners.
    - Modal form for create/edit.
    - Simple client‑side validation + error alerts.

> Similar patterns apply to other admin pages (`admin/transactions`, `admin/invoices`): they fetch lists via `getApiUrl`, show tables, and link back into user‑facing flows where relevant.

---

## 9. Styling, theming, and UX conventions

- **Tailwind CSS**:
  - Use utility classes for layout, spacing, colors, etc.
  - Prefer consistent spacing/typography scales from `tailwind.config.js`.
- **Dark mode**:
  - Dark mode support is built in; components use `dark:` variants for colors.
  - `DarkModeToggle` (and any layout/provider) handles toggling the theme.
- **Layout**:
  - Mobile‑first layout with bottom navigation for key user flows.
  - Admin pages use more desktop‑style layout (tables, modals).
- **Feedback**:
  - Always show clear loading, success, and error states (spinners, toasts, inline messages).
  - When calling APIs, disable buttons while a request is in flight to prevent double submits.

When adding new components, follow the same Tailwind conventions and reuse existing typography, colors, and spacing where possible.

---

## 10. Adding or changing frontend features

When you add a **new page**:

1. Create a folder and `page.tsx` under `app/…`.
2. Decide if it should be:
   - **Public** (no auth) – e.g. invoice viewer.
   - **User‑protected** – wrap with `AuthGuard` or copy its checks.
   - **Admin‑only** – (typically also behind `AuthGuard` plus server‑side admin checks via the backend).
3. For data fetching:
   - Use `fetch(getApiUrl("/api/..."))` inside `useEffect` or a dedicated data hook.
   - Handle `success` vs error responses explicitly.
4. For state:
   - Start with React `useState`/`useEffect`.
   - For complex server data, consider using `@tanstack/react-query`.
5. For styling:
   - Follow existing Tailwind patterns and dark mode support.

When you change an **existing flow**:

- **Search first**:
  - For example, to change off‑ramp behavior, inspect:
    - `app/offramp/page.tsx`
    - Any related helpers in `lib/`.
- **Coordinate with backend**:
  - Many flows depend on specific API contracts (e.g. `/api/offramp/*`, `/api/user/*`, `/api/auth/*`).
  - If you change request/response shapes, update both frontend and backend and keep docs in sync.

---

## 11. See also

- **Backend**: API endpoints, webhooks, and deployment docs usually live in the backend repo or a shared monorepo; ask your team for the backend repo or `DOCUMENTATION_BACKEND.md`.
- **This repo**: `README.md` at the root for quick start and repo-specific notes.

---

*This file is the main entry point for new frontend developers. If you update major flows (auth, wallets, off‑ramp, admin), please also update this document so it stays accurate.*
