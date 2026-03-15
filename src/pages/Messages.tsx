import { useState, useEffect, useRef, useCallback, TouchEvent as ReactTouchEvent } from "react";
import { sendPushToUser } from "@/hooks/usePushNotifications";
import { useParams, Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import AudioCall from "@/components/AudioCall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Send, AlertTriangle, ArrowLeft, Paperclip, FileText, Check, CheckCheck, Mic, Square, BellOff, Bell, ChevronRight, Reply, X, Trash2, Navigation } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const BYPASS_PATTERNS = /(\+?237|whatsapp|appel|telegram|signal|call\s*me|mon\s*num|num[ée]ro|t[ée]l[ée]phone|\d{8,})/i;

const isOnline = (lastSeen: string | null | undefined) => {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
};

const statusLabels: Record<string, string> = {
  pending: "En attente",
  accepted: "Accepté",
  in_progress: "En cours",
  completed: "Terminé",
  disputed: "Litige",
  cancelled: "Annulé",
};

const getCompletionPercentage = (mission: any): number => {
  switch (mission.status) {
    case "pending": return 0;
    case "accepted": return 25;
    case "in_progress": {
      const providerConfirmed = !!mission.provider_confirmed_at;
      const clientConfirmed = !!mission.client_confirmed_at;
      if (providerConfirmed && clientConfirmed) return 100;
      if (providerConfirmed || clientConfirmed) return 75;
      return 50;
    }
    case "completed": return 100;
    case "cancelled": return 0;
    case "disputed": return 50;
    default: return 0;
  }
};

const triggerHaptic = () => {
  if (navigator.vibrate) {
    navigator.vibrate(30);
  }
};

const Messages = () => {
  const { missionId } = useParams<{ missionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [bypassWarning, setBypassWarning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [otherTyping, setOtherTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; senderName: string } | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem("notifs-disabled") !== "true";
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; msgId: string } | null>(null);
  const readReceiptsEnabled = localStorage.getItem("privacy-read-receipts-disabled") !== "true";
  const queryClient = useQueryClient();

  const { data: mission } = useQuery({
    queryKey: ["mission", missionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("missions").select("*").eq("id", missionId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", missionId],
    enabled: !!missionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages").select("*")
        .eq("mission_id", missionId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const otherUserId = mission && user ? (user.id === mission.client_id ? mission.provider_id : mission.client_id) : null;

  const { data: otherProfile } = useQuery({
    queryKey: ["other-profile", otherUserId],
    enabled: !!otherUserId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, avatar_url, welcome_message, last_seen_at, latitude, longitude").eq("user_id", otherUserId!).single();
      return data;
    },
  });

  // Mark messages as read
  useEffect(() => {
    if (!messages || !user || !missionId || !readReceiptsEnabled) return;
    const unread = messages.filter(m => m.sender_id !== user.id && !m.is_read);
    if (unread.length === 0) return;
    const ids = unread.map(m => m.id);
    supabase.from("messages").update({ is_read: true }).in("id", ids).then(() => {
      queryClient.invalidateQueries({ queryKey: ["messages", missionId] });
    });
  }, [messages, user, missionId]);

  const welcomeMessage = (() => {
    if (!mission || !user || !otherProfile?.welcome_message) return null;
    const isClient = user.id === mission.client_id;
    if (!isClient) return null;
    if (messages && messages.length > 0) return null;
    return {
      id: "welcome-local",
      sender_id: mission.provider_id,
      content: otherProfile.welcome_message,
      created_at: mission.created_at,
      is_read: true,
      has_image: false,
      image_url: null,
      mission_id: missionId,
    };
  })();

  // Auto-accept mission when provider sends first message
  useEffect(() => {
    if (!mission || !user || !messages) return;
    const isProvider = user.id === mission.provider_id;
    if (isProvider && mission.status === "pending" && messages.some(m => m.sender_id === user.id)) {
      supabase.from("missions").update({ status: "accepted" as any }).eq("id", missionId!).then(() => {
        queryClient.invalidateQueries({ queryKey: ["mission", missionId] });
      });
    }
  }, [mission, user, messages]);

  // Realtime subscription
  useEffect(() => {
    if (!missionId) return;
    const channel = supabase
      .channel(`messages-${missionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `mission_id=eq.${missionId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages", missionId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [missionId, queryClient]);

  // Typing indicator via Realtime presence
  useEffect(() => {
    if (!missionId || !user) return;
    const channel = supabase.channel(`typing-${missionId}`, {
      config: { presence: { key: user.id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const others = Object.keys(state).filter(k => k !== user.id);
      const typing = others.some(k => (state[k] as any)?.[0]?.typing === true);
      setOtherTyping(typing);
    });

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [missionId, user]);

  const sendTypingIndicator = useCallback(() => {
    if (!missionId || !user) return;
    const channel = supabase.channel(`typing-${missionId}`);
    channel.track({ typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      channel.track({ typing: false });
    }, 2000);
  }, [missionId, user]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendNotification = async (content: string) => {
    if (!notificationsEnabled) return;
    if (!mission || !user) return;
    const recipientId = user.id === mission.client_id ? mission.provider_id : mission.client_id;
    if (!recipientId) return;
    await supabase.from("notifications").insert({
      user_id: recipientId,
      title: "Nouveau message",
      message: `${content.slice(0, 60)}...`,
      type: "message",
      link: `/messages/${missionId}`,
    });
    sendPushToUser(recipientId, "Nouveau message", content.slice(0, 100), `/messages/${missionId}`);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !missionId) return;
    if (BYPASS_PATTERNS.test(newMessage)) {
      setBypassWarning(true);
      toast.warning("⚠️ Partager des coordonnées avant le paiement de l'acompte est interdit.");
      return;
    }
    setSending(true);
    const contentToSend = replyTo
      ? `┃ ${replyTo.content}\n${newMessage.trim()}`
      : newMessage.trim();
    const { error } = await supabase.from("messages").insert({
      mission_id: missionId,
      sender_id: user.id,
      content: contentToSend,
    });
    if (error) {
      toast.error("Erreur d'envoi");
    } else {
      await sendNotification(newMessage.trim());
      setNewMessage("");
      setBypassWarning(false);
      setReplyTo(null);
    }
    setSending(false);
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!user) return;
    const { error } = await supabase.from("messages").delete().eq("id", msgId).eq("sender_id", user.id);
    if (error) {
      toast.error("Impossible de supprimer ce message");
    } else {
      queryClient.invalidateQueries({ queryKey: ["messages", missionId] });
      toast.success("Message supprimé");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !missionId) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${missionId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("message-attachments").upload(path, file);
    if (uploadError) {
      toast.error("Erreur d'upload");
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("message-attachments").getPublicUrl(path);
    const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes((ext || "").toLowerCase());
    const content = isImage ? " " : `📎 ${file.name}`;
    
    await supabase.from("messages").insert({
      mission_id: missionId,
      sender_id: user.id,
      content,
      has_image: isImage,
      image_url: publicUrl,
    });
    await sendNotification(isImage ? "Image" : file.name);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) { setRecording(false); setRecordingDuration(0); return; }
        await uploadVoiceMessage(blob);
        setRecording(false);
        setRecordingDuration(0);
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch {
      toast.error("Impossible d'accéder au microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const uploadVoiceMessage = async (blob: Blob) => {
    if (!user || !missionId) return;
    setUploading(true);
    const filename = `voice-${Date.now()}.webm`;
    const path = `${missionId}/${filename}`;
    const { error: uploadError } = await supabase.storage.from("message-attachments").upload(path, blob, { contentType: "audio/webm" });
    if (uploadError) {
      toast.error("Erreur d'envoi du message vocal");
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("message-attachments").getPublicUrl(path);
    await supabase.from("messages").insert({
      mission_id: missionId,
      sender_id: user.id,
      content: `🎤 Message vocal`,
      image_url: publicUrl,
      has_image: false,
    });
    await sendNotification("Message vocal");
    setUploading(false);
  };

  const toggleNotifications = () => {
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    localStorage.setItem("notifs-disabled", newVal ? "false" : "true");
    toast.success(newVal ? "Notifications activées" : "Notifications désactivées");
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Chargement...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const online = isOnline(otherProfile?.last_seen_at);
  const formatRecDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const completionPct = mission ? getCompletionPercentage(mission) : 0;
  const missionStatusLabel = mission ? (statusLabels[mission.status || "pending"] || mission.status) : "";

  return (
    <div className="h-[100dvh] bg-background flex flex-col">
      <Navbar />
      <div className="pt-16 flex-1 flex flex-col overflow-hidden">
        {/* Mission progress bar */}
        {mission && (
          <Link to={`/mission/${missionId}`} className="block border-b border-border bg-card/80 px-4 py-2.5 hover:bg-muted/50 transition-colors shrink-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">{mission.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{missionStatusLabel}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-primary">{completionPct}%</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </div>
            <Progress value={completionPct} className="h-1.5" />
          </Link>
        )}

        {/* Header */}
        <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-3 shrink-0">
          <Link to={`/mission/${missionId}`}><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold text-sm">
              {otherProfile?.full_name?.slice(0, 2).toUpperCase() || "??"}
            </div>
            {online && <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-card" />}
          </div>
          <div className="flex-1 min-w-0">
            <Link to={otherProfile?.id ? `/prestataire/${otherProfile.id}` : '#'} className="font-semibold text-sm text-foreground truncate hover:underline">{otherProfile?.full_name || "Conversation"}</Link>
            <p className="text-xs text-muted-foreground truncate">
              {otherTyping ? (
                <span className="text-primary font-medium">écrit...</span>
              ) : recording ? (
                <span className="text-destructive font-medium">🎤 enregistre un vocal...</span>
              ) : online ? (
                <span className="text-green-500 font-medium">En ligne</span>
              ) : otherProfile?.last_seen_at ? (
                `Vu ${formatDistanceToNow(new Date(otherProfile.last_seen_at), { addSuffix: true, locale: fr })}`
              ) : mission?.title}
            </p>
          </div>
          {/* Route to provider - always show if profile exists */}
          {otherProfile && (
            <Button variant="ghost" size="icon" onClick={() => {
              if (otherProfile.latitude && otherProfile.longitude) {
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${otherProfile.latitude},${otherProfile.longitude}`, "_blank");
              } else {
                toast.info("Ce prestataire n'a pas encore partagé sa position.");
              }
            }} title="Itinéraire">
              <Navigation className="w-4 h-4 text-primary" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleNotifications} title={notificationsEnabled ? "Désactiver les notifications" : "Activer les notifications"}>
            {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
          </Button>
          {otherUserId && missionId && (
            <AudioCall missionId={missionId} otherUserId={otherUserId} otherUserName={otherProfile?.full_name || "Utilisateur"} />
          )}
        </div>

        {/* Messages - scrollable area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {/* Welcome message */}
          {welcomeMessage && (
            <div className="flex justify-start">
              <div className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm bg-muted text-foreground rounded-bl-md">
                <p>{welcomeMessage.content}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(welcomeMessage.created_at!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            </div>
          )}
          {messages?.map((msg) => {
            const isMe = msg.sender_id === user.id;
            const isVoice = msg.content.startsWith("🎤") && msg.image_url && !msg.has_image;
            const isImageMsg = msg.has_image && msg.image_url;
            const isCallMsg = msg.content.startsWith("📞");
            const isReply = msg.content.startsWith("┃ ");
            let replyPreview = "";
            let actualContent = msg.content;
            if (isReply) {
              const lines = msg.content.split("\n");
              replyPreview = lines[0].replace("┃ ", "");
              actualContent = lines.slice(1).join("\n");
            }

            const handleTouchStart = (e: ReactTouchEvent) => {
              swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, msgId: msg.id };
            };
            const handleTouchEnd = (e: ReactTouchEvent) => {
              if (!swipeStartRef.current || swipeStartRef.current.msgId !== msg.id) return;
              const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
              const dy = Math.abs(e.changedTouches[0].clientY - swipeStartRef.current.y);
              if (dx > 60 && dy < 40) {
                triggerHaptic();
                const senderName = isMe ? "Vous" : (otherProfile?.full_name || "Utilisateur");
                const preview = msg.content.length > 60 ? msg.content.slice(0, 60) + "…" : msg.content;
                setReplyTo({ id: msg.id, content: isImageMsg ? "📷 Photo" : isVoice ? "🎤 Vocal" : preview, senderName });
              }
              swipeStartRef.current = null;
            };

            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"} group`}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {/* Delete button for own messages */}
                {isMe && (
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity self-center mr-1 text-muted-foreground hover:text-destructive"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"
                }`}>
                  {isReply && replyPreview && (
                    <div className={`mb-1.5 px-2 py-1 rounded-lg text-[11px] border-l-2 ${isMe ? "bg-primary-foreground/10 border-primary-foreground/40 text-primary-foreground/80" : "bg-foreground/5 border-primary/40 text-muted-foreground"}`}>
                      {replyPreview}
                    </div>
                  )}
                  {isImageMsg && (
                    <a href={msg.image_url!} target="_blank" rel="noopener noreferrer">
                      <img src={msg.image_url!} alt="" className="rounded-lg max-w-full max-h-48 object-cover" />
                    </a>
                  )}
                  {isVoice && (
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 shrink-0" />
                      <audio src={msg.image_url!} controls className="h-8 max-w-[200px]" />
                    </div>
                  )}
                  {msg.image_url && !msg.has_image && !isVoice && (
                    <a href={msg.image_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline mb-1">
                      <FileText className="w-4 h-4" /> Télécharger le fichier
                    </a>
                  )}
                  {!isImageMsg && !isVoice && actualContent.trim() && <p>{actualContent}</p>}
                  {isCallMsg && !isImageMsg && !isVoice && null}
                  <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : ""}`}>
                    <span className={`text-[10px] ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isMe && readReceiptsEnabled && (
                      msg.is_read ? <CheckCheck className="w-3.5 h-3.5 text-blue-400" /> : <Check className="w-3.5 h-3.5 text-primary-foreground/50" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />

          {/* Typing indicator */}
          {otherTyping && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl text-sm bg-muted text-muted-foreground rounded-bl-md flex items-center gap-1.5">
                <span className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                </span>
                <span className="text-xs">écrit...</span>
              </div>
            </div>
          )}
        </div>

        {/* Anti-bypass warning */}
        {bypassWarning && (
          <div className="mx-4 mb-2 p-3 rounded-xl bg-destructive/10 flex items-center gap-2 text-sm text-destructive shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Le partage de coordonnées est bloqué avant le paiement de l'acompte pour votre sécurité.</span>
          </div>
        )}

        {/* Reply preview */}
        {replyTo && (
          <div className="border-t border-border bg-card px-4 py-2 flex items-center gap-2 shrink-0">
            <Reply className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
              <p className="text-[11px] font-semibold text-primary">{replyTo.senderName}</p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input - sticky at bottom */}
        <div className="border-t border-border bg-card px-4 py-3 shrink-0">
          {recording ? (
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-mono text-destructive">{formatRecDuration(recordingDuration)}</span>
              <span className="text-sm text-muted-foreground flex-1">Enregistrement...</span>
              <Button size="icon" onClick={stopRecording} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} />
              <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Joindre un fichier">
                <Paperclip className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={startRecording} disabled={uploading} title="Message vocal">
                <Mic className="w-4 h-4" />
              </Button>
              <Input
                value={newMessage}
                onChange={(e) => { setNewMessage(e.target.value); sendTypingIndicator(); }}
                placeholder="Votre message..."
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                maxLength={1000}
                className="flex-1"
              />
              <Button variant="hero" size="icon" onClick={handleSend} disabled={sending || !newMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
          {uploading && <p className="text-xs text-muted-foreground mt-1">Envoi en cours...</p>}
        </div>
      </div>
    </div>
  );
};

export default Messages;