import { LayoutGrid, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export type ViewMode = "cards" | "table";

/** Shared card/table switch so every admin list behaves the same way. */
export function useViewMode(storageKey: string) {
  const isMobile = useIsMobile();
  const [stored, setStored] = useState<ViewMode>("cards");

  useEffect(() => {
    const v = localStorage.getItem(`mtools:view:${storageKey}`);
    if (v === "cards" || v === "table") setStored(v);
  }, [storageKey]);

  const setView = (v: ViewMode) => {
    setStored(v);
    localStorage.setItem(`mtools:view:${storageKey}`, v);
  };

  // Tables are unusable on narrow screens — always fall back to cards there.
  return { view: isMobile ? ("cards" as ViewMode) : stored, setView, locked: isMobile };
}

export function ViewToggle({
  view,
  onChange,
  locked,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
  locked?: boolean;
}) {
  if (locked) return null;
  return (
    <div className="flex rounded-md border p-0.5">
      <Button
        variant={view === "cards" ? "secondary" : "ghost"}
        size="sm"
        className="h-8 gap-1.5 px-2.5"
        onClick={() => onChange("cards")}
        aria-pressed={view === "cards"}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden lg:inline">Карточки</span>
      </Button>
      <Button
        variant={view === "table" ? "secondary" : "ghost"}
        size="sm"
        className="h-8 gap-1.5 px-2.5"
        onClick={() => onChange("table")}
        aria-pressed={view === "table"}
      >
        <TableIcon className="h-4 w-4" />
        <span className="hidden lg:inline">Таблица</span>
      </Button>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>
  );
}
