export const DEFAULT_CATEGORIES = [
  "SEO",
  "Продажи",
  "Дизайн",
  "Юридические",
  "Аналитика",
  "Продуктивность",
  "Разработка",
  "Маркетинг",
  "Поддержка",
  "Другое",
];

export const TOOL_TAGS = ["Внешний", "Внутренний", "Платный", "Бесплатный", "Новое", "Популярное", "Beta"];

export const TOOL_STATUSES = [
  { value: "online", label: "Онлайн" },
  { value: "unavailable", label: "Недоступен" },
  { value: "disabled", label: "Отключён" },
] as const;

export function statusMeta(tool: { status?: string | null; is_active?: boolean | null }) {
  if (tool.is_active === false || tool.status === "disabled")
    return { key: "disabled", label: "Отключён", dot: "bg-muted-foreground" };
  if (tool.status === "unavailable") return { key: "unavailable", label: "Недоступен", dot: "bg-destructive" };
  return { key: "online", label: "Онлайн", dot: "bg-emerald-500" };
}
