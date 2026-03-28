import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

type DeliveryRecord = {
  id: string;
  order_id: string;
  customer_name: string;
  address: string;
  driver_id: string;
};

type LoosePayload = Record<string, unknown>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Normalize Database Webhook / manual test / wrapped payloads */
const extractInsertRecord = (raw: unknown): { eventType?: string; record?: DeliveryRecord } => {
  let root: LoosePayload = raw as LoosePayload;
  if (typeof root === "string") {
    try {
      root = JSON.parse(root) as LoosePayload;
    } catch {
      return {};
    }
  }
  const nested = (root?.payload ?? root?.body ?? root) as LoosePayload;
  const record =
    (nested?.record as DeliveryRecord | undefined) ??
    (nested?.new as DeliveryRecord | undefined) ??
    (root?.record as DeliveryRecord | undefined) ??
    (root?.new as DeliveryRecord | undefined);
  const eventType =
    (nested?.type as string | undefined) ??
    (nested?.eventType as string | undefined) ??
    (root?.type as string | undefined) ??
    (root?.eventType as string | undefined);
  return { eventType, record };
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/** Must match `DELIVERY_NOTIFICATION_CHANNEL_ID` in the app. */
const ANDROID_CHANNEL_ID = "myNotificationChannel";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  try {
    const rawBody = await request.json();
    const { eventType, record: inserted } = extractInsertRecord(rawBody);

    console.log("[new-delivery-notify] received", {
      eventType: eventType ?? "(none)",
      hasRecord: Boolean(inserted),
      driver_id: inserted?.driver_id ?? null,
    });

    if (eventType && eventType !== "INSERT") {
      return json({ ok: true, ignored: true, reason: "not_insert" });
    }

    if (!inserted?.driver_id) {
      return json({ ok: false, error: "missing_driver_id" }, 400);
    }

    const { data: driverProfile, error: profileError } = await supabase
      .from("driver_profiles")
      .select("push_token")
      .eq("user_id", inserted.driver_id)
      .maybeSingle();

    if (profileError) {
      console.error("[new-delivery-notify] profile query", profileError);
      return json({ ok: false, error: "profile_query_failed", details: profileError.message }, 500);
    }

    const token = driverProfile?.push_token?.trim();
    if (!token) {
      console.warn("[new-delivery-notify] no push_token for driver", inserted.driver_id);
      return json({
        ok: false,
        skipped: true,
        reason: "no_push_token",
        hint: "Use a dev/production build (not Expo Go on Android), allow notifications, log in after phone verification.",
        driver_id: inserted.driver_id,
      });
    }

    const message = {
      to: token,
      sound: "default",
      priority: "high",
      channelId: ANDROID_CHANNEL_ID,
      title: "New Delivery Assigned",
      body: `Order ${inserted.order_id} for ${inserted.customer_name}`,
      data: {
        screen: "Deliveries",
        deliveryId: inserted.id,
        type: "new_delivery",
      },
    };

    const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(message),
    });

    const expoText = await expoResponse.text();
    let expoPayload: { data?: unknown };
    try {
      expoPayload = JSON.parse(expoText) as { data?: unknown };
    } catch {
      console.error("[new-delivery-notify] expo non-json", expoText.slice(0, 500));
      return json({ ok: false, error: "expo_bad_response", status: expoResponse.status, body: expoText.slice(0, 200) }, 500);
    }

    if (!expoResponse.ok) {
      console.error("[new-delivery-notify] expo http error", expoResponse.status, expoPayload);
      return json({ ok: false, error: "expo_http_error", status: expoResponse.status, expo: expoPayload }, 500);
    }

    const ticket = Array.isArray(expoPayload.data) ? expoPayload.data[0] : expoPayload.data;
    const ticketStatus = (ticket as { status?: string })?.status;
    if (ticketStatus === "error") {
      console.error("[new-delivery-notify] expo ticket error", ticket);
      return json({ ok: false, error: "expo_ticket_error", ticket }, 500);
    }

    console.log("[new-delivery-notify] sent", { ticketStatus: ticketStatus ?? "ok" });
    return json({ ok: true, sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[new-delivery-notify] exception", message);
    return json({ ok: false, error: message }, 500);
  }
});
