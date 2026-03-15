import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Shield, User, Wrench, ChevronRight, Upload, X, Plus, MapPin, Car, Phone } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/components/LanguageToggle";
import { quartersByCity } from "@/data/quarters";

const RoleSelection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLang();

  const [step, setStep] = useState<"choose" | "provider-onboarding">("choose");
  const [selectedRole, setSelectedRole] = useState<"client" | "provider" | null>(null);
  const [loading, setLoading] = useState(false);

  const [providerForm, setProviderForm] = useState({
    category: "",
    years_of_experience: "",
    skills: [] as string[],
    bio: "",
    city: "",
    quarter: "",
    phones: [""] as string[],
    can_travel: false,
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [newSkill, setNewSkill] = useState("");
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [locating, setLocating] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["categories-full"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data || [];
    },
  });

  const cameroonCities = ["Douala", "Yaoundé", "Garoua", "Bafoussam", "Bamenda", "Maroua", "Bertoua", "Kribi", "Limbé", "Buéa"];

  const handleChooseRole = async (role: "client" | "provider") => {
    setSelectedRole(role);
    if (role === "provider") {
      setStep("provider-onboarding");
    } else {
      // Client: submit immediately
      if (!user) return;
      setLoading(true);
      try {
        await supabase.from("user_roles").delete().eq("user_id", user.id);
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role: "client" });
        if (roleError) throw roleError;

        await supabase.from("profiles").upsert({
          user_id: user.id,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
          is_provider: false,
          bio: "Client TKLINK",
        }, { onConflict: "user_id" });

        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["userRole"] });
        toast.success(t("Bienvenue !", "Welcome!"));
        navigate("/recherche");
      } catch (err: any) {
        toast.error(err.message || t("Erreur lors de la configuration", "Configuration error"));
      } finally {
        setLoading(false);
      }
    }
  };

  // Auto-detect location when entering provider onboarding
  useEffect(() => {
    if (step === "provider-onboarding") {
      detectLocation();
    }
  }, [step]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t("Géolocalisation non disponible", "Geolocation not available"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProviderForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setLocating(false);
        toast.success(t("Position détectée !", "Location detected!"));
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          toast.error(t("Veuillez autoriser la géolocalisation dans les paramètres de votre navigateur", "Please allow geolocation in your browser settings"));
        } else {
          toast.error(t("Impossible de détecter la position", "Unable to detect position"));
        }
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && !providerForm.skills.includes(s)) {
      setProviderForm((f) => ({ ...f, skills: [...f.skills, s] }));
      setNewSkill("");
    }
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setGalleryFiles((prev) => [...prev, ...files].slice(0, 10));
  };

  const addPhone = () => {
    setProviderForm(f => ({ ...f, phones: [...f.phones, ""] }));
  };

  const updatePhone = (index: number, value: string) => {
    setProviderForm(f => ({
      ...f,
      phones: f.phones.map((p, i) => i === index ? value : p),
    }));
  };

  const removePhone = (index: number) => {
    if (providerForm.phones.length <= 1) return;
    setProviderForm(f => ({ ...f, phones: f.phones.filter((_, i) => i !== index) }));
  };

  const submitRole = async () => {
    if (!user || !selectedRole) return;
    setLoading(true);

    try {
      await supabase.from("user_roles").delete().eq("user_id", user.id);
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role: selectedRole });
      if (roleError) throw roleError;

      if (selectedRole === "provider") {
        const galleryUrls: string[] = [];
        for (const file of galleryFiles) {
          const path = `${user.id}/gallery/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
            galleryUrls.push(publicUrl);
          }
        }

        const phoneStr = providerForm.phones.filter(p => p.trim()).join(", ");
        const yearsExp = providerForm.years_of_experience ? parseInt(providerForm.years_of_experience) : 0;

        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            user_id: user.id,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
            is_provider: true,
            availability: "available",
            provider_categories: providerForm.category ? [providerForm.category] : [],
            years_of_experience: yearsExp,
            skills: providerForm.skills,
            bio: providerForm.bio,
            city: providerForm.city,
            quarter: providerForm.quarter,
            phone: phoneStr,
            can_travel: providerForm.can_travel,
            latitude: providerForm.latitude,
            longitude: providerForm.longitude,
            gallery: galleryUrls,
          }, { onConflict: "user_id" });
        if (profileError) throw profileError;
      } else {
        await supabase.from("profiles").upsert({ user_id: user.id, full_name: user.user_metadata?.full_name || user.user_metadata?.name || "", is_provider: false, bio: "Client TKLINK" }, { onConflict: "user_id" });
      }

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["userRole"] });
      toast.success(selectedRole === "provider" ? t("Profil prestataire créé !", "Provider profile created!") : t("Bienvenue !", "Welcome!"));
      navigate("/recherche");
    } catch (err: any) {
      toast.error(err.message || t("Erreur lors de la configuration", "Configuration error"));
    } finally {
      setLoading(false);
    }
  };

  // Offline detection
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  if (isOffline) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 gap-6">
        <img src="/serviko-logo.png" alt="TKLINK" className="w-32 h-32 object-contain" />
        <h1 className="text-2xl font-display font-bold text-foreground text-center">
          {t("Vous êtes hors ligne", "You are offline")}
        </h1>
        <p className="text-muted-foreground text-center max-w-sm">
          {t("Vérifiez votre connexion internet et réessayez.", "Check your internet connection and try again.")}
        </p>
      </div>
    );
  }

  if (step === "choose") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-2 justify-center mb-8">
            <div className="w-10 h-10 rounded-lg bg-gradient-hero flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-display font-bold text-foreground">
              TK<span className="text-gradient-gold">LINK</span>
            </span>
          </div>

          <div className="bg-card rounded-2xl border border-border p-8">
            <h1 className="text-2xl font-display font-bold text-foreground text-center mb-2">
              {t("Comment souhaitez-vous utiliser TKLINK ?", "How would you like to use TKLINK?")}
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-8">
              {t("Choisissez votre rôle pour commencer.", "Choose your role to get started.")}
            </p>

            <div className="grid gap-4">
              <button
                onClick={() => handleChooseRole("client")}
                className="flex items-center gap-4 p-6 rounded-2xl border-2 border-border hover:border-primary transition-all text-left group"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-lg text-foreground">Client</p>
                  <p className="text-sm text-muted-foreground">{t("Je cherche des prestataires pour mes projets", "I'm looking for providers for my projects")}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={() => handleChooseRole("provider")}
                className="flex items-center gap-4 p-6 rounded-2xl border-2 border-border hover:border-secondary transition-all text-left group"
              >
                <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0 group-hover:bg-secondary/20 transition-colors">
                  <Wrench className="w-7 h-7 text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-lg text-foreground">{t("Prestataire", "Provider")}</p>
                  <p className="text-sm text-muted-foreground">{t("Je propose mes services et expertise", "I offer my services and expertise")}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-secondary transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-10 h-10 rounded-lg bg-gradient-hero flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-display font-bold text-foreground">
            Presta<span className="text-gradient-gold">Link</span>
          </span>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8">
          <h1 className="text-2xl font-display font-bold text-foreground text-center mb-2">
            {t("Configurez votre profil prestataire", "Set up your provider profile")}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            {t("Ces informations vous rendront visible auprès des clients.", "This information will make you visible to clients.")}
          </p>

          <div className="space-y-6">
            {/* Category */}
            <div>
              <Label>{t("Catégorie de service *", "Service category *")}</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground mt-1"
                value={providerForm.category}
                onChange={(e) => setProviderForm({ ...providerForm, category: e.target.value })}
              >
                <option value="">{t("Sélectionner une catégorie", "Select a category")}</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Experience */}
            <div>
              <Label>{t("Années d'expérience", "Years of experience")}</Label>
              <Input
                type="number"
                min={1}
                max={50}
                placeholder={t("Ex: 5", "Ex: 5")}
                value={providerForm.years_of_experience}
                onChange={(e) => setProviderForm({ ...providerForm, years_of_experience: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Skills */}
            <div>
              <Label>{t("Compétences", "Skills")}</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder={t("Ex: Plomberie, Électricité...", "Ex: Plumbing, Electrical...")}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addSkill}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {providerForm.skills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {s}
                    <button onClick={() => setProviderForm((f) => ({ ...f, skills: f.skills.filter((x) => x !== s) }))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <Label>{t("Description de vos services *", "Description of your services *")}</Label>
              <Textarea
                value={providerForm.bio}
                onChange={(e) => setProviderForm({ ...providerForm, bio: e.target.value })}
                placeholder={t("Décrivez votre expertise, vos méthodes de travail...", "Describe your expertise, work methods...")}
                rows={4}
                className="mt-1"
              />
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("Ville *", "City *")}</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground mt-1"
                  value={providerForm.city}
                  onChange={(e) => setProviderForm({ ...providerForm, city: e.target.value })}
                >
                  <option value="">{t("Sélectionner", "Select")}</option>
                  {cameroonCities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label>{t("Quartier *", "Neighborhood *")}</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground mt-1"
                  value={providerForm.quarter}
                  onChange={(e) => setProviderForm({ ...providerForm, quarter: e.target.value })}
                >
                  <option value="">{t("Sélectionner", "Select")}</option>
                  {(quartersByCity[providerForm.city] || []).map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Geolocation */}
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={detectLocation} disabled={locating} className="gap-1.5">
                <MapPin className="w-4 h-4" />
                {locating ? t("Détection...", "Detecting...") : t("Détecter ma position", "Detect my location")}
              </Button>
              {providerForm.latitude && (
                <span className="text-xs text-muted-foreground">
                  ✅ {t("Position enregistrée", "Location saved")}
                </span>
              )}
            </div>

            {/* Can travel */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setProviderForm(f => ({ ...f, can_travel: !f.can_travel }))}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${providerForm.can_travel ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                <Car className="w-4 h-4" />
                <span className="text-sm font-medium">{t("Je peux me déplacer chez le client", "I can travel to the client")}</span>
              </button>
            </div>

            {/* Phone numbers */}
            <div>
              <Label className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                {t("Numéros de téléphone", "Phone numbers")}
              </Label>
              <div className="space-y-2 mt-1">
                {providerForm.phones.map((phone, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={phone}
                      onChange={(e) => updatePhone(i, e.target.value)}
                      placeholder={`+237 6XX XXX XXX`}
                    />
                    {providerForm.phones.length > 1 && (
                      <Button type="button" variant="outline" size="icon" onClick={() => removePhone(i)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={addPhone} className="mt-2 gap-1 text-xs">
                <Plus className="w-3 h-3" /> {t("Ajouter un numéro", "Add a number")}
              </Button>
            </div>

            {/* Gallery */}
            <div>
              <Label>{t("Photos de réalisations (max 10)", "Portfolio photos (max 10)")}</Label>
              <label className="mt-2 flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-sm text-muted-foreground">{t("Cliquer pour ajouter des photos", "Click to add photos")}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
              </label>
              {galleryFiles.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {galleryFiles.map((f, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                      <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setGalleryFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep("choose")}>
                {t("Retour", "Back")}
              </Button>
              <Button
                className="flex-1"
                size="lg"
                onClick={submitRole}
                disabled={loading || !providerForm.category || !providerForm.bio || !providerForm.city}
              >
                {loading ? t("Configuration...", "Setting up...") : t("Valider mon profil", "Confirm my profile")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
