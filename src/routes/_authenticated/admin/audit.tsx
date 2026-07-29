import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { auditLogQuery, usersQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Аудит-лог · Админ · MTools" },
      { name: "description", content: "История действий администраторов и изменений в системе." },
    ],
  }),
  component: AuditPage,
});

const ENTITIES = ["all", "user_roles", "profiles", "department_tools", "user_tool_overrides", "tools", "shifts", "departments"] as const;

function AuditPage() {
  const { data: logs } = useSuspenseQuery(auditLogQuery());
  const { data: users } = useSuspenseQuery(usersQuery());
  const userMap = useMemo(() => new Map(users.map((u: any) => [u.id, u])), [users]);
  const [entity, setEntity] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return logs.filter((l: any) => {
      if (entity !== "all" && l.entity_type !== entity) return false;
      if (search) {
        const s = search.toLowerCase();
        const actor = (userMap.get(l.actor_id ?? "") as any)?.full_name?.toLowerCase() ?? "";
        if (!actor.includes(s) && !l.entity_type.toLowerCase().includes(s) && !(l.entity_id ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [logs, entity, search, userMap]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Аудит-лог</h1>
        <p className="text-sm text-muted-foreground">Все действия админов, изменения ролей, отделов и доступов.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
        <Input placeholder="Поиск по автору, типу, ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ENTITIES.map((e) => <SelectItem key={e} value={e}>{e === "all" ? "Все сущности" : e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">События ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Событий не найдено</div>}
          {filtered.map((l: any) => {
            const actor = userMap.get(l.actor_id ?? "") as any;
            return (
              <div key={l.id} className="rounded-lg border p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant={l.action === "DELETE" ? "destructive" : l.action === "INSERT" ? "default" : "secondary"} className="shrink-0">
                        {l.action}
                      </Badge>
                      <span className="font-medium">{l.entity_type}</span>
                      {l.entity_id && <span className="truncate text-xs text-muted-foreground">#{l.entity_id.slice(0, 8)}</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {actor?.full_name ?? actor?.email ?? "система"} · {new Date(l.created_at).toLocaleString("ru-RU")}
                    </div>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-primary">Показать изменения</summary>
                  <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-[10px]">{JSON.stringify(l.changes, null, 2)}</pre>
                </details>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}