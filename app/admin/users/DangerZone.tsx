"use client";

import FSpinner from "@/components/FSpinner";

interface DangerZoneProps {
  resetEmail: string;
  setResetEmail: (v: string) => void;
  searchedUser: any;
  setSearchedUser: (v: any) => void;
  deleteConfirmation: string;
  setDeleteConfirmation: (v: string) => void;
  searchError: string | null;
  searchLoading: boolean;
  resetting: boolean;
  onSearch: () => void;
  onReset: () => void;
  onCancel: () => void;
}

export default function DangerZone({
  resetEmail,
  setResetEmail,
  searchedUser,
  setSearchedUser,
  deleteConfirmation,
  setDeleteConfirmation,
  searchError,
  searchLoading,
  resetting,
  onSearch,
  onReset,
  onCancel,
}: DangerZoneProps) {
  return (
    <div className="w-full max-w-md mx-auto bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
        <span className="material-icons-outlined text-xl">warning</span>
        DANGER ZONE - Reset User Account
      </h2>
      <p className="text-sm text-accent/70 mb-4">
        Search by email to permanently reset an account. This action is IRREVERSIBLE.
      </p>

      <div className="bg-surface/60 backdrop-blur-[16px] rounded-xl p-4 mb-4 border border-accent/10">
        <label className="block text-[10px] uppercase tracking-wider text-accent/60 mb-2 font-bold">
          Search User by Email
        </label>
        <div className="flex gap-2 min-w-0">
          <input
            type="email"
            placeholder="user@example.com"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            className="flex-1 min-w-0 bg-primary border border-accent/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
          />
          <button
            onClick={onSearch}
            disabled={searchLoading || !resetEmail.trim()}
            className="flex-shrink-0 px-4 py-2.5 bg-primary/60 border border-accent/10 text-white rounded-lg hover:bg-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium whitespace-nowrap"
          >
            {searchLoading ? (
              <>
                <FSpinner size="xs" />
                Searching...
              </>
            ) : (
              <>
                <span className="material-icons-outlined text-lg">search</span>
                Search
              </>
            )}
          </button>
        </div>
        {searchError && <p className="text-sm text-red-400 mt-2">{searchError}</p>}
      </div>

      {searchedUser && (
        <div className="bg-surface/60 backdrop-blur-[16px] rounded-xl p-6 border border-amber-500/30">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-secondary">check_circle</span>
            User Found
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <p className="text-[10px] uppercase text-accent/60 mb-1">Email</p>
              <p className="text-white font-medium">{searchedUser.email}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-accent/60 mb-1">Created</p>
              <p className="text-white font-medium">
                {new Date(searchedUser.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-accent/60 mb-1">Status</p>
              <p className="font-medium">
                {searchedUser.isBlocked ? (
                  <span className="text-red-400">Blocked</span>
                ) : (
                  <span className="text-secondary">Active</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-accent/60 mb-1">Linked Wallets</p>
              <p className="text-white font-medium">{searchedUser.linkedWallets}</p>
            </div>
          </div>

          <div className="bg-primary/40 rounded-lg p-4 mb-4 text-sm text-accent/80 space-y-1">
            <p className="font-medium text-white mb-2">Current Data</p>
            <p>• Transactions: {searchedUser.totalTransactions}</p>
            <p>• Spent: ₦{searchedUser.totalSpentNGN?.toLocaleString()}</p>
            <p>• Received: {searchedUser.totalReceivedSEND} SEND</p>
            <p>• Referrals: {searchedUser.referralCount}</p>
            {searchedUser.sendtag && <p>• SendTag: /{searchedUser.sendtag}</p>}
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4 text-sm text-red-400">
            <p className="font-bold mb-2">⚠️ WARNING: This will delete wallet(s), clear stats, and keep only email for re-registration.</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-accent/80 mb-2">
              Type <span className="font-bold text-red-400">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              placeholder="Type DELETE to confirm"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="w-full bg-primary border border-accent/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-accent/40 focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onReset}
              disabled={deleteConfirmation !== "DELETE" || resetting}
              className="flex-1 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {resetting ? (
                <>
                  <FSpinner size="xs" />
                  Resetting...
                </>
              ) : (
                <>⚠️ PERMANENTLY RESET THIS ACCOUNT</>
              )}
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-3 rounded-lg border border-accent/20 text-accent/80 hover:bg-accent/5 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
