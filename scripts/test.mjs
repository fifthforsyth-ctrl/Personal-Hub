#!/usr/bin/env node
//
// The pure logic, tested. Run with: npm test
//
// Only the parts that are genuinely tricky and genuinely pure: anchoring a
// highlight back into text that has been edited under it, and assembling a
// report that goes to another person. Both have been wrong at least once in
// ways a passing build did not catch, which is the entire argument for this
// file existing.

import { resolveHighlights, splitParagraphs, segmentsFor, buildTree, findInSource } from "../src/lib/noteText.js";
import { reportToText, fmtHours } from "../src/lib/workReport.js";
import { fmtMoney, spentOf, merchantTitle, monthProgress, budgetStatus, daysLeftInMonth, kindForBudget } from "../src/lib/money.js";
import { withTaps, waitingTaps, isUnnamed, KEEP_MS } from "../src/components/today/tapRows.js";
import { editableFields, changesFrom, draftOver, draftClashes, draftTime } from "../src/components/study/noteDraft.js";
import { computeDepths, computeMinuteBrightness } from "../src/lib/heat.js";
import {
  resolveRing,
  ringCoverage,
  pointAt,
  arcPath,
  windowPath,
  fmtClock,
  DAY_START_MIN,
  DAY_END_MIN,
  WINDOW_MINUTES,
} from "../src/lib/ring.js";
import { initials, ratedLine, sourceLine, RATINGS } from "../src/lib/quotes.js";
import { answerParts, stillWorking, unanswered, chartResult, ANSWER_GIVES_UP_MS } from "../src/lib/ask.js";
import { boardNotes, verdictOf, USEFUL, NOT_NOW } from "../src/lib/board.js";
import { slug, shelfFor, topShelf, inShelfOrder, shelfState, tiltOf, pinOf, PIN_COLORS, PEOPLE, THEMES, MOODS, corkItems } from "../src/lib/quoteShelves.js";
import { focusWeekOf, summarizeWeek, answerOn, awaitingReview, showsReview, movedLabel, nextPosition, cleanTitle, orderGoals } from "../src/lib/focus.js";

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

console.log("\nhighlight anchoring");

const body = `Everyday missionary work is not a program you run.

It is the ordinary attention you already pay to people, pointed somewhere.

The hardest part is that nobody claps.`;

const quote = "the ordinary attention you already pay to people";
const start = body.indexOf(quote);
const hl = [{ id: "h1", quoted_text: quote, start_offset: start, end_offset: start + quote.length, child_note_id: "c1" }];

ok("exact offsets resolve", resolveHighlights(body, hl)[0].start === start);

const edited = "A NEW OPENING LINE.\n\n" + body;
const shifted = resolveHighlights(edited, hl)[0];
ok("survives an edit above it", !shifted.orphaned && edited.slice(shifted.start, shifted.end) === quote);

ok("orphans when the passage is gone", resolveHighlights(body.replace(quote, "something else"), hl)[0].orphaned === true);
ok("an orphan is still returned", resolveHighlights(body.replace(quote, "something else"), hl).length === 1);

const dup = `${quote} ... filler ... ${quote}`;
const second = dup.lastIndexOf(quote);
ok(
  "a repeated phrase re-anchors to its own instance",
  resolveHighlights(dup, [{ id: "h", quoted_text: quote, start_offset: second, end_offset: second + quote.length }])[0].start === second
);

const paras = splitParagraphs(body);
ok("paragraph offsets are absolute", paras.every((p) => body.slice(p.start, p.end) === p.text));

const resolved = resolveHighlights(body, hl);
ok("segments rebuild each paragraph exactly", paras.every((p) => segmentsFor(p, resolved).map((s) => s.text).join("") === p.text));

const target = paras.find((p) => p.start <= start && p.end >= start + quote.length);
ok("the marked run is exactly the quote", segmentsFor(target, resolved).filter((s) => s.highlight).map((s) => s.text).join("") === quote);

const a = { id: "a", quoted_text: "ordinary attention", start_offset: body.indexOf("ordinary attention"), end_offset: body.indexOf("ordinary attention") + 18 };
const b = { id: "b", quoted_text: "attention you already", start_offset: body.indexOf("attention you already"), end_offset: body.indexOf("attention you already") + 21 };
const overlapPara = paras.find((p) => p.start <= a.start_offset && p.end >= b.end_offset);
ok(
  "overlapping highlights still reconstruct exactly",
  segmentsFor(overlapPara, resolveHighlights(body, [a, b])).map((s) => s.text).join("") === overlapPara.text
);

ok("an empty body doesn't explode", splitParagraphs("").length <= 1 && resolveHighlights("", hl)[0].orphaned === true);

