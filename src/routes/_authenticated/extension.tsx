import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, Chrome, PanelRight, RefreshCw, Copy, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { profileQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/extension")({
  head: () => ({
    meta: [
      { title: "Расширение Chrome · MTools" },
      { name: "description", content: "Закреплённая панель инструментов MTools в браузере: калькулятор, пароли, конвертер, заметки, помодоро." },
      { property: "og:title", content: "Расширение Chrome · MTools" },
      { property: "og:description", content: "Панель инструментов MTools прямо в браузере." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExtensionPage,
});

const steps = [
  "Скачайте архив и распакуйте его в удобную папку.",
  "Откройте chrome://extensions в Chrome, Edge, Brave или Arc.",
  "Включите «Режим разработчика» в правом верхнем углу.",
  "Нажмите «Загрузить распакованное расширение» и выберите распакованную папку.",
  "Закрепите MTools на панели браузера — иконка откроет панель инструментов.",
];

function ExtensionPage() {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(profileQuery());
  const token = (me?.profile as { extension_token?: string } | null)?.extension_token ?? "";
  const [revealed, setReveal] = useState(false);
  const masked = token ? `${token.slice(0, 4)}${"•".repeat(Math.max(token.length - 8, 8))}${token.slice(-4)}` : "";

  const resetToken = async () => {
    if (!confirm("Сбросить ключ? Все устройства придётся подключить заново.")) return;
    const next = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("profiles").update({ extension_token: next }).eq("id", me!.user.id);
    if (error) return toast.error(error.message);
    toast.success("Ключ обновлён");
    setReveal(true);
    qc.invalidateQueries({ queryKey: ["me", "profile"] });
  };

  const download = () => {
    fetch("/mtools-extension.zip")
      .then((r) => {
        if (!r.ok) throw new Error(`Не удалось скачать (${r.status})`);
        return r.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "mtools-extension.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((e) => toast.error(e.message));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Расширение для Chrome</h1>
        <p className="text-sm text-muted-foreground">
          Панель инструментов MTools всегда под рукой — без перехода в сервис.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gradient-brand text-white">v1.3.0</Badge>
              <Badge variant="outline">Manifest V3</Badge>
              <Badge variant="outline">Chrome · Edge · Brave · Arc</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Калькулятор, пароли, конвертер, заметки, помодоро, текст, цвет, даты — плюс ваши внутренние
              инструменты и внешние сервисы с иконками и синхронизацией через аккаунт.
            </p>
          </div>
          <Button onClick={download} className="gradient-brand text-white">
            <Download className="mr-2 h-4 w-4" /> Скачать расширение
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4" /> Синхронизация между устройствами
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Вставьте ключ во вкладку «Сервисы» расширения — панель подтянет ваши инструменты, ссылки,
            заметки и выбранный режим на любом устройстве.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={token} className="font-mono text-xs" />
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(token);
                toast.success("Ключ скопирован");
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Копировать
            </Button>
          </div>
          <p className="text-xs">Не передавайте ключ третьим лицам — он открывает доступ к вашему списку инструментов.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Chrome className="h-4 w-4" /> Установка
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {steps.map((s, i) => (
                <li key={i} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{s}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PanelRight className="h-4 w-4" /> Закрепить сбоку
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Расширение поддерживает боковую панель Chrome: кликните правой кнопкой по иконке MTools →
              «Открыть боковую панель». Панель останется закреплённой при переходе между вкладками.
            </p>
            <p>Заметки сохраняются локально в браузере и доступны офлайн.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
