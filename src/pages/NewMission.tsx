import { useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { z } from "zod";
import { AlertTriangle } from "lucide-react";

const missionSchema = z.object({
  title: z.string().trim().min(5, "Titre trop court").max(200),
  description: z.string().trim().min(10, "Description trop courte").max(2000),
});

const cameroonCities = ["Douala", "Yaoundé", "Garoua", "Bafoussam", "Bamenda", "Maroua", "Bertoua", "Kribi", "Limbé", "Buéa"];

const NewMission = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const providerId = searchParams.get("provider");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [city, setCity] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["categories-full"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data || [];
    },
  });

  const { data: provider } = useQuery({
    queryKey: ["provider-name", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, id").eq("user_id", providerId!).single();
      return data;
    },
  });

  // Check if there's an active mission with the same provider
  const { data: activeMission } = useQuery({
    queryKey: ["active-mission-check", user?.id, providerId],
    enabled: !!user && !!providerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("missions")
        .select("id, status, title")
        .eq("client_id", user!.id)
        .eq("provider_id", providerId!)
        .in("status", ["pending", "accepted", "in_progress", "disputed"])
        .limit(1);
      return data && data.length > 0 ? data[0] : null;
    },
  });

  const hasActiveMission = !!activeMission;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (hasActiveMission) {
        throw new Error(`Vous avez déjà une mission en cours avec ce prestataire ("${activeMission!.title}"). Terminez-la ou annulez-la avant d'en créer une nouvelle.`);
      }

      missionSchema.parse({ title, description });

      const { data: mission, error } = await supabase.from("missions").insert({
        client_id: user!.id,
        provider_id: providerId || null,
        title,
        description,
        category_id: categoryId || null,
        city: city || null,
        is_urgent: isUrgent,
        status: "pending",
      }).select().single();
      if (error) throw error;
      return mission;
    },
    onSuccess: (mission) => {
      toast.success("Mission créée avec succès !");
      // Redirect to messages to start conversation
      navigate(`/messages/${mission.id}`);
    },
    onError: (err: any) => {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error(err.message);
      }
    },
  });

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Chargement...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">Nouvelle mission</h1>
          {provider && <p className="text-muted-foreground mb-8">Prestataire : <span className="font-semibold text-foreground">{provider.full_name}</span></p>}

          {/* Warning if active mission exists */}
          {hasActiveMission && (
            <div className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive text-sm">Mission en cours existante</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Vous avez déjà une mission active avec ce prestataire : « {activeMission!.title} ».
                  Veuillez la terminer ou l'annuler avant d'en créer une nouvelle.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => navigate(`/messages/${activeMission!.id}`)}
                >
                  Voir la mission en cours
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <div>
                <Label htmlFor="title">Titre de la mission</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Réparation fuite d'eau" maxLength={200} />
              </div>
              <div>
                <Label htmlFor="desc">Description détaillée</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Décrivez le travail à réaliser..." rows={4} maxLength={2000} />
              </div>
              <div>
                <Label>Catégorie</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Sélectionner une catégorie</option>
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Ville</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">Sélectionner une ville</option>
                  {cameroonCities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} className="rounded" />
                <span className="text-sm font-medium text-foreground">Mission urgente</span>
              </label>
            </div>

            <Button
              className="w-full"
              size="lg"
              variant="hero"
              disabled={createMutation.isPending || !title || !description || hasActiveMission}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Création en cours..." : "Créer la mission"}
            </Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default NewMission;
