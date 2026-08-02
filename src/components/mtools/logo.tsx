export function MToolsLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex select-none items-baseline font-black leading-none tracking-tight ${className}`}
      aria-label="MTools"
    >
      <span
        className="bg-clip-text text-transparent"
        style={{
          backgroundImage:
            "linear-gradient(135deg, oklch(0.47 0.19 264) 0%, oklch(0.68 0.17 152) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        M
      </span>
      <span className="text-foreground">tools</span>
    </span>
  );
}

export function MToolsMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <div className={`${className} relative inline-flex items-center justify-center rounded-lg gradient-brand font-black text-white`}>
      <span className="text-sm leading-none">M</span>
    </div>
  );
}
