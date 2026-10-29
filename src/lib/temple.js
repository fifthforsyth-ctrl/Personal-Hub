// Temple: the pure logic behind the Temple page.
//
// FamilySearch decides what's ready. Everything here only sorts, batches and
// counts what the last snapshot said: which stage each open ordinance is in,
// how the queue fills a trip, who's missing parents, and the numbers on the
// Family view. Nothing here talks to the server.

export const KIND = {
  bap: "Baptism",
  con: "Confirmation",
  ini: "Initiatory",
  end: "Endowment",
  stp: "Sealed to parents",
  sts: "Sealed to spouse",
};

export const SHORT = { bap: "BAP", con: "CON", ini: "INIT", end: "ENDOW", stp: "SEAL·P", sts: "SEAL·S" };

// The completed list uses FamilySearch's own letters.
export const DONE_KIND = { B: "Baptism", C: "Confirmation", I: "Initiatory", E: "Endowment", SP: "Sealed to parents", SS: "Sealed to spouse" };

export const STAGES = [
  { id: "research", name: "Needs research", note: "FamilySearch needs more information first." },
  { id: "permission", name: "Needs permission", note: "Born within 110 years. Log permission to free these." },
  { id: "ready", name: "Ready", note: "Free to reserve, or to request from the temple." },
  { id: "mine", name: "Reserved by you", note: "Already yours. These fill trips first." },
  { id: "others", name: "Reserved by someone else", note: "Someone else holds these, so they can't go on your trips." },
];

const RESERVED = new Set(["InProgressNotPrinted", "InProgressPrinted", "SharedInProgressNotPrinted", "SharedInProgressPrinted"]);

// The stage of one open ordinance, from FamilySearch's status and who holds
// it. null for anything that isn't open work (Completed, NotAvailable).
//
// A reserved ordinance is yours only when FamilySearch says you own it
// (`mine`, read from its owner when synced). Snapshots from before that
// was read have no owner, so their own statuses decide as they used to.
// ReservedSharedReady is held by the temple and can be requested: ready.
export function stageOf(o) {
  const s = typeof o === "string" ? o : o?.fs_status;
  const mine = typeof o === "string" ? null : o?.mine ?? null;
  if (s === "Ready" || s === "ReservedSharedReady") return "ready";
  if (s === "NeedsMoreInformation") return "research";
  if (s === "NeedsPermission") return "permission";
  if (RESERVED.has(s)) {
    if (mine === true) return "mine";
    if (mine === false) return "others";
    return s.startsWith("Shared") ? "others" : "mine";
  }
  return null;
}

export function genOf(ahnentafel) {
  return ahnentafel ? Math.floor(Math.log2(ahnentafel)) + 1 : null;
}

export function bornYear(lifespan) {
  const m = /(\d{4})/.exec(lifespan || "");
  return m ? Number(m[1]) : null;
}

export function lifeYears(lifespan) {
  const m = (lifespan || "").match(/\d{4}/g);
  return m && m.length >= 2 ? [Number(m[0]), Number(m[1])] : null;
}

export function relLabel(gen) {
  if (gen === 3) return "Grandparent";
  if (gen === 4) return "Great-grandparent";
  if (gen > 4) return `${gen - 2}× great-grandparent`;
  return "";
}

export const fsUrl = (pid) => `https://www.familysearch.org/en/tree/person/ordinances/${pid}`;

export const ordKey = (o) => `${o.pid}|${o.kind}|${o.spouse_name || ""}`;

// FamilySearch's reasons, in a few plain words.
export function plainReason(r) {
  if (/standardized place/.test(r)) return "Needs a standard place";
  if (/standardized date/.test(r)) return "Needs a standard date";
  if (/linked to the parents/.test(r)) return "Not linked to parents";
  if (/invalid characters|language template/.test(r)) return "Name has characters FamilySearch rejects";
  if (/not have enough date, place, or relationship/.test(r)) return "Not enough to qualify yet";
  return r;
}

// --- The whole picture --------------------------------------------------------

