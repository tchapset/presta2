import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Phone, PhoneOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

// Generate ringtone
const playRingtone = () => {
  if (localStorage.getItem("call-ringtone-disabled") === "true") return () => {};
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let stopped = false;
  const playTone = (freq: number, startTime: number, duration: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  };
  let iteration = 0;
  const ringInterval = setInterval(() => {
    if (stopped) return;
    const now = ctx.currentTime;
    playTone(440, now, 0.4);
    playTone(480, now, 0.4);
    playTone(440, now + 0.5, 0.4);
    playTone(480, now + 0.5, 0.4);
    iteration++;
    if (iteration > 15) { clearInterval(ringInterval); stopped = true; }
  }, 2000);
  return () => { stopped = true; clearInterval(ringInterval); ctx.close().catch(() => {}); };
};

const GlobalCallListener = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState<{
    from: string;
    missionId: string;
    callerName: string;
    offer: RTCSessionDescriptionInit;
    createdAt: number;
  } | null>(null);
  const stopRingtoneRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`global-calls-${user.id}`);

    channel
      .on("broadcast", { event: "incoming-call" }, ({ payload }) => {
        if (payload.to !== user.id) return;
        if (window.location.pathname === `/messages/${payload.missionId}`) return;
        // Start ringtone
        stopRingtoneRef.current = playRingtone();
        setIncoming({
          from: payload.from,
          missionId: payload.missionId,
          callerName: payload.callerName || "Appel entrant",
          offer: payload.offer,
          createdAt: payload.createdAt ?? Date.now(),
        });
        setTimeout(() => {
          setIncoming(null);
          if (stopRingtoneRef.current) { stopRingtoneRef.current(); stopRingtoneRef.current = null; }
        }, 30000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const decline = useCallback(() => {
    if (stopRingtoneRef.current) { stopRingtoneRef.current(); stopRingtoneRef.current = null; }
    setIncoming(null);
  }, []);

  const accept = useCallback(() => {
    if (!incoming) return;
    if (stopRingtoneRef.current) { stopRingtoneRef.current(); stopRingtoneRef.current = null; }

    const pendingPayload = {
      missionId: incoming.missionId,
      from: incoming.from,
      offer: incoming.offer,
      createdAt: incoming.createdAt,
    };

    // Store pending call so AudioCall can recover it after navigation/mount
    sessionStorage.setItem("pendingIncomingCall", JSON.stringify(pendingPayload));
    (window as any).__pendingIncomingCall = pendingPayload;

    navigate(`/messages/${incoming.missionId}`);
    setIncoming(null);
  }, [incoming, navigate]);

  const initials = incoming?.callerName?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "??";

  return (
    <AnimatePresence>
      {incoming && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
          style={{
            background: "linear-gradient(165deg, hsl(var(--background)) 0%, hsl(145 60% 28% / 0.12) 50%, hsl(var(--background)) 100%)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="relative mb-8">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
                style={{ width: 96, height: 96, top: -8, left: -8 }}
              />
            ))}
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg relative z-10"
            >
              <span className="text-primary-foreground text-2xl font-bold font-display">{initials}</span>
            </motion.div>
          </div>

          <p className="text-2xl font-display font-bold text-foreground mb-1">{incoming.callerName}</p>
          <p className="text-muted-foreground text-sm mb-10">Appel audio entrant…</p>

          <div className="flex items-center gap-10">
            <div className="flex flex-col items-center gap-2">
              <button onClick={decline} className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95">
                <PhoneOff className="w-7 h-7 text-destructive-foreground" />
              </button>
              <span className="text-xs text-muted-foreground">Refuser</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <motion.button
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                onClick={accept}
                className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <Phone className="w-7 h-7 text-primary-foreground" />
              </motion.button>
              <span className="text-xs text-muted-foreground">Répondre</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalCallListener;
