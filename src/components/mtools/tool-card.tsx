import { ToolIcon } from "@/components/mtools/icon";
import { Button } from "@/components/ui/button";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { AnyTool } from "@/components/mtools/tool-launcher";

export type ToolLike = AnyTool & {
  icon?: string | null;
  icon_mode?: string | null;
  color?: string | null;
  category?: string | null;
};

/** Big gradient tool tile — the whole card is a button in normal mode. */
export function ToolCard({
  tool,
  onOpen,
  footer,
}: {
  tool: ToolLike;
  onOpen: () => void;
  footer?: React.ReactNode;
}) {
  const color = tool.color ?? "#1E4FD9";
  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        backgroundImage: `linear-gradient(135deg, ${color}2e, ${color}08 55%, transparent)`,
        borderColor: `${color}33`,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Открыть ${tool.name}`}
        className="absolute inset-0 z-0 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div
        className="pointer-events-none relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm"
        style={{ backgroundImage: `linear-gradient(135deg, ${color}, ${color}bb)` }}
      >
        <ToolIcon icon={tool.icon} iconMode={tool.icon_mode} url={tool.url} className="h-7 w-7" />
      </div>
      <div className="pointer-events-none relative z-10 mt-4 min-w-0">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="truncate">{tool.name}</span>
          {tool.kind === "external" && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        </div>
        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
          {tool.description || "Откройте инструмент в один клик"}
        </p>
      </div>
      <div className="relative z-10 mt-4 flex items-end justify-between gap-2">
        <Button size="sm" variant="secondary" onClick={onOpen} className="relative z-20">
          Открыть
        </Button>
        <span
          className="pointer-events-none flex h-9 w-9 items-center justify-center rounded-full border transition group-hover:translate-x-0.5"
          style={{ borderColor: `${color}55`, color }}
        >
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
      {footer && <div className="relative z-20 mt-4 border-t pt-3">{footer}</div>}
    </div>
  );
}