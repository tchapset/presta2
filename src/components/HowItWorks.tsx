import { motion } from "framer-motion";
import { Search, MessageSquare, CheckCircle, Star, CreditCard } from "lucide-react";
import { useLang } from "./LanguageToggle";

const HowItWorks = () => {
  const { t } = useLang();

  const steps = [
    {
      icon: Search,
      step: "1",
      title: t("Cherchez", "Search"),
      desc: t("Trouvez un prestataire par catégorie, ville ou proximité.", "Find a provider by category, city or proximity."),
      color: "bg-primary",
    },
    {
      icon: MessageSquare,
      step: "2",
      title: t("Contactez", "Contact"),
      desc: t("Discutez via la messagerie sécurisée et convenez du prix.", "Chat via secure messaging and agree on the price."),
      color: "bg-secondary",
    },
    {
      icon: CreditCard,
      step: "3",
      title: t("Payez", "Pay"),
      desc: t("Payez par Mobile Money. Fonds sécurisés en escrow.", "Pay via Mobile Money. Funds secured in escrow."),
      color: "bg-gold",
    },
    {
      icon: CheckCircle,
      step: "4",
      title: t("Validez", "Confirm"),
      desc: t("Confirmez la complétion. Le prestataire est payé automatiquement.", "Confirm completion. Provider gets paid automatically."),
      color: "bg-green-600",
    },
    {
      icon: Star,
      step: "5",
      title: t("Évaluez", "Rate"),
      desc: t("Laissez un avis pour aider la communauté.", "Leave a review to help the community."),
      color: "bg-primary",
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-warm">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-gold/20 text-gold-foreground text-sm font-semibold mb-3">
            {t("Comment ça marche ?", "How does it work?")}
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            {t("5 étapes simples", "5 simple steps")}
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 max-w-5xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex flex-col items-center text-center"
            >
              <div className={`w-14 h-14 rounded-2xl ${step.color} flex items-center justify-center mb-3 shadow-md`}>
                <step.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-display font-bold text-foreground mb-1">{step.step}</span>
              <h3 className="font-display font-bold text-foreground text-sm mb-1">{step.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
