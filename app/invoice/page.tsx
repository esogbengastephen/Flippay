"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUserFromStorage } from "@/lib/session";
import DashboardLayout from "@/components/DashboardLayout";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { getChainLogo, getTokenLogo } from "@/lib/logos";
import FSpinner from "@/components/FSpinner";

const FIAT_CURRENCIES = [
  { code: "NGN", label: "NGN (Nigerian Naira)" },
  { code: "USD", label: "USD (US Dollar)" },
  { code: "EUR", label: "EUR (Euro)" },
  { code: "GBP", label: "GBP (British Pound)" },
] as const;
const FIAT_CODES = FIAT_CURRENCIES.map((c) => c.code) as readonly string[];

const PHONE_COUNTRY_CODES = [
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+1", country: "US/Canada", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+233", country: "Ghana", flag: "🇬🇭" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+81", country: "Japan", flag: "🇯🇵" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
];

/** Parse full phone (e.g. +2348012345678) into country code and national number */
function parsePhone(phone: string | null | undefined): { code: string; number: string } {
  if (!phone || !phone.trim()) return { code: "+234", number: "" };
  const s = phone.trim();
  if (!s.startsWith("+")) return { code: "+234", number: s.replace(/\D/g, "") };
  const sorted = [...PHONE_COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const { code } of sorted) {
    if (s.startsWith(code)) {
      const rest = s.slice(code.length).replace(/\D/g, "").trim();
      return { code, number: rest };
    }
  }
  return { code: "+234", number: s.replace(/\D/g, "") };
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  crypto_chain_id: string | null;
  crypto_address: string | null;
  description: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  status: "pending" | "paid" | "expired" | "cancelled" | "draft";
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  invoice_type?: "personal" | "business";
  metadata?: {
    marked_paid_by?: string;
    marked_paid_at?: string;
  } | null;
}

interface WalletBalance {
  balance: string;
  usdValue: number;
  symbol: string;
}

