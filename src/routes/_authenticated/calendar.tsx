import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { shiftsQuery, profileQuery, tasksQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, ListTodo } from "lucide-react";
import { ru } from "date-fns/locale";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Календарь · MTools" },
      { name: "description", content: "График смен и событий сотрудника." },
    ],
  }),
  loader: async ({ context }) => {
    const qc = context.queryClient;
    await Promise.all([
      qc.ensureQueryData(profileQuery()),
      qc.ensureQueryData(shiftsQuery()),
      qc.ensureQueryData(tasksQuery()),
    ]);
  },
  errorComponent: ({ error }) => <div role="alert" className="p-4 text-sm text-destructive">{error.message}</div>,
  component: CalendarPage,
});

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function CalendarPage() {
  const { data: me } = useSuspenseQuery(profileQuery());
  const { data: allShifts } = useSuspenseQuery(shiftsQuery());
  const { data: tasks } = useSuspenseQuery(tasksQuery());
  const [date, setDate] = useState<Date>(() => startOfDay(new Date()));
  const [month, setMonth] = useState<Date>(() => startOfDay(new Date()));

  const isManager = me?.roles.some((r) => r === "admin" || r === "manager");
  const shifts = useMemo(
    () => (isManager ? allShifts : allShifts.filter((s: any) => s.user_id === me?.user.id)),
    [allShifts, isManager, me],
  );

  // A shift can span midnight — index every day it touches.
  const shiftsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of shifts) {
      const start = startOfDay(new Date(s.starts_at));
      const end = startOfDay(new Date(s.ends_at));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const k = dayKey(d);
        const arr = map.get(k) ?? [];
        arr.push(s);
        map.set(k, arr);
      }
    }
    return map;
  }, [shifts]);

  const dayShifts = (shiftsByDay.get(dayKey(date)) ?? []).sort(
    (a: any, b: any) => +new Date(a.starts_at) - +new Date(b.starts_at),
  );

  const upcoming = useMemo(
    () =>
      [...shifts]
        .filter((s: any) => new Date(s.ends_at) >= new Date())
        .sort((a: any, b: any) => +new Date(a.starts_at) - +new Date(b.starts_at))
        .slice(0, 5),
    [shifts],
  );

  const shiftDays = useMemo(
    () => [...shiftsByDay.keys()].map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, m, d);
    }),
    [shiftsByDay],
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of tasks as any[]) {
      if (!t.due_at) continue;
      const k = dayKey(new Date(t.due_at));
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    return map;
  }, [tasks]);

  const dueDays = useMemo(
    () => [...tasksByDay.keys()].map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, m, d);
    }),
    [tasksByDay],
  );

  const dayTasks = tasksByDay.get(dayKey(date)) ?? [];

  const shiftMonth = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
  };

  const goToday = () => {
    const t = startOfDay(new Date());
    setDate(t);
    setMonth(t);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">Календарь и смены</h1>
          <p className="text-sm text-muted-foreground">{isManager ? "Все смены команды" : "Ваш график"}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="icon" variant="outline" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={goToday}>Сегодня</Button>
          <Button size="icon" variant="outline" onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base capitalize">
              {month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center overflow-x-auto">
            <UICalendar
              mode="single"
              locale={ru}
              weekStartsOn={1}
              month={month}
              onMonthChange={setMonth}
              selected={date}
              onSelect={(d) => d && setDate(startOfDay(d))}
              modifiers={{ hasShift: shiftDays, hasTask: dueDays }}
              modifiersClassNames={{
                hasShift:
                  "relative font-bold text-primary after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
                hasTask: "underline decoration-2 underline-offset-4 decoration-emerald-500",
              }}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{date.toLocaleDateString("ru-RU", { dateStyle: "long" })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dayShifts.length === 0 && <div className="text-sm text-muted-foreground">Смен в этот день нет</div>}
              {dayShifts.map((s: any) => (
                <div key={s.id} className="rounded-lg border p-3" style={{ borderLeft: `3px solid ${s.color ?? "#1E4FD9"}` }}>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <div className="min-w-0 truncate font-medium">{s.title ?? "Смена"}</div>
                    {isManager && (
                      <Badge variant="outline" className="shrink-0">{s.user?.full_name ?? "—"}</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(s.starts_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })} —{" "}
                    {new Date(s.ends_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })}
                  </div>
                </div>
              ))}
              {dayTasks.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <ListTodo className="h-3.5 w-3.5" /> Дедлайны
                  </div>
                  {dayTasks.map((t: any) => (
                    <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <span className={`truncate ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
                      <Badge variant={t.status === "done" ? "secondary" : "outline"} className="shrink-0">
                        {new Date(t.due_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" /> Ближайшие смены
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.length === 0 && <div className="text-sm text-muted-foreground">Запланированных смен нет</div>}
              {upcoming.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => {
                    const d = startOfDay(new Date(s.starts_at));
                    setDate(d);
                    setMonth(d);
                  }}
                  className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition hover:bg-accent/50"
                >
                  <span className="truncate">{s.title ?? "Смена"}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {new Date(s.starts_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
