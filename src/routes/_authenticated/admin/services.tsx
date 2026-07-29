import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { servicesQuery, departmentsQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/services")({
  head: () => ({ meta: [{ title: "Сервисы · Админ · MTools" }, { name: "description", content: "Управление внешними сервисами компании." }] }),
  component: AdminServices,
});

function AdminServices() {
  const qc = useQueryClient();
  const { data: services } = useSuspenseQuery(servicesQuery());
  const { data: departments } = useSuspenseQuery(departmentsQuery());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", url: "", description: "", icon: "globe", department_id: "" });

  const create = async () => {
    if (!form.name || !form.url) return toast.error("Название и URL обязательны");
    const payload = { ...form, department_id: form.department_id || null };
    const { error } = await supabase.from("services").insert(payload);
    if (error) return toast.error(error.message);
    setForm({ name: "", url: "", description: "", icon: "globe", department_id: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["services"] });
  };

  const remove = async (id: string) => {
    await supabase.from("services").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["services"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Сервисы</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-brand text-white"><Plus className="mr-2 h-4 w-4" />Новый сервис</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Новый сервис</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Название</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" /></div>
              <div><Label>Описание</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Иконка (lucide)</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></div>
              <div><Label>Отдел (необязательно)</Label>
                <Select value={form.department_id || "none"} onValueChange={(v) => setForm({ ...form, department_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Все отделы</SelectItem>
                    {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={create} className="w-full gradient-brand text-white">Создать</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {services.map((s: any) => (
          <Card key={s.id}>
            <CardContent className="flex items-start justify-between p-4">
              <div className="min-w-0">
                <div className="font-medium">{s.name}</div>
                <a href={s.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary hover:underline">{s.url}</a>
                {s.description && <div className="mt-1 text-xs text-muted-foreground">{s.description}</div>}
                {s.department && <div className="mt-1 text-xs">Отдел: {s.department.name}</div>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}