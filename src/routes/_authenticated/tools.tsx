import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { myDashboardQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DynIcon } from "@/components/mtools/icon";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Calculator, PasswordGen, UnitConverter, Notes, Pomodoro } from "@/components/mtools/mini-tools";
import { ExternalLink } from "lucide-react";

const search = z.object({ tool: z.string().optional() });

export const Route = createFileRoute("/_authenticated/tools")({
  validateSearch: search.parse,
  head: () => ({ meta: [{ title: "Инструменты · MTools" }, { name: "description", content: "Все доступные вам инструменты с настройкой размещения." }] }),
  component: ToolsPage,
});

const InlineTools: Record<string, React.FC> = {
  calculator: Calculator,
  "password-gen": PasswordGen,
  "unit-converter": UnitConverter,
  notes: Notes,
  pomodoro: Pomodoro,
};

function ToolsPage() {
  const qc = useQueryClient();
  const { tool } = Route.useSearch();
  const { data: dash } = useSuspenseQuery(myDashboardQuery());

  const activeTool = tool ? dash?.tools.find((t) => t.slug === tool) : null;
  const Inline = activeTool ? InlineTools[activeTool.slug] : null;

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

  if (activeTool) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => history.back()}>← Назад</Button>
          <h1 className="text-2xl font-bold">{activeTool.name}</h1>
        </div>
        {activeTool.kind === "external" && activeTool.url ? (
          <Card><CardContent className="flex items-center justify-between p-6">
            <div><div className="font-medium">{activeTool.name}</div><div className="text-sm text-muted-foreground">{activeTool.description}</div></div>
            <Button asChild className="gradient-brand text-white"><a href={activeTool.url} target="_blank" rel="noreferrer">Открыть <ExternalLink className="ml-2 h-4 w-4" /></a></Button>
          </CardContent></Card>
        ) : Inline ? (
          <div className="mx-auto max-w-2xl"><Inline /></div>
        ) : (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Инструмент подключён, но пока не имеет встроенного интерфейса.</CardContent></Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Инструменты</h1>
        <p className="text-sm text-muted-foreground">Выберите, где отображать инструмент: на дашборде, в боковом меню или скрыть.</p>
      </div>

      {dash!.tools.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Пока нет доступных инструментов. Обратитесь к администратору для назначения.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dash!.tools.map((t) => {
            const layout = dash!.layouts.find((l) => l.tool_id === t.id);
            const loc = layout?.location ?? "dashboard";
            return (
              <Card key={t.id} className="transition hover:shadow-md">
                <CardHeader className="flex flex-row items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: (t.color ?? "#1E4FD9") + "22", color: t.color ?? "#1E4FD9" }}>
                    <DynIcon name={t.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                    {t.kind === "external" && <Badge variant="secondary" className="text-[10px]">Внешний</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={loc} onValueChange={(v) => setLocation(t.id, v as any)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dashboard">На дашборде</SelectItem>
                        <SelectItem value="sidebar">В боковом меню</SelectItem>
                        <SelectItem value="hidden">Скрыть</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button asChild size="sm" variant="outline"><a href={`/tools?tool=${t.slug}`}>Открыть</a></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}