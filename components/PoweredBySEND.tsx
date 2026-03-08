"use client";

import Image from "next/image";
import { getTokenLogo } from "@/lib/logos";

const SEND_LOGO = "https://res.cloudinary.com/dshqnkjqb/image/upload/v1766979129/71a616bbd4464dfc8c7a5dcb4b3ee043_fe2oeg.png";

export default function PoweredBySEND() {
  const logoUrl = getTokenLogo("SEND") || SEND_LOGO;
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
      <span>Powered by</span>
      <div className="bg-primary/60 p-1.5 rounded flex items-center justify-center overflow-hidden">
        <Image
          src={logoUrl}
          alt="Send"
          width={20}
          height={20}
          className="object-contain"
          unoptimized
        />
      </div>
      <span className="font-medium">Send</span>
    </div>
  );
}

