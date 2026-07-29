import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

async function callTelegram(path: string, body: unknown) {
  const lovable = process.env.LOVABLE_API_KEY;
  const tg = process.env.TELEGRAM_API_KEY;
  if (!lovable || !tg) throw new Error("Telegram-коннектор не подключён");
  const r = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": tg,
    },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Telegram [${r.status}]: ${txt}`);
  const j = JSON.parse(txt);
  if (j.ok === false) throw new Error(`Telegram error: ${j.description ?? "unknown"}`);
  return j;
}

export const sendTelegramToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), text: z.string().min(1).max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const roles = (rows ?? []).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("manager")) throw new Error("Недостаточно прав");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("profiles").select("telegram_chat_id, full_name").eq("id", data.user_id).maybeSingle();
    if (!profile?.telegram_chat_id) throw new Error("У сотрудника не привязан Telegram");
    await callTelegram("/sendMessage", { chat_id: Number(profile.telegram_chat_id), text: data.text, parse_mode: "HTML" });
    return { ok: true, to: profile.full_name };
  });

export const broadcastTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ text: z.string().min(1).max(4000), department_id: z.string().uuid().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(rows ?? []).some((r) => r.role === "admin")) throw new Error("Только для админов");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("profiles").select("telegram_chat_id").eq("is_active", true).not("telegram_chat_id", "is", null);
    if (data.department_id) q = q.eq("department_id", data.department_id);
    const { data: recipients } = await q;
    let sent = 0;
    for (const r of recipients ?? []) {
      try {
        await callTelegram("/sendMessage", { chat_id: Number(r.telegram_chat_id), text: data.text, parse_mode: "HTML" });
        sent++;
      } catch (e) {
        console.error("broadcast fail", e);
      }
    }
    return { ok: true, sent, total: recipients?.length ?? 0 };
  });