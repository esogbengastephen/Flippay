"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Cropper from "react-easy-crop";
import { getUserFromStorage } from "@/lib/session";
import DashboardLayout from "@/components/DashboardLayout";
import FSpinner from "@/components/FSpinner";
import PageLoadingSpinner from "@/components/PageLoadingSpinner";
import imageCompression from "browser-image-compression";

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  
  // Business invoice settings
  const [invoiceType, setInvoiceType] = useState<"personal" | "business">("personal");
  const [businessName, setBusinessName] = useState("");
  const [businessLogoUrl, setBusinessLogoUrl] = useState<string | null>(null);
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [businessState, setBusinessState] = useState("");
  const [businessZip, setBusinessZip] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const businessLogoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBusinessLogo, setUploadingBusinessLogo] = useState(false);
  const [showBusinessLogoCrop, setShowBusinessLogoCrop] = useState(false);
  const [businessImageSrc, setBusinessImageSrc] = useState<string>("");
  
  // Cropping state
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  useEffect(() => {
    const currentUser = getUserFromStorage();
    if (!currentUser) {
      router.push("/auth");
      return;
    }
    setUser(currentUser);
  }, [router]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(getApiUrl(`/api/user/profile?userId=${user.id}`));
      const data = await response.json();
      
      if (data.success && data.profile) {
        setDisplayName(data.profile.displayName || "");
        setPhotoUrl(data.profile.photoUrl || null);
        setInvoiceType(data.profile.invoiceType || "personal");
        setBusinessName(data.profile.businessName || "");
        setBusinessLogoUrl(data.profile.businessLogoUrl || null);
        setBusinessAddress(data.profile.businessAddress || "");
        setBusinessCity(data.profile.businessCity || "");
        setBusinessState(data.profile.businessState || "");
        setBusinessZip(data.profile.businessZip || "");
        setBusinessPhone(data.profile.businessPhone || "");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id]);

  // Create cropped image
  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new window.Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    // Set canvas size to match cropped area
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Draw the cropped image
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    // Convert to blob (0.85 = good quality, smaller file for faster compression/upload)
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas is empty"));
            return;
          }
          const url = URL.createObjectURL(blob);
          resolve(url);
        },
        "image/jpeg",
        0.85
      );
    });
  };

  const onCropComplete = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleCropAndUpload = async () => {
    if (!croppedAreaPixels || !imageSrc) return;

    setUploading(true);
    setError("");

    try {
      // Get cropped image
      const croppedImageUrl = await getCroppedImg(imageSrc, croppedAreaPixels);

      // Convert blob URL to File
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      const file = new File([blob], "profile.jpg", { type: "image/jpeg" });

      // Compress for fast upload (smaller = faster processing and upload)
      const options = {
        maxSizeMB: 0.2, // 200KB max for quick upload
        maxWidthOrHeight: 400, // Profile avatar size
        useWebWorker: true,
        fileType: "image/jpeg" as const,
        initialQuality: 0.8,
      };

      const compressedFile = await imageCompression(file, options);

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        // Upload to API
        const uploadResponse = await fetch(getApiUrl("/api/user/upload-photo"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            image: base64String,
            filename: "profile.jpg",
          }),
        });

        const uploadData = await uploadResponse.json();

        if (uploadData.success && uploadData.photoUrl) {
          setPhotoUrl(uploadData.photoUrl);
          setSuccess("Profile picture updated successfully!");
          setTimeout(() => setSuccess(""), 3000);
          setShowCropModal(false);
          setImageSrc("");
          URL.revokeObjectURL(croppedImageUrl);
        } else {
          setError(uploadData.error || "Failed to upload image");
        }
      };
      reader.readAsDataURL(compressedFile);
    } catch (error: any) {
      console.error("Error processing image:", error);
      setError(error.message || "Failed to process image");
    } finally {
      setUploading(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type — accept any image format
    if (!file.type.toLowerCase().startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be less than 10MB");
      return;
    }

    setError("");
    setSuccess("");

    // Read file and show crop modal
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageSrc(reader.result as string);
      setShowCropModal(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const handleBusinessLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.toLowerCase().startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be less than 10MB");
      return;
    }

    setError("");
    setSuccess("");

    const reader = new FileReader();
    reader.onloadend = () => {
      setBusinessImageSrc(reader.result as string);
      setShowBusinessLogoCrop(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const handleBusinessLogoCropAndUpload = async () => {
    if (!croppedAreaPixels || !businessImageSrc || !user?.id) return;

    setUploadingBusinessLogo(true);
    setError("");
    setSuccess("");

    try {
      // Get cropped image
      const croppedImageUrl = await getCroppedImg(businessImageSrc, croppedAreaPixels);

      // Convert blob URL to File
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      const file = new File([blob], "business-logo.jpg", { type: "image/jpeg" });

      // Compress for fast upload
      const options = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 512,
        useWebWorker: true,
        fileType: "image/jpeg" as const,
        initialQuality: 0.8,
      };

      const compressedFile = await imageCompression(file, options);

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        const uploadResponse = await fetch(getApiUrl("/api/user/upload-photo"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            image: base64String,
            type: "business",
          }),
        });

        const uploadData = await uploadResponse.json();

        if (uploadData.success && uploadData.photoUrl) {
          setBusinessLogoUrl(uploadData.photoUrl);
          setShowBusinessLogoCrop(false);
          setBusinessImageSrc("");
          setSuccess("Business logo uploaded successfully!");
        } else {
          setError(uploadData.error || "Failed to upload business logo");
        }
        setUploadingBusinessLogo(false);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error: any) {
      console.error("Error uploading business logo:", error);
      setError(error.message || "Failed to upload business logo");
      setUploadingBusinessLogo(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(getApiUrl("/api/user/profile"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          display_name: displayName.trim() || null,
          photo_url: photoUrl,
          invoice_type: invoiceType,
          business_name: invoiceType === "business" ? businessName.trim() || null : null,
          business_logo_url: invoiceType === "business" ? businessLogoUrl : null,
          business_address: invoiceType === "business" ? businessAddress.trim() || null : null,
          business_city: invoiceType === "business" ? businessCity.trim() || null : null,
          business_state: invoiceType === "business" ? businessState.trim() || null : null,
          business_zip: invoiceType === "business" ? businessZip.trim() || null : null,
          business_phone: invoiceType === "business" ? businessPhone.trim() || null : null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Profile updated successfully!");
        setTimeout(() => {
          router.push("/");
        }, 1500);
      } else {
        setError(data.error || "Failed to update profile");
      }
    } catch (error: any) {
      setError(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoadingSpinner message="Loading..." bgClass="bg-background-dark" />;
  }

  const inputClass =
    "w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base rounded-xl bg-primary/40 border border-accent/10 text-white placeholder-white/30 focus:border-secondary/30 focus:ring-0 outline-none";

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background-dark">
        <div className="max-w-lg mx-auto px-3 sm:px-4 pt-2 sm:pt-4 pb-24 sm:py-8">
          {/* Header */}
          <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-4">
            <button
              onClick={() => router.back()}
              className="hidden lg:flex p-1.5 rounded-lg hover:bg-white/5 transition text-accent/60 hover:text-secondary"
            >
              <span className="material-icons-outlined text-lg">arrow_back</span>
            </button>
            <h1 className="text-lg sm:text-2xl font-bold text-white font-display">Edit Profile</h1>
          </div>

        {/* Main Card - match Receive/Settings form style */}
        <div className="bg-surface/60 backdrop-blur-[24px] rounded-2xl sm:rounded-[2.5rem] p-3 sm:p-6 border border-secondary/10 shadow-xl">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-2 sm:mb-4 p-2.5 sm:p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
              <p className="text-xs sm:text-sm text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-2 sm:mb-4 p-2.5 sm:p-4 bg-secondary/20 border border-secondary/30 rounded-xl">
              <p className="text-xs sm:text-sm text-secondary">{success}</p>
            </div>
          )}

          {/* Profile Picture Section */}
          <div className="mb-3 sm:mb-5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1.5 sm:mb-2">
              Profile Picture
            </label>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="relative shrink-0">
                {photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt={displayName || "Profile"}
                    width={64}
                    height={64}
                    className="rounded-full border-2 border-accent/20 object-cover w-14 h-14 sm:w-24 sm:h-24"
                    unoptimized
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-24 sm:h-24 rounded-full bg-primary/40 border-2 border-accent/10 flex items-center justify-center">
                    <span className="material-icons-outlined text-accent/40 text-2xl sm:text-4xl">face</span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-secondary/50 rounded-full flex items-center justify-center">
                    <FSpinner size="sm" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 sm:gap-2 min-w-0">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-secondary hover:bg-secondary/90 text-primary font-semibold py-2 px-3 sm:py-2.5 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? "Uploading..." : "Change Photo"}
                </button>
                {photoUrl && (
                  <button
                    onClick={() => {
                      setPhotoUrl(null);
                      setSuccess("Profile picture removed");
                      setTimeout(() => setSuccess(""), 3000);
                    }}
                    className="text-xs sm:text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                aria-label="Upload profile picture"
              />
            </div>
            <p className="text-[10px] sm:text-xs text-accent/60 mt-1 sm:mt-2">
              PNG, JPG, or JPEG. Max size 10MB. Image will be optimized automatically.
            </p>
          </div>

          {/* Display Name Section */}
          <div className="mb-3 sm:mb-5">
            <label htmlFor="profile-display-name" className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1 sm:mb-2">
              Display Name
            </label>
            <input
              id="profile-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              maxLength={50}
              className={inputClass}
            />
            <p className="text-[10px] sm:text-xs text-accent/60 mt-0.5 sm:mt-1">
              {displayName.length}/50 characters
            </p>
          </div>

          {/* Email (Read-only) */}
          <div className="mb-3 sm:mb-5">
            <label htmlFor="profile-email" className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1 sm:mb-2">
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              value={user?.email || ""}
              disabled
              className={`${inputClass} bg-primary/30 text-accent/80 cursor-not-allowed`}
            />
            <p className="text-[10px] sm:text-xs text-accent/60 mt-0.5 sm:mt-1">
              Email cannot be changed
            </p>
          </div>

          {/* Invoice Settings Divider */}
          <div className="my-2 sm:my-5 border-t border-accent/10" />

          {/* Invoice Type Selection */}
          <div className="mb-3 sm:mb-5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1.5 sm:mb-2">
              Invoice Type
            </label>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setInvoiceType("personal")}
                className={`py-2.5 px-3 sm:py-3 sm:px-4 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition-all border ${
                  invoiceType === "personal"
                    ? "bg-secondary text-primary border-secondary/40 shadow-lg shadow-secondary/10"
                    : "bg-primary/40 border-accent/10 hover:border-secondary/20 text-accent"
                }`}
              >
                Personal
              </button>
              <button
                type="button"
                onClick={() => setInvoiceType("business")}
                className={`py-2.5 px-3 sm:py-3 sm:px-4 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition-all border ${
                  invoiceType === "business"
                    ? "bg-secondary text-primary border-secondary/40 shadow-lg shadow-secondary/10"
                    : "bg-primary/40 border-accent/10 hover:border-secondary/20 text-accent"
                }`}
              >
                Business
              </button>
            </div>
            <p className="text-[10px] sm:text-xs text-accent/60 mt-1 sm:mt-2">
              {invoiceType === "personal"
                ? "Invoices will show your personal name and email"
                : "Invoices will show your business information and logo"}
            </p>
          </div>

          {/* Business Settings (only shown if business is selected) */}
          {invoiceType === "business" && (
            <div className="space-y-3 sm:space-y-5 mb-3 sm:mb-5 p-3 sm:p-5 bg-primary/40 rounded-xl border border-accent/10">
              <h3 className="text-sm sm:text-lg font-bold text-white">Business Information</h3>

              {/* Business Logo */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1.5 sm:mb-2">
                  Business Logo
                </label>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <div className="relative shrink-0">
                    {businessLogoUrl ? (
                      <img
                        src={businessLogoUrl}
                        alt="Business Logo"
                        className="w-14 h-14 sm:w-24 sm:h-24 rounded-lg border-2 border-accent/10 object-contain bg-primary/40 p-1.5 sm:p-2"
                      />
                    ) : (
                      <div className="w-14 h-14 sm:w-24 sm:h-24 rounded-lg bg-primary/40 border-2 border-accent/10 flex items-center justify-center">
                        <span className="material-icons-outlined text-accent/40 text-2xl sm:text-4xl">image</span>
                      </div>
                    )}
                    {uploadingBusinessLogo && (
                      <div className="absolute inset-0 bg-secondary/50 rounded-lg flex items-center justify-center">
                        <FSpinner size="sm" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <button
                      onClick={() => businessLogoInputRef.current?.click()}
                      disabled={uploadingBusinessLogo}
                      className="bg-secondary hover:bg-secondary/90 text-primary font-semibold py-2 px-3 sm:py-2.5 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingBusinessLogo ? "Uploading..." : "Upload Logo"}
                    </button>
                    {businessLogoUrl && (
                      <button
                        onClick={() => {
                          setBusinessLogoUrl(null);
                          setSuccess("Business logo removed");
                          setTimeout(() => setSuccess(""), 3000);
                        }}
                        className="text-xs sm:text-sm text-red-400 hover:text-red-300 transition-colors"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                  <input
                    ref={businessLogoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBusinessLogoSelect}
                    className="hidden"
                    aria-label="Upload business logo"
                  />
                </div>
                <p className="text-[10px] sm:text-xs text-accent/60 mt-1 sm:mt-2">
                  PNG, JPG, or JPEG. Max size 10MB. Recommended: Square logo, transparent background.
                </p>
              </div>

              {/* Business Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1 sm:mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Enter business/company name"
                  maxLength={100}
                  className={inputClass}
                />
              </div>

              {/* Business Address */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1.5 sm:mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="Enter street address"
                  className={inputClass}
                />
              </div>

              {/* City, State, ZIP Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1.5 sm:mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={businessCity}
                    onChange={(e) => setBusinessCity(e.target.value)}
                    placeholder="City"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1.5 sm:mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    value={businessState}
                    onChange={(e) => setBusinessState(e.target.value)}
                    placeholder="State"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1.5 sm:mb-2">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={businessZip}
                    onChange={(e) => setBusinessZip(e.target.value)}
                    placeholder="ZIP"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Business Phone */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1.5 sm:mb-2">
                  Business Phone
                </label>
                <input
                  type="tel"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  placeholder="(000) 000-0000"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Save / Cancel */}
          <div className="flex flex-col-reverse sm:flex-row gap-1.5 sm:gap-4">
            <button
              onClick={() => router.back()}
              className="w-full sm:w-auto bg-primary/40 border border-accent/10 hover:border-secondary/20 text-accent font-semibold py-2.5 px-4 sm:py-3 sm:px-6 rounded-lg sm:rounded-xl text-sm sm:text-base transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 w-full bg-secondary hover:bg-secondary/90 text-primary font-semibold py-2.5 px-4 sm:py-3 sm:px-6 rounded-lg sm:rounded-xl text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2 shadow-[0_10px_30px_rgba(19,236,90,0.2)]"
            >
              {saving ? (
                <>
                  <FSpinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span className="material-icons-outlined text-base sm:text-xl">save</span>
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Business Logo Crop Modal - match page form style */}
      {showBusinessLogoCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-surface/60 backdrop-blur-[24px] rounded-2xl sm:rounded-[2.5rem] p-3 sm:p-6 border border-secondary/10 shadow-xl w-full max-w-lg">
            <h2 className="text-base sm:text-xl font-bold text-white mb-2 sm:mb-4">Crop Your Business Logo</h2>

            <div className="relative w-full h-52 sm:h-80 bg-primary/40 rounded-lg sm:rounded-xl overflow-hidden mb-2 sm:mb-4">
              <Cropper
                image={businessImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="rect"
                showGrid={false}
              />
            </div>

            <div className="mb-2 sm:mb-4">
              <label htmlFor="crop-zoom-business" className="block text-[10px] sm:text-xs font-semibold text-accent/60 mb-1">
                Zoom: {Math.round(zoom * 100)}%
              </label>
              <input
                id="crop-zoom-business"
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1.5 sm:h-2 bg-primary/60 rounded-lg appearance-none cursor-pointer accent-secondary"
                aria-label="Crop zoom level"
              />
            </div>

            <div className="flex gap-1.5 sm:gap-4">
              <button
                onClick={() => {
                  setShowBusinessLogoCrop(false);
                  setBusinessImageSrc("");
                  if (businessLogoInputRef.current) {
                    businessLogoInputRef.current.value = "";
                  }
                }}
                className="flex-1 bg-primary/40 border border-accent/10 hover:border-secondary/20 text-accent font-semibold py-2.5 px-3 sm:py-3 sm:px-6 rounded-lg sm:rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBusinessLogoCropAndUpload}
                disabled={uploadingBusinessLogo}
                className="flex-1 bg-secondary hover:bg-secondary/90 text-primary font-semibold py-2.5 px-3 sm:py-3 sm:px-6 rounded-lg sm:rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2"
              >
                {uploadingBusinessLogo ? (
                  <>
                    <FSpinner size="sm" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined text-base sm:text-lg">check</span>
                    <span>Save Logo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crop Modal - match page form style */}
      {showCropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-surface/60 backdrop-blur-[24px] rounded-2xl sm:rounded-[2.5rem] p-3 sm:p-6 border border-secondary/10 shadow-xl w-full max-w-lg">
            <h2 className="text-base sm:text-xl font-bold text-white mb-2 sm:mb-4">Crop Your Profile Picture</h2>

            <div className="relative w-full h-52 sm:h-80 bg-primary/40 rounded-lg sm:rounded-xl overflow-hidden mb-2 sm:mb-4">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="round"
                showGrid={false}
              />
            </div>

            <div className="mb-2 sm:mb-4">
              <label htmlFor="crop-zoom-profile" className="block text-[10px] sm:text-xs font-semibold text-accent/60 mb-1">
                Zoom: {Math.round(zoom * 100)}%
              </label>
              <input
                id="crop-zoom-profile"
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1.5 sm:h-2 bg-primary/60 rounded-lg appearance-none cursor-pointer accent-secondary"
                aria-label="Crop zoom level"
              />
            </div>

            <div className="flex gap-1.5 sm:gap-4">
              <button
                onClick={() => {
                  setShowCropModal(false);
                  setImageSrc("");
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="flex-1 bg-primary/40 border border-accent/10 hover:border-secondary/20 text-accent font-semibold py-2.5 px-3 sm:py-3 sm:px-6 rounded-lg sm:rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCropAndUpload}
                disabled={uploading}
                className="flex-1 bg-secondary hover:bg-secondary/90 text-primary font-semibold py-2.5 px-3 sm:py-3 sm:px-6 rounded-lg sm:rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2"
              >
                {uploading ? (
                  <>
                    <FSpinner size="sm" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined text-base sm:text-lg">check</span>
                    <span>Apply & Upload</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
