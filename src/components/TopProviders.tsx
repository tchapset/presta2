import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import ProviderCard from "./ProviderCard";
import { useLang } from "./LanguageToggle";

const TopProviders = () => {
  const { t } = useLang();

  const { data: providers } = useQuery({
    queryKey: ["top-providers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_provider", true)
        .order("reliability_score", { ascending: false })
        .limit(6);
      // Deduplicate by user_id
      const seen = new Set<string>();
      return (data || []).filter(p => {
        if (seen.has(p.user_id)) return false;
        seen.add(p.user_id);
        return true;
      });
    },
  });

  if (!providers || providers.length === 0) return null;

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            {t("Prestataires les mieux notés", "Top Rated Providers")}
          </h2>
          <p className="text-muted-foreground">
            {t("Les professionnels avec les meilleurs scores de fiabilité", "Professionals with the best reliability scores")}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((p, i) => (
            <ProviderCard key={p.id} provider={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TopProviders;
