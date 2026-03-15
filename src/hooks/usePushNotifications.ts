import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

async function registerPushSubscription(userId: string) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    // Register the push service worker
    const registration = await navigator.serviceWorker.register("/push-sw.js");
    await navigator.serviceWorker.ready;

    // Get VAPID public key from edge function
    const { data: vapidData, error: vapidError } = await supabase.functions.invoke(
      "send-push-notification",
      { body: { action: "get-vapid-key" } }
    );

    if (vapidError || !vapidData?.publicKey) {
      console.error("Failed to get VAPID key:", vapidError);
      return;
    }

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(vapidData.publicKey).buffer as ArrayBuffer,
      });
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) return;

    // Store in DB (upsert)
    await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
      { onConflict: "user_id,endpoint" }
    );
  } catch (err) {
    console.warn("Push registration failed:", err);
  }
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const permissionGranted = useRef(false);
  const registered = useRef(false);

  // Request permission and register push
  useEffect(() => {
    if (!user) return;
    if (!("Notification" in window)) return;

    const setup = async () => {
      if (Notification.permission === "granted") {
        permissionGranted.current = true;
      } else if (Notification.permission !== "denied") {
        const perm = await Notification.requestPermission();
        permissionGranted.current = perm === "granted";
      }

      // Register push subscription if permission granted
      if (permissionGranted.current && !registered.current) {
        registered.current = true;
        await registerPushSubscription(user.id);
      }
    };

    setup();
  }, [user]);

  // Listen for new notifications in realtime (in-app fallback)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("push-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (localStorage.getItem("notifs-disabled") === "true") return;

          const notification = payload.new as {
            title: string;
            message: string;
            link?: string;
            type: string;
          };

          // Play notification sound
          try {
            const audio = new Audio("/notification.mp3");
            audio.volume = 0.5;
            audio.play().catch(() => {});
          } catch {}

          // Show browser notification if tab is not focused
          if (document.hidden && permissionGranted.current) {
            const n = new Notification(notification.title, {
              body: notification.message,
              icon: "/pwa-icon-192.png",
              tag: `tklink-${Date.now()}`,
            });

            n.onclick = () => {
              window.focus();
              if (notification.link) {
                window.location.href = notification.link;
              }
              n.close();
            };
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
};

// Helper to send push notification to a user via edge function
export const sendPushToUser = async (
  userId: string,
  title: string,
  body: string,
  url?: string
) => {
  try {
    await supabase.functions.invoke("send-push-notification", {
      body: { user_id: userId, title, body, url },
    });
  } catch (err) {
    console.warn("Failed to send push:", err);
  }
};
