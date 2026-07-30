import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calculator, PasswordGen, UnitConverter, Notes, Pomodoro } from "@/components/mtools/mini-tools";

export const InlineTools: Record<string, React.FC> = {
  calculator: Calculator,
  "password-gen": PasswordGen,
  "unit-converter": UnitConverter,
  notes: Notes,
  pomodoro: Pomodoro,
};

export type AnyTool = {
  id: string;
  slug: string;
  name: string;
  kind?: string | null;
  url?: string | null;
  description?: string | null;
};

/** External tools open straight in a new tab, internal ones open in a dialog. */
export function launchTool(tool: AnyTool, setActive: (t: AnyTool | null) => void) {
  if (tool.kind === "external" && tool.url) {
    window.open(tool.url, "_blank", "noopener,noreferrer");
    return;
  }
  setActive(tool);
}

export function ToolDialog({ tool, onClose }: { tool: AnyTool | null; onClose: () => void }) {
  const Inline = tool ? InlineTools[tool.slug] : null;
  return (
    <Dialog open={!!tool} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tool?.name}</DialogTitle>
        </DialogHeader>
        {Inline ? (
          <Inline />
        ) : (
          <p className="text-sm text-muted-foreground">
            {tool?.description || "Инструмент подключён, но пока не имеет встроенного интерфейса."}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}