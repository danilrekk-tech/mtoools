import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { tasksQuery, profileQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Мои задачи · MTools" }, { name: "description", content: "Личные задачи сотрудника." }] }),
  component: TasksPage,
});

function TasksPage() {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(profileQuery());
  const { data: tasks } = useSuspenseQuery(tasksQuery());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [due, setDue] = useState("");

  const create = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from("tasks").insert({
      user_id: me!.user.id, title, description: desc || null, priority, due_at: due ? new Date(due).toISOString() : null,
    });
    if (error) return toast.error(error.message);
    setTitle(""); setDesc(""); setDue(""); setPriority("medium"); setOpen(false);
    qc.invalidateQueries({ queryKey: ["me", "tasks"] });
  };

  const toggle = async (id: string, done: boolean) => {
    await supabase.from("tasks").update({ status: done ? "done" : "todo" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["me", "tasks"] });
  };

  const remove = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["me", "tasks"] });
  };

  const grouped = { todo: tasks.filter((t) => t.status !== "done"), done: tasks.filter((t) => t.status === "done") };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Мои задачи</h1>
          <p className="text-sm text-muted-foreground">{grouped.todo.length} открытых · {grouped.done.length} выполнено</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-brand text-white"><Plus className="mr-2 h-4 w-4" />Новая задача</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Новая задача</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Название</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label>Описание</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Приоритет</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Низкий</SelectItem>
                      <SelectItem value="medium">Средний</SelectItem>
                      <SelectItem value="high">Высокий</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Дедлайн</Label><Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={create} className="gradient-brand text-white">Создать</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(["todo", "done"] as const).map((col) => (
          <Card key={col}>
            <CardHeader><CardTitle>{col === "todo" ? "К выполнению" : "Выполнено"}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {grouped[col].map((t) => (
                <div key={t.id} className="group flex items-start gap-3 rounded-lg border p-3">
                  <Checkbox checked={t.status === "done"} onCheckedChange={(v) => toggle(t.id, !!v)} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                    {t.description && <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant={t.priority === "high" ? "destructive" : t.priority === "medium" ? "default" : "secondary"}>
                        {t.priority === "high" ? "Высокий" : t.priority === "medium" ? "Средний" : "Низкий"}
                      </Badge>
                      {t.due_at && <Badge variant="outline">{new Date(t.due_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}</Badge>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {grouped[col].length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Пусто</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}