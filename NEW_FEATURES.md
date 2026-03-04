# New Features

Planned and proposed features for Flippay.

---

## History Page: Automatic Refresh

**Status:** Planned  
**Priority:** Medium  
**Target:** `/app/history/page.tsx`

### Description

Add automatic refresh (polling) to the History page so the transaction list updates periodically without requiring the user to navigate away and back.

### Context

- The History page currently fetches transactions **once** on mount.
- No polling or `setInterval` exists for the history/transactions list.
- Other parts of the app already use polling (e.g. PaymentForm, NotificationBell, UserDashboard).
- Transaction data is stored in Supabase and served via `/api/user/transactions`.

### Proposed Implementation

- Use `setInterval` to refetch transactions every **30–60 seconds** while the user is on the History page.
- Clear the interval on unmount to avoid memory leaks.
- Optionally: pause polling when the details modal is open, or when the tab is not visible (using `document.visibilityState`).
- Reuse the existing `fetchTransactions(userId)` function.

### Reference

Similar patterns exist in:
- `NotificationBell.tsx` – 30s polling
- `PaymentForm.tsx` – 30s for payment status, 10s for exchange rate
- `UserDashboard.tsx` – price and balance intervals

---
