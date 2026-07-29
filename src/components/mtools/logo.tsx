import logoAsset from "@/assets/mtools-logo.png.asset.json";

export function MToolsLogo({ className = "h-8" }: { className?: string }) {
  return <img src={logoAsset.url} alt="MTools" className={`${className} w-auto object-contain`} />;
}

export function MToolsMark({ className = "h-8 w-8" }: { className?: string }) {
  // Compact geometric mark inspired by logo: blue hex + green M
  return (
    <div className={`${className} relative inline-flex items-center justify-center rounded-lg gradient-brand text-white font-black`}>
      <span className="text-sm leading-none">M</span>
    </div>
  );
}