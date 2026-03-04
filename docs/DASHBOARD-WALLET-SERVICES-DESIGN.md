# Dashboard Wallet & Services – Design Draft

## Overview

Redesign the dashboard to show a focused wallet section and a **collapsed services** pattern: few primary services visible by default, with a "See more" control to expand the full list.

---

## 1. Wallet Section (Portfolio Balance)

### Current State
- 2-column grid: NGN card + Crypto card side by side
- Total balance at top with Deposit button
- Liquid glass styling

### Proposed Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Total Portfolio Balance                    [Deposit]            │
│  $ 1,234.56  +  ₦ 45,000 NGN                                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │ NGN (Fiat)      👁   │  │ Crypto (USD)    👁   │            │
│  │ ₦ 45,000             │  │ $ 1,234.56            │            │
│  │ Nigerian Naira       │  │ Multi-chain            │            │
│  └──────────────────────┘  └──────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

**Design decisions:**
- Keep the same layout (total + 2 cards) – it works well
- Align with Flippay branding: `bg-surface/60`, `border-secondary/10`, `text-secondary` accents
- Optional: add a subtle "View assets" link on the Crypto card for the assets modal
- Maintain blur orbs / glass treatment for consistency with Send/Receive/Settings pages

---

## 2. Services Section – Collapsed by Default

### Current State
- 11 services in a 4-column grid
- All visible at once (Crypto to Naira, Naira to Crypto, Generate Invoice, Create Prediction, Buy Data, Buy Airtime, Pay Betting, TV Sub, Electricity, Gift Card Redeem, Flip Lend)

### Proposed Design: Few + See More

**Initial view (collapsed):**
- Show **4 primary services** in a single row
- "See more" button/link below to expand

```
┌─────────────────────────────────────────────────────────────────┐
│  Services                                                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐              │
│  │ Crypto │  │ Naira  │  │Generate│  │ Create  │              │
│  │to Naira│  │to Crypto│  │Invoice │  │Prediction│              │
│  └────────┘  └────────┘  └────────┘  └────────┘              │
│                                                                  │
│              [ See more services  ▼ ]                            │
└─────────────────────────────────────────────────────────────────┘
```

**Expanded view (after "See more"):**
- Same 4 primary services at top
- Remaining 7 services in a second row
- "See less" to collapse back

```
┌─────────────────────────────────────────────────────────────────┐
│  Services                                                        │
├─────────────────────────────────────────────────────────────────┤
│  Row 1 (Primary):                                                │
│  [Crypto to Naira] [Naira to Crypto] [Generate Invoice] [Create Prediction] │
│                                                                  │
│  Row 2 (Secondary):                                              │
│  [Buy Data] [Buy Airtime] [Pay Betting] [TV Sub] [Electricity]   │
│  [Gift Card Redeem] [Flip Lend]                                  │
│                                                                  │
│              [ See less  ▲ ]                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Primary vs Secondary Services

| Primary (always visible) | Secondary (behind "See more") |
|--------------------------|-------------------------------|
| Crypto to Naira          | Buy Data                      |
| Naira to Crypto          | Buy Airtime                   |
| Generate Invoice         | Pay Betting                   |
| Create Prediction        | TV Sub                        |
|                          | Electricity                   |
|                          | Gift Card Redeem              |
|                          | Flip Lend                     |

**Rationale:** Crypto↔Naira and Invoice are core flows; Prediction is a differentiator. The rest are utilities that can live under "See more".

---

## 4. Quick Actions

**Keep as-is:**
- Send, Receive, Crypto to Naira, Naira to Crypto
- 2×2 grid in the right column
- No change needed – these are the main CTAs

---

## 5. Visual Specs (Flippay Branding)

| Element           | Class / Style                                      |
|-------------------|----------------------------------------------------|
| Section container | `bg-surface/60 backdrop-blur-[24px] rounded-2xl border border-secondary/10` |
| Section title     | `text-lg font-bold text-white` + green accent bar |
| Service card      | `bg-primary/40 border border-accent/10 hover:border-secondary/20` |
| See more button   | `text-secondary font-semibold hover:underline` + chevron icon |
| Icons             | `material-icons-outlined text-secondary`           |

---

## 6. Interaction

1. **Collapsed (default):** 4 primary services, "See more ▼"
2. **Click "See more":** Expand to show all 11 services, change to "See less ▲"
3. **Click "See less":** Collapse back to 4 services
4. **Coming soon** services: Same visual treatment, disabled state, no "Coming soon" badge clutter (or minimal badge)

---

## 7. Responsive

- **Mobile:** 2×2 grid for primary services; expanded view can be 2 columns
- **Desktop:** 4 in a row collapsed; expanded can wrap to 2 rows
- "See more" always centered below the grid

---

## 8. Summary

| Section        | Change                                      |
|----------------|---------------------------------------------|
| Wallet         | Minor polish; keep layout                   |
| Quick Actions  | No change                                   |
| Services       | Collapsed by default (4 visible), "See more" to expand |

---

*Draft only – no implementation. Ready for review before coding.*
