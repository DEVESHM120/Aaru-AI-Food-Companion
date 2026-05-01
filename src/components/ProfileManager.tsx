"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PersonAddress, PersonProfile } from "@/lib/profiles/types";
import { deleteProfile, getAllProfiles, newProfileId, saveProfile } from "@/lib/profiles/store";

interface ProfileManagerProps {
  activeProfile: PersonProfile | null;
  profiles: PersonProfile[];
  preloadedAddresses?: { address_id: string; location_name: string }[];
  swiggyToken?: string;
  onProfileChange: (profile: PersonProfile) => void;
  onAllProfilesChange: (profiles: PersonProfile[]) => void;
}

const DIETS = [
  { value: "veg", label: "Veg" },
  { value: "nonveg", label: "Non-veg" },
  { value: "both", label: "Both" },
] as const;

const BUDGETS = [
  { value: "budget", label: "Budget" },
  { value: "mid", label: "Mid" },
  { value: "premium", label: "Premium" },
] as const;

const LIKE_CHIPS = ["Spicy", "Cheesy", "Healthy", "Biryani", "North Indian", "South Indian", "Chinese", "Pizza", "Burger", "Desserts"];
const DISLIKE_CHIPS = ["Idli", "Dosa", "Sweets", "Too Oily", "South Indian", "Chinese", "Junk Food"];

function extractCity(locationName: string) {
  const parts = locationName.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? "";
}

function blankProfile(name: string): PersonProfile {
  return {
    id: newProfileId(),
    name,
    addresses: [],
    preferences: { likes: [], dislikes: [], diet: "both", priceRange: "mid", notes: "" },
    pastOrders: [],
    memories: [],
  };
}