export function buildTemple({ people = [], ordinances = [], done = [], trips = [], permissions = [], helpers = [], syncs = [] }) {
  const byPid = new Map();
  for (const p of people) byPid.set(p.pid, { ...p, gen: p.generation ?? genOf(p.ahnentafel) });
  const open = [];
  // Every ordinance not yet completed, open or not (NotAvailable too), so an
  // endowment never goes ahead of an initiatory that isn't done.
  const pending = [];
  for (const o of ordinances) {
    if (o.fs_status !== "Completed") pending.push(o);
    const stage = stageOf(o);
    if (!stage) continue;
    const person = byPid.get(o.pid) ?? { pid: o.pid, name: o.pid, gender: "U", lifespan: "", gen: null };
    open.push({ ...o, key: ordKey(o), stage, person });
  }
  const openByPid = new Map();
  for (const o of open) openByPid.set(o.pid, (openByPid.get(o.pid) ?? 0) + 1);
  // `people` is the pedigree; people you've reserved from outside it are
  // in byPid only, so the fan, the facts and the totals stay about your tree.
  const tree = people.filter((p) => p.ahnentafel != null);
  const deceased = tree.filter((p) => p.rollup_status !== "LIVING");
  const completed = tree.filter((p) => p.rollup_status === "COMPLETED");
  return {
    people: tree,
    byPid,
    open,
    pending,
    openByPid,
    done,
    trips,
    permissions: new Map(permissions.map((p) => [p.pid, p])),
    helpers,
    lastSync: syncs[0] ?? null,
    counts: {
      people: tree.length,
      deceased: deceased.length,
      completed: completed.length,
      ready: open.filter((o) => o.stage === "ready").length,
      mine: open.filter((o) => o.stage === "mine").length,
      research: open.filter((o) => o.stage === "research").length,
      others: open.filter((o) => o.stage === "others").length,
    },
  };
}

// --- The queue ------------------------------------------------------------------

export const TRIP_TYPES = {
  bap: { name: "Baptisms", sub: "Baptism and confirmation", limit: 5, kinds: ["bap"] },
  ini: { name: "Initiatories", sub: "Men's names on your trips", limit: 5, kinds: ["ini"] },
  end: { name: "Endowment", sub: "One per session", limit: 1, kinds: ["end"] },
  seal: { name: "Sealings", sub: "You keep every sealing", limit: 5, kinds: ["stp", "sts"], min: 3, max: 5 },
};

const INDIVIDUAL = ["bap", "con", "ini", "end"];

// You can only do an ordinance once the ones before it are completed in
// FamilySearch: baptism and confirmation before the initiatory, all three
// before the endowment, and the endowment before a sealing. Anything still
// open blocks it, whoever holds it and whatever trip it's planned for.
// `pending` is every ordinance that isn't completed (a list of open ones
// works too). NotAvailable never blocks: a child who died young has no
// individual ordinances and can still be sealed.
export function waitsOn(o, pending) {
  const theirs = pending.filter((x) => x.pid === o.pid && x.fs_status !== "Completed" && x.fs_status !== "NotAvailable");
  const has = (...kinds) => theirs.some((x) => kinds.includes(x.kind));
  if (o.kind === "con") return has("bap") ? "baptism" : null;
  if (o.kind === "ini") return has("bap", "con") ? "baptism" : null;
  if (has("bap", "con")) return o.kind === "end" || o.kind === "stp" || o.kind === "sts" ? "baptism" : null;
  if (o.kind === "end") return has("ini") ? "initiatory" : null;
  if (o.kind === "stp" || o.kind === "sts") return has("ini") ? "initiatory" : has("end") ? "endowment" : null;
  return null;
}

// Who goes on a trip of this type, best first: names you already hold, then
// the last open ordinance a person has, then closer relatives, then the
// oldest. Men only for individual ordinances (women's go to helpers); every
// sealing is yours. A couple's sealing shows once, not from both sides.
export function candidates(view, type, { taken = new Set() } = {}) {
  const T = TRIP_TYPES[type];
  const seen = new Set();
  const out = [];
  for (const o of view.open) {
    if (!T.kinds.includes(o.kind)) continue;
    // You reserve the names; the Hub only plans what you already hold.
    if (o.stage !== "mine") continue;
    if (taken.has(o.key)) continue;
    if (type !== "seal" && o.person.gender !== "M") continue;
    if (o.kind === "sts") {
      const couple = [o.person.name, o.spouse_name].sort().join("|");
      if (seen.has(couple)) continue;
      seen.add(couple);
    }
    const waits = waitsOn(o, view.pending ?? view.open);
    const lastOne = view.openByPid.get(o.pid) === 1;
    const why = [o.stage === "mine" ? "Reserved by you" : o.fs_status === "ReservedSharedReady" ? "Request from the temple" : "Ready"];
    if (lastOne) why.push(o.person.gender === "F" ? "Last one for her" : "Last one for him");
    if (o.person.gen) why.push(o.person.gen <= 5 ? relLabel(o.person.gen) : `Gen ${o.person.gen}`);
    out.push({ o, why, waits, lastOne });
  }
  out.sort(
    (a, b) =>
      Number(Boolean(a.waits)) - Number(Boolean(b.waits)) ||
      Number(a.o.stage !== "mine") - Number(b.o.stage !== "mine") ||
      Number(!a.lastOne) - Number(!b.lastOne) ||
      (a.o.person.gen ?? 99) - (b.o.person.gen ?? 99) ||
      (bornYear(a.o.person.lifespan) ?? 9999) - (bornYear(b.o.person.lifespan) ?? 9999) ||
      a.o.key.localeCompare(b.o.key)
  );
  return out;
}

