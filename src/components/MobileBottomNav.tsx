import { Home, Search, MessageSquare, LayoutDashboard, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion } from "framer-motion";

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
      // Get all missions for user
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

  if (!isMobile) return null;

  // Hide on certain pages like messages detail
  const hiddenPaths = ["/auth", "/choix-role", "/forgot-password", "/reset-password"];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null;
  if (location.pathname.startsWith("/messages/")) return null;

  const tabs = [
    { icon: Home, label: "Accueil", path: "/" },
    { icon: Search, label: "Recherche", path: "/recherche" },
    { icon: MessageSquare, label: "Messages", path: "/conversations", badge: unreadCount },
    { icon: LayoutDashboard, label: "Tableau", path: "/dashboard" },
    { icon: User, label: "Profil", path: "/profil/modifier" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map((tab) => {
          const isActive =
            tab.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(user ? tab.path : tab.path === "/" || tab.path === "/recherche" ? tab.path : "/auth")}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
            >
              <div className="relative">
                <tab.icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                {tab.badge && tab.badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1"
                  >
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </motion.span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
