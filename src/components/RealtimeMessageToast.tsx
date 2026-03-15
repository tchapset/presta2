import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

const RealtimeMessageToast = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("global-messages-toast")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === user.id) return;

          // Check if the user is part of this mission
          const { data: mission } = await supabase
            .from("missions")
            .select("id, client_id, provider_id")
            .eq("id", msg.mission_id)
            .single();

          if (!mission) return;
          if (mission.client_id !== user.id && mission.provider_id !== user.id) return;

          // Don't show toast if already on that conversation
          if (location.pathname === `/messages/${msg.mission_id}`) {
            queryClient.invalidateQueries({ queryKey: ["messages", msg.mission_id] });
            return;
          }

          // Get sender name
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("user_id", msg.sender_id)
            .single();

          const senderName = senderProfile?.full_name || "Quelqu'un";
          const preview = msg.has_image ? "📷 Photo" : msg.content?.slice(0, 60) || "Nouveau message";

          toast(senderName, {
            description: preview,
            action: {
              label: "Voir",
              onClick: () => navigate(`/messages/${msg.mission_id}`),
            },
            duration: 5000,
          });

          // Invalidate unread counts
          queryClient.invalidateQueries({ queryKey: ["total-unread"] });
          queryClient.invalidateQueries({ queryKey: ["conv-last-messages"] });
          queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, location.pathname]);

  return null;
};

export default RealtimeMessageToast;
