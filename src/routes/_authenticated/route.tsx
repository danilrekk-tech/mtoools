import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/mtools/app-sidebar";
import { TopBar } from "@/components/mtools/topbar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Session is read from local storage (instant); the network call only happens
  // when no cached session exists, so tab-to-tab navigation stays instant.
  beforeLoad: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (user) return { user };
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  return (
    <SidebarProvider>
      <div className="mtools-shell flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="min-w-0 flex-1">
          <TopBar />
          <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-7">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}