import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function DynIcon({ name, className }: { name?: string | null; className?: string }) {
  const Comp = (name && (Icons as unknown as Record<string, LucideIcon>)[name]) || Icons.Wrench;
  return <Comp className={className} />;
}

export function faviconUrl(url?: string | null, size = 128) {
  if (!url) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=${size}`;
  } catch {
    return null;
  }
}

/** Renders either a lucide icon or the site favicon, depending on the tool's icon_mode. */
export function ToolIcon({
  icon,
  iconMode,
  url,
  className = "h-5 w-5",
}: {
  icon?: string | null;
  iconMode?: string | null;
  url?: string | null;
  className?: string;
}) {
  const fav = iconMode === "favicon" ? faviconUrl(url) : null;
  if (fav) return <img src={fav} alt="" className={`${className} rounded-sm object-contain`} loading="lazy" />;
  return <DynIcon name={icon} className={className} />;
}
