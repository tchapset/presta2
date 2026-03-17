import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
import ReviewModal from "@/components/ReviewModal";
import ReportModal from "@/components/ReportModal";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Shield, Clock, Phone, Heart, Calendar, Briefcase, Car, Award, MessageSquare, Navigation, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import GalleryLightbox from "@/components/GalleryLightbox";
import { toast } from "sonner";

const ProviderProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [showPhone, setShowPhone] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleContact = async () => {
    if (!user) { toast.error("Connectez-vous pour contacter ce prestataire"); return; }
    if (!profile) return;
    setContactLoading(true);
    const { data: existing } = await supabase
      .from("missions")
      .select("id")
      .eq("client_id", user.id)
      .eq("provider_id", profile.user_id)
      .not("status", "in", '("completed","cancelled")')
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      navigate(`/mission/${existing.id}`);
    } else {
      const { data: newMission, error } = await supabase
        .from("missions")
        .insert({
          client_id: user.id,
          provider_id: profile.user_id,
          title: `Conversation avec ${profile.full_name}`,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) {
        toast.error("Erreur lors de la création de la conversation");
      } else {
        navigate(`/mission/${newMission.id}`);
      }
    }
    setContactLoading(false);
  };

  const { data: profile, isLoading } = useQuery({
    queryKey: ["provider", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews", profile?.user_id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews").select("*")
        .eq("reviewed_id", profile!.user_id)
        .order("created_at", { ascending: false }).limit(20);
      
      if (!data || data.length === 0) return [];

      const reviewerIds = data.map(r => r.reviewer_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", reviewerIds);

      return data.map(r => ({
        ...r,
        reviewer_name: profiles?.find(p => p.user_id === r.reviewer_id)?.full_name || "Client",
        reviewer_avatar: profiles?.find(p => p.user_id === r.reviewer_id)?.avatar_url || null,
      }));
    },
  });

  const { data: isFav } = useQuery({
    queryKey: ["favorite", user?.id, profile?.user_id],
    enabled: !!user && !!profile,
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("id").eq("user_id", user!.id).eq("provider_id", profile!.user_id).maybeSingle();
      return !!data;
    },
  });

  const toggleFavorite = async () => {
    if (!user || !profile) return toast.error("Connectez-vous d'abord");
    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("provider_id", profile.user_id);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, provider_id: profile.user_id });
    }
    queryClient.invalidateQueries({ queryKey: ["favorite", user.id, profile.user_id] });
  };

  if (isLoading) {
    return <div className="min-h-screen bg-background"><Navbar /><div className="pt-24 flex justify-center"><p className="text-muted-foreground">Chargement...</p></div></div>;
  }

  if (!profile) {
    return <div className="min-h-screen bg-background"><Navbar /><div className="pt-24 text-center"><p className="text-muted-foreground">Profil introuvable</p><Link to="/recherche"><Button className="mt-4">Retour</Button></Link></div></div>;
  }

  const avgRating = reviews?.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : Number(profile.reliability_score).toFixed(1);

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;

  // Provider level removed per user request

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: profile.full_name,
    description: profile.bio || `Prestataire de services sur PRESTA237`,
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
        title={`${profile.full_name} - ${profile.provider_categories?.[0] || "Prestataire"} à ${profile.city || "Cameroun"} | PRESTA237`}
        description={`${profile.full_name}, ${profile.provider_categories?.[0] || "prestataire"} à ${profile.city || "Cameroun"}. ${profile.bio?.slice(0, 120) || "Consultez le profil, les avis et contactez directement."}`}
        jsonLd={jsonLd}
      />
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-6">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold text-2xl overflow-hidden">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      profile.full_name?.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  {profile.availability === "available" && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-3 border-card" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-2xl font-display font-bold text-foreground">{profile.full_name}</h1>
                    {profile.is_verified && <Shield className="w-5 h-5 text-primary" />}
                    {profile.is_premium && <span className="px-2 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground font-semibold">Elite</span>}
                    {(profile as any).verification_level >= 2 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                        <Shield className="w-3 h-3" /> Identité vérifiée
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-2">
                    <span className="flex items-center gap-1"><Star className="w-4 h-4 text-gold fill-gold" />{avgRating} ({reviews?.length || 0} avis)</span>
                    {profile.city && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{profile.city}{profile.quarter ? `, ${profile.quarter}` : ""}</span>}
                    <span className={`flex items-center gap-1 ${profile.availability === "available" ? "text-green-600 font-semibold" : ""}`}><Clock className="w-4 h-4" />{profile.availability === "available" ? "Disponible" : "Indisponible"}</span>
                    {(profile as any).can_travel && <span className="flex items-center gap-1 text-blue-600"><Car className="w-4 h-4" />Se déplace</span>}
                    {(profile as any).pricing_type === "quote" && <span className="flex items-center gap-1 text-orange-600 font-medium">📋 Sur devis</span>}
                    {(profile as any).pricing_type === "fixed" && <span className="flex items-center gap-1 text-green-600 font-medium">💰 Tarif fixe</span>}
                    {(profile as any).pricing_type === "both" && <span className="flex items-center gap-1 text-purple-600 font-medium">📋💰 Devis & tarif fixe</span>}
                    {memberSince && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />Membre depuis {memberSince}</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button onClick={handleContact} disabled={contactLoading} size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                    <MessageSquare className="w-4 h-4" /> {contactLoading ? "..." : "Contacter"}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => {
                    const slug = profile.full_name.toLowerCase().trim()
                      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    const shareUrl = `https://presta237.com/p/${slug}`;
                    if (navigator.share) {
                      navigator.share({ title: `${profile.full_name} sur PRESTA237`, text: `Découvrez ${profile.full_name}, prestataire sur PRESTA237`, url: shareUrl }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                      toast.success("Lien copié : " + shareUrl);
                    }
                  }}>
                    <Share2 className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={toggleFavorite}>
                    <Heart className={`w-4 h-4 ${isFav ? "fill-accent text-accent" : ""}`} />
                  </Button>
                </div>
              </div>
              <div className="mt-3">
                <ReportModal reportedUserId={profile.user_id} reportedName={profile.full_name} />
              </div>
            </div>

            {/* Itinéraire - uses internal map, requires login */}
            {profile.latitude && profile.longitude && (
              <div className="bg-card rounded-2xl border border-border p-6 mb-6">
                <h2 className="text-lg font-display font-bold text-foreground mb-3">Itinéraire</h2>
                <Button variant="outline" className="gap-2" onClick={() => {
                  if (!user) {
                    toast.error("Connectez-vous pour voir l'itinéraire");
                    navigate("/auth");
                    return;
                  }
                  navigate(`/recherche?lat=${profile.latitude}&lng=${profile.longitude}`);
                }}>
                  <Navigation className="w-4 h-4" /> Voir l'itinéraire sur la carte
                </Button>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* À propos */}
                {profile.bio && (
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <h2 className="text-lg font-display font-bold text-foreground mb-3">À propos</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
                  </div>
                )}

                {/* Services */}
                {profile.provider_categories && profile.provider_categories.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <h2 className="text-lg font-display font-bold text-foreground mb-3">Services proposés</h2>
                    <div className="flex flex-wrap gap-2">
                      {profile.provider_categories.map((c) => (
                        <span key={c} className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expérience & Compétences */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h2 className="text-lg font-display font-bold text-foreground mb-4">Expérience & Compétences</h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {profile.years_of_experience != null && profile.years_of_experience > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                        <Briefcase className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-lg font-bold text-foreground">{profile.years_of_experience} ans</p>
                          <p className="text-xs text-muted-foreground">d'expérience</p>
                        </div>
                      </div>
                    )}
                    {profile.avg_response_time_minutes != null && (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                        <Clock className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-lg font-bold text-foreground">~{profile.avg_response_time_minutes} min</p>
                          <p className="text-xs text-muted-foreground">temps de réponse</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {profile.skills && (profile.skills as string[]).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-2">Compétences</h3>
                      <div className="flex flex-wrap gap-2">
                        {(profile.skills as string[]).map((s) => (
                          <span key={s} className="px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-sm font-medium">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.badges && profile.badges.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-foreground mb-2">Badges</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.badges.map((b) => (
                          <span key={b} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-medium">
                            <Award className="w-3.5 h-3.5" /> {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Galerie - max 10 photos */}
                {profile.gallery && profile.gallery.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <h2 className="text-lg font-display font-bold text-foreground mb-3">Galerie</h2>
                    <GalleryLightbox images={profile.gallery.slice(0, 10)} />
                  </div>
                )}

                {/* Avis */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-display font-bold text-foreground">Avis clients ({reviews?.length || 0})</h2>
                  </div>
                  {!user && (
                    <p className="text-sm text-muted-foreground mb-4 p-3 bg-muted/50 rounded-lg">
                      <Link to="/auth" className="text-primary underline">Connectez-vous</Link> pour donner votre avis.
                    </p>
                  )}
                  {user && user.id !== profile.user_id && (
                    <div className="mb-4">
                      <ReviewModal
                        reviewedId={profile.user_id}
                        trigger={
                          <Button variant="outline" size="sm" className="gap-1.5 border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-700">
                            <Star className="w-4 h-4" /> Écrire un avis
                          </Button>
                        }
                      />
                    </div>
                  )}
                  {!reviews || reviews.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Aucun avis pour le moment</p>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((r: any) => (
                        <div key={r.id} className="border-b border-border pb-4 last:border-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? "text-gold fill-gold" : "text-muted"}`} />
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground font-medium">{r.reviewer_name}</span>
                            <span className="text-xs text-muted-foreground">· {new Date(r.created_at!).toLocaleDateString("fr-FR")}</span>
                          </div>
                          <p className="text-sm text-foreground">{r.comment || "Aucun commentaire"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right sidebar */}
              <div className="space-y-6">
                {profile.intervention_zones && profile.intervention_zones.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-display font-bold text-foreground mb-3">Zones d'intervention</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.intervention_zones.map((z) => (
                        <span key={z} className="px-3 py-1 rounded-full bg-muted text-sm text-foreground">{z}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contact section */}
            {profile.phone && (
              <div className="bg-card rounded-2xl border border-border p-6 mt-6">
                <h2 className="text-lg font-display font-bold text-foreground mb-4">Contact</h2>
                {showPhone ? (
                  <div className="space-y-3">
                    <p className="text-foreground font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary" /> {profile.phone}
                    </p>
                    <div className="flex gap-2">
                      <a href={`https://wa.me/${profile.phone?.replace(/\s/g, "")}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="hero" size="sm" className="gap-2">WhatsApp</Button>
                      </a>
                      <a href={`tel:${profile.phone}`}>
                        <Button variant="outline" size="sm" className="gap-2"><Phone className="w-4 h-4" /> Appeler</Button>
                      </a>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => {
                    if (!user) {
                      toast.error("Connectez-vous pour voir le numéro");
                      return;
                    }
                    setShowPhone(true);
                  }} className="gap-2">
                    <Phone className="w-4 h-4" /> Afficher le numéro
                  </Button>
                )}
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

export default ProviderProfile;