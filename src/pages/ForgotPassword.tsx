import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { toast } from "sonner";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Email envoyé ! Vérifiez votre boîte de réception.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-10 h-10 rounded-lg bg-gradient-hero flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-display font-bold text-foreground">
            PRESTA<span className="text-gradient-gold">237</span>
          </span>
        </Link>

        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          {sent ? (
            <>
              <h1 className="text-2xl font-display font-bold text-foreground mb-2">Email envoyé !</h1>
              <p className="text-muted-foreground mb-6">Vérifiez votre boîte de réception pour réinitialiser votre mot de passe.</p>
              <Link to="/auth">
                <Button variant="outline">Retour à la connexion</Button>
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-display font-bold text-foreground mb-2">Mot de passe oublié</h1>
              <p className="text-sm text-muted-foreground mb-6">Entrez votre email pour recevoir un lien de réinitialisation.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="text-left">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Envoi..." : "Envoyer le lien"}
                </Button>
              </form>
              <Link to="/auth" className="text-sm text-primary hover:underline mt-4 block">
                Retour à la connexion
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
