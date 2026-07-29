import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { profileQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Send, Copy, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/telegram")({
  head: () => ({ meta: [{ title: "Telegram-бот · MTools" }, { name: "description", content: "Персональная настройка Telegram-бота сотрудника." }] }),
  component: TelegramPage,
});

const DEFAULT_FEATURES = [
  { key: "task_reminders", label: "Напоминания о задачах", desc: "Бот пришлёт напоминание перед дедлайном" },
  { key: "shift_reminders", label: "Напоминания о сменах", desc: "Уведомление за 30 минут до смены" },
  { key: "daily_report", label: "Ежедневный отчёт", desc: "Сводка выполненного за день в 18:00" },
  { key: "morning_briefing", label: "Утренний брифинг", desc: "Список задач на день в 9:00" },
  { key: "mentions", label: "Упоминания", desc: "Уведомления, когда вас упомянули в системе" },
];

function TelegramPage() {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(profileQuery());
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [linked, setLinked] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const { data: personal } = await supabase.from("telegram_settings").select("*").eq("user_id", me!.user.id).eq("scope", "user").maybeSingle();
      let deptFeatures: Record<string, boolean> = {};
      if (me?.profile?.department_id) {
        const { data: dept } = await supabase.from("telegram_settings").select("*").eq("department_id", me.profile.department_id).eq("scope", "department").maybeSingle();
        deptFeatures = (dept?.features as any) ?? {};
      }
      const merged = { ...deptFeatures, ...((personal?.features as any) ?? {}) };
      setSettings(merged);
      setLinked(personal);
    })();
  }, [me]);

  const linkCode = me?.profile?.telegram_link_code ?? "";

  const generateCode = async () => {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    await supabase.from("profiles").update({ telegram_link_code: code }).eq("id", me!.user.id);
    toast.success("Новый код создан");
    qc.invalidateQueries({ queryKey: ["me", "profile"] });
  };

  const toggle = async (key: string, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    const { data: existing } = await supabase.from("telegram_settings").select("id").eq("user_id", me!.user.id).eq("scope", "user").maybeSingle();
    if (existing) {
      await supabase.from("telegram_settings").update({ features: next }).eq("id", existing.id);
    } else {
      await supabase.from("telegram_settings").insert({ scope: "user", user_id: me!.user.id, features: next });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Telegram-бот</h1>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" />Привязка аккаунта</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {me?.profile?.telegram_chat_id ? (
            <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <div className="font-medium">Аккаунт привязан</div>
                <div className="text-xs text-muted-foreground">@{me.profile.telegram_username ?? "—"}</div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Отправьте команду <code className="rounded bg-muted px-1 py-0.5">/link {linkCode || "СГЕНЕРИРУЙТЕ_КОД"}</code> нашему боту для привязки.</p>
              <div className="flex gap-2">
                <Input readOnly value={linkCode} placeholder="Нажмите Сгенерировать" className="font-mono" />
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(linkCode); toast.success("Скопировано"); }} disabled={!linkCode}><Copy className="h-4 w-4" /></Button>
                <Button onClick={generateCode} className="gradient-brand text-white">Сгенерировать</Button>
              </div>
              <p className="text-xs text-muted-foreground">Бот компании подключается администратором через настройки коннекторов.</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Мои уведомления</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {DEFAULT_FEATURES.map((f) => (
            <div key={f.key} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-xs text-muted-foreground">{f.desc}</div>
              </div>
              <Switch checked={!!settings[f.key]} onCheckedChange={(v) => toggle(f.key, v)} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Настройки отдела применяются по умолчанию, а личные — переопределяют их.</p>
        </CardContent>
      </Card>
    </div>
  );
}