import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { usersQuery, departmentsQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sendTelegramToUser } from "@/lib/telegram.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Пользователи · Админ · MTools" }, { name: "description", content: "Управление сотрудниками и ролями." }] }),
  component: AdminUsers,
});

const ROLES = ["admin", "manager", "employee"] as const;

function AdminUsers() {
  const qc = useQueryClient();
  const { data: users } = useSuspenseQuery(usersQuery());
  const { data: departments } = useQuery(departmentsQuery());
  const send = useServerFn(sendTelegramToUser);
  const [dm, setDm] = useState<{ user: any; text: string } | null>(null);
  const [sending, setSending] = useState(false);

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

  const submitDm = async () => {
    if (!dm) return;
    setSending(true);
    try {
      const r = await send({ data: { user_id: dm.user.id, text: dm.text } });
      toast.success(`Отправлено ${r.to ?? ""}`);
      setDm(null);
    } catch (e: any) { toast.error(e.message); }
    setSending(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold sm:text-2xl">Пользователи</h1>
      <Card>
        <CardHeader><CardTitle>Все сотрудники ({users.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {users.map((u: any) => (
            <div key={u.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1.5fr_1fr_1.5fr_auto]">
              <div className="min-w-0">
                <div className="font-medium">{u.full_name ?? "Без имени"}</div>
                <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                {u.position && <div className="text-xs text-muted-foreground">{u.position}</div>}
                {u.telegram_chat_id && <div className="mt-1 text-xs text-primary">TG: @{u.telegram_username ?? "linked"}</div>}
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
              <Button
                size="sm"
                variant="outline"
                disabled={!u.telegram_chat_id}
                title={u.telegram_chat_id ? "Написать в Telegram" : "Telegram не привязан"}
                onClick={() => setDm({ user: u, text: "" })}
              >
                <Send className="mr-2 h-4 w-4" />TG
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!dm} onOpenChange={(v) => !v && setDm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Сообщение · {dm?.user?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Текст (HTML поддерживается)</Label>
            <Textarea rows={5} value={dm?.text ?? ""} onChange={(e) => setDm(dm ? { ...dm, text: e.target.value } : dm)} />
          </div>
          <DialogFooter>
            <Button onClick={submitDm} disabled={sending} className="gradient-brand text-white">
              {sending ? "Отправка…" : "Отправить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}