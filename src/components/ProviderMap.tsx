import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const cityCoords: Record<string, [number, number]> = {
  Douala: [4.0511, 9.7679], Yaoundé: [3.848, 11.5021], Garoua: [9.3014, 13.3975],
  Bafoussam: [5.4737, 10.4176], Bamenda: [5.9527, 10.157], Maroua: [10.5911, 14.3159],
  Bertoua: [4.5775, 13.6846], Kribi: [2.9394, 9.9079], Limbé: [4.0157, 9.2104], Buéa: [4.1527, 9.2414],
};

const makeIcon = (online: boolean) => L.divIcon({
  className: "custom-marker",
  html: `<div style="width:${online ? 17 : 14}px;height:${online ? 17 : 14}px;border-radius:50%;background:${online ? '#16a34a' : '#9ca3af'};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <div style="width:${online ? 5 : 3}px;height:${online ? 5 : 3}px;border-radius:50%;background:white;"></div>
  </div>`,
  iconSize: [online ? 17 : 14, online ? 17 : 14],
  iconAnchor: [online ? 9 : 7, online ? 9 : 7],
});

const userIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 1px 6px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center;">
    <div style="width:5px;height:5px;border-radius:50%;background:white;"></div>
  </div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface Provider {
  id: string;
  user_id: string;
  full_name: string;
  city?: string | null;
  quarter?: string | null;
  reliability_score?: number | null;
  provider_categories?: string[] | null;
  avatar_url?: string | null;
  is_verified?: boolean | null;
  is_premium?: boolean | null;
  availability?: string | null;
  last_seen_at?: string | null;
  badges?: string[] | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  avg_response_time_minutes?: number | null;
  can_travel?: boolean | null;
}

interface ProviderMapProps {
  providers: Provider[];
  userPosition?: [number, number] | null;
  center?: [number, number] | null;
  reviewCounts?: Record<string, number>;
  reviewAverages?: Record<string, number>;
}

