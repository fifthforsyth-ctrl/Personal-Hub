import { supabase } from "./supabaseClient";
import { parseScriptureRefs } from "./scripture";

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
      tags,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// A stretch of time logged after the fact — ends now, started `minutes` ago.
export async function logPastTimeEntry(userId, { categories, description, minutes }) {
  const tags = (categories ?? []).filter(Boolean);
  if (tags.length === 0) throw new Error("Pick at least one category.");
  const ended = new Date();
  const started = new Date(ended.getTime() - minutes * 60000);

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

export async function updateTimeEntry(entryId, fields) {
  const { error } = await supabase.from("time_log_entries").update(fields).eq("id", entryId);
  if (error) throw error;
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

// Moves incomplete past tasks onto today (unscheduled), bumping
// rollover_count — call once when the Plan page lands on "today". Tasks
// past the rollover cap stop moving and become stalled instead; see
// fetchStalledTasks.
export async function rolloverIncompleteTasks() {
  const { data, error } = await supabase.rpc("rollover_incomplete_tasks");
  if (error) throw error;
  return data; // number of tasks rolled
}

// Unfinished, in the past, and no longer rolling — these want a decision
// (do it, reschedule it, or admit it isn't happening) rather than another
// silent move to tomorrow.
export async function fetchStalledTasks() {
  const { data, error } = await supabase.rpc("stalled_tasks");
  if (error) throw error;
  return data ?? [];
}

// Pull a stalled task back onto a live day, resetting its roll counter so
// it gets a fresh run rather than immediately stalling again.
export async function reviveTask(taskId, date) {
  return updateTask(taskId, { date, rollover_count: 0, time_chunk_id: null });
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

// ---------------------------------------------------------------------------
// Phase 4 — Spiritual layer.
// ---------------------------------------------------------------------------

// Re-indexes every verse reference in a piece of text against its entity.
// Deletes first so an edit that REMOVES a reference doesn't leave the old
// row behind pointing at text that no longer mentions it.
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

export async function logExperience(userId, { kind, whatCame, triggerContext, linkedGoalId, tags }) {
  const { data, error } = await supabase
    .from("spiritual_experiences")
    .insert({
      user_id: userId,
      kind: kind || "prompting",
      what_came: whatCame,
      trigger_context: triggerContext || null,
      linked_goal_id: linkedGoalId || null,
      tags: tags ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  await syncScriptureRefs(userId, "experience", data.id, whatCame, triggerContext);
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
  await syncScriptureRefs(userId, "experience", experienceId, data.what_came, data.trigger_context, data.follow_up_notes);
  return data;
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
// it hasn't had a chance to be acted on yet.
export async function fetchOpenLoops(userId, { minAgeHours = 24 } = {}) {
  const cutoff = new Date(Date.now() - minAgeHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("spiritual_experiences")
    .select("*")
    .eq("user_id", userId)
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
      studied_on: studiedOn || undefined,
      linked_goal_id: linkedGoalId || null,
      tags: tags ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  await syncScriptureRefs(userId, "study_note", data.id, title, body, sourceRef);
  return data;
}

export async function fetchStudyNotes(userId, { limit = 50 } = {}) {
  const { data, error } = await supabase
    .from("study_notes")
    .select("*")
    .eq("user_id", userId)
    .order("studied_on", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function deleteStudyNote(noteId) {
  const { error } = await supabase.from("study_notes").delete().eq("id", noteId);
  if (error) throw error;
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
  await syncScriptureRefs(userId, "prayer", prayer.id, fields.content, fields.context, fields.feltResponse);
  return prayer;
}

// ---------------------------------------------------------------------------
// Phase 4.7 — Daily Journal & Day Archive.
// ---------------------------------------------------------------------------

export async function fetchDayArchive(dateStr) {
  const { data, error } = await supabase.rpc("day_archive", { p_date: dateStr, p_tz: localZone() });
  if (error) throw error;
  return data;
}

// Days that have anything on them, newest first — so paging back through
// the record skips empty dates instead of stepping over them one at a time.
export async function fetchArchiveDays(limit = 120) {
  const { data, error } = await supabase.rpc("archive_days", { p_limit: limit, p_tz: localZone() });
  if (error) throw error;
  return data ?? [];
}

export async function saveJournalEntry(userId, dateStr, fields) {
  const { thoughts, gratitude, godsHand, qChrist, qPrinciples, qSuccess, completed } = fields;
  const row = {
    user_id: userId,
    date: dateStr,
    thoughts: thoughts || null,
    gratitude: gratitude || null,
    gods_hand: godsHand || null,
    q_christ: qChrist || null,
    q_principles: qPrinciples || null,
    q_success: qSuccess || null,
    updated_at: new Date().toISOString(),
  };
  // Only stamped on the pass that finishes the reflection — saving a draft
  // must never make the day look reflected-on when it isn't.
  if (completed) row.reflection_completed_at = new Date().toISOString();

  const { error } = await supabase.from("journal_entries").upsert(row, { onConflict: "user_id,date" });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Goal linking — mapping categories/habits onto the tree, and the credit
// that flows up it.
// ---------------------------------------------------------------------------

export async function fetchGoalMappings(userId) {
  const { data, error } = await supabase
    .from("goal_mappings")
    .select("*")
    .eq("user_id", userId)
    .order("source_kind", { ascending: true })
    .order("source_value", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Distinct values actually present in the logs, so the setup screen lists
// what you really track rather than what you once typed.
export async function fetchMappableSources(userId) {
  const [{ data: entries, error: e1 }, { data: habits, error: e2 }] = await Promise.all([
    supabase.from("time_log_entries").select("category, subcategory").eq("user_id", userId),
    supabase.from("win_losses").select("habit_label").eq("user_id", userId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const counts = new Map();
  const bump = (kind, value) => {
    const key = `${kind} ${value}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const e of entries ?? []) {
    bump("category", e.category);
    if (e.subcategory) bump("subcategory", `${e.category} / ${e.subcategory}`);
  }
  for (const w of habits ?? []) bump("habit", w.habit_label);

  return [...counts.entries()]
    .map(([key, count]) => {
      const [source_kind, source_value] = key.split(" ");
      return { source_kind, source_value, count };
    })
    .sort((a, b) => b.count - a.count);
}

export async function upsertGoalMapping(userId, { sourceKind, sourceValue, goalNodeId, confirmed }) {
  const { error } = await supabase.from("goal_mappings").upsert(
    {
      user_id: userId,
      source_kind: sourceKind,
      source_value: sourceValue,
      goal_node_id: goalNodeId || null,
      origin: "manual",
      confirmed: confirmed ?? true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,source_kind,source_value" }
  );
  if (error) throw error;
}

export async function confirmGoalMappings(userId, ids) {
  const { error } = await supabase
    .from("goal_mappings")
    .update({ confirmed: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("id", ids);
  if (error) throw error;
}

// Pushes the confirmed mappings across every existing entry. Returns how
// many rows changed.
export async function applyGoalMappings() {
  const { data, error } = await supabase.rpc("apply_goal_mappings", { p_only_confirmed: true });
  if (error) throw error;
  return data;
}

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

async function callAssistant(action, payload = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("You need to be signed in.");

  const response = await fetch(`${supabase.supabaseUrl}/functions/v1/assistant`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabase.supabaseKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, tz: localZone(), ...payload }),
  });

  const body = await response.json().catch(() => ({ error: "The assistant returned something unreadable." }));
  if (!response.ok) throw new Error(body.error ?? `Assistant failed (${response.status}).`);
  return body;
}

// `notes` is whatever you typed into "anything I should know about
// tomorrow?" before pressing generate — the one piece of context the app
// cannot read off your own logs.
export function proposePlans({ notes, forDate } = {}) {
  return callAssistant("propose_plan", { notes: notes || null, for_date: forDate || null });
}

// "Map out my sleep over the past 6 months." The question goes to the
// assistant, which writes a read-only query against your own tables and
// picks a chart form for the answer; the query runs server-side under your
// RLS, so nothing it can reach is anything you couldn't already read.
export function askChart(question) {
  return callAssistant("ask_chart", { question });
}

// Reads descriptions over a date range and proposes which goal each stretch
// fed. Returns suggestions only — nothing is written until they're accepted.
export function suggestGoalLinks({ start, end, onlyUnlinked = false }) {
  return callAssistant("suggest_goal_links", { start, end: end ?? start, onlyUnlinked });
}

// How much there is to review, and how much has no link at all — so the
// button can say what it will actually do.
export async function fetchLinkStats(startDate, endDate) {
  const { data, error } = await supabase.rpc("link_stats", {
    p_start: startDate,
    p_end: endDate ?? startDate,
    p_tz: localZone(),
  });
  if (error) throw error;
  return data?.[0] ?? { total: 0, linked: 0, unlinked: 0 };
}

export async function applyGoalLinks(links) {
  for (const link of links) {
    await supabase.from("time_log_entries").update({ goal_node_id: link.goal_id }).eq("id", link.entry_id);
  }
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

export async function updateCategory(categoryId, fields) {
  const { error } = await supabase.from("user_categories").update(fields).eq("id", categoryId);
  if (error) throw error;
}

// Turns one accepted proposal into real blocks and tasks on a date.
export async function applyProposedPlan(userId, dateStr, plan) {
  for (const block of plan.blocks ?? []) {
    const chunk = await createTimeChunk(userId, {
      date: dateStr,
      start_time: block.start,
      end_time: block.end,
      title: block.title,
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

// Everything ever logged, by tag. The pie on the home page is explicitly a
// lifetime view, so the window starts before any row could exist rather than
// at some arbitrary "far enough back".
export function fetchLifetimeByCategory() {
  const end = new Date();
  end.setDate(end.getDate() + 1);
  return reflectionRpc("time_by_category", "1970-01-01", end.toISOString().slice(0, 10));
}

// Notes you leave for a day before its plan is drafted. Upserts the day_plan
// row, which may not exist yet on a day nothing has touched.
export async function setDayNotes(userId, dateStr, notes) {
  const { error } = await supabase
    .from("day_plans")
    .upsert({ user_id: userId, date: dateStr, notes: notes || null }, { onConflict: "user_id,date" });
  if (error) throw error;
}

// One call for everything the whole-day view shows, so opening a day is a
// single round trip rather than nine.
export async function fetchDayEverything(userId, dateStr) {
  const [archive, plan, chunks, tasks] = await Promise.all([
    fetchDayArchive(dateStr),
    fetchDayPlan(userId, dateStr),
    fetchTimeChunks(userId, dateStr),
    fetchTasks(userId, dateStr),
  ]);
  return { archive: archive ?? {}, plan, chunks, tasks };
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

// Asks the assistant to read the whole day and write a few sentences about
// it. Returns the text without saving — banking is what saves it.
export function writeDaySynopsis(dateStr) {
  return callAssistant("day_synopsis", { date: dateStr });
}
