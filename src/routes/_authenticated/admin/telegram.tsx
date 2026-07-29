import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { departmentsQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Telegram-бот по отделам</h1>
      <p className="text-sm text-muted-foreground">Включённые функции применяются ко всем сотрудникам отдела по умолчанию.</p>
      <div className="grid gap-4 md:grid-cols-2">
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
    </div>
  );
}