import { useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, Camera, FileCheck, CheckCircle, Clock, AlertTriangle, Upload } from "lucide-react";
import { motion } from "framer-motion";
import LoadingScreen from "@/components/LoadingScreen";

const Verification = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const idDocRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile-verification", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("verification_level, phone_verified, phone, full_name")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
  });

  const { data: verificationRequest } = useQuery({
    queryKey: ["verification-request", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("verification_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const submitVerification = useMutation({
    mutationFn: async () => {
      if (!idDocFile || !selfieFile) throw new Error("Veuillez fournir les deux photos");
      setUploading(true);

      const idPath = `${user!.id}/id-document-${Date.now()}.${idDocFile.name.split(".").pop()}`;
      const selfiePath = `${user!.id}/selfie-${Date.now()}.${selfieFile.name.split(".").pop()}`;

      const [idUpload, selfieUpload] = await Promise.all([
        supabase.storage.from("verification-docs").upload(idPath, idDocFile),
        supabase.storage.from("verification-docs").upload(selfiePath, selfieFile),
      ]);

      if (idUpload.error) throw new Error("Erreur upload pièce d'identité");
      if (selfieUpload.error) throw new Error("Erreur upload selfie");

      const { error: insertErr } = await supabase.from("verification_requests").insert({
        user_id: user!.id,
        level: 2,
        status: "pending",
        id_document_url: idPath,
        selfie_url: selfiePath,
      } as any);

      if (insertErr) throw new Error("Erreur création de la demande");

      toast.success("Demande envoyée ! Un administrateur va examiner vos documents.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["verification-request"] });
      queryClient.invalidateQueries({ queryKey: ["profile-verification"] });
      setIdDocFile(null);
      setSelfieFile(null);
      setUploading(false);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setUploading(false);
    },
  });

  if (authLoading || profileLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  const currentLevel = (profile as any)?.verification_level || 0;
  const requestStatus = verificationRequest?.status || null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-7 h-7 text-primary" />
              <h1 className="text-3xl font-display font-bold text-foreground">Vérification d'identité</h1>
            </div>
            <p className="text-muted-foreground mb-8">
              Soumettez vos documents pour vérification. Un administrateur examinera votre demande.
            </p>

            {/* Verification: ID + Selfie */}
            <div className={`bg-card rounded-2xl border p-6 mb-6 ${currentLevel >= 2 ? "border-primary/30" : "border-border"}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentLevel >= 2 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Camera className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display font-bold text-foreground">Vérification d'identité</h2>
                  <p className="text-xs text-muted-foreground">Pièce d'identité + Selfie — examiné par un administrateur</p>
                </div>
                {currentLevel >= 2 && <CheckCircle className="w-6 h-6 text-primary" />}
                {requestStatus === "pending" && <Clock className="w-6 h-6 text-muted-foreground" />}
              </div>

              {currentLevel >= 2 ? (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <CheckCircle className="w-4 h-4" />
                  Identité vérifiée par un administrateur
                </div>
              ) : requestStatus === "pending" ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  Demande en attente de validation par un administrateur...
                </div>
              ) : requestStatus === "rejected" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4" />
                    Vérification refusée : {verificationRequest?.rejection_reason || "Les documents ne sont pas conformes."}
                  </div>
                  <p className="text-xs text-muted-foreground">Vous pouvez soumettre de nouveaux documents ci-dessous.</p>
                </div>
              ) : null}

              {currentLevel < 2 && requestStatus !== "pending" && (
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <FileCheck className="w-4 h-4 text-primary" />
                      Pièce d'identité (CNI, Passeport, Permis)
                    </Label>
                    <input
                      ref={idDocRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setIdDocFile(e.target.files?.[0] || null)}
                    />
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => idDocRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" />
                      {idDocFile ? idDocFile.name : "Choisir une photo de votre pièce d'identité"}
                    </Button>
                  </div>

                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <Camera className="w-4 h-4 text-primary" />
                      Selfie avec la pièce d'identité
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Prenez un selfie en tenant votre pièce d'identité à côté de votre visage.
                    </p>
                    <input
                      ref={selfieRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                    />
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => selfieRef.current?.click()}
                    >
                      <Camera className="w-4 h-4" />
                      {selfieFile ? selfieFile.name : "Prendre un selfie"}
                    </Button>
                  </div>

                  <Button
                    variant="hero"
                    className="w-full"
                    disabled={!idDocFile || !selfieFile || uploading}
                    onClick={() => submitVerification.mutate()}
                  >
                    {uploading ? "Envoi en cours..." : "Soumettre pour vérification par l'admin"}
                  </Button>
                </div>
              )}
            </div>

            {/* Benefits */}
            <div className="bg-muted/50 rounded-2xl p-6">
              <h3 className="font-display font-bold text-foreground mb-3">Avantages de la vérification</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">✓</span>
                  Badge "Identité vérifiée" sur votre profil
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">★</span>
                  Priorité dans les résultats de recherche
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">🤝</span>
                  Plus de confiance de la part des clients
                </li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Verification;