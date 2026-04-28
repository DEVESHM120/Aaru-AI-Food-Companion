"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonProfile, PersonAddress } from "@/lib/profiles/types";
import { getAllProfiles, saveProfile, deleteProfile, newProfileId } from "@/lib/profiles/store";
import { PastOrder } from "@/lib/profiles/types";

interface ProfileManagerProps {
  activeProfile: PersonProfile | null;
  profiles: PersonProfile[];
  preloadedAddresses?: { address_id: string; location_name: string }[];
  onProfileChange: (profile: PersonProfile) => void;
  onAllProfilesChange: (profiles: PersonProfile[]) => void;
}

const DIET_OPTIONS = ["veg", "nonveg", "both"] as const;
const PRICE_OPTIONS = ["budget", "mid", "premium"] as const;
const LIKE_CHIPS = ["Spicy 🌶️", "Biryani 🍛", "North Indian", "South Indian", "Chinese", "Pizza 🍕", "Burger 🍔", "Desserts 🍮", "Seafood 🦐", "Street Food"];
const DISLIKE_CHIPS = ["Sweets", "Too Oily", "South Indian", "Chinese", "Junk Food", "Raw Food"];
const ADDRESS_LABELS = ["Home", "Office", "College", "Gym", "Parents' place"];

function emptyProfile(): PersonProfile {
  return {
    id: newProfileId(),
    name: "",
    addresses: [],
    preferences: { likes: [], dislikes: [], diet: "both", priceRange: "mid", notes: "" },
    pastOrders: [],
  };
}

