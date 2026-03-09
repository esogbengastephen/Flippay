"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { getUserFromStorage } from "@/lib/session";
import DashboardLayout from "@/components/DashboardLayout";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import { getChainLogo } from "@/lib/logos";
import FSpinner from "@/components/FSpinner";
import PageLoadingSpinner from "@/components/PageLoadingSpinner";
import dynamic from "next/dynamic";

// Lazy load QRCode component to reduce initial bundle
const QRCodeSVG = dynamic(() => import("qrcode.react").then(mod => ({ default: mod.QRCodeSVG })), {
  ssr: false,
  loading: () => <div className="w-48 h-48 flex items-center justify-center">Loading QR...</div>,
});

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
  status: "pending" | "paid" | "expired" | "cancelled";
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  invoice_type?: "personal" | "business";
}

interface Merchant {
  name: string;
  email: string;
  photoUrl: string | null;
  invoiceType?: "personal" | "business";
  businessName?: string | null;
  businessLogoUrl?: string | null;
  businessAddress?: string | null;
  businessCity?: string | null;
  businessState?: string | null;
  businessZip?: string | null;
  businessPhone?: string | null;
}

function InvoiceDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const invoiceNumber = params.invoiceNumber as string;
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<any>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [merchantWalletAddresses, setMerchantWalletAddresses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({ message: "", type: "info", isVisible: false });

  useEffect(() => {
    const currentUser = getUserFromStorage();
    setUser(currentUser);
    fetchInvoice();
    
    // Check if user returned from payment
    const paymentStatus = searchParams.get("payment");
    const reference = searchParams.get("reference");
    
    if (paymentStatus === "success" || reference) {
      // Wait a bit for webhook to process, then check invoice status
      setTimeout(() => {
        checkPaymentStatus(reference);
      }, 2000);
    }
  }, [invoiceNumber, searchParams]);
  
  const checkPaymentStatus = async (reference?: string | null) => {
    setIsCheckingPayment(true);
    try {
      // Fetch latest invoice status
      await fetchInvoice();
      
      // If reference provided, verify payment
      if (reference) {
        const response = await fetch(getApiUrl(`/api/paystack/verify?reference=${reference}`));
        const data = await response.json();
        
        if (data.success && data.data?.status === "success") {
          setToast({
            message: "Payment successful! Invoice has been marked as paid.",
            type: "success",
            isVisible: true,
          });
          // Refresh invoice after a moment
          setTimeout(() => {
            fetchInvoice();
          }, 1000);
        }
      }
    } catch (error) {
      console.error("Error checking payment status:", error);
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const user = getUserFromStorage();
      const url = getApiUrl(user
        ? `/api/invoices/${invoiceNumber}?email=${encodeURIComponent(user.email)}`
        : `/api/invoices/${invoiceNumber}`);

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        console.log("Invoice data:", data.invoice);
        console.log("Crypto address:", data.invoice?.crypto_address);
        console.log("Crypto chain ID:", data.invoice?.crypto_chain_id);
        console.log("Invoice status:", data.invoice?.status);
        setInvoice(data.invoice);
        if (data.merchant) {
          setMerchant(data.merchant);
        }
        
        // Check if current user is the invoice owner
        const currentUser = getUserFromStorage();
        if (currentUser && data.invoice) {
          // Check if user email matches merchant email or if user_id matches
          const userIsOwner = !!(currentUser.email === data.merchant?.email || 
                             (currentUser.id && data.invoice.user_id === currentUser.id));
          setIsOwner(userIsOwner);
        }
        
        // Fetch merchant's wallet addresses if invoice doesn't have crypto_address
        if (data.invoice && !data.invoice.crypto_address && data.invoice.crypto_chain_id && data.invoice.user_id) {
          fetchMerchantWalletAddresses(data.invoice.user_id, data.invoice.crypto_chain_id);
        }
      } else {
        setToast({
          message: data.error || "Invoice not found",
          type: "error",
          isVisible: true,
        });
      }
    } catch (error) {
      console.error("Error fetching invoice:", error);
      setToast({
        message: "Failed to fetch invoice",
        type: "error",
        isVisible: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMerchantWalletAddresses = async (merchantUserId: string, chainId: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/user/profile?userId=${merchantUserId}`));
      const data = await response.json();
      
      if (data.success && data.profile && data.profile.addresses) {
        setMerchantWalletAddresses(data.profile.addresses);
        console.log("Fetched merchant wallet addresses:", data.profile.addresses);
      }
    } catch (error) {
      console.error("Error fetching merchant wallet addresses:", error);
    }
  };

  // Get the effective wallet address (from invoice or merchant's dashboard)
  const getEffectiveWalletAddress = () => {
    if (!invoice || !invoice.crypto_chain_id) return null;
    
    // If invoice has a wallet address, use it
    if (invoice.crypto_address && invoice.crypto_address.trim() !== "") {
      return invoice.crypto_address;
    }
    
    // Otherwise, try to use merchant's wallet address for the chain
    return merchantWalletAddresses[invoice.crypto_chain_id] || null;
  };

  const handlePayInvoice = async () => {
    if (!user) {
      setToast({
        message: "Please log in to pay this invoice",
        type: "error",
        isVisible: true,
      });
      router.push("/auth");
      return;
    }

    setIsPaying(true);
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
        setIsPaying(false);
      }
    } catch (error) {
      console.error("Error paying invoice:", error);
      setToast({
        message: "Failed to process payment",
        type: "error",
        isVisible: true,
      });
      setIsPaying(false);
    }
  };

  const handleCopyWalletAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      setToast({
        message: "Wallet address copied to clipboard!",
        type: "success",
        isVisible: true,
      });
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (error) {
      console.error("Error copying wallet address:", error);
      setToast({
        message: "Failed to copy wallet address",
        type: "error",
        isVisible: true,
      });
    }
  };

  const handleShareInvoice = async () => {
    const shareUrl = window.location.href;
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

  const handleSendInvoice = async () => {
    const shareUrl = window.location.href;
    try {
      // Try to use Web Share API if available
      if (navigator.share) {
        await navigator.share({
          title: `Invoice ${invoice?.invoice_number}`,
          text: `Please find the invoice ${invoice?.invoice_number} for ${invoice?.currency === "NGN" ? `₦${parseFloat(invoice?.amount?.toString() || "0").toLocaleString()}` : `${parseFloat(invoice?.amount?.toString() || "0").toLocaleString()} ${invoice?.currency}`}`,
          url: shareUrl,
        });
        setToast({
          message: "Invoice shared successfully!",
          type: "success",
          isVisible: true,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        setToast({
          message: "Invoice link copied to clipboard! You can now send it via email or messaging app.",
          type: "success",
          isVisible: true,
        });
      }
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.name !== "AbortError") {
        console.error("Error sharing invoice:", error);
        // Fallback to clipboard
        try {
          await navigator.clipboard.writeText(shareUrl);
          setToast({
            message: "Invoice link copied to clipboard!",
            type: "success",
            isVisible: true,
          });
        } catch (clipboardError) {
          setToast({
            message: shareUrl,
            type: "info",
            isVisible: true,
          });
        }
      }
    }
  };

  const handleDownloadInvoice = async () => {
    if (!invoice) {
      setToast({
        message: "Invoice data not available",
        type: "error",
        isVisible: true,
      });
      return;
    }

    try {
      setToast({
        message: "Generating PDF...",
        type: "info",
        isVisible: true,
      });

      const { default: jsPDF } = await import("jspdf");

      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = 210;
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = margin;
      const lineH = 5;
      const contentLineH = 5.5;
      const sectionGap = 7;

      const ensureSpace = (needed: number) => {
        if (y + needed > 297 - margin) {
          pdf.addPage();
          y = margin;
        }
      };

      if (merchant) {
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        const fromName = (invoice?.invoice_type || merchant.invoiceType) === "business" && merchant.businessName ? merchant.businessName : merchant.name;
        const fromLines = pdf.splitTextToSize(fromName, 72);
        pdf.text(fromLines, margin, y);
        y += fromLines.length * 4 + 1;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(merchant.email, margin, y);
        y += lineH + 4;
      }

      const titleY = margin;
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text("INVOICE", pageW - margin, titleY + 6, { align: "right" });

      y = titleY + 12;
      const metaTableW = 58;
      const metaTableX = pageW - margin - metaTableW;
      const metaColW = metaTableW / 2;
      const metaRowH = 6;
      const metaPad = 3;
      const invNumLines = pdf.splitTextToSize(invoice.invoice_number, metaColW - metaPad * 2);
      const metaValueRowH = Math.max(metaRowH, invNumLines.length * 4 + 2);
      const metaTotalH = metaRowH + metaValueRowH;
      pdf.setFillColor(240, 240, 240);
      pdf.rect(metaTableX, y, metaColW, metaRowH, "F");
      pdf.rect(metaTableX + metaColW, y, metaColW, metaRowH, "F");
      pdf.setDrawColor(220, 220, 220);
      pdf.rect(metaTableX, y, metaTableW, metaTotalH, "S");
      pdf.line(metaTableX + metaColW, y, metaTableX + metaColW, y + metaTotalH);
      pdf.line(metaTableX, y + metaRowH, metaTableX + metaTableW, y + metaRowH);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text("INVOICE #", metaTableX + metaPad, y + 4);
      pdf.text("DATE", metaTableX + metaColW + metaPad, y + 4);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(invNumLines, metaTableX + metaPad, y + metaRowH + 4);
      pdf.text(new Date(invoice.created_at).toLocaleDateString(), metaTableX + metaColW + metaPad, y + metaRowH + 4);
      y += metaTotalH + 4;
      const pillW = 22;
      const pillH = 5;
      pdf.setFillColor(253, 230, 138);
      pdf.roundedRect(pageW - margin - pillW, y, pillW, pillH, 1, 1, "F");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(50, 50, 50);
      pdf.text(invoice.status.toUpperCase(), pageW - margin - pillW / 2, y + pillH / 2 + 0.8, { align: "center" });
      pdf.setTextColor(0, 0, 0);
      y += pillH + 4;

      pdf.setDrawColor(220, 220, 220);
      pdf.line(margin, y, pageW - margin, y);
      y += sectionGap;

      if (merchant) {
        ensureSpace(25);
        const barH = 7;
        const sectionIndent = 4;
        const afterBarGap = 4;
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, y, contentW, barH, "F");
        pdf.setDrawColor(229, 231, 235);
        pdf.rect(margin, y, contentW, barH, "S");
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.text("FROM", margin + sectionIndent, y + barH / 2 + 1.2);
        y += barH + afterBarGap;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        const fromName2 = (invoice?.invoice_type || merchant.invoiceType) === "business" && merchant.businessName ? merchant.businessName : merchant.name;
        const fromLines2 = pdf.splitTextToSize(fromName2, contentW - sectionIndent * 2);
        pdf.text(fromLines2, margin + sectionIndent, y);
        y += fromLines2.length * contentLineH;
        if ((invoice?.invoice_type || merchant.invoiceType) === "business" && (merchant.businessAddress || merchant.businessCity || merchant.businessState || merchant.businessZip)) {
          const addr = [merchant.businessAddress, [merchant.businessCity, merchant.businessState, merchant.businessZip].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
          const addrLines = pdf.splitTextToSize(addr, contentW - sectionIndent * 2);
          pdf.text(addrLines, margin + sectionIndent, y);
          y += addrLines.length * contentLineH;
        }
        if ((invoice?.invoice_type || merchant.invoiceType) === "business" && merchant.businessPhone) {
          pdf.text(`Phone: ${merchant.businessPhone}`, margin + sectionIndent, y);
          y += contentLineH;
        }
        pdf.text(merchant.email, margin + sectionIndent, y);
        y += contentLineH + sectionGap;
      }

      if (invoice.customer_name || invoice.customer_email || invoice.customer_phone) {
        ensureSpace(24);
        const barH = 7;
        const sectionIndent = 4;
        const afterBarGap = 4;
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, y, contentW, barH, "F");
        pdf.setDrawColor(229, 231, 235);
        pdf.rect(margin, y, contentW, barH, "S");
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.text("BILL TO", margin + sectionIndent, y + barH / 2 + 1.2);
        y += barH + afterBarGap;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        if (invoice.customer_name) {
          const lines = pdf.splitTextToSize(invoice.customer_name, contentW - sectionIndent * 2);
          pdf.text(lines, margin + sectionIndent, y);
          y += lines.length * contentLineH;
        }
        if (invoice.customer_email) {
          pdf.text(invoice.customer_email, margin + sectionIndent, y);
          y += contentLineH;
        }
        if (invoice.customer_phone) {
          pdf.text(invoice.customer_phone, margin + sectionIndent, y);
          y += contentLineH;
        }
        y += sectionGap;
      }

      ensureSpace(40);
      const lineItems = (invoice as any).metadata?.lineItems || [];
      const tableCol1 = margin;
      const amountColW = 48;
      const tableCol2 = pageW - margin - amountColW;
      const descColW = tableCol2 - tableCol1;
      const cellPadX = 4;
      const rowH = 8;
      const textBaseline = 5;

      pdf.setFillColor(243, 244, 246);
      pdf.rect(tableCol1, y, descColW, rowH, "F");
      pdf.rect(tableCol2, y, amountColW, rowH, "F");
      pdf.setDrawColor(229, 231, 235);
      pdf.rect(tableCol1, y, descColW + amountColW, rowH, "S");
      pdf.line(tableCol2, y, tableCol2, y + rowH);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("DESCRIPTION", tableCol1 + cellPadX, y + textBaseline);
      pdf.text("AMOUNT", tableCol2 + amountColW - cellPadX, y + textBaseline, { align: "right" });
      y += rowH;

      const fmtAmount = (amt: number) =>
        invoice.currency === "NGN"
          ? `₦${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : `${amt.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${invoice.currency}`;

      pdf.setFont("helvetica", "normal");
      if (lineItems.length > 0) {
        for (const item of lineItems) {
          const amt = parseFloat(String(item.amount));
          const descLines = pdf.splitTextToSize(item.description || "—", descColW - cellPadX * 2);
          const thisRowH = Math.max(rowH, descLines.length * 4 + 2);
          pdf.rect(tableCol1, y, descColW + amountColW, thisRowH, "S");
          pdf.line(tableCol2, y, tableCol2, y + thisRowH);
          pdf.text(descLines, tableCol1 + cellPadX, y + textBaseline);
          pdf.text(fmtAmount(amt), tableCol2 + amountColW - cellPadX, y + thisRowH / 2 - 1, { align: "right" });
          y += thisRowH;
        }
      } else {
        pdf.rect(tableCol1, y, descColW + amountColW, rowH, "S");
        pdf.line(tableCol2, y, tableCol2, y + rowH);
        pdf.text(invoice.description || "Service Payment", tableCol1 + cellPadX, y + textBaseline);
        pdf.text(fmtAmount(Number(invoice.amount)), tableCol2 + amountColW - cellPadX, y + textBaseline, { align: "right" });
        y += rowH;
      }

      pdf.setFont("helvetica", "bold");
      pdf.rect(tableCol1, y, descColW + amountColW, rowH, "S");
      pdf.line(tableCol2, y, tableCol2, y + rowH);
      pdf.text("TOTAL", tableCol1 + cellPadX, y + textBaseline);
      pdf.text(fmtAmount(Number(invoice.amount)), tableCol2 + amountColW - cellPadX, y + textBaseline, { align: "right" });
      y += rowH + 6;

      if (invoice.due_date) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, margin, y);
        y += contentLineH + sectionGap;
      }

      const bankDetails = (invoice as any).metadata?.bankDetails;
      if (invoice.currency === "NGN" && bankDetails && (bankDetails.accountName || bankDetails.accountNumber || bankDetails.bank)) {
        ensureSpace(28);
        const boxPad = 5;
        const boxY = y;
        pdf.setFillColor(249, 250, 251);
        pdf.setDrawColor(229, 231, 235);
        pdf.rect(margin, boxY, contentW, 1, "F");
        y += boxPad;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text("Bank Transfer Details", margin + 2, y);
        y += contentLineH + 1;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        if (bankDetails.accountName) {
          pdf.text(`Account Name: ${bankDetails.accountName}`, margin + 2, y);
          y += contentLineH;
        }
        if (bankDetails.accountNumber) {
          pdf.text(`Account Number: ${bankDetails.accountNumber}`, margin + 2, y);
          y += contentLineH;
        }
        if (bankDetails.bank) {
          pdf.text(`Bank: ${bankDetails.bank}`, margin + 2, y);
          y += contentLineH;
        }
        y += 3;
        pdf.rect(margin, boxY, contentW, y - boxY + 2, "S");
        y += sectionGap;
      }

      const effectiveAddress = invoice.crypto_chain_id
        ? (invoice.crypto_address?.trim() ? invoice.crypto_address : merchantWalletAddresses[invoice.crypto_chain_id] || null)
        : null;
      if (invoice.crypto_chain_id && invoice.currency !== "NGN" && effectiveAddress) {
        ensureSpace(38);
        const boxPad = 5;
        const boxIndent = 2;
        const boxY = y;
        pdf.setFillColor(249, 250, 251);
        pdf.setDrawColor(229, 231, 235);
        pdf.rect(margin, boxY, contentW, 1, "F");
        y += boxPad;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text("Payment Instructions", margin + boxIndent, y);
        y += contentLineH + 1;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        const sendStr = `Send ${parseFloat(String(invoice.amount)).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${invoice.currency} to:`;
        pdf.text(sendStr, margin + boxIndent, y);
        y += contentLineH;
        const addrLines = pdf.splitTextToSize(effectiveAddress, contentW - boxIndent * 2);
        pdf.text(addrLines, margin + boxIndent, y);
        y += addrLines.length * contentLineH + 3;
        pdf.text(`Network: ${invoice.crypto_chain_id.toUpperCase()}`, margin + boxIndent, y);
        y += contentLineH + 4;
        pdf.rect(margin, boxY, contentW, y - boxY + 2, "S");
        y += sectionGap;
      }

      ensureSpace(20);
      pdf.setDrawColor(229, 231, 235);
      pdf.line(margin, y, pageW - margin, y);
      y += 8;
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      const contact =
        merchant &&
        ((invoice?.invoice_type || merchant.invoiceType) === "business" && merchant.businessPhone
          ? `${merchant.businessName || merchant.name}, ${merchant.businessPhone}, ${merchant.email}`
          : `${merchant.name || "the sender"}${merchant.email ? `, ${merchant.email}` : ""}`);
      if (contact) {
        const footerLines = pdf.splitTextToSize(`If you have any questions about this invoice, please contact ${contact}.`, contentW);
        pdf.text(footerLines, margin, y);
        y += footerLines.length * contentLineH + 4;
      }
      pdf.text(`Invoice Template © ${new Date().getFullYear()} FlipPay`, pageW / 2, y, { align: "center" });

      pdf.save(`Invoice-${invoice.invoice_number}.pdf`);

      setToast({
        message: "Invoice downloaded successfully!",
        type: "success",
        isVisible: true,
      });
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      if (error?.message?.includes("Cannot find module") || error?.code === "MODULE_NOT_FOUND") {
        setToast({ message: "PDF library not available. Please run npm install.", type: "error", isVisible: true });
        return;
      }
      setToast({
        message: "Failed to generate PDF. Try again or use browser print (Ctrl+P / Cmd+P).",
        type: "error",
        isVisible: true,
      });
    }
  };

  const handleMarkAsPaid = async () => {
    if (!invoice) return;

    setIsMarkingPaid(true);
    try {
      const response = await fetch(getApiUrl(`/api/invoices/${encodeURIComponent(invoice.invoice_number)}/mark-paid`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: invoice.customer_email || user?.email,
          customerName: invoice.customer_name || user?.display_name,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          message: "Invoice marked as paid! The sender has been notified.",
          type: "success",
          isVisible: true,
        });
        // Refresh invoice after a moment
        setTimeout(() => {
          fetchInvoice();
        }, 1000);
      } else {
        setToast({
          message: data.error || "Failed to mark invoice as paid",
          type: "error",
          isVisible: true,
        });
      }
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      setToast({
        message: "Failed to mark invoice as paid",
        type: "error",
        isVisible: true,
      });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "expired":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "cancelled":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
      default:
        return "bg-amber-50 text-gray-900 dark:bg-amber-900/20 dark:text-gray-100";
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoadingSpinner message="Loading..." bgClass="bg-primary" />
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark pb-24 lg:pb-0">
          <div className="text-center">
            <span className="material-icons-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">
              receipt_long
            </span>
            <p className="text-gray-600 dark:text-gray-400">Invoice not found</p>
            <button
              onClick={() => router.push("/invoice")}
              className="mt-4 bg-primary text-secondary font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
            >
              Back to Invoices
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .invoice-container {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .invoice-card {
            box-shadow: none !important;
            border: 2px solid #93c5fd !important;
            page-break-inside: avoid;
            page-break-after: avoid;
            max-width: 794px !important;
            padding: 40px !important;
            min-height: 1123px !important;
          }
          .invoice-meta-mobile { display: none !important; }
          .invoice-meta-table { display: block !important; }
          button {
            display: none !important;
          }
          .no-print-button {
            display: none !important;
          }
          /* Ensure invoice fits on one page */
          @page {
            size: A4;
            margin: 0;
          }
          /* Hide dark mode styles in print */
          .dark\\:bg-white {
            background: white !important;
          }
          .dark\\:text-white {
            color: #1f2937 !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>
      <div className="min-h-screen bg-background-light dark:bg-background-dark p-2 sm:p-4 pb-20 sm:pb-24 overflow-x-hidden">
        <div className="max-w-4xl mx-auto invoice-container min-w-0">
        {/* Header */}
        <div className="mb-3 sm:mb-6 no-print">
          <button
            onClick={() => router.push("/invoice")}
            className="hidden lg:flex mb-2 text-primary hover:opacity-80 transition-opacity items-center gap-2"
          >
            <span className="material-icons-outlined">arrow_back</span>
            Back
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">Invoice Details</h1>
            <button
              onClick={handleShareInvoice}
              className="bg-secondary/10 text-secondary font-semibold py-2 px-3 rounded-lg hover:bg-secondary/20 transition-colors flex items-center gap-2"
            >
              <span className="material-icons-outlined text-sm">share</span>
              Share
            </button>
          </div>
        </div>

        {/* Invoice Card - Professional Invoice Layout (Single Page Design) */}
        <div ref={invoiceRef} className="invoice-card bg-white dark:bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-full min-w-0 box-border px-3 py-3 sm:px-6 sm:py-6 md:px-10 md:max-w-[794px] overflow-hidden">
          {/* Header Section: Company/Logo (Left) and INVOICE Title (Right) - stacked on mobile */}
          <div className="mb-4 pb-3 sm:mb-8 sm:pb-6 border-b border-gray-200">
            <div className="flex flex-col gap-3 sm:gap-6 md:flex-row md:items-start md:justify-between">
              {/* Left: Company/Personal Info - prevent overflow into table */}
              <div className="flex-1 min-w-0 overflow-hidden">
                {merchant && (
                  <>
                    {(invoice?.invoice_type || merchant.invoiceType) === "business" && merchant.businessLogoUrl ? (
                      <div className="mb-4">
                        <img
                          src={merchant.businessLogoUrl}
                          alt={merchant.businessName || "Business Logo"}
                          className="h-16 w-auto object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null}
                    <p className="text-base sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2 break-words">
                      {(invoice?.invoice_type || merchant.invoiceType) === "business" && merchant.businessName 
                        ? merchant.businessName 
                        : merchant.name}
                    </p>
                    {((invoice?.invoice_type || merchant.invoiceType) === "business" && merchant.businessAddress) ? (
                      <div className="text-sm text-gray-700 space-y-0.5">
                        {merchant.businessAddress && <p>{merchant.businessAddress}</p>}
                        {(merchant.businessCity || merchant.businessState || merchant.businessZip) && (
                          <p>
                            {[merchant.businessCity, merchant.businessState, merchant.businessZip]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                        {merchant.businessPhone && <p>Phone: {merchant.businessPhone}</p>}
                        <p className="text-gray-600">{merchant.email}</p>
                      </div>
                    ) : (
                      merchant.email && String(merchant.name || "").trim() !== String(merchant.email).trim()
                        ? <p className="text-sm text-gray-600">{merchant.email}</p>
                        : null
                    )}
                  </>
                )}
              </div>
              
              {/* Right: INVOICE Title and Details Table - full width on mobile (relative z-10 so it never sits under left overflow) */}
              <div className="relative z-10 w-full min-w-0 flex-shrink-0 md:text-right flex flex-col md:items-end overflow-hidden">
                <h2 className="text-xl sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-4">INVOICE</h2>
                {/* Mobile: stacked labels; Desktop/print: table */}
                <div className="invoice-meta-mobile sm:hidden space-y-2 text-sm text-gray-900">
                  <p><span className="font-semibold text-gray-900">INVOICE #</span> <span className="text-gray-900">{invoice.invoice_number}</span></p>
                  <p><span className="font-semibold text-gray-900">DATE</span> <span className="text-gray-900">{new Date(invoice.created_at).toLocaleDateString()}</span></p>
                </div>
                <div className="invoice-meta-table hidden sm:block overflow-x-auto w-full max-w-full">
                  <table className="border-collapse border border-gray-200 text-sm min-w-[200px]">
                    <thead>
                      <tr>
                        <th className="bg-gray-100 border border-gray-200 px-3 py-2 text-left font-semibold text-gray-900">INVOICE #</th>
                        <th className="bg-gray-100 border border-gray-200 px-3 py-2 text-left font-semibold text-gray-900">DATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-200 px-3 py-2 text-gray-900">{invoice.invoice_number}</td>
                        <td className="border border-gray-200 px-3 py-2 text-gray-900">{new Date(invoice.created_at).toLocaleDateString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <span
                  className={`inline-block mt-2 sm:mt-3 px-2 sm:px-3 py-0.5 sm:py-1 rounded text-xs font-semibold ${getStatusColor(
                    invoice.status
                  )}`}
                >
                  {invoice.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* From (Sender) Section - always show when merchant is available */}
          {merchant && (
            <div className="mb-4 sm:mb-6">
              <div className="bg-gray-100 px-2 sm:px-3 py-1.5 sm:py-2 mb-2 sm:mb-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  FROM
                </p>
              </div>
              <div className="space-y-1 text-sm text-gray-900">
                <p className="font-semibold">
                  {(invoice?.invoice_type || merchant.invoiceType) === "business" && merchant.businessName
                    ? merchant.businessName
                    : merchant.name}
                </p>
                {((invoice?.invoice_type || merchant.invoiceType) === "business" && (merchant.businessAddress || merchant.businessCity || merchant.businessState || merchant.businessZip)) ? (
                  <p className="text-gray-700">
                    {[merchant.businessAddress, [merchant.businessCity, merchant.businessState, merchant.businessZip].filter(Boolean).join(", ")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                {((invoice?.invoice_type || merchant.invoiceType) === "business" && merchant.businessPhone) && (
                  <p className="text-gray-700">Phone: {merchant.businessPhone}</p>
                )}
                <p className="text-gray-600">{merchant.email}</p>
              </div>
            </div>
          )}

          {/* Bill To Section */}
          {(invoice.customer_name || invoice.customer_email || invoice.customer_phone) && (
            <div className="mb-6 pb-4">
              <div className="bg-gray-100 px-2 sm:px-3 py-1.5 sm:py-2 mb-2 sm:mb-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  BILL TO
                </p>
              </div>
              <div className="space-y-1 text-sm text-gray-900">
                {invoice.customer_name && (
                  <p className="font-semibold">{invoice.customer_name}</p>
                )}
                {invoice.customer_email && (
                  <p>{invoice.customer_email}</p>
                )}
                {invoice.customer_phone && (
                  <p>{invoice.customer_phone}</p>
                )}
              </div>
            </div>
          )}

          {/* Line Items Table - scroll horizontally on narrow screens */}
          <div className="mb-3 sm:mb-6 overflow-x-auto -mx-2 sm:mx-0 md:-mx-0">
            <table className="w-full border-collapse border border-gray-200 text-sm min-w-[280px]">
              <thead>
                <tr>
                  <th className="bg-gray-100 border border-gray-200 px-2 py-1.5 sm:px-4 sm:py-3 text-left font-semibold text-gray-900 text-xs sm:text-sm">DESCRIPTION</th>
                  <th className="bg-gray-100 border border-gray-200 px-2 py-1.5 sm:px-4 sm:py-3 text-right font-semibold text-gray-900 text-xs sm:text-sm">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Check if invoice has line items in metadata
                  const lineItems = (invoice as any).metadata?.lineItems || [];
                  
                  if (lineItems.length > 0) {
                    // Display line items
                    return (
                      <>
                        {lineItems.map((item: any, index: number) => (
                          <tr key={index}>
                            <td className="border border-gray-200 px-4 py-3 text-gray-900">
                              <p className="font-semibold">{item.description}</p>
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-right text-gray-900 font-semibold">
                              {invoice.currency === "NGN" 
                                ? `₦${parseFloat(item.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `${parseFloat(item.amount.toString()).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${invoice.currency}`
                              }
                            </td>
                          </tr>
                        ))}
                      </>
                    );
                  } else {
                    // Fallback to single description (backward compatibility)
                    return (
                      <>
                        <tr>
                          <td className="border border-gray-200 px-2 py-1.5 sm:px-4 sm:py-3 text-gray-900">
                            <p className="font-semibold text-xs sm:text-sm">{invoice.description || "Service Payment"}</p>
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 sm:px-4 sm:py-3 text-right text-gray-900 font-semibold text-xs sm:text-sm">
                            {invoice.currency === "NGN" 
                              ? `₦${parseFloat(invoice.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `${parseFloat(invoice.amount.toString()).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${invoice.currency}`
                            }
                          </td>
                        </tr>
                      </>
                    );
                  }
                })()}
                {/* Additional Notes - full-width row (no columns) */}
                {invoice.description && (
                  <tr>
                    <td colSpan={2} className="border border-gray-200 px-4 py-3 text-gray-700 bg-gray-50">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Additional Notes</p>
                      <p className="text-sm italic">{invoice.description}</p>
                    </td>
                  </tr>
                )}
                {/* Total Row - TOTAL in first column, summed amount in second column */}
                <tr>
                  <td className="border border-gray-200 px-4 py-3 font-bold text-gray-900">TOTAL</td>
                  <td className="border border-gray-200 px-4 py-3 text-right font-bold text-lg text-gray-900">
                    {invoice.currency === "NGN" 
                      ? `₦${parseFloat(invoice.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `${parseFloat(invoice.amount.toString()).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${invoice.currency}`
                    }
                  </td>
                </tr>
              </tbody>
            </table>
            {invoice.due_date && (
              <p className="text-xs text-gray-600 mt-1 sm:mt-2">
                Due Date: {new Date(invoice.due_date).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Bank Details - NGN only */}
          {invoice.currency === "NGN" && (() => {
            const bankDetails = (invoice as any).metadata?.bankDetails;
            if (!bankDetails || (!bankDetails.accountName && !bankDetails.accountNumber && !bankDetails.bank)) return null;
            return (
              <div className="mb-3 p-2 sm:mb-6 sm:p-4 bg-gray-50 rounded border border-gray-200 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-gray-900 mb-2 sm:mb-3">Bank Transfer Details</p>
                <div className="space-y-2 text-sm text-gray-900 break-words">
                  {bankDetails.accountName && (
                    <p><span className="font-medium text-gray-700">Account Name:</span> {bankDetails.accountName}</p>
                  )}
                  {bankDetails.accountNumber && (
                    <p><span className="font-medium text-gray-700">Account Number:</span> {bankDetails.accountNumber}</p>
                  )}
                  {bankDetails.bank && (
                    <p><span className="font-medium text-gray-700">Bank:</span> {bankDetails.bank}</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Crypto Payment Instructions - Compact for single page */}
          {invoice.crypto_chain_id && invoice.currency !== "NGN" && invoice.status === "pending" && (() => {
            const effectiveAddress = getEffectiveWalletAddress();
            if (!effectiveAddress || effectiveAddress.trim() === "") return null;
            
            return (
              <div className="mb-3 p-2 sm:mb-6 sm:p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-xs font-semibold text-gray-900 mb-1.5 sm:mb-2">Payment Instructions</p>
                <p className="text-xs text-gray-800 mb-2">
                  Send <span className="font-bold">{parseFloat(invoice.amount.toString()).toLocaleString(undefined, { maximumFractionDigits: 8 })} {invoice.currency}</span> to the wallet address below:
                </p>
                <div className="flex items-start gap-3">
                  {effectiveAddress && (
                    <div className="bg-white p-2 rounded border border-gray-200 flex-shrink-0">
                      <QRCodeSVG
                        value={effectiveAddress}
                        size={100}
                        level="H"
                        includeMargin={true}
                        fgColor="#1a1a1a"
                        bgColor="#ffffff"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 mb-0.5">Wallet Address</p>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-mono text-gray-900 break-all flex-1">{effectiveAddress}</p>
                      <button
                        onClick={() => handleCopyWalletAddress(effectiveAddress)}
                        className="flex-shrink-0 p-1.5 rounded hover:bg-gray-100 transition-colors"
                        title="Copy wallet address"
                      >
                        <span className={`material-icons-outlined text-sm ${
                          copiedAddress ? "text-green-600" : "text-gray-600"
                        }`}>
                          {copiedAddress ? "check" : "content_copy"}
                        </span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-700">Network:</span>
                      {getChainLogo(invoice.crypto_chain_id) && (
                        <img
                          src={getChainLogo(invoice.crypto_chain_id)}
                          alt={invoice.crypto_chain_id}
                          className="w-4 h-4 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <span className="text-xs font-semibold text-gray-700">{invoice.crypto_chain_id.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Footer */}
          <div className="mt-auto pt-3 sm:pt-6 border-t border-gray-200 text-xs text-gray-600">
            <p className="mb-1 sm:mb-2">
              If you have any questions about this invoice, please contact{" "}
              {(invoice?.invoice_type || merchant?.invoiceType) === "business" && merchant?.businessPhone
                ? `${merchant.businessName || merchant.name}, ${merchant.businessPhone}, ${merchant.email}`
                : (merchant?.email && String(merchant?.name || "").trim() === String(merchant?.email || "").trim())
                  ? (merchant?.email || "the sender")
                  : `${merchant?.name || "the sender"}${merchant?.email ? `, ${merchant.email}` : ""}`}
            </p>
            <p className="text-right text-gray-500">
              Invoice Template © {new Date().getFullYear()} FlipPay
            </p>
          </div>

          {/* Action Buttons */}
          {invoice.status === "pending" && (
            <div className="pt-3 sm:pt-6 border-t border-gray-200 dark:border-gray-700 no-print">
              {isOwner ? (
                // Sender/Owner buttons: Send Invoice and Download Invoice
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <button
                    onClick={handleSendInvoice}
                    className="w-full bg-primary text-secondary font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <span className="material-icons-outlined text-lg sm:text-xl">send</span>
                    Send Invoice
                  </button>
                  <button
                    onClick={handleDownloadInvoice}
                    className="w-full bg-gray-700 text-white font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <span className="material-icons-outlined text-lg sm:text-xl">download</span>
                    Download Invoice
                  </button>
                </div>
              ) : (
                // Receiver buttons: I Paid button
                <div className="space-y-2 sm:space-y-3">
                  <button
                    onClick={handleMarkAsPaid}
                    disabled={isMarkingPaid}
                    className="w-full bg-green-500 text-white font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    {isMarkingPaid ? (
                      <>
                        <FSpinner size="sm" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <span className="material-icons-outlined">check_circle</span>
                        I Paid
                      </>
                    )}
                  </button>
                  <p className="text-xs text-center text-gray-600 dark:text-gray-400">
                    Click this button to notify the sender that you have made the payment
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* For owners, also show download button even if paid */}
          {invoice.status === "paid" && isOwner && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700 no-print">
              <button
                onClick={handleDownloadInvoice}
                className="w-full bg-gray-700 text-white font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <span className="material-icons-outlined">download</span>
                Download Invoice
              </button>
            </div>
          )}

          {invoice.status === "paid" && (
            <div className="pt-3 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4 text-center">
                <span className="material-icons-outlined text-green-500 text-3xl sm:text-4xl mb-1 sm:mb-2">
                  check_circle
                </span>
                <p className="text-green-800 dark:text-green-400 font-semibold">
                  This invoice has been paid
                </p>
              </div>
            </div>
          )}

          {invoice.status === "expired" && (
            <div className="pt-3 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4 text-center">
                <span className="material-icons-outlined text-red-500 text-3xl sm:text-4xl mb-1 sm:mb-2">
                  error
                </span>
                <p className="text-red-800 dark:text-red-400 font-semibold">
                  This invoice has expired
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
      </div>
    </>
    </DashboardLayout>
  );
}

export default function InvoiceDetailPage() {
  return (
    <Suspense fallback={
      <PageLoadingSpinner message="Loading..." bgClass="bg-primary" />
    }>
      <InvoiceDetailContent />
    </Suspense>
  );
}
