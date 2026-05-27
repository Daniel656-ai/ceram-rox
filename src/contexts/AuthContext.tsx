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
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  customRoleId: string | null;
  customRoleName: string | null;
  permissions: string[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  role: null,
  customRoleId: null,
  customRoleName: null,
  permissions: [],
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [customRoleId, setCustomRoleId] = useState<string | null>(null);
  const [customRoleName, setCustomRoleName] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const { profile, role, customRoleId, customRoleName, permissions } =
      await api.users.loadAuthContext(userId);
    if (profile) setProfile(profile);
    if (role) setRole(role as AppRole);
    setCustomRoleId(customRoleId);
    setCustomRoleName(customRoleName);
    setPermissions(permissions);
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
          setCustomRoleId(null);
          setCustomRoleName(null);
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
    setCustomRoleId(null);
    setCustomRoleName(null);
    setPermissions([]);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, role, customRoleId, customRoleName, permissions, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
