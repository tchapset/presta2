import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Radar, X, Search, MapPin, Star, Clock, Briefcase, Users } from "lucide-react";

interface RadarSearchProps {
  open: boolean;
  onClose: () => void;
  userPosition: [number, number] | null;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const isOnline = (lastSeen: string | null): boolean => {
  if (!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
};

const RadarSearch = ({ open, onClose, userPosition }: RadarSearchProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<any>(null);
  const [foundStats, setFoundStats] = useState<{ avg: number; count: number; missionsCompleted: number } | null>(null);
  const [pulseCount, setPulseCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("name");
      return data?.map((c) => c.name) || [];
    },
  });

  useEffect(() => {
    if (searching) {
      intervalRef.current = setInterval(() => {
        setPulseCount((c) => c + 1);
      }, 800);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [searching]);

  const startSearch = async () => {
    if (!user) { toast.error("Connectez-vous d'abord"); return; }
    if (!selectedCategory) { toast.error("Choisissez un service"); return; }
    if (!userPosition) { toast.error("Position non disponible"); return; }

    setSearching(true);
    setFound(null);
    setPulseCount(0);

    // Wait for radar animation effect
    await new Promise((r) => setTimeout(r, 3000));

    // Find nearest online provider with this category
    const { data: providers } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_provider", true)
      .contains("provider_categories", [selectedCategory]);

    if (!providers || providers.length === 0) {
      // No providers found - send notifications to offline providers nearby
      await notifyNearbyProviders();
      setSearching(false);
      toast.info("Aucun prestataire en ligne trouvé. Les prestataires proches ont été notifiés.");
      return;
    }

    // Sort by distance, prioritize online
    const withDist = providers
      .filter((p) => p.user_id !== user.id)
      .map((p) => ({
        ...p,
        distance: p.latitude && p.longitude
          ? haversine(userPosition[0], userPosition[1], p.latitude, p.longitude)
          : 9999,
        online: isOnline(p.last_seen_at),
      }))
      .sort((a, b) => {
        if (a.online && !b.online) return -1;
        if (!a.online && b.online) return 1;
        return a.distance - b.distance;
      });

    const best = withDist[0];
    if (!best) {
      await notifyNearbyProviders();
      setSearching(false);
      toast.info("Aucun prestataire trouvé. Les prestataires proches ont été notifiés.");
      return;
    }

    setFound(best);
    setSearching(false);

    // Fetch review stats and missions count for the found provider
    const [{ data: reviews }, { count: missionsCount }] = await Promise.all([
      supabase.from("reviews").select("rating").eq("reviewed_id", best.user_id),
      supabase.from("missions").select("*", { count: "exact", head: true }).eq("provider_id", best.user_id).eq("status", "completed"),
    ]);
    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length;
      setFoundStats({ avg, count: reviews.length, missionsCompleted: missionsCount || 0 });
    } else {
      setFoundStats({ avg: 0, count: 0, missionsCompleted: missionsCount || 0 });
    }
  };

  const notifyNearbyProviders = async () => {
    if (!userPosition || !user) return;
    const { data: providers } = await supabase
      .from("profiles")
      .select("user_id, latitude, longitude, city")
      .eq("is_provider", true)
      .contains("provider_categories", [selectedCategory]);

    if (!providers) return;

    const nearby = providers
      .filter((p) => p.user_id !== user.id)
      .filter((p) => {
        if (p.latitude && p.longitude) {
          return haversine(userPosition[0], userPosition[1], p.latitude, p.longitude) < 50;
        }
        return true;
      })
      .slice(0, 10);

    for (const p of nearby) {
      await supabase.from("notifications").insert({
        user_id: p.user_id,
        title: "Nouveau besoin client",
        message: `Un client cherche un prestataire pour "${selectedCategory}" près de votre zone.`,
        type: "radar_search",
      });
    }
  };

  const connectToProvider = async () => {
    if (!found || !user) return;
    // Create a mission/conversation
    const { data: mission, error } = await supabase
      .from("missions")
      .insert({
        client_id: user.id,
        provider_id: found.user_id,
        title: `Recherche rapide: ${selectedCategory}`,
        description: `Demande de service via recherche rapide pour "${selectedCategory}"`,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      toast.error("Erreur lors de la connexion");
      return;
    }

    // Send notification to provider
    await supabase.from("notifications").insert({
      user_id: found.user_id,
      title: "Nouvelle demande",
      message: `Un client vous a trouvé via recherche rapide pour "${selectedCategory}"`,
      type: "mission",
      link: `/mission/${mission.id}`,
    });

    onClose();
    navigate(`/mission/${mission.id}`);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-3xl border border-border p-8 max-w-md w-full relative overflow-hidden"
        >
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          <h2 className="text-xl font-display font-bold text-foreground mb-2 text-center">
            ⚡ Recherche Rapide
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Trouvez le prestataire le plus proche de vous
          </p>

          {!searching && !found && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">De quoi avez-vous besoin ?</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">Choisir un service</option>
                  {(categories || []).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {!userPosition && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Activez la géolocalisation pour utiliser cette fonctionnalité
                </p>
              )}
              <Button
                variant="hero"
                className="w-full gap-2"
                disabled={!selectedCategory || !userPosition}
                onClick={startSearch}
              >
                <Radar className="w-4 h-4" /> Lancer la recherche
              </Button>
            </div>
          )}

          {searching && (
            <div className="flex flex-col items-center py-8">
              <div className="relative w-48 h-48">
                {/* Radar circles */}
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border-2 border-primary/30"
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.5,
                      ease: "easeOut",
                    }}
                  />
                ))}
                {/* Radar sweep line */}
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <div
                    className="absolute top-1/2 left-1/2 w-1/2 h-0.5 origin-left"
                    style={{ background: "linear-gradient(to right, hsl(var(--primary)), transparent)" }}
                  />
                </motion.div>
                {/* Center dot */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary shadow-lg shadow-primary/50" />
              </div>
              <p className="text-sm text-muted-foreground mt-4 animate-pulse">
                Recherche en cours...
              </p>
            </div>
          )}

          {found && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="bg-muted/50 rounded-2xl p-4">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold text-lg overflow-hidden shrink-0">
                    {found.avatar_url ? (
                      <img src={found.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      found.full_name?.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground truncate">{found.full_name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedCategory}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      {found.online && (
                        <span className="text-primary font-medium">● En ligne</span>
                      )}
                      {found.distance < 9999 && (
                        <span className="text-muted-foreground">
                          <MapPin className="w-3 h-3 inline" /> {found.distance.toFixed(1)} km
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Provider stats */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Star className="w-3.5 h-3.5 text-gold fill-gold" />
                    <span className="font-semibold text-foreground">
                      {foundStats && foundStats.avg > 0 ? foundStats.avg.toFixed(1) : "—"}
                    </span>
                    <span>({foundStats?.count || 0} avis)</span>
                  </div>
                  {found.avg_response_time_minutes != null && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>~{found.avg_response_time_minutes} min</span>
                    </div>
                  )}
                  {found.years_of_experience != null && found.years_of_experience > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>{found.years_of_experience} ans d'exp.</span>
                    </div>
                  )}
                  {found.city && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{found.city}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span>{foundStats?.missionsCompleted || 0} missions</span>
                  </div>
                </div>
              </div>

              <Button variant="hero" className="w-full gap-2" onClick={connectToProvider}>
                💬 Contacter maintenant
              </Button>
              <Button variant="outline" className="w-full" onClick={() => { setFound(null); setFoundStats(null); setSearching(false); }}>
                Chercher un autre
              </Button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RadarSearch;
