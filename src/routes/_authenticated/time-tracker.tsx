import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { activeTimeEntryQuery, profileQuery, tasksQuery, timeEntriesQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Play, Square, Trash2, Plus, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/time-tracker")({
  head: () => ({
    meta: [
      { title: "Учёт времени · MTools" },
      { name: "description", content: "Таймер по задачам, ручные записи, статистика за день и неделю, экспорт в CSV." },
      { property: "og:title", content: "Учёт времени · MTools" },
      { property: "og:description", content: "Таймер по задачам и отчёты рабочего времени." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TimeTracker,
});

function fmt(sec: number) {
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}
const hours = (sec: number) => (sec / 3600).toFixed(1) + " ч";

function TimeTracker() {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(profileQuery());
  const { data: active } = useSuspenseQuery(activeTimeEntryQuery());
  const { data: tasks } = useSuspenseQuery(tasksQuery());
  const { data: history } = useSuspenseQuery(timeEntriesQuery());
  const [now, setNow] = useState(Date.now());
  const [note, setNote] = useState("");
  const [taskId, setTaskId] = useState("none");
  const [manual, setManual] = useState({ date: "", from: "09:00", to: "18:00", note: "" });
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["me", "time-entry"] });
    qc.invalidateQueries({ queryKey: ["me", "time-entries"] });
  };

  const secs = active ? Math.floor((now - new Date(active.started_at).getTime()) / 1000) : 0;

  const toggle = async () => {
    if (active) {
      await supabase.from("time_entries").update({ ended_at: new Date().toISOString(), duration_seconds: secs }).eq("id", active.id);
      toast.success("Запись сохранена");
    } else {
      const { error } = await supabase.from("time_entries").insert({
        user_id: me!.user.id,
        task_id: taskId === "none" ? null : taskId,
        note: note || (taskId !== "none" ? (tasks as any[]).find((t) => t.id === taskId)?.title : null) || null,
      });
      if (error) return toast.error(error.message);
      toast.success("Таймер запущен");
    }
    setNote("");
    invalidate();
  };

  const addManual = async () => {
    if (!manual.date) return toast.error("Укажите дату");
    const start = new Date(`${manual.date}T${manual.from}`);
    const end = new Date(`${manual.date}T${manual.to}`);
    const dur = Math.floor((+end - +start) / 1000);
    if (dur <= 0) return toast.error("Конец должен быть позже начала");
    const { error } = await supabase.from("time_entries").insert({
      user_id: me!.user.id,
      started_at: start.toISOString(),
      ended_at: end.toISOString(),
      duration_seconds: dur,
      note: manual.note || null,
    });
    if (error) return toast.error(error.message);
    setManualOpen(false);
    invalidate();
  };

  const remove = async (id: string) => {
    await supabase.from("time_entries").delete().eq("id", id);
    invalidate();
  };

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    let d = 0, w = 0, total = 0;
    for (const h of history as any[]) {
      const s = new Date(h.started_at);
      const dur = h.duration_seconds ?? 0;
      total += dur;
      if (s >= weekStart) w += dur;
      if (s >= today) d += dur;
    }
    return { d, w, total };
  }, [history]);

  const byTask = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of history as any[]) {
      const key = h.task_id ? ((tasks as any[]).find((t) => t.id === h.task_id)?.title ?? "Задача") : (h.note || "Без задачи");
      map.set(key, (map.get(key) ?? 0) + (h.duration_seconds ?? 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [history, tasks]);

  const exportCsv = () => {
    const rows = [["Начало", "Конец", "Длительность (мин)", "Описание"]].concat(
      (history as any[]).map((h) => [
        new Date(h.started_at).toLocaleString("ru-RU"),
        h.ended_at ? new Date(h.ended_at).toLocaleString("ru-RU") : "",
        String(Math.round((h.duration_seconds ?? 0) / 60)),
        (h.note ?? "").replace(/"/g, "'"),
      ]),
    );
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "mtools-time.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const openTasks = (tasks as any[]).filter((t) => t.status !== "done");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Учёт рабочего времени</h1>
        <div className="flex gap-2">
          <Dialog open={manualOpen} onOpenChange={setManualOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Вручную</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Добавить запись</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-3"><Label>Дата</Label><Input type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} /></div>
                <div><Label>С</Label><Input type="time" value={manual.from} onChange={(e) => setManual({ ...manual, from: e.target.value })} /></div>
                <div><Label>До</Label><Input type="time" value={manual.to} onChange={(e) => setManual({ ...manual, to: e.target.value })} /></div>
                <div className="sm:col-span-3"><Label>Описание</Label><Input value={manual.note} onChange={(e) => setManual({ ...manual, note: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={addManual} className="gradient-brand text-white">Добавить</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[["Сегодня", stats.d], ["На этой неделе", stats.w], ["Всего", stats.total]].map(([label, val]) => (
          <Card key={label as string}>
            <CardContent className="py-4">
              <div className="text-xs text-muted-foreground">{label as string}</div>
              <div className="text-2xl font-bold">{hours(val as number)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-5 py-8">
          <div className="font-mono text-5xl font-bold tabular-nums md:text-7xl">{fmt(secs)}</div>
          {!active && (
            <div className="grid w-full max-w-md gap-2">
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger><SelectValue placeholder="Задача" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без задачи</SelectItem>
                  {openTasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий (необязательно)" />
            </div>
          )}
          <Button onClick={toggle} size="lg" className={active ? "" : "gradient-brand text-white"} variant={active ? "destructive" : "default"}>
            {active ? <><Square className="mr-2 h-4 w-4" />Остановить</> : <><Play className="mr-2 h-4 w-4" />Запустить</>}
          </Button>
          {active && (
            <div className="text-center text-sm text-muted-foreground">
              {active.note && <div className="font-medium text-foreground">{active.note}</div>}
              Начало: {new Date(active.started_at).toLocaleString("ru-RU")}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">По задачам</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byTask.length === 0 && <div className="text-sm text-muted-foreground">Нет данных</div>}
            {byTask.map(([name, sec]) => (
              <div key={name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">
                <span className="truncate">{name}</span>
                <Badge variant="secondary">{hours(sec)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">История</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(history as any[]).length === 0 && <div className="text-sm text-muted-foreground">Пока пусто</div>}
            {(history as any[]).slice(0, 20).map((h) => (
              <div key={h.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate">{h.note || "Без описания"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(h.started_at).toLocaleString("ru-RU")}</div>
                </div>
                <span className="font-mono text-xs">{fmt(h.duration_seconds ?? 0)}</span>
                <Button size="icon" variant="ghost" onClick={() => remove(h.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
