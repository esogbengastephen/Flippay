"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUserFromStorage, isUserLoggedIn } from "@/lib/session";
import DashboardLayout from "@/components/DashboardLayout";
import FSpinner from "@/components/FSpinner";
import PageLoadingSpinner from "@/components/PageLoadingSpinner";

function HistoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("30");
  const [assetFilter, setAssetFilter] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
      return;
    }

    const currentUser = getUserFromStorage();
    if (!currentUser) {
      router.push("/auth");
      return;
    }

    setUser(currentUser);
    fetchTransactions(currentUser.id);
  }, [router]);

  // Handle URL params for transaction details (after transactions are loaded)
  useEffect(() => {
    const txId = searchParams.get("tx");
    const txType = searchParams.get("type");
    if (txId && transactions.length > 0 && user) {
      const tx = transactions.find(t => t.id === txId);
      if (tx) {
        // If type is provided in URL, use it; otherwise use transaction's type
        if (txType) {
          // Map old type names to new ones if needed
          const mappedType = txType === "crypto_purchase" ? "naira_to_crypto"
            : txType === "offramp" ? "crypto_to_naira"
            : txType === "invoice_paid" || txType === "invoice_created" ? "invoice"
            : txType;
          // Update filter to match the transaction type
          if (mappedType !== filter) {
            setFilter(mappedType);
          }
        }
        fetchTransactionDetails(tx);
      }
    }
  }, [transactions, searchParams, user]);

  const fetchTransactions = async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch(getApiUrl(`/api/user/transactions?userId=${userId}&limit=100`));
      const data = await response.json();

      if (data.success) {
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionDetails = async (tx: any) => {
    if (!user) return;

    setLoadingDetails(true);
    setSelectedTransaction(tx);
    setShowDetailsModal(true);

    try {
      // Use originalType if available, otherwise use type
      const typeForApi = tx.originalType || tx.type;
      // Handle invoice types
      const finalType = typeForApi === "invoice" 
        ? (tx.originalType === "invoice_paid" ? "invoice_paid" : "invoice_created")
        : typeForApi === "naira_to_crypto" ? "crypto_purchase"
        : typeForApi === "crypto_to_naira" ? "offramp"
        : typeForApi;

      const response = await fetch(
        getApiUrl(`/api/user/transactions/${tx.id}?type=${finalType}&userId=${user.id}`)
      );
      const data = await response.json();

      if (data.success) {
        setTransactionDetails(data.transaction);
      } else {
        setTransactionDetails(null);
      }
    } catch (error) {
      console.error("Error fetching transaction details:", error);
      setTransactionDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === "completed" || status === "paid") return "Successful";
    if (status === "failed") return "Failed";
    return "Pending";
  };

  const filterByDate = (tx: any) => {
    if (dateRange === "all") return true;
    const txDate = new Date(tx.date).getTime();
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    if (dateRange === "7") return txDate >= now - 7 * msPerDay;
    if (dateRange === "30") return txDate >= now - 30 * msPerDay;
    return true; // custom or fallback
  };

  const filterByAsset = (tx: any) => {
    if (assetFilter === "all") return true;
    const label = (tx.amountLabel || tx.secondaryAmountLabel || "").toUpperCase();
    if (assetFilter === "NGN") return label.includes("₦") || label.includes("NGN");
    if (assetFilter === "SEND") return label.includes("SEND");
    if (assetFilter === "USDC") return label.includes("USDC");
    if (assetFilter === "USDT") return label.includes("USDT");
    return true;
  };

  const filterByType = (tx: any) => {
    if (filter === "all") return true;
    if (filter === "invoice") return tx.type === "invoice" || tx.type === "invoice_paid" || tx.type === "invoice_created";
    return tx.type === filter || tx.originalType === filter;
  };

  const filteredTransactions = transactions
    .filter(filterByDate)
    .filter(filterByAsset)
    .filter(filterByType);

  const transactionTypes = [
    { id: "all", label: "All", icon: "list" },
    { id: "naira_to_crypto", label: "Naira to Crypto", icon: "currency_bitcoin" },
    { id: "crypto_to_naira", label: "Crypto to Naira", icon: "currency_exchange" },
    { id: "receive_naira", label: "Receive Naira", icon: "account_balance_wallet" },
    { id: "receive_crypto", label: "Receive Crypto", icon: "wallet" },
    { id: "utility", label: "Utility", icon: "receipt" },
    { id: "invoice", label: "Invoices", icon: "receipt_long" },
  ];

  const getStatusBadgeClass = (status: string) => {
    if (status === "completed" || status === "paid") return "bg-secondary/10 text-secondary border border-secondary/20";
    if (status === "failed") return "bg-red-500/10 text-red-500 border border-red-500/20";
    return "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20";
  };

  const getIconBgClass = (status: string) => {
    if (status === "completed" || status === "paid") return "bg-secondary/10 text-secondary";
    if (status === "failed") return "bg-red-500/10 text-red-500";
    return "bg-yellow-500/10 text-yellow-500";
  };

  return (
    <div className="min-h-screen bg-background-dark pb-24 lg:pb-8">
      {/* Background blur orbs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-secondary rounded-full blur-[150px] opacity-[0.07]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary rounded-full blur-[150px] opacity-20" />
      </div>

      <div className="p-4 lg:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <button
              onClick={() => router.back()}
              className="hidden lg:flex items-center gap-2 text-accent/70 hover:text-white mb-4 transition-colors"
            >
              <span className="material-icons-outlined text-lg">arrow_back</span>
              <span className="text-sm font-medium">Back</span>
            </button>
            <h1 className="text-3xl font-bold text-white mb-2">History</h1>
            <p className="text-accent/70">Manage and track your transactions across the platform.</p>
          </div>
        </header>

        {/* Filter Section - glass-panel */}
        <section className="glass-panel p-4 sm:p-6 rounded-2xl mb-8 flex flex-wrap items-end gap-4 sm:gap-6">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-accent/70 uppercase tracking-wider mb-2">Date Range</label>
            <div className="relative">
              <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-accent/50 text-lg">calendar_today</span>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 appearance-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary outline-none transition-all text-white"
              >
                <option value="30" className="bg-surface text-white">Last 30 Days</option>
                <option value="7" className="bg-surface text-white">Last 7 Days</option>
                <option value="all" className="bg-surface text-white">All Time</option>
                <option value="custom" className="bg-surface text-white">Custom Range</option>
              </select>
              <span className="material-icons-outlined absolute right-3 top-1/2 -translate-y-1/2 text-accent/50 text-lg pointer-events-none">expand_more</span>
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-accent/70 uppercase tracking-wider mb-2">Asset Type</label>
            <div className="relative">
              <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-accent/50 text-lg">token</span>
              <select
                value={assetFilter}
                onChange={(e) => setAssetFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 appearance-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary outline-none transition-all text-white"
              >
                <option value="all" className="bg-surface text-white">All Assets</option>
                <option value="NGN" className="bg-surface text-white">NGN (Fiat)</option>
                <option value="SEND" className="bg-surface text-white">SEND</option>
                <option value="USDC" className="bg-surface text-white">USDC</option>
                <option value="USDT" className="bg-surface text-white">USDT</option>
              </select>
              <span className="material-icons-outlined absolute right-3 top-1/2 -translate-y-1/2 text-accent/50 text-lg pointer-events-none">expand_more</span>
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-accent/70 uppercase tracking-wider mb-2">Transaction Type</label>
            <div className="relative">
              <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-accent/50 text-lg">filter_list</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 appearance-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary outline-none transition-all text-white"
              >
                {transactionTypes.map((type) => (
                  <option key={type.id} value={type.id} className="bg-surface text-white">
                    {type.label}
                  </option>
                ))}
              </select>
              <span className="material-icons-outlined absolute right-3 top-1/2 -translate-y-1/2 text-accent/50 text-lg pointer-events-none">expand_more</span>
            </div>
          </div>
        </section>

        {/* Content */}
        {loading ? (
          <PageLoadingSpinner message="Loading transactions..." bgClass="bg-background-light dark:bg-background-dark" />
        ) : filteredTransactions.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center border border-white/5">
            <span className="material-icons-outlined text-6xl text-accent/40 mb-4 block">receipt</span>
            <p className="text-lg font-semibold text-white mb-2">No transactions found</p>
            <p className="text-sm text-accent/60">
              {filter === "all" 
                ? "You haven't made any transactions yet" 
                : filter === "receive_naira" || filter === "receive_crypto"
                ? `No ${transactionTypes.find(t => t.id === filter)?.label.toLowerCase()} transactions yet.`
                : `No ${transactionTypes.find(t => t.id === filter)?.label.toLowerCase()} transactions`}
            </p>
          </div>
        ) : (
          <section className="bg-surface rounded-2xl border border-white/5 overflow-hidden shadow-xl">
            {/* Desktop: Table */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-xs font-semibold text-accent/70 uppercase tracking-wider">
                    <th className="px-4 sm:px-6 py-5">Transaction</th>
                    <th className="px-4 sm:px-6 py-5">Amount</th>
                    <th className="px-4 sm:px-6 py-5">Date & Time</th>
                    <th className="px-4 sm:px-6 py-5">Status</th>
                    <th className="px-4 sm:px-6 py-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {filteredTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => fetchTransactionDetails(tx)}
                      className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="px-4 sm:px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getIconBgClass(tx.status)}`}>
                            <span className="material-icons-outlined text-xl">{tx.icon}</span>
                          </div>
                          <div>
                            <div className="text-white">{tx.title}</div>
                            <div className="text-xs font-mono text-accent/60">{tx.reference ? `${tx.reference.substring(0, 8)}...` : tx.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-5">
                        <div className="text-white">{tx.amountLabel}</div>
                        {tx.secondaryAmountLabel && (
                          <div className="text-xs text-accent/60">{tx.secondaryAmountLabel}</div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-5">
                        <div className="text-white">{new Date(tx.date).toLocaleDateString()}</div>
                        <div className="text-xs text-accent/60">{new Date(tx.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-5">
                        <span className={`px-2.5 py-1 rounded-full text-xs ${getStatusBadgeClass(tx.status)}`}>
                          {getStatusLabel(tx.status)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-5 text-right">
                        <span className="text-secondary hover:underline flex items-center justify-end gap-1 text-sm font-semibold">
                          View <span className="material-icons-outlined text-[16px]">chevron_right</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden divide-y divide-white/5">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => fetchTransactionDetails(tx)}
                  className="p-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getIconBgClass(tx.status)}`}>
                        <span className="material-icons-outlined text-xl">{tx.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white">{tx.title}</p>
                        <p className="text-sm text-accent/60 truncate">{tx.description}</p>
                        <p className="text-xs text-accent/50 mt-1">
                          {new Date(tx.date).toLocaleDateString()} • {new Date(tx.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-white">{tx.amountLabel}</p>
                      {tx.secondaryAmountLabel && (
                        <p className="text-xs text-secondary">{tx.secondaryAmountLabel}</p>
                      )}
                      <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs ${getStatusBadgeClass(tx.status)}`}>
                        {getStatusLabel(tx.status)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Transaction Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="material-icons-outlined text-secondary">receipt_long</span>
                Transaction Details
              </h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedTransaction(null);
                  setTransactionDetails(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <span className="material-icons-outlined text-accent/70">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <FSpinner size="md" />
                  <span className="ml-3 text-accent/70">Loading details...</span>
                </div>
              ) : transactionDetails ? (
                <div className="space-y-6">
                  {/* Transaction Type & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full ${getIconBgClass(transactionDetails.status)} flex items-center justify-center`}>
                        <span className="material-icons-outlined text-xl">
                          {selectedTransaction?.icon || "receipt"}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">
                          {selectedTransaction?.title || transactionDetails.serviceName || "Transaction"}
                        </h3>
                        <p className="text-sm text-accent/70">
                          {selectedTransaction?.description}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm ${getStatusBadgeClass(transactionDetails.status)} font-medium`}>
                      {getStatusLabel(transactionDetails.status)}
                    </span>
                  </div>

                  {/* Amount Section */}
                  <div className="bg-surface-highlight/50 rounded-2xl p-6 border border-secondary/20">
                    <p className="text-sm text-accent/70 mb-2">Amount</p>
                    <p className="text-3xl font-bold text-white">
                      {selectedTransaction?.amountLabel || `₦${transactionDetails.totalAmount?.toLocaleString() || transactionDetails.ngnAmount?.toLocaleString() || "0"}`}
                    </p>
                    {selectedTransaction?.secondaryAmountLabel && (
                      <p className="text-lg font-semibold text-secondary mt-2">
                        {selectedTransaction.secondaryAmountLabel}
                      </p>
                    )}
                  </div>

                  {/* Transaction Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Date & Time */}
                    <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5">
                      <p className="text-xs text-accent/60 mb-1">Date & Time</p>
                      <p className="font-semibold text-white">
                        {new Date(transactionDetails.createdAt || transactionDetails.date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-accent/70">
                        {new Date(transactionDetails.createdAt || transactionDetails.date).toLocaleTimeString()}
                      </p>
                    </div>

                    {/* Reference */}
                    {(transactionDetails.transactionId || transactionDetails.clubkonnectReference || transactionDetails.invoiceNumber || transactionDetails.reference) && (
                      <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5">
                        <p className="text-xs text-accent/60 mb-1">Reference</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-semibold text-white break-all flex-1">
                            {transactionDetails.transactionId || transactionDetails.clubkonnectReference || transactionDetails.invoiceNumber || transactionDetails.reference}
                          </p>
                          <button
                            onClick={() => {
                              const ref = transactionDetails.transactionId || transactionDetails.clubkonnectReference || transactionDetails.invoiceNumber || transactionDetails.reference;
                              navigator.clipboard.writeText(ref);
                              alert("Copied to clipboard!");
                            }}
                            className="p-1 hover:bg-white/10 rounded flex-shrink-0" aria-label="Copy reference"
                          >
                            <span className="material-icons-outlined text-sm text-secondary">content_copy</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Transaction Hash */}
                    {(transactionDetails.txHash || transactionDetails.swapTxHash) && (
                      <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5">
                        <p className="text-xs text-accent/60 mb-1">Transaction Hash</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-semibold text-white break-all flex-1">
                            {transactionDetails.txHash || transactionDetails.swapTxHash}
                          </p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(transactionDetails.txHash || transactionDetails.swapTxHash);
                              alert("Copied to clipboard!");
                            }}
                            className="p-1 hover:bg-white/10 rounded" aria-label="Copy hash"
                          >
                            <span className="material-icons-outlined text-sm text-secondary">content_copy</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Type-specific fields */}
                    {transactionDetails.type === "crypto_purchase" && (
                      <>
                        {transactionDetails.walletAddress && (
                          <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5">
                            <p className="text-xs text-accent/60 mb-1">Wallet Address</p>
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-sm font-semibold text-white break-all flex-1">
                                {transactionDetails.walletAddress}
                              </p>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(transactionDetails.walletAddress);
                                  alert("Copied to clipboard!");
                                }}
                                className="p-1 hover:bg-white/10 rounded flex-shrink-0" aria-label="Copy address"
                              >
                                <span className="material-icons-outlined text-sm text-secondary">content_copy</span>
                              </button>
                            </div>
                          </div>
                        )}
                        {transactionDetails.exchangeRate && (
                          <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5">
                            <p className="text-xs text-accent/60 mb-1">Exchange Rate</p>
                            <p className="font-semibold text-white">
                              1 SEND = ₦{transactionDetails.exchangeRate.toLocaleString()}
                            </p>
                          </div>
                        )}
                        {transactionDetails.paystackReference && (
                          <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5">
                            <p className="text-xs text-accent/60 mb-1">Payment Reference</p>
                            <p className="font-mono text-sm font-semibold text-white">
                              {transactionDetails.paystackReference}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {transactionDetails.type === "utility" && (
                      <>
                        {transactionDetails.network && (
                          <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5">
                            <p className="text-xs text-accent/60 mb-1">Network</p>
                            <p className="font-semibold text-white">
                              {transactionDetails.network}
                            </p>
                          </div>
                        )}
                        {(transactionDetails.phoneNumber || transactionDetails.meterNumber) && (
                          <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5">
                            <p className="text-xs text-accent/60 mb-1">
                              {transactionDetails.serviceId === "electricity" ? "Meter Number" : "Phone Number"}
                            </p>
                            <p className="font-semibold text-white">
                              {transactionDetails.phoneNumber || transactionDetails.meterNumber}
                            </p>
                          </div>
                        )}
                        {transactionDetails.markupAmount > 0 && (
                          <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5">
                            <p className="text-xs text-accent/60 mb-1">Service Fee</p>
                            <p className="font-semibold text-white">
                              ₦{transactionDetails.markupAmount.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {transactionDetails.type === "offramp" && (
                      <>
                        {transactionDetails.userAccountNumber && (
                          <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5">
                            <p className="text-xs text-accent/60 mb-1">Account Number</p>
                            <p className="font-semibold text-white">
                              {transactionDetails.userAccountNumber}
                            </p>
                          </div>
                        )}
                        {transactionDetails.tokenSymbol && (
                          <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5">
                            <p className="text-xs text-accent/60 mb-1">Token</p>
                            <p className="font-semibold text-white">
                              {transactionDetails.tokenAmount} {transactionDetails.tokenSymbol}
                            </p>
                          </div>
                        )}
                        {transactionDetails.feeNgn > 0 && (
                          <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5">
                            <p className="text-xs text-accent/60 mb-1">Fee</p>
                            <p className="font-semibold text-white">
                              ₦{transactionDetails.feeNgn.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {transactionDetails.type === "invoice_paid" || transactionDetails.type === "invoice_created" ? (
                      <>
                        {transactionDetails.customerName && (
                          <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5">
                            <p className="text-xs text-accent/60 mb-1">Customer</p>
                            <p className="font-semibold text-white">
                              {transactionDetails.customerName}
                            </p>
                          </div>
                        )}
                        {transactionDetails.description && (
                          <div className="bg-surface-highlight/30 rounded-xl p-4 border border-white/5 md:col-span-2">
                            <p className="text-xs text-accent/60 mb-1">Description</p>
                            <p className="font-semibold text-white">
                              {transactionDetails.description}
                            </p>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>

                  {/* Error Message (if failed) */}
                  {transactionDetails.errorMessage && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                      <p className="text-sm font-semibold text-red-500 mb-1">Error</p>
                      <p className="text-sm text-red-400">
                        {transactionDetails.errorMessage}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <span className="material-icons-outlined text-6xl text-accent/40 mb-4">error_outline</span>
                  <p className="text-accent/70">Failed to load transaction details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function HistoryPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <PageLoadingSpinner message="Loading..." bgClass="bg-background-light dark:bg-background-dark" />
      }>
        <HistoryPageContent />
      </Suspense>
    </DashboardLayout>
  );
}
