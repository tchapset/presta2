import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { MapPin, Clock, MessageSquare, Plus, X, Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const CATEGORIES = [
  "Plomberie","Électricité","Peinture","Ménage","Déménagement",
  "Couture","Traiteur","Informatique","Photographie","Maçonnerie",
  "Jardinage","Mécanique","Cours","Design","Autre",
];

const MissionWall = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState("");
  const [form, setForm] = useState({ title: "", description: "", budget: "", category: "", city: "", deadline: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["mission-wall", filterCat],
    queryFn: async () => {
      let q = supabase
        .from("mission_wall_posts" as any)
        .select("*, profiles(full_name, city, avatar_url, is_verified)")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (filterCat) q = q.eq("category", filterCat);
      const { data } = await q;
      return (data as any[]) || [];
    },
    staleTime: 30000,
  });

  const createPost = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Connectez-vous pour poster");
      if (!form.title.trim() || !form.description.trim() || !form.category) {
        throw new Error("Titre, description et catégorie sont obligatoires");
      }
      const { error } = await supabase.from("mission_wall_posts" as any).insert({
        client_id: user.id,
        title: form.title.trim(),
        description: form.description.trim(),
        budget: form.budget ? parseInt(form.budget) : null,
        category: form.category,
        city: form.city.trim() || null,
        deadline: form.deadline || null,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mission-wall"] });
      toast.success("Votre besoin a été publié !");
      setShowForm(false);
      setForm({ title: "", description: "", budget: "", category: "", city: "", deadline: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (h < 1) return "À l'instant";
    if (h < 24) return `Il y a ${h}h`;
    return `Il y a ${d}j`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-display font-bold text-foreground">Mur de missions</h1>
                <p className="text-muted-foreground mt-1">Les clients publient leurs besoins, les prestataires proposent leurs services</p>
              </div>
              {user && (
                <Button variant="hero" onClick={() => setShowForm(!showForm)} className="gap-2">
                  {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {showForm ? "Annuler" : "Poster un besoin"}
                </Button>
              )}
            </div>
          </motion.div>

          {/* Post form */}
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border border-border p-6 mb-6 shadow-sm">
              <h3 className="font-display font-bold text-foreground mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" /> Décrivez votre besoin
              </h3>
              <div className="space-y-3">
                <Input placeholder="Titre* (ex: Besoin d'un plombier urgent)" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-11" />
                <textarea placeholder="Description* — Décrivez précisément ce dont vous avez besoin..."
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={4} />
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="h-11 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Catégorie*</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Input placeholder="Ville (optionnel)" value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="h-11" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Budget max (FCFA)" type="number" value={form.budget}
                    onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} className="h-11" />
                  <Input placeholder="Date limite" type="date" value={form.deadline}
                    onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="h-11" />
                </div>
                <Button variant="hero" className="w-full" onClick={() => createPost.mutate()} disabled={createPost.isPending}>
                  {createPost.isPending ? "Publication..." : "Publier mon besoin"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Filter */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
            <button onClick={() => setFilterCat("")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${!filterCat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              Tout
            </button>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setFilterCat(c === filterCat ? "" : c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${filterCat === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {c}
              </button>
            ))}
          </div>

          {/* Posts list */}
          {isLoading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />)}
            </div>
          ) : (posts || []).length === 0 ? (
            <div className="text-center py-16">
              <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground font-medium">Aucune mission publiée{filterCat ? ` en ${filterCat}` : ""}</p>
              {user && <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>Soyez le premier à poster</Button>}
            </div>
          ) : (
            <div className="space-y-4">
              {(posts || []).map((post: any, i: number) => (
                <motion.div key={post.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-2xl border border-border p-5 hover:border-primary/30 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{post.category}</span>
                        {post.city && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3" />{post.city}</span>}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{timeAgo(post.created_at)}</span>
                      </div>
                      <h3 className="font-display font-bold text-foreground text-lg leading-tight">{post.title}</h3>
                    </div>
                    {post.budget && (
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">Budget max</p>
                        <p className="font-bold text-primary">{parseInt(post.budget).toLocaleString("fr-FR")} FCFA</p>
                      </div>
                    )}
                  </div>

                  <p className={`text-sm text-muted-foreground leading-relaxed ${expandedId === post.id ? "" : "line-clamp-2"}`}>
                    {post.description}
                  </p>
                  {post.description.length > 120 && (
                    <button className="text-xs text-primary mt-1 flex items-center gap-0.5"
                      onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}>
                      {expandedId === post.id ? <><ChevronUp className="w-3 h-3" />Réduire</> : <><ChevronDown className="w-3 h-3" />Lire plus</>}
                    </button>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {(post.profiles?.full_name || "?").slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-sm text-muted-foreground">{post.profiles?.full_name || "Client"}</span>
                      {post.profiles?.is_verified && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">✓ Vérifié</span>}
                    </div>
                    {user && user.id !== post.client_id ? (
                      <Button size="sm" variant="hero" className="gap-1.5" onClick={() => navigate(`/nouvelle-mission?client=${post.client_id}&ref=${post.id}`)}>
                        <MessageSquare className="w-3.5 h-3.5" /> Proposer mes services
                      </Button>
                    ) : !user ? (
                      <Link to="/auth">
                        <Button size="sm" variant="outline">Se connecter pour répondre</Button>
                      </Link>
                    ) : null}
                  </div>
                  {post.deadline && (
                    <p className="text-xs text-amber-600 mt-2">⏰ Avant le {new Date(post.deadline).toLocaleDateString("fr-FR")}</p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MissionWall;
