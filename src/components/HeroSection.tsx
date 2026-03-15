import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Search, MapPin, ChevronDown, CheckCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-image.jpg";
import { useLang } from "./LanguageToggle";

const cities = ["Douala", "Yaoundé", "Garoua", "Bafoussam", "Bamenda", "Maroua", "Bertoua", "Kribi", "Limbé", "Buéa"];

const HeroSection = () => {
  const navigate = useNavigate();
  const { t } = useLang();
  const [serviceInput, setServiceInput] = useState("");
  const [lieuInput, setLieuInput] = useState("");
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showLieuDropdown, setShowLieuDropdown] = useState(false);
  const serviceRef = useRef<HTMLDivElement>(null);
  const lieuRef = useRef<HTMLDivElement>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("name");
      return data?.map(c => c.name) || [];
    },
  });

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (serviceRef.current && !serviceRef.current.contains(e.target as Node)) setShowServiceDropdown(false);
      if (lieuRef.current && !lieuRef.current.contains(e.target as Node)) setShowLieuDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredCategories = (categories || []).filter(c =>
    c.toLowerCase().includes(serviceInput.toLowerCase())
  );

  const filteredCities = cities.filter(c =>
    c.toLowerCase().includes(lieuInput.toLowerCase())
  );

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (serviceInput) params.set("category", serviceInput);
    if (lieuInput) params.set("city", lieuInput);
    navigate(`/recherche?${params.toString()}`);
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-transparent" />

      <div className="container mx-auto px-4 relative z-10 pt-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <span className="text-sm text-primary-foreground/80 font-medium">
                🇨🇲 {t("La marketplace #1 au Cameroun", "The #1 Marketplace in Cameroon")}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-primary-foreground leading-tight mb-6">
              {t("Trouvez le bon", "Find the right")}{" "}
              <span className="text-gradient-gold">{t("prestataire", "provider")}</span>
              <br />
              {t("près de chez vous", "near you")}
            </h1>

            <p className="text-lg text-primary-foreground/70 mb-8 max-w-lg leading-relaxed">
              {t(
                "Plombier, électricien, peintre… Trouvez un professionnel vérifié près de chez vous en quelques clics.",
                "Plumber, electrician, painter… Find a verified professional near you in a few clicks."
              )}
            </p>

            {/* Search card with autocomplete */}
            <div className="bg-card/95 backdrop-blur-md rounded-2xl p-5 shadow-xl max-w-md mb-8 border border-border/50">
              {/* Service autocomplete */}
              <div className="relative mb-3" ref={serviceRef}>
                <div className="flex items-center gap-3 h-14 px-4 rounded-xl bg-background border border-border">
                  <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={serviceInput}
                    onChange={(e) => { setServiceInput(e.target.value); setShowServiceDropdown(true); }}
                    onFocus={() => setShowServiceDropdown(true)}
                    placeholder={t("Prestations de service", "Service type")}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0 cursor-pointer" onClick={() => setShowServiceDropdown(!showServiceDropdown)} />
                </div>
                {showServiceDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {filteredCategories.length > 0 ? filteredCategories.map(cat => (
                      <button key={cat} onClick={() => { setServiceInput(cat); setShowServiceDropdown(false); }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors text-foreground">
                        {cat}
                      </button>
                    )) : (
                      <p className="px-4 py-3 text-sm text-muted-foreground">{t("Aucune catégorie trouvée", "No category found")}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Location autocomplete */}
              <div className="relative mb-4" ref={lieuRef}>
                <div className="flex items-center gap-3 h-14 px-4 rounded-xl bg-background border border-border">
                  <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={lieuInput}
                    onChange={(e) => { setLieuInput(e.target.value); setShowLieuDropdown(true); }}
                    onFocus={() => setShowLieuDropdown(true)}
                    placeholder={t("Lieu", "Location")}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0 cursor-pointer" onClick={() => setShowLieuDropdown(!showLieuDropdown)} />
                </div>
                {showLieuDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {filteredCities.length > 0 ? filteredCities.map(city => (
                      <button key={city} onClick={() => { setLieuInput(city); setShowLieuDropdown(false); }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors text-foreground">
                        {city}
                      </button>
                    )) : (
                      <p className="px-4 py-3 text-sm text-muted-foreground">{t("Aucune ville trouvée", "No city found")}</p>
                    )}
                  </div>
                )}
              </div>

              <Button variant="hero" size="xl" onClick={handleSearch} className="w-full h-14 rounded-xl text-base font-semibold">
                {t("Recherche", "Search")}
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-primary-foreground/60">
              {[
                t("Prestataires vérifiés", "Verified Providers"),
                t("Avis vérifiés", "Verified Reviews"),
                t("Recherche par carte", "Map Search"),
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-gold" />
                  {item}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="hidden lg:block">
            <div className="relative">
              <img src={heroImage} alt={t("Prestataire professionnel au travail", "Professional provider at work")} className="rounded-3xl shadow-2xl w-full object-cover h-[500px]" />
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="absolute -bottom-6 -left-6 glass rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-gold flex items-center justify-center text-gold-foreground font-bold text-sm">JD</div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Jean Dupont</p>
                    <p className="text-xs text-muted-foreground">⭐ 4.9 · Plombier · Douala</p>
                  </div>
                </div>
              </motion.div>
              <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 4, repeat: Infinity }} className="absolute -top-4 -right-4 glass rounded-2xl p-4 shadow-xl">
                <p className="text-sm font-bold text-primary">+2,500</p>
                <p className="text-xs text-muted-foreground">{t("prestataires disponibles", "available providers")}</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
