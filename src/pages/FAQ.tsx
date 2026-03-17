import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { HelpCircle, Send, MessageSquare, Shield, CreditCard, Search, UserCheck } from "lucide-react";
import { motion } from "framer-motion";
import BackToTop from "@/components/BackToTop";

const faqSections = [
  {
    title: "Général",
    icon: HelpCircle,
    questions: [
      {
        q: "Qu'est-ce que PRESTA237 ?",
        a: "PRESTA237 est une plateforme de mise en relation entre clients et prestataires de services locaux au Cameroun. Elle permet de trouver, contacter et évaluer des professionnels vérifiés.",
      },
      {
        q: "L'inscription est-elle gratuite ?",
        a: "Oui, l'inscription est entièrement gratuite pour les clients et les prestataires. Les prestataires peuvent opter pour un abonnement Premium pour plus de visibilité.",
      },
      {
        q: "Dans quelles villes PRESTA237 est-il disponible ?",
        a: "PRESTA237 est disponible dans les principales villes du Cameroun : Douala, Yaoundé, Bafoussam, Bamenda, Garoua, Maroua, Bertoua, Kribi, Limbé et Buéa.",
      },
    ],
  },
  {
    title: "Recherche & Contact",
    icon: Search,
    questions: [
      {
        q: "Comment trouver un prestataire ?",
        a: "Utilisez la barre de recherche ou la page Recherche pour filtrer par catégorie de service, ville, disponibilité et distance. Vous pouvez aussi consulter les avis et notes avant de faire votre choix.",
      },
      {
        q: "Comment contacter un prestataire ?",
        a: "Depuis le profil d'un prestataire, cliquez sur « Contacter ». Une conversation sera créée et vous pourrez échanger par messages, envoyer des photos et passer des appels audio.",
      },
      {
        q: "Puis-je voir les avis avant de choisir ?",
        a: "Oui, chaque profil prestataire affiche les avis des clients précédents avec la note moyenne et les commentaires détaillés.",
      },
    ],
  },
  {
    title: "Missions & Paiement",
    icon: CreditCard,
    questions: [
      {
        q: "Comment créer une mission ?",
        a: "Allez dans votre tableau de bord et cliquez « Nouvelle mission ». Décrivez votre besoin, choisissez une catégorie, un montant et sélectionnez un prestataire.",
      },
      {
        q: "Comment se passe le paiement ?",
        a: "Les montants sont gérés via le portefeuille PRESTA237. Un acompte est retenu en garantie et le solde est libéré une fois que les deux parties confirment la fin de la mission.",
      },
      {
        q: "Que se passe-t-il en cas de litige ?",
        a: "En cas de désaccord, vous pouvez signaler un litige depuis la page de la mission. Notre équipe d'administration examinera le cas et prendra une décision équitable.",
      },
    ],
  },
  {
    title: "Vérification & Sécurité",
    icon: Shield,
    questions: [
      {
        q: "Comment vérifier mon identité ?",
        a: "Rendez-vous dans Réglages → Vérifier mon identité. Soumettez votre pièce d'identité et un selfie. Notre système IA compare les deux photos et un administrateur valide la demande.",
      },
      {
        q: "Que signifie le badge « Identité vérifiée » ?",
        a: "Ce badge indique que le prestataire a passé avec succès la vérification d'identité (pièce d'identité + selfie). C'est un gage de confiance supplémentaire.",
      },
      {
        q: "Comment signaler un comportement abusif ?",
        a: "Sur le profil de l'utilisateur, cliquez sur « Signaler ». Choisissez un motif et décrivez la situation. Notre équipe de modération traitera votre signalement.",
      },
    ],
  },
  {
    title: "Compte Prestataire",
    icon: UserCheck,
    questions: [
      {
        q: "Comment devenir prestataire ?",
        a: "Lors de votre inscription, choisissez le rôle « Prestataire » ou « Les deux ». Complétez ensuite votre profil avec vos services, votre zone d'intervention et votre expérience.",
      },
      {
        q: "Comment améliorer ma visibilité ?",
        a: "Complétez votre profil à 100%, obtenez le badge « Identité vérifiée », répondez rapidement aux messages et collectez des avis positifs. L'abonnement Premium vous met en avant dans les recherches.",
      },
      {
        q: "Comment gérer mes missions ?",
        a: "Depuis votre tableau de bord, vous pouvez voir toutes vos missions, accepter ou refuser de nouvelles demandes, et confirmer l'achèvement des travaux.",
      },
    ],
  },
];

const FAQ = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const submitTicket = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
        throw new Error("Veuillez remplir tous les champs");
      }
      const { error } = await supabase.from("support_tickets" as any).insert({
        user_id: user?.id || null,
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Votre message a été envoyé ! Nous vous répondrons rapidement.");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="FAQ & Support - PRESTA237"
        description="Trouvez des réponses à vos questions sur PRESTA237. Centre d'aide et support client pour la plateforme de services au Cameroun."
      />
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
                Centre d'aide
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Trouvez rapidement des réponses à vos questions ou contactez notre équipe de support.
              </p>
            </div>

            {/* FAQ Sections */}
            <div className="space-y-8 mb-16">
              {faqSections.map((section, sIdx) => (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: sIdx * 0.1 }}
                  className="bg-card rounded-2xl border border-border p-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <section.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-lg font-display font-bold text-foreground">{section.title}</h2>
                  </div>
                  <Accordion type="single" collapsible className="w-full">
                    {section.questions.map((item, qIdx) => (
                      <AccordionItem key={qIdx} value={`${sIdx}-${qIdx}`}>
                        <AccordionTrigger className="text-sm font-medium text-foreground hover:text-primary">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                          {item.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </motion.div>
              ))}
            </div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-card rounded-2xl border border-border p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-foreground">Contactez-nous</h2>
                  <p className="text-xs text-muted-foreground">Vous n'avez pas trouvé de réponse ? Écrivez-nous.</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label>Nom</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" className="mt-1" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" className="mt-1" />
                </div>
              </div>
              <div className="mb-4">
                <Label>Sujet</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="De quoi s'agit-il ?" className="mt-1" />
              </div>
              <div className="mb-4">
                <Label>Message</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Décrivez votre problème ou question..." className="mt-1" rows={4} />
              </div>
              <Button
                onClick={() => submitTicket.mutate()}
                disabled={submitTicket.isPending}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                {submitTicket.isPending ? "Envoi..." : "Envoyer le message"}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
      <Footer />
      <BackToTop />
    </div>
  );
};

export default FAQ;
