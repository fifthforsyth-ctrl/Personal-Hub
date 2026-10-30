#!/usr/bin/env node
//
// The pure logic, tested. Run with: npm test
//
// Only the parts that are genuinely tricky and genuinely pure: anchoring a
// highlight back into text that has been edited under it, and assembling a
// report that goes to another person. Both have been wrong at least once in
// ways a passing build did not catch, which is the entire argument for this
// file existing.

import { readFileSync } from "node:fs";
import { dropIndex, edgePush, moved, towardEdge } from "../src/lib/dragOrder.js";
import { questTagOptions, tagOf, questWorkDone } from "../src/lib/questWork.js";
import { CATALOG, SIZES, buildOf, seedFor, soldiersFor, bowFor, layout, tileOf, freePlot, dayIndex, finishedUnits, allocate, villagersOf, villageOf, standingOf, shortName } from "../src/lib/village.js";
import { listDays, ongoingList, pickedLines, dayLabel, nextPosition as nextLinePosition, boardOf, parseLines, withFinished, withFinishedStep, countLine, campTally } from "../src/lib/questTasks.js";
import { questDoneToday, allDoneToday, countDone, earlierOnToday } from "../src/lib/doneToday.js";
import { DEFAULT_COMPUTERS, computersOf, nextComputer, todayCards, orderCards, NO_FILTER, filterOn, matchesFilter, campColumns, computerColumns, reorderShown, moveKey, rowOf } from "../src/lib/todayBoard.js";
import { fitView, zoomAt, clampView, toPicture, toBox, centreOn, shrinkTo, pinNumbers, pinSpots } from "../src/lib/zoom.js";
import { pastedImage, pageOf } from "../src/lib/photo.js";
import { fitPage, pageSize, pushPoint, widthAt, nearStroke, erasedBy, drawPieces, drawStrokes, staleSummary, inkFrame, plainSummary, appendToNote } from "../src/lib/sketch.js";
import {
  buildCamp,
  stepsUnder,
  campProgress,
  stepsLine,
  splitSteps,
  planFromOutline,
  titleFromFilename,
  planFileKind,
  planRows,
  planStepCount,
  noteBlocks,
  boldRuns,
  mountainsOf,
  todayPicks,
  questToday,
  pickDiff,
} from "../src/lib/camp.js";
import { planMove, applyRows, inPageOrder, planPinDrop, applyPinDrop, byPin } from "../src/lib/stepMoves.js";
import { kindFields, isNote, resolvePlan, resolveWords, resolvedLine, resolvedGroups } from "../src/lib/camp.js";
import { normalizePhone, prettyPhone, wakeClock, fillMessage, shortTime, deliveryLine, upStreak } from "../src/lib/wake.js";
import {
  stageOf,
  buildTemple,
  candidates,
  fillTrip,
  myNames,
  planTrips,
  paceTimeline,
  tripDates,
  waitsOn,
  tripProgress,
  nextTrip,
  helperNames,
  missingParents,
  crowd as templeCrowd,
  familyFacts,
  countryOf,
  parseSnapshot,
  plainReason,
  fanSlots,
} from "../src/lib/temple.js";
import { familySearchSync, syncBookmarklet, SYNC_VERSION } from "../src/lib/templeSync.js";
import {
  zoneOf,
  stepIndex,
  focusSteps,
  fedLine,
  shortGoal,
  gearFor,
  questState,
  questLayout,
  climberAt,
  lessonWeek,
  lessonNote,
  buildAscent,
  windowDays,
  WINDOW_DAYS,
} from "../src/lib/ascent.js";
import { levelFrom, placement, inRange, average, missCounts, fullest, tierOf, TIERS, bowLine, bowProgress, bowEarned, fourReasons, DEFAULT_REASONS, shortTarget, iconFor, buildRange, answersOf, LEVELS, isLoosed, focusMinutes, startingAnswers, readLine, guessReason, shotFrom } from "../src/lib/mark.js";
import { resolveHighlights, splitParagraphs, segmentsFor, buildTree, findInSource } from "../src/lib/noteText.js";
import { reportToText, fmtHours, buildReport } from "../src/lib/workReport.js";
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
import { shareText, shareFileName, wrapText, layoutCard, CARD_H } from "../src/lib/quoteShare.js";
import { answerParts, stillWorking, unanswered, chartResult, ANSWER_GIVES_UP_MS } from "../src/lib/ask.js";
import { boardNotes, verdictOf, USEFUL, NOT_NOW } from "../src/lib/board.js";
import {
  slug,
  shelfFor,
  topShelf,
  inShelfOrder,
  shelfState,
  tiltOf,
  pinOf,
  PIN_COLORS,
  PEOPLE,
  THEMES,
  MOODS,
  corkItems,
  notesOnShelf,
  shelfCounts,
  notePeople,
  interleave,
  holdsNotes,
} from "../src/lib/quoteShelves.js";
import {
  runawayOf,
  usualLightsOut,
  suggestedSleepStart,
  resolveTimeAfter,
  resolveTimeBefore,
  lastNightSleep,
  rememberedAlarm,
  habitsToAsk,
  keptByWake,
  reasonChips,
  namesInText,
  peopleChips,
  tidyName,
  followUpKinds,
  fmtClock as clockText,
  isMorning,
  offPlan,
  lightsOutFor,
  windDown,
  eveningStamp,
  STRESS_SOURCES,
  isNap,
  exerciseKindFrom,
  dayPart,
  clientFromTags,
  clientFor,
  clientChips,
  depositClient,
  isWeighIn,
  weightChange,
  leftUndone,
  isSunday,
  savingsRate,
  earningsByClient,
  practiceSummary,
  TASK_REASONS,
  DEFAULT_CLIENTS,
  ranThroughNight,
  overnightSleepStart,
  planOvernightFix,
  withSleepFrom,
  overnightProblem,
} from "../src/lib/honest.js";
import { focusWeekOf, summarizeWeek, answerOn, awaitingReview, showsReview, movedLabel, nextPosition, cleanTitle, orderGoals } from "../src/lib/focus.js";
import {
  buildMirror,
  lastWeekStart,
  weekDates,
  familyLookup,
  nightsOf,
  earlyDaysOf,
  wakeOutcomes,
  wakeHabitTime,
  isWakeHabit,
  mornings,
  workWeek,
  peopleWeek,
  missesWeek,
  moodWeek,
  focusMirror,
  moneyWeek,
  practiceWeek,
  weightTrend,
  pieces,
  andList,
  fmtHours as mirrorHours,
} from "../src/lib/mirror.js";

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

// Your own notes on the shelves.
const filed = [
  { id: "b1", created_at: "2026-10-01T08:00:00Z", parent_note_id: null, shelf_keys: ["person:david-a-bednar", "theme:discipline"], shelf_people: ["David A. Bednar"] },
  { id: "b2", created_at: "2026-10-05T08:00:00Z", parent_note_id: null, shelf_keys: ["person:david-a-bednar"], shelf_people: ["David A. Bednar"] },
  { id: "g1", created_at: "2026-10-03T08:00:00Z", parent_note_id: null, shelf_keys: ["person:grandpa-joe", "theme:work"], shelf_people: ["Grandpa Joe"] },
  { id: "c1", created_at: "2026-10-06T08:00:00Z", parent_note_id: "b1", shelf_keys: ["person:david-a-bednar"], shelf_people: ["David A. Bednar"] },
  { id: "u1", created_at: "2026-10-07T08:00:00Z", parent_note_id: null },
];
ok("a Bednar quote you wrote is on his shelf, newest first", notesOnShelf(filed, "person:david-a-bednar").map((n) => n.id).join() === "b2,b1");
ok("a note can be on a person's shelf and a theme's", notesOnShelf(filed, "theme:discipline").map((n) => n.id).join() === "b1");
ok("cards cut from a note don't count twice", !notesOnShelf(filed, "person:david-a-bednar").some((n) => n.id === "c1"));
ok("notes not yet filed are on no shelf", notesOnShelf(filed, "theme:work").every((n) => n.id !== "u1"));
ok("shelf counts", shelfCounts(filed).get("person:david-a-bednar") === 2 && shelfCounts(filed).get("theme:work") === 1);
ok("people your notes quote get shelves; the Board's own don't repeat", notePeople(filed).map((p) => `${p.name}:${p.count}`).join() === "Grandpa Joe:1");
ok("their shelf key is made the usual way", shelfFor("person", notePeople(filed)[0]).key === "person:grandpa-joe");
ok("nothing filed, no people", notePeople(null).length === 0 && shelfCounts(undefined).size === 0);
ok("All takes turns", interleave(["q1", "q2", "q3"], ["n1"]).join() === "q1,n1,q2,q3");
ok("All with only notes", interleave([], ["n1", "n2"]).join() === "n1,n2");
ok("people, themes and moods hold notes; top picks and asks don't",
  holdsNotes({ facet: "person" }) && holdsNotes({ facet: "theme" }) && holdsNotes({ facet: "mood" }) && !holdsNotes({ facet: "top" }) && !holdsNotes({ facet: "ask" }));

// The board function files notes under these same names.
const boardFn = readFileSync(new URL("../supabase/functions/board/index.ts", import.meta.url), "utf8");
ok("the board function knows every person", PEOPLE.every((p) => boardFn.includes(`"${p.name}"`)));
ok("the board function knows every theme", THEMES.every((t) => boardFn.includes(`"${t.name}"`)));
ok("the board function knows every mood", MOODS.every((m) => boardFn.includes(`"${m.name}"`)));

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

// Honest tracking: runaway timers, the morning, misses and people.
{
const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi);
const prepEntry = { id: "p", tags: ["Prep"], started_at: at(2026, 10, 13, 21, 46).toISOString(), ended_at: null };
ok("a timer that crossed midnight is a runaway", runawayOf(prepEntry, { now: at(2026, 10, 14, 5, 0) })?.overnight === true);
ok("a short evening timer isn't", runawayOf(prepEntry, { now: at(2026, 10, 13, 22, 30) }) === null);
const workEntry = { id: "w", tags: ["Forsyth Media LLC"], started_at: at(2026, 10, 14, 8, 0).toISOString() };
ok("four hours of work is fine", runawayOf(workEntry, { now: at(2026, 10, 14, 12, 0), isWork: true }) === null);
ok("four hours of anything else isn't", runawayOf(workEntry, { now: at(2026, 10, 14, 12, 0) })?.overnight === false);
ok("six hours of work is a runaway", runawayOf(workEntry, { now: at(2026, 10, 14, 14, 0), isWork: true }) !== null);
ok("Sleep is never a runaway", runawayOf({ tags: ["Sleep"], started_at: at(2026, 10, 13, 22).toISOString() }, { now: at(2026, 10, 14, 9) }) === null);
ok("a stopped timer is never a runaway", runawayOf({ ...prepEntry, ended_at: at(2026, 10, 13, 22).toISOString() }, { now: at(2026, 10, 14, 9) }) === null);

const sleeps = [at(2026, 10, 10, 22, 0), at(2026, 10, 11, 22, 10), at(2026, 10, 12, 23, 50), at(2026, 10, 13, 0, 40), at(2026, 10, 9, 14, 0)].map((d) => ({ started_at: d.toISOString(), tags: ["Sleep"] }));
ok("usual lights-out is the median night, naps left out", usualLightsOut(sleeps) === "23:50");
ok("no sleep, no usual", usualLightsOut([]) === null);
ok("the split starts at your usual lights-out", suggestedSleepStart(prepEntry, "22:10", at(2026, 10, 14, 5)).getHours() === 22);
ok("an early-hours usual still lands that night", suggestedSleepStart(prepEntry, "00:30", at(2026, 10, 14, 5)).getDate() === 14);
ok("a usual long after the start falls back to half an hour in",
  suggestedSleepStart({ started_at: at(2026, 10, 13, 13, 0).toISOString() }, "22:10", at(2026, 10, 14, 5)).getHours() === 13);
ok("a time after the start that's on its clock is that day", resolveTimeAfter(at(2026, 10, 13, 21, 46).toISOString(), "22:10").getDate() === 13);
ok("an earlier clock time is the next day", resolveTimeAfter(at(2026, 10, 13, 21, 46).toISOString(), "01:30").getDate() === 14);
ok("lights out at 22:10 before a 4:31 wake is the night before", resolveTimeBefore(at(2026, 10, 14, 4, 31).toISOString(), "22:10").getDate() === 13);
ok("lights out at 00:20 before a 4:31 wake is the same day", resolveTimeBefore(at(2026, 10, 14, 4, 31).toISOString(), "00:20").getDate() === 14);

const nights = [
  { id: "old", tags: ["Sleep"], started_at: at(2026, 10, 12, 22).toISOString() },
  { id: "last", tags: ["Sleep"], started_at: at(2026, 10, 13, 21, 52).toISOString() },
  { id: "nap", tags: ["Sleep"], started_at: at(2026, 10, 14, 13).toISOString() },
];
ok("last night's sleep is the one that started between noon and noon", lastNightSleep(nights, "2026-10-14")?.id === "last");
ok("the alarm set last night wins", rememberedAlarm("06:00:00", "04:30:00") === "06:00");
ok("otherwise the last one used", rememberedAlarm(null, "04:30:00") === "04:30");
ok("and 4:30 when there's none", rememberedAlarm(null, null) === "04:30");
ok("clock times read plainly", clockText("04:30:00") === "4:30" && clockText("18:05", { ampm: true }) === "6:05 pm");

const watched = [{ id: "a", label: "Up at 4:30", due_by: "04:45:00", on_alarm: "04:30:00", active: true }];
const asked = habitsToAsk(watched, { alarm: "04:30" });
ok("a 4:30 day asks about Up at 4:30", asked.length === 1 && asked[0].label === "Up at 4:30" && asked[0].wake);
ok("a 6:00 day asks about Up at 6:00, due 6:15", habitsToAsk(watched, { alarm: "06:00" })[0].label === "Up at 6:00" && habitsToAsk(watched, { alarm: "06:00" })[0].due_by === "06:15");
ok("a wake-up already logged by hand isn't asked again", habitsToAsk(watched, { alarm: "04:30", handWins: [{ habit_label: "Up on time" }] }).length === 0);
ok("up by 4:45 is kept", keptByWake(asked[0], at(2026, 10, 14, 4, 31)) === true);
ok("up at 6:10 is a miss", keptByWake(asked[0], at(2026, 10, 14, 6, 10)) === false);
ok("no wake time, no guess", keptByWake(asked[0], null) === null);
ok("reason chips: defaults first, then yours, once each", reasonChips(["Late night", "Kids up early", "late NIGHT"]).join("|") === "Late night|Date ran late|Snoozed|Sick|Chose rest|Kids up early");

ok("names follow 'with'", namesInText("Date with Zimi").join() === "Zimi" && namesInText("Gym with my brother").join() === "Brother");
ok("short all-caps names stay as written", namesInText("Lunch with AJ").join() === "AJ" && tidyName("aj") === "Aj");
ok("known names are found as words", namesInText("Minister to mom", ["Mom"]).join() === "Mom");
ok("not every word after 'with' is a person", namesInText("Done with work").length === 0 && namesInText("Chess with him").length === 0);
const chipsP = peopleChips([
  { people: ["Zimi"], started_at: "2026-10-12T10:00:00Z" },
  { people: ["AJ", "zimi"], started_at: "2026-10-14T10:00:00Z" },
  { description: "Gym with brother", started_at: "2026-10-01T10:00:00Z" },
]);
ok("people chips: newest picks first, then names from descriptions, then Family", chipsP.join() === "AJ,Zimi,Brother,Family");
const fam = (t) => ({ "Forsyth Media LLC": "Work", Meet: "People", Date: "People", Prep: "Upkeep" })[t] ?? "Other";
ok("work asks deep or shallow", followUpKinds({ tags: ["Forsyth Media LLC"] }, fam).join() === "work");
ok("people time asks who", followUpKinds({ tags: ["Meet"] }, fam).join() === "people");
ok("a work meeting with people asks both", followUpKinds({ tags: ["Forsyth Media LLC", "Meet"] }, fam).join() === "work,people");
ok("prep asks nothing", followUpKinds({ tags: ["Prep"] }, fam).length === 0);
ok("the morning is three to noon", isMorning(at(2026, 10, 14, 4, 31)) && !isMorning(at(2026, 10, 14, 12, 1)) && !isMorning(at(2026, 10, 14, 2, 0)));

const askFnT1 = readFileSync(new URL("../supabase/functions/ask/index.ts", import.meta.url), "utf8");
const assistantFnT1 = readFileSync(new URL("../supabase/functions/assistant/index.ts", import.meta.url), "utf8");
for (const col of ["woke_at", "lights_out_at", "sleep_quality", "energy text", "depth", "people_feel", "reason text", "watched_habits"]) {
  ok(`Ask's schema notes know ${col}`, askFnT1.includes(col));
  ok(`the assistant's schema notes know ${col}`, assistantFnT1.includes(col));
}
}

// --- Honest tracking, tier 2: the evening ------------------------------------
{
const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi);
const day = "2026-10-14";
const chunks = [
  { category: "Forsyth Media LLC", start_time: "09:00:00", end_time: "12:00:00" },
  { category: "Forsyth Media LLC", start_time: "13:00:00", end_time: "16:00:00" },
  { category: "Study", start_time: "06:00:00", end_time: "07:00:00" },
  { category: "Exercise", start_time: "17:00:00", end_time: "18:00:00" },
  { category: "Sleep", start_time: "20:00:00", end_time: "04:30:00" },
  { category: null, start_time: "12:00:00", end_time: "13:00:00" },
  { category: "Meet", start_time: "21:00:00", end_time: "22:00:00" },
];
const entries = [
  { tags: ["Forsyth Media LLC"], started_at: at(2026, 10, 14, 9, 0).toISOString(), ended_at: at(2026, 10, 14, 11, 0).toISOString() },
  { tags: ["Study"], started_at: at(2026, 10, 14, 19, 0).toISOString(), ended_at: at(2026, 10, 14, 19, 50).toISOString() },
  { tags: ["Exercise"], started_at: at(2026, 10, 14, 17, 0).toISOString(), ended_at: at(2026, 10, 14, 17, 20).toISOString(), is_example: true },
];
const off = offPlan(chunks, entries, { date: day, now: at(2026, 10, 14, 20, 30) });
ok("off plan: work with 2 of 6 hours is missed", off[0]?.category === "Forsyth Media LLC" && off[0].planned === 360 && off[0].tracked === 120);
ok("off plan: study done later in the day isn't missed", !off.some((o) => o.category === "Study"));
ok("off plan: sample rows don't count, so exercise is missed", off.some((o) => o.category === "Exercise" && o.tracked === 0));
ok("off plan: blocks still ahead, Sleep and blocks with no category are left out", !off.some((o) => ["Meet", "Sleep"].includes(o.category)) && off.length === 2);
ok("off plan: nothing planned, nothing asked", offPlan([], entries, { date: day, now: at(2026, 10, 14, 21) }).length === 0);

const lo = lightsOutFor("2026-10-15", "04:30");
ok("lights out for 4:30 is 8:00 the evening before", lo.getDate() === 14 && lo.getHours() === 20 && lo.getMinutes() === 0);
ok("lights out for 6:00 is 9:30", lightsOutFor("2026-10-15", "06:00:00").getHours() === 21 && lightsOutFor("2026-10-15", "06:00").getMinutes() === 30);
ok("wind-down: quiet before 7:15", windDown({ tomorrow: "2026-10-15", alarm: "04:30", now: at(2026, 10, 14, 19, 0) }) === null);
ok("wind-down: shows from 7:15", windDown({ tomorrow: "2026-10-15", alarm: "04:30:00", now: at(2026, 10, 14, 19, 20) })?.alarm === "04:30");
ok("wind-down: still shows past lights out", windDown({ tomorrow: "2026-10-15", alarm: "04:30", now: at(2026, 10, 14, 22, 0) })?.past === true);
ok("wind-down: not once Sleep is running", windDown({ tomorrow: "2026-10-15", alarm: "04:30", now: at(2026, 10, 14, 20, 30), sleeping: true }) === null);
ok("wind-down: gone at the alarm", windDown({ tomorrow: "2026-10-15", alarm: "04:30", now: at(2026, 10, 15, 4, 30) }) === null);
ok("wind-down: nothing without an alarm", windDown({ tomorrow: "2026-10-15", alarm: null, now: at(2026, 10, 14, 20, 30) }) === null);

ok("evening stamp: now, on the day itself", eveningStamp(day, at(2026, 10, 14, 21, 15)).getHours() === 21);
const late = eveningStamp(day, at(2026, 10, 15, 0, 20));
ok("evening stamp: past midnight it stays on the day", late.getDate() === 14 && late.getHours() === 23 && late.getMinutes() === 59);
ok("stress chips: defaults, then yours", reasonChips(["Clients", "work"], 8, STRESS_SOURCES).join("|") === `${STRESS_SOURCES.join("|")}|Clients`);

const askFnT2 = readFileSync(new URL("../supabase/functions/ask/index.ts", import.meta.url), "utf8");
const assistantFnT2 = readFileSync(new URL("../supabase/functions/assistant/index.ts", import.meta.url), "utf8");
for (const col of ["mood smallint", "stress smallint", "stress_source", "off_plan_reason", "had_prompting"]) {
  ok(`Ask's schema notes know ${col}`, askFnT2.includes(col));
  ok(`the assistant's schema notes know ${col}`, assistantFnT2.includes(col));
}
}

// --- Honest tracking, tier 3: the rest of the day ------------------------------
{
console.log("\nhonest tracking, tier 3");
const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi);
const fam3 = (t) => ({ "Forsyth Media LLC": "Work", "Client work (Parker)": "Work", Meet: "People", Exercise: "Body", Study: "Spirit" })[t] ?? "Other";
ok("exercise asks what kind", followUpKinds({ tags: ["Exercise"] }, fam3).join() === "exercise");
ok("study asks how awake", followUpKinds({ tags: ["Study"] }, fam3).join() === "study");
ok("the gym with a friend asks both", followUpKinds({ tags: ["Exercise", "Meet"] }, fam3).join() === "people,exercise");
ok("a run is read from the description", exerciseKindFrom("Morning run") === "run" && exerciseKindFrom("Quick jog") === "run");
ok("so is the gym", exerciseKindFrom("Gym with AJ") === "gym" && exerciseKindFrom("Lifting") === "gym");
ok("anything else is left to pick", exerciseKindFrom("Hike") === null && exerciseKindFrom("Pruning") === null && exerciseKindFrom(null) === null);
ok("morning, afternoon and evening from the start time",
  dayPart(at(2026, 10, 14, 6).toISOString()) === "morning" && dayPart(at(2026, 10, 14, 13).toISOString()) === "afternoon" && dayPart(at(2026, 10, 14, 18).toISOString()) === "evening");

ok("Parker's categories name Parker", clientFromTags(["Client work (Parker)"]) === "Parker" && clientFromTags(["Working for Parker"]) === "Parker");
ok("Scripture Central's category names it", clientFromTags(["Scripture central work"]) === "Scripture Central");
ok("a client in the description is picked", clientFor({ tags: ["Meeting"], description: "Call with Parker" }, DEFAULT_CLIENTS) === "Parker");
ok("a client already picked stays", clientFor({ tags: ["Client work (Parker)"], client: "Acme" }) === "Acme");
ok("no client is guessed from nothing", clientFor({ tags: ["Forsyth Media LLC"], description: "Edit" }, DEFAULT_CLIENTS) === null);
ok("client chips: the usual two, then yours, once each", clientChips(["Acme", "parker", "Acme"]).join() === "Parker,Scripture Central,Acme");
ok("a deposit's bank words name the client", depositClient({ payee: "Certificate of Origin Parker Walbeck P", description: "ORIG CO NAME:PARKER WALBECK P" }) === "Parker");
ok("a client you added is found in a deposit too", depositClient({ payee: "ACME STUDIO LLC" }, ["Acme"]) === "Acme");
ok("a deposit's own client wins", depositClient({ client: "Acme", payee: "PARKER WALBECK" }) === "Acme");
ok("an unknown payer stays unnamed", depositClient({ payee: "Venmo" }) === null);

ok("Sleep at 2 pm is a nap", isNap({ tags: ["Sleep"], started_at: at(2026, 10, 14, 14).toISOString() }));
ok("Sleep at 10 pm isn't", !isNap({ tags: ["Sleep"], started_at: at(2026, 10, 14, 22).toISOString() }));
ok("the database's answer wins", isNap({ tags: ["Sleep"], is_nap: true, started_at: at(2026, 10, 14, 22).toISOString() }));
ok("only Sleep can be a nap", !isNap({ tags: ["Study"], started_at: at(2026, 10, 14, 14).toISOString() }));
const withNap = [
  { id: "night", tags: ["Sleep"], started_at: at(2026, 10, 13, 21, 50).toISOString() },
  { id: "nap", tags: ["Sleep"], started_at: at(2026, 10, 14, 10).toISOString() },
];
ok("a morning nap is never last night's sleep", lastNightSleep(withNap, "2026-10-14")?.id === "night");
ok("an early-evening nap doesn't move the usual lights-out",
  usualLightsOut([...withNap, { tags: ["Sleep"], started_at: at(2026, 10, 12, 22, 10).toISOString() }, { tags: ["Sleep"], started_at: at(2026, 10, 11, 18, 30).toISOString() }]) === "22:10");

ok("Weigh myself offers the number", isWeighIn("Weigh myself") && isWeighIn("Weighed myself") && isWeighIn(" weigh in"));
ok("other wins don't", !isWeighIn("Workout") && !isWeighIn("Weight lifting") && !isWeighIn(null));
const change = weightChange([{ value: 183.4, measured_at: "2026-10-08T12:00:00Z" }], 182.2);
ok("weight change: down 1.2 since the last one", change.diff === -1.2 && change.since === "2026-10-08T12:00:00Z");
ok("weight change: a first reading has nothing to compare", weightChange([], 182) === null);

ok("left undone: unfinished top-level tasks, never examples",
  leftUndone([{ id: 1, status: false }, { id: 2, status: true }, { id: 3, status: false, parent_task_id: 1 }, { id: 4, status: false, is_example: true }, { id: 5, status: null }]).map((t) => t.id).join() === "1,5");
ok("task reasons: the usual ones, then yours", reasonChips(["Too tired", "forgot"], 7, TASK_REASONS).join("|") === [...TASK_REASONS, "Too tired"].join("|"));
ok("Sunday is Sunday", isSunday("2026-10-18") && !isSunday("2026-10-15"));

