import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { toolsQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { ToolIcon } from "@/components/mtools/icon";
import { IconPicker } from "@/components/mtools/icon-picker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/tools")({
  head: () => ({ meta: [{ title: "Инструменты · Админ · MTools" }, { name: "description", content: "Каталог внутренних инструментов." }] }),
  component: AdminTools,
});

function AdminTools() {
  const qc = useQueryClient();
  const { data: tools } = useSuspenseQuery(toolsQuery());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const empty = { name: "", slug: "", description: "", icon: "Wrench", icon_mode: "icon", color: "#1E4FD9", category: "general", kind: "internal", url: "", is_active: true };
  const [form, setForm] = useState<any>(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setForm(t); setOpen(true); };

  const save = async () => {
    if (!form.name || !form.slug) return toast.error("Название и slug обязательны");
    const payload = { ...form, url: form.url || null };
    const { error } = editing
      ? await supabase.from("tools").update(payload).eq("id", editing.id)
      : await supabase.from("tools").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["tools"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить инструмент?")) return;
    await supabase.from("tools").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["tools"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Инструменты</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-brand text-white" onClick={openNew}><Plus className="mr-2 h-4 w-4" />Новый инструмент</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Редактировать" : "Новый инструмент"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Название</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Slug (латиница, тире)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
              <div><Label>Описание</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Категория</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <IconPicker
                icon={form.icon}
                iconMode={form.icon_mode}
                color={form.color}
                url={form.url}
                onChange={(patch) => setForm({ ...form, ...patch })}
              />
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Цвет</Label><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-full" /></div>
                <div><Label>Тип</Label>
                  <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Встроенный</SelectItem>
                      <SelectItem value="external">Внешняя ссылка</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.kind === "external" && <div><Label>URL</Label><Input value={form.url ?? ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" /></div>}
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Активен</Label></div>
              <Button onClick={save} className="w-full gradient-brand text-white">Сохранить</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {tools.map((t: any) => (
          <Card key={t.id}>
            <CardHeader className="flex flex-row items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: (t.color ?? "#1E4FD9") + "22", color: t.color }}>
                <ToolIcon icon={t.icon} iconMode={t.icon_mode} url={t.url} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <div className="text-xs text-muted-foreground">{t.slug} · {t.category}</div>
              </div>
            </CardHeader>
            <CardContent className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}