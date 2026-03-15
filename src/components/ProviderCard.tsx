import { Star, MapPin, Clock, CheckCircle, Zap, Award, Users, Car, Briefcase, Shield, FileText, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useLang } from "./LanguageToggle";

interface ProviderCardProps {
  provider: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
    bio?: string | null;
    city?: string | null;
    quarter?: string | null;
    is_verified?: boolean | null;
    is_premium?: boolean | null;
    reliability_score?: number | null;
    provider_categories?: string[] | null;
    years_of_experience?: number | null;
    availability?: string | null;
    last_seen_at?: string | null;
    avg_response_time_minutes?: number | null;
    badges?: string[] | null;
    can_travel?: boolean | null;
    verification_level?: number | null;
    phone_verified?: boolean | null;
    pricing_type?: string | null;
  };
  index?: number;
  reviewCount?: number;
  distance?: number | null;
  avgRating?: number;
}

const isOnline = (lastSeen: string | null | undefined): boolean => {
  if (!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
};

const ProviderCard = ({ provider: p, index = 0, reviewCount = 0, distance, avgRating }: ProviderCardProps) => {
  const { t } = useLang();
  const score = avgRating !== undefined ? avgRating : (Number(p.reliability_score) || 0);
  const online = isOnline(p.last_seen_at);
  const responseTime = p.avg_response_time_minutes;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/prestataire/${p.id}`} className="block">
        <div className={`bg-card rounded-2xl border p-5 card-hover relative ${p.is_premium ? "border-secondary/50 ring-1 ring-secondary/20" : "border-border"}`}>
          {p.is_premium && (
            <div className="absolute top-0 right-4 px-3 py-1 rounded-b-lg bg-secondary text-secondary-foreground text-[10px] font-bold uppercase tracking-wider">
              Premium
            </div>
          )}

          <div className="flex items-start gap-4 mb-3">
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold text-lg overflow-hidden">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.full_name} className="w-full h-full object-cover" />
                ) : (
                  p.full_name?.slice(0, 2).toUpperCase() || "??"
                )}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-card ${online ? "bg-green-500" : "bg-muted-foreground/30"}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-display font-bold text-foreground truncate text-sm">{p.full_name}</h3>
                {p.is_verified && <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {p.provider_categories?.[0] || t("Prestataire", "Provider")}
              </p>
              {p.city && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {p.city}{p.quarter ? ` · ${p.quarter}` : ""}
                </p>
              )}
            </div>
          </div>

          {/* Status + Badges */}
          <div className="flex flex-wrap gap-1 mb-3">
            {online ? (
              <Badge variant="outline" className="text-[10px] gap-0.5 border-green-500/30 text-green-600 py-0">
                <Zap className="w-2.5 h-2.5" /> <span className="text-green-600 font-semibold">{t("Disponible", "Available")}</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] gap-0.5 border-muted-foreground/20 text-muted-foreground py-0">
                {t("Hors ligne", "Offline")}
              </Badge>
            )}
            {p.can_travel && (
              <Badge variant="outline" className="text-[10px] gap-0.5 border-blue-500/30 text-blue-600 py-0">
                <Car className="w-2.5 h-2.5" /> {t("Se déplace", "Travels")}
              </Badge>
            )}
            {p.pricing_type === "quote" && (
              <Badge variant="outline" className="text-[10px] gap-0.5 border-orange-500/30 text-orange-600 py-0">
                <FileText className="w-2.5 h-2.5" /> {t("Sur devis", "Quote")}
              </Badge>
            )}
            {p.pricing_type === "fixed" && (
              <Badge variant="outline" className="text-[10px] gap-0.5 border-green-500/30 text-green-600 py-0">
                <DollarSign className="w-2.5 h-2.5" /> {t("Tarif fixe", "Fixed price")}
              </Badge>
            )}
            {p.pricing_type === "both" && (
              <Badge variant="outline" className="text-[10px] gap-0.5 border-purple-500/30 text-purple-600 py-0">
                <FileText className="w-2.5 h-2.5" /> {t("Devis & fixe", "Quote & fixed")}
              </Badge>
            )}
            {(p.verification_level ?? 0) >= 2 && (
              <Badge variant="outline" className="text-[10px] gap-0.5 border-primary/30 text-primary py-0">
                <Shield className="w-2.5 h-2.5" /> {t("Identité vérifiée", "ID Verified")}
              </Badge>
            )}
            {(p.badges || []).map(b => (
              <Badge key={b} variant="outline" className="text-[10px] gap-0.5 border-secondary/30 text-secondary py-0">
                <Award className="w-2.5 h-2.5" /> {b}
              </Badge>
            ))}
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              {distance != null && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                </span>
              )}
              {responseTime != null && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> ~{responseTime}min
                </span>
              )}
              {p.years_of_experience != null && p.years_of_experience > 0 && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> {p.years_of_experience} {t("ans", "yrs")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                <Star className="w-3.5 h-3.5 text-gold fill-gold" />
                <span className="font-bold text-foreground">{score.toFixed(1)}</span>
              </span>
              <span className="flex items-center gap-0.5 text-muted-foreground">
                <Users className="w-3 h-3" /> {reviewCount}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProviderCard;