const tree = buildTree([
  { id: "1", parent_note_id: null, position: 0, created_at: "a" },
  { id: "2", parent_note_id: "1", position: 1, created_at: "b" },
  { id: "3", parent_note_id: "1", position: 0, created_at: "c" },
]);
ok("tree roots", (tree.get("__root__") ?? []).length === 1);
ok("children sort by position", tree.get("1").map((n) => n.id).join(",") === "3,2");

console.log("\nfinding a selection back in markdown source");

const md = `## Alma 32

The seed is **good**, but he does not say
you will know at once.

> [!insight] Mine
> The ==experiment== is the point, not the result.

See [[Faith|faith]] for more.`;

ok("exact prose", findInSource(md, "The seed is")?.tier === "exact");
ok("across a source line break", findInSource(md, "he does not say you will know at once.")?.tier === "whitespace");
ok("through **bold**", findInSource(md, "The seed is good, but he does not say")?.tier === "markup");
ok("through ==a highlight==", findInSource(md, "The experiment is the point")?.tier === "markup");
ok("a genuine paraphrase is refused", findInSource(md, "Alma teaches that faith is like a seed") === null);
ok("an empty selection is refused", findInSource(md, "   ") === null);

console.log("\nend-of-day work report");

const work = {
  date: "2026-09-08",
  minutes: 440,
  tasks: [
    { id: "1", title: "Wire address validation", done: true },
    { id: "2", title: "Payment retry logic", done: false, rolled: 2 },
  ],
  notes: [
    { id: "n1", kind: "did", body: "Helped Sam debug the deploy", minutes: 35 },
    { id: "n2", kind: "blocked", body: "Need the staging API key" },
    { id: "n3", kind: "question", body: "Partial refunds — original card or store credit?" },
  ],
  tomorrow: [{ title: "Finish payment retries" }],
};
const text = reportToText(work);

ok("hours are formatted", fmtHours(440) === "7h 20m");
ok("a finished task is listed", text.includes("· Wire address validation"));
ok("unplanned work is listed with its time", text.includes("Helped Sam debug the deploy (35m)"));
ok("a carry-over says how long it has carried", text.includes("carried 2 days"));
ok("a blocker lands under NEED FROM YOU", /NEED FROM YOU[\s\S]*staging API key/.test(text));
ok("a question is marked as one", text.includes("· Q: Partial refunds"));
ok("tomorrow is listed", /TOMORROW[\s\S]*Finish payment retries/.test(text));
ok("an unplanned tomorrow says so", reportToText({ date: "2026-09-08", minutes: 0, tasks: [], notes: [], tomorrow: [] }).includes("(not planned yet)"));
ok("no section is invented when empty", !text.includes("NOTES"));


// ---------------------------------------------------------------------------

console.log("\nwheel brightness from minutes");

// Two pillars, each with two children. Credit is already rolled up by
// goal_credit, so a parent's minutes are the sum of its subtree.
const wNodes = [
  { id: "A" }, { id: "B" },
  { id: "A1" }, { id: "A2" },
  { id: "B1" }, { id: "B2" },
];
const wEdges = [
  { parent_id: "A", child_id: "A1" },
  { parent_id: "A", child_id: "A2" },
  { parent_id: "B", child_id: "B1" },
  { parent_id: "B", child_id: "B2" },
];

const depths = computeDepths(wNodes, wEdges);
ok("roots sit at depth 0", depths.get("A") === 0 && depths.get("B") === 0);
ok("children sit at depth 1", depths.get("A1") === 1 && depths.get("B2") === 1);

const mins = new Map([
  ["A", 600], ["A1", 600], ["A2", 0],
  ["B", 60], ["B1", 30], ["B2", 30],
]);
const bright = computeMinuteBrightness(wNodes, wEdges, mins);

ok("the busiest node in a ring is fully lit", Math.abs(bright.get("A") - 1) < 1e-9, String(bright.get("A")));
ok("the busiest child is fully lit too, though it has a tenth of the root's ring leader",
   Math.abs(bright.get("A1") - 1) < 1e-9, String(bright.get("A1")));
ok("a node with no minutes is unlit", bright.get("A2") < 0.05, String(bright.get("A2")));
ok("a quiet sibling is dim but visible", bright.get("B") > 0.1 && bright.get("B") < 0.45, String(bright.get("B")));
ok("equal siblings light equally", bright.get("B1") === bright.get("B2"));
ok("a node holding a twentieth of its ring's leader stays dim", bright.get("B1") < 0.3, String(bright.get("B1")));

