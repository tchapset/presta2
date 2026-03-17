import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, TrendingUp, Shield, AlertTriangle, DollarSign, Settings, FolderPlus, Trash2, Award, Crown, Star, BarChart3, FileCheck, CheckCircle, XCircle, Eye, Flag, MessageSquare, Wallet, Clock } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const AVAILABLE_BADGES = ["Top Prestataire", "Élite", "Vérifié", "Réactif", "Expert", "Recommandé"];

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"users" | "missions" | "disputes" | "categories" | "badges" | "settings" | "nps" | "verifications" | "reports" | "support" | "transfers">("users");

  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");
  const [editingCat, setEditingCat] = useState<{ id: string; name: string; description: string; icon: string } | null>(null);

  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });

  const { data: allProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: allMissions } = useQuery({
    queryKey: ["admin-missions"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("missions").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: platformSettings } = useQuery({
    queryKey: ["platform-settings"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*");
      return data || [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return data || [];
    },
  });

  const { data: platformReviews } = useQuery({
    queryKey: ["admin-platform-reviews"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("platform_reviews").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: verificationRequests } = useQuery({
    queryKey: ["admin-verifications"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("verification_requests")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const approveVerification = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      await supabase.from("verification_requests").update({ status: "approved" }).eq("id", id);
      await supabase.from("profiles").update({ is_verified: true, verification_level: 2 } as any).eq("user_id", userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      toast.success("Vérification approuvée");
    },
  });

  const rejectVerification = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      await supabase.from("verification_requests").update({ status: "rejected", rejection_reason: reason || "Rejeté par l'administrateur" }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-verifications"] });
      toast.success("Vérification rejetée");
    },
  });

  const { data: allReports } = useQuery({
    queryKey: ["admin-reports"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("reports" as any).select("*").order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const { data: allTickets } = useQuery({
    queryKey: ["admin-tickets"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("support_tickets" as any).select("*").order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const { data: allTransfers } = useQuery({
    queryKey: ["admin-transfers"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("mobile_money_transfers").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const updateReportStatus = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      await supabase.from("reports" as any).update({ status, admin_note: note || null } as any).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast.success("Signalement mis à jour");
    },
  });

  const updateTicketStatus = useMutation({
    mutationFn: async ({ id, status, reply }: { id: string; status: string; reply?: string }) => {
      await supabase.from("support_tickets" as any).update({ status, admin_reply: reply || null } as any).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      toast.success("Ticket mis à jour");
    },
  });

  const updateTransferStatus = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      // Get transfer details for notification
      const { data: transfer } = await supabase.from("mobile_money_transfers").select("user_id, amount").eq("id", id).single();
      
      await supabase.from("mobile_money_transfers").update({
        status,
        admin_note: note || null,
        processed_at: new Date().toISOString(),
      } as any).eq("id", id);

      // Notify the provider about withdrawal status
      if (transfer) {
        const amount = Number(transfer.amount).toLocaleString();
        const title = status === "completed" ? "Retrait envoyé ✅" : "Retrait échoué ❌";
        const message = status === "completed"
          ? `Votre retrait de ${amount} FCFA a été envoyé avec succès.`
          : `Votre retrait de ${amount} FCFA a échoué. ${note || "Contactez le support."}`;
        
        await supabase.from("notifications").insert({
          user_id: transfer.user_id,
          title,
          message,
          type: "payment",
          link: "/portefeuille",
        });

        // Also send push notification
        const { sendPushToUser } = await import("@/hooks/usePushNotifications");
        sendPushToUser(transfer.user_id, title, message, "/portefeuille");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transfers"] });
      toast.success("Transfert mis à jour et prestataire notifié");
    },
  });

  const npsStats = useMemo(() => {
    if (!platformReviews || platformReviews.length === 0) return null;
    const total = platformReviews.length;
    const promoters = platformReviews.filter(r => r.rating >= 4).length;
    const detractors = platformReviews.filter(r => r.rating <= 2).length;
    const passives = total - promoters - detractors;
    const npsScore = Math.round(((promoters - detractors) / total) * 100);
    const avgRating = platformReviews.reduce((s, r) => s + r.rating, 0) / total;
    const distribution = [1, 2, 3, 4, 5].map(n => ({
      rating: n,
      count: platformReviews.filter(r => r.rating === n).length,
      pct: Math.round((platformReviews.filter(r => r.rating === n).length / total) * 100),
    }));
    return { total, promoters, detractors, passives, npsScore, avgRating, distribution };
  }, [platformReviews]);

  const disputes = allMissions?.filter((m) => m.status === "disputed") || [];
  const totalRevenue = allMissions?.filter((m) => m.status === "completed").reduce((s, m) => s + (m.total_amount || 0) * (m.commission_rate || 10) / 100, 0) || 0;
  const providerCount = allProfiles?.filter((p) => p.is_provider).length || 0;
  const providerProfiles = allProfiles?.filter((p) => p.is_provider) || [];

  const toggleVerify = useMutation({
    mutationFn: async ({ userId, verified }: { userId: string; verified: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_verified: verified }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-profiles"] }); toast.success("Profil mis à jour"); },
  });

  const togglePremium = useMutation({
    mutationFn: async ({ userId, premium }: { userId: string; premium: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_premium: premium }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-profiles"] }); toast.success("Statut premium mis à jour"); },
  });

  const toggleBadge = useMutation({
    mutationFn: async ({ userId, badge, add }: { userId: string; badge: string; add: boolean }) => {
      const profile = allProfiles?.find(p => p.user_id === userId);
      const currentBadges = (profile as any)?.badges || [];
      const newBadges = add ? [...currentBadges, badge] : currentBadges.filter((b: string) => b !== badge);
      const { error } = await supabase.from("profiles").update({ badges: newBadges }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-profiles"] }); toast.success("Badge mis à jour"); },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase.from("platform_settings").update({ value }).eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-settings"] }); toast.success("Paramètre mis à jour"); },
  });

  const resolveMission = useMutation({
    mutationFn: async ({ missionId, status }: { missionId: string; status: Database["public"]["Enums"]["mission_status"] }) => {
      const { error } = await supabase.from("missions").update({ status }).eq("id", missionId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-missions"] }); toast.success("Litige résolu"); },
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      if (!newCatName.trim()) throw new Error("Le nom est requis");
      const { error } = await supabase.from("categories").insert({ name: newCatName.trim(), description: newCatDesc.trim() || null, icon: newCatIcon.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewCatName(""); setNewCatDesc(""); setNewCatIcon("");
      toast.success("Catégorie ajoutée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Catégorie supprimée");
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, name, description, icon }: { id: string; name: string; description: string; icon: string }) => {
      const { error } = await supabase.from("categories").update({ name, description: description || null, icon: icon || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingCat(null);
      toast.success("Catégorie modifiée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (authLoading || roleLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Chargement...</p></div>;
  if (!user || !isAdmin) return <Navigate to="/dashboard" replace />;

  const tabs = [
    { id: "users" as const, label: "Utilisateurs", icon: Users, count: allProfiles?.length },
    { id: "missions" as const, label: "Missions", icon: TrendingUp, count: allMissions?.length },
    { id: "disputes" as const, label: "Litiges", icon: AlertTriangle, count: disputes.length },
    { id: "categories" as const, label: "Catégories", icon: FolderPlus, count: categories?.length },
    { id: "badges" as const, label: "Badges & Premium", icon: Award },
    { id: "verifications" as const, label: "Vérifications", icon: FileCheck, count: verificationRequests?.filter(v => v.status === "pending").length },
    { id: "reports" as const, label: "Signalements", icon: Flag, count: allReports?.filter(r => r.status === "pending").length },
    { id: "transfers" as const, label: "Transferts MoMo", icon: Wallet, count: allTransfers?.filter((t: any) => t.status === "pending").length },
    { id: "support" as const, label: "Support", icon: MessageSquare, count: allTickets?.filter(t => t.status === "open").length },
    { id: "nps" as const, label: "NPS & Avis", icon: BarChart3, count: platformReviews?.length },
    { id: "settings" as const, label: "Paramètres", icon: Settings },
  ];

  const formatAmount = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">Panel Administrateur</h1>
          <p className="text-muted-foreground mb-8">Gestion de la plateforme PRESTA237</p>

          {/* Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Utilisateurs", value: String(allProfiles?.length || 0), icon: Users, color: "bg-primary/10 text-primary" },
              { label: "Prestataires", value: String(providerCount), icon: Shield, color: "bg-secondary/10 text-secondary" },
              { label: "Litiges actifs", value: String(disputes.length), icon: AlertTriangle, color: "bg-destructive/10 text-destructive" },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-card rounded-2xl border border-border p-5">
                <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mb-3`}><s.icon className="w-5 h-5" /></div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-xl font-display font-bold text-foreground">{s.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                <t.icon className="w-4 h-4" />{t.label}{t.count !== undefined && <span className="ml-1 px-2 py-0.5 rounded-full bg-background/20 text-xs">{t.count}</span>}
              </button>
            ))}
          </div>

          {/* Users Tab */}
          {activeTab === "users" && (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Nom</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Ville</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Vérifié</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Actions</th>
                  </tr></thead>
                  <tbody>
                    {allProfiles?.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-foreground">{p.full_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.city || "—"}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_provider ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{p.is_provider ? "Prestataire" : "Client"}</span></td>
                        <td className="px-4 py-3">{p.is_verified ? <Shield className="w-4 h-4 text-primary" /> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant={p.is_verified ? "outline" : "default"} onClick={() => toggleVerify.mutate({ userId: p.user_id, verified: !p.is_verified })}>
                            {p.is_verified ? "Retirer" : "Vérifier"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Missions Tab */}
          {activeTab === "missions" && (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Titre</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Montant</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Statut</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Date</th>
                  </tr></thead>
                  <tbody>
                    {allMissions?.map((m) => (
                      <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-foreground">{m.title}</td>
                        <td className="px-4 py-3 text-foreground">{formatAmount(m.total_amount || 0)}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.status === "completed" ? "bg-primary/10 text-primary" : m.status === "disputed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{m.status}</span></td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(m.created_at!).toLocaleDateString("fr-FR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disputes Tab */}
          {activeTab === "disputes" && (
            <div className="space-y-4">
              {disputes.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-8 text-center"><p className="text-muted-foreground">Aucun litige en cours 🎉</p></div>
              ) : disputes.map((d) => (
                <div key={d.id} className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="font-display font-bold text-foreground mb-2">{d.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{d.description}</p>
                  <p className="text-sm mb-4">Montant : <span className="font-semibold">{formatAmount(d.total_amount || 0)}</span></p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={() => resolveMission.mutate({ missionId: d.id, status: "completed" })}>Résoudre en faveur du prestataire</Button>
                    <Button size="sm" variant="outline" onClick={() => resolveMission.mutate({ missionId: d.id, status: "cancelled" })}>Rembourser le client</Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === "categories" && (
            <div className="space-y-6">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-display font-bold text-foreground mb-4">Ajouter une catégorie</h3>
                <div className="grid sm:grid-cols-3 gap-4 mb-4">
                  <div><Label>Nom *</Label><Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Ex: Plomberie" className="mt-1" /></div>
                  <div><Label>Description</Label><Input value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} placeholder="Description courte" className="mt-1" /></div>
                  <div><Label>Icône (emoji)</Label><Input value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)} placeholder="🔧" className="mt-1" /></div>
                </div>
                <Button onClick={() => addCategory.mutate()} disabled={!newCatName.trim() || addCategory.isPending}>
                  <FolderPlus className="w-4 h-4 mr-2" /> Ajouter
                </Button>
              </div>

              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Icône</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Nom</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Description</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Actions</th>
                  </tr></thead>
                  <tbody>
                    {categories?.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        {editingCat?.id === c.id ? (
                          <>
                            <td className="px-4 py-3"><Input value={editingCat.icon} onChange={(e) => setEditingCat({ ...editingCat, icon: e.target.value })} className="w-16 h-8 text-center" /></td>
                            <td className="px-4 py-3"><Input value={editingCat.name} onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })} className="h-8" /></td>
                            <td className="px-4 py-3"><Input value={editingCat.description} onChange={(e) => setEditingCat({ ...editingCat, description: e.target.value })} className="h-8" /></td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => updateCategory.mutate(editingCat)} disabled={!editingCat.name.trim() || updateCategory.isPending}>
                                  <CheckCircle className="w-3 h-3 mr-1" /> Enregistrer
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingCat(null)}>
                                  <XCircle className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-xl">{c.icon || "📂"}</td>
                            <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{c.description || "—"}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => setEditingCat({ id: c.id, name: c.name, description: c.description || "", icon: c.icon || "" })}>
                                  ✏️ Modifier
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => deleteCategory.mutate(c.id)}>
                                  <Trash2 className="w-3 h-3 mr-1" /> Supprimer
                                </Button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {(!categories || categories.length === 0) && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Aucune catégorie</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Badges & Premium Tab */}
          {activeTab === "badges" && (
            <div className="space-y-6">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-display font-bold text-foreground mb-2">Gestion des badges et abonnements premium</h3>
                <p className="text-sm text-muted-foreground mb-4">Attribuez des badges et le statut premium aux prestataires pour les mettre en avant dans les résultats de recherche.</p>
              </div>

              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Prestataire</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Premium</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Badges</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Actions</th>
                  </tr></thead>
                  <tbody>
                    {providerProfiles.map((p) => {
                      const badges = (p as any).badges || [];
                      return (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gradient-hero flex items-center justify-center text-primary-foreground text-xs font-bold overflow-hidden">
                                {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : p.full_name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{p.full_name}</p>
                                <p className="text-xs text-muted-foreground">{p.city || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant={p.is_premium ? "default" : "outline"} onClick={() => togglePremium.mutate({ userId: p.user_id, premium: !p.is_premium })}>
                              <Crown className="w-3 h-3 mr-1" /> {p.is_premium ? "Premium ✓" : "Activer"}
                            </Button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {badges.map((b: string) => (
                                <span key={b} className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-xs font-medium">{b}</span>
                              ))}
                              {badges.length === 0 && <span className="text-muted-foreground text-xs">Aucun</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {AVAILABLE_BADGES.map(badge => {
                                const has = badges.includes(badge);
                                return (
                                  <button key={badge} onClick={() => toggleBadge.mutate({ userId: p.user_id, badge, add: !has })}
                                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${has ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                                    {has ? "✓ " : ""}{badge}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Verifications Tab */}
          {activeTab === "verifications" && (
            <div className="space-y-6">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-display font-bold text-foreground mb-2">Gestion des demandes de vérification</h3>
                <p className="text-sm text-muted-foreground">Approuvez ou rejetez les demandes de vérification d'identité des utilisateurs.</p>
              </div>
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Utilisateur</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Niveau</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Statut</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Documents</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Actions</th>
                  </tr></thead>
                  <tbody>
                    {verificationRequests?.map((v) => {
                      const userProfile = allProfiles?.find(p => p.user_id === v.user_id);
                      return (
                        <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gradient-hero flex items-center justify-center text-primary-foreground text-xs font-bold overflow-hidden">
                                {userProfile?.avatar_url ? <img src={userProfile.avatar_url} alt="" className="w-full h-full object-cover" /> : (userProfile?.full_name || "??").slice(0, 2).toUpperCase()}
                              </div>
                              <span className="font-medium text-foreground">{userProfile?.full_name || "Inconnu"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">Niveau {v.level}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              v.status === "approved" ? "bg-primary/10 text-primary" :
                              v.status === "rejected" ? "bg-destructive/10 text-destructive" :
                              "bg-secondary/10 text-secondary"
                            }`}>{v.status === "approved" ? "Approuvé" : v.status === "rejected" ? "Rejeté" : "En attente"}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(v.created_at!).toLocaleDateString("fr-FR")}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {v.id_document_url && (
                                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={async () => {
                                  const { data } = await supabase.storage.from("verification-docs").createSignedUrl(v.id_document_url!, 300);
                                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                }}>
                                  <Eye className="w-3 h-3" /> Pièce ID
                                </Button>
                              )}
                              {v.selfie_url && (
                                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={async () => {
                                  const { data } = await supabase.storage.from("verification-docs").createSignedUrl(v.selfie_url!, 300);
                                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                }}>
                                  <Eye className="w-3 h-3" /> Selfie
                                </Button>
                              )}
                              {!v.id_document_url && !v.selfie_url && <span className="text-muted-foreground text-xs">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {v.status === "pending" ? (
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="text-xs gap-1" onClick={() => approveVerification.mutate({ id: v.id, userId: v.user_id })}>
                                  <CheckCircle className="w-3 h-3" /> Approuver
                                </Button>
                                <Button size="sm" variant="destructive" className="text-xs gap-1" onClick={() => rejectVerification.mutate({ id: v.id })}>
                                  <XCircle className="w-3 h-3" /> Rejeter
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">{v.rejection_reason || "—"}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {(!verificationRequests || verificationRequests.length === 0) && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucune demande de vérification</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* NPS & Platform Reviews Tab */}
          {activeTab === "nps" && (
            <div className="space-y-6">
              {npsStats ? (
                <>
                  {/* NPS Score + Key Metrics */}
                  <div className="grid sm:grid-cols-4 gap-4">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-card rounded-2xl border border-border p-6 text-center sm:col-span-1">
                      <p className="text-sm text-muted-foreground mb-1">Score NPS</p>
                      <p className={`text-4xl font-display font-bold ${npsStats.npsScore >= 50 ? "text-primary" : npsStats.npsScore >= 0 ? "text-secondary" : "text-destructive"}`}>
                        {npsStats.npsScore > 0 ? "+" : ""}{npsStats.npsScore}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {npsStats.npsScore >= 50 ? "Excellent 🎉" : npsStats.npsScore >= 0 ? "Correct 👍" : "À améliorer ⚠️"}
                      </p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                      className="bg-card rounded-2xl border border-border p-6 text-center">
                      <p className="text-sm text-muted-foreground mb-1">Note moyenne</p>
                      <p className="text-3xl font-display font-bold text-foreground flex items-center justify-center gap-1">
                        {npsStats.avgRating.toFixed(1)} <Star className="w-6 h-6 text-gold fill-gold" />
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{npsStats.total} avis au total</p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="bg-card rounded-2xl border border-border p-6">
                      <p className="text-sm text-muted-foreground mb-3">Répartition</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-primary font-medium">Promoteurs (4-5★)</span>
                          <span className="font-bold">{npsStats.promoters} ({Math.round(npsStats.promoters / npsStats.total * 100)}%)</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Passifs (3★)</span>
                          <span className="font-bold">{npsStats.passives} ({Math.round(npsStats.passives / npsStats.total * 100)}%)</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-destructive font-medium">Détracteurs (1-2★)</span>
                          <span className="font-bold">{npsStats.detractors} ({Math.round(npsStats.detractors / npsStats.total * 100)}%)</span>
                        </div>
                      </div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                      className="bg-card rounded-2xl border border-border p-6">
                      <p className="text-sm text-muted-foreground mb-3">Distribution des notes</p>
                      <div className="space-y-2">
                        {npsStats.distribution.reverse().map(d => (
                          <div key={d.rating} className="flex items-center gap-2">
                            <span className="text-xs w-6 text-right font-medium">{d.rating}★</span>
                            <Progress value={d.pct} className="h-2 flex-1" />
                            <span className="text-xs w-8 text-muted-foreground">{d.count}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </div>

                  {/* Recent reviews list */}
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-display font-bold text-foreground mb-4">Derniers avis plateforme</h3>
                    <div className="space-y-3">
                      {platformReviews?.slice(0, 20).map(r => (
                        <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                          <div className="flex gap-0.5 shrink-0 mt-0.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "text-gold fill-gold" : "text-muted"}`} />
                            ))}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{r.comment || <span className="text-muted-foreground italic">Pas de commentaire</span>}</p>
                            <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at!).toLocaleDateString("fr-FR")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-card rounded-2xl border border-border p-8 text-center">
                  <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Aucun avis plateforme reçu pour le moment</p>
                </div>
              )}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-display font-bold text-foreground mb-2">Signalements d'utilisateurs</h3>
                <p className="text-sm text-muted-foreground">Gérez les signalements reçus sur les profils.</p>
              </div>
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Signalé par</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Utilisateur signalé</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Motif</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Statut</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Actions</th>
                  </tr></thead>
                  <tbody>
                    {allReports?.map((r: any) => {
                      const reporter = allProfiles?.find(p => p.user_id === r.reporter_id);
                      const reported = allProfiles?.find(p => p.user_id === r.reported_user_id);
                      return (
                        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-foreground">{reporter?.full_name || "Inconnu"}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{reported?.full_name || "Inconnu"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.reason}{r.details && <span className="block text-xs mt-0.5">{r.details}</span>}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              r.status === "resolved" ? "bg-primary/10 text-primary" :
                              r.status === "dismissed" ? "bg-muted text-muted-foreground" :
                              "bg-destructive/10 text-destructive"
                            }`}>{r.status === "pending" ? "En attente" : r.status === "resolved" ? "Résolu" : "Rejeté"}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                          <td className="px-4 py-3">
                            {r.status === "pending" && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="text-xs" onClick={() => updateReportStatus.mutate({ id: r.id, status: "resolved", note: "Action prise" })}>Résoudre</Button>
                                <Button size="sm" variant="outline" className="text-xs" onClick={() => updateReportStatus.mutate({ id: r.id, status: "dismissed" })}>Rejeter</Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {(!allReports || allReports.length === 0) && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucun signalement</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Support Tab */}
          {activeTab === "support" && (
            <div className="space-y-6">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-display font-bold text-foreground mb-2">Tickets de support</h3>
                <p className="text-sm text-muted-foreground">Gérez les demandes de support des utilisateurs.</p>
              </div>
              <div className="space-y-4">
                {allTickets?.map((t: any) => (
                  <div key={t.id} className="bg-card rounded-2xl border border-border p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-display font-bold text-foreground">{t.subject}</h4>
                        <p className="text-xs text-muted-foreground">Par {t.name} ({t.email}) — {new Date(t.created_at).toLocaleDateString("fr-FR")}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.status === "closed" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                      }`}>{t.status === "open" ? "Ouvert" : "Fermé"}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{t.message}</p>
                    {t.admin_reply && (
                      <div className="bg-muted/50 rounded-xl p-3 mb-3">
                        <p className="text-xs font-semibold text-foreground mb-1">Réponse admin :</p>
                        <p className="text-sm text-muted-foreground">{t.admin_reply}</p>
                      </div>
                    )}
                    {t.status === "open" && (
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => updateTicketStatus.mutate({ id: t.id, status: "closed", reply: "Traité par l'équipe support" })}>
                        Marquer comme traité
                      </Button>
                    )}
                  </div>
                ))}
                {(!allTickets || allTickets.length === 0) && (
                  <div className="bg-card rounded-2xl border border-border p-8 text-center">
                    <p className="text-muted-foreground">Aucun ticket de support</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transfers Tab */}
          {activeTab === "transfers" && (
            <div className="space-y-6">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-display font-bold text-foreground mb-2">Transferts Mobile Money</h3>
                <p className="text-sm text-muted-foreground">Gérez les demandes de retrait des prestataires. Marquez comme envoyé après avoir effectué le transfert.</p>
              </div>
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Prestataire</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Montant</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Opérateur</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Téléphone</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Nom</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Statut</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Actions</th>
                  </tr></thead>
                  <tbody>
                    {allTransfers?.map((tr: any) => {
                      const userProfile = allProfiles?.find(p => p.user_id === tr.user_id);
                      return (
                        <tr key={tr.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium text-foreground">{userProfile?.full_name || "Inconnu"}</td>
                          <td className="px-4 py-3 font-bold text-foreground">{Number(tr.amount).toLocaleString()} FCFA</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tr.operator === "orange" ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"}`}>
                              {tr.operator === "orange" ? "Orange" : "MTN"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{tr.phone || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{tr.name_on_account || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              tr.status === "completed" ? "bg-primary/10 text-primary" :
                              tr.status === "failed" ? "bg-destructive/10 text-destructive" :
                              "bg-secondary/10 text-secondary"
                            }`}>
                              {tr.status === "completed" ? "Envoyé ✓" : tr.status === "failed" ? "Échoué" : "En attente"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(tr.created_at).toLocaleDateString("fr-FR")}</td>
                          <td className="px-4 py-3">
                            {tr.status === "pending" && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="text-xs gap-1" onClick={() => updateTransferStatus.mutate({ id: tr.id, status: "completed", note: "Transféré manuellement" })}>
                                  <CheckCircle className="w-3 h-3" /> Envoyé
                                </Button>
                                <Button size="sm" variant="destructive" className="text-xs gap-1" onClick={() => updateTransferStatus.mutate({ id: tr.id, status: "failed", note: "Échec du transfert" })}>
                                  <XCircle className="w-3 h-3" /> Échoué
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {(!allTransfers || allTransfers.length === 0) && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Aucun transfert</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              {platformSettings?.map((s) => (
                <div key={s.id} className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-foreground">{s.key}</p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                  <Input className="w-32" defaultValue={s.value} onBlur={(e) => { if (e.target.value !== s.value) updateSetting.mutate({ key: s.key, value: e.target.value }); }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Admin;
