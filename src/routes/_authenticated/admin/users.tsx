import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { usersQuery, departmentsQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Пользователи · Админ · MTools" }, { name: "description", content: "Управление сотрудниками и ролями." }] }),
  component: AdminUsers,
});

const ROLES = ["admin", "manager", "employee"] as const;

function AdminUsers() {
  const qc = useQueryClient();
  const { data: users } = useSuspenseQuery(usersQuery());
  const { data: departments } = useQuery(departmentsQuery());

  const setDepartment = async (userId: string, deptId: string) => {
    const { error } = await supabase.from("profiles").update({ department_id: deptId === "none" ? null : deptId }).eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success("Отдел обновлён");
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const toggleRole = async (userId: string, role: string, has: boolean) => {
    if (has) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    }
    toast.success("Роль обновлена");
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Пользователи</h1>
      <Card>
        <CardHeader><CardTitle>Все сотрудники ({users.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {users.map((u: any) => (
            <div key={u.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1.5fr_1fr_1.5fr]">
              <div>
                <div className="font-medium">{u.full_name ?? "Без имени"}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
                {u.position && <div className="text-xs text-muted-foreground">{u.position}</div>}
              </div>
              <Select value={u.department_id ?? "none"} onValueChange={(v) => setDepartment(u.id, v)}>
                <SelectTrigger><SelectValue placeholder="Отдел" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначен</SelectItem>
                  {(departments ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => {
                  const has = u.roles.includes(r);
                  return (
                    <Button key={r} size="sm" variant={has ? "default" : "outline"} className={has ? "gradient-brand text-white" : ""} onClick={() => toggleRole(u.id, r, has)}>
                      {r}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}