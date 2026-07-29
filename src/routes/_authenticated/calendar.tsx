import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { shiftsQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Календарь · MTools" }, { name: "description", content: "График смен и событий." }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const { data: shifts } = useSuspenseQuery(shiftsQuery());
  const [date, setDate] = useState<Date | undefined>(new Date());

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, typeof shifts>();
    for (const s of shifts) {
      const key = new Date(s.starts_at).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(s); map.set(key, arr);
    }
    return map;
  }, [shifts]);

  const dayShifts = date ? shiftsByDay.get(date.toDateString()) ?? [] : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Календарь и смены</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>График</CardTitle></CardHeader>
          <CardContent>
            <UICalendar
              mode="single"
              selected={date}
              onSelect={setDate}
              modifiers={{ hasShift: (d) => shiftsByDay.has(d.toDateString()) }}
              modifiersClassNames={{ hasShift: "font-bold text-primary underline" }}
              className="rounded-md border"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{date?.toLocaleDateString("ru-RU", { dateStyle: "long" })}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {dayShifts.length === 0 && <div className="text-sm text-muted-foreground">Смен в этот день нет</div>}
            {dayShifts.map((s: any) => (
              <div key={s.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{s.title ?? "Смена"}</div>
                  <Badge variant="outline">{s.user?.full_name ?? "—"}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(s.starts_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })} — {new Date(s.ends_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}