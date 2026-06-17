import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PrintHeader } from "@/components/PrintHeader";
import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b flex items-center px-4 bg-card print:hidden">
            <SidebarTrigger />
          </header>
          <PrintHeader />
          <main className="flex-1 p-6 overflow-auto print:p-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

