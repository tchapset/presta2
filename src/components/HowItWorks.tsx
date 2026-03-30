import { motion } from "framer-motion";
import { Search, MessageSquare, CheckCircle, CreditCard } from "lucide-react";
import { useLang } from "./LanguageToggle";

const HowItWorks = () => {
  const { t } = useLang();

  const steps = [
    {
      icon: Search,
      step: "1",
      title: t("Cherchez", "Search"),
      desc: t("Trouvez un prestataire par catégorie, ville ou proximité.", "Find a provider by category, city or proximity."),
      color: "from-primary to-primary/80",
    },
    {
      icon: MessageSquare,
      step: "2",
      title: t("Contactez", "Contact"),
      desc: t("Discutez via la messagerie sécurisée et convenez du prix.", "Chat via secure messaging and agree on the price."),
      color: "from-secondary to-secondary/80",
    },
    {
      icon: CreditCard,
      step: "3",
      title: t("Payez", "Pay"),
      desc: t("Payez par Mobile Money. Fonds sécurisés en escrow.", "Pay via Mobile Money. Funds secured in escrow."),
      color: "from-amber-500 to-amber-400",
    },
    {
      icon: CheckCircle,
      step: "4",
      title: t("Validez", "Confirm"),
      desc: t("Confirmez la complétion. Le prestataire est payé automatiquement.", "Confirm completion. Provider gets paid automatically."),
      color: "from-green-600 to-green-500",
    },
  ];

  return (
    <section className="py-16 md:py-20 bg-warm">
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
            {t("4 étapes simples", "4 simple steps")}
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center text-center"
            >
              {/* Connector line */}
              <div className="relative flex items-center justify-center mb-4 w-full">
                {i < steps.length - 1 && (
                  <div className="absolute left-1/2 top-7 w-full h-0.5 bg-border hidden md:block" style={{ zIndex: 0 }} />
                )}
                <div className={`relative z-10 w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                  <step.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <span className="w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center mb-2">{step.step}</span>
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