ok("savings rate: 43% of 6,000 kept", Math.round(savingsRate(6000, 3423.05) * 100) === 43);
ok("savings rate: nothing came in, nothing to say", savingsRate(0, 500) === null);
ok("savings rate: spending more than came in shows as negative", savingsRate(1000, 1500) === -0.5);
const earned = earningsByClient(
  [{ client: "Parker", amount: 6000 }, { client: "parker", amount: 500 }, { client: null, amount: 100 }, { client: "Acme", amount: -5 }],
  [
    { tags: ["Client work (Parker)"], duration_minutes: 600 },
    { tags: ["Forsyth Media LLC"], client: "Parker", duration_minutes: 120 },
    { tags: ["Scripture central work"], duration_minutes: 240 },
    { tags: ["Forsyth Media LLC"], duration_minutes: 90 },
    { tags: ["Forsyth Media LLC"], client: "Parker", duration_minutes: 60, is_example: true },
  ]
);
ok("earnings: Parker's pay and hours together", earned.rows[0].client === "Parker" && earned.rows[0].amount === 6500 && earned.rows[0].minutes === 720);
ok("earnings: what it comes to an hour", Math.round(earned.rows[0].perHour) === 542);
ok("earnings: hours with no pay yet still show", earned.rows.some((r) => r.client === "Scripture Central" && r.minutes === 240 && r.perHour === null));
ok("earnings: hours with no client are counted on their own", earned.untaggedMinutes === 90);

const shippedText = reportToText({ ...work, shipped: "The new course intro" });
ok("what I shipped heads the report", /— 7h 20m\n\nSHIPPED\n· The new course intro\n\nDONE/.test(shippedText));
ok("no shipped line, no section", !reportToText(work).includes("SHIPPED") && buildReport({ ...work, shipped: "  " }).shipped === null);

const prac = practiceSummary([
  { tags: ["Temple"], started_at: at(2026, 10, 3, 9).toISOString() },
  { tags: ["Temple"], started_at: at(2026, 10, 3, 14).toISOString() },
  { tags: ["Temple"], started_at: at(2026, 10, 10, 9).toISOString() },
  { tags: ["Exercise"], exercise_kind: "run", started_at: at(2026, 10, 4, 6).toISOString() },
  { tags: ["Exercise"], exercise_kind: "gym", started_at: at(2026, 10, 5, 15).toISOString() },
  { tags: ["Exercise"], started_at: at(2026, 10, 6, 6).toISOString() },
  { tags: ["Sleep"], is_nap: true, started_at: at(2026, 10, 6, 13).toISOString(), duration_minutes: 25 },
  { tags: ["Study"], alertness: "drowsy", started_at: at(2026, 10, 6, 21).toISOString() },
  { tags: ["Study"], started_at: at(2026, 10, 7, 5).toISOString() },
  { tags: ["Temple"], is_example: true, started_at: at(2026, 10, 12, 9).toISOString() },
]);
ok("temple visits are days with a Temple entry", prac.templeVisits === 2);
ok("workouts by kind", prac.exercise.total === 3 && prac.exercise.run === 1 && prac.exercise.gym === 1 && prac.exercise.unsaid === 1);
ok("workouts by time of day", prac.exercise.morning === 2 && prac.exercise.afternoon === 1);
ok("naps with their minutes", prac.naps.count === 1 && prac.naps.minutes === 25);
ok("study by how awake", prac.study.sessions === 2 && prac.study.drowsy === 1 && prac.study.alert === 0);

const askFnT3 = readFileSync(new URL("../supabase/functions/ask/index.ts", import.meta.url), "utf8");
const assistantFnT3 = readFileSync(new URL("../supabase/functions/assistant/index.ts", import.meta.url), "utf8");
for (const col of ["is_nap", "exercise_kind", "exercise_metric", "exercise_unit", "alertness", "client text", "shipped text", "sabbath_note", "fast_sunday", "left_reason", "intent text", "body_metrics"]) {
  ok(`Ask's schema notes know ${col}`, askFnT3.includes(col));
  ok(`the assistant's schema notes know ${col}`, assistantFnT3.includes(col));
}
ok("Ask counts temple visits as days", askFnT3.includes("distinct days with a Temple entry"));
ok("Ask knows the savings rate", askFnT3.includes("savings rate"));
const mig3 = readFileSync(new URL("../supabase/migrations/0071_honest_lightweight.sql", import.meta.url), "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");
ok("tier 3's migration only adds", !/\bdrop\b|\bdelete\s+from\b|\bupdate\s+public\.|\btruncate\b/i.test(mig3) && /add column if not exists is_nap/.test(mig3));
}

// --- The weekly mirror ---------------------------------------------------------
{
console.log("\nthe weekly mirror");
const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi);
const iso = (...a) => at(...a).toISOString();
// The sentences use non-breaking spaces inside "7 h 10 m"; compare plainly.
const plain = (s) => String(s ?? "").replace(/\u00a0/g, " ");
const has = (section, line) => (section?.lines ?? []).some((l) => plain(l) === line);
const week = "2026-10-04";
const days = weekDates(week);

ok("the mirror opens on the last whole week", lastWeekStart("2026-10-18") === "2026-10-11" && lastWeekStart("2026-10-15") === "2026-10-04" && lastWeekStart("2026-10-17") === "2026-10-04");
ok("a week is Sunday to Saturday", days.length === 7 && days[0] === "2026-10-04" && days[6] === "2026-10-10");
ok("lists read as a sentence", andList(["a"]) === "a" && andList(["a", "b"]) === "a and b" && andList(["a", null, "b", "c"]) === "a, b and c");
ok("hours: whole from ten up, hours and minutes below", plain(mirrorHours(3000)) === "50 h" && plain(mirrorHours(148)) === "2 h 28 m");
ok("bold pieces for the page", JSON.stringify(pieces("You slept **7 h** a night.")) === JSON.stringify([{ text: "You slept ", bold: false }, { text: "7 h", bold: true }, { text: " a night.", bold: false }]));

// Nights: noon to noon, naps and samples left out, the check-in first.
const sleep = (from, to, extra = {}) => ({ tags: ["Sleep"], started_at: iso(...from), ended_at: iso(...to), duration_minutes: (at(...to) - at(...from)) / 60000, ...extra });
const sleeps = [
  sleep([2026, 10, 3, 22, 0], [2026, 10, 4, 6, 0]),
  sleep([2026, 10, 4, 21, 30], [2026, 10, 5, 4, 40]),
  sleep([2026, 10, 5, 5, 0], [2026, 10, 5, 6, 0]),
  sleep([2026, 10, 5, 14, 0], [2026, 10, 5, 14, 30], { is_nap: true }),
  sleep([2026, 10, 6, 23, 10], [2026, 10, 7, 5, 20]),
  sleep([2026, 10, 7, 22, 0], [2026, 10, 8, 7, 0], { is_example: true }),
];
const plansByDate = {
  "2026-10-05": { alarm_at: "04:30:00", mood: 4, energy: "high", stress: 2 },
  "2026-10-06": { mood: 2, energy: "low", stress: 4, stress_source: "Work" },
  "2026-10-07": { alarm_at: "04:30:00", mood: 3, energy: "high" },
  "2026-10-09": { alarm_at: "06:30:00", woke_at: iso(2026, 10, 9, 4, 35), lights_out_at: iso(2026, 10, 8, 20, 5) },
};
const nights = nightsOf(days, sleeps, plansByDate);
const night = (d) => nights.find((x) => x.date === d);
ok("a night runs noon to noon: Saturday night is Sunday's", night("2026-10-04").sleepMinutes === 480);
ok("going back to sleep counts toward the night, and is noted", night("2026-10-05").sleepMinutes === 490 && night("2026-10-05").backToSleep === true);
ok("a nap is never the night", night("2026-10-06").sleepMinutes == null);
ok("sample sleep is left out", night("2026-10-08").sleepMinutes == null);
ok("the morning check-in wins over the timers", night("2026-10-09").woke.getHours() === 4 && night("2026-10-09").woke.getMinutes() === 35 && night("2026-10-09").sleepMinutes === 510);

ok("a wake-up habit's time is read from its name", wakeHabitTime("Up at 4:30") === "04:30" && wakeHabitTime("Wake up at 4.45am") === "04:45" && wakeHabitTime("Up on time") === null);
ok("which habits are getting up", isWakeHabit("Up on time") && isWakeHabit("Get up") && isWakeHabit("Wake up early") && !isWakeHabit("Cleanup") && !isWakeHabit("Run"));

// Early days: an alarm at 5:00 or before, or a wake habit that names one.
const wl = [
  { kind: "loss", habit_label: "Up at 4:30", reason: "Late night", occurred_at: iso(2026, 10, 7, 6) },
  { kind: "win", habit_label: "Up at 4:30", occurred_at: iso(2026, 10, 10, 4, 50) },
  { kind: "win", habit_label: "Up at 4:30", occurred_at: iso(2026, 10, 8, 4, 50), is_example: true },
];
const early = earlyDaysOf(days, plansByDate, wl, []);
ok("early days: 4:30 alarms and a logged 'Up at 4:30', not a 6:30 alarm or a sample", Object.keys(early).sort().join() === "2026-10-05,2026-10-07,2026-10-10");
ok("up is due fifteen minutes after the alarm", early["2026-10-05"].due === 285);
ok("a watched habit's own minute wins", earlyDaysOf(days, plansByDate, [], [{ on_alarm: "04:30:00", due_by: "05:00:00", active: true }])["2026-10-05"].due === 300);
const outcomes = wakeOutcomes(early, nights, wl);
ok("kept by waking in time", outcomes["2026-10-05"].kept === true);
ok("a logged miss decides it, with its reason", outcomes["2026-10-07"].kept === false && outcomes["2026-10-07"].reason === "Late night");
ok("a logged win decides it with no sleep tracked", outcomes["2026-10-10"].kept === true);

const morn = mornings({ days, nights, early, outcomes, upTo: "2026-10-10" });
ok("mornings: up on time, out of the early days", has(morn, "You were up by **4:45 am** on **2 of 3** early days."));
ok("mornings: the miss, with why", has(morn, "Missed on Wednesday (late night, lights out 11:10 pm)."));
ok("mornings: lights out before 4:30 days against its target", has(morn, "Before 4:30 days, lights out averaged **10:20 pm**, against an 8:00 pm target."));
ok("mornings: sleep on 4:30 days against the others", has(morn, "On 4:30 days you slept **7 h 10 m**. On the others, **8 h 15 m**."));
ok("mornings: going back to sleep", has(morn, "One morning you went back to sleep after waking."));
ok("mornings: untracked nights named by their evening", has(morn, "Monday, Wednesday and Friday nights have no sleep tracked."));
const nightBar = morn.chart.points.find((p) => p.date === "2026-10-05");
ok("the night chart runs past midnight, with the alarm", nightBar.out === 21 * 60 + 30 && nightBar.wake === 1440 + 4 * 60 + 40 && nightBar.alarm === 1440 + 270);

// Work.
const fam = familyLookup([{ name: "Forsyth Media LLC", family: "Work" }, { name: "Date", family: "People" }, { name: "Meet", family: "People" }, { name: "Odd job", family: null, is_work: true }]);
ok("families: yours first, marked-as-work counts, case aside", fam("Odd job") === "Work" && fam("date") === "People" && fam("Sleep") !== "Work");
const work = [
  { tags: ["Forsyth Media LLC"], depth: "deep", client: "Parker", started_at: iso(2026, 10, 5, 6), ended_at: iso(2026, 10, 5, 10), duration_minutes: 240 },
  { tags: ["Forsyth Media LLC"], depth: "shallow", started_at: iso(2026, 10, 5, 13), ended_at: iso(2026, 10, 5, 14), duration_minutes: 60 },
  { tags: ["Forsyth Media LLC"], started_at: iso(2026, 10, 6, 9), ended_at: iso(2026, 10, 6, 11), duration_minutes: 120 },
  { tags: ["Forsyth Media LLC"], depth: "deep", is_example: true, started_at: iso(2026, 10, 6, 12), ended_at: iso(2026, 10, 6, 20), duration_minutes: 480 },
];
const target = { label: "Forsyth Media", categories: ["Forsyth Media LLC"], minutes: 3600, period: "week" };
const ww = workWeek({ days, entries: work, familyOf: fam, targets: [target], early, upTo: "2026-10-10" });
ok("work against its weekly target, samples aside", has(ww, "Forsyth Media got **7 h** of its 60 h."));
ok("deep and shallow, and what wasn't marked", has(ww, "Of **7 h** of work, **4 h** went to deep work and **1 h** to shallow (2 h not marked)."));
ok("a lone client", has(ww, "Parker had **4 h** of it."));
ok("early days against the other workdays", has(ww, "On 4:30 days you worked **1 h 40 m** a day; on other workdays, **40 m**."));
ok("a daily work target is read for its week", has(workWeek({ days, entries: work, familyOf: fam, targets: [{ ...target, label: "Deep work", period: "day", minutes: 240, weekly_minutes: 1440 }], upTo: "2026-10-10" }), "Deep work got **7 h** of its 24 h."));
ok("no work, no work card", workWeek({ days, entries: [], familyOf: fam, upTo: "2026-10-10" }) === null);

// People.
const together = [
  { tags: ["Date"], people: ["Zimi"], people_feel: "life_giving", started_at: iso(2026, 10, 5, 19), ended_at: iso(2026, 10, 5, 22), duration_minutes: 180 },
  { tags: ["Meet"], people: ["zimi", "AJ"], people_feel: "draining", started_at: iso(2026, 10, 6, 12), ended_at: iso(2026, 10, 6, 13), duration_minutes: 60 },
  { tags: ["Meet"], started_at: iso(2026, 10, 7, 12), ended_at: iso(2026, 10, 7, 13), duration_minutes: 60 },
];
const pw = peopleWeek({ entries: together, familyOf: fam });
ok("people: the time and the stretches", has(pw, "**5 h** with people, across **3** stretches."));
ok("people: who, once each whatever the case", has(pw, "Most of it was with **Zimi** (4 h) and **AJ** (1 h)."));
ok("people: how it felt", has(pw, "Of the 2 you rated, **1** felt life-giving and **1** draining."));
ok("people: with no names, the kinds of time", has(peopleWeek({ entries: together.map(({ people, people_feel, ...e }) => e), familyOf: fam }), "Mostly Date (**3 h**) and Meet (**2 h**)."));

// Wins and misses.
const mw = missesWeek({
  winLosses: [
    { kind: "win", habit_label: "Run" },
    { kind: "win", habit_label: "Floss" },
    { kind: "loss", habit_label: "Up at 4:30", reason: "Late night" },
    { kind: "loss", habit_label: "up at 4:30", reason: "Snoozed" },
    { kind: "loss", habit_label: "Loss", reason: "late night" },
    { kind: "loss", habit_label: "Phone", is_example: true },
  ],
});
ok("misses: counted, samples aside", has(mw, "**2** wins and **3** misses logged."));
ok("misses: by habit, with the unnamed ones", has(mw, "Missed: Up at 4:30 twice, and 1 without a name."));
ok("misses: the reasons, most first", has(mw, "Reasons you gave: late night (2) and snoozed."));
ok("no misses is said plainly", has(missesWeek({ winLosses: [{ kind: "win", habit_label: "Run" }] }), "**1** win logged, and no misses."));
ok("unnamed misses aren't called 'Loss'", has(missesWeek({ winLosses: [{ kind: "loss", habit_label: "Loss" }, { kind: "loss", habit_label: "" }] }), "Both were logged without a name."));

// Mood and energy.
const md = moodWeek({ days, plansByDate: { ...plansByDate, "2026-10-08": { mood: 1, is_example: true } }, upTo: "2026-10-07" });
ok("mood: its range and the lowest day, up to today", has(md, "Mood ran from **2** to **4**, lowest on Tuesday."));
ok("energy: counted by level", has(md, "Energy was high on **2** days and low on **1**."));
ok("stress: the highest day and where it came from", has(md, "Stress was highest on Tuesday, at **4**, from work."));
ok("mood chart: one point a day, none past today", md.chart.points.length === 7 && md.chart.points[1].mood === 4 && md.chart.points[4].mood === null);

// Focus goals.
const fm = focusMirror({
  goals: [{ id: "g1", title: "Up at 4:30", position: 0 }, { id: "g2", title: "Plan the day", position: 1 }],
  checkins: [{ goal_id: "g1", date: "2026-10-05", moved: true }, { goal_id: "g1", date: "2026-10-06", moved: false }, { goal_id: "g2", date: "2026-10-05", moved: true }],
  weekStart: week,
});
ok("focus: moved out of the check-ins answered", has(fm, "Your focus goals moved on **2 of 3** check-ins."));
ok("focus: each goal's seven days", fm.goals.length === 2 && fm.goals[0].days.length === 7 && fm.goals[0].days[2].moved === false);
ok("focus: goals with no check-ins say so", has(focusMirror({ goals: [{ id: "g1", title: "x" }], checkins: [], weekStart: week }), "Your focus goal has no check-ins this week."));

// Money.
const money = moneyWeek({
  txns: [
    { amount: -700, budget_id: "rent", posted_at: iso(2026, 10, 1, 12), reviewed_at: "x" },
    { amount: -50, budget_id: "groc", intent: "impulse", posted_at: iso(2026, 10, 5, 12), reviewed_at: "x" },
    { amount: -30, purchase_kind: "Gas", posted_at: iso(2026, 10, 6, 12), reviewed_at: "x" },
    { amount: -20, posted_at: iso(2026, 10, 7, 12), reviewed_at: null },
    { amount: -100, is_business: true, posted_at: iso(2026, 10, 8, 12), reviewed_at: "x" },
    { amount: -500, is_transfer: true, posted_at: iso(2026, 10, 8, 12) },
    { amount: 900, posted_at: iso(2026, 10, 9, 12) },
    { amount: -40, budget_id: "groc", posted_at: iso(2026, 10, 12, 12), reviewed_at: "x" },
  ],
  budgets: [
    { id: "rent", name: "Rent", monthly_limit: 700 },
    { id: "groc", name: "Groceries", monthly_limit: 300 },
    { id: "fun", name: "Fun", monthly_limit: 100 },
    { id: "old", name: "Old", monthly_limit: 50, archived: true },
  ],
  weekStart: week,
  upTo: "2026-10-10",
});
ok("money: the week's spending and what it went to", has(money, "You spent **$100**, most on Groceries ($50) and Gas ($30)."));
ok("money: impulse", has(money, "**$50** of it was impulse."));
ok("money: what's still to sort", has(money, "**1** purchase ($20) is still to sort."));
ok("money: business on its own line", has(money, "Business spending: **$100**."));
ok("budgets: the month as the week left it, untouched ones left out", money.budgets.map((g) => `${g.name}:${g.spent}`).join() === "Rent:700,Groceries:50");
ok("budgets: the mark at the week's end in the month", Math.abs(money.progress - 10 / 31) < 1e-9 && money.asOf === "2026-10-10");

// Body and practice, with the weight's trend.
const weighIns = [
  { value: 183.2, date: "2026-09-20", measured_at: iso(2026, 9, 20, 7) },
  { value: 181.4, date: "2026-10-05", measured_at: iso(2026, 10, 5, 7) },
  { value: 181.0, date: "2026-10-05", measured_at: iso(2026, 10, 5, 21) },
  { value: 180.6, date: "2026-10-09", measured_at: iso(2026, 10, 9, 7) },
  { value: 150, date: "2026-10-08", measured_at: iso(2026, 10, 8, 7), is_example: true },
];
ok("weight trend: one point a day, its last, samples aside", JSON.stringify(weightTrend(weighIns)) === JSON.stringify([{ date: "2026-09-20", value: 183.2 }, { date: "2026-10-05", value: 181 }, { date: "2026-10-09", value: 180.6 }]));
const body = practiceWeek({
  entries: [
    { tags: ["Temple"], started_at: iso(2026, 10, 6, 10), ended_at: iso(2026, 10, 6, 12) },
    { tags: ["Exercise"], exercise_kind: "run", started_at: iso(2026, 10, 7, 6), ended_at: iso(2026, 10, 7, 7) },
  ],
  weights: weighIns.slice(1),
  trend: weighIns,
});
ok("practice: temple and workouts", has(body, "**1** temple visit and **1** workout (1 run)."));
ok("practice: the week's weigh-ins", has(body, "Weight went from 181.4 to **180.6 lb** across 3 weigh-ins."));
ok("practice: the trend, when the week has a weigh-in", body.chart?.weights.length === 3);
ok("practice: no trend without one this week", practiceWeek({ entries: [{ tags: ["Temple"], started_at: iso(2026, 10, 6, 10), ended_at: iso(2026, 10, 6, 12) }], weights: [], trend: weighIns }).chart === null);

// The whole week: samples nowhere, the week under way counted to today.
const whole = buildMirror({
  weekStart: week,
  today: "2026-10-07",
  dayPlans: [
    { date: "2026-10-05", mood: 4, energy: "okay" },
    { date: "2026-10-06", mood: 1, energy: "low", is_example: true },
  ],
  entries: [...sleeps, ...work, ...together],
  winLosses: [...wl, { kind: "win", habit_label: "Run", occurred_at: iso(2026, 10, 5, 7) }, { kind: "loss", habit_label: "Run", occurred_at: iso(2026, 10, 9, 7) }],
  watched: [],
  goals: [],
  checkins: [],
  txns: [],
  budgets: [],
  targets: [target],
  categories: [{ name: "Forsyth Media LLC", family: "Work" }, { name: "Date", family: "People" }, { name: "Meet", family: "People" }],
  weights: [],
});
const part = (key) => whole.sections.find((s) => s.key === key);
ok("a week under way is counted to today", whole.current === true && whole.upTo === "2026-10-07");
ok("the parts in reading order, empty ones left out", whole.sections.map((s) => s.key).join() === "mornings,work,people,misses,mood,practice");
ok("the nap shows under practice, not as a night", has(part("practice"), "**1** nap."));
ok("a sample day's mood never shows", has(part("mood"), "Mood was **4** on Monday, the one day you rated it."));
ok("a miss after today isn't counted yet", has(part("misses"), "**1** win and **1** miss logged."));
ok("work after today isn't counted yet", has(part("work"), "Forsyth Media got **7 h** of its 60 h."));
ok("a finished week isn't 'so far'", buildMirror({ weekStart: week, today: "2026-10-12" }).current === false);
ok("an empty week has nothing to show", buildMirror({ weekStart: week, today: "2026-10-12" }).sections.length === 0);
}

// --- Old timers that ran through the night ------------------------------------
{
console.log("\nold timers that ran through the night");
const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi);
const iso = (...a) => at(...a).toISOString();
const same = (a, b) => a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
const timer = (id, tags, from, to, more = {}) => ({ id, tags, description: more.description ?? null, started_at: iso(...from), ended_at: to ? iso(...to) : null, ended_by: null, is_example: false, ...more });

const prep = timer("prep", ["Prep"], [2026, 9, 8, 21, 46], [2026, 9, 9, 5, 52], { description: "Prep for bed" });
ok("a bedtime timer stopped the next morning ran through the night", ranThroughNight(prep));
ok("one already looked at isn't offered again", !ranThroughNight({ ...prep, ended_by: "stop" }) && !ranThroughNight({ ...prep, ended_by: "overnight_fix" }));
ok("sample entries are never offered", !ranThroughNight({ ...prep, is_example: true }));
ok("Sleep is never offered", !ranThroughNight({ ...prep, tags: ["Sleep"] }));
ok("a running timer is the live card's, not the list's", !ranThroughNight({ ...prep, ended_at: null }));
ok("a date that ran just past midnight isn't a runaway", !ranThroughNight(timer("date", ["Date"], [2026, 10, 7, 18, 17], [2026, 10, 8, 0, 16])));
ok("a long work day isn't either", !ranThroughNight(timer("work", ["Forsyth Media LLC"], [2026, 10, 5, 7, 41], [2026, 10, 5, 18, 18])));
ok("an hour awake in the small hours isn't", !ranThroughNight(timer("up", ["Study"], [2026, 10, 5, 2, 30], [2026, 10, 5, 3, 30])));
const temple = timer("temple", ["Prep"], [2026, 10, 10, 13, 33], [2026, 10, 11, 7, 19], { description: "Prep for temple" });
ok("an afternoon timer that ran to the next morning is", ranThroughNight(temple));

const usual = "22:28";
ok("bedtime routine: asleep half an hour in", same(overnightSleepStart(prep, usual), at(2026, 9, 8, 22, 16)));
ok("an hour before lights-out is still the routine",
  same(overnightSleepStart(timer("p2", ["Prep"], [2026, 9, 13, 21, 17], [2026, 9, 14, 5, 37]), usual), at(2026, 9, 13, 21, 47)));
ok("started after your usual lights-out: half an hour in",
  same(overnightSleepStart(timer("p3", ["Prep"], [2026, 9, 11, 22, 46], [2026, 9, 12, 7, 27]), usual), at(2026, 9, 11, 23, 16)));
ok("an evening timer left going: your usual lights-out",
  same(overnightSleepStart(timer("r", ["Reflect", "Plan"], [2026, 9, 24, 20, 40], [2026, 9, 25, 5, 13]), usual), at(2026, 9, 24, 22, 28)));
ok("an afternoon timer: lights-out that night, not half an hour in", same(overnightSleepStart(temple, usual), at(2026, 10, 10, 22, 28)));
const chess = timer("chess", ["Minister"], [2026, 10, 3, 17, 38], [2026, 10, 4, 8, 59], { description: "Chess with AJ" });
ok("a lights-out after midnight is that night's small hours", same(overnightSleepStart(chess, "00:30"), at(2026, 10, 4, 0, 30)));
ok("no sleep on record: half an hour in", same(overnightSleepStart(chess, null), at(2026, 10, 3, 18, 8)));
ok("a timer started after midnight: half an hour in",
  same(overnightSleepStart(timer("late", ["Study"], [2026, 10, 5, 0, 40], [2026, 10, 5, 6, 0]), usual), at(2026, 10, 5, 1, 10)));

