// The bank connection. Reads two Chase checking accounts through SimpleFIN
// Bridge, read-only.
//
// What this function holds, and how carefully:
//   · Your Chase login: never. It is entered on SimpleFIN's own site.
//   · The SimpleFIN setup token: for the length of one request. It is single
//     use, exchanged immediately, and never stored or logged.
//   · The SimpleFIN access URL: in Vault, readable only by the service role.
//     It is never returned to the browser, never logged, and stripped of its
//     credentials before any request is made with it, so even an error
//     message that echoes a URL echoes one with nothing in it.
//
// Three ways in, the same shape as the curator and the miner: the twice-daily
// cron with the shared secret, and the app with your ordinary JWT for
// connecting, syncing now, and disconnecting. verify_jwt is off because the
// cron has no login, so this authenticates itself — no valid secret and no
// valid token is a 401, never "carry on anyway".

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// SimpleFIN caps a request at 90 days and reports asking for exactly 90 as
// having exceeded it, so the first sync asks for a day less.
const FIRST_SYNC_DAYS = 89;
// Each sync re-reads the last ten days: banks restate and late-post, and
// ingest is idempotent, so the overlap costs nothing and misses nothing.
const OVERLAP_DAYS = 10;
// SimpleFIN Bridge rations requests per day. A button that can be pressed
// repeatedly must not be able to burn the day's allowance.
const MIN_MANUAL_GAP_MS = 15 * 60 * 1000;

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// Split "https://user:pass@host/path" into a clean URL and a Basic header.
// Fetch will not accept credentials in a URL, and a URL without them is safe
// to appear in any error that might surface.
function authorise(accessUrl: string) {
  const u = new URL(accessUrl);
  if (u.protocol !== "https:") throw new Error("The SimpleFIN access URL must be https.");
  const header = "Basic " + btoa(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`);
  u.username = "";
  u.password = "";
  return { base: u.toString().replace(/\/+$/, ""), header };
}

async function claim(setupToken: string): Promise<string> {
  let claimUrl: URL;
  try {
    claimUrl = new URL(atob(setupToken.trim()));
  } catch {
    throw new Error("That doesn't look like a SimpleFIN setup token. Copy the whole token from SimpleFIN Bridge and paste it again.");
  }
  // Only SimpleFIN's own servers. This function holds the service key, and it
  // must not be talked into POSTing at an arbitrary address.
  if (claimUrl.protocol !== "https:" || !/(^|\.)simplefin\.org$/.test(claimUrl.hostname)) {
    throw new Error("That token doesn't point at SimpleFIN Bridge.");
  }

  const res = await fetch(claimUrl.toString(), { method: "POST", headers: { "Content-Length": "0" } });
  if (res.status === 403) {
    throw new Error("SimpleFIN says that token has already been used or was revoked. Make a new one in SimpleFIN Bridge and paste that.");
  }
  if (!res.ok) throw new Error(`SimpleFIN refused the token (${res.status}).`);

  const accessUrl = (await res.text()).trim();
  // Validate the shape without ever echoing it.
  try {
    const u = new URL(accessUrl);
    if (u.protocol !== "https:" || !u.username || !u.password) throw new Error();
  } catch {
    throw new Error("SimpleFIN returned something that isn't an access URL.");
  }
  return accessUrl;
}

async function syncUser(db: any, userId: string, { manual = false } = {}) {
  const { data: conn } = await db
    .from("bank_connections")
    .select("id, last_synced_at, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!conn || conn.status === "disconnected") return { skipped: "not connected" };

  if (manual && conn.last_synced_at && Date.now() - Date.parse(conn.last_synced_at) < MIN_MANUAL_GAP_MS) {
    return { skipped: "synced in the last 15 minutes", last_synced_at: conn.last_synced_at };
  }

  const { data: accessUrl, error: accessError } = await db.rpc("get_bank_access", { p_user_id: userId });
  if (accessError || !accessUrl) return { skipped: "no access key stored" };

  const since = conn.last_synced_at
    ? Date.parse(conn.last_synced_at) - OVERLAP_DAYS * 86400_000
    : Date.now() - FIRST_SYNC_DAYS * 86400_000;

  const { base, header } = authorise(accessUrl);
  // pending=1 is opt-in in the protocol; without it a Saturday purchase is
  // invisible until Chase posts it on Monday.
  const res = await fetch(`${base}/accounts?pending=1&start-date=${Math.floor(since / 1000)}`, {
    headers: { Authorization: header, Accept: "application/json" },
  });

  const fail = async (message: string) => {
    await db.from("bank_connections").update({ status: "error", last_error: message }).eq("id", conn.id);
    return { error: message };
  };

  if (res.status === 403) return fail("SimpleFIN no longer accepts this connection. Reconnect it from the Money page.");
  if (res.status === 402) return fail("SimpleFIN Bridge says the subscription needs paying.");
  if (!res.ok) return fail(`SimpleFIN returned ${res.status}.`);

  const payload = await res.json();

  const { data: summary, error } = await db.rpc("ingest_simplefin", {
    p_user_id: userId,
    p_connection_id: conn.id,
    p_payload: payload,
  });
  if (error) return fail(`Saving the sync failed: ${error.message}`);

  // v2 reports structured problems in errlist; v1 used a plain errors list.
  // Either way, what did arrive is kept, and the problem is shown rather than
  // hidden — usually it's Chase wanting you to re-authenticate at SimpleFIN.
  const warnings = [
    ...(payload.errlist ?? []).map((e: any) => e?.msg).filter(Boolean),
    ...(payload.errors ?? []).filter((e: any) => typeof e === "string"),
  ];
  if (warnings.length) {
    await db.from("bank_connections").update({ last_error: warnings.join(" · ") }).eq("id", conn.id);
  }

  return { ...summary, warnings };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const db = admin();
    const body = await req.json().catch(() => ({}));

    // --- twice a day ------------------------------------------------------
    const cronSecret = Deno.env.get("CRON_SECRET");
    const presented = req.headers.get("x-cron-secret");
    if (cronSecret && presented && presented === cronSecret) {
      const { data: conns, error } = await db
        .from("bank_connections")
        .select("user_id")
        .neq("status", "disconnected");
      if (error) throw new Error(`bank_connections: ${error.message}`);

      const results = [];
      for (const c of conns ?? []) {
        try {
          results.push({ user: c.user_id, ...(await syncUser(db, c.user_id)) });
        } catch (err) {
          results.push({ user: c.user_id, error: err instanceof Error ? err.message : String(err) });
        }
      }
      return json({ ran: "cron", results });
    }

    // --- you, from the app --------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await asUser.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Not signed in." }, 401);

    // Everything below runs as the service role — it has to, to reach Vault —
    // and is scoped to exactly this user by passing their id explicitly.
    const userId = userData.user.id;

    switch (body.action) {
      case "claim": {
        if (!body.setup_token) return json({ error: "Paste the setup token from SimpleFIN Bridge." }, 400);
        const accessUrl = await claim(String(body.setup_token));
        // Store before anything else can fail: the token is spent the moment
        // it is claimed, so losing the access URL here would mean making a new
        // token at SimpleFIN.
        const { error } = await db.rpc("store_bank_access", { p_user_id: userId, p_access_url: accessUrl });
        if (error) throw new Error(`Couldn't store the connection: ${error.message}`);
        return json({ connected: true, sync: await syncUser(db, userId) });
      }

      case "sync":
        return json(await syncUser(db, userId, { manual: true }));

      case "disconnect": {
        const { error } = await db.rpc("forget_bank_access", { p_user_id: userId });
        if (error) throw new Error(error.message);
        return json({ disconnected: true });
      }

      default:
        return json({ error: `Unknown action "${body.action}".` }, 400);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
