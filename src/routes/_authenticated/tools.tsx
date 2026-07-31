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
import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const search = z.object({ tool: z.string().optional() });

export const Route = createFileRoute("/_authenticated/tools")({
  validateSearch: search.parse,
  head: () => ({ meta: [{ title: "Инструменты · MTools" }, { name: "description", content: "Все доступные вам инструменты с настройкой размещения." }] }),
  component: ToolsPage,
});

function ToolsPage() {
  const qc = useQueryClient();
  const { tool } = Route.useSearch();
  const { data: dash } = useSuspenseQuery(myDashboardQuery());
  const [activeTool, setActiveTool] = useState<AnyTool | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [q, setQ] = useState("");

  // Deep link (?tool=slug) opens the tool immediately, without an extra page.
  useEffect(() => {
    if (!tool) return;
    const t = dash?.tools.find((x) => x.slug === tool);
    if (t) launchTool(t as AnyTool, setActiveTool);
  }, [tool, dash]);

  const setLocation = async (toolId: string, loc: "dashboard" | "sidebar" | "hidden") => {
    const { data: user } = await supabase.auth.getUser();
    const uid = user.user!.id;
    const existing = dash?.layouts.find((l) => l.tool_id === toolId);
    if (existing) {
      await supabase.from("dashboard_layouts").update({ location: loc }).eq("id", existing.id);
    } else {
      await supabase.from("dashboard_layouts").insert({ user_id: uid, tool_id: toolId, location: loc });
    }
    toast.success("Размещение обновлено");
    qc.invalidateQueries({ queryKey: ["me", "dashboard"] });
  };

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (dash?.tools ?? []).filter(
      (t) => !s || t.name.toLowerCase().includes(s) || (t.description ?? "").toLowerCase().includes(s),
    );
  }, [dash, q]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">Панель инструментов</h1>
          <p className="text-sm text-muted-foreground">Все необходимые инструменты в одном месте</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск инструмента..." className="pl-9" />
          </div>
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="edit-mode" className="cursor-pointer text-xs">Режим настройки</Label>
            <Switch id="edit-mode" checked={editMode} onCheckedChange={setEditMode} />
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          {q ? "Ничего не найдено." : "Пока нет доступных инструментов. Обратитесь к администратору для назначения."}
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((t) => {
            const layout = dash!.layouts.find((l) => l.tool_id === t.id);
            const loc = layout?.location ?? "dashboard";
            return (
              <ToolCard
                key={t.id}
                tool={t as AnyTool}
                onOpen={() => launchTool(t as AnyTool, setActiveTool)}
                footer={
                  editMode ? (
                    <Select value={loc} onValueChange={(v) => setLocation(t.id, v as any)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dashboard">На дашборде</SelectItem>
                        <SelectItem value="sidebar">В боковом меню</SelectItem>
                        <SelectItem value="hidden">Скрыть</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
      <ToolDialog tool={activeTool} onClose={() => setActiveTool(null)} />
    </div>
  );
}