// Keys already on a planned trip, so two trips never take the same name.
export function takenKeys(trips, exceptId = null) {
  const taken = new Set();
  for (const t of trips) {
    if (t.status !== "planned" || t.id === exceptId) continue;
    for (const it of t.items ?? []) taken.add(ordKey({ pid: it.pid, kind: it.kind, spouse_name: it.spouse }));
  }
  return taken;
}

export function fillTrip(view, type, limit) {
  const T = TRIP_TYPES[type];
  const n = limit ?? T.limit;
  const all = candidates(view, type, { taken: takenKeys(view.trips) });
  const free = all.filter((c) => !c.waits);
  const waiting = [];
  for (const c of all) if (c.waits && !waiting.some((w) => w.o.pid === c.o.pid)) waiting.push(c);
  return { type, limit: n, items: free.slice(0, n), more: Math.max(0, free.length - n), waiting };
}

export function tripItem(o) {
  return { pid: o.pid, name: o.person.name, kind: o.kind, spouse: o.spouse_name || "", lifespan: o.person.lifespan || "" };
}

// A trip is finished when none of its names are still open in FamilySearch.
// Ticking it here never makes it done.
export function tripProgress(trip, view) {
  const byKey = new Map(view.open.map((o) => [o.key, o]));
  const items = (trip.items ?? []).map((it) => {
    const o = byKey.get(ordKey({ pid: it.pid, kind: it.kind, spouse_name: it.spouse }));
    return { ...it, open: Boolean(o), blocked: o ? blockedReason(o, view) : null };
  });
  return { items, left: items.filter((i) => i.open).length, finished: items.length > 0 && items.every((i) => !i.open) };
}

// Why a name on a planned trip can't be done now, from the latest snapshot:
// someone else holds it, or an earlier ordinance isn't completed yet.
export function blockedReason(o, view) {
  if (o.stage === "others") return o.reserved_by ? `Reserved by ${o.reserved_by}` : "Reserved by someone else";
  if (o.stage !== "mine" && o.stage !== "ready") return STAGES.find((s) => s.id === o.stage)?.name ?? "Not ready";
  const waits = waitsOn(o, view.pending ?? view.open);
  return waits ? `Waits on the ${waits}` : null;
}

export function nextTrip(trips, today) {
  return trips
    .filter((t) => t.status === "planned" && t.planned_on >= today)
    .sort((a, b) => a.planned_on.localeCompare(b.planned_on))[0] ?? null;
}

// Women's baptisms, confirmations, initiatories and endowments: theirs to
// take. Grouped by person.
export function helperNames(view) {
  const by = new Map();
  for (const o of view.open) {
    if (o.person.gender !== "F" || !INDIVIDUAL.includes(o.kind) || o.stage === "others") continue;
    if (!by.has(o.pid)) by.set(o.pid, { person: o.person, ords: [], ready: false });
    const g = by.get(o.pid);
    g.ords.push(o);
    if (o.stage === "ready" || o.stage === "mine") g.ready = true;
  }
  const all = [...by.values()];
  return { ready: all.filter((g) => g.ready), later: all.filter((g) => !g.ready) };
}

// --- Research -------------------------------------------------------------------

export function researchGroups(view) {
  const groups = new Map();
  for (const o of view.open) {
    if (o.stage !== "research") continue;
    for (const r of o.reasons?.length ? o.reasons : ["Needs more information"]) {
      const label = plainReason(r);
      if (!groups.has(label)) groups.set(label, new Map());
      groups.get(label).set(o.pid, o.person);
    }
  }
  return [...groups.entries()].map(([label, m]) => ({ label, people: [...m.values()] }));
}

