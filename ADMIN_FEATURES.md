# FlipPay Admin Features

This document describes the features available in the FlipPay Admin Panel (`/admin`).

---

## Overview

The admin panel is protected by wallet authentication. Admins connect their wallet to access the dashboard and manage platform operations. Access is role-based: **Super Admin** has full access; **Admin** has permissions granted per feature.

---

## 1. Dashboard (`/admin`)

**Permission:** `view_dashboard`

Central overview of platform metrics and activity.

### Stats Cards
- **Total Volume (TV)** – All funds processed (onramp + offramp)
- **Total Users**
- **Total Onramp Transactions**
- **Total Revenue (NGN)**
- **Total Revenue ($SEND)**
- **Tokens Distributed**
- **Offramp Transactions** & **Offramp Volume**
- **Smart Wallets** – Adoption metrics (Base, Solana)
- **KYC Verified (Tier 2+)**
- **Pending / Successful / Failed Payments**

### Network Breakdown
- **Base Network** – Transactions, volume, completed/pending/failed
- **Solana Network** – Same metrics
- **Offramp Summary** – Total transactions, volume, success rate

### Smart Wallet & KYC
- Smart wallet adoption (Base, Solana, both)
- KYC tier distribution (Tier 1, 2, 3) with pie chart

### Revenue & Analytics
- Revenue breakdown by service type (Onramp vs Offramp)
- Network revenue breakdown chart
- Revenue trends (last 30 days)
- Transaction volume chart (last 30 days)

### Quick Actions
- Links to Onramp, Offramp, All Transactions, KYC, Payments, Invoices

### Recent Activity
- Recent transaction activity with status, time, wallet, and Basescan link

---

## 2. Onramp (`/admin/onramp`)

**Permission:** `manage_onramp`

Manage NGN → crypto onramp transactions.

### Features
- List onramp transactions with pagination
- Filter by status (pending, completed, failed)
- View transaction details: ID, Paystack reference, wallet, NGN amount, SEND amount, exchange rate, sendtag, timestamps, tx hash
- **Check SEND Routes** – Verify USDC/USDC-WETH/SEND pool availability and swap routes

---

## 3. All Transactions (`/admin/transactions`)

**Permission:** `manage_transactions`

Unified view of all onramp transactions.

### Features
- List transactions with status (pending, completed, failed)
- Filter by status, date range, amount range
- Search by wallet address, Paystack reference, transaction ID
- View verification history and attempt details
- Link to Basescan for completed transactions

---

## 4. Payments (`/admin/payments`)

**Permission:** `verify_payments`

Verify and manage pending payments.

### Features
- List pending payments from Paystack
- Verify payments (match with transactions, mark as verified)
- View payment details: reference, amount, customer, status, transaction link
- Filter and search payments

---

## 5. Invoices (`/admin/invoices`)

**Permission:** `manage_invoices`

Manage merchant invoices.

### Features
- List invoices with pagination
- Filter by status (pending, paid, expired, cancelled)
- View invoice details: number, merchant, amount, currency, customer, status, due date, payment info
- Link to related transactions

---

## 6. Users (`/admin/users`)

**Permission:** `manage_users`

Manage platform users.

### Features
- List users with pagination
- Search by email, wallet, referral code
- Filter by transaction count, spend, date range
- View user details: email, wallet, referral code, referral count, transactions, spend, SEND received
- **Block / Unblock** users
- **Reset user** – Trigger passkey reset
- **Export** – Export selected users or filtered results
- **Delete user** – With confirmation

---

## 7. Referrals (`/admin/referrals`)

**Permission:** `view_referrals`

Manage referral program and referrers.

### Features
- List referrers with stats
- Search and filter (min referrals, active referrals, spending, date range)
- View referral stats: total users, total referrals, active referrers, referral revenue
- Top referrer highlight
- Drill-down into referred users per referrer

---

## 8. Token Distribution (`/admin/token-distribution`)

**Permission:** `manage_token_distribution`

Monitor SEND token distribution.

### Features
- View liquidity pool balance
- Check wallet balance (any address)
- List distribution history (completed transactions with SEND amounts, tx hashes)

---

## 9. Utility (`/admin/utility`)

