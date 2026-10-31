// The weekly mirror: one calm look back at a week, Sunday to Saturday.
//
// The page fetches the week's rows and hands them in here; what comes back
// is plain sentences, with **bold** on the numbers, and the few points the
// small charts draw. Nothing is scored, praised or scolded: the point is to
// see the week clearly, not to grade it. A part with nothing recorded is
// left out rather than shown empty.
//
// Pure on purpose, so each rule can be tested on its own (scripts/test.mjs).

import { addDays, parseDateStr, startOfMonth, toDateStr } from "./planDates.js";
import {
  tagsOf,
  isSleep,
  isNap,
  clockMinutes,
  fmtClock,
  fmtDuration,
  SLEEP_HOURS,
  practiceSummary,
  clientOfEntry,
  DEFAULT_REASONS,
  STRESS_SOURCES,
} from "./honest.js";
import { summarizeWeek } from "./focus.js";
import { fmtMoney } from "./money.js";
import { CATEGORY_FAMILY } from "./categories.js";

const MIN = 60000;

// --- Words and numbers ---------------------------------------------------------

const b = (s) => `**${s}**`;

// What you typed can't open or close the bold.
const clean = (s) => String(s ?? "").replace(/\*/g, "").trim();

export function andList(items) {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);
const times = (n) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const sum = (values) => values.reduce((a, v) => a + (Number(v) || 0), 0);
const mean = (values) => (values.length ? sum(values) / values.length : null);

// Whole hours from ten up; hours and minutes below that.
export function fmtHours(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m >= 600) return `${Math.round(m / 60)}\u00a0h`;
  return fmtDuration(m);
}

const money = (v) => fmtMoney(v, { round: true });

export const weekdayName = (date) => parseDateStr(date).toLocaleDateString("en-US", { weekday: "long" });

