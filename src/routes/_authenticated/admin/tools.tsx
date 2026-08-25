import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { toolsQuery, toolCategoriesQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Search, X } from "lucide-react";
import { ViewToggle, useViewMode, EmptyState } from "@/components/mtools/view-toggle";
import { ToolIcon } from "@/components/mtools/icon";
import { IconPicker } from "@/components/mtools/icon-picker";
import { DEFAULT_CATEGORIES, TOOL_TAGS, TOOL_STATUSES, statusMeta } from "@/lib/tool-meta";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/tools")({
  head: () => ({ meta: [{ title: "Инструменты · Админ · MTools" }, { name: "description", content: "Каталог внутренних инструментов." }] }),
  component: AdminTools,
});

const NEW_CATEGORY = "__new__";

function AdminTools() {
  const qc = useQueryClient();
  const { data: tools } = useSuspenseQuery(toolsQuery());
  const { data: cats } = useQuery(toolCategoriesQuery());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { view, setView, locked } = useViewMode("admin-tools");
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("all");
  const [newCat, setNewCat] = useState("");
  const [featureDraft, setFeatureDraft] = useState("");

  const empty = {
    name: "", slug: "", description: "", icon: "Wrench", icon_mode: "icon", color: "#1E4FD9",
    category: "general", kind: "internal", url: "", is_active: true, tags: [] as string[],
    features: [] as string[], status: "online",
  };
  const [form, setForm] = useState<any>(empty);

  const categories = useMemo(() => {
    const set = new Set<string>([...DEFAULT_CATEGORIES, ...(cats ?? []).map((c: any) => c.name), ...(tools as any[]).map((t) => t.category).filter(Boolean)]);
    return Array.from(set);
  }, [cats, tools]);

  const openNew = () => { setEditing(null); setForm(empty); setNewCat(""); setOpen(true); };
  const openEdit = (t: any) => {
    setEditing(t);
    setForm({ ...empty, ...t, tags: t.tags ?? [], features: t.features ?? [] });
    setNewCat("");
    setOpen(true);
  };

  const toggleTag = (tag: string) =>
    setForm((f: any) => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter((t: string) => t !== tag) : [...f.tags, tag] }));

  const save = async () => {
    if (!form.name || !form.slug) return toast.error("Название и slug обязательны");
    const category = form.category === NEW_CATEGORY ? newCat.trim() : form.category;
    if (!category) return toast.error("Укажите категорию");
    if (form.category === NEW_CATEGORY) {
      await supabase.from("tool_categories").insert({ name: category }).select().maybeSingle();
      qc.invalidateQueries({ queryKey: ["tool-categories"] });
    }
    const { id, created_at, updated_at, last_checked_at, ...rest } = form;
    const payload = { ...rest, category, url: form.url || null };
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

  const filtered = useMemo(
    () =>
      (tools as any[]).filter((t) => {
        if (fCat !== "all" && t.category !== fCat) return false;
        if (q && !`${t.name} ${t.slug} ${t.description ?? ""} ${(t.tags ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [tools, q, fCat],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Инструменты</h1>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setView} locked={locked} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gradient-brand text-white" onClick={openNew}><Plus className="mr-2 h-4 w-4" />Новый</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Редактировать" : "Новый инструмент"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Название</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Slug (латиница, тире)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
                <div><Label>Описание</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

                <div>
                  <Label>Категория</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Выберите категорию" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      <SelectItem value={NEW_CATEGORY}>+ Новая категория…</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.category === NEW_CATEGORY && (
                    <Input className="mt-2" placeholder="Название новой категории" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
                  )}
                </div>

                <div>
                  <Label>Теги</Label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {TOOL_TAGS.map((tag) => (
                      <Badge
                        key={tag}
                        variant={form.tags.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Возможности</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      value={featureDraft}
                      placeholder="Добавить пункт и Enter"
                      onChange={(e) => setFeatureDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && featureDraft.trim()) {
                          e.preventDefault();
                          setForm({ ...form, features: [...form.features, featureDraft.trim()] });
                          setFeatureDraft("");
                        }
                      }}
                    />
                  </div>
                  {form.features.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {form.features.map((f: string, i: number) => (
                        <Badge key={`${f}-${i}`} variant="secondary" className="gap-1">
                          {f}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => setForm({ ...form, features: form.features.filter((_: string, j: number) => j !== i) })} />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <IconPicker icon={form.icon} iconMode={form.icon_mode} color={form.color} url={form.url} onChange={(patch) => setForm({ ...form, ...patch })} />

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

                <div><Label>Статус</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TOOL_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {form.kind === "external" && <div><Label>URL</Label><Input value={form.url ?? ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" /></div>}
                <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Активен</Label></div>
                <Button onClick={save} className="w-full gradient-brand text-white">Сохранить</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию, описанию, тегам" className="pl-9" />
        </div>
        <Select value={fCat} onValueChange={setFCat}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {view === "cards" ? (
        <Card>
          <CardHeader><CardTitle>Инструменты ({filtered.length})</CardTitle></CardHeader>
          <CardContent>
            {filtered.length === 0 && <EmptyState>Ничего не найдено</EmptyState>}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t: any) => {
            const sm = statusMeta(t);
            return (
              <Card key={t.id}>
                <CardHeader className="flex flex-row items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: (t.color ?? "#1E4FD9") + "22", color: t.color }}>
                    <ToolIcon icon={t.icon} iconMode={t.icon_mode} url={t.url} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <div className="text-xs text-muted-foreground">{t.slug} · {t.category}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />{sm.label}
                      </span>
                      {(t.tags ?? []).map((tag: string) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            );
          })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Инструменты ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Инструмент</th>
                  <th className="p-3">Категория</th>
                  <th className="p-3">Тип</th>
                  <th className="p-3">Теги</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any) => {
                  const sm = statusMeta(t);
                  return (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: (t.color ?? "#1E4FD9") + "22", color: t.color }}>
                            <ToolIcon icon={t.icon} iconMode={t.icon_mode} url={t.url} className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{t.name}</div>
                            <div className="truncate text-xs text-muted-foreground">{t.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">{t.category}</td>
                      <td className="p-3">{t.kind === "external" ? "Внешний" : "Встроенный"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">{(t.tags ?? []).map((tag: string) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}</div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 text-xs"><span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />{sm.label}</span>
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="p-6"><EmptyState>Ничего не найдено</EmptyState></div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
