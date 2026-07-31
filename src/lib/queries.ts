import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const profileQuery = () =>
  queryOptions({
    queryKey: ["me", "profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*, department:departments(*)").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        user,
        profile,
        roles: (roles ?? []).map((r) => r.role as "admin" | "manager" | "employee"),
      };
    },
  });

export const departmentsQuery = () =>
  queryOptions({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

export const toolsQuery = () =>
  queryOptions({
    queryKey: ["tools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tools").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

export const usersQuery = () =>
  queryOptions({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*, department:departments(name,color)").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const rolesByUser = new Map<string, string[]>();
      for (const r of roles ?? []) {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      }
      return (profiles ?? []).map((p) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }));
    },
  });

export const myDashboardQuery = () =>
  queryOptions({
    queryKey: ["me", "dashboard"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return { tools: [], layouts: [] };
      const [{ data: prof }, { data: allTools }, { data: layouts }, { data: overrides }] = await Promise.all([
        supabase.from("profiles").select("department_id").eq("id", uid).maybeSingle(),
        supabase.from("tools").select("*").eq("is_active", true),
        supabase.from("dashboard_layouts").select("*").eq("user_id", uid),
        supabase.from("user_tool_overrides").select("*").eq("user_id", uid),
      ]);
      let deptToolIds = new Set<string>();
      if (prof?.department_id) {
        const { data: dt } = await supabase.from("department_tools").select("tool_id").eq("department_id", prof.department_id);
        deptToolIds = new Set((dt ?? []).map((r) => r.tool_id));
      }
      const overridesMap = new Map<string, boolean>((overrides ?? []).map((o) => [o.tool_id, o.granted]));
      const availableTools = (allTools ?? []).filter((t) => {
        const o = overridesMap.get(t.id);
        if (o === false) return false;
        if (o === true) return true;
        return deptToolIds.has(t.id);
      });
      return { tools: availableTools, layouts: layouts ?? [] };
    },
  });

export const tasksQuery = () =>
  queryOptions({
    queryKey: ["me", "tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const shiftsQuery = () =>
  queryOptions({
    queryKey: ["shifts"],
    queryFn: async () => {
      const [{ data, error }, { data: profiles }] = await Promise.all([
        supabase.from("shifts").select("*").order("starts_at"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      if (error) throw error;
      const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      return (data ?? []).map((s) => ({ ...s, user: { full_name: names.get(s.user_id) ?? null } }));
    },
  });

export const activeTimeEntryQuery = () =>
  queryOptions({
    queryKey: ["me", "time-entry", "active"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data } = await supabase.from("time_entries").select("*").eq("user_id", uid).is("ended_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

export const notificationsQuery = () =>
  queryOptions({
    queryKey: ["me", "notifications"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

export const auditLogQuery = () =>
  queryOptions({
    queryKey: ["admin", "audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });