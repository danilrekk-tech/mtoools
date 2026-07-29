import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { shiftsQuery, usersQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/shifts")({
  head: () => ({ meta: [{ title: "Смены · Админ · MTools" }, { name: "description", content: "Планирование рабочих смен." }] }),
  component: AdminShifts,
});

function AdminShifts() {
  const qc = useQueryClient();
  const { data: shifts } = useSuspenseQuery(shiftsQuery());
  const { data: users } = useSuspenseQuery(usersQuery());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", starts_at: "", ends_at: "", title: "" });

  const create = async () => {
    if (!form.user_id || !form.starts_at || !form.ends_at) return toast.error("Заполните все поля");
    const { error } = await supabase.from("shifts").insert({ ...form, starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString() });
    if (error) return toast.error(error.message);
    setForm({ user_id: "", starts_at: "", ends_at: "", title: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["shifts"] });
  };

  const remove = async (id: string) => {
    await supabase.from("shifts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["shifts"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Смены</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-brand text-white"><Plus className="mr-2 h-4 w-4" />Новая смена</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Назначить смену</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Сотрудник</Label>
                <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Начало</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
              <div><Label>Окончание</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
              <div><Label>Название</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <Button onClick={create} className="w-full gradient-brand text-white">Создать</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader><CardTitle>Расписание ({shifts.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {shifts.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Смены пока не назначены</div>}
          {shifts.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">{s.user?.full_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(s.starts_at).toLocaleString("ru-RU")} → {new Date(s.ends_at).toLocaleString("ru-RU")}
                </div>
                {s.title && <div className="mt-1 text-xs">{s.title}</div>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}