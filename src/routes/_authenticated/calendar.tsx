import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { shiftsQuery, profileQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Календарь · MTools" },
      { name: "description", content: "График смен и событий сотрудника." },
    ],
  }),
  component: CalendarPage,
});

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function CalendarPage() {
  const { data: me } = useSuspenseQuery(profileQuery());
  const { data: allShifts } = useSuspenseQuery(shiftsQuery());
  const [date, setDate] = useState<Date>(new Date());

  const isManager = me?.roles.some((r) => r === "admin" || r === "manager");
  const shifts = useMemo(
    () => (isManager ? allShifts : allShifts.filter((s: any) => s.user_id === me?.user.id)),
    [allShifts, isManager, me],
  );

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of shifts) {
      const k = dayKey(new Date(s.starts_at));
      const arr = map.get(k) ?? [];
      arr.push(s);
      map.set(k, arr);
    }
    return map;
  }, [shifts]);

  const dayShifts = shiftsByDay.get(dayKey(date)) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Календарь и смены</h1>
        <p className="text-sm text-muted-foreground">
          {isManager ? "Все смены команды" : "Ваш график"}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>График</CardTitle></CardHeader>
          <CardContent className="flex justify-center overflow-x-auto">
            <UICalendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              modifiers={{ hasShift: (d) => shiftsByDay.has(dayKey(d)) }}
              modifiersClassNames={{
                hasShift: "relative font-bold text-primary after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
              }}
              className="rounded-md border"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {date.toLocaleDateString("ru-RU", { dateStyle: "long" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dayShifts.length === 0 && (
              <div className="text-sm text-muted-foreground">Смен в этот день нет</div>
            )}
            {dayShifts.map((s: any) => (
              <div key={s.id} className="rounded-lg border p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <div className="min-w-0 truncate font-medium">{s.title ?? "Смена"}</div>
                  <Badge variant="outline" className="shrink-0" style={{ borderColor: s.color }}>
                    {s.user?.full_name ?? "—"}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(s.starts_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })} —{" "}
                  {new Date(s.ends_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}