export default function ProfileManager({
  activeProfile,
  profiles,
  preloadedAddresses,
  onProfileChange,
  onAllProfilesChange,
}: ProfileManagerProps) {
  const [availableAddresses, setAvailableAddresses] = useState<{ address_id: string; location_name: string }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PersonProfile | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [pastOrders, setPastOrders] = useState<PastOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (preloadedAddresses && preloadedAddresses.length > 0) {
      setAvailableAddresses(preloadedAddresses);
    }
  }, [preloadedAddresses]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAvailableAddresses((cur) => {
        if (cur.length > 0) return cur;
        fetch("/api/addresses")
          .then((r) => r.json())
          .then((data) => { if (data.length > 0) setAvailableAddresses(data); })
          .catch(() => {});
        return cur;
      });
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit(profile: PersonProfile) {
    setEditingProfile({ ...profile, addresses: [...profile.addresses], pastOrders: [...profile.pastOrders] });
    setIsAddingNew(false);
    setIsOpen(false);
    loadOrders();
  }

  function openNew() {
    setEditingProfile(emptyProfile());
    setIsAddingNew(true);
    setIsOpen(false);
  }

  async function loadOrders(forceRefresh = false) {
    if (loadingOrders) return;
    if (!forceRefresh && pastOrders.length > 0) return;
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      setPastOrders(data);
    } catch {}
    setLoadingOrders(false);
  }

  async function syncOrdersToProfile() {
    if (!editingProfile) return;
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/orders");
      const orders = await res.json();
      setPastOrders(orders);
      setEditingProfile({ ...editingProfile, pastOrders: orders });
    } catch {}
    setLoadingOrders(false);
  }

  function persistProfile(p: PersonProfile) {
    saveProfile(p);
    const updated = getAllProfiles();
    onAllProfilesChange(updated);
    onProfileChange(p);
    setEditingProfile(null);
  }

  function handleDelete(id: string) {
    deleteProfile(id);
    const updated = getAllProfiles();
    onAllProfilesChange(updated);
    if (activeProfile?.id === id && updated.length > 0) {
      onProfileChange(updated[0]);
    }
    setEditingProfile(null);
  }

  function toggleChip(arr: string[], val: string) {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }

  function toggleAddress(profile: PersonProfile, addr: { address_id: string; location_name: string }) {
    const exists = profile.addresses.find((a) => a.addressId === addr.address_id);
    if (exists) {
      return profile.addresses.filter((a) => a.addressId !== addr.address_id);
    }
    const city = extractCity(addr.location_name);
    const newAddr: PersonAddress = {
      addressId: addr.address_id,
      locationName: addr.location_name,
      city,
      label: ADDRESS_LABELS[profile.addresses.length] ?? "Address",
    };
    return [...profile.addresses, newAddr];
  }

  function updateAddressLabel(profile: PersonProfile, addressId: string, label: string): PersonAddress[] {
    return profile.addresses.map((a) =>
      a.addressId === addressId ? { ...a, label } : a
    );
  }

  const inputStyle = {
    backgroundColor: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };

  const pillBase = "flex-1 py-2 rounded-xl text-sm font-medium transition-colors";

  return (
    <>
      {/* Trigger button */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
          style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
        >
          <span>👤</span>
          <span>{activeProfile ? activeProfile.name : "Add Person"}</span>
          <span style={{ color: "var(--text-muted)" }}>▾</span>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              className="absolute top-9 left-0 w-72 rounded-2xl z-50 overflow-hidden"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
              }}
            >
              <div className="p-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>People</p>
                <button
                  onClick={openNew}
                  className="text-xs font-semibold transition-opacity hover:opacity-70"
                  style={{ color: "var(--accent-2)" }}
                >
                  + Add person
                </button>
              </div>

              {profiles.length === 0 ? (
                <div className="p-4 text-sm text-center" style={{ color: "var(--text-muted)" }}>
                  No profiles yet.<br />Add a person to get started.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {profiles.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-4 py-3 last:border-0"
                      style={{
                        borderBottom: "1px solid var(--border)",
                        backgroundColor: activeProfile?.id === p.id ? "rgba(255,69,0,0.06)" : "transparent",
                      }}
                    >
                      <button
                        onClick={() => { onProfileChange(p); setIsOpen(false); }}
                        className="flex-1 text-left"
                      >
                        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{p.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {p.addresses.map((a) => a.label).join(", ") || "No address"}
                          {" · "}{p.preferences.diet}
                        </p>
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        className="text-xs px-2 py-1 transition-opacity hover:opacity-70"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Profile editor modal */}
      <AnimatePresence>
        {editingProfile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
              onClick={() => setEditingProfile(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[460px] sm:bottom-8 rounded-3xl z-50 overflow-hidden max-h-[90vh] overflow-y-auto"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
              }}
            >
              {/* Header */}
              <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <h2 className="font-bold" style={{ color: "var(--text)" }}>
                    {isAddingNew ? "New person" : `Edit ${editingProfile.name}`}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {isAddingNew ? "Set name, address and preferences" : "Update preferences and details"}
                  </p>
                </div>
                {!isAddingNew && (
                  <button
                    onClick={() => handleDelete(editingProfile.id)}
                    className="text-xs px-2 py-1 transition-opacity hover:opacity-70"
                    style={{ color: "#EF4444" }}
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className="p-5 space-y-5">
                {/* Name */}
                <div>
                  <SectionLabel>Name</SectionLabel>
                  <input
                    type="text"
                    value={editingProfile.name}
                    onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                    placeholder="e.g. Devesh, Divya, Mom..."
                    className="w-full rounded-xl px-4 py-2.5 text-sm placeholder:opacity-40 focus:outline-none"
                    style={{ ...inputStyle, outline: "none" }}
                    onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(255,69,0,0.3)")}
                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                  />
                </div>

                {/* Addresses */}
                <div>
                  <SectionLabel>Delivery Addresses</SectionLabel>
                  {availableAddresses.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>No Zomato addresses found. Connect Zomato MCP to load.</p>
                  ) : (
                    <div className="space-y-2">
                      {availableAddresses.map((addr) => {
                        const linked = editingProfile.addresses.find((a) => a.addressId === addr.address_id);
                        return (
                          <div key={addr.address_id} className="flex items-start gap-2">
                            <button
                              onClick={() =>
                                setEditingProfile({
                                  ...editingProfile,
                                  addresses: toggleAddress(editingProfile, addr),
                                })
                              }
                              className="mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center transition-all text-xs"
                              style={linked ? {
                                backgroundColor: "var(--accent)",
                                border: "2px solid var(--accent)",
                                color: "white",
                              } : {
                                backgroundColor: "var(--surface-2)",
                                border: "2px solid var(--border)",
                              }}
                            >
                              {linked && "✓"}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{addr.location_name}</p>
                              {linked && (
                                <input
                                  type="text"
                                  value={linked.label}
                                  onChange={(e) =>
                                    setEditingProfile({
                                      ...editingProfile,
                                      addresses: updateAddressLabel(editingProfile, addr.address_id, e.target.value),
                                    })
                                  }
                                  placeholder="Label (Home, Office...)"
                                  className="mt-1 w-full text-xs rounded-lg px-2 py-1 focus:outline-none"
                                  style={{
                                    backgroundColor: "rgba(255,69,0,0.07)",
                                    border: "1px solid rgba(255,69,0,0.25)",
                                    color: "var(--text)",
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {editingProfile.addresses.length > 1 && (
                    <div className="mt-3">
                      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Default delivery address</p>
                      <div className="flex gap-2 flex-wrap">
                        {editingProfile.addresses.map((a) => (
                          <button
                            key={a.addressId}
                            onClick={() => setEditingProfile({ ...editingProfile, defaultAddressId: a.addressId })}
                            className="px-2 py-1 rounded-lg text-xs font-medium transition-all"
                            style={editingProfile.defaultAddressId === a.addressId ? {
                              background: "linear-gradient(135deg, #FF4500, #FF7A00)",
                              color: "white",
                            } : {
                              backgroundColor: "var(--surface-2)",
                              color: "var(--text-muted)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Diet */}
                <div>
                  <SectionLabel>Diet</SectionLabel>
                  <div className="flex gap-2">
                    {DIET_OPTIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() =>
                          setEditingProfile({
                            ...editingProfile,
                            preferences: { ...editingProfile.preferences, diet: d },
                          })
                        }
                        className={pillBase}
                        style={editingProfile.preferences.diet === d ? {
                          background: "linear-gradient(135deg, #FF4500, #FF7A00)",
                          color: "white",
                        } : {
                          backgroundColor: "var(--surface-2)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {d === "veg" ? "🥗 Veg" : d === "nonveg" ? "🍖 Non-veg" : "🍽️ Both"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <SectionLabel>Budget</SectionLabel>
                  <div className="flex gap-2">
                    {PRICE_OPTIONS.map((p) => (
                      <button
                        key={p}
                        onClick={() =>
                          setEditingProfile({
                            ...editingProfile,
                            preferences: { ...editingProfile.preferences, priceRange: p },
                          })
                        }
                        className={pillBase}
                        style={editingProfile.preferences.priceRange === p ? {
                          background: "linear-gradient(135deg, #FF4500, #FF7A00)",
                          color: "white",
                        } : {
                          backgroundColor: "var(--surface-2)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {p === "budget" ? "💰 Budget" : p === "mid" ? "🍴 Mid" : "💎 Premium"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Likes */}
                <div>
                  <SectionLabel>Likes</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {LIKE_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        onClick={() =>
                          setEditingProfile({
                            ...editingProfile,
                            preferences: {
                              ...editingProfile.preferences,
                              likes: toggleChip(editingProfile.preferences.likes, chip),
                            },
                          })
                        }
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                        style={editingProfile.preferences.likes.includes(chip) ? {
                          backgroundColor: "rgba(255,69,0,0.12)",
                          border: "1px solid rgba(255,69,0,0.3)",
                          color: "#FF7A00",
                        } : {
                          backgroundColor: "var(--surface-2)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dislikes */}
                <div>
                  <SectionLabel>Dislikes</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {DISLIKE_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        onClick={() =>
                          setEditingProfile({
                            ...editingProfile,
                            preferences: {
                              ...editingProfile.preferences,
                              dislikes: toggleChip(editingProfile.preferences.dislikes, chip),
                            },
                          })
                        }
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                        style={editingProfile.preferences.dislikes.includes(chip) ? {
                          backgroundColor: "rgba(239,68,68,0.12)",
                          border: "1px solid rgba(239,68,68,0.3)",
                          color: "#EF4444",
                        } : {
                          backgroundColor: "var(--surface-2)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <SectionLabel>Notes for Aaru</SectionLabel>
                  <textarea
                    value={editingProfile.preferences.notes}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        preferences: { ...editingProfile.preferences, notes: e.target.value },
                      })
                    }
                    placeholder={`e.g. "Doesn't like sweets in periods", "Lactose intolerant"`}
                    rows={2}
                    className="w-full rounded-xl px-4 py-2.5 text-sm placeholder:opacity-40 focus:outline-none resize-none"
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(255,69,0,0.3)")}
                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                  />
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Aaru remembers this when ordering for {editingProfile.name || "this person"}
                  </p>
                </div>

                {/* Past orders */}
                {!isAddingNew && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <SectionLabel>Recent Orders</SectionLabel>
                      <button
                        onClick={syncOrdersToProfile}
                        disabled={loadingOrders}
                        className="text-xs disabled:opacity-40 transition-opacity hover:opacity-70"
                        style={{ color: "#FF7A00" }}
                      >
                        {loadingOrders ? "Syncing..." : "Sync from Zomato ↻"}
                      </button>
                    </div>
                    {loadingOrders ? (
                      <p className="text-xs animate-pulse" style={{ color: "var(--text-muted)" }}>Fetching from Zomato...</p>
                    ) : (editingProfile.pastOrders.length > 0 || pastOrders.length > 0) ? (
                      <div className="space-y-1.5">
                        {(editingProfile.pastOrders.length > 0 ? editingProfile.pastOrders : pastOrders).slice(0, 5).map((o, i) => (
                          <div
                            key={i}
                            className="flex justify-between text-xs px-3 py-2 rounded-lg"
                            style={{ backgroundColor: "var(--surface-2)" }}
                          >
                            <span style={{ color: "var(--text)" }}>{o.itemName} — <span style={{ color: "var(--text-muted)" }}>{o.restaurantName}</span></span>
                            <span style={{ color: "var(--text-muted)" }}>₹{o.price}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>No orders synced yet. Tap "Sync from Zomato" above.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 pt-0 flex gap-3">
                <button
                  onClick={() => setEditingProfile(null)}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all"
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!editingProfile.name.trim()) return;
                    persistProfile(editingProfile);
                  }}
                  disabled={!editingProfile.name.trim()}
                  className="flex-1 py-3 rounded-2xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #FF4500, #FF7A00)" }}
                >
                  Save
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

function extractCity(locationName: string): string {
  const parts = locationName.split(",");
  for (const part of parts.reverse()) {
    const trimmed = part.trim();
    if (trimmed && trimmed.length > 2 && !trimmed.match(/^\d/)) return trimmed;
  }
  return "Delhi";
}
