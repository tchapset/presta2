import { useState, useEffect } from "react";
import { Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface PlatformReviewModalProps {
  missionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PlatformReviewModal = ({ missionId, open, onOpenChange }: PlatformReviewModalProps) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const ratingLabels = ["", "Décevant", "Moyen", "Bien", "Très bien", "Excellent !"];

  const submit = async () => {
    if (!user || rating === 0) return toast.error("Veuillez donner une note");
    setLoading(true);
    try {
      const { error } = await supabase.from("platform_reviews" as any).insert({
        user_id: user.id,
        mission_id: missionId,
        rating,
        comment: comment.trim() || null,
      } as any);
      if (error) throw error;
      toast.success("Merci pour votre avis ! 🎉");
      onOpenChange(false);
      setRating(0);
      setComment("");
    } catch (e: any) {
      if (e.message?.includes("duplicate")) {
        toast.info("Vous avez déjà donné votre avis pour cette mission");
        onOpenChange(false);
      } else {
        toast.error(e.message || "Erreur");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Comment s'est passée votre expérience ?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          <p className="text-sm text-muted-foreground text-center">
            Votre avis nous aide à améliorer TKLINK pour toute la communauté.
          </p>

          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <motion.button
                key={n}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(n)}
              >
                <Star
                  className={`w-9 h-9 transition-colors ${
                    n <= (hovered || rating) ? "text-gold fill-gold" : "text-muted"
                  }`}
                />
              </motion.button>
            ))}
          </div>

          <p className="text-center text-sm font-medium text-foreground">
            {rating === 0
              ? "Cliquez pour noter"
              : ratingLabels[rating]}
          </p>

          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Partagez votre expérience avec TKLINK... (optionnel)"
            rows={3}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Plus tard
            </Button>
            <Button
              className="flex-1"
              variant="hero"
              onClick={submit}
              disabled={loading || rating === 0}
            >
              {loading ? "Envoi..." : "Envoyer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlatformReviewModal;
