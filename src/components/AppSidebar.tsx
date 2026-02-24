import {
  LayoutDashboard,
  ClipboardList,
  FolderOpen,
  Users,
  Settings,
  LogOut,
  Beaker,
  BarChart3,
  CalendarDays,
  Building2,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const auftraggeberItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Messaufträge", url: "/auftraege", icon: ClipboardList },
  { title: "Projekte", url: "/projekte", icon: FolderOpen },
  { title: "Proben", url: "/proben", icon: FlaskConical },
];

const masterItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Alle Messaufträge", url: "/auftraege", icon: ClipboardList },
  { title: "Projekte", url: "/projekte", icon: FolderOpen },
  { title: "Proben", url: "/proben", icon: FlaskConical },
];

const masterAdminItems = [
  { title: "Benutzer", url: "/admin/benutzer", icon: Users },
  { title: "Messungen", url: "/admin/messdienstleistungen", icon: Beaker },
  { title: "Arbeitsplätze", url: "/admin/arbeitsplaetze", icon: Building2 },
  { title: "Statistiken", url: "/admin/statistiken", icon: BarChart3 },
  { title: "Berechtigungen", url: "/admin/berechtigungen", icon: ShieldCheck },
];

const durchfuehrerItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Arbeitsplanung", url: "/arbeitsplanung", icon: CalendarDays },
  { title: "Meine Aufträge", url: "/auftraege", icon: ClipboardList },
  { title: "Proben", url: "/proben", icon: FlaskConical },
];

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const items =
    role === "master" ? masterItems :
    role === "durchfuehrer" ? durchfuehrerItems :
    auftraggeberItems;

  const roleLabel =
    role === "master" ? "Administrator" :
    role === "auftraggeber" ? "Auftraggeber" :
    role === "durchfuehrer" ? "Messdienstleister" : "";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
          <Beaker className="h-4 w-4 text-accent-foreground" />
        </div>
        {!collapsed && <span className="font-bold text-sidebar-foreground tracking-tight">Ceram ROX</span>}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === "master" && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {masterAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <Separator className="bg-sidebar-border" />
        {!collapsed && (
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile ? `${profile.first_name} ${profile.last_name}` : "Benutzer"}
            </p>
            <p className="text-xs text-sidebar-foreground/60">{roleLabel}</p>
          </div>
        )}
        <div className="px-2 pb-2">
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Abmelden</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
