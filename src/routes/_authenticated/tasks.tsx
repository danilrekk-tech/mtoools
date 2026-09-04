import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { tasksQuery, profileQuery, teamProfilesQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Play, Search, AlarmClock } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Мои задачи · MTools" },
      { name: "description", content: "Канбан задач с приоритетами, тегами, чек-листами и запуском таймера." },
      { property: "og:title", content: "Мои задачи · MTools" },
      { property: "og:description", content: "Канбан задач сотрудника с фильтрами и учётом времени." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    const qc = context.queryClient;
    await Promise.all([qc.ensureQueryData(profileQuery()), qc.ensureQueryData(tasksQuery())]);
  },
  errorComponent: ({ error }) => <div role="alert" className="p-4 text-sm text-destructive">{error.message}</div>,
  component: TasksPage,
});

const COLUMNS = [
  { id: "todo", title: "К выполнению" },
  { id: "in_progress", title: "В работе" },
  { id: "done", title: "Выполнено" },
] as const;

const PRIORITY_LABEL: Record<string, string> = { high: "Высокий", medium: "Средний", low: "Низкий" };

type Check = { text: string; done: boolean };

function TasksPage() {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(profileQuery());
  const { data: tasks } = useSuspenseQuery(tasksQuery());
  const isManager = me?.roles.some((r) => r === "admin" || r === "manager") ?? false;
  const { data: team } = useQuery({ ...teamProfilesQuery(), enabled: isManager });

  const [open, setOpen] = useState(false);
  const empty = { title: "", description: "", priority: "medium", due: "", tags: "", estimate: "", assignee: "me" };
  const [form, setForm] = useState(empty);
  const [q, setQ] = useState("");
  const [fPriority, setFPriority] = useState("all");
  const [fScope, setFScope] = useState<"mine" | "all">("mine");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["me", "tasks"] });
    qc.invalidateQueries({ queryKey: ["me", "time-entry"] });
  };

  const create = async () => {
    if (!form.title.trim()) return toast.error("Введите название");
    const assignee = form.assignee === "me" ? me!.user.id : form.assignee;
    const { error } = await supabase.from("tasks").insert({
      user_id: assignee,
      assignee_id: assignee,
      created_by: me!.user.id,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      due_at: form.due ? new Date(form.due).toISOString() : null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      estimate_minutes: form.estimate ? Number(form.estimate) : null,
    });
    if (error) return toast.error(error.message);
    setForm(empty);
    setOpen(false);
    invalidate();
  };

  const setStatus = async (id: string, status: string) => {
    await supabase
      .from("tasks")
      .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", id);
    invalidate();
  };

  const remove = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    invalidate();
  };

  const toggleCheck = async (task: any, index: number) => {
    const list: Check[] = Array.isArray(task.checklist) ? [...task.checklist] : [];
    if (!list[index]) return;
    list[index] = { ...list[index], done: !list[index].done };
    await supabase.from("tasks").update({ checklist: list }).eq("id", task.id);
    invalidate();
  };

  const addCheck = async (task: any, text: string) => {
    const list: Check[] = Array.isArray(task.checklist) ? [...task.checklist] : [];
    list.push({ text, done: false });
    await supabase.from("tasks").update({ checklist: list }).eq("id", task.id);
    invalidate();
  };

  const startTimer = async (task: any) => {
    const { data: active } = await supabase
      .from("time_entries").select("id, started_at").eq("user_id", me!.user.id).is("ended_at", null).maybeSingle();
    if (active) {
      await supabase.from("time_entries").update({
        ended_at: new Date().toISOString(),
        duration_seconds: Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000),
      }).eq("id", active.id);
    }
    const { error } = await supabase.from("time_entries").insert({ user_id: me!.user.id, task_id: task.id, note: task.title });
    if (error) return toast.error(error.message);
    if (task.status === "todo") await setStatus(task.id, "in_progress");
    toast.success("Таймер запущен по задаче");
    invalidate();
  };

  const filtered = useMemo(
    () =>
      (tasks as any[]).filter((t) => {
        if (fScope === "mine" && t.assignee_id !== me?.user.id && t.user_id !== me?.user.id) return false;
        if (fPriority !== "all" && t.priority !== fPriority) return false;
        if (q && !`${t.title} ${t.description ?? ""} ${(t.tags ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [tasks, q, fPriority, fScope, me],
  );

  const nameOf = (id: string) => (team ?? []).find((p: any) => p.id === id)?.full_name ?? "";
  const overdue = (t: any) => t.status !== "done" && t.due_at && new Date(t.due_at) < new Date();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Задачи</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.filter((t) => t.status !== "done").length} открытых ·{" "}
            {filtered.filter((t) => overdue(t)).length} просрочено
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-brand text-white"><Plus className="mr-2 h-4 w-4" />Задача</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Новая задача</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Название</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Описание</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Приоритет</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Низкий</SelectItem>
                      <SelectItem value="medium">Средний</SelectItem>
                      <SelectItem value="high">Высокий</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Дедлайн</Label><Input type="datetime-local" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></div>
                <div><Label>Теги (через запятую)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
                <div><Label>Оценка, мин</Label><Input type="number" value={form.estimate} onChange={(e) => setForm({ ...form, estimate: e.target.value })} /></div>
              </div>
              {isManager && (
                <div>
                  <Label>Исполнитель</Label>
                  <Select value={form.assignee} onValueChange={(v) => setForm({ ...form, assignee: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="me">Себе</SelectItem>
                      {(team ?? []).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter><Button onClick={create} className="gradient-brand text-white">Создать</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по задачам и тегам" className="pl-9" />
        </div>
        <Select value={fPriority} onValueChange={setFPriority}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все приоритеты</SelectItem>
            <SelectItem value="high">Высокий</SelectItem>
            <SelectItem value="medium">Средний</SelectItem>
            <SelectItem value="low">Низкий</SelectItem>
          </SelectContent>
        </Select>
        {isManager && (
          <Select value={fScope} onValueChange={(v) => setFScope(v as "mine" | "all")}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mine">Мои</SelectItem>
              <SelectItem value="all">Вся команда</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = filtered.filter((t) => (col.id === "todo" ? t.status !== "done" && t.status !== "in_progress" : t.status === col.id));
          return (
            <Card key={col.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{col.title}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    isManager={isManager}
                    assigneeName={t.assignee_id && t.assignee_id !== me?.user.id ? nameOf(t.assignee_id) : ""}
                    overdue={!!overdue(t)}
                    onStatus={setStatus}
                    onRemove={remove}
                    onToggleCheck={toggleCheck}
                    onAddCheck={addCheck}
                    onStartTimer={startTimer}
                  />
                ))}
                {items.length === 0 && (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Пусто</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TaskRow({
  task, isManager, assigneeName, overdue, onStatus, onRemove, onToggleCheck, onAddCheck, onStartTimer,
}: {
  task: any;
  isManager: boolean;
  assigneeName: string;
  overdue: boolean;
  onStatus: (id: string, s: string) => void;
  onRemove: (id: string) => void;
  onToggleCheck: (t: any, i: number) => void;
  onAddCheck: (t: any, text: string) => void;
  onStartTimer: (t: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newCheck, setNewCheck] = useState("");
  const checks: Check[] = Array.isArray(task.checklist) ? task.checklist : [];
  const doneChecks = checks.filter((c) => c.done).length;

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <Checkbox checked={task.status === "done"} onCheckedChange={(v) => onStatus(task.id, v ? "done" : "todo")} />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setExpanded((e) => !e)}>
          <div className={`text-sm font-medium ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}>{task.title}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant={task.priority === "high" ? "destructive" : task.priority === "medium" ? "default" : "secondary"}>
              {PRIORITY_LABEL[task.priority] ?? task.priority}
            </Badge>
            {task.due_at && (
              <Badge variant={overdue ? "destructive" : "outline"}>
                {new Date(task.due_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
              </Badge>
            )}
            {task.estimate_minutes ? <Badge variant="outline"><AlarmClock className="mr-1 h-3 w-3" />{task.estimate_minutes} мин</Badge> : null}
            {checks.length > 0 && <Badge variant="outline">{doneChecks}/{checks.length}</Badge>}
            {(task.tags ?? []).map((tag: string) => <Badge key={tag} variant="secondary">#{tag}</Badge>)}
            {isManager && assigneeName && <Badge variant="outline">{assigneeName}</Badge>}
          </div>
        </button>
        <div className="flex shrink-0 flex-col gap-1">
          {task.status !== "done" && (
            <Button size="icon" variant="ghost" title="Запустить таймер" onClick={() => onStartTimer(task)}>
              <Play className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => onRemove(task.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
          {checks.map((c, i) => (
            <label key={i} className="flex items-center gap-2 text-xs">
              <Checkbox checked={c.done} onCheckedChange={() => onToggleCheck(task, i)} />
              <span className={c.done ? "text-muted-foreground line-through" : ""}>{c.text}</span>
            </label>
          ))}
          <div className="flex gap-2">
            <Input
              value={newCheck}
              onChange={(e) => setNewCheck(e.target.value)}
              placeholder="Пункт чек-листа"
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCheck.trim()) { onAddCheck(task, newCheck.trim()); setNewCheck(""); }
              }}
            />
            <Button size="sm" variant="secondary" onClick={() => { if (newCheck.trim()) { onAddCheck(task, newCheck.trim()); setNewCheck(""); } }}>+</Button>
          </div>
          {task.status !== "in_progress" && task.status !== "done" && (
            <Button size="sm" variant="outline" onClick={() => onStatus(task.id, "in_progress")}>В работу</Button>
          )}
        </div>
      )}
    </div>
  );
}
