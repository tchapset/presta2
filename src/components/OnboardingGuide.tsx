import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Search, MessageSquare, Star, ArrowRight, X, Sparkles, UserCheck, Shield, MapPin, Bell, Wallet, CreditCard, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const ONBOARDING_CLIENT_KEY = "presta237-onboarding-client-done";
const ONBOARDING_PROVIDER_KEY = "presta237-onboarding-provider-done";

// Client-focused steps
const clientSteps = [
  {
    icon: Sparkles,
    title: "Bienvenue sur PRESTA237 ! 🎉",
    description: "La plateforme qui connecte clients et prestataires de services au Cameroun. Suivez ce guide rapide.",
    color: "from-primary to-primary/70",
    action: null,
    actionLabel: null,
  },
  {
    icon: Search,
    title: "Trouvez un prestataire",
    description: "Recherchez par catégorie, ville ou compétence. Utilisez la carte pour voir les prestataires près de vous.",
    color: "from-secondary to-primary",
    action: "/recherche",
    actionLabel: "Lancer une recherche",
  },
  {
    icon: MessageSquare,
    title: "Contactez et négociez",
    description: "Depuis le profil d'un prestataire, cliquez « Contacter » pour démarrer une conversation sécurisée.",
    color: "from-primary to-primary/70",
    action: null,
    actionLabel: null,
  },
  {
    icon: CreditCard,
    title: "Payez en sécurité",
    description: "Payez via Orange Money ou MTN MoMo. Votre argent est gardé en escrow jusqu'à ce que vous confirmiez la complétion.",
    color: "from-gold to-gold/70",
    action: null,
    actionLabel: null,
  },
  {
    icon: Star,
    title: "Évaluez et recommandez",
    description: "Une fois satisfait, laissez un avis. Les meilleurs prestataires gagnent en visibilité grâce à vos retours !",
    color: "from-primary to-secondary",
    action: null,
    actionLabel: null,
  },
];

// Provider-focused steps
const providerSteps = [
  {
    icon: Sparkles,
    title: "Bienvenue prestataire ! 🎉",
    description: "PRESTA237 vous connecte avec des clients qui ont besoin de vos services. Voici comment tirer le meilleur de la plateforme.",
    color: "from-primary to-primary/70",
    action: null,
    actionLabel: null,
  },
  {
    icon: UserCheck,
    title: "Complétez votre profil",
    description: "Ajoutez photo, compétences, type de tarification et zone d'intervention. Un profil complet reçoit 5x plus de contacts.",
    color: "from-secondary to-secondary/70",
    action: "/profil/modifier",
    actionLabel: "Modifier mon profil",
  },
  {
    icon: Shield,
    title: "Vérifiez votre identité",
    description: "Soumettez votre pièce d'identité pour obtenir le badge « Vérifié ». Les clients font davantage confiance aux profils vérifiés.",
    color: "from-primary to-secondary",
    action: "/verification",
    actionLabel: "Vérifier mon identité",
  },
  {
    icon: MapPin,
    title: "Activez votre position",
    description: "Indiquez votre position sur la carte pour apparaître dans les recherches de proximité. Activez « Se déplace » si vous pouvez aller chez le client.",
    color: "from-secondary to-primary",
    action: "/profil/modifier",
    actionLabel: "Configurer ma position",
  },
  {
    icon: MessageSquare,
    title: "Répondez rapidement",
    description: "Les clients voient votre temps de réponse moyen. Répondez vite pour améliorer votre classement et recevoir plus de demandes.",
    color: "from-primary to-primary/70",
    action: null,
    actionLabel: null,
  },
  {
    icon: FileText,
    title: "Gérez vos missions",
    description: "Suivez l'avancement de chaque mission depuis votre tableau de bord. Confirmez la complétion pour recevoir votre paiement.",
    color: "from-gold to-gold/70",
    action: "/dashboard",
    actionLabel: "Voir mon tableau de bord",
  },
  {
    icon: Wallet,
    title: "Recevez vos paiements",
    description: "Une fois la mission confirmée, les fonds sont versés dans votre portefeuille. Transférez-les vers votre compte Orange Money ou MTN MoMo.",
    color: "from-secondary to-secondary/70",
    action: "/portefeuille",
    actionLabel: "Voir mon portefeuille",
  },
  {
    icon: Bell,
    title: "Activez les notifications",
    description: "Ne manquez aucun message ou demande de mission. Activez les notifications push dans les réglages.",
    color: "from-primary to-secondary",
    action: "/reglages",
    actionLabel: "Ouvrir les réglages",
  },
];

const OnboardingGuide = () => {
  const { user } = useAuth();
  const { data: userRole } = useUserRole();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const isProvider = userRole === "provider" || userRole === "both";
  const isClient = userRole === "client";
  const steps = isProvider ? providerSteps : clientSteps;
  const storageKey = isProvider ? ONBOARDING_PROVIDER_KEY : ONBOARDING_CLIENT_KEY;

  useEffect(() => {
    if (!user || (!isProvider && !isClient)) return;
    const done = localStorage.getItem(storageKey);
    if (!done) {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, isProvider, isClient, storageKey]);

  const close = () => {
    setShow(false);
    localStorage.setItem(storageKey, "true");
  };

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      close();
      navigate(isProvider ? "/dashboard" : "/recherche");
    }
  };

  const goToAction = () => {
    const current = steps[step];
    if (current.action) {
      close();
      navigate(current.action);
    }
  };

  if (!show) return null;

  const current = steps[step];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      >
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="bg-card rounded-3xl border border-border shadow-2xl max-w-sm w-full p-8 relative overflow-hidden"
        >
          <button
            onClick={close}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-br ${current.color} opacity-10 rounded-t-3xl`} />

          <div className="relative text-xs text-muted-foreground mb-4">
            {isProvider ? "Guide prestataire" : "Guide client"} — Étape {step + 1} / {steps.length}
          </div>

          <div className="relative text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.1 }}
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${current.color} flex items-center justify-center mx-auto mb-6 shadow-lg`}
            >
              <current.icon className="w-8 h-8 text-primary-foreground" />
            </motion.div>

            <h2 className="text-xl font-display font-bold text-foreground mb-3">
              {current.title}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              {current.description}
            </p>

            {current.action && current.actionLabel && (
              <Button
                variant="outline"
                size="sm"
                className="mb-4 gap-2 w-full border-primary/30 text-primary hover:bg-primary/10"
                onClick={goToAction}
              >
                <current.icon className="w-4 h-4" />
                {current.actionLabel}
              </Button>
            )}

            <div className="flex items-center justify-center gap-1.5 mb-6">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-primary/50" : "w-1.5 bg-muted"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              {step > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(step - 1)}
                  className="flex-1"
                >
                  Retour
                </Button>
              )}
              <Button
                onClick={next}
                className="flex-1 gap-2"
                size="sm"
              >
                {step === steps.length - 1 ? "C'est parti !" : "Suivant"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {step === 0 && (
              <button onClick={close} className="text-xs text-muted-foreground mt-4 hover:underline">
                Passer l'introduction
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingGuide;
