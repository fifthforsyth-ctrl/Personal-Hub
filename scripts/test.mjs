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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
