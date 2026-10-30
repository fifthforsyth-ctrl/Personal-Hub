// Moving camp steps, one or many at a time (Aaron, 2026-10-30): "I need to
// be able to select multiple tasks in a camp and drag them", from the
// clipboard into the sections he's organizing, between columns, into
// another camp, or under another step.
//
// planMove works out every row that changes, and what each was, so the
// page can show it at once, save it in one go (camp_steps_place, 0095) and
// put it all back on Undo. Pure, so it can be tested.

import { stepsUnder } from "./camp.js";

const BYPOS = (a, b) =>
  (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || String(a.id).localeCompare(String(b.id));

// `steps` are every step the page knows (one camp's, or a quest's), `ids`
// the ones to move in the order they should land, and `to` where:
//   { campId, sectionId, parentId, beforeId }
// sectionId null is the camp's own steps above its sections; with parentId
// they go under that step, in its camp and section, after its others; with
// beforeId just before that one, else at the end.
//
// One under another that's moving comes along with it, and everything under
// each one comes too. A step can't go under itself or anything under it, so
// that asks for nothing (null). Otherwise it resolves to
//   { rows, was, tops, campId, sectionId, parentId }
// where `rows` are the changes ({ id, ...fields }), `was` the same rows as
// they were, and `tops` the ids that land side by side.
export function planMove(steps, ids, to = {}) {
  const all = steps ?? [];
  const byId = new Map(all.map((s) => [s.id, s]));
  const chosen = new Set((ids ?? []).filter((id) => byId.has(id)));
  if (!chosen.size) return null;
  const isUnderChosen = (st) => {
    const seen = new Set();
    for (let p = st.parent_id; p && !seen.has(p); p = byId.get(p)?.parent_id) {
      if (chosen.has(p)) return true;
      seen.add(p);
    }
    return false;
  };
  const tops = [...new Set(ids)].filter((id) => chosen.has(id) && !isUnderChosen(byId.get(id)));
  const tails = tops.flatMap((id) => stepsUnder(all, id));
  const moving = new Set([...tops, ...tails.map((x) => x.id)]);

  const parentId = to.parentId ?? null;
  const parent = parentId ? byId.get(parentId) : null;
  if (parentId && (!parent || moving.has(parentId))) return null;
  const campId = parent ? parent.camp_id : (to.campId ?? byId.get(tops[0]).camp_id);
  const sectionId = parent ? (parent.section_id ?? null) : (to.sectionId ?? null);

  const there = all
    .filter((x) => !moving.has(x.id) && x.camp_id === campId && (x.section_id ?? null) === sectionId && (x.parent_id ?? null) === parentId)
    .sort(BYPOS);
  const at = to.beforeId ? there.findIndex((x) => x.id === to.beforeId) : -1;
  const order = [...there];
  order.splice(at < 0 ? order.length : at, 0, ...tops.map((id) => byId.get(id)));

  const rows = [];
  const was = [];
  const put = (st, fields) => {
    const changed = Object.keys(fields).filter((k) => (st[k] ?? null) !== (fields[k] ?? null));
    if (!changed.length) return;
    rows.push({ id: st.id, ...Object.fromEntries(changed.map((k) => [k, fields[k]])) });
    was.push({ id: st.id, ...Object.fromEntries(changed.map((k) => [k, st[k] ?? null])) });
  };
  const top = new Set(tops);
  order.forEach((st, k) => {
    if (top.has(st.id)) put(st, { camp_id: campId, section_id: sectionId, parent_id: parentId, position: k });
    else put(st, { position: k });
  });
  for (const st of tails) put(st, { camp_id: campId, section_id: sectionId });
  return { rows, was, tops, campId, sectionId, parentId };
}

// The steps with `rows` written over them (rows from planMove, or its `was`).
export function applyRows(steps, rows) {
  const by = new Map((rows ?? []).map(({ id, ...fields }) => [id, fields]));
  return (steps ?? []).map((x) => (by.has(x.id) ? { ...x, ...by.get(x.id) } : x));
}

// The ids picked (`sel`) in the order they sit on the page: by camp, then
// the camp's own steps, then each section in order, then down each list.
// `camps` and `sections` give the order of camps and sections.
export function inPageOrder(sel, steps, sections = [], camps = []) {
  const campAt = new Map((camps ?? []).map((c, i) => [c.id, i]));
  const secAt = new Map([...(sections ?? [])].sort(BYPOS).map((s, i) => [s.id, i]));
  const byId = new Map((steps ?? []).map((s) => [s.id, s]));
  // a step's path from its top step down, each by position
  const path = (st) => {
    const out = [];
    const seen = new Set();
    for (let x = st; x && !seen.has(x.id); x = x.parent_id ? byId.get(x.parent_id) : null) {
      seen.add(x.id);
      out.unshift(x);
    }
    return out;
  };
  const key = (st) => [campAt.get(st.camp_id) ?? 1e6, st.section_id ? (secAt.get(st.section_id) ?? 1e6) + 1 : 0];
  return [...sel]
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => {
      const [ca, sa] = key(a);
      const [cb, sb] = key(b);
      if (ca !== cb) return ca - cb;
      if (sa !== sb) return sa - sb;
      const pa = path(a);
      const pb = path(b);
      for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
        if (pa[i].id !== pb[i].id) return BYPOS(pa[i], pb[i]);
      }
      return pa.length - pb.length;
    })
    .map((st) => st.id);
}

// Steps dropped on a picture (Aaron, 2026-10-30: "when I drag and drop a
// task onto the image it creates a pin in that spot"): each one carried
// wears the pin (`pinId`), and goes to the end of the picture's section
// (`to`, as planMove takes it) unless it's a step of that section already,
// the way a task added on a pin lands there (0096). With `to` null the
// picture's tasks can't go there from this page, so they only take the pin.
// Null when nothing would change; otherwise
//   { place, placeWas, pins, pinsWas, ids, sectionId }
// where `place`/`placeWas` are planMove's rows (for camp_steps_place) and
// `pins`/`pinsWas` the pin each one wears after, and before.
export function planPinDrop(steps, ids, pinId, to = null) {
  const all = steps ?? [];
  const byId = new Map(all.map((s) => [s.id, s]));
  const known = [...new Set(ids ?? [])].filter((id) => byId.has(id));
  if (!known.length || !pinId) return null;
  const away = to
    ? known.filter((id) => {
        const st = byId.get(id);
        return (to.campId && st.camp_id !== to.campId) || (st.section_id ?? null) !== (to.sectionId ?? null) || Boolean(st.parent_id);
      })
    : [];
  const move = away.length ? planMove(all, away, to) : null;
  const wearing = known.filter((id) => (byId.get(id).pin_id ?? null) !== pinId);
  const place = move?.rows ?? [];
  if (!place.length && !wearing.length) return null;
  return {
    place,
    placeWas: move?.was ?? [],
    pins: wearing.map((id) => ({ id, pin_id: pinId })),
    pinsWas: wearing.map((id) => ({ id, pin_id: byId.get(id).pin_id ?? null })),
    ids: known,
    sectionId: place.length ? move.sectionId : null,
  };
}

// The steps as a pin drop leaves them, or (`back`) as they were.
export function applyPinDrop(steps, plan, back = false) {
  return back ? applyRows(applyRows(steps, plan.pinsWas), plan.placeWas) : applyRows(applyRows(steps, plan.place), plan.pins);
}

// Rows of { id, pin_id } as one list of ids for each pin (null: none).
export function byPin(rows) {
  const m = new Map();
  for (const r of rows ?? []) {
    const k = r.pin_id ?? null;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r.id);
  }
  return [...m];
}
