// The dragons (supabase/migrations/0087_dragons.sql): tasks build the
// village; wins raise the dragons. Every win he logs after the purse
// started puts one in it (it started with 100), and he spends them on eggs
// and on training the dragons that hatch. A loss never takes a win out, and
// spending never touches his win history.
//
// An egg rests in the hatchery's warm sand once the hatchery stands. Each
// day he banks warms it, and it hatches on the third; on days he doesn't
// bank, it simply waits. Until it hatches its warmth comes from the banked
// days, so unbanking a day takes its warmth back. Once the page sees it
// hatch, the day is kept (hatched_on, through dragon_hatch), and a dragon
// with a kept day, or one he has trained, has hatched for good: a task
// unticked later can move the day the hatchery stood, but never turns a
// dragon back into an egg. There is no hunger, sickness, decay, timer or
// reminder, and dragons never leave.
//
// Everything here is pure: the page loads the rows (fetchDragons in api.js)
// and dragonsOf turns them into the purse, the dragons and the eggs. The
// server keeps the prices too and checks every spend (dragon_buy,
// dragon_train); these are the same numbers, for showing.

export const START_WINS = 100;
export const HATCH_DAYS = 3;

// The five kinds, cheapest egg first.
export const KINDS = [
  {
    kind: "boulder",
    name: "Boulder dragon",
    egg: 40,
    line: "Slow, tough and gentle. Its hide is half rock and it would rather guard the gate than race.",
    eggLine: "Grey and speckled, rough like a river stone.",
  },
  {
    kind: "crest",
    name: "Crest dragon",
    egg: 50,
    line: "Walks on two legs, fans its crown when it is proud, and flicks its tail spikes at the training targets.",
    eggLine: "Cream with dark spots, like the dragon's own back.",
  },
  {
    kind: "dawn",
    name: "Dawn dragon",
    egg: 70,
    line: "The night dragon's white cousin: sleek, quiet, with eyes like a winter sky.",
    eggLine: "White as new snow.",
  },
  {
    kind: "ember",
    name: "Ember dragon",
    egg: 90,
    line: "Fierce and proud. Its belly and wing edges glow like a forge.",
    eggLine: "Black, veined with orange as if it were still cooling.",
  },
  {
    kind: "night",
    name: "Night dragon",
    egg: 150,
    line: "The rare one. Black, quick and loyal, and the one the others follow.",
    eggLine: "Black, with a faint slate mottle. The largest of the five.",
  },
];

const BY_KIND = new Map(KINDS.map((k) => [k.kind, k]));

export function kindOf(kind) {
  return BY_KIND.get(kind) ?? { kind, name: "Dragon", egg: 0, line: "", eggLine: "" };
}

// Training, in order, paid in wins. A hatchling needs nothing but to hatch.
export const TRAINING = [
  { stage: "fledgling", name: "Fledgling", cost: 30, line: "Fed at the fish racks. Glides from the rooftops." },
  { stage: "flier", name: "Flier", cost: 60, line: "Trained in the ring. Flies the village circuit." },
  { stage: "rider", name: "Rider's dragon", cost: 120, line: "Saddled at the workshop. Carries a rider over the village each evening you bank the day." },
];

// Every stage from the egg up.
export const STAGES = [
  { stage: "egg", name: "Egg", line: "Rests in the hatchery's warm sand. Each day you bank warms it, and it hatches on the third." },
  { stage: "hatchling", name: "Hatchling", line: "Curious and small, about a third of its full size, with a big head and bigger eyes." },
  ...TRAINING.map(({ stage, name, line }) => ({ stage, name, line })),
];

const STAGE_NAME = new Map(STAGES.map((s) => [s.stage, s.name]));

const later = (a, b) => (a > b ? a : b);

const byBought = (a, b) =>
  String(a.bought_on).localeCompare(String(b.bought_on)) ||
  String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
  String(a.id).localeCompare(String(b.id));

// The day the hatchery stood: the day its last task was laid, from
// villageOf() (or allocate()'s projects). Null while none stands. With two,
// the first.
export function hatcheryDay(village) {
  const projects = Array.isArray(village) ? village : village?.projects ?? [];
  const days = projects.filter((p) => p.kind === "hatchery" && p.complete && p.finishedOn).map((p) => p.finishedOn);
  return days.sort()[0] ?? null;
}

