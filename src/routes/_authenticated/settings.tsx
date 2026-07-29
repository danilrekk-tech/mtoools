import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { profileQuery, departmentsQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Настройки · MTools" }, { name: "description", content: "Личные настройки профиля." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(profileQuery());
  const [name, setName] = useState(me?.profile?.full_name ?? "");
  const [pos, setPos] = useState(me?.profile?.position ?? "");
  const [tz, setTz] = useState(me?.profile?.timezone ?? "Europe/Moscow");

  useEffect(() => {
    setName(me?.profile?.full_name ?? "");
    setPos(me?.profile?.position ?? "");
    setTz(me?.profile?.timezone ?? "Europe/Moscow");
  }, [me]);

  const save = async () => {
    const { error } = await supabase.from("profiles").update({ full_name: name, position: pos, timezone: tz }).eq("id", me!.user.id);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    qc.invalidateQueries({ queryKey: ["me", "profile"] });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Мой профиль</h1>
      <Card>
        <CardHeader><CardTitle>Персональные данные</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Email</Label><Input value={me?.user.email ?? ""} disabled /></div>
          <div><Label>Имя</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Должность</Label><Input value={pos ?? ""} onChange={(e) => setPos(e.target.value)} /></div>
          <div><Label>Часовой пояс</Label><Input value={tz ?? ""} onChange={(e) => setTz(e.target.value)} /></div>
          <div><Label>Отдел</Label><Input value={(me?.profile?.department as any)?.name ?? "Не назначен"} disabled /></div>
          <Button onClick={save} className="gradient-brand text-white">Сохранить</Button>
        </CardContent>
      </Card>
    </div>
  );
}