// The whole point of normalizing per ring. Under a single global scale a
// deep node could never be brighter than the root that contains it, so the
// rim would be permanently dark however the week actually went. Here a
// depth-2 leaf leads its own ring and is fully lit, while the root holding
// six times its minutes is no brighter.
const deepNodes = [...wNodes, { id: "A1a" }, { id: "A1b" }];
const deepEdges = [...wEdges, { parent_id: "A1", child_id: "A1a" }, { parent_id: "A1", child_id: "A1b" }];
const deepBright = computeMinuteBrightness(
  deepNodes,
  deepEdges,
  new Map([
    ["A", 660], ["A1", 600], ["A2", 0], ["A1a", 600], ["A1b", 0],
    ["B", 60], ["B1", 30], ["B2", 30],
  ])
);
ok("a depth-2 leaf can be fully lit", Math.abs(deepBright.get("A1a") - 1) < 1e-9, String(deepBright.get("A1a")));
ok("its root, holding more minutes, is no brighter", deepBright.get("A") <= deepBright.get("A1a"));

// A node reachable from no root at all must still resolve rather than throw.
const orphanBright = computeMinuteBrightness(
  [{ id: "X" }, { id: "Y" }],
  [{ parent_id: "X", child_id: "Y" }, { parent_id: "Y", child_id: "X" }],
  new Map([["X", 10], ["Y", 10]])
);
ok("a cycle resolves instead of hanging", orphanBright.size === 2);

// ---------------------------------------------------------------------------

console.log("\nthe day ring");

// The face covers the waking day: 5am just clockwise of twelve o'clock,
// 10pm just anticlockwise of it, with a gap between them.
const [xStart, yStart] = pointAt(50, 50, 40, DAY_START_MIN);
ok("5am sits just past the top, going clockwise", xStart > 50 && yStart < 15, `${xStart.toFixed(1)},${yStart.toFixed(1)}`);
const [xEnd, yEnd] = pointAt(50, 50, 40, DAY_END_MIN);
ok("10pm sits just before the top", xEnd < 50 && yEnd < 15, `${xEnd.toFixed(1)},${yEnd.toFixed(1)}`);
ok("the two ends do not meet", Math.abs(xEnd - xStart) > 4);

// Halfway through the window is the bottom of the circle. That is 1:30pm,
// not noon — the window is not centred on midday and should not pretend to
// be.
const mid = (DAY_START_MIN + DAY_END_MIN) / 2;
const [xMid, yMid] = pointAt(50, 50, 40, mid);
ok("the middle of the waking day is at the bottom", Math.abs(xMid - 50) < 0.01 && yMid > 89, `${xMid.toFixed(1)},${yMid.toFixed(1)}`);

// The morning is the right-hand side, the evening the left.
const [xMorning] = pointAt(50, 50, 40, 8 * 60);
const [xEvening] = pointAt(50, 50, 40, 19 * 60);
ok("8am is on the right", xMorning > 50, String(xMorning));
ok("7pm is on the left", xEvening < 50, String(xEvening));

// Night is outside the window entirely.
ok("an entry wholly before 5am is dropped",
   resolveRing([{ start_min: 0, end_min: 240, category: "Sleep" }]).length === 0);
ok("an entry wholly after 10pm is dropped",
   resolveRing([{ start_min: 1350, end_min: 1440, category: "Prep" }]).length === 0);

// ...but the part of a night that runs into the morning is a fact about the
// day, and is kept.
const overnight = resolveRing([{ start_min: 0, end_min: 7 * 60, category: "Sleep" }]);
ok("a lie-in past 5am is clipped, not dropped", overnight.length === 1, JSON.stringify(overnight));
ok("it starts at the window edge", overnight[0].start_min === DAY_START_MIN);
ok("and ends when you woke", overnight[0].end_min === 7 * 60);

const late = resolveRing([{ start_min: 21 * 60, end_min: 23 * 60 + 30, category: "Study" }]);
ok("an evening running past 10pm is clipped at the far edge", late[0].end_min === DAY_END_MIN);

// A short entry inside a long one is the truer description of those minutes.
const overlapped = resolveRing(
  [
    { start_min: 480, end_min: 720, category: "Work" },
    { start_min: 540, end_min: 570, category: "Exercise" },
  ],
  5
);
ok("an overlap resolves to three runs", overlapped.length === 3, JSON.stringify(overlapped));
ok("the shorter entry wins the contested minutes", overlapped[1].category === "Exercise");
ok("the longer one resumes after it", overlapped[2].category === "Work" && overlapped[2].end_min === 720);

// Touching entries of the same kind must not become a barcode.
const merged = resolveRing([
  { start_min: 6 * 60, end_min: 7 * 60, category: "Study" },
  { start_min: 7 * 60, end_min: 8 * 60, category: "Study" },
]);
ok("adjacent runs of one category merge", merged.length === 1 && merged[0].end_min === 8 * 60);