// Minutes after midnight → "4:34 am".
export function clockText(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return fmtClock(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`, { ampm: true });
}

const clockOf = (d) => clockText(d.getHours() * 60 + d.getMinutes());
const dayMinutes = (d) => d.getHours() * 60 + d.getMinutes();

// A clock that runs on past midnight, so 12:16 am (24:16) is later than
// 11:40 pm, not earlier.
const nightMinutes = (d) => {
  const m = dayMinutes(d);
  return m < 12 * 60 ? m + 1440 : m;
};

// The same clock for waking: any time before the evening is the morning
// after, so a late 1:10 pm still sits below 9:10 am.
const wakeMinutes = (d) => {
  const m = dayMinutes(d);
  return m < 18 * 60 ? m + 1440 : m;
};

// "an 8:00 pm target", "a 9:00 pm target".
const article = (text) => (/^(8|11|18)\b|^8:/.test(text) ? "an" : "a");

// The reasons offered as chips read lower-case inside a sentence; anything
// you typed yourself stays as you wrote it.
const KNOWN_WORDS = new Set([...DEFAULT_REASONS, ...STRESS_SOURCES].map((r) => r.toLowerCase()));
const inSentence = (text) => {
  const t = clean(text);
  return KNOWN_WORDS.has(t.toLowerCase()) ? t.toLowerCase() : t;
};

// Each row's count by a key, case aside: [[label, count], …], most first.
function countBy(rows, keyOf) {
  const map = new Map();
  for (const r of rows) {
    const label = clean(keyOf(r));
    if (!label) continue;
    const k = label.toLowerCase();
    const hit = map.get(k) ?? [label, 0];
    hit[1] += 1;
    map.set(k, hit);
  }
  return [...map.values()].sort((a, b2) => b2[1] - a[1] || a[0].localeCompare(b2[0]));
}

const isExample = (row) => Boolean(row?.is_example);
const minutesOf = (e) => Math.max(0, Number(e.duration_minutes) || 0);

// --- The week ---------------------------------------------------------------------

export function weekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

// The week the mirror opens on: the last whole one, which ended on the
// Saturday before today (on a Sunday, yesterday).
export function lastWeekStart(today) {
  return addDays(today, -parseDateStr(today).getDay() - 7);
}

// A category's family from your own categories (marked as work counts as
// Work), falling back to the app's defaults.
export function familyLookup(categories) {
  const map = new Map();
  for (const c of categories ?? []) {
    const fam = c.is_work ? "Work" : c.family;
    if (fam) map.set(String(c.name).toLowerCase(), fam);
  }
  return (name) => map.get(String(name ?? "").toLowerCase()) ?? CATEGORY_FAMILY[name] ?? "Other";
}

// --- Nights and mornings -------------------------------------------------------------

function lengthOf(e) {
  const d = Number(e.duration_minutes);
  if (Number.isFinite(d) && d > 0) return d;
  return Math.max(0, (new Date(e.ended_at) - new Date(e.started_at)) / MIN);
}

// Each day's night: the sleep before it, from noon the day before to noon
// that day, never a nap. The longest stretch that began in the evening or
// the small hours (6 pm to 5 am) is the night itself: lights out when it
// began, woke when it ended. Sleep that starts after that is going back to
// sleep, and every stretch counts toward the hours. What you answered in
// the morning check-in (woke at, lights out, snoozed) wins over the timers.
export function nightsOf(days, sleepEntries, plansByDate = {}) {
  const sleeps = (sleepEntries ?? []).filter((e) => e.ended_at && !isExample(e) && isSleep(e) && !isNap(e));
  return days.map((date) => {
    const [y, m, d] = date.split("-").map(Number);
    const from = new Date(y, m - 1, d - 1, 12);
    const to = new Date(y, m - 1, d, 12);
    const parts = sleeps.filter((e) => {
      const s = new Date(e.started_at);
      return s >= from && s < to;
    });
    const atNight = parts.filter((e) => {
      const h = new Date(e.started_at).getHours();
      return h >= 18 || h < 5;
    });
    const main = atNight.reduce((best, e) => (!best || lengthOf(e) > lengthOf(best) ? e : best), null);
    const plan = plansByDate[date] ?? null;

    const lightsOut = plan?.lights_out_at ? new Date(plan.lights_out_at) : main ? new Date(main.started_at) : null;
    const woke = plan?.woke_at ? new Date(plan.woke_at) : main ? new Date(main.ended_at) : null;
    const night = lightsOut && woke && woke > lightsOut ? (woke - lightsOut) / MIN : null;
    const others = parts.filter((e) => e !== main);
    const back = woke ? others.some((e) => new Date(e.started_at) >= woke) : false;

    return {
      date,
      lightsOut,
      woke,
      sleepMinutes: night == null ? null : night + sum(others.map(lengthOf)),
      backToSleep: plan?.snoozed === true || back,
    };
  });
}

// An alarm at 5:00 or before makes an early day.
export const EARLY_BY = 5 * 60;

// "Up at 4:30", "Wake up at 4:30am" → "04:30".
export function wakeHabitTime(label) {
  const m = String(label ?? "").match(/\b(?:up|wake|woke|awake)\b\D{0,12}?(\d{1,2})[:.](\d{2})/i);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

// "Up at 4:30", "Up on time", "Wake up early": the habit of getting up.
export const isWakeHabit = (label) => /^\s*(?:get\s+)?(?:up|wake|woke|awake)\b/i.test(String(label ?? ""));

function logsOn(winLosses, date) {
  return (winLosses ?? []).filter((w) => !isExample(w) && toDateStr(new Date(w.occurred_at)) === date);
}

// Which days started early, each with its alarm and the minute "up" was
// due: the alarm set for that day when it's 5:00 or before, or, on a day
// with no alarm set, a wake-up habit logged that day that names such a time
// ("Up at 4:30"). Up is due fifteen minutes after the alarm, unless a
// watched habit for that alarm says otherwise.
export function earlyDaysOf(days, plansByDate = {}, winLosses = [], watched = []) {
  const out = {};
  for (const date of days) {
    const set = plansByDate[date]?.alarm_at ? String(plansByDate[date].alarm_at).slice(0, 5) : null;
    let alarm = null;
    if (set) {
      if (clockMinutes(set) <= EARLY_BY) alarm = set;
    } else {
      alarm =
        logsOn(winLosses, date)
          .map((w) => wakeHabitTime(w.habit_label))
          .find((t) => t && clockMinutes(t) <= EARLY_BY) ?? null;
    }
    if (!alarm) continue;
    const habit = (watched ?? []).find((h) => h.active !== false && h.on_alarm && clockMinutes(h.on_alarm) === clockMinutes(alarm));
    out[date] = { alarm, due: habit?.due_by ? clockMinutes(habit.due_by) : clockMinutes(alarm) + 15 };
  }
  return out;
}

// How each early day went: a wake-up habit logged that day decides it (a
// win kept it, a miss missed it; the latest one counts); with nothing
// logged, when you woke against the minute up was due. Unknown otherwise.
export function wakeOutcomes(early, nights, winLosses) {
  const out = {};
  for (const [date, e] of Object.entries(early)) {
    const logs = logsOn(winLosses, date)
      .filter((w) => isWakeHabit(w.habit_label))
      .sort((a, z) => new Date(z.occurred_at) - new Date(a.occurred_at));
    const night = nights.find((n) => n.date === date);
    if (logs[0]) out[date] = { kept: logs[0].kind === "win", reason: logs[0].kind === "loss" ? clean(logs[0].reason) || null : null };
    else if (night?.woke) out[date] = { kept: dayMinutes(night.woke) <= e.due, reason: null };
    else out[date] = { kept: null, reason: null };
  }
  return out;
}

// "4:30 days" when every early day had the same alarm, else "early days".
function earlyLabel(early, dates) {
  const alarms = [...new Set(dates.filter((d) => early[d]).map((d) => early[d].alarm))];
  return alarms.length === 1 ? `${fmtClock(alarms[0])} days` : "early days";
}

export function mornings({ days, nights, early, outcomes, upTo }) {
  const past = days.filter((d) => d <= upTo);
  const nightOf = (d) => nights.find((n) => n.date === d) ?? {};
  const earlyDates = past.filter((d) => early[d]);
  const alarms = [...new Set(earlyDates.map((d) => early[d].alarm))];
  const sameAlarm = alarms.length === 1 ? alarms[0] : null;
  const label = earlyLabel(early, earlyDates);
  const lines = [];

  const known = earlyDates.filter((d) => outcomes[d]?.kept != null);
  if (known.length) {
    const kept = known.filter((d) => outcomes[d].kept).length;
    const dues = [...new Set(known.map((d) => early[d].due))];
    const by = dues.length === 1 ? `up by ${b(clockText(dues[0]))}` : "up on time";
    lines.push(`You were ${by} on ${b(`${kept} of ${known.length}`)} early ${plural(known.length, "day")}.`);
    const missed = known.filter((d) => !outcomes[d].kept);
    if (missed.length) {
      const said = missed.map((d) => {
        const n = nightOf(d);
        const why = [
          outcomes[d].reason && inSentence(outcomes[d].reason),
          n.lightsOut && `lights out ${clockOf(n.lightsOut)}`,
          n.backToSleep && "went back to sleep",
        ].filter(Boolean);
        return why.length ? `${weekdayName(d)} (${why.join(", ")})` : weekdayName(d);
      });
      lines.push(`Missed on ${andList(said)}.`);
    }
  }

  const wakes = past.map((d) => nightOf(d).woke).filter(Boolean).map(dayMinutes);
  if (wakes.length >= 2) {
    const lo = Math.min(...wakes);
    const hi = Math.max(...wakes);
    lines.push(lo === hi ? `You woke at ${b(clockText(lo))} each morning.` : `Wake times ran from ${b(clockText(lo))} to ${b(clockText(hi))}.`);
  }

  const outs = past.map((d) => nightOf(d).lightsOut).filter(Boolean).map(nightMinutes);
  if (outs.length >= 2) {
    const lo = Math.min(...outs);
    const hi = Math.max(...outs);
    lines.push(lo === hi ? `Lights out was ${b(clockText(lo))} each night.` : `Lights out ran from ${b(clockText(lo))} to ${b(clockText(hi))}.`);
  }

  // Against the lights-out the evening sets for an early alarm.
  const earlyOuts = earlyDates.map((d) => nightOf(d).lightsOut).filter(Boolean).map(nightMinutes);
  if (sameAlarm && earlyOuts.length) {
    const target = clockText(clockMinutes(sameAlarm) - SLEEP_HOURS * 60);
    lines.push(`Before ${label}, lights out averaged ${b(clockText(mean(earlyOuts)))}, against ${article(target)} ${target} target.`);
  }

  const slept = (dates) => dates.map((d) => nightOf(d).sleepMinutes).filter((m) => m != null);
  const onEarly = slept(earlyDates);
  const onOthers = slept(past.filter((d) => !early[d]));
  if (onEarly.length && onOthers.length) {
    lines.push(`On ${label} you slept ${b(fmtDuration(mean(onEarly)))}. On the others, ${b(fmtDuration(mean(onOthers)))}.`);
  } else if (onEarly.length + onOthers.length) {
    lines.push(`You slept ${b(fmtDuration(mean([...onEarly, ...onOthers])))} a night.`);
  }

  const back = past.filter((d) => nightOf(d).backToSleep).length;
  if (back) lines.push(back === 1 ? "One morning you went back to sleep after waking." : `You went back to sleep after waking on ${b(back)} mornings.`);

  // Named by the evening they began: the night before Sunday is Saturday night.
  const untracked = past.filter((d) => nightOf(d).sleepMinutes == null);
  if (untracked.length && untracked.length < past.length) {
    const names = untracked.map((d) => weekdayName(addDays(d, -1)));
    lines.push(`${andList(names)} ${plural(names.length, "night has", "nights have")} no sleep tracked.`);
  } else if (untracked.length && lines.length) {
    lines.push("No sleep was tracked this week.");
  }

  if (!lines.length) return null;
  return {
    key: "mornings",
    title: "Sleep and mornings",
    lines,
    // Each morning's night as it lay on the clock (lights out to awake, in
    // minutes on the running night clock), with the alarm on early days.
    chart: {
      alarm: sameAlarm,
      points: days.map((d) => {
        const n = d <= upTo ? nightOf(d) : {};
        return {
          date: d,
          out: n.lightsOut ? nightMinutes(n.lightsOut) : null,
          wake: n.woke ? wakeMinutes(n.woke) : null,
          alarm: early[d] ? clockMinutes(early[d].alarm) + 1440 : null,
        };
      }),
    },
  };
}

// --- Work ----------------------------------------------------------------------------

// Work time against the weekly target, deep and shallow, by client, and on
// early days against the other workdays (Sunday isn't one).
export function workWeek({ days, entries, familyOf, targets = [], early = {}, upTo }) {
  const done = (entries ?? []).filter((e) => e.ended_at && !isExample(e));
  const work = done.filter((e) => tagsOf(e).some((t) => familyOf(t) === "Work"));
  const total = sum(work.map(minutesOf));
  if (!total) return null;
  const deep = sum(work.filter((e) => e.depth === "deep").map(minutesOf));
  const shallow = sum(work.filter((e) => e.depth === "shallow").map(minutesOf));
  const unmarked = total - deep - shallow;
  const lines = [];

  // A target's week: as set for a weekly one, and as the database counts it
  // for a daily one (each working day, or every night).
  const weekly = (t) => Number(t.weekly_minutes ?? (t.period === "week" ? t.minutes : 0)) || 0;
  const said = new Set();
  for (const t of (targets ?? []).filter((x) => x.active !== false && weekly(x) > 0 && (x.categories ?? []).some((c) => familyOf(c) === "Work"))) {
    const names = new Set(t.categories.map((c) => String(c).toLowerCase()));
    const got = sum(done.filter((e) => tagsOf(e).some((x) => names.has(String(x).toLowerCase()))).map(minutesOf));
    lines.push(`${clean(t.label)} got ${b(fmtHours(got))} of its ${fmtHours(weekly(t))}.`);
    said.add(fmtHours(got));
  }

  if (deep + shallow > 0) {
    const rest = unmarked >= 30 ? ` (${fmtHours(unmarked)} not marked)` : "";
    lines.push(`Of ${b(fmtHours(total))} of work, ${b(fmtHours(deep))} went to deep work and ${b(fmtHours(shallow))} to shallow${rest}.`);
  } else if (!said.has(fmtHours(total))) {
    // Only when it says something the target line didn't.
    lines.push(`${b(fmtHours(total))} of work in all.`);
  }

  const byClient = new Map();
  for (const e of work) {
    const c = clientOfEntry(e);
    if (c) byClient.set(c, (byClient.get(c) ?? 0) + minutesOf(e));
  }
  if (byClient.size === 1) {
    const [[c, m]] = [...byClient.entries()];
    lines.push(`${clean(c)} had ${b(fmtHours(m))} of it.`);
  } else if (byClient.size) {
    const list = [...byClient.entries()].sort((x, y) => y[1] - x[1]).map(([c, m]) => `${clean(c)} ${b(fmtHours(m))}`);
    lines.push(`By client: ${andList(list)}.`);
  }

  const byDay = new Map(days.map((d) => [d, { deep: 0, shallow: 0, other: 0 }]));
  for (const e of work) {
    const row = byDay.get(toDateStr(new Date(e.started_at)));
    if (row) row[e.depth === "deep" ? "deep" : e.depth === "shallow" ? "shallow" : "other"] += minutesOf(e);
  }
  const workdays = days.filter((d) => d <= upTo && parseDateStr(d).getDay() !== 0);
  const onEarly = workdays.filter((d) => early[d]);
  const onOthers = workdays.filter((d) => !early[d]);
  if (onEarly.length && onOthers.length) {
    const avg = (dates) => mean(dates.map((d) => {
      const r = byDay.get(d);
      return r.deep + r.shallow + r.other;
    }));
    lines.push(`On ${earlyLabel(early, onEarly)} you worked ${b(fmtDuration(avg(onEarly)))} a day; on other workdays, ${b(fmtDuration(avg(onOthers)))}.`);
  }

  return { key: "work", title: "Work", lines, chart: { days: days.map((d) => ({ date: d, ...byDay.get(d) })) } };
}

// --- People ----------------------------------------------------------------------------

const shortCategory = (c) => clean(c).replace(/\s*\([^)]*\)\s*$/, "");

// Time with people, who it was with (the names you picked when a timer
// stopped), and how it felt. With no names picked yet, the kinds of time.
export function peopleWeek({ entries, familyOf }) {
  const list = (entries ?? []).filter((e) => e.ended_at && !isExample(e) && tagsOf(e).some((t) => familyOf(t) === "People"));
  const total = sum(list.map(minutesOf));
  if (!total) return null;
  const lines = [`${b(fmtHours(total))} with people, across ${b(list.length)} ${plural(list.length, "stretch", "stretches")}.`];

  const who = new Map();
  for (const e of list) {
    for (const p of e.people ?? []) {
      const name = clean(p);
      if (!name) continue;
      const k = name.toLowerCase();
      const row = who.get(k) ?? { name, minutes: 0 };
      row.minutes += minutesOf(e);
      who.set(k, row);
    }
  }
  if (who.size) {
    // "Most of it" only when the names you picked cover most of the time.
    const named = sum(list.filter((e) => (e.people ?? []).some((p) => clean(p))).map(minutesOf));
    const top = [...who.values()].sort((x, y) => y.minutes - x.minutes).slice(0, 3);
    const names = andList(top.map((p) => `${b(p.name)} (${fmtHours(p.minutes)})`));
    lines.push(named * 2 >= total ? `Most of it was with ${names}.` : `Where you noted who: ${names}.`);
  } else {
    const byKind = new Map();
    for (const e of list) {
      const t = shortCategory(tagsOf(e).find((x) => familyOf(x) === "People"));
      byKind.set(t, (byKind.get(t) ?? 0) + minutesOf(e));
    }
    const top = [...byKind.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3);
    lines.push(`Mostly ${andList(top.map(([k, m]) => `${k} (${b(fmtHours(m))})`))}.`);
  }

  const rated = list.filter((e) => e.people_feel);
  if (rated.length) {
    const n = (v) => rated.filter((e) => e.people_feel === v).length;
    const feels = [
      n("life_giving") && `${b(n("life_giving"))} felt life-giving`,
      n("neutral") && `${b(n("neutral"))} neutral`,
      n("draining") && `${b(n("draining"))} draining`,
    ].filter(Boolean);
    if (rated.length === 1) {
      const only = { life_giving: "life-giving", neutral: "neutral", draining: "draining" }[rated[0].people_feel];
      if (only) lines.push(`The one you rated felt ${b(only)}.`);
    } else {
      lines.push(`Of the ${rated.length} you rated, ${andList(feels)}.`);
    }
  }
  return { key: "people", title: "People", lines };
}

// --- Wins and misses -------------------------------------------------------------------

const UNNAMED = new Set(["", "win", "loss"]);

export function missesWeek({ winLosses }) {
  const rows = (winLosses ?? []).filter((w) => !isExample(w));
  const wins = rows.filter((w) => w.kind === "win").length;
  const losses = rows.filter((w) => w.kind === "loss");
  if (!wins && !losses.length) return null;
  const lines = [];
  if (losses.length) {
    lines.push(`${b(wins)} ${plural(wins, "win")} and ${b(losses.length)} ${plural(losses.length, "miss", "misses")} logged.`);
    // A miss tapped without a name is saved as "Loss".
    const named = losses.filter((w) => !UNNAMED.has(clean(w.habit_label).toLowerCase()));
    const unnamed = losses.length - named.length;
    if (named.length) {
      const byHabit = countBy(named, (w) => w.habit_label);
      const top = byHabit.slice(0, 3).map(([label, n]) => `${label} ${times(n)}`);
      const more = byHabit.length - top.length;
      const extra = [more && `${more} ${plural(more, "other")}`, unnamed && `${unnamed} without a name`].filter(Boolean);
      lines.push(`Missed: ${andList(top)}${extra.length ? `, and ${andList(extra)}` : ""}.`);
    } else {
      lines.push(unnamed === 1 ? "It was logged without a name." : `${unnamed === 2 ? "Both were" : `All ${unnamed} were`} logged without a name.`);
    }
    const reasons = countBy(losses.filter((w) => w.reason), (w) => w.reason);
    if (reasons.length) {
      lines.push(`Reasons you gave: ${andList(reasons.slice(0, 3).map(([r, n]) => (n > 1 ? `${inSentence(r)} (${n})` : inSentence(r))))}.`);
    }
  } else {
    lines.push(`${b(wins)} ${plural(wins, "win")} logged, and no misses.`);
  }
  return { key: "misses", title: "Wins and misses", lines };
}

// --- Mood and energy -----------------------------------------------------------------------

export function moodWeek({ days, plansByDate, upTo }) {
  const past = days.filter((d) => d <= upTo).map((d) => ({ date: d, plan: plansByDate[d] })).filter((r) => r.plan);
  const moods = past.filter((r) => r.plan.mood != null);
  const energies = past.filter((r) => r.plan.energy);
  const stresses = past.filter((r) => r.plan.stress != null);
  if (!moods.length && !energies.length && !stresses.length) return null;
  const lines = [];

  if (moods.length) {
    const vals = moods.map((r) => Number(r.plan.mood));
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    if (moods.length === 1) lines.push(`Mood was ${b(lo)} on ${weekdayName(moods[0].date)}, the one day you rated it.`);
    else if (lo === hi) lines.push(`Mood was ${b(lo)} on each of the ${moods.length} days you rated it.`);
    else lines.push(`Mood ran from ${b(lo)} to ${b(hi)}, lowest on ${weekdayName(moods.find((r) => Number(r.plan.mood) === lo).date)}.`);
  }

  if (energies.length) {
    const n = (v) => energies.filter((r) => r.plan.energy === v).length;
    const parts = ["high", "okay", "low"].filter((v) => n(v)).map((v, i) => `${v} on ${b(n(v))}${i === 0 ? ` ${plural(n(v), "day")}` : ""}`);
    lines.push(`Energy was ${andList(parts)}.`);
  }

  if (stresses.length) {
    const top = stresses.reduce((a, r) => (Number(r.plan.stress) > Number(a.plan.stress) ? r : a));
    const from = top.plan.stress_source ? `, from ${inSentence(top.plan.stress_source)}` : "";
    lines.push(`Stress was highest on ${weekdayName(top.date)}, at ${b(top.plan.stress)}${from}.`);
  }

  return {
    key: "mood",
    title: "Mood and energy",
    lines,
    chart: {
      points: days.map((d) => {
        const p = d <= upTo ? plansByDate[d] : null;
        return { date: d, mood: p?.mood != null ? Number(p.mood) : null, energy: p?.energy ?? null };
      }),
    },
  };
}

// --- Focus goals ------------------------------------------------------------------------

export function focusMirror({ goals, checkins, weekStart }) {
  if (!(goals ?? []).length) return null;
  const week = summarizeWeek(goals, checkins, weekStart);
  const moved = sum(week.map((g) => g.movedDays));
  const answered = sum(week.map((g) => g.answeredDays));
  const lines = [
    answered
      ? `Your focus goals moved on ${b(`${moved} of ${answered}`)} ${plural(answered, "check-in")}.`
      : goals.length === 1
        ? "Your focus goal has no check-ins this week."
        : `Your ${goals.length} focus goals have no check-ins this week.`,
  ];
  return {
    key: "focus",
    title: "Focus goals",
    lines,
    goals: week.map((g) => ({ id: g.id, title: clean(g.title), days: g.days, movedDays: g.movedDays, answeredDays: g.answeredDays })),
  };
}

// --- Money ------------------------------------------------------------------------------------

// The week's spending (what it went to, how much was impulse, what's still
// to sort, the business side), and each budget as it stood when the week
// ended: the month's spending against its limit. `upTo` is the last day
// counted; the month is the one it falls in.
export function moneyWeek({ txns, budgets, weekStart, upTo }) {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${addDays(upTo, 1)}T00:00:00`);
  const monthStart = new Date(`${startOfMonth(upTo)}T00:00:00`);
  const spend = (txns ?? []).filter((t) => Number(t.amount) < 0 && !t.is_transfer);
  const between = (t, from) => {
    const p = new Date(t.posted_at);
    return p >= from && p < end;
  };
  const week = spend.filter((t) => between(t, start));
  const personal = week.filter((t) => !t.is_business);
  const out = (rows) => sum(rows.map((t) => -Number(t.amount)));
  const total = out(personal);
  const business = out(week.filter((t) => t.is_business));

  const names = new Map((budgets ?? []).map((g) => [g.id, clean(g.name)]));
  const rows = (budgets ?? [])
    .filter((g) => !g.archived && Number(g.monthly_limit) > 0)
    .map((g) => ({
      id: g.id,
      name: clean(g.name),
      limit: Number(g.monthly_limit),
      spent: out(spend.filter((t) => t.budget_id === g.id && between(t, monthStart))),
    }))
    .filter((r) => r.spent > 0);
  if (!total && !business && !rows.length) return null;

  const lines = [];
  if (total) {
    // What it went to: the budget, else the kind of purchase. Purchases
    // not sorted yet have their own line below.
    const groups = new Map();
    for (const t of personal) {
      const g = (t.budget_id && names.get(t.budget_id)) || clean(t.purchase_kind) || (t.reviewed_at ? "Other" : null);
      if (g) groups.set(g, (groups.get(g) ?? 0) + -Number(t.amount));
    }
    const top = [...groups.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2);
    lines.push(`You spent ${b(money(total))}${top.length ? `, most on ${andList(top.map(([g, v]) => `${g} (${money(v)})`))}` : ""}.`);
    const impulse = out(personal.filter((t) => t.intent === "impulse"));
    if (impulse > 0) lines.push(`${b(money(impulse))} of it was impulse.`);
  }
  const unsorted = week.filter((t) => !t.reviewed_at);
  if (unsorted.length) {
    lines.push(`${b(unsorted.length)} ${plural(unsorted.length, "purchase")} (${money(out(unsorted))}) ${plural(unsorted.length, "is", "are")} still to sort.`);
  }
  if (business > 0) lines.push(`Business spending: ${b(money(business))}.`);

  const month = parseDateStr(upTo).toLocaleDateString("en-US", { month: "long" });
  // Where the month stood when the week ended, for the marker on each bar.
  const [y, m, d] = upTo.split("-").map(Number);
  const progress = d / new Date(y, m, 0).getDate();
  return { key: "money", title: "Money", lines, budgets: rows, month, asOf: upTo, progress };
}

