# Connect frontend to backend (NEXT_PUBLIC_API_URL)

The payment page and other features need the **backend API URL** so the frontend (flippay.app) can call the backend (flippayback.vercel.app). If this is wrong or missing, you’ll see the default rate (50) and “default rate – connect to backend” on the buy page.

---

## 1. Set the environment variable

**Name:** `NEXT_PUBLIC_API_URL`  
**Value:** Your backend base URL **with no trailing slash**.

- **Local:** `http://localhost:3001` (when the backend runs on port 3001)
- **Production:** `https://flippayback.vercel.app` (or your real backend URL)

Wrong:

- `https://flippayback.vercel.app/` (no trailing slash)
- `flippayback.vercel.app` (must include `https://`)
- Extra spaces before or after the URL

---

## 2. Where to set it

### Local

In the **frontend** folder, create or edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Restart the frontend dev server after changing it.

### Production (Vercel)

1. Open your **frontend** project on [Vercel](https://vercel.com) (the one that deploys flippay.app).
2. Go to **Settings → Environment Variables**.
3. Add (or update):
   - **Key:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://flippayback.vercel.app` (no trailing slash)
   - **Environments:** Production (and Preview if you use it).
4. Save.
5. **Redeploy** the frontend (Deployments → … on latest → Redeploy, or push a new commit).

Important: `NEXT_PUBLIC_*` is baked into the client bundle at **build** time. Changing the variable in Vercel alone is not enough; you must trigger a new build (redeploy) for the new URL to be used.

---

## 3. Check that the backend is reachable

In a browser or with curl:

```bash
curl -s https://flippayback.vercel.app/api/rate
```

You should get JSON with `success`, `rate`, `transactionsEnabled`, etc. If that fails, fix the backend or URL first.

---

## 4. Check the frontend

1. Open the payment page (e.g. flippay.app/payment).
2. Open DevTools → **Network**.
3. Find the request to `.../api/rate` (or `.../api/rate?t=...`).
   - If it’s **red** (failed): check CORS, backend logs, and that the URL is exactly the one you set (no typo, no trailing slash).
   - If it’s **200** and the response has `rate` and `success: true`: the frontend is connected; the rate and “minimum purchase” on the page should match the backend.

---

## 5. Code reference

- The URL is read in `frontend/lib/apiBase.ts` via `getApiBase()` and `getApiUrl(path)`.
- Trailing slashes in `NEXT_PUBLIC_API_URL` are stripped so paths like `/api/rate` don’t get a double slash.
