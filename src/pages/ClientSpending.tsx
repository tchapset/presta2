import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingDown, Calendar, Users, DollarSign } from "lucide-react";
import { motion } from "framer-motion";
import LoadingScreen from "@/components/LoadingScreen";

const ClientSpending = () => {
  const { user, loading: authLoading } = useAuth();

  const { data: escrows } = useQuery({
    queryKey: ["client-escrows", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("escrow_payments")
        .select("*, missions!inner(title, provider_id)")
        .eq("payer_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: providerProfiles } = useQuery({
    queryKey: ["provider-profiles-for-spending", escrows?.map(e => (e as any).missions?.provider_id)],
    enabled: !!escrows && escrows.length > 0,
    queryFn: async () => {
      const ids = [...new Set(escrows!.map((e: any) => e.missions?.provider_id).filter(Boolean))];
      if (ids.length === 0) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      return data || [];
    },
  });

  if (authLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  const formatAmount = (n: number) => `${Math.abs(n).toLocaleString("fr-FR")} FCFA`;
  const totalSpent = escrows?.filter(e => ["held", "released", "provider_completed"].includes(e.status)).reduce((s, e) => s + (e.amount || 0), 0) || 0;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthlySpent = escrows?.filter(e => ["held", "released", "provider_completed"].includes(e.status) && e.created_at && e.created_at >= monthStart).reduce((s, e) => s + (e.amount || 0), 0) || 0;
  const uniqueProviders = new Set(escrows?.map((e: any) => e.missions?.provider_id).filter(Boolean)).size;

  const getProviderName = (providerId: string) => {
    return providerProfiles?.find(p => p.user_id === providerId)?.full_name || "—";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">Mes Dépenses</h1>
              <p className="text-muted-foreground">Suivez vos paiements et dépenses</p>
            </div>
            <Link to="/dashboard">
              <Button variant="outline" size="sm">← Retour</Button>
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border border-border p-5">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-3">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground">Total dépensé</p>
              <p className="text-xl font-display font-bold text-foreground">{formatAmount(totalSpent)}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-card rounded-2xl border border-border p-5">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5 text-secondary" />
              </div>
              <p className="text-sm text-muted-foreground">Ce mois</p>
              <p className="text-xl font-display font-bold text-foreground">{formatAmount(monthlySpent)}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-card rounded-2xl border border-border p-5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Prestataires payés</p>
              <p className="text-xl font-display font-bold text-foreground">{uniqueProviders}</p>
            </motion.div>
          </div>

          {/* Payment History */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-bold text-foreground flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" /> Historique des paiements
              </h3>
            </div>
            {escrows && escrows.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Mission</TableHead>
                      <TableHead>Prestataire</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {escrows.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(e.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          <Link to={`/mission/${e.mission_id}`} className="text-primary hover:underline">
                            {e.missions?.title || "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{getProviderName(e.missions?.provider_id)}</TableCell>
                        <TableCell className="font-semibold">{Number(e.amount).toLocaleString("fr-FR")} FCFA</TableCell>
                        <TableCell>
                          <Badge variant={
                            e.status === "released" ? "default" :
                            e.status === "refunded" ? "secondary" :
                            e.status === "disputed" ? "destructive" : "outline"
                          } className="text-xs">
                            {e.status === "released" ? "Libéré" :
                             e.status === "held" ? "En séquestre" :
                             e.status === "provider_completed" ? "En attente" :
                             e.status === "refunded" ? "Remboursé" :
                             e.status === "disputed" ? "Litige" :
                             e.status === "pending" ? "En cours" : e.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Aucun paiement pour le moment.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ClientSpending;
