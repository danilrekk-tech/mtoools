import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, Sun, LogOut, User, Bell } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { profileQuery, notificationsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export function TopBar() {
  const { theme, toggle } = useTheme();
  const { data: me } = useSuspenseQuery(profileQuery());
  const { data: notifs = [] } = useQuery(notificationsQuery());
  const navigate = useNavigate();
  const qc = useQueryClient();

  const initials = (me?.profile?.full_name ?? me?.user.email ?? "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const unread = (notifs as any[]).filter((n) => !n.read_at).length;
  const markAllRead = async () => {
    if (!me) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("user_id", me.user.id);
    qc.invalidateQueries({ queryKey: ["me", "notifications"] });
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:px-4">
      <SidebarTrigger />
      <div className="flex-1" />
      <Popover onOpenChange={(o) => o && unread > 0 && markAllRead()}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Уведомления">
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="border-b p-3 text-sm font-semibold">Уведомления</div>
          <div className="max-h-96 overflow-auto">
            {(notifs as any[]).length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Пока нет уведомлений</div>
            )}
            {(notifs as any[]).map((n) => (
              <div key={n.id} className={`border-b p-3 text-sm ${!n.read_at ? "bg-muted/40" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{n.title}</div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{n.channel}</Badge>
                </div>
                {n.body && <div className="mt-1 text-xs text-muted-foreground">{n.body}</div>}
                <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("ru-RU")}</div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Сменить тему">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 pl-2 pr-3">
            <Avatar className="h-7 w-7">
              <AvatarImage src={me?.profile?.avatar_url ?? undefined} />
              <AvatarFallback className="gradient-brand text-xs text-white">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm md:inline">{me?.profile?.full_name ?? me?.user.email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{me?.profile?.full_name ?? "—"}</span>
              <span className="text-xs text-muted-foreground">{me?.user.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate({ to: "/settings" })}>
            <User className="mr-2 h-4 w-4" /> Мой профиль
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={signOut} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" /> Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}