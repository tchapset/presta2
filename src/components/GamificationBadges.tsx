import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Trophy, Star, Medal, Shield, Award, Zap, Crown, Heart } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

// Badge definitions
const BADGE_DEFINITIONS = [
  { key: "first_mission", label: "Première mission", icon: "🎯", check: (stats: Stats) => stats.totalMissions >= 1, description: "Complétez votre première mission" },
  { key: "5_missions", label: "Habitué", icon: "⭐", check: (stats: Stats) => stats.completedMissions >= 5, description: "5 missions complétées" },
  { key: "10_missions", label: "Fidèle", icon: "🔥", check: (stats: Stats) => stats.completedMissions >= 10, description: "10 missions complétées" },
  { key: "25_missions", label: "Expert", icon: "💎", check: (stats: Stats) => stats.completedMissions >= 25, description: "25 missions complétées" },
  { key: "first_review", label: "Premier avis", icon: "📝", check: (stats: Stats) => stats.reviewsGiven >= 1, description: "Laissez votre premier avis" },
  { key: "5_reviews", label: "Critique", icon: "🗣️", check: (stats: Stats) => stats.reviewsGiven >= 5, description: "5 avis donnés" },
  { key: "10_reviews", label: "Influenceur", icon: "🌟", check: (stats: Stats) => stats.reviewsGiven >= 10, description: "10 avis donnés" },
  { key: "top_rated", label: "Top noté", icon: "👑", check: (stats: Stats) => stats.avgRating >= 4.5 && stats.reviewsReceived >= 3, description: "Note moyenne ≥ 4.5 (min 3 avis)" },
];

// Provider levels
const LEVELS = [
  { name: "Bronze", minMissions: 0, color: "from-amber-700 to-amber-600", icon: Medal, textColor: "text-amber-700" },
  { name: "Argent", minMissions: 5, color: "from-gray-400 to-gray-300", icon: Shield, textColor: "text-gray-500" },
  { name: "Or", minMissions: 15, color: "from-yellow-500 to-amber-400", icon: Crown, textColor: "text-yellow-600" },
  { name: "Platine", minMissions: 30, color: "from-primary to-primary/70", icon: Trophy, textColor: "text-primary" },
];

interface Stats {
  totalMissions: number;
  completedMissions: number;
  reviewsGiven: number;
  reviewsReceived: number;
  avgRating: number;
}

interface GamificationBadgesProps {
  compact?: boolean;
}

