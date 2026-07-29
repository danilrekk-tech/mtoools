import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { activeTimeEntryQuery, profileQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/time-tracker")({
  head: () => ({ meta: [{ title: "Учёт времени · MTools" }, { name: "description", content: "Таймер и история рабочего времени." }] }),
  component: TimeTracker,
});

function fmt(sec: number) {
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function TimeTracker() {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(profileQuery());
  const { data: active } = useSuspenseQuery(activeTimeEntryQuery());
  const [now, setNow] = useState(Date.now());
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => { if (!active) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [active]);
  useEffect(() => {
    supabase.from("time_entries").select("*").not("ended_at", "is", null).order("started_at", { ascending: false }).limit(20).then(({ data }) => setHistory(data ?? []));
  }, [active]);

  const secs = active ? Math.floor((now - new Date(active.started_at).getTime()) / 1000) : 0;
  const toggle = async () => {
    if (active) {
      await supabase.from("time_entries").update({ ended_at: new Date().toISOString(), duration_seconds: secs }).eq("id", active.id);
      toast.success("Смена сохранена");
    } else {
      await supabase.from("time_entries").insert({ user_id: me!.user.id });
      toast.success("Таймер запущен");
    }
    qc.invalidateQueries({ queryKey: ["me", "time-entry"] });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Учёт рабочего времени</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-10">
          <div className="font-mono text-6xl font-bold tabular-nums md:text-7xl">{fmt(secs)}</div>
          <Button onClick={toggle} size="lg" className={active ? "" : "gradient-brand text-white"} variant={active ? "destructive" : "default"}>
            {active ? <><Square className="mr-2 h-4 w-4" />Остановить</> : <><Play className="mr-2 h-4 w-4" />Начать смену</>}
          </Button>
          {active && <div className="text-sm text-muted-foreground">Начало: {new Date(active.started_at).toLocaleString("ru-RU")}</div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>История</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && <div className="text-sm text-muted-foreground">Пока пусто</div>}
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{new Date(h.started_at).toLocaleString("ru-RU")}</span>
              <span className="font-mono">{fmt(h.duration_seconds ?? 0)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}