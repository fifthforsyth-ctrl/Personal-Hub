import { supabase } from "./supabaseClient";

// The Love tab: two people, each with their own Hub, and what they share.
// Everything else in the Hub stays private; only the love_* tables are seen
// by both, and only while both are in an active pair (0109_love.sql).

export { RATINGS, cleanHandle, handlesFrom, mentions, leaderboard } from "./loveRules";

// ---------------------------------------------------------------------------
// The pair
// ---------------------------------------------------------------------------

// { pair, me, partner, invites } — pair is null until one is active.
export async function fetchLoveState(userId) {
  const [{ data: members, error: mErr }, { data: invites, error: iErr }] = await Promise.all([
    supabase.from("love_members").select("pair_id, user_id, name, handles, love_pairs!inner(id, status, invited_by, invite_email, invite_name, created_at, accepted_at)"),
    supabase.rpc("love_my_invites"),
  ]);
  if (mErr) throw mErr;
  if (iErr) throw iErr;
  const mine = (members ?? []).filter((m) => m.user_id === userId);
  const active = mine.find((m) => m.love_pairs.status === "active");
  const pending = mine.find((m) => m.love_pairs.status === "pending" && m.love_pairs.invited_by === userId);
  if (!active) return { pair: null, me: null, partner: null, sent: pending?.love_pairs ?? null, invites: invites ?? [] };
  const partner = (members ?? []).find((m) => m.pair_id === active.pair_id && m.user_id !== userId) ?? null;
  return { pair: active.love_pairs, me: active, partner, sent: null, invites: invites ?? [] };
}

export async function invitePartner({ email, myName, theirName, myHandles, theirHandles }) {
  const { data, error } = await supabase.rpc("love_invite", {
    p_email: email,
    p_my_name: myName,
    p_their_name: theirName,
    p_my_handles: myHandles,
    p_their_handles: theirHandles,
  });
  if (error) throw error;
  return data;
}

export async function acceptInvite(pairId) {
  const { error } = await supabase.rpc("love_accept", { p_pair: pairId });
  if (error) throw error;
}

export async function declineInvite(pairId) {
  const { error } = await supabase.rpc("love_decline", { p_pair: pairId });
  if (error) throw error;
}

export async function endPair() {
  const { error } = await supabase.rpc("love_end");
  if (error) throw error;
}

export async function saveMe(name, handles) {
  const { error } = await supabase.rpc("love_set_me", { p_name: name, p_handles: handles });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Everything shared, at once: it's two people's worth, so it's small.
// ---------------------------------------------------------------------------

export async function fetchLove(pairId) {
  const q = (table, select = "*") => supabase.from(table).select(select).eq("pair_id", pairId);
  const results = await Promise.all([
    q("love_mentions").order("journal_date", { ascending: false }).limit(200),
    q("love_quotes").order("created_at", { ascending: false }).limit(200),
    q("love_dates").order("created_at", { ascending: false }).limit(500),
    q("love_ratings"),
    q("love_shares").order("created_at", { ascending: false }).limit(200),
    q("love_comments").order("created_at", { ascending: true }).limit(2000),
    supabase.from("love_alerts").select("*").eq("pair_id", pairId).order("created_at", { ascending: false }).limit(100),
  ]);
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
  const [mentions, quotes, dates, ratings, shares, comments, alerts] = results.map((r) => r.data ?? []);
  return { mentions, quotes, dates, ratings, shares, comments, alerts };
}

export async function unreadLoveCount() {
  const { count, error } = await supabase.from("love_alerts").select("id", { count: "exact", head: true }).is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markAlertsRead(ids) {
  if (!ids.length) return;
  const { error } = await supabase.from("love_alerts").update({ read_at: new Date().toISOString() }).in("id", ids);
  if (error) throw error;
  notifyLoveChanged();
}

// The nav's heart listens for this, so reading here clears the dot there.
export function notifyLoveChanged() {
  window.dispatchEvent(new Event("love-changed"));
  if ("clearAppBadge" in navigator) navigator.clearAppBadge().catch(() => {});
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export async function addDate(pairId, fields) {
  const { data, error } = await supabase.from("love_dates").insert({ pair_id: pairId, ...fields }).select().single();
  if (error) throw error;
  return data;
}

export async function updateDate(id, fields) {
  const { data, error } = await supabase.from("love_dates").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDate(id) {
  const { error } = await supabase.from("love_dates").delete().eq("id", id);
  if (error) throw error;
}

export async function rateDate(pairId, dateId, userId, scores) {
  const { error } = await supabase
    .from("love_ratings")
    .upsert({ pair_id: pairId, date_id: dateId, user_id: userId, ...scores }, { onConflict: "date_id,user_id" });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Quotes, shares, comments
// ---------------------------------------------------------------------------

export async function sendQuote(quoteId, note) {
  const { error } = await supabase.rpc("love_send_quote", { p_quote: quoteId, p_note: note || null });
  if (error) throw error;
}

export async function shareWithPartner(pairId, { kind, title, body, refDate, payload }) {
  const { error } = await supabase
    .from("love_shares")
    .insert({ pair_id: pairId, kind, title, body: body || null, ref_date: refDate ?? null, payload: payload ?? {} });
  if (error) throw error;
}

export async function deleteShare(id) {
  const { error } = await supabase.from("love_shares").delete().eq("id", id);
  if (error) throw error;
}

export async function addComment(pairId, subjectKind, subjectId, body) {
  const { data, error } = await supabase
    .from("love_comments")
    .insert({ pair_id: pairId, subject_kind: subjectKind, subject_id: subjectId, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(id) {
  const { error } = await supabase.from("love_comments").delete().eq("id", id);
  if (error) throw error;
}

// Just the pair id and the other person's name, for the share buttons
// around the app. Cached for the session; null when not paired.
let partnerCache = null;
export async function loadPartner(userId) {
  if (partnerCache && partnerCache.userId === userId) return partnerCache.value;
  const { data, error } = await supabase.from("love_members").select("pair_id, user_id, name, handles, love_pairs!inner(status)").eq("love_pairs.status", "active");
  if (error) throw error;
  const me = (data ?? []).find((m) => m.user_id === userId);
  const them = me ? (data ?? []).find((m) => m.pair_id === me.pair_id && m.user_id !== userId) : null;
  const value = me && them ? { pairId: me.pair_id, name: them.name, handles: them.handles ?? [], myName: me.name } : null;
  partnerCache = { userId, value };
  return value;
}

export function forgetPartner() {
  partnerCache = null;
}