// Gaps are real and must survive: an unaccounted hour is information.
const gapped = resolveRing([
  { start_min: 6 * 60, end_min: 7 * 60, category: "Study" },
  { start_min: 9 * 60, end_min: 10 * 60, category: "Exercise" },
]);
ok("a gap is left unpainted", gapped.length === 2 && gapped[1].start_min === 9 * 60);
ok("coverage is measured against the waking window, not the clock",
   Math.abs(ringCoverage(gapped) - 120 / WINDOW_MINUTES) < 1e-9, String(ringCoverage(gapped)));

// Two entries covering exactly the same span must not depend on row order.
const tieA = resolveRing([
  { start_min: 6 * 60, end_min: 10 * 60, category: "Sleep" },
  { start_min: 6 * 60, end_min: 10 * 60, category: "Prep" },
]);
const tieB = resolveRing([
  { start_min: 6 * 60, end_min: 10 * 60, category: "Prep" },
  { start_min: 6 * 60, end_min: 10 * 60, category: "Sleep" },
]);
ok("an exact tie resolves the same way whichever order it arrives in",
   tieA.length === 1 && tieB.length === 1 && tieA[0].category === tieB[0].category,
   `${tieA[0]?.category} vs ${tieB[0]?.category}`);

// An entry carrying only tags still colours the ring.
const tagged = resolveRing([{ start_min: 6 * 60, end_min: 7 * 60, tags: ["Prep"] }]);
ok("tags stand in when category is absent", tagged.length === 1 && tagged[0].category === "Prep");

// Arcs sweeping past half the face need the large-arc flag or they draw
// inside out. Half the face is now half of seventeen hours, not of twelve.
const shortArc = arcPath(50, 50, 40, 30, 6 * 60, 9 * 60);
const longArc = arcPath(50, 50, 40, 30, 6 * 60, 20 * 60);
ok("a three-hour arc is not flagged large", shortArc.includes("0 1"), shortArc);
ok("a fourteen-hour arc is", longArc.includes("1 1"), longArc);
ok("an arc entirely outside the window is refused", arcPath(50, 50, 40, 30, 0, 4 * 60) === null);

// The background is the whole window, and must be a real path rather than
// collapsing the way a full circle would.
ok("the window draws as an arc, not a degenerate circle", typeof windowPath(50, 50, 40, 30) === "string");

ok("clock formatting reads as a clock", fmtClock(0) === "12:00am" && fmtClock(720) === "12:00pm" && fmtClock(1385) === "11:05pm",
   `${fmtClock(0)} ${fmtClock(720)} ${fmtClock(1385)}`);

console.log("\nmoney");

ok("spending shows positive", spentOf(-6.45) === 6.45);
ok("a deposit is not spending", spentOf(1800) === 0);
ok("money formats with cents", fmtMoney(1234.5) === "$1,234.50");
ok("money can round", fmtMoney(1234.5, { round: true }) === "$1,235");
ok("nonsense isn't formatted as $NaN", fmtMoney("abc") === "—");

ok("processor prefix and city go", merchantTitle("CARD PURCHASE 09/30 SQ *BLUE BOTTLE COF 1234 DENVER CO") === "Blue Bottle Cof",
   merchantTitle("CARD PURCHASE 09/30 SQ *BLUE BOTTLE COF 1234 DENVER CO"));
ok("order ids go", merchantTitle("AMAZON.COM*AB1CD2EF3 AMZN.COM/BILL WA") === "Amazon.com", merchantTitle("AMAZON.COM*AB1CD2EF3 AMZN.COM/BILL WA"));
ok("an unparseable description survives", merchantTitle("*** ") !== "");

ok("month progress mid-month", Math.abs(monthProgress(new Date(2026, 8, 15)) - 0.5) < 0.001);
ok("month progress last day is 1", monthProgress(new Date(2026, 8, 30)) === 1);

ok("$300 of $400 on the 28th is fine", budgetStatus({ spent: 300, limit: 400 }, 28 / 30).state === "fine");
ok("$300 of $400 on the 9th is ahead", budgetStatus({ spent: 300, limit: 400 }, 9 / 30).state === "ahead");
ok("$380 of $400 is close", budgetStatus({ spent: 380, limit: 400 }, 0.95).state === "close");
ok("$410 of $400 is over", budgetStatus({ spent: 410, limit: 400 }, 0.5).state === "over");
ok("over reports a negative remainder", budgetStatus({ spent: 410, limit: 400 }, 0.5).remaining === -10);
ok("a quarter gone on the 2nd is still fine", budgetStatus({ spent: 112, limit: 400 }, 2 / 31).state === "fine");
ok("most of it gone on the 2nd is ahead", budgetStatus({ spent: 97, limit: 120 }, 2 / 31).state === "ahead");
ok("no limit is untracked, not divided by zero", budgetStatus({ spent: 50, limit: null }, 0.5).state === "untracked");

