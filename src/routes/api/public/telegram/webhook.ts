import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

function deriveSecret(key: string) {
  return createHash("sha256").update(`telegram-webhook:${key}`).digest("base64url");
}
function safeEqual(a: string, b: string) {
  const A = Buffer.from(a); const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

async function sendMessage(chatId: number, text: string) {
  const lovable = process.env.LOVABLE_API_KEY!;
  const tg = process.env.TELEGRAM_API_KEY!;
  await fetch(`${GATEWAY}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": tg,
    },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tg = process.env.TELEGRAM_API_KEY;
        if (!tg) return new Response("Telegram not configured", { status: 503 });
        const expected = deriveSecret(tg);
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });

        const update = await request.json();
        const message = update.message ?? update.edited_message;
        if (!message?.chat?.id || typeof update.update_id !== "number") {
          return Response.json({ ok: true, ignored: true });
        }

        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        await supabase.from("telegram_messages").upsert(
          {
            update_id: update.update_id,
            chat_id: message.chat.id,
            user_id: message.from?.id ?? null,
            username: message.from?.username ?? null,
            text: message.text ?? null,
            raw_update: update,
          },
          { onConflict: "update_id" },
        );

        const chatId: number = message.chat.id;
        const text: string = (message.text ?? "").trim();
        const cmd = text.split(/\s+/)[0]?.toLowerCase() ?? "";
        const arg = text.split(/\s+/).slice(1).join(" ");

        // Find profile bound to this chat
        const { data: linked } = await supabase
          .from("profiles")
          .select("id, full_name, department_id, department:departments(name)")
          .eq("telegram_chat_id", String(chatId))
          .maybeSingle();

        // /start & /help
        if (cmd === "/start" || cmd === "/help") {
          const base = [
            "👋 Я MTools-бот вашей команды.",
            "",
            "<b>Команды:</b>",
            "/link CODE — привязать аккаунт (код из личного кабинета)",
            "/tasks — мои открытые задачи",
            "/shift — ближайшая смена",
            "/team — задачи отдела (для менеджеров)",
          ].join("\n");
          await sendMessage(chatId, base);
          return Response.json({ ok: true });
        }

        // /link CODE
        if (cmd === "/link") {
          const code = arg.trim().toUpperCase();
          if (!code) {
            await sendMessage(chatId, "Использование: <code>/link ВАШКОД</code>");
            return Response.json({ ok: true });
          }
          const { data: prof } = await supabase.from("profiles").select("id, full_name").eq("telegram_link_code", code).maybeSingle();
          if (!prof) {
            await sendMessage(chatId, "❌ Код не найден. Сгенерируйте новый в кабинете MTools.");
            return Response.json({ ok: true });
          }
          await supabase
            .from("profiles")
            .update({
              telegram_chat_id: String(chatId),
              telegram_username: message.from?.username ?? null,
              telegram_link_code: null,
            })
            .eq("id", prof.id);
          await sendMessage(chatId, `✅ Готово, ${prof.full_name ?? "коллега"}! Аккаунт привязан.`);
          return Response.json({ ok: true });
        }

        if (!linked) {
          await sendMessage(chatId, "Сначала привяжите аккаунт: <code>/link ВАШКОД</code>");
          return Response.json({ ok: true });
        }

        // /tasks
        if (cmd === "/tasks") {
          const { data: tasks } = await supabase
            .from("tasks").select("title, priority, due_at")
            .eq("user_id", linked.id).neq("status", "done")
            .order("due_at", { ascending: true, nullsFirst: false }).limit(10);
          if (!tasks?.length) { await sendMessage(chatId, "🎉 Открытых задач нет."); return Response.json({ ok: true }); }
          const body = tasks.map((t: any) =>
            `• ${t.title}${t.due_at ? ` <i>(до ${new Date(t.due_at).toLocaleDateString("ru-RU")})</i>` : ""}`,
          ).join("\n");
          await sendMessage(chatId, `<b>Ваши задачи:</b>\n${body}`);
          return Response.json({ ok: true });
        }

        // /shift
        if (cmd === "/shift") {
          const { data: shifts } = await supabase
            .from("shifts").select("starts_at, ends_at, title")
            .eq("user_id", linked.id).gte("ends_at", new Date().toISOString())
            .order("starts_at").limit(3);
          if (!shifts?.length) { await sendMessage(chatId, "Ближайших смен нет."); return Response.json({ ok: true }); }
          const body = shifts.map((s: any) =>
            `• ${new Date(s.starts_at).toLocaleString("ru-RU")} → ${new Date(s.ends_at).toLocaleTimeString("ru-RU", { timeStyle: "short" })}${s.title ? " · " + s.title : ""}`,
          ).join("\n");
          await sendMessage(chatId, `<b>Ваши смены:</b>\n${body}`);
          return Response.json({ ok: true });
        }

        // /team — manager/admin
        if (cmd === "/team") {
          const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", linked.id);
          const isMgr = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "manager");
          if (!isMgr) { await sendMessage(chatId, "Команда доступна менеджерам."); return Response.json({ ok: true }); }
          if (!linked.department_id) { await sendMessage(chatId, "Вы не привязаны к отделу."); return Response.json({ ok: true }); }
          const { data: members } = await supabase.from("profiles").select("id, full_name").eq("department_id", linked.department_id);
          const ids = (members ?? []).map((m: any) => m.id);
          const { data: tasks } = await supabase.from("tasks").select("title, user_id").in("user_id", ids).neq("status", "done").limit(20);
          const nameMap = new Map((members ?? []).map((m: any) => [m.id, m.full_name]));
          const body = (tasks ?? []).map((t: any) => `• [${nameMap.get(t.user_id) ?? "?"}] ${t.title}`).join("\n") || "Открытых задач нет";
          await sendMessage(chatId, `<b>Задачи отдела ${(linked.department as any)?.name ?? ""}:</b>\n${body}`);
          return Response.json({ ok: true });
        }

        await sendMessage(chatId, "Не знаю такой команды. Попробуйте /help");
        return Response.json({ ok: true });
      },
    },
  },
});