import { ToolIcon } from "@/components/mtools/icon";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronDown, ExternalLink, LifeBuoy, Star, Unlink } from "lucide-react";
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
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-card transition ${
        unavailable ? "opacity-70" : "hover:-translate-y-[3px] hover:shadow-lg"
      }`}
      style={{ borderColor: `${color}33` }}
    >
      <div className="p-5 pb-4" style={{ backgroundImage: `linear-gradient(135deg, ${color}22, ${color}0a)` }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm transition ${
                unavailable ? "text-muted-foreground" : "group-hover:scale-105 group-hover:-rotate-2"
              }`}
              style={unavailable ? undefined : { color }}
            >
              {st.key === "unavailable" ? (
                <Unlink className="h-5 w-5" />
              ) : (
                <ToolIcon icon={tool.icon} iconMode={tool.icon_mode} url={tool.url} className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{tool.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${st.dot}`} />
                {st.label} · {access}
              </p>
            </div>
          </div>
          {onToggleFavorite && (
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-label={favorite ? "Убрать из «Мои инструменты»" : "В «Мои инструменты»"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-background/60 hover:text-foreground"
            >
              <Star className={`h-4 w-4 ${favorite ? "fill-amber-400 text-amber-400" : ""}`} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5">
        <div className="mb-2.5 mt-3 flex flex-wrap gap-1.5">
          {tool.category && (
            <span className="rounded-md bg-primary/10 px-2.5 py-0.5 text-xs text-primary">{tool.category}</span>
          )}
          {tags.map((t) => (
            <span key={t} className="rounded-md bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{t}</span>
          ))}
        </div>

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
              className="mt-3 flex w-full items-center justify-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground"
            >
              Возможности <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
            </button>
            <div
              ref={panel}
              className="overflow-hidden transition-[max-height] duration-200"
              style={{ maxHeight: open ? (panel.current?.scrollHeight ?? 400) : 0 }}
            >
              <ul className="my-2 list-disc pl-5 text-[13px] leading-7 text-muted-foreground">
                {features.map((f, i) => <li key={i}>{f}</li>)}
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
            <Button onClick={onOpen} className="w-full gradient-brand text-white">
              Открыть {tool.kind === "external" && <ExternalLink className="ml-2 h-3.5 w-3.5" />}
            </Button>
          )}
        </div>

        {footer && <div className="mt-4 border-t pt-3">{footer}</div>}
      </div>
    </div>
  );
}
