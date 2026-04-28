import { PersonProfile, PastOrder } from "./types";

const STORAGE_KEY = "aaru_profiles";

export function getAllProfiles(): PersonProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProfile(profile: PersonProfile): void {
  const profiles = getAllProfiles();
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.push(profile);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function deleteProfile(id: string): void {
  const profiles = getAllProfiles().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function addPastOrder(profileId: string, order: PastOrder): void {
  const profiles = getAllProfiles();
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return;
  // Prepend new order, keep latest 20
  profile.pastOrders = [order, ...profile.pastOrders].slice(0, 20);
  saveProfile(profile);
}

export function addMemory(profileId: string, fact: string): void {
  const profiles = getAllProfiles();
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return;
  const existing = profile.memories ?? [];
  if (existing.some((m) => m.toLowerCase() === fact.toLowerCase())) return;
  profile.memories = [fact, ...existing].slice(0, 30);
  saveProfile(profile);
}

export function setMemories(profileId: string, memories: string[]): void {
  const profiles = getAllProfiles();
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return;
  profile.memories = memories.slice(0, 30);
  saveProfile(profile);
}

export function newProfileId(): string {
  return `person_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