ok("days left counts today", daysLeftInMonth(new Date(2026, 9, 12)) === 20, String(daysLeftInMonth(new Date(2026, 9, 12))));
ok("the last day has one left", daysLeftInMonth(new Date(2026, 9, 31)) === 1);
ok("a leap February has 29 on the 1st", daysLeftInMonth(new Date(2028, 1, 1)) === 29);

// The purchase question asks only for the budget; the kind follows from it.
ok("a budget named like a kind gives that kind", kindForBudget(" groceries ") === "Groceries");
ok("otherwise last time's kind, when the budget is the same as last time",
   kindForBudget("Household", { suggestedKind: "Shopping", suggestedBudgetId: "b1", budgetId: "b1" }) === "Shopping");
ok("but not when the budget changed", kindForBudget("Household", { suggestedKind: "Shopping", suggestedBudgetId: "b1", budgetId: "b2" }) === null);
ok("no budget then and none now is the same budget", kindForBudget(null, { suggestedKind: "Gas" }) === "Gas");
ok("nothing is guessed beyond that", kindForBudget("Household") === null);

// ---------------------------------------------------------------------------

console.log("\nwins kept on the phone");

// A page shows what it loaded plus this phone's taps for the same day, each
// once. A tap the database already has is matched by id, so a reload landing
// mid-send never counts a win twice or drops one.
const localAt = (h, m, dayOffset = 0) => new Date(2026, 9, 12 + dayOffset, h, m).toISOString();
const loaded = [
  { id: "r1", kind: "win", habit_label: "Prayed", occurred_at: localAt(10, 0) },
  { id: "r2", kind: "loss", habit_label: "Loss", occurred_at: localAt(11, 0) },
];
const outbox = {
  taps: [
    { id: "r1", user_id: "u", kind: "win", habit_label: "Prayed", occurred_at: localAt(10, 0), status: "sent" },
    { id: "t2", user_id: "u", kind: "win", habit_label: "Win", occurred_at: localAt(9, 30), status: "waiting" },
    { id: "t3", user_id: "someone else", kind: "win", habit_label: "Win", occurred_at: localAt(9, 45), status: "waiting" },
    { id: "t4", user_id: "u", kind: "win", habit_label: "Win", occurred_at: localAt(9, 0, -1), status: "waiting" },
  ],
  removing: new Set(["r2"]),
  renamed: new Map([["t2", { label: "Ran", at: Date.now() }]]),
};
const shown = withTaps(loaded, outbox, { userId: "u", date: "2026-10-12" });
ok("loaded rows and taps merge, each once, oldest first", shown.map((r) => r.id).join() === "t2,r1", shown.map((r) => r.id).join());
ok("a rename shows before the database has it", shown[0].habit_label === "Ran");
ok("a row being deleted is already gone", !shown.some((r) => r.id === "r2"));
ok("another day's tap stays on its own day", !shown.some((r) => r.id === "t4"));
ok("kind narrows to losses", withTaps(loaded, outbox, { userId: "u", date: "2026-10-12", kind: "loss" }).length === 0);
const oldRename = { ...outbox, renamed: new Map([["t2", { label: "Ran", at: Date.now() - KEEP_MS - 1 }]]) };
ok("an old rename gives way to what was loaded", withTaps(loaded, oldRename, { userId: "u", date: "2026-10-12" })[0].habit_label === "Win");

const waitingOut = { taps: [{ user_id: "u", status: "waiting" }, { user_id: "u", status: "waiting", offline: false }, { user_id: "u", status: "sending" }] };
ok("waiting taps are counted", waitingTaps(waitingOut, "u").count === 2);
ok("one from storage counts as waiting for a signal", waitingTaps(waitingOut, "u").offline === true);
ok("all failing with a signal is not offline", waitingTaps({ taps: [{ user_id: "u", status: "waiting", offline: false }] }, "u").offline === false);

ok("a plain Win is unnamed", isUnnamed({ habit_label: " Win " }) && isUnnamed({ habit_label: "" }) && isUnnamed(null));
ok("a named win is named", !isUnnamed({ habit_label: "Ran 5k" }));

// ---------------------------------------------------------------------------

console.log("\nBoard drafts");

const fromNote = editableFields({ title: "Untitled note", body: null, source_ref: null, note_kind: null });
ok("a placeholder title starts empty", fromNote.title === "" && fromNote.body === "" && fromNote.kind === "thought");

