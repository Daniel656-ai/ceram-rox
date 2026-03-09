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
  KeyRound,
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
  const { profile, role, customRoleName, permissions, signOut } = useAuth();
  const { state } = useSidebar();
  const { t } = useTranslation(["navigation", "common"]);
  const collapsed = state === "collapsed";

  const hasPerm = (key: string) => permissions.includes(key);
  const isAdmin = hasPerm("admin.system");

  // Build navigation items based on permissions
  const navItems = [
    { title: t("navigation:dashboard"), url: "/dashboard", icon: LayoutDashboard, show: true },
    { title: role === "master" ? t("navigation:all_orders") : role === "durchfuehrer" ? t("navigation:my_orders") : t("navigation:orders"), url: "/auftraege", icon: ClipboardList, show: hasPerm("orders.view") || hasPerm("orders.create") },
    { title: t("navigation:projects"), url: "/projekte", icon: FolderOpen, show: hasPerm("projects.view") || hasPerm("projects.create") },
    { title: t("navigation:samples"), url: "/proben", icon: FlaskConical, show: hasPerm("samples.view") || hasPerm("samples.create") },
    { title: t("navigation:results_database"), url: "/ergebnisse", icon: Database, show: hasPerm("measurements.view") || hasPerm("samples.view") },
    { title: t("navigation:raw_materials"), url: "/rohstoffe", icon: Gem, show: hasPerm("raw_materials.manage") || hasPerm("samples.view") },
    { title: t("navigation:work_planning"), url: "/arbeitsplanung", icon: CalendarDays, show: hasPerm("measurements.enter") },
    { title: t("navigation:calendar"), url: "/kalender", icon: CalendarClock, show: isAdmin || hasPerm("absences.manage_all") || role === "durchfuehrer" || role === "master" },
  ].filter((item) => item.show);

  const adminItems = [
    { title: t("navigation:users"), url: "/admin/benutzer", icon: Users, show: hasPerm("users.manage") },
    { title: t("navigation:roles"), url: "/admin/rollen", icon: KeyRound, show: isAdmin },
    { title: t("navigation:measurement_services"), url: "/admin/messdienstleistungen", icon: Beaker, show: hasPerm("services.manage") },
    { title: t("navigation:workstations"), url: "/admin/arbeitsplaetze", icon: Building2, show: hasPerm("workstations.manage") },
    { title: t("navigation:statistics"), url: "/admin/statistiken", icon: BarChart3, show: isAdmin },
    { title: t("navigation:permissions"), url: "/admin/berechtigungen", icon: ShieldCheck, show: isAdmin },
    { title: t("navigation:sync"), url: "/admin/synchronisation", icon: RefreshCw, show: isAdmin },
  ].filter((item) => item.show);

  const roleLabel = customRoleName || (
    role === "master" ? t("common:role_master") :
    role === "auftraggeber" ? t("common:role_auftraggeber") :
    role === "durchfuehrer" ? t("common:role_durchfuehrer") : ""
  );

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
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
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

        {adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("navigation:administration")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
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
