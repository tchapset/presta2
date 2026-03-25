import { useState, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sendPushToUser } from "@/hooks/usePushNotifications";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ReviewModal from "@/components/ReviewModal";
import PlatformReviewModal from "@/components/PlatformReviewModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, CheckCircle, XCircle, Clock, MessageSquare, AlertTriangle, Star, Ban, MapPin, Briefcase, Users, FileText, CreditCard, Lock, Unlock, Timer } from "lucide-react";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import type { Database } from "@/integrations/supabase/types";
import mtnLogo from "@/assets/mtn-logo.png";
import orangeLogo from "@/assets/orange-logo.png";

type MissionStatus = Database["public"]["Enums"]["mission_status"];

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "En attente", icon: Clock, color: "text-muted-foreground" },
  accepted: { label: "Accepté", icon: CheckCircle, color: "text-secondary" },
  in_progress: { label: "En cours", icon: Clock, color: "text-primary" },
  completed: { label: "Terminé", icon: CheckCircle, color: "text-primary" },
  disputed: { label: "Litige", icon: AlertTriangle, color: "text-destructive" },
  cancelled: { label: "Annulé", icon: XCircle, color: "text-muted-foreground" },
};

const getCompletionPercentage = (mission: any, escrow: any): number => {
  if (!escrow || escrow.status === "pending" || escrow.status === "failed") {
    switch (mission.status) {
      case "pending": return 0;
      case "accepted": return 25;
      default: return 0;
    }
  }
  switch (escrow.status) {
    case "held": return 50;
    case "provider_completed": return 75;
    case "released": return 100;
    case "disputed": return 60;
    case "refunded": return 100;
    default: return 50;
  }
};

const MissionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [showPlatformReview, setShowPlatformReview] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showPayMethodDialog, setShowPayMethodDialog] = useState(false);
  const [showCashWarningDialog, setShowCashWarningDialog] = useState(false);
  const [showCashConfirmDialog, setShowCashConfirmDialog] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [cashPaying, setCashPaying] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [showInvoiceDescDialog, setShowInvoiceDescDialog] = useState(false);
  const [invoiceDesc, setInvoiceDesc] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payPhone, setPayPhone] = useState("");
  const [payOperator, setPayOperator] = useState<"orange" | "mtn" | "">("");
  const [disputeReason, setDisputeReason] = useState("");
  const [paying, setPaying] = useState(false);

  const { data: mission, isLoading } = useQuery({
    queryKey: ["mission", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("missions").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: escrow, refetch: refetchEscrow } = useQuery({
    queryKey: ["escrow", id],
    enabled: !!id,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase
        .from("escrow_payments" as any)
        .select("*")
        .eq("mission_id", id!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: unreadCount } = useQuery({
    queryKey: ["unread-messages", id, user?.id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("mission_id", id!)
        .eq("is_read", false)
        .neq("sender_id", user!.id);
      return count || 0;
    },
    refetchInterval: 10000,
  });

  const { data: clientProfile } = useQuery({
    queryKey: ["profile-client", mission?.client_id],
    enabled: !!mission,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", mission!.client_id).single();
      return data;
    },
  });

  const { data: providerProfile } = useQuery({
    queryKey: ["profile-provider", mission?.provider_id],
    enabled: !!mission?.provider_id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, avatar_url, city, quarter, years_of_experience, avg_response_time_minutes, reliability_score, can_travel, is_verified, badges").eq("user_id", mission!.provider_id!).single();
      return data;
    },
  });

  const { data: providerReviewStats } = useQuery({
    queryKey: ["provider-review-stats", mission?.provider_id],
    enabled: !!mission?.provider_id,
    queryFn: async () => {
      const [{ data: reviews }, { count: missionsCount }] = await Promise.all([
        supabase.from("reviews").select("rating").eq("reviewed_id", mission!.provider_id!),
        supabase.from("missions").select("*", { count: "exact", head: true }).eq("provider_id", mission!.provider_id!).eq("status", "completed"),
      ]);
      const avg = reviews && reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
      return { count: reviews?.length || 0, avg, missionsCompleted: missionsCount || 0 };
    },
  });

  const { data: existingReview } = useQuery({
    queryKey: ["review-exists", id, user?.id],
    enabled: !!mission && !!user,
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("id").eq("mission_id", id!).eq("reviewer_id", user!.id).maybeSingle();
      return !!data;
    },
  });

  const { data: existingPlatformReview } = useQuery({
    queryKey: ["platform-review-exists", id, user?.id],
    enabled: !!mission && !!user,
    queryFn: async () => {
      const { data } = await supabase.from("platform_reviews" as any).select("id").eq("mission_id", id!).eq("user_id", user!.id).maybeSingle();
      return !!(data as any);
    },
  });

  useEffect(() => {
    if (mission?.status === "completed" && existingPlatformReview === false && user) {
      const dismissKey = `platform-review-dismissed-${id}`;
      if (!sessionStorage.getItem(dismissKey)) {
        const timer = setTimeout(() => setShowPlatformReview(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [mission?.status, existingPlatformReview, user, id]);

  const notifyOtherUser = async (title: string, message: string) => {
    if (!mission || !user) return;
    const recipientId = user.id === mission.client_id ? mission.provider_id : mission.client_id;
    if (!recipientId) return;
    await supabase.from("notifications").insert({
      user_id: recipientId, title, message, type: "mission", link: `/mission/${id}`,
    });
    sendPushToUser(recipientId, title, message, `/mission/${id}`);
  };

  const updateStatus = useMutation({
    mutationFn: async (status: MissionStatus) => {
      const updateData: any = { status };
      if (status === "completed") updateData.completed_at = new Date().toISOString();
      const { error } = await supabase.from("missions").update(updateData).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["mission", id] });
      toast.success("Statut mis à jour");
      const labels: Record<string, string> = { accepted: "Mission acceptée", in_progress: "Travaux démarrés", completed: "Mission terminée", cancelled: "Mission annulée", disputed: "Litige signalé" };
      notifyOtherUser(labels[status] || "Mise à jour", `La mission "${mission?.title}" : ${labels[status] || status}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- ESCROW PAYMENT ---
  const handlePayment = async () => {
    if (!payAmount || !payPhone || !id) return;
    const amount = parseInt(payAmount);
    if (isNaN(amount) || amount < 100) {
      toast.error("Montant minimum : 100 FCFA");
      return;
    }
    // Validate phone format (237...)
    const phone = payPhone.replace(/\s/g, "");
    if (!/^237\d{9}$/.test(phone)) {
      toast.error("Numéro invalide. Format : 237XXXXXXXXX");
      return;
    }

    setPaying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/freemopay-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ mission_id: id, amount, payer_phone: phone, operator: payOperator }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de paiement");

      toast.success(data.message || "Paiement initié ! Validez sur votre téléphone.");
      setShowPayDialog(false);
      setPayAmount("");
      setPayPhone("");
      setPayOperator("");
      refetchEscrow();
      queryClient.invalidateQueries({ queryKey: ["mission", id] });
    } catch (err: any) {
      toast.error(err.message || "Erreur de paiement");
    } finally {
      setPaying(false);
    }
  };

  // --- CASH PAYMENT ---
  const handleCashPayment = async () => {
    if (!cashAmount || !id || !mission) return;
    const amount = parseInt(cashAmount);
    if (isNaN(amount) || amount < 100) {
      toast.error("Montant invalide (minimum 100 FCFA)");
      return;
    }
    setCashPaying(true);
    try {
      const serviceClient = supabase;
      // Record cash payment as a mission note and update status
      await serviceClient.from("missions").update({
        status: "in_progress",
        total_amount: amount,
        deposit_amount: amount,
      }).eq("id", id);

      // Insert notification for both parties
      const notifications: any[] = [
        {
          user_id: mission.client_id,
          title: "Paiement cash enregistré",
          message: `Vous avez déclaré avoir payé ${amount.toLocaleString("fr-FR")} FCFA en cash pour "${mission.title}".`,
          type: "payment",
          link: `/mission/${id}`,
        },
      ];
      if (mission.provider_id) {
        notifications.push({
          user_id: mission.provider_id,
          title: "Paiement cash reçu",
          message: `Le client a déclaré vous avoir payé ${amount.toLocaleString("fr-FR")} FCFA en cash pour "${mission.title}".`,
          type: "payment",
          link: `/mission/${id}`,
        });
      }
      await serviceClient.from("notifications").insert(notifications);

      toast.success("Paiement cash enregistré. La mission est maintenant en cours.");
      setShowCashConfirmDialog(false);
      setCashAmount("");
      queryClient.invalidateQueries({ queryKey: ["mission", id] });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement du paiement cash");
    } finally {
      setCashPaying(false);
    }
  };

  // --- ESCROW ACTIONS ---
  const escrowAction = async (action: string, extra?: any) => {
    if (!escrow?.id) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/escrow-release`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ escrow_id: escrow.id, action, ...extra }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(action === "provider_complete" ? "Marqué comme terminé" : action === "client_confirm" ? "Paiement libéré !" : "Action effectuée");
      refetchEscrow();
      queryClient.invalidateQueries({ queryKey: ["mission", id] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const saveInvoiceDescription = async (desc: string) => {
    await supabase.from("missions").update({ invoice_description: desc } as any).eq("id", id!);
    queryClient.invalidateQueries({ queryKey: ["mission", id] });
    toast.success("Description de facture enregistrée");
    setShowInvoiceDescDialog(false);
  };

  const generateInvoicePDF = () => {
    if (!mission || mission.status !== "completed") return;
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString("fr-FR");
    const invoiceNum = `FAC-${mission.id.substring(0, 8).toUpperCase()}`;
    doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.text("FACTURE", 20, 25);
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text(`N° ${invoiceNum}`, 20, 33); doc.text(`Date : ${now}`, 20, 39);
    doc.setFontSize(14); doc.setTextColor(26, 122, 76); doc.setFont("helvetica", "bold");
    doc.text("PRESTA237", 150, 25);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text("Marketplace de services", 150, 31); doc.text("Cameroun", 150, 36);
    doc.setDrawColor(200); doc.setLineWidth(0.5); doc.line(20, 45, 190, 45);
    doc.setTextColor(0); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("Client :", 20, 55); doc.setFont("helvetica", "normal");
    doc.text(clientProfile?.full_name || "—", 20, 62);
    doc.setFont("helvetica", "bold"); doc.text("Prestataire :", 120, 55);
    doc.setFont("helvetica", "normal"); doc.text(providerProfile?.full_name || "—", 120, 62);
    if (mission.city) doc.text(mission.city, 120, 68);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("Détails de la prestation", 20, 82);
    const tableTop = 90;
    doc.setFillColor(245, 245, 245); doc.rect(20, tableTop - 5, 170, 10, "F");
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("Description", 25, tableTop + 1); doc.text("Montant", 165, tableTop + 1, { align: "right" });
    doc.setFont("helvetica", "normal");
    let y = tableTop + 12;
    // Use provider's custom invoice description if available
    const invoiceDescription = (mission as any).invoice_description || mission.description || mission.title;
    doc.text(invoiceDescription, 25, y, { maxWidth: 120 });
    doc.text(mission.total_amount ? `${mission.total_amount.toLocaleString("fr-FR")} FCFA` : "—", 165, y, { align: "right" });
    y += 10; doc.setDrawColor(200); doc.line(20, y, 190, y); y += 10;
    const commission = (mission.total_amount || 0) * (mission.commission_rate || 10) / 100;
    doc.text("Commission PRESTA237 :", 110, y);
    doc.text(`${commission.toLocaleString("fr-FR")} FCFA`, 165, y, { align: "right" }); y += 8;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("Total TTC :", 110, y);
    doc.text(`${(mission.total_amount || 0).toLocaleString("fr-FR")} FCFA`, 165, y, { align: "right" });
    y += 15; doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100);
    doc.text(`Mission créée le : ${new Date(mission.created_at || "").toLocaleDateString("fr-FR")}`, 20, y);
    if (mission.completed_at) doc.text(`Terminée le : ${new Date(mission.completed_at).toLocaleDateString("fr-FR")}`, 20, y + 5);
    doc.setFontSize(7);
    doc.text("Ce document a été généré automatiquement par PRESTA237.", 20, 275);
    doc.text(`Facture ${invoiceNum} — Générée le ${now}`, 20, 280);
    doc.save(`facture-${invoiceNum}.pdf`);
    toast.success("Facture téléchargée !");
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Chargement...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isLoading) return <div className="min-h-screen bg-background"><Navbar /><div className="pt-24 text-center text-muted-foreground">Chargement...</div></div>;
  if (!mission) return <div className="min-h-screen bg-background"><Navbar /><div className="pt-24 text-center"><p className="text-muted-foreground">Mission introuvable</p></div></div>;

  const isClient = user.id === mission.client_id;
  const isProvider = user.id === mission.provider_id;
  const status = statusConfig[mission.status || "pending"];
  const StatusIcon = status.icon;
  const formatAmount = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
  const completionPct = getCompletionPercentage(mission, escrow);

  const canReview = mission.status === "completed" && !existingReview;
  const reviewedId = isClient ? mission.provider_id : mission.client_id;

  const escrowStatus = escrow?.status;
  const hasEscrow = escrow && !["failed"].includes(escrowStatus);
  const escrowHeld = escrowStatus === "held";
  const escrowProviderDone = escrowStatus === "provider_completed";
  const escrowReleased = escrowStatus === "released";
  const escrowDisputed = escrowStatus === "disputed";
  const escrowPending = escrowStatus === "pending";

  // Auto-release countdown
  const autoReleaseAt = escrow?.auto_release_at ? new Date(escrow.auto_release_at) : null;
  const hoursLeft = autoReleaseAt ? Math.max(0, Math.round((autoReleaseAt.getTime() - Date.now()) / (1000 * 60 * 60))) : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-6">
              <StatusIcon className={`w-6 h-6 ${status.color}`} />
              <span className={`text-sm font-semibold ${status.color}`}>{status.label}</span>
            </div>

            <h1 className="text-3xl font-display font-bold text-foreground mb-2">{mission.title}</h1>
            <p className="text-muted-foreground mb-6">{mission.description}</p>

            {/* Completion progress */}
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-bold text-foreground text-sm">Progression</h3>
                <span className="text-sm font-bold text-primary">{completionPct}%</span>
              </div>
              <Progress value={completionPct} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>En attente</span>
                <span>Payé</span>
                <span>En cours</span>
                <span>Terminé</span>
              </div>
            </div>

            {/* Escrow status card */}
            {hasEscrow && (
              <div className={`rounded-2xl border p-6 mb-6 ${escrowDisputed ? "bg-destructive/5 border-destructive/30" : escrowReleased ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-primary/5 border-primary/30"}`}>
                <div className="flex items-center gap-3 mb-3">
                  {escrowDisputed ? <AlertTriangle className="w-5 h-5 text-destructive" /> :
                   escrowReleased ? <Unlock className="w-5 h-5 text-green-600" /> :
                   <Lock className="w-5 h-5 text-primary" />}
                  <h3 className="font-display font-bold text-foreground">
                    {escrowPending ? "Paiement en attente de validation" :
                     escrowHeld ? "Fonds sécurisés en escrow" :
                     escrowProviderDone ? "En attente de confirmation client" :
                     escrowReleased ? "Paiement libéré" :
                     escrowDisputed ? "Litige en cours" :
                     "Escrow"}
                  </h3>
                </div>

                {/* Escrow tutorial for providers */}
                {isProvider && escrowHeld && (
                  <div className="bg-primary/5 rounded-xl p-4 mb-4 border border-primary/20">
                    <h4 className="text-sm font-bold text-primary mb-2">💡 Comment fonctionne l'escrow ?</h4>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Le client a payé — les fonds sont <strong>sécurisés</strong> sur la plateforme.</li>
                      <li>Effectuez le travail, puis cliquez <strong>"J'ai terminé"</strong>.</li>
                      <li>Le client confirme la qualité → les fonds sont <strong>crédités sur votre portefeuille</strong>.</li>
                      <li>Si le client ne répond pas sous 48h, les fonds sont <strong>libérés automatiquement</strong>.</li>
                    </ol>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Montant total</span>
                    <p className="font-bold text-foreground">{formatAmount(escrow.amount)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Commission ({escrow.commission_rate}%)</span>
                    <p className="font-semibold text-foreground">{formatAmount(escrow.commission_amount)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prestataire recevra</span>
                    <p className="font-bold text-green-600">{formatAmount(escrow.provider_amount)}</p>
                  </div>
                  {escrowProviderDone && hoursLeft !== null && (
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1"><Timer className="w-3 h-3" /> Auto-libération</span>
                      <p className="font-bold text-primary">{hoursLeft}h restantes</p>
                    </div>
                  )}
                </div>
                {escrowDisputed && escrow.dispute_reason && (
                  <div className="mt-3 p-3 rounded-lg bg-destructive/10 text-sm">
                    <span className="font-semibold text-destructive">Motif : </span>
                    <span className="text-foreground">{escrow.dispute_reason}</span>
                  </div>
                )}
              </div>
            )}

            {/* Messagerie shortcut */}
            {mission.provider_id && (
              <Link to={`/messages/${mission.id}`} className="block mb-6">
                <Button variant="outline" className="w-full gap-2 h-12 text-base border-primary/30 hover:bg-primary/5 relative">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Messagerie
                  {!!unreadCount && unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}

            <div className="grid sm:grid-cols-2 gap-6 mb-8">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-display font-bold text-foreground mb-4">Participants</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-hero flex items-center justify-center text-primary-foreground text-sm font-bold">{clientProfile?.full_name?.slice(0, 2).toUpperCase() || "CL"}</div>
                    <div><p className="text-sm font-semibold text-foreground">{clientProfile?.full_name || "Client"}</p><p className="text-xs text-muted-foreground">Client</p></div>
                  </div>
                  {mission.provider_id && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center text-secondary font-bold text-sm">{providerProfile?.full_name?.slice(0, 2).toUpperCase() || "PR"}</div>
                      <div><p className="text-sm font-semibold text-foreground">{providerProfile?.full_name || "Prestataire"}</p><p className="text-xs text-muted-foreground">Prestataire</p></div>
                    </div>
                  )}
                </div>
              </div>

              {mission.provider_id && providerProfile && (
                <div className="bg-card rounded-2xl border border-border p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-primary" />
                    <h3 className="font-display font-bold text-foreground">Statistiques du prestataire</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Star className="w-4 h-4 text-gold" /> Note moyenne</span>
                      <span className="font-bold text-foreground">{providerReviewStats?.avg ? providerReviewStats.avg.toFixed(1) : "—"}/5</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Users className="w-4 h-4" /> Avis reçus</span>
                      <span className="font-semibold">{providerReviewStats?.count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-secondary" /> Missions réalisées</span>
                      <span className="font-semibold">{providerReviewStats?.missionsCompleted || 0}</span>
                    </div>
                    {providerProfile.avg_response_time_minutes != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-4 h-4" /> Temps de réponse</span>
                        <span className="font-semibold">~{providerProfile.avg_response_time_minutes} min</span>
                      </div>
                    )}
                    {providerProfile.years_of_experience != null && providerProfile.years_of_experience > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> Expérience</span>
                        <span className="font-semibold">{providerProfile.years_of_experience} ans</span>
                      </div>
                    )}
                    {providerProfile.city && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Localisation</span>
                        <span className="font-semibold">{providerProfile.city}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="font-display font-bold text-foreground mb-4">Actions</h3>
              <div className="flex flex-wrap gap-3">
                {/* Provider accepts/starts */}
                {isProvider && mission.status === "pending" && (
                  <>
                    <Button variant="hero" onClick={() => updateStatus.mutate("accepted")}>Accepter la mission</Button>
                    <Button variant="outline" onClick={() => updateStatus.mutate("cancelled")}>Refuser</Button>
                  </>
                )}
                {isProvider && mission.status === "accepted" && !hasEscrow && (
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> En attente du paiement client
                  </span>
                )}

                {/* Client pays */}
                {isClient && mission.provider_id && ["accepted", "in_progress"].includes(mission.status || "") && !hasEscrow && (
                  <Button variant="hero" onClick={() => setShowPayMethodDialog(true)} className="gap-2">
                    <CreditCard className="w-4 h-4" /> Payer le prestataire
                  </Button>
                )}

                {/* Escrow pending - waiting for mobile money validation */}
                {escrowPending && (
                  <span className="text-sm text-primary flex items-center gap-2 animate-pulse">
                    <Clock className="w-4 h-4" /> Validation du paiement en cours...
                  </span>
                )}

                {/* Provider marks work as done */}
                {isProvider && escrowHeld && (
                  <Button variant="hero" onClick={() => escrowAction("provider_complete")} className="gap-2">
                    <CheckCircle className="w-4 h-4" /> J'ai terminé le travail
                  </Button>
                )}
                {isProvider && escrowProviderDone && (
                  <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Vous avez confirmé la fin</span>
                )}

                {/* Client confirms or disputes */}
                {isClient && escrowProviderDone && (
                  <>
                    <Button variant="hero" onClick={() => escrowAction("client_confirm")} className="gap-2">
                      <CheckCircle className="w-4 h-4" /> Confirmer et libérer le paiement
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-2"
                      onClick={() => setShowDisputeDialog(true)}
                    >
                      <AlertTriangle className="w-4 h-4" /> Ouvrir un litige
                    </Button>
                  </>
                )}
                {isClient && escrowProviderDone && hoursLeft !== null && (
                  <p className="w-full text-xs text-muted-foreground mt-1">
                    ⏱️ Si vous ne confirmez pas dans les {hoursLeft}h, les fonds seront libérés automatiquement.
                  </p>
                )}

                {/* Cancel */}
                {(isClient || isProvider) && mission.status === "pending" && (
                  <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => {
                    if (confirm("Êtes-vous sûr de vouloir annuler cette mission ?")) updateStatus.mutate("cancelled");
                  }}>
                    <Ban className="w-4 h-4 mr-2" />Annuler la mission
                  </Button>
                )}

                {/* Invoice */}
                {mission.status === "completed" && (
                  <div className="flex flex-wrap gap-2">
                    {isProvider && (
                      <Button variant="outline" onClick={() => {
                        setInvoiceDesc((mission as any).invoice_description || mission.description || "");
                        setShowInvoiceDescDialog(true);
                      }} className="gap-2">
                        <FileText className="w-4 h-4" /> Rédiger la description de facture
                      </Button>
                    )}
                    <Button variant="outline" onClick={generateInvoicePDF} className="gap-2">
                      <FileText className="w-4 h-4" />Télécharger la facture
                    </Button>
                  </div>
                )}

                {/* Review */}
                {canReview && reviewedId && (
                  <ReviewModal missionId={mission.id} reviewedId={reviewedId} />
                )}

                {/* Dispute from held state */}
                {isClient && escrowHeld && (
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-2"
                    onClick={() => setShowDisputeDialog(true)}
                  >
                    <AlertTriangle className="w-4 h-4" /> Ouvrir un litige
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Payment Method Selection Dialog */}
      <Dialog open={showPayMethodDialog} onOpenChange={setShowPayMethodDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Choisir le mode de paiement
            </DialogTitle>
            <DialogDescription>
              Comment souhaitez-vous payer le prestataire ?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            {/* Escrow Option */}
            <button
              type="button"
              onClick={() => { setShowPayMethodDialog(false); setShowPayDialog(true); }}
              className="flex flex-col gap-3 rounded-2xl border-2 border-primary/40 bg-primary/5 p-5 text-left hover:border-primary hover:bg-primary/10 transition-all duration-200 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Paiement Escrow</p>
                  <p className="text-xs text-primary font-medium">Commission 6% — Recommandé ✅</p>
                </div>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 pl-1">
                <li>🔒 Fonds bloqués jusqu'à validation du travail</li>
                <li>🔄 Remboursement en cas de litige</li>
                <li>📄 Facture automatique générée</li>
                <li>📡 Suivi en temps réel du paiement</li>
              </ul>
            </button>

            {/* Cash Option */}
            <button
              type="button"
              onClick={() => { setShowPayMethodDialog(false); setShowCashWarningDialog(true); }}
              className="flex flex-col gap-3 rounded-2xl border-2 border-border bg-muted/30 p-5 text-left hover:border-muted-foreground/40 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Unlock className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Paiement en Cash</p>
                  <p className="text-xs text-muted-foreground">Paiement direct, sans protection</p>
                </div>
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayMethodDialog(false)}>Annuler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Warning Dialog */}
      <Dialog open={showCashWarningDialog} onOpenChange={setShowCashWarningDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Attention — Paiement en cash
            </DialogTitle>
            <DialogDescription>
              Avant de continuer, prenez connaissance des risques importants.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <p className="text-sm font-bold text-destructive mb-2">⚠️ Inconvénients du paiement en cash :</p>
            <ul className="text-sm text-foreground space-y-2">
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <span><strong>Aucune protection</strong> — En cas de travail non fait ou mal fait, vous ne pourrez pas être remboursé via la plateforme.</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <span><strong>Aucun arbitrage possible</strong> — Les litiges cash ne peuvent pas être traités par notre équipe d'administration.</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <span><strong>Pas de facture officielle</strong> — Aucune preuve de paiement certifiée par PRESTA237 ne sera générée.</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <span><strong>Risque d'arnaque</strong> — Le prestataire pourrait disparaître après paiement sans achever le travail.</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <span><strong>Aucun suivi</strong> — Le statut de la mission ne sera pas mis à jour automatiquement.</span>
              </li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Nous vous recommandons vivement d'utiliser l'escrow pour votre sécurité.
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10 gap-2 flex-1"
              onClick={() => { setShowCashWarningDialog(false); setShowCashConfirmDialog(true); }}
            >
              Continuer en cash quand même
            </Button>
            <Button
              variant="hero"
              className="gap-2 flex-1"
              onClick={() => { setShowCashWarningDialog(false); setShowPayDialog(true); }}
            >
              <Shield className="w-4 h-4" /> Utiliser l'Escrow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Confirmation Dialog */}
      <Dialog open={showCashConfirmDialog} onOpenChange={setShowCashConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-muted-foreground" /> Déclarer un paiement en cash
            </DialogTitle>
            <DialogDescription>
              Indiquez le montant que vous avez payé directement au prestataire.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300 mb-2">
            ⚠️ Ce paiement n'est <strong>pas sécurisé</strong> par PRESTA237. Aucun remboursement possible en cas de litige.
          </div>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-xl p-4">
              <label className="text-sm font-medium text-foreground mb-2 block">Montant payé en cash (FCFA)</label>
              <Input
                type="number"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="Ex: 25000"
                min={100}
                className="text-lg font-bold h-12"
              />
              {cashAmount && parseInt(cashAmount) > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Le prestataire recevra <strong>{parseInt(cashAmount).toLocaleString("fr-FR")} FCFA</strong> — aucune commission prélevée.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowCashConfirmDialog(false)}>Annuler</Button>
            <Button
              variant="outline"
              className="border-amber-400 text-amber-700 hover:bg-amber-50 gap-2"
              onClick={handleCashPayment}
              disabled={cashPaying || !cashAmount}
            >
              {cashPaying ? <span className="animate-pulse">Enregistrement...</span> : <><Unlock className="w-4 h-4" /> Confirmer le paiement cash</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Payer le prestataire</DialogTitle>
            <DialogDescription>
              Le montant sera sécurisé en escrow puis transféré dans le portefeuille du prestataire après votre confirmation.
            </DialogDescription>
          </DialogHeader>
          {/* Payment advantages */}
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
            <h4 className="text-sm font-bold text-primary mb-2">🛡️ Pourquoi payer via PRESTA237 ?</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✅ <strong>Protection escrow</strong> — vos fonds sont sécurisés jusqu'à validation du travail</li>
              <li>✅ <strong>Remboursement garanti</strong> — litige ? l'admin arbitre et peut vous rembourser</li>
              <li>✅ <strong>Facture automatique</strong> — preuve de paiement téléchargeable</li>
              <li>✅ <strong>Suivi transparent</strong> — suivez chaque étape du paiement en temps réel</li>
            </ul>
          </div>
          <div className="space-y-5">
            {/* Operator selection with logos */}
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Choisissez votre opérateur</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPayOperator("orange")}
                  className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-5 transition-all duration-200 ${payOperator === "orange" ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 shadow-lg scale-[1.03]" : "border-border hover:border-orange-300 hover:shadow-md"}`}
                >
                  <img src={orangeLogo} alt="Orange Money" className="w-16 h-16 object-contain" />
                  <span className="font-bold text-sm text-foreground">Orange Money</span>
                  {payOperator === "orange" && <CheckCircle className="w-5 h-5 text-orange-500" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPayOperator("mtn")}
                  className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-5 transition-all duration-200 ${payOperator === "mtn" ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 shadow-lg scale-[1.03]" : "border-border hover:border-yellow-300 hover:shadow-md"}`}
                >
                  <img src={mtnLogo} alt="MTN MoMo" className="w-16 h-16 object-contain" />
                  <span className="font-bold text-sm text-foreground">MTN MoMo</span>
                  {payOperator === "mtn" && <CheckCircle className="w-5 h-5 text-yellow-500" />}
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="bg-muted/50 rounded-xl p-4">
              <label className="text-sm font-medium text-foreground mb-2 block">Montant (FCFA)</label>
              <Input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Ex: 25000"
                min={100}
                className="text-lg font-bold h-12"
              />
              {payAmount && parseInt(payAmount) > 0 && (
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Commission PRESTA237 (6%)</span>
                    <span className="font-semibold text-foreground">{Math.round(parseInt(payAmount) * 0.06).toLocaleString("fr-FR")} FCFA</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5">
                    <span className="text-muted-foreground">Le prestataire recevra</span>
                    <span className="font-bold text-green-600">{Math.round(parseInt(payAmount) * 0.94).toLocaleString("fr-FR")} FCFA</span>
                  </div>
                </div>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Numéro Mobile Money</label>
              <Input
                type="tel"
                value={payPhone}
                onChange={(e) => setPayPhone(e.target.value)}
                placeholder="237XXXXXXXXX"
                maxLength={12}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground mt-1">Format : 237 suivi de 9 chiffres</p>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>Annuler</Button>
            <Button variant="hero" size="lg" onClick={handlePayment} disabled={paying || !payAmount || !payPhone || !payOperator} className="gap-2">
              {paying ? (
                <span className="animate-pulse">Traitement en cours...</span>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Payer {payAmount ? `${parseInt(payAmount).toLocaleString("fr-FR")} FCFA` : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute dialog */}
      <Dialog open={showDisputeDialog} onOpenChange={setShowDisputeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" /> Ouvrir un litige</DialogTitle>
            <DialogDescription>
              L'escrow sera bloqué et un administrateur examinera votre demande. Vous pouvez joindre des preuves (photos) via la messagerie.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Motif du litige</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Décrivez le problème rencontré..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisputeDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={() => {
              escrowAction("client_dispute", { reason: disputeReason });
              setShowDisputeDialog(false);
              setDisputeReason("");
            }} disabled={!disputeReason.trim()}>
              Confirmer le litige
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice description dialog */}
      <Dialog open={showInvoiceDescDialog} onOpenChange={setShowInvoiceDescDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Description de la facture</DialogTitle>
            <DialogDescription>
              Rédigez la description qui apparaîtra sur la facture téléchargeable par le client.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px]"
            value={invoiceDesc}
            onChange={(e) => setInvoiceDesc(e.target.value)}
            placeholder="Décrivez les travaux réalisés pour la facture..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDescDialog(false)}>Annuler</Button>
            <Button variant="hero" onClick={() => saveInvoiceDescription(invoiceDesc)} disabled={!invoiceDesc.trim()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {id && (
        <PlatformReviewModal
          missionId={id}
          open={showPlatformReview}
          onOpenChange={(open) => {
            setShowPlatformReview(open);
            if (!open) sessionStorage.setItem(`platform-review-dismissed-${id}`, "1");
          }}
        />
      )}

      <Footer />
    </div>
  );
};

export default MissionDetail;
