import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REPORT_REASONS = [
  "Faux profil",
  "Contenu inapproprié",
  "Harcèlement",
  "Arnaque / Fraude",
  "Comportement abusif",
  "Autre",
];

interface ReportModalProps {
  reportedUserId: string;
  reportedName: string;
}

const ReportModal = ({ reportedUserId, reportedName }: ReportModalProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const submitReport = useMutation({
    mutationFn: async () => {
      if (!reason) throw new Error("Sélectionnez un motif");
      const { error } = await supabase.from("reports" as any).insert({
        reporter_id: user!.id,
        reported_user_id: reportedUserId,
        reason,
        details: details.trim() || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Signalement envoyé. Notre équipe va l'examiner.");
      setOpen(false);
      setReason("");
      setDetails("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!user || user.id === reportedUserId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
          <Flag className="w-4 h-4" /> Signaler
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signaler {reportedName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Motif du signalement</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choisir un motif..." />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Détails (optionnel)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Décrivez la situation..."
              className="mt-1"
              rows={3}
            />
          </div>
          <Button
            className="w-full"
            variant="destructive"
            disabled={!reason || submitReport.isPending}
            onClick={() => submitReport.mutate()}
          >
            {submitReport.isPending ? "Envoi..." : "Envoyer le signalement"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportModal;