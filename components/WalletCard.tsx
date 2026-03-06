"use client";

import React from 'react';

interface WalletCardProps {
  label: string;
  currency: 'NGN' | 'Crypto';
  amount: string;
  isHidden: boolean;
  onToggleVisibility: () => void;
  accountNumber?: string;
  icon: string;
  onViewAssets?: () => void;
  comingSoon?: boolean;
}

export const WalletCard: React.FC<WalletCardProps> = ({
  label,
  currency,
  amount,
  isHidden,
  onToggleVisibility,
  accountNumber,
  icon,
  onViewAssets,
  comingSoon = false,
}) => {
  return (
    <div className={`min-w-0 bg-surface-highlight rounded-lg p-3 sm:p-5 flex flex-col justify-between border border-white/5 shadow-lg relative overflow-hidden group min-h-[120px] sm:min-h-[140px] animate-card-enter card-hover hover:border-secondary/30 transition-all ${comingSoon ? "opacity-70 pointer-events-none cursor-not-allowed" : ""}`}>
      <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-secondary/5 rounded-full" aria-hidden></div>

      <div className="flex justify-between items-start mb-2 min-w-0">
        <div className="flex items-center gap-1.5 text-accent min-w-0">
          <span className="material-icons-round text-lg shrink-0 text-secondary">{icon}</span>
          <span className="font-bold text-sm truncate font-display">{label}</span>
        </div>
        {!comingSoon && (
          <div className="flex items-center gap-2 shrink-0">
            {currency === 'Crypto' && onViewAssets && (
              <button 
                onClick={onViewAssets} 
                className="focus:outline-none"
                title="View assets"
              >
                <span className="material-icons-round text-accent/60 text-sm cursor-pointer hover:text-secondary transition-colors">
                  list
                </span>
              </button>
            )}
            <button onClick={onToggleVisibility} className="focus:outline-none">
              <span className="material-icons-round text-accent/60 text-sm cursor-pointer hover:text-secondary transition-colors">
                {isHidden ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 min-w-0 overflow-hidden">
        {comingSoon ? (
          <p className="text-xs font-semibold text-accent/60 uppercase tracking-wide">Coming soon</p>
        ) : (
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate font-display">
            {isHidden ? '••••••••' : amount}
          </h2>
        )}
      </div>

      {comingSoon ? (
        <div className="h-8"></div>
      ) : accountNumber ? (
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-semibold text-accent/70">Account Details</p>
          <div className="flex items-center gap-1">
            <p className="text-xs font-bold text-accent tracking-wider">{accountNumber}</p>
            <span 
              className="material-icons-round text-[10px] text-accent/60 cursor-pointer hover:text-secondary transition-colors"
              onClick={() => navigator.clipboard.writeText(accountNumber)}
            >
              content_copy
            </span>
          </div>
        </div>
      ) : (
        <div className="h-8"></div>
      )}
    </div>
  );
};
