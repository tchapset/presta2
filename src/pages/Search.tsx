import { Star, MapPin, ArrowUpDown, Map, List, Wifi, SlidersHorizontal, Clock, Users, Car, Search, Radar } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProviderCard from "@/components/ProviderCard";
import BackToTop from "@/components/BackToTop";
import RadarSearch from "@/components/RadarSearch";
import { useLang } from "@/components/LanguageToggle";
import { quartersByCity } from "@/data/quarters";

const ProviderMap = lazy(() => import("@/components/ProviderMap"));

const cities = ["Toutes", "Douala", "Yaoundé", "Garoua", "Bafoussam", "Bamenda", "Maroua", "Bertoua", "Kribi", "Limbé", "Buéa"];

const cityCoords: Record<string, [number, number]> = {
  Douala: [4.0511, 9.7679], Yaoundé: [3.848, 11.5021], Garoua: [9.3014, 13.3975],
  Bafoussam: [5.4764, 10.4175], Bamenda: [5.9597, 10.1597], Maroua: [10.5953, 14.3157],
  Bertoua: [4.5772, 13.684], Kribi: [2.9391, 9.9103], Limbé: [4.0186, 9.2043], Buéa: [4.1597, 9.2295],
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type SortOption = "rating" | "experience" | "name" | "distance";

const SearchPage = () => {
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get("category") || "Toutes";
  const cityFromUrl = searchParams.get("city") || "Toutes";

  const [selectedCity, setSelectedCity] = useState(cityFromUrl);
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl);
  const [sortBy, setSortBy] = useState<SortOption>("distance");
  const [showMap, setShowMap] = useState(true);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [canTravelOnly, setCanTravelOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [quarterFilter, setQuarterFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [maxDistance, setMaxDistance] = useState(0); // 0 = no limit
  const [radarOpen, setRadarOpen] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPosition([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    if (selectedCity !== "Toutes" && cityCoords[selectedCity]) {
      setMapCenter(cityCoords[selectedCity]);
    } else if (userPosition) {
      setMapCenter(userPosition);
    } else {
      setMapCenter(null);
    }
  }, [selectedCity, userPosition]);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("name");
      if (error) throw error;
      return data?.map(c => c.name) || [];
    },
  });

  const { data: providers, isLoading } = useQuery({
    queryKey: ["providers", selectedCity, selectedCategory],
    queryFn: async () => {
      let query = supabase.from("profiles").select("*").eq("is_provider", true);
      if (selectedCity !== "Toutes") query = query.eq("city", selectedCity);
      if (selectedCategory !== "Toutes") query = query.contains("provider_categories", [selectedCategory]);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: reviewData } = useQuery({
    queryKey: ["review-data-all"],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("reviewed_id, rating");
      const counts: Record<string, number> = {};
      const totals: Record<string, number> = {};
      (data || []).forEach(r => {
        counts[r.reviewed_id] = (counts[r.reviewed_id] || 0) + 1;
        totals[r.reviewed_id] = (totals[r.reviewed_id] || 0) + r.rating;
      });
      const averages: Record<string, number> = {};
      Object.keys(counts).forEach(id => {
        averages[id] = totals[id] / counts[id];
      });
      return { counts, averages };
    },
  });

  const reviewCounts = reviewData?.counts || {};
  const reviewAverages = reviewData?.averages || {};

  // Show all quarters: from selected city or from all cities
  const allQuarters = (() => {
    if (selectedCity !== "Toutes" && quartersByCity[selectedCity]) {
      return quartersByCity[selectedCity];
    }
    // All quarters from all cities
    const all: string[] = [];
    Object.values(quartersByCity).forEach(qs => all.push(...qs));
    return [...new Set(all)].sort();
  })();
  const categoryNames = ["Toutes", ...(categories || [])];

  const getDistance = (provider: any): number | null => {
    if (provider.latitude && provider.longitude && userPosition) {
      return haversine(userPosition[0], userPosition[1], provider.latitude, provider.longitude);
    }
    if (!userPosition || !provider.city) return null;
    const coords = cityCoords[provider.city];
    if (!coords) return null;
    return haversine(userPosition[0], userPosition[1], coords[0], coords[1]);
  };

  const isOnline = (lastSeen: string | null): boolean => {
    if (!lastSeen) return false;
    return (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
  };

  const uniqueProviders = (() => {
    const seen = new Set<string>();
    return (providers || []).filter(p => {
      if (seen.has(p.user_id)) return false;
      seen.add(p.user_id);
      return true;
    });
  })();

  let filteredProviders = uniqueProviders;
  if (onlineOnly) filteredProviders = filteredProviders.filter(p => isOnline(p.last_seen_at));
  if (canTravelOnly) filteredProviders = filteredProviders.filter(p => (p as any).can_travel);
  if (quarterFilter) filteredProviders = filteredProviders.filter(p => p.quarter === quarterFilter);
  
  // Min rating filter
  if (minRating > 0) {
    filteredProviders = filteredProviders.filter(p => {
      const avg = reviewAverages[p.user_id] ?? Number(p.reliability_score || 0);
      return avg >= minRating;
    });
  }

  // Max distance filter
  if (maxDistance > 0) {
    filteredProviders = filteredProviders.filter(p => {
      const d = getDistance(p);
      return d !== null && d <= maxDistance;
    });
  }
  
  // Keyword search
  if (keyword.trim()) {
    const kw = keyword.trim().toLowerCase();
    filteredProviders = filteredProviders.filter(p => 
      (p.full_name || "").toLowerCase().includes(kw) ||
      (p.skills as string[] || []).some(s => s.toLowerCase().includes(kw)) ||
      (p.provider_categories || []).some(c => c.toLowerCase().includes(kw))
    );
  }

  const sortedProviders = [...filteredProviders].sort((a, b) => {
    const aPremium = a.is_premium ? 1 : 0;
    const bPremium = b.is_premium ? 1 : 0;
    if (bPremium !== aPremium) return bPremium - aPremium;
    switch (sortBy) {
      case "rating": {
        const avgA = reviewAverages[a.user_id] ?? Number(a.reliability_score || 0);
        const avgB = reviewAverages[b.user_id] ?? Number(b.reliability_score || 0);
        return avgB - avgA;
      }
      case "experience": return (b.years_of_experience || 0) - (a.years_of_experience || 0);
      case "name": return (a.full_name || "").localeCompare(b.full_name || "");
      case "distance": {
        const dA = getDistance(a) ?? 9999;
        const dB = getDistance(b) ?? 9999;
        return dA - dB;
      }
      default: return 0;
    }
  });

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "distance", label: t("Plus proches", "Nearest") },
    { value: "rating", label: t("Meilleurs notés", "Top Rated") },
    { value: "experience", label: t("Plus expérimentés", "Most Experienced") },
    { value: "name", label: t("Nom A-Z", "Name A-Z") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              {t("Trouver un prestataire", "Find a Provider")}
            </h1>
            <div className="flex gap-2">
              {/* Radar quick search */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRadarOpen(true)}
                className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Radar className="w-4 h-4" />
                <span className="hidden sm:inline">{t("Rapide", "Quick")}</span>
              </Button>
              <Button
                variant={onlineOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setOnlineOnly(!onlineOnly)}
                className="gap-1.5"
              >
                <Wifi className="w-4 h-4" />
                <span className="hidden sm:inline">{t("En ligne", "Online")}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-1.5"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">{t("Filtres", "Filters")}</span>
              </Button>
              <Button
                variant={showMap ? "default" : "outline"}
                size="sm"
                onClick={() => setShowMap(!showMap)}
                className="gap-1.5"
              >
                {showMap ? <List className="w-4 h-4" /> : <Map className="w-4 h-4" />}
                <span className="hidden sm:inline">{showMap ? t("Liste", "List") : t("Carte", "Map")}</span>
              </Button>
            </div>
          </div>

          {/* Keyword search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t("Rechercher par nom, compétence ou service...", "Search by name, skill or service...")}
              className="pl-10"
            />
          </div>

          <p className="text-muted-foreground mb-4 text-sm">
            {sortedProviders.length} {t("prestataires disponibles", "providers available")}
          </p>

          {/* Filters - dropdowns */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={selectedCity}
              onChange={(e) => { setSelectedCity(e.target.value); setQuarterFilter(""); }}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
            >
              {cities.map(c => <option key={c} value={c}>{c === "Toutes" ? t("Toutes les villes", "All cities") : c}</option>)}
            </select>
            <select
              value={quarterFilter}
              onChange={(e) => setQuarterFilter(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
            >
              <option value="">{t("Tous les quartiers", "All neighborhoods")}</option>
              {allQuarters.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
            >
              {categoryNames.map(c => <option key={c} value={c}>{c === "Toutes" ? t("Toutes catégories", "All categories") : c}</option>)}
            </select>
          </div>

          {/* Sort + extra filters */}
          {showFilters && (
            <div className="p-4 bg-muted/50 rounded-xl mb-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t("Trier :", "Sort:")}</span>
                {sortOptions.map((opt) => (
                  <button key={opt.value} onClick={() => setSortBy(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${sortBy === opt.value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant={canTravelOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCanTravelOnly(!canTravelOnly)}
                  className="gap-1.5"
                >
                  <Car className="w-4 h-4" />
                  {t("Se déplace", "Can travel")}
                </Button>
                {/* Quarter filter already in main filters row */}
              </div>

              {/* Advanced filters: rating + distance */}
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-gold" />
                  <span className="text-xs text-muted-foreground">{t("Note min :", "Min rating:")}</span>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4, 5].map(r => (
                      <button
                        key={r}
                        onClick={() => setMinRating(r)}
                        className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${minRating === r ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      >
                        {r === 0 ? t("∞", "All") : r}
                      </button>
                    ))}
                  </div>
                </div>
                {userPosition && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">{t("Distance max :", "Max distance:")}</span>
                    <div className="flex gap-1">
                      {[0, 5, 10, 25, 50].map(d => (
                        <button
                          key={d}
                          onClick={() => setMaxDistance(d)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${maxDistance === d ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                        >
                          {d === 0 ? t("∞", "All") : `${d}km`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Map */}
          {showMap && (
            <div className="mb-6">
              <Suspense fallback={<div className="h-[500px] bg-muted rounded-2xl animate-pulse" />}>
                <ProviderMap
                  providers={sortedProviders}
                  userPosition={userPosition}
                  center={mapCenter}
                  reviewCounts={reviewCounts}
                  reviewAverages={reviewAverages}
                />
              </Suspense>
            </div>
          )}

          {/* Results */}
          {isLoading ? (
            <div className="text-center py-20 text-muted-foreground">{t("Chargement...", "Loading...")}</div>
          ) : sortedProviders.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">{t("Aucun prestataire trouvé", "No providers found")}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedProviders.map((p, i) => (
                <ProviderCard
                  key={`provider-${p.user_id}`}
                  provider={p}
                  index={i}
                  distance={getDistance(p)}
                  reviewCount={reviewCounts[p.user_id] || 0}
                  avgRating={reviewAverages[p.user_id]}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
      <BackToTop />
      <RadarSearch open={radarOpen} onClose={() => setRadarOpen(false)} userPosition={userPosition} />
    </div>
  );
};

export default SearchPage;
