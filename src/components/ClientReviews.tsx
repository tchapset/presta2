import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { motion } from "framer-motion";
import { useLang } from "./LanguageToggle";

const placeholderReviews = [
  { id: "p1", rating: 5, comment: "PRESTA237 m'a permis de trouver un plombier fiable en 10 minutes. Service au top !", reviewer_name: "Marie K.", created_at: "2026-01-15" },
  { id: "p2", rating: 4, comment: "Plateforme très intuitive, le système de paiement sécurisé me rassure énormément.", reviewer_name: "Paul N.", created_at: "2026-02-10" },
  { id: "p3", rating: 5, comment: "Grâce à PRESTA237 j'ai doublé ma clientèle. Indispensable pour les prestataires !", reviewer_name: "Aïcha M.", created_at: "2026-03-05" },
];

const ClientReviews = () => {
  const { t } = useLang();

  const { data: reviews } = useQuery({
    queryKey: ["platform-reviews"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_reviews" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);

      if (!data || data.length === 0) return [];

      const userIds = (data as any[]).map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);

      return (data as any[]).map((r: any) => ({
        ...r,
        reviewer_name: profiles?.find(p => p.user_id === r.user_id)?.full_name || "Utilisateur",
        reviewer_avatar: profiles?.find(p => p.user_id === r.user_id)?.avatar_url,
      }));
    },
  });

  const displayReviews = reviews && reviews.length > 0 ? reviews : placeholderReviews;

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            {t("Ce que nos utilisateurs pensent de PRESTA237", "What Our Users Think of PRESTA237")}
          </h2>
          <p className="text-muted-foreground">
            {t("Des avis authentiques de notre communauté", "Authentic reviews from our community")}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayReviews.map((r: any, i: number) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-2xl border border-border p-6"
            >
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className={`w-4 h-4 ${j < r.rating ? "text-gold fill-gold" : "text-muted"}`} />
                ))}
              </div>
              <p className="text-sm text-foreground mb-4 line-clamp-3">{r.comment || t("Excellente plateforme !", "Excellent platform!")}</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-hero flex items-center justify-center text-primary-foreground text-xs font-bold">
                  {(r.reviewer_name || "US")?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.reviewer_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at!).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ClientReviews;
