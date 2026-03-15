import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Smartphone, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const operators = [
  { name: "MTN Mobile Money", color: "bg-yellow-400 text-yellow-900" },
  { name: "Orange Money", color: "bg-orange-500 text-white" },
];

interface WalletRechargeProps {
  trigger?: React.ReactNode;
}

const WalletRecharge = ({ trigger }: WalletRechargeProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState("");
  const [loading, setLoading] = useState(false);

  const quickAmounts = [1000, 2000, 5000, 10000, 25000, 50000];

  const handleSubmit = () => {
    if (!amount || !phone || !operator) return toast.error("Remplissez tous les champs");
    if (Number(amount) < 500) return toast.error("Montant minimum : 500 FCFA");
    setStep("confirm");
  };

  const handleConfirm = () => {
    setLoading(true);
    // Simulate payment
    setTimeout(() => {
      setLoading(false);
      setStep("success");
    }, 2000);
  };

  const reset = () => {
    setStep("form");
    setAmount("");
    setPhone("");
    setOperator("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger || <Button variant="hero" size="sm">Recharger</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            {step === "success" ? "Paiement réussi" : "Recharger via Mobile Money"}
          </DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4 mt-2">
            <div>
              <Label>Opérateur</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {operators.map((op) => (
                  <button
                    key={op.name}
                    onClick={() => setOperator(op.name)}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      operator === op.name ? "border-primary" : "border-border"
                    }`}
                  >
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${op.color} mb-1`}>
                      {op.name.split(" ")[0]}
                    </span>
                    <p className="text-xs text-muted-foreground">{op.name}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Montant (FCFA)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000"
                min={500}
                className="mt-1"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {quickAmounts.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(String(a))}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      amount === String(a) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.toLocaleString()} F
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Numéro de téléphone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="6XX XXX XXX"
                className="mt-1"
              />
            </div>

            <Button className="w-full" variant="hero" onClick={handleSubmit}>
              Continuer
            </Button>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4 mt-2">
            <div className="bg-muted rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Opérateur</span><span className="font-semibold text-foreground">{operator}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Montant</span><span className="font-semibold text-foreground">{Number(amount).toLocaleString()} FCFA</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Téléphone</span><span className="font-semibold text-foreground">{phone}</span></div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Un prompt USSD sera envoyé sur votre téléphone pour confirmer le paiement.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("form")}>Retour</Button>
              <Button variant="hero" className="flex-1" onClick={handleConfirm} disabled={loading}>
                {loading ? "Traitement..." : "Confirmer"}
              </Button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-display font-bold text-lg text-foreground">{Number(amount).toLocaleString()} FCFA</p>
              <p className="text-sm text-muted-foreground">ajoutés à votre wallet</p>
            </div>
            <Button variant="hero" onClick={reset} className="w-full">Fermer</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WalletRecharge;
