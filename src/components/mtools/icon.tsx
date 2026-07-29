import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function DynIcon({ name, className }: { name?: string | null; className?: string }) {
  const Comp = (name && (Icons as unknown as Record<string, LucideIcon>)[name]) || Icons.Wrench;
  return <Comp className={className} />;
}