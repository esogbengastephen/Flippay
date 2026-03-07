import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_RATE = 50;
const DEFAULT_MINIMUM = 3000;

/**
 * Server-side proxy for payment page rate. Fetches from backend so the client
 * never hits CORS (same-origin request to this route, server fetches backend).
 * Minimum purchase is always loaded from DB via backend /api/rate.
 */
export async function GET() {
  let base = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) {
    base = "http://localhost:3001";
  }

  let rate: number | null = null;
  let minimumPurchase = DEFAULT_MINIMUM;
  let transactionsEnabled = true;

  try {
    const [tokenRes, rateRes] = await Promise.all([
      fetch(`${base}/api/token-prices?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      }),
      fetch(`${base}/api/rate?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      }),
    ]);

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (tokenRes.ok && tokenData.success && tokenData.pricesNGN?.SEND != null) {
      const sendNgn = Number(tokenData.pricesNGN.SEND);
      if (!Number.isNaN(sendNgn) && sendNgn > 0) {
        rate = 1 / sendNgn;
      }
    }

    const rateData = await rateRes.json().catch(() => ({}));
    if (rateRes.ok && rateData.success) {
      if (rateData.transactionsEnabled !== undefined) {
        transactionsEnabled = rateData.transactionsEnabled !== false;
      }
      if (rateData.minimumPurchase != null && Number(rateData.minimumPurchase) > 0) {
        minimumPurchase = Number(rateData.minimumPurchase);
      }
      if (rate == null && rateData.rate != null) {
        const r = Number(rateData.rate);
        if (!Number.isNaN(r) && r > 0) rate = r;
      }
    }

    const finalRate = rate ?? DEFAULT_RATE;
    return NextResponse.json({
      success: true,
      rate: finalRate,
      minimumPurchase,
      transactionsEnabled,
      rateFromApi: rate != null,
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      rate: DEFAULT_RATE,
      minimumPurchase,
      transactionsEnabled,
      rateFromApi: false,
      error: String(e),
    });
  }
}
