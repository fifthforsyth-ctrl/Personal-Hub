// Wake watch: sends the morning text to your peers.
//
// The deciding happens in the database (wake_watch_tick, every minute in
// the morning window); this only sends. Two ways in:
//   · the tick, with the shared x-cron-secret and { report_id }: texts that
//     morning's message to every active peer, then marks the report sent or
//     failed
//   · the app, with your login and { test: true, peer_id? }: a test text to
//     one peer or all of them, so you can see the first one land before
//     going live
//
// Texts go through Twilio, from the number in TWILIO_FROM, with the account
// in TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN (project secrets, never in the
// code). Until those are set this answers 503 and the report is marked
// failed with that reason, so nothing is silently lost.
//
// verify_jwt is off because the tick has no login; neither path falls
// through without its own check.

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type Peer = { id: string; name: string; phone: string };

function twilio() {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM");
  if (!sid || !token || !from) return null;
  return { sid, token, from };
}

async function sendText(t: { sid: string; token: string; from: string }, to: string, body: string) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${t.sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${t.sid}:${t.token}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: t.from, Body: body }),
  });
  if (res.ok) return null;
  const err = await res.json().catch(() => ({}));
  return `${res.status} ${err.message ?? res.statusText}`;
}

// Sends to each peer; returns how many went and the errors by name.
async function sendAll(t: ReturnType<typeof twilio>, peers: Peer[], body: string) {
  let sent = 0;
  const errors: string[] = [];
  for (const p of peers) {
    const err = await sendText(t!, p.phone, body);
    if (err) errors.push(`${p.name}: ${err}`);
    else sent += 1;
  }
  return { sent, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const cronSecret = Deno.env.get("CRON_SECRET");
    const presented = req.headers.get("x-cron-secret");
    const isCron = Boolean(cronSecret && presented && presented === cronSecret);

    // --- the morning text ------------------------------------------------
    if (isCron) {
      const reportId = String(body.report_id ?? "");
      const { data: report, error } = await admin
        .from("wake_reports")
        .select("id, user_id, message, status")
        .eq("id", reportId)
        .maybeSingle();
      if (error) throw new Error(`wake_reports: ${error.message}`);
      if (!report) return json({ error: "No such report." }, 404);
      // Only a queued report goes, and only once.
      if (report.status !== "queued") return json({ skipped: report.status });

      const { data: claimed } = await admin
        .from("wake_reports")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", report.id)
        .eq("status", "queued")
        .select("id");
      if (!claimed?.length) return json({ skipped: "taken" });

      const t = twilio();
      if (!t) {
        await admin.from("wake_reports").update({ status: "failed", error: "Texting isn't set up yet (Twilio secrets missing)." }).eq("id", report.id);
        return json({ error: "Twilio is not set up on this project." }, 503);
      }

      const { data: peers } = await admin
        .from("wake_peers")
        .select("id, name, phone")
        .eq("user_id", report.user_id)
        .eq("active", true);
      const { sent, errors } = await sendAll(t, peers ?? [], report.message ?? "");
      await admin
        .from("wake_reports")
        .update({ status: sent ? "sent" : "failed", sent_to: sent, error: errors.length ? errors.join("; ") : null })
        .eq("id", report.id);
      return json({ sent, errors });
    }

    // --- a test text from the app ----------------------------------------
    const auth = req.headers.get("authorization") ?? "";
    const { data: who } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    const userId = who?.user?.id;
    if (!userId) return json({ error: "Sign in first." }, 401);
    if (!body.test) return json({ error: "Nothing to do." }, 400);

    const t = twilio();
    if (!t) return json({ error: "Texting isn't set up yet. The Twilio number and keys still need to be added." }, 503);

    let q = admin.from("wake_peers").select("id, name, phone").eq("user_id", userId).eq("active", true);
    if (body.peer_id) q = q.eq("id", String(body.peer_id));
    const { data: peers } = await q;
    if (!peers?.length) return json({ error: "No peers to text." }, 400);

    const { data: watch } = await admin.from("wake_watch").select("check_at").eq("user_id", userId).maybeSingle();
    const at = String(watch?.check_at ?? "04:35").slice(0, 5).replace(/^0/, "");
    const text =
      typeof body.text === "string" && body.text.trim()
        ? body.text.trim().slice(0, 300)
        : `Aaron added you to his wake-up watch. Each morning around ${at} you'll get one text: whether he's up fighting dragons, or when the sleep dragons won. Reply STOP to stop.`;
    const { sent, errors } = await sendAll(t, peers, text);
    return json({ sent, errors }, errors.length && !sent ? 502 : 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