export default function InvoicePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isPaying, setIsPaying] = useState<string | null>(null);
  const [walletBalances, setWalletBalances] = useState<Record<string, WalletBalance>>({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  
  // Delete state
  const [deletingInvoice, setDeletingInvoice] = useState<string | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  
  // Dropdown state
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false);
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const [isEditChainDropdownOpen, setIsEditChainDropdownOpen] = useState(false);
  const [isEditTokenDropdownOpen, setIsEditTokenDropdownOpen] = useState(false);
  const chainDropdownRef = useRef<HTMLDivElement>(null);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);
  const editChainDropdownRef = useRef<HTMLDivElement>(null);
  const editTokenDropdownRef = useRef<HTMLDivElement>(null);
  
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "expired" | "cancelled" | "draft">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [remindingInvoice, setRemindingInvoice] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "amount" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Edit state
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFormData, setEditFormData] = useState({
    amount: "",
    currency: "NGN",
    fiatCurrency: "NGN",
    cryptoChainId: "",
    cryptoToken: "",
    cryptoAddress: "",
    description: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerPhoneCountryCode: "+234",
    dueDate: "",
    invoiceType: "personal" as "personal" | "business",
    accountName: "",
    accountNumber: "",
    bank: "",
  });
  
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([
    { id: Date.now().toString(), description: "", amount: "" }
  ]);
  const [editActiveTab, setEditActiveTab] = useState<"NGN" | "Crypto">("NGN");

  // Tab state
  const [activeTab, setActiveTab] = useState<"NGN" | "Crypto">("NGN");

  // Line items state
  interface LineItem {
    id: string;
    description: string;
    amount: string;
  }

  // Form state
  const [formData, setFormData] = useState({
    amount: "",
    currency: "NGN",
    fiatCurrency: "NGN",
    cryptoChainId: "",
    cryptoToken: "", // USDC, USDT, or SEND
    cryptoAddress: "",
    description: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerPhoneCountryCode: "+234",
    dueDate: "",
    invoiceType: "personal" as "personal" | "business",
    accountName: "",
    accountNumber: "",
    bank: "",
  });
  
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: Date.now().toString(), description: "", amount: "" }
  ]);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({ message: "", type: "info", isVisible: false });

  useEffect(() => {
    const currentUser = getUserFromStorage();
    if (!currentUser) {
      router.push("/auth");
      return;
    }
    setUser(currentUser);
    fetchInvoices(currentUser.email);
    fetchWalletBalances(currentUser.id);
    fetchUserProfile(currentUser.id);
  }, [router]);

  const fetchUserProfile = async (userId: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/user/profile?userId=${userId}`));
      const data = await response.json();
      
      if (data.success && data.profile && data.profile.invoiceType) {
        // Set default invoice type from user profile
        setFormData(prev => ({ ...prev, invoiceType: data.profile.invoiceType }));
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(event.target as Node)) {
        setIsChainDropdownOpen(false);
      }
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setIsTokenDropdownOpen(false);
      }
      if (editChainDropdownRef.current && !editChainDropdownRef.current.contains(event.target as Node)) {
        setIsEditChainDropdownOpen(false);
      }
      if (editTokenDropdownRef.current && !editTokenDropdownRef.current.contains(event.target as Node)) {
        setIsEditTokenDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchWalletBalances = async (userId: string) => {
    setLoadingBalances(true);
    try {
      const response = await fetch(getApiUrl(`/api/wallet/balances?userId=${userId}`));
      const data = await response.json();

      if (data.success && data.balances) {
        setWalletBalances(data.balances);
      }
    } catch (error) {
      console.error("Error fetching wallet balances:", error);
    } finally {
      setLoadingBalances(false);
    }
  };

  const fetchInvoices = async (email: string) => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl(`/api/invoices/list?email=${encodeURIComponent(email)}`));
      const data = await response.json();

      if (data.success) {
        const invoicesList = data.invoices || [];
        setInvoices(invoicesList);
        setFilteredInvoices(invoicesList);
      } else {
        setToast({
          message: data.error || "Failed to fetch invoices",
          type: "error",
          isVisible: true,
        });
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
      setToast({
        message: "Failed to fetch invoices",
        type: "error",
        isVisible: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Line items helper functions
  const addLineItem = () => {
    setLineItems([...lineItems, { id: Date.now().toString(), description: "", amount: "" }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: "description" | "amount", value: string) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotal = (items: LineItem[]): number => {
    return items.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      return sum + amount;
    }, 0);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate line items
    const validItems = lineItems.filter(item => 
      item.description.trim() && item.amount && parseFloat(item.amount) > 0
    );
    
    if (validItems.length === 0) {
      setToast({
        message: "Please add at least one item with description and amount",
        type: "error",
        isVisible: true,
      });
      return;
    }

    // Calculate total from line items
    const totalAmount = calculateTotal(validItems);
    
    if (totalAmount <= 0) {
      setToast({
        message: "Total amount must be greater than zero",
        type: "error",
        isVisible: true,
      });
      return;
    }

    // Validate crypto fields if crypto tab is active
    if (activeTab === "Crypto") {
      if (!formData.cryptoChainId) {
        setToast({
          message: "Please select a network/chain",
          type: "error",
          isVisible: true,
        });
        return;
      }
      if (!formData.cryptoToken) {
        setToast({
          message: "Please select a token",
          type: "error",
          isVisible: true,
        });
        return;
      }
    }

    setIsCreating(true);
    try {
      // Determine currency based on active tab
      const currency = activeTab === "NGN" ? formData.fiatCurrency : formData.cryptoToken;
      const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
      
      // Use custom address if provided, otherwise use wallet address from user's dashboard
      const finalCryptoAddress = activeTab === "Crypto" 
        ? (formData.cryptoAddress?.trim() || walletAddresses[formData.cryptoChainId] || "")
        : null;
      
      const response = await fetch(getApiUrl("/api/invoices/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: totalAmount.toString(),
          currency: currency,
          cryptoChainId: activeTab === "Crypto" ? formData.cryptoChainId : null,
          cryptoAddress: finalCryptoAddress,
          description: formData.description || null,
          customerName: formData.customerName || null,
          customerEmail: formData.customerEmail || null,
          customerPhone: formData.customerPhone.trim()
            ? (formData.customerPhoneCountryCode || "+234") + formData.customerPhone.trim().replace(/\D/g, "")
            : null,
          dueDate: formData.dueDate || null,
          invoiceType: formData.invoiceType,
          lineItems: validItems.map(item => ({
            description: item.description.trim(),
            amount: parseFloat(item.amount)
          })),
          ...(activeTab === "NGN" && (formData.accountName || formData.accountNumber || formData.bank) ? {
            bankDetails: {
              accountName: formData.accountName || null,
              accountNumber: formData.accountNumber || null,
              bank: formData.bank || null,
            }
          } : {}),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          message: "Invoice created successfully!",
          type: "success",
          isVisible: true,
        });
        setShowCreateForm(false);
        setFormData({
          amount: "",
          currency: "NGN",
          fiatCurrency: "NGN",
          cryptoChainId: "",
          cryptoToken: "",
          cryptoAddress: "",
          description: "",
          customerName: "",
          customerEmail: "",
          customerPhone: "",
          customerPhoneCountryCode: "+234",
          dueDate: "",
          invoiceType: "personal",
          accountName: "",
          accountNumber: "",
          bank: "",
        });
        setLineItems([{ id: Date.now().toString(), description: "", amount: "" }]);
        setActiveTab("NGN");
        fetchInvoices(user.email);
      } else {
        setToast({
          message: data.error || "Failed to create invoice",
          type: "error",
          isVisible: true,
        });
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
      setToast({
        message: "Failed to create invoice",
        type: "error",
        isVisible: true,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handlePayInvoice = async (invoiceNumber: string) => {
    setIsPaying(invoiceNumber);
    try {
      const response = await fetch(getApiUrl(`/api/invoices/${invoiceNumber}/pay`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
        }),
      });

      const data = await response.json();

      if (data.success && data.authorization_url) {
        // Redirect to Paystack payment page
        window.location.href = data.authorization_url;
      } else {
        setToast({
          message: data.error || "Failed to initialize payment",
          type: "error",
          isVisible: true,
        });
        setIsPaying(null);
      }
    } catch (error) {
      console.error("Error paying invoice:", error);
      setToast({
        message: "Failed to process payment",
        type: "error",
        isVisible: true,
      });
      setIsPaying(null);
    }
  };

  const handleShareInvoice = async (invoiceNumber: string) => {
    const shareUrl = `${window.location.origin}/invoice/${invoiceNumber}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast({
        message: "Invoice link copied to clipboard!",
        type: "success",
        isVisible: true,
      });
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      setToast({
        message: shareUrl,
        type: "info",
        isVisible: true,
      });
    }
  };

  // Edit line items helper functions
  const addEditLineItem = () => {
    setEditLineItems([...editLineItems, { id: Date.now().toString(), description: "", amount: "" }]);
  };

  const removeEditLineItem = (id: string) => {
    if (editLineItems.length > 1) {
      setEditLineItems(editLineItems.filter(item => item.id !== id));
    }
  };

  const updateEditLineItem = (id: string, field: "description" | "amount", value: string) => {
    setEditLineItems(editLineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    const isCrypto = !FIAT_CODES.includes(invoice.currency);
    setEditActiveTab(isCrypto ? "Crypto" : "NGN");
    
    // Load line items from metadata if they exist
    const lineItemsFromMetadata = (invoice.metadata as any)?.lineItems || [];
    if (lineItemsFromMetadata.length > 0) {
      setEditLineItems(lineItemsFromMetadata.map((item: any, index: number) => ({
        id: `edit-${index}-${Date.now()}`,
        description: item.description || "",
        amount: item.amount?.toString() || "",
      })));
    } else {
      // Fallback: create one item from description
      setEditLineItems([{
        id: Date.now().toString(),
        description: invoice.description || "",
        amount: invoice.amount.toString(),
      }]);
    }
    
    const bankDetails = (invoice.metadata as any)?.bankDetails || {};
    const parsed = parsePhone(invoice.customer_phone);
    setEditFormData({
      amount: invoice.amount.toString(),
      currency: invoice.currency,
      fiatCurrency: isCrypto ? "NGN" : invoice.currency,
      cryptoChainId: invoice.crypto_chain_id || "",
      cryptoToken: isCrypto ? invoice.currency : "",
      cryptoAddress: invoice.crypto_address || "",
      description: invoice.description || "",
      customerName: invoice.customer_name || "",
      customerEmail: invoice.customer_email || "",
      customerPhone: parsed.number,
      customerPhoneCountryCode: parsed.code,
      dueDate: invoice.due_date ? invoice.due_date.split('T')[0] : "",
      invoiceType: invoice.invoice_type || "personal",
      accountName: bankDetails.accountName || "",
      accountNumber: bankDetails.accountNumber || "",
      bank: bankDetails.bank || "",
    });
  };

  const handleUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;

    // Validate line items
    const validItems = editLineItems.filter(item => 
      item.description.trim() && item.amount && parseFloat(item.amount) > 0
    );
    
    if (validItems.length === 0) {
      setToast({
        message: "Please add at least one item with description and amount",
        type: "error",
        isVisible: true,
      });
      return;
    }

    // Calculate total from line items
    const totalAmount = calculateTotal(validItems);
    
    if (totalAmount <= 0) {
      setToast({
        message: "Total amount must be greater than zero",
        type: "error",
        isVisible: true,
      });
      return;
    }

    if (editActiveTab === "Crypto") {
      if (!editFormData.cryptoChainId || !editFormData.cryptoToken) {
        setToast({
          message: "Please select network and token",
          type: "error",
          isVisible: true,
        });
        return;
      }
    }

    setIsUpdating(true);
    try {
      const currency = editActiveTab === "NGN" ? editFormData.fiatCurrency : editFormData.cryptoToken;
      const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
      
      // Use custom address if provided, otherwise use wallet address from user's dashboard
      const finalCryptoAddress = editActiveTab === "Crypto"
        ? (editFormData.cryptoAddress?.trim() || walletAddresses[editFormData.cryptoChainId] || "")
        : null;
      
      const response = await fetch(getApiUrl(`/api/invoices/${encodeURIComponent(editingInvoice.invoice_number)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: totalAmount.toString(),
          currency: currency,
          cryptoChainId: editActiveTab === "Crypto" ? editFormData.cryptoChainId : null,
          cryptoAddress: finalCryptoAddress,
          description: editFormData.description || null,
          customerName: editFormData.customerName || null,
          customerEmail: editFormData.customerEmail || null,
          customerPhone: editFormData.customerPhone.trim()
            ? (editFormData.customerPhoneCountryCode || "+234") + editFormData.customerPhone.trim().replace(/\D/g, "")
            : null,
          dueDate: editFormData.dueDate || null,
          invoiceType: editFormData.invoiceType,
          lineItems: validItems.map(item => ({
            description: item.description.trim(),
            amount: parseFloat(item.amount)
          })),
          ...(editActiveTab === "NGN" && (editFormData.accountName || editFormData.accountNumber || editFormData.bank) ? {
            bankDetails: {
              accountName: editFormData.accountName || null,
              accountNumber: editFormData.accountNumber || null,
              bank: editFormData.bank || null,
            }
          } : {}),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          message: "Invoice updated successfully!",
          type: "success",
          isVisible: true,
        });
        setEditingInvoice(null);
        fetchInvoices(user.email);
      } else {
        console.error("Update failed:", data);
        console.error("Invoice number used:", editingInvoice.invoice_number);
        setToast({
          message: data.error || "Failed to update invoice",
          type: "error",
          isVisible: true,
        });
      }
    } catch (error) {
      console.error("Error updating invoice:", error);
      console.error("Invoice number used:", editingInvoice.invoice_number);
      setToast({
        message: "Failed to update invoice. Please try again.",
        type: "error",
        isVisible: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadPDF = async (invoiceNumber: string) => {
    try {
      // Navigate to invoice page to download
      const invoiceUrl = `${window.location.origin}/invoice/${encodeURIComponent(invoiceNumber)}`;
      window.open(invoiceUrl, '_blank');
      
      setToast({
        message: "Opening invoice page. Click 'Download Invoice' button to download PDF.",
        type: "info",
        isVisible: true,
      });
    } catch (error) {
      console.error("Error opening invoice:", error);
      setToast({
        message: "Failed to open invoice page",
        type: "error",
        isVisible: true,
      });
    }
  };

  const handleDeleteClick = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
  };

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete || !user) return;

    setDeletingInvoice(invoiceToDelete.invoice_number);
    try {
      const response = await fetch(
        getApiUrl(`/api/invoices/${encodeURIComponent(invoiceToDelete.invoice_number)}?email=${encodeURIComponent(user.email)}`),
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        setToast({
          message: "Invoice deleted successfully",
          type: "success",
          isVisible: true,
        });
        setInvoiceToDelete(null);
        fetchInvoices(user.email);
      } else {
        setToast({
          message: data.error || "Failed to delete invoice",
          type: "error",
          isVisible: true,
        });
      }
    } catch (error) {
      console.error("Error deleting invoice:", error);
      setToast({
        message: "Failed to delete invoice",
        type: "error",
        isVisible: true,
      });
    } finally {
      setDeletingInvoice(null);
    }
  };

  const handleCancelDelete = () => {
    setInvoiceToDelete(null);
  };

  // Calculate statistics (by currency - no conversion)
  const calculateStats = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const byCurrency = (
      list: typeof invoices,
      predicate: (inv: Invoice) => boolean
    ): Record<string, number> => {
      const out: Record<string, number> = {};
      list.filter(predicate).forEach((inv) => {
        const c = inv.currency || "NGN";
        const amt = parseFloat(inv.amount.toString());
        out[c] = (out[c] || 0) + amt;
      });
      return out;
    };

    const totalRevenueByCurrency = byCurrency(invoices, (inv) => inv.status === "paid");
    const pendingByCurrency = byCurrency(invoices, (inv) => inv.status === "pending");
    const paidThisMonthByCurrency = byCurrency(
      invoices,
      (inv) =>
        inv.status === "paid" && new Date(inv.paid_at || inv.created_at) >= startOfMonth
    );
    const overdueCount = invoices.filter((inv) => {
      if (inv.status !== "pending" || !inv.due_date) return false;
      return new Date(inv.due_date) < now;
    }).length;

    return {
      totalRevenueByCurrency,
      pendingByCurrency,
      paidThisMonthByCurrency,
      overdueCount,
    };
  };

  const formatCurrencyAmount = (currency: string, amount: number): string => {
    if (currency === "NGN") return `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (currency === "USD") return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (currency === "EUR") return `€${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (currency === "GBP") return `£${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${currency}`;
  };

  const renderAmountsByCurrency = (byCurrency: Record<string, number>) => {
    const entries = Object.entries(byCurrency).filter(([, v]) => v > 0);
    if (entries.length === 0) return "—";
    return (
      <span className="flex flex-col gap-0.5">
        {entries.map(([currency, amount]) => (
          <span key={currency} className="font-bold text-white">
            {formatCurrencyAmount(currency, amount)}
          </span>
        ))}
      </span>
    );
  };

  // Filter and sort invoices
  useEffect(() => {
    let filtered = [...invoices];

    if (statusFilter !== "all") {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.invoice_number.toLowerCase().includes(query) ||
        inv.customer_name?.toLowerCase().includes(query) ||
        inv.customer_email?.toLowerCase().includes(query) ||
        inv.description?.toLowerCase().includes(query) ||
        inv.amount.toString().includes(query)
      );
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "date":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "amount":
          comparison = parseFloat(a.amount.toString()) - parseFloat(b.amount.toString());
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    setFilteredInvoices(filtered);
  }, [invoices, statusFilter, searchQuery, sortBy, sortOrder]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, sortBy, sortOrder]);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      let y = 20;

      pdf.setFontSize(18);
      pdf.text("Invoice Summary Report", pageWidth / 2, y, { align: "center" });
      y += 15;

      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: "center" });
      y += 15;

      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const monthInvoices = invoices.filter(
        (inv) => new Date(inv.created_at) >= startOfMonth
      );
      const paidThisMonth = monthInvoices.filter((inv) => inv.status === "paid");
      const pendingCount = invoices.filter((inv) => inv.status === "pending").length;
      const overdueCount = invoices.filter((inv) => {
        if (inv.status !== "pending" || !inv.due_date) return false;
        return new Date(inv.due_date) < new Date();
      }).length;

      pdf.setFontSize(12);
      pdf.text("Monthly Summary", 14, y);
      y += 8;
      pdf.setFontSize(10);
      pdf.text(`Total invoices this month: ${monthInvoices.length}`, 14, y);
      y += 6;
      pdf.text(`Paid this month: ${paidThisMonth.length}`, 14, y);
      y += 6;
      pdf.text(`Pending: ${pendingCount}`, 14, y);
      y += 6;
      pdf.text(`Overdue: ${overdueCount}`, 14, y);
      y += 15;

      pdf.setFontSize(12);
      pdf.text("Recent Invoices", 14, y);
      y += 8;

      const displayList = filteredInvoices.slice(0, 20);
      pdf.setFontSize(9);
      displayList.forEach((inv, i) => {
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }
        const amt = inv.currency === "NGN" ? `₦${parseFloat(inv.amount.toString()).toLocaleString()}` : `${inv.currency} ${parseFloat(inv.amount.toString()).toLocaleString()}`;
        pdf.text(`${inv.invoice_number} | ${inv.customer_name || "—"} | ${amt} | ${inv.status}`, 14, y);
        y += 6;
      });

      pdf.save(`Invoice-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
      setToast({ message: "Report downloaded successfully", type: "success", isVisible: true });
    } catch (error) {
      console.error("Error generating report:", error);
      setToast({ message: "Failed to generate report", type: "error", isVisible: true });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleRemindInvoice = async (invoice: Invoice) => {
    setRemindingInvoice(invoice.invoice_number);
    try {
      const invoiceUrl = `${window.location.origin}/invoice/${encodeURIComponent(invoice.invoice_number)}`;
      await navigator.clipboard.writeText(invoiceUrl);
      setToast({
        message: "Invoice link copied! Share it with the customer to send a reminder.",
        type: "success",
        isVisible: true,
      });
    } catch {
      setToast({
        message: "Could not copy link. Please share the invoice manually.",
        type: "info",
        isVisible: true,
      });
    } finally {
      setRemindingInvoice(null);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-dark">
        <div className="text-center">
          <FSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-accent/70">Loading...</p>
        </div>
      </div>
    );
  }

  const stats = calculateStats();

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-secondary/20 text-secondary border border-secondary/30";
      case "expired":
        return "bg-rose-900/30 text-rose-300 border border-rose-800";
      case "draft":
        return "bg-slate-800 text-slate-400 border border-slate-700";
      case "cancelled":
        return "bg-slate-700/50 text-slate-300 border border-slate-600";
      default:
        return "bg-slate-700/50 text-slate-300 border border-slate-600";
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background-dark p-4 pb-24 lg:pb-8">
        {/* Background blur orbs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-secondary rounded-full blur-[150px] opacity-[0.07]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary rounded-full blur-[150px] opacity-20" />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/")}
              className="hidden lg:flex items-center gap-2 text-accent/70 hover:text-white mb-4 transition-colors"
            >
              <span className="material-icons-outlined text-lg">arrow_back</span>
              <span className="text-sm font-medium">Back</span>
            </button>
            <h1 className="text-3xl font-bold text-white mb-2">Invoice Management</h1>
            <p className="text-accent/70">Generate and manage your invoices</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-secondary text-background-dark font-bold px-5 py-2.5 rounded-lg shadow-lg shadow-secondary/20 hover:opacity-90 transition-all"
          >
            <span className="material-icons-outlined text-sm">add</span>
            Create Invoice
          </button>
        </header>

        {/* Statistics Cards - 5-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-surface rounded-xl p-6 border border-white/5 shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-icons-outlined text-6xl text-white">trending_up</span>
            </div>
            <p className="text-sm font-medium text-accent/70 mb-1">Total Revenue</p>
            <div className="text-2xl font-bold text-white mt-1">
              {renderAmountsByCurrency(stats.totalRevenueByCurrency)}
            </div>
          </div>
          <div className="bg-surface rounded-xl p-6 border border-white/5 shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-icons-outlined text-6xl text-white">schedule</span>
            </div>
            <p className="text-sm font-medium text-accent/70 mb-1">Pending</p>
            <div className="text-2xl font-bold text-white mt-1">
              {renderAmountsByCurrency(stats.pendingByCurrency)}
            </div>
          </div>
          <div className="bg-surface rounded-xl p-6 border border-white/5 shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-icons-outlined text-6xl text-white">calendar_today</span>
            </div>
            <p className="text-sm font-medium text-accent/70 mb-1">Paid This Month</p>
            <div className="text-2xl font-bold text-white mt-1">
              {renderAmountsByCurrency(stats.paidThisMonthByCurrency)}
            </div>
          </div>
          <div className="bg-surface rounded-xl p-6 border border-white/5 shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-icons-outlined text-6xl text-white">warning</span>
            </div>
            <p className="text-sm font-medium text-accent/70 mb-1">Overdue</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.overdueCount}</p>
            {stats.overdueCount > 0 && (
              <div className="mt-4 flex items-center text-xs font-medium text-rose-400">
                <span className="material-icons-outlined text-xs mr-1">warning</span>
                {stats.overdueCount} action {stats.overdueCount === 1 ? "item" : "items"}
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-surface to-background-dark border border-secondary/30 rounded-xl p-6 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full border-[20px] border-secondary/10" />
            <h3 className="text-lg font-bold relative z-10 text-secondary">Generate Report</h3>
            <p className="text-sm text-white/70 relative z-10 mt-1 mb-4">Download PDF summary of monthly activity.</p>
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              className="w-full bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/50 py-2 rounded-lg text-sm font-bold transition-colors relative z-10 disabled:opacity-50"
            >
              {isGeneratingReport ? "Generating..." : "Download"}
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div id="invoices-list" className="mb-6 overflow-hidden">
          <div className="flex flex-col gap-4">
            {/* Row 1: Search + Sort - same baseline */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative flex-1 sm:max-w-[200px] min-w-0">
                <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-accent/50 text-lg">search</span>
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-white/10 rounded-lg bg-surface text-white placeholder-accent/50 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary"
                />
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="text-sm text-accent/70 whitespace-nowrap">Sort by:</span>
                <div className="flex items-center gap-1 border border-white/10 rounded-lg bg-surface px-3 py-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "date" | "amount" | "status")}
                    className="bg-transparent border-none text-sm font-bold text-white focus:ring-0 cursor-pointer pr-6 focus:outline-none appearance-none"
                  >
                    <option value="date" className="bg-surface">Date Created</option>
                    <option value="amount" className="bg-surface">Amount (High-Low)</option>
                    <option value="status" className="bg-surface">Status</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className="p-1 rounded hover:bg-white/10 text-accent/70 hover:text-white transition-colors -ml-1"
                    title={sortOrder === "asc" ? "Sort Descending" : "Sort Ascending"}
                  >
                    <span className="material-icons-outlined text-sm">{sortOrder === "asc" ? "arrow_upward" : "arrow_downward"}</span>
                  </button>
                </div>
              </div>
            </div>
            {/* Row 2: Filter tabs - compact, no green bleed */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 custom-scrollbar">
              {(["all", "pending", "paid", "expired", "cancelled", "draft"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
                    statusFilter === status
                      ? "bg-secondary/20 text-secondary border border-secondary/40"
                      : "bg-surface border border-white/10 text-accent/80 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {status === "all" ? "All Invoices" : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Invoices List */}
        {filteredInvoices.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center border border-white/5">
            <span className="material-icons-outlined text-6xl text-accent/40 mb-4 block">receipt_long</span>
            <p className="text-lg font-semibold text-white mb-2">
              {invoices.length === 0 ? "No invoices yet" : "No invoices match your filters"}
            </p>
            {invoices.length === 0 && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 bg-secondary text-background-dark font-bold py-2 px-5 rounded-lg hover:opacity-90 transition-opacity"
              >
                Create Your First Invoice
              </button>
            )}
            {(searchQuery || statusFilter !== "all") && (
              <button
                onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                className="mt-4 bg-surface-highlight text-white font-semibold py-2 px-4 rounded-lg hover:bg-white/10 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="bg-surface rounded-xl shadow-lg border border-white/5 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-highlight/50 text-accent/70 border-b border-white/10">
                    <th className="px-4 sm:px-6 py-4 text-xs font-bold uppercase tracking-wider text-white">Invoice ID</th>
                    <th className="px-4 sm:px-6 py-4 text-xs font-bold uppercase tracking-wider text-white hidden md:table-cell">Client</th>
                    <th className="px-4 sm:px-6 py-4 text-xs font-bold uppercase tracking-wider text-white hidden lg:table-cell">Date Issued</th>
                    <th className="px-4 sm:px-6 py-4 text-xs font-bold uppercase tracking-wider text-white hidden lg:table-cell">Due Date</th>
                    <th className="px-4 sm:px-6 py-4 text-xs font-bold uppercase tracking-wider text-white">Amount</th>
                    <th className="px-4 sm:px-6 py-4 text-xs font-bold uppercase tracking-wider text-white">Status</th>
                    <th className="px-4 sm:px-6 py-4 text-xs font-bold uppercase tracking-wider text-right text-white">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedInvoices.map((invoice, idx) => {
                    const isOverdue = invoice.status === "pending" && invoice.due_date && new Date(invoice.due_date) < new Date();
                    const amountStr = FIAT_CODES.includes(invoice.currency)
                      ? (invoice.currency === "NGN" ? "₦" : invoice.currency === "USD" ? "$" : invoice.currency === "EUR" ? "€" : invoice.currency === "GBP" ? "£" : "") + parseFloat(invoice.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (invoice.currency !== "NGN" ? ` ${invoice.currency}` : "")
                      : `${parseFloat(invoice.amount.toString()).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${invoice.currency}`;
                    const statusDisplay = isOverdue ? "Overdue" : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1);
                    const statusClass = isOverdue ? "bg-rose-900/30 text-rose-300 border border-rose-800" : getStatusBadgeClass(invoice.status);
                    const initials = (invoice.customer_name || invoice.customer_email || "?")
                      .split(/[\s@]/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((s) => s[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    return (
                      <tr
                        key={invoice.id}
                        className={`hover:bg-secondary/10 transition-colors group ${idx % 2 === 1 ? "bg-surface-highlight/20" : ""}`}
                      >
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <span className="font-bold text-white">{invoice.invoice_number}</span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded bg-white/10 flex items-center justify-center text-xs font-bold text-white mr-3 flex-shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white">{invoice.customer_name || "—"}</div>
                              <div className="text-xs text-accent/60">{invoice.customer_email || ""}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-accent/70 hidden lg:table-cell">
                          {new Date(invoice.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-accent/70 hidden lg:table-cell">
                          {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <span className="font-bold text-white">{amountStr}</span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${statusClass}`}>
                            {statusDisplay}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isOverdue && (
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemindInvoice(invoice); }}
                                disabled={remindingInvoice === invoice.invoice_number}
                                className="text-xs bg-secondary text-background-dark font-bold px-2 py-1 rounded shadow hover:opacity-90 disabled:opacity-50"
                              >
                                {remindingInvoice === invoice.invoice_number ? "..." : "Remind"}
                              </button>
                            )}
                            <Link href={`/invoice/${invoice.invoice_number}`} className="p-2 rounded-lg text-accent/70 hover:text-secondary hover:bg-secondary/10 transition-colors" title="View">
                              <span className="material-icons-outlined text-lg">visibility</span>
                            </Link>
                            {(invoice.status === "pending" || invoice.status === "draft") && (
                              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditInvoice(invoice); }} className="p-2 rounded-lg text-accent/70 hover:text-secondary hover:bg-secondary/10 transition-colors" title="Edit">
                                <span className="material-icons-outlined text-lg">edit</span>
                              </button>
                            )}
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShareInvoice(invoice.invoice_number); }} className="p-2 rounded-lg text-accent/70 hover:text-secondary hover:bg-secondary/10 transition-colors" title="Share">
                              <span className="material-icons-outlined text-lg">share</span>
                            </button>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownloadPDF(invoice.invoice_number); }} className="p-2 rounded-lg text-accent/70 hover:text-secondary hover:bg-secondary/10 transition-colors" title="PDF">
                              <span className="material-icons-outlined text-lg">download</span>
                            </button>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteClick(invoice); }} className="p-2 rounded-lg text-accent/70 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                              <span className="material-icons-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 sm:px-6 py-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-accent/70">
                Showing <span className="font-bold text-white">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{" "}
                <span className="font-bold text-white">{Math.min(currentPage * PAGE_SIZE, filteredInvoices.length)}</span> of{" "}
                <span className="font-bold text-white">{filteredInvoices.length}</span> invoices
              </p>
              <nav className="flex items-center gap-1" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-white/10 bg-surface text-accent/70 hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-icons-outlined text-sm">chevron_left</span>
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium ${
                        currentPage === pageNum
                          ? "bg-secondary text-background-dark border border-secondary"
                          : "border border-white/10 bg-surface text-accent/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-white/10 bg-surface text-accent/70 hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-icons-outlined text-sm">chevron_right</span>
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Floating Add Button - Mobile */}
        <button
          onClick={() => setShowCreateForm(true)}
          className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-secondary text-background-dark rounded-full shadow-xl flex items-center justify-center hover:opacity-90 z-40"
          aria-label="Create invoice"
        >
          <span className="material-icons-outlined">add</span>
        </button>

        {/* Create Invoice Modal */}
        {showCreateForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-md overflow-y-auto"
            onClick={() => {
              setShowCreateForm(false);
              setActiveTab("NGN");
            }}
          >
            <div
              className="bg-surface/95 backdrop-blur-[24px] rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-accent/10 my-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-3 pb-0 flex-shrink-0">
                <h2 className="text-base font-bold text-white">Create Invoice</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-accent/70 hover:text-white p-1 rounded-lg hover:bg-white/5"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateInvoice} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto flex-1 p-3 pt-2 space-y-3">
                {/* Invoice Type Display (read-only, managed in Settings) */}
                <div className="mb-2 p-2.5 bg-surface-highlight/50 border border-accent/10 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-accent/90">
                        Invoice Type: <span className="capitalize text-white">{formData.invoiceType}</span>
                      </p>
                      <p className="text-xs text-accent/60 mt-1">
                        {formData.invoiceType === "personal" 
                          ? "Invoice will show your personal name and email"
                          : "Invoice will show your business information and logo"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push("/settings")}
                      className="text-xs text-secondary hover:underline font-medium"
                    >
                      Change in Settings →
                    </button>
                  </div>
                </div>

                {/* Tab Selection */}
                <div className="flex gap-2 mb-3 border-b border-accent/10">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("NGN");
                      setFormData({ 
                        ...formData, 
                        currency: "NGN", 
                        cryptoChainId: "", 
                        cryptoToken: "", 
                        cryptoAddress: "",
                        amount: "",
                      });
                    }}
                    className={`flex-1 py-2 px-3 text-sm font-semibold transition-colors ${
                      activeTab === "NGN"
                        ? "border-b-2 border-secondary text-secondary"
                        : "text-accent/70 hover:text-white"
                    }`}
                  >
                    Fiat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("Crypto");
                      setFormData({ 
                        ...formData, 
                        currency: "", 
                        cryptoChainId: "", 
                        cryptoToken: "", 
                        cryptoAddress: "",
                        amount: "",
                      });
                    }}
                    className={`flex-1 py-2 px-3 text-sm font-semibold transition-colors ${
                      activeTab === "Crypto"
                        ? "border-b-2 border-secondary text-secondary"
                        : "text-accent/70 hover:text-white"
                    }`}
                  >
                    Crypto
                  </button>
                </div>

                {activeTab === "NGN" ? (
                  /* Fiat Tab Content */
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-accent/80 mb-1">
                        Select currency
                      </label>
                      <select
                        value={formData.fiatCurrency}
                        onChange={(e) => setFormData({ ...formData, fiatCurrency: e.target.value })}
                        className="w-full rounded-xl border border-accent/10 bg-primary/40 text-white px-3 py-2.5 focus:ring-2 focus:ring-secondary focus:border-secondary"
                        title="Fiat currency"
                      >
                        {FIAT_CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    {/* Amount will be calculated from line items */}
                  </div>
                ) : (
                  /* Crypto Tab Content */
                  <div className="space-y-3">
                    {/* Step 1: Select Chain/Network */}
                    <div>
                      <label className="block text-sm font-medium text-accent/80 mb-1">
                        Select Network/Chain *
                      </label>
                      <div className="relative" ref={chainDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsChainDropdownOpen(!isChainDropdownOpen)}
                          className="w-full rounded-xl border border-accent/10 bg-primary/40 text-white px-3 py-2.5 pl-10 pr-10 focus:ring-2 focus:ring-secondary focus:border-secondary flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {formData.cryptoChainId && getChainLogo(formData.cryptoChainId) ? (
                              <img
                                src={getChainLogo(formData.cryptoChainId)}
                                alt={SUPPORTED_CHAINS[formData.cryptoChainId]?.name || formData.cryptoChainId}
                                className="w-5 h-5 rounded-full flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-primary/60 flex-shrink-0"></div>
                            )}
                            <span className="text-sm truncate">
                              {formData.cryptoChainId 
                                ? SUPPORTED_CHAINS[formData.cryptoChainId]?.name 
                                : "Select a network"}
                            </span>
                          </div>
                          <span className="material-icons-outlined text-accent/60 text-sm flex-shrink-0">
                            {isChainDropdownOpen ? "expand_less" : "expand_more"}
                          </span>
                        </button>

                        {isChainDropdownOpen && (
                          <div className="absolute z-50 w-full mt-2 bg-surface border border-accent/10 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                            {Object.values(SUPPORTED_CHAINS).map((chain) => {
                              const logoUrl = getChainLogo(chain.id);
                              const isSelected = formData.cryptoChainId === chain.id;
                              return (
                                <button
                                  key={chain.id}
                                  type="button"
                                  onClick={() => {
                                    const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
                                    setFormData({
                                      ...formData,
                                      cryptoChainId: chain.id,
                                      cryptoToken: "",
                                      cryptoAddress: walletAddresses[chain.id] || "",
                                      amount: "",
                                    });
                                    setIsChainDropdownOpen(false);
                                  }}
                                  className={`w-full p-3 flex items-center gap-3 transition-colors ${
                                    isSelected
                                      ? "bg-secondary/10 hover:bg-secondary/20"
                                      : "hover:bg-primary/60"
                                  }`}
                                >
                                  {logoUrl ? (
                                    <img
                                      src={logoUrl}
                                      alt={chain.name}
                                      className="w-5 h-5 rounded-full flex-shrink-0"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-primary/60 flex-shrink-0"></div>
                                  )}
                                  <span className={`text-sm font-medium flex-1 text-left ${
                                    isSelected
                                      ? "text-secondary"
                                      : "text-white"
                                  }`}>
                                    {chain.name}
                                  </span>
                                  {isSelected && (
                                    <span className="material-icons-outlined text-secondary text-sm">
                                      check
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 2: Select Token (only shown if chain is selected) */}
                    {formData.cryptoChainId && (() => {
                      // Build available tokens list
                      const availableTokens: Array<{ symbol: string; label: string }> = [];
                      
                      // Add native token
                      if (SUPPORTED_CHAINS[formData.cryptoChainId]?.nativeCurrency?.symbol) {
                        const nativeSymbol = SUPPORTED_CHAINS[formData.cryptoChainId].nativeCurrency!.symbol;
                        availableTokens.push({
                          symbol: nativeSymbol,
                          label: `${nativeSymbol} (Native)`
                        });
                      }
                      
                      // Add stablecoins
                      availableTokens.push({ symbol: "USDC", label: "USDC" });
                      availableTokens.push({ symbol: "USDT", label: "USDT" });
                      
                      // Add SEND token only for Base
                      if (formData.cryptoChainId === "base") {
                        availableTokens.push({ symbol: "SEND", label: "SEND Token" });
                      }
                      
                      return (
                        <div>
                      <label className="block text-sm font-medium text-accent/80 mb-1">
                        Select Token *
                      </label>
                      <div className="relative" ref={tokenDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                          className="w-full rounded-xl border border-accent/10 bg-primary/40 text-white px-3 py-2.5 pl-10 pr-10 focus:ring-2 focus:ring-secondary focus:border-secondary flex items-center justify-between"
                        >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {formData.cryptoToken && getTokenLogo(formData.cryptoToken) ? (
                                  <img
                                    src={getTokenLogo(formData.cryptoToken)}
                                    alt={formData.cryptoToken}
                                    className="w-5 h-5 rounded-full flex-shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-primary/60 flex-shrink-0"></div>
                                )}
                                <span className="text-sm truncate">
                                  {formData.cryptoToken 
                                    ? availableTokens.find(t => t.symbol === formData.cryptoToken)?.label
                                    : "Select a token"}
                                </span>
                              </div>
                              <span className="material-icons-outlined text-accent/60 text-sm flex-shrink-0">
                                {isTokenDropdownOpen ? "expand_less" : "expand_more"}
                              </span>
                            </button>

                            {isTokenDropdownOpen && (
                              <div className="absolute z-50 w-full mt-2 bg-surface border border-accent/10 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                                {availableTokens.map((token) => {
                                  const logoUrl = getTokenLogo(token.symbol);
                                  const isSelected = formData.cryptoToken === token.symbol;
                                  return (
                                    <button
                                      key={token.symbol}
                                      type="button"
                                      onClick={() => {
                                        setFormData({ 
                                          ...formData, 
                                          cryptoToken: token.symbol,
                                          amount: "",
                                        });
                                        setIsTokenDropdownOpen(false);
                                      }}
                                      className={`w-full p-3 flex items-center gap-3 transition-colors ${
                                        isSelected
                                          ? "bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30"
                                          : "hover:bg-white/5"
                                      }`}
                                    >
                                      {logoUrl ? (
                                        <img
                                          src={logoUrl}
                                          alt={token.symbol}
                                          className="w-5 h-5 rounded-full flex-shrink-0"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-primary/60 flex-shrink-0"></div>
                                      )}
                                      <span className={`text-sm font-medium flex-1 text-left ${
                                        isSelected
                                          ? "text-primary dark:text-primary"
                                          : "text-white"
                                      }`}>
                                        {token.label}
                                      </span>
                                      {isSelected && (
                                        <span className="material-icons-outlined text-primary text-sm">
                                          check
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Amount will be calculated from line items */}

                    {/* Wallet Address Input */}
                    {formData.cryptoChainId && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-medium text-accent/80">
                            Wallet Address (Optional)
                          </label>
                          {(() => {
                            const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
                            const defaultAddress = walletAddresses[formData.cryptoChainId] || "";
                            const isUsingDefault = formData.cryptoAddress === defaultAddress;
                            
                            if (defaultAddress && !isUsingDefault) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, cryptoAddress: defaultAddress });
                                  }}
                                  className="text-xs text-primary hover:underline font-semibold"
                                >
                                  Use my wallet address
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <input
                          type="text"
                          value={formData.cryptoAddress}
                          onChange={(e) => setFormData({ ...formData, cryptoAddress: e.target.value })}
                          className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40 font-mono text-sm"
                          placeholder="Enter custom wallet address (optional)"
                        />
                        <p className="text-xs text-accent/60 mt-1">
                          {(() => {
                            const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
                            const defaultAddress = walletAddresses[formData.cryptoChainId] || "";
                            if (defaultAddress) {
                              return `If left empty, will use your ${formData.cryptoChainId} wallet: ${defaultAddress.slice(0, 6)}...${defaultAddress.slice(-4)}`;
                            }
                            return "Enter a custom wallet address (optional). If empty, you'll need to add a wallet address in your crypto dashboard first.";
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Line Items Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-accent/80">
                      Items
                    </label>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="text-sm text-primary hover:text-primary/80 font-semibold flex items-center gap-1"
                    >
                      <span className="material-icons-outlined text-sm">add</span>
                      Add Item
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                            className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 text-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                            placeholder="Item description"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.amount}
                            onChange={(e) => updateLineItem(item.id, "amount", e.target.value)}
                            className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 text-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                            placeholder="Amount"
                          />
                        </div>
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(item.id)}
                            className="mt-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2"
                            title="Remove item"
                          >
                            <span className="material-icons-outlined text-sm">delete</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Total Display */}
                  <div className="mt-3 p-3 bg-surface-highlight/50 rounded-lg border border-accent/10">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-accent/90">
                        Total:
                      </span>
                      <span className="text-lg font-bold text-secondary">
                        {activeTab === "NGN" 
                          ? (formData.fiatCurrency === "NGN" 
                              ? `₦${calculateTotal(lineItems).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `${formData.fiatCurrency === "USD" ? "$" : formData.fiatCurrency === "EUR" ? "€" : formData.fiatCurrency === "GBP" ? "£" : ""}${calculateTotal(lineItems).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${formData.fiatCurrency}`)
                          : `${calculateTotal(lineItems).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${formData.cryptoToken || ""}`
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bank Details - NGN only */}
                {activeTab === "NGN" && (
                  <div className="space-y-3 p-3 bg-surface-highlight/50 border border-accent/10 rounded-xl">
                    <p className="text-sm font-semibold text-white">Bank Details (for Fiat payment)</p>
                    <div>
                      <label className="block text-sm font-medium text-accent/80 mb-1">
                        Account Name
                      </label>
                      <input
                        type="text"
                        value={formData.accountName}
                        onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                        className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                        placeholder="Account name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-accent/80 mb-1">
                        Account Number
                      </label>
                      <input
                        type="text"
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                        placeholder="Account number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-accent/80 mb-1">
                        Bank
                      </label>
                      <input
                        type="text"
                        value={formData.bank}
                        onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                        className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                        placeholder="Bank name"
                      />
                    </div>
                  </div>
                )}

                {/* Optional Description Field */}
                <div>
                  <label className="block text-sm font-medium text-accent/80 mb-1">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                    rows={2}
                    placeholder="Additional notes or terms..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-accent/80 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                    placeholder="Customer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-accent/80 mb-1">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                    placeholder="customer@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-accent/80 mb-1">
                    Customer Phone
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.customerPhoneCountryCode}
                      onChange={(e) => setFormData({ ...formData, customerPhoneCountryCode: e.target.value })}
                      className="w-[130px] rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40 flex-shrink-0"
                      title="Country code"
                    >
                      {PHONE_COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      className="flex-1 min-w-0 rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                      placeholder="801 234 5678"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-accent/80 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                  />
                </div>
                </div>

                <div className="flex gap-3 pt-4 p-6 flex-shrink-0 border-t border-accent/10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setActiveTab("NGN");
                    }}
                    className="flex-1 bg-primary/40 border border-accent/10 text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-primary/60 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 bg-secondary text-primary font-bold py-2.5 px-4 rounded-xl hover:bg-secondary/90 transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(19,236,90,0.2)]"
                  >
                    {isCreating ? "Creating..." : "Create Invoice"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Invoice Modal */}
        {editingInvoice && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto"
            onClick={() => {
              setEditingInvoice(null);
              setEditActiveTab("NGN");
            }}
          >
            <div
              className="bg-surface/95 backdrop-blur-[24px] rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-secondary/10 my-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 pb-0 flex-shrink-0">
                <h2 className="text-lg font-bold text-white">Edit Invoice</h2>
                <button
                  onClick={() => {
                    setEditingInvoice(null);
                    setEditActiveTab("NGN");
                  }}
                  className="text-accent/70 hover:text-white p-1 rounded-lg hover:bg-white/5"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleUpdateInvoice} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto flex-1 p-4 pt-3 space-y-4">
                {/* Invoice Type Display (read-only, managed in Settings) */}
                <div className="mb-3 p-3 bg-surface-highlight/50 border border-secondary/10 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-accent/90">
                        Invoice Type: <span className="capitalize text-white">{editFormData.invoiceType}</span>
                      </p>
                      <p className="text-xs text-accent/60 mt-1">
                        {editFormData.invoiceType === "personal" 
                          ? "Invoice will show your personal name and email"
                          : "Invoice will show your business information and logo"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push("/settings")}
                      className="text-xs text-secondary hover:underline font-medium"
                    >
                      Change in Settings →
                    </button>
                  </div>
                </div>

                {/* Tab Selection */}
                <div className="flex gap-2 mb-3 border-b border-accent/10">
                  <button
                    type="button"
                    onClick={() => {
                      setEditActiveTab("NGN");
                      setEditFormData({ 
                        ...editFormData, 
                        currency: "NGN", 
                        cryptoChainId: "", 
                        cryptoToken: "", 
                        cryptoAddress: "",
                        amount: "",
                      });
                    }}
                    className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors ${
                      editActiveTab === "NGN"
                        ? "border-b-2 border-secondary text-secondary"
                        : "text-accent/70 hover:text-white"
                    }`}
                  >
                    Fiat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditActiveTab("Crypto");
                      setEditFormData({ 
                        ...editFormData, 
                        currency: "", 
                        cryptoChainId: "", 
                        cryptoToken: "", 
                        cryptoAddress: "",
                        amount: "",
                      });
                    }}
                    className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors ${
                      editActiveTab === "Crypto"
                        ? "border-b-2 border-secondary text-secondary"
                        : "text-accent/70 hover:text-white"
                    }`}
                  >
                    Crypto
                  </button>
                </div>

                {editActiveTab === "NGN" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-accent/80 mb-1">
                        Select currency
                      </label>
                      <select
                        value={editFormData.fiatCurrency}
                        onChange={(e) => setEditFormData({ ...editFormData, fiatCurrency: e.target.value })}
                        className="w-full rounded-xl border border-accent/10 bg-primary/40 text-white px-3 py-2.5 focus:ring-2 focus:ring-secondary focus:border-secondary"
                        title="Fiat currency"
                      >
                        {FIAT_CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    {/* Amount will be calculated from line items */}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-accent/80 mb-1">
                        Select Network/Chain *
                      </label>
                      <div className="relative" ref={editChainDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsEditChainDropdownOpen(!isEditChainDropdownOpen)}
                          className="w-full rounded-xl border border-accent/10 bg-primary/40 text-white px-3 py-2.5 pl-10 pr-10 focus:ring-2 focus:ring-secondary focus:border-secondary flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {editFormData.cryptoChainId && getChainLogo(editFormData.cryptoChainId) ? (
                              <img
                                src={getChainLogo(editFormData.cryptoChainId)}
                                alt={SUPPORTED_CHAINS[editFormData.cryptoChainId]?.name || editFormData.cryptoChainId}
                                className="w-5 h-5 rounded-full flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-primary/60 flex-shrink-0"></div>
                            )}
                            <span className="text-sm truncate">
                              {editFormData.cryptoChainId 
                                ? SUPPORTED_CHAINS[editFormData.cryptoChainId]?.name 
                                : "Select a network"}
                            </span>
                          </div>
                          <span className="material-icons-outlined text-accent/60 text-sm flex-shrink-0">
                            {isEditChainDropdownOpen ? "expand_less" : "expand_more"}
                          </span>
                        </button>

                        {isEditChainDropdownOpen && (
                          <div className="absolute z-50 w-full mt-2 bg-surface border border-accent/10 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                            {Object.values(SUPPORTED_CHAINS).map((chain) => {
                              const logoUrl = getChainLogo(chain.id);
                              const isSelected = editFormData.cryptoChainId === chain.id;
                              return (
                                <button
                                  key={chain.id}
                                  type="button"
                                  onClick={() => {
                                    const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
                                    setEditFormData({
                                      ...editFormData,
                                      cryptoChainId: chain.id,
                                      cryptoToken: "",
                                      cryptoAddress: walletAddresses[chain.id] || "",
                                      amount: "",
                                    });
                                    setIsEditChainDropdownOpen(false);
                                  }}
                                  className={`w-full p-3 flex items-center gap-3 transition-colors ${
                                    isSelected
                                      ? "bg-secondary/10 hover:bg-secondary/20"
                                      : "hover:bg-primary/60"
                                  }`}
                                >
                                  {logoUrl ? (
                                    <img
                                      src={logoUrl}
                                      alt={chain.name}
                                      className="w-5 h-5 rounded-full flex-shrink-0"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-primary/60 flex-shrink-0"></div>
                                  )}
                                  <span className={`text-sm font-medium flex-1 text-left ${
                                    isSelected
                                      ? "text-secondary"
                                      : "text-white"
                                  }`}>
                                    {chain.name}
                                  </span>
                                  {isSelected && (
                                    <span className="material-icons-outlined text-secondary text-sm">
                                      check
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {editFormData.cryptoChainId && (() => {
                      // Build available tokens list
                      const availableTokens: Array<{ symbol: string; label: string }> = [];
                      
                      // Add native token
                      if (SUPPORTED_CHAINS[editFormData.cryptoChainId]?.nativeCurrency?.symbol) {
                        const nativeSymbol = SUPPORTED_CHAINS[editFormData.cryptoChainId].nativeCurrency!.symbol;
                        availableTokens.push({
                          symbol: nativeSymbol,
                          label: `${nativeSymbol} (Native)`
                        });
                      }
                      
                      // Add stablecoins
                      availableTokens.push({ symbol: "USDC", label: "USDC" });
                      availableTokens.push({ symbol: "USDT", label: "USDT" });
                      
                      // Add SEND token only for Base
                      if (editFormData.cryptoChainId === "base") {
                        availableTokens.push({ symbol: "SEND", label: "SEND Token" });
                      }
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-accent/80 mb-1">
                            Select Token *
                          </label>
                          <div className="relative" ref={editTokenDropdownRef}>
                            <button
                              type="button"
                              onClick={() => setIsEditTokenDropdownOpen(!isEditTokenDropdownOpen)}
                              className="w-full rounded-xl border border-accent/10 bg-primary/40 text-white px-3 py-2.5 pl-10 pr-10 focus:ring-2 focus:ring-secondary focus:border-secondary flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {editFormData.cryptoToken && getTokenLogo(editFormData.cryptoToken) ? (
                                  <img
                                    src={getTokenLogo(editFormData.cryptoToken)}
                                    alt={editFormData.cryptoToken}
                                    className="w-5 h-5 rounded-full flex-shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-primary/60 flex-shrink-0"></div>
                                )}
                                <span className="text-sm truncate">
                                  {editFormData.cryptoToken 
                                    ? availableTokens.find(t => t.symbol === editFormData.cryptoToken)?.label
                                    : "Select a token"}
                                </span>
                              </div>
                              <span className="material-icons-outlined text-accent/60 text-sm flex-shrink-0">
                                {isEditTokenDropdownOpen ? "expand_less" : "expand_more"}
                              </span>
                            </button>

                            {isEditTokenDropdownOpen && (
                              <div className="absolute z-50 w-full mt-2 bg-surface border border-accent/10 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                                {availableTokens.map((token) => {
                                  const logoUrl = getTokenLogo(token.symbol);
                                  const isSelected = editFormData.cryptoToken === token.symbol;
                                  return (
                                    <button
                                      key={token.symbol}
                                      type="button"
                                      onClick={() => {
                                        setEditFormData({ 
                                          ...editFormData, 
                                          cryptoToken: token.symbol,
                                          amount: "",
                                        });
                                        setIsEditTokenDropdownOpen(false);
                                      }}
                                      className={`w-full p-3 flex items-center gap-3 transition-colors ${
                                        isSelected
                                          ? "bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30"
                                          : "hover:bg-white/5"
                                      }`}
                                    >
                                      {logoUrl ? (
                                        <img
                                          src={logoUrl}
                                          alt={token.symbol}
                                          className="w-5 h-5 rounded-full flex-shrink-0"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-primary/60 flex-shrink-0"></div>
                                      )}
                                      <span className={`text-sm font-medium flex-1 text-left ${
                                        isSelected
                                          ? "text-primary dark:text-primary"
                                          : "text-white"
                                      }`}>
                                        {token.label}
                                      </span>
                                      {isSelected && (
                                        <span className="material-icons-outlined text-primary text-sm">
                                          check
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Amount will be calculated from line items */}

                    {/* Wallet Address Input */}
                    {editFormData.cryptoChainId && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-medium text-accent/80">
                            Wallet Address (Optional)
                          </label>
                          {(() => {
                            const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
                            const defaultAddress = walletAddresses[editFormData.cryptoChainId] || "";
                            const isUsingDefault = editFormData.cryptoAddress === defaultAddress;
                            
                            if (defaultAddress && !isUsingDefault) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditFormData({ ...editFormData, cryptoAddress: defaultAddress });
                                  }}
                                  className="text-xs text-primary hover:underline font-semibold"
                                >
                                  Use my wallet address
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <input
                          type="text"
                          value={editFormData.cryptoAddress}
                          onChange={(e) => setEditFormData({ ...editFormData, cryptoAddress: e.target.value })}
                          className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40 font-mono text-sm"
                          placeholder="Enter custom wallet address (optional)"
                        />
                        <p className="text-xs text-accent/60 mt-1">
                          {(() => {
                            const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
                            const defaultAddress = walletAddresses[editFormData.cryptoChainId] || "";
                            if (defaultAddress) {
                              return `If left empty, will use your ${editFormData.cryptoChainId} wallet: ${defaultAddress.slice(0, 6)}...${defaultAddress.slice(-4)}`;
                            }
                            return "Enter a custom wallet address (optional). If empty, you'll need to add a wallet address in your crypto dashboard first.";
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Line Items Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-accent/80">
                      Items
                    </label>
                    <button
                      type="button"
                      onClick={addEditLineItem}
                      className="text-sm text-primary hover:text-primary/80 font-semibold flex items-center gap-1"
                    >
                      <span className="material-icons-outlined text-sm">add</span>
                      Add Item
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {editLineItems.map((item, index) => (
                      <div key={item.id} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateEditLineItem(item.id, "description", e.target.value)}
                            className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 text-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                            placeholder="Item description"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.amount}
                            onChange={(e) => updateEditLineItem(item.id, "amount", e.target.value)}
                            className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 text-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                            placeholder="Amount"
                          />
                        </div>
                        {editLineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEditLineItem(item.id)}
                            className="mt-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2"
                            title="Remove item"
                          >
                            <span className="material-icons-outlined text-sm">delete</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Total Display */}
                  <div className="mt-3 p-3 bg-surface-highlight/50 rounded-lg border border-accent/10">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-accent/90">
                        Total:
                      </span>
                      <span className="text-lg font-bold text-secondary">
                        {editActiveTab === "NGN" 
                          ? (editFormData.fiatCurrency === "NGN" 
                              ? `₦${calculateTotal(editLineItems).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `${editFormData.fiatCurrency === "USD" ? "$" : editFormData.fiatCurrency === "EUR" ? "€" : editFormData.fiatCurrency === "GBP" ? "£" : ""}${calculateTotal(editLineItems).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${editFormData.fiatCurrency}`)
                          : `${calculateTotal(editLineItems).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${editFormData.cryptoToken || ""}`
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bank Details - NGN only */}
                {editActiveTab === "NGN" && (
                  <div className="space-y-3 p-3 bg-surface-highlight/50 border border-accent/10 rounded-xl">
                    <p className="text-sm font-semibold text-white">Bank Details (for Fiat payment)</p>
                    <div>
                      <label className="block text-sm font-medium text-accent/80 mb-1">
                        Account Name
                      </label>
                      <input
                        type="text"
                        value={editFormData.accountName}
                        onChange={(e) => setEditFormData({ ...editFormData, accountName: e.target.value })}
                        className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                        placeholder="Account name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-accent/80 mb-1">
                        Account Number
                      </label>
                      <input
                        type="text"
                        value={editFormData.accountNumber}
                        onChange={(e) => setEditFormData({ ...editFormData, accountNumber: e.target.value })}
                        className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                        placeholder="Account number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-accent/80 mb-1">
                        Bank
                      </label>
                      <input
                        type="text"
                        value={editFormData.bank}
                        onChange={(e) => setEditFormData({ ...editFormData, bank: e.target.value })}
                        className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                        placeholder="Bank name"
                      />
                    </div>
                  </div>
                )}

                {/* Optional Description Field */}
                <div>
                  <label className="block text-sm font-medium text-accent/80 mb-1">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                    rows={2}
                    placeholder="Additional notes or terms..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-accent/80 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.customerName}
                    onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                    className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                    placeholder="Customer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-accent/80 mb-1">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    value={editFormData.customerEmail}
                    onChange={(e) => setEditFormData({ ...editFormData, customerEmail: e.target.value })}
                    className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                    placeholder="customer@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-accent/80 mb-1">
                    Customer Phone
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={editFormData.customerPhoneCountryCode}
                      onChange={(e) => setEditFormData({ ...editFormData, customerPhoneCountryCode: e.target.value })}
                      className="w-[130px] rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40 flex-shrink-0"
                      title="Country code"
                    >
                      {PHONE_COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={editFormData.customerPhone}
                      onChange={(e) => setEditFormData({ ...editFormData, customerPhone: e.target.value })}
                      className="flex-1 min-w-0 rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                      placeholder="801 234 5678"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-accent/80 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editFormData.dueDate}
                    onChange={(e) => setEditFormData({ ...editFormData, dueDate: e.target.value })}
                    className="w-full rounded-lg border border-accent/10 bg-primary/40 text-white px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary placeholder-accent/40"
                  />
                </div>
                </div>

                <div className="flex gap-3 pt-4 p-6 flex-shrink-0 border-t border-accent/10">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingInvoice(null);
                      setEditActiveTab("NGN");
                    }}
                    className="flex-1 bg-primary/40 border border-accent/10 text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary/60 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 bg-primary text-secondary font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isUpdating ? "Updating..." : "Update Invoice"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleCancelDelete}
        >
          <div
            className="bg-surface/95 backdrop-blur-[24px] rounded-xl shadow-xl max-w-md w-full p-4 border border-accent/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                <span className="material-icons-outlined text-red-600 dark:text-red-400 text-2xl">
                  warning
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Delete Invoice</h2>
                <p className="text-sm text-accent/70">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="mb-6 p-4 bg-red-500/10 rounded-lg border border-red-500/30">
              <p className="text-sm text-white mb-2">
                Are you sure you want to delete invoice <span className="font-semibold">{invoiceToDelete.invoice_number}</span>?
              </p>
              <p className="text-xs text-accent/70">
                Amount: {FIAT_CODES.includes(invoiceToDelete.currency)
                  ? (invoiceToDelete.currency === "NGN" ? "₦" : invoiceToDelete.currency === "USD" ? "$" : invoiceToDelete.currency === "EUR" ? "€" : invoiceToDelete.currency === "GBP" ? "£" : "") + parseFloat(invoiceToDelete.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (invoiceToDelete.currency !== "NGN" ? ` ${invoiceToDelete.currency}` : "")
                  : `${parseFloat(invoiceToDelete.amount.toString()).toLocaleString()} ${invoiceToDelete.currency}`
                }
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelDelete}
                disabled={deletingInvoice !== null}
                className="flex-1 bg-primary/40 border border-accent/10 text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary/60 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingInvoice !== null}
                className="flex-1 bg-red-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingInvoice === invoiceToDelete.invoice_number ? (
                  <>
                    <FSpinner size="xs" className="border-white" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined text-sm">delete</span>
                    Delete Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
    </DashboardLayout>
  );
}
