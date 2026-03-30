import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import CategoryGrid from "@/components/CategoryGrid";
import FeaturesGrid from "@/components/FeaturesGrid";
import HowItWorks from "@/components/HowItWorks";
import TopProviders from "@/components/TopProviders";
import ClientReviews from "@/components/ClientReviews";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
import SEOHead from "@/components/SEOHead";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "PRESTA237",
  url: "https://presta2.vercel.app",
  description: "La marketplace sécurisée pour les services locaux au Cameroun. Trouvez plombiers, électriciens et prestataires vérifiés.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://presta2.vercel.app/recherche?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PRESTA237",
  url: "https://presta2.vercel.app",
  logo: "https://presta2.vercel.app/presta237-logo.png",
  sameAs: [],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    areaServed: "CM",
    availableLanguage: ["French", "English"],
  },
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="PRESTA237 - Services locaux vérifiés au Cameroun"
        description="Trouvez et contactez des prestataires de services vérifiés au Cameroun. Plomberie, électricité, ménage, informatique et plus. Avis clients, paiement sécurisé."
        canonical="https://presta2.vercel.app/"
        jsonLd={[jsonLd, orgJsonLd] as any}
      />
      <Navbar />
      <main>
        <HeroSection />
        <CategoryGrid />
        <TopProviders />
        <HowItWorks />

        {/* Mission Wall Teaser */}
        <section className="py-14 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col md:flex-row items-center justify-between gap-6 bg-card rounded-3xl border border-border p-8 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Briefcase className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold text-foreground mb-1">
                    Mur de missions
                  </h2>
                  <p className="text-muted-foreground text-sm max-w-md">
                    Publiez votre besoin et laissez les prestataires venir à vous. Des plombiers, électriciens et bien d'autres répondent à vos demandes.
                  </p>
                </div>
              </div>
              <Link to="/mur-missions">
                <Button variant="hero" size="lg" className="gap-2 whitespace-nowrap">
                  Voir les missions <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        <FeaturesGrid />
        <ClientReviews />
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
};

export default Index;
