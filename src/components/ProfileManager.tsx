"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonProfile, PersonAddress } from "@/lib/profiles/types";
import { getAllProfiles, saveProfile, deleteProfile, newProfileId } from "@/lib/profiles/store";
import { PastOrder } from "@/lib/profiles/types";

interface ProfileManagerProps {
  activeProfile: PersonProfile | null;
  profiles: PersonProfile[];  // BUG-001 fix: parent-controlled, no local state divergence
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
  // BUG-001 fix: allProfiles comes from parent prop — no local state that can diverge
  const [availableAddresses, setAvailableAddresses] = useState<{ address_id: string; location_name: string }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PersonProfile | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [pastOrders, setPastOrders] = useState<PastOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // BUG-004 fix: sync from preloadedAddresses prop when it arrives (parent fetches async)
  useEffect(() => {
    if (preloadedAddresses && preloadedAddresses.length > 0) {
      setAvailableAddresses(preloadedAddresses);
    }
  }, [preloadedAddresses]);

  // Only self-fetch if parent didn't provide addresses after a short wait
  useEffect(() => {
    const timer = setTimeout(() => {
      setAvailableAddresses((cur) => {
        if (cur.length > 0) return cur; // already have them from parent
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
    onAllProfilesChange(updated);  // BUG-006 fix: single update path, parent owns allProfiles state
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

  return (
    <>
      {/* Trigger button */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-full transition-colors"
        >
          <span>👤</span>
          <span>{activeProfile ? activeProfile.name : "Add Person"}</span>
          <span className="text-stone-400">▾</span>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              className="absolute top-9 left-0 w-72 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 overflow-hidden"
            >
              <div className="p-3 border-b border-stone-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">People</p>
                <button
                  onClick={openNew}
                  className="text-xs text-amber-600 font-semibold hover:text-amber-700"
                >
                  + Add person
                </button>
              </div>

              {profiles.length === 0 ? (
                <div className="p-4 text-sm text-stone-400 text-center">
                  No profiles yet.<br />Add a person to get started.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {profiles.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between px-4 py-3 border-b border-stone-50 last:border-0 ${activeProfile?.id === p.id ? "bg-amber-50" : "hover:bg-stone-50"}`}
                    >
                      <button
                        onClick={() => { onProfileChange(p); setIsOpen(false); }}
                        className="flex-1 text-left"
                      >
                        <p className="text-sm font-semibold text-stone-800">{p.name}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {p.addresses.map((a) => a.label).join(", ") || "No address"}
                          {" · "}{p.preferences.diet}
                        </p>
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        className="text-xs text-stone-400 hover:text-amber-600 px-2 py-1"
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
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
              onClick={() => setEditingProfile(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[460px] sm:bottom-8 bg-white rounded-3xl shadow-2xl z-50 overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="p-5 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-stone-900">
                    {isAddingNew ? "New person" : `Edit ${editingProfile.name}`}
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {isAddingNew ? "Set name, address and preferences" : "Update preferences and details"}
                  </p>
                </div>
                {!isAddingNew && (
                  <button
                    onClick={() => handleDelete(editingProfile.id)}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1"
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className="p-5 space-y-5">
                {/* Name */}
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Name</p>
                  <input
                    type="text"
                    value={editingProfile.name}
                    onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                    placeholder="e.g. Devesh, Divya, Mom..."
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>

                {/* Addresses */}
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Delivery Addresses</p>
                  {availableAddresses.length === 0 ? (
                    <p className="text-xs text-stone-400">No Zomato addresses found. Connect Zomato MCP to load.</p>
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
                              className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                                linked
                                  ? "bg-amber-500 border-amber-500 text-white"
                                  : "border-stone-300 bg-white"
                              }`}
                            >
                              {linked && <span className="text-xs">✓</span>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-stone-600 truncate">{addr.location_name}</p>
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
                                  className="mt-1 w-full text-xs rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Default address selector */}
                  {editingProfile.addresses.length > 1 && (
                    <div className="mt-3">
                      <p className="text-xs text-stone-500 mb-1">Default delivery address</p>
                      <div className="flex gap-2 flex-wrap">
                        {editingProfile.addresses.map((a) => (
                          <button
                            key={a.addressId}
                            onClick={() => setEditingProfile({ ...editingProfile, defaultAddressId: a.addressId })}
                            className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                              editingProfile.defaultAddressId === a.addressId
                                ? "bg-amber-500 text-white"
                                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                            }`}
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
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Diet</p>
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
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                          editingProfile.preferences.diet === d
                            ? "bg-amber-500 text-white"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        {d === "veg" ? "🥗 Veg" : d === "nonveg" ? "🍖 Non-veg" : "🍽️ Both"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Budget</p>
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
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                          editingProfile.preferences.priceRange === p
                            ? "bg-amber-500 text-white"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        {p === "budget" ? "💰 Budget" : p === "mid" ? "🍴 Mid" : "💎 Premium"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Likes */}
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Likes</p>
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
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          editingProfile.preferences.likes.includes(chip)
                            ? "bg-amber-100 text-amber-700 border border-amber-300"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dislikes */}
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Dislikes</p>
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
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          editingProfile.preferences.dislikes.includes(chip)
                            ? "bg-red-100 text-red-700 border border-red-200"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                    Notes for Aaru
                  </p>
                  <textarea
                    value={editingProfile.preferences.notes}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        preferences: { ...editingProfile.preferences, notes: e.target.value },
                      })
                    }
                    placeholder={`e.g. "Doesn't like sweets in periods", "Lactose intolerant", "Always orders extra spicy"`}
                    rows={2}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-stone-400 mt-1">Aaru remembers this when ordering for {editingProfile.name || "this person"}</p>
                </div>

                {/* Past orders */}
                {!isAddingNew && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Recent Orders</p>
                      <button
                        onClick={syncOrdersToProfile}
                        disabled={loadingOrders}
                        className="text-xs text-amber-600 hover:text-amber-700 disabled:opacity-40"
                      >
                        {loadingOrders ? "Syncing..." : "Sync from Zomato ↻"}
                      </button>
                    </div>
                    {loadingOrders ? (
                      <p className="text-xs text-stone-400 animate-pulse">Fetching from Zomato...</p>
                    ) : (editingProfile.pastOrders.length > 0 || pastOrders.length > 0) ? (
                      <div className="space-y-1.5">
                        {(editingProfile.pastOrders.length > 0 ? editingProfile.pastOrders : pastOrders).slice(0, 5).map((o, i) => (
                          <div key={i} className="flex justify-between text-xs text-stone-600 bg-stone-50 rounded-lg px-3 py-2">
                            <span>{o.itemName} — <span className="text-stone-400">{o.restaurantName}</span></span>
                            <span className="text-stone-400">₹{o.price}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400">No orders synced yet. Tap "Sync from Zomato" above.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 pt-0 flex gap-3">
                <button
                  onClick={() => setEditingProfile(null)}
                  className="flex-1 py-3 rounded-2xl border border-stone-200 text-stone-600 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!editingProfile.name.trim()) return;
                    persistProfile(editingProfile);
                  }}
                  disabled={!editingProfile.name.trim()}
                  className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
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

function extractCity(locationName: string): string {
  const parts = locationName.split(",");
  for (const part of parts.reverse()) {
    const trimmed = part.trim();
    if (trimmed && trimmed.length > 2 && !trimmed.match(/^\d/)) return trimmed;
  }
  return "Delhi";
}
