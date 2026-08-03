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
            "/new ТЕКСТ — создать задачу",
            "/done N — закрыть задачу №N из /tasks",
            "/shift — ближайшая смена",
            "/time — запустить или остановить таймер",
            "/report — время за сегодня и неделю",
            "/tools — мои инструменты и сервисы",
            "/me — мой профиль",
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
          const body = tasks.map((t: any, i: number) =>
            `${i + 1}. ${t.title}${t.due_at ? ` <i>(до ${new Date(t.due_at).toLocaleDateString("ru-RU")})</i>` : ""}`,
          ).join("\n");
          await sendMessage(chatId, `<b>Ваши задачи:</b>\n${body}\n\nЗакрыть: <code>/done 1</code>`);
          return Response.json({ ok: true });
        }

        // /new — создать задачу
        if (cmd === "/new") {
          if (!arg.trim()) { await sendMessage(chatId, "Использование: <code>/new Позвонить клиенту</code>"); return Response.json({ ok: true }); }
          const { error } = await supabase.from("tasks").insert({
            user_id: linked.id, assignee_id: linked.id, created_by: linked.id, title: arg.trim(), status: "todo", priority: "medium",
          });
          await sendMessage(chatId, error ? `❌ ${error.message}` : `✅ Задача создана: ${arg.trim()}`);
          return Response.json({ ok: true });
        }

        // /done N — закрыть задачу
        if (cmd === "/done") {
          const n = Number(arg.trim());
          const { data: list } = await supabase
            .from("tasks").select("id, title").eq("user_id", linked.id).neq("status", "done")
            .order("due_at", { ascending: true, nullsFirst: false }).limit(10);
          const target = list?.[n - 1];
          if (!n || !target) { await sendMessage(chatId, "Укажите номер задачи из /tasks, например <code>/done 2</code>"); return Response.json({ ok: true }); }
          await supabase.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", target.id);
          await sendMessage(chatId, `✅ Закрыто: ${target.title}`);
          return Response.json({ ok: true });
        }

        // /time — таймер
        if (cmd === "/time") {
          const { data: active } = await supabase
            .from("time_entries").select("id, started_at, note").eq("user_id", linked.id).is("ended_at", null).maybeSingle();
          if (active) {
            const dur = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000);
            await supabase.from("time_entries").update({ ended_at: new Date().toISOString(), duration_seconds: dur }).eq("id", active.id);
            await sendMessage(chatId, `⏹ Таймер остановлен: ${(dur / 3600).toFixed(2)} ч`);
          } else {
            await supabase.from("time_entries").insert({ user_id: linked.id, note: arg.trim() || "Работа из Telegram" });
            await sendMessage(chatId, "▶️ Таймер запущен. Отправьте /time снова, чтобы остановить.");
          }
          return Response.json({ ok: true });
        }

        // /report — время
        if (cmd === "/report") {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const weekStart = new Date(today); weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
          const { data: entries } = await supabase
            .from("time_entries").select("started_at, duration_seconds").eq("user_id", linked.id).gte("started_at", weekStart.toISOString());
          let d = 0, w = 0;
          for (const e of entries ?? []) {
            const dur = (e as any).duration_seconds ?? 0;
            w += dur;
            if (new Date((e as any).started_at) >= today) d += dur;
          }
          await sendMessage(chatId, `<b>Учёт времени</b>\nСегодня: ${(d / 3600).toFixed(1)} ч\nЗа неделю: ${(w / 3600).toFixed(1)} ч`);
          return Response.json({ ok: true });
        }

        // /tools — инструменты сотрудника
        if (cmd === "/tools") {
          const { data: allowed } = await supabase
            .from("department_tools").select("tool:tools(name, url, kind, is_active)")
            .eq("department_id", linked.department_id ?? "00000000-0000-0000-0000-000000000000");
          const items = (allowed ?? []).map((r: any) => r.tool).filter((t: any) => t?.is_active);
          if (!items.length) { await sendMessage(chatId, "Инструменты не назначены."); return Response.json({ ok: true }); }
          const body = items.map((t: any) => (t.url ? `• <a href="${t.url}">${t.name}</a>` : `• ${t.name}`)).join("\n");
          await sendMessage(chatId, `<b>Ваши инструменты:</b>\n${body}`);
          return Response.json({ ok: true });
        }

        // /me — профиль
        if (cmd === "/me") {
          const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", linked.id);
          const roleList = (roles ?? []).map((r: any) => r.role).join(", ") || "employee";
          const { count } = await supabase
            .from("tasks").select("id", { count: "exact", head: true }).eq("user_id", linked.id).neq("status", "done");
          await sendMessage(
            chatId,
            `<b>${linked.full_name ?? "Сотрудник"}</b>\nОтдел: ${(linked.department as any)?.name ?? "—"}\nРоли: ${roleList}\nОткрытых задач: ${count ?? 0}`,
          );
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