function cloneProfile(profile: PersonProfile): PersonProfile {
  return {
    ...profile,
    addresses: [...profile.addresses],
    pastOrders: [...profile.pastOrders],
    memories: [...(profile.memories ?? [])],
    preferences: {
      ...profile.preferences,
      likes: [...profile.preferences.likes],
      dislikes: [...profile.preferences.dislikes],
    },
  };
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function ProfileManager({
  activeProfile,
  profiles,
  preloadedAddresses = [],
  swiggyToken,
  onProfileChange,
  onAllProfilesChange,
}: ProfileManagerProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PersonProfile | null>(null);
  const [newPersonName, setNewPersonName] = useState("");
  const [manualLabel, setManualLabel] = useState("Home");
  const [manualAddress, setManualAddress] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [syncedAddresses, setSyncedAddresses] = useState<{ address_id: string; location_name: string }[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => setMounted(true), []);

  const addressOptions = useMemo(() => {
    const seen = new Set<string>();
    return [...syncedAddresses, ...preloadedAddresses].filter((address) => {
      const key = address.address_id || address.location_name;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [preloadedAddresses, syncedAddresses]);

  const shownProfiles = profiles.length > 0 ? profiles : activeProfile ? [activeProfile] : [];

  function persistProfiles(nextActive?: PersonProfile) {
    const latest = getAllProfiles();
    onAllProfilesChange(latest);
    if (nextActive) onProfileChange(nextActive);
  }

  function startEdit(profile: PersonProfile) {
    setDraft(cloneProfile(profile));
  }

  function addPerson() {
    const name = newPersonName.trim();
    if (!name) return;
    const profile = blankProfile(name);
    saveProfile(profile);
    setNewPersonName("");
    setDraft(cloneProfile(profile));
    persistProfiles(profile);
  }

  function saveDraft() {
    if (!draft?.name.trim()) return;
    const cleanDraft = {
      ...draft,
      name: draft.name.trim(),
      defaultAddressId: draft.defaultAddressId ?? draft.addresses[0]?.addressId,
    };
    saveProfile(cleanDraft);
    setDraft(null);
    persistProfiles(cleanDraft.id === activeProfile?.id ? cleanDraft : undefined);
  }

  function removeProfile(profile: PersonProfile) {
    deleteProfile(profile.id);
    const remaining = getAllProfiles();
    onAllProfilesChange(remaining);
    if (activeProfile?.id === profile.id && remaining[0]) onProfileChange(remaining[0]);
    setDraft(null);
  }

  async function syncSwiggyAddresses() {
    if (!swiggyToken || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch("/api/swiggy/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: swiggyToken }),
      });
      const data = await res.json();
      const addresses = Array.isArray(data.addresses) ? data.addresses : [];
      setSyncedAddresses(
        addresses
          .map((address: Record<string, string>, index: number) => ({
            address_id: address.address_id ?? address.id ?? `swiggy_${index}`,
            location_name: address.address ?? address.formatted_address ?? address.locationName ?? address.location_name ?? "",
          }))
          .filter((address: { address_id: string; location_name: string }) => address.address_id && address.location_name)
      );
    } catch {
      // Manual addresses remain available when sync fails.
    } finally {
      setIsSyncing(false);
    }
  }

  function addExistingAddress(option: { address_id: string; location_name: string }) {
    if (!draft) return;
    if (draft.addresses.some((address) => address.addressId === option.address_id)) return;
    const address: PersonAddress = {
      addressId: option.address_id,
      label: draft.addresses.length === 0 ? "Home" : `Address ${draft.addresses.length + 1}`,
      locationName: option.location_name,
      city: extractCity(option.location_name),
    };
    setDraft({
      ...draft,
      addresses: [...draft.addresses, address],
      defaultAddressId: draft.defaultAddressId ?? address.addressId,
    });
  }

  function addManualAddress() {
    if (!draft || !manualAddress.trim()) return;
    const address: PersonAddress = {
      addressId: `manual_${Date.now()}`,
      label: manualLabel.trim() || "Address",
      locationName: manualAddress.trim(),
      city: manualCity.trim() || extractCity(manualAddress),
    };
    setDraft({
      ...draft,
      addresses: [...draft.addresses, address],
      defaultAddressId: draft.defaultAddressId ?? address.addressId,
    });
    setManualLabel("Home");
    setManualAddress("");
    setManualCity("");
  }

  function updateAddress(addressId: string, patch: Partial<PersonAddress>) {
    if (!draft) return;
    setDraft({
      ...draft,
      addresses: draft.addresses.map((address) => address.addressId === addressId ? { ...address, ...patch } : address),
    });
  }

  function removeAddress(addressId: string) {
    if (!draft) return;
    const addresses = draft.addresses.filter((address) => address.addressId !== addressId);
    setDraft({
      ...draft,
      addresses,
      defaultAddressId: draft.defaultAddressId === addressId ? addresses[0]?.addressId : draft.defaultAddressId,
    });
  }

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[1000] flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
            onClick={() => {
              setOpen(false);
              setDraft(null);
            }}
          />

          <motion.section
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="relative w-full max-w-[560px] rounded-t-3xl"
            style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)", maxHeight: "92dvh" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-center pt-3">
              <div className="h-1 w-10 rounded-full" style={{ backgroundColor: "var(--border)" }} />
            </div>

            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>People & Preferences</h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Profiles, addresses, and food rules for ordering.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setDraft(null);
                }}
                className="rounded-full px-3 py-2 text-sm"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(92dvh-92px)] overflow-y-auto px-5 pb-6 pt-4">
              {!draft ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    {shownProfiles.map((profile) => {
                      const selected = activeProfile?.id === profile.id;
                      const defaultAddress = profile.addresses.find((address) => address.addressId === profile.defaultAddressId) ?? profile.addresses[0];
                      return (
                        <div
                          key={profile.id}
                          className="rounded-2xl p-4"
                          style={{
                            backgroundColor: "var(--surface)",
                            border: selected ? "2px solid rgba(255,69,0,0.45)" : "1px solid var(--border)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-bold" style={{ color: "var(--text)" }}>{profile.name}</p>
                              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                                {profile.preferences.diet} · {profile.preferences.priceRange} · {profile.addresses.length} address{profile.addresses.length === 1 ? "" : "es"}
                              </p>
                              {defaultAddress && (
                                <p className="mt-1 line-clamp-1 text-xs" style={{ color: "var(--text-muted)" }}>
                                  Default: {defaultAddress.label} - {defaultAddress.locationName}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 gap-2">
                              {!selected && (
                                <button
                                  type="button"
                                  onClick={() => onProfileChange(profile)}
                                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                                  style={{ color: "#FF7A00", backgroundColor: "rgba(255,122,0,0.1)" }}
                                >
                                  Use
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => startEdit(profile)}
                                className="rounded-full px-3 py-1.5 text-xs"
                                style={{ color: "var(--text)", border: "1px solid var(--border)" }}
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                          <ProfileSummary profile={profile} />
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                    <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Add a person</p>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={newPersonName}
                        onChange={(event) => setNewPersonName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") addPerson();
                        }}
                        placeholder="Name, e.g. Divya"
                        className="min-w-0 flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                        style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                      />
                      <button
                        type="button"
                        onClick={addPerson}
                        disabled={!newPersonName.trim()}
                        className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                        style={{ background: "linear-gradient(135deg,#FF4500,#FF7A00)" }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <EditProfile
                  draft={draft}
                  addressOptions={addressOptions}
                  swiggyToken={swiggyToken}
                  isSyncing={isSyncing}
                  manualLabel={manualLabel}
                  manualAddress={manualAddress}
                  manualCity={manualCity}
                  onDraftChange={setDraft}
                  onBack={() => setDraft(null)}
                  onSave={saveDraft}
                  onDelete={() => removeProfile(draft)}
                  onSyncSwiggy={syncSwiggyAddresses}
                  onAddExistingAddress={addExistingAddress}
                  onAddManualAddress={addManualAddress}
                  onManualLabelChange={setManualLabel}
                  onManualAddressChange={setManualAddress}
                  onManualCityChange={setManualCity}
                  onUpdateAddress={updateAddress}
                  onRemoveAddress={removeAddress}
                />
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
        style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
      >
        <span>People</span>
        <span className="max-w-[86px] truncate">{activeProfile?.name ?? ""}</span>
      </button>
      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}

function ProfileSummary({ profile }: { profile: PersonProfile }) {
  return (
    <div className="mt-3 space-y-1">
      {profile.preferences.likes.length > 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Likes: {profile.preferences.likes.join(", ")}</p>}
      {profile.preferences.dislikes.length > 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Dislikes: {profile.preferences.dislikes.join(", ")}</p>}
      {(profile.memories?.length ?? 0) > 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Memory: {profile.memories![0]}</p>}
    </div>
  );
}

function EditProfile({
  draft,
  addressOptions,
  swiggyToken,
  isSyncing,
  manualLabel,
  manualAddress,
  manualCity,
  onDraftChange,
  onBack,
  onSave,
  onDelete,
  onSyncSwiggy,
  onAddExistingAddress,
  onAddManualAddress,
  onManualLabelChange,
  onManualAddressChange,
  onManualCityChange,
  onUpdateAddress,
  onRemoveAddress,
}: {
  draft: PersonProfile;
  addressOptions: { address_id: string; location_name: string }[];
  swiggyToken?: string;
  isSyncing: boolean;
  manualLabel: string;
  manualAddress: string;
  manualCity: string;
  onDraftChange: (profile: PersonProfile) => void;
  onBack: () => void;
  onSave: () => void;
  onDelete: () => void;
  onSyncSwiggy: () => void;
  onAddExistingAddress: (address: { address_id: string; location_name: string }) => void;
  onAddManualAddress: () => void;
  onManualLabelChange: (value: string) => void;
  onManualAddressChange: (value: string) => void;
  onManualCityChange: (value: string) => void;
  onUpdateAddress: (addressId: string, patch: Partial<PersonAddress>) => void;
  onRemoveAddress: (addressId: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded-full px-3 py-1.5 text-xs" style={{ border: "1px solid var(--border)", color: "var(--text)" }}>Back</button>
        <h3 className="min-w-0 flex-1 truncate font-bold" style={{ color: "var(--text)" }}>Edit {draft.name}</h3>
        <button type="button" onClick={onDelete} className="rounded-full px-3 py-1.5 text-xs" style={{ color: "#EF4444", border: "1px solid rgba(239,68,68,0.35)" }}>Delete</button>
      </div>

      <Field label="Name">
        <input value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
      </Field>

      <Field label="Diet">
        <div className="grid grid-cols-3 gap-2">
          {DIETS.map((diet) => <Choice key={diet.value} active={draft.preferences.diet === diet.value} onClick={() => onDraftChange({ ...draft, preferences: { ...draft.preferences, diet: diet.value } })}>{diet.label}</Choice>)}
        </div>
      </Field>

      <Field label="Budget">
        <div className="grid grid-cols-3 gap-2">
          {BUDGETS.map((budget) => <Choice key={budget.value} active={draft.preferences.priceRange === budget.value} onClick={() => onDraftChange({ ...draft, preferences: { ...draft.preferences, priceRange: budget.value } })}>{budget.label}</Choice>)}
        </div>
      </Field>

      <Field label="Likes">
        <ChipGrid values={LIKE_CHIPS} selected={draft.preferences.likes} onToggle={(value) => onDraftChange({ ...draft, preferences: { ...draft.preferences, likes: toggleValue(draft.preferences.likes, value) } })} />
      </Field>

      <Field label="Dislikes">
        <ChipGrid values={DISLIKE_CHIPS} selected={draft.preferences.dislikes} danger onToggle={(value) => onDraftChange({ ...draft, preferences: { ...draft.preferences, dislikes: toggleValue(draft.preferences.dislikes, value) } })} />
      </Field>

      <Field label="Notes">
        <textarea value={draft.preferences.notes} onChange={(event) => onDraftChange({ ...draft, preferences: { ...draft.preferences, notes: event.target.value } })} placeholder="Anything Aaru should remember for recommendations" rows={3} className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
      </Field>

      <Field label="Saved addresses">
        <div className="space-y-2">
          {draft.addresses.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>No address saved yet. Add one below before ordering for this person.</p>}
          {draft.addresses.map((address) => (
            <div key={address.addressId} className="rounded-xl p-3" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex gap-2">
                <input value={address.label} onChange={(event) => onUpdateAddress(address.addressId, { label: event.target.value })} className="w-24 rounded-lg px-2 py-1.5 text-xs outline-none" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }} />
                <button type="button" onClick={() => onDraftChange({ ...draft, defaultAddressId: address.addressId })} className="rounded-lg px-2 py-1.5 text-xs" style={draft.defaultAddressId === address.addressId ? { backgroundColor: "#FF7A00", color: "#fff" } : { color: "var(--text-muted)", border: "1px solid var(--border)" }}>Default</button>
                <button type="button" onClick={() => onRemoveAddress(address.addressId)} className="ml-auto rounded-lg px-2 py-1.5 text-xs" style={{ color: "#EF4444" }}>Remove</button>
              </div>
              <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{address.locationName}</p>
              <input value={address.city} onChange={(event) => onUpdateAddress(address.addressId, { city: event.target.value })} placeholder="City" className="mt-2 w-full rounded-lg px-2 py-1.5 text-xs outline-none" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }} />
            </div>
          ))}
        </div>
      </Field>

      <Field label="Add from available addresses">
        {swiggyToken && <button type="button" onClick={onSyncSwiggy} disabled={isSyncing} className="mb-2 w-full rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50" style={{ color: "#FC8019", border: "1px solid rgba(252,128,25,0.35)", backgroundColor: "rgba(252,128,25,0.08)" }}>{isSyncing ? "Checking Swiggy addresses..." : "Check available Swiggy addresses"}</button>}
        <div className="space-y-2">
          {addressOptions.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>No imported addresses yet. Add manually below.</p>}
          {addressOptions.map((address) => <button key={address.address_id} type="button" onClick={() => onAddExistingAddress(address)} className="w-full rounded-xl p-3 text-left text-xs" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{address.location_name}</button>)}
        </div>
      </Field>

      <Field label="Add manual address">
        <div className="grid grid-cols-2 gap-2">
          <input value={manualLabel} onChange={(event) => onManualLabelChange(event.target.value)} placeholder="Label" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
          <input value={manualCity} onChange={(event) => onManualCityChange(event.target.value)} placeholder="City" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
        </div>
        <textarea value={manualAddress} onChange={(event) => onManualAddressChange(event.target.value)} placeholder="Full address / area" rows={2} className="mt-2 w-full resize-none rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
        <button type="button" onClick={onAddManualAddress} disabled={!manualAddress.trim()} className="mt-2 w-full rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#FF4500,#FF7A00)" }}>Add address</button>
      </Field>

      {(draft.memories?.length ?? 0) > 0 && (
        <Field label="Aaru memory">
          <div className="space-y-1">
            {draft.memories!.slice(0, 6).map((memory, index) => <p key={`${memory}-${index}`} className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "var(--surface)", color: "var(--text-muted)" }}>{memory}</p>)}
          </div>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2 pb-2">
        <button type="button" onClick={onBack} className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ border: "1px solid var(--border)", color: "var(--text)" }}>Cancel</button>
        <button type="button" onClick={onSave} disabled={!draft.name.trim()} className="rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#FF4500,#FF7A00)" }}>Save profile</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p>
      {children}
    </div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl px-3 py-2 text-sm font-semibold" style={active ? { background: "linear-gradient(135deg,#FF4500,#FF7A00)", color: "#fff" } : { color: "var(--text-muted)", border: "1px solid var(--border)", backgroundColor: "var(--surface-2)" }}>
      {children}
    </button>
  );
}

function ChipGrid({ values, selected, danger, onToggle }: { values: string[]; selected: string[]; danger?: boolean; onToggle: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => {
        const active = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={active
              ? { color: danger ? "#EF4444" : "#FF7A00", backgroundColor: danger ? "rgba(239,68,68,0.12)" : "rgba(255,122,0,0.12)", border: `1px solid ${danger ? "rgba(239,68,68,0.35)" : "rgba(255,122,0,0.35)"}` }
              : { color: "var(--text-muted)", backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}
