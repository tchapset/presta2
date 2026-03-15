import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ReviewModalProps {
  reviewedId: string;
  missionId?: string;
  trigger?: React.ReactNode;
}

const ReviewModal = ({ reviewedId, missionId, trigger }: ReviewModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!user || rating === 0) return toast.error("Veuillez donner une note");
    setLoading(true);
    try {
      const insertData: any = {
        reviewer_id: user.id,
        reviewed_id: reviewedId,
        rating,
        comment: comment.trim() || null,
      };
      if (missionId) insertData.mission_id = missionId;
      const { error } = await supabase.from("reviews").insert(insertData);
      if (error) throw error;
      toast.success("Avis publié !");
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      setOpen(false);
      setRating(0);
      setComment("");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="hero" size="sm">
            <Star className="w-4 h-4 mr-2" /> Écrire un avis
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Donner votre avis</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(n)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    n <= (hovered || rating) ? "text-gold fill-gold" : "text-muted"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {rating === 0 ? "Cliquez pour noter" : `${rating}/5 étoiles`}
          </p>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Décrivez votre expérience..."
            rows={4}
          />
          <Button className="w-full" variant="hero" onClick={submit} disabled={loading || rating === 0}>
            {loading ? "Publication..." : "Publier l'avis"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewModal;
