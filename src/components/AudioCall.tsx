import { useState, useEffect, useRef, useCallback } from "react";
import { Phone, PhoneOff, PhoneCall, Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface AudioCallProps {
  missionId: string;
  otherUserId: string;
  otherUserName: string;
}

type CallState = "idle" | "calling" | "ringing" | "connected" | "ended";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

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

const AudioCall = ({ missionId, otherUserId, otherUserName }: AudioCallProps) => {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unansweredTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRingtoneRef = useRef<(() => void) | null>(null);
  const callStateRef = useRef<CallState>("idle");
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingFromRef = useRef<string | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const hasRemoteAnsweredRef = useRef(false);
  const channelReadyRef = useRef(false);

  const channelName = `call-${[user?.id, otherUserId].sort().join("-")}-${missionId}`;
  const initials = otherUserName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  const clearPendingIncomingCall = useCallback(() => {
    pendingOfferRef.current = null;
    pendingFromRef.current = null;
    sessionStorage.removeItem("pendingIncomingCall");
    delete (window as any).__pendingIncomingCall;
  }, []);

  const clearUnansweredTimeout = useCallback(() => {
    if (unansweredTimeoutRef.current) {
      clearTimeout(unansweredTimeoutRef.current);
      unansweredTimeoutRef.current = null;
    }
  }, []);

  const flushPendingIceCandidates = useCallback(async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription || pendingIceCandidatesRef.current.length === 0) return;

    const queued = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("ICE candidate flush failed", error);
      }
    }
  }, []);

  const applyPendingIncomingCall = useCallback((payload: any) => {
    if (!payload || payload.missionId !== missionId) return false;
    if (!payload.offer?.type || !payload.offer?.sdp) return false;

    // Ignore stale offers (older than ~120s to give time for navigation)
    if (payload.createdAt && Date.now() - payload.createdAt > 120000) {
      clearPendingIncomingCall();
      return false;
    }

    pendingOfferRef.current = payload.offer as RTCSessionDescriptionInit;
    pendingFromRef.current = payload.from ?? null;
    (window as any).__pendingIncomingCall = payload;
    return true;
  }, [missionId, clearPendingIncomingCall]);

  const hydratePendingOffer = useCallback(() => {
    if (pendingOfferRef.current?.type && pendingOfferRef.current?.sdp) return true;

    const inMemory = (window as any).__pendingIncomingCall;
    if (applyPendingIncomingCall(inMemory)) return true;

    const raw = sessionStorage.getItem("pendingIncomingCall");
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw);
      return applyPendingIncomingCall(parsed);
    } catch {
      return false;
    }
  }, [applyPendingIncomingCall]);

  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    clearUnansweredTimeout();
    if (stopRingtoneRef.current) { stopRingtoneRef.current(); stopRingtoneRef.current = null; }
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    peerConnection.current?.close();
    peerConnection.current = null;
    pendingIceCandidatesRef.current = [];
    hasRemoteAnsweredRef.current = false;
    setCallDuration(0);
    setIsMuted(false);
    setIsSpeaker(false);
  }, [clearUnansweredTimeout]);

  const setupPeerConnection = useCallback(async () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnection.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.current = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      if (remoteAudio.current) {
        remoteAudio.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: event.candidate, from: user!.id },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        clearUnansweredTimeout();
        if (stopRingtoneRef.current) { stopRingtoneRef.current(); stopRingtoneRef.current = null; }
        setCallState("connected");
        timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
      } else if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        if (pc.connectionState === "failed" && hasRemoteAnsweredRef.current) {
          toast.error("Connexion audio impossible");
        }
        setCallState("ended");
        cleanup();
      }
    };

    return pc;
  }, [user, cleanup, clearUnansweredTimeout]);

  useEffect(() => {
    if (!user) return;
    channelReadyRef.current = false;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "call-offer" }, async ({ payload }) => {
        if (payload.to !== user.id) return;
        applyPendingIncomingCall({
          missionId,
          from: payload.from,
          offer: payload.offer,
          createdAt: payload.createdAt ?? Date.now(),
        });
        if (stopRingtoneRef.current) stopRingtoneRef.current();
        stopRingtoneRef.current = playRingtone();
        setCallState("ringing");
      })
      .on("broadcast", { event: "call-answer" }, async ({ payload }) => {
        if (payload.to !== user.id) return;

        hasRemoteAnsweredRef.current = true;
        clearUnansweredTimeout();

        if (stopRingtoneRef.current) { stopRingtoneRef.current(); stopRingtoneRef.current = null; }

        const pc = peerConnection.current;
        if (!pc) return;

        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        await flushPendingIceCandidates(pc);
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.from === user.id || !payload.candidate) return;
        const pc = peerConnection.current;
        if (!pc) return;

        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (error) {
            console.warn("ICE candidate rejected", error);
          }
          return;
        }

        pendingIceCandidatesRef.current.push(payload.candidate as RTCIceCandidateInit);
      })
      .on("broadcast", { event: "call-end" }, async ({ payload }) => {
        if (payload.from === user.id) return;
        if (stopRingtoneRef.current) { stopRingtoneRef.current(); stopRingtoneRef.current = null; }
        const wasConnected = callStateRef.current === "connected" || peerConnection.current?.connectionState === "connected";
        setCallState("idle");
        cleanup();
        clearPendingIncomingCall();
        if (payload.duration && payload.duration > 0) {
          toast.info(`Appel terminé`);
        } else if (!wasConnected) {
          toast.info("Appel manqué");
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channelReadyRef.current = true;

          // Recover pending call if user accepted from global incoming overlay
          const hasPending = hydratePendingOffer();
          if (hasPending && callStateRef.current === "idle") {
            if (stopRingtoneRef.current) stopRingtoneRef.current();
            stopRingtoneRef.current = playRingtone();
            setCallState("ringing");
          }
          return;
        }

        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          channelReadyRef.current = false;
        }
      });

    return () => {
      channelReadyRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [
    user,
    channelName,
    cleanup,
    missionId,
    applyPendingIncomingCall,
    hydratePendingOffer,
    clearPendingIncomingCall,
    clearUnansweredTimeout,
    flushPendingIceCandidates,
  ]);

  const startCall = async () => {
    try {
      if (!channelReadyRef.current || !channelRef.current) {
        toast.error("Initialisation de l'appel en cours, réessaie dans 1s");
        return;
      }

      hasRemoteAnsweredRef.current = false;
      clearUnansweredTimeout();
      setCallState("calling");
      stopRingtoneRef.current = playRingtone();

      const pc = await setupPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const createdAt = Date.now();

      const offerStatus = await channelRef.current.send({
        type: "broadcast",
        event: "call-offer",
        payload: { offer, from: user!.id, to: otherUserId, createdAt },
      });

      if (offerStatus !== "ok") {
        throw new Error("offer_not_sent");
      }

      const globalChannel = supabase.channel(`global-calls-${otherUserId}`);
      globalChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          globalChannel.send({
            type: "broadcast",
            event: "incoming-call",
            payload: {
              from: user!.id,
              to: otherUserId,
              missionId,
              callerName: user!.user_metadata?.full_name || "Appelant",
              offer,
              createdAt,
            },
          });
          setTimeout(() => supabase.removeChannel(globalChannel), 2000);
        }
      });

      await supabase.from("notifications").insert({
        user_id: otherUserId,
        title: "Appel entrant",
        message: `Appel audio en cours...`,
        type: "call",
        link: `/messages/${missionId}`,
      });

      unansweredTimeoutRef.current = setTimeout(() => {
        if (!hasRemoteAnsweredRef.current && callStateRef.current === "calling") {
          endCall();
          toast.error("Pas de réponse");
        }
      }, 30000);
    } catch {
      toast.error("Impossible de lancer l'appel");
      setCallState("idle");
      cleanup();
    }
  };

  const acceptCall = async () => {
    try {
      if (stopRingtoneRef.current) { stopRingtoneRef.current(); stopRingtoneRef.current = null; }

      const hasOffer = hydratePendingOffer();
      if (!hasOffer) {
        toast.error("L'offre d'appel a expiré");
        setCallState("idle");
        return;
      }

      const pc = await setupPeerConnection();
      const offer = pendingOfferRef.current;
      if (!offer) {
        toast.error("L'offre d'appel a expiré");
        setCallState("idle");
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingIceCandidates(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const answerStatus = await channelRef.current?.send({
        type: "broadcast",
        event: "call-answer",
        payload: { answer, from: user!.id, to: otherUserId },
      });

      if (answerStatus !== "ok") {
        throw new Error("answer_not_sent");
      }

      hasRemoteAnsweredRef.current = true;
      setCallState("calling");
      clearPendingIncomingCall();
    } catch (err) {
      console.error("Accept call error:", err);
      toast.error("Erreur lors de la connexion");
      setCallState("idle");
      cleanup();
    }
  };

  const endCall = async () => {
    clearUnansweredTimeout();
    if (stopRingtoneRef.current) { stopRingtoneRef.current(); stopRingtoneRef.current = null; }
    clearPendingIncomingCall();
    const duration = callDuration;
    channelRef.current?.send({
      type: "broadcast",
      event: "call-end",
      payload: { from: user!.id, duration },
    });
    if (duration > 0) {
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const durationStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      await supabase.from("messages").insert({
        mission_id: missionId,
        sender_id: user!.id,
        content: `📞 Appel audio • ${durationStr}`,
      });
    } else {
      await supabase.from("messages").insert({
        mission_id: missionId,
        sender_id: user!.id,
        content: `📞 Appel manqué`,
      });
    }
    setCallState("idle");
    cleanup();
  };

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsMuted(!isMuted);
    }
  };

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const pulseRings = [0, 1, 2];

  return (
    <>
      <audio ref={remoteAudio} autoPlay />

      {callState === "idle" && (
        <Button variant="ghost" size="icon" onClick={startCall} title="Appeler" className="relative group">
          <Phone className="w-4 h-4 text-primary transition-transform group-hover:scale-110" />
        </Button>
      )}

      <AnimatePresence>
        {callState === "ringing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
            style={{
              background: "linear-gradient(165deg, hsl(var(--background)) 0%, hsl(145 60% 28% / 0.12) 50%, hsl(var(--background)) 100%)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="relative mb-8">
              {pulseRings.map((i) => (
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
                style={{ boxShadow: "0 0 40px hsl(145 60% 28% / 0.35)" }}
              >
                <span className="text-primary-foreground text-2xl font-bold font-display">{initials}</span>
              </motion.div>
            </div>

            <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-2xl font-display font-bold text-foreground mb-1">
              {otherUserName}
            </motion.p>
            <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }} className="text-muted-foreground text-sm mb-10">
              Appel audio entrant…
            </motion.p>

            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="flex items-center gap-10">
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => { if (stopRingtoneRef.current) { stopRingtoneRef.current(); stopRingtoneRef.current = null; } setCallState("idle"); cleanup(); clearPendingIncomingCall(); channelRef.current?.send({ type: "broadcast", event: "call-end", payload: { from: user!.id } }); }}
                  className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                  style={{ boxShadow: "0 4px 20px hsl(0 84% 60% / 0.4)" }}
                >
                  <PhoneOff className="w-7 h-7 text-destructive-foreground" />
                </button>
                <span className="text-xs text-muted-foreground">Refuser</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  onClick={acceptCall}
                  className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                  style={{ boxShadow: "0 4px 20px hsl(145 60% 28% / 0.4)" }}
                >
                  <Phone className="w-7 h-7 text-primary-foreground" />
                </motion.button>
                <span className="text-xs text-muted-foreground">Accepter</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(callState === "calling" || callState === "connected") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
            style={{
              background: callState === "connected"
                ? "linear-gradient(165deg, hsl(var(--background)) 0%, hsl(145 60% 28% / 0.08) 50%, hsl(var(--background)) 100%)"
                : "linear-gradient(165deg, hsl(var(--background)) 0%, hsl(40 70% 55% / 0.08) 50%, hsl(var(--background)) 100%)",
              backdropFilter: "blur(20px)",
            }}
          >
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="relative mb-8">
              {callState === "connected" && (
                <motion.div className="absolute -inset-3 rounded-full border-2 border-primary/20" animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} />
              )}
              <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl ${callState === "connected" ? "bg-gradient-to-br from-primary to-primary/70" : "bg-gradient-to-br from-secondary to-secondary/70"}`}>
                <span className="text-primary-foreground text-3xl font-bold font-display">{initials}</span>
              </div>
            </motion.div>

            <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="text-2xl font-display font-bold text-foreground mb-1">
              {otherUserName}
            </motion.p>

            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center gap-2 mb-12">
              {callState === "calling" ? (
                <>
                  <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2 h-2 rounded-full bg-secondary" />
                  <span className="text-muted-foreground text-sm">Appel en cours…</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-primary font-mono text-lg font-semibold tracking-wider">{formatDuration(callDuration)}</span>
                </>
              )}
            </motion.div>

            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45, type: "spring" }} className="flex items-center gap-5">
              {callState === "connected" && (
                <>
                  <div className="flex flex-col items-center gap-1.5">
                    <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? "bg-destructive/20 text-destructive" : "bg-muted text-foreground"}`}>
                      {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>
                    <span className="text-[10px] text-muted-foreground">{isMuted ? "Unmute" : "Mute"}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <button onClick={() => setIsSpeaker(!isSpeaker)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isSpeaker ? "bg-primary/20 text-primary" : "bg-muted text-foreground"}`}>
                      <Volume2 className="w-6 h-6" />
                    </button>
                    <span className="text-[10px] text-muted-foreground">Speaker</span>
                  </div>
                </>
              )}
              <div className="flex flex-col items-center gap-1.5">
                <button onClick={endCall} className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95" style={{ boxShadow: "0 4px 20px hsl(0 84% 60% / 0.4)" }}>
                  <PhoneOff className="w-6 h-6 text-destructive-foreground" />
                </button>
                <span className="text-[10px] text-muted-foreground">Raccrocher</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AudioCall;
