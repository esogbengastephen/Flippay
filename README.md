# Send Xino (FlipPay) — Frontend

Next.js 16 frontend for the Send Xino multi-chain fiat on/off-ramp and payments app (SEND / USDC / NGN).

## Quick start

- **Node.js** 18+ (20 LTS recommended)
- **Backend** must be running or set to a deployed API URL

```bash
npm install
cp .env.example .env.local
# Edit .env.local: set NEXT_PUBLIC_API_URL (e.g. http://localhost:3001)
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

## Documentation

- **[FRONTEND_DOCUMENTATION.md](./FRONTEND_DOCUMENTATION.md)** — Full guide for developers: stack, project layout, auth, API usage, routing, and how to add or change features.

## Scripts

| Command         | Description              |
|-----------------|--------------------------|
| `npm run dev`   | Start dev server         |
| `npm run build` | Production build        |
| `npm run start` | Run production build     |
| `npm run lint`  | Run ESLint               |
