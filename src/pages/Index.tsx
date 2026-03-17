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
        <FeaturesGrid />
        <ClientReviews />
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
};

export default Index;
