import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Navigate, Link } from "react-router-dom";
import { MessageSquare, ArrowLeft, Trash2, Search, SlidersHorizontal, X } from "lucide-react";
import { formatDistanceToNow, isToday, isThisWeek, isThisMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { useLang } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  in_progress: "En cours",
  completed: "Terminée",
  disputed: "Litige",
  cancelled: "Annulée",
};

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  accepted: "bg-secondary/20 text-secondary",
  in_progress: "bg-primary/20 text-primary",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  disputed: "bg-destructive/20 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const Conversations = () => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Get all missions where user is client or provider
  const { data: missions, isLoading } = useQuery({
    queryKey: ["my-conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .or(`client_id.eq.${user!.id},provider_id.eq.${user!.id}`)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Delete all messages for a mission
  const deleteConversation = useMutation({
    mutationFn: async (missionId: string) => {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("mission_id", missionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conv-last-messages"] });
      toast.success("Conversation supprimée");
      setDeletingId(null);
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
      setDeletingId(null);
    },
  });

  // Get the other user's profiles
  const otherUserIds = missions
    ?.map((m) => (m.client_id === user?.id ? m.provider_id : m.client_id))
    .filter(Boolean) as string[] | undefined;

  const { data: profiles } = useQuery({
    queryKey: ["conv-profiles", otherUserIds],
    enabled: !!otherUserIds && otherUserIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, last_seen_at")
        .in("user_id", otherUserIds!);
      return data || [];
    },
  });

  // Get last message + unread count per mission
  const { data: lastMessages } = useQuery({
    queryKey: ["conv-last-messages", missions?.map((m) => m.id)],
    enabled: !!missions && missions.length > 0,
    queryFn: async () => {
      const results: Record<string, { content: string; created_at: string; sender_id: string; unread: number }> = {};
      for (const m of missions!) {
        const { data: msgs } = await supabase
          .from("messages")
          .select("content, created_at, sender_id, is_read")
          .eq("mission_id", m.id)
          .order("created_at", { ascending: false })
          .limit(20);
        if (msgs && msgs.length > 0) {
          const unread = msgs.filter((msg) => msg.sender_id !== user!.id && !msg.is_read).length;
          results[m.id] = { content: msgs[0].content, created_at: msgs[0].created_at!, sender_id: msgs[0].sender_id, unread };
        }
      }
      return results;
    },
  });

  const profileMap = useMemo(() => new Map(profiles?.map((p) => [p.user_id, p])), [profiles]);

  // Group missions by provider - show only the most recent active mission per counterpart
  const groupedMissions = useMemo(() => {
    if (!missions || !user) return [];
    
    // Group by other user
    const byUser = new Map<string, typeof missions>();
    for (const m of missions) {
      const otherId = m.client_id === user.id ? m.provider_id : m.client_id;
      if (!otherId) continue;
      if (!byUser.has(otherId)) byUser.set(otherId, []);
      byUser.get(otherId)!.push(m);
    }

    // For each group, pick the latest active mission (or latest with messages)
    const result: typeof missions = [];
    for (const [, userMissions] of byUser) {
      // Prefer active missions
      const active = userMissions.filter(m => 
        ["pending", "accepted", "in_progress", "disputed"].includes(m.status || "")
      );
      
      if (active.length > 0) {
        // Pick the one with the most recent message, or the most recent mission
        const withMsg = active.filter(m => lastMessages?.[m.id]);
        if (withMsg.length > 0) {
          withMsg.sort((a, b) => {
            const aTime = lastMessages?.[a.id]?.created_at || "";
            const bTime = lastMessages?.[b.id]?.created_at || "";
            return bTime.localeCompare(aTime);
          });
          result.push(withMsg[0]);
        } else {
          result.push(active[0]);
        }
      } else {
        // All completed/cancelled - show the most recent one with messages
        const withMsg = userMissions.filter(m => lastMessages?.[m.id]);
        if (withMsg.length > 0) {
          withMsg.sort((a, b) => {
            const aTime = lastMessages?.[a.id]?.created_at || "";
            const bTime = lastMessages?.[b.id]?.created_at || "";
            return bTime.localeCompare(aTime);
          });
          result.push(withMsg[0]);
        }
      }
    }

    return result;
  }, [missions, user, lastMessages]);

  // Filter and sort
  const filteredMissions = useMemo(() => {
    if (!user) return [];
    let result = groupedMissions.slice();

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => {
        const otherId = m.client_id === user?.id ? m.provider_id : m.client_id;
        const profile = otherId ? profileMap.get(otherId) : null;
        const nameMatch = profile?.full_name?.toLowerCase().includes(q);
        const titleMatch = m.title?.toLowerCase().includes(q);
        return nameMatch || titleMatch;
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((m) => m.status === statusFilter);
    }

    if (dateFilter !== "all") {
      result = result.filter((m) => {
        const msgDate = lastMessages?.[m.id]?.created_at;
        const date = msgDate ? new Date(msgDate) : m.updated_at ? new Date(m.updated_at) : null;
        if (!date) return false;
        if (dateFilter === "today") return isToday(date);
        if (dateFilter === "week") return isThisWeek(date, { weekStartsOn: 1 });
        if (dateFilter === "month") return isThisMonth(date);
        return true;
      });
    }

    // Only show missions that have messages
    if (lastMessages) {
      result = result.filter((m) => lastMessages[m.id]);
    }

    result.sort((a, b) => {
      const aMsg = lastMessages?.[a.id];
      const bMsg = lastMessages?.[b.id];
      if (aMsg && !bMsg) return -1;
      if (!aMsg && bMsg) return 1;
      if (aMsg && bMsg) return new Date(bMsg.created_at).getTime() - new Date(aMsg.created_at).getTime();
      return 0;
    });

    return result;
  }, [groupedMissions, searchQuery, statusFilter, dateFilter, lastMessages, profileMap, user?.id]);

  const hasActiveFilters = searchQuery || statusFilter !== "all" || dateFilter !== "all";

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Chargement...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16">
        <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <h1 className="text-lg font-display font-bold text-foreground">{t("Messages", "Messages")}</h1>
        </div>

        {/* Search & Filters */}
        <div className="px-4 py-3 space-y-2 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("Rechercher par nom ou mission...", "Search by name or mission...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </div>

          {showFilters && (
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les dates</SelectItem>
                  <SelectItem value="today">Aujourd'hui</SelectItem>
                  <SelectItem value="week">7 derniers jours</SelectItem>
                  <SelectItem value="month">30 derniers jours</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setDateFilter("all"); }}>
                  <X className="w-3 h-3 mr-1" /> Réinit.
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="divide-y divide-border">
          {isLoading && (
            <div className="p-8 text-center text-muted-foreground">{t("Chargement...", "Loading...")}</div>
          )}

          {filteredMissions.length === 0 && !isLoading && (
            <div className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {hasActiveFilters
                  ? t("Aucun résultat pour ces filtres", "No results for these filters")
                  : t("Aucune conversation", "No conversations")}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setDateFilter("all"); }}>
                  {t("Réinitialiser les filtres", "Reset filters")}
                </Button>
              ) : (
                <Link to="/recherche">
                  <Button variant="hero" size="sm" className="mt-4">{t("Trouver un prestataire", "Find a provider")}</Button>
                </Link>
              )}
            </div>
          )}

          {filteredMissions.map((mission) => {
            const otherId = mission.client_id === user.id ? mission.provider_id : mission.client_id;
            const profile = otherId ? profileMap.get(otherId) : null;
            const lastMsg = lastMessages?.[mission.id];
            const lastSeen = profile?.last_seen_at;
            const online = lastSeen ? Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000 : false;
            const unread = lastMsg?.unread || 0;

            return (
              <div
                key={mission.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group"
              >
                <Link to={`/messages/${mission.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative shrink-0">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold text-sm">
                        {profile?.full_name?.slice(0, 2).toUpperCase() || "??"}
                      </div>
                    )}
                    {online && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-sm truncate text-foreground">
                        {profile?.full_name || t("Utilisateur", "User")}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[mission.status || "pending"] || "bg-muted text-muted-foreground"}`}>
                          {statusLabels[mission.status || "pending"] || mission.status}
                        </span>
                        {lastMsg && (
                          <span className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(lastMsg.created_at), { addSuffix: false, locale: fr })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate ${unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {lastMsg ? (lastMsg.sender_id === user.id ? `Vous: ${lastMsg.content}` : lastMsg.content) : mission.title}
                      </p>
                      {unread > 0 && (
                        <span className="shrink-0 ml-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                
                {/* Delete button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer la conversation ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tous les messages de cette conversation seront supprimés définitivement. Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => deleteConversation.mutate(mission.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Conversations;
