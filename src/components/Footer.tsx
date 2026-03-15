import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { useLang } from "./LanguageToggle";
import { motion } from "framer-motion";

const Footer = () => {
  const { t } = useLang();

  return (
    <footer className="bg-[hsl(160,30%,10%)] text-[hsl(40,20%,96%)]">
      {/* CTA Band */}
      <div className="border-b border-white/10">
        <div className="container mx-auto px-4 py-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl md:text-3xl font-display font-bold mb-3">
              {t("Prêt à trouver le bon prestataire ?", "Ready to find the right provider?")}
            </h3>
            <p className="text-sm opacity-70 mb-6 max-w-md mx-auto">
              {t(
                "Rejoignez des milliers d'utilisateurs qui font confiance à TKLINK au Cameroun.",
                "Join thousands of users who trust TKLINK in Cameroon."
              )}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                to="/recherche"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                {t("Trouver un prestataire", "Find a provider")}
              </Link>
              <Link
                to="/auth?mode=signup"
                className="px-6 py-3 rounded-xl border border-white/20 text-sm font-semibold hover:bg-white/5 transition-colors"
              >
                {t("Devenir prestataire", "Become a provider")}
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-10 mb-10">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src="/serviko-logo.png" alt="TKLINK" className="w-9 h-9 rounded-lg" />
              <span className="text-xl font-display font-bold">TKLINK</span>
            </Link>
            <p className="text-sm opacity-70 leading-relaxed">
              {t(
                "La plateforme de mise en relation de confiance pour les services locaux au Cameroun.",
                "The trusted connection platform for local services in Cameroon."
              )}
            </p>
          </div>

          <div>
            <h4 className="font-display font-bold mb-4">{t("Plateforme", "Platform")}</h4>
            <ul className="space-y-2.5 text-sm opacity-70">
              <li><Link to="/recherche" className="hover:opacity-100 transition-opacity">{t("Trouver un prestataire", "Find a provider")}</Link></li>
              <li><Link to="/auth?mode=signup" className="hover:opacity-100 transition-opacity">{t("Devenir prestataire", "Become a provider")}</Link></li>
              <li><Link to="/" className="hover:opacity-100 transition-opacity">{t("Comment ça marche", "How it works")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold mb-4">{t("Confiance", "Trust")}</h4>
            <ul className="space-y-2.5 text-sm opacity-70">
              <li><Link to="/" className="hover:opacity-100 transition-opacity">{t("Prestataires vérifiés", "Verified providers")}</Link></li>
              <li><Link to="/" className="hover:opacity-100 transition-opacity">{t("Avis authentiques", "Authentic reviews")}</Link></li>
              <li><Link to="/" className="hover:opacity-100 transition-opacity">{t("Suivi de mission", "Mission tracking")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold mb-4">Support</h4>
            <ul className="space-y-2.5 text-sm opacity-70">
              <li><Link to="/faq" className="hover:opacity-100 transition-opacity">{t("Centre d'aide", "Help Center")}</Link></li>
              <li><Link to="/faq" className="hover:opacity-100 transition-opacity">Contact</Link></li>
              <li><Link to="/" className="hover:opacity-100 transition-opacity">{t("Conditions d'utilisation", "Terms of Service")}</Link></li>
              <li><Link to="/" className="hover:opacity-100 transition-opacity">{t("Politique de confidentialité", "Privacy Policy")}</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm opacity-50">
          <span>© 2026 TKLINK. {t("Tous droits réservés.", "All rights reserved.")}</span>
          <span className="flex items-center gap-1">
            {t("Fait avec", "Made with")} <Heart className="w-3.5 h-3.5 fill-current text-destructive" /> {t("au Cameroun", "in Cameroon")} 🇨🇲
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