const base = { title: "Alma 32", sourceRef: "", body: "Faith is like a seed.", kind: "thought" };
ok("spaces around the title aren't a change", Object.keys(changesFrom({ ...base, title: " Alma 32 " }, base)).length === 0);
ok("the source is saved trimmed", changesFrom({ ...base, sourceRef: " Alma 32:28 " }, base).sourceRef === "Alma 32:28");
ok("a body change is sent whole", changesFrom({ ...base, body: "Faith is like a seed. It grows." }, base).body === "Faith is like a seed. It grows.");
ok("the kind goes as noteKind", changesFrom({ ...base, kind: "insight" }, base).noteKind === "insight");

// A draft that changed only the title, over a note whose body changed on
// another device since: the title comes from the draft, the body from now.
const draft = { base, fields: { ...base, title: "Alma 32: the seed" }, at: Date.now() };
const movedOn = { ...base, body: "Faith is like a seed. Written on the computer." };
const resumed = draftOver(draft, movedOn);
ok("a resumed draft keeps its own change", resumed.title === "Alma 32: the seed");
ok("and the note's newer body", resumed.body === movedOn.body);
ok("no clash when they changed different fields", !draftClashes(draft, movedOn));
ok("a clash when both changed the title", draftClashes(draft, { ...movedOn, title: "Alma 32, again" }));

const noon = new Date(2026, 9, 12, 12, 0);
ok("a draft from today shows the time", !/Oct/.test(draftTime(new Date(2026, 9, 12, 9, 5), noon)), draftTime(new Date(2026, 9, 12, 9, 5), noon));
ok("an older one shows the day too", /Oct/.test(draftTime(new Date(2026, 9, 10, 9, 5), noon)), draftTime(new Date(2026, 9, 10, 9, 5), noon));

// --- weekly focus goals ------------------------------------------------------

ok("a Wednesday belongs to the week starting Sunday", focusWeekOf("2026-10-14") === "2026-10-11");
ok("a Sunday starts its own week", focusWeekOf("2026-10-11") === "2026-10-11");
ok("a Saturday is the end of that week", focusWeekOf("2026-10-17") === "2026-10-11");

const goalsWk = [
  { id: "b", title: "Exercise", position: 1, created_at: "2026-10-11T10:00:00Z" },
  { id: "a", title: "Patience", position: 0, created_at: "2026-10-11T11:00:00Z" },
];
const checks = [
  { goal_id: "a", date: "2026-10-11", moved: true },
  { goal_id: "a", date: "2026-10-12", moved: false },
  { goal_id: "a", date: "2026-10-13", moved: true },
  { goal_id: "b", date: "2026-10-12", moved: true },
  { goal_id: "a", date: "2026-10-18", moved: true }, // next week: not counted
];
const sumWk = summarizeWeek(goalsWk, checks, "2026-10-11");
ok("goals keep the order they were set in", sumWk[0].id === "a" && sumWk[1].id === "b");
ok("each goal gets seven days", sumWk.every((g) => g.days.length === 7));
ok("days that moved it are counted", sumWk[0].movedDays === 2, sumWk[0].movedDays);
ok("a 'not today' counts as answered, not moved", sumWk[0].answeredDays === 3, sumWk[0].answeredDays);
ok("a day nobody answered is null", sumWk[0].days[3].moved === null);
ok("check-ins outside the week are ignored", sumWk[0].days.every((d) => d.date <= "2026-10-17"));
ok("the label reads naturally", movedLabel(sumWk[0]) === "Moved it 2 of 3 days", movedLabel(sumWk[0]));
ok("one answered day is singular", movedLabel(sumWk[1]) === "Moved it 1 of 1 day", movedLabel(sumWk[1]));
ok("no answers says so", movedLabel({ answeredDays: 0, movedDays: 0 }) === "No check-ins");

ok("today's answer is found", answerOn(checks, "a", "2026-10-13") === true);
ok("'not today' is false, not null", answerOn(checks, "a", "2026-10-12") === false);
ok("no answer is null", answerOn(checks, "b", "2026-10-13") === null);
ok("a timestamp-shaped date still matches", answerOn([{ goal_id: "x", date: "2026-10-13T00:00:00", moved: true }], "x", "2026-10-13") === true);

ok("only unreviewed goals wait for Sunday", awaitingReview([{ id: 1, review: "kept" }, { id: 2, review: null }, { id: 3 }]).map((g) => g.id).join() === "2,3");
ok("the review shows on this week", showsReview("2026-10-11", "2026-10-11"));
ok("and on next week, planned on a Saturday", showsReview("2026-10-18", "2026-10-17"));
ok("but not on weeks already past", !showsReview("2026-10-04", "2026-10-13"));
ok("nor two weeks ahead", !showsReview("2026-10-25", "2026-10-13"));

