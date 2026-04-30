"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonProfile, PersonAddress } from "@/lib/profiles/types";
import { getAllProfiles, saveProfile, deleteProfile, newProfileId } from "@/lib/profiles/store";

interface AvailableAddress {
  address_id: string;
  location_name: string;
  source: "zomato" | "swiggy";
}

interface ProfileManagerProps {
  activeProfile: PersonProfile | null;
  profiles: PersonProfile[];
  preloadedAddresses?: { address_id: string; location_name: string }[];
  swiggyToken?: string;
  onProfileChange: (profile: PersonProfile) => void;
  onAllProfilesChange: (profiles: PersonProfile[]) => void;
}

const DIET_OPTIONS = ["veg", "nonveg", "both"] as const;
const PRICE_OPTIONS = ["budget", "mid", "premium"] as const;
const LIKE_CHIPS = ["Spicy 🌶️", "Biryani 🍛", "North Indian", "South Indian", "Chinese", "Pizza 🍕", "Burger 🍔", "Desserts 🍮", "Seafood 🦐", "Street Food"];
const DISLIKE_CHIPS = ["Sweets", "Too Oily", "South Indian", "Chinese", "Junk Food", "Raw Food"];
const ADDRESS_LABELS = ["Home", "Office", "College", "Gym", "Parents' place"];

function extractCity(loc: string): string {
  for (const part of loc.split(",").reverse()) {
    const t = part.trim();
    if (t && t.length > 2 && !t.match(/^\d/)) return t;
  }
  return "Delhi";
}

