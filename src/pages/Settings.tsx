import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Globe, Lock, LogOut, Moon, Settings, Shield, Trash2, User } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/components/LanguageToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LoadingScreen from "@/components/LoadingScreen";

const SettingsPage = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { lang, setLang, t } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ full_name: "", phone: "", city: "" });
  const [pushEnabled, setPushEnabled] = useState(localStorage.getItem("notifs-disabled") !== "true");
  const [ringtoneEnabled, setRingtoneEnabled] = useState(localStorage.getItem("call-ringtone-disabled") !== "true");
  const [hideOnlineStatus, setHideOnlineStatus] = useState(localStorage.getItem("privacy-hide-online") === "true");
  const [hideReadReceipts, setHideReadReceipts] = useState(localStorage.getItem("privacy-read-receipts-disabled") === "true");
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains("dark"));

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("full_name, phone, city").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!profile) return;
    setForm({ full_name: profile.full_name || "", phone: profile.phone || "", city: profile.city || "" });
  }, [profile]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [darkMode]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ full_name: form.full_name, phone: form.phone, city: form.city }).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["profile", user?.id] }); toast.success(t("Profil mis à jour", "Profile updated")); },
    onError: (err: any) => toast.error(err.message || t("Erreur de mise à jour", "Update error")),
  });

  const togglePushNotifications = async (enabled: boolean) => {
    setPushEnabled(enabled);
    localStorage.setItem("notifs-disabled", enabled ? "false" : "true");
    if (enabled && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    toast.success(enabled ? t("Notifications activées", "Notifications enabled") : t("Notifications désactivées", "Notifications disabled"));
  };

  const toggleRingtone = (enabled: boolean) => {
    setRingtoneEnabled(enabled);
    localStorage.setItem("call-ringtone-disabled", enabled ? "false" : "true");
    toast.success(enabled ? t("Sonnerie activée", "Ringtone enabled") : t("Sonnerie désactivée", "Ringtone disabled"));
  };

  const toggleHideOnline = async (hidden: boolean) => {
    setHideOnlineStatus(hidden);
    localStorage.setItem("privacy-hide-online", hidden ? "true" : "false");
    if (user) await supabase.from("profiles").update({ last_seen_at: hidden ? new Date(0).toISOString() : new Date().toISOString() }).eq("user_id", user.id);
    toast.success(hidden ? t("Statut en ligne masqué", "Online status hidden") : t("Statut en ligne visible", "Online status visible"));
  };

  const toggleReadReceipts = (hidden: boolean) => {
    setHideReadReceipts(hidden);
    localStorage.setItem("privacy-read-receipts-disabled", hidden ? "true" : "false");
    toast.success(hidden ? t("Accusés de lecture masqués", "Read receipts hidden") : t("Accusés de lecture activés", "Read receipts enabled"));
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!confirm(t("Voulez-vous vraiment supprimer votre compte ? Cette action est irréversible.", "Do you really want to delete your account? This action is irreversible."))) return;
    await supabase.from("profiles").delete().eq("user_id", user.id);
    await supabase.from("user_roles").delete().eq("user_id", user.id);
    await supabase.from("favorites").delete().eq("user_id", user.id);
    await supabase.auth.signOut();
    toast.success(t("Compte supprimé", "Account deleted"));
    navigate("/");
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  if (authLoading || isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <Settings className="w-7 h-7 text-primary" />
              {t("Réglages", "Settings")}
            </h1>
            <p className="text-muted-foreground mt-2">{t("Gérez votre profil, notifications, confidentialité et préférences", "Manage your profile, notifications, privacy and preferences")}</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
                <User className="w-5 h-5 text-primary" /> {t("Profil", "Profile")}
              </h2>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">{t("Nom complet", "Full name")}</Label>
                  <Input id="name" value={form.full_name} onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="phone">{t("Téléphone", "Phone")}</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="city">{t("Ville", "City")}</Label>
                  <Input id="city" value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="hero" onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending}>
                  {t("Enregistrer", "Save")}
                </Button>
                <Link to="/profil/modifier"><Button variant="outline">{t("Édition avancée", "Advanced edit")}</Button></Link>
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" /> {t("Notifications", "Notifications")}
              </h2>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("Notifications popup", "Popup notifications")}</p>
                  <p className="text-xs text-muted-foreground">{t("Afficher un popup pour les nouveaux messages", "Show a popup for new messages")}</p>
                </div>
                <Switch checked={pushEnabled} onCheckedChange={togglePushNotifications} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("Sonnerie des appels", "Call ringtone")}</p>
                  <p className="text-xs text-muted-foreground">{t("Faire sonner le téléphone à l'arrivée d'un appel", "Ring the phone when a call arrives")}</p>
                </div>
                <Switch checked={ringtoneEnabled} onCheckedChange={toggleRingtone} />
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" /> {t("Confidentialité", "Privacy")}
              </h2>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("Masquer mon statut en ligne", "Hide my online status")}</p>
                  <p className="text-xs text-muted-foreground">{t("Les autres utilisateurs ne verront plus \"En ligne\"", "Other users will no longer see \"Online\"")}</p>
                </div>
                <Switch checked={hideOnlineStatus} onCheckedChange={toggleHideOnline} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("Masquer les accusés de lecture", "Hide read receipts")}</p>
                  <p className="text-xs text-muted-foreground">{t("Ne pas envoyer ni afficher l'état \"vu\" dans la messagerie", "Do not send or display \"seen\" status in messaging")}</p>
                </div>
                <Switch checked={hideReadReceipts} onCheckedChange={toggleReadReceipts} />
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" /> {t("Préférences", "Preferences")}
              </h2>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("Langue", "Language")}</p>
                  <p className="text-xs text-muted-foreground">{t("Choisissez la langue de l'application", "Choose the app language")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={lang === "fr" ? "default" : "outline"} size="sm" onClick={() => setLang("fr")}>FR</Button>
                  <Button variant={lang === "en" ? "default" : "outline"} size="sm" onClick={() => setLang("en")}>EN</Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("Thème sombre", "Dark theme")}</p>
                  <p className="text-xs text-muted-foreground">{t("Activer ou désactiver le mode sombre", "Enable or disable dark mode")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-muted-foreground" />
                  <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                </div>
              </div>
            </section>
          </div>

          <section className="mt-6 bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> {t("Vérification d'identité", "Identity verification")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("Renforcez la confiance avec les autres utilisateurs en vérifiant votre identité.", "Build trust with other users by verifying your identity.")}</p>
            <Link to="/verification">
              <Button variant="hero" size="sm" className="gap-2"><Shield className="w-4 h-4" /> {t("Vérifier mon identité", "Verify my identity")}</Button>
            </Link>
          </section>

          <section className="mt-6 bg-card border border-destructive/30 rounded-2xl p-6">
            <h2 className="text-lg font-display font-semibold text-destructive flex items-center gap-2">
              <Shield className="w-5 h-5" /> {t("Zone sensible", "Danger zone")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">{t("Déconnexion et suppression définitive du compte", "Sign out and permanent account deletion")}</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleSignOut}><LogOut className="w-4 h-4 mr-2" /> {t("Se déconnecter", "Sign out")}</Button>
              <Button variant="destructive" onClick={handleDeleteAccount}><Trash2 className="w-4 h-4 mr-2" /> {t("Supprimer le compte", "Delete account")}</Button>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SettingsPage;