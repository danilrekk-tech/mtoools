import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Единая «шапка» раздела: градиентная плитка с иконкой, заголовок, подпись и слот действий.
 * Используется на всех внутренних страницах для визуальной согласованности.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card/60 p-4 sm:p-5">
      <div
        aria-hidden
        className="gradient-brand pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full opacity-20 blur-3xl"
      />
      <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-4">
        <span className="gradient-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-lg sm:h-12 sm:w-12">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="mtools-section-title truncate text-xl font-bold sm:text-2xl">{title}</h1>
              {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
          </div>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}
