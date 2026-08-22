/** Deterministic avatar colors + initials so identically named people stay distinguishable. */
export const AVATAR_COLORS = [
  "#1E4FD9",
  "#22C55E",
  "#A855F7",
  "#F59E0B",
  "#06B6D4",
  "#EC4899",
  "#F97316",
  "#6366F1",
];

export function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function avatarColor(seed?: string | null) {
  return AVATAR_COLORS[hashString((seed ?? "?").toLowerCase()) % AVATAR_COLORS.length];
}

export function initials(name?: string | null, email?: string | null) {
  const src = (name ?? "").trim();
  if (src) {
    const parts = src.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]!.toUpperCase()).join("");
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
}
