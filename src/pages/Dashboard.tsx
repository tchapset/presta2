import { Star, Heart, MapPin, Settings, MessageSquare, CheckCircle, Clock, FileText, Wallet , Share2} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import ProviderCard from "@/components/ProviderCard";
import { useLang } from "@/components/LanguageToggle";
import { toast } from "sonner";
import LoadingScreen from "@/components/LoadingScreen";
import DashboardCharts from "@/components/DashboardCharts";
import MissionsCalendar from "@/components/MissionsCalendar";
import GamificationBadges from "@/components/GamificationBadges";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DashboardPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: userRole } = useUserRole();
  const { t } = useLang();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: favorites } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("*").eq("user_id", user!.id);
      return data || [];
    },
  });

  const { data: favProfiles } = useQuery({
    queryKey: ["fav-profiles", favorites?.map(f => f.provider_id)],
    enabled: !!favorites && favorites.length > 0,
    queryFn: async () => {
      const ids = favorites!.map(f => f.provider_id);
      const { data } = await supabase.from("profiles").select("*").in("user_id", ids);
      return data || [];
    },
  });

  const { data: reviewsGiven } = useQuery({
    queryKey: ["reviews-given", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("id").eq("reviewer_id", user!.id);
      return data?.length || 0;
    },
  });

  const { data: reviewsReceived } = useQuery({
    queryKey: ["reviews-received", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("id, rating").eq("reviewed_id", user!.id);
      return data || [];
    },
  });

  const { data: allMissions } = useQuery({
    queryKey: ["all-user-missions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("missions")
        .select("*")
        .or(`client_id.eq.${user!.id},provider_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });


  if (authLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  const isProvider = userRole === "provider" || userRole === "both";
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || t("Utilisateur", "User");
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
  const avgRating = reviewsReceived && reviewsReceived.length > 0
    ? (reviewsReceived.reduce((s, r) => s + r.rating, 0) / reviewsReceived.length).toFixed(1)
    : "0.0";
  const isOnline = profile?.availability === "available";
  
  // Mission counts
  const totalMissions = allMissions?.length || 0;
  const inProgressMissions = allMissions?.filter(m => ["pending", "accepted", "in_progress"].includes(m.status || "")).length || 0;
  const completedMissions = allMissions?.filter(m => m.status === "completed").length || 0;

  const toggleAvailability = async () => {
    if (!user) return;
    const newStatus = isOnline ? "unavailable" : "available";
    await supabase.from("profiles").update({ availability: newStatus }).eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success(newStatus === "available" ? t("Vous êtes en ligne", "You are online") : t("Vous êtes hors ligne", "You are offline"));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">{t("Tableau de bord", "Dashboard")}</h1>
              <p className="text-muted-foreground">{t("Bienvenue", "Welcome")}, {displayName} 👋</p>
              {memberSince && <p className="text-xs text-muted-foreground">{t("Membre depuis le", "Member since")} {memberSince}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium">
                {isProvider ? `🔧 ${t("Prestataire", "Provider")}` : `👤 Client`}
              </span>
              <Link to="/conversations">
                <Button variant="outline" size="icon" title={t("Messages", "Messages")}>
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/reglages">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Settings className="w-4 h-4" /> {t("Paramètres", "Settings")}
                </Button>
              </Link>
              {isProvider && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const slug = (profile?.full_name || displayName).toLowerCase().trim()
                      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    const shareUrl = `https://presta237.com/p/${slug}`;
                    if (navigator.share) {
                      navigator.share({ title: `Mon profil sur PRESTA237`, text: `Découvrez mon profil sur PRESTA237`, url: shareUrl }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                      toast.success("Lien copié : " + shareUrl);
                    }
                  }}
                >
                  <Share2 className="w-4 h-4" /> {t("Partager mon profil", "Share my profile")}
                </Button>
              )}
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {isProvider ? (
              <>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border p-6">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center mb-3"><Star className="w-5 h-5 text-gold" /></div>
                  <p className="text-sm text-muted-foreground">{t("Note moyenne", "Average rating")}</p>
                  <p className="text-2xl font-display font-bold text-foreground">{avgRating} ⭐</p>
                  <p className="text-xs text-muted-foreground">{reviewsReceived?.length || 0} {t("avis reçus", "reviews received")}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl border border-border p-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3"><MapPin className="w-5 h-5 text-primary" /></div>
                  <p className="text-sm text-muted-foreground">{t("Visibilité", "Visibility")}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className={`text-2xl font-display font-bold ${isOnline ? "text-primary" : "text-muted-foreground"}`}>
                      {isOnline ? t("En ligne", "Online") : t("Hors ligne", "Offline")}
                    </p>
                    <button
                      onClick={toggleAvailability}
                      className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isOnline ? "bg-primary" : "bg-muted"}`}
                    >
                      <motion.span
                        layout
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={`block h-6 w-6 rounded-full shadow-lg ${isOnline ? "bg-primary-foreground" : "bg-muted-foreground/60"}`}
                        style={{ marginLeft: isOnline ? "1.75rem" : "0.25rem" }}
                      />
                    </button>
                  </div>
                </motion.div>
              </>
            ) : (
              <>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border p-6">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-3"><Heart className="w-5 h-5 text-accent" /></div>
                  <p className="text-sm text-muted-foreground">{t("Prestataires favoris", "Favorite providers")}</p>
                  <p className="text-2xl font-display font-bold text-foreground">{favorites?.length || 0}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl border border-border p-6">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center mb-3"><Star className="w-5 h-5 text-gold" /></div>
                  <p className="text-sm text-muted-foreground">{t("Avis donnés", "Reviews given")}</p>
                  <p className="text-2xl font-display font-bold text-foreground">{reviewsGiven || 0}</p>
                </motion.div>
              </>
            )}
            {/* Mission counts */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-2xl border border-border p-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3"><FileText className="w-5 h-5 text-primary" /></div>
              <p className="text-sm text-muted-foreground">{t("Missions", "Missions")}</p>
              <p className="text-2xl font-display font-bold text-foreground">{totalMissions}</p>
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {inProgressMissions} {t("en cours", "active")}</span>
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> {completedMissions} {t("terminées", "done")}</span>
              </div>
            </motion.div>
            {/* Wallet / Spending link */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-2xl border border-border p-6">
              <Link to={isProvider ? "/portefeuille" : "/depenses"} className="block">
                <div className="w-10 h-10 rounded-xl bg-emerald-light flex items-center justify-center mb-3"><Wallet className="w-5 h-5 text-primary" /></div>
                <p className="text-sm text-muted-foreground">{isProvider ? t("Mon portefeuille", "My Wallet") : t("Mes dépenses", "My Spending")}</p>
                <p className="text-lg font-display font-bold text-primary">{isProvider ? t("Gérer mes revenus →", "Manage revenue →") : t("Voir mes paiements →", "View payments →")}</p>
              </Link>
            </motion.div>
          </div>

          {/* Tabs: Statistiques / Calendrier / Badges */}
          <Tabs defaultValue="stats" className="mb-8">
            <TabsList className="mb-4">
              <TabsTrigger value="stats">{t("Statistiques", "Statistics")}</TabsTrigger>
              <TabsTrigger value="calendar">{t("Calendrier", "Calendar")}</TabsTrigger>
              <TabsTrigger value="badges">{t("Badges & Niveaux", "Badges & Levels")}</TabsTrigger>
            </TabsList>

            <TabsContent value="stats">
              {allMissions && allMissions.length > 0 ? (
                <DashboardCharts missions={allMissions} isProvider={isProvider} />
              ) : (
                <div className="bg-card rounded-2xl border border-border p-8 text-center">
                  <p className="text-muted-foreground text-sm">{t("Aucune mission pour le moment. Les statistiques apparaîtront ici.", "No missions yet. Statistics will appear here.")}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="calendar">
              <MissionsCalendar missions={allMissions || []} />
            </TabsContent>

            <TabsContent value="badges">
              <GamificationBadges />
            </TabsContent>
          </Tabs>

          {/* Gamification compact + Favorites */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Compact badge widget */}
            <div className="lg:col-span-1">
              <GamificationBadges compact />
            </div>

            {/* Favorites */}
            <div className="lg:col-span-2">
              {favorites && favorites.length > 0 && (
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h2 className="text-lg font-display font-bold text-foreground mb-6 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-accent" />{t("Prestataires favoris", "Favorite providers")}
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {favProfiles?.map((p, i) => (
                      <ProviderCard key={p.id} provider={p} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
      <BackToTop />
    </div>
  );
};

export default DashboardPage;