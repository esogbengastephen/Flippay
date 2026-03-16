"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isUserLoggedIn, getUserFromStorage } from "@/lib/session";
import DashboardLayout from "@/components/DashboardLayout";
import { getApiUrl } from "@/lib/apiBase";
import { apiFetch } from "@/lib/api-client";
import FSpinner from "@/components/FSpinner";
import PoweredBySEND from "@/components/PoweredBySEND";

type Tab = "generate" | "mine" | "redeem";

type CouponRow = {
  id: string;
  code: string;
  amount: number;
  status: string;
  expiresAt: string;
  createdAt: string;
};

export default function CouponsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("generate");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [expiryDays, setExpiryDays] = useState(7);
  const [redeemCode, setRedeemCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [createdCodes, setCreatedCodes] = useState<string[]>([]);
  const [myCoupons, setMyCoupons] = useState<CouponRow[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
    }
  }, [router]);

  useEffect(() => {
    if (tab === "mine" && isUserLoggedIn()) {
      const u = getUserFromStorage();
      const uid = u && typeof (u as { id?: string }).id === "string" ? (u as { id: string }).id : "";
      if (!uid) return;
      setLoadingMine(true);
      apiFetch(getApiUrl(`/api/coupons/mine?userId=${encodeURIComponent(uid)}`))
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.coupons) setMyCoupons(data.coupons);
        })
        .catch(() => setMyCoupons([]))
        .finally(() => setLoadingMine(false));
    }
  }, [tab]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = getUserFromStorage();
    if (!user) {
      setMessage({ type: "error", text: "Please log in again." });
      router.push("/auth");
      return;
    }
    const total = parseFloat(amount);
    if (isNaN(total) || total <= 0) {
      setMessage({ type: "error", text: "Enter a valid total amount" });
      return;
    }
    const qty = Math.min(10, Math.max(1, Math.floor(quantity) || 1));
    const minTotal = 50 * qty;
    if (total < minTotal) {
      setMessage({ type: "error", text: `Minimum ₦50 per coupon. For ${qty} coupon(s), total must be at least ₦${minTotal}` });
      return;
    }
    setLoading(true);
    setMessage(null);
    setCreatedCodes([]);
    const userId = (user as { id?: string }).id;
    try {
      const res = await apiFetch(getApiUrl("/api/coupons/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalAmount: total, expiryDays, count: qty, userId: userId }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.coupons) && data.coupons.length > 0) {
        setCreatedCodes(data.coupons.map((c: { code: string }) => c.code));
        setMessage({
          type: "success",
          text: data.coupons.length === 1
            ? "Coupon created. Share the code with anyone to redeem."
            : `${data.coupons.length} coupons created. Share the codes with anyone to redeem.`,
        });
      } else {
        let text = data.error || "Failed to create coupon";
        if (data.transferReference) text += ` Ref: ${data.transferReference}`;
        if (data.detail) text += ` (${data.detail})`;
        setMessage({ type: "error", text });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = getUserFromStorage();
    if (!user) {
      setMessage({ type: "error", text: "Please log in again." });
      router.push("/auth");
      return;
    }
    const code = redeemCode.trim().toUpperCase().replace(/\s/g, "");
    if (!code) {
      setMessage({ type: "error", text: "Enter a coupon code" });
      return;
    }
    setLoading(true);
    setMessage(null);
    const userId = (user as { id?: string }).id;
    try {
      const res = await apiFetch(getApiUrl("/api/coupons/redeem"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, userId }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: data.message || `₦${data.amount} added to your balance` });
        setRedeemCode("");
      } else {
        setMessage({ type: "error", text: data.error || "Invalid or expired code" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setMessage({ type: "success", text: "Code copied to clipboard" });
  };

  const copyAllCodes = () => {
    if (createdCodes.length > 0) {
      navigator.clipboard.writeText(createdCodes.join("\n"));
      setMessage({ type: "success", text: `${createdCodes.length} code(s) copied to clipboard` });
    }
  };

  if (!isUserLoggedIn()) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "generate", label: "Generate" },
    { id: "mine", label: "My Coupons" },
    { id: "redeem", label: "Redeem" },
  ];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background-dark text-white p-4 sm:p-6 pb-28">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-primary/40 border border-accent/10 hover:border-secondary/20"
              aria-label="Back"
            >
              <span className="material-icons-outlined text-white">arrow_back</span>
            </button>
            <h1 className="text-xl font-bold font-display">Coupons</h1>
          </div>

          <div className="flex gap-2 p-1 rounded-2xl bg-surface/60 border border-accent/10 mb-6">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  tab === t.id
                    ? "bg-secondary text-green-950 border-2 border-blue-400 shadow-[0_0_14px_rgba(59,130,246,0.25)] ring-2 ring-blue-400/20"
                    : "text-gray-400 hover:text-gray-300 hover:bg-primary/40 border-2 border-transparent"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {message && (
            <div
              className={`mb-4 p-4 rounded-2xl border text-sm ${
                message.type === "success"
                  ? "bg-secondary/20 border-secondary/40 text-secondary"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}
            >
              {message.text}
            </div>
          )}

          {tab === "generate" && (
            <div className="bg-surface/60 backdrop-blur-[24px] rounded-2xl p-6 border border-secondary/10">
              <h2 className="text-base font-semibold text-white mb-4">Generate Coupon</h2>
              <p className="text-sm text-accent/70 mb-4">Enter the total amount and how many coupons to generate. The amount is split equally (min ₦50 per coupon).</p>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2">Total amount (₦)</label>
                  <input
                    type="number"
                    min={50}
                    step={50}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1000"
                    className="w-full rounded-2xl border border-accent/10 bg-primary/40 px-4 py-3 text-white placeholder-white/40 focus:border-secondary/40 outline-none"
                    aria-label="Total amount to split across coupons"
                  />
                  <p className="text-xs text-accent/50 mt-1">Split equally across coupons. Minimum ₦50 per coupon.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2">Number of coupons</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                    className="w-full rounded-2xl border border-accent/10 bg-primary/40 px-4 py-3 text-white placeholder-white/40 focus:border-secondary/40 outline-none"
                    aria-label="Number of coupons to generate"
                  />
                  <p className="text-xs text-accent/50 mt-1">
                    {quantity} coupon(s) → ₦{amount && !isNaN(parseFloat(amount)) && parseFloat(amount) >= 50 * quantity
                      ? (parseFloat(amount) / quantity).toFixed(2)
                      : "—"} each (max 10 per request, 20 per day)
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2">Expires in</label>
                  <select
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                    aria-label="Expiry in days"
                    className="w-full rounded-2xl border border-accent/10 bg-primary/40 px-4 py-3 text-white focus:border-secondary/40 outline-none"
                  >
                    <option value={1}>1 day</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </div>
                {createdCodes.length > 0 && (
                  <div className="p-4 rounded-xl bg-primary/60 border border-secondary/20 space-y-3">
                    <p className="text-xs text-accent/70">
                      {createdCodes.length === 1 ? "Your coupon code" : "Your coupon codes"}
                    </p>
                    <ul className="space-y-2">
                      {createdCodes.map((code) => (
                        <li key={code} className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-mono font-bold text-secondary break-all">{code}</span>
                          <button type="button" onClick={() => copyCode(code)} className="text-sm font-semibold text-secondary hover:underline shrink-0">
                            Copy
                          </button>
                        </li>
                      ))}
                    </ul>
                    {createdCodes.length > 1 && (
                      <button type="button" onClick={copyAllCodes} className="text-sm font-semibold text-secondary hover:underline">
                        Copy all codes
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-secondary text-green-950 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <FSpinner size="sm" /> : quantity > 1 ? `Generate ${quantity} Coupons` : "Generate Coupon"}
                </button>
              </form>
            </div>
          )}

          {tab === "mine" && (
            <div className="bg-surface/60 backdrop-blur-[24px] rounded-2xl p-6 border border-secondary/10">
              <h2 className="text-base font-semibold text-white mb-4">My Coupons</h2>
              {loadingMine ? (
                <div className="flex justify-center py-8">
                  <FSpinner size="md" />
                </div>
              ) : myCoupons.length === 0 ? (
                <p className="text-sm text-accent/60 py-6 text-center">You haven’t created any coupons yet.</p>
              ) : (
                <ul className="space-y-3">
                  {myCoupons.map((c) => (
                    <li key={c.id} className="p-4 rounded-xl bg-primary/40 border border-accent/10 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-mono font-semibold text-white">{c.code}</p>
                        <p className="text-sm text-accent/70">₦{Number(c.amount).toLocaleString()} · {c.status}</p>
                      </div>
                      <span className={`text-xs font-semibold uppercase ${c.status === "redeemed" ? "text-secondary" : c.status === "expired" ? "text-red-400" : "text-accent/70"}`}>
                        {c.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "redeem" && (
            <div className="bg-surface/60 backdrop-blur-[24px] rounded-2xl p-6 border border-secondary/10">
              <h2 className="text-base font-semibold text-white mb-4">Redeem Coupon</h2>
              <p className="text-sm text-accent/70 mb-4">Enter a code to add the amount to your coupon balance. You can use it for airtime, data, and more.</p>
              <form onSubmit={handleRedeem} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2">Coupon code</label>
                  <input
                    type="text"
                    value={redeemCode}
                    onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                    placeholder="FP-XXXX-XXXX"
                    className="w-full rounded-2xl border border-accent/10 bg-primary/40 px-4 py-3 text-white font-mono placeholder-white/40 focus:border-secondary/40 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-secondary text-green-950 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <FSpinner size="sm" /> : "Redeem"}
                </button>
              </form>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <PoweredBySEND />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
