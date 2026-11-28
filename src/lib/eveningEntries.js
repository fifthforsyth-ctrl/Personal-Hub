// The evening as journal entries (Aaron, 2026-11-28): pick any of your
// targets to write about, let the Hub choose a question, or write your own,
// as many as you like, then bank the day. Nothing here touches the network.

import { arrowRef } from "./arrows.js";

export const TEXT_MAX = 8000;

// The targets to choose from, biggest first: the mission (when it's written),
// the lifetime goals, the quests and lessons, then this week's focuses.
// `ladder` is ladderOf()'s { mission, goals, climbs, focuses }.
export function targetChoices(ladder) {
  if (!ladder) return [];
  const out = [];
  if (ladder.mission?.statement) out.push({ kind: "mission", key: "mission", title: "My mission", group: "Mission" });
  for (const g of ladder.goals ?? []) out.push({ kind: "goal", key: g.key, title: g.short || g.title, full: g.title, group: "Lifetime goals" });
  for (const c of ladder.climbs ?? []) out.push({ kind: c.kind, key: c.key, title: c.title, group: c.kind === "lesson" ? "Lessons" : "Quests" });
  for (const f of ladder.focuses ?? []) out.push({ kind: "focus", key: f.key, title: f.title, group: "This week's focus" });
  return out.filter((t) => t.title);
}

// The question a target entry opens with, read aloud when talking it through.
export function targetPrompt(choice) {
  if (choice.kind === "mission") return "What do you want to say about your mission tonight?";
  return `What do you want to say about “${choice.full || choice.title}” tonight?`;
}

// A new entry, not yet saved. `local` keys it until the Hub gives it an id.
export function newEntry(kind, { choice = null, prompt = null, topic = null, position = 0 } = {}) {
  const local = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  if (kind === "target" && choice) {
    return {
      local,
      id: null,
      kind,
      ref: arrowRef(choice.kind, choice.key),
      targetKey: choice.key,
      topic: choice.title,
      prompt: prompt ?? targetPrompt(choice),
      text: "",
      saved: "",
      position,
    };
  }
  return { local, id: null, kind, ref: null, targetKey: null, topic: topic ?? (kind === "ask" ? "Chosen for you" : null), prompt, text: "", saved: "", position };
}

// A saved row as the page holds it.
export function fromRow(r) {
  const targetKey = r.mission ? "mission" : r.goal_id ?? r.quest_id ?? r.lesson_id ?? r.focus_goal_id ?? null;
  return {
    local: r.id,
    id: r.id,
    kind: r.kind,
    ref: null,
    targetKey,
    topic: r.topic,
    prompt: r.prompt,
    text: r.text ?? "",
    saved: r.text ?? "",
    position: r.position ?? 0,
  };
}

// What the page starts from: the saved entries with this phone's draft laid
// over them. A draft entry the Hub already has (by id or local key) gives its
// words when they differ; one it has never seen is added at the end; an
// entry the Hub has that the draft lacks stays (written on another device).
export function mergeEntries(rows, draft) {
  const list = (rows ?? []).map(fromRow);
  if (!Array.isArray(draft)) return list;
  for (const d of draft) {
    if (!d || typeof d !== "object" || typeof d.text !== "string") continue;
    const at = list.findIndex((e) => (d.id && e.id === d.id) || e.local === d.local);
    if (at >= 0) {
      if (d.text !== list[at].text && d.text !== d.saved) list[at] = { ...list[at], text: d.text };
    } else if (!d.id) {
      list.push({ ...d });
    }
  }
  return list;
}

// Entries with words not yet on the Hub.
export const unsaved = (list) => (list ?? []).filter((e) => e.text.trim() !== (e.saved ?? "").trim());

// What a reflection said, for the banked card and the record: one row per
// entry with words, labelled by what it was about.
export function entryCards(rows) {
  return (rows ?? [])
    .filter((r) => (r.text ?? "").trim())
    .map((r) => ({
      label: r.topic || (r.kind === "ask" ? "Chosen for you" : r.kind === "free" ? "Journal" : "A target"),
      question: r.prompt || "",
      text: r.text,
    }));
}

// The questions "Choose for me" hands out, one a tap, from what the assistant
// wrote for tonight ({ gods_hand_nudge, savior_question, learn_question }).
// Ones already asked tonight are left out.
export const GODS_HAND = "Where did you see God's hand today?";

export function questionsFrom(q, asked = []) {
  const seen = new Set(asked.map((a) => String(a ?? "").trim()));
  const list = [
    q?.savior_question,
    q?.learn_question,
    q?.gods_hand_nudge ? `${GODS_HAND} ${q.gods_hand_nudge}` : GODS_HAND,
  ]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean);
  return list.filter((s) => !seen.has(s));
}
