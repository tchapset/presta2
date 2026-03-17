import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const ROLE_CACHE_KEY = "presta237-role-checked";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const checkRoleAndRedirect = async (userId: string, event: string) => {
    const path = window.location.pathname;
    // Never redirect if already on these pages or on a provider public profile page
    if (
      path === "/choix-role" ||
      path.startsWith("/~oauth") ||
      path === "/reset-password" ||
      path === "/forgot-password" ||
      path.startsWith("/p/")
    ) return;

    // For any event other than SIGNED_IN, if we already verified this user has a role, skip
    if (event !== "SIGNED_IN") {
      const cached = localStorage.getItem(ROLE_CACHE_KEY);
      if (cached === userId) return;
    }

    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!roles || roles.length === 0) {
        localStorage.removeItem(ROLE_CACHE_KEY);
        window.location.href = "/choix-role";
      } else {
        // Cache that this user has a role
        localStorage.setItem(ROLE_CACHE_KEY, userId);
      }
    } catch {
      // Network error - don't redirect, user might be offline
      console.warn("Could not check role - possibly offline");
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user && _event === "SIGNED_IN") {
          checkRoleAndRedirect(session.user.id, _event);
        }
        // TOKEN_REFRESHED and INITIAL will use cache — no redirect if cached

        if (_event === "SIGNED_OUT") {
          localStorage.removeItem(ROLE_CACHE_KEY);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        checkRoleAndRedirect(session.user.id, "INITIAL");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    localStorage.removeItem(ROLE_CACHE_KEY);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
