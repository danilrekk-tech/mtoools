import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MToolsLogo } from "@/components/mtools/logo";
import { ArrowRight, CheckCircle2, Send, ShieldCheck, Timer, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Landing,
});

function Landing() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setReady(true);
    });
  }, []);
  if (!ready) return null;
  if (signedIn) {
    // Redirect signed-in users to their workspace
    if (typeof window !== "undefined") window.location.replace("/dashboard");
    return null;
  }
  return (
    <div className="mtools-shell min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <MToolsLogo className="text-3xl" />
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Войти</Link></Button>
          <Button asChild className="gradient-brand text-white"><Link to="/auth">Начать</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" /> Единое рабочее пространство компании
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
            Всё для работы вашей <span className="text-gradient-brand">команды</span> в одном месте
          </h1>
          <p className="mt-5 text-lg text-muted-foreground md:text-xl">
            MTools — рабочее пространство сотрудника с задачами, календарём смен, учётом времени,
            каталогом инструментов и Telegram-ботом для каждого отдела.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gradient-brand text-white">
              <Link to="/auth">Открыть рабочее место <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Users, title: "Отделы и роли", text: "Гибкая админка сотрудников и прав доступа." },
            { icon: Timer, title: "Учёт времени", text: "Таймер работы и графики смен." },
            { icon: Send, title: "Telegram-бот", text: "Разный функционал для каждого отдела." },
            { icon: ShieldCheck, title: "Безопасность", text: "Роли, RLS и авторизация Google/Email." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card/85 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_55px_rgba(0,0,0,0.18)]">
              <f.icon className="h-6 w-6 text-primary" />
              <div className="mt-3 font-semibold">{f.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{f.text}</div>
            </div>
          ))}
        </div>
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © MTools · Все инструменты команды в одном окне
      </footer>
    </div>
  );
}
