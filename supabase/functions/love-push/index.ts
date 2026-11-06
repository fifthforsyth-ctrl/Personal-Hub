// Love tab notifications, pushed to the phone.
//
// Two ways in:
//   - the love-push cron (public.love_push_tick, every minute while there's
//     something to send) with x-cron-secret: every alert that has waited a
//     minute goes to each phone or browser its person turned notifications
//     on for. The minute lets a journal answer still being typed settle; a
//     mention is sent with the answer as it reads now, and one taken back
//     before then isn't sent at all.
//   - the app, signed in, with {action: "test"}: one test notification to
//     your own devices, from the Love tab's "Send me a test".
//
// iPhone only shows these for the Hub added to the Home Screen (iOS 16.4 or
// later), after "Turn on notifications" there. A subscription the push
// service says is gone (404/410) is marked failed and not tried again.
//
// verify_jwt is off: the cron has no user, so the secret is its check and
// the test checks the caller's token itself.
//
// Keys: the VAPID private key from the vault (0110) or a VAPID_PRIVATE_KEY
// secret; CRON_SECRET (already set for the other crons); SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY (built in).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@^2.45.0";
import { sendPush, type Subscription } from "./webpush.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

type Sub = Subscription & { id: string; user_id: string };

// The public half matches src/lib/push.js. The private half is a function
// secret if one is set, otherwise the vault's 'love_vapid_private' (0110).
const VAPID_PUBLIC = "BOBDXKVdOpgY7QVMjaCYUkne6vsk2RieYXar1FWZK9u5ejevbGWoti4MKN3kyWKqjU70-F1VkN3JRKXW2X8V2LU";
let keys: { publicKey: string; privateKey: string; subject: string } | null = null;

async function loadVapid(admin: SupabaseClient) {
  if (keys) return keys;
  let privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? null;
  if (!privateKey) {
    const { data, error } = await admin.rpc("love_vapid_private");
    if (error) throw error;
    privateKey = data;
  }
  if (!privateKey) throw new Error("The push key isn't set on this project.");
  keys = { publicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? VAPID_PUBLIC, privateKey, subject: "https://forsyth-hub.vercel.app" };
  return keys;
}

function vapid() {
  if (!keys) throw new Error("Push keys not loaded.");
  return keys;
}

// Sends one message to each device; marks the ones that answered.
async function deliver(admin: SupabaseClient, subs: Sub[], message: unknown) {
  let sent = 0;
  for (const sub of subs) {
    try {
      const status = await sendPush(sub, message, vapid());
      if (status >= 200 && status < 300) {
        sent += 1;
        await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", sub.id);
      } else if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").update({ failed_at: new Date().toISOString() }).eq("id", sub.id);
      } else {
        console.warn("push", status, new URL(sub.endpoint).host);
      }
    } catch (err) {
      console.warn("push failed", err);
    }
  }
  return sent;
}

async function unreadCount(admin: SupabaseClient, userId: string) {
  const { count } = await admin
    .from("love_alerts")
    .select("id", { count: "exact", head: true })
    .eq("recipient", userId)
    .is("read_at", null);
  return count ?? 0;
}

async function runCron(admin: SupabaseClient) {
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const { data: alerts, error } = await admin
    .from("love_alerts")
    .select("id, recipient, kind, subject_kind, subject_id, title, body")
    .is("pushed_at", null)
    .lt("created_at", cutoff)
    .order("created_at")
    .limit(50);
  if (error) throw error;
  if (!alerts?.length) return { alerts: 0, sent: 0 };

  // Mark them first: a slow push service must never send one twice.
  await admin.from("love_alerts").update({ pushed_at: new Date().toISOString() }).in("id", alerts.map((a) => a.id));

  const mentionIds = alerts.filter((a) => a.kind === "mention").map((a) => a.subject_id);
  const mentions = new Map<string, string>();
  if (mentionIds.length) {
    const { data } = await admin.from("love_mentions").select("id, body").in("id", mentionIds);
    for (const m of data ?? []) mentions.set(m.id, m.body);
  }

  const recipients = [...new Set(alerts.map((a) => a.recipient))];
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", recipients)
    .is("failed_at", null);

  let sent = 0;
  for (const who of recipients) {
    const mine = (subs ?? []).filter((s) => s.user_id === who) as Sub[];
    if (!mine.length) continue;
    const badge = await unreadCount(admin, who);
    for (const a of alerts.filter((x) => x.recipient === who)) {
      let body = a.body;
      if (a.kind === "mention") {
        if (!mentions.has(a.subject_id)) continue; // taken back before it went
        body = mentions.get(a.subject_id)!;
      }
      sent += await deliver(admin, mine, {
        title: a.title,
        body: (body ?? "").slice(0, 240),
        url: `/love?open=${a.subject_kind}:${a.subject_id}`,
        tag: `${a.subject_kind}:${a.subject_id}:${a.kind}`,
        badge,
      });
    }
  }
  return { alerts: alerts.length, sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await loadVapid(admin);
    const cronSecret = Deno.env.get("CRON_SECRET");
    const presented = req.headers.get("x-cron-secret");
    if (cronSecret && presented && presented === cronSecret) {
      return json(await runCron(admin));
    }

    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: who } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (!who?.user) return json({ error: "Sign in first." }, 401);

    const body = await req.json().catch(() => ({}));
    if (body.action !== "test") return json({ error: "Unknown action." }, 400);
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .eq("user_id", who.user.id)
      .is("failed_at", null);
    if (!subs?.length) return json({ sent: 0, devices: 0 });
    const sent = await deliver(admin, subs as Sub[], {
      title: "Notifications are on",
      body: "This is how the Love tab will reach you.",
      url: "/love",
      tag: "love-test",
    });
    return json({ sent, devices: subs.length });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
