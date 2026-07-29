export function MToolsLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex select-none items-baseline font-black leading-none tracking-tight ${className}`}
      aria-label="MTools"
    >
      <span className="gradient-brand bg-clip-text text-transparent">M</span>
      <span className="text-foreground">tools</span>
    </span>
  );
}

export function MToolsMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <div className={`${className} relative inline-flex items-center justify-center rounded-lg gradient-brand text-white font-black`}>
      <span className="text-sm leading-none">M</span>
    </div>
  );
}