const isOnline = (lastSeen: string | null): boolean => {
  if (!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
};

const ProviderMap = ({ providers, userPosition, center, reviewCounts = {}, reviewAverages = {} }: ProviderMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const getCoords = (p: Provider): [number, number] | null => {
      if (p.latitude && p.longitude) return [p.latitude, p.longitude];
      if (p.city && cityCoords[p.city]) return cityCoords[p.city];
      return null;
    };

    const providersWithCoords = providers
      .filter(p => getCoords(p) !== null)
      .map(p => ({
        ...p,
        coords: getCoords(p)!,
        offset: (p.latitude && p.longitude) ? [0, 0] as [number, number] : [Math.random() * 0.008 - 0.004, Math.random() * 0.008 - 0.004] as [number, number],
      }));

    const mapCenter: [number, number] = center
      ? center
      : userPosition
        ? userPosition
        : providersWithCoords.length > 0
          ? providersWithCoords[0].coords
          : [5.9631, 10.1591];

    const zoom = center ? 13 : userPosition ? 12 : 7;
    const map = L.map(mapRef.current).setView(mapCenter, zoom);
    mapInstanceRef.current = map;

    const routeLayer = L.layerGroup().addTo(map);
    routeLayerRef.current = routeLayer;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    if (userPosition) {
      L.marker(userPosition, { icon: userIcon }).addTo(map)
        .bindPopup('<p style="font-weight:bold;margin:0;">📍 Votre position</p>');
    }

    const locateBtn = L.Control.extend({
      onAdd: () => {
        const btn = L.DomUtil.create("button", "");
        btn.innerHTML = "◎";
        btn.style.cssText = "width:32px;height:32px;border-radius:8px;background:hsl(var(--primary));color:white;border:none;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);";
        btn.onclick = (e) => {
          e.stopPropagation();
          if (userPosition) {
            map.flyTo(userPosition, 14);
          } else {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const latlng: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                L.marker(latlng, { icon: userIcon }).addTo(map)
                  .bindPopup('<p style="font-weight:bold;margin:0;">📍 Votre position</p>');
                map.flyTo(latlng, 14);
              },
              () => { /* silently fail */ }
            );
          }
        };
        return btn;
      },
    });
    new locateBtn({ position: "bottomright" }).addTo(map);

    const drawRoute = async (destLat: number, destLng: number) => {
      if (!userPosition) return;
      routeLayer.clearLayers();
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${userPosition[1]},${userPosition[0]};${destLng},${destLat}?overview=full&geometries=geojson`
        );
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
          L.polyline(coords, { color: "#3b82f6", weight: 5, opacity: 0.8 }).addTo(routeLayer);
          const duration = Math.round(data.routes[0].duration / 60);
          const distKm = (data.routes[0].distance / 1000).toFixed(1);
          const infoControl = L.Control.extend({
            onAdd: () => {
              const div = L.DomUtil.create("div", "");
              div.innerHTML = `<div style="background:white;padding:8px 14px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.2);font-family:system-ui;font-size:13px;"><b>${distKm} km</b> · ~${duration} min<br/><button id="clear-route" style="color:#ef4444;font-size:12px;cursor:pointer;border:none;background:none;margin-top:4px;">✕ Fermer l'itinéraire</button></div>`;
              div.querySelector("#clear-route")?.addEventListener("click", () => routeLayer.clearLayers());
              return div;
            },
          });
          new infoControl({ position: "topright" }).addTo(routeLayer as any);
          map.fitBounds(L.polyline(coords).getBounds(), { padding: [50, 50] });
        }
      } catch {
        // Silently fail
      }
    };

    (window as any).__drawRoute = drawRoute;

    (window as any).__contactProvider = async (providerUserId: string, providerName: string, profileId: string) => {
      // Navigate to internal messaging - find or create mission
      const { data: { user: currentUser } } = await (await import("@/integrations/supabase/client")).supabase.auth.getUser();
      if (!currentUser) { window.location.href = "/auth"; return; }
      const { data: existing } = await (await import("@/integrations/supabase/client")).supabase
        .from("missions").select("id")
        .eq("client_id", currentUser.id).eq("provider_id", providerUserId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existing) { window.location.href = `/messages/${existing.id}`; return; }
      const { data: newM } = await (await import("@/integrations/supabase/client")).supabase
        .from("missions").insert({ client_id: currentUser.id, provider_id: providerUserId, title: `Conversation avec ${providerName}`, status: "pending" })
        .select("id").single();
      if (newM) window.location.href = `/messages/${newM.id}`;
    };

    (window as any).__callProvider = async (providerUserId: string, providerName: string) => {
      // Find existing mission for call context
      const { data: { user: currentUser } } = await (await import("@/integrations/supabase/client")).supabase.auth.getUser();
      if (!currentUser) { window.location.href = "/auth"; return; }
      const { data: existing } = await (await import("@/integrations/supabase/client")).supabase
        .from("missions").select("id")
        .eq("client_id", currentUser.id).eq("provider_id", providerUserId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existing) { window.location.href = `/messages/${existing.id}?call=true`; return; }
      const { data: newM } = await (await import("@/integrations/supabase/client")).supabase
        .from("missions").insert({ client_id: currentUser.id, provider_id: providerUserId, title: `Conversation avec ${providerName}`, status: "pending" })
        .select("id").single();
      if (newM) window.location.href = `/messages/${newM.id}?call=true`;
    };

    providersWithCoords.forEach((p) => {
      const online = isOnline(p.last_seen_at);
      const icon = makeIcon(online);
      const actualCoords: [number, number] = [p.coords[0] + p.offset[0], p.coords[1] + p.offset[1]];
      const marker = L.marker(actualCoords, { icon }).addTo(map);

      const initials = (p.full_name || "??").slice(0, 2).toUpperCase();
      const cat = p.provider_categories?.[0] || "Prestataire";
      const avgRating = reviewAverages[p.user_id] ?? Number(p.reliability_score || 0);
      const score = avgRating.toFixed(1);
      const rCount = reviewCounts[p.user_id] || 0;
      const respTime = p.avg_response_time_minutes;
      const availText = online ? '<span style="color:#16a34a;font-weight:600;">Disponible</span>' : '<span style="color:#9ca3af;">Hors ligne</span>';

      marker.bindPopup(`
        <div style="min-width:220px;font-family:system-ui;padding:4px 0;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#16a34a,#059669);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;flex-shrink:0;">
              ${p.avatar_url ? `<img src="${p.avatar_url}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;" />` : initials}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:4px;">
                <b style="font-size:14px;">${p.full_name}</b>
                ${online ? '<span style="width:8px;height:8px;border-radius:50%;background:#16a34a;display:inline-block;" title="En ligne"></span>' : ''}
              </div>
              <div style="color:#888;font-size:12px;">${cat}</div>
              <div style="font-size:11px;margin-top:2px;">${availText}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;font-size:11px;margin-bottom:8px;color:#666;">
            <span>⭐ ${score}</span>
            <span>· ${rCount} avis</span>
            ${respTime ? `<span>· ⏱ ~${respTime}min</span>` : ''}
            ${p.can_travel ? '<span>· 🚗 Se déplace</span>' : ''}
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:6px 0;" />
          <a href="/prestataire/${p.id}" style="display:block;text-align:center;padding:8px;background:#374151;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;margin-bottom:4px;">
            👤 Voir le profil
          </a>
          ${userPosition ? `
          <button onclick="window.__drawRoute(${actualCoords[0]},${actualCoords[1]})" style="display:block;width:100%;text-align:center;padding:8px;background:#3b82f6;color:white;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:500;margin-bottom:4px;">
            🗺️ Itinéraire
          </button>
          ` : ''}
          <div style="display:flex;gap:4px;margin-top:4px;">
            <button onclick="window.__contactProvider('${p.user_id}','${p.full_name.replace(/'/g, "\\'")}','${p.id}')" style="flex:1;text-align:center;padding:6px;background:#16a34a;color:white;border-radius:8px;border:none;cursor:pointer;font-size:12px;">💬 Message</button>
            <button onclick="window.__callProvider('${p.user_id}','${p.full_name.replace(/'/g, "\\'")}')" style="flex:1;text-align:center;padding:6px;background:#ef4444;color:white;border-radius:8px;border:none;cursor:pointer;font-size:12px;">📞 Appel</button>
          </div>
        </div>
      `, { maxWidth: 280 });
    });

    return () => {
      delete (window as any).__drawRoute;
      delete (window as any).__contactProvider;
      delete (window as any).__callProvider;
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [providers, userPosition, center, reviewCounts, reviewAverages]);

  return (
    <div className="rounded-2xl overflow-hidden border border-border h-[500px] relative z-0">
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
};

export default ProviderMap;
