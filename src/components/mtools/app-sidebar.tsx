import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListTodo,
  Calendar,
  Timer,
  Wrench,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { MToolsLogo } from "./logo";
import { useSuspenseQuery } from "@tanstack/react-query";
import { myDashboardQuery } from "@/lib/queries";
import { DynIcon } from "./icon";

const mainItems = [
  { title: "Главная", url: "/", icon: LayoutDashboard },
  { title: "Мои задачи", url: "/tasks", icon: ListTodo },
  { title: "Календарь", url: "/calendar", icon: Calendar },
  { title: "Учёт времени", url: "/time-tracker", icon: Timer },
  { title: "Инструменты", url: "/tools", icon: Wrench },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: dash } = useSuspenseQuery(myDashboardQuery());
  const isActive = (p: string) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/"));

  const sidebarTools = (dash?.layouts ?? [])
    .filter((l) => l.location === "sidebar")
    .map((l) => dash?.tools.find((t) => t.id === l.tool_id))
    .filter(Boolean);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/70 px-2">
        <Link to="/" className="flex items-center gap-2 rounded-xl px-2 py-3">
          <MToolsLogo className="text-2xl" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Рабочее пространство</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {sidebarTools.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Мои инструменты</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sidebarTools.map((t) => (
                  <SidebarMenuItem key={t!.id}>
                    <SidebarMenuButton asChild tooltip={t!.name}>
                      <Link to="/tools" search={{ tool: t!.slug }} className="flex items-center gap-2">
                        <DynIcon name={t!.icon} className="h-4 w-4" />
                        <span>{t!.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/settings")} tooltip="Настройки">
              <Link to="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Настройки</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}