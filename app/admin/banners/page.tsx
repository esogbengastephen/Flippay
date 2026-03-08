"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import Image from "next/image";

interface Banner {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  is_active: boolean;
  display_order: number;
  click_count: number;
  placement?: "dashboard" | "banners_page";
  created_at: string;
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    image_url: "",
    link_url: "",
    display_order: 0,
    is_active: true,
    placement: "banners_page" as "dashboard" | "banners_page",
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const response = await fetch(getApiUrl("/api/admin/banners"));
      const data = await response.json();

      if (data.success) {
        setBanners(data.banners || []);
      }
    } catch (error) {
      console.error("Error fetching banners:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.image_url?.trim()) {
      alert("Banner image URL is required");
      return;
    }
    setIsPublishing(true);
    try {
      const url = getApiUrl(
        editingBanner ? `/api/banners/${editingBanner.id}` : "/api/banners"
      );
      const method = editingBanner ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          link_url: formData.link_url || null,
          title: formData.title || null,
          placement: formData.placement || "banners_page",
        }),
      });

      let data: { success?: boolean; error?: string };
      try {
        data = await response.json();
      } catch {
        throw new Error(response.ok ? "Invalid response from server" : `Request failed (${response.status})`);
      }

      if (data.success) {
        setShowAddModal(false);
        setEditingBanner(null);
        setFormData({
          title: "",
          image_url: "",
          link_url: "",
          display_order: 0,
          is_active: true,
          placement: "banners_page",
        });
        fetchBanners();
      } else {
        alert(data.error || "Failed to save banner");
      }
    } catch (error: any) {
      console.error("Error saving banner:", error);
      alert(error?.message || "Failed to save banner");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || "",
      image_url: banner.image_url,
      link_url: banner.link_url || "",
      display_order: banner.display_order,
      is_active: banner.is_active,
      placement: (banner.placement as "dashboard" | "banners_page") || "banners_page",
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;

    try {
      const response = await fetch(getApiUrl(`/api/banners/${id}`), {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        fetchBanners();
      } else {
        alert(data.error || "Failed to delete banner");
      }
    } catch (error) {
      console.error("Error deleting banner:", error);
      alert("Failed to delete banner");
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      const response = await fetch(getApiUrl(`/api/banners/${banner.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !banner.is_active }),
      });

      const data = await response.json();

      if (data.success) {
        fetchBanners();
      }
    } catch (error) {
      console.error("Error toggling banner:", error);
    }
  };

  const filteredBanners = banners.filter(
    (b) =>
      !searchQuery ||
      (b.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Search */}
      <div className="flex justify-end">
        <div className="relative w-full sm:w-64">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-accent/50 text-sm">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search banners..."
              className="w-full bg-surface border border-accent/10 rounded-full py-2 pl-10 pr-4 text-xs text-white placeholder:text-accent/40 focus:outline-none focus:border-secondary/50"
            />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Create Form - Left Sidebar */}
        <div className="xl:col-span-1">
          <div className="bg-surface/60 backdrop-blur-[16px] border border-secondary/10 p-6 rounded-3xl sticky top-24">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="material-icons-outlined text-secondary">
                add_circle
              </span>
              Create New Banner
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setFormData({
                  title: "",
                  image_url: "",
                  link_url: "",
                  display_order: banners.length,
                  is_active: true,
                  placement: "banners_page",
                });
                setEditingBanner(null);
                setShowAddModal(true);
              }}
              className="space-y-5"
            >
              <button
                type="submit"
                className="w-full bg-secondary text-primary py-4 rounded-xl font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(19,236,90,0.3)] mt-4"
              >
                <span className="material-icons-outlined">add</span>
                Add New Banner
              </button>
            </form>
          </div>
        </div>

        {/* Banners Grid */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-icons-outlined text-secondary">
                grid_view
              </span>
              Active Banners
            </h2>
          </div>

          {loading ? (
            <div className="bg-surface/60 backdrop-blur-[16px] border border-secondary/10 rounded-3xl p-12 text-center">
              <span className="material-icons-outlined text-4xl text-accent/50 animate-pulse">
                image
              </span>
              <p className="text-accent/70 mt-4">Loading banners...</p>
            </div>
          ) : filteredBanners.length === 0 ? (
            <div className="bg-surface/60 backdrop-blur-[16px] border border-secondary/10 rounded-3xl p-12 text-center">
              <span className="material-icons-outlined text-6xl text-accent/40 mb-4 block">
                image
              </span>
              <p className="text-accent/70">
                {searchQuery
                  ? "No banners match your search."
                  : "No banners yet. Click Add New Banner to create one."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredBanners.map((banner) => (
                <div
                  key={banner.id}
                  className={`bg-surface/60 backdrop-blur-[16px] border border-accent/10 rounded-3xl overflow-hidden flex flex-col hover:border-secondary/30 transition-all group ${
                    !banner.is_active ? "opacity-80" : ""
                  }`}
                >
                  <div className={`aspect-video relative ${!banner.is_active ? "grayscale group-hover:grayscale-0 transition-all duration-500" : ""}`}>
                    <Image
                      src={banner.image_url}
                      alt={banner.title || "Banner"}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      unoptimized
                    />
                    <div className="absolute top-4 left-4 flex flex-wrap gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                          banner.is_active
                            ? "bg-secondary text-primary shadow-[0_0_10px_rgba(19,236,90,0.4)]"
                            : "bg-surface-highlight text-accent/70"
                        }`}
                      >
                        {banner.is_active ? "Active" : "Inactive"}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider bg-primary/60 text-accent/90 border border-accent/20">
                        {banner.placement === "dashboard" ? "Dashboard" : "Banners Page"}
                      </span>
                    </div>
                    <div className={`absolute inset-0 bg-gradient-to-t from-background-dark to-transparent ${!banner.is_active ? "opacity-80" : "opacity-60"}`} />
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-white">
                        {banner.title || "Untitled Banner"}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(banner)}
                          className="text-accent/70 hover:text-secondary transition-colors p-1"
                          title="Edit"
                        >
                          <span className="material-icons-outlined text-xl">
                            edit
                          </span>
                        </button>
                        <button
                          onClick={() => handleDelete(banner.id)}
                          className="text-accent/70 hover:text-red-400 transition-colors p-1"
                          title="Delete"
                        >
                          <span className="material-icons-outlined text-xl">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-accent/60 mb-4 line-clamp-2">
                      {banner.link_url
                        ? `Link: ${banner.link_url}`
                        : "No link configured"}
                    </p>
                    <div className="mt-auto pt-4 border-t border-accent/10 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-accent/60 uppercase">
                            Order
                          </span>
                          <span className="text-sm font-bold text-white">
                            {banner.display_order}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-accent/60 uppercase">
                            Clicks
                          </span>
                          <span className="text-sm font-bold text-white">
                            {banner.click_count}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleActive(banner)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          banner.is_active
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
                            : "bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30"
                        }`}
                      >
                        {banner.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add More Card */}
              <button
                onClick={() => {
                  setFormData({
                    title: "",
                    image_url: "",
                    link_url: "",
                    display_order: banners.length,
                    is_active: true,
                    placement: "banners_page",
                  });
                  setEditingBanner(null);
                  setShowAddModal(true);
                }}
                className="border-2 border-dashed border-accent/10 rounded-3xl flex flex-col items-center justify-center p-8 hover:bg-surface/30 hover:border-secondary/20 transition-all cursor-pointer group min-h-[200px]"
              >
                <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <span className="material-icons-outlined text-3xl text-accent/60 group-hover:text-secondary">
                    add
                  </span>
                </div>
                <p className="font-bold text-accent/60 group-hover:text-white">
                  Add More
                </p>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface/60 backdrop-blur-[16px] border border-secondary/10 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingBanner ? "Edit Banner" : "Add New Banner"}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingBanner(null);
                  }}
                  className="text-accent/70 hover:text-white p-1 rounded-lg hover:bg-accent/10 transition-colors"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-accent/70 uppercase tracking-wider">
                    Title (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full bg-surface border border-accent/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
                    placeholder="e.g. Summer Crypto Rewards"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-accent/70 uppercase tracking-wider">
                    Banner Image
                  </label>
                  <div className="border-2 border-dashed border-accent/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 bg-surface/50 hover:border-secondary/30 transition-colors">
                    <span className="material-icons-outlined text-4xl text-accent/60">upload_file</span>
                    <input
                      type="text"
                      value={formData.image_url}
                      onChange={(e) =>
                        setFormData({ ...formData, image_url: e.target.value })
                      }
                      className="w-full bg-surface border border-accent/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
                      placeholder="https://example.com/banner.jpg (1200x400px recommended)"
                    />
                    {formData.image_url && (
                      <div className="mt-2 relative w-full aspect-video bg-surface rounded-xl overflow-hidden">
                        <Image
                          src={formData.image_url}
                          alt="Preview"
                          fill
                          className="object-contain"
                          unoptimized
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-accent/70 uppercase tracking-wider">
                    Target URL
                  </label>
                  <input
                    type="url"
                    value={formData.link_url}
                    onChange={(e) =>
                      setFormData({ ...formData, link_url: e.target.value })
                    }
                    className="w-full bg-surface border border-accent/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
                    placeholder="https://flippay.io/promo/..."
                  />
                  <p className="text-xs text-accent/50">
                    Leave empty if banner should not be clickable
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-accent/70 uppercase tracking-wider">
                    Where to show
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="placement"
                        checked={formData.placement === "dashboard"}
                        onChange={() => setFormData({ ...formData, placement: "dashboard" })}
                        className="border-accent/30 bg-surface text-secondary focus:ring-secondary"
                      />
                      <span className="text-sm text-white">Dashboard (between Services & Recent Transactions)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="placement"
                        checked={formData.placement === "banners_page"}
                        onChange={() => setFormData({ ...formData, placement: "banners_page" })}
                        className="border-accent/30 bg-surface text-secondary focus:ring-secondary"
                      />
                      <span className="text-sm text-white">Banners page (/banners)</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="display-order" className="block text-xs font-semibold text-accent/70 uppercase tracking-wider">
                      Display Order
                    </label>
                    <input
                      id="display-order"
                      type="number"
                      value={formData.display_order}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          display_order: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-surface border border-accent/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 py-2">
                    <input
                      id="active"
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_active: e.target.checked,
                        })
                      }
                      className="rounded border-accent/20 bg-surface text-secondary focus:ring-secondary"
                    />
                    <label
                      htmlFor="active"
                      className="text-sm text-white cursor-pointer"
                    >
                      Publish immediately
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isPublishing}
                    className="flex-1 bg-secondary text-primary py-4 rounded-xl font-bold hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isPublishing ? "Publishing..." : editingBanner ? "Update Banner" : "Publish Banner"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingBanner(null);
                    }}
                    className="px-4 py-3 border border-accent/10 rounded-xl text-accent/80 hover:bg-surface-highlight transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