// Direct-line ancestors in generations 6 to 8 with a parent missing from the
// tree: each one found can open new names.
export function missingParents(people, { from = 6, to = 8 } = {}) {
  const have = new Set(people.map((p) => p.ahnentafel).filter(Boolean));
  const out = [];
  for (const p of people) {
    const gen = p.generation ?? genOf(p.ahnentafel);
    if (!p.ahnentafel || gen < from || gen > to || p.rollup_status === "LIVING") continue;
    const father = have.has(2 * p.ahnentafel);
    const mother = have.has(2 * p.ahnentafel + 1);
    if (father && mother) continue;
    out.push({ person: { ...p, gen }, missing: !father && !mother ? "both" : !father ? "father" : "mother" });
  }
  return out.sort((a, b) => a.person.ahnentafel - b.person.ahnentafel);
}

export function permissionNames(view) {
  return view.open.filter((o) => o.stage === "permission");
}

// --- People you've done work for --------------------------------------------------

export function crowd(done) {
  const list = done
    .map((d) => ({ ...d, ordinances: [...(d.ordinances ?? [])].sort((a, b) => (a.date || "").localeCompare(b.date || "")) }))
    .sort((a, b) => (a.ordinances[0]?.date || "").localeCompare(b.ordinances[0]?.date || "") || a.pid.localeCompare(b.pid));
  const dates = list.flatMap((d) => d.ordinances.map((o) => o.date)).filter(Boolean).sort();
  return {
    people: list,
    ordinances: list.reduce((n, d) => n + d.ordinances.length, 0),
    direct: list.filter((d) => d.in_pedigree).length,
    since: dates[0] ?? null,
    temples: tally(list.flatMap((d) => d.ordinances.map((o) => o.temple).filter(Boolean))),
  };
}

