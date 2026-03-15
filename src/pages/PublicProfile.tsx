import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Shield, Clock, Briefcase, Car, Award, MessageSquare } from "lucide-react";
import GalleryLightbox from "@/components/GalleryLightbox";

const PublicProfile = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", slug],
    queryFn: async () => {
      // slug is the full_name with dashes, e.g., "jean-dupont"
      // We search by matching the slug pattern
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_provider", true);
      
      if (!data) return null;
      
      // Find profile whose name matches the slug
      const nameSlug = slug?.toLowerCase().replace(/-/g, " ");
      const match = data.find(p => 
        p.full_name.toLowerCase().trim() === nameSlug
      );
      return match || null;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["public-reviews", profile?.user_id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("reviewed_id", profile!.user_id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 flex justify-center">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 text-center">
          <p className="text-muted-foreground text-lg">Profil introuvable</p>
          <Link to="/recherche"><Button className="mt-4">Rechercher des prestataires</Button></Link>
        </div>
        <Footer />
      </div>
    );
  }

  const avgRating = reviews?.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: profile.full_name,
    description: profile.bio || `Prestataire de services sur TKLINK`,
    url: `https://presta2.vercel.app/p/${profile.full_name.toLowerCase().replace(/\s+/g, "-")}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: profile.city || "Cameroun",
      addressCountry: "CM",
    },
    aggregateRating: reviews?.length ? {
      "@type": "AggregateRating",
      ratingValue: avgRating,
      reviewCount: reviews.length,
    } : undefined,
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${profile.full_name} - ${profile.provider_categories?.[0] || "Prestataire"} | TKLINK`}
        description={`${profile.full_name}, ${profile.provider_categories?.[0] || "prestataire"} à ${profile.city || "Cameroun"}. ${profile.bio?.slice(0, 120) || "Consultez le profil et contactez directement."}`}
        jsonLd={jsonLd}
      />
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Header */}
          <div className="bg-card rounded-2xl border border-border p-8 mb-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold text-2xl overflow-hidden shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  profile.full_name?.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-2xl font-display font-bold text-foreground">{profile.full_name}</h1>
                  {profile.is_verified && <Shield className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                  <span className="flex items-center gap-1"><Star className="w-4 h-4 text-gold fill-gold" />{avgRating} ({reviews?.length || 0} avis)</span>
                  {profile.city && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{profile.city}{profile.quarter ? `, ${profile.quarter}` : ""}</span>}
                  <span className={`flex items-center gap-1 ${profile.availability === "available" ? "text-green-600 font-semibold" : ""}`}>
                    <Clock className="w-4 h-4" />{profile.availability === "available" ? "Disponible" : "Indisponible"}
                  </span>
                  {profile.can_travel && <span className="flex items-center gap-1 text-blue-600"><Car className="w-4 h-4" />Se déplace</span>}
                </div>
              </div>
              <Link to={`/prestataire/${profile.id}`}>
                <Button className="gap-2">
                  <MessageSquare className="w-4 h-4" /> Voir le profil complet
                </Button>
              </Link>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <h2 className="text-lg font-display font-bold text-foreground mb-3">À propos</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
            </div>
          )}

          {/* Services */}
          {profile.provider_categories && profile.provider_categories.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <h2 className="text-lg font-display font-bold text-foreground mb-3">Services</h2>
              <div className="flex flex-wrap gap-2">
                {profile.provider_categories.map((c) => (
                  <span key={c} className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <div className="grid grid-cols-2 gap-4">
              {profile.years_of_experience != null && profile.years_of_experience > 0 && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                  <Briefcase className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-lg font-bold text-foreground">{profile.years_of_experience} ans</p>
                    <p className="text-xs text-muted-foreground">d'expérience</p>
                  </div>
                </div>
              )}
              {profile.skills && (profile.skills as string[]).length > 0 && (
                <div className="col-span-2">
                  <div className="flex flex-wrap gap-2">
                    {(profile.skills as string[]).map((s) => (
                      <span key={s} className="px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-sm font-medium">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Gallery */}
          {profile.gallery && profile.gallery.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <h2 className="text-lg font-display font-bold text-foreground mb-3">Galerie</h2>
              <GalleryLightbox images={profile.gallery.slice(0, 10)} />
            </div>
          )}

          {/* Reviews */}
          {reviews && reviews.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-lg font-display font-bold text-foreground mb-4">Avis ({reviews.length})</h2>
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="border-b border-border pb-3 last:border-0">
                    <div className="flex gap-0.5 mb-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? "text-gold fill-gold" : "text-muted"}`} />
                      ))}
                    </div>
                    <p className="text-sm text-foreground">{r.comment || "Aucun commentaire"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-8 text-center">
            <p className="text-muted-foreground text-sm mb-3">Intéressé par ce prestataire ?</p>
            <Link to={`/prestataire/${profile.id}`}>
              <Button variant="hero" size="lg">Contacter {profile.full_name}</Button>
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PublicProfile;
