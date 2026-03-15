import { useState, useEffect } from "react";
import { X, Download, Share, Monitor, Tablet, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("pwa-banner-dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 1 * 24 * 60 * 60 * 1000) return;

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    if (isStandalone) return;

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      setTimeout(() => setShowBanner(true), 3000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-banner-dismissed", String(Date.now()));
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={handleDismiss}
          />

          {/* Popup centrée — s'adapte à toutes les tailles d'écran */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="
              fixed left-1/2 top-1/2 z-50
              -translate-x-1/2 -translate-y-1/2
              w-[92vw]
              sm:w-[420px]
              md:w-[480px]
              lg:w-[520px]
            "
          >
            <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              {/* Header coloré */}
              <div className="bg-gradient-to-r from-primary/20 to-primary/5 px-6 pt-6 pb-4">
                <button
                  onClick={handleDismiss}
                  className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors rounded-full p-1 hover:bg-black/5"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 border border-primary/20">
                    <img src="/serviko-logo.png" alt="TKLINK" className="w-9 h-9 rounded-lg" onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-2xl">🔗</span>';
                    }} />
                  </div>
                  <div>
                    <p className="font-display font-bold text-foreground text-lg leading-tight">
                      Installer TKLINK
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Application gratuite
                    </p>
                  </div>
                </div>
              </div>

              {/* Corps */}
              <div className="px-6 py-4">
                {isIOS ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Installez TKLINK sur votre écran d'accueil pour un accès rapide :
                    </p>
                    <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                      <Share className="h-5 w-5 text-primary shrink-0" />
                      <p className="text-sm">
                        Appuyez sur <span className="font-semibold">Partager</span> puis{" "}
                        <span className="font-semibold">« Sur l'écran d'accueil »</span>
                      </p>
                    </div>
                    <Button className="w-full mt-2" onClick={handleDismiss}>
                      J'ai compris
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Accédez à TKLINK en un clic, même sans connexion internet.
                    </p>

                    {/* Avantages */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-muted/50 p-3 flex flex-col items-center gap-1.5">
                        <Smartphone className="h-5 w-5 text-primary" />
                        <span className="text-xs text-muted-foreground">Mobile</span>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-3 flex flex-col items-center gap-1.5">
                        <Tablet className="h-5 w-5 text-primary" />
                        <span className="text-xs text-muted-foreground">Tablette</span>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-3 flex flex-col items-center gap-1.5">
                        <Monitor className="h-5 w-5 text-primary" />
                        <span className="text-xs text-muted-foreground">PC</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={handleDismiss}>
                        Plus tard
                      </Button>
                      <Button className="flex-1" onClick={handleInstall}>
                        <Download className="h-4 w-4 mr-2" />
                        Installer
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