function tally(xs) {
  const m = new Map();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// --- Your family in numbers ---------------------------------------------------------

const COUNTRY = {
  "United Kingdom": "England & Scotland",
  England: "England & Scotland",
  Scotland: "England & Scotland",
  Germany: "Germany & Prussia",
  Prussia: "Germany & Prussia",
  "British Colonial America": "Colonial America",
  "Republic of Vermont": "United States",
  Czechoslovakia: "Bohemia",
  "British North America": "Canada",
  Russia: "Russian Empire",
};

export function countryOf(place) {
  if (!place) return null;
  const last = place.split(",").pop().trim();
  return COUNTRY[last] ?? last;
}

export function familyFacts(people, { thisYear = new Date().getFullYear() } = {}) {
  const born = people.map((p) => ({ p, y: bornYear(p.lifespan) })).filter((x) => x.y);
  const lives = people.map((p) => ({ p, span: lifeYears(p.lifespan) })).filter((x) => x.span && x.span[1] >= x.span[0]);
  const years = lives.map((x) => x.span[1] - x.span[0]);
  const earliest = born.reduce((a, b) => (!a || b.y < a.y ? b : a), null);
  const byLength = [...lives].sort((a, b) => b.span[1] - b.span[0] - (a.span[1] - a.span[0]));

  const decades = new Map();
  for (const { y } of born) decades.set(Math.floor(y / 10) * 10, (decades.get(Math.floor(y / 10) * 10) ?? 0) + 1);
  const firstDecade = earliest ? Math.floor(earliest.y / 10) * 10 : 1700;
  const byDecade = [];
  for (let d = firstDecade; d <= Math.floor(thisYear / 10) * 10; d += 10) byDecade.push({ decade: d, n: decades.get(d) ?? 0 });

  const towns = tally(
    people
      .map((p) => (p.birth_place || "").split(",").map((s) => s.trim()))
      .filter((parts) => parts.length >= 3)
      .map((parts) => `${parts[0]}|${parts[parts.length - 2]}`)
  ).map(([k, n]) => {
    const [town, region] = k.split("|");
    return { town, region, n };
  });

  const pioneers = people.filter((p) => {
    const y = bornYear(p.lifespan);
    return y && y < 1850 && /\bUtah\b/.test(p.death_place || "") && !/\bUtah\b/.test(p.birth_place || "");
  });

  return {
    people: people.length,
    completed: people.filter((p) => p.rollup_status === "COMPLETED").length,
    yearsLived: years.reduce((a, b) => a + b, 0),
    withBothDates: lives.length,
    averageLife: years.length ? Math.round(years.reduce((a, b) => a + b, 0) / years.length) : null,
    longest: byLength[0] ?? null,
    shortest: byLength[byLength.length - 1] ?? null,
    earliest: earliest ? { person: earliest.p, year: earliest.y } : null,
    span: earliest ? thisYear - earliest.y : null,
    aliveIn1776: lives.filter((x) => x.span[0] <= 1776 && x.span[1] >= 1776).length,
    byDecade,
    countries: tally(people.map((p) => countryOf(p.birth_place)).filter(Boolean)),
    towns,
    pioneers,
  };
}

// Stories from Church and world history, each tied to people in the tree by
// their FamilySearch id. One shows only when its people are still in the
// snapshot.
export const STORIES = [
  {
    title: "Born in a country that no longer exists",
    pids: ["K2Q6-JV8"],
    text: "Shadrach Roundy was born in 1788 in the Republic of Vermont, an independent country from 1777 to 1791. Others in your tree were born in Bohemia, Prussia, the Russian Empire and British Colonial America.",
  },
  {
    title: "Pioneers to Zion",
    pids: ["K2Q6-JV8", "KWJY-X32", "K2HH-5XK"],
    text: "Shadrach Roundy came west in Brigham Young's 1847 vanguard company. Daniel Tyler marched with the Mormon Battalion and wrote its history. Zera Pulsipher was one of the early presidents of the Seventy.",
  },
  {
    title: "The Laturnus road",
    pids: ["MTQD-174"],
    text: "Your Laturnus line were Black Sea Germans: from Alsace to the steppe near Odessa, then to the North Dakota prairie.",
    route: ["Oberseebach, Alsace", "Odessa, Russia", "North Dakota"],
  },
  {
    title: "The Nottingham converts",
    pids: ["KWJF-H7M", "KWJF-H7J"],
    text: "The Astill and Goddard families left Radford, Nottinghamshire, England, for Utah.",
  },
];

// --- The fan chart ----------------------------------------------------------------

export const FAN_RADII = [0, 22, 48, 72, 94, 114, 132, 148, 162, 176];

// One wedge per pedigree slot from generation 2 out, left to right; a slot
// with no person is an unknown ancestor.
export function fanSlots(people, generations = 9) {
  const byA = new Map(people.filter((p) => p.ahnentafel).map((p) => [p.ahnentafel, p]));
  const slots = [];
  for (let g = 2; g <= generations; g++) {
    const n = 2 ** (g - 1);
    for (let i = 0; i < n; i++) {
      slots.push({ g, i, n, a: n + i, person: byA.get(n + i) ?? null });
    }
  }
  return slots;
}

// --- Loading a snapshot -------------------------------------------------------------

// A snapshot file, checked before anything is written. Throws with a
// sentence that says what's wrong.
export function parseSnapshot(text) {
  let snap;
  try {
    snap = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a FamilySearch snapshot (it isn't JSON).");
  }
  if (snap?.kind !== "hub-temple-snapshot" || !Array.isArray(snap.people)) {
    throw new Error("That file isn't a FamilySearch snapshot for the Hub.");
  }
  const synced = new Date(snap.synced_at);
  if (Number.isNaN(synced.getTime())) throw new Error("The snapshot has no date it was read.");
  // Someone can sit in the pedigree twice (cousins who married); they're kept
  // once, at their closest place in it.
  const people = uniqueBy(
    snap.people.filter((p) => p && typeof p.pid === "string" && p.name).sort((a, b) => (a.ahnentafel ?? 1e9) - (b.ahnentafel ?? 1e9)),
    (p) => p.pid
  );
  const ordinances = uniqueBy(
    (snap.ordinances ?? []).filter((o) => o && o.pid && KIND[o.kind] && o.fs_status),
    (o) => ordKey(o)
  );
  // A sync that couldn't read the completed list leaves `done` out, and the
  // list from before stays.
  const hasDone = Array.isArray(snap.done);
  const done = uniqueBy((snap.done ?? []).filter((d) => d && d.pid && d.name), (d) => d.pid);
  if (!people.length) throw new Error("The snapshot has nobody in it.");
  return {
    syncedAt: synced.toISOString(),
    people: people.map((p) => ({
      pid: p.pid,
      name: p.name,
      gender: ["M", "F"].includes(p.gender) ? p.gender : "U",
      lifespan: p.lifespan ?? null,
      ahnentafel: Number.isInteger(p.ahnentafel) ? p.ahnentafel : null,
      generation: Number.isInteger(p.generation) ? p.generation : genOf(p.ahnentafel),
      birth_place: p.birth_place ?? null,
      death_place: p.death_place ?? null,
      rollup_status: p.rollup_status ?? null,
    })),
    ordinances: ordinances.map((o) => ({
      pid: o.pid,
      kind: o.kind,
      spouse_name: o.spouse_name ?? "",
      fs_status: o.fs_status,
      reasons: Array.isArray(o.reasons) ? o.reasons.map(String) : [],
      reserved_by: typeof o.reserved_by === "string" && o.reserved_by ? o.reserved_by : null,
      mine: typeof o.mine === "boolean" ? o.mine : null,
    })),
    done: !hasDone ? null : done.map((d) => ({
      pid: d.pid,
      name: d.name,
      gender: ["M", "F"].includes(d.gender) ? d.gender : "U",
      lifespan: d.lifespan ?? null,
      in_pedigree: Boolean(d.in_pedigree),
      ordinances: Array.isArray(d.ordinances) ? d.ordinances.filter((o) => o && o.type) : [],
    })),
  };
}

function uniqueBy(rows, keyOf) {
  const seen = new Set();
  return rows.filter((r) => {
    const k = keyOf(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// --- Your reservations, in order ---------------------------------------------------
//
// You find and reserve names in FamilySearch; the Hub takes every name you
// hold and works out what each person needs next and when you can do it.
//
// Each person goes step by step: baptism (with confirmation), then the
// initiatory, then the endowment, then their sealings. A step is yours to
// do when you hold it. Women's baptisms, confirmations, initiatories and
// endowments go to a helper. Anything before your step that someone else
// holds, or that isn't reserved yet, holds the person up.

export const STEPS = [
  { id: "bap", name: "Baptism", kinds: ["bap", "con"] },
  { id: "ini", name: "Initiatory", kinds: ["ini"] },
  { id: "end", name: "Endowment", kinds: ["end"] },
  { id: "seal", name: "Sealing", kinds: ["stp", "sts"] },
];

const STEP_OF = { bap: "bap", con: "bap", ini: "ini", end: "end", stp: "seal", sts: "seal" };

// A couple's sealing needs both of them endowed, and it's one sealing
// however many of their records list it. So each couple's sealing is kept
// once, on whichever of the two still has steps of yours ahead of it; when
// the other spouse still needs work you don't hold, it waits.
function sealCouples(out, view, pending) {
  const byName = new Map();
  for (const p of view.byPid.values()) if (!byName.has(p.name)) byName.set(p.name, p);
  const entryOf = new Map(out.map((e) => [e.person.pid, e]));
  const behind = (pid) => pending.some((x) => x.pid === pid && INDIVIDUAL.includes(x.kind) && x.fs_status !== "Completed" && x.fs_status !== "NotAvailable");
  const groups = new Map();
  for (const e of out) {
    const st = e.steps.find((x) => x.step === "seal");
    if (!st) continue;
    for (const o of st.ords) {
      if (o.kind !== "sts") continue;
      const k = [e.person.name, o.spouse_name].sort().join("|");
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push({ e, o });
    }
  }
  for (const list of groups.values()) {
    for (const { e, o } of list) {
      const st = e.steps.find((x) => x.step === "seal");
      st.ords = st.ords.filter((x) => x !== o);
    }
    const first = list[0];
    const spouse = byName.get(first.o.spouse_name);
    const sides = [first.e.person, spouse].filter(Boolean);
    const late = sides.filter((p) => behind(p.pid));
    let home = first;
    let held = null;
    for (const p of late) {
      const e = entryOf.get(p.pid);
      if (e && e.lane !== "helper" && e.lane !== "waiting" && e.steps.some((x) => x.step !== "seal")) {
        home = list.find((x) => x.e === e) ?? { e, o: first.o };
      } else {
        held = `Sealing waits on ${p.name}'s ordinances`;
      }
    }
    if (held) {
      first.e.held = [...(first.e.held ?? []), held];
      continue;
    }
    let st = home.e.steps.find((x) => x.step === "seal");
    if (!st) home.e.steps.push((st = { step: "seal", ords: [] }));
    st.ords.push(home.o);
  }
  for (let i = out.length - 1; i >= 0; i--) {
    const e = out[i];
    e.steps = e.steps.filter((x) => x.ords.length);
    if (!e.steps.length) {
      if (e.held?.length) {
        e.lane = "waiting";
        e.why = e.why ?? e.held[0];
      } else if (e.lane !== "waiting") out.splice(i, 1);
    } else if (e.lane === "seal" && e.steps[0].step !== "seal") e.lane = e.steps[0].step;
  }
}

// Everyone you hold a name for, with the step they're on.
//   lane: "bap" | "ini" | "end" | "seal"  (yours to do next)
//         "helper"                          (a woman's step, for a helper)
//         "waiting"                         (held up; `why` says by what)
//   steps: the steps still yours, in order, with the ordinances in each
export function myNames(view) {
  const pending = view.pending ?? view.open;
  const openByKey = new Map(view.open.map((o) => [o.key, o]));
  const byPid = new Map();
  for (const o of view.open) {
    if (o.stage !== "mine") continue;
    if (!byPid.has(o.pid)) byPid.set(o.pid, []);
    byPid.get(o.pid).push(o);
  }
  const out = [];
  for (const [pid, mine] of byPid) {
    const person = mine[0].person;
    const left = pending.filter((x) => x.pid === pid && x.fs_status !== "Completed" && x.fs_status !== "NotAvailable");
    const steps = [];
    // Steps of yours behind one you can't do yet: shown, never planned.
    const later = [];
    let lane = null;
    let why = null;
    let blocked = false;
    for (const st of STEPS) {
      const here = left.filter((x) => st.kinds.includes(x.kind));
      if (!here.length) continue;
      const theirs = here.map((x) => openByKey.get(ordKey(x)) ?? { ...x, key: ordKey(x), stage: stageOf(x), person });
      const yours = theirs.filter((x) => x.stage === "mine");
      const notYours = theirs.filter((x) => x.stage !== "mine");
      if (!blocked && (!yours.length || (st.id !== "seal" && notYours.length))) {
        // A step you don't hold: everything of yours after it waits.
        const x = notYours[0];
        why =
          x.stage === "others"
            ? `${st.name} held by ${x.reserved_by || "someone else"}`
            : x.stage === "ready"
              ? `Reserve the ${st.name.toLowerCase()} too`
              : x.stage === "research"
                ? `${st.name} needs research`
                : x.stage === "permission"
                  ? `${st.name} needs permission`
                  : `${st.name} isn't ready`;
        if (st.id !== "seal") blocked = true;
        if (!lane && st.id !== "seal") lane = "waiting";
        if (yours.length) (blocked ? later : steps).push({ step: st.id, ords: yours });
        continue;
      }
      if (!yours.length) continue;
      (blocked ? later : steps).push({ step: st.id, ords: yours });
      if (!lane) lane = person.gender === "F" && st.id !== "seal" ? "helper" : st.id;
    }
    if (!steps.length && !later.length) continue;
    if (!lane) lane = "waiting";
    out.push({ person, lane, why: blocked || lane === "waiting" ? why : null, steps: lane === "waiting" ? [] : steps, later: lane === "waiting" ? [...steps, ...later] : later });
  }
  sealCouples(out, view, pending);
  out.sort((a, b) => (a.person.gen ?? 99) - (b.person.gen ?? 99) || (bornYear(a.person.lifespan) ?? 9999) - (bornYear(b.person.lifespan) ?? 9999) || a.person.name.localeCompare(b.person.name));
  return out;
}

// The days you go, for 1, 2 or 3 trips a week, from the day after `from`.
const WEEKDAYS = { 1: [6], 2: [3, 6], 3: [1, 3, 6] };

export function tripDates(from, perWeek, count) {
  const days = WEEKDAYS[perWeek] ?? WEEKDAYS[1];
  const [y, m, d] = from.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const out = [];
  for (let i = 0; out.length < count && i < count * 8 + 7; i++) {
    t.setUTCDate(t.getUTCDate() + 1);
    if (days.includes(t.getUTCDay())) out.push(t.toISOString().slice(0, 10));
  }
  return out;
}

// Your next trips, in order, from the names you hold.
//
// One kind of work per trip, at the trip limits (5 baptisms, 5
// initiatories, 1 endowment, up to 5 sealings). A person's next step can
// only go on a later trip than the one before it. Each trip takes the kind
// with the fullest batch, earlier steps first on a tie; sealings wait for
// at least 3 unless nothing else is ready. Trips you've already planned go
// first, as you planned them.
export function planTrips(view, { from, perWeek = 1, max = 80 } = {}) {
  const names = myNames(view).filter((n) => n.lane !== "helper" && n.lane !== "waiting");
  // A queue of steps per person; `after` is the trip index their last step was on.
  const state = names.map((n) => ({ person: n.person, steps: n.steps.map((s) => ({ ...s, ords: [...s.ords] })), after: -1 }));
  const trips = [];
  const planned = (view.trips ?? []).filter((t) => t.status === "planned" && t.planned_on >= from).sort((a, b) => a.planned_on.localeCompare(b.planned_on));
  const keyOf = (it) => ordKey({ pid: it.pid, kind: it.kind, spouse_name: it.spouse });

  for (const t of planned) {
    const idx = trips.length;
    const keys = new Set((t.items ?? []).map(keyOf));
    for (const s of state) {
      const st = s.steps[0];
      if (!st) continue;
      const hit = st.ords.filter((o) => keys.has(o.key) || (st.step === "bap" && o.kind === "con" && keys.has(ordKey({ pid: o.pid, kind: "bap", spouse_name: "" }))));
      if (!hit.length) continue;
      st.ords = st.ords.filter((o) => !hit.includes(o));
      if (!st.ords.length) {
        s.steps.shift();
        s.after = idx;
      }
    }
    trips.push({ date: t.planned_on, kind: t.kind, items: t.items ?? [], planned: t });
  }

  const start = trips.length ? trips[trips.length - 1].date : from;
  const dates = tripDates(start, perWeek, max);
  for (let i = 0; i < dates.length; i++) {
    const idx = trips.length;
    const ready = { bap: [], ini: [], end: [], seal: [] };
    for (const s of state) {
      const st = s.steps[0];
      if (st && s.after < idx) ready[st.step].push(s);
    }
    const sealCount = ready.seal.reduce((n, s) => n + s.steps[0].ords.length, 0);
    if (!ready.bap.length && !ready.ini.length && !ready.end.length && !sealCount) break;
    const others = ready.bap.length + ready.ini.length + ready.end.length;
    const fullness = {
      bap: Math.min(1, ready.bap.length / TRIP_TYPES.bap.limit),
      ini: Math.min(1, ready.ini.length / TRIP_TYPES.ini.limit),
      end: ready.end.length ? 1 : 0,
      seal: sealCount >= 3 || !others ? Math.min(1, sealCount / TRIP_TYPES.seal.limit) : 0,
    };
    const kind = ["bap", "ini", "end", "seal"].reduce((best, k) => (fullness[k] > fullness[best] ? k : best), "bap");
    const items = [];
    if (kind === "seal") {
      for (const s of ready.seal) {
        const st = s.steps[0];
        while (st.ords.length && items.length < TRIP_TYPES.seal.limit) items.push(tripItem(st.ords.shift()));
        if (!st.ords.length) {
          s.steps.shift();
          s.after = idx;
        }
        if (items.length >= TRIP_TYPES.seal.limit) break;
      }
    } else {
      for (const s of ready[kind].slice(0, TRIP_TYPES[kind].limit)) {
        const st = s.steps.shift();
        s.after = idx;
        items.push(...st.ords.filter((o) => o.kind !== "con").map(tripItem));
      }
    }
    trips.push({ date: dates[i], kind, items });
  }

  const left = state.filter((s) => s.steps.length);
  const ordinances = trips.reduce((n, t) => n + t.items.reduce((m, it) => m + (it.kind === "bap" ? 2 : 1), 0), 0);
  return { trips, left: left.map((s) => s.person), finished: left.length === 0, ordinances };
}

// How far each pace gets you: when everything you hold would be done, and
// how many ordinances in the first 4 and 12 weeks.
export function paceTimeline(view, from) {
  return [1, 2, 3].map((perWeek) => {
    const plan = planTrips(view, { from, perWeek, max: 400 });
    const by = (weeks) => {
      const [y, m, d] = from.split("-").map(Number);
      const end = new Date(Date.UTC(y, m - 1, d + weeks * 7)).toISOString().slice(0, 10);
      return plan.trips.filter((t) => t.date <= end).reduce((n, t) => n + t.items.reduce((k, it) => k + (it.kind === "bap" ? 2 : 1), 0), 0);
    };
    const last = plan.trips[plan.trips.length - 1];
    return { perWeek, trips: plan.trips.length, doneOn: plan.finished && last ? last.date : null, ordinances: plan.ordinances, in4: by(4), in12: by(12) };
  });
}
