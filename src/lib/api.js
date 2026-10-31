import { supabase } from "./supabaseClient";
import { parseScriptureRefs } from "./scripture";
import { todayStr, addDays, toDateStr, startOfMonth, startOfWeek } from "./planDates";
import { RUNAWAY_HOURS, ranThroughNight } from "./honest";
import { planRows } from "./camp";
import { byPin } from "./stepMoves";
import { questTagOptions, questWorkDone } from "./questWork";

// ---------------------------------------------------------------------------
// Goal tree (nodes + node_edges) — structurally identical to Symposium's,
// minus the hiking/elevation gamification layer, which doesn't fit this
// app's tone.
// ---------------------------------------------------------------------------

export async function fetchTree(userId) {
  const { data: nodes, error: nodesError } = await supabase
    .from("nodes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (nodesError) throw nodesError;

  const nodeIds = (nodes ?? []).map((n) => n.id);
  if (nodeIds.length === 0) return { nodes: [], edges: [] };

  // Oldest first: a goal is drawn under its first parent, and without an
  // order that could change from one load to the next.
  const { data: edges, error: edgesError } = await supabase
    .from("node_edges")
    .select("id, child_id, parent_id, weight")
    .in("child_id", nodeIds)
    .order("created_at", { ascending: true });
  if (edgesError) throw edgesError;

  return { nodes: nodes ?? [], edges: edges ?? [] };
}

export async function createNode(userId, fields) {
  const { data, error } = await supabase.from("nodes").insert({ user_id: userId, ...fields }).select().single();
  if (error) throw error;
  return data;
}

export async function updateNode(nodeId, fields) {
  const { data, error } = await supabase.from("nodes").update(fields).eq("id", nodeId).select().single();
  if (error) throw error;
  return data;
}

// Its sub-goals (with everything under them) move up to its parent, and what
// was linked to it counts toward the parent instead — one transaction on the
// server. Returns how many sub-goals moved.
export async function deleteNode(nodeId) {
  const { data, error } = await supabase.rpc("delete_goal", { p_node_id: nodeId });
  if (error) throw error;
  return data ?? 0;
}

export async function createEdge(childId, parentId, weight) {
  const { error } = await supabase.from("node_edges").insert({ child_id: childId, parent_id: parentId, weight: weight ?? null });
  if (error) throw error;
}

// "Goes under": swaps the parent a goal is drawn under. The new edge goes in
// before the old one comes out, so a failure halfway leaves the goal under
// both rather than under neither.
export async function moveNode(nodeId, fromParentId, toParentId) {
  if (fromParentId === toParentId) return;
  if (toParentId) {
    const { error } = await supabase
      .from("node_edges")
      .upsert({ child_id: nodeId, parent_id: toParentId }, { onConflict: "child_id,parent_id", ignoreDuplicates: true });
    if (error) throw error;
  }
  if (fromParentId) {
    const { error } = await supabase.from("node_edges").delete().eq("child_id", nodeId).eq("parent_id", fromParentId);
    if (error) throw error;
  }
}

export async function setFocused(nodeId, isFocused) {
  const { error } = await supabase.from("nodes").update({ is_focused: isFocused }).eq("id", nodeId);
  if (error) throw error;
}

// Backs both the Checkbox method (amount always 1) and the Counter method
// (arbitrary amount). The day is the phone's: the database clock is UTC,
// which is tomorrow for most of a Mountain-time evening.
export async function recordProgress(nodeId, amount = 1) {
  const { error } = await supabase.rpc("record_progress", { p_node_id: nodeId, p_amount: amount, p_today: todayStr() });
  if (error) throw error;
}

// Takes back the newest check-in made today (and the completion it brought,
// if the goal falls short of its target again).
export async function undoCheckin(nodeId) {
  const { error } = await supabase.rpc("undo_checkin", { p_node_id: nodeId, p_today: todayStr(), p_tz: localZone() });
  if (error) throw error;
}

// Note method: the note itself is the "activity" event. A trigger stamps
// the node's last_activity_at automatically on insert.
export async function recordNote(userId, nodeId, text) {
  const clean = (text ?? "").trim();
  if (!clean) throw new Error("Note can't be empty.");
  const { error } = await supabase.from("node_notes").insert({ user_id: userId, node_id: nodeId, note_text: clean });
  if (error) throw error;
}

export async function repeatNode(nodeId, newTarget) {
  const { error } = await supabase.rpc("repeat_node", { p_node_id: nodeId, p_new_target: newTarget ?? null });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Phase 0 — Minute tracking, win/loss log, prayer log.
// ---------------------------------------------------------------------------

// Tracking is multi-tag: one activity can be Serve AND Minister AND Meeting
// at once, and each tag is credited the full duration. `category` holds the
// first tag so older single-category code keeps working; `tags` is the truth.
export async function startTimeEntry(userId, { categories, description, subcategory, goalNodeId }) {
  const tags = (categories ?? []).filter(Boolean);
  if (tags.length === 0) throw new Error("Pick at least one category.");

  const { data, error } = await supabase
    .from("time_log_entries")
    .insert({
      user_id: userId,
      category: tags[0],
      subcategory: subcategory || null,
      description: description || null,
      goal_node_id: goalNodeId || null,
      // A goal chosen at the moment of tracking is your own decision, so it
      // is stamped as one — otherwise the linker offers it back to you later
      // as though a category rule had guessed it.
      goal_link_source: goalNodeId ? "manual" : null,
      tags,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// A stretch of time logged after the fact. With no `startedAt` it ends now
// and started `minutes` ago; with one (a past day's page) it starts there.
export async function logPastTimeEntry(userId, { categories, description, minutes, startedAt }) {
  const tags = (categories ?? []).filter(Boolean);
  if (tags.length === 0) throw new Error("Pick at least one category.");
  const started = startedAt ? new Date(startedAt) : new Date(Date.now() - minutes * 60000);
  const ended = new Date(started.getTime() + minutes * 60000);

  const { data, error } = await supabase
    .from("time_log_entries")
    .insert({
      user_id: userId,
      category: tags[0],
      description: description || null,
      tags,
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// `endedBy` says how it ended: a plain stop, the Going to bed button, or a
// runaway timer ended after the fact. `at` ends it earlier than now.
export async function stopTimeEntry(entryId, { endedBy = "stop", at } = {}) {
  const { data, error } = await supabase
    .from("time_log_entries")
    .update({ ended_at: (at ? new Date(at) : new Date()).toISOString(), ended_by: endedBy })
    .eq("id", entryId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Going to bed: whatever is running stops, and Sleep starts, in one tap.
export async function goToBed(userId, runningId) {
  if (runningId) await stopTimeEntry(runningId, { endedBy: "bedtime" });
  return startTimeEntry(userId, { categories: ["Sleep"] });
}

// A timer that ran through the night, split where sleep began: the entry
// ends there, and Sleep carries on from that moment (still running, so the
// morning check-in's "I'm up" ends it).
export async function splitIntoSleep(userId, entry, sleepAt) {
  const at = new Date(sleepAt).toISOString();
  await stopTimeEntry(entry.id, { endedBy: "overnight_fix", at });
  const { data, error } = await supabase
    .from("time_log_entries")
    .insert({ user_id: userId, category: "Sleep", tags: ["Sleep"], started_at: at, split_from: entry.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Sleep entries since a moment, newest first: last night for the morning
// check-in, the last month for your usual lights-out.
export async function fetchSleepEntries(userId, sinceISO) {
  const { data, error } = await supabase
    .from("time_log_entries")
    .select("id, started_at, ended_at, duration_minutes, tags, category, is_nap")
    .eq("user_id", userId)
    .contains("tags", ["Sleep"])
    .gte("started_at", sinceISO)
    .order("started_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  return data ?? [];
}

// Old timers that ran through the night, with what else started while each
// one ran and the recent Sleep entries your usual lights-out comes from:
// everything the fix list needs to propose each fix.
export async function fetchOvernightTimers(userId) {
  const { data, error } = await supabase
    .from("time_log_entries")
    .select("id, description, category, tags, started_at, ended_at, ended_by, is_example")
    .eq("user_id", userId)
    .eq("is_example", false)
    .is("ended_by", null)
    .not("ended_at", "is", null)
    .not("tags", "cs", "{Sleep}")
    .gte("duration_minutes", RUNAWAY_HOURS * 60)
    .order("started_at", { ascending: true })
    .limit(1000);
  if (error) throw error;
  const timers = (data ?? []).filter(ranThroughNight);
  if (timers.length === 0) return { timers, others: [], sleeps: [] };

  // Only the entries that started while one of them ran. Times are quoted:
  // a timestamp's dots and colons mean something else in a filter.
  const during = timers
    .map((t) => `and(started_at.gt."${new Date(t.started_at).toISOString()}",started_at.lt."${new Date(t.ended_at).toISOString()}")`)
    .join(",");
  const [others, sleeps] = await Promise.all([
    supabase
      .from("time_log_entries")
      .select("id, description, category, tags, started_at, ended_at, is_nap, is_example")
      .eq("user_id", userId)
      .eq("is_example", false)
      .or(during)
      .order("started_at", { ascending: true })
      .limit(1000),
    fetchSleepEntries(userId, new Date(Date.now() - 60 * 86400000).toISOString()),
  ]);
  if (others.error) throw others.error;
  return { timers, others: others.data ?? [], sleeps };
}

// One old overnight timer, fixed: it ends at `end`, keeping the end it had
// in original_ended_at, and when you were asleep, Sleep runs from
// `sleepFrom` to `sleepUntil`. One step on the server, so a fix is never
// half done.
export async function fixOvernightTimer({ id, end, sleepFrom = null, sleepUntil = null }) {
  const { error } = await supabase.rpc("fix_overnight_timer", {
    p_id: id,
    p_end: new Date(end).toISOString(),
    p_sleep_from: sleepFrom ? new Date(sleepFrom).toISOString() : null,
    p_sleep_until: sleepUntil ? new Date(sleepUntil).toISOString() : null,
  });
  if (error) throw error;
}

// Old overnight timers left as they were. 'stop' is what they always were:
// a timer stopped by hand, at the time it says.
export async function keepOvernightTimers(ids) {
  if (!ids.length) return;
  const { error } = await supabase.from("time_log_entries").update({ ended_by: "stop" }).in("id", ids).is("ended_by", null);
  if (error) throw error;
}

// Recent stretches that can name people: what's been picked before, and
// descriptions to find names in ("Date with Zimi").
export async function fetchPeopleHistory(userId) {
  const since = new Date(Date.now() - 120 * 86400000).toISOString();
  const { data, error } = await supabase
    .from("time_log_entries")
    .select("id, people, description, started_at, tags, category")
    .eq("user_id", userId)
    .gte("started_at", since)
    .or("people.not.is.null,description.not.is.null")
    .order("started_at", { ascending: false })
    .limit(400);
  if (error) throw error;
  return data ?? [];
}

export async function updateTimeEntry(entryId, fields) {
  const { error } = await supabase.from("time_log_entries").update(fields).eq("id", entryId);
  if (error) throw error;
}

// One tap from whatever is running to something else (Waste, a temple
// visit): the running timer ends now and the new one starts. Returns both,
// so the one that stopped can still be asked about.
export async function switchTimer(userId, runningId, { categories, description }) {
  const stopped = runningId ? await stopTimeEntry(runningId) : null;
  const started = await startTimeEntry(userId, { categories, description });
  return { stopped, started };
}

// Clients you've picked before, newest first: on work time and on deposits.
export async function fetchClientHistory(userId) {
  const [entries, deposits] = await Promise.all([
    supabase
      .from("time_log_entries")
      .select("client, started_at")
      .eq("user_id", userId)
      .not("client", "is", null)
      .order("started_at", { ascending: false })
      .limit(200),
    supabase
      .from("bank_transactions")
      .select("client, posted_at")
      .eq("user_id", userId)
      .not("client", "is", null)
      .order("posted_at", { ascending: false })
      .limit(50),
  ]);
  if (entries.error) throw entries.error;
  if (deposits.error) throw deposits.error;
  return [
    ...(entries.data ?? []).map((r) => ({ client: r.client, at: r.started_at })),
    ...(deposits.data ?? []).map((r) => ({ client: r.client, at: r.posted_at })),
  ]
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .map((r) => r.client);
}

export async function deleteTimeEntry(entryId) {
  const { error } = await supabase.from("time_log_entries").delete().eq("id", entryId);
  if (error) throw error;
}

export async function deleteWinLoss(id) {
  const { error } = await supabase.from("win_losses").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchOpenTimeEntry(userId) {
  const { data, error } = await supabase
    .from("time_log_entries")
    .select("*")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchTimeEntries(userId, { sinceISO, limit = 100 } = {}) {
  let query = supabase.from("time_log_entries").select("*").eq("user_id", userId).order("started_at", { ascending: false }).limit(limit);
  if (sinceISO) query = query.gte("started_at", sinceISO);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// Entries whose started_at falls on the given local calendar date (YYYY-MM-DD) —
// used for the planner's plan-vs-actual comparison.
export async function fetchTimeEntriesForDate(userId, dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { data, error } = await supabase
    .from("time_log_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("started_at", start.toISOString())
    .lt("started_at", end.toISOString())
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// A tap made on the phone carries its own id and time, so a tap that waited
// offline lands on the day it was made, and sending it twice can't make two
// rows: the second insert hits the same id and is reported as a duplicate
// (code 23505), which the outbox treats as already saved.
export async function logWinLoss(userId, { kind, habitLabel, goalNodeId, note, id, occurredAt }) {
  const row = { user_id: userId, kind, habit_label: habitLabel, goal_node_id: goalNodeId || null, note: note || null };
  if (id) row.id = id;
  if (occurredAt) row.occurred_at = occurredAt;
  const { data, error } = await supabase.from("win_losses").insert(row).select().single();
  if (error) throw error;
  return data;
}

// One-tap wins are logged first and named after, so the label is the one
// field that gets edited once the row already exists.
export async function updateWinLoss(id, fields) {
  const { error } = await supabase.from("win_losses").update(fields).eq("id", id);
  if (error) throw error;
}

// The wins you log most, for one-tap chips. Labels are typed freehand, so
// they're grouped case- and space-insensitively and shown in the spelling
// you used most recently.
export async function fetchTopWinLabels(userId, { days = 30, limit = 4 } = {}) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase
    .from("win_losses")
    .select("habit_label, occurred_at")
    .eq("user_id", userId)
    .eq("kind", "win")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const groups = new Map();
  for (const r of data ?? []) {
    const label = (r.habit_label ?? "").trim();
    const key = label.toLowerCase().replace(/\s+/g, " ");
    if (!key || key === "win") continue;
    const g = groups.get(key) ?? { label, count: 0 };
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((g) => g.label);
}

// Reasons given for past misses, most recent first, for the reason chips.
export async function fetchLossReasons(userId) {
  const { data, error } = await supabase
    .from("win_losses")
    .select("reason, occurred_at")
    .eq("user_id", userId)
    .not("reason", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => r.reason);
}

// The rows a morning check-in wrote replace the ones it wrote before (an
// edited check-in), and never touch anything tapped by hand.
export async function replaceCheckinWinLosses(userId, sinceISO, rows) {
  const { error: delError } = await supabase
    .from("win_losses")
    .delete()
    .eq("user_id", userId)
    .eq("source", "checkin")
    .gte("occurred_at", sinceISO);
  if (delError) throw delError;
  if (rows.length === 0) return;
  const { error } = await supabase.from("win_losses").insert(rows.map((r) => ({ ...r, user_id: userId, source: "checkin" })));
  if (error) throw error;
}

export async function fetchWatchedHabits(userId) {
  const { data, error } = await supabase
    .from("watched_habits")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchWinLosses(userId, { sinceISO, limit = 100 } = {}) {
  let query = supabase.from("win_losses").select("*").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(limit);
  if (sinceISO) query = query.gte("occurred_at", sinceISO);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// Weight (and later steps and resting heart rate), one row per reading.
export async function saveBodyMetric(userId, { kind = "weight", value, unit = "lb", date, measuredAt }) {
  const n = Number(value);
  if (!(n > 0)) throw new Error("Enter a number.");
  const at = measuredAt ? new Date(measuredAt) : new Date();
  const { data, error } = await supabase
    .from("body_metrics")
    .insert({ user_id: userId, kind, value: n, unit, date: date ?? toDateStr(at), measured_at: at.toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Readings of one kind, newest first. Examples are left out.
export async function fetchBodyMetrics(userId, { kind = "weight", sinceISO, limit = 400 } = {}) {
  let q = supabase
    .from("body_metrics")
    .select("id, date, measured_at, value, unit")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("is_example", false)
    .order("measured_at", { ascending: false })
    .limit(limit);
  if (sinceISO) q = q.gte("measured_at", sinceISO);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function logPrayer(userId, { context, content, feltResponse, tags, prayedAt }) {
  const row = { user_id: userId, context: context || null, content, felt_response: feltResponse || null, tags: tags ?? [] };
  if (prayedAt) row.prayed_at = prayedAt;
  const { data, error } = await supabase
    .from("prayer_logs")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Phase 2 — Daily Planning & Time-Chunking.
// ---------------------------------------------------------------------------

export async function fetchDayPlan(userId, date) {
  const { data, error } = await supabase.from("day_plans").select("*").eq("user_id", userId).eq("date", date).maybeSingle();
  if (error) throw error;
  return data;
}

// The morning check-in's answers, on the day they belong to.
export async function saveMorning(userId, date, fields) {
  return patchDayPlan(userId, date, fields);
}

// Some fields of a day's plan, leaving the others as they are. The row is
// made if the day doesn't have one yet (tomorrow's alarm, set tonight).
export async function patchDayPlan(userId, date, fields) {
  const { data, error } = await supabase
    .from("day_plans")
    .upsert({ user_id: userId, date, ...fields }, { onConflict: "user_id,date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Stress sources and off-plan reasons you've given before, newest first, to
// come back as chips.
export async function fetchEveningHistory(userId) {
  const { data, error } = await supabase
    .from("day_plans")
    .select("date, stress_source, off_plan_reason")
    .eq("user_id", userId)
    .or("stress_source.not.is.null,off_plan_reason.not.is.null")
    .order("date", { ascending: false })
    .limit(60);
  if (error) throw error;
  const rows = data ?? [];
  return {
    stressSources: rows.map((r) => r.stress_source).filter(Boolean),
    offPlanReasons: rows.map((r) => r.off_plan_reason).filter(Boolean),
  };
}

// The alarm used most recently before a day, to offer it again.
export async function fetchLastAlarm(userId, beforeDate) {
  const { data, error } = await supabase
    .from("day_plans")
    .select("date, alarm_at")
    .eq("user_id", userId)
    .lt("date", beforeDate)
    .not("alarm_at", "is", null)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.alarm_at ?? null;
}

export async function setDayEnergyTag(userId, date, energyTag) {
  const { error } = await supabase.from("day_plans").upsert({ user_id: userId, date, energy_tag: energyTag }, { onConflict: "user_id,date" });
  if (error) throw error;
}

export async function fetchTimeChunks(userId, date) {
  const { data, error } = await supabase
    .from("time_chunks")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTimeChunk(userId, fields) {
  const { data, error } = await supabase.from("time_chunks").insert({ user_id: userId, ...fields }).select().single();
  if (error) throw error;
  return data;
}

// Moving or renaming a block keeps its tasks and its notes, which deleting
// and re-adding it never did. Returns the saved row.
export async function updateTimeChunk(chunkId, fields) {
  const { data, error } = await supabase.from("time_chunks").update(fields).eq("id", chunkId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTimeChunk(chunkId) {
  const { error } = await supabase.from("time_chunks").delete().eq("id", chunkId);
  if (error) throw error;
}

// Several blocks in one round trip (replacing a day with a preset). Their
// tasks stay on the day, unscheduled.
export async function deleteTimeChunks(chunkIds) {
  if (chunkIds.length === 0) return;
  const { error } = await supabase.from("time_chunks").delete().in("id", chunkIds);
  if (error) throw error;
}

export async function fetchTasks(userId, date) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTask(userId, fields) {
  const { data, error } = await supabase.from("tasks").insert({ user_id: userId, ...fields }).select().single();
  if (error) throw error;
  return data;
}

export async function updateTask(taskId, fields) {
  const { error } = await supabase.from("tasks").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", taskId);
  if (error) throw error;
}

// Why tasks were left undone before, newest first, to come back as chips.
export async function fetchTaskReasons(userId) {
  const { data, error } = await supabase
    .from("tasks")
    .select("left_reason, date")
    .eq("user_id", userId)
    .not("left_reason", "is", null)
    .order("date", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => r.left_reason);
}

export async function toggleTask(taskId, done) {
  await updateTask(taskId, { status: done, completed_at: done ? new Date().toISOString() : null });
}

export async function deleteTask(taskId) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

// Takes back what a preset just put on the day.
export async function deleteTasks(taskIds) {
  if (taskIds.length === 0) return;
  const { error } = await supabase.from("tasks").delete().in("id", taskIds);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Plan presets (reusable blocks and whole days) + overview rollups.
// ---------------------------------------------------------------------------

export async function fetchTemplates(userId, kind) {
  let query = supabase.from("plan_templates").select("*").eq("user_id", userId).order("name", { ascending: true });
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// Creates a single-block preset ("chunk" kind) plus its tasks in one go.
export async function createChunkTemplate(userId, { name, title, startTime, endTime, goalNodeId, taskTitles = [] }) {
  const { data: template, error } = await supabase
    .from("plan_templates")
    .insert({ user_id: userId, name, kind: "chunk" })
    .select()
    .single();
  if (error) throw error;

  const { data: chunk, error: cErr } = await supabase
    .from("template_chunks")
    .insert({ template_id: template.id, title, start_time: startTime, end_time: endTime, goal_node_id: goalNodeId || null })
    .select()
    .single();
  if (cErr) throw cErr;

  const rows = taskTitles.filter((t) => t.trim()).map((t, i) => ({ template_chunk_id: chunk.id, title: t.trim(), position: i }));
  if (rows.length > 0) {
    const { error: tErr } = await supabase.from("template_tasks").insert(rows);
    if (tErr) throw tErr;
  }
  return template;
}

export async function deleteTemplate(templateId) {
  const { error } = await supabase.from("plan_templates").delete().eq("id", templateId);
  if (error) throw error;
}

// Stamps a preset onto a date (server-side, one round trip). Returns the
// number of blocks created.
export async function applyTemplate(templateId, date) {
  const { data, error } = await supabase.rpc("apply_plan_template", { p_template_id: templateId, p_date: date });
  if (error) throw error;
  return data;
}

export async function saveDayAsTemplate(date, name) {
  const { data, error } = await supabase.rpc("save_day_as_template", { p_date: date, p_name: name });
  if (error) throw error;
  return data;
}

// Per-day rollup for the month/year overview grids — one call per range.
// The browser's own zone goes along for the ride so logged time buckets
// into the right local day (an 8pm entry is tonight, not tomorrow-in-UTC).
export async function fetchPlanSummary(startDate, endDate) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { data, error } = await supabase.rpc("plan_summary", { p_start: startDate, p_end: endDate, p_tz: tz });
  if (error) throw error;
  return data ?? [];
}

// The time zone this device is in, which the database's day-by-day rollups
// count days in.
function localZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

// ---------------------------------------------------------------------------
// Phase 4 — Spiritual layer.
// ---------------------------------------------------------------------------

// Re-indexes every verse reference in a piece of text against its entity.
// Deletes first so an edit that REMOVES a reference doesn't leave the old
// row behind pointing at text that no longer mentions it.
// Callers treat this as best effort: the entry itself is already saved, and
// reporting a failed index update as a failed save would invite a second,
// duplicate entry.
async function syncScriptureRefs(userId, entityType, entityId, ...texts) {
  const combined = texts.filter(Boolean).join("\n");
  const refs = parseScriptureRefs(combined);

  await supabase.from("scripture_refs").delete().eq("entity_type", entityType).eq("entity_id", entityId);
  if (refs.length === 0) return [];

  const rows = refs.map((r) => ({
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    book: r.book,
    chapter: r.chapter,
    verse_start: r.verseStart,
    verse_end: r.verseEnd,
    raw_ref: r.rawRef,
  }));
  const { error } = await supabase.from("scripture_refs").insert(rows);
  if (error) throw error;
  return refs;
}

export async function logExperience(userId, { kind, whatCame, triggerContext, linkedGoalId, tags, occurredAt }) {
  const row = {
    user_id: userId,
    kind: kind || "prompting",
    what_came: whatCame,
    trigger_context: triggerContext || null,
    linked_goal_id: linkedGoalId || null,
    tags: tags ?? [],
  };
  if (occurredAt) row.occurred_at = occurredAt;
  const { data, error } = await supabase
    .from("spiritual_experiences")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  await syncScriptureRefs(userId, "experience", data.id, whatCame, triggerContext).catch((err) => console.warn(err));
  return data;
}

export async function updateExperience(userId, experienceId, fields) {
  const { data, error } = await supabase
    .from("spiritual_experiences")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", experienceId)
    .select()
    .single();
  if (error) throw error;
  await syncScriptureRefs(userId, "experience", experienceId, data.what_came, data.trigger_context, data.follow_up_notes).catch((err) => console.warn(err));
  return data;
}

// The verse index first: if that fails nothing is gone yet, so an Undo toast
// that puts the row back is telling the truth.
export async function deleteExperience(experienceId) {
  const { error: refsError } = await supabase.from("scripture_refs").delete().eq("entity_type", "experience").eq("entity_id", experienceId);
  if (refsError) throw refsError;
  const { error } = await supabase.from("spiritual_experiences").delete().eq("id", experienceId);
  if (error) throw error;
}

// Closing the loop: what you actually did, and what came of it.
export async function closeExperienceLoop(userId, experienceId, { actionTaken, followUpNotes }) {
  return updateExperience(userId, experienceId, {
    acted_on: true,
    acted_on_at: new Date().toISOString(),
    action_taken: actionTaken || null,
    follow_up_notes: followUpNotes || null,
  });
}

export async function fetchExperiences(userId, { limit = 100, sinceISO } = {}) {
  let query = supabase
    .from("spiritual_experiences")
    .select("*")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (sinceISO) query = query.gte("occurred_at", sinceISO);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// Promptings still waiting on a follow-up, oldest first — the weekly-review
// queue. `minAgeHours` keeps something logged an hour ago out of the way;
// it hasn't had a chance to be acted on yet. Only promptings: a tender mercy
// or a comfort is something to keep, not something to do.
export async function fetchOpenLoops(userId, { minAgeHours = 24 } = {}) {
  const cutoff = new Date(Date.now() - minAgeHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("spiritual_experiences")
    .select("*")
    .eq("user_id", userId)
    .eq("kind", "prompting")
    .eq("acted_on", false)
    .lte("occurred_at", cutoff)
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createStudyNote(userId, { title, body, sourceKind, sourceRef, studiedOn, linkedGoalId, tags }) {
  const { data, error } = await supabase
    .from("study_notes")
    .insert({
      user_id: userId,
      title,
      body,
      source_kind: sourceKind || "other",
      source_ref: sourceRef || null,
      studied_on: studiedOn || todayStr(),
      linked_goal_id: linkedGoalId || null,
      tags: tags ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  await syncScriptureRefs(userId, "study_note", data.id, title, body, sourceRef).catch((err) => console.warn(err));
  return data;
}

export async function fetchOnThisDay() {
  const { data, error } = await supabase.rpc("on_this_day", { p_tz: localZone() });
  if (error) throw error;
  return data ?? [];
}

export async function fetchEntriesForScripture(book, chapter) {
  const { data, error } = await supabase.rpc("entries_for_scripture", {
    p_book: book,
    p_chapter: chapter ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

// Distinct books/chapters you've referenced, for the cross-reference picker.
export async function fetchReferencedScriptures(userId) {
  const { data, error } = await supabase
    .from("scripture_refs")
    .select("book, chapter, raw_ref")
    .eq("user_id", userId);
  if (error) throw error;

  const byBook = new Map();
  for (const r of data ?? []) {
    const entry = byBook.get(r.book) ?? { book: r.book, count: 0, chapters: new Set() };
    entry.count += 1;
    if (r.chapter != null) entry.chapters.add(r.chapter);
    byBook.set(r.book, entry);
  }
  return [...byBook.values()]
    .map((e) => ({ ...e, chapters: [...e.chapters].sort((a, b) => a - b) }))
    .sort((a, b) => b.count - a.count);
}

// Also index prayers, which Phase 0 wrote before scripture_refs existed.
export async function logPrayerWithRefs(userId, fields) {
  const prayer = await logPrayer(userId, fields);
  await syncScriptureRefs(userId, "prayer", prayer.id, fields.content, fields.context, fields.feltResponse).catch((err) => console.warn(err));
  return prayer;
}

// Fixing a prayer you wrote. Its verse references are re-indexed from the new
// words, so an edit that removes "Alma 32" stops listing it under Alma.
export async function updatePrayer(userId, prayerId, { context, content, feltResponse }) {
  const row = {};
  if (context !== undefined) row.context = context?.trim() || null;
  if (content !== undefined) row.content = content.trim();
  if (feltResponse !== undefined) row.felt_response = feltResponse?.trim() || null;
  const { data, error } = await supabase.from("prayer_logs").update(row).eq("id", prayerId).select().single();
  if (error) throw error;
  await syncScriptureRefs(userId, "prayer", prayerId, data.content, data.context, data.felt_response).catch((err) => console.warn(err));
  return data;
}

// References first, as with an experience: left behind, they'd list a prayer
// under its verses that no longer exists.
export async function deletePrayer(prayerId) {
  const { error: refsError } = await supabase.from("scripture_refs").delete().eq("entity_type", "prayer").eq("entity_id", prayerId);
  if (refsError) throw refsError;
  const { error } = await supabase.from("prayer_logs").delete().eq("id", prayerId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Phase 4.7 — Daily Journal & Day Archive.
// ---------------------------------------------------------------------------

export async function fetchDayArchive(dateStr) {
  const { data, error } = await supabase.rpc("day_archive", { p_date: dateStr, p_tz: localZone() });
  if (error) throw error;
  return data;
}

// Writes only the answers it is given. The evening has changed its questions
// over time, and a day reflected under the old set must not lose those
// answers because the new flow never sends them — so an absent field is left
// alone and only an explicit value (including "") is written.
export async function saveJournalEntry(userId, dateStr, fields) {
  const columns = {
    thoughts: "thoughts",
    gratitude: "gratitude",
    godsHand: "gods_hand",
    qChrist: "q_christ",
    qPrinciples: "q_principles",
    qSuccess: "q_success",
    qSavior: "q_savior",
    qLearn: "q_learn",
  };
  const row = { user_id: userId, date: dateStr, updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(columns)) {
    if (fields[key] !== undefined) row[column] = fields[key] || null;
  }
  const { completed } = fields;
  // Only stamped on the pass that finishes the reflection — saving a draft
  // must never make the day look reflected-on when it isn't.
  if (completed) row.reflection_completed_at = new Date().toISOString();

  const { error } = await supabase.from("journal_entries").upsert(row, { onConflict: "user_id,date" });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Goal linking — the credit that flows up the tree.
// ---------------------------------------------------------------------------

// What fed which goal over a range, with credit rolled up to ancestors.
export async function fetchGoalCredit(startDate, endDate) {
  const { data, error } = await supabase.rpc("goal_credit", {
    p_start: startDate,
    p_end: endDate,
    p_tz: localZone(),
  });
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// The assistant. Everything runs in the `assistant` Edge Function so the
// Anthropic key stays server-side — nothing here ever sees it.
// ---------------------------------------------------------------------------

// Every edge function is called the same way: as you, with your session's
// token, and with its errors turned into a sentence. A 504 comes back as the
// gateway's own HTML rather than our JSON — it means the function ran past
// Supabase's 150-second ceiling, so say that instead of "unreadable".
async function callFunction(name, payload, what) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("You need to be signed in.");

  const response = await fetch(`${supabase.supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabase.supabaseKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({
    error:
      response.status === 504
        ? "That took longer than the 150 seconds the server allows. Try a smaller stretch."
        : `${what} returned something unreadable.`,
  }));
  if (!response.ok || body?.error) {
    const err = new Error(body?.error ?? `${what} failed (${response.status}).`);
    err.status = response.status;
    throw err;
  }
  return body;
}

function callAssistant(action, payload = {}) {
  return callFunction("assistant", { action, tz: localZone(), ...payload }, "The assistant");
}

// `notes` is whatever you typed into "anything I should know about
// tomorrow?" before pressing generate — the one piece of context the app
// cannot read off your own logs.
export function proposePlans({ notes, forDate } = {}) {
  return callAssistant("propose_plan", { notes: notes || null, for_date: forDate || null });
}

// The record one goal keeps: every entry, finished task and win that landed
// on it or anywhere beneath it, each labelled with the node it actually
// landed on. Answers "what time went to this, and through what".
export async function fetchGoalLedger(nodeId, startDate, endDate) {
  const { data, error } = await supabase.rpc("goal_ledger", {
    p_node_id: nodeId,
    p_start: startDate,
    p_end: endDate,
    p_tz: localZone(),
  });
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Ideal days — the shape a weekday is supposed to have.
//
// Stored as ordinary day templates, so anything that already applies a
// template to a date works on them unchanged. What makes one an "ideal day"
// is that it names the weekdays it governs; the planner reads it alongside
// the last fortnight of what actually happened.
// ---------------------------------------------------------------------------

export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// One round trip: ideal_days() returns every day template with its blocks
// and their tasks, already in the shape the planner edits.
export async function fetchIdealDays() {
  const { data, error } = await supabase.rpc("ideal_days");
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    notes: d.notes ?? "",
    weekdays: d.weekdays ?? [],
    blocks: (d.blocks ?? []).map((b) => ({
      title: b.title,
      category: b.category ?? "",
      start: b.start ?? "",
      end: b.end ?? "",
      tasks: b.tasks ?? [],
    })),
  }));
}

// Saves a whole ideal day at once. The blocks are replaced rather than
// diffed — an ideal day is short and edited as a single shape, and a
// replace can't leave a half-applied schedule behind.
export async function saveIdealDay(userId, { id, name, notes, weekdays, blocks }) {
  let templateId = id;
  const fields = {
    name: name?.trim() || "Untitled day",
    notes: notes?.trim() || null,
    applies_to_weekdays: (weekdays ?? []).length > 0 ? weekdays : null,
  };

  if (templateId) {
    const { error } = await supabase.from("plan_templates").update(fields).eq("id", templateId);
    if (error) throw error;
    const { data: old, error: oErr } = await supabase.from("template_chunks").select("id").eq("template_id", templateId);
    if (oErr) throw oErr;
    if ((old ?? []).length > 0) {
      const { error: dErr } = await supabase
        .from("template_chunks")
        .delete()
        .in("id", old.map((c) => c.id));
      if (dErr) throw dErr;
    }
  } else {
    const { data, error } = await supabase
      .from("plan_templates")
      .insert({ user_id: userId, kind: "day", ...fields })
      .select()
      .single();
    if (error) throw error;
    templateId = data.id;
  }

  const ordered = [...(blocks ?? [])].filter((b) => b.title?.trim() && b.start && b.end).sort((a, b) => a.start.localeCompare(b.start));

  for (const [position, block] of ordered.entries()) {
    const { data: chunk, error } = await supabase
      .from("template_chunks")
      .insert({
        template_id: templateId,
        title: block.title.trim(),
        category: block.category?.trim() || null,
        start_time: block.start,
        end_time: block.end,
        position,
      })
      .select()
      .single();
    if (error) throw error;

    const taskRows = (block.tasks ?? [])
      .filter((t) => t.trim())
      .map((t, i) => ({ template_chunk_id: chunk.id, title: t.trim(), position: i }));
    if (taskRows.length > 0) {
      const { error: tErr } = await supabase.from("template_tasks").insert(taskRows);
      if (tErr) throw tErr;
    }
  }

  return templateId;
}

// The ideal day governing a given date, if one claims that weekday.
export function idealDayFor(idealDays, dateStr) {
  // Built from parts rather than Date.parse: "2026-09-12" parsed as a string
  // is UTC midnight, which is the previous weekday west of Greenwich.
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return idealDays.find((day) => (day.weekdays ?? []).includes(dow)) ?? null;
}

// The day as a clock face. Returns date -> arcs in local minutes past
// midnight, already split at the day boundary so a night's sleep paints the
// end of one ring and the start of the next.
export async function fetchDayRings(startDate, endDate) {
  const { data, error } = await supabase.rpc("day_rings", {
    p_start: startDate,
    p_end: endDate ?? startDate,
    p_tz: localZone(),
  });
  if (error) throw error;

  const byDay = new Map();
  for (const row of data ?? []) {
    if (!byDay.has(row.day)) byDay.set(row.day, []);
    byDay.get(row.day).push(row);
  }
  return byDay;
}

// ---------------------------------------------------------------------------
// Week planning — commitments first, ideal days for the rest.
// ---------------------------------------------------------------------------

// What the week is FOR, with how the last one actually went. A target has
// no time attached — that is the whole difficulty with one, and the reason
// it has to be stated somewhere rather than hoped for.
export async function fetchWeeklyTargets(weekStart) {
  const { data, error } = await supabase.rpc("weekly_targets", {
    p_week_start: weekStart,
    p_tz: localZone(),
  });
  if (error) throw error;
  return data ?? [];
}

export async function saveWeeklyTarget(userId, { id, label, categories, minutes, period, position }) {
  const row = {
    label: label?.trim() || "Untitled",
    categories: (categories ?? []).filter(Boolean),
    minutes: Math.max(1, Math.round(Number(minutes) || 0)),
    period: period === "day" ? "day" : "week",
    position: position ?? 0,
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const { error } = await supabase.from("weekly_targets").update(row).eq("id", id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase
    .from("weekly_targets")
    .insert({ user_id: userId, ...row })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteWeeklyTarget(id) {
  const { error } = await supabase.from("weekly_targets").delete().eq("id", id);
  if (error) throw error;
}

// Standing blocks — the same time every week, stamped onto each matching
// date eight weeks ahead as an ordinary commitment.
export async function fetchStandingBlocks() {
  const { data, error } = await supabase
    .from("standing_blocks")
    .select("*")
    .eq("active", true)
    .order("weekday", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addStandingBlock(userId, { weekday, title, category, start, end }) {
  const { error } = await supabase.from("standing_blocks").insert({
    user_id: userId,
    weekday: Number(weekday),
    title: title.trim(),
    category: category || null,
    start_time: start,
    end_time: end,
  });
  if (error) throw error;
  const { error: stampError } = await supabase.rpc("stamp_my_standing_blocks");
  if (stampError) throw stampError;
}

// Takes the future occurrences with it; past ones are history.
export async function removeStandingBlock(id) {
  const { error } = await supabase.rpc("remove_standing_block", { p_id: id });
  if (error) throw error;
}

// Throws away a week's proposal so it can be asked for again. Only the
// planner's own blocks go — never one you scheduled, never one with tasks.
export async function clearWeekPlan(weekStart) {
  const { data, error } = await supabase.rpc("clear_week_plan", { p_start: weekStart });
  if (error) throw error;
  return data ?? 0;
}

// `overrides` is a rebalance: amounts the person set by hand after looking
// at a draft, which replace the targets for that one pass. `only` narrows
// the reply to a few dates — the budget is decided before any call, so the
// week can be laid out in slices without the totals drifting.
export function proposeWeek({ weekStart, notes, overrides, only } = {}) {
  return callAssistant("propose_week", {
    week_start: weekStart,
    notes: notes || null,
    overrides: overrides?.length ? overrides : null,
    only: only?.length ? only : null,
  });
}

// Commits a whole week at once.
//
// Only this planner's own previous output is swept. Anything you put on a
// day yourself is a commitment by definition — you scheduled it — and a
// block with tasks already hanging off it belongs to a day that has started
// being lived. Neither is ever touched.
export async function applyWeekPlan(userId, days) {
  const dates = days.map((d) => d.date);

  const { data: existing, error: exErr } = await supabase
    .from("time_chunks")
    .select("id, date, source")
    .eq("user_id", userId)
    .in("date", dates);
  if (exErr) throw exErr;

  const chunkIds = (existing ?? []).map((c) => c.id);
  let withTasks = new Set();
  if (chunkIds.length > 0) {
    const { data: tasks, error: tErr } = await supabase
      .from("tasks")
      .select("time_chunk_id")
      .in("time_chunk_id", chunkIds);
    if (tErr) throw tErr;
    withTasks = new Set((tasks ?? []).map((t) => t.time_chunk_id));
  }

  const sweep = (existing ?? [])
    .filter((c) => c.source === "plan" && !withTasks.has(c.id))
    .map((c) => c.id);
  for (let i = 0; i < sweep.length; i += 50) {
    const { error } = await supabase.from("time_chunks").delete().in("id", sweep.slice(i, i + 50));
    if (error) throw error;
  }

  const rows = [];
  for (const day of days) {
    for (const block of day.blocks ?? []) {
      if (!block.title?.trim() || !block.start || !block.end) continue;
      if (block.source !== "plan") continue; // already on the day, untouched
      rows.push({
        user_id: userId,
        date: day.date,
        title: block.title.trim(),
        category: block.category ?? null,
        start_time: block.start,
        end_time: block.end,
        source: "plan",
      });
    }
  }
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from("time_chunks").insert(rows.slice(i, i + 100));
    if (error) throw error;
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Categories — the tracker's vocabulary, owned by the user.
// ---------------------------------------------------------------------------

export async function fetchCategories(userId, { includeArchived = false } = {}) {
  let query = supabase.from("user_categories").select("*").eq("user_id", userId);
  if (!includeArchived) query = query.eq("archived", false);
  const { data, error } = await query.order("position", { ascending: true }).order("name", { ascending: true });
  if (error) throw error;

  // First run on a device: fill the list from the defaults plus whatever
  // has already been logged, so the picker is never empty.
  if ((data ?? []).length === 0) {
    const { error: seedError } = await supabase.rpc("seed_user_categories");
    if (seedError) throw seedError;
    const { data: seeded, error: reError } = await supabase
      .from("user_categories")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("position", { ascending: true });
    if (reError) throw reError;
    return seeded ?? [];
  }
  return data;
}

export async function createCategory(userId, { name, color }) {
  const clean = (name ?? "").trim();
  if (!clean) throw new Error("Give the category a name.");
  const { error } = await supabase.from("user_categories").upsert(
    { user_id: userId, name: clean, color: color || "#71717a", archived: false, position: 50 },
    { onConflict: "user_id,name" }
  );
  if (error) throw error;
}

// Archive rather than delete: a used category is attached to months of
// history, and removing it would rewrite what those entries meant.
export async function archiveCategory(categoryId) {
  const { error } = await supabase.from("user_categories").update({ archived: true }).eq("id", categoryId);
  if (error) throw error;
}

export async function restoreCategory(categoryId) {
  const { error } = await supabase.from("user_categories").update({ archived: false }).eq("id", categoryId);
  if (error) throw error;
}

// Turns one accepted proposal into real blocks and tasks on a date.
// Committing a day's plan REPLACES the rough shape the week planner put on
// that day, rather than stacking on top of it. This only inserted before,
// which meant planning tomorrow in detail left the day holding two versions
// of itself — the week's broad blocks and the day's, overlapping.
//
// Only the week planner's own output is swept, and only where no tasks hang
// off it. Anything you scheduled yourself stays, as it does everywhere else.
export async function applyProposedPlan(userId, dateStr, plan) {
  const { data: existing, error: exErr } = await supabase
    .from("time_chunks")
    .select("id, source")
    .eq("user_id", userId)
    .eq("date", dateStr);
  if (exErr) throw exErr;

  const generated = (existing ?? []).filter((c) => c.source === "plan").map((c) => c.id);
  let withTasks = new Set();
  if (generated.length > 0) {
    const { data: tasks, error: tErr } = await supabase
      .from("tasks")
      .select("time_chunk_id")
      .in("time_chunk_id", generated);
    if (tErr) throw tErr;
    withTasks = new Set((tasks ?? []).map((t) => t.time_chunk_id));
  }

  const sweep = generated.filter((id) => !withTasks.has(id));
  if (sweep.length > 0) {
    const { error } = await supabase.from("time_chunks").delete().in("id", sweep);
    if (error) throw error;
  }

  for (const block of plan.blocks ?? []) {
    const chunk = await createTimeChunk(userId, {
      date: dateStr,
      start_time: block.start,
      end_time: block.end,
      title: block.title,
      // Marked as planned, not manual: a block put here by a generator
      // should stay sweepable by the next one. The tasks underneath are
      // what protect it once you have started working the day.
      source: "plan",
    });
    for (const [position, title] of (block.tasks ?? []).entries()) {
      await createTask(userId, { date: dateStr, time_chunk_id: chunk.id, title, position });
    }
  }
}

// Lightweight id+title list for goal-link pickers elsewhere in the app —
// deliberately not the full fetchTree (no edges, no tracking state needed
// just to tag an entry).
export async function fetchGoalOptions(userId) {
  const { data, error } = await supabase.from("nodes").select("id, title").eq("user_id", userId).order("title", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Every node with its full path ("in tune with God > Scripture Study >
// Daily study"). Titles alone are ambiguous in this tree — there are three
// separate "Reading" nodes and two "Obedience" — so any picker that has to
// identify a node precisely needs the path, not the title.
export async function fetchGoalPaths(userId) {
  const { nodes, edges } = await fetchTree(userId);
  const parentOf = new Map();
  for (const e of edges) if (!parentOf.has(e.child_id)) parentOf.set(e.child_id, e.parent_id);
  const titleById = new Map(nodes.map((n) => [n.id, n.title]));

  return nodes
    .map((n) => {
      const parts = [n.title];
      let cur = n.id;
      const seen = new Set([cur]);
      while (parentOf.has(cur)) {
        cur = parentOf.get(cur);
        if (seen.has(cur)) break; // cycle guard
        seen.add(cur);
        parts.unshift(titleById.get(cur) ?? "?");
      }
      return { id: n.id, title: n.title, path: parts.join(" › "), depth: parts.length - 1, is_focused: n.is_focused ?? false };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function fetchPrayers(userId, { sinceISO, limit = 100 } = {}) {
  let query = supabase.from("prayer_logs").select("*").eq("user_id", userId).order("prayed_at", { ascending: false }).limit(limit);
  if (sinceISO) query = query.gte("prayed_at", sinceISO);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Phase 5 — the Day Card and the desktop home.
// ---------------------------------------------------------------------------

// Notes you leave for a day before its plan is drafted. Upserts the day_plan
// row, which may not exist yet on a day nothing has touched.
export async function setDayNotes(userId, dateStr, notes) {
  const { error } = await supabase
    .from("day_plans")
    .upsert({ user_id: userId, date: dateStr, notes: notes || null }, { onConflict: "user_id,date" });
  if (error) throw error;
}

// A week of day cards needs every block and task in the range at once —
// seven separate day fetches would be seven round trips for one screen.
export async function fetchRangePlan(userId, startDate, endDate) {
  const [{ data: chunks, error: e1 }, { data: tasks, error: e2 }] = await Promise.all([
    supabase
      .from("time_chunks")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("start_time", { ascending: true }),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("position", { ascending: true }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return { chunks: chunks ?? [], tasks: tasks ?? [] };
}

// Minutes per category per day across a range — what paints the coloured
// strip on each day card in the week and month grids.
export async function fetchRangeTimeByDay(userId, startDate, endDate) {
  const tz = localZone();
  const { data, error } = await supabase
    .from("time_log_entries")
    .select("category, tags, duration_minutes, started_at")
    .eq("user_id", userId)
    .gte("started_at", new Date(`${startDate}T00:00:00`).toISOString())
    .lt("started_at", new Date(new Date(`${endDate}T00:00:00`).getTime() + 86400000).toISOString());
  if (error) throw error;

  const byDay = new Map();
  for (const e of data ?? []) {
    // Bucketed in the browser's own zone so a 10pm entry belongs to tonight.
    const day = new Date(e.started_at).toLocaleDateString("en-CA", { timeZone: tz });
    if (!byDay.has(day)) byDay.set(day, new Map());
    const bucket = byDay.get(day);
    const tags = e.tags?.length ? e.tags : [e.category];
    const mins = Number(e.duration_minutes) || 0;
    for (const t of tags) bucket.set(t, (bucket.get(t) ?? 0) + mins);
  }

  return new Map(
    [...byDay.entries()].map(([day, bucket]) => [
      day,
      [...bucket.entries()].map(([category, minutes]) => ({ category, minutes })).sort((a, b) => b.minutes - a.minutes),
    ])
  );
}

// ---------------------------------------------------------------------------
// The day bank — closing a day out.
// ---------------------------------------------------------------------------

// Writes the synopsis and stamps the day banked in one go, so a day can never
// end up marked finished with no summary on it.
export async function bankDay(userId, dateStr, synopsis) {
  const { error } = await supabase.from("day_plans").upsert(
    {
      user_id: userId,
      date: dateStr,
      synopsis: synopsis || null,
      banked_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" }
  );
  if (error) throw error;
}

// A day banked while the assistant was down has no synopsis; this fills it in
// later without touching when the day was banked.
export async function saveDaySynopsis(userId, dateStr, synopsis) {
  const { error } = await supabase
    .from("day_plans")
    .update({ synopsis: synopsis || null })
    .eq("user_id", userId)
    .eq("date", dateStr);
  if (error) throw error;
}

// Reopening a banked day keeps the synopsis — you're editing the day, not
// throwing away what was written about it.
export async function unbankDay(userId, dateStr) {
  const { error } = await supabase
    .from("day_plans")
    .update({ banked_at: null })
    .eq("user_id", userId)
    .eq("date", dateStr);
  if (error) throw error;
}

// Today's verse and prompt. Read from the table first — it's written once a
// day and kept — and only generated when there isn't one yet or you ask for
// a fresh one.
export async function fetchDailyWalk(dateStr) {
  const { data, error } = await supabase.from("daily_walk").select("*").eq("date", dateStr).maybeSingle();
  if (error) throw error;
  return data;
}

export function generateDailyWalk(dateStr) {
  return callAssistant("walk_with_god", { date: dateStr });
}

// Tonight's two adaptive questions and the nudge under God's hand. The
// function writes them onto the journal row itself, so they're kept with
// whatever you answer.
export function generateReflectionQuestions(dateStr) {
  return callAssistant("reflection_questions", { date: dateStr });
}

// Asks the assistant to read the whole day and write a few sentences about
// it. Returns the text without saving — banking is what saves it.
export function writeDaySynopsis(dateStr) {
  return callAssistant("day_synopsis", { date: dateStr });
}

// ---------------------------------------------------------------------------
// The student section — reading notes, highlights, and sub-notes.
// ---------------------------------------------------------------------------

// The API answers at most 1,000 rows a request, so a list that can outgrow
// that is read a page at a time. `build` returns a fresh query ordered down to
// a unique column, so pages can't overlap or skip a row.
async function selectAllPages(build, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

// The whole shelf, bodies excluded (see the note_cards view): the directory
// is a tree built in memory, and a note's full text arrives only when you
// open it.
export function fetchNotes(userId) {
  return selectAllPages(() =>
    supabase
      .from("note_cards")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
  );
}

export async function fetchNote(noteId) {
  const { data, error } = await supabase.from("study_notes").select("*").eq("id", noteId).single();
  if (error) throw error;
  return data;
}

// Every word of every note, searched on the server: the shelf only carries
// the first 400 characters of each body, so searching it in the page missed
// most of what's written. Each hit comes back with a short window around the
// first match instead of the whole body.
export async function searchNotes(query, limit = 30) {
  const { data, error } = await supabase.rpc("search_notes", { p_query: query, p_limit: limit });
  if (error) throw error;
  return data ?? [];
}

// The board's quiet filing: a one-line gist and a few tags for a thought,
// so search and the curator can find it later (never shown on the card),
// the shelves it belongs on, and a picture that stands for it.
export function gistNote(noteId) {
  return callFunction("board", { action: "gist", note_id: noteId }, "The board");
}

// Thoughts not yet filed, a few at a time. Resolves to
// { filed, failed, more }.
export function gistBacklog() {
  return callFunction("board", { action: "gist_backlog" }, "The board");
}

export async function createNote(userId, fields = {}) {
  const row = {
    user_id: userId,
    title: fields.title?.trim() || "Untitled",
    body: fields.body ?? "",
    excerpt: fields.excerpt ?? null,
    note_kind: fields.noteKind ?? "thought",
    parent_note_id: fields.parentId ?? null,
    source_kind: fields.sourceKind ?? "other",
    source_ref: fields.sourceRef ?? null,
    // The phone's date: UTC is already tomorrow on a Mountain-time evening.
    studied_on: fields.studiedOn ?? todayStr(),
    tags: fields.tags ?? [],
    position: fields.position ?? 0,
  };
  const { data, error } = await supabase.from("study_notes").insert(row).select("*").single();
  if (error) throw error;
  // Verse references are indexed the same way here as everywhere else, so a
  // note that mentions Alma 32 shows up under Alma 32 on the scripture page.
  // The note itself is saved either way, so a failed index is only logged.
  await syncScriptureRefs(userId, "study_note", data.id, data.title, data.body).catch((err) => console.warn(err));
  return data;
}

export async function updateNote(userId, noteId, fields) {
  const row = { updated_at: new Date().toISOString() };
  if (fields.title !== undefined) row.title = fields.title.trim() || "Untitled";
  if (fields.body !== undefined) row.body = fields.body;
  if (fields.sourceRef !== undefined) row.source_ref = fields.sourceRef || null;
  if (fields.sourceKind !== undefined) row.source_kind = fields.sourceKind;
  if (fields.parentId !== undefined) row.parent_note_id = fields.parentId;
  if (fields.pinned !== undefined) row.pinned = fields.pinned;
  if (fields.noteKind !== undefined) row.note_kind = fields.noteKind;
  if (fields.tags !== undefined) row.tags = fields.tags;

  const { data, error } = await supabase.from("study_notes").update(row).eq("id", noteId).select("*").single();
  if (error) throw error;
  if (fields.title !== undefined || fields.body !== undefined) {
    await syncScriptureRefs(userId, "study_note", noteId, data.title, data.body).catch((err) => console.warn(err));
    // The gist described the words as they were, so it's filed again.
    if (!data.parent_note_id && !data.obsidian_uid) gistNote(noteId).catch((err) => console.warn(err));
  }
  return data;
}

// Children are re-parented to the deleted note's own parent rather than left
// pointing at nothing — the database would null them to the top level, which
// loses where they came from.
export async function deleteNote(noteId) {
  const { data: note, error: readError } = await supabase.from("study_notes").select("parent_note_id").eq("id", noteId).single();
  if (readError) throw readError;
  const { error: moveError } = await supabase
    .from("study_notes")
    .update({ parent_note_id: note?.parent_note_id ?? null })
    .eq("parent_note_id", noteId);
  // Stop here rather than delete: the database would drop the children to the
  // top level and lose where they came from.
  if (moveError) throw moveError;
  // Its verse references go with it, or the Scripture tab keeps counting a
  // note that no longer exists.
  const { error: refsError } = await supabase.from("scripture_refs").delete().eq("entity_type", "study_note").eq("entity_id", noteId);
  if (refsError) throw refsError;
  const { error } = await supabase.from("study_notes").delete().eq("id", noteId);
  if (error) throw error;
}

// Every highlight on the shelf, or only those on the notes named. The whole
// shelf is asked for by owner rather than as a list of ids: five hundred ids
// in the address is longer than some proxies will pass.
export async function fetchHighlights(userId, noteIds = null) {
  if (Array.isArray(noteIds) && noteIds.length === 0) return [];
  return selectAllPages(() => {
    let query = supabase.from("note_highlights").select("*").eq("user_id", userId).not("note_id", "is", null);
    if (noteIds) query = query.in("note_id", noteIds);
    return query.order("start_offset", { ascending: true }).order("id", { ascending: true });
  });
}

export async function createHighlight(userId, { noteId, quotedText, startOffset, endOffset, color = "accent", childNoteId = null }) {
  const { data, error } = await supabase
    .from("note_highlights")
    .insert({
      user_id: userId,
      note_id: noteId,
      quoted_text: quotedText,
      start_offset: startOffset,
      end_offset: endOffset,
      color,
      child_note_id: childNoteId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteHighlight(highlightId) {
  const { error } = await supabase.from("note_highlights").delete().eq("id", highlightId);
  if (error) throw error;
}

// Highlight a passage, then promote it into its own note — one operation, so
// a failure can't leave a highlight pointing at a note that was never made.
export async function createSubNoteFromHighlight(userId, { noteId, quotedText, startOffset, endOffset, title, sourceRef, position, noteKind }) {
  const child = await createNote(userId, {
    title: title || quotedText.slice(0, 70),
    body: "",
    excerpt: quotedText,
    parentId: noteId,
    sourceRef,
    noteKind,
    position: position ?? 0,
  });
  const highlight = await createHighlight(userId, {
    noteId,
    quotedText,
    startOffset,
    endOffset,
    childNoteId: child.id,
  });
  return { child, highlight };
}

// A highlight you marked earlier, made into a note of its own now: the note
// is written first, then the highlight is pointed at it, so a failure leaves
// at worst a note without a mark rather than a mark pointing at nothing.
export async function promoteHighlight(userId, highlight, { title, sourceRef, position, noteKind }) {
  const child = await createNote(userId, {
    title: title || highlight.quoted_text.slice(0, 70),
    body: "",
    excerpt: highlight.quoted_text,
    parentId: highlight.note_id,
    sourceRef,
    noteKind,
    position: position ?? 0,
  });
  const { error } = await supabase.from("note_highlights").update({ child_note_id: child.id }).eq("id", highlight.id);
  if (error) throw error;
  return child;
}

export async function markNoteSurfaced(noteId) {
  const { error } = await supabase.rpc("mark_note_surfaced", { p_note_id: noteId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Meeting notes on a time block, and the cards lifted out of them.
// ---------------------------------------------------------------------------

export async function saveChunkNotes(chunkId, notes) {
  const { error } = await supabase.from("time_chunks").update({ notes: notes || null }).eq("id", chunkId);
  if (error) throw error;
}

export async function fetchChunkHighlights(userId, chunkIds) {
  if (!chunkIds?.length) return [];
  const { data, error } = await supabase
    .from("note_highlights")
    .select("*")
    .eq("user_id", userId)
    .in("chunk_id", chunkIds)
    .order("start_offset", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// A line from a meeting, promoted into a card that keeps the way back to the
// day it was said.
export async function createCardFromChunk(userId, { chunkId, date, quotedText, startOffset, endOffset, noteKind, title }) {
  const card = await createNote(userId, {
    title: title || quotedText.slice(0, 70),
    body: "",
    excerpt: quotedText,
    noteKind: noteKind ?? "counsel",
    studiedOn: date,
  });

  const { error: linkError } = await supabase
    .from("study_notes")
    .update({ origin_chunk_id: chunkId, origin_date: date })
    .eq("id", card.id);
  if (linkError) throw linkError;

  const { data: highlight, error } = await supabase
    .from("note_highlights")
    .insert({
      user_id: userId,
      chunk_id: chunkId,
      note_id: null,
      child_note_id: card.id,
      quoted_text: quotedText,
      start_offset: startOffset,
      end_offset: endOffset,
    })
    .select("*")
    .single();
  if (error) throw error;

  return { card, highlight };
}

// ---------------------------------------------------------------------------
// Quote images. Private bucket, so what's persisted is the object path and
// the app signs a short-lived URL each time it needs to show one.
// ---------------------------------------------------------------------------

export async function uploadNoteImage(userId, noteId, file) {
  const extension = (file.name?.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  const path = `${userId}/${noteId}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from("note-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;

  const { error: linkError } = await supabase
    .from("study_notes")
    .update({ image_path: path, updated_at: new Date().toISOString() })
    .eq("id", noteId);
  if (linkError) throw linkError;

  return path;
}

export async function signedImageUrl(path, seconds = 3600) {
  if (!path) return null;
  // Already a URL — a data: URI from a fixture, or anything else fully
  // qualified. Signing it would be nonsense, so hand it straight back.
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const { data, error } = await supabase.storage.from("note-images").createSignedUrl(path, seconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// The note lets go of the picture first, so a failure leaves it exactly as it
// was. The file itself is only clutter once nothing points at it.
export async function removeNoteImage(userId, noteId, path) {
  const { error } = await supabase.from("study_notes").update({ image_path: null }).eq("id", noteId);
  if (error) throw error;
  if (path) {
    const { error: fileError } = await supabase.storage.from("note-images").remove([path]);
    if (fileError) console.warn(fileError);
  }
}

// A picture the board found for a note, taken off. It isn't looked for
// again (pictured_at stays).
export async function removeNoteWebImage(noteId) {
  const { error } = await supabase
    .from("study_notes")
    .update({ image_url: null, image_credit: null, image_page: null })
    .eq("id", noteId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// The curator.
// ---------------------------------------------------------------------------

export async function fetchDailySelection(dateStr) {
  const { data, error } = await supabase.rpc("daily_selection", { p_date: dateStr });
  if (error) throw error;
  return data ?? null;
}

// The fallback path. The midnight job normally has this done before you look;
// this is what runs when it didn't, and it authenticates as you rather than
// as the scheduler.
export function runCurator(dateStr) {
  return callFunction("curator", { tz: localZone(), date: dateStr ?? null }, "The curator");
}

export async function scoreSelectionItem(itemId, score, feedback) {
  const { error } = await supabase.rpc("score_selection_item", {
    p_item_id: itemId,
    p_score: score,
    p_feedback: feedback ?? null,
  });
  if (error) throw error;
}

// The device's own clock is the only place the zone is actually known, so the
// app writes it whenever it loads — that's what the midnight job reads.
// Best effort: a miss (no signal) just waits for the next load, so it's
// logged rather than shown.
export async function syncProfileTimezone(userId) {
  const tz = localZone();
  await supabase.from("profiles").update({ timezone: tz }).eq("id", userId).then(
    ({ error }) => error && console.warn(error),
    (err) => console.warn(err)
  );
}

// ---------------------------------------------------------------------------
// The work day, and reporting it.
// ---------------------------------------------------------------------------

export async function fetchWorkDay(dateStr) {
  const { data, error } = await supabase.rpc("work_day", { p_date: dateStr, p_tz: localZone() });
  if (error) throw error;
  return data ?? null;
}

export async function addWorkNote(userId, dateStr, { kind = "did", body, minutes }) {
  const { data, error } = await supabase
    .from("work_notes")
    .insert({ user_id: userId, date: dateStr, kind, body: body.trim(), minutes: minutes ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWorkNote(id) {
  const { error } = await supabase.from("work_notes").delete().eq("id", id);
  if (error) throw error;
}

export async function setTaskWork(taskId, isWork) {
  const { error } = await supabase.from("tasks").update({ is_work: isWork }).eq("id", taskId);
  if (error) throw error;
}

// `sent` is what separates a draft you looked at from a report you actually
// gave him — only the second one gets stamped.
export async function saveWorkReport(dateStr, report, sent = false) {
  const { error } = await supabase.rpc("save_work_report", {
    p_date: dateStr,
    p_report: report,
    p_sent: sent,
  });
  if (error) throw error;
}

export async function fetchWorkCategories(userId) {
  const { data, error } = await supabase
    .from("user_categories")
    .select("id, name, color, is_work")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function setCategoryWork(categoryId, isWork) {
  const { error } = await supabase.from("user_categories").update({ is_work: isWork }).eq("id", categoryId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Money.
//
// The bank connection itself is never touched from here: connecting, syncing
// and disconnecting all go through the `bank` edge function, which is the
// only thing that can reach the stored access key. Everything below reads and
// writes your own rows under ordinary RLS.
// ---------------------------------------------------------------------------

function callBank(action, payload = {}) {
  return callFunction("bank", { action, ...payload }, "The bank sync");
}

// The setup token goes straight to the edge function and is spent there. It
// is never written anywhere on this side.
export const connectBank = (setupToken) => callBank("claim", { setup_token: setupToken });
export const syncBank = () => callBank("sync");
export const disconnectBank = () => callBank("disconnect");

export async function fetchMoneyOverview(monthDate) {
  const { data, error } = await supabase.rpc("money_overview", { p_month: monthDate, p_tz: localZone() });
  if (error) throw error;
  return data;
}

// What came in during a month (not transfers) and the work time logged in
// it, to set earnings beside hours. Work time is any entry with a category
// in the Work family or marked as work. Examples are left out.
export async function fetchMonthEarnings(userId, monthStart, monthEnd) {
  const from = new Date(`${monthStart}T00:00:00`).toISOString();
  const to = new Date(`${monthEnd}T00:00:00`).toISOString();
  const [cats, deposits] = await Promise.all([
    supabase.from("user_categories").select("name, family, is_work").eq("user_id", userId),
    supabase
      .from("bank_transactions")
      .select("id, posted_at, amount, payee, description, client")
      .eq("user_id", userId)
      .gt("amount", 0)
      .eq("is_transfer", false)
      .gte("posted_at", from)
      .lt("posted_at", to)
      .order("posted_at", { ascending: false }),
  ]);
  if (cats.error) throw cats.error;
  if (deposits.error) throw deposits.error;
  const work = (cats.data ?? []).filter((c) => c.family === "Work" || c.is_work).map((c) => c.name);
  let entries = [];
  if (work.length) {
    const { data, error } = await supabase
      .from("time_log_entries")
      .select("id, category, tags, client, description, duration_minutes, is_example")
      .eq("user_id", userId)
      .eq("is_example", false)
      .not("ended_at", "is", null)
      // Quoted by hand: category names can hold commas and brackets.
      .overlaps("tags", `{${work.map((w) => `"${w.replace(/["\\]/g, "\\$&")}"`).join(",")}}`)
      .gte("started_at", from)
      .lt("started_at", to)
      .limit(2000);
    if (error) throw error;
    entries = data ?? [];
  }
  return { deposits: deposits.data ?? [], entries };
}

// By default only what you've bought since about a week before connecting —
// the 90-day backfill is history, not a to-do list. includeHistory opens it.
export async function fetchPurchaseInbox(limit = 25, includeHistory = false) {
  const { data, error } = await supabase.rpc("purchase_inbox", { p_limit: limit, p_include_history: includeHistory });
  if (error) throw error;
  return data ?? [];
}

export async function classifyPurchase(id, { budgetId, kind, isBusiness, businessCategory, note, remember = true }) {
  const { error } = await supabase.rpc("classify_purchase", {
    p_id: id,
    p_budget_id: budgetId || null,
    p_kind: kind || null,
    p_is_business: Boolean(isBusiness),
    p_business_category: businessCategory || null,
    p_note: note || null,
    p_remember: remember,
  });
  if (error) throw error;
}

// Put a transaction back in the question queue — for an answer you want to
// change. The old answer comes off the transaction (a purchase waiting for an
// answer counts as unsorted, and keeping its budget counted it in both places)
// and goes back on as the suggestion, so the question opens already filled in.
export async function reopenTransaction(id, { budgetId = null, kind = null } = {}) {
  const { error } = await supabase
    .from("bank_transactions")
    .update({
      reviewed_at: null,
      budget_id: null,
      purchase_kind: null,
      suggested_budget_id: budgetId || null,
      suggested_kind: kind || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function setTransfer(id, isTransfer) {
  const { error } = await supabase.from("bank_transactions").update({ is_transfer: isTransfer }).eq("id", id);
  if (error) throw error;
}

// Planned or impulse, for a purchase; null takes the answer back.
export async function setPurchaseIntent(id, intent) {
  const { error } = await supabase.from("bank_transactions").update({ intent: intent || null }).eq("id", id);
  if (error) throw error;
}

// Who a deposit came from, and its note, in one save.
export async function saveIncome(id, { note, client }) {
  const { error } = await supabase
    .from("bank_transactions")
    .update({ note: note?.trim() || null, client: client?.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchTransactions(userId, { start, end, scope = "all", budgetId, limit = 200 } = {}) {
  let q = supabase
    .from("bank_transactions")
    .select("*, account:bank_accounts(name, nickname, kind), budget:budgets!bank_transactions_budget_id_fkey(name, color), receipts(id)")
    .eq("user_id", userId)
    .order("posted_at", { ascending: false })
    .limit(limit);
  if (start) q = q.gte("posted_at", new Date(`${start}T00:00:00`).toISOString());
  if (end) q = q.lt("posted_at", new Date(`${end}T00:00:00`).toISOString());
  if (scope === "business") q = q.eq("is_business", true);
  if (scope === "personal") q = q.eq("is_business", false);
  if (budgetId) q = q.eq("budget_id", budgetId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// Charges the bank hasn't posted yet. Shown, never asked about — the
// question waits for the posted version, which can arrive under a new id.
export async function fetchPendingTransactions() {
  const { data, error } = await supabase
    .from("bank_pending")
    .select("id, transacted_at, amount, description, account:bank_accounts(name, nickname, kind)")
    .order("transacted_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

// A cash or card-elsewhere expense that will never arrive from the bank.
export async function addManualExpense(userId, { date, amount, description, isBusiness, businessCategory, budgetId, kind, note }) {
  const value = Math.abs(Number(amount));
  if (!value) throw new Error("Enter an amount.");
  const { data, error } = await supabase
    .from("bank_transactions")
    .insert({
      user_id: userId,
      source: "manual",
      posted_at: new Date(`${date}T12:00:00`).toISOString(),
      amount: -value,
      description: description?.trim() || "Cash expense",
      is_business: Boolean(isBusiness),
      business_category: isBusiness ? businessCategory || null : null,
      budget_id: budgetId || null,
      purchase_kind: kind || null,
      note: note || null,
      reviewed_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Only a cash expense can be corrected or removed this way; what came from
// the bank is the bank's record, and the filter on `source` makes sure of it.
export async function updateManualExpense(id, { date, amount, description }) {
  const row = { updated_at: new Date().toISOString() };
  if (date !== undefined) row.posted_at = new Date(`${date}T12:00:00`).toISOString();
  if (amount !== undefined) {
    const value = Math.abs(Number(amount));
    if (!value) throw new Error("Enter an amount.");
    row.amount = -value;
  }
  if (description !== undefined) row.description = description?.trim() || "Cash expense";
  const { error } = await supabase.from("bank_transactions").update(row).eq("id", id).eq("source", "manual");
  if (error) throw error;
}

export async function deleteManualExpense(id) {
  const { error } = await supabase.from("bank_transactions").delete().eq("id", id).eq("source", "manual");
  if (error) throw error;
}

export async function fetchBudgets(userId) {
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("position")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function saveBudget(userId, budget) {
  // A limit of nothing or zero is no limit: "$0 left" on a budget you only
  // wanted to track says something you didn't mean.
  const limit = Number(budget.limit);
  const row = {
    user_id: userId,
    name: budget.name.trim(),
    color: budget.color,
    monthly_limit: budget.limit === "" || budget.limit == null || !(limit > 0) ? null : Math.round(limit * 100) / 100,
    kind: budget.kind ?? "personal",
  };
  const q = budget.id
    ? supabase.from("budgets").update(row).eq("id", budget.id)
    : supabase.from("budgets").insert(row);
  const { error } = await q;
  if (error) throw error;
}

// Archived rather than deleted, so last month's spending still knows where it
// went.
export async function archiveBudget(id) {
  const { error } = await supabase.from("budgets").update({ archived: true }).eq("id", id);
  if (error) throw error;
}

export async function fetchArchivedBudgets(userId) {
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .eq("archived", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function restoreBudget(id) {
  const { error } = await supabase.from("budgets").update({ archived: false }).eq("id", id);
  if (error) throw error;
}

export async function setAccountKind(accountId, kind) {
  const { error } = await supabase.rpc("set_account_kind", { p_account_id: accountId, p_kind: kind });
  if (error) throw error;
}

// How many purchases a change of account kind would relabel: set_account_kind
// carries the new kind through to everything in the account not yet answered.
export async function countUnsortedInAccount(accountId) {
  const { count, error } = await supabase
    .from("bank_transactions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .is("reviewed_at", null)
    .eq("is_transfer", false)
    .lt("amount", 0);
  if (error) throw error;
  return count ?? 0;
}

export async function renameAccount(accountId, nickname) {
  const { error } = await supabase
    .from("bank_accounts")
    .update({ nickname: nickname?.trim() || null })
    .eq("id", accountId);
  if (error) throw error;
}

// Receipts. Private bucket, so the row holds the object path and the app signs
// a short-lived link each time it needs to show one.
export async function uploadReceipt(userId, transactionId, file) {
  const ext = (file.name?.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const path = `${userId}/${transactionId ?? "loose"}/${Date.now()}.${ext}`;

  const { error: upError } = await supabase.storage.from("receipts").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upError) throw upError;

  const { data, error } = await supabase
    .from("receipts")
    .insert({
      user_id: userId,
      transaction_id: transactionId ?? null,
      storage_path: path,
      file_name: file.name ?? null,
      mime_type: file.type ?? null,
      size_bytes: file.size ?? null,
    })
    .select("*")
    .single();
  if (error) {
    // Don't leave an orphaned file behind a row that never got written.
    const { error: cleanupError } = await supabase.storage.from("receipts").remove([path]);
    if (cleanupError) console.warn(cleanupError);
    throw error;
  }
  return data;
}

export async function fetchReceipts(userId, { transactionId } = {}) {
  let q = supabase
    .from("receipts")
    .select("*, txn:bank_transactions(description, amount, posted_at, business_category)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (transactionId) q = q.eq("transaction_id", transactionId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function receiptLink(path, seconds = 600) {
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, seconds);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

// The row first: if that fails nothing is lost and the receipt can come back
// on screen. A file left behind after the row is gone is only clutter in the
// bucket, so that failure is logged rather than shown.
export async function deleteReceipt(receipt) {
  const { error } = await supabase.from("receipts").delete().eq("id", receipt.id);
  if (error) throw error;
  const { error: fileError } = await supabase.storage.from("receipts").remove([receipt.storage_path]);
  if (fileError) console.warn(fileError);
}

// ---------------------------------------------------------------------------
// Weekly focus goals (0059). A week is the Sunday it starts on.
// ---------------------------------------------------------------------------

const FOCUS_COLUMNS = "id, week_start, title, node_id, carried_from, review, reviewed_at, position, created_at";

// The week's goals and every answer given about them that week.
export async function fetchFocusWeek(userId, weekStart) {
  const [goals, checkins] = await Promise.all([
    supabase.from("focus_goals").select(FOCUS_COLUMNS).eq("user_id", userId).eq("week_start", weekStart),
    supabase
      .from("focus_checkins")
      .select("goal_id, date, moved")
      .eq("user_id", userId)
      .gte("date", weekStart)
      .lte("date", addDays(weekStart, 6)),
  ]);
  if (goals.error) throw goals.error;
  if (checkins.error) throw checkins.error;
  const ids = new Set((goals.data ?? []).map((g) => g.id));
  return { goals: goals.data ?? [], checkins: (checkins.data ?? []).filter((c) => ids.has(c.goal_id)) };
}

export async function addFocusGoal(userId, { weekStart, title, nodeId = null, carriedFrom = null, position = 0 }) {
  const { data, error } = await supabase
    .from("focus_goals")
    .insert({ user_id: userId, week_start: weekStart, title, node_id: nodeId, carried_from: carriedFrom, position })
    .select(FOCUS_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateFocusGoal(goalId, fields) {
  const { error } = await supabase.from("focus_goals").update(fields).eq("id", goalId);
  if (error) throw error;
}

// Its check-ins go with it.
export async function deleteFocusGoal(goalId) {
  const { error } = await supabase.from("focus_goals").delete().eq("id", goalId);
  if (error) throw error;
}

// Sunday's verdict on last week's goal: kept, adjusted, let_go, or null to
// take it back.
export async function reviewFocusGoal(goalId, review) {
  await updateFocusGoal(goalId, { review, reviewed_at: review ? new Date().toISOString() : null });
}

// "Did today move it?" true, false, or null to clear the answer.
export async function setFocusCheckin(userId, goalId, date, moved) {
  if (moved === null) {
    const { error } = await supabase.from("focus_checkins").delete().eq("goal_id", goalId).eq("date", date);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("focus_checkins")
    .upsert({ user_id: userId, goal_id: goalId, date, moved }, { onConflict: "goal_id,date" });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Quotes: one a day, chosen for the week, and rated.
// ---------------------------------------------------------------------------

export async function fetchQuoteDay(userId, dateStr) {
  const { data, error } = await supabase
    .from("quote_days")
    .select("date, reason, quote:quotes(*)")
    .eq("user_id", userId)
    .eq("date", dateStr)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// Finds the day's quote when the nightly run didn't. It searches the web to
// confirm the wording, so it can take a minute. Resolves to the day's row.
export function pickQuote(dateStr) {
  return callFunction("quotes", { tz: localZone(), date: dateStr }, "Finding a quote");
}

export async function rateQuote(quoteId, rating) {
  const { data, error } = await supabase
    .from("quotes")
    .update({ rating, rated_at: rating ? new Date().toISOString() : null })
    .eq("id", quoteId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Saving a quote pins it to the Board; taking it off unpins it.
export async function saveQuote(quoteId, saved) {
  const { data, error } = await supabase
    .from("quotes")
    .update({ saved_at: saved ? new Date().toISOString() : null })
    .eq("id", quoteId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function fetchSavedQuotes(userId) {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("user_id", userId)
    .not("saved_at", "is", null)
    .order("saved_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Quote shelves: top picks for the week, and shelves to browse by person,
// theme or mood. The `quotes` function fills a shelf in the background; the
// page reads the row until it's ready.
// ---------------------------------------------------------------------------

export async function fetchShelf(userId, key) {
  const { data: row, error } = await supabase
    .from("quote_collections")
    .select("*")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  if (!row || row.quote_ids.length === 0) return { row, quotes: [] };
  const { data: quotes, error: quotesError } = await supabase.from("quotes").select("*").in("id", row.quote_ids);
  if (quotesError) throw quotesError;
  return { row, quotes: quotes ?? [] };
}

// Every shelf you've opened, for the covers on the browse tiles.
export async function fetchShelfCovers(userId) {
  const { data: rows, error } = await supabase
    .from("quote_collections")
    .select("key, status, quote_ids")
    .eq("user_id", userId)
    .eq("status", "ready");
  if (error) throw error;
  const firsts = (rows ?? []).map((r) => r.quote_ids[0]).filter(Boolean);
  if (firsts.length === 0) return {};
  const { data: quotes, error: quotesError } = await supabase.from("quotes").select("id, image_url").in("id", firsts);
  if (quotesError) throw quotesError;
  const image = new Map((quotes ?? []).map((q) => [q.id, q.image_url]));
  return Object.fromEntries((rows ?? []).map((r) => [r.key, image.get(r.quote_ids[0]) ?? null]));
}

// Starts filling a shelf (or adds to it with `more`, or replaces it with
// `fresh`). Resolves at once to the shelf's row, usually still pending.
export function requestShelf(shelf, { more = false, fresh = false } = {}) {
  return callFunction("quotes", { action: "shelf", tz: localZone(), date: todayStr(), ...shelf, more, fresh }, "Finding quotes");
}

// Quotes from before the pictures were kept apart share one portrait per
// person; this gives each after the first a picture of its own, a dozen at a
// time. Resolves to { repictured, more }.
export function repictureQuotes() {
  return callFunction("quotes", { action: "repicture" }, "Pictures");
}

// ---------------------------------------------------------------------------
// Ask: a conversation about your record. The `ask` function looks things up
// in your own tables and answers with words and charts; each conversation is
// kept in ask_conversations.
// ---------------------------------------------------------------------------

export async function fetchAskConversations(userId) {
  const { data, error } = await supabase
    .from("ask_conversations")
    .select("id, title, updated_at, working_since")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return data ?? [];
}

export async function fetchAskConversation(id) {
  const { data, error } = await supabase.from("ask_conversations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteAskConversation(id) {
  const { error } = await supabase.from("ask_conversations").delete().eq("id", id);
  if (error) throw error;
}

// Asks one question. The answer is worked out on the server and saved to
// the conversation whether or not this page is still listening; while it
// is, `onEvent` hears each step: { type: "conversation", id, title },
// { type: "step", text }, then { type: "answer", message }. Resolves to the
// answer message.
export async function askHub({ conversationId = null, question, onEvent = () => {} }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("You need to be signed in.");

  const response = await fetch(`${supabase.supabaseUrl}/functions/v1/ask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabase.supabaseKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conversation_id: conversationId, question, tz: localZone() }),
  });

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(body?.error ?? `Ask failed (${response.status}).`);
    err.status = response.status;
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let at;
    while ((at = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      if (!line) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === "answer") answer = event.message;
      onEvent(event);
    }
    if (done) break;
  }
  if (!answer) throw new Error("The answer stopped partway. It may still land; look again in a minute.");
  return answer;
}

// ---------------------------------------------------------------------------
// The weekly mirror. One week's rows, read together; src/lib/mirror.js turns
// them into the page's sentences and charts, so nothing new is stored.
// Examples are left out here, and again there.
// ---------------------------------------------------------------------------

const MIRROR_ENTRY_COLUMNS =
  "id, started_at, ended_at, duration_minutes, tags, category, depth, people, people_feel, is_nap, exercise_kind, alertness, client, is_example";

export async function fetchMirrorWeek(userId, weekStart) {
  const weekEnd = addDays(weekStart, 6);
  const at = (date, time = "00:00:00") => new Date(`${date}T${time}`).toISOString();
  const [plans, entries, winLosses, watched, focus, txns, budgets, targets, categories, weights, healthDays] = await Promise.all([
    supabase
      .from("day_plans")
      .select("date, alarm_at, woke_at, lights_out_at, snoozed, mood, energy, stress, stress_source, is_example")
      .eq("user_id", userId)
      .eq("is_example", false)
      .gte("date", weekStart)
      .lte("date", weekEnd),
    // From noon the Saturday before, so Sunday morning's night is whole.
    selectAllPages(() =>
      supabase
        .from("time_log_entries")
        .select(MIRROR_ENTRY_COLUMNS)
        .eq("user_id", userId)
        .eq("is_example", false)
        .not("ended_at", "is", null)
        .gte("started_at", at(addDays(weekStart, -1), "12:00:00"))
        .lt("started_at", at(addDays(weekEnd, 1)))
        .order("started_at", { ascending: true })
        .order("id", { ascending: true })
    ),
    supabase
      .from("win_losses")
      .select("id, kind, habit_label, reason, occurred_at, is_example")
      .eq("user_id", userId)
      .eq("is_example", false)
      .gte("occurred_at", at(weekStart))
      .lt("occurred_at", at(addDays(weekEnd, 1)))
      .order("occurred_at", { ascending: true })
      .limit(1000),
    fetchWatchedHabits(userId),
    fetchFocusWeek(userId, weekStart),
    // Spending, from the first of the month the week starts in: budgets are
    // monthly, so each one is read as the week left it.
    selectAllPages(() =>
      supabase
        .from("bank_transactions")
        .select("id, posted_at, amount, is_transfer, is_business, budget_id, purchase_kind, intent, reviewed_at")
        .eq("user_id", userId)
        .lt("amount", 0)
        .eq("is_transfer", false)
        .gte("posted_at", at(startOfMonth(weekStart)))
        .lt("posted_at", at(addDays(weekEnd, 1)))
        .order("posted_at", { ascending: true })
        .order("id", { ascending: true })
    ),
    fetchBudgets(userId),
    fetchWeeklyTargets(weekStart),
    // Archived ones too: an old entry still names its category.
    supabase.from("user_categories").select("name, family, is_work").eq("user_id", userId),
    // Eight weeks of weigh-ins, for the trend the week's reading joins.
    supabase
      .from("body_metrics")
      .select("id, date, measured_at, value, unit, is_example")
      .eq("user_id", userId)
      .eq("kind", "weight")
      .eq("is_example", false)
      .gte("date", addDays(weekStart, -49))
      .lte("date", weekEnd)
      .order("measured_at", { ascending: true }),
    // What the watch measured (0099). The mirror still opens without it.
    supabase
      .from("health_days")
      .select(HEALTH_DAY_COLUMNS)
      .eq("user_id", userId)
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .then((r) => r, (err) => ({ data: [], error: null, failed: err })),
  ]);
  for (const r of [plans, winLosses, categories, weights]) if (r.error) throw r.error;
  if (healthDays.error) console.warn(healthDays.error);
  return {
    dayPlans: plans.data ?? [],
    entries,
    winLosses: winLosses.data ?? [],
    watched,
    goals: focus.goals,
    checkins: focus.checkins,
    txns,
    budgets,
    targets,
    categories: categories.data ?? [],
    weights: weights.data ?? [],
    healthDays: healthDays.error ? [] : healthDays.data ?? [],
  };
}

// The home screen widget's key (see 0073_phone_widget.sql). The row says
// whether a widget is on and when it last asked; the key itself only ever
// comes back once, from newWidgetKey.
export async function fetchWidgetKey(userId) {
  const { data, error } = await supabase.from("widget_keys").select("created_at, last_used_at").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function newWidgetKey() {
  const { data, error } = await supabase.rpc("new_widget_key");
  if (error) throw error;
  return data;
}

export async function deleteWidgetKey(userId) {
  const { error } = await supabase.from("widget_keys").delete().eq("user_id", userId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Apple Watch (0099): the watch key, and what the watch measured. The key
// works like the widget's: the row says it's on and what last used it, the
// key itself comes back once, from newWatchKey.
// ---------------------------------------------------------------------------

export const HEALTH_DAY_COLUMNS =
  "date, woke_at, sleep_start, sleep_end, asleep_min, deep_min, rem_min, core_min, awake_min, in_bed_min, steps, active_kcal, exercise_min, stand_hours, daylight_min, mindful_min, distance_mi, flights, resting_hr, hrv_ms, avg_hr, respiratory_rate, wrist_temp_c, spo2_pct, vo2max, caffeine_mg, weight_lb, updated_at";

export async function fetchWatchKey(userId) {
  const { data, error } = await supabase.from("watch_keys").select("created_at, last_used_at, last_used_by").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function newWatchKey() {
  const { data, error } = await supabase.rpc("new_watch_key");
  if (error) throw error;
  return data;
}

export async function deleteWatchKey(userId) {
  const { error } = await supabase.from("watch_keys").delete().eq("user_id", userId);
  if (error) throw error;
}

// Days of watch numbers, oldest first.
export async function fetchHealthDays(userId, fromDate, toDate) {
  let q = supabase.from("health_days").select(HEALTH_DAY_COLUMNS).eq("user_id", userId).gte("date", fromDate).order("date", { ascending: true });
  if (toDate) q = q.lte("date", toDate);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// Workouts that started on or after a moment, newest first.
export async function fetchHealthWorkouts(userId, sinceISO, untilISO) {
  let q = supabase
    .from("health_workouts")
    .select("id, name, started_at, ended_at, minutes, active_kcal, avg_hr, max_hr, distance, distance_unit, time_entry_id")
    .eq("user_id", userId)
    .gte("started_at", sinceISO)
    .order("started_at", { ascending: false })
    .limit(50);
  if (untilISO) q = q.lt("started_at", untilISO);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// The last thing Health Auto Export sent: when, and what it carried.
export async function fetchLastHealthImport(userId) {
  const { data, error } = await supabase
    .from("health_imports")
    .select("received_at, summary")
    .eq("user_id", userId)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Ascent (0074): the mission, the lifetime goals (the tree's root goals),
// their focuses, quests with their camps, and lessons with this week's
// answers. Days are the phone's.
// ---------------------------------------------------------------------------

const ASCENT_FOCUS = "id, goal_id, name, why, categories, position, created_at";
const ASCENT_QUEST = "id, title, note, goal_id, lesson_id, status, started_on, finished_on, position, computers, created_at";
const ASCENT_CAMP = "id, quest_id, title, note, position, reached_on, created_at";
const ASCENT_LESSON = "id, title, question, goal_id, status, started_on, ended_on, position, created_at";

export async function fetchAscent(userId, today) {
  const weekStart = startOfWeek(today);
  const [mission, nodes, edges, focuses, quests, camps, lessons, checkins, steps] = await Promise.all([
    supabase.from("missions").select("statement, summit, updated_at").eq("user_id", userId).maybeSingle(),
    selectAllPages(() => supabase.from("nodes").select("id, title, description, created_at").eq("user_id", userId).order("id")),
    // A goal with a parent isn't a lifetime goal. Your own edges only, by
    // row-level security.
    selectAllPages(() => supabase.from("node_edges").select("id, child_id").order("id")),
    supabase.from("focuses").select(ASCENT_FOCUS).eq("user_id", userId),
    supabase.from("quests").select(ASCENT_QUEST).eq("user_id", userId),
    supabase.from("quest_camps").select(ASCENT_CAMP).eq("user_id", userId),
    supabase.from("lessons").select(ASCENT_LESSON).eq("user_id", userId),
    supabase
      .from("lesson_checkins")
      .select("lesson_id, date, kept")
      .eq("user_id", userId)
      .gte("date", weekStart)
      .lte("date", addDays(weekStart, 6)),
    supabase.rpc("ascent_steps", { p_today: today, p_days: 30, p_tz: localZone() }),
  ]);
  for (const r of [mission, focuses, quests, camps, lessons, checkins, steps]) if (r.error) throw r.error;
  const children = new Set(edges.map((e) => e.child_id));
  return {
    mission: mission.data ?? null,
    goals: nodes.filter((n) => !children.has(n.id)),
    focuses: focuses.data ?? [],
    quests: quests.data ?? [],
    camps: camps.data ?? [],
    lessons: lessons.data ?? [],
    checkins: checkins.data ?? [],
    steps: steps.data ?? [],
  };
}

export async function saveMission(userId, { statement, summit }) {
  const { error } = await supabase
    .from("missions")
    .upsert({ user_id: userId, statement, summit: summit || null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function addFocus(userId, { goalId, name, why, categories, position = 0 }) {
  const { error } = await supabase
    .from("focuses")
    .insert({ user_id: userId, goal_id: goalId, name, why: why || null, categories, position });
  if (error) throw error;
}

export async function updateFocus(id, fields) {
  const { error } = await supabase.from("focuses").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteFocus(id) {
  const { error } = await supabase.from("focuses").delete().eq("id", id);
  if (error) throw error;
}

// A quest and its camps, in order. A quest added as already done becomes a
// patch straight away. With `lessonId` it's that lesson's own mountain
// (0079), shown with the lesson rather than as a quest.
export async function addQuest(userId, { title, note, goalId, lessonId = null, status = "on", today, camps = [], position = 0 }) {
  const { data, error } = await supabase
    .from("quests")
    .insert({
      user_id: userId,
      title,
      note: note || null,
      goal_id: goalId || null,
      lesson_id: lessonId || null,
      status,
      started_on: status === "on" ? today : null,
      finished_on: status === "done" ? today : null,
      position,
    })
    .select("id")
    .single();
  if (error) throw error;
  await syncCamps(userId, data.id, camps, []);
  return data.id;
}

export async function updateQuest(id, fields) {
  const { error } = await supabase.from("quests").update(fields).eq("id", id);
  if (error) throw error;
}

// Its camps go with it.
export async function deleteQuest(id) {
  const { error } = await supabase.from("quests").delete().eq("id", id);
  if (error) throw error;
}

// Brings a quest's camps in line with the list its sheet holds (`rows`, in
// order, each { id, title, reached_on }; no id for a new one): renamed,
// reordered or reached in place, new ones added, the rest removed. `before`
// is what the quest had.
export async function syncCamps(userId, questId, rows, before) {
  const ordered = rows.map((r, i) => ({ ...r, position: i }));
  const keep = new Set(ordered.filter((r) => r.id).map((r) => r.id));
  const gone = before.filter((c) => !keep.has(c.id)).map((c) => c.id);
  if (gone.length) {
    const { error } = await supabase.from("quest_camps").delete().in("id", gone);
    if (error) throw error;
  }
  const fresh = ordered.filter((r) => !r.id);
  if (fresh.length) {
    const { error } = await supabase
      .from("quest_camps")
      .insert(fresh.map((r) => ({ user_id: userId, quest_id: questId, title: r.title, position: r.position, reached_on: r.reached_on ?? null })));
    if (error) throw error;
  }
  for (const r of ordered.filter((x) => x.id)) {
    const was = before.find((c) => c.id === r.id);
    if (was && was.title === r.title && was.position === r.position && (was.reached_on ?? null) === (r.reached_on ?? null)) continue;
    await updateCamp(r.id, { title: r.title, position: r.position, reached_on: r.reached_on ?? null });
  }
}

export async function updateCamp(id, fields) {
  const { error } = await supabase.from("quest_camps").update(fields).eq("id", id);
  if (error) throw error;
}

// New camps at the end of a quest's (or a lesson's) mountain, in order.
// Resolves to the rows as saved.
export async function addCamps(userId, questId, titles, startAt = 0) {
  if (!titles.length) return [];
  const { data, error } = await supabase
    .from("quest_camps")
    .insert(titles.map((title, i) => ({ user_id: userId, quest_id: questId, title, position: startAt + i })))
    .select(ASCENT_CAMP);
  if (error) throw error;
  return data ?? [];
}

export async function addLesson(userId, { title, question, goalId, today, position = 0 }) {
  const { data, error } = await supabase
    .from("lessons")
    .insert({ user_id: userId, title, question: question || null, goal_id: goalId || null, started_on: today, position })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateLesson(id, fields) {
  const { error } = await supabase.from("lessons").update(fields).eq("id", id);
  if (error) throw error;
}

// Its answers go with it.
export async function deleteLesson(id) {
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Camps (0079): the steps under each camp, grouped into sections, with a note
// on each, and the plans that fill them. A plan is read once by the `plan`
// edge function and kept, so it can fill any number of camps.
// ---------------------------------------------------------------------------

const CAMP_SECTION = "id, camp_id, plan_id, title, why, note, color, today_on, computer, clipboard, position, created_at";
const CAMP_STEP = "id, camp_id, section_id, parent_id, kind, text, note, urgency, color, working_since, today_on, computer, pin_id, done_on, position, created_at";
const PLAN_ROW = "id, title, summary, notes, sections, source, created_at";

// Every step's camp, whether it's done and whether it's picked for a day,
// for the camp lists on the Range and Quests. Its section and the step it's
// under count a section picked for today (0091) by its own steps.
// Steps of sections he resolved (0097) count as done in their camps, so
// taking a finished section away leaves the camp as far along as it was.
export async function fetchStepTally(userId, resolved = fetchResolvedSteps(userId)) {
  const [steps, kept] = await Promise.all([
    selectAllPages(() => supabase.from("camp_steps").select("id, camp_id, section_id, parent_id, kind, done_on, working_since, today_on").eq("user_id", userId).order("id")),
    resolved,
  ]);
  return [...steps, ...kept.filter((r) => r.counted && r.camp_id).map(resolvedTallyRow)];
}

// A resolved step as one of the camp's steps for counting: done, in no
// section, never on Today.
const resolvedTallyRow = (r) => ({ id: r.id, camp_id: r.camp_id, section_id: null, parent_id: null, kind: "task", done_on: r.done_on, working_since: null, today_on: null, resolved: true });

// Every section's camp and the day it was picked for (0091), for the same.
export function fetchSectionTally(userId) {
  return selectAllPages(() => supabase.from("camp_sections").select("id, camp_id, today_on, clipboard").eq("user_id", userId).order("id"));
}

// The sections and steps of several camps (a quest's), for its Today on
// Quests: the steps picked for today, with what's under them and the
// section each sits in.
export async function fetchCampsSteps(userId, campIds) {
  if (!campIds.length) return { sections: [], steps: [] };
  const [sections, steps] = await Promise.all([
    selectAllPages(() => supabase.from("camp_sections").select(CAMP_SECTION).eq("user_id", userId).in("camp_id", campIds).order("id")),
    selectAllPages(() => supabase.from("camp_steps").select(CAMP_STEP).eq("user_id", userId).in("camp_id", campIds).order("id")),
  ]);
  return { sections, steps };
}

// One camp: the camp, the mountain it's on (a quest, or a lesson's own),
// the camps beside it, its sections and steps, the finished steps of
// sections resolved there (0097), and the plans they came from. Null when
// the camp is gone.
export async function fetchCamp(userId, campId) {
  const camp = await supabase.from("quest_camps").select(ASCENT_CAMP).eq("id", campId).eq("user_id", userId).maybeSingle();
  if (camp.error) throw camp.error;
  if (!camp.data) return null;
  const [quest, camps, sections, steps, resolved] = await Promise.all([
    supabase.from("quests").select(ASCENT_QUEST).eq("id", camp.data.quest_id).maybeSingle(),
    supabase.from("quest_camps").select(ASCENT_CAMP).eq("quest_id", camp.data.quest_id),
    selectAllPages(() => supabase.from("camp_sections").select(CAMP_SECTION).eq("camp_id", campId).order("id")),
    selectAllPages(() => supabase.from("camp_steps").select(CAMP_STEP).eq("camp_id", campId).order("id")),
    fetchResolvedSteps(userId, campId),
  ]);
  for (const r of [quest, camps]) if (r.error) throw r.error;
  const planIds = [...new Set(sections.map((s) => s.plan_id).filter(Boolean))];
  const [lesson, plans] = await Promise.all([
    quest.data?.lesson_id
      ? supabase.from("lessons").select("id, title, status").eq("id", quest.data.lesson_id).maybeSingle()
      : Promise.resolve({ data: null }),
    planIds.length ? supabase.from("quest_plans").select("id, title, notes").in("id", planIds) : Promise.resolve({ data: [] }),
  ]);
  for (const r of [lesson, plans]) if (r.error) throw r.error;
  return {
    camp: camp.data,
    quest: quest.data ?? null,
    lesson: lesson.data ?? null,
    camps: camps.data ?? [],
    sections,
    steps,
    resolved,
    plans: plans.data ?? [],
  };
}

// Every mountain a plan can go on: quests, lessons' own mountains and their
// camps, and the lessons (which can be given one).
export async function fetchMountains(userId) {
  const [quests, camps, lessons] = await Promise.all([
    supabase.from("quests").select(ASCENT_QUEST).eq("user_id", userId),
    supabase.from("quest_camps").select(ASCENT_CAMP).eq("user_id", userId),
    supabase.from("lessons").select(ASCENT_LESSON).eq("user_id", userId),
  ]);
  for (const r of [quests, camps, lessons]) if (r.error) throw r.error;
  return { quests: quests.data ?? [], camps: camps.data ?? [], lessons: lessons.data ?? [] };
}

// New steps at the end of a section (or of the camp's loose steps, with no
// section), in the order given; with `parentId`, sub-steps under that step
// (0083), in its section. `extra` goes on every one (today_on, a step added
// to Today's board). Resolves to the rows as saved.
export async function addSteps(userId, campId, sectionId, texts, startAt = 0, parentId = null, extra = {}) {
  const rows = texts.map((text, i) => ({ user_id: userId, camp_id: campId, section_id: sectionId ?? null, parent_id: parentId, text, position: startAt + i, ...extra }));
  if (!rows.length) return [];
  const { data, error } = await supabase.from("camp_steps").insert(rows).select(CAMP_STEP);
  if (error) throw error;
  return data ?? [];
}

export async function updateStep(id, fields) {
  const { error } = await supabase
    .from("camp_steps")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// The same fields on several steps at once: steps picked for today, or
// taken off it.
export async function updateSteps(ids, fields) {
  if (!ids.length) return;
  const { error } = await supabase
    .from("camp_steps")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

// A step (and everything under it) into another section, or to the camp's
// top with `sectionId` null. A sub-step becomes a step of its own there.
export async function moveStepToSection(id, underIds, sectionId, position) {
  const at = new Date().toISOString();
  const { error } = await supabase
    .from("camp_steps")
    .update({ section_id: sectionId ?? null, parent_id: null, position, updated_at: at })
    .eq("id", id);
  if (error) throw error;
  if (!underIds.length) return;
  const { error: e2 } = await supabase.from("camp_steps").update({ section_id: sectionId ?? null, updated_at: at }).in("id", underIds);
  if (e2) throw e2;
}

// Steps, or a section, into another camp of the quest (Today's board, By
// camp). `rows` are each { id, camp_id, section_id?, parent_id?, position? }:
// written one by one, so Undo can put each back as it was.
export async function moveToCamp(table, rows) {
  if (table !== "camp_steps" && table !== "camp_sections") throw new Error(`Can't move ${table}.`);
  const at = new Date().toISOString();
  for (const { id, ...fields } of rows) {
    const { error } = await supabase
      .from(table)
      .update(table === "camp_steps" ? { ...fields, updated_at: at } : fields)
      .eq("id", id);
    if (error) throw error;
  }
}

// Many steps moved at once (0095): `rows` from planMove (lib/stepMoves.js),
// each { id, camp_id?, section_id?, parent_id?, position?, today_on? },
// written in one statement, so they land together or not at all.
export async function placeSteps(rows) {
  if (!rows.length) return;
  const { error } = await supabase.rpc("camp_steps_place", { p_rows: rows });
  if (error) throw error;
}

// Steps dropped on a pin (planPinDrop, lib/stepMoves.js): moved into the
// picture's section, then wearing the pin; or (`back`) as they were.
export async function savePinDrop(plan, back = false) {
  await placeSteps(back ? plan.placeWas : plan.place);
  for (const [pin_id, ids] of byPin(back ? plan.pinsWas : plan.pins)) await updateSteps(ids, { pin_id });
}

export async function deleteStep(id) {
  const { error } = await supabase.from("camp_steps").delete().eq("id", id);
  if (error) throw error;
}

export async function addSection(userId, campId, { title, why = null, color = null, position = 0, clipboard = false }) {
  const { data, error } = await supabase
    .from("camp_sections")
    .insert({ user_id: userId, camp_id: campId, title, why: why || null, color: color || null, position, ...(clipboard ? { clipboard: true } : {}) })
    .select(CAMP_SECTION)
    .single();
  if (error) throw error;
  return data;
}

export async function updateSection(id, fields) {
  const { error } = await supabase.from("camp_sections").update(fields).eq("id", id);
  if (error) throw error;
}

// The same change to several sections at once (picking them for today, 0091).
export async function updateSections(ids, fields) {
  if (!ids.length) return;
  const { error } = await supabase.from("camp_sections").update(fields).in("id", ids);
  if (error) throw error;
}

// Its steps go with it.
export async function deleteSection(id) {
  const { error } = await supabase.from("camp_sections").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Resolving a section (0097): its finished steps are kept in resolved_steps,
// so their bricks stay in the village and the camp still counts them, and
// the section goes with everything in it.
// ---------------------------------------------------------------------------

const RESOLVED_STEP = "id, camp_id, quest_id, section_id, section_title, parent_id, text, note, done_on, done_at, counted, position, resolved_on, resolved_at";

// Every one of his, or a camp's.
export function fetchResolvedSteps(userId, campId = null) {
  return selectAllPages(() => {
    let q = supabase.from("resolved_steps").select(RESOLVED_STEP).eq("user_id", userId);
    if (campId) q = q.eq("camp_id", campId);
    return q.order("id");
  });
}

// What else would go with a section: its photos, and the sketches and
// pasted pictures (0098) on its steps (`stepIds`), so the page can say so
// before it goes.
export async function fetchSectionExtras(sectionId, stepIds) {
  const photos = await supabase.from("section_photos").select("id", { count: "exact", head: true }).eq("section_id", sectionId);
  if (photos.error) throw photos.error;
  let sketches = 0;
  let pictures = 0;
  for (let i = 0; i < stepIds.length; i += 150) {
    const some = stepIds.slice(i, i + 150);
    const [drawn, pasted] = await Promise.all([
      supabase.from("sketches").select("id", { count: "exact", head: true }).in("camp_step_id", some).is("image_path", null),
      supabase.from("sketches").select("id", { count: "exact", head: true }).in("camp_step_id", some).not("image_path", "is", null),
    ]);
    if (drawn.error) throw drawn.error;
    if (pasted.error) throw pasted.error;
    sketches += drawn.count ?? 0;
    pictures += pasted.count ?? 0;
  }
  return { photos: photos.count ?? 0, sketches, pictures };
}

// Resolves to how many finished steps were kept. The section's photo files,
// and pictures pasted on its steps (0098), go after it, since nothing
// points at them then.
export async function resolveSection(sectionId, today) {
  const [files, pasted] = await Promise.all([
    supabase.from("section_photos").select("image_path").eq("section_id", sectionId).not("image_path", "is", null),
    supabase.from("sketches").select("image_path, camp_steps!inner(section_id)").eq("camp_steps.section_id", sectionId).not("image_path", "is", null),
  ]);
  if (files.error) throw files.error;
  if (pasted.error) throw pasted.error;
  const { data, error } = await supabase.rpc("resolve_section", { p_section: sectionId, p_today: today });
  if (error) throw error;
  const paths = [...(files.data ?? []), ...(pasted.data ?? [])].map((f) => f.image_path).filter(Boolean);
  if (paths.length) {
    const { error: fileError } = await supabase.storage.from("note-images").remove(paths);
    if (fileError) console.warn(fileError);
  }
  return data ?? 0;
}

// Saves a new order: `rows` in the order they should be, each { id,
// position } as it was. Only the ones that moved are written.
export async function reorder(table, rows) {
  if (table !== "camp_steps" && table !== "camp_sections" && table !== "quest_tasks") throw new Error(`Can't reorder ${table}.`);
  for (const [i, r] of rows.entries()) {
    if (r.position === i) continue;
    const { error } = await supabase.from(table).update({ position: i }).eq("id", r.id);
    if (error) throw error;
  }
}

// --- Plans ---------------------------------------------------------------------

export async function fetchPlans(userId) {
  const { data, error } = await supabase.from("quest_plans").select(PLAN_ROW).eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// The plan, and the camps it has filled so far ({ camp_id } once per camp).
export async function fetchPlan(userId, id) {
  const [plan, used] = await Promise.all([
    supabase.from("quest_plans").select(PLAN_ROW).eq("id", id).eq("user_id", userId).maybeSingle(),
    selectAllPages(() => supabase.from("camp_sections").select("id, camp_id").eq("plan_id", id).order("id")),
  ]);
  if (plan.error) throw plan.error;
  return plan.data ? { ...plan.data, camps: [...new Set(used.map((s) => s.camp_id))] } : null;
}

// Keeps a plan as read (and checked). Resolves to its id.
export async function savePlan(userId, { title, summary, notes, sections, source }) {
  const { data, error } = await supabase
    .from("quest_plans")
    .insert({ user_id: userId, title, summary: summary || null, notes: notes || null, sections, source: source || null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// The camps it filled keep their sections and steps.
export async function deletePlan(id) {
  const { error } = await supabase.from("quest_plans").delete().eq("id", id);
  if (error) throw error;
}

// Reads a plan: { text, filename } for a page or a document, { pdf,
// filename } with the PDF as base64. Resolves to { title, summary,
// sections, notes }; nothing is saved.
export async function readPlan({ text, pdf, filename }) {
  const out = await callFunction("plan", { action: "read", text: text ?? null, pdf: pdf ?? null, filename: filename ?? null }, "The plan reader");
  if (!out?.plan?.sections?.length) throw new Error("No steps were found in that plan.");
  return out.plan;
}

// Puts a plan's sections and steps into each of `campIds`, after what each
// camp already holds.
export async function addPlanToCamps(userId, plan, planId, campIds) {
  if (!campIds.length) return;
  const had = await selectAllPages(() =>
    supabase.from("camp_sections").select("id, camp_id, position").in("camp_id", campIds).order("id")
  );
  const sections = [];
  const steps = [];
  for (const campId of campIds) {
    const after = had.filter((s) => s.camp_id === campId).reduce((m, s) => Math.max(m, s.position + 1), 0);
    const rows = planRows(plan, campId, after);
    const base = sections.length;
    sections.push(...rows.sections.map((s) => ({ ...s, user_id: userId, plan_id: planId })));
    steps.push(...rows.steps.map((st) => ({ ...st, section: base + st.section })));
  }
  const { data, error } = await supabase.from("camp_sections").insert(sections).select("id, camp_id, position");
  if (error) throw error;
  const idOf = new Map((data ?? []).map((s) => [`${s.camp_id}:${s.position}`, s.id]));
  await insertSteps(
    userId,
    steps.map(({ section, ...st }) => ({ ...st, section_id: idOf.get(`${sections[section].camp_id}:${sections[section].position}`) }))
  );
}

// Makes each of a plan's sections a camp of its own on a mountain (a quest,
// or a lesson's), after the camps it has, with the section's steps in it.
export async function addPlanAsCamps(userId, plan, questId, startAt = 0) {
  const list = plan?.sections ?? [];
  if (!list.length) return;
  const { data, error } = await supabase
    .from("quest_camps")
    .insert(
      list.map((s, i) => ({
        user_id: userId,
        quest_id: questId,
        title: String(s.title ?? "").trim().slice(0, 200) || `Camp ${startAt + i + 1}`,
        note: [s.why, s.note].map((v) => String(v ?? "").trim()).filter(Boolean).join("\n\n").slice(0, 4000) || null,
        position: startAt + i,
      }))
    )
    .select("id, position");
  if (error) throw error;
  const campAt = new Map((data ?? []).map((c) => [c.position, c.id]));
  const steps = list.flatMap((s, i) =>
    planRows({ sections: [{ ...s, why: null, note: null }] }, campAt.get(startAt + i)).steps.map(({ section, ...st }) => ({ ...st, section_id: null }))
  );
  await insertSteps(userId, steps);
}

// A few hundred at a time, so one request never gets too big.
async function insertSteps(userId, rows) {
  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await supabase.from("camp_steps").insert(rows.slice(i, i + 400).map((r) => ({ ...r, user_id: userId })));
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// The Mark (0075): a target for each lifetime goal, quest and lesson, what a
// bullseye takes for each, and one shot per target per day. Loaded with
// everything Ascent loads, since the targets are its goals.
// ---------------------------------------------------------------------------

const MARK_TARGET = "id, goal_id, quest_id, lesson_id, reasons, created_at";
const MARK_AIM = "id, target_id, text, focus_id, position, retired_on, created_at";
const MARK_SHOT = "id, target_id, date, answers, level, reason, reason_how, note, loosed_at, created_at";

export async function fetchRange(userId, today) {
  const [ascent, targets, aims, shots] = await Promise.all([
    fetchAscent(userId, today),
    selectAllPages(() => supabase.from("mark_targets").select(MARK_TARGET).eq("user_id", userId).order("id")),
    selectAllPages(() => supabase.from("mark_aims").select(MARK_AIM).eq("user_id", userId).order("id")),
    // A shot a day per target: past a thousand in a few months, so paged.
    selectAllPages(() => supabase.from("mark_shots").select(MARK_SHOT).eq("user_id", userId).lte("date", today).order("id")),
  ]);
  return { ...ascent, marks: { targets, aims, shots } };
}

// The target's row, made the first time it's needed. `ref` is
// { goal_id } or { quest_id } or { lesson_id }.
export async function ensureTarget(userId, ref, reasons = []) {
  const [column, id] = Object.entries(ref)[0];
  const found = await supabase.from("mark_targets").select("id").eq("user_id", userId).eq(column, id).maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return found.data.id;
  const { data, error } = await supabase
    .from("mark_targets")
    .insert({ user_id: userId, [column]: id, reasons })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// A target's four sections and what a bullseye takes, as its sheet holds
// them (`aims` in order, each { id, text, focus_id }; no id for a new one).
// An aim that's gone is deleted if no shot ever answered it, and otherwise
// retired, so it stops being asked while old shots still read as they were.
export async function saveTargetSetup(userId, ref, { reasons, aims }, before, { answered = new Set(), today } = {}) {
  const targetId = await ensureTarget(userId, ref, reasons);
  const { error: rErr } = await supabase.from("mark_targets").update({ reasons }).eq("id", targetId);
  if (rErr) throw rErr;

  const ordered = aims.map((a, i) => ({ ...a, position: i }));
  const keep = new Set(ordered.filter((a) => a.id).map((a) => a.id));
  const gone = (before ?? []).filter((a) => !keep.has(a.id));
  const drop = gone.filter((a) => !answered.has(a.id)).map((a) => a.id);
  const retire = gone.filter((a) => answered.has(a.id)).map((a) => a.id);
  if (drop.length) {
    const { error } = await supabase.from("mark_aims").delete().in("id", drop);
    if (error) throw error;
  }
  if (retire.length) {
    const { error } = await supabase.from("mark_aims").update({ retired_on: today }).in("id", retire);
    if (error) throw error;
  }
  const fresh = ordered.filter((a) => !a.id);
  if (fresh.length) {
    const { error } = await supabase
      .from("mark_aims")
      .insert(fresh.map((a) => ({ user_id: userId, target_id: targetId, text: a.text, focus_id: a.focus_id || null, position: a.position })));
    if (error) throw error;
  }
  for (const a of ordered.filter((x) => x.id)) {
    const was = (before ?? []).find((b) => b.id === a.id);
    if (was && was.text === a.text && (was.focus_id ?? null) === (a.focus_id || null) && was.position === a.position) continue;
    const { error } = await supabase.from("mark_aims").update({ text: a.text, focus_id: a.focus_id || null, position: a.position }).eq("id", a.id);
    if (error) throw error;
  }
  return targetId;
}

// Tonight's shot at one target, saved as it's answered (one per target per
// day). Saving never looses it: `loosed_at` isn't sent, so an arrow already
// on the target stays there and one still in hand stays in hand.
export async function saveShot(userId, ref, targetId, date, shot, reasons) {
  const id = targetId ?? (await ensureTarget(userId, ref, reasons));
  const { data, error } = await supabase
    .from("mark_shots")
    .upsert(
      { user_id: userId, target_id: id, date, ...shot, updated_at: new Date().toISOString() },
      { onConflict: "target_id,date" }
    )
    .select(MARK_SHOT)
    .single();
  if (error) throw error;
  return data;
}

// Banking the day: every shot answered for it flies. Returns the ones that
// were still in hand.
export async function looseShots(userId, date) {
  const { data, error } = await supabase
    .from("mark_shots")
    .update({ loosed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("date", date)
    .is("loosed_at", null)
    .select(MARK_SHOT);
  if (error) throw error;
  return data ?? [];
}

// What a line says got in the way: the index of one of the four sections,
// or -1 when it doesn't say. Read by the `mark` function; the key stays there.
export async function readMarkLine({ target, reasons, line, answers }) {
  const out = await callFunction("mark", { action: "read", target, reasons, line, answers }, "The reader");
  const k = Number(out?.section);
  return Number.isInteger(k) && k >= 0 && k <= 3 ? k : -1;
}


// ---------------------------------------------------------------------------
// Temple: a mirror of FamilySearch (people, open ordinances, the work you've
// finished), replaced by each snapshot you load, plus your own trips,
// helpers and permissions on top.
// ---------------------------------------------------------------------------

const TEMPLE_PERSON = "pid, name, gender, lifespan, ahnentafel, generation, birth_place, death_place, rollup_status";
const TEMPLE_ORD = "id, pid, kind, spouse_name, fs_status, reasons, reserved_by, mine";
const TEMPLE_DONE = "pid, name, gender, lifespan, in_pedigree, ordinances";
const TEMPLE_TRIP = "id, kind, planned_on, items, rechecked_on, printed, status, created_at";

export async function fetchTemple(userId) {
  const [people, ordinances, done, trips, helpers, permissions, syncs] = await Promise.all([
    selectAllPages(() => supabase.from("temple_people").select(TEMPLE_PERSON).eq("user_id", userId).order("pid")),
    selectAllPages(() => supabase.from("temple_ordinances").select(TEMPLE_ORD).eq("user_id", userId).order("id")),
    selectAllPages(() => supabase.from("temple_done").select(TEMPLE_DONE).eq("user_id", userId).order("pid")),
    selectAllPages(() => supabase.from("temple_trips").select(TEMPLE_TRIP).eq("user_id", userId).order("planned_on").order("id")),
    selectAllPages(() => supabase.from("temple_helpers").select("id, name, note, per_trip, created_at").eq("user_id", userId).order("created_at")),
    selectAllPages(() => supabase.from("temple_permissions").select("pid, granted_by, relationship, granted_on, note").eq("user_id", userId).order("pid")),
    supabase.from("temple_syncs").select("synced_at, loaded_at, counts").eq("user_id", userId).order("synced_at", { ascending: false }).limit(1),
  ]);
  if (syncs.error) throw syncs.error;
  return { people, ordinances, done, trips, helpers, permissions, syncs: syncs.data ?? [] };
}

// The next planned trip from today on, for the card on Today. null when
// there isn't one (or the Temple tables aren't there yet).
export async function fetchNextTempleTrip(userId, today) {
  const { data, error } = await supabase
    .from("temple_trips")
    .select(TEMPLE_TRIP)
    .eq("user_id", userId)
    .eq("status", "planned")
    .gte("planned_on", today)
    .order("planned_on")
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

// Replaces the FamilySearch mirror with a parsed snapshot (see parseSnapshot
// in lib/temple.js): rows are upserted, then anything the snapshot no
// longer has is removed, so a failure part way leaves the old picture
// rather than an empty one.
export async function loadTempleSnapshot(userId, snap) {
  const stamp = snap.syncedAt;
  const chunks = (rows, n = 500) => Array.from({ length: Math.ceil(rows.length / n) }, (_, i) => rows.slice(i * n, i * n + n));

  for (const part of chunks(snap.people.map((p) => ({ ...p, user_id: userId, synced_at: stamp })))) {
    const { error } = await supabase.from("temple_people").upsert(part, { onConflict: "user_id,pid" });
    if (error) throw error;
  }
  for (const part of chunks(snap.ordinances.map((o) => ({ ...o, user_id: userId, synced_at: stamp })))) {
    const { error } = await supabase.from("temple_ordinances").upsert(part, { onConflict: "user_id,pid,kind,spouse_name" });
    if (error) throw error;
  }
  // The completed list only ever grows: FamilySearch forgets work after two
  // years, the Hub doesn't. Each person's ordinances are merged with what's
  // already here.
  if (snap.done?.length) {
    const have = await selectAllPages(() => supabase.from("temple_done").select("pid, ordinances").eq("user_id", userId).order("pid"));
    const before = new Map(have.map((d) => [d.pid, d.ordinances ?? []]));
    const rows = snap.done.map((d) => ({ ...d, ordinances: mergeDoneOrdinances(before.get(d.pid), d.ordinances), user_id: userId, synced_at: stamp }));
    for (const part of chunks(rows)) {
      const { error } = await supabase.from("temple_done").upsert(part, { onConflict: "user_id,pid" });
      if (error) throw error;
    }
  }
  // Whatever this snapshot didn't mention is gone from FamilySearch's view:
  // finished, or no longer in the tree.
  for (const table of ["temple_people", "temple_ordinances"]) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId).neq("synced_at", stamp);
    if (error) throw error;
  }
  const counts = { people: snap.people.length, open: snap.ordinances.length, done: snap.done?.length ?? null, version: snap.version ?? null };
  const { error } = await supabase.from("temple_syncs").insert({ user_id: userId, synced_at: stamp, counts });
  if (error) throw error;
  return counts;
}

// The newest snapshot the sync button sent (temple-sync edge function), if
// it's newer than what's loaded. null when there's nothing new.
export async function fetchTempleInbox(userId, after) {
  let q = supabase.from("temple_inbox").select("id, synced_at, snapshot").eq("user_id", userId).is("applied_at", null);
  if (after) q = q.gt("synced_at", after);
  const { data, error } = await q.order("synced_at", { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function markTempleInboxApplied(userId) {
  const { error } = await supabase.from("temple_inbox").update({ applied_at: new Date().toISOString() }).eq("user_id", userId).is("applied_at", null);
  if (error) throw error;
}

// A new key for the sync bookmark (shown once; only its hash is kept).
// Making one retires the last, so an old bookmark stops working.
export async function makeTempleSyncKey() {
  const { data, error } = await supabase.rpc("new_temple_sync_key");
  if (error) throw error;
  return data;
}

export async function fetchTempleSyncKeyInfo(userId) {
  const { data, error } = await supabase.from("temple_sync_keys").select("created_at, last_used_at").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

function mergeDoneOrdinances(a = [], b = []) {
  const seen = new Set();
  return [...b, ...a].filter((o) => {
    const k = `${o.type}|${o.date ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function addTempleTrip(userId, { kind, planned_on, items }) {
  const { data, error } = await supabase.from("temple_trips").insert({ user_id: userId, kind, planned_on, items }).select(TEMPLE_TRIP).single();
  if (error) throw error;
  return data;
}

export async function updateTempleTrip(id, fields) {
  const { data, error } = await supabase.from("temple_trips").update(fields).eq("id", id).select(TEMPLE_TRIP).single();
  if (error) throw error;
  return data;
}

export async function saveTemplePermission(userId, { pid, granted_by, relationship, granted_on, note }) {
  const { error } = await supabase
    .from("temple_permissions")
    .upsert({ user_id: userId, pid, granted_by, relationship: relationship || null, granted_on, note: note || null }, { onConflict: "user_id,pid" });
  if (error) throw error;
}

export async function deleteTemplePermission(userId, pid) {
  const { error } = await supabase.from("temple_permissions").delete().eq("user_id", userId).eq("pid", pid);
  if (error) throw error;
}

export async function addTempleHelper(userId, { name, note, per_trip }) {
  const { error } = await supabase.from("temple_helpers").insert({ user_id: userId, name, note: note || null, per_trip: per_trip ?? 5 });
  if (error) throw error;
}

export async function deleteTempleHelper(id) {
  const { error } = await supabase.from("temple_helpers").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Wake watch: at 4:35 your peers hear whether you're up (0078_wake_watch).
// The morning is judged in the database; the `wake` edge function texts.
// ---------------------------------------------------------------------------

export async function fetchWakeWatch(userId) {
  const { data, error } = await supabase.from("wake_watch").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

// Creates the row on first save; the defaults (4:35, 9:00, the three
// messages) come from the table.
export async function saveWakeWatch(userId, patch) {
  const { data, error } = await supabase
    .from("wake_watch")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchWakePeers(userId) {
  const { data, error } = await supabase
    .from("wake_peers")
    .select("id, name, phone, active, created_at")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function addWakePeer(userId, { name, phone }) {
  const { data, error } = await supabase.from("wake_peers").insert({ user_id: userId, name, phone }).select().single();
  if (error) throw error;
  return data;
}

export async function updateWakePeer(id, patch) {
  const { error } = await supabase.from("wake_peers").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteWakePeer(id) {
  const { error } = await supabase.from("wake_peers").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchWakeReports(userId, { limit = 14 } = {}) {
  const { data, error } = await supabase
    .from("wake_reports")
    .select("id, date, outcome, woke_at, message, status, sent_to, error, decided_at")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// A test text to one peer (or all active ones), straight away.
export function sendWakeTest(peerId) {
  return callFunction("wake", { test: true, peer_id: peerId ?? null }, "The test text");
}

// ---------------------------------------------------------------------------
// Quest lists and the village (0081). Each quest (and each lesson, on its own
// mountain) keeps a running list of tasks, sub-tasks and notes. The village
// keeps only the builds he chose; how far along each is comes from every
// task and camp step finished, so this loads those beside the builds.
// ---------------------------------------------------------------------------

const QUEST_TASK = "id, quest_id, parent_id, kind, text, note, urgency, color, day, ongoing, today_on, computer, working_since, pin_id, done_on, done_at, position, created_at, updated_at";
const VILLAGE_PROJECT = "id, kind, seed, plot, need, started_on, created_at";

// What lays bricks: every finished task (not note lines) and camp step, with
// enough to say what it was and where it came from, and the finished steps
// of sections he resolved (0097), in their places as they were.
async function fetchFinished(userId, resolved = fetchResolvedSteps(userId)) {
  const [tasks, steps, kept] = await Promise.all([
    selectAllPages(() =>
      supabase
        .from("quest_tasks")
        .select("id, quest_id, kind, text, note, done_on, done_at, updated_at")
        .eq("user_id", userId)
        .eq("kind", "task")
        .not("done_on", "is", null)
        .order("id")
    ),
    selectAllPages(() =>
      supabase.from("camp_steps").select("id, camp_id, text, note, done_on, updated_at").eq("user_id", userId).not("done_on", "is", null).order("id")
    ),
    resolved,
  ]);
  return [tasks, [...steps, ...kept.map(resolvedFinished)]];
}

const resolvedFinished = (r) => ({ id: r.id, camp_id: r.camp_id, quest_id: r.quest_id, text: r.text, note: r.note ?? null, done_on: r.done_on, updated_at: r.done_at, resolved: true });

// The quests and camps a day's block can be tagged with (0085).
export async function fetchQuestTagOptions(userId) {
  const [quests, camps] = await Promise.all([
    supabase.from("quests").select("id, title, lesson_id, position").eq("user_id", userId),
    supabase.from("quest_camps").select("id, quest_id, title, position").eq("user_id", userId),
  ]);
  for (const r of [quests, camps]) if (r.error) throw r.error;
  return questTagOptions(quests.data ?? [], camps.data ?? []);
}

// What got finished on `date` on the quests and camps its blocks are tagged
// with, for the end-of-day report.
export async function fetchQuestWorkDone(userId, date) {
  const chunks = await supabase.from("time_chunks").select("id, quest_id, camp_id").eq("user_id", userId).eq("date", date);
  if (chunks.error) throw chunks.error;
  const tagged = (chunks.data ?? []).filter((c) => c.quest_id || c.camp_id);
  if (!tagged.length) return [];
  const [quests, camps, tasks, steps] = await Promise.all([
    supabase.from("quests").select("id, title").eq("user_id", userId),
    supabase.from("quest_camps").select("id, quest_id, title").eq("user_id", userId),
    supabase.from("quest_tasks").select("id, quest_id, kind, text, done_on, done_at, updated_at").eq("user_id", userId).eq("done_on", date),
    supabase.from("camp_steps").select("id, camp_id, text, done_on, updated_at").eq("user_id", userId).eq("done_on", date),
  ]);
  for (const r of [quests, camps, tasks, steps]) if (r.error) throw r.error;
  return questWorkDone({ date, chunks: tagged, quests: quests.data ?? [], camps: camps.data ?? [], tasks: tasks.data ?? [], steps: steps.data ?? [] });
}

// The builds and everything finished.
async function villageBuilds(userId) {
  const [[tasks, steps], projects] = await Promise.all([fetchFinished(userId), supabase.from("village_projects").select(VILLAGE_PROJECT).eq("user_id", userId)]);
  if (projects.error) throw projects.error;
  return { tasks, steps, projects: projects.data ?? [] };
}

// The village page: the builds and everything finished, the quests and
// lessons that name each brick's quest, the arrows that train the soldiers,
// and the people who live there.
export async function fetchVillage(userId) {
  const [builds, camps, quests, lessons, shots, temple] = await Promise.all([
    villageBuilds(userId),
    supabase.from("quest_camps").select("id, quest_id").eq("user_id", userId),
    supabase.from("quests").select("id, title, lesson_id").eq("user_id", userId),
    supabase.from("lessons").select("id, title").eq("user_id", userId),
    // Arrows that have flown (loosed on Bank the day); level 0 is a bullseye.
    selectAllPages(() => supabase.from("mark_shots").select("id, date, level").eq("user_id", userId).not("loosed_at", "is", null).order("id")),
    selectAllPages(() => supabase.from("temple_done").select(TEMPLE_DONE).eq("user_id", userId).order("pid")),
  ]);
  for (const r of [camps, quests, lessons]) if (r.error) throw r.error;
  const { tasks, steps, projects } = builds;
  return {
    tasks,
    steps,
    projects,
    camps: camps.data ?? [],
    quests: quests.data ?? [],
    lessons: lessons.data ?? [],
    shots,
    temple,
  };
}

// A build chosen: it stands on `plot` and starts taking bricks today.
export async function addVillageProject(userId, { kind, seed, plot, need, today }) {
  const { data, error } = await supabase
    .from("village_projects")
    .insert({ user_id: userId, kind, seed, plot, need, started_on: today })
    .select(VILLAGE_PROJECT)
    .single();
  if (error) throw error;
  return data;
}

// Build something else on the same plot, keeping the bricks already laid.
export async function updateVillageProject(id, fields) {
  const { error } = await supabase.from("village_projects").update(fields).eq("id", id);
  if (error) throw error;
}

// The quests page: the lists along the top, the goals they serve, the camps
// on each and every step and section in them (for how far along each camp
// is and what's on today there), the builds and everything finished (for
// the build going up).
export async function fetchQuestBoard(userId) {
  const resolved = fetchResolvedSteps(userId);
  const [[tasks, steps], projects, quests, lessons, camps, goals, campSteps, campSections] = await Promise.all([
    fetchFinished(userId, resolved),
    supabase.from("village_projects").select(VILLAGE_PROJECT).eq("user_id", userId),
    supabase.from("quests").select(ASCENT_QUEST).eq("user_id", userId),
    supabase.from("lessons").select(ASCENT_LESSON).eq("user_id", userId),
    supabase.from("quest_camps").select(ASCENT_CAMP).eq("user_id", userId),
    selectAllPages(() => supabase.from("nodes").select("id, title").eq("user_id", userId).order("id")),
    fetchStepTally(userId, resolved),
    fetchSectionTally(userId),
  ]);
  for (const r of [projects, quests, lessons, camps]) if (r.error) throw r.error;
  return {
    finished: { tasks, steps },
    projects: projects.data ?? [],
    quests: quests.data ?? [],
    lessons: lessons.data ?? [],
    camps: camps.data ?? [],
    campSteps,
    campSections,
    goals,
  };
}

// Every line on one quest's list.
export function fetchQuestTasks(userId, questId) {
  return selectAllPages(() => supabase.from("quest_tasks").select(QUEST_TASK).eq("user_id", userId).eq("quest_id", questId).order("id"));
}

// A new line (or several, in order). Resolves to the rows as saved.
export async function addQuestTasks(userId, rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase
    .from("quest_tasks")
    .insert(rows.map((r) => ({ user_id: userId, ...r })))
    .select(QUEST_TASK);
  if (error) throw error;
  return data ?? [];
}

export async function updateQuestTask(id, fields) {
  const { error } = await supabase
    .from("quest_tasks")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// The same fields on several lines at once: a line and its sub-tasks moved
// onto the ongoing list or off it, or lines picked for today.
export async function updateQuestTasks(ids, fields) {
  if (!ids.length) return;
  const { error } = await supabase
    .from("quest_tasks")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

// Its sub-tasks go with it.
export async function deleteQuestTask(id) {
  const { error } = await supabase.from("quest_tasks").delete().eq("id", id);
  if (error) throw error;
}

// A task (and its sub-tasks) turned into a step in a camp (and sub-steps),
// from Today's board: `steps` are the new rows, the step first, each with
// its id and the task it was (`from`). Sketches go with them, then the task
// goes (its sub-tasks with it). `notes` are note lines under it, whose
// sketches go to the step.
export async function lineToStep(userId, steps, notes = []) {
  const [top, ...subs] = steps;
  const row = ({ from, ...r }) => ({ user_id: userId, ...r });
  const one = await supabase.from("camp_steps").insert(row(top));
  if (one.error) throw one.error;
  if (subs.length) {
    const rest = await supabase.from("camp_steps").insert(subs.map(row));
    if (rest.error) throw rest.error;
  }
  for (const st of [...steps, ...notes.map((from) => ({ id: top.id, from }))]) {
    const { error } = await supabase.from("sketches").update({ quest_task_id: null, camp_step_id: st.id }).eq("quest_task_id", st.from);
    if (error) throw error;
  }
  await deleteQuestTask(top.from);
}

// And back (Undo): the task and its sub-tasks as they were (`tasks`, the
// task first, with their ids), their sketches, and the step goes.
export async function stepToLine(userId, tasks, steps) {
  const [top, ...subs] = tasks;
  const row = (r) => ({ ...r, user_id: userId });
  const one = await supabase.from("quest_tasks").insert(row(top));
  if (one.error) throw one.error;
  if (subs.length) {
    const rest = await supabase.from("quest_tasks").insert(subs.map(row));
    if (rest.error) throw rest.error;
  }
  for (const st of steps) {
    const { error } = await supabase.from("sketches").update({ camp_step_id: null, quest_task_id: st.from }).eq("camp_step_id", st.id);
    if (error) throw error;
  }
  const { error } = await supabase.from("camp_steps").delete().eq("id", steps[0].id);
  if (error) throw error;
}

// The order he put a quest's Today in (0092): the keys of what's on it
// ("step:<id>", "sec:<id>", "line:<id>"), or [] when he hasn't ordered it.
export async function fetchTodayOrder(userId, questId, day) {
  const { data, error } = await supabase.from("quest_today").select("keys").eq("user_id", userId).eq("quest_id", questId).eq("day", day).maybeSingle();
  if (error) throw error;
  return data?.keys ?? [];
}

export async function saveTodayOrder(userId, questId, day, keys) {
  const { error } = await supabase
    .from("quest_today")
    .upsert({ user_id: userId, quest_id: questId, day, keys, updated_at: new Date().toISOString() }, { onConflict: "quest_id,day" });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Sketches (0088): drawn on a quest line or a camp step, kept as strokes,
// with what the sketch reader made of them.
// ---------------------------------------------------------------------------

const SKETCH = "id, quest_task_id, camp_step_id, width, height, strokes, image_path, title, summary, analyzed_at, created_at, updated_at";
const sketchRows = (rows) => rows.map(({ quest_tasks: _t, camp_steps: _s, ...row }) => row);

// Every sketch on one quest's lines.
export async function fetchQuestSketches(userId, questId) {
  return sketchRows(
    await selectAllPages(() =>
      supabase.from("sketches").select(`${SKETCH}, quest_tasks!inner(quest_id)`).eq("user_id", userId).eq("quest_tasks.quest_id", questId).order("id")
    )
  );
}

// Every sketch on one camp's steps.
export async function fetchCampSketches(userId, campId) {
  return sketchRows(
    await selectAllPages(() =>
      supabase.from("sketches").select(`${SKETCH}, camp_steps!inner(camp_id)`).eq("user_id", userId).eq("camp_steps.camp_id", campId).order("id")
    )
  );
}

// A new sketch on a line ({ quest_task_id }) or a step ({ camp_step_id }),
// with { width, height, strokes }. Resolves to the row as saved.
export async function addSketch(userId, fields) {
  const { data, error } = await supabase
    .from("sketches")
    .insert({ user_id: userId, ...fields })
    .select(SKETCH)
    .single();
  if (error) throw error;
  return data;
}

export async function updateSketch(id, fields) {
  const { error } = await supabase
    .from("sketches")
    .update({ updated_at: new Date().toISOString(), ...fields })
    .eq("id", id);
  if (error) throw error;
}

// A pasted picture's file (0098) goes after it, once nothing points at it.
export async function deleteSketch(id, imagePath = null) {
  const { error } = await supabase.from("sketches").delete().eq("id", id);
  if (error) throw error;
  if (imagePath) {
    const { error: fileError } = await supabase.storage.from("note-images").remove([imagePath]);
    if (fileError) console.warn(fileError);
  }
}

// Has the sketch reader look at a sketch (`image`: a PNG, base64) with what
// it's on. It keeps what it made of it on the sketch and resolves to
// { title, summary, analyzed_at }.
export async function analyzeSketch(id, image) {
  const out = await callFunction("sketch", { action: "analyze", sketchId: id, image }, "The sketch reader");
  if (!out?.summary) throw new Error("The sketch came back unread.");
  return { title: out.title ?? null, summary: out.summary, analyzed_at: out.analyzed_at ?? new Date().toISOString() };
}

// One sketch, wherever it is (a pin's task opens the sketch it's on).
export async function fetchSketch(id) {
  const { data, error } = await supabase.from("sketches").select(SKETCH).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// His latest sketches, anywhere, newest first: to take one as a section's
// photo.
export async function fetchRecentSketches(userId, limit = 12) {
  // drawings only: a pasted picture (0098) is a file of its own
  const { data, error } = await supabase.from("sketches").select(SKETCH).eq("user_id", userId).is("image_path", null).order("updated_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Photos on sections, and pins on photos and sketches (0096). A photo's
// picture sits in the private note-images bucket under his own folder; the
// app signs a short-lived URL to show it (signedImageUrl).
// ---------------------------------------------------------------------------

const PHOTO = "id, section_id, image_path, sketch, sketch_id, width, height, caption, position, created_at, updated_at";
const PIN = "id, photo_id, sketch_id, x, y, note, created_at, updated_at";

// The photos on these sections.
export async function fetchSectionPhotos(userId, sectionIds) {
  const ids = [...new Set(sectionIds ?? [])].filter(Boolean);
  if (!ids.length) return [];
  const out = [];
  for (let i = 0; i < ids.length; i += 150) {
    out.push(...(await selectAllPages(() => supabase.from("section_photos").select(PHOTO).eq("user_id", userId).in("section_id", ids.slice(i, i + 150)).order("id"))));
  }
  return out;
}

export async function fetchSectionPhoto(id) {
  const { data, error } = await supabase.from("section_photos").select(PHOTO).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// A picture into his folder of the bucket. Resolves to its path.
export async function uploadSectionPicture(userId, blob, extension = "jpg", kind = "section") {
  const path = `${userId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from("note-images").upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: blob.type || undefined,
  });
  if (error) throw error;
  return path;
}

// A photo on a section: { section_id, image_path | sketch (+ sketch_id), width, height, position }.
export async function addSectionPhoto(userId, fields) {
  const { data, error } = await supabase
    .from("section_photos")
    .insert({ user_id: userId, ...fields })
    .select(PHOTO)
    .single();
  if (error) throw error;
  return data;
}

export async function updateSectionPhoto(id, fields) {
  const { error } = await supabase
    .from("section_photos")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// The photo goes (its pins with it; their tasks stay, without the pin),
// then its picture's file, which is only clutter once nothing points at it.
export async function deleteSectionPhoto(photo) {
  const { error } = await supabase.from("section_photos").delete().eq("id", photo.id);
  if (error) throw error;
  if (photo.image_path) {
    const { error: fileError } = await supabase.storage.from("note-images").remove([photo.image_path]);
    if (fileError) console.warn(fileError);
  }
}

// Every pin of his: they're few, and a step's pin opens from anywhere.
export async function fetchPins(userId) {
  return selectAllPages(() => supabase.from("image_pins").select(PIN).eq("user_id", userId).order("id"));
}

// A pin on a photo ({ photo_id }) or a sketch ({ sketch_id }), at { x, y }.
export async function addPin(userId, fields) {
  const { data, error } = await supabase
    .from("image_pins")
    .insert({ user_id: userId, ...fields })
    .select(PIN)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePin(id, fields) {
  const { error } = await supabase
    .from("image_pins")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePin(id) {
  const { error } = await supabase.from("image_pins").delete().eq("id", id);
  if (error) throw error;
}

