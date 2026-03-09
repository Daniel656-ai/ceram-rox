import {
  LayoutDashboard,
  ClipboardList,
  FolderOpen,
  Users,
  LogOut,
  Beaker,
  BarChart3,
  CalendarDays,
  CalendarClock,
  Building2,
  FlaskConical,
  ShieldCheck,
  Database,
  Gem,
  RefreshCw,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
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
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();
  const { state } = useSidebar();
  const { t } = useTranslation(["navigation", "common"]);
  const collapsed = state === "collapsed";

  const auftraggeberItems = [
    { title: t("navigation:dashboard"), url: "/dashboard", icon: LayoutDashboard },
    { title: t("navigation:orders"), url: "/auftraege", icon: ClipboardList },
    { title: t("navigation:projects"), url: "/projekte", icon: FolderOpen },
    { title: t("navigation:samples"), url: "/proben", icon: FlaskConical },
    { title: t("navigation:results_database"), url: "/ergebnisse", icon: Database },
    { title: t("navigation:raw_materials"), url: "/rohstoffe", icon: Gem },
  ];

  const masterItems = [
    { title: t("navigation:dashboard"), url: "/dashboard", icon: LayoutDashboard },
    { title: t("navigation:all_orders"), url: "/auftraege", icon: ClipboardList },
    { title: t("navigation:projects"), url: "/projekte", icon: FolderOpen },
    { title: t("navigation:samples"), url: "/proben", icon: FlaskConical },
    { title: t("navigation:results_database"), url: "/ergebnisse", icon: Database },
    { title: t("navigation:raw_materials"), url: "/rohstoffe", icon: Gem },
    { title: t("navigation:calendar"), url: "/kalender", icon: CalendarClock },
  ];

  const masterAdminItems = [
    { title: t("navigation:users"), url: "/admin/benutzer", icon: Users },
    { title: t("navigation:measurement_services"), url: "/admin/messdienstleistungen", icon: Beaker },
    { title: t("navigation:workstations"), url: "/admin/arbeitsplaetze", icon: Building2 },
    { title: t("navigation:statistics"), url: "/admin/statistiken", icon: BarChart3 },
    { title: t("navigation:permissions"), url: "/admin/berechtigungen", icon: ShieldCheck },
    { title: t("navigation:sync"), url: "/admin/synchronisation", icon: RefreshCw },
  ];

  const durchfuehrerItems = [
    { title: t("navigation:dashboard"), url: "/dashboard", icon: LayoutDashboard },
    { title: t("navigation:work_planning"), url: "/arbeitsplanung", icon: CalendarDays },
    { title: t("navigation:my_orders"), url: "/auftraege", icon: ClipboardList },
    { title: t("navigation:samples"), url: "/proben", icon: FlaskConical },
    { title: t("navigation:results_database"), url: "/ergebnisse", icon: Database },
    { title: t("navigation:raw_materials"), url: "/rohstoffe", icon: Gem },
    { title: t("navigation:calendar"), url: "/kalender", icon: CalendarClock },
  ];

  const items =
    role === "master" ? masterItems :
    role === "durchfuehrer" ? durchfuehrerItems :
    auftraggeberItems;

  const roleLabel =
    role === "master" ? t("common:role_master") :
    role === "auftraggeber" ? t("common:role_auftraggeber") :
    role === "durchfuehrer" ? t("common:role_durchfuehrer") : "";

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
          <SidebarGroupLabel>{t("navigation:navigation")}</SidebarGroupLabel>
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
            <SidebarGroupLabel>{t("navigation:administration")}</SidebarGroupLabel>
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
              {profile ? `${profile.first_name} ${profile.last_name}` : t("common:user")}
            </p>
            <p className="text-xs text-sidebar-foreground/60">{roleLabel}</p>
          </div>
        )}
        <div className="px-2">
          <LanguageSwitcher collapsed={collapsed} />
        </div>
        <div className="px-2 pb-2">
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">{t("common:sign_out")}</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
