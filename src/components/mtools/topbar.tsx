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
import { Moon, Sun, LogOut, User } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { profileQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export function TopBar() {
  const { theme, toggle } = useTheme();
  const { data: me } = useSuspenseQuery(profileQuery());
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

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:px-4">
      <SidebarTrigger />
      <div className="flex-1" />
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