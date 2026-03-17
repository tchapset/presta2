import { Home, Search, MessageSquare, LayoutDashboard, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";

const MobileBottomNav = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: unreadCount } = useQuery({
    queryKey: ["total-unread", user?.id],
    enabled: !!user,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data: missions } = await supabase
        .from("missions")
        .select("id")
        .or(`client_id.eq.${user!.id},provider_id.eq.${user!.id}`);
      if (!missions || missions.length === 0) return 0;
      const ids = missions.map((m) => m.id);
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("mission_id", ids)
        .eq("is_read", false)
        .neq("sender_id", user!.id);
      return count || 0;
    },
  });

  // Ne pas afficher si pas connecté
  if (!user) return null;
  if (!isMobile) return null;

  // Cacher sur certaines pages
  const hiddenPaths = ["/auth", "/choix-role", "/forgot-password", "/reset-password"];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null;
  if (location.pathname.startsWith("/messages/")) return null;

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom"
      style={{
        background: "hsl(var(--card))",
        borderTop: "1px solid hsl(var(--border))",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="flex items-center justify-around px-2" style={{ height: "64px" }}>

        {/* Accueil */}
        <button
          onClick={() => navigate("/")}
          className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full"
        >
          {isActive("/") && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-primary"
            />
          )}
          <Home
            className={`w-6 h-6 transition-all duration-200 ${
              isActive("/") ? "text-primary scale-110" : "text-muted-foreground"
            }`}
          />
          <span className={`text-[10px] font-semibold transition-colors ${
            isActive("/") ? "text-primary" : "text-muted-foreground"
          }`}>
            Accueil
          </span>
        </button>

        {/* Messages */}
        <button
          onClick={() => navigate("/conversations")}
          className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full"
        >
          {isActive("/conversations") && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-primary"
            />
          )}
          <div className="relative">
            <MessageSquare
              className={`w-6 h-6 transition-all duration-200 ${
                isActive("/conversations") ? "text-primary scale-110" : "text-muted-foreground"
              }`}
            />
            <AnimatePresence>
              {(unreadCount || 0) > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-2 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1"
                >
                  {(unreadCount || 0) > 99 ? "99+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <span className={`text-[10px] font-semibold transition-colors ${
            isActive("/conversations") ? "text-primary" : "text-muted-foreground"
          }`}>
            Messages
          </span>
        </button>

        {/* Recherche — bouton central vert surélevé */}
        <button
          onClick={() => navigate("/recherche")}
          className="relative flex flex-col items-center justify-center -mt-5"
          style={{ flex: "0 0 auto" }}
        >
          <motion.div
            whileTap={{ scale: 0.92 }}
            className="flex flex-col items-center justify-center rounded-2xl shadow-lg"
            style={{
              width: "60px",
              height: "60px",
              background: "linear-gradient(135deg, hsl(145, 60%, 28%), hsl(145, 55%, 40%))",
              boxShadow: "0 4px 20px hsla(145, 60%, 28%, 0.5)",
            }}
          >
            <Search className="w-7 h-7 text-white" />
          </motion.div>
          <span className="text-[10px] font-bold text-primary mt-1">Recherche</span>
        </button>

        {/* Tableau de bord */}
        <button
          onClick={() => navigate("/dashboard")}
          className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full"
        >
          {isActive("/dashboard") && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-primary"
            />
          )}
          <LayoutDashboard
            className={`w-6 h-6 transition-all duration-200 ${
              isActive("/dashboard") ? "text-primary scale-110" : "text-muted-foreground"
            }`}
          />
          <span className={`text-[10px] font-semibold transition-colors ${
            isActive("/dashboard") ? "text-primary" : "text-muted-foreground"
          }`}>
            Tableau
          </span>
        </button>

        {/* Profil */}
        <button
          onClick={() => navigate("/profil/modifier")}
          className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full"
        >
          {isActive("/profil") && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-primary"
            />
          )}
          <User
            className={`w-6 h-6 transition-all duration-200 ${
              isActive("/profil") ? "text-primary scale-110" : "text-muted-foreground"
            }`}
          />
          <span className={`text-[10px] font-semibold transition-colors ${
            isActive("/profil") ? "text-primary" : "text-muted-foreground"
          }`}>
            Profil
          </span>
        </button>

      </div>
    </nav>
  );
};

export default MobileBottomNav;
