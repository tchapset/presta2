import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Share2, Upload, X, Plus, MessageCircle, MapPin, Trash2, CheckCircle } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});
import LoadingScreen from "@/components/LoadingScreen";
import { quartersByCity } from "@/data/quarters";

const cameroonCities = ["Douala", "Yaoundé", "Garoua", "Bafoussam", "Bamenda", "Maroua", "Bertoua", "Kribi", "Limbé", "Buéa"];

const EditProfile = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: userRole } = useUserRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isProvider = userRole === "provider" || userRole === "both";
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [geoLoaded, setGeoLoaded] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("name");
      return data?.map((c) => c.name) || [];
    },
  });

  const [form, setForm] = useState({
    full_name: "",
    bio: "",
    phone: "",
    city: "",
    quarter: "",
    availability: "available",
    provider_categories: [] as string[],
    intervention_zones: [] as string[],
    years_of_experience: 0,
    skills: [] as string[],
    welcome_message: "",
    latitude: null as number | null,
    longitude: null as number | null,
    can_travel: false,
    pricing_type: "fixed" as "fixed" | "quote" | "both",
  });
  const [newZone, setNewZone] = useState("");
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        bio: profile.bio || "",
        phone: profile.phone || "",
        city: profile.city || "",
        quarter: profile.quarter || "",
        availability: profile.availability || "available",
        provider_categories: profile.provider_categories || [],
        intervention_zones: profile.intervention_zones || [],
        years_of_experience: profile.years_of_experience || 0,
        skills: (profile.skills as string[]) || [],
        welcome_message: (profile as any).welcome_message || "",
        latitude: (profile as any).latitude || null,
        longitude: (profile as any).longitude || null,
        can_travel: (profile as any).can_travel || false,
        pricing_type: (profile as any).pricing_type || "fixed",
      });
    }
  }, [profile]);

  // Auto-detect location for providers who don't have one yet
  useEffect(() => {
    if (!isProvider || !profile || geoLoaded) return;
    if (!(profile as any).latitude && !(profile as any).longitude) {
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
          setGeoLoaded(true);
          if (mapInstanceRef.current && markerRef.current) {
            mapInstanceRef.current.flyTo([pos.coords.latitude, pos.coords.longitude], 15);
            markerRef.current.setLatLng([pos.coords.latitude, pos.coords.longitude]);
          }
        },
        () => setGeoLoaded(true),
        { enableHighAccuracy: true }
      );
    } else {
      setGeoLoaded(true);
    }
  }, [isProvider, profile, geoLoaded]);

  // Location picker map for providers - use callback ref for reliable init
  const initMap = useCallback((node: HTMLDivElement | null) => {
    if (!node || !isProvider) return;
    // Clean up previous instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const lat = form.latitude || 4.0511;
    const lng = form.longitude || 9.7679;
    const map = L.map(node).setView([lat, lng], form.latitude ? 15 : 10);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    // Fix: invalidate size after mount to ensure tiles render
    setTimeout(() => map.invalidateSize(), 200);

    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    markerRef.current = marker;

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      setForm(f => ({ ...f, latitude: pos.lat, longitude: pos.lng }));
    });

    map.on("click", (e: any) => {
      marker.setLatLng(e.latlng);
      setForm(f => ({ ...f, latitude: e.latlng.lat, longitude: e.latlng.lng }));
    });
  }, [isProvider, profile]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const useCurrentLocation = () => {
    toast.info("Récupération de votre position...");
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // Forcer la mise à jour du formulaire avec la position GPS actuelle
        // en ignorant tout déplacement manuel précédent
        setForm(f => ({ ...f, latitude: lat, longitude: lng }));
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 17);
          markerRef.current.setLatLng([lat, lng]);
        }
        toast.success(`Position mise à jour (précision: ~${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        if (err.code === 1) {
          toast.error("Accès à la localisation refusé. Vérifiez les permissions de votre navigateur.");
        } else if (err.code === 2) {
          toast.error("Position introuvable. Vérifiez que le GPS est activé.");
        } else {
          toast.error("Délai dépassé. Réessayez.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const updateData: any = {
        full_name: form.full_name,
        bio: form.bio,
        phone: form.phone,
        city: form.city,
        quarter: form.quarter,
      };
      if (isProvider) {
        updateData.availability = form.availability;
        updateData.provider_categories = form.provider_categories;
        updateData.intervention_zones = form.intervention_zones;
        updateData.years_of_experience = form.years_of_experience;
        updateData.skills = form.skills;
        updateData.welcome_message = form.welcome_message;
        updateData.latitude = form.latitude;
        updateData.longitude = form.longitude;
        updateData.can_travel = form.can_travel;
        updateData.pricing_type = form.pricing_type;
      }
      const { error } = await supabase.from("profiles").update(updateData).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profil mis à jour avec succès !");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleDeleteAccount = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.")) return;
    await supabase.from("profiles").delete().eq("user_id", user!.id);
    await supabase.from("user_roles").delete().eq("user_id", user!.id);
    await supabase.from("favorites").delete().eq("user_id", user!.id);
    await supabase.auth.signOut();
    toast.success("Compte supprimé");
    navigate("/");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const path = `${user.id}/avatar.${file.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) return toast.error("Erreur upload");
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Photo de profil mise à jour");
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!user || files.length === 0) return;
    const currentGallery = profile?.gallery || [];
    if (currentGallery.length >= 6) {
      toast.error("Maximum 6 photos atteint");
      return;
    }
    const remaining = 6 - currentGallery.length;
    const filesToUpload = files.slice(0, remaining);
    toast.loading(`Chargement de ${filesToUpload.length} photo${filesToUpload.length > 1 ? "s" : ""}...`, { id: "gallery-upload" });
    const newUrls: string[] = [];
    for (const file of filesToUpload) {
      const path = `${user.id}/gallery/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
        newUrls.push(publicUrl);
      }
    }
    const gallery = [...currentGallery, ...newUrls].slice(0, 6);
    await supabase.from("profiles").update({ gallery }).eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success(`${newUrls.length} photo${newUrls.length > 1 ? "s" : ""} ajoutée${newUrls.length > 1 ? "s" : ""}`, { id: "gallery-upload" });
  };

  const toggleCategory = (cat: string) => {
    setForm((f) => ({
      ...f,
      provider_categories: f.provider_categories.includes(cat)
        ? f.provider_categories.filter((c) => c !== cat)
        : [...f.provider_categories, cat],
    }));
  };

  const addZone = () => {
    if (newZone.trim() && !form.intervention_zones.includes(newZone.trim())) {
      setForm((f) => ({ ...f, intervention_zones: [...f.intervention_zones, newZone.trim()] }));
      setNewZone("");
    }
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && !form.skills.includes(s)) {
      setForm((f) => ({ ...f, skills: [...f.skills, s] }));
      setNewSkill("");
    }
  };

  if (authLoading || isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <h1 className="text-3xl font-display font-bold text-foreground mb-8">Modifier mon profil</h1>

          <div className="space-y-6">
            {/* Avatar */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <Label>Photo de profil</Label>
              <div className="flex items-center gap-4 mt-2">
                <div className="w-16 h-16 rounded-xl bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold overflow-hidden">
                  {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : form.full_name.slice(0, 2).toUpperCase()}
                </div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80 transition-colors">
                    <Upload className="w-4 h-4" />Changer la photo
                  </span>
                </label>
              </div>
            </div>

            {/* Basic Info */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <div>
                <Label htmlFor="name">Nom complet</Label>
                <Input id="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="bio">{isProvider ? "Description de vos services" : "Bio"}</Label>
                <Textarea id="bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder={isProvider ? "Décrivez votre expertise..." : "Parlez de vous..."} rows={3} />
              </div>
              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+237 6XX XXX XXX" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ville</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
                    <option value="">Sélectionner</option>
                    {cameroonCities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Quartier</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.quarter} onChange={(e) => setForm({ ...form, quarter: e.target.value })}>
                    <option value="">Sélectionner</option>
                    {(quartersByCity[form.city] || []).map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Provider-only sections */}
            {isProvider && (
              <>
                {/* Location picker */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <Label className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Ma position sur la carte
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">Touchez un point sur la carte pour indiquer votre position. Votre position actuelle est utilisée par défaut.</p>
                  <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation} className="mb-3 gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Utiliser ma position actuelle
                  </Button>
                  <div ref={initMap} className="h-[250px] rounded-xl overflow-hidden border border-border" />
                  {form.latitude && form.longitude && (
                    <p className="text-xs text-muted-foreground mt-2">📍 {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}</p>
                  )}
                </div>

                {/* Can travel toggle */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Je peux me déplacer</Label>
                      <p className="text-xs text-muted-foreground mt-1">Indiquez si vous pouvez vous rendre chez le client</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, can_travel: !f.can_travel }))}
                      className={`relative w-12 h-6 rounded-full transition-colors ${form.can_travel ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.can_travel ? "translate-x-6" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Welcome message */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <Label htmlFor="welcome" className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-primary" />
                    Message de bienvenue automatique
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">Ce message sera envoyé automatiquement lorsqu'un client vous contacte pour la première fois.</p>
                  <Textarea
                    id="welcome"
                    value={form.welcome_message}
                    onChange={(e) => setForm({ ...form, welcome_message: e.target.value })}
                    placeholder="Ex: Bonjour ! Merci de m'avoir contacté. Comment puis-je vous aider ?"
                    rows={3}
                  />
                </div>

                {/* Experience */}
                <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
                  <div>
                    <Label>Années d'expérience</Label>
                    <Input type="number" min={0} max={50} value={form.years_of_experience} onChange={(e) => setForm({ ...form, years_of_experience: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>Disponibilité</Label>
                    <div className="flex gap-2 mt-1">
                      {["available", "busy", "unavailable"].map((a) => (
                        <button key={a} type="button" onClick={() => setForm({ ...form, availability: a })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${form.availability === a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {a === "available" ? "Disponible" : a === "busy" ? "Occupé" : "Indisponible"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Type de tarification</Label>
                    <p className="text-xs text-muted-foreground mb-2">Comment facturez-vous vos services ?</p>
                    <div className="flex gap-2 mt-1">
                      {([
                        { value: "fixed", label: "Tarif fixe" },
                        { value: "quote", label: "Sur devis" },
                        { value: "both", label: "Les deux" },
                      ] as const).map((opt) => (
                        <button key={opt.value} type="button" onClick={() => setForm({ ...form, pricing_type: opt.value })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${form.pricing_type === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Skills */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <Label>Compétences</Label>
                  <div className="flex gap-2 mt-2">
                    <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Ajouter une compétence" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} />
                    <Button type="button" variant="outline" size="icon" onClick={addSkill}><Plus className="w-4 h-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {form.skills.map((s) => (
                      <span key={s} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                        {s}
                        <button onClick={() => setForm((f) => ({ ...f, skills: f.skills.filter((x) => x !== s) }))}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Categories */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <Label>Catégories de services</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {categories?.map((c) => (
                      <button key={c} type="button" onClick={() => toggleCategory(c)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${form.provider_categories.includes(c) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zones */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <Label>Zones d'intervention</Label>
                  <div className="flex gap-2 mt-2">
                    <Input value={newZone} onChange={(e) => setNewZone(e.target.value)} placeholder="Ajouter une zone" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addZone())} />
                    <Button type="button" variant="outline" onClick={addZone}>Ajouter</Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {form.intervention_zones.map((z) => (
                      <span key={z} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-sm">
                        {z}
                        <button onClick={() => setForm((f) => ({ ...f, intervention_zones: f.intervention_zones.filter((x) => x !== z) }))}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Gallery */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Photos de réalisations</Label>
                    <span className="text-xs text-muted-foreground">{profile?.gallery?.length || 0}/6 photos</span>
                  </div>
                  {(profile?.gallery?.length || 0) < 6 && (
                    <label className="mt-2 flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                      <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                      <span className="text-sm text-muted-foreground">Ajouter des photos (max 6)</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
                    </label>
                  )}
                  {profile?.gallery && profile.gallery.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {profile.gallery.map((url, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-green-400 shadow-sm group">
                          <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              const newGallery = profile.gallery!.filter((_, j) => j !== i);
                              await supabase.from("profiles").update({ gallery: newGallery }).eq("user_id", user!.id);
                              queryClient.invalidateQueries({ queryKey: ["profile"] });
                              toast.success("Photo supprimée");
                            }}
                            className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Supprimer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {isProvider && (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  const slug = (form.full_name || "").toLowerCase().trim()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                  const shareUrl = `https://presta237.com/p/${slug}`;
                  if (navigator.share) {
                    navigator.share({ title: `Mon profil sur PRESTA237`, text: `Découvrez mon profil sur PRESTA237`, url: shareUrl }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(shareUrl);
                    import("sonner").then(({ toast }) => toast.success("Lien copié : " + shareUrl));
                  }
                }}
              >
                <Share2 className="w-4 h-4" /> Partager mon profil
              </Button>
            )}
            <Button className="w-full" size="lg" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />{updateMutation.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>

            {/* Delete account */}
            <div className="bg-destructive/5 rounded-2xl border border-destructive/20 p-6">
              <h3 className="font-display font-bold text-destructive mb-2">Zone dangereuse</h3>
              <p className="text-sm text-muted-foreground mb-4">La suppression de votre compte est irréversible. Toutes vos données seront perdues.</p>
              <Button variant="destructive" size="sm" onClick={handleDeleteAccount} className="gap-1.5">
                <Trash2 className="w-4 h-4" /> Supprimer mon compte
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default EditProfile;