ok("new goals go to the end", nextPosition([{ position: 0 }, { position: 3 }]) === 4);
ok("the first goal is position 0", nextPosition([]) === 0);
ok("titles are trimmed and squeezed", cleanTitle("  patience   with\nthe kids ") === "patience with the kids");
ok("a blank title is empty", cleanTitle("   ") === "");
ok("titles are capped at 200", cleanTitle("x".repeat(250)).length === 200);
ok("ordering doesn't change the input", (() => { const g = [{ position: 2 }, { position: 1 }]; orderGoals(g); return g[0].position === 2; })());

// --- The Board ---------------------------------------------------------------

const shelf = [
  { id: "old", created_at: "2026-08-01T10:00:00Z", parent_note_id: null },
  { id: "child", created_at: "2026-09-20T10:00:00Z", parent_note_id: "old" },
  { id: "new", created_at: "2026-10-12T10:00:00Z", parent_note_id: null },
];
ok("the board lists newest first", boardNotes(shelf).map((n) => n.id).join() === "new,old");
ok("notes cut from a passage fold under their parent", !boardNotes(shelf).some((n) => n.id === "child"));
ok("the board copes with nothing", boardNotes(null).length === 0);
ok("folding doesn't reorder the input", shelf[0].id === "old");

ok("useful saves as a high score", verdictOf(USEFUL) === "useful");
ok("not now saves as a low score", verdictOf(NOT_NOW) === "not_now");
ok("an old 7 out of 10 reads as useful", verdictOf(7) === "useful");
ok("an old 5 out of 10 reads as not now", verdictOf(5) === "not_now");
ok("unscored has no verdict", verdictOf(null) === null && verdictOf(0) === null);

// --- Quotes ------------------------------------------------------------------

ok("initials skip titles", initials("President Russell M. Nelson") === "RN");
ok("initials for one name", initials("Augustine") === "A");
ok("initials from initials", initials("C. S. Lewis") === "CL");
ok("initials ignore a suffix", initials("Martin Luther King Jr.") === "MK");
ok("initials of nothing are empty", initials("") === "");
ok("three ratings, in order", RATINGS.map((r) => r.key).join() === "applies,somewhat,not_now");
ok("applies says it comes back", ratedLine("applies").includes("come back"));
ok("unrated says nothing", ratedLine(null) === "");
ok("source gets its year", sourceLine({ source: "Mere Christianity", year: 1952 }) === "Mere Christianity (1952)");
ok("a year already in the source isn't repeated", sourceLine({ source: "General conference, October 2018", year: 2018 }) === "General conference, October 2018");
ok("only a year", sourceLine({ source: "", year: 1863 }) === "1863");
ok("nothing at all", sourceLine({}) === "");

// --- Quote shelves and the cork -------------------------------------------------

const KEY = /^[a-z]+:[a-z0-9-]{1,80}$/;
ok("names slug to dashes", slug("Russell M. Nelson") === "russell-m-nelson");
ok("slugs drop accents", slug("Dieter F. Uchtdorf über") === "dieter-f-uchtdorf-uber");
ok("a slug of punctuation still has something", slug("?!") === "x");
ok("slugs stop at 80 without a trailing dash", slug("ab ".repeat(40)).length <= 80 && !slug("ab ".repeat(40)).endsWith("-"));
ok("every built-in shelf has a key the database takes", [
  ...PEOPLE.map((p) => shelfFor("person", p)),
  ...THEMES.map((t) => shelfFor("theme", t)),
  ...MOODS.map((m) => shelfFor("mood", m)),
].every((s) => KEY.test(s.key) && s.label.length <= 80 && (s.hint ?? "").length <= 300));
ok("built-in shelf keys are all different", (() => {
  const keys = [...PEOPLE.map((p) => shelfFor("person", p).key), ...THEMES.map((t) => shelfFor("theme", t).key), ...MOODS.map((m) => shelfFor("mood", m).key)];
  return new Set(keys).size === keys.length;
})());
ok("a person shelf asks for their quotes", shelfFor("person", { name: "C. S. Lewis" }).key === "person:c-s-lewis");
ok("a mood shelf carries what helps", shelfFor("mood", MOODS[0]).hint.startsWith("For when"));
ok("an ask shelf is what you typed, tidied", (() => {
  const s = shelfFor("ask", { name: "  patience   with kids " });
  return s.key === "ask:patience-with-kids" && s.label === "patience with kids" && s.facet === "ask";
})());
ok("a long ask still makes a valid key", KEY.test(shelfFor("ask", { name: "word ".repeat(40) }).key));
ok("top picks are keyed by the week's Sunday", topShelf("2026-10-14").key === "top:2026-10-11");
ok("a Sunday is its own week", topShelf("2026-10-11").key === "top:2026-10-11");
ok("Saturday belongs to the week before", topShelf("2026-10-17").key === "top:2026-10-11");