const GamificationBadges = ({ compact = false }: GamificationBadgesProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["gamification-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [missions, reviewsGiven, reviewsReceived] = await Promise.all([
        supabase.from("missions").select("id, status").or(`client_id.eq.${user!.id},provider_id.eq.${user!.id}`),
        supabase.from("reviews").select("id").eq("reviewer_id", user!.id),
        supabase.from("reviews").select("id, rating").eq("reviewed_id", user!.id),
      ]);
      const allMissions = missions.data || [];
      const received = reviewsReceived.data || [];
      return {
        totalMissions: allMissions.length,
        completedMissions: allMissions.filter((m) => m.status === "completed").length,
        reviewsGiven: reviewsGiven.data?.length || 0,
        reviewsReceived: received.length,
        avgRating: received.length > 0 ? received.reduce((s, r) => s + r.rating, 0) / received.length : 0,
      } as Stats;
    },
  });

  // Fetch earned badges
  const { data: earnedBadges } = useQuery({
    queryKey: ["user-achievements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_achievements")
        .select("*")
        .eq("user_id", user!.id);
      return data || [];
    },
  });

  // Auto-award new badges
  useEffect(() => {
    if (!stats || !earnedBadges || !user) return;
    const earnedKeys = new Set(earnedBadges.map((b: any) => b.badge_key));
    BADGE_DEFINITIONS.forEach(async (badge) => {
      if (!earnedKeys.has(badge.key) && badge.check(stats)) {
        const { error } = await supabase.from("user_achievements").insert({
          user_id: user.id,
          badge_key: badge.key,
          badge_label: badge.label,
          badge_icon: badge.icon,
        });
        if (!error) {
          toast.success(`🏆 Nouveau badge débloqué : ${badge.icon} ${badge.label}`);
          queryClient.invalidateQueries({ queryKey: ["user-achievements"] });
        }
      }
    });
  }, [stats, earnedBadges, user]);

  if (!stats) return null;

  // Calculate level
  const currentLevel = [...LEVELS].reverse().find((l) => stats.completedMissions >= l.minMissions) || LEVELS[0];
  const nextLevel = LEVELS[LEVELS.indexOf(currentLevel) + 1];
  const progress = nextLevel
    ? Math.min(100, Math.round(((stats.completedMissions - currentLevel.minMissions) / (nextLevel.minMissions - currentLevel.minMissions)) * 100))
    : 100;

  const earnedKeys = new Set((earnedBadges || []).map((b: any) => b.badge_key));

  if (compact) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${currentLevel.color} flex items-center justify-center shadow-md`}>
            <currentLevel.icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-display font-bold text-foreground">Niveau {currentLevel.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {stats.completedMissions} mission{stats.completedMissions > 1 ? "s" : ""} complétée{stats.completedMissions > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {nextLevel && (
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>{currentLevel.name}</span>
              <span>{nextLevel.name}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full bg-gradient-to-r ${currentLevel.color} rounded-full`}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {nextLevel.minMissions - stats.completedMissions} mission{nextLevel.minMissions - stats.completedMissions > 1 ? "s" : ""} pour le niveau {nextLevel.name}
            </p>
          </div>
        )}
        {/* Badge icons row */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {BADGE_DEFINITIONS.map((b) => (
            <span
              key={b.key}
              title={earnedKeys.has(b.key) ? b.label : `${b.label} — ${b.description}`}
              className={`text-lg transition-all ${earnedKeys.has(b.key) ? "" : "opacity-20 grayscale"}`}
            >
              {b.icon}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Level card */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-sm font-display font-bold text-foreground mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-secondary" /> Niveau prestataire
        </h3>
        <div className="flex items-center gap-4 mb-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${currentLevel.color} flex items-center justify-center shadow-lg`}
          >
            <currentLevel.icon className="w-8 h-8 text-white" />
          </motion.div>
          <div>
            <p className="text-xl font-display font-bold text-foreground">{currentLevel.name}</p>
            <p className="text-xs text-muted-foreground">
              {stats.completedMissions} mission{stats.completedMissions > 1 ? "s" : ""} complétée{stats.completedMissions > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {nextLevel && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>{currentLevel.name}</span>
              <span>{progress}%</span>
              <span>{nextLevel.name}</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className={`h-full bg-gradient-to-r ${currentLevel.color} rounded-full`}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Encore {nextLevel.minMissions - stats.completedMissions} mission{nextLevel.minMissions - stats.completedMissions > 1 ? "s" : ""} pour atteindre le niveau <strong>{nextLevel.name}</strong>
            </p>
          </div>
        )}
        {!nextLevel && (
          <p className="text-sm text-primary font-medium">🎉 Vous avez atteint le niveau maximum !</p>
        )}
      </div>

      {/* Badges grid */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-sm font-display font-bold text-foreground mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-secondary" /> Badges ({earnedBadges?.length || 0}/{BADGE_DEFINITIONS.length})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_DEFINITIONS.map((b, i) => {
            const earned = earnedKeys.has(b.key);
            return (
              <motion.div
                key={b.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-xl p-3 text-center transition-all border ${
                  earned
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/30 border-border opacity-50"
                }`}
              >
                <span className="text-2xl block mb-1">{b.icon}</span>
                <p className={`text-xs font-medium ${earned ? "text-foreground" : "text-muted-foreground"}`}>
                  {b.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{b.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GamificationBadges;
