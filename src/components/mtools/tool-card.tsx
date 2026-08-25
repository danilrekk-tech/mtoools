import { ToolIcon } from "@/components/mtools/icon";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowUpRight, ChevronDown, ExternalLink, LifeBuoy, Star, Unlink } from "lucide-react";
import { useRef, useState } from "react";
import { statusMeta } from "@/lib/tool-meta";
import type { AnyTool } from "@/components/mtools/tool-launcher";

export type ToolLike = AnyTool & {
  icon?: string | null;
  icon_mode?: string | null;
  color?: string | null;
  category?: string | null;
  tags?: string[] | null;
  features?: string[] | null;
  status?: string | null;
  is_active?: boolean | null;
  last_checked_at?: string | null;
};

export function ToolCard({
  tool,
  onOpen,
  footer,
  favorite,
  onToggleFavorite,
}: {
  tool: ToolLike;
  onOpen: () => void;
  footer?: React.ReactNode;
  favorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const color = tool.color ?? "#1E4FD9";
  const st = statusMeta(tool);
  const unavailable = st.key === "unavailable" || st.key === "disabled";
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const features = (tool.features ?? []).filter(Boolean);
  const tags = (tool.tags ?? []).filter(Boolean).slice(0, 2);
  const access = tool.kind === "external" ? "внешний" : "внутренний";

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-300 ${
        unavailable
          ? "opacity-70 saturate-50"
          : "hover:-translate-y-1 hover:border-transparent hover:shadow-[0_18px_40px_-18px_var(--tool-glow)]"
      }`}
      style={
        {
          borderColor: `${color}30`,
          ["--tool-glow" as string]: `${color}88`,
        } as React.CSSProperties
      }
    >
      {/* accent rail */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 opacity-70 transition-opacity group-hover:opacity-100"
        style={{ backgroundImage: `linear-gradient(90deg, ${color}, ${color}55 70%, transparent)` }}
      />

      <div
        className="relative p-5 pb-4"
        style={{ backgroundImage: `radial-gradient(120% 130% at 0% 0%, ${color}2e, transparent 70%)` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-background/80 shadow-sm backdrop-blur transition-transform duration-300 ${
                unavailable ? "text-muted-foreground" : "group-hover:-rotate-3 group-hover:scale-110"
              }`}
              style={unavailable ? undefined : { color, borderColor: `${color}33`, boxShadow: `0 6px 18px -10px ${color}` }}
            >
              {st.key === "unavailable" ? (
                <Unlink className="h-5 w-5" />
              ) : (
                <ToolIcon icon={tool.icon} iconMode={tool.icon_mode} url={tool.url} className="h-6 w-6" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-tight">{tool.name}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="relative flex h-1.5 w-1.5">
                  {!unavailable && (
                    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${st.dot}`} />
                  )}
                  <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${st.dot}`} />
                </span>
                {st.label} · {access}
              </p>
            </div>
          </div>
          {onToggleFavorite && (
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-label={favorite ? "Убрать из «Мои инструменты»" : "В «Мои инструменты»"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-background/70 hover:text-foreground"
            >
              <Star className={`h-4 w-4 transition ${favorite ? "scale-110 fill-amber-400 text-amber-400" : ""}`} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5">
        {(tool.category || tags.length > 0) && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {tool.category && (
              <span
                className="rounded-md px-2.5 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: `${color}1a`, color }}
              >
                {tool.category}
              </span>
            )}
            {tags.map((t) => (
              <span key={t} className="rounded-md bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">{t}</span>
            ))}
          </div>
        )}

        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {tool.description || "Откройте инструмент в один клик"}
        </p>

        {st.key === "unavailable" && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Сервис не отвечает
              {tool.last_checked_at && (
                <span className="block text-destructive/80">
                  Последняя проверка: {new Date(tool.last_checked_at).toLocaleString("ru-RU")}
                </span>
              )}
            </span>
          </div>
        )}

        {features.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-1 text-[13px] text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            >
              Возможности <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
            </button>
            <div
              ref={panel}
              className="overflow-hidden transition-[max-height] duration-300"
              style={{ maxHeight: open ? (panel.current?.scrollHeight ?? 400) : 0 }}
            >
              <ul className="my-2 space-y-1 text-[13px] leading-6 text-muted-foreground">
                {features.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <div className="mt-auto pt-4">
          {unavailable ? (
            <div className="space-y-2">
              <Button className="w-full" disabled>Недоступно</Button>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href="/telegram"><LifeBuoy className="mr-2 h-3.5 w-3.5" />Сообщить в поддержку</a>
              </Button>
            </div>
          ) : (
            <Button
              onClick={onOpen}
              className="group/btn w-full border-0 text-white shadow-sm transition-shadow hover:shadow-md"
              style={{ backgroundImage: `linear-gradient(135deg, ${color}, ${color}b3)` }}
            >
              Открыть
              {tool.kind === "external" ? (
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              ) : (
                <ArrowUpRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
              )}
            </Button>
          )}
        </div>

        {footer && <div className="mt-4 border-t pt-3">{footer}</div>}
      </div>
    </div>
  );
}
