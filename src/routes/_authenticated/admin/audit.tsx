import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { auditLogQuery, usersQuery, toolsQuery, departmentsQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutList, Table2 } from "lucide-react";
import { UserAvatar } from "@/components/mtools/user-avatar";
import { describeAudit, ENTITY_LABELS } from "@/lib/audit-text";

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
  const { data: tools } = useSuspenseQuery(toolsQuery());
  const { data: departments } = useSuspenseQuery(departmentsQuery());
  const userMap = useMemo(() => new Map((users as any[]).map((u) => [u.id, u])), [users]);
  const ctx = useMemo(
    () => ({
      userName: (id?: string | null) => {
        const u = userMap.get(id ?? "") as any;
        return u?.full_name ?? u?.email ?? "";
      },
      toolName: (id?: string | null) => (tools as any[]).find((t) => t.id === id)?.name ?? "инструмент",
      deptName: (id?: string | null) => (departments as any[]).find((d) => d.id === id)?.name ?? "отдел",
    }),
    [userMap, tools, departments],
  );
  const [entity, setEntity] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");

  const filtered = useMemo(() => {
    return (logs as any[])
      .map((l) => ({ ...l, text: describeAudit(l, ctx) }))
      .filter((l) => {
        if (entity !== "all" && l.entity_type !== entity) return false;
        if (search && !l.text.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });
  }, [logs, entity, search, ctx]);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ScrollText}
        title="Аудит-лог"
        subtitle="Все действия админов, изменения ролей, отделов и доступов."
        actions={<Button variant="outline" size="sm" onClick={() => setView(view === "cards" ? "table" : "cards")}>
          {view === "cards" ? <Table2 className="mr-2 h-4 w-4" /> : <LayoutList className="mr-2 h-4 w-4" />}
          {view === "cards" ? "Таблица" : "Карточки"}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
        <Input placeholder="Поиск по событию…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ENTITIES.map((e) => <SelectItem key={e} value={e}>{e === "all" ? "Все сущности" : (ENTITY_LABELS[e] ?? e)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">События ({filtered.length})</CardTitle></CardHeader>
        <CardContent className={view === "table" ? "p-0 sm:p-0" : "space-y-2"}>
          {filtered.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Событий не найдено</div>}

          {view === "table" && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[280px]">Событие</TableHead>
                    <TableHead>Раздел</TableHead>
                    <TableHead>Автор</TableHead>
                    <TableHead className="whitespace-nowrap">Когда</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => {
                    const actor = userMap.get(l.actor_id ?? "") as any;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm">{l.text}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ENTITY_LABELS[l.entity_type] ?? l.entity_type}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{actor?.full_name ?? actor?.email ?? "система"}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ru-RU")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {view === "cards" &&
            filtered.map((l) => {
              const actor = userMap.get(l.actor_id ?? "") as any;
              return (
                <div key={l.id} className="rounded-lg border p-3">
                  <div className="flex items-start gap-3">
                    <UserAvatar name={actor?.full_name} email={actor?.email} avatarUrl={actor?.avatar_url} className="h-8 w-8" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{l.text}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={l.action === "DELETE" ? "destructive" : l.action === "INSERT" ? "default" : "secondary"} className="shrink-0">
                          {ENTITY_LABELS[l.entity_type] ?? l.entity_type}
                        </Badge>
                        {new Date(l.created_at).toLocaleString("ru-RU")}
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-primary">Технические детали</summary>
                        <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-[10px]">{JSON.stringify(l.changes, null, 2)}</pre>
                      </details>
                    </div>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}
