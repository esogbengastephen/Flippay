"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getUserFromStorage } from "@/lib/session";
import { getBettingNetworkLogo, getTelecomNetworkLogo, getTVNetworkLogo, getGiftCardNetworkLogo } from "@/lib/logos";
import FSpinner from "@/components/FSpinner";

interface GiftCardProduct {
  id: number;
  name: string;
  brandName: string;
  logoUrl?: string;
}

interface UtilityFormProps {
  serviceId: string;
  serviceName: string;
  icon: string;
  networks?: string[];
  placeholder?: string;
  showPackageDropdown?: boolean; // For TV subscriptions
  productMap?: Record<string, GiftCardProduct>; // For gift card products from Reloadly
}

export default function UtilityForm({
  serviceId,
  serviceName,
  icon,
  networks = [],
  placeholder = "Enter phone number",
  showPackageDropdown = false,
  productMap = {},
}: UtilityFormProps) {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState(networks[0] || "");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [packages, setPackages] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [serviceSettings, setServiceSettings] = useState<any>(null);
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState(false);
  const networkDropdownRef = useRef<HTMLDivElement>(null);
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());

  // Close dropdown when clicking outside
  useEffect(() => {
    if (typeof document === "undefined") return;
    
    const handleClickOutside = (event: MouseEvent) => {
      try {
        if (networkDropdownRef.current && !networkDropdownRef.current.contains(event.target as Node)) {
          setIsNetworkDropdownOpen(false);
        }
      } catch (e) {
        console.warn("Error in click outside handler:", e);
      }
    };

    try {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        try {
          if (typeof document !== "undefined") {
            document.removeEventListener("mousedown", handleClickOutside);
          }
        } catch (e) {
          console.warn("Error removing click outside listener:", e);
        }
      };
    } catch (e) {
      console.warn("Error adding click outside listener:", e);
      return () => {}; // Return empty cleanup function
    }
  }, []);

  useEffect(() => {
    fetchServiceSettings();
  }, [serviceId]);

  // Fetch packages when network is selected (for TV, Data, or Betting)
  useEffect(() => {
    if (showPackageDropdown && selectedNetwork && (serviceId === "tv" || serviceId === "data" || serviceId === "betting")) {
      if (serviceId === "tv") {
        fetchTVPackages(selectedNetwork);
      } else if (serviceId === "data") {
        fetchDataPackages(selectedNetwork);
      } else if (serviceId === "betting") {
        fetchBettingPackages(selectedNetwork);
      }
    }
  }, [selectedNetwork, showPackageDropdown, serviceId]);

  // Update amount when package is selected
  useEffect(() => {
    if (selectedPackage && packages.length > 0) {
      const pkg = packages.find(p => p.id === selectedPackage || p.name === selectedPackage);
      if (pkg && pkg.amount) {
        setAmount(pkg.amount.toString());
      }
    }
  }, [selectedPackage, packages]);

  useEffect(() => {
    if (amount && serviceSettings) {
      const amountNum = parseFloat(amount);
      if (!isNaN(amountNum) && amountNum > 0) {
        const markup = serviceSettings.markup || 0;
        const total = amountNum + (amountNum * markup / 100);
        setCalculatedTotal(total);
      } else {
        setCalculatedTotal(0);
      }
    } else {
      setCalculatedTotal(0);
    }
  }, [amount, serviceSettings]);

  const fetchServiceSettings = async () => {
    setLoadingSettings(true);
    setError(null);
    
    try {
      const response = await fetch(getApiUrl(`/api/utility/service/${serviceId}`));
      const data = await response.json();
      
      if (data.success && data.service) {
        setServiceSettings(data.service);
        if (data.service.status !== "active") {
          setError(`${serviceName} service is currently unavailable`);
        }
      } else {
        // Use default settings if API fails
        const defaultSettings: Record<string, any> = {
          airtime: {
            id: "airtime",
            name: "Airtime",
            status: "active",
            markup: 2.5,
            minAmount: 50,
            maxAmount: 10000,
          },
          data: {
            id: "data",
            name: "Data Bundle",
            status: "active",
            markup: 3.0,
            minAmount: 100,
            maxAmount: 50000,
          },
          tv: {
            id: "tv",
            name: "Cable TV Subscription",
            status: "active",
            markup: 2.0,
            minAmount: 1000,
            maxAmount: 50000,
          },
          betting: {
            id: "betting",
            name: "Betting Wallet Funding",
            status: "active",
            markup: 2.5,
            minAmount: 100,
            maxAmount: 100000,
          },
          "gift-card-redeem": {
            id: "gift-card-redeem",
            name: "Gift Card Redeem",
            status: "active",
            markup: 5.0,
            minAmount: 500,
            maxAmount: 50000,
          },
        };
        
        const defaultService = defaultSettings[serviceId] || {
          id: serviceId,
          status: "active",
          markup: 0,
          minAmount: 0,
          maxAmount: 0,
        };
        
        setServiceSettings(defaultService);
      }
    } catch (error) {
      console.error("Error fetching service settings:", error);
      // Use default settings on error
      const defaultSettings: Record<string, any> = {
        airtime: {
          id: "airtime",
          name: "Airtime",
          status: "active",
          markup: 2.5,
          minAmount: 50,
          maxAmount: 10000,
        },
        data: {
          id: "data",
          name: "Data Bundle",
          status: "active",
          markup: 3.0,
          minAmount: 100,
          maxAmount: 50000,
        },
        tv: {
          id: "tv",
          name: "Cable TV Subscription",
          status: "active",
          markup: 2.0,
          minAmount: 1000,
          maxAmount: 50000,
        },
        betting: {
          id: "betting",
          name: "Betting Wallet Funding",
          status: "active",
          markup: 2.5,
          minAmount: 100,
          maxAmount: 100000,
        },
      };
      
      const defaultService = defaultSettings[serviceId] || {
        id: serviceId,
        status: "active",
        markup: 0,
        minAmount: 0,
        maxAmount: 0,
      };
      
      setServiceSettings(defaultService);
    } finally {
      setLoadingSettings(false);
    }
  };

  const validateForm = () => {
    if (!phoneNumber.trim()) {
      if (serviceId === "gift-card-redeem") {
        setError("Please enter a gift card code");
      } else if (serviceId === "electricity") {
        setError("Please enter a meter number");
      } else {
        setError("Please enter a phone number");
      }
      return false;
    }

    // Gift card code validation (different from phone number)
    if (serviceId === "gift-card-redeem") {
      // Basic gift card code validation (alphanumeric, 10-50 characters)
      const codeRegex = /^[A-Za-z0-9]{10,50}$/;
      const cleanedCode = phoneNumber.trim().replace(/\s/g, "");
      if (!codeRegex.test(cleanedCode)) {
        setError("Please enter a valid gift card code (10-50 alphanumeric characters)");
        return false;
      }
      // For gift card redemption, amount is not required (will be determined from code)
      return true;
    } else if (serviceId === "electricity") {
      // Meter number validation (alphanumeric, typically 10-15 characters)
      const meterRegex = /^[A-Za-z0-9]{10,15}$/;
      const cleanedMeter = phoneNumber.trim().replace(/\s/g, "");
      if (!meterRegex.test(cleanedMeter)) {
        setError("Please enter a valid meter number (10-15 alphanumeric characters)");
        return false;
      }
    } else {
      // Basic phone number validation (Nigerian format)
      const phoneRegex = /^(0|\+234)[789][01]\d{8}$/;
      const cleanedPhone = phoneNumber.replace(/\s/g, "");
      if (!phoneRegex.test(cleanedPhone)) {
        setError("Please enter a valid Nigerian phone number");
        return false;
      }
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return false;
    }

    if (serviceSettings) {
      const amountNum = parseFloat(amount);
      if (serviceSettings.minAmount && amountNum < serviceSettings.minAmount) {
        setError(`Minimum amount is ₦${serviceSettings.minAmount.toLocaleString()}`);
        return false;
      }
      if (serviceSettings.maxAmount && amountNum > serviceSettings.maxAmount) {
        setError(`Maximum amount is ₦${serviceSettings.maxAmount.toLocaleString()}`);
        return false;
      }
    }

    if (networks.length > 0 && !selectedNetwork) {
      setError("Please select a network");
      return false;
    }

    if (showPackageDropdown && !selectedPackage && !amount) {
      setError("Please select a package or enter an amount");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    const user = getUserFromStorage();
    if (!user) {
      router.push("/auth");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(getApiUrl("/api/utility/purchase"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceId,
          phoneNumber: phoneNumber.replace(/\s/g, ""),
          network: selectedNetwork || null,
          packageId: selectedPackage || null,
          amount: serviceId === "gift-card-redeem" ? 0 : parseFloat(amount), // Amount will be determined from gift card code
          userId: user.id,
        }),
      });

      // Read response text first (can only be read once)
      const responseText = await response.text();
      
      // Check if response is ok before parsing
      if (!response.ok) {
        let errorMessage = `Server error (${response.status})`;
        try {
          // Try to parse as JSON
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If not JSON, use the text as error message
          errorMessage = responseText || errorMessage;
        }
        setError(errorMessage);
        return;
      }

      // Parse the response as JSON
      const data = JSON.parse(responseText);

      if (data.success) {
        setSuccess(data.message || `${serviceName} purchase successful!`);
        // Reset form
        setPhoneNumber("");
        setAmount("");
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } else {
        setError(data.error || "Purchase failed. Please try again.");
      }
    } catch (error: any) {
      console.error("Error processing purchase:", error);
      // Provide more specific error messages
      if (error.message) {
        setError(error.message);
      } else if (error.name === "TypeError" && error.message?.includes("fetch")) {
        setError("Network error. Server may be down. Please check your connection and try again.");
      } else if (error.name === "SyntaxError") {
        setError("Invalid response from server. Please try again.");
      } else {
        setError(`An error occurred: ${error.message || "Unknown error"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTVPackages = async (network: string) => {
    if (!network) return;
    
    setLoadingPackages(true);
    setSelectedPackage("");
    setAmount("");
    
    try {
      const response = await fetch(getApiUrl(`/api/utility/tv-packages?network=${encodeURIComponent(network)}`));
      const data = await response.json();
      
      if (data.success && data.packages) {
        setPackages(data.packages);
      } else {
        setError("Failed to load TV packages. Please try again.");
        setPackages([]);
      }
    } catch (error) {
      console.error("Error fetching TV packages:", error);
      setError("Failed to load TV packages. Please try again.");
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const fetchDataPackages = async (network: string) => {
    if (!network) return;
    
    setLoadingPackages(true);
    setSelectedPackage("");
    setAmount("");
    
    try {
      const response = await fetch(getApiUrl(`/api/utility/data-packages?network=${encodeURIComponent(network)}`));
      const data = await response.json();
      
      if (data.success && data.packages) {
        setPackages(data.packages);
      } else {
        setError("Failed to load data packages. Please try again.");
        setPackages([]);
      }
    } catch (error) {
      console.error("Error fetching data packages:", error);
      setError("Failed to load data packages. Please try again.");
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const fetchBettingPackages = async (network: string) => {
    if (!network) return;
    
    setLoadingPackages(true);
    setSelectedPackage("");
    setAmount("");
    
    try {
      const response = await fetch(getApiUrl(`/api/utility/betting-packages?network=${encodeURIComponent(network)}`));
      const data = await response.json();
      
      if (data.success && data.packages) {
        setPackages(data.packages);
      } else {
        setError("Failed to load betting packages. Please try again.");
        setPackages([]);
      }
    } catch (error) {
      console.error("Error fetching betting packages:", error);
      setError("Failed to load betting packages. Please try again.");
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "");
    
    // Format as Nigerian number
    if (digits.startsWith("234")) {
      return `+${digits}`;
    } else if (digits.startsWith("0")) {
      return digits;
    } else if (digits.length > 0) {
      return `0${digits}`;
    }
    return digits;
  };

  // Function to detect network from phone number
  const detectNetwork = (phone: string): string | null => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, "");
    
    // Extract the first 4 digits (or first 5 for some special cases)
    let prefix = "";
    if (digits.startsWith("234")) {
      // International format: +2348012345678 -> extract 8012
      prefix = digits.substring(3, 7);
    } else if (digits.startsWith("0")) {
      // Local format: 08012345678 -> extract 0801
      prefix = digits.substring(0, 4);
    } else if (digits.length >= 4) {
      // No leading 0: 8012345678 -> extract 8012
      prefix = digits.substring(0, 4);
    }
    
    // Network prefix mapping (Nigerian networks)
    const networkPrefixes: Record<string, string[]> = {
      MTN: [
        "0803", "0806", "0703", "0706", "0813", "0816", "0810", "0814",
        "0903", "0906", "0913", "0916", "07025", "07026", "0704"
      ],
      Airtel: [
        "0802", "0808", "0708", "0812", "0901", "0902", "0904", "0907", "0912"
      ],
      Glo: [
        "0805", "0807", "0705", "0815", "0811", "0905", "0915"
      ],
      "9mobile": [
        "0809", "0817", "0818", "0908", "0909"
      ],
    };
    
    // Check for 5-digit prefix first (MTN special cases)
    if (digits.length >= 5) {
      const fiveDigitPrefix = digits.startsWith("234") 
        ? digits.substring(3, 8) 
        : digits.substring(0, 5);
      
      if (networkPrefixes.MTN.includes(fiveDigitPrefix)) {
        return "MTN";
      }
    }
    
    // Check 4-digit prefix
    for (const [network, prefixes] of Object.entries(networkPrefixes)) {
      if (prefixes.includes(prefix)) {
        return network;
      }
    }
    
    return null;
  };

  // Auto-detect network when phone number changes
  useEffect(() => {
    if (phoneNumber && networks.length > 0) {
      const detectedNetwork = detectNetwork(phoneNumber);
      if (detectedNetwork && networks.includes(detectedNetwork)) {
        // Only auto-select if network is available for this service and different from current selection
        setSelectedNetwork((prev) => {
          if (prev !== detectedNetwork) {
            return detectedNetwork;
          }
          return prev;
        });
      }
    }
  }, [phoneNumber, networks]);

  if (loadingSettings || !serviceSettings) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
        <div className="text-center">
          <FSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-accent/70">Loading service...</p>
        </div>
      </div>
    );
  }

  if (serviceSettings.status !== "active") {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface/60 backdrop-blur-[24px] p-8 rounded-2xl border border-secondary/10 text-center">
          <span className="material-icons-outlined text-6xl text-red-400 mb-4">error_outline</span>
          <h2 className="text-xl font-bold text-white mb-2">Service Unavailable</h2>
          <p className="text-accent/70">
            {serviceName} is currently disabled. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  const subtitle =
    serviceId === "gift-card-redeem"
      ? "Enter your gift card code to redeem its value"
      : serviceId === "electricity"
      ? "Pay your electricity bills quickly and securely"
      : "Quick and secure transactions";

  return (
    <div className="min-h-screen bg-background-dark relative flex flex-col items-center p-4 pb-24 lg:pb-8">
      {/* Background blur orbs - Flippay branding */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary rounded-full blur-[160px] opacity-[0.05]" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[500px] h-[500px] bg-primary rounded-full blur-[120px] opacity-30" />
      </div>

      <div className="w-full max-w-lg mt-8 lg:mt-16 relative">
        {/* Header - match offramp */}
        <div className="text-center mb-10 relative">
          <button
            onClick={() => router.back()}
            className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-xl transition-colors text-accent/60 hover:text-secondary"
          >
            <span className="material-icons-outlined">arrow_back</span>
          </button>
          <h1 className="text-3xl font-bold mb-2 tracking-tight text-white font-display">{serviceName}</h1>
          <p className="text-accent/70">{subtitle}</p>
        </div>

        {/* Form Card - glass style like offramp */}
        <div className="bg-surface/60 backdrop-blur-[24px] rounded-[2.5rem] p-6 sm:p-8 border border-secondary/10 shadow-2xl relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Network Selection */}
            {networks.length > 0 && (
              <div ref={networkDropdownRef} className="relative">
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                  Select Network
                  {phoneNumber && detectNetwork(phoneNumber) && (
                    <span className="ml-2 text-secondary font-normal normal-case">
                      (Auto-detected: {detectNetwork(phoneNumber)})
                    </span>
                  )}
                </label>
                {(serviceId === "betting" || serviceId === "airtime" || serviceId === "data" || serviceId === "tv" || serviceId === "gift-card-redeem") ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsNetworkDropdownOpen(!isNetworkDropdownOpen)}
                      className={`w-full rounded-3xl border px-5 py-4 flex items-center justify-between transition-all ${
                        phoneNumber && detectNetwork(phoneNumber) && selectedNetwork === detectNetwork(phoneNumber)
                          ? "bg-primary/60 border-secondary/30"
                          : "bg-primary/40 border-accent/10 hover:border-secondary/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {selectedNetwork && (
                          <div className="relative w-6 h-6">
                            {(() => {
                              let logoUrl = "";
                              if (serviceId === "betting") {
                                logoUrl = getBettingNetworkLogo(selectedNetwork);
                              } else if (serviceId === "airtime" || serviceId === "data") {
                                logoUrl = getTelecomNetworkLogo(selectedNetwork);
                              } else if (serviceId === "tv") {
                                logoUrl = getTVNetworkLogo(selectedNetwork);
                              } else if (serviceId === "gift-card-redeem") {
                                // Use Reloadly product logo if available, otherwise fallback to local logo
                                const product = productMap[selectedNetwork];
                                logoUrl = product?.logoUrl || getGiftCardNetworkLogo(selectedNetwork);
                              }
                              
                              const logoKey = `${serviceId}-${selectedNetwork}`;
                              const hasFailed = failedLogos.has(logoKey);
                              
                              return (
                                <>
                                  {logoUrl && !hasFailed ? (
                                    // Show actual logo if available
                                    <Image
                                      src={logoUrl}
                                      alt={selectedNetwork}
                                      width={24}
                                      height={24}
                                      className="rounded object-contain"
                                      unoptimized
                                      onError={() => {
                                        setFailedLogos(prev => new Set(prev).add(logoKey));
                                      }}
                                    />
                                  ) : (
                                    // Fallback - show letter only if logo failed or unavailable
                                    <div className="w-6 h-6 rounded bg-primary/60 flex items-center justify-center">
                                      <span className="text-xs text-white font-bold">{selectedNetwork.charAt(0)}</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        <span className="font-medium text-white">{selectedNetwork || "Select a network"}</span>
                      </div>
                      <span className="material-icons-outlined text-accent/60">
                        {isNetworkDropdownOpen ? "expand_less" : "expand_more"}
                      </span>
                    </button>

                    {isNetworkDropdownOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/20 shadow-xl max-h-64 overflow-y-auto">
                        {networks.map((network) => (
                          <button
                            key={network}
                            type="button"
                            onClick={() => {
                              setSelectedNetwork(network);
                              setIsNetworkDropdownOpen(false);
                            }}
                            className={`w-full p-4 flex items-center gap-3 transition-colors text-left ${
                              selectedNetwork === network
                                ? "bg-secondary/10 text-secondary"
                                : "text-white hover:bg-primary/50"
                            }`}
                          >
                            <div className="relative w-6 h-6">
                              {(() => {
                                let logoUrl = "";
                                // Note: This block only renders when serviceId is NOT "electricity" (see line 617 condition)
                                if (serviceId === "betting") {
                                  logoUrl = getBettingNetworkLogo(network);
                                } else if (serviceId === "airtime" || serviceId === "data") {
                                  logoUrl = getTelecomNetworkLogo(network);
                                } else if (serviceId === "tv") {
                                  logoUrl = getTVNetworkLogo(network);
                                } else if (serviceId === "gift-card-redeem") {
                                  // Use Reloadly product logo if available, otherwise fallback to local logo
                                  const product = productMap[network];
                                  logoUrl = product?.logoUrl || getGiftCardNetworkLogo(network);
                                }
                                
                                const logoKey = `${serviceId}-${network}`;
                                const hasFailed = failedLogos.has(logoKey);
                                
                                return (
                                  <>
                                    {logoUrl && !hasFailed ? (
                                      // Show actual logo if available
                                      <Image
                                        src={logoUrl}
                                        alt={network}
                                        width={24}
                                        height={24}
                                        className="rounded object-contain"
                                        unoptimized
                                        onError={() => {
                                          setFailedLogos(prev => new Set(prev).add(logoKey));
                                        }}
                                      />
                                    ) : (
                                      // Fallback - show letter only if logo failed or unavailable
                                      <div className="w-6 h-6 rounded bg-primary/60 flex items-center justify-center">
                                        <span className="text-xs text-white font-bold">{network.charAt(0)}</span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            <span className="font-medium">{network}</span>
                            {selectedNetwork === network && (
                              <span className="material-icons-outlined text-secondary ml-auto text-sm">
                                check
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <select
                    value={selectedNetwork}
                    onChange={(e) => setSelectedNetwork(e.target.value)}
                    className={`w-full rounded-3xl border px-5 py-4 bg-primary/40 text-white placeholder-white/30 focus:border-secondary/30 focus:ring-0 outline-none ${
                      phoneNumber && detectNetwork(phoneNumber) && selectedNetwork === detectNetwork(phoneNumber)
                        ? "border-secondary/30"
                        : "border-accent/10"
                    }`}
                    required
                  >
                    <option value="">Select a network</option>
                    {networks.map((network) => (
                      <option key={network} value={network} className="bg-primary text-white">
                        {network}
                      </option>
                    ))}
                  </select>
                )}
                {phoneNumber && detectNetwork(phoneNumber) && selectedNetwork === detectNetwork(phoneNumber) && (
                  <p className="text-xs text-secondary mt-1 flex items-center gap-1">
                    <span className="material-icons-outlined text-sm">check_circle</span>
                    Network automatically detected
                  </p>
                )}
              </div>
            )}

            {/* Package Selection */}
            {showPackageDropdown && selectedNetwork && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                  Select Package
                </label>
                {loadingPackages ? (
                  <div className="w-full rounded-3xl border border-accent/10 bg-primary/40 px-5 py-4 flex items-center gap-2">
                    <FSpinner size="xs" />
                    <span className="text-sm text-accent/70">Loading packages...</span>
                  </div>
                ) : (
                  <select
                    value={selectedPackage}
                    onChange={(e) => setSelectedPackage(e.target.value)}
                    className="w-full rounded-3xl border border-accent/10 bg-primary/40 text-white px-5 py-4 focus:border-secondary/30 focus:ring-0 outline-none"
                    required
                  >
                    <option value="" className="bg-primary text-white">Select a package</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id || pkg.name} value={pkg.id || pkg.name} className="bg-primary text-white">
                        {pkg.name} {pkg.amount ? `- ₦${pkg.amount.toLocaleString()}` : ""} {pkg.data ? `(${pkg.data})` : ""} {pkg.validity ? `- ${pkg.validity}` : ""}
                      </option>
                    ))}
                  </select>
                )}
                {packages.length === 0 && !loadingPackages && selectedNetwork && (
                  <p className="text-xs text-accent/50 mt-1">
                    No packages available for {selectedNetwork}
                  </p>
                )}
              </div>
            )}

            {/* Phone Number / Gift Card Code */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                {placeholder}
              </label>
              <div className="flex items-center gap-3 p-5 rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 focus-within:bg-primary/60 transition-all">
                <span className="material-icons-outlined text-accent/40">
                  {serviceId === "gift-card-redeem" ? "card_giftcard" : serviceId === "electricity" ? "bolt" : "phone"}
                </span>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => {
                    if (serviceId === "gift-card-redeem" || serviceId === "electricity") {
                      setPhoneNumber(e.target.value);
                    } else {
                      setPhoneNumber(formatPhoneNumber(e.target.value));
                    }
                  }}
                  placeholder={
                    serviceId === "gift-card-redeem"
                      ? "Enter gift card code"
                      : serviceId === "electricity"
                      ? "Enter meter number"
                      : placeholder || "08012345678 or +2348012345678"
                  }
                  maxLength={serviceId === "gift-card-redeem" ? 50 : serviceId === "electricity" ? 15 : 14}
                  className="flex-1 bg-transparent border-none p-0 text-white placeholder-white/30 focus:ring-0 outline-none"
                  required
                />
              </div>
            </div>

            {/* Amount */}
            {serviceId !== "gift-card-redeem" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                  Amount (₦)
                </label>
                <div className="flex items-center gap-3 p-5 rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 focus-within:bg-primary/60 transition-all">
                  <span className="material-icons-outlined text-accent/40">payments</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={showPackageDropdown ? "Select a package or enter amount" : "Enter amount"}
                    min={serviceSettings.minAmount || 1}
                    max={serviceSettings.maxAmount || 1000000}
                    step="1"
                    className="flex-1 bg-transparent border-none p-0 text-white placeholder-white/30 focus:ring-0 outline-none"
                    required={!showPackageDropdown || !selectedPackage}
                    disabled={showPackageDropdown && selectedPackage ? true : false}
                  />
                </div>
                {serviceSettings.minAmount && serviceSettings.maxAmount && (
                  <p className="text-xs text-accent/50 mt-1">
                    Min: ₦{serviceSettings.minAmount.toLocaleString()} - Max: ₦{serviceSettings.maxAmount.toLocaleString()}
                  </p>
                )}
              </div>
            )}
            
            {/* Gift Card Info Message */}
            {serviceId === "gift-card-redeem" && (
              <div className="p-4 rounded-2xl bg-secondary/10 border border-secondary/20">
                <p className="text-sm text-accent/90 flex items-start gap-2">
                  <span className="material-icons-outlined text-secondary text-lg">info</span>
                  <span>
                    <strong className="text-white">Redeem your existing gift card:</strong> Enter the gift card code you already have.
                    The value will be automatically detected from the code and credited to your account.
                  </span>
                </p>
              </div>
            )}

            {/* Price Breakdown */}
            {calculatedTotal > 0 && (
              <div className="p-5 rounded-2xl bg-primary/40 border border-accent/10 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-accent/70">Amount:</span>
                  <span className="text-white font-medium">₦{parseFloat(amount).toLocaleString()}</span>
                </div>
                {serviceSettings.markup > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-accent/70">Service Fee ({serviceSettings.markup}%):</span>
                    <span className="text-white font-medium">
                      ₦{((parseFloat(amount) * serviceSettings.markup) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-accent/10">
                  <span className="text-white font-bold">Total:</span>
                  <span className="text-secondary font-bold text-lg">
                    ₦{calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/30">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-4 rounded-2xl bg-secondary/10 border border-secondary/20">
                <p className="text-sm text-secondary">{success}</p>
              </div>
            )}

            {/* Submit Button - match offramp */}
            <button
              type="submit"
              disabled={loading || !phoneNumber || (serviceId !== "gift-card-redeem" && (!amount || calculatedTotal === 0))}
              className="w-full bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(19,236,90,0.2)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <FSpinner size="sm" />
                  Processing...
                </>
              ) : (
                <>
                  <span className="material-icons-outlined font-bold">{icon}</span>
                  {serviceId === "gift-card-redeem" ? "Redeem Gift Card" : `Purchase ${serviceName}`}
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-accent/40 text-xs mt-10">
          Powered by Flippay • Quick and secure transactions
        </p>
      </div>
    </div>
  );
}

