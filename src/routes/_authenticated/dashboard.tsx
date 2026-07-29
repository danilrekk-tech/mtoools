import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { profileQuery, myDashboardQuery, tasksQuery, activeTimeEntryQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DynIcon } from "@/components/mtools/icon";
import { Timer, Play, Square, ArrowUpRight, ListTodo, Users, Layers, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Главная · MTools" },
      { name: "description", content: "Панель сотрудника MTools: задачи, инструменты, учёт времени." },
    ],
  }),
  component: Dashboard,
});

function useTicker(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function fmt(sec: number) {
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function Dashboard() {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(profileQuery());
  const { data: dash } = useSuspenseQuery(myDashboardQuery());
  const { data: tasks } = useSuspenseQuery(tasksQuery());
  const { data: active } = useSuspenseQuery(activeTimeEntryQuery());
  const now = useTicker(!!active);
  const secs = active ? Math.floor((now - new Date(active.started_at).getTime()) / 1000) : 0;

  const dashboardTools = useMemo(() => {
    const layoutMap = new Map((dash?.layouts ?? []).map((l) => [l.tool_id, l]));
    return (dash?.tools ?? [])
      .filter((t) => {
        const l = layoutMap.get(t.id);
        return !l || l.location === "dashboard";
      })
      .sort((a, b) => (layoutMap.get(a.id)?.position ?? 0) - (layoutMap.get(b.id)?.position ?? 0));
  }, [dash]);

  const toggleTimer = async () => {
    if (active) {
      const dur = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000);
      await supabase.from("time_entries").update({ ended_at: new Date().toISOString(), duration_seconds: dur }).eq("id", active.id);
      toast.success("Смена завершена");
    } else {
      await supabase.from("time_entries").insert({ user_id: me!.user.id, started_at: new Date().toISOString() });
      toast.success("Таймер запущен");
    }
    qc.invalidateQueries({ queryKey: ["me", "time-entry"] });
  };

  const openTasks = tasks.filter((t) => t.status !== "done");
  const doneToday = tasks.filter((t) => t.status === "done").length;
  const greeting = new Date().getHours() < 12 ? "Доброе утро" : new Date().getHours() < 18 ? "Добрый день" : "Добрый вечер";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">
            {greeting}, {me?.profile?.full_name?.split(" ")[0] ?? "коллега"} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {me?.profile?.department ? `Отдел: ${(me!.profile.department as any).name}` : "Отдел не назначен"}
          </p>
        </div>
        <Button asChild variant="outline"><Link to="/tools"><LayoutGrid className="mr-2 h-4 w-4" />Настроить дашборд</Link></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Рабочее время</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{active ? fmt(secs) : "00:00:00"}</div>
            <Button onClick={toggleTimer} size="sm" className={`mt-3 w-full ${active ? "" : "gradient-brand text-white"}`} variant={active ? "destructive" : "default"}>
              {active ? <><Square className="mr-2 h-3 w-3" />Стоп</> : <><Play className="mr-2 h-3 w-3" />Начать работу</>}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Задачи</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openTasks.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Открытых · {doneToday} выполнено</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Инструменты</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dash?.tools.length ?? 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Доступно вам</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Ваша роль</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {me?.roles.map((r) => (
                <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                  {r === "admin" ? "Администратор" : r === "manager" ? "Менеджер" : "Сотрудник"}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-4 w-4" /> Мои инструменты</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link to="/tools">Все <ArrowUpRight className="ml-1 h-3 w-3" /></Link></Button>
          </CardHeader>
          <CardContent>
            {dashboardTools.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Инструменты не назначены. Обратитесь к администратору или перейдите в{" "}
                <Link to="/tools" className="text-primary hover:underline">каталог</Link>.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {dashboardTools.map((t) => (
                  <Link
                    key={t.id}
                    to="/tools"
                    search={{ tool: t.slug }}
                    className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition hover:border-primary hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: (t.color ?? "#1E4FD9") + "22", color: t.color ?? "#1E4FD9" }}>
                      <DynIcon name={t.icon} className="h-5 w-5" />
                    </div>
                    <div className="text-xs font-medium">{t.name}</div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><ListTodo className="h-4 w-4" /> Задачи на сегодня</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link to="/tasks">Все</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {openTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="truncate">{t.title}</span>
                <Badge variant={t.priority === "high" ? "destructive" : t.priority === "medium" ? "default" : "secondary"} className="ml-2 shrink-0">
                  {t.priority === "high" ? "Высокий" : t.priority === "medium" ? "Средний" : "Низкий"}
                </Badge>
              </div>
            ))}
            {openTasks.length === 0 && (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Задач пока нет</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}