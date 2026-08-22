/** Turns raw audit rows into human sentences: "Данил добавил инструмент X в отдел Y". */
export type AuditCtx = {
  userName: (id?: string | null) => string;
  toolName: (id?: string | null) => string;
  deptName: (id?: string | null) => string;
};

const roleRu: Record<string, string> = { admin: "администратор", manager: "руководитель", employee: "сотрудник" };

export const ENTITY_LABELS: Record<string, string> = {
  user_roles: "Роли",
  profiles: "Сотрудники",
  department_tools: "Доступы отделов",
  user_tool_overrides: "Персональные доступы",
  tools: "Инструменты",
  shifts: "Смены",
  departments: "Отделы",
};

export function describeAudit(log: any, ctx: AuditCtx): string {
  const actor = ctx.userName(log.actor_id) || "Система";
  const d = (log.changes?.new ?? log.changes?.old ?? log.changes ?? {}) as any;
  const t = () => `«${ctx.toolName(d.tool_id ?? log.entity_id)}»`;
  const dep = () => `«${ctx.deptName(d.department_id ?? log.entity_id)}»`;
  const usr = () => ctx.userName(d.user_id ?? log.entity_id) || "сотруднику";

  switch (`${log.action} ${log.entity_type}`) {
    case "INSERT department_tools":
      return `${actor} добавил инструмент ${t()} в отдел ${dep()}`;
    case "DELETE department_tools":
      return `${actor} убрал инструмент ${t()} из отдела ${dep()}`;
    case "INSERT user_tool_overrides":
      return `${actor} настроил персональный доступ к ${t()} для ${usr()}`;
    case "DELETE user_tool_overrides":
      return `${actor} снял персональный доступ к ${t()} у ${usr()}`;
    case "INSERT tools":
      return `${actor} создал инструмент «${d.name ?? ctx.toolName(log.entity_id)}»`;
    case "UPDATE tools":
      return `${actor} изменил инструмент «${d.name ?? ctx.toolName(log.entity_id)}»`;
    case "DELETE tools":
      return `${actor} удалил инструмент «${d.name ?? ctx.toolName(log.entity_id)}»`;
    case "INSERT user_roles":
      return `${actor} назначил роль «${roleRu[d.role] ?? d.role ?? "—"}» пользователю ${usr()}`;
    case "DELETE user_roles":
      return `${actor} снял роль «${roleRu[d.role] ?? d.role ?? "—"}» с пользователя ${usr()}`;
    case "INSERT departments":
      return `${actor} создал отдел «${d.name ?? ctx.deptName(log.entity_id)}»`;
    case "UPDATE departments":
      return `${actor} изменил отдел «${d.name ?? ctx.deptName(log.entity_id)}»`;
    case "DELETE departments":
      return `${actor} удалил отдел «${d.name ?? ctx.deptName(log.entity_id)}»`;
    case "INSERT shifts":
      return `${actor} назначил смену «${d.title ?? "Смена"}» сотруднику ${usr()}`;
    case "UPDATE shifts":
      return `${actor} изменил смену «${d.title ?? "Смена"}» сотрудника ${usr()}`;
    case "DELETE shifts":
      return `${actor} удалил смену сотрудника ${usr()}`;
    case "UPDATE profiles":
      return `${actor} изменил профиль сотрудника ${ctx.userName(log.entity_id) || "—"}`;
    case "INSERT profiles":
      return `Создан профиль сотрудника ${ctx.userName(log.entity_id) || d.email || "—"}`;
    default:
      return `${actor} — ${log.action.toLowerCase()} в разделе «${ENTITY_LABELS[log.entity_type] ?? log.entity_type}»`;
  }
}