// --- Body and practice ------------------------------------------------------------------------

const fmtWeight = (v) => String(Math.round(Number(v) * 10) / 10);

// One point a day (the day's last reading), oldest first.
export function weightTrend(readings) {
  const byDay = new Map();
  for (const w of [...(readings ?? [])].sort((x, y) => new Date(x.measured_at) - new Date(y.measured_at))) {
    if (isExample(w) || !(Number(w.value) > 0)) continue;
    byDay.set(String(w.date ?? toDateStr(new Date(w.measured_at))).slice(0, 10), Number(w.value));
  }
  return [...byDay.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([date, value]) => ({ date, value }));
}

// The week's temple visits, workouts, study and naps, and its weigh-ins,
// with the weight's trend over the weeks before (`trend`) when the week
// had a weigh-in to add to it.
export function practiceWeek({ entries, weights, trend = [] }) {
  const s = practiceSummary((entries ?? []).filter((e) => e.ended_at));
  const parts = [];
  if (s.templeVisits) parts.push(`${b(s.templeVisits)} temple ${plural(s.templeVisits, "visit")}`);
  if (s.exercise.total) {
    const kinds = [
      s.exercise.run && `${s.exercise.run} ${plural(s.exercise.run, "run")}`,
      s.exercise.gym && `${s.exercise.gym} gym`,
      s.exercise.other && `${s.exercise.other} other`,
    ].filter(Boolean);
    parts.push(`${b(s.exercise.total)} ${plural(s.exercise.total, "workout")}${kinds.length ? ` (${kinds.join(", ")})` : ""}`);
  }
  if (s.study.sessions) {
    const awake = [s.study.alert && `${s.study.alert} alert`, s.study.drowsy && `${s.study.drowsy} drowsy`].filter(Boolean);
    parts.push(`${b(s.study.sessions)} study ${plural(s.study.sessions, "session")}${awake.length ? ` (${awake.join(", ")})` : ""}`);
  }
  if (s.naps.count) parts.push(`${b(s.naps.count)} ${plural(s.naps.count, "nap")}`);

  const lines = [];
  if (parts.length) lines.push(`${andList(parts)}.`);
  const ws = (weights ?? [])
    .filter((w) => !isExample(w) && Number(w.value) > 0)
    .sort((x, y) => new Date(x.measured_at) - new Date(y.measured_at));
  if (ws.length === 1) lines.push(`Weighed in at ${b(`${fmtWeight(ws[0].value)} lb`)}.`);
  else if (ws.length > 1) {
    const first = Number(ws[0].value);
    const last = Number(ws[ws.length - 1].value);
    lines.push(
      Math.round((last - first) * 10) === 0
        ? `Weight held at ${b(`${fmtWeight(last)} lb`)} across ${ws.length} weigh-ins.`
        : `Weight went from ${fmtWeight(first)} to ${b(`${fmtWeight(last)} lb`)} across ${ws.length} weigh-ins.`
    );
  }
  if (!lines.length) return null;
  const points = ws.length ? weightTrend(trend) : [];
  return { key: "practice", title: "Body and practice", lines, chart: points.length >= 2 ? { weights: points } : null };
}