// Sleep logged that night anyway: the timer ran alongside it.
const ranOn = timer("ranOn", ["Prep"], [2026, 9, 9, 23, 17], [2026, 9, 10, 6, 57], { description: "prep for bed" });
const slept = timer("slept", ["Sleep"], [2026, 9, 9, 23, 37], [2026, 9, 10, 6, 57]);
const along = planOvernightFix(ranOn, [slept], usual);
ok("Sleep logged anyway: it ends when Sleep began", along.kind === "alongside" && same(along.end, at(2026, 9, 9, 23, 37)) && along.endedFor.id === "slept");
ok("and no second Sleep is added", along.sleepFrom === undefined && overnightProblem(along) === null);

const reflection = timer("refl", ["Reflect"], [2026, 9, 6, 20, 41], [2026, 9, 7, 7, 50], { description: "End of day reflection" });
const evening = [
  timer("bedprep", ["Prep"], [2026, 9, 6, 21, 27], [2026, 9, 6, 21, 44], { description: "Prep for bed" }),
  timer("night", ["Sleep"], [2026, 9, 6, 21, 44], [2026, 9, 7, 7, 29]),
  timer("upprep", ["Prep"], [2026, 9, 7, 7, 32], [2026, 9, 7, 7, 50], { description: "Up and prep" }),
];
const refl = planOvernightFix(reflection, evening, usual);
ok("it ends when the next thing began, even before Sleep", refl.kind === "alongside" && same(refl.end, at(2026, 9, 6, 21, 27)) && refl.endedFor.description === "Prep for bed");

// Fell asleep with it going.
const asleep = planOvernightFix(prep, [timer("dating", ["Social activity"], [2026, 9, 8, 21, 23], [2026, 9, 8, 21, 53])], usual);
ok("asleep: it ends where sleep began", asleep.kind === "asleep" && same(asleep.end, at(2026, 9, 8, 22, 16)) && same(asleep.sleepFrom, asleep.end));
ok("and Sleep runs until the timer was stopped", same(asleep.sleepUntil, at(2026, 9, 9, 5, 52)) && !asleep.wokeFor && !asleep.endedFor);
ok("something that began before it doesn't count", overnightProblem(asleep) === null);

const symposium = timer("sym", ["Symposium (group goal meeting)"], [2026, 10, 4, 7, 10], [2026, 10, 4, 9, 10]);
const chessFix = planOvernightFix(chess, [symposium], usual);
ok("an evening left running sleeps from your usual lights-out", chessFix.kind === "asleep" && same(chessFix.sleepFrom, at(2026, 10, 3, 22, 28)));
ok("and wakes when the first thing of the morning began", same(chessFix.sleepUntil, at(2026, 10, 4, 7, 10)) && chessFix.wokeFor.id === "sym");

const napped = planOvernightFix(temple, [timer("nap", ["Sleep"], [2026, 10, 10, 15, 0], [2026, 10, 10, 15, 30], { is_nap: true })], usual);
ok("a nap isn't the night's sleep", napped.kind === "asleep");
ok("but the timer ends when the nap began", same(napped.end, at(2026, 10, 10, 15, 0)) && napped.endedFor.id === "nap" && same(napped.sleepFrom, at(2026, 10, 10, 22, 28)));
ok("sample entries don't shape a fix", planOvernightFix(ranOn, [{ ...slept, is_example: true }], usual).kind === "asleep");

const later = withSleepFrom(chessFix, at(2026, 10, 3, 23, 30));
ok("moving the time moves the end with it", same(later.end, at(2026, 10, 3, 23, 30)) && same(later.sleepUntil, at(2026, 10, 4, 7, 10)) && overnightProblem(later) === null);
ok("asleep after the timer stopped can't be saved", overnightProblem(withSleepFrom(chessFix, at(2026, 10, 4, 9, 30))) !== null);
ok("asleep after the morning's first entry runs to the stop", same(withSleepFrom(chessFix, at(2026, 10, 4, 7, 30)).sleepUntil, at(2026, 10, 4, 8, 59)));

const mig = readFileSync(new URL("../supabase/migrations/0072_overnight_fix.sql", import.meta.url), "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");
const outsideFn = mig.replace(/\$\$[\s\S]*?\$\$/g, "");
ok("the migration only adds a column and a function", /add column if not exists original_ended_at/.test(mig) && !/\bdrop\b|\bdelete\b|\bupdate\b|\btruncate\b/i.test(outsideFn));
ok("the fix runs as you, under row-level security", /security invoker/.test(mig) && /grant execute on function public\.fix_overnight_timer/.test(mig));
ok("a fix keeps the end it had", /set original_ended_at = v\.ended_at/.test(mig));
const askFn = readFileSync(new URL("../supabase/functions/ask/index.ts", import.meta.url), "utf8");
const assistantFn = readFileSync(new URL("../supabase/functions/assistant/index.ts", import.meta.url), "utf8");
ok("Ask knows original_ended_at", askFn.includes("original_ended_at timestamptz") && askFn.includes("ran past 3:00 with ended_by null"));
ok("the assistant knows original_ended_at", assistantFn.includes("original_ended_at timestamptz") && assistantFn.includes("ran past 3:00 with ended_by null"));
}

