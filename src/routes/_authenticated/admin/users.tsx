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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Send, Search, Download, LayoutGrid, Table as TableIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sendTelegramToUser } from "@/lib/telegram.functions";
import { UserAvatar, DeptDot } from "@/components/mtools/user-avatar";


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
  const [q, setQ] = useState("");
  const [fDept, setFDept] = useState("all");
  const [fRole, setFRole] = useState("all");
  const [view, setView] = useState<"cards" | "table">("cards");

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

  const toggleActive = async (userId: string, next: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_active: next }).eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success(next ? "Сотрудник активирован" : "Доступ отключён");
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const filtered = useMemo(
    () =>
      (users as any[]).filter((u) => {
        if (fDept !== "all" && (u.department_id ?? "none") !== fDept) return false;
        if (fRole !== "all" && !u.roles.includes(fRole)) return false;
        if (q && !`${u.full_name ?? ""} ${u.email ?? ""} ${u.position ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [users, q, fDept, fRole],
  );

  const exportCsv = () => {
    const rows = [["Имя", "Email", "Должность", "Отдел", "Роли", "Telegram", "Активен"]].concat(
      filtered.map((u: any) => [
        u.full_name ?? "",
        u.email ?? "",
        u.position ?? "",
        (departments ?? []).find((d: any) => d.id === u.department_id)?.name ?? "",
        u.roles.join("/"),
        u.telegram_username ?? (u.telegram_chat_id ? "linked" : ""),
        u.is_active === false ? "нет" : "да",
      ]),
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, "'")}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "mtools-users.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Пользователи</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            <Button variant={view === "cards" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("cards")}><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant={view === "table" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("table")}><TableIcon className="h-4 w-4" /></Button>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
        </div>
      </div>


      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Всего", users.length],
          ["С Telegram", (users as any[]).filter((u) => u.telegram_chat_id).length],
          ["Администраторов", (users as any[]).filter((u) => u.roles.includes("admin")).length],
        ].map(([label, val]) => (
          <Card key={label as string}>
            <CardContent className="py-4">
              <div className="text-xs text-muted-foreground">{label as string}</div>
              <div className="text-2xl font-bold">{val as number}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени, почте, должности" className="pl-9" />
        </div>
        <Select value={fDept} onValueChange={setFDept}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все отделы</SelectItem>
            <SelectItem value="none">Без отдела</SelectItem>
            {(departments ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fRole} onValueChange={setFRole}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все роли</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {view === "table" ? (
        <Card>
          <CardHeader><CardTitle>Сотрудники ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Сотрудник</th>
                  <th className="p-3">Отдел</th>
                  <th className="p-3">Роли</th>
                  <th className="p-3">Telegram</th>
                  <th className="p-3">Доступ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u: any) => {
                  const dept = (departments ?? []).find((d: any) => d.id === u.department_id);
                  return (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={u.full_name} email={u.email} avatarUrl={u.avatar_url} className="h-8 w-8" />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{u.full_name ?? "Без имени"}</div>
                            <div className="truncate text-xs text-muted-foreground">{u.email}{u.position ? ` · ${u.position}` : ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <DeptDot color={dept?.color} />{dept?.name ?? "—"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          {u.roles.map((r: string) => <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>)}
                        </div>
                      </td>
                      <td className="p-3 text-xs">{u.telegram_chat_id ? `@${u.telegram_username ?? "linked"}` : "—"}</td>
                      <td className="p-3"><Switch checked={u.is_active !== false} onCheckedChange={(v) => toggleActive(u.id, v)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader><CardTitle>Сотрудники ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {filtered.length === 0 && <div className="text-sm text-muted-foreground">Никого не найдено</div>}
          {filtered.map((u: any) => {
            const dept = (departments ?? []).find((d: any) => d.id === u.department_id);
            return (
            <div key={u.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1.5fr_1fr_1.5fr_auto]">
              <div className="flex min-w-0 gap-3">
                <UserAvatar name={u.full_name} email={u.email} avatarUrl={u.avatar_url} />
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{u.full_name ?? "Без имени"}</span>
                  {u.is_active === false && <Badge variant="destructive">отключён</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                {u.position && <div className="text-xs text-muted-foreground">{u.position}</div>}
                {dept && (
                  <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <DeptDot color={dept.color} />{dept.name}
                  </div>
                )}
                {u.telegram_chat_id && <div className="mt-1 text-xs text-primary">TG: @{u.telegram_username ?? "linked"}</div>}
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={u.is_active !== false} onCheckedChange={(v) => toggleActive(u.id, v)} />
                  Доступ активен
                </label>
                </div>
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
            );
          })}
        </CardContent>
      </Card>
      )}


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