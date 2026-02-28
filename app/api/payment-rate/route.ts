import { NextResponse } from "next/server";

const DEFAULT_RATE = 50;
const DEFAULT_MINIMUM = 3000;

/**
 * Server-side proxy for payment page rate. Fetches from backend so the client
 * never hits CORS (same-origin request to this route, server fetches backend).
 * Requires NEXT_PUBLIC_API_URL to be set in the frontend project.
 */
export async function GET() {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) {
    return NextResponse.json({
      success: false,
      rate: DEFAULT_RATE,
      minimumPurchase: DEFAULT_MINIMUM,
      transactionsEnabled: true,
      rateFromApi: false,
      error: "NEXT_PUBLIC_API_URL not set",
    });
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
