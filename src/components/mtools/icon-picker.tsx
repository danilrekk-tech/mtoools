import { useMemo, useState } from "react";
import { ICON_GROUPS, EMOJI_PACK } from "@/lib/icon-pack";
import { DynIcon, faviconUrl } from "@/components/mtools/icon";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  const [tab, setTab] = useState<"line" | "emoji">(icon?.startsWith("emoji:") ? "emoji" : "line");
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const src =
      tab === "emoji" ? [{ group: "Цветные", items: EMOJI_PACK }] : ICON_GROUPS;
    const query = q.trim().toLowerCase();
    if (!query) return src;
    return src
      .map((g) => ({
        group: g.group,
        items: g.items.filter(
          (i) => i.label.toLowerCase().includes(query) || i.name.toLowerCase().includes(query),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [tab, q]);

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

      <div className="flex gap-2">
        <div className="flex rounded-lg border p-0.5">
          {(
            [
              ["line", "Контурные"],
              ["emoji", "Цветные"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-md px-2.5 py-1 text-xs transition ${
                tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск иконки…"
          className="h-8 flex-1 text-xs"
        />
      </div>

      <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border p-2">
        {groups.map((g) => (
          <div key={g.group} className="space-y-1.5">
            <div className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {g.group}
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {g.items.map((i) => {
                const sel = !active && icon === i.name;
                return (
                  <button
                    key={i.name}
                    type="button"
                    title={i.label}
                    onClick={() => onChange({ icon: i.name, icon_mode: "icon" })}
                    className={`flex aspect-square items-center justify-center rounded-md border text-base transition ${
                      sel ? "border-primary bg-primary/10 text-primary" : "border-transparent hover:bg-accent"
                    }`}
                    style={sel && color && !i.name.startsWith("emoji:") ? { color } : undefined}
                  >
                    <DynIcon name={i.name} className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">Ничего не найдено</p>
        )}
      </div>
    </div>
  );
}
