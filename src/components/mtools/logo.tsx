import { cn } from "@/lib/utils";

/**
 * Текстовый логотип MTools: буква M — акцентным цветом системы,
 * остальное — цветом текста. Размер задаётся через className (text-*).
 */
export function MToolsLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-baseline font-black leading-none tracking-[-0.04em]",
        className,
      )}
      aria-label="MTools"
    >
      <span className="text-primary">M</span>
      <span className="text-foreground">tools</span>
    </span>
  );
}

/** Компактный знак для свёрнутого бокового меню. */
export function MToolsMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-center justify-center rounded-xl bg-primary/12 font-black leading-none tracking-[-0.04em] text-primary ring-1 ring-primary/25",
        "h-9 w-9 text-xl",
        className,
      )}
      aria-label="MTools"
    >
      M
    </span>
  );
}
