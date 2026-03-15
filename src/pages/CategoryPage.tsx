import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import ProviderCard from "@/components/ProviderCard";
import BackToTop from "@/components/BackToTop";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const CategoryPage = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(name || "");

  const { data: providers, isLoading } = useQuery({
    queryKey: ["category-providers", decodedName],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_provider", true)
        .contains("provider_categories", [decodedName])
        .order("is_premium", { ascending: false });
      return data || [];
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["all-reviews-category"],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("reviewed_id, rating");
      return data || [];
    },
  });

  const getAvgRating = (userId: string) => {
    const userReviews = reviews?.filter(r => r.reviewed_id === userId) || [];
    return userReviews.length > 0 ? userReviews.reduce((s, r) => s + r.rating, 0) / userReviews.length : 0;
  };

  const getReviewCount = (userId: string) => reviews?.filter(r => r.reviewed_id === userId).length || 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${decodedName} au Cameroun - TKLINK`,
    description: `Trouvez les meilleurs prestataires de ${decodedName.toLowerCase()} au Cameroun. Profils vérifiés, avis clients et devis gratuits.`,
    provider: {
      "@type": "Organization",
      name: "TKLINK",
    },
    areaServed: {
      "@type": "Country",
      name: "Cameroun",
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${decodedName} au Cameroun - Prestataires vérifiés | TKLINK`}
        description={`Trouvez les meilleurs prestataires de ${decodedName.toLowerCase()} au Cameroun. Comparez les avis, prix et disponibilités sur TKLINK.`}
        jsonLd={jsonLd}
      />
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" /> Retour
            </Button>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
              {decodedName}
            </h1>
            <p className="text-muted-foreground mb-8">
              {providers?.length || 0} prestataire{(providers?.length || 0) > 1 ? "s" : ""} disponible{(providers?.length || 0) > 1 ? "s" : ""} au Cameroun
            </p>

            {isLoading ? (
              <p className="text-muted-foreground">Chargement...</p>
            ) : providers && providers.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {providers.map((p, i) => (
                  <ProviderCard
                    key={p.id}
                    provider={p}
                    index={i}
                    avgRating={getAvgRating(p.user_id)}
                    reviewCount={getReviewCount(p.user_id)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <p className="text-muted-foreground mb-4">Aucun prestataire trouvé dans cette catégorie.</p>
                <Button onClick={() => navigate("/recherche")}>Voir tous les prestataires</Button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      <Footer />
      <BackToTop />
    </div>
  );
};

export default CategoryPage;