// The purse and the dragons, from the rows as loaded:
//   purse       { start_wins, started_at }, or null before the first spend
//   winsSince   wins logged after started_at
//   winsToday   of those, the ones on the phone's day
//   dragons     [{ id, kind, name, bought_on, free, hatched_on, created_at }]
//   spends      [{ dragon_id, what, cost, day }]
//   banked      the banked days ("YYYY-MM-DD")
//   hatcheryOn  hatcheryDay() of the village, or null
//   today       the phone's day
// Each dragon comes back as
//   { id, kind, name, boughtOn, free, stage, hatched, hatchOn, kept, warmth,
//     daysLeft, waiting, next: { stage, cost } | null, short }
// where warmth is 0..3 banked days so far, daysLeft how many more it takes
// to hatch, waiting that no hatchery stands yet, kept that the day it
// hatched is stored (the page keeps it when it isn't: see keepHatches in
// api.js), and short the wins still needed for `next` (0 when he can
// afford it).
export function dragonsOf({ purse = null, winsSince = 0, winsToday = 0, dragons = [], spends = [], banked = [], hatcheryOn = null, today }) {
  const start = purse?.start_wins ?? START_WINS;
  const earned = Number(winsSince) || 0;
  const spent = spends.reduce((a, s) => a + (Number(s.cost) || 0), 0);
  // Only deleting a win that was already spent can take the purse below
  // nothing. It shows as empty, and what's short still counts from the real
  // amount so the page never offers what the server would refuse.
  const raw = start + earned - spent;
  const shortOf = (cost) => Math.max(0, cost - raw);

  const stands = !!hatcheryOn && (!today || hatcheryOn <= today);
  const days = [...new Set(banked.filter(Boolean))].filter((d) => !today || d <= today).sort();
  const trainedIn = new Map();
  for (const s of spends) {
    if (!trainedIn.has(s.dragon_id)) trainedIn.set(s.dragon_id, new Set());
    trainedIn.get(s.dragon_id).add(s.what);
  }

  const list = [...dragons].sort(byBought).map((d) => {
    const from = stands ? later(d.bought_on, hatcheryOn) : null;
    const warm = from ? days.filter((x) => x >= from) : [];
    const warmth = Math.min(HATCH_DAYS, warm.length);
    // Stages count only in order, so a gap can't skip one.
    const had = trainedIn.get(d.id) ?? new Set();
    let at = -1;
    while (at + 1 < TRAINING.length && had.has(TRAINING[at + 1].stage)) at++;
    const kept = d.hatched_on ?? null;
    const hatched = Boolean(kept) || warmth >= HATCH_DAYS || at >= 0;
    const next = hatched && at + 1 < TRAINING.length ? TRAINING[at + 1] : null;
    return {
      id: d.id,
      kind: d.kind,
      name: d.name ?? null,
      boughtOn: d.bought_on,
      free: !!d.free,
      stage: !hatched ? "egg" : at >= 0 ? TRAINING[at].stage : "hatchling",
      hatched,
      hatchOn: kept ?? warm[HATCH_DAYS - 1] ?? null,
      kept: Boolean(kept),
      warmth: hatched ? HATCH_DAYS : warmth,
      daysLeft: hatched ? 0 : HATCH_DAYS - warmth,
      waiting: !hatched && !stands,
      next: next ? { stage: next.stage, cost: next.cost } : null,
      short: next ? shortOf(next.cost) : 0,
    };
  });

  return {
    balance: Math.max(0, raw),
    todayWins: Number(winsToday) || 0,
    start,
    earned,
    spent,
    // One free egg ever, of any kind, once the hatchery stands.
    freeEgg: dragons.some((d) => d.free) ? "used" : stands ? "ready" : "locked",
    dragons: list,
    eggs: list.filter((d) => !d.hatched),
    hatched: list.filter((d) => d.hatched),
    nextEgg: KINDS.map((k) => ({ kind: k.kind, cost: k.egg, short: shortOf(k.egg) })),
  };
}

// What the painter draws on a dragon build: his hatched dragons at their
// stages, and the eggs warming in the hatchery (an egg bought before the
// hatchery stood isn't in it yet).
export function paintDragons(state) {
  return {
    dragons: (state?.hatched ?? []).map((d) => ({ id: d.id, kind: d.kind, stage: d.stage, name: d.name ?? null })),
    eggs: (state?.eggs ?? []).filter((e) => !e.waiting).map((e) => ({ id: e.id, kind: e.kind })),
  };
}

// "64 wins", "1 win".
export function winsLine(n) {
  return `${Number(n).toLocaleString("en-US")} ${n === 1 ? "win" : "wins"}`;
}

// Under an egg: how many more banked days it takes, never a countdown.
export function hatchLine(egg) {
  if (egg.waiting) return "Waits for the hatchery";
  if (egg.daysLeft <= 0) return "Hatched";
  if (egg.daysLeft === 1) return "Hatches the next day you bank";
  return egg.warmth > 0 ? `Hatches after ${egg.daysLeft} more banked days` : `Hatches after ${egg.daysLeft} banked days`;
}

// Under a dragon: "Fledgling · next, flier", or just "Rider's dragon".
export function stageLine(dragon) {
  const name = STAGE_NAME.get(dragon.stage) ?? "Dragon";
  if (!dragon.next) return name;
  return `${name} · next, ${STAGE_NAME.get(dragon.next.stage).toLowerCase()}`;
}
