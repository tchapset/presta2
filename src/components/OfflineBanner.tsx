import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi } from "lucide-react";

const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -60 }}
          animate={{ y: 0 }}
          exit={{ y: -60 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <WifiOff className="w-4 h-4" />
          Connexion perdue — Vérifiez votre réseau
        </motion.div>
      )}
      {isOnline && showReconnected && (
        <motion.div
          initial={{ y: -60 }}
          animate={{ y: 0 }}
          exit={{ y: -60 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-green-600 text-white py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Wifi className="w-4 h-4" />
          Connexion rétablie ✓
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
