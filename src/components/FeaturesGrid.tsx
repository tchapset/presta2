import { motion } from "framer-motion";
import { Shield, MapPin, Star, Zap, CreditCard, MessageSquare } from "lucide-react";
import { useLang } from "./LanguageToggle";

const FeaturesGrid = () => {
  const { t } = useLang();

  const features = [
    {
      icon: Zap,
      title: t("Recherche radar", "Radar search"),
      desc: t("Trouvez le prestataire le plus proche en quelques secondes.", "Find the nearest provider in seconds."),
      gradient: "from-primary to-primary/70",
    },
    {
      icon: CreditCard,
      title: t("Paiement sécurisé", "Secure payment"),
      desc: t("Orange Money & MTN MoMo avec protection escrow.", "Orange Money & MTN MoMo with escrow protection."),
      gradient: "from-gold to-gold/70",
    },
    {
      icon: Shield,
      title: t("Prestataires vérifiés", "Verified providers"),
      desc: t("Vérification d'identité et badges de fiabilité.", "Identity verification and reliability badges."),
      gradient: "from-secondary to-secondary/70",
    },
    {
      icon: MapPin,
      title: t("Carte interactive", "Interactive map"),
      desc: t("Visualisez les prestataires en temps réel sur la carte.", "View providers in real-time on the map."),
      gradient: "from-primary to-secondary",
    },
    {
      icon: MessageSquare,
      title: t("Messagerie enrichie", "Rich messaging"),
      desc: t("Texte, photos, fichiers et messages vocaux.", "Text, photos, files and voice messages."),
      gradient: "from-secondary to-primary",
    },
    {
      icon: Star,
      title: t("Avis authentiques", "Authentic reviews"),
      desc: t("Seuls les utilisateurs ayant terminé une mission peuvent noter.", "Only users who completed a mission can rate."),
      gradient: "from-gold to-primary",
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-light text-primary text-sm font-semibold mb-3">
            {t("Pourquoi PRESTA237 ?", "Why PRESTA237?")}
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
            {t("Tout ce qu'il vous faut", "Everything you need")}
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group bg-card rounded-2xl border border-border p-5 card-hover"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm`}>
                <feature.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-display font-bold text-foreground text-sm mb-1">{feature.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;