**Permission:** `manage_utility`

Configure utility services (airtime, data, TV, etc.).

### Features
- List utility services by category (airtime, data, TV, betting, electricity, school, etc.)
- Enable/disable each service
- Edit per-service settings:
  - Markup percentage
  - Min/max amount
  - API endpoint
  - Supported networks
- Per-network markup override

---

## 10. Test Transfer (`/admin/test-transfer`)

**Permission:** `test_transfers`

Test SEND transfers from the liquidity pool.

### Features
- Check pool balance (requires connected admin wallet)
- Verify pool configuration
- Send test SEND transfer to a recipient address
- View pool address, token contract, balance

---

## 11. Price Action (`/admin/price-action`)

**Permission:** `manage_price_action`

Configure exchange rates and pricing.

### Features
- **BUY (Onramp) tab:**
  - Live prices (SEND, USDC, USDT) from API
  - CoinGecko prices (USD, NGN)
  - Admin-set exchange rates (NGN ↔ SEND, USDC, USDT)
  - Profit margins (NGN per token)
  - Enable/disable onramp
  - Minimum purchase (NGN)
  - Auto-publish from CoinGecko
- **SELL (Offramp) tab:**
  - Live sell prices
  - Admin-set sell rates
  - Profit margins
  - Enable/disable offramp
  - Minimum offramp SEND

---

## 12. Banners (`/admin/banners`)

**Permission:** `manage_banners`

Manage homepage banners.

### Features
- List banners
- Add new banner (title, image URL, link URL, display order, active)

- Edit banner
- Delete banner
- Reorder display (display_order)
- Toggle active/inactive
- View click count

---

## 13. Offramp (`/admin/offramp`)

**Permission:** `manage_offramp`

Manage crypto → NGN offramp transactions.

### Features
- List offramp transactions with pagination
- Filter by status, network (Base, Solana), token
- View transaction details: user, wallet, network, token amount, USDC amount, NGN amount, status, swap tx hash, Paystack reference, timestamps
- Link to block explorer for swap tx

---

## 14. KYC Management (`/admin/kyc`)

**Permission:** `manage_kyc`

Manage user KYC verification.

### Features
- List users with KYC status
- Filter by tier (Tier 1, 2, 3)
- Search by email or name
- View KYC tier, BVN status, upgrade eligibility
- Manually update user KYC tier (admin override)

---

## 15. Settings (`/admin/settings`)

**Permission:** `manage_settings`

Platform and admin management.

### Features
- **Deposit Account** – View NGN deposit account details
- **Admin Management:**
  - List admins (wallet, role, permissions, status)
  - Add new admin (wallet, role, permissions)
  - Edit admin (role, permissions, active/inactive)
  - Deactivate admin
- **Permissions:** Per-tab granular access (view_dashboard, manage_onramp, etc.)

---

## 16. Token Prices (`/admin/token-prices`)

**Permission:** (via `manage_settings` or admin settings)

Manage token prices (SEND, USDC, USDT).

### Features
- View current admin-set prices
- Edit prices (NGN per token)
- View price history (updated_at, updated_by)

---

## Permission Summary

| Permission              | Description                    |
|------------------------|--------------------------------|
| `view_dashboard`       | Access dashboard               |
| `manage_onramp`        | Onramp transactions            |
| `manage_transactions`  | All transactions               |
| `verify_payments`      | Payment verification           |
| `manage_invoices`      | Invoice management             |
| `manage_users`         | User management                |
| `view_referrals`       | Referral program               |
| `manage_token_distribution` | Token distribution         |
| `manage_utility`       | Utility services               |
| `test_transfers`       | Test transfers                 |
| `manage_price_action`  | Exchange rates & pricing       |
| `manage_banners`       | Homepage banners               |
| `manage_offramp`       | Offramp transactions           |
| `manage_kyc`           | KYC management                 |
| `manage_settings`      | Platform & admin settings      |

---

## Authentication

- **Wallet Connect** – Admins connect via wallet (e.g. MetaMask)
- **Session** – 24-hour session stored in localStorage
- **Roles:** `super_admin` (full access), `admin` (permission-based)
- **API:** `/api/admin/me` returns role and permissions for the connected wallet