ok("shelf quotes come back in shelf order", inShelfOrder(["b", "a", "c"], [{ id: "a" }, { id: "b" }, { id: "c" }]).map((q) => q.id).join() === "b,a,c");
ok("a quote that's gone is left out", inShelfOrder(["a", "gone"], [{ id: "a" }]).length === 1);
ok("no ids, no quotes", inShelfOrder(null, [{ id: "a" }]).length === 0);

const asked = "2026-10-13T12:00:00Z";
ok("no row is missing", shelfState(null) === "missing");
ok("a fresh pending shelf is pending", shelfState({ status: "pending", requested_at: asked }, Date.parse(asked) + 60_000) === "pending");
ok("a pending shelf abandoned for 5 minutes reads as failed", shelfState({ status: "pending", requested_at: asked }, Date.parse(asked) + 6 * 60_000) === "failed");
ok("ready is ready", shelfState({ status: "ready", requested_at: asked }) === "ready");

ok("tilt is steady for a card", tiltOf("abc") === tiltOf("abc"));
ok("tilt stays small", ["a", "b", "some-uuid-1234", "", null].every((id) => Math.abs(tiltOf(id)) <= 0.6));
ok("pins are one of the colors", PIN_COLORS.includes(pinOf("abc")) && pinOf("abc") === pinOf("abc"));

const cork = corkItems(
  [{ id: "q1", saved_at: "2026-10-12T10:00:00Z" }, { id: "q2", saved_at: "2026-10-13T09:00:00Z" }],
  [
    { id: "n1", created_at: "2026-10-13T08:00:00Z", parent_note_id: null },
    { id: "n2", created_at: "2026-09-01T08:00:00Z", parent_note_id: null, pinned: true },
    { id: "n3", created_at: "2026-10-13T10:00:00Z", parent_note_id: "n1" },
  ]
);
ok("pinned thoughts go to the top of the cork", cork[0].id === "n2");
ok("then everything newest first", cork.map((i) => i.id).join() === "n2,q2,n1,q1");
ok("thoughts cut from a passage stay folded on the cork", !cork.some((i) => i.id === "n3"));
ok("the cork copes with nothing", corkItems(null, undefined).length === 0);

// Ask: an answer's words and charts, and whether one is still coming.
const charts2 = [{ n: 1, title: "Sleep" }, { n: 2, title: "Study" }];
const parts = answerParts("You slept **7h**.\n\n[[chart:2]]\n\nMore below.\n[[chart:9]]", charts2);
ok("a chart goes where its marker is", parts.map((p) => (p.kind === "chart" ? `c${p.chart.n}` : "t")).join() === "t,c2,t,c1");
ok("a marker with no chart is dropped", !parts.some((p) => p.kind === "chart" && p.chart.n === 9));
ok("an answer with no markers puts its charts at the end", answerParts("Just words.", charts2).map((p) => p.kind).join() === "text,chart,chart");
ok("a chart placed twice shows once", answerParts("[[chart:1]] and [[chart:1]]", [{ n: 1 }]).filter((p) => p.kind === "chart").length === 1);
ok("an empty answer is no parts", answerParts("", []).length === 0);
const t0 = Date.parse("2026-10-13T20:00:00Z");
const waitingConvo = { working_since: "2026-10-13T20:00:00Z", messages: [{ role: "user", text: "q" }] };
ok("a fresh question is still being worked on", stillWorking(waitingConvo, t0 + 30_000));
ok("past three minutes it isn't coming", !stillWorking(waitingConvo, t0 + ANSWER_GIVES_UP_MS + 1) && unanswered(waitingConvo, t0 + ANSWER_GIVES_UP_MS + 1));
ok("an answered question isn't waiting", !stillWorking({ working_since: null, messages: [{ role: "user" }, { role: "assistant" }] }) && !unanswered({ messages: [{ role: "user" }, { role: "assistant" }] }));
ok("no conversation, nothing waiting", !stillWorking(null) && !unanswered(null));
const cr = chartResult({ n: 1, title: "T", caption: "C", chart_type: "line", x_key: "week", y_key: "minutes", series_key: "category", x_kind: "date", y_unit: "minutes", rows: [{}] });
ok("a saved chart draws with its caption and series", cr.spec.answer === "C" && cr.spec.series_key === "category" && cr.rows.length === 1);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
