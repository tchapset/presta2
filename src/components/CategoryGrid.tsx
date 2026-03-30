import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "./LanguageToggle";
import {
  Wrench, Zap, Paintbrush, Home, Truck, Scissors,
  ChefHat, Laptop, Camera, Hammer, Leaf, Car,
  Baby, Heart, Music, Dumbbell, BookOpen, PenTool,
  Tv, Shirt, ShoppingBag, Wifi,
} from "lucide-react";

const iconMap: Record<string, any> = {
  Plomberie: Wrench, Électricité: Zap, Peinture: Paintbrush, Ménage: Home,
  Déménagement: Truck, Couture: Scissors, Traiteur: ChefHat, Informatique: Laptop,
  Photographie: Camera, Maçonnerie: Hammer, Jardinage: Leaf, Mécanique: Car,
  Garde_enfants: Baby, Santé: Heart, Musique: Music, Sport: Dumbbell,
  Cours: BookOpen, Design: PenTool, Électronique: Tv, Pressing: Shirt,
  Commerce: ShoppingBag, Internet: Wifi,
};

const colorMap: Record<string, string> = {
  Plomberie: "bg-blue-100 dark:bg-blue-950/40 text-blue-600",
  Électricité: "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-600",
  Peinture: "bg-pink-100 dark:bg-pink-950/40 text-pink-600",
  Ménage: "bg-green-100 dark:bg-green-950/40 text-green-600",
  Déménagement: "bg-orange-100 dark:bg-orange-950/40 text-orange-600",
  Couture: "bg-purple-100 dark:bg-purple-950/40 text-purple-600",
  Traiteur: "bg-red-100 dark:bg-red-950/40 text-red-600",
  Informatique: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600",
  Photographie: "bg-teal-100 dark:bg-teal-950/40 text-teal-600",
  Maçonnerie: "bg-stone-100 dark:bg-stone-950/40 text-stone-600",
};

const CategoryGrid = () => {
  const navigate = useNavigate();
  const { t } = useLang();

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("name");
      return data?.map(c => c.name) || [];
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const { data: providerCounts } = useQuery({
    queryKey: ["provider-counts-by-category"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("provider_categories").eq("is_provider", true);
      if (!data) return {};
      const counts: Record<string, number> = {};
      data.forEach(p => {
        (p.provider_categories || []).forEach((cat: string) => {
          counts[cat] = (counts[cat] || 0) + 1;
        });
      });
      return counts;
    },
    staleTime: 60000,
  });

  const cats = (categories || []).map(name => ({
    label: name,
    icon: iconMap[name] || Wrench,
    count: providerCounts?.[name] || 0,
    colorClass: colorMap[name] || "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600",
  }));

  if (cats.length === 0) return null;

  return (
    <section className="py-16 md:py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
            {t("Explorez nos catégories", "Explore our categories")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("Des centaines de prestataires vérifiés dans toutes les catégories", "Hundreds of verified providers in all categories")}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
          {cats.map((cat, i) => (
            <motion.button
              key={cat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/recherche?category=${encodeURIComponent(cat.label)}`)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
            >
              <div className={`w-12 h-12 rounded-xl ${cat.colorClass} flex items-center justify-center transition-transform group-hover:scale-110`}>
                <cat.icon className="w-6 h-6" />
              </div>
              <span className="font-semibold text-sm text-foreground text-center leading-tight">{cat.label}</span>
              <span className="text-xs text-muted-foreground">{cat.count} pro{cat.count > 1 ? "s" : ""}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryGrid;
