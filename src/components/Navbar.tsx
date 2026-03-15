import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, Download, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "./ThemeToggle";
import LanguageToggle from "./LanguageToggle";
import { useLang } from "./LanguageToggle";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t } = useLang();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin-nav", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });

  const { data: unreadMsgCount } = useQuery({
    queryKey: ["unread-msg-total", user?.id],
    enabled: !!user,
    refetchInterval: 10000,
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false)
        .neq("sender_id", user!.id);
      return count || 0;
    },
  });

  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem("privacy-hide-online") === "true") return;
    const update = () => supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("user_id", user.id).then(() => {});
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {})
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstallModal(true);
    }
  };

  const links = [
    { to: "/", label: t("Accueil", "Home") },
    { to: "/recherche", label: t("Trouver un prestataire", "Find a Provider") },
    ...(user ? [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/conversations", label: t("Messages", "Messages"), badge: unreadMsgCount },
      { to: "/reglages", label: t("Réglages", "Settings") },
    ] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
    { to: "/faq", label: t("Centre d'aide", "Help Center") },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src="/serviko-logo.png" alt="TKLINK" className="w-9 h-9 rounded-lg" />
            <span className="text-xl font-display font-bold text-foreground">
              TK<span className="text-gradient-gold">LINK</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link key={link.to} to={link.to}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname === link.to ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                {link.label}
                {('badge' in link) && (link as any).badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {(link as any).badge > 9 ? "9+" : (link as any).badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            {!isInstalled && (
              <Button variant="gold" size="sm" onClick={handleInstallClick} className="gap-1 animate-pulse hover:animate-none">
                <Download className="w-4 h-4" /> {t("Installer l'app", "Install App")}
              </Button>
            )}
            <LanguageToggle />
            <ThemeToggle />
            {user ? (
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-1" /> {t("Déconnexion", "Logout")}
              </Button>
            ) : (
              <>
                <Link to="/auth?mode=login"><Button variant="ghost" size="sm">{t("Connexion", "Login")}</Button></Link>
                <Link to="/auth?mode=signup"><Button variant="hero" size="sm">{t("Inscription gratuite", "Free Signup")}</Button></Link>
              </>
            )}
          </div>

          <div className="md:hidden flex items-center gap-1">
            {user && (
              <Link to="/conversations" className="relative p-2">
                <MessageSquare className="w-5 h-5 text-foreground" />
                {(unreadMsgCount || 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {unreadMsgCount! > 9 ? "9+" : unreadMsgCount}
                  </span>
                )}
              </Link>
            )}
            <ThemeToggle />
            <button onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-border">
            <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
              {links.map((link) => (
                <Link key={link.to} to={link.to} onClick={() => setIsOpen(false)} className="px-4 py-3 rounded-lg text-sm font-medium hover:bg-muted flex items-center justify-between">
                  <span>{link.label}</span>
                  {('badge' in link) && (link as any).badge > 0 && (
                    <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {(link as any).badge > 9 ? "9+" : (link as any).badge}
                    </span>
                  )}
                </Link>
              ))}
              {!isInstalled && (
                <button onClick={() => { handleInstallClick(); setIsOpen(false); }}
                  className="px-4 py-3 rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2 text-primary font-bold">
                  <Download className="w-4 h-4" /> {t("📲 Télécharger l'application", "📲 Download the App")}
                </button>
              )}
              <div className="flex items-center gap-2 px-4 py-2">
                <LanguageToggle />
              </div>
              <div className="flex gap-2 pt-2">
                {user ? (
                  <Button variant="outline" className="flex-1" onClick={handleSignOut}>{t("Déconnexion", "Logout")}</Button>
                ) : (
                  <>
                    <Link to="/auth?mode=login" className="flex-1"><Button variant="outline" className="w-full">{t("Connexion", "Login")}</Button></Link>
                    <Link to="/auth?mode=signup" className="flex-1"><Button variant="hero" className="w-full">{t("Inscription", "Signup")}</Button></Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Install Instructions Modal */}
      <AnimatePresence>
        {showInstallModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setShowInstallModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Download className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  {t("Installer TKLINK", "Install TKLINK")}
                </h3>
                {isIOS ? (
                  <div className="text-left space-y-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{t("Sur iPhone/iPad :", "On iPhone/iPad:")}</p>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                      <span className="text-lg">1️⃣</span>
                      <p>{t("Appuyez sur le bouton Partager", "Tap the Share button")} <span className="inline-block">⬆️</span> {t("en bas de Safari", "at the bottom of Safari")}</p>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                      <span className="text-lg">2️⃣</span>
                      <p>{t("Faites défiler et appuyez sur", "Scroll down and tap")} <strong>{t("\"Sur l'écran d'accueil\"", "\"Add to Home Screen\"")}</strong></p>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                      <span className="text-lg">3️⃣</span>
                      <p>{t("Appuyez sur \"Ajouter\"", "Tap \"Add\"")}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-left space-y-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{t("Sur Android / PC :", "On Android / PC:")}</p>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                      <span className="text-lg">1️⃣</span>
                      <p>{t("Ouvrez le menu du navigateur", "Open the browser menu")} <strong>⋮</strong></p>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                      <span className="text-lg">2️⃣</span>
                      <p>{t("Appuyez sur", "Tap")} <strong>{t("\"Installer l'application\"", "\"Install app\"")}</strong></p>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                      <span className="text-lg">3️⃣</span>
                      <p>{t("Confirmez l'installation", "Confirm installation")}</p>
                    </div>
                  </div>
                )}
                <Button variant="outline" className="w-full" onClick={() => setShowInstallModal(false)}>
                  {t("Compris", "Got it")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
