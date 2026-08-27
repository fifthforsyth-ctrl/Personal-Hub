import { supabase } from "./supabaseClient";

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

  const { data: edges, error: edgesError } = await supabase
    .from("node_edges")
    .select("id, child_id, parent_id, weight")
    .in("child_id", nodeIds);
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

export async function deleteNode(nodeId) {
  const { error } = await supabase.from("nodes").delete().eq("id", nodeId);
  if (error) throw error;
}

export async function createEdge(childId, parentId, weight) {
  const { error } = await supabase.from("node_edges").insert({ child_id: childId, parent_id: parentId, weight: weight ?? null });
  if (error) throw error;
}

export async function setFocused(nodeId, isFocused) {
  const { error } = await supabase.from("nodes").update({ is_focused: isFocused }).eq("id", nodeId);
  if (error) throw error;
}

export async function recordCompletion(nodeId, kind) {
  const { error } = await supabase.rpc("record_completion", { p_node_id: nodeId, p_kind: kind });
  if (error) throw error;
}

// Backs both the Checkbox method (amount always 1) and the Counter method
// (arbitrary amount).
export async function recordProgress(nodeId, amount = 1) {
  const { error } = await supabase.rpc("record_progress", { p_node_id: nodeId, p_amount: amount });
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

export async function startTimeEntry(userId, { category, subcategory, description, goalNodeId, tags }) {
  const { data, error } = await supabase
    .from("time_log_entries")
    .insert({
      user_id: userId,
      category,
      subcategory: subcategory || null,
      description: description || null,
      goal_node_id: goalNodeId || null,
      tags: tags ?? [],
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function stopTimeEntry(entryId) {
  const { data, error } = await supabase
    .from("time_log_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", entryId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Manual (non-timer) entry — logging time after the fact.
export async function createTimeEntry(userId, fields) {
  const { data, error } = await supabase
    .from("time_log_entries")
    .insert({ user_id: userId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTimeEntry(entryId) {
  const { error } = await supabase.from("time_log_entries").delete().eq("id", entryId);
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
    .lt("started_at", end.toISOString());
  if (error) throw error;
  return data ?? [];
}

export async function logWinLoss(userId, { kind, habitLabel, goalNodeId, note }) {
  const { data, error } = await supabase
    .from("win_losses")
    .insert({ user_id: userId, kind, habit_label: habitLabel, goal_node_id: goalNodeId || null, note: note || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchWinLosses(userId, { sinceISO, limit = 100 } = {}) {
  let query = supabase.from("win_losses").select("*").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(limit);
  if (sinceISO) query = query.gte("occurred_at", sinceISO);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function logPrayer(userId, { context, content, feltResponse, tags }) {
  const { data, error } = await supabase
    .from("prayer_logs")
    .insert({ user_id: userId, context: context || null, content, felt_response: feltResponse || null, tags: tags ?? [] })
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

export async function deleteTimeChunk(chunkId) {
  const { error } = await supabase.from("time_chunks").delete().eq("id", chunkId);
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

export async function toggleTask(taskId, done) {
  await updateTask(taskId, { status: done, completed_at: done ? new Date().toISOString() : null });
}

export async function deleteTask(taskId) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

// Moves every incomplete task dated before today onto today (unscheduled),
// bumping rollover_count — call once when the Plan page lands on "today".
export async function rolloverIncompleteTasks() {
  const { data, error } = await supabase.rpc("rollover_incomplete_tasks");
  if (error) throw error;
  return data; // number of tasks rolled
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

// Full contents of one preset, for previewing before applying / editing.
export async function fetchTemplateDetail(templateId) {
  const { data: chunks, error: cErr } = await supabase
    .from("template_chunks")
    .select("*")
    .eq("template_id", templateId)
    .order("position", { ascending: true });
  if (cErr) throw cErr;

  const chunkIds = (chunks ?? []).map((c) => c.id);
  if (chunkIds.length === 0) return { chunks: [], tasks: [] };

  const { data: tasks, error: tErr } = await supabase
    .from("template_tasks")
    .select("*")
    .in("template_chunk_id", chunkIds)
    .order("position", { ascending: true });
  if (tErr) throw tErr;

  return { chunks: chunks ?? [], tasks: tasks ?? [] };
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

// ---------------------------------------------------------------------------
// Phase 1 — Reflection. Every rollup is computed in the database, so asking
// an 18-month question costs one round trip instead of downloading every
// entry in the range.
// ---------------------------------------------------------------------------

function localZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

async function reflectionRpc(name, startDate, endDate) {
  const { data, error } = await supabase.rpc(name, { p_start: startDate, p_end: endDate, p_tz: localZone() });
  if (error) throw error;
  return data ?? [];
}

export const fetchTimeByCategory = (s, e) => reflectionRpc("time_by_category", s, e);
export const fetchHabitStrength = (s, e) => reflectionRpc("habit_strength", s, e);
export const fetchProductivityHeatmap = (s, e) => reflectionRpc("productivity_heatmap", s, e);

export async function fetchReflectionTotals(startDate, endDate) {
  const rows = await reflectionRpc("reflection_totals", startDate, endDate);
  return rows[0] ?? null;
}

// Lightweight id+title list for goal-link pickers elsewhere in the app —
// deliberately not the full fetchTree (no edges, no tracking state needed
// just to tag an entry).
export async function fetchGoalOptions(userId) {
  const { data, error } = await supabase.from("nodes").select("id, title").eq("user_id", userId).order("title", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPrayers(userId, { sinceISO, limit = 100 } = {}) {
  let query = supabase.from("prayer_logs").select("*").eq("user_id", userId).order("prayed_at", { ascending: false }).limit(limit);
  if (sinceISO) query = query.gte("prayed_at", sinceISO);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
