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
  const deceased = people.filter((p) => p.rollup_status !== "LIVING");
  const completed = people.filter((p) => p.rollup_status === "COMPLETED");
  return {
    people,
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
      people: people.length,
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
    if (o.stage !== "ready" && o.stage !== "mine") continue;
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
