import { useState, useEffect, useMemo } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Wallet, ArrowUpCircle, ArrowDownCircle, CheckCircle, Clock, AlertCircle, TrendingUp, DollarSign, Calendar, Send, BarChart3, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import LoadingScreen from "@/components/LoadingScreen";
import mtnLogo from "@/assets/mtn-logo.png";
import orangeLogo from "@/assets/orange-logo.png";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useLang } from "@/components/LanguageToggle";

const ProviderWallet = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: userRole } = useUserRole();
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawOperator, setWithdrawOperator] = useState<"mtn" | "orange">("mtn");
  const [withdrawPhone, setWithdrawPhone] = useState("");
  const [withdrawName, setWithdrawName] = useState("");
  const [saveInfo, setSaveInfo] = useState(false);

  const isProvider = userRole === "provider" || userRole === "both";

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").eq("user_id", user!.id).single();
      return data;
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!wallet,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("wallet_id", wallet!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: transfers } = useQuery({
    queryKey: ["momo-transfers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("mobile_money_transfers")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return data;
    },
  });

  // Load saved withdrawal info
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`withdraw-info-${user?.id}`);
      if (saved) {
        try {
          const info = JSON.parse(saved);
          setWithdrawPhone(info.phone || "");
          setWithdrawName(info.name || "");
          setWithdrawOperator(info.operator || "mtn");
        } catch {}
      }
    }
  }, [user?.id]);

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const amount = parseInt(withdrawAmount);
      if (isNaN(amount) || amount < 500) throw new Error(t("Montant minimum : 500 FCFA", "Minimum amount: 500 FCFA"));
      if (!withdrawPhone || !/^237\d{9}$/.test(withdrawPhone.replace(/\s/g, "")))
        throw new Error(t("Numéro invalide (format : 237XXXXXXXXX)", "Invalid number (format: 237XXXXXXXXX)"));
      if (!withdrawName.trim()) throw new Error(t("Nom obligatoire", "Name required"));
      if (amount > (wallet?.balance || 0)) throw new Error(t("Solde insuffisant", "Insufficient balance"));

      // Deduct from wallet
      const { error: walletErr } = await supabase
        .from("wallets")
        .update({ balance: (wallet?.balance || 0) - amount })
        .eq("id", wallet!.id);
      if (walletErr) throw walletErr;

      // Create withdrawal request
      const { data: transferRecord, error } = await supabase.from("mobile_money_transfers").insert({
        user_id: user!.id,
        amount,
        phone: withdrawPhone.replace(/\s/g, ""),
        operator: withdrawOperator,
        name_on_account: withdrawName.trim(),
        transfer_type: "withdrawal",
        status: "pending",
      } as any).select().single();
      if (error) throw error;

      // Create transaction record
      await supabase.from("transactions").insert({
        wallet_id: wallet!.id,
        amount: -amount,
        type: "withdrawal" as any,
        description: `Retrait ${withdrawOperator.toUpperCase()} vers ${withdrawPhone}`,
        status: "pending",
      });

      // Save info if requested
      if (saveInfo) {
        localStorage.setItem(`withdraw-info-${user?.id}`, JSON.stringify({
          phone: withdrawPhone,
          name: withdrawName,
          operator: withdrawOperator,
        }));
      }

      // Trigger automatic withdrawal via FreeMoPay
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("freemopay-withdraw", {
          body: { transfer_id: (transferRecord as any).id },
        });
        if (fnError) {
          console.warn("Auto-withdraw failed, will be processed manually:", fnError);
        }
      } catch (err) {
        console.warn("Auto-withdraw call failed:", err);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["momo-transfers"] });
      toast.success(t("Retrait en cours de traitement ! Vous serez notifié.", "Withdrawal being processed! You will be notified."));
      setShowWithdraw(false);
      setWithdrawAmount("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (authLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  const balance = wallet?.balance || 0;
  const pendingBalance = wallet?.pending_balance || 0;
  const formatAmount = (n: number) => `${Math.abs(n).toLocaleString("fr-FR")} FCFA`;

  // Revenue calculations
  const totalRevenue = transactions?.filter(t => t.type === "escrow_release" && t.status === "completed").reduce((s, t) => s + (t.amount || 0), 0) || 0;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthlyRevenue = transactions?.filter(t => t.type === "escrow_release" && t.status === "completed" && t.created_at && t.created_at >= monthStart).reduce((s, t) => s + (t.amount || 0), 0) || 0;
  const totalWithdrawn = transfers?.filter(t => (t as any).transfer_type === "withdrawal" && t.status === "completed").reduce((s, t) => s + (t.amount || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">{t("Mon Portefeuille", "My Wallet")}</h1>
              <p className="text-muted-foreground">{t("Gérez vos revenus et retraits", "Manage your revenue and withdrawals")}</p>
            </div>
            <Link to="/dashboard">
              <Button variant="outline" size="sm">← {t("Retour", "Back")}</Button>
            </Link>
          </div>

          {/* Balance Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-8 text-primary-foreground mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="w-8 h-8" />
              <span className="text-lg font-medium opacity-90">{t("Solde disponible", "Available balance")}</span>
            </div>
            <p className="text-4xl font-display font-bold mb-2">{formatAmount(balance)}</p>
            {pendingBalance > 0 && (
              <p className="text-sm opacity-75">+ {formatAmount(pendingBalance)} {t("en attente", "pending")}</p>
            )}
            <div className="mt-6">
              <Button
                variant="secondary"
                size="lg"
                className="gap-2 font-bold"
                onClick={() => setShowWithdraw(true)}
                disabled={balance < 500}
              >
                <Send className="w-5 h-5" /> {t("Transférer vers mon compte", "Transfer to my account")}
              </Button>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-card rounded-2xl border border-border p-5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{t("Revenus totaux", "Total revenue")}</p>
              <p className="text-xl font-display font-bold text-foreground">{formatAmount(totalRevenue)}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-card rounded-2xl border border-border p-5">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5 text-secondary" />
              </div>
              <p className="text-sm text-muted-foreground">{t("Revenus ce mois", "This month's revenue")}</p>
              <p className="text-xl font-display font-bold text-foreground">{formatAmount(monthlyRevenue)}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-card rounded-2xl border border-border p-5">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center mb-3">
                <ArrowUpCircle className="w-5 h-5 text-gold" />
              </div>
              <p className="text-sm text-muted-foreground">{t("Total retiré", "Total withdrawn")}</p>
              <p className="text-xl font-display font-bold text-foreground">{formatAmount(totalWithdrawn)}</p>
            </motion.div>
          </div>

          {/* Monthly Revenue Bar Chart */}
          {transactions && transactions.length > 0 && (() => {
            const monthlyData: { month: string; revenue: number }[] = [];
            const now = new Date();
            for (let i = 5; i >= 0; i--) {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              const start = d.toISOString();
              const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
              const rev = transactions.filter(t => t.type === "escrow_release" && t.status === "completed" && t.created_at && t.created_at >= start && t.created_at < end).reduce((s, t) => s + (t.amount || 0), 0);
              monthlyData.push({ month: d.toLocaleDateString("fr-FR", { month: "short" }), revenue: rev });
            }
            return (
              <div className="bg-card rounded-2xl border border-border p-6 mb-8">
                <h3 className="font-display font-bold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" /> {t("Revenus mensuels", "Monthly revenue")}
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => [`${value.toLocaleString("fr-FR")} FCFA`, t("Revenus", "Revenue")]} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {/* Tabs */}
          <Tabs defaultValue="transactions">
            <TabsList className="mb-4">
              <TabsTrigger value="transactions">{t("Transactions", "Transactions")}</TabsTrigger>
              <TabsTrigger value="withdrawals">{t("Retraits", "Withdrawals")}</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions">
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                {transactions && transactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("Date", "Date")}</TableHead>
                          <TableHead>{t("Description", "Description")}</TableHead>
                          <TableHead>{t("Type", "Type")}</TableHead>
                          <TableHead className="text-right">{t("Montant", "Amount")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((t: any) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(t.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                            </TableCell>
                            <TableCell className="text-sm">{t.description || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {t.type === "escrow_release" ? "Paiement reçu" :
                                 t.type === "withdrawal" ? "Retrait" :
                                 t.type === "refund" ? "Remboursement" :
                                 t.type === "commission" ? "Commission" : t.type}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${t.amount >= 0 ? "text-green-600" : "text-destructive"}`}>
                              {t.amount >= 0 ? "+" : ""}{Number(t.amount).toLocaleString("fr-FR")} FCFA
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">{t("Aucune transaction pour le moment.", "No transactions yet.")}</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="withdrawals">
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                {transfers && transfers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("Date", "Date")}</TableHead>
                          <TableHead>{t("Montant", "Amount")}</TableHead>
                          <TableHead>{t("Opérateur", "Operator")}</TableHead>
                          <TableHead>{t("Téléphone", "Phone")}</TableHead>
                          <TableHead>{t("Nom", "Name")}</TableHead>
                          <TableHead>{t("Statut", "Status")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transfers.map((tr: any) => (
                          <TableRow key={tr.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(tr.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                            </TableCell>
                            <TableCell className="font-semibold">{Number(tr.amount).toLocaleString()} FCFA</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <img src={tr.operator === "orange" ? orangeLogo : mtnLogo} alt="" className="w-5 h-5 object-contain" />
                                <span className="text-xs font-medium">{tr.operator === "orange" ? "Orange" : "MTN"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{tr.phone || "—"}</TableCell>
                            <TableCell className="text-sm">{tr.name_on_account || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={
                                tr.status === "completed" ? "default" :
                                tr.status === "failed" ? "destructive" :
                                tr.status === "processing" ? "secondary" : "secondary"
                              } className="text-xs">
                                {tr.status === "completed" ? <><CheckCircle className="w-3 h-3 mr-1" />{t("Envoyé", "Sent")}</> :
                                 tr.status === "failed" ? <><AlertCircle className="w-3 h-3 mr-1" />{t("Échoué", "Failed")}</> :
                                 tr.status === "processing" ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />{t("En cours", "Processing")}</> :
                                 <><Clock className="w-3 h-3 mr-1" />{t("En attente", "Pending")}</>}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <ArrowDownCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">{t("Aucun retrait pour le moment.", "No withdrawals yet.")}</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Withdrawal Dialog */}
      <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="w-5 h-5 text-primary" /> {t("Demande de retrait", "Withdrawal request")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("Montant (FCFA)", "Amount (FCFA)")}</Label>
              <Input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Ex: 10000"
                min={500}
                max={balance}
              />
              <p className="text-xs text-muted-foreground mt-1">{t("Solde disponible", "Available balance")} : {formatAmount(balance)}</p>
            </div>

            <div>
              <Label className="mb-2 block">{t("Réseau Mobile Money", "Mobile Money Network")}</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setWithdrawOperator("orange")}
                  className={`flex items-center justify-center gap-3 rounded-xl border-2 p-4 transition-all ${withdrawOperator === "orange" ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 shadow-md scale-[1.02]" : "border-border hover:border-orange-300"}`}
                >
                  <img src={orangeLogo} alt="Orange Money" className="w-10 h-10 object-contain" />
                  <span className="font-bold text-sm">Orange Money</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawOperator("mtn")}
                  className={`flex items-center justify-center gap-3 rounded-xl border-2 p-4 transition-all ${withdrawOperator === "mtn" ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 shadow-md scale-[1.02]" : "border-border hover:border-yellow-300"}`}
                >
                  <img src={mtnLogo} alt="MTN MoMo" className="w-10 h-10 object-contain" />
                  <span className="font-bold text-sm">MTN MoMo</span>
                </button>
              </div>
            </div>

            <div>
              <Label>{t("Numéro de téléphone (237...)", "Phone number (237...)")}</Label>
              <Input
                type="tel"
                value={withdrawPhone}
                onChange={(e) => setWithdrawPhone(e.target.value)}
                placeholder="237XXXXXXXXX"
                maxLength={12}
              />
            </div>

            <div>
              <Label>{t("Nom sur le compte", "Name on account")}</Label>
              <Input
                value={withdrawName}
                onChange={(e) => setWithdrawName(e.target.value)}
                placeholder="Ex: Jean Dupont"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="save-info"
                checked={saveInfo}
                onChange={(e) => setSaveInfo(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="save-info" className="text-sm text-muted-foreground cursor-pointer">
                {t("Enregistrer ces informations pour la prochaine fois", "Save this info for next time")}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdraw(false)}>{t("Annuler", "Cancel")}</Button>
            <Button
              onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending || !withdrawAmount || !withdrawPhone || !withdrawName}
              className="gap-2"
            >
              {withdrawMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("Traitement...", "Processing...")}</> : t("Envoyer la demande", "Send request")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default ProviderWallet;
