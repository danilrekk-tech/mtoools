import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { departmentsQuery, toolsQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/departments")({
  head: () => ({ meta: [{ title: "Отделы · Админ · MTools" }, { name: "description", content: "Управление отделами и назначением инструментов." }] }),
  component: AdminDepartments,
});

function AdminDepartments() {
  const qc = useQueryClient();
  const { data: departments } = useSuspenseQuery(departmentsQuery());
  const { data: tools } = useSuspenseQuery(toolsQuery());
  const [name, setName] = useState("");
  const [color, setColor] = useState("#1E4FD9");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deptTools, setDeptTools] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("department_tools").select("*");
      const map: Record<string, Set<string>> = {};
      for (const r of data ?? []) {
        (map[r.department_id] ??= new Set()).add(r.tool_id);
      }
      setDeptTools(map);
    })();
  }, [departments]);

  const create = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("departments").insert({ name: name.trim(), color });
    if (error) return toast.error(error.message);
    setName(""); toast.success("Отдел создан");
    qc.invalidateQueries({ queryKey: ["departments"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить отдел?")) return;
    await supabase.from("departments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["departments"] });
  };

  const toggleTool = async (deptId: string, toolId: string, has: boolean) => {
    if (has) {
      await supabase.from("department_tools").delete().eq("department_id", deptId).eq("tool_id", toolId);
    } else {
      await supabase.from("department_tools").insert({ department_id: deptId, tool_id: toolId });
    }
    const next = { ...deptTools };
    next[deptId] = new Set(next[deptId] ?? []);
    if (has) next[deptId].delete(toolId); else next[deptId].add(toolId);
    setDeptTools(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Отделы</h1>
        <Dialog>
          <DialogTrigger asChild><Button className="gradient-brand text-white"><Plus className="mr-2 h-4 w-4" />Новый отдел</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Создать отдел</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Название</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Цвет</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full" /></div>
              <Button onClick={create} className="w-full gradient-brand text-white">Создать</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-3">
        {departments.map((d: any) => (
          <Card key={d.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded" style={{ backgroundColor: d.color }} />
                <CardTitle className="text-base">{d.name}</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>{expanded === d.id ? "Скрыть" : "Инструменты"}</Button>
                <Button variant="ghost" size="icon" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            {expanded === d.id && (
              <CardContent className="grid gap-2 md:grid-cols-2">
                {tools.map((t: any) => {
                  const has = deptTools[d.id]?.has(t.id) ?? false;
                  return (
                    <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded border p-2 hover:bg-accent">
                      <Checkbox checked={has} onCheckedChange={() => toggleTool(d.id, t.id, has)} />
                      <span className="text-sm">{t.name}</span>
                    </label>
                  );
                })}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}