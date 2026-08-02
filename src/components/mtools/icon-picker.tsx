import { ICON_PACK } from "@/lib/icon-pack";
import { DynIcon, faviconUrl } from "@/components/mtools/icon";
import { Label } from "@/components/ui/label";
import { Globe } from "lucide-react";

export function IconPicker({
  icon,
  iconMode,
  color,
  url,
  onChange,
}: {
  icon?: string | null;
  iconMode?: string | null;
  color?: string | null;
  url?: string | null;
  onChange: (patch: { icon?: string; icon_mode?: string }) => void;
}) {
  const fav = faviconUrl(url);
  const active = iconMode === "favicon";
  return (
    <div className="space-y-2">
      <Label>Иконка</Label>
      {url && (
        <button
          type="button"
          onClick={() => onChange({ icon_mode: active ? "icon" : "favicon" })}
          className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm transition ${
            active ? "border-primary bg-primary/10" : "hover:bg-accent"
          }`}
        >
          {fav ? <img src={fav} alt="" className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
          <span>Использовать фавикон сайта</span>
        </button>
      )}
      <div className="grid max-h-52 grid-cols-8 gap-1.5 overflow-y-auto rounded-lg border p-2">
        {ICON_PACK.map((i) => {
          const sel = !active && icon === i.name;
          return (
            <button
              key={i.name}
              type="button"
              title={i.label}
              onClick={() => onChange({ icon: i.name, icon_mode: "icon" })}
              className={`flex aspect-square items-center justify-center rounded-md border transition ${
                sel ? "border-primary bg-primary/10 text-primary" : "border-transparent hover:bg-accent"
              }`}
              style={sel && color ? { color } : undefined}
            >
              <DynIcon name={i.name} className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
