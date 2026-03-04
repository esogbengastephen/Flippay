"use client";

import Image from "next/image";

export default function PoweredBySEND() {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
      <span>Powered by</span>
      <div className="bg-primary p-1.5 rounded flex items-center justify-center">
        <Image
          src="/flippay-logo-white.png"
          alt="FlipPay"
          width={20}
          height={20}
          className="object-contain mix-blend-lighten"
        />
      </div>
      <span className="font-medium">Flippay</span>
    </div>
  );
}

