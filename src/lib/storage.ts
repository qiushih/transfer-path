import type { AcademicProfile } from "@/domain/types";

/**
 * Profiles stay in the browser. Transcript data is a student record, and the
 * app has no server-side store precisely so it never holds one.
 */
const KEY = "transfer-path.profile.v1";

export const EMPTY_PROFILE: AcademicProfile = {
  currentProgram: "",
  calendarYear: "2024-2025",
  attempts: [],
  terms: [],
};

export function loadProfile(): AcademicProfile {
  if (typeof window === "undefined") return EMPTY_PROFILE;
  const stored = window.localStorage.getItem(KEY);
  if (!stored) return EMPTY_PROFILE;
  try {
    return { ...EMPTY_PROFILE, ...(JSON.parse(stored) as AcademicProfile) };
  } catch {
    return EMPTY_PROFILE;
  }
}

export function saveProfile(profile: AcademicProfile): void {
  window.localStorage.setItem(KEY, JSON.stringify(profile));
}

export function clearProfile(): void {
  window.localStorage.removeItem(KEY);
}

/**
 * Lets the tree defer to a client-only render before touching localStorage,
 * so the profile can be read in a state initializer without the server and
 * client producing different markup.
 */
export const mountedStore = {
  subscribe: () => () => {},
  getSnapshot: () => true,
  getServerSnapshot: () => false,
};
