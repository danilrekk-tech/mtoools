import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { shiftsQuery, usersQuery } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/shifts")({
  head: () => ({
    meta: [
      { title: "Планировщик смен · Админ · MTools" },
      { name: "description", content: "Визуальный планировщик недельных смен." },
    ],
  }),
  component: AdminShifts,
});

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function AdminShifts() {
  const qc = useQueryClient();
  const { data: shifts } = useSuspenseQuery(shiftsQuery());
  const { data: users } = useSuspenseQuery(usersQuery());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [editing, setEditing] = useState<any | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const cellShifts = (uid: string, day: Date) =>
    shifts.filter((s: any) => s.user_id === uid && sameDay(new Date(s.starts_at), day));

  const openCreate = (uid: string, day: Date) => {
    const starts = new Date(day);
    starts.setHours(9, 0, 0, 0);
    const ends = new Date(day);
    ends.setHours(18, 0, 0, 0);
    setEditing({
      id: null,
      user_id: uid,
      starts_at: toLocalInput(starts),
      ends_at: toLocalInput(ends),
      title: "",
      color: "#1E4FD9",
    });
  };

  const openEdit = (s: any) =>
    setEditing({
      id: s.id,
      user_id: s.user_id,
      starts_at: toLocalInput(new Date(s.starts_at)),
      ends_at: toLocalInput(new Date(s.ends_at)),
      title: s.title ?? "",
      color: s.color ?? "#1E4FD9",
    });

  const save = async () => {
    if (!editing) return;
    const payload = {
      user_id: editing.user_id,
      starts_at: new Date(editing.starts_at).toISOString(),
      ends_at: new Date(editing.ends_at).toISOString(),
      title: editing.title || null,
      color: editing.color,
    };
    const q = editing.id
      ? supabase.from("shifts").update(payload).eq("id", editing.id)
      : supabase.from("shifts").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Сохранено · сотрудник уведомлён");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["shifts"] });
  };

  const remove = async () => {
    if (!editing?.id) return;
    await supabase.from("shifts").delete().eq("id", editing.id);
    toast.success("Смена удалена");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["shifts"] });
  };

  const label = weekStart.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) +
    " – " + addDays(weekStart, 6).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">Планировщик смен</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setWeekStart(startOfWeek(new Date()))}>Сегодня</Button>
          <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[220px_repeat(7,minmax(110px,1fr))] border-b bg-muted/40 text-xs font-medium">
                <div className="p-2">Сотрудник</div>
                {days.map((d) => (
                  <div key={d.toISOString()} className={`p-2 text-center ${sameDay(d, new Date()) ? "text-primary" : ""}`}>
                    <div>{d.toLocaleDateString("ru-RU", { weekday: "short" })}</div>
                    <div className="text-[10px] text-muted-foreground">{d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</div>
                  </div>
                ))}
              </div>
              {users.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">Нет сотрудников</div>
              )}
              {users.map((u: any) => (
                <div key={u.id} className="grid grid-cols-[220px_repeat(7,minmax(110px,1fr))] border-b last:border-b-0">
                  <div className="min-w-0 border-r p-2">
                    <div className="truncate text-sm font-medium">{u.full_name ?? u.email}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{u.department?.name ?? "—"}</div>
                  </div>
                  {days.map((d) => {
                    const cs = cellShifts(u.id, d);
                    return (
                      <button
                        key={d.toISOString()}
                        onClick={() => (cs[0] ? openEdit(cs[0]) : openCreate(u.id, d))}
                        className="min-h-[70px] space-y-1 border-r p-1.5 text-left transition hover:bg-accent/40"
                      >
                        {cs.length === 0 && (
                          <span className="text-[10px] text-muted-foreground/60">+ добавить</span>
                        )}
                        {cs.map((s: any) => (
                          <div
                            key={s.id}
                            className="rounded px-1.5 py-1 text-[11px] text-white shadow-sm"
                            style={{ backgroundColor: s.color ?? "#1E4FD9" }}
                          >
                            <div className="font-semibold">
                              {new Date(s.starts_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })}–
                              {new Date(s.ends_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })}
                            </div>
                            {s.title && <div className="truncate opacity-90">{s.title}</div>}
                          </div>
                        ))}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Редактировать смену" : "Новая смена"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Сотрудник</Label>
                <div className="mt-1 rounded border bg-muted/40 px-3 py-2 text-sm">
                  {users.find((u: any) => u.id === editing.user_id)?.full_name ?? "—"}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Начало</Label>
                  <Input type="datetime-local" value={editing.starts_at} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })} />
                </div>
                <div>
                  <Label>Окончание</Label>
                  <Input type="datetime-local" value={editing.ends_at} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Название</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Утренняя смена" />
              </div>
              <div>
                <Label>Цвет</Label>
                <Input type="color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="h-10 w-24 p-1" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {editing?.id ? (
              <Button variant="destructive" onClick={remove}><Trash2 className="mr-2 h-4 w-4" />Удалить</Button>
            ) : <span />}
            <Button onClick={save} className="gradient-brand text-white">Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}