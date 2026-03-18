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

    // Ne jamais rediriger sur ces pages
    if (
      path === "/choix-role" ||
      path.startsWith("/~oauth") ||
      path === "/reset-password" ||
      path === "/forgot-password" ||
      path.startsWith("/p/")
    ) return;

    // Si cache valide → utiliser le cache sans vérifier le serveur
    const cached = localStorage.getItem(ROLE_CACHE_KEY);
    if (cached === userId) return;

    // Si hors ligne → utiliser le cache si disponible, sinon ne rien faire
    if (!navigator.onLine) {
      console.warn("Offline - using cache for role check");
      if (cached) return; // cache existe mais pas pour ce userId → ne pas rediriger
      return; // pas de cache → ne pas rediriger non plus
    }

    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!roles || roles.length === 0) {
        // Seulement rediriger si on est en ligne ET pas de rôle
        if (navigator.onLine) {
          localStorage.removeItem(ROLE_CACHE_KEY);
          window.location.href = "/choix-role";
        }
      } else {
        // Admin → toujours vers dashboard
        if (roles.some(r => r.role === "admin")) {
          localStorage.setItem(ROLE_CACHE_KEY, userId);
          if (path === "/choix-role") {
            window.location.href = "/dashboard";
          }
          return;
        }
        localStorage.setItem(ROLE_CACHE_KEY, userId);
      }
    } catch {
      // Erreur réseau → ne jamais rediriger, garder le cache
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
