import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { myDashboardQuery } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { ToolDialog, launchTool, type AnyTool } from "@/components/mtools/tool-launcher";
import { ToolCard } from "@/components/mtools/tool-card";
import { EmptyState, ViewToggle, useViewMode } from "@/components/mtools/view-toggle";
import { Search, SlidersHorizontal, Star, Clock3, LayoutGrid, ListFilter, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_CATEGORIES } from "@/lib/tool-meta";
import { ToolIcon } from "@/components/mtools/icon";

const search = z.object({ tool: z.string().optional() });

export const Route = createFileRoute("/_authenticated/tools")({
  validateSearch: search.parse,
  head: () => ({ meta: [{ title: "Инструменты · MTools" }, { name: "description", content: "Все доступные вам инструменты с настройкой размещения." }] }),
  component: ToolsPage,
});

type FilterTab = "all" | "favorites" | "recent";
type SortMode = "smart" | "name" | "category";
const FAVORITES_KEY = "mtools:tools:favorites";
const RECENT_KEY = "mtools:tools:recent";
const MAX_RECENT = 6;

function readStorage(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeStorage(key: string, value: string[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

function ToolsPage() {
  const qc = useQueryClient();
  const { tool } = Route.useSearch();
  const { data: dash } = useSuspenseQuery(myDashboardQuery());
  const [activeTool, setActiveTool] = useState<AnyTool | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortMode>("smart");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const { view, setView, locked } = useViewMode("tools");

  useEffect(() => {
    setFavorites(readStorage(FAVORITES_KEY));
    setRecent(readStorage(RECENT_KEY));
  }, []);

  const markRecent = useCallback((toolId: string) => {
    setRecent((current) => {
      const next = [toolId, ...current.filter((id) => id !== toolId)].slice(0, MAX_RECENT);
      writeStorage(RECENT_KEY, next);
      return next;
    });
  }, []);

  const openTool = useCallback((target: AnyTool) => {
    markRecent(target.id);
    launchTool(target, setActiveTool);
  }, [markRecent]);

  useEffect(() => {
    if (!tool) return;
    const t = dash?.tools.find((x) => x.slug === tool);
    if (t) openTool(t as AnyTool);
  }, [tool, dash, openTool]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current];
      writeStorage(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const setLocation = async (toolId: string, loc: "dashboard" | "sidebar" | "hidden") => {
    const { data: user } = await supabase.auth.getUser();
    const uid = user.user?.id;
    if (!uid) return;
    const existing = dash?.layouts.find((l) => l.tool_id === toolId);
    const { error } = existing
      ? await supabase.from("dashboard_layouts").update({ location: loc }).eq("id", existing.id)
      : await supabase.from("dashboard_layouts").insert({ user_id: uid, tool_id: toolId, location: loc });
    if (error) return toast.error(error.message);
    toast.success("Размещение обновлено");
    qc.invalidateQueries({ queryKey: ["me", "dashboard"] });
  };

  const categories = useMemo(() => {
    const values = new Set<string>([
      ...DEFAULT_CATEGORIES,
      ...(dash?.tools ?? []).map((t) => t.category).filter((value): value is string => Boolean(value)),
    ]);
    return Array.from(values);
  }, [dash]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    const result = (dash?.tools ?? []).filter((t) => {
      if (tab === "favorites" && !favorites.includes(t.id)) return false;
      if (tab === "recent" && !recent.includes(t.id)) return false;
      if (category !== "all" && t.category !== category) return false;
      if (s && !`${t.name} ${t.description ?? ""} ${t.category ?? ""} ${(t.tags ?? []).join(" ")}`.toLowerCase().includes(s)) return false;
      return true;
    });

    return [...result].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "ru");
      if (sort === "category") return (a.category ?? "Другое").localeCompare(b.category ?? "Другое", "ru");
      const recentDiff = recent.indexOf(a.id) - recent.indexOf(b.id);
      const aFav = favorites.includes(a.id) ? 0 : 1;
      const bFav = favorites.includes(b.id) ? 0 : 1;
      if (tab === "recent") return recentDiff;
      if (aFav !== bFav) return aFav - bFav;
      return recentDiff || a.name.localeCompare(b.name, "ru");
    });
  }, [dash, tab, favorites, recent, category, q, sort]);

  const recentTools = useMemo(
    () => recent.map((id) => dash?.tools.find((tool) => tool.id === id)).filter(Boolean).slice(0, MAX_RECENT),
    [dash, recent],
  );

  const favoriteCount = favorites.filter((id) => (dash?.tools ?? []).some((tool) => tool.id === id)).length;
  const recentCount = recent.filter((id) => (dash?.tools ?? []).some((tool) => tool.id === id)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wrench className="h-4 w-4" />
            Рабочая библиотека
          </div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Инструменты</h1>
          <p className="mt-1 text-sm text-muted-foreground">Все необходимые инструменты в одном месте</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1 sm:min-w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск инструмента..." className="h-10 pl-9" />
          </div>
          <ViewToggle view={view} onChange={setView} locked={locked} />
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="edit-mode" className="cursor-pointer text-xs">Настройка</Label>
            <Switch id="edit-mode" checked={editMode} onCheckedChange={setEditMode} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["all", "Все", (dash?.tools ?? []).length, LayoutGrid],
            ["favorites", "Избранное", favoriteCount, Star],
            ["recent", "Недавние", recentCount, Clock3],
          ] as const).map(([value, label, count, Icon]) => (
            <Button
              key={value}
              variant={tab === value ? "secondary" : "outline"}
              className="h-9 gap-2"
              onClick={() => setTab(value)}
              aria-pressed={tab === value}
            >
              <Icon className="h-4 w-4" />
              {label}
              <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[10px]">{count}</span>
            </Button>
          ))}
          <Select value={sort} onValueChange={(value) => setSort(value as SortMode)}>
            <SelectTrigger className="ml-auto h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="smart">Сначала важное</SelectItem>
              <SelectItem value="name">По названию</SelectItem>
              <SelectItem value="category">По категории</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Button variant={category === "all" ? "secondary" : "outline"} size="sm" onClick={() => setCategory("all")} className="shrink-0 gap-2">
            <ListFilter className="h-3.5 w-3.5" /> Все категории
          </Button>
          {categories.map((item) => (
            <Button key={item} variant={category === item ? "secondary" : "outline"} size="sm" onClick={() => setCategory(item)} className="shrink-0">
              {item}
            </Button>
          ))}
        </div>
      </div>

      {tab === "all" && !q && category === "all" && recentTools.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Недавно использованные</h2>
              <p className="text-xs text-muted-foreground">Быстрый возврат к инструментам, которые вы запускали последними</p>
            </div>
            {recentCount > 0 && <Button variant="ghost" size="sm" onClick={() => setTab("recent")}>Все недавние →</Button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {recentTools.map((t) => t && (
              <button
                key={t.id}
                type="button"
                onClick={() => openTool(t as AnyTool)}
                className="group flex min-w-0 items-center gap-3 rounded-xl border bg-card/70 p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background/70"
                  style={{ color: t.color ?? "#1E4FD9", borderColor: `${t.color ?? "#1E4FD9"}30` }}
                >
                  <ToolCardMiniIcon tool={t as any} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{t.name}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">Недавно</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {visible.length === 0 ? (
        <Card><CardContent className="p-8"><EmptyState>{tab === "favorites" ? "В избранном пока ничего нет." : tab === "recent" ? "Недавних запусков пока нет." : q ? "Ничего не найдено. Попробуйте изменить запрос." : "Пока нет доступных инструментов. Обратитесь к администратору для назначения."}</EmptyState></CardContent></Card>
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((t) => {
            const layout = dash!.layouts.find((l) => l.tool_id === t.id);
            const loc = (layout?.location ?? "dashboard") as "dashboard" | "sidebar" | "hidden";
            return (
              <ToolCard
                key={t.id}
                tool={t as AnyTool}
                onOpen={() => openTool(t as AnyTool)}
                favorite={favorites.includes(t.id)}
                onToggleFavorite={() => toggleFavorite(t.id)}
                location={loc}
                onSetLocation={(value) => setLocation(t.id, value)}
                footer={editMode ? (
                  <Select value={loc} onValueChange={(v) => setLocation(t.id, v as "dashboard" | "sidebar" | "hidden")}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dashboard">На дашборде</SelectItem>
                      <SelectItem value="sidebar">В боковом меню</SelectItem>
                      <SelectItem value="hidden">Скрыть</SelectItem>
                    </SelectContent>
                  </Select>
                ) : undefined}
              />
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((t) => {
            const layout = dash!.layouts.find((l) => l.tool_id === t.id);
            const loc = (layout?.location ?? "dashboard") as "dashboard" | "sidebar" | "hidden";
            const color = t.color ?? "#1E4FD9";
            return (
              <div key={t.id} className="group flex flex-col gap-4 rounded-2xl border bg-card/80 p-4 transition hover:border-primary/30 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background/70" style={{ color, borderColor: `${color}30` }}>
                    <ToolCardMiniIcon tool={t as any} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{t.name}</h3>
                      {t.category && <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t.category}</span>}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{t.description || "Инструмент MTools"}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => toggleFavorite(t.id)} aria-label="Избранное">
                    <Star className={`h-4 w-4 ${favorites.includes(t.id) ? "fill-amber-400 text-amber-400" : ""}`} />
                  </Button>
                  <Button onClick={() => openTool(t as AnyTool)} className="gap-2">{t.kind === "external" ? "Открыть" : "Запустить"}</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ToolDialog tool={activeTool} onClose={() => setActiveTool(null)} />
    </div>
  );
}

function ToolCardMiniIcon({ tool }: { tool: any }) {
  return <ToolIcon icon={tool.icon} iconMode={tool.icon_mode} url={tool.url} className="h-5 w-5" />;
}
