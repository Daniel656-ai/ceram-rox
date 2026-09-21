import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import type { Database } from "@/integrations/supabase/types";


type AppRole = Database["public"]["Enums"]["app_role"];

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  must_change_password?: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Primäre Basisrolle (größter Funktionsumfang) – Verhalten wie bisher. */
  role: AppRole | null;
  /** Alle zugewiesenen Basisrollen. */
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  customRoleId: string | null;
  customRoleName: string | null;
  customRoleIds: string[];
  customRoleNames: string[];
  permissions: string[];
  mustChangePassword: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  role: null,
  roles: [],
  hasRole: () => false,
  customRoleId: null,
  customRoleName: null,
  customRoleIds: [],
  customRoleNames: [],
  permissions: [],
  mustChangePassword: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [customRoleId, setCustomRoleId] = useState<string | null>(null);
  const [customRoleName, setCustomRoleName] = useState<string | null>(null);
  const [customRoleIds, setCustomRoleIds] = useState<string[]>([]);
  const [customRoleNames, setCustomRoleNames] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const ctx = await api.users.loadAuthContext(userId);
    if (ctx.profile) setProfile(ctx.profile as Profile);
    if (ctx.role) setRole(ctx.role as AppRole);
    setRoles((ctx.roles ?? []) as AppRole[]);
    setCustomRoleId(ctx.customRoleId);
    setCustomRoleName(ctx.customRoleName);
    setCustomRoleIds(ctx.customRoleIds ?? []);
    setCustomRoleNames(ctx.customRoleNames ?? []);
    setPermissions(ctx.permissions);
  };

  const refreshProfile = async () => {
    if (user) await fetchUserData(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = api.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setProfile(null);
          setRole(null);
          setRoles([]);
          setCustomRoleId(null);
          setCustomRoleName(null);
          setCustomRoleIds([]);
          setCustomRoleNames([]);
          setPermissions([]);
        }
        setLoading(false);
      }
    );

    api.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await api.auth.signOut();
    setProfile(null);
    setRole(null);
    setRoles([]);
    setCustomRoleId(null);
    setCustomRoleName(null);
    setCustomRoleIds([]);
    setCustomRoleNames([]);
    setPermissions([]);
  };

  const mustChangePassword = !!profile?.must_change_password;
  const effectiveRoles = roles.length > 0 ? roles : role ? [role] : [];
  const hasRole = (r: AppRole) => effectiveRoles.includes(r);

  return (
    <AuthContext.Provider value={{ session, user, profile, role, roles: effectiveRoles, hasRole, customRoleId, customRoleName, customRoleIds, customRoleNames, permissions, mustChangePassword, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