// --- Ascent: the goals page ------------------------------------------------------
{
console.log("\nascent");
ok("zones climb with the share of days walked", zoneOf(0) === "trail" && zoneOf(3) === "foot" && zoneOf(35) === "switch" && zoneOf(69) === "switch" && zoneOf(70) === "ridge");

const index = stepIndex([
  { tag: "Draw", days: ["2026-10-01", "2026-10-17"], last_day: "2026-10-17" },
  { tag: "draw ", days: ["2026-10-02"], last_day: "2026-10-02" },
  { tag: "Serve", days: ["2026-10-17", "2026-10-18"], last_day: "2026-10-18" },
  { tag: "Minister", days: ["2026-10-18", "2026-10-19"], last_day: "2026-10-19" },
  { tag: "Painting", days: [], last_day: "2026-06-01" },
]);
const drawn = focusSteps({ categories: ["DRAW"] }, index);
ok("categories match however they're typed", drawn.days.size === 3 && drawn.last === "2026-10-17");
const served = focusSteps({ categories: ["Serve", "Minister"] }, index);
ok("a day with two of a focus's categories is one footprint", served.days.size === 3 && served.last === "2026-10-19");
ok("a focus with no logged category has no steps", focusSteps({ categories: ["Chess"] }, index).days.size === 0);

ok("the line under a goal says what feeds it", fedLine({ focuses: [{ name: "Drawing" }], count: 2, last: "2026-10-17" }) === `Drawing · 2 of ${WINDOW_DAYS} days`);
ok("two focuses read as a list", fedLine({ focuses: [{ name: "Serving" }, { name: "Ministering" }], count: 1, last: "2026-10-19" }).startsWith("Serving and Ministering"));
ok("a quiet focus says when it was last walked, not that it failed", /none logged since/.test(fedLine({ focuses: [{ name: "Painting" }], count: 0, last: "2026-06-01" })));
ok("a goal with nothing feeding it says so plainly", fedLine({ focuses: [], count: 0, last: null }) === "No focus yet");
ok("short names drop the 'highly'", shortGoal("Highly in tune with God") === "In tune with God" && shortGoal("be highly skilled") === "Skilled");
ok("each goal gets its gear", gearFor("Highly selfless") === "rope" && gearFor("Highly disciplined") === "boot" && gearFor("Highly in tune with God") === "compass" && gearFor("Highly educated") === "map" && gearFor("Highly skilled") === "axe" && gearFor("Something new") === "tent");

const camps = [
  { id: "c2", position: 1, title: "Beta", reached_on: null },
  { id: "c1", position: 0, title: "Prototype", reached_on: "2026-10-10" },
  { id: "c3", position: 2, title: "Launch", reached_on: "2026-10-12" },
];
const st = questState({ status: "on" }, camps);
ok("camps are climbed in order", st.camps.map((c) => c.id).join() === "c1,c2,c3" && st.reached === 1 && st.next.id === "c2");
ok("a camp ticked out of order doesn't skip the one below it", !st.atSummit && !st.done);
const top = questState({ status: "on" }, camps.map((c) => ({ ...c, reached_on: "2026-10-12" })));
ok("with every camp reached, only the summit is left", top.next === null && top.atSummit && !top.done);
ok("a quest with no camps goes straight for the summit", questState({ status: "on" }, []).atSummit);
ok("a done quest is at the top", questState({ status: "done" }, camps).done && questState({ status: "done" }, camps).next === null);

let spaced = true;
let growing = true;
let prevH = 0;
for (let n = 0; n <= 14; n++) {
  const g = questLayout(n);
  if (g.H < prevH) growing = false;
  prevH = g.H;
  const ys = g.turns.map((t) => t[1]);
  for (let i = 1; i < ys.length; i++) if (!(ys[i] < ys[i - 1])) spaced = false;
  // Labels on the same side of the trail sit two camps apart.
  for (let i = 3; i < g.turns.length - 1; i++) if (g.turns[i - 2][1] - g.turns[i][1] < 20) spaced = false;
  if (g.turns[g.turns.length - 2][1] - g.turns[g.turns.length - 1][1] < 14) spaced = false;
}
ok("the trail always climbs, and camp labels never sit on each other", spaced);
ok("many camps make a taller mountain", growing && questLayout(12).H > questLayout(3).H);

const turnAt = [0, 0.25, 0.5, 0.75, 1];
ok("the climber stands just past the last camp reached", Math.abs(climberAt({ reached: 1, done: false }, turnAt) - 0.32) < 1e-9);
ok("and at the top once the quest is done", climberAt({ reached: 0, done: true }, turnAt) === 1);

const lesson = { id: "L", title: "More integrity", started_on: "2026-10-14" };
const week = lessonWeek(lesson, new Map([["2026-10-15", true], ["2026-10-16", false], ["2026-10-19", true]]), "2026-10-19");
ok("the week runs Sunday to Saturday", week[0].date === "2026-10-18" && week[6].date === "2026-10-24" && week.map((d) => d.letter).join("") === "SMTWTFS");
ok("today is marked, the rest of the week is ahead", week[1].isToday && week[1].kept === true && week[2].ahead && !week[0].ahead);
const late = lessonWeek({ ...lesson, started_on: "2026-10-20" }, new Map(), "2026-10-21");
ok("days before a lesson began aren't counted as missed", late[0].before && late[1].before && !late[2].before && late[2].kept === null);
ok("the note counts days from the start", lessonNote(lesson, true, "2026-10-19") === "Day 6 · kept today");
ok("a slip is noted without a scolding", lessonNote(lesson, false, "2026-10-19") === "Day 6 · slipped today, and that's noted");
ok("no answer yet asks for one tonight", lessonNote(lesson, null, "2026-10-14") === "Day 1 · check in tonight");

const today = "2026-10-19";
const view = buildAscent(
  {
    mission: { statement: "To become a trusted servant", summit: "A trusted servant" },
    goals: [
      { id: "g2", title: "Highly selfless", created_at: "2026-02-02" },
      { id: "g1", title: "Highly skilled", created_at: "2026-01-01" },
    ],
    focuses: [
      { id: "f1", goal_id: "g1", name: "Drawing", categories: ["Draw"], position: 0 },
      { id: "f2", goal_id: "g2", name: "Serving and ministering", categories: ["Serve", "Minister"], position: 1 },
    ],
    quests: [
      { id: "q1", title: "Build the best Premiere Pro plugin", goal_id: "g1", status: "on", position: 0 },
      { id: "q0", title: "Finish the course", goal_id: null, status: "done", finished_on: "2026-09-01", position: 1 },
      { id: "q9", title: "Learn the cello", goal_id: "gone", status: "set_aside", position: 2 },
    ],
    camps: [{ id: "c1", quest_id: "q1", title: "Prototype", position: 0, reached_on: null }],
    lessons: [
      { id: "l1", title: "Stop drinking caffeine", goal_id: "g2", status: "learning", started_on: "2026-10-19", position: 0 },
      { id: "l2", title: "Patience", goal_id: null, status: "learned", started_on: "2026-08-01", position: 1 },
    ],
    checkins: [{ lesson_id: "l1", date: today, kept: true }],
    steps: [
      { tag: "Draw", days: ["2026-10-17", "2026-10-02"], last_day: "2026-10-17" },
      { tag: "Serve", days: ["2026-10-19"], last_day: "2026-10-19" },
      { tag: "Minister", days: ["2026-10-19", "2026-10-18"], last_day: "2026-10-19" },
    ],
  },
  today
);
ok("lifetime goals keep the order they were made in", view.goals.map((g) => g.id).join() === "g1,g2");
const made = "2026-08-27T21:03:25Z";
const ordered = buildAscent({ goals: ["Highly disciplined", "Highly educated", "Highly in tune with God", "Highly selfless", "Highly skilled"].map((title) => ({ id: title, title, created_at: made })) }, today);
ok("goals made together read in the order Aaron names them", ordered.goals.map((g) => g.short).join() === "Skilled,In tune with God,Educated,Selfless,Disciplined");
ok("a goal's footprints are its focuses' days", view.goals[0].count === 2 && view.goals[1].count === 2 && view.goals[1].prints.length === WINDOW_DAYS);
ok("today's footprint is the last one", view.goals[1].prints[WINDOW_DAYS - 1] === true && view.goals[0].prints[WINDOW_DAYS - 1] === false);
ok("the climber is as high as the goals are strong on average", Math.abs(view.climb - (7 + 7) / 2 / 100) < 1e-9);
ok("a quest's tag names the goal it serves", view.quests.length === 1 && view.quests[0].serves.label === "Skilled" && view.quests[0].serves.gear === "axe");
ok("a goal lists the quest that serves it", view.goals[0].quests.map((q) => q.id).join() === "q1");
ok("a finished quest becomes a patch", view.patches.map((q) => q.id).join() === "q0" && view.patches[0].serves.kind === "mission");
ok("a set-aside quest whose goal is gone serves the mission", view.setAside[0].serves.kind === "mission");
ok("a lesson shows today's answer", view.lessons.length === 1 && view.lessons[0].today === true && view.lessons[0].note === "Day 1 · kept today");
ok("learned lessons are kept apart", view.learned.map((l) => l.id).join() === "l2");
ok("nothing loaded is an empty mountain, not a crash", buildAscent(null, today).goals.length === 0 && buildAscent(null, today).climb === 0);
ok("the window ends today", windowDays(today).at(-1) === today && windowDays(today).length === WINDOW_DAYS);

const mig = readFileSync(new URL("../supabase/migrations/0074_ascent.sql", import.meta.url), "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");
const tables = ["missions", "focuses", "quests", "quest_camps", "lessons", "lesson_checkins"];
ok("every Ascent table has row-level security", tables.every((t) => new RegExp(`alter table public\\.${t} enable row level security`).test(mig)));
ok("and is yours alone", tables.every((t) => new RegExp(`create policy "[^"]+" on public\\.${t}\\s+for all to authenticated\\s+using \\(user_id = auth\\.uid\\(\\)\\)`).test(mig)));
ok("nothing is open to signed-out visitors", /revoke all on[\s\S]*from anon/.test(mig) && !/grant[^;]*\bto anon\b/i.test(mig));
ok("the footprints function runs as you, on the phone's day", /function public\.ascent_steps\(p_today date/.test(mig) && /security invoker/.test(mig) && !/current_date/.test(mig));
ok("only signed-in users can call it", /grant execute on function public\.ascent_steps[^;]*to authenticated/.test(mig) && /revoke all on function public\.ascent_steps[^;]*from public/i.test(mig));
ok("the migration drops nothing", !/\bdrop\b|\btruncate\b|\bdelete\s+from\b/i.test(mig));
}

console.log("\nthe mark");
{
  ok("all Yes is a bullseye", levelFrom([2, 2, 2]) === 0);
  ok("all No is a miss", levelFrom([0, 0]) === 5);
  ok("one Some in three is the inner ring", levelFrom([1, 2, 2]) === 1);
  ok("half done is the middle", levelFrom([2, 0]) === 2 && levelFrom([1]) === 2);
  ok("a little done stays on the face, at the edge", levelFrom([1, 0, 0]) === 4);
  ok("a quarter done is the outer ring", levelFrom([2, 0, 0, 0]) === 3);
  ok("nothing answered yet has no ring", levelFrom([]) === null && levelFrom([2, null]) === null);

  const p1 = placement("shot-1", 2, 1);
  const p2 = placement("shot-1", 2, 1);
  ok("a mark always sits in the same spot", p1.x === p2.x && p1.y === p2.y);
  const rr = Math.hypot(p1.x, p1.y);
  ok("a mark sits inside its own ring", rr >= LEVELS[2].r0 - 0.1 && rr <= LEVELS[2].r1 + 0.1);
  ok("a miss sits in its section (bottom right)", p1.x > 0 && p1.y > 0);
  const tl = placement("shot-2", 4, 3);
  ok("and top left is the last section", tl.x < 0 && tl.y < 0);
  let allIn = true;
  for (let i = 0; i < 200; i++) {
    const lv = i % 6;
    const q = placement(`s${i}`, lv, i % 4);
    const d = Math.hypot(q.x, q.y);
    if (d < LEVELS[lv].r0 - 0.1 || d > LEVELS[lv].r1 + 0.1) allIn = false;
    if (lv > 0 && sectionOf(q) !== i % 4) allIn = false;
  }
  ok("two hundred marks all land in their ring and section", allIn);

  const shots = [
    { id: "a", date: "2026-10-19", level: 0, reason: null },
    { id: "b", date: "2026-10-18", level: 2, reason: 1 },
    { id: "c", date: "2026-10-10", level: 3, reason: 1 },
    { id: "d", date: "2026-09-01", level: 5, reason: 2 },
  ];
  ok("a week shows the last seven days", inRange(shots, "2026-10-19", "7").map((s) => s.id).join() === "a,b");
  ok("thirty days leaves out September 1", inRange(shots, "2026-10-19", "30").length === 3);
  ok("All is everything", inRange(shots, "2026-10-19", "all").length === 4);
  ok("the average is out of 10", Math.abs(average(shots.slice(0, 3)) - (10 + 6 + 4) / 3) < 1e-9);
  ok("misses gather by section; bullseyes have none", missCounts(shots).join() === "0,2,1,0");
  ok("the fullest section is the next thing to work on", fullest(missCounts(shots)) === 1 && fullest([0, 0, 0, 0]) === -1);

  ok("the bow starts as wood", tierOf(0) === 0 && TIERS[tierOf(29)].short === "Bow of wood");
  ok("a longbow at 30, a recurve at 90, steel at 180", tierOf(30) === 1 && tierOf(90) === 2 && tierOf(180) === 3 && tierOf(500) === 3);
  ok("the bow's line counts down to the next", bowLine(27) === "27 bullseyes · 3 more to a longbow" && bowLine(1) === "1 bullseye · 29 more to a longbow");
  ok("and stops at the last", bowLine(200) === "200 bullseyes · every bow earned" && bowProgress(200) === 1);
  ok("a new bow is earned only when the count crosses its line", bowEarned(28, 30) === 1 && bowEarned(30, 31) === -1 && bowEarned(29, 29) === -1 && bowEarned(178, 181) === 3);
  ok("crossing two bows at once earns the top one", bowEarned(20, 95) === 2);
  ok("every bow after wood has a verse", TIERS[0].verse === null && TIERS.slice(1).every((t) => t.verse?.text && /^[A-Z].+\.$/.test(t.verse.text) && /\d+:\d+$/.test(t.verse.cite)));
  ok("the bow of steel gets the bow of steel", TIERS[3].verse.cite === "Psalm 18:34" && TIERS[3].verse.text.includes("bow of steel"));
  ok("progress is from this bow to the next", Math.abs(bowProgress(60) - 0.5) < 1e-9);

  ok("blank sections fall back to the defaults", fourReasons(["Tired", "", null]).join() === `Tired,${DEFAULT_REASONS.slice(1).join()}`);
  ok("short names read like tabs", shortTarget("goal", "Highly in tune with God") === "In tune" && shortTarget("quest", "Build the best Premiere Pro plugin") === "Plugin" && shortTarget("lesson", "Stop drinking caffeine") === "Caffeine" && shortTarget("lesson", "More integrity") === "Integrity");
  ok("a caffeine lesson gets a cup", iconFor("lesson", "Stop drinking caffeine") === "cup" && iconFor("lesson", "More integrity") === "sign" && iconFor("quest", "x") === "tent");

  const today = "2026-10-19";
  const av = buildAscent(
    {
      goals: [{ id: "g1", title: "Highly disciplined", created_at: "2026-08-27" }],
      quests: [{ id: "q1", title: "Build the best Premiere Pro plugin", status: "on", position: 0 }],
      lessons: [{ id: "l1", title: "Stop drinking caffeine", status: "learning", started_on: today, position: 0 }],
    },
    today
  );
  const rg = buildRange(
    av,
    {
      targets: [
        { id: "t1", goal_id: "g1", quest_id: null, lesson_id: null, reasons: ["Tired", "Late night", "Phone", "Overbooked"] },
        { id: "t2", goal_id: null, quest_id: null, lesson_id: "l1", reasons: ["Tired", "Social", "Habit", "Craving"] },
      ],
      aims: [
        { id: "a2", target_id: "t1", text: "In bed on time", position: 1 },
        { id: "a1", target_id: "t1", text: "Exercised", position: 0 },
        { id: "a0", target_id: "t1", text: "Old one", position: 2, retired_on: "2026-10-01" },
        { id: "b1", target_id: "t2", text: "Went without caffeine", position: 0 },
      ],
      shots: [
        { id: "s2", target_id: "t1", date: today, level: 0, reason: null, answers: [], loosed_at: "2026-10-20T04:00:00Z" },
        { id: "s1", target_id: "t1", date: "2026-10-18", level: 2, reason: 1, answers: [{ aim: "a1", text: "Exercised", v: 2 }], loosed_at: "2026-10-19T04:00:00Z" },
        { id: "s3", target_id: "t1", date: "2026-10-20", level: 0, reason: null, answers: [], loosed_at: "2026-10-21T04:00:00Z" },
        // Answered tonight on another target, but the day isn't banked yet.
        { id: "s4", target_id: "t2", date: today, level: 0, reason: null, answers: [{ aim: "b1", text: "Went without caffeine", v: 2 }], loosed_at: null },
      ],
    },
    today
  );
  ok("every goal, quest and lesson is a target, in that order", rg.all.map((t) => t.kind).join() === "goal,quest,lesson");
  ok("a target with no row yet shows empty with the default sections", rg.quests[0].targetId === null && rg.quests[0].shots.length === 0 && rg.quests[0].reasons.join() === DEFAULT_REASONS.join());
  ok("aims are asked in order; retired ones aren't asked", rg.goals[0].aims.map((a) => a.id).join() === "a1,a2" && rg.goals[0].retired.length === 1);
  ok("shots read oldest first, and none from after today", rg.goals[0].shots.map((s) => s.id).join() === "s1,s2");
  ok("today's shot is known", rg.goals[0].today?.id === "s2");
  ok("bullseyes count across every target", rg.bullseyes === 1);
  ok("answers read as they were asked", answersOf(rg.goals[0].shots[0]).map((a) => `${a.text}:${a.v}`).join() === "Exercised:2" && answersOf({}).length === 0);
  ok("nothing loaded is an empty range, not a crash", buildRange(null, null, today).all.length === 0);
  ok("an arrow is on the target only once loosed", isLoosed({ loosed_at: "2026-10-20T04:00:00Z" }) && !isLoosed({ loosed_at: null }) && !isLoosed(null));
  const caffeine = rg.lessons[0];
  ok("tonight's answers wait in hand until the day is banked", caffeine.shots.length === 0 && caffeine.today === null && caffeine.tonight?.id === "s4");
  ok("a waiting arrow is no bullseye yet", rg.bullseyes === 1);
  ok("and a loosed one is tonight's too", rg.goals[0].tonight?.id === "s2");

  console.log("\ntonight");
  const exercise = { id: "f1", categories: ["Exercise"] };
  const entries = [
    { tags: ["exercise "], category: "Health", duration_minutes: 35 },
    { tags: [], category: "Exercise", duration_minutes: 10 },
    { tags: ["Exercise"], category: "x", duration_minutes: 99, is_example: true },
    { tags: ["Work"], category: "Work", duration_minutes: 240 },
  ];
  ok("the time log's minutes for a focus, by tag or category, examples aside", focusMinutes(exercise, entries) === 45);
  ok("a focus not in the log is zero", focusMinutes({ categories: ["Draw"] }, entries) === 0 && focusMinutes({ categories: [] }, entries) === 0);
  ok("a timer still running counts as logged", focusMinutes(exercise, [{ tags: ["Exercise"], duration_minutes: null }]) === 1);

  const tDisc = {
    aims: [
      { id: "a1", text: "Exercised", focus_id: "f1" },
      { id: "a2", text: "In bed on time", focus_id: null },
    ],
    tonight: null,
  };
  const byId = new Map([["f1", exercise]]);
  ok("the time log answers Yes for a focus it saw; the rest wait for you", startingAnswers(tDisc, { focusesById: byId, entries }).join() === "2,");
  ok("it never answers No for you", startingAnswers(tDisc, { focusesById: byId, entries: [] }).every((v) => v === null));
  ok(
    "what's already saved wins over the time log",
    startingAnswers({ ...tDisc, tonight: { answers: [{ aim: "a1", text: "Exercised", v: 1 }, { aim: "a2", text: "In bed on time", v: 0 }] } }, { focusesById: byId, entries }).join() === "1,0"
  );

  const why = ["Tired", "Late night", "Phone", "Overbooked"];
  ok("a line is read for its reason", readLine(why, "I stayed up way too late again") === 1);
  ok("by the reason's own name too", readLine(why, "Too much phone tonight") === 2);
  ok("a line about what went well points nowhere", readLine(why, "I hit a new PR of 101 pushups.") === -1 && readLine(why, "") === -1);
  ok("his own words from Oct 17 read as overbooked", readLine(why, "I felt a bit behind all day.") === 3);
  const tGuess = { shots: [{ date: "2026-10-18", level: 2, reason: 3 }, { date: "2026-10-17", level: 3, reason: 3 }, { date: "2026-10-16", level: 1, reason: 0 }, { date: "2026-09-01", level: 5, reason: 1 }] };
  ok("with nothing to read, the guess is where the last 30 days of misses gather", guessReason(tGuess, today) === 3);
  ok("and the first section when there are none", guessReason({ shots: [] }, today) === 0);

  const half = shotFrom(tDisc, [2, 0], { line: "  Stayed up late. ", reason: 1, how: "read" });
  ok("a shot keeps each answer with what it was called", half.answers.map((a) => `${a.aim}:${a.text}:${a.v}`).join() === "a1:Exercised:2,a2:In bed on time:0");
  ok("half done lands in the middle, in the section read from the line", half.level === 2 && half.reason === 1 && half.reason_how === "read" && half.note === "Stayed up late.");
  const bull = shotFrom(tDisc, [2, 2], { line: "", reason: 1, how: "guess" });
  ok("a bullseye has no section and an empty line is no note", bull.level === 0 && bull.reason === null && bull.reason_how === null && bull.note === null);
  ok("nothing to save until every aim is answered", shotFrom(tDisc, [2, null]) === null);

  const mk = readFileSync(new URL("../supabase/migrations/0075_the_mark.sql", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  const mt = ["mark_targets", "mark_aims", "mark_shots"];
  ok("every Mark table has row-level security", mt.every((t) => new RegExp(`alter table public\\.${t} enable row level security`).test(mk)));
  ok("and is yours alone", mt.every((t) => new RegExp(`create policy "[^"]+" on public\\.${t}\\s+for all to authenticated\\s+using \\(user_id = auth\\.uid\\(\\)\\)`).test(mk)));
  ok("nothing is open to signed-out visitors", /revoke all on[\s\S]*from anon/.test(mk) && !/grant[^;]*\bto anon\b/i.test(mk));
  ok("one shot per target per day", /unique \(target_id, date\)/.test(mk));
  ok("the Mark migration drops nothing", !/\bdrop\b|\btruncate\b|\bdelete\s+from\b/i.test(mk) && !/current_date/.test(mk));
  const loosedSql = readFileSync(new URL("../supabase/migrations/0076_mark_loosed.sql", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  ok("loosing adds one column and drops nothing", /add column if not exists loosed_at timestamptz/.test(loosedSql) && !/\bdrop\b|\btruncate\b|\bdelete\b/i.test(loosedSql));
}

// --- Temple -------------------------------------------------------------------
{
  const people = [
    { pid: "ME", name: "Aaron", gender: "M", lifespan: "2005-Living", ahnentafel: 1, generation: 1, rollup_status: "LIVING" },
    { pid: "DAD", name: "Dad", gender: "M", lifespan: "Living", ahnentafel: 2, generation: 2, rollup_status: "LIVING" },
    { pid: "GP", name: "Grandpa", gender: "M", lifespan: "1940-2006", ahnentafel: 4, generation: 3, rollup_status: "READY", birth_place: "Provo, Utah, Utah, United States" },
    { pid: "OLD", name: "Old Man", gender: "M", lifespan: "1766-1817", ahnentafel: 200, generation: 8, rollup_status: "READY", birth_place: "Lutzhausen, Luxembourg" },
    { pid: "BUD", name: "Bud Wells", gender: "M", lifespan: "1799-Deceased", ahnentafel: 201, generation: 8, rollup_status: "READY" },
    { pid: "HER", name: "Anna", gender: "F", lifespan: "1770-1832", ahnentafel: 203, generation: 8, rollup_status: "NEEDS_MORE_INFORMATION" },
    { pid: "PIO", name: "Pioneer", gender: "M", lifespan: "1788-1872", ahnentafel: 148, generation: 8, rollup_status: "COMPLETED", birth_place: "Rockingham, Windham, Republic of Vermont", death_place: "Salt Lake City, Salt Lake, Utah, United States" },
  ];
  const ordinances = [
    { pid: "GP", kind: "stp", spouse_name: "", fs_status: "Ready", reasons: [] },
    { pid: "OLD", kind: "sts", spouse_name: "Catherine", fs_status: "ReservedSharedReady", reasons: [] },
    { pid: "OLD", kind: "bap", spouse_name: "", fs_status: "Ready", reasons: [] },
    { pid: "OLD", kind: "con", spouse_name: "", fs_status: "Ready", reasons: [] },
    { pid: "OLD", kind: "ini", spouse_name: "", fs_status: "Ready", reasons: [] },
    { pid: "BUD", kind: "bap", spouse_name: "", fs_status: "InProgressNotPrinted", reasons: [] },
    { pid: "BUD", kind: "end", spouse_name: "", fs_status: "Completed", reasons: [] },
    { pid: "HER", kind: "bap", spouse_name: "", fs_status: "NeedsMoreInformation", reasons: ["This person's record needs a standardized place in a birth event."] },
  ];
  const v = buildTemple({ people, ordinances, done: [], trips: [] });

  ok(
    "FamilySearch's statuses sort into stages",
    stageOf("ReservedSharedReady") === "ready" && stageOf("SharedInProgressPrinted") === "others" && stageOf("InProgressNotPrinted") === "mine" && stageOf("Completed") === null
  );
  ok(
    "a reservation is yours only when FamilySearch says you hold it",
    stageOf({ fs_status: "InProgressNotPrinted", mine: false }) === "others" &&
      stageOf({ fs_status: "SharedInProgressNotPrinted", mine: true }) === "mine" &&
      stageOf({ fs_status: "InProgressNotPrinted", mine: true }) === "mine"
  );
  ok("completed ordinances aren't open work", v.open.length === 7 && !v.open.some((o) => o.fs_status === "Completed"));
  ok("counts come from the snapshot", v.counts.deceased === 5 && v.counts.completed === 1 && v.counts.ready === 5 && v.counts.mine === 1);

  const bap = candidates(v, "bap");
  ok("names you hold go first", bap[0].o.pid === "BUD" && bap[0].why[0] === "Reserved by you");
  ok("women's individual ordinances aren't on your trips", !candidates(v, "bap").some((c) => c.o.pid === "HER"));
  ok("an initiatory waits for that person's baptism", waitsOn(v.open.find((o) => o.pid === "OLD" && o.kind === "ini"), v.open) === "baptism");
  ok("only names you've reserved go on your trips", !candidates(v, "bap").some((c) => c.o.stage === "ready"));
  // The same tree once you've reserved everything that was ready.
  const held2 = ordinances.map((o) => (o.fs_status === "Ready" || o.fs_status === "ReservedSharedReady" ? { ...o, fs_status: "InProgressNotPrinted", mine: true } : o));
  const v2h = buildTemple({ people, ordinances: held2, done: [], trips: [] });
  const ini = fillTrip(v2h, "ini");
  ok("so it isn't on the initiatory trip yet", ini.items.length === 0 && ini.waiting.length === 1);

  const seal = fillTrip(v2h, "seal");
  ok("a sealing waits until that person's own ordinances are done", seal.items.map((c) => c.o.pid).join() === "GP" && seal.waiting[0].waits === "baptism");

  // Someone else holds Bendicht's endowment; Peter's initiatory is held by
  // someone else, so his endowment can't go ahead even though it's free.
  const held = [
    { pid: "BEN", kind: "end", spouse_name: "", fs_status: "InProgressNotPrinted", reasons: [], mine: false, reserved_by: "Gretamay" },
    { pid: "PET", kind: "ini", spouse_name: "", fs_status: "InProgressNotPrinted", reasons: [], mine: false, reserved_by: "lisa" },
    { pid: "PET", kind: "end", spouse_name: "", fs_status: "InProgressNotPrinted", reasons: [], mine: true },
    { pid: "PET", kind: "stp", spouse_name: "", fs_status: "InProgressNotPrinted", reasons: [], mine: true },
    { pid: "KID", kind: "bap", spouse_name: "", fs_status: "NotAvailable", reasons: [] },
    { pid: "KID", kind: "stp", spouse_name: "", fs_status: "InProgressNotPrinted", reasons: [], mine: true },
    { pid: "MINE", kind: "end", spouse_name: "", fs_status: "InProgressNotPrinted", reasons: [], mine: true },
  ];
  const hp = ["BEN", "PET", "KID", "MINE"].map((pid, i) => ({ pid, name: pid, gender: "M", lifespan: "1800-1850", ahnentafel: 300 + i, rollup_status: "READY" }));
  const hv = buildTemple({ people: hp, ordinances: held, done: [], trips: [] });
  const hEnd = fillTrip(hv, "end", 5);
  ok("someone else's reservation is never on your trip", !candidates(hv, "end").some((c) => c.o.pid === "BEN") && hv.counts.others === 2);
  ok("an endowment waits on an initiatory someone else holds", hEnd.waiting.some((c) => c.o.pid === "PET" && c.waits === "initiatory"));
  ok("so only the endowment you hold with nothing before it goes", hEnd.items.map((c) => c.o.pid).join() === "MINE");
  ok("a sealing waits for the endowment", waitsOn(held[3], hv.pending) === "initiatory");
  ok("a child with no individual ordinances can still be sealed", fillTrip(hv, "seal").items.some((c) => c.o.pid === "KID"));
  const heldTrip = { id: "t9", kind: "end", planned_on: "2026-11-01", status: "planned", items: [{ pid: "BEN", name: "BEN", kind: "end", spouse: "" }, { pid: "PET", name: "PET", kind: "end", spouse: "" }] };
  const hp2 = tripProgress(heldTrip, hv);
  ok(
    "a planned name that's no longer doable says why",
    hp2.items[0].blocked === "Reserved by Gretamay" && hp2.items[1].blocked === "Waits on the initiatory" && !hp2.finished
  );
  ok("the last open ordinance a person has is called out", candidates(v2h, "seal").find((c) => c.o.pid === "GP").why.includes("Last one for him"));

  const trip = { id: "t1", kind: "seal", planned_on: "2026-10-24", status: "planned", items: [{ pid: "GP", name: "Grandpa", kind: "stp", spouse: "" }] };
  const withTrip = buildTemple({ people, ordinances, done: [], trips: [trip] });
  ok("a name on a planned trip isn't offered twice", !fillTrip(withTrip, "seal").items.some((c) => c.o.pid === "GP"));
  ok("a trip isn't done while its names are open", !tripProgress(trip, withTrip).finished);
  const after = buildTemple({ people, ordinances: ordinances.filter((o) => o.pid !== "GP"), done: [], trips: [trip] });
  ok("it's done when FamilySearch no longer has them open", tripProgress(trip, after).finished);
  ok("the next trip is the soonest planned one from today", nextTrip([{ ...trip, planned_on: "2026-10-19" }, trip, { ...trip, id: "t2", planned_on: "2026-11-01" }], "2026-10-20").planned_on === "2026-10-24");

  const h = helperNames(v);
  ok("women's names wait for research before a helper gets them", h.ready.length === 0 && h.later.length === 1 && h.later[0].person.pid === "HER");
  ok("FamilySearch's reasons read plainly", plainReason(ordinances[7].reasons[0]) === "Needs a standard place");

  const mp = missingParents(people);
  ok("missing parents are found from gaps in the pedigree", mp.length === 4 && mp.find((m) => m.person.pid === "OLD").missing === "both");

  const c = templeCrowd([
    { pid: "A", name: "A", gender: "M", in_pedigree: true, ordinances: [{ type: "E", date: "2025-02-01", temple: "Lindon" }] },
    { pid: "B", name: "B", gender: "F", in_pedigree: false, ordinances: [{ type: "B", date: "2024-09-12", temple: "Mount Timpanogos" }, { type: "C", date: "2024-09-12", temple: "Mount Timpanogos" }] },
  ]);
  ok("one figure per person, however many ordinances", c.people.length === 2 && c.ordinances === 3 && c.direct === 1);
  ok("in the order you did them", c.people[0].pid === "B" && c.since === "2024-09-12" && c.temples[0][0] === "Mount Timpanogos");

  const f = familyFacts(people, { thisYear: 2026 });
  ok("years lived add up whole lives only", f.yearsLived === 66 + 51 + 62 + 84 && f.withBothDates === 4);
  ok("alive in 1776 counts lives that cross it", f.aliveIn1776 === 2);
  ok("a pioneer was born elsewhere and died in Utah", f.pioneers.length === 1 && f.pioneers[0].pid === "PIO");
  ok("old countries fold into today's names", countryOf("Rockingham, Windham, Republic of Vermont") === "United States" && countryOf("Kelso, Scotland") === "England & Scotland");
  ok("the fan has a wedge for every slot out to nine generations", fanSlots(people).length === 510 && fanSlots(people).filter((s) => s.person).length === 6);

  let threw = "";
  try {
    parseSnapshot('{"kind":"something-else"}');
  } catch (e) {
    threw = e.message;
  }
  ok("a file that isn't a snapshot is refused in words", /isn't a FamilySearch snapshot/.test(threw));
  const snap = parseSnapshot(JSON.stringify({ kind: "hub-temple-snapshot", version: 1, synced_at: "2026-10-20T14:55:00Z", people: [people[2]], ordinances: [ordinances[0], { pid: "X", kind: "nope", fs_status: "Ready" }], done: [] }));
  const twice = parseSnapshot(JSON.stringify({ kind: "hub-temple-snapshot", synced_at: "2026-10-20T14:55:00Z", people: [{ ...people[3], ahnentafel: 300 }, people[3]], ordinances: [], done: [] }));
  ok("someone in the pedigree twice is kept once, at the closer place", twice.people.length === 1 && twice.people[0].ahnentafel === 200);
  ok("a snapshot keeps only rows it understands", snap.people.length === 1 && snap.ordinances.length === 1 && snap.ordinances[0].spouse_name === "");
  const v2 = parseSnapshot(
    JSON.stringify({ kind: "hub-temple-snapshot", synced_at: "2026-10-28T14:55:00Z", people: [people[2]], ordinances: [{ ...ordinances[0], fs_status: "InProgressNotPrinted", mine: false, reserved_by: "Kiona" }] })
  );
  ok("who holds a reservation comes through", v2.ordinances[0].mine === false && v2.ordinances[0].reserved_by === "Kiona");
  ok("a sync without the completed list keeps the one already here", v2.done === null && snap.done.length === 0);

  const tm = readFileSync(new URL("../supabase/migrations/0077_temple.sql", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  const tt = ["temple_people", "temple_ordinances", "temple_done", "temple_syncs", "temple_trips", "temple_helpers", "temple_permissions"];
  ok("every Temple table has row-level security", tt.every((t) => new RegExp(`alter table public\\.${t} enable row level security`).test(tm)));
  ok("and is yours alone, closed to signed-out visitors", /using \(\(select auth\.uid\(\)\) = user_id\) with check/.test(tm) && /from anon, public;/.test(tm) && !/\bto anon\b/i.test(tm));
  ok("the Temple migration drops nothing", !/\bdrop\b|\btruncate\b|\bdelete\s+from\b/i.test(tm) && !/current_date/.test(tm));

  const ts = readFileSync(new URL("../supabase/migrations/0094_temple_sync.sql", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  ok(
    "the sync tables are yours alone and closed to signed-out visitors",
    ["temple_sync_keys", "temple_inbox"].every((t) => new RegExp(`alter table public\\.${t} enable row level security`).test(ts)) &&
      /revoke all on public\.temple_inbox from anon, public/.test(ts) &&
      !/\bto anon\b/i.test(ts)
  );
  ok("the sync migration drops nothing", !/\bdrop\b|\btruncate\b|\bdelete\s+from\b/i.test(ts));

  // Your reservations, in order.
  {
    const M = (pid, kind, extra = {}) => ({ pid, kind, spouse_name: "", fs_status: "InProgressNotPrinted", reasons: [], mine: true, ...extra });
    const rp = [
      ["A", "M", 5], ["ANN", "F", 5], ["B", "M", 6], ["C", "M", 6], ["D", "F", 6], ["E", "M", 7], ["F", "M", 7], ["G", "F", 7],
    ].map(([pid, gender, generation], i) => ({ pid, name: pid, gender, lifespan: `${1800 + i}-1870`, ahnentafel: 2 ** (generation - 1) + i, generation, rollup_status: "READY" }));
    const ro = [
      M("A", "bap"), M("A", "con"), M("A", "ini"), M("A", "end"), M("A", "sts", { spouse_name: "ANN" }),
      M("B", "end"),
      M("C", "ini", { mine: false, reserved_by: "lisa" }), M("C", "end"),
      M("D", "bap"), M("D", "con"),
      M("E", "stp"),
      M("F", "stp"), M("F", "sts", { spouse_name: "G" }), M("G", "sts", { spouse_name: "F" }),
    ];
    const rv = buildTemple({ people: rp, ordinances: ro, done: [], trips: [] });
    const lanes = Object.fromEntries(myNames(rv).map((n) => [n.person.pid, n.lane]));
    ok("each name sits at the next ordinance it needs", lanes.A === "bap" && lanes.B === "end" && lanes.E === "seal" && lanes.F === "seal");
    ok("an endowment behind someone else's initiatory waits, and says why", lanes.C === "waiting" && myNames(rv).find((n) => n.person.pid === "C").why === "Initiatory held by lisa");
    ok("a woman's baptism goes to a helper", lanes.D === "helper");
    const cut = buildTemple({ people: rp, ordinances: [M("B", "bap"), M("B", "con"), M("B", "ini", { mine: false, reserved_by: "lisa" }), M("B", "end")], done: [], trips: [] });
    const cutB = myNames(cut)[0];
    ok("steps of yours behind one you don't hold are never planned", cutB.lane === "bap" && cutB.steps.length === 1 && cutB.later[0].step === "end" && planTrips(cut, { from: "2026-10-28" }).trips.length === 1);
    ok("a couple's sealing counts once", lanes.G === undefined && myNames(rv).find((n) => n.person.pid === "F").steps[0].ords.length === 2);
    ok("and waits for the spouse who's still behind", myNames(rv).find((n) => n.person.pid === "A").steps.map((x) => x.step).join() === "bap,ini,end,seal");
    const held = buildTemple({ people: rp, ordinances: [...ro, { pid: "ANN", kind: "end", spouse_name: "", fs_status: "InProgressNotPrinted", reasons: [], mine: false, reserved_by: "Gretamay" }], done: [], trips: [] });
    ok("a sealing waits on a spouse whose work you don't hold", !myNames(held).find((n) => n.person.pid === "A").steps.some((x) => x.step === "seal"));

    ok("trip days for once, twice and three times a week", tripDates("2026-10-28", 1, 2).join() === "2026-10-31,2026-11-07" && tripDates("2026-10-28", 2, 3).join() === "2026-10-31,2026-11-04,2026-11-07" && tripDates("2026-10-28", 3, 3).join() === "2026-10-31,2026-11-02,2026-11-04");
    const plan = planTrips(rv, { from: "2026-10-28", perWeek: 1 });
    ok("one kind of work per trip, the fullest batch first", plan.trips.map((t) => t.kind).join() === "end,seal,bap,ini,end,seal");
    ok("a person's next step goes on a later trip", plan.trips[2].items[0].pid === "A" && plan.trips[3].items[0].pid === "A" && plan.trips[4].items[0].pid === "A");
    ok("a baptism trip lists the baptism once (the confirmation goes with it)", plan.trips[2].items.length === 1 && plan.trips[2].items[0].kind === "bap");
    ok("everything you can do is done, on the sixth Saturday", plan.finished && plan.trips[5].date === "2026-12-05" && plan.ordinances === 9);
    const pace = paceTimeline(rv, "2026-10-28");
    ok("going more often finishes sooner", pace[0].doneOn === "2026-12-05" && pace[1].doneOn < pace[0].doneOn && pace[2].doneOn <= pace[1].doneOn && pace[0].in4 < pace[2].in4);
    const withPlan = buildTemple({ people: rp, ordinances: ro, done: [], trips: [{ id: "p", kind: "bap", planned_on: "2026-10-29", status: "planned", items: [{ pid: "A", name: "A", kind: "bap", spouse: "" }] }] });
    const p2 = planTrips(withPlan, { from: "2026-10-28", perWeek: 1 });
    ok("a trip you planned comes first, and its names aren't planned again", p2.trips[0].planned && p2.trips[1].date === "2026-10-31" && !p2.trips.slice(1).some((t) => t.kind === "bap"));
  }

  // The bookmark, run against a pretend FamilySearch.
  const fsAnc = {
    persons: [
      { id: "KWBN-5QK", living: true, display: { ascendancyNumber: "1", name: "Aaron", gender: "Male", lifespan: "2005-Living" } },
      { id: "AAAA-111", living: false, display: { ascendancyNumber: "4", name: "Grandpa", gender: "Male", lifespan: "1900-1970", birthPlace: "Provo" } },
      { id: "BBBB-222", living: false, display: { ascendancyNumber: "5", name: "Grandma", gender: "Female", lifespan: "1902-1980" } },
    ],
  };
  const fsOrd = {
    "AAAA-111": {
      baptism: { status: "Completed" },
      initiatory: { status: "InProgressNotPrinted", owner: "M9MG-YS4", ownerName: "Forsyth, Aaron Michael" },
      endowment: { status: "InProgressNotPrinted", owner: "MM6T-QBH", ownerName: "Kiona Rainey" },
      confirmation: { status: "InProgressNotPrinted", owner: "ZZZZ-999", ownerName: "Forsyth, Aaron Michael", canUnreserve: true },
      sealingsToSpouses: [{ status: "SharedInProgressPrinted", owner: "M9MG-YS4", alternateReservationDetails: { ownerId: "M957-32M", ownerName: "Ashton, Paige" }, relationships: { spouseName: "Grandma" } }],
      sealingsToParents: [{ status: "NotAvailable" }],
    },
  };
  const realFetch = globalThis.fetch;
  globalThis.location = { hostname: "www.familysearch.org" };
  globalThis.document = { cookie: "a=1; fssessionid=tok" };
  const asked = [];
  globalThis.fetch = async (url, opts = {}) => {
    asked.push([opts.method ?? "GET", url]);
    const u = new URL(url, "https://www.familysearch.org");
    const okJ = (j) => ({ ok: true, status: 200, json: async () => j });
    if (u.pathname === "/platform/users/current") return okJ({ users: [{ id: "cis.user.MMMM-ABCD", treeUserId: "M9MG-YS4", personId: "KWBN-5QK" }] });
    if (u.pathname === "/platform/tree/ancestry") return okJ(fsAnc);
    let m;
    if ((m = u.pathname.match(/person\/(.+)\/summary/))) return okJ({ templeRollupStatus: m[1] === "BBBB-222" ? "COMPLETED" : "READY" });
    if ((m = u.pathname.match(/reservations\/person\/(.+)\/ordinances/))) return okJ({ data: fsOrd[m[1]] });
    return { ok: false, status: 500, json: async () => ({}) };
  };
  const fsSnap = await familySearchSync({ quiet: true, send: false });
  globalThis.fetch = realFetch;
  delete globalThis.location;
  delete globalThis.document;
  const fsHeld = (kind) => fsSnap.ordinances.find((o) => o.kind === kind);
  ok("the bookmark only reads", asked.every(([m]) => m === "GET"));
  ok("it reads the pedigree with each person's place in it", fsSnap.people.length === 3 && fsSnap.people[1].generation === 3 && fsSnap.people[2].rollup_status === "COMPLETED");
  ok("only open ordinances come back, and sealings that can't be done don't", fsSnap.ordinances.map((o) => o.kind).join() === "con,ini,end,sts");
  ok("it reads you as your tree user id, not your account id", asked.some(([, u]) => u.includes("owner=M9MG-YS4")) && !asked.some(([, u]) => u.includes("cis.user")));
  ok("a reservation you can give back is yours", fsHeld("con").mine === true);
  ok(
    "each says who holds it",
    fsHeld("ini").mine === true && fsHeld("end").mine === false && fsHeld("end").reserved_by === "Kiona Rainey" && fsHeld("sts").reserved_by === "Ashton, Paige"
  );
  ok("the snapshot says which bookmark made it", fsSnap.version === SYNC_VERSION && parseSnapshot(JSON.stringify(fsSnap)).version === SYNC_VERSION);
  ok("a completed list it can't read is left out, not emptied", !("done" in fsSnap) && parseSnapshot(JSON.stringify(fsSnap)).done === null);
  const bm = syncBookmarklet({ key: "ts_abc", endpoint: "https://x.supabase.co/functions/v1/temple-sync", hub: "https://hub" });
  let parses = true;
  try {
    new Function(decodeURIComponent(bm.slice("javascript:".length)));
  } catch {
    parses = false;
  }
  ok("the bookmark is one piece of code with its key inside", bm.startsWith("javascript:") && parses && decodeURIComponent(bm).includes('"key":"ts_abc"'));
}

// --- Wake watch ---------------------------------------------------------------
{
  ok("a 10-digit US number gets +1", normalizePhone("(801) 555-1234") === "+18015551234");
  ok("an 11-digit one starting with 1 keeps it", normalizePhone("1 801 555 1234") === "+18015551234");
  ok("a + number keeps its country code", normalizePhone("+44 20 7946 0958") === "+442079460958");
  ok("too short is refused", normalizePhone("555-1234") === null && normalizePhone("") === null);
  ok("a US number reads the usual way", prettyPhone("+18015551234") === "(801) 555-1234");
  ok("the wake time reads like the text writes it", wakeClock("2026-10-20T11:23:25Z", "America/Denver") === "5:23 am");
  ok("and in winter time too", wakeClock("2026-12-02T12:05:00Z", "America/Denver") === "5:05 am");
  ok("{time} is filled in", fillMessage("he woke up at {time}", "2026-10-20T11:23:25Z", "America/Denver") === "he woke up at 5:23 am");
  ok("4:35 shows without the leading zero", shortTime("04:35:00") === "4:35");
  ok("a failed text says why", /Twilio/.test(deliveryLine({ status: "failed", error: "Twilio secrets missing" })));
  ok("one peer is singular", deliveryLine({ status: "sent", sent_to: 1 }) === "Texted to 1 peer.");
  ok("a streak skips this morning's wait and stops at the first miss",
    upStreak([{ outcome: "waiting" }, { outcome: "up" }, { outcome: "up" }, { outcome: "late" }, { outcome: "up" }]) === 2);

  const wm = readFileSync(new URL("../supabase/migrations/0078_wake_watch.sql", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  ok("every wake table has row-level security", ["wake_watch", "wake_peers", "wake_reports"].every((t) => new RegExp(`alter table public\\.${t} enable row level security`).test(wm)));
  ok("reports can only be read from the app, never written", !/grant[^;]*(insert|update|delete)[^;]*wake_reports/.test(wm));
  ok("the judging functions can't be called from the app", /revoke all on function public\.wake_watch_tick\(\) from public, anon, authenticated/.test(wm) && /revoke all on function public\.trigger_wake_send\(uuid\)/.test(wm));
  ok("the wake migration drops nothing", !/\bdrop\s+(table|column|function|policy)\b|\btruncate\b|\bdelete\s+from\b/i.test(wm));
  ok("it starts off and in practice", /enabled boolean not null default false/.test(wm) && /live boolean not null default false/.test(wm));
}

{
  // Sharing a quote: what a friend gets.
  const q = { text: "  The past is to be learned from but not lived in. ", author: "Jeffrey R. Holland", source: "BYU devotional", year: 2009 };
  ok("shared words are quoted and signed", shareText(q) === "\u201CThe past is to be learned from but not lived in.\u201D\n\u2014 Jeffrey R. Holland, BYU devotional (2009)");
  ok("no author, no dash", shareText({ text: "Hi" }) === "\u201CHi\u201D");
  ok("the file is named for who said it", shareFileName(q) === "quote-jeffrey-r-holland.png" && shareFileName({}) === "quote.png");

  const mono = (w) => (s) => s.length * w;
  const lines = wrapText("one two three four five", mono(1), 9);
  ok("words wrap without cutting one", lines.join("|") === "one two|three|four five");
  ok("a word longer than the line gets its own line", wrapText("a extraordinarily b", mono(1), 5).join("|") === "a|extraordinarily|b");

  const measureAt = (size) => mono(size === "mono" ? 13 : size * 0.5);
  const short = layoutCard(q, measureAt);
  ok("a short quote gets the big type and a full card", short.text.size === 56 && short.height === CARD_H);
  ok("the photo is a good size", short.photo.h >= 300 && short.photo.h <= 560);
  ok("everything sits inside the print", short.source.y + short.source.lines.length * 32 <= short.print.y + short.print.h);
  const long = layoutCard({ ...q, text: "word ".repeat(220) }, measureAt);
  ok("a very long quote grows the card instead of shrinking past readable", long.text.size === 32 && long.height > CARD_H);
  ok("and still fits on it", long.print.y + long.print.h <= long.height);
  const mid = layoutCard({ ...q, text: "word ".repeat(40) }, measureAt);
  ok("a longer quote steps the type down", mid.text.size < 56 && mid.height === CARD_H);
}

{
  console.log("\ncamps and plans");

  const sections = [
    { id: "s2", title: "Market research", position: 1 },
    { id: "s1", title: "Name the job", position: 0 },
  ];
  const steps = [
    { id: "a", section_id: "s1", text: "Write it in one sentence", position: 0, done_on: "2026-10-22" },
    { id: "b", section_id: "s1", text: "Say which tab", position: 1, done_on: "2026-10-22" },
    { id: "c", section_id: "s2", text: "List the competitors", position: 0, done_on: null },
    { id: "d", section_id: "s2", text: "Read the complaints", position: 1, done_on: null },
    { id: "e", section_id: null, text: "Loose one", position: 0, done_on: null },
    { id: "f", section_id: "gone", text: "Section went away", position: 1, done_on: null },
  ];
  const camp = buildCamp(sections, steps);
  ok("sections come in order and are numbered", camp.sections.map((x) => `${x.number}${x.id}`).join() === "1s1,2s2");
  ok("a section knows how far along it is", camp.sections[0].done === 2 && camp.sections[0].complete && !camp.sections[1].complete);
  ok("steps with no section (or a lost one) sit loose at the top", camp.loose.map((x) => x.id).join() === "e,f");
  ok("the next step is the first open one, top to bottom", camp.next.id === "e" && camp.done === 2 && camp.total === 6);
  {
    const w = buildCamp([], [
      { id: "a", text: "A", position: 0 },
      { id: "b", text: "B", position: 1, working_since: "2026-10-23T18:00:00Z" },
      { id: "c", text: "C", position: 2, working_since: "2026-10-23T18:00:00Z", done_on: "2026-10-23" },
    ]);
    ok("the step you're working on is the next step", w.next?.id === "b");
  }
  ok("an empty camp has no next step", buildCamp([], []).next === null && buildCamp(null, null).total === 0);
  ok("an empty section isn't complete", buildCamp([{ id: "x", title: "X" }], []).sections[0].complete === false);

  // Sub-steps (0083) sit under their step, count like steps, and come next in reading order.
  const withSubs = buildCamp(sections, [
    ...steps,
    { id: "a1", section_id: "s1", parent_id: "a", text: "First draft", position: 0, done_on: "2026-10-23" },
    { id: "c2", section_id: "s2", parent_id: "c", text: "The paid ones", position: 1, done_on: null },
    { id: "c1", section_id: "s2", parent_id: "c", text: "The free ones", position: 0, done_on: null },
    { id: "z1", section_id: "s1", parent_id: "gone", text: "Its step went away", position: 5, done_on: null },
  ]);
  const s1 = withSubs.sections[0];
  const s2 = withSubs.sections[1];
  ok("sub-steps sit under their step, in order", s2.steps[0].subs.map((x) => x.id).join() === "c1,c2" && s1.steps[0].subs.map((x) => x.id).join() === "a1");
  ok("sub-steps aren't steps of their own in the section", s2.steps.map((x) => x.id).join() === "c,d");
  ok("a sub-step whose step is gone stands on its own", s1.steps.map((x) => x.id).join() === "a,b,z1" && !s1.complete);
  ok("sub-steps count on the section and the camp", s2.total === 4 && s1.done === 3 && withSubs.total === 10 && withSubs.done === 3);

  // Today (0090): steps picked for today show again in the camp's Today, as the same steps.
  {
    const T = "2026-10-27";
    const picked = [
      ...steps.map((x) => (x.id === "d" || x.id === "a" ? { ...x, today_on: T } : x.id === "e" ? { ...x, today_on: "2026-10-26" } : x)),
      { id: "c1", section_id: "s2", parent_id: "c", text: "The free ones", position: 0, done_on: null, today_on: T },
      { id: "c2", section_id: "s2", parent_id: "c", text: "The paid ones", position: 1, done_on: T },
      { id: "d1", section_id: "s2", parent_id: "d", text: "Under a picked step", position: 0, done_on: null, today_on: T },
    ];
    const view = buildCamp(sections, picked, T);
    const tp = todayPicks(view, T);
    ok("today's picks come in the camp's order, a picked sub-step on its own", tp.items.map((x) => x.id).join() === "a,c1,d");
    ok("yesterday's pick isn't on today", !tp.items.some((x) => x.id === "e"));
    ok("a step under a picked step shows under it, not twice", tp.items.find((x) => x.id === "d").subs.map((x) => x.id).join() === "d1" && tp.items.filter((x) => x.id === "d1").length === 0);
    ok("each pick says where it sits", tp.items[0].from === "1. Name the job" && tp.items[1].from === "2. Market research · under “List the competitors”");
    ok("today counts its picks and what's under them", tp.total === 4 && tp.done === 1);
    ok("nothing picked: an empty Today", todayPicks(buildCamp(sections, steps, T), T).items.length === 0 && todayPicks(null, T).total === 0);
    ok("a step picked for today comes next, before the first open one", view.next.id === "c1" && buildCamp(sections, picked).next.id === "e");
    ok(
      "working on a step still comes first",
      buildCamp(sections, picked.map((x) => (x.id === "f" ? { ...x, working_since: "2026-10-27T15:00:00Z" } : x)), T).next.id === "f"
    );
    const loosePick = todayPicks(buildCamp(sections, picked.map((x) => (x.id === "e" ? { ...x, today_on: T } : x)), T), T);
    ok("a loose step picked says nothing about a section", loosePick.items[0].id === "e" && loosePick.items[0].from === null);

    const camps = [
      { id: "k2", quest_id: "q", title: "Multicam", position: 1 },
      { id: "k1", quest_id: "q", title: "Sift", position: 0 },
      { id: "k3", quest_id: "q", title: "Graphica", position: 2 },
    ];
    const qsecs = [{ id: "x1", camp_id: "k1", title: "Search", position: 0 }];
    const qsteps = [
      { id: "m1", camp_id: "k2", text: "Angle strip", position: 0, today_on: T, done_on: null },
      { id: "m2", camp_id: "k2", text: "Not today", position: 1, today_on: null },
      { id: "s1", camp_id: "k1", section_id: "x1", text: "Search by tag", position: 0, today_on: T, done_on: T },
      { id: "g1", camp_id: "k3", text: "Old pick", position: 0, today_on: "2026-10-20" },
    ];
    const qt = questToday(camps, qsecs, qsteps, T);
    ok("a quest's Today: each camp's picks under it, camps in order, none for camps with nothing", qt.map((g) => `${g.number}${g.camp.title}:${g.items.map((x) => x.id).join("+")}`).join() === "1Sift:s1,2Multicam:m1");
    ok("each camp's Today knows how far along it is", qt[0].done === 1 && qt[0].total === 1 && qt[1].done === 0 && qt[0].items[0].from === "1. Search");
    ok("no camps, no Today", questToday([], [], [], T).length === 0 && questToday(null, null, null, T).length === 0);

    const d = pickDiff(["a", "b", "c"], new Set(["b", "c", "x", "y"]));
    ok("picking works out what to put on today and what to take off", d.add.join() === "x,y" && d.remove.join() === "a");
    ok("picking nothing new changes nothing", pickDiff(["a"], new Set(["a"])).add.length === 0 && pickDiff(["a"], new Set(["a"])).remove.length === 0);

    const tally = campTally([{ camp_id: "k1", today_on: T }, { camp_id: "k1", today_on: "2026-10-26", done_on: T }, { camp_id: "k2" }], T);
    ok("the camps on Quests count today's picks", tally.get("k1").today === 1 && tally.get("k1").done === 1 && tally.get("k2").today === 0 && campTally([{ camp_id: "k1", today_on: T }]).get("k1").today === 0);
    const secTally = campTally(
      [
        { camp_id: "k1", section_id: "x1", done_on: null },
        { camp_id: "k1", section_id: "x1", done_on: T, today_on: T },
        { camp_id: "k1", section_id: "x1", done_on: "2026-10-20" },
        { camp_id: "k1", section_id: "x1", parent_id: "p", done_on: null },
        { camp_id: "k1", section_id: "x2", today_on: T },
        { camp_id: "k1", section_id: "x2" },
      ],
      T,
      [{ id: "x1", camp_id: "k1", today_on: T }, { id: "x2", camp_id: "k1", today_on: null }]
    );
    ok("a section on today counts its steps that show in Today, once each", secTally.get("k1").today === 3);
    const openUnder = campTally(
      [
        { id: "p", camp_id: "k1", section_id: "x1", done_on: "2026-10-20" },
        { id: "c", camp_id: "k1", section_id: "x1", parent_id: "p", done_on: null },
        { id: "q", camp_id: "k1", section_id: "x1", done_on: null },
      ],
      T,
      [{ id: "x1", camp_id: "k1", today_on: T }]
    );
    ok("a step done before today with a sub-step still to do counts, as Today shows it", openUnder.get("k1").today === 2);


    const qtSec = questToday(camps, [...qsecs, { id: "x3", camp_id: "k3", title: "Rings", position: 0, today_on: T }], [...qsteps, { id: "g2", camp_id: "k3", section_id: "x3", text: "Ring one", position: 1 }], T);
    ok("a quest's Today takes in a camp with only a section on today", qtSec.map((g) => g.camp.title).join() === "Sift,Multicam,Graphica" && qtSec[2].blocks[0].section.id === "x3" && qtSec[2].items.map((x) => x.id).join() === "g2");

    // A whole section on today (0091).
    const secs = sections.map((x) => (x.id === "s2" ? { ...x, today_on: T } : x));
    const whole = todayPicks(buildCamp(secs, picked, T), T);
    ok(
      "a section picked whole is a block of its own, between the steps picked one by one",
      whole.blocks.map((b) => (b.section ? `[${b.section.id}:${b.items.map((x) => x.id).join("+")}]` : b.items.map((x) => x.id).join("+"))).join() === "a,[s2:c+d]"
    );
    ok("a step picked on its own inside a picked section shows there once", whole.items.filter((x) => x.id === "c1").length === 0 && whole.items.find((x) => x.id === "c").subs.some((x) => x.id === "c1"));
    ok("a picked section's steps don't say where they sit", whole.blocks[1].items.every((x) => !x.from));
    ok("each block counts itself, and today counts them all", whole.blocks[1].total === 5 && whole.blocks[1].done === 1 && whole.total === 6 && whole.done === 2);
    const s2done = picked.map((x) => (["c", "c1", "c2"].includes(x.id) ? { ...x, done_on: "2026-10-20" } : x.id === "d" ? { ...x, done_on: T } : x));
    const later = todayPicks(buildCamp(secs, s2done, T), T).blocks[1];
    ok("a picked section leaves out what was done before today, keeps what's done today, and counts the rest", later.items.map((x) => x.id).join() === "d" && later.earlier === 1);
    ok("a step done before today stays while something under it is still to do", todayPicks(buildCamp(secs, picked.map((x) => (x.id === "c" ? { ...x, done_on: "2026-10-20" } : x)), T), T).blocks[1].items.map((x) => x.id).join() === "c,d");
    ok("a section picked yesterday isn't on today", todayPicks(buildCamp(sections.map((x) => (x.id === "s2" ? { ...x, today_on: "2026-10-26" } : x)), steps, T), T).blocks.length === 0);
    const empty = todayPicks(buildCamp([...secs, { id: "s9", title: "Later", position: 9, today_on: T }], steps, T), T);
    ok("a picked section with no steps still shows, empty", empty.blocks.some((b) => b.section?.id === "s9" && b.items.length === 0 && b.total === 0));
    ok("a step in a section on today comes next", buildCamp(secs, steps, T).next.id === "c" && buildCamp(secs, steps).next.id === "e");

    const fin = withFinishedStep([{ id: "z", camp_id: "k1", done_on: T }], { id: "s1", camp_id: "k1", text: "Search by tag", note: null, done_on: T, subs: [], from: "x" });
    ok("a step ticked in a quest's Today lays its bricks, untouched otherwise", fin.length === 2 && fin[1].text === "Search by tag" && !("subs" in fin[1]) && withFinishedStep(fin, { id: "s1", done_on: null }).length === 1);
  }
  // Quest tags on the day's blocks (0085).
  const tq = [{ id: "q1", title: "Plugin", position: 0 }, { id: "ml", title: "Integrity", lesson_id: "l1" }];
  const tc = [{ id: "c2", quest_id: "q1", title: "Sift tab", position: 1 }, { id: "c1", quest_id: "q1", title: "Multicam tab", position: 0 }];
  const opts = questTagOptions(tq, tc);
  ok("a block can take a quest or one of its camps, and not a lesson's mountain", opts.map((o) => o.value).join() === "q:q1,c:c1,c:c2" && opts[1].label === "Plugin · Multicam tab");
  ok("a block knows its tag", tagOf({ camp_id: "c1", quest_id: "q1" }, opts).short === "Multicam tab" && tagOf({ quest_id: "q1" }, opts).value === "q:q1" && tagOf({}, opts) === null);
  const qd = (chunks) =>
    questWorkDone({
      date: "2026-10-23",
      chunks,
      quests: tq,
      camps: tc,
      tasks: [
        { id: "t1", quest_id: "q1", kind: "task", text: "Email beta users", done_on: "2026-10-23", done_at: "2026-10-23T15:00:00Z" },
        { id: "n1", quest_id: "q1", kind: "note", text: "a note", done_on: "2026-10-23" },
      ],
      steps: [
        { id: "s1", camp_id: "c1", text: "Fix sync drift", done_on: "2026-10-23", updated_at: "2026-10-23T14:00:00Z" },
        { id: "s2", camp_id: "c2", text: "Sort clips", done_on: "2026-10-23", updated_at: "2026-10-23T16:00:00Z" },
        { id: "s3", camp_id: "c1", text: "Yesterday's", done_on: "2026-10-22" },
      ],
    });
  ok("a camp tag brings that camp's steps finished today", qd([{ camp_id: "c1", quest_id: "q1" }]).map((x) => `${x.where}: ${x.title}`).join() === "Multicam tab: Fix sync drift");
  ok("a quest tag brings its tasks and all its camps' steps, in the order done", qd([{ quest_id: "q1" }]).map((x) => x.id).join() === "s1,t1,s2");
  ok("no tag, no quest work", qd([{}]).length === 0);
  const rep = { date: "2026-10-23", minutes: 60, tasks: [], notes: [], tomorrow: [], questDone: [{ id: "s1", title: "Fix sync drift", where: "Multicam tab" }] };
  ok("quest work goes in the report's Done", reportToText(rep).includes("DONE\n· Multicam tab: Fix sync drift") && buildReport(rep).quest.length === 1);

  // Drag to reorder: where a dragged item lands, and the order it makes.
  const mids = [10, 30, 50, 70];
  ok("a drag that doesn't cross a neighbour's middle stays put", dropIndex(mids, 1, 38) === 1 && dropIndex(mids, 1, 22) === 1);
  ok("dragging down past two middles moves two places", dropIndex(mids, 0, 55) === 2 && dropIndex(mids, 0, 99) === 3);
  ok("dragging up to the top lands first", dropIndex(mids, 3, 5) === 0 && dropIndex(mids, 3, 45) === 2);
  ok("moved() puts the dragged id in its new place", moved(["a", "b", "c", "d"], 0, 2).join() === "b,c,a,d" && moved(["a", "b", "c"], 2, 0).join() === "c,a,b");
  // Sketches: the page, its points, the eraser and drawing a stroke a piece at a time.
  ok("a new sketch's page is the room it had, less its margin, within bounds", JSON.stringify(pageSize(1024, 700)) === '{"width":1000,"height":676}' && pageSize(10, 10).width === 50);
  const fp = fitPage(1000, 500, 500, 500);
  ok("a page fits its box, centred", fp.scale === 0.5 && fp.x === 0 && fp.y === 125);
  const pts = [];
  ok("points are kept to a tenth, pressure as 0-100", pushPoint(pts, 10.04, 20.06, 0.5) && pts.join() === "10,20.1,50");
  ok("a point too close to the last is skipped, unless the pen lifts there", !pushPoint(pts, 10.2, 20.2, 0.5) && pushPoint(pts, 10.2, 20.2, 0.5, 0.75, true) && !pushPoint(pts, 10.2, 20.2, 0.5, 0.75, true));
  ok("a pencil pressed harder draws wider", widthAt(4, 90) > widthAt(4, 50) && widthAt(4, 50) > widthAt(4, 10));
  const line = { c: "#141414", w: 4, p: [0, 0, 50, 100, 0, 50] };
  const dotS = { c: "#141414", w: 4, p: [300, 300, 50] };
  ok("the eraser finds a stroke it touches, not one it doesn't", nearStroke(line, 50, 8, 6) && !nearStroke(line, 50, 30, 6) && nearStroke(dotS, 305, 300, 2));
  const hit = erasedBy([line, dotS], 50, 40, 50, -40, 6);
  ok("an eraser swept across a line takes it and only it", hit.has(line) && !hit.has(dotS) && erasedBy([line, dotS], 290, 300, 290, 300, 8).has(dotS));
  const calls = [];
  const fake = { beginPath() {}, moveTo(x, y) { calls.push(`m${x},${y}`); }, quadraticCurveTo(cx, cy, x, y) { calls.push(`q${x},${y}`); }, lineTo(x, y) { calls.push(`l${x},${y}`); }, stroke() {}, arc() { calls.push("dot"); }, fill() {} };
  const three = { c: "#000", w: 2, p: [0, 0, 50, 10, 0, 50, 20, 10, 50] };
  drawPieces(fake, three, 1, 3, false);
  ok("while drawing, the last piece waits for the pen to lift", calls.join(" ") === "m0,0 q15,5");
  calls.length = 0;
  drawPieces(fake, three, 2, 3, true);
  ok("once it lifts, the last piece runs to the last point, joined to the one before", calls.join(" ") === "m15,5 l20,10");
  calls.length = 0;
  drawStrokes(fake, [dotS]);
  ok("a single tap is a dot", calls.join() === "dot");
  const widths = [];
  const thin = { set lineWidth(v) { widths.push(v); }, beginPath() {}, moveTo() {}, quadraticCurveTo() {}, lineTo() {}, stroke() {} };
  drawStrokes(thin, [{ c: "#000", w: 2, p: [0, 0, 10, 50, 0, 90] }], 6);
  ok("shrunk to a thumbnail, no line is drawn thinner than the floor; a heavy one keeps its width", widths[0] === 6 && drawPieces(thin, { c: "#000", w: 9, p: [0, 0, 100, 5, 0, 100] }, 1, 2, true, 6) === undefined && widths[1] > 6);
  const fr = inkFrame({ width: 1000, height: 700, strokes: [{ c: "#000", w: 4, p: [880, 600, 50, 900, 620, 50] }] });
  ok("a few words in a corner: the thumbnail frames them, kept on the page", fr.width === 300 && fr.height === 300 && fr.x === 700 && fr.y === 400);
  ok("a blank page has no frame; a page drawn edge to edge is framed whole", inkFrame({ width: 500, height: 400, strokes: [] }) === null && JSON.stringify(inkFrame({ width: 500, height: 400, strokes: [{ c: "#000", w: 4, p: [0, 0, 50, 500, 400, 50] }] })) === '{"x":0,"y":0,"width":500,"height":400}');
  ok("a summary goes into notes as plain words, bullets kept", plainSummary("## Plan\nThe **gist** here.\n- **Lead:** a point\n* another __one__") === "Plan\nThe gist here.\n- Lead: a point\n- another one");
  ok("added to the end of a line's notes after a blank line", JSON.stringify(appendToNote("Old note ", " New", 100)) === '{"note":"Old note\\n\\nNew","status":"ok"}' && appendToNote(null, "New", 100).note === "New");
  ok("notes that can't take all of it say so: cut, or full", appendToNote("a".repeat(90), "b".repeat(20), 100).status === "cut" && appendToNote("a".repeat(90), "b".repeat(20), 100).note.length === 100 && appendToNote("a".repeat(99), "b", 100).status === "full");
  ok("a summary is stale once the sketch is drawn on after it", staleSummary({ summary: "x", analyzed_at: "2026-10-26T23:00:00Z", updated_at: "2026-10-26T23:05:00.000Z" }) && !staleSummary({ summary: "x", analyzed_at: "2026-10-26T23:05:00+00:00", updated_at: "2026-10-26T23:00:00.000Z" }) && !staleSummary({ summary: null, analyzed_at: null, updated_at: "2026-10-26T23:00:00Z" }));

  // How far along each camp is, for the camps under each quest.
  const ct = campTally([
    { camp_id: "a", done_on: "2026-10-20" },
    { camp_id: "a", done_on: null, working_since: "2026-10-26T10:00:00Z" },
    { camp_id: "a", done_on: null },
    { camp_id: "b", done_on: "2026-10-21", working_since: "2026-10-21T10:00:00Z" },
  ]);
  ok("camp tally: steps done of all, and whether an open one is being worked on", JSON.stringify(ct.get("a")) === '{"done":1,"total":3,"working":true,"today":0}' && JSON.stringify(ct.get("b")) === '{"done":1,"total":1,"working":false,"today":0}' && !ct.has("c"));

  // Scrolling while dragging, in a box from 60 (under the top bar) to 760 (above the tab bar).
  ok("no scroll in the middle of the box", edgePush(400, 60, 760) === 0 && edgePush(141, 60, 760) === 0 && edgePush(679, 60, 760) === 0);
  ok("near the top edge it scrolls up, near the bottom down", edgePush(100, 60, 760) < 0 && edgePush(720, 60, 760) > 0);
  ok("full speed at the box's edge", edgePush(60, 60, 760) === -1 && edgePush(760, 60, 760) === 1);
  ok("past the edge (over the tab bar) it goes faster, but only so fast", edgePush(800, 60, 760) > 1 && edgePush(2000, 60, 760) === 1.75 && edgePush(-500, 60, 760) === -1.75);
  ok("a short box keeps a middle where it doesn't scroll", edgePush(130, 100, 160) === 0 && edgePush(101, 100, 160) < 0);
  ok("pressing a handle already near an edge doesn't scroll until it moves toward it", towardEdge(edgePush(740, 60, 760), 740, 740) === 0 && towardEdge(edgePush(745, 60, 760), 740, 745) === 0 && towardEdge(edgePush(750, 60, 760), 740, 750) > 0);
  ok("moving away from an edge never scrolls toward it; the other way works", towardEdge(edgePush(720, 60, 760), 740, 720) === 0 && towardEdge(edgePush(80, 60, 760), 100, 80) < 0 && towardEdge(0, 0, 500) === 0);
  const deep = buildCamp([], [
    { id: "t", text: "Top", position: 0, done_on: null },
    { id: "t1", parent_id: "t", text: "Sub", position: 0, done_on: "2026-10-23" },
    { id: "t11", parent_id: "t1", text: "Sub-sub", position: 0, done_on: null },
    { id: "t111", parent_id: "t11", text: "Deeper still", position: 0, done_on: "2026-10-23" },
    { id: "x", parent_id: "y", text: "loop", position: 1, done_on: null },
    { id: "y", parent_id: "x", text: "loop", position: 2, done_on: null },
  ]);
  ok("sub-steps nest as deep as they go", deep.loose[0].subs[0].subs[0].subs[0].id === "t111" && deep.loose.length === 1 && deep.total === 4 && deep.done === 2 && deep.next.id === "t");
  ok("everything under a step, however deep", stepsUnder([{ id: "t" }, { id: "t1", parent_id: "t" }, { id: "t11", parent_id: "t1" }, { id: "o", parent_id: "z" }], "t").map((x) => x.id).join() === "t1,t11");
  ok("the next step can be a sub-step", buildCamp(sections, [...steps.slice(0, 3), { id: "c1", section_id: "s2", parent_id: "c", text: "x", position: 0, done_on: null }].map((x) => (x.id === "c" ? { ...x, done_on: "2026-10-23" } : x))).next.id === "c1");

  const tally = campProgress([{ camp_id: "c1", done_on: "2026-10-22" }, { camp_id: "c1", done_on: null }, { camp_id: "c2", done_on: null }]);
  ok("steps are tallied by camp", tally.get("c1").done === 1 && tally.get("c1").total === 2 && tally.get("c2").done === 0);
  const clipTally = campProgress([{ camp_id: "c1", section_id: "s", done_on: null }, { camp_id: "c1", section_id: "clip", done_on: null }], [{ id: "s" }, { id: "clip", clipboard: true }]);
  ok("the Range leaves the clipboard's thoughts out, as the camp does", clipTally.get("c1").total === 1);
  ok("the camp line reads plainly", stepsLine({ done: 12, total: 49 }) === "12 of 49 steps" && stepsLine({ done: 0, total: 0 }) === "No steps yet" && stepsLine({ done: 3, total: 3 }) === "All 3 steps done");

  ok("a pasted list is one step a line, bullets and boxes off", splitSteps("- [ ] Mock it up\n2. Number the steps\n\n• Keep labels short\n  [x] Check widths  ").join("|") === "Mock it up|Number the steps|Keep labels short|Check widths");
  ok("one line is one step", splitSteps("Write a NEW sequence (copy)").join("|") === "Write a NEW sequence (copy)");
  ok("a step that only starts with a number keeps it", splitSteps("200 cuts on the Mac Pro").join() === "200 cuts on the Mac Pro");

  const outline = [
    "FTF Tools · how we build",
    "# New feature playbook",
    "Every step we took, turned into a checklist.",
    "## The workflow",
    "1",
    "### Name the job in one sentence",
    "If it can't be said simply, it isn't ready to build.",
    "- Write what the editor gets.",
    "- Say which tab it lives on.",
    "2",
    "### 2. Market research",
    "- List the competitors.",
    "**Wait for Aaron's OK before building.** Never start on a guess.",
    "## When to check in",
    "| Moment | Who |",
    "| After research | Boss |",
    "## What makes a good plugin",
    "### Invisible cuts",
    "You can't hear the join.",
  ].join("\n");
  const plan = planFromOutline(outline, "x");
  ok("the outline reader takes the title from the top heading", plan.title === "New feature playbook");
  ok("headings with lists become sections, numbers off", plan.sections.map((x) => x.title).join("|") === "Name the job in one sentence|Market research");
  ok("the line under a heading is its why", plan.sections[0].why === "If it can't be said simply, it isn't ready to build.");
  ok("list items are its steps", plan.sections[0].steps.map((x) => x.text).join("|") === "Write what the editor gets.|Say which tab it lives on.");
  ok("a line after the steps is the section's note", plan.sections[1].note.startsWith("**Wait for Aaron's OK"));
  ok("a bare heading over sections is dropped", !plan.notes.includes("The workflow"));
  ok("tables and other headings go to the notes", plan.notes.includes("| After research | Boss |") && plan.notes.includes("### Invisible cuts") && plan.notes.includes("## What makes a good plugin"));
  ok("text before the first heading is the summary", plan.summary.includes("FTF Tools"));
  ok("a plain list with no headings is one section", planFromOutline("- one\n- two", "My plan").sections[0].title === "My plan");
  ok("text with nothing to do has no sections", planFromOutline("Just a paragraph.").sections.length === 0);

  ok("file names read as titles", titleFromFilename("new-feature_playbook.html") === "New feature playbook" && titleFromFilename("") === "");
  ok(
    "files are sorted by kind",
    planFileKind("plan.pdf") === "pdf" && planFileKind("Plan.HTML") === "html" && planFileKind("x.md") === "md" && planFileKind("notes", "text/plain") === "md" && planFileKind("a.docx") === null
  );

  const twoSec = { sections: [{ title: "A", why: "because", note: "", steps: [{ text: "one", note: "n" }, { text: "  " }, { text: "two" }] }, { title: "", steps: [{ text: "three" }] }] };
  const rows = planRows(twoSec, "camp1", 4);
  ok("a plan's sections go after what the camp has", rows.sections.map((x) => x.position).join() === "4,5" && rows.sections[1].title === "Part 2");
  ok("empty steps are left out and the rest keep their section", rows.steps.map((x) => `${x.section}:${x.text}`).join() === "0:one,0:two,1:three");
  ok("empty words are stored as nothing", rows.sections[0].note === null && rows.steps[0].note === "n" && rows.steps[1].note === null);
  ok("a plan's steps are counted", planStepCount(twoSec) === 4 && planStepCount(null) === 0);

  const blocks = noteBlocks("## When to check in\n\n| Moment | Who |\n|---|---|\n| After research | Boss |\n\n### Fast\nBeats the competitor.\n- Robotic cuts\n- Lag\nDone.");
  ok(
    "notes become headings, tables, paragraphs and lists",
    blocks.map((b) => b.kind).join() === "h,table,h,p,ul,p" && blocks[1].head.join() === "Moment,Who" && blocks[1].rows.length === 1 && blocks[4].items.length === 2
  );
  ok("bold lead-ins stay bold", JSON.stringify(boldRuns("**Wait** for it")) === JSON.stringify([{ bold: true, text: "Wait" }, { bold: false, text: " for it" }]));
  ok("a stray ** is just text", boldRuns("2 ** 3")[0].text === "2 ** 3");

  const mts = mountainsOf({
    quests: [
      { id: "lq", title: "More integrity", lesson_id: "l1", status: "on", position: 1 },
      { id: "q1", title: "Build the best Premiere Pro plugin", status: "on", position: 0 },
      { id: "q2", title: "Old", status: "done", position: 2 },
    ],
    camps: [
      { id: "c2", quest_id: "q1", title: "Multicam tab", position: 1 },
      { id: "c1", quest_id: "q1", title: "Sift tab", position: 0 },
    ],
    lessons: [
      { id: "l1", title: "More integrity", status: "learning", position: 0 },
      { id: "l2", title: "Stop drinking caffeine", status: "learning", position: 1 },
      { id: "l3", title: "Patience", status: "learned", position: 2 },
    ],
  });
  ok("plans can go on quests, then lessons", mts.map((m) => `${m.kind}:${m.title}`).join("|") === "Quest:Build the best Premiere Pro plugin|Lesson:More integrity|Lesson:Stop drinking caffeine");
  ok("a mountain's camps are in order", mts[0].camps.map((c) => c.title).join() === "Sift tab,Multicam tab");
  ok("a lesson with no mountain can be given one", mts[2].questId === null && mts[2].lessonId === "l2");

  // A lesson's own mountain is shown with the lesson, not as a quest.
  const av = buildAscent(
    {
      goals: [{ id: "g1", title: "Highly skilled", created_at: "2026-01-01" }],
      quests: [
        { id: "q1", title: "Build the best Premiere Pro plugin", goal_id: "g1", status: "on", position: 0 },
        { id: "lq", title: "old name", goal_id: null, lesson_id: "l1", status: "on", position: 1 },
        { id: "lq2", title: "Patience", lesson_id: "l2", status: "done", finished_on: "2026-10-01", position: 2 },
      ],
      camps: [
        { id: "c1", quest_id: "q1", title: "Sift tab", position: 0 },
        { id: "lc", quest_id: "lq", title: "Tell the whole truth for a week", position: 0 },
      ],
      lessons: [
        { id: "l1", title: "More integrity", goal_id: "g1", status: "learning", started_on: "2026-10-19", position: 0 },
        { id: "l2", title: "Patience", status: "learned", started_on: "2026-08-01", position: 1 },
      ],
    },
    "2026-10-22"
  );
  ok("a lesson's mountain isn't a quest (or a target of its own)", av.quests.map((q) => q.id).join() === "q1" && av.goals[0].quests.map((q) => q.id).join() === "q1");
  ok("it climbs beside the quest, by the lesson's name", av.climbs.length === 1 && av.climbs[0].title === "More integrity" && av.climbs[0].state.camps.length === 1);
  ok("it serves what the lesson serves", av.climbs[0].serves.kind === "goal" && av.climbs[0].serves.id === "g1");
  ok("the lesson knows its mountain", av.lessons[0].mountain?.id === "lq" && av.learned[0].mountain?.id === "lq2");
  ok("a finished lesson mountain is a patch", av.patches.map((q) => q.id).join() === "lq2");
}

// --- Village ------------------------------------------------------------------
{
  ok("the sketch's 29 builds, smallest first within each size", CATALOG.length === 29 && new Set(CATALOG.map((c) => c.kind)).size === 29 && SIZES.every((z) => { const n = CATALOG.filter((c) => c.size === z.key).map((c) => c.need); return n.length && n.every((x, i) => !i || x >= n[i - 1]); }));
  ok("small, middle and big run 12 to 24, 28 to 55 and 70 to 150 tasks", ["small:12:24", "middle:28:55", "big:70:150"].every((r) => { const [z, lo, hi] = r.split(":"); const n = CATALOG.filter((c) => c.size === z).map((c) => c.need); return Math.min(...n) === +lo && Math.max(...n) === +hi && SIZES.find((x) => x.key === z).line === `${lo} to ${hi} tasks`; }));
  ok("the sword armory takes 40 tasks and the citadel 150", buildOf("armory").need === 40 && buildOf("armory").name === "Sword armory" && buildOf("citadel").need === 150 && buildOf("citadel").name === "Citadel");
  ok("the windmill going up keeps its kind and its 45", buildOf("windmill").need === 45 && buildOf("windmill").size === "middle" && !buildOf("windmill").line.startsWith("Your build"));
  ok("no build is a dragon build, and the old dragon builds go by plain names", CATALOG.every((c) => !("dragon" in c) && !("tag" in c) && !/dragon/i.test(c.name + c.line)) && ["stables:Stables", "citadel:Citadel", "saddlery:Saddlery", "hatchery:Fire ring", "flighttower:Round tower", "ring:Training ring", "fishracks:Fish racks"].every((r) => { const [k, n] = r.split(":"); return buildOf(k).name === n; }));
  ok("every build has a name and a line", CATALOG.every((c) => c.name && c.line.length > 40 && /[.)]$/.test(c.line)));
  const has = (path) => { try { return readFileSync(new URL(`../${path}`, import.meta.url)).length > 0; } catch { return false; } };
  ok("every build has its painting and its finished picture", CATALOG.every((c) => has(`public/kit/builds/${c.kind}.js`) && has(`public/village/builds/${c.kind}.jpg`)));
  ok("an unknown kind still has a name", buildOf("zeppelin").name === "Build" && buildOf("zeppelin").need > 0 && buildOf("fortress").name === "Build");
  ok("Another look gives a new variation, the same each time", seedFor("chapel", 0) === seedFor("chapel", 0) && seedFor("chapel", 0) !== seedFor("chapel", 1) && seedFor("chapel", 3) > 0);
  ok("every 5 arrows trains a soldier", soldiersFor(0) === 0 && soldiersFor(4) === 0 && soldiersFor(5) === 1 && soldiersFor(124) === 24);
  ok("their bows are The Mark's", bowFor(0) === tierOf(0) && bowFor(30) === tierOf(30) && bowFor(30) !== bowFor(0) && bowFor(180) === tierOf(180));
  ok("plots start beside the plaza", JSON.stringify(tileOf(0)) === "[0,-1]" && JSON.stringify(tileOf(3)) === "[0,1]");
  const big = layout(60), seen = new Set();
  for (const t of [...big.plots.map((p) => p.tile), ...big.nature.map((n) => n.tile), [0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) seen.add(t.join());
  ok("the village grows forever without two things on one plot", big.plots.length === 60 && seen.size === big.plots.length + big.nature.length + 5);
  ok("the first free plot fills gaps", freePlot([{ plot: 0 }, { plot: 2 }]) === 1 && freePlot([]) === 0);
  ok("day index counts calendar days", dayIndex("2026-10-22", "2026-10-15") === 7 && dayIndex("2026-11-02", "2026-10-31") === 2);
  ok("short names", shortName("Build the best Premiere Pro plugin") === "Plugin" && shortName("More integrity") === "More integrity" && shortName("Future quest number 15") === "Future quest");

  const units = finishedUnits({
    tasks: [
      { id: "t2", quest_id: "q1", kind: "task", text: "later", done_on: "2026-10-22", done_at: "2026-10-22T18:00:00Z" },
      { id: "t1", quest_id: "q1", kind: "task", text: "earlier", done_on: "2026-10-22", done_at: "2026-10-22T09:00:00Z" },
      { id: "t3", quest_id: "q1", kind: "task", text: "open", done_on: null },
      { id: "n1", quest_id: "q1", kind: "note", text: "a note", done_on: "2026-10-22" },
    ],
    steps: [{ id: "s1", camp_id: "c1", text: "a camp step", done_on: "2026-10-21", updated_at: "2026-10-21T10:00:00Z" }],
    camps: [{ id: "c1", quest_id: "q2" }],
  });
  ok("finished tasks and camp steps lay bricks, in the order they were done", units.map((u) => u.id).join() === "s1,t1,t2");
  ok("a camp step counts for its quest", units[0].src === "step" && units[0].questId === "q2" && units[1].src === "task");
  const subUnits = finishedUnits({
    steps: [
      { id: "s1", camp_id: "c1", text: "a step", done_on: "2026-10-21" },
      { id: "s1a", camp_id: "c1", parent_id: "s1", text: "its sub-step", done_on: "2026-10-22" },
      { id: "s1b", camp_id: "c1", parent_id: "s1", text: "an open sub-step", done_on: null },
    ],
    camps: [{ id: "c1", quest_id: "q2" }],
  });
  ok("a finished camp sub-step lays its own bricks for the quest", subUnits.map((x) => x.id).join() === "s1,s1a" && subUnits[1].questId === "q2");

  const u = (id, day) => ({ id, day, at: day + "T12:00:00Z" });
  const al = allocate(
    [
      { id: "b", kind: "beacon", need: 2, started_on: "2026-10-20", created_at: "2026-10-20T10:00:00Z" },
      { id: "a", kind: "liberty", need: 3, started_on: "2026-10-10", created_at: "2026-10-10T10:00:00Z" },
    ],
    [u("1", "2026-10-05"), u("2", "2026-10-11"), u("3", "2026-10-12"), u("4", "2026-10-13"), u("5", "2026-10-21"), u("6", "2026-10-22")]
  );
  ok("builds take tasks in the order they were chosen", al.projects.map((p) => p.id).join() === "a,b" && al.projects[0].items.map((i) => i.id).join() === "1,2,3");
  ok("a task finished before a build was chosen lays its bricks the day it was", al.projects[0].items[0].laid === "2026-10-10" && al.projects[1].items[0].laid === "2026-10-20");
  ok("both stand, and the extra task waits for the next build", al.current === -1 && al.projects.every((p) => p.complete) && al.waiting.map((w) => w.id).join() === "6" && al.projects[1].finishedOn === "2026-10-21");
  const going = allocate([{ id: "a", kind: "liberty", need: 3, started_on: "2026-10-10" }], [u("1", "2026-10-11")]);
  ok("a build still short of its tasks is the one going up", going.current === 0 && going.projects[0].done === 1 && !going.projects[0].complete && !going.waiting.length);

  const people = villagersOf([
    { pid: "B", name: "Ben", ordinances: [{ date: "2025-03-01", temple: "Provo" }, { date: "2024-12-01", temple: "Mount Timpanogos" }] },
    { pid: "A", name: "Ann", ordinances: [{ date: "2025-01-01", temple: "Provo" }] },
    { pid: "C", name: "Cy", ordinances: [] },
  ]);
  ok("villagers arrive on their first ordinance, earliest first", people.map((p) => p.pid).join() === "B,A,C" && people[0].first === "2024-12-01" && people[0].temple === "Mount Timpanogos" && people[2].first === null);

  const raw = {
    projects: [
      { id: "p0", kind: "windmill", seed: 3, plot: 0, need: 3, started_on: "2026-10-20" },
      { id: "p1", kind: "hatchery", seed: 9, plot: 1, need: 4, started_on: "2026-10-22" },
      { id: "p9", kind: "chapel", seed: 1, plot: 2, need: 4, started_on: "2026-11-01" },
    ],
    tasks: [
      { id: "t1", quest_id: "q1", kind: "task", text: "one", done_on: "2026-10-20", done_at: "2026-10-20T09:00:00Z" },
      { id: "t2", quest_id: "lq", kind: "task", text: "two", done_on: "2026-10-21", done_at: "2026-10-21T09:00:00Z" },
      { id: "t3", quest_id: "q1", kind: "task", text: "three", done_on: "2026-10-21", done_at: "2026-10-21T10:00:00Z" },
      { id: "t4", quest_id: "q1", kind: "task", text: "four", done_on: "2026-10-22", done_at: "2026-10-22T10:00:00Z" },
      { id: "t5", quest_id: "q1", kind: "task", text: "tomorrow", done_on: "2026-10-23", done_at: "2026-10-23T10:00:00Z" },
    ],
    steps: [],
    camps: [],
    quests: [{ id: "q1", title: "Build the best Premiere Pro plugin" }, { id: "lq", title: "x", lesson_id: "l1" }],
    lessons: [{ id: "l1", title: "More integrity" }],
    shots: [{ date: "2026-10-19", level: 0 }, { date: "2026-10-21", level: 2 }, { date: "2026-10-30", level: 0 }],
    temple: [{ pid: "A", name: "Ann", ordinances: [{ date: "2025-01-01", temple: "Provo" }] }, { pid: "B", name: "Ben", ordinances: [{ date: "2026-10-21", temple: "Provo" }] }],
  };
  const v = villageOf(raw, "2026-10-22");
  ok("the village has the builds chosen so far, not later ones", v.projects.map((p) => p.id).join() === "p0,p1" && v.projects[0].name === "Windmill" && v.projects[1].name === "Fire ring");
  ok("the windmill stood on its third task, the hatchery is going up", v.projects[0].complete && v.projects[0].finishedOn === "2026-10-21" && v.current === 1 && v.projects[1].done === 1 && v.waiting === 0);
  ok("each brick knows its quest, a lesson's by the lesson's name", v.projects[0].items[1].quest === "More integrity" && v.projects[0].items[0].quest === "Build the best Premiere Pro plugin");
  ok("tasks and arrows after today don't count yet", v.arrows.length === 2 && v.bullseyes.length === 1 && v.projects[1].items.every((i) => i.day <= "2026-10-22"));
  ok("the first day is the first thing that happened (an arrow here)", v.day0 === "2026-10-19" && v.days === 3 && v.nextPlot === 2);
  ok("villagers from before the village arrive on its first day", v.villagers.map((x) => x.arrive).join() === "2026-10-19,2026-10-21");
  const st = standingOf(raw.projects, finishedUnits(raw), "2026-10-22");
  ok("where it stands: the hatchery, 1 of 4, 3 left, 1 today", st.project.id === "p1" && st.done === 1 && st.need === 4 && st.left === 3 && st.today === 1 && st.standing === 1);
  const none = standingOf([raw.projects[0]], finishedUnits(raw), "2026-10-22");
  ok("nothing going up: the finished tasks wait for a build", none.project === null && none.waiting === 1 && none.standing === 1 && none.last.id === "p0");
  const empty = villageOf({}, "2026-10-22");
  ok("an empty village starts a week back", empty.day0 === "2026-10-15" && empty.days === 7 && empty.current === -1 && empty.nextPlot === 0 && !empty.villagers.length);
}

// --- Quest lists ------------------------------------------------------------------
{
  const T = "2026-10-23";
  const rows = [
    { id: "a", day: "2026-10-21", kind: "task", text: "old", position: 0, done_on: null },
    { id: "b", day: T, kind: "task", text: "second", position: 1, done_on: T },
    { id: "c", day: T, kind: "task", text: "first", position: 0, done_on: null },
    { id: "s1", day: T, parent_id: "c", kind: "task", text: "sub", position: 0, done_on: T },
    { id: "n", day: T, kind: "note", text: "a note", position: 2 },
    { id: "y", day: "2026-10-22", kind: "note", text: "yesterday's note", position: 0 },
  ];
  const days = listDays(rows, T);
  ok("today first, then the rest newest first", days.map((d) => d.day).join() === "2026-10-23,2026-10-22,2026-10-21");
  ok("lines in order with their sub-tasks under them", days[0].items.map((i) => i.id).join() === "c,b,n" && days[0].items[0].subs.map((x) => x.id).join() === "s1");
  ok("tasks and sub-tasks count, note lines don't", days[0].done === 2 && days[0].total === 3 && days[1].total === 0);
  ok("an earlier day's open task stays on its day", days[2].items[0].id === "a" && days[2].done === 0);
  ok("today is there even with nothing on it", listDays([], T).length === 1 && listDays([], T)[0].items.length === 0);
  ok("day names", dayLabel(T, T) === "Today" && dayLabel("2026-10-22", T) === "Yesterday" && dayLabel("2026-10-20", T) === "Tue, Oct 20" && dayLabel("2025-10-20", T).includes("2025"));
  ok("a new line goes after the last one, a sub-task after its last sibling", nextLinePosition(rows, T) === 3 && nextLinePosition(rows, T, "c") === 1 && nextLinePosition(rows, "2026-10-24") === 0);

  // The ongoing list (0089): its lines are on no day, its sub-tasks go with them.
  const more = [
    ...rows,
    { id: "o1", day: "2026-10-21", ongoing: true, kind: "task", text: "keep it on one page", position: 1, done_on: null },
    { id: "o2", day: "2026-10-20", ongoing: true, kind: "note", text: "aim for clarity", position: 0 },
    { id: "o1s", day: "2026-10-21", parent_id: "o1", kind: "task", text: "sub with no mark", position: 0, done_on: "2026-10-22" },
    { id: "o3", day: T, ongoing: true, kind: "task", text: "ticked today", position: 2, done_on: T },
    { id: "o4", day: T, ongoing: true, kind: "task", text: "ticked before", position: 3, done_on: "2026-10-22" },
    { id: "o5", day: T, ongoing: true, kind: "task", text: "ticked before, a sub still open", position: 4, done_on: "2026-10-22" },
    { id: "o5s", day: T, ongoing: true, parent_id: "o5", kind: "task", text: "open sub", position: 0, done_on: null },
  ];
  const daysWith = listDays(more, T);
  ok("ongoing lines stay off the days", daysWith.map((d) => d.items.map((i) => i.id).join("+")).join("|") === listDays(rows, T).map((d) => d.items.map((i) => i.id).join("+")).join("|"));
  const og = ongoingList(more, T);
  ok("the ongoing list in order, its sub-tasks under them", og.items.map((i) => i.id).join() === "o2,o1,o3,o5" && og.items[1].subs.map((x) => x.id).join() === "o1s");
  ok("lines done before today tuck away, unless a sub-task is still open", og.earlier.map((i) => i.id).join() === "o4");
  ok("the ongoing list counts all its tasks, not its notes", og.done === 4 && og.total === 6);
  ok("nothing ongoing: an empty list", ongoingList(rows, T).items.length === 0 && ongoingList(rows, T).total === 0);
  const lastSub = ongoingList(more.map((r) => (r.id === "o5s" ? { ...r, done_on: T } : r)), T);
  ok("ticking the last open sub-task today keeps its line in view", lastSub.items.some((i) => i.id === "o5") && lastSub.earlier.map((i) => i.id).join() === "o4");
  ok("a new ongoing line goes after the last ongoing one", nextLinePosition(more, null) === 5 && nextLinePosition(more, T) === 3 && nextLinePosition(more, null, "o5") === 1);

  // Lines picked for today (0090) from the ongoing list and earlier days show again in today's list.
  {
    const pk = more.map((r) =>
      r.id === "o1" || r.id === "o2" || r.id === "a" || r.id === "c" || r.id === "s1" ? { ...r, today_on: T } : r.id === "y" ? { ...r, today_on: "2026-10-22" } : r
    );
    pk.push({ id: "w", day: "2026-10-22", kind: "task", text: "yesterday's open task", position: 3, done_on: null, today_on: T });
    const p = pickedLines(pk, T);
    ok("picked lines: the ongoing list's first, then earlier days newest first", p.items.map((i) => i.id).join() === "o2,o1,w,a");
    ok("a line on today's own list isn't shown twice, nor a sub-task alone", !p.items.some((i) => i.id === "c" || i.id === "s1"));
    ok("a picked line keeps its sub-tasks and says where it's from", p.items[1].subs.map((x) => x.id).join() === "o1s" && p.items[0].from === "ongoing" && p.items[2].from === "2026-10-22");
    ok("a line picked on another day isn't on today", !pickedLines(pk, "2026-10-28").items.length);
    ok("picked lines count their tasks and sub-tasks, not notes", p.total === 4 && p.done === 1);
    ok("picked lines stay where they sit too", ongoingList(pk, T).items.some((i) => i.id === "o1") && listDays(pk, T).some((d) => d.items.some((i) => i.id === "a")));
  }

  const b = boardOf({
    quests: [
      { id: "q2", title: "Second", status: "on", position: 1 },
      { id: "q1", title: "First", status: "on", position: 0, goal_id: "g1", note: "notes" },
      { id: "q3", title: "Done", status: "done", position: 2 },
      { id: "lq", title: "x", lesson_id: "l1", status: "on", note: "lesson notes" },
    ],
    lessons: [
      { id: "l1", title: "More integrity", status: "learning", position: 0 },
      { id: "l2", title: "Caffeine", status: "learning", position: 1 },
      { id: "l3", title: "Patience", status: "learned", position: 2 },
    ],
  });
  ok("quests on, in order, then lessons being learned", b.map((i) => i.key).join() === "q1,q2,lq,lesson-l2" && b[0].goalId === "g1" && b[0].note === "notes");
  ok("a lesson's list is its mountain, or waits for one", b[2].questId === "lq" && b[2].name === "More integrity" && b[2].note === "lesson notes" && b[3].questId === null && b[3].type === "Lesson");

  const parsed = parseLines("- Call Sam\n  - ask about the beta\n\t[ ] check email\n\n2. Write copy");
  ok("a pasted list: one line each, marks taken off, indented lines as sub-tasks", parsed.map((l) => (l.sub ? ">" : "") + l.text).join("|") === "Call Sam|>ask about the beta|>check email|Write copy");
  ok("lines indented alike are all top lines", parseLines("  one\n  two\n    three").map((l) => l.sub).join() === "false,false,true");

  const fin = [{ id: "x", kind: "task", done_on: T }];
  ok("a tick adds a brick, untick takes it off", withFinished(fin, { id: "a", quest_id: "q1", kind: "task", text: "t", done_on: T }).length === 2 && withFinished(fin, { id: "x", kind: "task", done_on: null }).length === 0);
  ok("a note line never lays a brick", withFinished([], { id: "n", kind: "note", done_on: T }).length === 0);
  ok("counts read", countLine(1, "task", "tasks") === "1 task" && countLine(3, "task", "tasks") === "3 tasks");
}

function sectionOf({ x, y }) {
  const a = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.floor(((((a + 90) % 360) + 360) % 360) / 90);
}

// ---------------------------------------------------------------------------
// The 3D village's plan and arithmetic (src/village/plots.js)
// ---------------------------------------------------------------------------
{
  const P = await import("../src/village/plots.js");
  const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
  console.log("\nthe 3D village");

  // The coast: every plot's pad, in the order the town takes them.
  const C = await import("../src/village/coast.js");
  const S = C.sites();
  ok("64 plots on the coast, nearest the plaza first", S.length === 64 && S.every((s, i) => i === 0 || Math.hypot(s.x, s.z) >= Math.hypot(S[i - 1].x, S[i - 1].z) - 1e-9));
  ok("every build faces the plaza", S.every((s) => {
    const [fx, fz] = P.frontOf(s.ry);
    return (fx * -s.x + fz * -s.z) / Math.hypot(s.x, s.z) > 0.999;
  }));
  const onPad = (s) => [...C.cornersOf(s), [s.x, s.z]];
  ok("every plot is on land, clear of the shore and the rivers", S.every((s) => onPad(s).every(([x, z]) => {
    const rv = C.riverAt(x, z);
    return C.shoreDist(x, z) >= 18 && C.naturalAt(x, z) > 1 && (!rv || rv.past || rv.d > rv.w / 2 + 6);
  })));
  const riverX = (rv, z) => rv.samples.reduce((b, t) => (Math.abs(t.z - z) < Math.abs(b.z - z) ? t : b)).x;
  ok("the town stays between the two rivers", S.every((s) => s.x > riverX(C.RIVERS[0], s.z) && s.x < riverX(C.RIVERS[1], s.z)));
  const plazaRect = { x: 0, z: 0, hw: P.PLAZA / 2, hd: P.PLAZA / 2, ry: 0 };
  let tight = 0;
  for (let i = 0; i < S.length; i++) {
    const a = S[i];
    if (Math.min(...onPad(a).map(([x, z]) => C.rectOut(plazaRect, x, z))) < C.GAP) tight++;
    for (let j = i + 1; j < S.length; j++) {
      const b = S[j];
      if (Math.hypot(a.x - b.x, a.z - b.z) > P.TILE * 2) continue;
      const gap = Math.min(...onPad(b).map(([x, z]) => C.rectOut(a, x, z)), ...onPad(a).map(([x, z]) => C.rectOut(b, x, z)));
      if (gap < C.GAP - 1e-6) tight++;
    }
  }
  ok("no two plots overlap, a lane's width apart, and none on the plaza", tight === 0, `${tight} too close`);
  ok("a build is scaled down only when it reaches past its plot", P.scaleFor(P.TILE / 2 - P.MARGIN) === 1 && near(P.scaleFor(18.6), (P.TILE / 2 - P.MARGIN) / 18.6));

  // The ground: the plaza and the plots in use levelled, the rest as the land lies.
  const g1 = C.groundOf([S[0]]);
  ok("a plot in use is cut level", onPad(S[0]).every(([x, z]) => near(g1.height(x, z), S[0].y)) && near(C.heightAt(0, 0), C.PLAZA_LEVEL));
  ok("a plot not yet used is left as the land lies", near(C.groundOf([]).height(S[40].x, S[40].z), C.naturalAt(S[40].x, S[40].z)));
  const inner = (s, k) => [[-k, -k], [k, -k], [-k, k], [k, k]].map(([a, b]) => [s.x + a * s.hw * Math.cos(s.ry) + b * s.hd * Math.sin(s.ry), s.z - a * s.hw * Math.sin(s.ry) + b * s.hd * Math.cos(s.ry)]);
  const every = (n) => {
    const g = C.groundOf(S.slice(0, n));
    return S.slice(0, n).every((s) => [...onPad(s), ...inner(s, 0.9)].every(([x, z]) => Math.abs(g.height(x, z) - s.y) < 0.02));
  };
  ok("every plot in use stays level when its neighbours are cut too", every(7) && every(17) && every(40) && every(64));
  let seam = 0;
  const gAll = C.groundOf(S);
  for (const s of S)
    for (let k = -60; k <= 60; k += 0.5) {
      for (const [x, z] of [[s.x + k, s.z], [s.x, s.z + k]]) {
        const a = gAll.height(x, z);
        const b = gAll.height(x + 0.1, z + 0.1);
        // the land's own cliffs aside
        if (Math.abs(a - b) > 0.6 && Math.abs(C.naturalAt(x, z) - C.naturalAt(x + 0.1, z + 0.1)) < 0.3) seam++;
      }
    }
  ok("the banks round the plots have no steps in them", seam === 0, `${seam} steps`);
  ok("more builds than plots share the last plots' lanes", C.routeOf(64) === C.routeOf(63 - (64 % 8)) && C.routeOf(70).length > 1);

  const aaron = { projects: [{ id: "w", kind: "windmill", plot: 0 }], nextPlot: 1 };
  const plan = P.planOf(aaron);
  ok("the windmill stands on the first plot, the next plot staked out", plan.plots[0].x === S[0].x && plan.plots[0].z === S[0].z && plan.plots[0].y === S[0].y && plan.stake.x === S[1].x && plan.stake.plot === 1);
  ok("the town reaches as far as the plots in use and the next one", near(plan.radius, Math.max(P.PLAZA * 0.71, Math.hypot(S[0].x, S[0].z), Math.hypot(S[1].x, S[1].z)) + P.TILE * 0.62) && P.planOf({ projects: [], nextPlot: 0 }).radius <= plan.radius);
  const big = P.planOf({ projects: layout(16).plots.map(({ plot }) => ({ id: `p${plot}`, kind: "forge", plot })), nextPlot: 16 });
  ok("a bigger village reaches further", big.radius > plan.radius * 1.5);

  // Lanes run from each plot's front to the plaza, round every other plot, never through a river or the sea.
  const paths = P.pathsOf(big, () => 6);
  const inPlaza = ([x, z]) => Math.abs(x) <= P.PLAZA / 2 + 1e-9 && Math.abs(z) <= P.PLAZA / 2 + 1e-9;
  ok("a lane from every plot and the next", paths.length === 17 && paths.every((p) => p.points.length >= 3));
  ok("every lane ends at the plaza", paths.every((p) => {
    const [x, z] = p.points[p.points.length - 1];
    return Math.abs(x) <= P.PLAZA / 2 + 0.5 && Math.abs(z) <= P.PLAZA / 2 + 0.5;
  }));
  let crosses = 0;
  let wet = 0;
  for (const path of [...paths, ...C.allRoutes().map((points, plot) => ({ plot, points: [null, ...points] }))]) {
    for (let i = 1; i < path.points.length - 1; i++) {
      const [ax, az] = path.points[i];
      const [bx, bz] = path.points[i + 1];
      for (let k = 0; k <= 10; k++) {
        const x = ax + ((bx - ax) * k) / 10;
        const z = az + ((bz - az) * k) / 10;
        for (const q of S) if (q.plot !== path.plot && Math.abs(x - q.x) < P.TILE && Math.abs(z - q.z) < P.TILE && C.rectOut(q, x, z) < 0.3) crosses++;
        const rv = C.riverAt(x, z);
        if (C.shoreDist(x, z) < 3 || (rv && !rv.past && rv.d < rv.w / 2 + 1)) wet++;
      }
    }
  }
  ok("no lane, of all the town's, crosses another plot", crosses === 0, `${crosses} points inside other plots`);
  ok("no lane runs into a river or the sea", wet === 0, `${wet} wet points`);
  const first = paths.find((p) => p.plot === 0).points;
  const [f0x, f0z] = P.frontOf(S[0].ry);
  ok("a lane starts at its build's front", near(first[0][0], S[0].x + f0x * 6) && near(first[0][1], S[0].z + f0z * 6));

  // Progress, as the painted stills show it.
  const s1 = P.stageOf(106, 36, 45, 0);
  ok("36 of 45 shows 84 of the windmill's 106 steps, none today", s1.shown === 84 && s1.today === 0 && near(s1.frac, 84.5 / 106));
  ok("5 laid today are the last 11 steps", P.stageOf(106, 36, 45, 5).today === 11);
  ok("a build that stands shows everything, its people too", P.stageOf(106, 45, 45, 0).shown === 107 && P.stageOf(106, 45, 45, 0).frac === 1);

  // The replay: Aaron's village, day by day.
  const arrows = [];
  for (let d = 20; d <= 23; d++) for (let i = 0; i < 8; i++) arrows.push({ id: `a${d}${i}`, date: `2026-10-${d}`, level: arrows.length < 10 ? 0 : 2 });
  const steps = Array.from({ length: 36 }, (_, i) => ({ id: `s${String(i).padStart(2, "0")}`, camp_id: "c1", text: `Step ${i}`, done_on: "2026-10-23", updated_at: `2026-10-23T10:${String(i).padStart(2, "0")}:00Z` }));
  const temple = Array.from({ length: 125 }, (_, i) => ({ pid: `x${i}`, name: `Name ${i}`, gender: i % 9 ? "M" : "F", ordinances: [{ date: "2019-05-04", temple: "Provo" }] }));
  const raw = { projects: [{ id: "w", kind: "windmill", seed: 10120, plot: 0, need: 45, started_on: "2026-10-22" }], tasks: [], steps, camps: [{ id: "c1", quest_id: "q1" }], quests: [{ id: "q1", title: "Q" }], lessons: [], shots: arrows, temple };
  const v = villageOf(raw, "2026-10-25");
  ok("five days from the first arrow to today", P.spanOf(v) === 5 && P.dayOf(null, v) === 5 && P.dayOf("2026-10-22", v) === 2 && P.dayOf("2020-01-01", v) === 0);
  const d2 = P.stateOn(v, 2);
  const d3 = P.stateOn(v, 3);
  const now = P.stateOn(v, 5);
  ok("day 2: the windmill's plot is laid out, nothing on it yet", d2.builds[0].exists && d2.builds[0].done === 0 && d2.going === "w");
  ok("day 3: 36 tasks laid at once, all that day", d3.builds[0].done === 36 && d3.builds[0].laid === 36);
  ok("today: 36 of 45, none today", now.builds[0].done === 36 && now.builds[0].laid === 0 && !now.builds[0].complete && now.going === "w");
  ok("day 1: not chosen yet", !P.stateOn(v, 1).builds[0].exists && P.stateOn(v, 1).going === null);
  ok("the soldiers train as the arrows fly", P.stateOn(v, 0).soldiers === 1 && P.stateOn(v, 1).soldiers === 3 && now.soldiers === 6 && now.tier === 0);
  ok("everyone from before the village is there from the first day", P.stateOn(v, 0).villagers === 125);
  ok("a replay takes 4 to 30 seconds", P.playSecs(5) === 4 && P.playSecs(30) === 10 && P.playSecs(400) === 30);

  // People.
  const f = P.formationOf(100, 2);
  ok("at most 40 soldiers drill, all in the plaza", P.formationOf(6).length === 6 && f.length === 40 && f.every((s) => inPlaza([s.x, s.z]) && s.z > 1 && s.tier === 2));
  ok("archers draw in the front rank", f.slice(0, 10).every((s) => s.pose === "draw" && s.role === "archer") && f.some((s) => s.role === "soldier"));
  const spots = P.spotsOf(P.pathsOf(plan), v.villagers);
  ok("40 villagers stand at most, the same each time", spots.length === 40 && JSON.stringify(spots) === JSON.stringify(P.spotsOf(P.pathsOf(plan), v.villagers)));
  ok("none stands on the flag", spots.every((s) => Math.hypot(s.x, s.z) > 2.5));
  ok("no villagers, nobody drawn", P.spotsOf(P.pathsOf(plan), []).length === 0);

  // Labels.
  const rect = { left: 0, top: 0, right: 390, bottom: 844 };
  const shown = P.placeLabels(
    [
      { id: "a", x: 100, y: 200, w: 80, h: 24, prio: 1 },
      { id: "b", x: 120, y: 210, w: 80, h: 24, prio: 0 },
      { id: "c", x: 300, y: 400, w: 60, h: 24, prio: 2 },
      { id: "d", x: 380, y: 400, w: 60, h: 24, prio: 3 },
      { id: "e", x: 200, y: 600, w: 60, h: 24, prio: 4, on: false },
    ],
    rect
  );
  ok("labels: the first placed wins an overlap, off-screen and behind hide", shown.has("b") && !shown.has("a") && shown.has("c") && !shown.has("d") && !shown.has("e"));
  const kept = P.placeLabels(
    [
      { id: "over", x: 200, y: 300, w: 80, h: 24, prio: 0 },
      { id: "clear", x: 200, y: 500, w: 80, h: 24, prio: 1 },
    ],
    rect,
    4,
    [{ l: 150, r: 260, t: 280, b: 340 }]
  );
  ok("labels keep off what must stay in sight (the soldiers)", !kept.has("over") && kept.has("clear"));

  // Links.
  ok("?build=<id> opens that build", JSON.stringify(P.linkOf("?build=abc")) === '{"build":"abc","choose":null}');
  ok("?choose opens Choose, ?choose=<kind> points at one", P.linkOf("?choose").choose === true && P.linkOf("?choose=forge").choose === "forge" && P.linkOf("").choose === null && P.linkOf("").build === null);
}

// Saves in order (2026-10-27): a quick Undo waits for the move it undoes.
{
  const { savesInOrder, undoableSave } = await import("../src/lib/inOrder.js");
  const tick = (ms) => new Promise((r) => setTimeout(r, ms));
  const seen = [];
  const save = (name, ms, bad = false) => () => tick(ms).then(() => (seen.push(name), bad ? Promise.reject(new Error(name)) : null));

  const inOrder = savesInOrder();
  const a = inOrder(save("slow", 30, true)).catch(() => "caught");
  const b = inOrder(save("fast", 1));
  ok("saves land in the order they were made, even after one fails", (await a) === "caught" && (await b) === null && seen.join() === "slow,fast");

  // The move fails after Undo was tapped: Undo's save runs, then the failure.
  seen.length = 0;
  const log = [];
  const q = savesInOrder();
  const undo = undoableSave(q, save("move", 20, true), (err) => log.push(`failed ${err.message}`));
  undo(save("back", 1), (err) => log.push(`back failed ${err.message}`));
  await tick(60);
  ok("a move that fails after Undo is reported once Undo's save has landed", seen.join() === "move,back" && log.join() === "failed move");

  // The move fails before Undo: reported at once.
  seen.length = 0;
  log.length = 0;
  const q2 = savesInOrder();
  undoableSave(q2, save("move", 1, true), (err) => log.push(`failed ${err.message}`));
  await tick(20);
  ok("a move that fails with no Undo is reported right away", log.join() === "failed move");

  // Undo's own save fails: its own message, and nothing else.
  seen.length = 0;
  log.length = 0;
  const q3 = savesInOrder();
  const undo3 = undoableSave(q3, save("move", 5), (err) => log.push(`failed ${err.message}`));
  undo3(save("back", 1, true), (err) => log.push(`back failed ${err.message}`));
  await tick(40);
  ok("Undo's own failure is reported as Undo's", seen.join() === "move,back" && log.join() === "back failed back");

  // A failure's reload waits for the saves already in line, and goes again
  // for any made while it was out.
  seen.length = 0;
  const q4 = savesInOrder();
  q4(save("first", 5, true)).catch(() => q4.reload(save("reload", 10)));
  q4(save("second", 10));
  await tick(12);
  q4(save("third", 1));
  await tick(60);
  ok("a reload after a failure runs after the saves before it, and again after one made while it was out", seen.join() === "first,second,reload,third,reload");
}

// Everything finished today: what the count on a quest's Today, and the
// build's "N today", open.
{
  const T = "2026-10-27";
  const camps = [
    { id: "k2", quest_id: "q", title: "Multicam", position: 1 },
    { id: "k1", quest_id: "q", title: "Sift", position: 0 },
    { id: "k3", quest_id: "q", title: "Graphica", position: 2 },
    { id: "k9", quest_id: "other", title: "Elsewhere", position: 0 },
  ];
  const sections = [
    { id: "x1", camp_id: "k1", title: "Search", position: 0 },
    { id: "x2", camp_id: "k1", title: "Tags", position: 1 },
  ];
  const steps = [
    { id: "a", camp_id: "k1", section_id: "x2", text: "Tag panel", position: 0, done_on: T },
    { id: "a1", camp_id: "k1", section_id: "x2", parent_id: "a", text: "Panel layout", position: 0, done_on: T },
    { id: "a2", camp_id: "k1", section_id: "x2", parent_id: "a", text: "Panel colours", position: 1, done_on: null },
    { id: "a21", camp_id: "k1", section_id: "x2", parent_id: "a2", text: "Pick the orange", position: 0, done_on: T },
    { id: "b", camp_id: "k1", section_id: "x1", text: "Search by tag", position: 0, done_on: null },
    { id: "b1", camp_id: "k1", section_id: "x1", parent_id: "b", text: "Index the tags", position: 0, done_on: T },
    { id: "c", camp_id: "k1", text: "Loose one", position: 0, done_on: T, note: "Took an hour" },
    { id: "m", camp_id: "k2", text: "Done yesterday", position: 0, done_on: "2026-10-26" },
    { id: "g", camp_id: "k3", text: "Ring one", position: 0, done_on: T },
    { id: "z", camp_id: "k9", text: "Other quest's", position: 0, done_on: T },
  ];
  const lines = [
    { id: "t1", quest_id: "q", kind: "task", text: "Today's own", day: T, position: 0, done_on: T },
    { id: "t2", quest_id: "q", kind: "task", text: "Still open", day: T, position: 1, done_on: null },
    { id: "t21", quest_id: "q", kind: "task", parent_id: "t2", text: "Its first part", day: T, position: 0, done_on: T },
    { id: "n1", quest_id: "q", kind: "note", text: "A note", day: T, position: 2, done_on: null },
    { id: "o1", quest_id: "q", kind: "task", text: "Ongoing one", ongoing: true, day: "2026-10-20", position: 0, done_on: T },
    { id: "o11", quest_id: "q", kind: "task", parent_id: "o1", text: "Ongoing part", ongoing: false, day: "2026-10-25", position: 0, done_on: T },
    { id: "e1", quest_id: "q", kind: "task", text: "From the 20th", day: "2026-10-20", position: 0, done_on: T },
    { id: "e2", quest_id: "q", kind: "task", text: "From the 25th", day: "2026-10-25", position: 0, done_on: T },
    { id: "e3", quest_id: "q", kind: "task", text: "Done back then", day: "2026-10-25", position: 1, done_on: "2026-10-25" },
    { id: "lost", quest_id: "q", kind: "task", parent_id: "gone", text: "Orphan", day: T, position: 0, done_on: T },
  ];
  const mine = questDoneToday({ camps: camps.filter((c) => c.quest_id === "q"), sections, steps, lines }, T);
  const shape = (items) => items.map((i) => i.id + (i.subs.length ? `(${shape(i.subs)})` : "")).join("+");
  const find = (items, id) => items.reduce((hit, i) => hit ?? (i.id === id ? i : find(i.subs, id)), null);
  const at = (id) => mine.groups.reduce((hit, g) => hit ?? find(g.items, id), null);
  ok(
    "done today: each camp's steps as they sit in it, camps in order, then the list's lines",
    mine.groups.map((g) => `${g.camp ? g.number + g.camp.title : g.key}:${shape(g.items)}`).join() === "1Sift:c+b1+a(a1+a21),3Graphica:g,list:t1+t21+o1(o11)+e2+e1",
    mine.groups.map((g) => `${g.camp ? g.number + g.camp.title : g.key}:${shape(g.items)}`).join()
  );
  ok(
    "each says where it sits when that isn't plain",
    at("c").from === null && at("b1").from === "1. Search · under “Search by tag”" && at("a").from === "2. Tags" && at("a1").from === null && at("a21").from === "under “Panel colours”"
  );
  ok(
    "a line says which list it's on unless it's today's",
    at("t1").from === null && at("t21").from === "under “Still open”" && at("o1").from === "Ongoing" && at("o11").from === null && at("e2").from === "Sun, Oct 25" && at("e1").from === "Tue, Oct 20"
  );
  ok("notes, steps done other days, other quests' steps and orphans stay out", !at("n1") && !at("m") && !at("z") && !at("e3") && !at("lost") && !at("t2") && !at("b"));
  ok("an item keeps its note", at("c").note === "Took an hour" && at("t1").note === null);
  ok("done today counts everything, what's under each too", mine.count === 12 && countDone(mine.groups[0].items) === 5 && countDone(null) === 0);
  ok("each group counts what's under its items too, and they add up", mine.groups.map((g) => g.count).join() === "5,1,6" && mine.groups.reduce((n, g) => n + g.count, 0) === mine.count);

  const onToday = [
    [{ id: "x", kind: "task", done_on: T, subs: [{ id: "x1", kind: "task", done_on: "2026-10-26", subs: [] }] }],
    [
      { id: "y", done_on: "2026-10-25", subs: [{ id: "y1", done_on: null, subs: [{ id: "y11", done_on: "2026-10-24", subs: [] }] }] },
      { id: "x", kind: "task", done_on: T, subs: [{ id: "x1", kind: "task", done_on: "2026-10-26", subs: [] }] },
    ],
    [{ id: "n", kind: "note", done_on: "2026-10-20", subs: [] }],
  ];
  const early = earlierOnToday(onToday, T);
  ok(
    "what Today counts as done but was finished before today: each once, in order, saying when",
    early.map((x) => `${x.id}:${x.from}`).join() === "x1:Finished yesterday,y:Finished Sun, Oct 25,y11:Finished Sat, Oct 24",
    early.map((x) => `${x.id}:${x.from}`).join()
  );
  ok("nothing on Today, nothing earlier", earlierOnToday([], T).length === 0 && earlierOnToday(null, T).length === 0 && earlierOnToday([[{ id: "a", done_on: T, subs: [] }]], T).length === 0);
  ok("nothing loaded, nothing done", questDoneToday({}, T).count === 0 && questDoneToday(undefined, T).groups.length === 0 && questDoneToday({ camps: null, sections: null, steps: null, lines: null }, T).count === 0);

  const items = [
    { key: "q", questId: "q", name: "Plugin" },
    { key: "lesson-l1", questId: null, lessonId: "l1", name: "Integrity" },
    { key: "lq", questId: "lq", name: "Patience" },
  ];
  const quests = [
    { id: "q", title: "Plugin" },
    { id: "lq", title: "Mountain", lesson_id: "l2" },
    { id: "old", title: "Old quest" },
    { id: "other", title: "Another" },
    { id: "lz", title: "Mountain", lesson_id: "l3" },
  ];
  const lessons = [
    { id: "l2", title: "Patience" },
    { id: "l3", title: "Honesty" },
  ];
  const tasks = [
    { id: "t1", quest_id: "q", kind: "task", text: "Second", done_on: T, done_at: "2026-10-27T15:00:00Z" },
    { id: "t0", quest_id: "q", kind: "task", text: "First", done_on: T, done_at: "2026-10-27T09:00:00Z" },
    { id: "ty", quest_id: "q", kind: "task", text: "Yesterday", done_on: "2026-10-26" },
    { id: "lt", quest_id: "lq", kind: "task", text: "Held my tongue", done_on: T },
    { id: "ot", quest_id: "old", kind: "task", text: "Old one", done_on: T },
    { id: "zt", quest_id: "lz", kind: "task", text: "Told the truth", done_on: T },
  ];
  const fsteps = [
    { id: "s2", camp_id: "k1", text: "Later step", done_on: T, updated_at: "2026-10-27T12:00:00Z" },
    { id: "s1", camp_id: "k1", text: "Earlier step", done_on: T, updated_at: "2026-10-27T08:00:00Z" },
    { id: "s3", camp_id: "k2", text: "Multicam step", done_on: T },
    { id: "sy", camp_id: "k2", text: "Yesterday's", done_on: "2026-10-26" },
    { id: "sz", camp_id: "k9", text: "Other quest's", done_on: T },
    { id: "sx", camp_id: "nowhere", text: "No camp", done_on: T },
  ];
  const all = allDoneToday({ items, quests, lessons, camps, tasks, steps: fsteps }, T);
  ok(
    "all quests: in the order along the top, then the rest by name, a lesson's mountain by the lesson's",
    all.map((q) => `${q.key}=${q.name}:${q.count}`).join() === "q=Plugin:5,lq=Patience:1,other=Another:1,lz=Honesty:1,old=Old quest:1",
    all.map((q) => `${q.key}=${q.name}:${q.count}`).join()
  );
  ok(
    "each quest's camps in order, then its list, each in the order they were done",
    all[0].groups.map((g) => `${g.camp ? g.number + g.camp.title : g.key}:${shape(g.items)}`).join() === "1Sift:s1+s2,2Multicam:s3,list:t0+t1"
  );
  ok("each quest's groups count themselves", all[0].groups.map((g) => g.count).join() === "2,1,2" && all.every((q) => q.count === q.groups.reduce((n, g) => n + g.count, 0)));
  ok("nothing done anywhere, no quests", allDoneToday({}, T).length === 0 && allDoneToday({ items, quests, lessons, camps, tasks: [], steps: [] }, T).length === 0);

  // The open quest's own day stands in for what the village knows of it.
  const fresh = { groups: [{ key: "list", items: [{ id: "n", text: "New", note: null, from: null, subs: [{ id: "n1", text: "Sub", note: null, from: null, subs: [] }] }], count: 2 }], count: 2 };
  const over = allDoneToday({ items, quests, lessons, camps, tasks, steps: fsteps }, T, { questId: "q", ...fresh });
  ok(
    "the open quest's own day replaces the village's, in its place",
    over.map((q) => `${q.key}:${q.count}`).join() === "q:2,lq:1,other:1,lz:1,old:1" && over[0].groups === fresh.groups && over[0].name === "Plugin",
    over.map((q) => `${q.key}:${q.count}`).join()
  );
  const gone = allDoneToday({ items, quests, lessons, camps, tasks, steps: fsteps }, T, { questId: "q", groups: [], count: 0 });
  ok("an open quest with nothing done today isn't listed, whatever the village had", gone.map((q) => q.key).join() === "lq,other,lz,old");
  const added = allDoneToday({ items, quests, lessons, camps, tasks: [], steps: [] }, T, { questId: "lq", ...fresh });
  ok("an open quest the village had nothing for yet is listed", added.length === 1 && added[0].key === "lq" && added[0].name === "Patience" && added[0].count === 2);
  const unlisted = allDoneToday({ items, quests, lessons, camps, tasks: [], steps: [] }, T, { questId: "old", ...fresh });
  ok("…and one not along the top too, by its name", unlisted.length === 1 && unlisted[0].name === "Old quest" && unlisted[0].groups === fresh.groups);
}

// --- Today's board (0092) -------------------------------------------------------
{
  const T = "2026-10-28";
  const camps = [
    { id: "k2", title: "Multicam", position: 1 },
    { id: "k1", title: "Sift", position: 0 },
  ];
  const sections = [
    { id: "sec1", camp_id: "k1", title: "Search", position: 0, today_on: T, computer: 2, color: "blue" },
    { id: "sec2", camp_id: "k1", title: "Tag", position: 1, today_on: null },
  ];
  const steps = [
    { id: "a", camp_id: "k1", section_id: "sec1", text: "In the section", position: 0, urgency: "red" },
    { id: "b", camp_id: "k1", section_id: "sec1", text: "Done before", position: 1, done_on: "2026-10-20" },
    { id: "c", camp_id: "k1", section_id: "sec2", text: "Picked", position: 0, today_on: T, urgency: "yellow", color: "green", computer: 1 },
    { id: "c1", camp_id: "k1", section_id: "sec2", parent_id: "c", text: "Under it", position: 0, done_on: T },
    { id: "d", camp_id: "k1", section_id: null, text: "Loose", position: 0, today_on: T },
    { id: "e", camp_id: "k2", section_id: null, text: "Done today", position: 0, today_on: T, done_on: T, computer: 1 },
    { id: "f", camp_id: "k2", section_id: null, text: "Not on today", position: 1 },
  ];
  const own = [
    { id: "o1", kind: "task", text: "Mine", computer: 1, urgency: "red", subs: [] },
    { id: "o2", kind: "note", text: "A note", subs: [] },
  ];
  const picked = [{ id: "p1", kind: "task", text: "From the list", from: "ongoing", computer: 9, subs: [{ id: "p1a", kind: "task", done_on: T, color: "blue", urgency: "green" }] }];
  const cards = todayCards({ camps, sections, steps, own, picked }, T);
  const keys = (list) => list.map((c) => c.key).join();
  ok(
    "today's cards: each camp in order (loose steps, a whole section, steps), then the list's picks, then today's own",
    keys(cards) === "step:d,sec:sec1,step:c,step:e,line:p1,line:o1,line:o2",
    keys(cards)
  );
  const by = Object.fromEntries(cards.map((c) => [c.key, c]));
  ok("a step card carries what's under it and where it sits", by["step:c"].done === 1 && by["step:c"].total === 2 && by["step:c"].item.from === "2. Tag" && by["step:c"].number === 1 && by["step:e"].number === 2);
  ok("a section card: its steps still on (not the one done before), not finished", by["sec:sec1"].total === 1 && by["sec:sec1"].block.earlier === 1 && !by["sec:sec1"].finished && by["sec:sec1"].computer === 2);
  ok("a step done today is finished; a note line can't be worked on", by["step:e"].finished && !by["line:o2"].actionable && !by["line:o2"].finished && by["line:o1"].actionable);
  ok("a line counts its tasks", by["line:p1"].done === 1 && by["line:p1"].total === 2 && by["line:o2"].total === 0);
  ok("nothing on today, no cards", todayCards({}, T).length === 0 && todayCards({ camps, sections: [], steps: [], own: [], picked: [] }, T).length === 0);

  ok("his order first, then the rest as they came; keys no longer on today are skipped", keys(orderCards(cards, ["line:o1", "gone:1", "step:e"])) === "line:o1,step:e,step:d,sec:sec1,step:c,line:p1,line:o2");
  ok("no order yet, the order Today has always had", keys(orderCards(cards, undefined)) === keys(cards) && keys(orderCards(cards, [])) === keys(cards));

  const only = (f) => keys(cards.filter((c) => matchesFilter(c, f)));
  ok("no filter shows everything", !filterOn(NO_FILTER) && only(NO_FILTER) === keys(cards));
  ok("urgent: anything with an urgent row on it", filterOn({ urgency: ["red"], color: [] }) && only({ urgency: ["red"], color: [] }) === "sec:sec1,line:o1");
  ok("a colour: a section in it, or a sub-task in it", only({ urgency: [], color: ["blue"] }) === "sec:sec1,line:p1");
  ok("either of two urgencies", only({ urgency: ["red", "yellow"], color: [] }) === "sec:sec1,step:c,line:o1");
  ok("urgency and colour must be on the same row", only({ urgency: ["green"], color: ["blue"] }) === "line:p1" && only({ urgency: ["red"], color: ["blue"] }) === "");
  {
    const noteCard = { key: "line:n", rows: [{ id: "n", kind: "note", urgency: "red", color: "blue" }] };
    ok("a line of notes is never urgent, but keeps its colour", !matchesFilter(noteCard, { urgency: ["red"], color: [] }) && matchesFilter(noteCard, { urgency: [], color: ["blue"] }));
  }

  const cc = campColumns(cards);
  ok(
    "by camp: each camp's column in camp order, then the quest's list",
    cc.map((c) => `${c.key}:${c.cards.map((x) => x.id).join("+")}:${c.done}/${c.total}`).join() === "camp:k1:d+sec1+c:1/4,camp:k2:e:1/1,list:p1+o1+o2:1/3",
    cc.map((c) => `${c.key}:${c.cards.map((x) => x.id).join("+")}:${c.done}/${c.total}`).join()
  );
  ok("by camp, in his order within a column", campColumns(orderCards(cards, ["step:c", "step:d"]))[0].cards.map((x) => x.id).join() === "c,d,sec1");

  const pcs = computerColumns(cards, DEFAULT_COMPUTERS);
  const pcShape = (cols) => cols.map((c) => `${c.key}:${c.open.map((x) => x.id).join("+")}|${c.finished.map((x) => x.id).join("+")}:${c.working ?? "-"}/${c.deck ?? "-"}`).join(" ");
  ok(
    "by computer: no one's first (a gone computer's too), then each; done ones sink; top is working on, next on deck",
    pcShape(pcs) === "none:d+p1+o2|:-/- pc:1:c+o1|e:step:c/line:o1 pc:2:sec1|:sec:sec1/-",
    pcShape(pcs)
  );
  const withNote = cards.map((c) => (c.id === "o2" ? { ...c, computer: 2 } : c));
  ok("a note line is never what a computer's working on, nor on deck", pcShape(computerColumns(withNote, DEFAULT_COMPUTERS)).endsWith("pc:2:sec1+o2|:sec:sec1/-"));
  ok("no computers: everything is no one's", computerColumns(cards, []).length === 1 && computerColumns(cards, [])[0].cards.length === cards.length);

  const order = ["a", "b", "c", "d", "e"];
  ok("dragged among the ones shown, they swap places among themselves", reorderShown(order, ["b", "d", "e"], ["e", "b", "d"]).join() === "a,e,c,b,d");
  ok("into another column, before a card", moveKey(order, "e", "b").join() === "a,e,b,c,d");
  ok("into another column, after its last", moveKey(order, "a", null, ["c", "d"]).join() === "b,c,d,a,e");
  ok("into an empty column, it keeps its place", moveKey(order, "c", null, []).join() === "a,b,c,d,e" && moveKey(order, "x", null, []).join() === "a,b,c,d,e,x");
  ok("before itself or a key not there, after the column's last", moveKey(order, "a", "zz", ["b"]).join() === "b,a,c,d,e");

  ok("no computers saved, the two it starts with", computersOf(null) === DEFAULT_COMPUTERS && computersOf(undefined).length === 2 && computersOf([]).length === 0);
  ok(
    "saved computers: trimmed, a blank name gets its number, repeats and junk skipped",
    JSON.stringify(computersOf([{ n: 3, name: "  Mac  " }, { n: 3, name: "dup" }, { n: "x" }, { n: 0 }, { n: 1, name: "" }])) === JSON.stringify([{ n: 3, name: "Mac" }, { n: 1, name: "Computer 1" }])
  );
  ok("a new computer takes the lowest number free", JSON.stringify(nextComputer([{ n: 1 }, { n: 3 }])) === JSON.stringify({ n: 2, name: "Computer 2" }) && nextComputer([]).n === 1);
  ok("nor one still handed out on a row (a removal that didn't clear it)", nextComputer([{ n: 1 }], [2, 1]).n === 3 && nextComputer([{ n: 1 }], []).n === 2);
  ok("where a card's computer is written", rowOf(by["sec:sec1"]).table === "camp_sections" && rowOf(by["step:c"]).table === "camp_steps" && rowOf(by["line:o1"]).table === "quest_tasks" && rowOf(by["line:o1"]).id === "o1");
}


{
  console.log("\nthe clipboard: many steps moved at once (0095)");
  const st = (id, camp, section, parent, position, extra = {}) => ({ id, camp_id: camp, section_id: section, parent_id: parent, position, created_at: "2026-10-30", ...extra });
  const steps = [
    st("a", "sift", "clip", null, 0),
    st("b", "sift", "clip", null, 1),
    st("b1", "sift", "clip", "b", 0),
    st("c", "sift", "clip", null, 2),
    st("x", "sift", "ui", null, 0),
    st("y", "sift", "ui", null, 1),
    st("m", "multi", "mclip", null, 0),
  ];
  const plan = planMove(steps, ["c", "a"], { campId: "sift", sectionId: "ui", beforeId: "y" });
  const after = applyRows(steps, plan.rows);
  const order = (sec) => after.filter((x) => x.section_id === sec && !x.parent_id).sort((p, q) => p.position - q.position).map((x) => x.id).join();
  ok("selected steps land together, in the order given, before the one let go on", order("ui") === "x,c,a,y", order("ui"));
  ok("the ones left behind keep their places", order("clip") === "b");
  ok("only what changed is written", plan.rows.every((r) => Object.keys(r).length > 1) && !plan.rows.some((r) => r.id === "x"));
  const back = applyRows(after, plan.was);
  ok("Undo puts every row back as it was", JSON.stringify(back) === JSON.stringify(steps));

  const cross = planMove(steps, ["b"], { campId: "multi", sectionId: "mclip" });
  const moved = applyRows(steps, cross.rows);
  const b1 = moved.find((x) => x.id === "b1");
  ok("into another camp: its sub-steps come along into that camp and section", b1.camp_id === "multi" && b1.section_id === "mclip" && b1.parent_id === "b");
  ok("...at the end there", moved.find((x) => x.id === "b").position === 1);

  const nested = planMove(steps, ["a", "c"], { parentId: "x" });
  const n2 = applyRows(steps, nested.rows);
  ok("under another step: in its camp and section, after its others", n2.filter((x) => x.parent_id === "x").map((x) => x.id).join() === "a,c" && n2.find((x) => x.id === "a").section_id === "ui");
  ok("not under itself, nor under one of its own", planMove(steps, ["b"], { parentId: "b1" }) === null && planMove(steps, ["b"], { parentId: "b" }) === null);
  const withSub = planMove(steps, ["b1", "b"], { campId: "sift", sectionId: "ui" });
  ok("a sub-step selected with its step comes along under it, not beside it", withSub.tops.join() === "b" && applyRows(steps, withSub.rows).find((x) => x.id === "b1").parent_id === "b");
  ok("nothing there to move asks for nothing", planMove(steps, ["zz"], { sectionId: "ui" }) === null);
  ok("already where it is, nothing is written", planMove(steps, ["a"], { campId: "sift", sectionId: "clip", beforeId: "b" }).rows.length === 0);

  const sections = [{ id: "ui", position: 0 }, { id: "clip", position: 5 }, { id: "mclip", position: 0 }];
  const camps = [{ id: "sift" }, { id: "multi" }];
  ok("selected in the order they sit on the page", inPageOrder(new Set(["m", "c", "x", "b1", "a"]), steps, sections, camps).join() === "x,a,b1,c,m", inPageOrder(new Set(["m", "c", "x", "b1", "a"]), steps, sections, camps).join());

  const view = buildCamp(
    [{ id: "s1", title: "UI", position: 0 }, { id: "cb", title: "Meeting", position: 1, clipboard: true }],
    [st("t1", "c", "s1", null, 0, { done_on: "2026-10-30" }), st("t2", "c", "s1", null, 1, { kind: "note" }), st("t3", "c", "cb", null, 0), st("t4", "c", "cb", null, 1, { today_on: "2026-10-30" })],
    "2026-10-30"
  );
  ok("clipboard columns stand apart from the camp's sections", view.sections.map((x) => x.id).join() === "s1" && view.clips.map((x) => x.id).join() === "cb" && view.clips[0].steps.length === 2);
  ok("what's on the clipboard, and notes, don't count toward how far along it is", view.total === 1 && view.done === 1 && view.sections[0].total === 1);
  ok("nor is a note ever the next step", view.next === null);
  const picks = todayPicks(view, "2026-10-30");
  ok("a clipboard step picked for today shows on Today, saying it's from the clipboard", picks.items.map((x) => x.id).join() === "t4" && picks.items[0].from === "Clipboard · Meeting");
  ok("a step made a note can't stay done or urgent", JSON.stringify(kindFields({ kind: "task" })) === JSON.stringify({ kind: "note", done_on: null, urgency: null, working_since: null }) && kindFields({ kind: "note" }).kind === "task" && isNote({ kind: "note" }));
  const tally = campTally([st("t1", "c", "s1", null, 0), st("t3", "c", "cb", null, 0, { today_on: "2026-10-30" }), st("t5", "c", null, null, 0, { kind: "note" })], "2026-10-30", [{ id: "cb", camp_id: "c", clipboard: true }]).get("c");
  ok("the camps on Quests count neither the clipboard nor notes, but its picks are on today", tally.total === 1 && tally.today === 1, JSON.stringify(tally));
}

{
  console.log("\nlooking up close, and pins (0096)");
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const fit = fitView(2000, 1000, 1000, 800, 20);
  ok("all of it fits, centred, with room around it", near(fit.k, 0.48) && near(fit.x, 20) && near(fit.y, 160));
  const z = zoomAt(fit, 0.96, 500, 400);
  ok("zooming keeps what's under the pointer under it", near(toPicture(z, 2000, 1000, 500, 400).x, toPicture(fit, 2000, 1000, 500, 400).x) && near(toPicture(z, 2000, 1000, 500, 400).y, 0.5));
  const off = toPicture(fit, 2000, 1000, 5, 5);
  ok("a tap beside the picture is on nothing", off === null);
  const back = toBox(z, 2000, 1000, 0.25, 0.75);
  const there = toPicture(z, 2000, 1000, back.x, back.y);
  ok("a pin goes where it was put and comes back there", near(there.x, 0.25) && near(there.y, 0.75));
  const small = clampView({ k: 0.3, x: -400, y: 900 }, 2000, 1000, 1000, 800, 0.36, 4.8);
  ok("zoomed out past the least, it stops there, centred", near(small.k, 0.36) && near(small.x, 140) && near(small.y, 220));
  const far = clampView({ k: 2, x: 500, y: -5000 }, 2000, 1000, 1000, 800, 0.36, 4.8, 48);
  ok("zoomed in, it can't be dragged far off its edges", near(far.x, 48) && near(far.y, 800 - 2000 - 48));
  const big = clampView({ k: 9, x: 0, y: 0 }, 2000, 1000, 1000, 800, 0.36, 4.8);
  ok("nor zoomed in past the most", near(big.k, 4.8));
  const c = centreOn(2000, 1000, 1000, 800, 0.8, 0.2, 1.2);
  const mid = toPicture(c, 2000, 1000, 500, 400);
  ok("opened on a pin, the pin is in the middle", near(mid.x, 0.8) && near(mid.y, 0.2));
  ok("a big photo is made smaller, its shape kept; a small one is left", JSON.stringify(shrinkTo(4032, 3024, 2560)) === JSON.stringify({ width: 2560, height: 1920 }) && JSON.stringify(shrinkTo(800, 600, 2560)) === JSON.stringify({ width: 800, height: 600 }));
  const nums = pinNumbers([{ id: "b", created_at: "2026-10-30T10:05" }, { id: "a", created_at: "2026-10-30T10:01" }, { id: "c", created_at: "2026-10-30T10:09" }]);
  ok("pins are numbered in the order they went on", nums.get("a") === 1 && nums.get("b") === 2 && nums.get("c") === 3);
}

{
  console.log("\nresolving a section, and keeping what was finished (0097)");
  const sec = { id: "S", camp_id: "C", title: "Old UI", clipboard: false };
  const steps = [
    { id: "a", camp_id: "C", section_id: "S", parent_id: null, kind: "task", text: "done one", done_on: "2026-10-20", position: 0 },
    { id: "b", camp_id: "C", section_id: "S", parent_id: "a", kind: "task", text: "done sub", done_on: "2026-10-21", position: 0 },
    { id: "c", camp_id: "C", section_id: null, parent_id: "a", kind: "task", text: "sub elsewhere", done_on: "2026-10-22", position: 1 },
    { id: "d", camp_id: "C", section_id: "S", parent_id: null, kind: "task", text: "open", done_on: null, position: 1 },
    { id: "e", camp_id: "C", section_id: "S", parent_id: null, kind: "note", text: "a note", done_on: null, position: 2 },
    { id: "f", camp_id: "C", section_id: "T", parent_id: null, kind: "task", text: "other section", done_on: "2026-10-23", position: 0 },
  ];
  const plan = resolvePlan(sec, steps, { photos: 1, sketches: 2, pictures: 1 });
  ok("everything in it goes, with what's under its steps", [...plan.ids].sort().join() === "a,b,c,d,e");
  ok("its finished steps are the ones kept", plan.kept.map((x) => x.id).sort().join() === "a,b,c");
  ok("it says what else would go", plan.lose.join("|") === "1 step not done yet|1 note|1 photo|1 picture|2 sketches" && plan.ask);
  const done = resolvePlan(sec, steps.filter((x) => x.id !== "d" && x.id !== "e"), { photos: 0, sketches: 0 });
  ok("all finished and nothing else in it, it goes without asking", !done.ask && done.lose.length === 0 && done.kept.length === 3);
  ok("when the photos couldn't be counted, it asks", resolvePlan(sec, [], null).ask);
  const words = resolveWords(sec, plan, { photos: 1, sketches: 2, pictures: 1 });
  ok(
    "the question says what stays and what goes",
    words.title === "Resolve “Old UI”?" &&
      words.confirmLabel === "Resolve section" &&
      words.body.startsWith("Its 3 finished steps stay in your village, and the camp still counts them as done.") &&
      words.body.includes("Going with it: 1 step not done yet, 1 note, 1 photo, 1 picture and 2 sketches.")
  );
  const clip = resolveWords({ ...sec, clipboard: true, title: "Clipboard" }, plan, {});
  ok("a clipboard column is removed, and isn't counted in the camp", clip.title === "Remove “Clipboard”?" && clip.confirmLabel === "Remove column" && !clip.body.includes("counts"));
  ok("with nothing finished it's just removed", resolveWords(sec, resolvePlan(sec, [], { photos: 0, sketches: 0 }), {}).confirmLabel === "Remove section");
  ok("the toast says how many were kept", resolvedLine(sec, 3) === "“Old UI” resolved · 3 done steps kept" && resolvedLine(sec, 0) === "“Old UI” removed");
  const groups = resolvedGroups([
    { id: "b", section_id: "S", section_title: "Old UI", parent_id: "a", text: "done sub", done_on: "2026-10-21", position: 0, counted: true, resolved_on: "2026-10-30" },
    { id: "a", section_id: "S", section_title: "Old UI", parent_id: null, text: "done one", done_on: "2026-10-20", position: 0, counted: true, resolved_on: "2026-10-30" },
    { id: "z", section_id: "Q", section_title: "Earlier", parent_id: null, text: "long ago", done_on: "2026-09-01", position: 0, counted: false, resolved_on: "2026-10-01" },
  ]);
  ok(
    "resolved sections are listed newest first, sub-steps after their step",
    groups.map((g) => g.title).join() === "Old UI,Earlier" && groups[0].steps.map((x) => `${x.id}${x.depth}`).join() === "a0,b1" && groups[1].clipboard
  );
  // A resolved step lays its bricks where it did, even with its camp gone.
  const live = finishedUnits({ steps: steps.filter((x) => x.done_on).map((x) => ({ ...x, updated_at: `${x.done_on}T10:00:00Z` })), camps: [{ id: "C", quest_id: "Q1" }] });
  const kept = finishedUnits({
    steps: steps.filter((x) => x.done_on).map((x) => ({ id: x.id, camp_id: x.id === "f" ? "C" : null, quest_id: "Q1", text: x.text, done_on: x.done_on, updated_at: `${x.done_on}T10:00:00Z` })),
    camps: [{ id: "C", quest_id: "Q1" }],
  });
  ok("its bricks keep their order and quest after the section goes", live.map((u) => `${u.id}${u.questId}`).join() === kept.map((u) => `${u.id}${u.questId}`).join());
  const project = [{ id: "p", kind: "beacon", seed: 1, plot: 0, need: 12, started_on: "2026-10-01", created_at: "2026-10-01" }];
  ok("so the building stands as tall as before", allocate(project, live).projects[0].done === allocate(project, kept).projects[0].done);
}

{
  console.log("\npictures pasted into a task (0098)");
  const png = { type: "image/png", name: "image.png" };
  const clip = (text, files = [], items = []) => ({ getData: (t) => (t === "text/plain" ? text : ""), files, items });
  ok("a screenshot on the clipboard is a picture to add", pastedImage(clip("", [png])) === png);
  ok("one that only comes as an item is found too", pastedImage(clip("", [], [{ kind: "file", type: "image/jpeg", getAsFile: () => png }])) === png);
  ok("text pastes as text, even with a picture of it along (cells from a sheet)", pastedImage(clip("Q3 numbers", [png])) === null);
  ok("a file that isn't a picture isn't taken", pastedImage(clip("", [{ type: "application/pdf" }])) === null && pastedImage(null) === null);
  ok("a picture's size is its page, as it is", JSON.stringify(pageOf(1600, 1200)) === JSON.stringify({ width: 1600, height: 1200 }));
  const tiny = pageOf(20, 10);
  ok("a tiny one is made big enough to be a page, its shape kept", tiny.height === 50 && tiny.width === 100);
  ok("a size not known is a 4 by 3 page", JSON.stringify(pageOf(null, null)) === JSON.stringify({ width: 1200, height: 900 }));
  const long = pageOf(30, 12000);
  ok("an odd long one stays within the page's bounds", long.width >= 50 && long.height <= 10000);
}

{
  console.log("\nsteps dropped on a picture, and its pins shown small");
  const steps = [
    { id: "pic", camp_id: "c1", section_id: "ui", parent_id: null, position: 0, pin_id: null },
    { id: "u2", camp_id: "c1", section_id: "ui", parent_id: null, position: 1, pin_id: "p1" },
    { id: "t1", camp_id: "c1", section_id: "clip", parent_id: null, position: 0, pin_id: null },
    { id: "t1a", camp_id: "c1", section_id: "clip", parent_id: "t1", position: 0, pin_id: null },
    { id: "t2", camp_id: "c1", section_id: "clip", parent_id: null, position: 1, pin_id: "p0" },
  ];
  const to = { campId: "c1", sectionId: "ui" };
  const one = planPinDrop(steps, ["t1"], "p9", to);
  const after = applyPinDrop(steps, one);
  const t1 = after.find((x) => x.id === "t1");
  ok("a clipboard thought dropped on a picture wears its pin", t1.pin_id === "p9");
  ok("and goes to the end of the picture's section", t1.section_id === "ui" && t1.position === 2 && one.sectionId === "ui");
  ok("its sub-steps come along, without the pin", after.find((x) => x.id === "t1a").section_id === "ui" && after.find((x) => x.id === "t1a").pin_id === null);
  const back = applyPinDrop(after, one, true);
  ok("Undo puts it back as it was, pin and all", JSON.stringify(back) === JSON.stringify(steps));
  const two = planPinDrop(steps, ["t1", "t2"], "p9", to);
  ok("several carried together all take the pin", applyPinDrop(steps, two).filter((x) => x.pin_id === "p9").length === 2);
  ok("each one's pin before is kept for Undo", JSON.stringify(two.pinsWas) === JSON.stringify([{ id: "t1", pin_id: null }, { id: "t2", pin_id: "p0" }]));
  const there = planPinDrop(steps, ["u2"], "p9", to);
  ok("one in the picture's section already only changes its pin", there.place.length === 0 && there.sectionId === null && there.pins[0].pin_id === "p9");
  ok("nothing to change asks for nothing", planPinDrop(steps, ["u2"], "p1", to) === null && planPinDrop(steps, ["gone"], "p9", to) === null);
  const stay = planPinDrop(steps, ["t1"], "p9", null);
  ok("where its tasks can't go from here, it only takes the pin", stay.place.length === 0 && applyPinDrop(steps, stay).find((x) => x.id === "t1").section_id === "clip");
  ok("pins to save, one list each", JSON.stringify(byPin([{ id: "a", pin_id: null }, { id: "b", pin_id: "p0" }, { id: "c", pin_id: null }])) === JSON.stringify([[null, ["a", "c"]], ["p0", ["b"]]]));

  const pins = [{ id: "a", x: 0.5, y: 0.5 }, { id: "b", x: 0, y: 1 }];
  const whole = pinSpots(pins, { w: 1200, h: 300 }, 600, 150);
  ok("on a picture shown whole, a pin sits where it was put", whole[0].left === 300 && whole[0].top === 75 && whole[1].left === 0 && whole[1].top === 150);
  const boxed = pinSpots(pins, { w: 1200, h: 300 }, 600, 300);
  ok("fitted into a taller box, it's centred with the picture", boxed[0].left === 300 && boxed[0].top === 150 && boxed[1].top === 225);
  const cut = pinSpots([{ id: "a", x: 0.5, y: 0.5 }, { id: "edge", x: 0.02, y: 0.5 }], { w: 1200, h: 300, cover: true }, 150, 150);
  ok("cut to fill a small square, the middle stays and the cut-off one goes", cut.length === 1 && cut[0].left === 75 && cut[0].top === 75);
  const inked = pinSpots([{ id: "a", x: 0.5, y: 0.5 }, { id: "far", x: 0.95, y: 0.05 }], { w: 1000, h: 1000, frame: { x: 400, y: 400, width: 200, height: 200 }, pad: 0 }, 100, 100);
  ok("on a sketch shown by its inked part, a pin outside that part isn't shown", inked.length === 1 && inked[0].left === 50 && inked[0].top === 50);
  ok("before its box is measured there's nowhere to show them", pinSpots(pins, { w: 10, h: 10 }, 0, 0).length === 0);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
