"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export interface TransactionSuccessProps {
  sendType: "ngn" | "crypto";
  amount: string;
  // NGN-specific
  recipientName?: string;
  bankName?: string;
  accountNumber?: string;
  // Crypto-specific
  chain?: string;
  token?: string;
  recipientAddress?: string;
  txHash?: string;
  explorerUrl?: string;
  // Actions
  onSendAgain: () => void;
}

function DetailRow({
  label,
  value,
  mono = false,
  isLast = false,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  isLast?: boolean;
  link?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between py-3 ${!isLast ? "border-b" : ""}`}
      style={{ borderColor: "rgba(19,236,90,0.08)" }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "rgba(226,232,240,0.45)" }}
      >
        {label}
      </span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-sm font-semibold underline underline-offset-2 ${mono ? "font-mono" : ""}`}
          style={{ color: "#13EC5A" }}
        >
          {value}
        </a>
      ) : (
        <span
          className={`text-sm font-semibold text-right max-w-[55%] break-all ${mono ? "font-mono text-xs" : ""}`}
          style={{ color: "#E2E8F0" }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

export default function TransactionSuccess({
  sendType,
  amount,
  recipientName,
  bankName,
  accountNumber,
  chain,
  token,
  recipientAddress,
  txHash,
  explorerUrl,
  onSendAgain,
}: TransactionSuccessProps) {
  const router = useRouter();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const truncateAddress = (addr: string) =>
    addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : "";

  const formattedAmount =
    sendType === "ngn"
      ? `₦${parseFloat(amount).toLocaleString()}`
      : `${amount} ${token ?? ""}`;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5 overflow-y-auto"
      style={{ background: "#05110B" }}
    >
      {/* Ambient glow blob */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(19,236,90,0.1) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-sm flex flex-col items-center py-8 sm:py-12 relative">
        {/* ── Success Icon ── */}
        <div className="relative mb-5 sm:mb-7">
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-40"
            style={{ background: "rgba(19,236,90,0.2)" }}
          />
          <div
            className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(19,236,90,0.1)",
              border: "1.5px solid rgba(19,236,90,0.45)",
              boxShadow:
                "0 0 40px rgba(19,236,90,0.2), inset 0 0 20px rgba(19,236,90,0.06)",
            }}
          >
            <span
              className="material-icons-outlined text-[40px] sm:text-[52px] text-[#13EC5A]"
            >
              check_circle
            </span>
          </div>
        </div>

        {/* ── Headline ── */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1" style={{ color: "#E2E8F0" }}>
          Transaction Successful
        </h1>
        <p className="text-sm mb-5 sm:mb-7" style={{ color: "rgba(226,232,240,0.5)" }}>
          Your transfer has been processed
        </p>

        {/* ── Amount ── */}
        <div
          className="text-3xl sm:text-4xl font-extrabold mb-6 sm:mb-8 tracking-tight"
          style={{ color: "#13EC5A" }}
        >
          {formattedAmount}
        </div>

        {/* ── Detail Card ── */}
        <div
          className="w-full rounded-2xl px-5 mb-6 sm:mb-8"
          style={{
            background: "rgba(14,35,22,0.75)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(19,236,90,0.12)",
          }}
        >
          {sendType === "ngn" ? (
            <>
              {recipientName && (
                <DetailRow label="Recipient" value={recipientName} />
              )}
              {bankName && <DetailRow label="Bank" value={bankName} />}
              {accountNumber && (
                <DetailRow label="Account" value={accountNumber} mono />
              )}
            </>
          ) : (
            <>
              {chain && <DetailRow label="Network" value={chain} />}
              {token && <DetailRow label="Token" value={token} />}
              {recipientAddress && (
                <DetailRow
                  label="To"
                  value={truncateAddress(recipientAddress)}
                  mono
                />
              )}
              {txHash && (
                <DetailRow
                  label="Tx Hash"
                  value={truncateAddress(txHash)}
                  mono
                  link={explorerUrl}
                />
              )}
            </>
          )}

          {/* Status row */}
          <div
            className="flex items-center justify-between pt-4 mt-1 pb-4"
            style={{ borderTop: "1px solid rgba(19,236,90,0.08)" }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "rgba(226,232,240,0.45)" }}
            >
              Status
            </span>
            <span
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(19,236,90,0.1)",
                color: "#13EC5A",
                border: "1px solid rgba(19,236,90,0.2)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: "#13EC5A" }}
              />
              Confirmed
            </span>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 sm:py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.97]"
            style={{
              background: "#13EC5A",
              color: "#05110B",
              boxShadow: "0 4px 24px rgba(19,236,90,0.28)",
            }}
          >
            Back to Home
          </button>

          <button
            onClick={onSendAgain}
            className="w-full py-3 sm:py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.97]"
            style={{
              background: "rgba(19,236,90,0.07)",
              color: "#13EC5A",
              border: "1px solid rgba(19,236,90,0.22)",
            }}
          >
            Send Again
          </button>

          <button
            onClick={() => router.push("/history")}
            className="w-full py-3 text-sm font-semibold transition-all"
            style={{ color: "rgba(226,232,240,0.45)" }}
          >
            View Transaction History
          </button>
        </div>
      </div>
    </div>
  );
}