// --- What the watch measured ---------------------------------------------------------------

// Supporting numbers from the Apple Watch (health_days), in a line or two:
// nights the watch saw and their average, the deep and REM in them, steps,
// resting heart rate and HRV, mindful minutes. Workouts already count in
// "Body and practice" (each one is an Exercise entry), so they aren't
// repeated here. Nothing is compared against a target.
export function watchWeek({ healthDays, days, upTo }) {
  const rows = (healthDays ?? []).filter((h) => {
    const d = String(h.date).slice(0, 10);
    return d >= days[0] && d <= upTo;
  });
  if (!rows.length) return null;
  const vals = (col) => rows.map((r) => r[col]).filter((v) => v != null && Number(v) > 0).map(Number);
  const lines = [];

  const slept = vals("asleep_min");
  if (slept.length) {
    const deep = vals("deep_min");
    const rem = vals("rem_min");
    const stages = deep.length && rem.length ? `, about ${b(fmtHours(mean(deep)))} deep and ${b(fmtHours(mean(rem)))} REM a night` : "";
    lines.push(`The watch saw ${b(slept.length)} ${plural(slept.length, "night")}, averaging ${b(fmtHours(mean(slept)))} asleep${stages}.`);
  }

  const parts = [];
  const steps = vals("steps");
  if (steps.length) parts.push(`${b(Math.round(mean(steps)).toLocaleString("en-US"))} steps a day`);
  const rhr = vals("resting_hr");
  if (rhr.length) parts.push(`resting heart rate ${b(Math.round(mean(rhr)))}`);
  const hrv = vals("hrv_ms");
  if (hrv.length) parts.push(`HRV ${b(`${Math.round(mean(hrv))} ms`)}`);
  if (parts.length) lines.push(`${andList(parts).replace(/^[a-z]/, (c) => c.toUpperCase())}.`);

  const mindful = vals("mindful_min");
  if (mindful.length) lines.push(`${b(fmtHours(sum(mindful)))} mindful.`);

  if (!lines.length) return null;
  return { key: "watch", title: "From your watch", lines };
}

