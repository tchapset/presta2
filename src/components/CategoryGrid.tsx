import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "./LanguageToggle";
import {
  Wrench, Zap, Paintbrush, Home, Truck, Scissors,
  ChefHat, Laptop, Camera, Hammer,
} from "lucide-react";

const iconMap: Record<string, any> = {
  Plomberie: Wrench, Électricité: Zap, Peinture: Paintbrush, Ménage: Home,
  Déménagement: Truck, Couture: Scissors, Traiteur: ChefHat, Informatique: Laptop,
  Photographie: Camera, Maçonnerie: Hammer,
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
  });

  const cats = (categories || []).map(name => ({
    label: name,
    icon: iconMap[name] || Wrench,
    count: providerCounts?.[name] || 0,
  }));

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            {t("Explorez nos catégories", "Explore our categories")}
          </h2>
          <p className="text-muted-foreground">
            {t("Des centaines de prestataires vérifiés dans toutes les catégories", "Hundreds of verified providers in all categories")}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {cats.map((cat, i) => (
            <motion.button
              key={cat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate(`/recherche?category=${encodeURIComponent(cat.label)}`)}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-light flex items-center justify-center group-hover:bg-gradient-hero transition-colors">
                <cat.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors" />
              </div>
              <span className="font-semibold text-sm text-foreground">{cat.label}</span>
              <span className="text-xs text-muted-foreground">{cat.count} pros</span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryGrid;