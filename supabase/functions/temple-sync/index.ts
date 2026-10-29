// Receives a FamilySearch snapshot from the "Sync to Hub" bookmark.
//
// The bookmark runs in Aaron's signed-in FamilySearch tab, reads his tree
// and ordinances there (GETs only) and posts the snapshot here with the key
// made in the Hub (Temple > Sync). Only the key's SHA-256 is stored
// (temple_sync_keys). This checks the shape, parks the snapshot in
// temple_inbox for that one person, and the Temple page loads it the next
// time it opens. Nothing here reads or writes FamilySearch.
//
// verify_jwt is off because the bookmark has no Hub login; the key is the check.

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-sync-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 8_000_000;
const KEEP = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Send the snapshot with POST." }, 405);

  const key = (req.headers.get("x-sync-key") ?? new URL(req.url).searchParams.get("key") ?? "").trim();
  if (!key || key.length < 32) return json({ error: "No sync key. Make the bookmark again in the Hub under Temple > Sync." }, 401);

  const text = await req.text();
  if (text.length > MAX_BYTES) return json({ error: "That snapshot is too big." }, 413);
  let snap: any;
  try {
    snap = JSON.parse(text);
  } catch {
    return json({ error: "That isn't a snapshot." }, 400);
  }
  const synced = new Date(snap?.synced_at);
  if (snap?.kind !== "hub-temple-snapshot" || !Array.isArray(snap.people) || !snap.people.length || Number.isNaN(synced.getTime())) {
    return json({ error: "That isn't a FamilySearch snapshot for the Hub." }, 400);
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: found, error: keyError } = await db
    .from("temple_sync_keys")
    .select("user_id")
    .eq("key_hash", await sha256Hex(key))
    .maybeSingle();
  if (keyError) return json({ error: "The Hub didn't answer. Try again in a minute." }, 500);
  if (!found) return json({ error: "This bookmark's key was replaced. Make the bookmark again in the Hub under Temple > Sync." }, 401);
  const userId = found.user_id as string;

  const { error } = await db.from("temple_inbox").insert({ user_id: userId, synced_at: synced.toISOString(), snapshot: snap });
  if (error) return json({ error: "The Hub couldn't save it. Try again in a minute." }, 500);

  // Keep the last few; older ones are never loaded.
  const { data: old } = await db
    .from("temple_inbox")
    .select("id")
    .eq("user_id", userId)
    .order("synced_at", { ascending: false })
    .range(KEEP, KEEP + 100);
  if (old?.length) await db.from("temple_inbox").delete().in("id", old.map((r) => r.id));
  await db.from("temple_sync_keys").update({ last_used_at: new Date().toISOString() }).eq("user_id", userId);

  return json({
    ok: true,
    people: snap.people.length,
    open: Array.isArray(snap.ordinances) ? snap.ordinances.length : 0,
    done: Array.isArray(snap.done) ? snap.done.length : null,
  });
});
