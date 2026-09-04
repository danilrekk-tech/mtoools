import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import {
  activeTimeEntryQuery,
  notificationsQuery,
  profileQuery,
  shiftsQuery,
  tasksQuery,
  timeEntriesQuery,
  myDashboardQuery,
} from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToolCard } from "@/components/mtools/tool-card";
import { DeptDot } from "@/components/mtools/user-avatar";
import {
  Play,
  Square,
  ArrowUpRight,
  ListTodo,
  LayoutGrid,
  SlidersHorizontal,
  CalendarDays,
  Bell,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Plus,
  TimerReset,
} from "lucide-react";
import { ToolDialog, launchTool, type AnyTool } from "@/components/mtools/tool-launcher";
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
  // Параллельный прогрев кэша — иначе useSuspenseQuery выполняются водопадом.
  loader: async ({ context }) => {
    const qc = context.queryClient;
    await Promise.all([
      qc.ensureQueryData(profileQuery()),
      qc.ensureQueryData(myDashboardQuery()),
      qc.ensureQueryData(tasksQuery()),
      qc.ensureQueryData(activeTimeEntryQuery()),
      qc.ensureQueryData(shiftsQuery()),
      qc.ensureQueryData(timeEntriesQuery()),
      qc.ensureQueryData(notificationsQuery()),
    ]);
  },
  errorComponent: ({ error }) => <div role="alert" className="p-4 text-sm text-destructive">{error.message}</div>,
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
  const h = Math.floor(Math.max(0, sec) / 3600).toString().padStart(2, "0");
  const m = Math.floor((Math.max(0, sec) % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(Math.max(0, sec) % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function fmtDuration(sec: number) {
  const totalMinutes = Math.round(Math.max(0, sec) / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
const startOfWeek = (d: Date) => {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
};
const endOfWeek = (d: Date) => new Date(startOfWeek(d).getTime() + 7 * 86400000);

function Dashboard() {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(profileQuery());
  const { data: dash } = useSuspenseQuery(myDashboardQuery());
  const { data: tasks } = useSuspenseQuery(tasksQuery());
  const { data: active } = useSuspenseQuery(activeTimeEntryQuery());
  const { data: shifts } = useSuspenseQuery(shiftsQuery());
  const { data: timeEntries } = useSuspenseQuery(timeEntriesQuery());
  const { data: notifications } = useSuspenseQuery(notificationsQuery());
  const now = useTicker(!!active);
  const [activeTool, setActiveTool] = useState<AnyTool | null>(null);
  const [editMode, setEditMode] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);

  const activeSeconds = active ? Math.floor((now - new Date(active.started_at).getTime()) / 1000) : 0;

  const dashboardTools = useMemo(() => {
    const layoutMap = new Map((dash?.layouts ?? []).map((l) => [l.tool_id, l]));
    return (dash?.tools ?? [])
      .filter((t) => {
        const l = layoutMap.get(t.id);
        return !l || l.location === "dashboard";
      })
      .sort((a, b) => (layoutMap.get(a.id)?.position ?? 0) - (layoutMap.get(b.id)?.position ?? 0));
  }, [dash]);

  const myShifts = useMemo(
    () => (shifts ?? []).filter((s: any) => s.user_id === me?.user.id),
    [shifts, me?.user.id],
  );

  const todayShift = useMemo(
    () => myShifts
      .filter((s: any) => new Date(s.ends_at) >= todayStart && new Date(s.starts_at) < todayEnd)
      .sort((a: any, b: any) => +new Date(a.starts_at) - +new Date(b.starts_at))[0],
    [myShifts, todayStart, todayEnd],
  );

  const nextShift = useMemo(
    () => myShifts
      .filter((s: any) => new Date(s.ends_at) >= new Date())
      .sort((a: any, b: any) => +new Date(a.starts_at) - +new Date(b.starts_at))[0],
    [myShifts, now],
  );

  const nextEvent = nextShift;
  const openTasks = useMemo(() => (tasks ?? []).filter((t: any) => t.status !== "done"), [tasks]);
  const todayTasks = useMemo(
    () => openTasks.filter((t: any) => t.due_at && new Date(t.due_at) >= todayStart && new Date(t.due_at) < todayEnd),
    [openTasks, todayStart, todayEnd],
  );
  const focusTasks = useMemo(
    () => [...todayTasks, ...openTasks.filter((t: any) => !todayTasks.includes(t))]
      .sort((a: any, b: any) => {
        const priority = { high: 0, medium: 1, low: 2 } as Record<string, number>;
        const p = (priority[a.priority] ?? 3) - (priority[b.priority] ?? 3);
        if (p !== 0) return p;
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return +new Date(a.due_at) - +new Date(b.due_at);
      })
      .slice(0, 4),
    [todayTasks, openTasks],
  );

  const doneToday = useMemo(
    () => (tasks ?? []).filter((t: any) => t.status === "done" && t.completed_at && new Date(t.completed_at) >= todayStart && new Date(t.completed_at) < todayEnd).length,
    [tasks, todayStart, todayEnd],
  );
  const overdueTasks = useMemo(
    () => openTasks.filter((t: any) => t.due_at && new Date(t.due_at) < todayStart),
    [openTasks, todayStart],
  );
  const dueTodayCount = todayTasks.length + doneToday;
  const taskProgress = dueTodayCount ? Math.round((doneToday / dueTodayCount) * 100) : 0;

  const todaySeconds = useMemo(() => {
    const completed = (timeEntries ?? []).reduce((sum: number, entry: any) => {
      const start = new Date(entry.started_at);
      const end = new Date(entry.ended_at);
      const overlapStart = Math.max(start.getTime(), todayStart.getTime());
      const overlapEnd = Math.min(end.getTime(), todayEnd.getTime());
      return sum + Math.max(0, Math.floor((overlapEnd - overlapStart) / 1000));
    }, 0);
    return completed + activeSeconds;
  }, [timeEntries, todayStart, todayEnd, activeSeconds]);

  const weekSeconds = useMemo(() => {
    const completed = (timeEntries ?? []).reduce((sum: number, entry: any) => {
      const start = new Date(entry.started_at);
      const end = new Date(entry.ended_at);
      const overlapStart = Math.max(start.getTime(), weekStart.getTime());
      const overlapEnd = Math.min(end.getTime(), weekEnd.getTime());
      return sum + Math.max(0, Math.floor((overlapEnd - overlapStart) / 1000));
    }, 0);
    const activeStart = active ? new Date(active.started_at).getTime() : 0;
    const activeWeekOverlap = active ? Math.max(0, Math.floor((now - Math.max(activeStart, weekStart.getTime())) / 1000)) : 0;
    return completed + activeWeekOverlap;
  }, [timeEntries, weekStart, weekEnd, active, now]);

  const weekByDay = useMemo(() => {
    const values = Array.from({ length: 5 }, (_, i) => ({
      date: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i),
      seconds: 0,
    }));
    for (const entry of timeEntries ?? []) {
      const start = new Date(entry.started_at);
      const end = new Date(entry.ended_at);
      values.forEach((day) => {
        const ds = startOfDay(day.date).getTime();
        const de = endOfDay(day.date).getTime();
        const overlap = Math.max(0, Math.floor((Math.min(end.getTime(), de) - Math.max(start.getTime(), ds)) / 1000));
        day.seconds += overlap;
      });
    }
    if (active) {
      const start = new Date(active.started_at);
      values.forEach((day) => {
        const ds = startOfDay(day.date).getTime();
        const de = endOfDay(day.date).getTime();
        day.seconds += Math.max(0, Math.floor((Math.min(now, de) - Math.max(start.getTime(), ds)) / 1000));
      });
    }
    return values;
  }, [timeEntries, weekStart, active, now]);

  const unreadNotifications = useMemo(() => (notifications ?? []).filter((n: any) => !n.read_at), [notifications]);

  const setLocation = async (toolId: string, loc: "dashboard" | "sidebar" | "hidden") => {
    const existing = dash?.layouts.find((l) => l.tool_id === toolId);
    if (existing) await supabase.from("dashboard_layouts").update({ location: loc }).eq("id", existing.id);
    else await supabase.from("dashboard_layouts").insert({ user_id: me!.user.id, tool_id: toolId, location: loc });
    toast.success("Размещение обновлено");
    qc.invalidateQueries({ queryKey: ["me", "dashboard"] });
  };

  const toggleTimer = async () => {
    if (active) {
      const dur = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000);
      const { error } = await supabase.from("time_entries").update({ ended_at: new Date().toISOString(), duration_seconds: dur }).eq("id", active.id);
      if (error) return toast.error("Не удалось завершить таймер");
      toast.success("Работа завершена");
    } else {
      const { error } = await supabase.from("time_entries").insert({ user_id: me!.user.id, started_at: new Date().toISOString() });
      if (error) return toast.error("Не удалось запустить таймер");
      toast.success("Таймер запущен");
    }
    qc.invalidateQueries({ queryKey: ["me", "time-entry"] });
    qc.invalidateQueries({ queryKey: ["me", "time-entries"] });
  };

  const greeting = new Date().getHours() < 12 ? "Доброе утро" : new Date().getHours() < 18 ? "Добрый день" : "Добрый вечер";
  const firstName = me?.profile?.full_name?.split(" ")[0] ?? "коллега";
  const workdayTarget = 8 * 3600;
  const workdayProgress = Math.min(100, Math.round((todaySeconds / workdayTarget) * 100));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{greeting}, {firstName}</h1>
          {me?.profile?.department ? (
            <span
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
              style={{
                borderColor: `${(me.profile.department as any).color ?? "#64748B"}55`,
                backgroundColor: `${(me.profile.department as any).color ?? "#64748B"}14`,
                color: (me.profile.department as any).color ?? undefined,
              }}
            >
              <DeptDot color={(me.profile.department as any).color} className="h-2 w-2" />
              {(me.profile.department as any).name}
            </span>
          ) : <p className="mt-1 text-sm text-muted-foreground">Отдел не назначен</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" className="relative" aria-label="Уведомления">
            <Link to="/settings">
              <Bell className="h-4 w-4" />
              {unreadNotifications.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{Math.min(unreadNotifications.length, 9)}</span>}
            </Link>
          </Button>
          <Button asChild variant="outline"><Link to="/tools"><SlidersHorizontal className="mr-2 h-4 w-4" />Настроить дашборд</Link></Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                Рабочий день · {active ? "Работаю" : "Не запущен"}
              </div>
              <div className="mt-2 text-4xl font-bold tracking-tight tabular-nums md:text-5xl">{fmt(todaySeconds)}</div>
              <div className="mt-1 text-sm text-muted-foreground">Начало {active ? new Date(active.started_at).toLocaleTimeString("ru-RU", { timeStyle: "short" }) : "—"} · План 8 ч · Осталось {fmtDuration(Math.max(0, workdayTarget - todaySeconds))}</div>
            </div>
            <Button onClick={toggleTimer} size="lg" variant={active ? "destructive" : "default"} className={!active ? "gradient-brand text-white" : ""}>
              {active ? <><Square className="mr-2 h-4 w-4" />Завершить работу</> : <><Play className="mr-2 h-4 w-4" />Начать работу</>}
            </Button>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${workdayProgress}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Сегодня" value={fmtDuration(todaySeconds)} icon={<Clock3 className="h-4 w-4" />} />
            <Stat label="Задач открыто" value={String(openTasks.length)} icon={<ListTodo className="h-4 w-4" />} />
            <Stat label="Выполнено сегодня" value={String(doneToday)} icon={<CheckCircle2 className="h-4 w-4" />} />
            <Stat label="Прогресс" value={`${taskProgress}%`} icon={<TimerReset className="h-4 w-4" />} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><ListTodo className="h-4 w-4" /> Мой фокус</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link to="/tasks">Все задачи <ArrowUpRight className="ml-1 h-3 w-3" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueTasks.length > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                <span><strong>{overdueTasks.length}</strong> просроченных задач</span>
              </div>
            )}
            {focusTasks.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">На сегодня задач нет</div>
            ) : focusTasks.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{t.due_at ? (new Date(t.due_at) < todayStart ? "Просрочено" : `до ${new Date(t.due_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })}`) : "Без срока"}</span>
                    {t.project && <span className="truncate">· {t.project}</span>}
                  </div>
                </div>
                <Badge variant={t.priority === "high" ? "destructive" : t.priority === "medium" ? "default" : "secondary"} className="shrink-0">
                  {t.priority === "high" ? "Высокий" : t.priority === "medium" ? "Средний" : "Низкий"}
                </Badge>
              </div>
            ))}
            <Button asChild variant="outline" className="mt-1 w-full"><Link to="/tasks"><Plus className="mr-2 h-4 w-4" />Новая задача</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Ближайшее событие</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link to="/calendar">Календарь <ArrowUpRight className="ml-1 h-3 w-3" /></Link></Button>
          </CardHeader>
          <CardContent>
            {nextEvent ? (
              <div className="rounded-xl border p-4">
                <div className="text-sm text-muted-foreground">{new Date(nextEvent.starts_at) <= new Date() ? "Сейчас" : new Date(nextEvent.starts_at).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}</div>
                <div className="mt-1 text-xl font-semibold">{nextEvent.title ?? "Смена"}</div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{new Date(nextEvent.starts_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })} — {new Date(nextEvent.ends_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })}</span>
                  {new Date(nextEvent.starts_at) > new Date() && <span>через {fmtDuration(Math.floor((new Date(nextEvent.starts_at).getTime() - Date.now()) / 1000))}</span>}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Ближайших событий нет</div>
            )}
            {todayShift && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Моя смена сегодня</span>
                <span className="font-medium">{new Date(todayShift.starts_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })} — {new Date(todayShift.ends_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><LayoutGrid className="h-4 w-4" /> Быстрый доступ</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <Label htmlFor="dash-edit" className="cursor-pointer text-xs">Настройка</Label>
              <Switch id="dash-edit" checked={editMode} onCheckedChange={setEditMode} />
            </div>
            <Button asChild size="sm" variant="ghost"><Link to="/tools">Все</Link></Button>
          </div>
        </CardHeader>
        <CardContent>
          {(editMode ? dash?.tools ?? [] : dashboardTools).length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Инструменты не назначены. Перейдите в <Link to="/tools" className="text-primary hover:underline">каталог</Link>.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(editMode ? dash!.tools : dashboardTools).slice(0, 8).map((t) => (
                <ToolCard
                  key={t.id}
                  tool={t as AnyTool}
                  onOpen={() => launchTool(t as AnyTool, setActiveTool)}
                  footer={editMode ? (
                    <Select value={dash!.layouts.find((l) => l.tool_id === t.id)?.location ?? "dashboard"} onValueChange={(v) => setLocation(t.id, v as any)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dashboard">На дашборде</SelectItem>
                        <SelectItem value="sidebar">В боковом меню</SelectItem>
                        <SelectItem value="hidden">Скрыть</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : undefined}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4" /> Моя неделя</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><div className="text-2xl font-bold">{fmtDuration(weekSeconds)}</div><div className="text-xs text-muted-foreground">Отработано с понедельника</div></div>
              <Badge variant="secondary">Среднее {fmtDuration(weekSeconds / 5)}</Badge>
            </div>
            <div className="space-y-2">
              {weekByDay.map((day) => {
                const max = Math.max(8 * 3600, ...weekByDay.map((d) => d.seconds));
                const pct = Math.min(100, (day.seconds / max) * 100);
                return <div key={day.date.toISOString()} className="flex items-center gap-3 text-xs">
                  <span className="w-7 text-muted-foreground">{day.date.toLocaleDateString("ru-RU", { weekday: "short" })}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                  <span className="w-14 text-right tabular-nums">{fmtDuration(day.seconds)}</span>
                </div>;
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Уведомления</CardTitle>
            {unreadNotifications.length > 0 && <Badge>{unreadNotifications.length} новых</Badge>}
          </CardHeader>
          <CardContent className="space-y-2">
            {(notifications ?? []).slice(0, 4).map((n: any) => (
              <div key={n.id} className={`rounded-lg border px-3 py-2.5 text-sm ${!n.read_at ? "bg-accent/40" : ""}`}>
                <div className="font-medium">{n.title ?? "Уведомление"}</div>
                {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
              </div>
            ))}
            {(notifications ?? []).length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Новых уведомлений нет</div>}
          </CardContent>
        </Card>
      </div>

      <ToolDialog tool={activeTool} onClose={() => setActiveTool(null)} />
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="rounded-lg bg-muted/50 p-3"><div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div><div className="mt-1 text-lg font-semibold tabular-nums">{value}</div></div>;
}
