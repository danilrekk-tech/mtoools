import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

async function sendTelegram(chatId: number, text: string) {
  const lovable = process.env.LOVABLE_API_KEY;
  const tg = process.env.TELEGRAM_API_KEY;
  if (!lovable || !tg) return false;
  const r = await fetch(`${GATEWAY}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": tg,
    },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  return r.ok;
}

export const Route = createFileRoute("/api/public/cron/dispatch-notifications")({
  server: {
    handlers: {
      POST: async () => {
        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: pending } = await supabase
          .from("notifications")
          .select("id, user_id, title, body, channel")
          .is("delivered_at", null)
          .in("channel", ["telegram"])
          .limit(100);
        let sent = 0;
        for (const n of pending ?? []) {
          const { data: p } = await supabase.from("profiles").select("telegram_chat_id").eq("id", n.user_id).maybeSingle();
          if (!p?.telegram_chat_id) {
            await supabase.from("notifications").update({ delivered_at: new Date().toISOString() }).eq("id", n.id);
            continue;
          }
          const ok = await sendTelegram(Number(p.telegram_chat_id), `<b>${n.title}</b>\n${n.body ?? ""}`);
          if (ok) {
            await supabase.from("notifications").update({ delivered_at: new Date().toISOString() }).eq("id", n.id);
            sent++;
          }
        }
        return Response.json({ ok: true, sent, pending: pending?.length ?? 0 });
      },
    },
  },
});