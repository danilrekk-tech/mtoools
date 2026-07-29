import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { departmentsQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { broadcastTelegram } from "@/lib/telegram.functions";
import { Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/telegram")({
  head: () => ({ meta: [{ title: "Telegram · Админ · MTools" }, { name: "description", content: "Настройки бота по отделам." }] }),
  component: AdminTelegram,
});

const FEATURES = [
  { key: "task_reminders", label: "Напоминания о задачах" },
  { key: "shift_reminders", label: "Напоминания о сменах" },
  { key: "daily_report", label: "Ежедневный отчёт" },
  { key: "morning_briefing", label: "Утренний брифинг" },
  { key: "mentions", label: "Упоминания" },
  { key: "kpi_digest", label: "Дайджест KPI" },
];

function AdminTelegram() {
  const { data: departments } = useSuspenseQuery(departmentsQuery());
  const [settings, setSettings] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("telegram_settings").select("*").eq("scope", "department");
      const map: Record<string, Record<string, boolean>> = {};
      for (const r of data ?? []) if (r.department_id) map[r.department_id] = (r.features as any) ?? {};
      setSettings(map);
    })();
  }, []);

  const toggle = async (deptId: string, key: string, value: boolean) => {
    const next = { ...settings, [deptId]: { ...(settings[deptId] ?? {}), [key]: value } };
    setSettings(next);
    const { data: existing } = await supabase.from("telegram_settings").select("id").eq("department_id", deptId).eq("scope", "department").maybeSingle();
    if (existing) {
      await supabase.from("telegram_settings").update({ features: next[deptId] }).eq("id", existing.id);
    } else {
      await supabase.from("telegram_settings").insert({ scope: "department", department_id: deptId, features: next[deptId] });
    }
    toast.success("Обновлено");
  };

  const broadcast = useServerFn(broadcastTelegram);
  const [msg, setMsg] = useState("");
  const [target, setTarget] = useState<string>("all");
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!msg.trim()) return toast.error("Введите текст");
    setSending(true);
    try {
      const r = await broadcast({ data: { text: msg, department_id: target === "all" ? null : target } });
      toast.success(`Отправлено ${r.sent} из ${r.total}`);
      setMsg("");
    } catch (e: any) { toast.error(e.message); }
    setSending(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold sm:text-2xl">Telegram-бот</h1>
      <Tabs defaultValue="features">
        <TabsList>
          <TabsTrigger value="features">Функции отделов</TabsTrigger>
          <TabsTrigger value="broadcast">Рассылка</TabsTrigger>
        </TabsList>
        <TabsContent value="features" className="mt-4">
      <p className="text-sm text-muted-foreground">Включённые функции применяются ко всем сотрудникам отдела по умолчанию.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {departments.map((d: any) => (
          <Card key={d.id}>
            <CardHeader className="flex flex-row items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: d.color }} />
              <CardTitle className="text-base">{d.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {FEATURES.map((f) => (
                <div key={f.key} className="flex items-center justify-between rounded border p-2">
                  <Label className="text-sm">{f.label}</Label>
                  <Switch checked={!!settings[d.id]?.[f.key]} onCheckedChange={(v) => toggle(d.id, f.key, v)} />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
        </TabsContent>
        <TabsContent value="broadcast" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Отправить сообщение</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Кому</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всем сотрудникам</SelectItem>
                    {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Текст (поддерживает HTML)</Label>
                <Textarea rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Коллеги, ..." />
              </div>
              <Button onClick={send} disabled={sending} className="gradient-brand text-white">
                <Send className="mr-2 h-4 w-4" />{sending ? "Отправка…" : "Отправить"}
              </Button>
              <p className="text-xs text-muted-foreground">Сообщение получат только сотрудники с привязанным Telegram.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}