// --- The whole mirror ---------------------------------------------------------------------------

// Every part for one week, in the order it reads best: the nights and
// mornings first, then work and people, the misses, how the days felt, the
// focus goals, money, and the body. A week still under way is counted up to
// today.
export function buildMirror({
  weekStart,
  today,
  dayPlans,
  entries,
  winLosses,
  watched,
  goals,
  checkins,
  txns,
  budgets,
  targets,
  categories,
  weights,
  healthDays,
}) {
  const days = weekDates(weekStart);
  const upTo = today >= days[6] ? days[6] : today;
  const plansByDate = Object.fromEntries(
    (dayPlans ?? []).filter((p) => !isExample(p)).map((p) => [String(p.date).slice(0, 10), p])
  );
  const familyOf = familyLookup(categories);
  const all = (entries ?? []).filter((e) => !isExample(e));
  const inWeek = all.filter((e) => {
    const d = toDateStr(new Date(e.started_at));
    return d >= days[0] && d <= upTo;
  });
  const wl = (winLosses ?? []).filter((w) => {
    const d = toDateStr(new Date(w.occurred_at));
    return !isExample(w) && d >= days[0] && d <= upTo;
  });
  // The weigh-ins can reach back a few weeks, for the trend.
  const weighDate = (w) => String(w.date ?? toDateStr(new Date(w.measured_at))).slice(0, 10);
  const readings = (weights ?? []).filter((w) => !isExample(w) && weighDate(w) <= upTo);
  const weekWeights = readings.filter((w) => weighDate(w) >= days[0]);

  const nights = nightsOf(days, all, plansByDate);
  const early = earlyDaysOf(days.filter((d) => d <= upTo), plansByDate, wl, watched);
  const outcomes = wakeOutcomes(early, nights, wl);

  const sections = [
    mornings({ days, nights, early, outcomes, upTo }),
    workWeek({ days, entries: inWeek, familyOf, targets, early, upTo }),
    peopleWeek({ entries: inWeek, familyOf }),
    missesWeek({ winLosses: wl }),
    moodWeek({ days, plansByDate, upTo }),
    focusMirror({ goals, checkins, weekStart }),
    moneyWeek({ txns, budgets, weekStart, upTo }),
    practiceWeek({ entries: inWeek, weights: weekWeights, trend: readings }),
    watchWeek({ healthDays, days, upTo }),
  ].filter(Boolean);

  return { weekStart, days, upTo, current: upTo < days[6], sections };
}

// A line of mirror text as pieces: [{ text, bold }].
export function pieces(line) {
  return String(line)
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((p) => (p.startsWith("**") && p.endsWith("**") ? { text: p.slice(2, -2), bold: true } : { text: p, bold: false }));
}

// The Sunday line on Today goes once the week has been looked at (or put
// away). Kept on this device only; a cleared browser just shows it again.
const seenKey = (weekStart) => `hub.mirror-seen.${weekStart}`;

export function mirrorSeen(weekStart) {
  try {
    return localStorage.getItem(seenKey(weekStart)) === "1";
  } catch (err) {
    console.warn(err);
    return false;
  }
}

export function markMirrorSeen(weekStart) {
  try {
    localStorage.setItem(seenKey(weekStart), "1");
  } catch (err) {
    console.warn(err);
  }
}