function toggleChip(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

export default function ProfileManager({
  activeProfile, profiles, preloadedAddresses = [], swiggyToken,
  onProfileChange, onAllProfilesChange,
}: ProfileManagerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "edit">("list");
  const [draft, setDraft] = useState<PersonProfile | null>(null);
  const [newName, setNewName] = useState("");
  const [showMemories, setShowMemories] = useState(false);
  const [swiggyAddresses, setSwiggyAddresses] = useState<AvailableAddress[]>([]);
  const [syncingSwiggy, setSyncingSwiggy] = useState(false);

  const others = profiles.filter((p) => p.id !== activeProfile?.id);

  function openEdit(p: PersonProfile) {
    setDraft({ ...p, preferences: { ...p.preferences }, addresses: [...p.addresses] });
    setView("edit");
  }

  function cancelEdit() {
    setDraft(null);
    setView("list");
  }

  function saveEdit() {
    if (!draft || !draft.name.trim()) return;
    saveProfile(draft);
    const all = getAllProfiles();
    onAllProfilesChange(all);
    if (draft.id === activeProfile?.id) onProfileChange(draft);
    setDraft(null);
    setView("list");
  }

  function handleDelete(id: string) {
    deleteProfile(id);
    const remaining = getAllProfiles();
    onAllProfilesChange(remaining);
    if (activeProfile?.id === id && remaining.length > 0) onProfileChange(remaining[0]);
    setDraft(null);
    setView("list");
  }

  function handleAddPerson() {
    if (!newName.trim()) return;
    const p: PersonProfile = {
      id: newProfileId(),
      name: newName.trim(),
      addresses: [],
      preferences: { likes: [], dislikes: [], diet: "both", priceRange: "mid", notes: "" },
      pastOrders: [],
    };
    saveProfile(p);
    onAllProfilesChange(getAllProfiles());
    setNewName("");
  }

  function toggleAddress(addr: AvailableAddress) {
    if (!draft) return;
    const exists = draft.addresses.find((a) => a.addressId === addr.address_id);
    const addresses = exists
      ? draft.addresses.filter((a) => a.addressId !== addr.address_id)
      : [...draft.addresses, {
          addressId: addr.address_id,
          locationName: addr.location_name,
          city: extractCity(addr.location_name),
          label: ADDRESS_LABELS[draft.addresses.length] ?? "Address",
        } as PersonAddress];
    setDraft({ ...draft, addresses });
  }

  async function syncSwiggyAddresses() {
    if (!swiggyToken || syncingSwiggy) return;
    setSyncingSwiggy(true);
    try {
      const res = await fetch("/api/swiggy/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: swiggyToken }),
      });
      const data = await res.json();
      if (!Array.isArray(data.addresses)) return;
      const mapped: AvailableAddress[] = data.addresses
        .map((a: Record<string, string>) => ({
          address_id: a.address_id ?? a.id ?? "",
          location_name: a.address ?? a.formatted_address ?? a.locationName ?? a.location_name ?? "",
          source: "swiggy" as const,
        }))
        .filter((a: AvailableAddress) => a.address_id && a.location_name);
      setSwiggyAddresses(mapped);
    } catch {}
    setSyncingSwiggy(false);
  }

  function updateAddressLabel(addressId: string, label: string) {
    if (!draft) return;
    setDraft({ ...draft, addresses: draft.addresses.map((a) => a.addressId === addressId ? { ...a, label } : a) });
  }

  const pill = "flex-1 py-2 rounded-xl text-sm font-medium transition-colors";
  const surface = { backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" };
  const active = { background: "linear-gradient(135deg,#FF4500,#FF7A00)", color: "white" };

  return (
    <>
      {/* Header trigger */}
      <button
        onClick={() => { setView("list"); setOpen(true); }}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
        style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
      >
        <span>👤</span>
        <span>{activeProfile?.name ?? "People"}</span>
        <span style={{ color: "var(--text-muted)" }}>▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
              onClick={() => { setOpen(false); cancelEdit(); }}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="relative rounded-t-3xl max-h-[88vh] overflow-y-auto"
              style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "var(--border)" }} />
              </div>

              {/* ── LIST VIEW ─────────────────────────────────────────────── */}
              {view === "list" && (
                <div className="px-4 pb-8">
                  <div className="flex items-center justify-between py-3 mb-1">
                    <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>People & Preferences</h2>
                    <button onClick={() => { setOpen(false); }} className="text-lg leading-none" style={{ color: "var(--text-muted)" }}>✕</button>
                  </div>

                  {/* You */}
                  {activeProfile && (
                    <section className="mb-5">
                      <Label>You</Label>
                      <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "2px solid rgba(255,69,0,0.2)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-bold text-base" style={{ color: "var(--text)" }}>{activeProfile.name}</p>
                          <button onClick={() => openEdit(activeProfile)} className="text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: "rgba(255,69,0,0.1)", color: "#FF7A00" }}>
                            Edit
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <Badge>{activeProfile.preferences.diet === "veg" ? "🥗 Veg" : activeProfile.preferences.diet === "nonveg" ? "🍖 Non-veg" : "🍽️ Both"}</Badge>
                          <Badge>{activeProfile.preferences.priceRange === "budget" ? "💰 Budget" : activeProfile.preferences.priceRange === "mid" ? "🍴 Mid-range" : "💎 Premium"}</Badge>
                        </div>

                        {activeProfile.addresses.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Addresses</p>
                            <div className="flex flex-wrap gap-1">
                              {activeProfile.addresses.map((a) => (
                                <span key={a.addressId} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}>
                                  📍 {a.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeProfile.preferences.likes.length > 0 && (
                          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                            Likes: <span style={{ color: "var(--text)" }}>{activeProfile.preferences.likes.join(", ")}</span>
                          </p>
                        )}
                        {activeProfile.preferences.dislikes.length > 0 && (
                          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                            Dislikes: <span style={{ color: "var(--text)" }}>{activeProfile.preferences.dislikes.join(", ")}</span>
                          </p>
                        )}
                        {activeProfile.preferences.notes?.trim() && (
                          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                            Note: <span style={{ color: "var(--text)" }}>{activeProfile.preferences.notes}</span>
                          </p>
                        )}

                        {(activeProfile.memories?.length ?? 0) > 0 && (
                          <div>
                            <button onClick={() => setShowMemories((v) => !v)} className="text-xs font-medium" style={{ color: "#FF7A00" }}>
                              🧠 Aaru knows {activeProfile.memories!.length} thing{activeProfile.memories!.length !== 1 ? "s" : ""} about you {showMemories ? "▴" : "▾"}
                            </button>
                            {showMemories && (
                              <ul className="mt-2 space-y-1">
                                {activeProfile.memories!.map((m, i) => (
                                  <li key={i} className="text-xs pl-2" style={{ color: "var(--text-muted)", borderLeft: "2px solid rgba(255,69,0,0.3)" }}>{m}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {activeProfile.pastOrders.length > 0 && (
                          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                            <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Recent orders</p>
                            {activeProfile.pastOrders.slice(0, 3).map((o, i) => (
                              <p key={i} className="text-xs" style={{ color: "var(--text)" }}>
                                {o.itemName} <span style={{ color: "var(--text-muted)" }}>· {o.restaurantName} · ₹{o.price}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Other people */}
                  {others.length > 0 && (
                    <section className="mb-5">
                      <Label>People you order for</Label>
                      <div className="space-y-2">
                        {others.map((p) => (
                          <div key={p.id} className="rounded-2xl p-3 flex items-center justify-between gap-3" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{p.name}</p>
                              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                                {p.preferences.diet === "veg" ? "🥗" : p.preferences.diet === "nonveg" ? "🍖" : "🍽️"}{" "}
                                {p.addresses.length > 0 ? `· ${p.addresses.map(a => a.label).join(", ")}` : "· No address"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => { onProfileChange(p); setOpen(false); }} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(255,69,0,0.1)", color: "#FF7A00" }}>
                                Switch
                              </button>
                              <button onClick={() => openEdit(p)} className="text-xs" style={{ color: "var(--text-muted)" }}>Edit</button>
                              <button onClick={() => handleDelete(p.id)} className="text-xs" style={{ color: "#EF4444" }}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Add person */}
                  <section>
                    <Label>Add someone</Label>
                    <div className="flex gap-2">
                      <input
                        type="text" value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddPerson()}
                        placeholder="Name (e.g. Priya, Mom, Partner)"
                        className="flex-1 px-3 py-2.5 rounded-xl text-sm focus:outline-none placeholder:opacity-40"
                        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
                      />
                      <button onClick={handleAddPerson} disabled={!newName.trim()}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                        style={{ background: "linear-gradient(135deg,#FF4500,#FF7A00)" }}>
                        Add
                      </button>
                    </div>
                    <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                      Tell Aaru their preferences in conversation — it learns automatically.
                    </p>
                  </section>
                </div>
              )}

              {/* ── EDIT VIEW ─────────────────────────────────────────────── */}
              {view === "edit" && draft && (
                <div className="px-4 pb-8">
                  <div className="flex items-center gap-3 py-3 mb-2">
                    <button onClick={cancelEdit} className="text-sm font-medium" style={{ color: "#FF7A00" }}>← Back</button>
                    <h2 className="font-bold text-base flex-1" style={{ color: "var(--text)" }}>
                      {draft.id === activeProfile?.id ? "Your preferences" : `Edit ${draft.name}`}
                    </h2>
                    {draft.id !== activeProfile?.id && (
                      <button onClick={() => handleDelete(draft.id)} className="text-xs px-2 py-1 rounded-full" style={{ color: "#EF4444", backgroundColor: "rgba(239,68,68,0.08)" }}>
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="space-y-5">
                    {/* Name */}
                    <Field label="Name">
                      <input type="text" value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        placeholder="e.g. Devesh, Divya, Mom"
                        className="w-full rounded-xl px-4 py-2.5 text-sm placeholder:opacity-40 focus:outline-none"
                        style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                      />
                    </Field>

                    {/* Addresses */}
                    <Field label="Delivery Addresses">
                      {/* Swiggy sync button */}
                      {swiggyToken && (
                        <button
                          onClick={syncSwiggyAddresses}
                          disabled={syncingSwiggy}
                          className="w-full mb-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                          style={{ backgroundColor: syncingSwiggy ? "rgba(252,128,25,0.06)" : "rgba(252,128,25,0.1)", border: "1px solid rgba(252,128,25,0.25)", color: "#FC8019" }}
                        >
                          <span>{syncingSwiggy ? "⏳" : "🛵"}</span>
                          {syncingSwiggy ? "Fetching from Swiggy…" : "Sync addresses from Swiggy"}
                        </button>
                      )}

                      {/* Combined address list */}
                      {(() => {
                        const zomatoAddrs: AvailableAddress[] = preloadedAddresses.map(a => ({ ...a, source: "zomato" as const }));
                        // Merge: swiggy takes precedence; deduplicate by address_id
                        const seenIds = new Set(swiggyAddresses.map(a => a.address_id));
                        const merged = [...swiggyAddresses, ...zomatoAddrs.filter(a => !seenIds.has(a.address_id))];

                        if (merged.length === 0) return (
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {swiggyToken ? 'Tap "Sync from Swiggy" to import your saved addresses.' : "No addresses found. Add your Swiggy account to auto-import."}
                          </p>
                        );

                        return (
                          <div className="space-y-2">
                            {merged.map((addr) => {
                              const linked = draft.addresses.find((a) => a.addressId === addr.address_id);
                              return (
                                <div key={addr.address_id} className="flex items-start gap-2">
                                  <button onClick={() => toggleAddress(addr)}
                                    className="mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs transition-all"
                                    style={linked ? { backgroundColor: "var(--accent)", border: "2px solid var(--accent)", color: "white" }
                                                 : { backgroundColor: "var(--surface-2)", border: "2px solid var(--border)" }}>
                                    {linked && "✓"}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs truncate flex-1" style={{ color: "var(--text-muted)" }}>{addr.location_name}</p>
                                      <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium"
                                        style={addr.source === "swiggy"
                                          ? { backgroundColor: "rgba(252,128,25,0.1)", color: "#FC8019" }
                                          : { backgroundColor: "rgba(226,55,68,0.08)", color: "#E23744" }}>
                                        {addr.source === "swiggy" ? "Swiggy" : "Zomato"}
                                      </span>
                                    </div>
                                    {linked && (
                                      <input type="text" value={linked.label}
                                        onChange={(e) => updateAddressLabel(addr.address_id, e.target.value)}
                                        placeholder="Label (Home, Office…)"
                                        className="mt-1 w-full text-xs rounded-lg px-2 py-1 focus:outline-none"
                                        style={{ backgroundColor: "rgba(255,69,0,0.07)", border: "1px solid rgba(255,69,0,0.25)", color: "var(--text)" }}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {draft.addresses.length > 1 && (
                        <div className="mt-3">
                          <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Default address</p>
                          <div className="flex gap-2 flex-wrap">
                            {draft.addresses.map((a) => (
                              <button key={a.addressId}
                                onClick={() => setDraft({ ...draft, defaultAddressId: a.addressId })}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                                style={draft.defaultAddressId === a.addressId ? active : surface}>
                                {a.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </Field>

                    {/* Diet */}
                    <Field label="Diet">
                      <div className="flex gap-2">
                        {DIET_OPTIONS.map((d) => (
                          <button key={d} onClick={() => setDraft({ ...draft, preferences: { ...draft.preferences, diet: d } })}
                            className={pill} style={draft.preferences.diet === d ? active : surface}>
                            {d === "veg" ? "🥗 Veg" : d === "nonveg" ? "🍖 Non-veg" : "🍽️ Both"}
                          </button>
                        ))}
                      </div>
                    </Field>

                    {/* Budget */}
                    <Field label="Budget">
                      <div className="flex gap-2">
                        {PRICE_OPTIONS.map((p) => (
                          <button key={p} onClick={() => setDraft({ ...draft, preferences: { ...draft.preferences, priceRange: p } })}
                            className={pill} style={draft.preferences.priceRange === p ? active : surface}>
                            {p === "budget" ? "💰 Budget" : p === "mid" ? "🍴 Mid" : "💎 Premium"}
                          </button>
                        ))}
                      </div>
                    </Field>

                    {/* Likes */}
                    <Field label="Likes">
                      <div className="flex flex-wrap gap-2">
                        {LIKE_CHIPS.map((chip) => {
                          const on = draft.preferences.likes.includes(chip);
                          return (
                            <button key={chip}
                              onClick={() => setDraft({ ...draft, preferences: { ...draft.preferences, likes: toggleChip(draft.preferences.likes, chip) } })}
                              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                              style={on ? { backgroundColor: "rgba(255,69,0,0.12)", border: "1px solid rgba(255,69,0,0.3)", color: "#FF7A00" } : surface}>
                              {chip}
                            </button>
                          );
                        })}
                      </div>
                    </Field>

                    {/* Dislikes */}
                    <Field label="Dislikes">
                      <div className="flex flex-wrap gap-2">
                        {DISLIKE_CHIPS.map((chip) => {
                          const on = draft.preferences.dislikes.includes(chip);
                          return (
                            <button key={chip}
                              onClick={() => setDraft({ ...draft, preferences: { ...draft.preferences, dislikes: toggleChip(draft.preferences.dislikes, chip) } })}
                              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                              style={on ? { backgroundColor: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444" } : surface}>
                              {chip}
                            </button>
                          );
                        })}
                      </div>
                    </Field>

                    {/* Notes */}
                    <Field label="Notes for Aaru">
                      <textarea value={draft.preferences.notes}
                        onChange={(e) => setDraft({ ...draft, preferences: { ...draft.preferences, notes: e.target.value } })}
                        placeholder={`e.g. "Lactose intolerant", "Doesn't eat onions"`}
                        rows={2}
                        className="w-full rounded-xl px-4 py-2.5 text-sm placeholder:opacity-40 focus:outline-none resize-none"
                        style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                      />
                    </Field>

                    {/* Memories (read-only) */}
                    {(draft.memories?.length ?? 0) > 0 && (
                      <Field label="What Aaru has learned">
                        <ul className="space-y-1.5">
                          {draft.memories!.map((m, i) => (
                            <li key={i} className="text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}>
                              🧠 {m}
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Learned from conversations — updates automatically.</p>
                      </Field>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      <button onClick={cancelEdit}
                        className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                        style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                        Cancel
                      </button>
                      <button onClick={saveEdit} disabled={!draft.name.trim()}
                        className="flex-1 py-3 rounded-2xl text-white text-sm font-semibold disabled:opacity-40"
                        style={{ background: "linear-gradient(135deg,#FF4500,#FF7A00)" }}>
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{children}</p>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}>
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{label}</p>
      {children}
    </div>
  );
}
