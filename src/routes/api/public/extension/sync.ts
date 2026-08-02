import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" },
  });

async function loadUser(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, department_id, ui_prefs")
    .eq("extension_token", token)
    .maybeSingle();
  return { supabaseAdmin, profile };
}

export const Route = createFileRoute("/api/public/extension/sync")({
  server: {
    handlers: {
      OPTIONS: async () => json({ ok: true }),
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!/^[a-f0-9]{8,64}$/.test(token)) return json({ error: "bad token" }, 400);
        const { supabaseAdmin, profile } = await loadUser(token);
        if (!profile) return json({ error: "not found" }, 404);

        const [{ data: allTools }, { data: overrides }] = await Promise.all([
          supabaseAdmin.from("tools").select("id, slug, name, description, icon, icon_mode, color, kind, url").eq("is_active", true),
          supabaseAdmin.from("user_tool_overrides").select("tool_id, granted").eq("user_id", profile.id),
        ]);
        let deptToolIds = new Set<string>();
        if (profile.department_id) {
          const { data: dt } = await supabaseAdmin.from("department_tools").select("tool_id").eq("department_id", profile.department_id);
          deptToolIds = new Set((dt ?? []).map((r) => r.tool_id));
        }
        const ov = new Map((overrides ?? []).map((o) => [o.tool_id, o.granted]));
        const tools = (allTools ?? []).filter((t) => {
          const o = ov.get(t.id);
          if (o === false) return false;
          if (o === true) return true;
          return deptToolIds.has(t.id);
        });
        return json({ user: { name: profile.full_name }, prefs: profile.ui_prefs ?? {}, tools });
      },
      POST: async ({ request }) => {
        const parsed = z
          .object({ token: z.string().regex(/^[a-f0-9]{8,64}$/), prefs: z.record(z.string(), z.unknown()) })
          .safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "bad request" }, 400);
        const { supabaseAdmin, profile } = await loadUser(parsed.data.token);
        if (!profile) return json({ error: "not found" }, 404);
        const merged = { ...(profile.ui_prefs as Record<string, unknown> ?? {}), ...parsed.data.prefs };
        await supabaseAdmin.from("profiles").update({ ui_prefs: merged }).eq("id", profile.id);
        return json({ ok: true, prefs: merged });
      },
    },
  },
});
