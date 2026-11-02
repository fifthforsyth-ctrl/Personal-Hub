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
import { fileURLToPath } from "node:url";
import { readHealthPayload, mergeDay, sleepAction, workoutAction, exerciseEntry, workoutFrom, parseHaeDate, exerciseKindOf, metricFor, bedtimeOf } from "../supabase/functions/watch/health.js";
import { ms as appMs, hhmm, planOf, blockAt, focusWeek, targetsToday, sleptLast } from "../supabase/functions/watch/app.js";
import { watchForPrompt } from "../supabase/functions/assistant/body.js";
import { PUSH_TONE, aimForPrompt } from "../supabase/functions/assistant/tone.js";
import { eveningWatchParts, morningWatchLine, workoutName, lastUsedLine, watchAddress, fmtMins as watchMins, restingNormal, minutesWatchParts, minutesWatch } from "../src/lib/watch.js";
import { watchSlept } from "../src/lib/watch.js";
import { upInTheNight, plainlyTheWorkout } from "../supabase/functions/watch/health.js";
import { dropIndex, edgePush, moved, towardEdge } from "../src/lib/dragOrder.js";
import { questTagOptions, tagOf, questWorkDone } from "../src/lib/questWork.js";
import { CATALOG, SIZES, buildOf, seedFor, soldiersFor, bowFor, layout, tileOf, freePlot, dayIndex, finishedUnits, allocate, villagersOf, villageOf, standingOf, shortName } from "../src/lib/village.js";
import { listDays, ongoingList, pickedLines, dayLabel, nextPosition as nextLinePosition, boardOf, parseLines, withFinished, withFinishedStep, countLine, campTally } from "../src/lib/questTasks.js";
import { questDoneToday, allDoneToday, countDone, earlierOnToday } from "../src/lib/doneToday.js";
import { DEFAULT_COMPUTERS, computersOf, nextComputer, todayCards, orderCards, NO_FILTER, filterOn, matchesFilter, campColumns, computerColumns, reorderShown, moveKey, rowOf } from "../src/lib/todayBoard.js";
import { fitView, zoomAt, clampView, toPicture, toBox, centreOn, shrinkTo, pinNumbers, pinSpots, tipAt } from "../src/lib/zoom.js";
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
import { kindFields, isNote, resolvePlan, resolveWords, resolvedLine, resolvedGroups, shades } from "../src/lib/camp.js";
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
import { levelFrom, placement, inRange, average, missCounts, fullest, tierOf, TIERS, bowLine, bowProgress, bowEarned, fourReasons, DEFAULT_REASONS, shortTarget, iconFor, buildRange, answersOf, LEVELS, isLoosed, focusMinutes, watchSaw, startingAnswers, readLine, guessReason, shotFrom, answerText, tonightLevel, levelAtSpot, clampSpot, ringSpot, quickShot, quickOf, WHOLE } from "../src/lib/mark.js";
import { normCheck as ckNorm, markOf as ckMark, clockDiff as ckClock, scores as ckScores, answered as ckAnswered, allAnswered as ckAll, checksLevel as ckLevel, shareOf as ckShare, shareOfLevel as ckShareOfLevel, levelOfShare as ckLevelOfShare, passText as ckPassText, valueText as ckValueText, clockText as ckClockText, answerEntry as ckEntry, legacyValue as ckLegacy, autoValue as ckAuto, wokeAt as ckWoke, toFive as ckToFive, tenOf as ckTenOf } from "../src/lib/checks.js";
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
import { lineageIds, LINEAGE_WEEKS, weekShots, checkinShot, MOVED_LEVEL, NOT_TODAY_LEVEL, newestFirst, cleanNote, noteDay, landsBy as fLandsBy, checkinLevel as fCheckinLevel, placedArrow as fPlaced, checksArrow as fChecksArrow, checksFor as fChecksFor, countsToward as fToward, linkedArrows as fLinked } from "../src/lib/focus.js";
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
  watchWeek,
  weightTrend,
  pieces,
  andList,
  fmtHours as mirrorHours,
} from "../src/lib/mirror.js";
import { planForToday, questItemsForToday, blocksOf, pickBlock, tallyItems, doneFields, withFields, applyOverrides } from "../src/lib/todayPlan.js";
import { build as esbuildBundle } from "esbuild";

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
  const vals = (list) => list.map((a) => a.value ?? "").join();
  ok("the time log answers Yes for a focus it saw; the rest wait for you", vals(startingAnswers(tDisc, { focusesById: byId, entries })) === "yes,");
  ok("it never answers No for you", startingAnswers(tDisc, { focusesById: byId, entries: [] }).every((a) => a.value === null));
  ok(
    "what's already saved wins over the time log",
    vals(startingAnswers({ ...tDisc, tonight: { answers: [{ aim: "a1", text: "Exercised", v: 0 }, { aim: "a2", text: "In bed on time", v: 2 }] } }, { focusesById: byId, entries })) === "no,yes"
  );
  ok(
    "an old Some on what is now a Yes/No starts again",
    vals(startingAnswers({ ...tDisc, tonight: { answers: [{ aim: "a2", text: "In bed on time", v: 1, line: "close" }] } }, { focusesById: byId, entries })) === "yes," &&
      startingAnswers({ ...tDisc, tonight: { answers: [{ aim: "a2", text: "In bed on time", v: 1, line: "close" }] } }, { focusesById: byId, entries })[1].line === "close"
  );

  const why = ["Tired", "Late night", "Phone", "Overbooked"];
  ok("a line is read for its reason", readLine(why, "I stayed up way too late again") === 1);
  ok("by the reason's own name too", readLine(why, "Too much phone tonight") === 2);
  ok("a line about what went well points nowhere", readLine(why, "I hit a new PR of 101 pushups.") === -1 && readLine(why, "") === -1);
  ok("his own words from Oct 17 read as overbooked", readLine(why, "I felt a bit behind all day.") === 3);
  const tGuess = { shots: [{ date: "2026-10-18", level: 2, reason: 3 }, { date: "2026-10-17", level: 3, reason: 3 }, { date: "2026-10-16", level: 1, reason: 0 }, { date: "2026-09-01", level: 5, reason: 1 }] };
  ok("with nothing to read, the guess is where the last 30 days of misses gather", guessReason(tGuess, today) === 3);
  ok("and the first section when there are none", guessReason({ shots: [] }, today) === 0);

  const half = shotFrom(tDisc, [{ value: "yes" }, { value: "no", line: "11:40" }], { line: "  Stayed up late. ", reason: 1, how: "read" });
  ok("a shot keeps each answer with what it was called", half.answers.map((a) => `${a.aim}:${a.text}:${a.v}`).join() === "a1:Exercised:2,a2:In bed on time:0");
  ok("and its kind, its value and its own line", half.answers[1].kind === "yn" && half.answers[1].value === "no" && half.answers[1].line === "11:40" && half.answers[0].line === undefined);
  ok("half done lands in the middle, in the section read from the line", half.level === 2 && half.reason === 1 && half.reason_how === "read" && half.note === "Stayed up late.");
  const bull = shotFrom(tDisc, [{ value: "yes" }, { value: "yes" }], { line: "", reason: 1, how: "guess" });
  ok("a bullseye has no section and an empty line is no note", bull.level === 0 && bull.reason === null && bull.reason_how === null && bull.note === null);
  ok("nothing to save until every aim is answered", shotFrom(tDisc, [{ value: "yes" }, { value: null }]) === null);

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

// --- Wake watch, removed ------------------------------------------------------
{
  const off = readFileSync(new URL("../supabase/migrations/0099_wake_watch_off.sql", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  ok("turning Wake watch off stops the morning job", /cron\.unschedule\('wake-watch'\)/.test(off));
  ok("and keeps every logged morning", !/\bdrop\b|\btruncate\b|\bdelete\s+from\b/i.test(off));
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

{
  console.log("\nsection colours on their steps, and a pin's card");
  // Aaron, 2026-10-30: "when I change the color of a section I want all the
  // tasks to share the same color unless I change the color of a specific task"
  const sections = [{ id: "ui", color: "blue" }, { id: "plain", color: null }];
  const steps = [
    { id: "a", section_id: "ui", color: null },
    { id: "b", section_id: "ui", color: "red" },
    { id: "c", section_id: "ui", color: "none" },
    { id: "a1", section_id: "ui", parent_id: "a", color: null },
    { id: "b1", section_id: "ui", parent_id: "b", color: null },
    { id: "b1x", section_id: null, parent_id: "b1", color: null },
    { id: "c1", section_id: "ui", parent_id: "c", color: null },
    { id: "a2", section_id: null, parent_id: "a", color: null },
    { id: "p", section_id: "plain", color: null },
    { id: "loose", section_id: null, color: null },
    { id: "lp1", section_id: "ui", parent_id: "lp2", color: null },
    { id: "lp2", section_id: "ui", parent_id: "lp1", color: null },
  ];
  const sh = shades(sections, steps);
  const of = (id) => sh.of(steps.find((x) => x.id === id));
  ok("a step with no colour of its own wears its section's", of("a") === "blue" && JSON.stringify(sh.above(steps[0])) === JSON.stringify({ color: "blue", from: "section" }));
  ok("one given its own keeps it", of("b") === "red");
  ok("one set to No color stays plain, and so do its sub-steps", of("c") === "none" && of("c1") === "none");
  ok("a sub-step wears its step's colour, however deep", of("b1") === "red" && of("b1x") === "red" && sh.above(steps.find((x) => x.id === "b1")).from === "step");
  ok("or, under a step with none, the section's", of("a1") === "blue" && of("a2") === "blue");
  ok("a section with no colour gives none", of("p") === null && of("loose") === null);
  ok("a loop in the data doesn't go round forever", of("lp1") === "blue");
  const changed = shades([{ id: "ui", color: "green" }], steps);
  ok("a section's new colour reaches every step without its own at once", changed.of(steps[0]) === "green" && changed.of(steps[1]) === "red");

  const card = { kind: "step", rows: [steps[0], steps[3]] };
  ok("the Today filter finds a step by the colour it shows", matchesFilter(card, { urgency: [], color: ["blue"] }, sh.of) && !matchesFilter(card, { urgency: [], color: ["blue"] }));
  ok("and not one set plain in a coloured section", !matchesFilter({ kind: "step", rows: [steps[2]] }, { urgency: [], color: ["blue"] }, sh.of));
  ok("a quest line goes by its own colour", !matchesFilter({ kind: "line", rows: [{ id: "a", section_id: "ui", color: null }] }, { urgency: [], color: ["blue"] }, sh.of));

  const at = { left: 100, right: 124, top: 200, bottom: 232 };
  const up = tipAt(at, 200, 80, 400, 800);
  ok("a pin's card sits centred above it", up.left === 12 && up.top === 112 && !up.below);
  ok("and slides in from the screen's edge", tipAt({ left: 380, right: 400, top: 300, bottom: 330 }, 200, 80, 400, 800).left === 192);
  const low = tipAt({ left: 100, right: 124, top: 30, bottom: 62 }, 200, 80, 400, 800);
  ok("with no room above, it goes below", low.below && low.top === 70);
  ok("with no room either way, it stays on screen above", tipAt({ left: 100, right: 124, top: 30, bottom: 62 }, 200, 80, 400, 120).top === 8);
}


console.log("\napple watch");
{
  const TZ = "America/Denver";
  ok("a Health Auto Export date reads with its offset", parseHaeDate("2026-10-31 05:10:00 -0600").toISOString() === "2026-10-31T11:10:00.000Z");
  ok("a date-only string keeps its day", parseHaeDate("2026-10-31").toISOString().startsWith("2026-10-31"));
  ok("rubbish is null", parseHaeDate("soon") === null && parseHaeDate("") === null);
  ok("metric names match loosely", metricFor("step_count")?.col === "steps" && metricFor("Resting Heart Rate")?.col === "resting_hr" && metricFor("heart_rate")?.col === "avg_hr");
  ok("an unknown metric matches nothing", metricFor("toothbrushing") === null);

  const payload = {
    data: {
      metrics: [
        { name: "step_count", units: "count", data: [{ date: "2026-10-30 00:00:00 -0600", qty: 8421.6 }, { date: "2026-10-31 00:00:00 -0600", qty: 1200 }] },
        { name: "resting_heart_rate", units: "count/min", data: [{ date: "2026-10-30 00:00:00 -0600", qty: 52 }, { date: "2026-10-30 12:00:00 -0600", qty: 56 }] },
        { name: "heart_rate", units: "count/min", data: [{ date: "2026-10-30 00:00:00 -0600", Min: 48, Avg: 71, Max: 140 }] },
        { name: "active_energy", units: "kJ", data: [{ date: "2026-10-30 00:00:00 -0600", qty: 4184 }] },
        { name: "weight_body_mass", units: "kg", data: [{ date: "2026-10-30 07:00:00 -0600", qty: 80 }] },
        { name: "toothbrushing", units: "count", data: [{ date: "2026-10-30 00:00:00 -0600", qty: 2 }] },
        {
          name: "sleep_analysis",
          units: "hr",
          data: [
            { date: "2026-10-31", totalSleep: 6.5, core: 4, deep: 1, rem: 1.5, awake: 0.25, inBed: 7, sleepStart: "2026-10-30 22:20:00 -0600", sleepEnd: "2026-10-31 04:50:00 -0600" },
            { date: "2026-10-31", totalSleep: 0.5, core: 0.5, deep: 0, rem: 0, sleepStart: "2026-10-31 13:00:00 -0600", sleepEnd: "2026-10-31 13:30:00 -0600" },
          ],
        },
      ],
      workouts: [
        { id: "W1", name: "Traditional Strength Training", start: "2026-10-30 06:10:00 -0600", end: "2026-10-30 06:45:00 -0600", duration: 2100, activeEnergyBurned: { qty: 280, units: "kcal" }, heartRate: { avg: { qty: 118, units: "bpm" }, max: { qty: 151, units: "bpm" } } },
        { name: "Outdoor Run", start: "2026-10-29 17:00:00 -0600", end: "2026-10-29 17:31:00 -0600", distance: { qty: 3.1, units: "mi" }, avgHeartRate: { qty: 150, units: "bpm" } },
        { name: "Broken", start: "2026-10-29 17:00:00 -0600", end: "2026-10-29 16:00:00 -0600" },
      ],
    },
  };
  const r = readHealthPayload(payload, TZ);
  ok("steps land on their day, whole", r.days["2026-10-30"].steps === 8422 && r.days["2026-10-31"].steps === 1200);
  ok("a rate averages across the day's rows", r.days["2026-10-30"].resting_hr === 54);
  ok("heart rate rows read their Avg", r.days["2026-10-30"].avg_hr === 71);
  ok("kJ become kcal and kg become lb", r.days["2026-10-30"].active_kcal === 1000 && Math.abs(r.days["2026-10-30"].weight_lb - 176.4) < 0.1);
  ok("an unknown metric is kept by name, not dropped", r.days["2026-10-30"].extra.toothbrushing?.qty === 2 && r.unknown.includes("toothbrushing"));
  const night = r.days["2026-10-31"];
  ok("the night lands on the morning you woke, in minutes", night.asleep_min === 390 && night.deep_min === 60 && night.rem_min === 90 && night.in_bed_min === 420);
  ok("a nap doesn't stand in for the night", r.nights.length === 1 && r.nights[0].end.toISOString() === "2026-10-31T10:50:00.000Z");
  ok("broken workouts are left out", r.workouts.length === 2);
  const lift = r.workouts.find((w) => w.external_id === "W1");
  ok("a v2 workout reads its seconds, energy and heart", lift.minutes === 35 && lift.active_kcal === 280 && lift.avg_hr === 118 && lift.max_hr === 151 && lift.kind === "gym");
  const run = r.workouts.find((w) => w.name === "Outdoor Run");
  ok("a v1 workout without an id or duration still lands once", run.external_id === "Outdoor Run@2026-10-29T23:00:00.000Z" && run.minutes === 31 && run.distance === 3.1 && run.kind === "run");
  ok("workout kinds", exerciseKindOf("Running") === "run" && exerciseKindOf("Functional Strength Training") === "gym" && exerciseKindOf("Walking") === "other");
  ok("a duration that isn't seconds falls back to the clock", workoutFrom({ name: "X", start: "2026-10-30 06:00:00 -0600", end: "2026-10-30 06:40:00 -0600", duration: 40 }).minutes === 40);

  const stages = readHealthPayload(
    {
      data: {
        metrics: [
          {
            name: "sleep_analysis",
            units: "hr",
            data: [
              { startDate: "2026-10-30 22:30:00 -0600", endDate: "2026-10-30 22:40:00 -0600", value: "In Bed", qty: 0.17 },
              { startDate: "2026-10-30 22:40:00 -0600", endDate: "2026-10-31 01:00:00 -0600", value: "Core", qty: 2.3 },
              { startDate: "2026-10-31 01:00:00 -0600", endDate: "2026-10-31 02:00:00 -0600", value: "Deep", qty: 1 },
              { startDate: "2026-10-31 02:00:00 -0600", endDate: "2026-10-31 02:10:00 -0600", value: "Awake", qty: 0.17 },
              { startDate: "2026-10-31 02:10:00 -0600", endDate: "2026-10-31 04:30:00 -0600", value: "REM", qty: 2.3 },
            ],
          },
        ],
      },
    },
    TZ
  );
  const sn = stages.days["2026-10-31"];
  ok("stage rows add up into one night", sn && sn.asleep_min === 340 && sn.deep_min === 60 && sn.awake_min === 10 && sn.rem_min === 140 && sn.core_min === 140);
  ok("the night runs from first sleep to last", sn.sleep_start === "2026-10-31T04:40:00.000Z" && sn.sleep_end === "2026-10-31T10:30:00.000Z");

  ok("a day's totals keep the larger count on a resend", mergeDay({ steps: 9000, resting_hr: 55, extra: { a: 1 } }, { steps: 4000, resting_hr: 53, extra: { b: 2 } }).steps === 9000);
  ok("and readings take the newest", mergeDay({ steps: 9000, resting_hr: 55 }, { resting_hr: 53 }).resting_hr === 53);
  ok("and extra merges", JSON.stringify(mergeDay({ extra: { a: 1 } }, { extra: { b: 2 } }).extra) === '{"a":1,"b":2}');

  const nightObj = { start: new Date("2026-10-31T04:20:00Z"), end: new Date("2026-10-31T10:50:00Z") };
  const now = new Date("2026-10-31T14:00:00Z");
  ok("an unlogged night goes in", sleepAction(nightObj, [], now).kind === "add");
  ok("a logged night the watch already set is left alone", sleepAction(nightObj, [{ id: "s", tags: ["Sleep"], started_at: "2026-10-31T04:00:00Z", ended_at: "2026-10-31T11:00:00Z", watch_fixed_at: "2026-10-31T11:05:00Z" }], now).kind === "skip");
  ok("a Sleep timer still running from that night ends when you woke", (() => {
    const a = sleepAction(nightObj, [{ id: "s", tags: ["Sleep"], started_at: "2026-10-31T04:00:00Z", ended_at: null }], now);
    return a.kind === "end" && a.id === "s" && a.at === "2026-10-31T10:50:00.000Z";
  })());
  ok("an old forgotten Sleep timer is left to the fix list", sleepAction(nightObj, [{ id: "s", tags: ["Sleep"], started_at: "2026-10-30T20:00:00Z", ended_at: null }], now).kind === "skip");
  ok("a stale night doesn't end a running timer", sleepAction(nightObj, [{ id: "s", tags: ["Sleep"], started_at: "2026-10-31T04:00:00Z", ended_at: null }], new Date("2026-11-02T14:00:00Z")).kind === "skip");
  ok("a night that isn't over yet waits", sleepAction({ start: nightObj.start, end: new Date("2026-10-31T16:00:00Z") }, [], now).kind === "skip");
  ok("other timers don't block a night", sleepAction(nightObj, [{ id: "w", tags: ["Free time"], started_at: "2026-10-31T03:00:00Z", ended_at: "2026-10-31T12:00:00Z" }], now).kind === "add");

  ok("a workout you timed is linked, not doubled", workoutAction(lift, [{ id: "e", tags: ["Exercise"], started_at: "2026-10-30T12:05:00Z", ended_at: "2026-10-30T12:50:00Z" }]).kind === "link");
  ok("an untimed workout is added", workoutAction(lift, [{ id: "e", tags: ["Study"], started_at: "2026-10-30T12:05:00Z", ended_at: "2026-10-30T12:50:00Z" }]).kind === "add");
  const ex = exerciseEntry("u", run);
  ok("a run's Exercise entry carries its miles", ex.exercise_kind === "run" && ex.exercise_metric === 3.1 && ex.exercise_unit === "mi" && ex.source === "watch" && ex.tags[0] === "Exercise");
  ok("a lift's carries none", exerciseEntry("u", lift).exercise_metric === null);

  ok("watch names shorten", workoutName("Traditional Strength Training") === "Strength" && workoutName("Outdoor Run") === "Run" && workoutName("High Intensity Interval") === "HIIT");
  ok("minutes read as hours", watchMins(390) === "6h 30m" && watchMins(35) === "35m");
  const parts = eveningWatchParts({ asleep_min: 390, deep_min: 60, rem_min: 90, steps: 8421, resting_hr: 54, hrv_ms: 61 }, [{ name: "Traditional Strength Training", minutes: 35, started_at: "2026-10-30T12:10:00Z", avg_hr: 118 }]);
  ok("the evening line: sleep, workouts, steps, heart", parts.map((p) => p.label).join(",") === "Slept,Strength,Steps,Resting HR" && parts[0].sub === "1h 00m deep, 1h 30m REM" && parts[3].sub === "HRV 61 ms");
  ok("nothing from the watch, no line", eveningWatchParts(null, []).length === 0);
  ok("with no wake-up automation, Up comes from when the watch saw you wake", eveningWatchParts({ sleep_end: "2026-11-01T15:54:17Z", asleep_min: 586 }, [])[0]?.label === "Up");
  ok("the automation's moment wins over the watch's", eveningWatchParts({ woke_at: "2026-11-01T11:30:00Z", sleep_end: "2026-11-01T15:54:17Z" }, [])[0]?.value === eveningWatchParts({ woke_at: "2026-11-01T11:30:00Z" }, [])[0]?.value);
  ok("the key's status says what last used it", lastUsedLine({ last_used_at: new Date(Date.now() - 5 * 60000).toISOString(), last_used_by: "health" }) === "On · Health Auto Export, 5 min ago" && lastUsedLine(null) === "Off");
  ok("the watch address carries the key", watchAddress("https://x.supabase.co/functions/v1/watch", "ab12") === "https://x.supabase.co/functions/v1/watch?key=ab12");

  const week = ["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"];
  const wk = watchWeek({ healthDays: [{ date: "2026-10-26", asleep_min: 400, deep_min: 60, rem_min: 90, steps: 8000, resting_hr: 54 }, { date: "2026-10-27", asleep_min: 380, deep_min: 70, rem_min: 80, steps: 10000, resting_hr: 56, mindful_min: 15 }, { date: "2026-11-02", steps: 99999 }], days: week, upTo: "2026-10-31" });
  ok("the mirror's watch part counts the nights and averages", wk.lines[0].startsWith("The watch saw **2** nights, averaging **6") && wk.lines[0].includes("REM a night."), wk?.lines?.join(" | "));
  ok("and the steps leave out days past the week", wk.lines[1].startsWith("**9,000** steps a day"), wk?.lines?.join(" | "));
  ok("no watch rows, no part", watchWeek({ healthDays: [], days: week, upTo: "2026-10-31" }) === null);
}

{
  // The Hub app on the watch.
  const plan = planOf([
    { title: "Exercise", category: "Exercise", start_time: "04:45:00", end_time: "05:45:00" },
    { title: "Up and grind", category: null, start_time: "04:30:00", end_time: "04:45:00" },
    { title: "", category: "Study", start_time: "06:00:00", end_time: "07:00:00" },
    { title: "No time", start_time: null, end_time: null },
  ]);
  ok("the watch plan is in order, with clock times", plan.map((b) => `${b.start}-${b.end} ${b.title}`).join(", ") === "04:30-04:45 Up and grind, 04:45-05:45 Exercise, 06:00-07:00 Block", JSON.stringify(plan));
  ok("the block you're in", blockAt(plan, "05:00")?.title === "Exercise" && blockAt(plan, "05:00")?.now === true);
  ok("between blocks, the next one", blockAt(plan, "05:50")?.title === "Block" && blockAt(plan, "05:50")?.now === false);
  ok("after the last block, nothing", blockAt(plan, "21:00") === null && blockAt([], "05:00") === null);
  ok("clock times trim seconds", hhmm("4:30:00") === "04:30" && hhmm(null) === "");
  ok("times go out as epoch ms", appMs("2026-11-01T16:23:18.378+00:00") === Date.parse("2026-11-01T16:23:18.378Z") && appMs(null) === null);

  const goals = [
    { week_start: "2026-11-01", title: "Wake up at 4:30", position: 2 },
    { week_start: "2026-11-01", title: "Daily form--win by win", position: 1 },
    { week_start: "2026-10-25", title: "Old goal", position: 0 },
  ];
  ok("this week's focus goals, in order", focusWeek(goals, "2026-11-03").join(" | ") === "Daily form--win by win | Wake up at 4:30");
  ok("last week's goals still show until the new week is planned", focusWeek(goals.slice(2), "2026-10-31").join() === "Old goal");
  ok("goals over a week old don't", focusWeek(goals.slice(2), "2026-11-02").length === 0 && focusWeek([], "2026-11-02").length === 0);

  const targets = [
    { label: "Study", categories: ["Study"], minutes: 60, period: "day", position: 0 },
    { label: "Sleep", categories: ["Sleep"], minutes: 480, period: "day", position: 2 },
    { label: "Exercise", categories: ["Exercise", "Run"], minutes: 60, period: "day", position: 1 },
    { label: "Forsyth Media", categories: ["Work"], minutes: 3600, period: "week", position: 3 },
  ];
  const entries = [
    { category: "Study", tags: ["Study"], ended_at: "x", duration_minutes: 25 },
    { category: "Other", tags: ["Run"], ended_at: "x", duration_minutes: 30 },
    { category: "Study", tags: [], ended_at: "x", duration_minutes: 10 },
    { category: "Study", tags: ["Study"], ended_at: null, duration_minutes: null },
  ];
  const tt = targetsToday(targets, entries);
  ok("daily targets count today's minutes by tag, sleep and weekly ones left out", tt.map((t) => `${t.label} ${t.done}/${t.goal}`).join(", ") === "Study 35/60, Exercise 30/60", JSON.stringify(tt));

  const slept = sleptLast(
    [
      { category: "Sleep", tags: ["Sleep"], started_at: "2026-11-01T04:30:00Z", ended_at: "2026-11-01T11:40:00Z" },
      { category: "Sleep", tags: ["Sleep"], started_at: "2026-10-31T05:00:00Z", ended_at: "2026-10-31T12:00:00Z" },
      { category: "Nap", tags: ["Sleep"], started_at: "2026-11-01T20:00:00Z", ended_at: null },
    ],
    "2026-11-01T06:00:00.000Z"
  );
  ok("last night's sleep is the one that ended today", slept === 430, String(slept));
  ok("no night, no sleep line", sleptLast([], "2026-11-01T06:00:00.000Z") === null);
  const noBed = readHealthPayload(
    { data: { metrics: [{ name: "sleep_analysis", units: "hr", data: [{ date: "2026-11-01", totalSleep: 9.77, core: 6.5, deep: 0.85, rem: 2.42, awake: 0.57, inBed: 0, sleepStart: "2026-10-31 23:33:52 -0600", sleepEnd: "2026-11-01 09:54:17 -0600" }] }] } },
    "America/Denver"
  );
  ok("a watch night with inBed 0 leaves time in bed empty", noBed.days["2026-11-01"]?.in_bed_min == null && noBed.days["2026-11-01"]?.asleep_min === 586, JSON.stringify(noBed.days));
}

{
  // What the prompts are told the watch saw. (Clocks went back at 2 a.m.
  // on 2026-11-01, so Denver is UTC-7 all that day after it.)
  const tz = "America/Denver";
  const history = [
    { date: "2026-10-29", asleep_min: 420, resting_hr: 54 },
    { date: "2026-10-30", asleep_min: 430, resting_hr: 56 },
    { date: "2026-10-31", asleep_min: 440, resting_hr: 55 },
  ];
  const day = { date: "2026-11-01", sleep_end: "2026-11-01T11:41:00Z", asleep_min: 370, deep_min: 48, rem_min: 80, steps: 8421.4, resting_hr: 61 };
  const w = watchForPrompt({
    date: "2026-11-01",
    day,
    history: [...history, day],
    workouts: [
      { name: "Traditional Strength Training", started_at: "2026-11-01T13:10:00Z", minutes: 42 },
      { name: "Outdoor Walk", started_at: "2026-11-02T04:30:00Z", minutes: 20 },
      { name: "Outdoor Run", started_at: "2026-11-02T08:00:00Z", minutes: 30 },
    ],
    tz,
  });
  ok("watch prompt: up time from the watch's wake", w?.up_at === "4:41 AM", JSON.stringify(w));
  ok("watch prompt: short night said against the usual", w?.last_night === "6h 10m asleep, about 1h 00m less than their usual 7h 10m", w?.last_night);
  ok("watch prompt: stages", w?.sleep_stages === "48m deep, 1h 20m REM", w?.sleep_stages);
  ok("watch prompt: only that day's workouts, local time, in order", JSON.stringify(w?.workouts) === JSON.stringify(["Strength, 42m at 6:10 AM", "Walk, 20m at 9:30 PM"]), JSON.stringify(w?.workouts));
  ok("watch prompt: steps rounded, resting HR beside the usual", w?.steps === 8421 && w?.resting_heart_rate === "61 bpm (their usual 55)", JSON.stringify(w));
  const fresh = watchForPrompt({ date: "2026-11-01", day: { date: "2026-11-01", asleep_min: 586, woke_at: "2026-11-01T12:00:00Z", sleep_end: "2026-11-01T15:54:17Z" }, history: [], workouts: [], tz });
  ok("watch prompt: no usual until there are 3 nights; the wake-up automation wins", fresh?.last_night === "9h 46m asleep" && fresh?.up_at === "5:00 AM", JSON.stringify(fresh));
  const near = watchForPrompt({ date: "2026-11-01", day: { date: "2026-11-01", asleep_min: 420 }, history, workouts: [], tz });
  ok("watch prompt: within half an hour is about usual", near?.last_night === "7h 00m asleep, about their usual", near?.last_night);
  ok("watch prompt: nothing from the watch, nothing in the record", watchForPrompt({ date: "2026-11-01", day: null, history: [], workouts: [], tz }) === null);
}

{
  // The watch beside the time log, in the evening's shots and the morning.
  const exercise = { categories: ["Exercise"] };
  const entries = [
    { category: "Exercise", tags: ["Exercise"], source: "watch", description: "Traditional Strength Training", started_at: "2026-11-01T13:10:00Z", ended_at: "2026-11-01T13:52:00Z", duration_minutes: 42 },
    { category: "Exercise", tags: ["Exercise"], source: "app", description: "Stretch", started_at: "2026-11-01T14:00:00Z", ended_at: "2026-11-01T14:10:00Z", duration_minutes: 10 },
    { category: "Exercise", tags: ["Exercise"], source: "watch", started_at: "2026-11-02T00:00:00Z", ended_at: null, duration_minutes: null },
    { category: "Sleep", tags: ["Sleep"], source: "watch", started_at: "2026-11-01T05:30:00Z", ended_at: "2026-11-01T11:40:00Z", duration_minutes: 370 },
  ];
  ok("watch saw: the workout it recorded, by its short name", watchSaw(exercise, entries) === "Strength 42m", watchSaw(exercise, entries));
  ok("watch saw: nothing for a focus it didn't touch", watchSaw({ categories: ["Draw"] }, entries) === "" && watchSaw({ categories: [] }, entries) === "");
  ok("watch saw: a timer still running isn't counted yet", !watchSaw(exercise, entries).includes("Exercise"));
  const line = morningWatchLine({ asleep_min: 586, deep_min: 51, rem_min: 145, sleep_end: "2026-11-01T15:54:17Z" });
  ok("morning watch line: slept, stages, when it saw you wake", /^Your watch: slept 9h 46m · 51m deep, 2h 25m REM · awake at \d{1,2}:54/.test(line ?? ""), line);
  ok("morning watch line: no night, no line", morningWatchLine(null) === null && morningWatchLine({ steps: 400 }) === null);
  ok("watch key status names the watch app", lastUsedLine({ last_used_at: new Date().toISOString(), last_used_by: "app" }).includes("the watch app"));
}

{
  console.log("\nthe push: tone and aim (Nov 2026)");
  ok("the tone never soothes", /Never soothe/.test(PUSH_TONE) && /it's okay/.test(PUSH_TONE));
  ok("the tone never speaks for God", /don't speak for God/i.test(PUSH_TONE) && /what God expects/.test(PUSH_TONE));
  ok("the tone grounds the push in evidence and forbids invention", /real person/.test(PUSH_TONE) && /research/.test(PUSH_TONE) && /Never invent a figure/.test(PUSH_TONE));
  ok("the tone keeps reflection and God at the centre", /walk with God at the centre/.test(PUSH_TONE));
  const index = readFileSync(new URL("../supabase/functions/assistant/index.ts", import.meta.url), "utf8");
  ok("the old soft tone line is gone from the spirit prompts", !/warm and direct, like a trusted friend/.test(index));
  ok("walk and reflection both read the aim, in his time zone", (index.match(/aimDay\(supabase, date, tz\)/g) ?? []).length === 2);
  const evening = aimForPrompt({
    date: "2026-11-02",
    tz: "America/Denver",
    goals: [{ id: "g1", title: "Highly skilled" }],
    focuses: [{ id: "f1", goal_id: "g1", name: "Draw", categories: ["Art"] }],
    entries: [
      // 8 pm on Nov 2 in Denver is Nov 3 in UTC: still tonight.
      { category: "Art", tags: [], duration_minutes: 45, started_at: "2026-11-03T03:00:00Z" },
      // 8 pm on Oct 26 in Denver is Oct 27 in UTC: eight local days back, so out.
      { category: "Art", tags: [], duration_minutes: 60, started_at: "2026-10-27T02:00:00Z" },
    ],
  });
  ok("tonight's evening minutes count and last week's evening doesn't", evening.lifetime_goals[0].focuses[0].minutes_last_7_days === 45, JSON.stringify(evening.lifetime_goals[0]));

  ok("no rows is no aim", aimForPrompt({ date: "2026-11-02" }) === null);
  const aim = aimForPrompt({
    date: "2026-11-02",
    mission: { statement: "To become a trusted servant", summit: "An Exalted Servant" },
    goals: [{ id: "g1", title: "Highly skilled" }, { id: "g2", title: "Highly educated" }],
    focuses: [{ id: "f1", goal_id: "g1", name: "Draw", categories: ["Art"] }],
    entries: [
      { category: "Art", tags: [], duration_minutes: 30, started_at: "2026-11-01T14:00:00Z" },
      { category: "Work", tags: ["art"], duration_minutes: 10, started_at: "2026-10-31T14:00:00Z" },
      { category: "Art", tags: [], duration_minutes: 99, started_at: "2026-10-20T14:00:00Z" },
    ],
    weekFocus: [{ id: "w2", title: "No artificial meals", position: 2 }, { id: "w1", title: "Up at 4:30", position: 1 }],
    checkins: [{ goal_id: "w1", date: "2026-11-01", moved: true }, { goal_id: "w1", date: "2026-11-02", moved: false }],
    targets: [{ id: "t1", goal_id: "g1" }, { id: "t2", quest_id: "q1" }, { id: "t3", lesson_id: "l1" }],
    shots: [
      { target_id: "t1", date: "2026-11-01", level: 0, note: "an hour of gesture drawing" },
      { target_id: "t1", date: "2026-10-30", level: 5, note: null },
      { target_id: "t1", date: "2026-10-01", level: 0, note: "old" },
      { target_id: "t2", date: "2026-11-02", level: 2, note: null },
    ],
    quests: [{ id: "q1", title: "Premiere plugin", status: "on" }, { id: "q9", title: "Done one", status: "done" }],
    lessons: [{ id: "l1", title: "More integrity", status: "learning" }, { id: "l2", title: "Learned", status: "learned" }],
  });
  ok("the mission and summit come through", aim.mission === "To become a trusted servant" && aim.summit === "An Exalted Servant");
  ok("a focus counts its category and tags, only in the last week", aim.lifetime_goals[0].focuses[0].minutes_last_7_days === 40, JSON.stringify(aim.lifetime_goals[0]));
  ok("a goal with no focus says so", aim.lifetime_goals[1].focuses === "none set yet");
  ok("arrows are this week's only, oldest first, with their notes", JSON.stringify(aim.lifetime_goals[0].arrows_last_7_days) === JSON.stringify(["2026-10-30 missed", "2026-11-01 bullseye: an hour of gesture drawing"]), JSON.stringify(aim.lifetime_goals[0].arrows_last_7_days));
  ok("this week's focus is in his order with moved and not days", aim.this_weeks_focus[0].focus === "Up at 4:30" && aim.this_weeks_focus[0].days_moved === 1 && aim.this_weeks_focus[0].days_not === 1);
  ok("only quests still on, with their arrows", aim.quests.length === 1 && aim.quests[0].arrows_last_7_days[0] === "2026-11-02 middle ring", JSON.stringify(aim.quests));
  ok("only lessons still being learned", aim.lessons.length === 1 && aim.lessons[0].lesson === "More integrity");
}

{
  console.log("\ntoday's plan, block by block");
  const D = "2026-11-02";
  const at = (h, m = 0) => h * 60 + m;
  const chunks = [
    { id: "c5", start_time: "21:30:00", end_time: "04:30:00", title: "Sleep" },
    { id: "c3", start_time: "13:00:00", end_time: "15:00:00", title: "Multicam", quest_id: "q1", camp_id: "k1" },
    { id: "c1", start_time: "08:00:00", end_time: "10:00:00", title: "Morning" },
    { id: "c4", start_time: "16:00:00", end_time: "18:00:00", title: "Plugin again", quest_id: "q1", camp_id: null },
    { id: "c2", start_time: "10:00:00", end_time: "12:00:00", title: "Plugin", quest_id: "q1", camp_id: null },
    { id: "c6", start_time: null, end_time: null, title: "No time" },
  ];
  const tasks = [
    { id: "t1", title: "Inbox", time_chunk_id: "c1", parent_task_id: null, status: true, position: 0 },
    { id: "t1a", title: "Reply to Sam", time_chunk_id: "c1", parent_task_id: "t1", status: false, position: 0 },
    { id: "t2", title: "Export clips", time_chunk_id: "c3", parent_task_id: null, status: false, position: 1 },
    { id: "t3", title: "Call the bank", time_chunk_id: null, parent_task_id: null, status: false, position: 2 },
    { id: "t4", title: "Moved block", time_chunk_id: "gone", parent_task_id: null, status: false, position: 3 },
  ];
  const work = {
    quests: [
      { id: "q1", title: "Plugin", status: "on", position: 0 },
      { id: "q2", title: "House", status: "on", position: 1 },
    ],
    camps: [
      { id: "k1", quest_id: "q1", title: "Multicam", position: 0 },
      { id: "k2", quest_id: "q1", title: "Audio", position: 1 },
      { id: "k3", quest_id: "q2", title: "Kitchen", position: 0 },
    ],
    sections: [
      { id: "sA", camp_id: "k2", title: "Mixer", today_on: D, position: 0 },
      { id: "sB", camp_id: "k2", title: "Later", today_on: null, position: 1 },
    ],
    steps: [
      { id: "s1", camp_id: "k1", section_id: null, parent_id: null, kind: "task", text: "Sync angles", today_on: D, done_on: null, position: 0 },
      { id: "s1a", camp_id: "k1", section_id: null, parent_id: "s1", kind: "task", text: "Check audio drift", today_on: D, done_on: null, position: 0 },
      { id: "s2", camp_id: "k2", section_id: null, parent_id: null, kind: "task", text: "Pick a limiter", today_on: D, done_on: null, position: 0 },
      { id: "s3", camp_id: "k2", section_id: "sA", parent_id: null, kind: "task", text: "Done last week", today_on: null, done_on: "2026-10-30", position: 1 },
      { id: "s4", camp_id: "k2", section_id: "sA", parent_id: null, kind: "task", text: "Done this morning", today_on: null, done_on: D, position: 2 },
      { id: "s7", camp_id: "k2", section_id: "sA", parent_id: null, kind: "task", text: "Done before, one left", today_on: null, done_on: "2026-10-29", position: 3 },
      { id: "s7a", camp_id: "k2", section_id: "sA", parent_id: "s7", kind: "task", text: "The one left", today_on: null, done_on: null, position: 0 },
      { id: "s5", camp_id: "k3", section_id: null, parent_id: null, kind: "task", text: "Measure the sink", today_on: D, done_on: null, position: 0 },
      { id: "n1", camp_id: "k1", section_id: null, parent_id: null, kind: "note", text: "Remember the tripod", today_on: D, done_on: null, position: 5 },
      { id: "s6", camp_id: "k2", section_id: "sB", parent_id: null, kind: "task", text: "Not today", today_on: null, done_on: null, position: 0 },
    ],
    lines: [
      { id: "l1", quest_id: "q1", parent_id: null, kind: "task", text: "Write release notes", day: D, ongoing: false, today_on: null, done_on: null, position: 0 },
      { id: "l1a", quest_id: "q1", parent_id: "l1", kind: "task", text: "List the fixes", day: D, ongoing: false, today_on: null, done_on: D, position: 0 },
      { id: "l2", quest_id: "q1", parent_id: null, kind: "task", text: "Ongoing, not picked", day: "2026-10-20", ongoing: true, today_on: null, done_on: null, position: 1 },
      { id: "l3", quest_id: "q2", parent_id: null, kind: "task", text: "Order tiles", day: "2026-10-30", ongoing: false, today_on: D, done_on: null, position: 0 },
      { id: "l4", quest_id: "q1", parent_id: null, kind: "note", text: "A note line", day: D, ongoing: false, today_on: null, done_on: null, position: 2 },
      { id: "l5", quest_id: "q1", parent_id: "l2", kind: "task", text: "Under the ongoing one", day: D, ongoing: false, today_on: null, done_on: null, position: 0 },
    ],
  };
  const planAt = (nowMin, extra = {}) => planForToday({ chunks, tasks, questWork: work, nowMin, date: D, ...extra });
  const ids = (items) => items.map((i) => i.id);
  const everyId = (p) => {
    const walk = (items) => items.flatMap((i) => [i.id, ...walk(i.subs)]);
    return [...p.blocks.flatMap((b) => walk(b.items)), ...walk(p.loose.planned), ...p.loose.quests.flatMap((g) => walk(g.items))];
  };
  const blockOf = (p, id) => p.blocks.find((b) => b.items.some((i) => i.id === id))?.id ?? null;

  const p = planAt(at(11));
  ok("every block with a time is listed, in day order", JSON.stringify(ids(p.blocks)) === JSON.stringify(["c1", "c2", "c3", "c4", "c5"]), JSON.stringify(ids(p.blocks)));
  const sleep = p.blocks.find((b) => b.id === "c5");
  ok("a block that ends before it starts ends tomorrow", sleep.startMin === at(21, 30) && sleep.endMin === at(4, 30) + 24 * 60, JSON.stringify([sleep.startMin, sleep.endMin]));
  ok("blocks are past, now or ahead against the clock", JSON.stringify(p.blocks.map((b) => b.state)) === JSON.stringify(["past", "now", "ahead", "ahead", "ahead"]), JSON.stringify(p.blocks.map((b) => b.state)));
  ok("just after midnight the night's block is still ahead", blocksOf(chunks, at(0, 30)).find((b) => b.id === "c5").state === "ahead");
  ok("a block ends as the next one starts", blocksOf(chunks, at(10)).find((b) => b.id === "c1").state === "past" && blocksOf(chunks, at(10)).find((b) => b.id === "c2").state === "now");

  const morning = p.blocks.find((b) => b.id === "c1");
  ok("a planned task goes in the block it was planned into", ids(morning.items).join() === "t1", JSON.stringify(ids(morning.items)));
  ok("its sub-tasks sit under it, not beside it", ids(morning.items[0].subs).join() === "t1a" && morning.items[0].subs[0].kind === "task", JSON.stringify(morning.items[0]));
  ok("a block counts what's in it and under it", morning.done === 1 && morning.total === 2, JSON.stringify([morning.done, morning.total]));
  ok("planned tasks with no block, or a block that isn't today's, wait at the foot", ids(p.loose.planned).join() === "t3,t4", JSON.stringify(ids(p.loose.planned)));

  const multicam = p.blocks.find((b) => b.id === "c3");
  ok("a camp step goes to the block tied to its camp, after the block's own tasks", ids(multicam.items).join() === "t2,s1", JSON.stringify(ids(multicam.items)));
  ok("a step under a picked step shows under it once, not again on its own", ids(multicam.items[1].subs).join() === "s1a" && everyId(p).filter((x) => x === "s1a").length === 1, JSON.stringify(everyId(p)));
  ok("a camp step says which camp it's from", multicam.items[1].from === "Multicam" && multicam.items[1].kind === "step", JSON.stringify(multicam.items[1]));
  ok("a step whose camp has no block goes to a block tied to its quest", blockOf(p, "s2") === "c2", blockOf(p, "s2"));
  ok("a quest line goes to the quest's block, not to one of its camps", blockOf(p, "l1") === "c2" && blockOf(planAt(at(14)), "l1") === "c4", JSON.stringify([blockOf(p, "l1"), blockOf(planAt(at(14)), "l1")]));
  ok("a quest line says which quest it's from", p.blocks.find((b) => b.id === "c2").items.find((i) => i.id === "l1").from === "Plugin");
  ok("a quest line's sub-tasks come with it", ids(p.blocks.find((b) => b.id === "c2").items.find((i) => i.id === "l1").subs).join() === "l1a");

  ok("two blocks on one quest: the one running now takes it", blockOf(planAt(at(16, 30)), "s2") === "c4", blockOf(planAt(at(16, 30)), "s2"));
  ok("two blocks on one quest: before both, the next one ahead takes it", blockOf(planAt(at(9)), "s2") === "c2", blockOf(planAt(at(9)), "s2"));
  ok("two blocks on one quest: between them, the one still ahead takes it", blockOf(planAt(at(12, 30)), "s2") === "c4", blockOf(planAt(at(12, 30)), "s2"));
  ok("two blocks on one quest: after both, the last one keeps it", blockOf(planAt(at(19)), "s2") === "c4", blockOf(planAt(at(19)), "s2"));
  ok("with only a camp's block on the quest, a quest line goes there", blockOf(planForToday({ chunks: chunks.filter((c) => c.id === "c3"), tasks: [], questWork: work, nowMin: at(11), date: D }), "l1") === "c3");
  ok("pickBlock with nothing to pick is null", pickBlock([]) === null);

  ok("done things stay, marked done", morning.items[0].done === true && p.blocks.find((b) => b.id === "c2").items.find((i) => i.id === "s4")?.done === true);
  ok("a step in a section picked for today that was finished before today is left out", !everyId(p).includes("s3"), JSON.stringify(everyId(p)));
  ok("one finished before today with something under it still open stays, with it", blockOf(p, "s7") === "c2" && ids(p.blocks.find((b) => b.id === "c2").items.find((i) => i.id === "s7").subs).join() === "s7a");
  ok("a step in a section that isn't picked isn't on today", !everyId(p).includes("s6"));
  ok("notes are never things to do", !everyId(p).includes("n1") && !everyId(p).includes("l4"), JSON.stringify(everyId(p)));
  ok("a quest line that isn't picked, from the ongoing list, isn't on today", !everyId(p).includes("l2"));
  ok("a sub-task never comes on its own without its task", !everyId(p).includes("l5"));

  ok("a quest with no block gets its own group at the foot, by name", p.loose.quests.length === 1 && p.loose.quests[0].questId === "q2" && p.loose.quests[0].title === "House", JSON.stringify(p.loose.quests));
  ok("in a quest's group, its camps' steps come before its lines", ids(p.loose.quests[0].items).join() === "s5,l3", JSON.stringify(ids(p.loose.quests[0].items)));
  ok("with no blocks at all, everything waits at the foot", (() => {
    const bare = planForToday({ chunks: [], tasks, questWork: work, nowMin: at(11), date: D });
    return bare.blocks.length === 0 && ids(bare.loose.planned).join() === "t1,t2,t3,t4" && bare.loose.quests.map((g) => g.questId).join() === "q1,q2";
  })());
  ok("the quests' own order holds", ids(questItemsForToday(work, D)).join() === "s1,s2,s4,s7,l1,s5,l3", JSON.stringify(ids(questItemsForToday(work, D))));
  ok("a line picked from elsewhere comes before today's own", (() => {
    const two = questItemsForToday({ quests: work.quests, lines: [work.lines[0], { ...work.lines[2], id: "lp", today_on: D }] }, D);
    return ids(two).join() === "lp,l1";
  })());
  ok("nothing loaded yet is an empty plan, not a crash", (() => {
    const empty = planForToday({ chunks: null, tasks: null, questWork: null, nowMin: 0, date: D });
    return empty.blocks.length === 0 && empty.loose.planned.length === 0 && empty.loose.quests.length === 0 && empty.total === 0;
  })());
  ok("a count takes in everything under each item, too", JSON.stringify(tallyItems([{ done: true, subs: [{ done: false, subs: [{ done: true, subs: [] }] }] }])) === JSON.stringify({ done: 2, total: 3 }));

  const iso = "2026-11-02T18:00:00.000Z";
  ok("ticking a task sets its status and when", JSON.stringify(doneFields("task", true, D, iso)) === JSON.stringify({ status: true, completed_at: iso }) && doneFields("task", false, D, iso).completed_at === null);
  ok("ticking a line keeps the day and the moment and stops working on it", JSON.stringify(doneFields("line", true, D, iso)) === JSON.stringify({ done_on: D, done_at: iso, working_since: null }));
  ok("unticking a line clears both", JSON.stringify(doneFields("line", false, D, iso)) === JSON.stringify({ done_on: null, done_at: null }));
  ok("ticking a step keeps the day and stops working on it; unticking clears it", JSON.stringify(doneFields("step", true, D, iso)) === JSON.stringify({ done_on: D, working_since: null }) && JSON.stringify(doneFields("step", false, D, iso)) === JSON.stringify({ done_on: null }));
  const loaded = { tasks, work };
  const ticked = withFields(loaded, "step", "s1", doneFields("step", true, D, iso));
  ok("a tick changes only that row, and shows in the plan before it's saved", ticked.work.steps.find((s) => s.id === "s1").done_on === D && ticked.work.steps.find((s) => s.id === "s2").done_on === null && loaded.work.steps.find((s) => s.id === "s1").done_on === null && planForToday({ chunks, tasks: ticked.tasks, questWork: ticked.work, nowMin: at(11), date: D }).blocks.find((b) => b.id === "c3").items[1].done === true);
  const unticked = withFields(loaded, "task", "t1", doneFields("task", false, D, iso));
  ok("unticking a task keeps it where it was", planForToday({ chunks, tasks: unticked.tasks, questWork: work, nowMin: at(11), date: D }).blocks.find((b) => b.id === "c1").items[0].done === false && blockOf(planForToday({ chunks, tasks: unticked.tasks, questWork: work, nowMin: at(11), date: D }), "t1") === "c1");
  ok("unticking a step in a picked section keeps it on today", everyId(planForToday({ chunks, tasks, questWork: withFields(loaded, "step", "s4", doneFields("step", false, D, iso)).work, nowMin: at(11), date: D })).includes("s4"));
}

{
  console.log("\nthe week's focus as small targets (0101)");
  const wk = "2026-11-01";
  const goals = [
    { id: "g1", title: "Patience" },
    { id: "g2", title: "Exercise" },
  ];
  const checkins = [
    { goal_id: "g1", date: "2026-11-03", moved: false },
    { goal_id: "g1", date: "2026-11-01", moved: true },
    { goal_id: "g1", date: "2026-10-31", moved: true }, // last week
    { goal_id: "g1", date: "2026-11-08", moved: true }, // next week
    { goal_id: "gone", date: "2026-11-02", moved: true }, // not this week's goal
    { goal_id: "g2", date: "2026-11-02T00:00:00", moved: true },
  ];
  const shots = weekShots(goals, checkins, wk);
  const radius = (s) => Math.hypot(s.x, s.y);
  const g1 = shots.g1;
  ok("every goal this week gets its own list of marks", Object.keys(shots).join() === "g1,g2", JSON.stringify(Object.keys(shots)));
  ok("only this week's check-ins become marks", g1.length === 2 && shots.gone === undefined, JSON.stringify(g1.map((s) => s.date)));
  ok("marks run oldest first, so the latest is the one lit", g1.map((s) => s.date).join() === "2026-11-01,2026-11-03", JSON.stringify(g1.map((s) => s.date)));
  ok("a day that moved it lands in the inner ring", g1[0].level === MOVED_LEVEL && MOVED_LEVEL === 1 && radius(g1[0]) >= LEVELS[1].r0 - 0.2 && radius(g1[0]) <= LEVELS[1].r1 + 0.2, JSON.stringify(g1[0]));
  ok("a 'not today' lands in the miss band", g1[1].level === NOT_TODAY_LEVEL && NOT_TODAY_LEVEL === 5 && radius(g1[1]) >= LEVELS[5].r0 - 0.2 && radius(g1[1]) <= LEVELS[5].r1 + 0.2, JSON.stringify(g1[1]));
  ok("a mark's id is the goal and the day", g1[0].id === "g1:2026-11-01", g1[0].id);
  ok("a mark sits where the Mark would put it, the same every time", JSON.stringify(placement("g1:2026-11-01", 1, null)) === JSON.stringify({ x: g1[0].x, y: g1[0].y }) && JSON.stringify(checkinShot("g1", "2026-11-01", true)) === JSON.stringify(g1[0]));
  ok("a timestamp-shaped date still lands on its day", shots.g2.length === 1 && shots.g2[0].date === "2026-11-02", JSON.stringify(shots.g2));
  ok("a goal nobody answered has no marks", weekShots([{ id: "g3" }], [], wk).g3.length === 0);
  ok("no goals, no marks", JSON.stringify(weekShots(null, checkins, wk)) === "{}");
  ok("two answers for one day keep the last", weekShots([{ id: "a" }], [{ goal_id: "a", date: wk, moved: true }, { goal_id: "a", date: wk, moved: false }], wk).a.map((s) => s.level).join() === "5");
}

{
  console.log("\na focus's earlier weeks (0101)");
  const all = [
    { id: "w3", carried_from: "w2" },
    { id: "w2", carried_from: "w1" },
    { id: "w1", carried_from: null },
    { id: "other", carried_from: null },
  ];
  ok("a kept focus walks back through every week it was carried", lineageIds("w3", all).join() === "w3,w2,w1", JSON.stringify(lineageIds("w3", all)));
  ok("a goal row works as well as its id", lineageIds({ id: "w2", carried_from: "w1" }, all).join() === "w2,w1");
  ok("a focus set fresh this week is only itself", lineageIds("w1", all).join() === "w1");
  ok("other goals never join the chain", !lineageIds("w3", all).includes("other"));
  ok("a removed earlier week ends the chain there", lineageIds("b", [{ id: "b", carried_from: "a" }]).join() === "b");
  ok("a goal not in the list yet still counts as itself", lineageIds({ id: "new", carried_from: "w2" }, all).join() === "new,w2,w1", JSON.stringify(lineageIds({ id: "new", carried_from: "w2" }, all)));
  ok("a loop between two weeks stops instead of hanging", lineageIds("x", [{ id: "x", carried_from: "y" }, { id: "y", carried_from: "x" }]).join() === "x,y");
  ok("a goal pointing at itself is just itself", lineageIds("s", [{ id: "s", carried_from: "s" }]).join() === "s");
  const long = Array.from({ length: 80 }, (_, i) => ({ id: `n${i}`, carried_from: i < 79 ? `n${i + 1}` : null }));
  const walked = lineageIds("n0", long);
  ok("the chain reaches back a year and no further", walked.length === LINEAGE_WEEKS && LINEAGE_WEEKS === 52 && walked[0] === "n0" && walked[51] === "n51", walked.length);
  ok("nothing given, nothing walked", lineageIds(null, all).length === 0 && lineageIds("w1", null).join() === "w1");
}

{
  console.log("\nnotes on a focus (0101)");
  const notes = [
    { id: "a", created_at: "2026-10-28T09:00:00+00:00" },
    { id: "c", created_at: "2026-11-02T08:00:00+00:00" },
    { id: "b", created_at: "2026-11-01T20:00:00+00:00" },
  ];
  ok("notes read newest first", newestFirst(notes).map((n) => n.id).join() === "c,b,a");
  ok("sorting leaves the list it was given alone", notes[0].id === "a");
  ok("a note loses the blank space round it but keeps its own lines", cleanNote("  first line\r\nsecond  \n\n") === "first line\nsecond", JSON.stringify(cleanNote("  first line\r\nsecond  \n\n")));
  ok("an empty note is nothing to save", cleanNote("   \n ") === "" && cleanNote(null) === "");
  ok("a note stops at the 2000 characters the table allows", cleanNote("x".repeat(2500)).length === 2000);
  ok("the cap counts characters, not halves of an emoji", Array.from(cleanNote("😀".repeat(2100))).length === 2000);
  ok("today's note says today", noteDay("2026-11-02", "2026-11-02") === "Today");
  ok("yesterday's says yesterday", noteDay("2026-11-01", "2026-11-02") === "Yesterday");
  ok("an older note shows its date", /Oct/.test(noteDay("2026-10-27", "2026-11-02")), noteDay("2026-10-27", "2026-11-02"));
  const mig = readFileSync(new URL("../supabase/migrations/0101_focus_notes.sql", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  ok("the notes migration only adds", !/\bdrop\b|\bdelete\s+from\b|\bupdate\s+public\.|\btruncate\b|\balter\s+table\s+public\.focus_(goals|checkins)\b/i.test(mig));
  ok("notes are kept to your own rows on your own goals", /enable row level security/.test(mig) && /g\.id = goal_id and g\.user_id = auth\.uid\(\)/.test(mig));
  ok("removing a goal takes its notes with it", /references public\.focus_goals\(id\) on delete cascade/.test(mig));
  ok("Ask's schema notes know focus_notes", readFileSync(new URL("../supabase/functions/ask/index.ts", import.meta.url), "utf8").includes("focus_notes(id, goal_id, date date, text text"));
}

{
  console.log("\nthe watch sets hand-logged sleep and exercise right (0102)");
  const now = new Date("2026-10-31T14:00:00Z");
  const night = { start: new Date("2026-10-31T04:40:00Z"), end: new Date("2026-10-31T10:30:00Z"), bedStart: null };
  const hand = { id: "h", category: "Sleep", tags: ["Sleep"], started_at: "2026-10-31T04:20:00Z", ended_at: "2026-10-31T10:45:00Z", is_nap: false, source: null, watch_fixed_at: null };
  const fix = sleepAction(night, [hand], now);
  ok("one hand-logged night off by 5 minutes or more takes the watch's times", fix.kind === "fix" && fix.id === "h" && fix.start === "2026-10-31T04:40:00.000Z" && fix.end === "2026-10-31T10:30:00.000Z", JSON.stringify(fix));
  const bedNight = { ...night, bedStart: new Date("2026-10-31T04:25:00Z") };
  const bedFix = sleepAction(bedNight, [hand], now);
  ok("its start is when you got into bed, when that was measured", bedFix.kind === "fix" && bedFix.start === "2026-10-31T04:25:00.000Z", JSON.stringify(bedFix));
  ok("otherwise when you fell asleep", bedtimeOf(night) === night.start.getTime());
  const staged = readHealthPayload({ data: { metrics: [{ name: "sleep_analysis", units: "hr", data: [
    { startDate: "2026-10-30 22:25:00 -0600", endDate: "2026-10-31 04:35:00 -0600", value: "In Bed", qty: 6.2 },
    { startDate: "2026-10-30 22:40:00 -0600", endDate: "2026-10-31 04:30:00 -0600", value: "Core", qty: 5.8 },
  ] }] } }, "America/Denver").nights[0];
  ok("a night of stages knows when you got into bed", staged?.bedStart?.toISOString() === "2026-10-31T04:25:00.000Z" && staged.start.toISOString() === "2026-10-31T04:40:00.000Z", JSON.stringify(staged));
  const agg = (inBed) => readHealthPayload({ data: { metrics: [{ name: "sleep_analysis", units: "hr", data: [{ date: "2026-10-31", totalSleep: 5.8, inBed, inBedStart: "2026-10-30 22:25:00 -0600", sleepStart: "2026-10-30 22:40:00 -0600", sleepEnd: "2026-10-31 04:30:00 -0600" }] }] } }, "America/Denver").nights[0];
  ok("a summed night has a bed time only when time in bed was measured", agg(6.2)?.bedStart?.toISOString() === "2026-10-31T04:25:00.000Z" && agg(0)?.bedStart === null);
  ok("a bed time after you fell asleep, or 3 hours before, isn't believed", bedtimeOf({ start: night.start, bedStart: new Date("2026-10-31T05:00:00Z") }) === night.start.getTime() && bedtimeOf({ start: night.start, bedStart: new Date("2026-10-31T01:00:00Z") }) === night.start.getTime());
  const two = sleepAction(night, [{ ...hand, id: "a", ended_at: "2026-10-31T07:00:00Z" }, { ...hand, id: "b", started_at: "2026-10-31T07:30:00Z" }], now);
  ok("two Sleep entries over one night are left as you logged them", two.kind === "skip", JSON.stringify(two));
  ok("an entry the watch already set isn't moved again", sleepAction(night, [{ ...hand, watch_fixed_at: "2026-10-31T11:00:00Z" }], now).kind === "skip");
  const close = sleepAction(night, [{ ...hand, started_at: "2026-10-31T04:37:00Z", ended_at: "2026-10-31T10:34:00Z" }], now);
  ok("under 5 minutes off, nothing moves; it's only marked as checked", close.kind === "match" && close.id === "h", JSON.stringify(close));
  ok("a nap is never moved", sleepAction(night, [{ ...hand, is_nap: true }], now).kind === "skip");
  ok("a running Sleep timer still just ends", sleepAction(night, [{ ...hand, ended_at: null }], now).kind === "end");
  const reading = { id: "r", category: "Reading", tags: ["Reading"], started_at: "2026-10-31T03:30:00Z", ended_at: "2026-10-31T04:30:00Z" };
  const fitted = sleepAction(bedNight, [{ ...hand, started_at: "2026-10-31T04:30:00Z" }, reading], now);
  ok("the watch's start stops where the entry before it ended", fitted.kind === "fix" && fitted.start === "2026-10-31T04:30:00.000Z" && fitted.end === "2026-10-31T10:30:00.000Z", JSON.stringify(fitted));

  const lift = { external_id: "W1", started_at: "2026-10-30T12:10:00.000Z", ended_at: "2026-10-30T12:45:00.000Z" };
  const timed = { id: "e", category: "Exercise", tags: ["Exercise"], started_at: "2026-10-30T12:00:00Z", ended_at: "2026-10-30T12:30:00Z", watch_fixed_at: null };
  const wfix = workoutAction(lift, [timed], [lift]);
  ok("one finished Exercise entry off by 5 minutes takes the workout's times", wfix.kind === "link" && wfix.id === "e" && wfix.fix?.start === "2026-10-30T12:10:00.000Z" && wfix.fix?.end === "2026-10-30T12:45:00.000Z", JSON.stringify(wfix));
  ok("a running Exercise timer is linked, not moved", (() => {
    const a = workoutAction(lift, [{ ...timed, ended_at: null }], [lift], Date.parse("2026-10-30T13:00:00Z"));
    return a.kind === "link" && !a.fix && !a.match;
  })());
  ok("one timer holding a run and a lift is left as logged", !workoutAction(lift, [{ ...timed, ended_at: "2026-10-30T13:30:00Z" }], [lift, { external_id: "W2", started_at: "2026-10-30T12:50:00Z", ended_at: "2026-10-30T13:20:00Z" }]).fix);
  ok("a workout over two Exercise entries moves neither", (() => {
    const a = workoutAction(lift, [timed, { ...timed, id: "e2", started_at: "2026-10-30T12:31:00Z", ended_at: "2026-10-30T12:50:00Z" }], [lift]);
    return a.kind === "link" && !a.fix;
  })());
  ok("an entry the watch already set keeps its times", !workoutAction(lift, [{ ...timed, watch_fixed_at: "2026-10-30T13:00:00Z" }], [lift]).fix);
  ok("under 5 minutes off is only marked as checked", workoutAction(lift, [{ ...timed, started_at: "2026-10-30T12:08:00Z", ended_at: "2026-10-30T12:47:00Z" }], [lift]).match === true);
  const study = { id: "s", category: "Study", tags: ["Study"], started_at: "2026-10-30T12:40:00Z", ended_at: "2026-10-30T13:30:00Z" };
  const forgot = workoutAction(lift, [{ ...timed, ended_at: "2026-10-30T12:40:00Z" }, study], [lift]);
  ok("a workout left running on the watch stops where your next timer starts", forgot.fix?.start === "2026-10-30T12:10:00.000Z" && forgot.fix?.end === "2026-10-30T12:40:00.000Z", JSON.stringify(forgot));
  ok("an Exercise entry the import makes is stamped as the watch's", typeof exerciseEntry("u", { ...lift, kind: "gym", name: "Strength" }, new Date("2026-10-30T14:00:00Z")).watch_fixed_at === "string");

  const sql = readFileSync(new URL("../supabase/migrations/0102_watch_corrects.sql", import.meta.url), "utf8").replace(/--.*$/gm, "");
  ok("0102 only adds: no drop, no constraint change, nothing deleted", !/\bdrop\b|\bconstraint\b|delete\s+from|\btruncate\b/i.test(sql));
  ok("0102 adds the three columns", ["watch_fixed_at", "hand_started_at", "hand_ended_at"].every((c) => new RegExp(`add column if not exists ${c} timestamptz`).test(sql)));
  ok("0102 stamps only what the import made", (sql.match(/t\.source = 'watch'/g) ?? []).length === 2);

  ok("watch saw: a hand-logged workout the watch set counts", watchSaw({ categories: ["Exercise"] }, [{ category: "Exercise", tags: ["Exercise"], source: null, watch_fixed_at: "2026-11-01T14:00:00Z", description: "Run", started_at: "2026-11-01T13:00:00Z", ended_at: "2026-11-01T13:30:00Z", duration_minutes: 30 }]) === "Run 30m");
  ok("watch saw: one it never set doesn't", watchSaw({ categories: ["Exercise"] }, [{ category: "Exercise", tags: ["Exercise"], source: null, watch_fixed_at: null, started_at: "2026-11-01T13:00:00Z", ended_at: "2026-11-01T13:30:00Z", duration_minutes: 30 }]) === "");
}

{
  console.log("\nthe watch on Today's minutes");
  const days = (from, n, hr) => Array.from({ length: n }, (_, i) => ({ date: `2026-10-${String(from + i).padStart(2, "0")}`, resting_hr: hr }));
  ok("no normal from fewer than 7 readings", restingNormal(days(20, 6, 52), "2026-11-01") === null);
  ok("7 readings make a normal: the middle one", restingNormal([...days(20, 3, 50), ...days(23, 4, 56)], "2026-11-01") === 56);
  ok("an even count takes the middle two", restingNormal([...days(20, 4, 50), ...days(24, 4, 55)], "2026-11-01") === 53, String(restingNormal([...days(20, 4, 50), ...days(24, 4, 55)], "2026-11-01")));
  ok("the day itself and days over 4 weeks back are left out", restingNormal([...days(1, 3, 90), ...days(20, 7, 52), { date: "2026-11-01", resting_hr: 99 }], "2026-11-01") === 52);
  ok("empty readings don't count", restingNormal([...days(20, 6, 52), { date: "2026-10-28", resting_hr: null }, { date: "2026-10-29", resting_hr: 0 }], "2026-11-01") === null);

  const today = { date: "2026-11-01", asleep_min: 412, woke_at: "2026-11-01T11:41:00Z", sleep_end: "2026-11-01T11:30:00Z", resting_hr: 54 };
  const parts = minutesWatchParts(today, null, 52);
  ok("slept, up and resting heart rate, words first", parts.map((p) => p.label).join(",") === "Slept,Up,Resting HR" && parts[0].value === "6h 52m" && /^\d{1,2}:\d{2}/.test(parts[1].value) && parts[1].value === minutesWatchParts({ woke_at: today.woke_at }, null, null)[0].value && parts[2].value === "54", JSON.stringify(parts));
  ok("resting heart rate sits beside your normal", parts[2].sub === "your normal 52");
  ok("up is when the watch saw you wake, without the automation", minutesWatchParts({ sleep_end: "2026-11-01T11:30:00Z" }, null, null)[0]?.label === "Up" && minutesWatchParts({ woke_at: "2026-11-01T11:41:00Z", sleep_end: "2026-11-01T11:30:00Z" }, null, null)[0]?.value !== minutesWatchParts({ sleep_end: "2026-11-01T11:30:00Z" }, null, null)[0]?.value);
  const early = minutesWatchParts({ asleep_min: 412 }, { resting_hr: 57 }, 52);
  ok("before today's resting heart rate is in, yesterday's says so", early[1]?.label === "Resting HR" && early[1].value === "57" && early[1].sub === "yesterday, your normal 52", JSON.stringify(early));
  ok("no normal yet, no comparison", minutesWatchParts({ resting_hr: 54 }, null, null)[0].sub === null);
  ok("nothing from the watch, nothing shown", minutesWatchParts(null, null, null).length === 0 && minutesWatchParts({ steps: 3000 }, null, 52).length === 0 && minutesWatch([], "2026-11-01").length === 0);
  const month = [...days(20, 4, 50), ...days(24, 3, 60), { date: "2026-10-31", resting_hr: 70 }, { date: "2026-11-01", asleep_min: 400 }];
  const fall = minutesWatch(month, "2026-11-01");
  ok("yesterday's reading is set beside the normal before it, not itself", fall.find((p) => p.label === "Resting HR")?.sub === "yesterday, your normal 50", JSON.stringify(fall));
  ok("today's reading is set beside the 4 weeks before today", minutesWatch([...month.slice(0, -1), { date: "2026-11-01", resting_hr: 58 }], "2026-11-01").find((p) => p.label === "Resting HR")?.sub === "your normal 55");
}

{
  console.log("\nthe watch only sets what it saw, and says the night once");
  const now = new Date("2026-10-19T15:00:00Z");
  // His 10-19: Sleep 22:28-4:33, up, Exercise 5:27-6:02, back to bed
  // 7:18-8:30. The watch sends one summed night over both parts.
  const split = readHealthPayload({ data: { metrics: [{ name: "sleep_analysis", units: "hr", data: [
    { date: "2026-10-19", totalSleep: 7.25, awake: 2.75, inBed: 0, sleepStart: "2026-10-18 22:30:00 -0600", sleepEnd: "2026-10-19 08:30:00 -0600" },
  ] }] } }, "America/Denver").nights[0];
  const first = { id: "s1", category: "Sleep", tags: ["Sleep"], started_at: "2026-10-19T04:28:00Z", ended_at: "2026-10-19T10:33:42Z", is_nap: false, source: null, watch_fixed_at: null };
  const exercise = { id: "x", category: "Exercise", tags: ["Exercise"], started_at: "2026-10-19T11:27:00Z", ended_at: "2026-10-19T12:02:00Z" };
  const withRun = sleepAction(split, [first, exercise], now);
  ok("a split night: the first part's I'm up stays, not stretched to the run", withRun.kind === "match" && withRun.id === "s1", JSON.stringify(withRun));
  const alone = sleepAction(split, [first], now);
  ok("a split night with only the first part logged isn't stretched to 8:30", alone.kind === "match", JSON.stringify(alone));
  const over = sleepAction(split, [{ ...first, started_at: "2026-10-19T04:00:00Z", ended_at: "2026-10-19T14:30:00Z" }], now);
  ok("on a split night an entry still shrinks to the watch", over.kind === "fix" && over.start === "2026-10-19T04:30:00.000Z" && over.end === "2026-10-19T14:30:00.000Z", JSON.stringify(over));
  ok("an hour awake makes a night split", upInTheNight(split, [], now.getTime()));
  ok("so does a hole in the stages the watch doesn't call awake", upInTheNight({ start: "2026-10-31T04:40:00Z", end: "2026-10-31T11:20:00Z", asleep: 300, awake: 10 }, [], now.getTime()));

  const night = { start: new Date("2026-10-31T04:40:00Z"), end: new Date("2026-10-31T10:30:00Z"), asleep: 340, awake: 10, bedStart: null };
  const later = new Date("2026-10-31T14:00:00Z");
  const hand = { id: "h", category: "Sleep", tags: ["Sleep"], started_at: "2026-10-31T04:40:00Z", ended_at: "2026-10-31T10:00:00Z", is_nap: false, source: null, watch_fixed_at: null };
  ok("a plain night isn't split", !upInTheNight(night, [hand], later.getTime()));
  const grow = sleepAction(night, [hand], later);
  ok("a plain night can grow an entry by up to 45 minutes", grow.kind === "fix" && grow.end === "2026-10-31T10:30:00.000Z", JSON.stringify(grow));
  const far = sleepAction(night, [{ ...hand, started_at: "2026-10-31T05:45:00Z", ended_at: "2026-10-31T10:45:00Z" }], later);
  ok("a side that would grow more than 45 minutes keeps your time; the other side still moves", far.kind === "fix" && far.start === "2026-10-31T05:45:00.000Z" && far.end === "2026-10-31T10:30:00.000Z", JSON.stringify(far));
  const study = { id: "st", category: "Study", tags: ["Study"], started_at: "2026-10-31T08:10:00Z", ended_at: "2026-10-31T08:50:00Z" };
  const upped = sleepAction(night, [{ ...hand, ended_at: "2026-10-31T08:00:00Z" }, study], later);
  ok("something else logged inside the night keeps the entry from growing", upped.kind === "match", JSON.stringify(upped));
  const reading = { id: "r", category: "Reading", tags: ["Reading"], started_at: "2026-10-31T04:00:00Z", ended_at: "2026-10-31T04:43:00Z" };
  ok("a few minutes' overlap at the edge doesn't count as up in the night", !upInTheNight(night, [reading], later.getTime()));

  const timer = { ...hand, started_at: "2026-10-31T04:20:00Z", ended_at: null };
  const ended = sleepAction(night, [timer], later);
  ok("a running Sleep timer ends and starts at the watch's bedtime in one step", ended.kind === "end" && ended.at === "2026-10-31T10:30:00.000Z" && ended.start === "2026-10-31T04:40:00.000Z", JSON.stringify(ended));
  ok("within 5 minutes its start stays", sleepAction(night, [{ ...timer, started_at: "2026-10-31T04:37:00Z" }], later).start === null);
  ok("and a bedtime more than 45 minutes before your tap isn't taken", sleepAction(night, [{ ...timer, started_at: "2026-10-31T05:50:00Z" }], later).start === null);
  ok("an earlier timer just before it keeps the start from running into it", sleepAction({ ...night, bedStart: new Date("2026-10-31T04:10:00Z") }, [{ ...timer, started_at: "2026-10-31T04:30:00Z" }, { id: "p", category: "Prep", tags: ["Prep"], started_at: "2026-10-31T04:00:00Z", ended_at: "2026-10-31T04:25:00Z" }], later).start === "2026-10-31T04:25:00.000Z");
  // The watch ends it at 4:30 and stamps it; he moves the times in the
  // check-in; the next send has the same night and leaves his times alone.
  const edited = { ...timer, started_at: "2026-10-31T04:15:00Z", ended_at: "2026-10-31T10:20:00Z", watch_fixed_at: "2026-10-31T12:45:00Z" };
  ok("a check-in edit after the watch ended the timer survives the next send", sleepAction(night, [edited], new Date("2026-10-31T14:00:00Z")).kind === "skip");
  const watchFn = readFileSync(new URL("../supabase/functions/watch/index.ts", import.meta.url), "utf8");
  const endFn = watchFn.slice(watchFn.indexOf("async function endSleep"), watchFn.indexOf("async function stampChecked"));
  ok("ending a Sleep timer stamps it in the same update", /ended_at: at, ended_by: "stop", watch_fixed_at: new Date\(\)\.toISOString\(\)/.test(endFn), endFn.slice(0, 200));
  ok("only his own row, only while it's still running", /\.eq\("user_id", userId\)\.is\("ended_at", null\)/.test(endFn));
  ok("a moved start keeps his beside it, and only lands if it's still where it was read", /hand_started_at: old\.started_at/.test(endFn) && /q\.eq\("started_at", old\.started_at\)/.test(endFn));
  ok("the import ends timers through it", /act\.kind === "end"\) \{\s*if \(await endSleep\(/.test(watchFn));

  const walk = { external_id: "walk", started_at: "2026-10-18T16:05:00.000Z", ended_at: "2026-10-18T16:50:00.000Z" };
  const hike = { id: "hike", category: "Exercise", tags: ["Exercise", "Minister"], started_at: "2026-10-18T15:58:35Z", ended_at: "2026-10-18T20:58:35Z", watch_fixed_at: null };
  const onHike = workoutAction(walk, [hike], [walk]);
  ok("a five-hour hike tagged Minister holding a 45-minute walk is only linked", onHike.kind === "link" && onHike.id === "hike" && !onHike.fix && !onHike.match, JSON.stringify(onHike));
  const pickleball = { external_id: "pb", started_at: "2026-10-25T02:00:00.000Z", ended_at: "2026-10-25T03:00:00.000Z" };
  const dateNight = { id: "date", category: "Date", tags: ["Date", "Exercise"], started_at: "2026-10-25T01:30:00Z", ended_at: "2026-10-25T03:52:30Z", watch_fixed_at: null };
  const onDate = workoutAction(pickleball, [dateNight], [pickleball]);
  ok("a date that was also exercise is only linked", onDate.kind === "link" && !onDate.fix && !onDate.match, JSON.stringify(onDate));
  const run = { external_id: "run", started_at: "2026-10-30T12:30:00.000Z", ended_at: "2026-10-30T13:00:00.000Z" };
  const gym = { id: "gym", category: "Exercise", tags: ["Exercise"], started_at: "2026-10-30T12:00:00Z", ended_at: "2026-10-30T13:30:00Z", watch_fixed_at: null };
  const onGym = workoutAction(run, [gym], [run]);
  ok("a 90-minute gym entry holding a 30-minute run is only linked", onGym.kind === "link" && !onGym.fix && !onGym.match, JSON.stringify(onGym));
  ok("a mixed entry with the workout's times isn't stamped as the watch's", !workoutAction(walk, [{ ...hike, started_at: "2026-10-18T16:04:00Z", ended_at: "2026-10-18T16:51:00Z" }], [walk]).match);
  const left = { external_id: "left", started_at: "2026-10-30T12:00:00.000Z", ended_at: "2026-10-30T13:10:00.000Z" };
  ok("a workout left running 40 minutes past your entry doesn't drag it along", !workoutAction(left, [{ ...gym, ended_at: "2026-10-30T12:30:00Z" }], [left]).fix);
  ok("an entry that is the workout still takes its times", plainlyTheWorkout({ ...gym, tags: ["Exercise"], ended_at: "2026-10-30T13:05:00Z", started_at: "2026-10-30T12:25:00Z" }, run, { start: Date.parse(run.started_at), end: Date.parse(run.ended_at) }));
  ok("one with no tags but Exercise as its category counts", plainlyTheWorkout({ id: "n", category: "Exercise", tags: null, started_at: run.started_at, ended_at: run.ended_at }, run, { start: Date.parse(run.started_at), end: Date.parse(run.ended_at) }));

  const today = { date: "2026-11-02", asleep_min: 412, woke_at: "2026-11-02T11:41:00Z", resting_hr: 54 };
  ok("the watch's sleep reads one way", watchSlept(today) === "6h 52m" && watchSlept({ asleep_min: 0 }) === null && watchSlept(null) === null);
  ok("the Minutes row and the check-in's line use the same number", minutesWatchParts(today, null, null)[0].value === watchSlept(today) && morningWatchLine(today).includes(watchSlept(today)));
  const quiet = minutesWatchParts(today, null, 52, { night: false });
  ok("while the check-in is up, the Minutes row leaves out Slept and Up", quiet.map((p) => p.label).join(",") === "Resting HR", JSON.stringify(quiet));
  ok("after it, they're back", minutesWatch([today], "2026-11-02").map((p) => p.label).join(",") === "Slept,Up,Resting HR" && minutesWatch([today], "2026-11-02", { night: false }).length === 1);
  const checkinSrc = readFileSync(new URL("../src/components/today/MorningCheckin.jsx", import.meta.url), "utf8");
  ok("the check-in's one line says the watch's sleep the Minutes way", /if \(slept\) parts\.push\(`slept \$\{slept\}`\);\s*else if \(plan\.woke_at && plan\.lights_out_at\)/.test(checkinSrc) && /slept=\{data\.watchSlept\}/.test(checkinSrc));
  const glanceSrc = readFileSync(new URL("../src/components/today/MinutesGlance.jsx", import.meta.url), "utf8");
  ok("the Minutes row follows whether the check-in shows the night", /checkinOnPage \? shown \?\? isMorning\(\) : false/.test(glanceSrc) && /minutesWatch\(data, date, \{ night \}\)/.test(glanceSrc));
}

{
  console.log("\ntoday's plan: notes from Quests over their tasks");
  const D = "2026-11-02";
  const at = (h, m = 0) => h * 60 + m;
  const chunks = [
    { id: "c1", start_time: "08:00:00", end_time: "10:00:00", title: "Plugin", quest_id: "q1", camp_id: null },
    { id: "c2", start_time: "10:00:00", end_time: "12:00:00", title: "Multicam", quest_id: "q1", camp_id: "k1" },
  ];
  const line = (id, fields) => ({ id, quest_id: "q1", parent_id: null, kind: "task", text: id, day: D, ongoing: false, today_on: null, done_on: null, position: 0, ...fields });
  const step = (id, fields) => ({ id, camp_id: "k1", section_id: null, parent_id: null, kind: "task", text: id, today_on: null, done_on: null, position: 0, ...fields });
  const work = {
    quests: [{ id: "q1", title: "Plugin", status: "on", position: 0 }],
    camps: [
      { id: "k1", quest_id: "q1", title: "Multicam", position: 0 },
      { id: "k2", quest_id: "q1", title: "Audio", position: 1 },
    ],
    sections: [{ id: "sA", camp_id: "k2", title: "Mixer", today_on: D, position: 0 }],
    lines: [
      // picked for today from the ongoing list, its tasks left where they were
      line("m1", { kind: "note", text: "Meeting with the team", day: "2026-10-26", ongoing: true, today_on: D }),
      line("m1a", { parent_id: "m1", day: "2026-10-26", ongoing: true }),
      line("m1b", { parent_id: "m1", day: "2026-10-26", ongoing: true, done_on: D, position: 1 }),
      line("m1c", { parent_id: "m1", kind: "note", text: "Sam ran it", day: "2026-10-26", ongoing: true, position: 2 }),
      // written on today's own list
      line("m2", { kind: "note", text: "Ideas from the call", position: 1 }),
      line("m2a", { parent_id: "m2" }),
      line("m3", { kind: "note", text: "Just a thought", position: 2 }),
      // not on today, though a task under it carries today's day
      line("m4", { kind: "note", text: "Old note", day: "2026-10-20", ongoing: true, position: 3 }),
      line("m4a", { parent_id: "m4" }),
      line("m5a", { parent_id: "gone" }),
    ],
    steps: [
      // a note step picked on its own, with steps under it
      step("n1", { kind: "note", text: "Camera checklist", today_on: D }),
      step("n1a", { parent_id: "n1" }),
      step("n1b", { parent_id: "n1", position: 1 }),
      // a picked task step with a note under it, and a task under that
      step("t1", { text: "Rig the cameras", today_on: D, position: 1 }),
      step("t1n", { parent_id: "t1", kind: "note", text: "How it went" }),
      step("t1na", { parent_id: "t1n", text: "Order a second clamp" }),
      // notes in a section picked for today
      step("n2", { camp_id: "k2", section_id: "sA", kind: "note", text: "Mixer notes" }),
      step("n2a", { camp_id: "k2", section_id: "sA", parent_id: "n2" }),
      step("n3", { camp_id: "k2", section_id: "sA", kind: "note", text: "Finished last week", position: 1 }),
      step("n3a", { camp_id: "k2", section_id: "sA", parent_id: "n3", done_on: "2026-10-29" }),
    ],
  };
  const ids = (items) => items.map((i) => i.id);
  const everyId = (p) => {
    const walk = (items) => items.flatMap((i) => [i.id, ...walk(i.subs)]);
    return [...p.blocks.flatMap((b) => walk(b.items)), ...walk(p.loose.planned), ...p.loose.quests.flatMap((g) => walk(g.items))];
  };
  const p = planForToday({ chunks, tasks: [], questWork: work, nowMin: at(9), date: D });
  const c1 = p.blocks.find((b) => b.id === "c1");
  const c2 = p.blocks.find((b) => b.id === "c2");
  const find = (block, id) => block.items.find((i) => i.id === id);

  const m1 = find(c1, "m1");
  ok("a note picked for today heads its tasks, in the quest's block", m1?.heading === true && ids(m1.subs).join() === "m1a,m1b", JSON.stringify(m1));
  ok("the note has no box to tick; the tasks under it do", m1?.done === false && m1.subs.every((s) => s.kind === "line" && !s.heading) && m1.subs[1]?.done === true, JSON.stringify(m1?.subs));
  ok("the note says which quest it's from", m1?.from === "Plugin");
  ok("a note under the note is words, not a thing to do", !everyId(p).includes("m1c"), JSON.stringify(everyId(p)));
  const m2 = find(c1, "m2");
  ok("a note written on today's own list heads its tasks too", m2?.heading === true && ids(m2.subs).join() === "m2a", JSON.stringify(m2));
  ok("a note with nothing to tick under it stays on Quests", !everyId(p).includes("m3"));
  ok("tasks under a note that isn't on today stay off it, as any sub-task does", !everyId(p).includes("m4") && !everyId(p).includes("m4a") && !everyId(p).includes("m5a"), JSON.stringify(everyId(p)));

  const n1 = find(c2, "n1");
  ok("a note step picked on its own heads its steps, in its camp's block", n1?.heading === true && ids(n1.subs).join() === "n1a,n1b" && n1.subs.every((s) => s.kind === "step"), JSON.stringify(n1));
  ok("the tasks under a note further down come up under the step above it", ids(find(c2, "t1")?.subs ?? []).join() === "t1na" && !everyId(p).includes("t1n"), JSON.stringify(find(c2, "t1")));
  const n2 = find(c1, "n2");
  ok("a note in a section picked for today heads its steps, shown once", n2?.heading === true && ids(n2.subs).join() === "n2a" && everyId(p).filter((x) => x === "n2a").length === 1, JSON.stringify(everyId(p)));
  ok("a note in a picked section whose steps were all done before today is left out", !everyId(p).includes("n3") && !everyId(p).includes("n3a"));
  ok("a note takes its place in the quests' order, like a task there", ids(questItemsForToday(work, D)).join() === "n1,t1,n2,m1,m2", JSON.stringify(ids(questItemsForToday(work, D))));

  ok("a block counts the tasks under a note, not the note", c1.done === 1 && c1.total === 4 && c2.done === 0 && c2.total === 4, JSON.stringify([c1.done, c1.total, c2.done, c2.total]));
  ok("a count leaves a heading out", JSON.stringify(tallyItems([{ heading: true, done: false, subs: [{ done: true, subs: [] }, { done: false, subs: [] }] }])) === JSON.stringify({ done: 1, total: 2 }));
  const bare = planForToday({ chunks: [], tasks: [], questWork: work, nowMin: at(9), date: D });
  ok("with no block for it, a note and its tasks wait in the quest's group", bare.loose.quests.length === 1 && bare.loose.quests[0].items.some((i) => i.id === "m1" && i.heading && i.subs.length === 2), JSON.stringify(bare.loose.quests));
  const iso = "2026-11-02T18:00:00.000Z";
  const ticked = withFields({ tasks: [], work }, "line", "m1a", doneFields("line", true, D, iso));
  ok("a tick under a note shows before it's saved", find(planForToday({ chunks, tasks: [], questWork: ticked.work, nowMin: at(9), date: D }).blocks.find((b) => b.id === "c1"), "m1")?.subs[0]?.done === true);
}

{
  console.log("\na focus's half-written note and a deleted note outlive the sheet");
  // FocusSheet.jsx is a component, so it's built here with what it takes from
  // React, the page and the database swapped for stand-ins, and only its own
  // small helpers are run. Each stand-in hands its calls to `standIns`, so a
  // test can say what "the database" answers.
  const { build } = await import("esbuild");
  const sheetPath = fileURLToPath(new URL("../src/components/focus/FocusSheet.jsx", import.meta.url));
  const sheetSrc = readFileSync(sheetPath, "utf8");
  const standIns = (globalThis.__focusSheetStandIns = {});
  const keepReal = /\/lib\/(focus|planDates)$/;
  const built = await build({
    entryPoints: [sheetPath],
    bundle: true,
    write: false,
    format: "esm",
    jsx: "transform",
    logLevel: "silent",
    plugins: [
      {
        name: "stand-ins",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => (a.importer === sheetPath && !keepReal.test(a.path) ? { path: a.path, namespace: "stand-in" } : undefined));
          b.onLoad({ filter: /.*/, namespace: "stand-in" }, (a) => {
            const from = a.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const clause = sheetSrc.match(new RegExp(`^import (.+) from "${from}";$`, "m"))?.[1] ?? "";
            const names = (clause.match(/\{([^}]*)\}/)?.[1] ?? "").split(",").map((n) => n.trim()).filter(Boolean);
            const lines = names.map((n) => `export const ${n} = (...a) => globalThis.__focusSheetStandIns[${JSON.stringify(n)}]?.(...a);`);
            return { contents: [...lines, "export default () => null;"].join("\n"), loader: "js" };
          });
        },
      },
    ],
  });
  const { readDraft, keepDraft, dropSavedDraft, loadNotes, deleteLater, onNoteBack } = await import(
    `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`
  );
  const phone = (init = {}) => {
    const m = new Map(Object.entries(init));
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
  };
  const key = (id) => `hub.focus-note-draft.${id}`;

  // Tap Save, then close the sheet before the note has saved.
  const s1 = phone();
  keepDraft("g", "Phone in the kitchen", s1);
  dropSavedDraft("g", "Phone in the kitchen", s1);
  ok("a saved note's kept copy goes, even when the sheet closed while it saved", s1.getItem(key("g")) === null);
  keepDraft("g", "Phone in the kitchen. And the alarm", s1);
  dropSavedDraft("g", "Phone in the kitchen", s1);
  ok("what you typed after tapping Save is still kept", s1.getItem(key("g")) === "Phone in the kitchen. And the alarm");
  keepDraft("g", "  \n", s1);
  ok("an emptied box keeps nothing", s1.getItem(key("g")) === null);
  ok(
    "saving clears the kept copy itself and leaves newer typing in the box",
    /await saveNote\(userId, \{ goalId: goal\.id, date, sent: draft \}\)/.test(sheetSrc) &&
      /dropSavedDraft\(goalId, sent, store\)/.test(sheetSrc) &&
      /setDraft\(\(cur\) => draftAfterSave\(cur, sent, Boolean\(row\)\)\)/.test(sheetSrc) &&
      !/setDraft\(""\)/.test(sheetSrc)
  );

  // Saturday's half-written note, after the focus is kept on Sunday.
  const kept = { id: "new", carried_from: "old" };
  const s2 = phone({ [key("old")]: "Half a note from Saturday" });
  ok("a draft left last week opens under the focus kept into this week", readDraft(kept, s2) === "Half a note from Saturday");
  ok("it moves across, so last week's copy doesn't linger", s2.getItem(key("new")) === "Half a note from Saturday" && s2.getItem(key("old")) === null);
  ok("and it's still there the next time", readDraft(kept, s2) === "Half a note from Saturday");
  const s3 = phone({ [key("new")]: "this week's", [key("old")]: "last week's" });
  ok("this week's own draft comes first", readDraft(kept, s3) === "this week's");
  ok("a focus set fresh this week only has its own", readDraft({ id: "fresh", carried_from: null }, phone({ [key("old")]: "x" })) === "");
  const off = { getItem: () => { throw new Error("off"); }, setItem: () => { throw new Error("off"); }, removeItem: () => { throw new Error("off"); } };
  keepDraft("g", "x", off);
  dropSavedDraft("g", "x", off);
  ok("storage turned off just means no draft", readDraft(kept, off) === "");
  ok("the sheet reads its draft from the whole goal row, carried_from and all", /useState\(\(\) => readDraft\(goal\)\)/.test(sheetSrc));

  // Delete a note, close the sheet, open it again inside the 6 seconds.
  const n1 = { id: "n1", goal_id: "w2", date: "2026-11-01", text: "Phone in the kitchen", created_at: "2026-11-01T12:00:00Z" };
  const n2 = { id: "n2", goal_id: "w1", date: "2026-10-28", text: "Lights out by 9:30", created_at: "2026-10-28T13:00:00Z" };
  let inDb = [n1, n2];
  const deleted = [];
  standIns.fetchFocusLineage = async () => [{ id: "w2", carried_from: "w1" }, { id: "w1", carried_from: null }];
  standIns.fetchFocusNotes = async (_, ids) => inDb.filter((n) => ids.includes(n.goal_id));
  standIns.deleteFocusNote = async (id) => {
    deleted.push(id);
    inDb = inDb.filter((n) => n.id !== id);
  };
  const shown = async () => (await loadNotes("u", "w2")).notes.map((n) => n.id).join();
  ok("both weeks' notes load, newest first", (await shown()) === "n1,n2");
  const first = deleteLater(n1);
  ok("a note deleted a moment ago stays gone when the sheet is opened again", (await shown()) === "n2" && deleted.length === 0);
  // A sheet opened near the end of the 6 seconds: the database reads its list
  // while the note is still there, the delete goes through, then the list arrives.
  const readEarly = inDb;
  const fetchNotes = standIns.fetchFocusNotes;
  let answer;
  standIns.fetchFocusNotes = () => new Promise((r) => (answer = () => r(readEarly)));
  const late = loadNotes("u", "w2");
  await first.run();
  await new Promise((r) => setTimeout(r));
  answer();
  const lateIds = (await late).notes.map((n) => n.id).join();
  standIns.fetchFocusNotes = fetchNotes;
  ok("once Undo has gone it's deleted for real", deleted.join() === "n1" && (await shown()) === "n2");
  ok("a list read just before the delete went through, arriving after it, still leaves the note out", lateIds === "n2", lateIds);
  inDb = [n1, n2];
  ok("a note deleted for real never comes back in a list, however late it was read", (await shown()) === "n2");
  inDb = [n2];

  const back = [];
  const stop = onNoteBack((note) => back.push(note.id));
  const second = deleteLater(n2);
  ok("hidden while Undo is offered", (await shown()) === "");
  second.onUndo();
  ok("Undo reaches the sheet on screen, even one opened after the delete", back.join() === "n2");
  ok("and a sheet opened after Undo shows the note again", (await shown()) === "n2");
  stop();
  deleteLater(n1).onUndo();
  ok("a closed sheet hears nothing", back.join() === "n2");
  standIns.deleteFocusNote = async () => {
    throw new Error("offline");
  };
  const third = deleteLater(n2);
  const hiddenFirst = (await shown()) === "";
  const failed = await third.run().then(() => false, () => true);
  ok("a delete that fails lets the note show again", hiddenFirst && failed && (await shown()) === "n2");
  ok("the sheet deletes through deleteLater and listens for Undo", /toast\.undoable\(\{ message: "Note deleted", \.\.\.deleteLater\(note\) \}\)/.test(sheetSrc) && /onNoteBack\(putBack\)/.test(sheetSrc));
  delete globalThis.__focusSheetStandIns;

  // The strip's titles: whole goals on a phone at 390, and on a desk.
  const css = readFileSync(new URL("../src/styles/focus.css", import.meta.url), "utf8");
  const gap = Number(css.match(/--focus-gap: (\d+)px;/)?.[1]);
  const pad = Number(css.match(/\.focus-strip__row \{ margin: 0 -14px; padding: 2px (\d+)px 4px;/)?.[1]);
  const cell = (390 - 2 * pad - 4 * gap) / 5;
  // 68px is what "Time developing artistic ability" needs for three lines at 10.5px, measured in the app's font.
  ok("five across at 390 leave each title room for three lines of its words", cell >= 68 && /font-size: 10\.5px;/.test(css), `${cell}px`);
  const title = css.slice(css.indexOf(".focus-strip__title {"));
  ok("titles get three lines, not two", /-webkit-line-clamp: 3;/.test(title) && !/-webkit-line-clamp: 2;/.test(title));
  const least = Number(css.match(/repeat\(auto-fill, minmax\((\d+)px, 1fr\)\)/)?.[1]);
  const deskGap = Number(css.match(/gap: 10px (\d+)px;/)?.[1]);
  ok("five fit across the narrowest desk column (613px at 901 wide), each wider than the old 88px", least > 88 && 5 * least + 4 * deskGap <= 613, `${least}px`);
}

{
  console.log("\ntoday's plan: a tick holds until a load reads it back");
  const D = "2026-11-02";
  const iso = "2026-11-02T18:00:00.000Z";
  const chunks = [{ id: "c1", start_time: "08:00:00", end_time: "10:00:00", title: "Plugin", quest_id: "q1", camp_id: null }];
  const tasks = [
    { id: "t1", title: "Email Sam", status: false, time_chunk_id: "c1", parent_task_id: null, position: 0 },
    { id: "t2", title: "Book the room", status: false, time_chunk_id: "c1", parent_task_id: null, position: 1 },
  ];
  const line = (id, fields) => ({ id, quest_id: "q1", parent_id: null, kind: "task", text: id, day: D, ongoing: false, today_on: null, done_on: null, position: 0, ...fields });
  const work = {
    quests: [{ id: "q1", title: "Plugin", status: "on", position: 0 }],
    camps: [],
    sections: [],
    steps: [],
    lines: [line("n1", { kind: "note", text: "Meeting with the team" }), line("n1a", { parent_id: "n1" }), line("n1b", { parent_id: "n1", position: 1 })],
  };
  const loaded = (startedAt, rows = tasks) => ({ tasks: rows, work, startedAt });
  const tick = (kind, id, done, savedAt) => [`${kind}:${id}`, { kind, id, fields: doneFields(kind, done, D, iso), savedAt }];
  const status = (data, id) => data.tasks.find((t) => t.id === id).status;
  const lineDone = (data, id) => data.work.lines.find((l) => l.id === id).done_on;

  const out = new Map([tick("task", "t1", true, null)]);
  const whileOut = applyOverrides(loaded(500), out);
  ok("a tick shows while its save is out, even over a load that began after it", status(whileOut.data, "t1") === true && whileOut.keep.has("task:t1"));
  ok("with nothing loaded yet, a tick waits for the load", (() => {
    const r = applyOverrides(undefined, out);
    return r.data === undefined && r.keep.size === 1;
  })());

  const landed = new Map([tick("task", "t1", true, 100)]);
  const early = applyOverrides(loaded(90), landed);
  ok("a load that began before the save landed can't undo the tick", status(early.data, "t1") === true && early.keep.has("task:t1"));
  ok("a load that began the moment the save landed keeps it too", applyOverrides(loaded(100), landed).keep.has("task:t1"));

  // Since that load the row was unticked somewhere else (on another phone,
  // say): the load is right and the old tick mustn't cover it.
  const late = applyOverrides(loaded(150), landed);
  ok("a load that began after the save landed shows the row as loaded, and the tick goes", status(late.data, "t1") === false && late.keep.size === 0);
  ok("one that read the tick back shows it ticked", status(applyOverrides(loaded(150, [{ ...tasks[0], status: true }, tasks[1]]), landed).data, "t1") === true);

  const many = new Map([tick("task", "t1", true, 100), tick("line", "n1a", true, null), tick("task", "t2", true, 200)]);
  const each = applyOverrides(loaded(150), many);
  ok(
    "each row's tick is judged on its own",
    status(each.data, "t1") === false && status(each.data, "t2") === true && lineDone(each.data, "n1a") === D && lineDone(each.data, "n1b") === null && [...each.keep.keys()].join() === "line:n1a,task:t2",
    JSON.stringify([...each.keep.keys()])
  );
  ok("ticks leave what was loaded as it was, and keep when its load began", tasks[1].status === false && work.lines[1].done_on === null && each.data.startedAt === 150);
  ok("a tick on a task under a note shows in its block", (() => {
    const c1 = planForToday({ chunks, tasks: each.data.tasks, questWork: each.data.work, nowMin: 9 * 60, date: D }).blocks.find((b) => b.id === "c1");
    const note = c1.items.find((i) => i.id === "n1");
    return note?.heading === true && note.subs[0].done === true && note.subs[1].done === false && c1.done === 2 && c1.total === 4;
  })());
  ok("an untick holds the same way", (() => {
    const r = applyOverrides(loaded(90, [{ ...tasks[0], status: true }, tasks[1]]), new Map([tick("task", "t1", false, 100)]));
    return status(r.data, "t1") === false && r.data.tasks[0].completed_at === null;
  })());
}

{
  console.log("\na focus note still saving when its sheet opens again, and whole titles on a 375 phone");
  // Built the same way as the block above (the same bundle, so the same
  // module and its sets), with only the database and storage stood in for.
  const { build } = await import("esbuild");
  const sheetPath = fileURLToPath(new URL("../src/components/focus/FocusSheet.jsx", import.meta.url));
  const sheetSrc = readFileSync(sheetPath, "utf8");
  const standIns = (globalThis.__focusSheetStandIns = {});
  const keepReal = /\/lib\/(focus|planDates)$/;
  const built = await build({
    entryPoints: [sheetPath],
    bundle: true,
    write: false,
    format: "esm",
    jsx: "transform",
    logLevel: "silent",
    plugins: [
      {
        name: "stand-ins",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => (a.importer === sheetPath && !keepReal.test(a.path) ? { path: a.path, namespace: "stand-in" } : undefined));
          b.onLoad({ filter: /.*/, namespace: "stand-in" }, (a) => {
            const from = a.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const clause = sheetSrc.match(new RegExp(`^import (.+) from "${from}";$`, "m"))?.[1] ?? "";
            const names = (clause.match(/\{([^}]*)\}/)?.[1] ?? "").split(",").map((n) => n.trim()).filter(Boolean);
            const lines = names.map((n) => `export const ${n} = (...a) => globalThis.__focusSheetStandIns[${JSON.stringify(n)}]?.(...a);`);
            return { contents: [...lines, "export default () => null;"].join("\n"), loader: "js" };
          });
        },
      },
    ],
  });
  const { readDraft, keepDraft, saveNote, onNoteLanded, withNote, draftAfterSave } = await import(
    `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`
  );
  const phone = (init = {}) => {
    const m = new Map(Object.entries(init));
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
  };
  const key = (id) => `hub.focus-note-draft.${id}`;
  // The database holds each insert until the test lets it land, or fail.
  const inserts = [];
  standIns.addFocusNote = (_, n) =>
    new Promise((resolve, reject) => {
      const row = { id: `s${inserts.length}`, goal_id: n.goalId, date: n.date, text: n.text, created_at: `2026-11-02T18:0${inserts.length}:00Z` };
      inserts.push({ n, land: () => resolve(row), fail: () => reject(new Error("offline")) });
    });
  const heard = [];
  const stopHearing = onNoteLanded((e) => heard.push(e));
  const D = "2026-11-02";

  // Tap Save, swipe the sheet closed, open it again before the note lands.
  const lunch = "Packed lunch the night before";
  const s1 = phone();
  keepDraft("g5", lunch, s1);
  const saving = saveNote("u", { goalId: "g5", date: D, sent: lunch }, s1);
  ok("a sheet opened while its note is saving leaves that note out of the box, so it can't be saved twice", readDraft({ id: "g5" }, s1) === "");
  ok("the phone's copy is kept until it lands, in case it doesn't", s1.getItem(key("g5")) === lunch);
  ok("newer typing in the box is read as usual meanwhile", readDraft({ id: "g5" }, phone({ [key("g5")]: lunch + ". And water" })) === lunch + ". And water");
  ok("another focus's draft is read as usual meanwhile", readDraft({ id: "g2" }, phone({ [key("g2")]: lunch })) === lunch);
  keepDraft("g5", "", s1); // the reopened sheet's empty box
  inserts[0].land();
  const row = await saving;
  ok("when it lands, every sheet on screen hears which focus, what was sent and the saved note", heard.length === 1 && heard[0].goalId === "g5" && heard[0].sent === lunch && heard[0].row === row && row.text === lunch, JSON.stringify(heard));
  keepDraft("g5", lunch, s1);
  ok("after it lands the same words typed again are a draft like any other", readDraft({ id: "g5" }, s1) === lunch);
  keepDraft("g5", "", s1);

  const s2 = phone();
  keepDraft("g5", "Fruit for dessert", s2);
  const quiet = saveNote("u", { goalId: "g5", date: D, sent: "Fruit for dessert" }, s2);
  inserts[1].land();
  await quiet;
  ok("a note that saves with no sheet open leaves no copy behind", s2.getItem(key("g5")) === null);

  // It doesn't save, after a sheet opened meanwhile emptied the box.
  const s3 = phone();
  keepDraft("g5", "Walk after dinner", s3);
  const failing = saveNote("u", { goalId: "g5", date: D, sent: "Walk after dinner" }, s3);
  keepDraft("g5", "", s3);
  inserts[2].fail();
  const threw = await failing.then(() => false, () => true);
  ok("a note that doesn't save is a draft again, even after a sheet opened meanwhile emptied the box", threw && readDraft({ id: "g5" }, s3) === "Walk after dinner");
  ok("and the sheets on screen hear it didn't", heard.at(-1).row === null && heard.at(-1).sent === "Walk after dinner");
  const s4 = phone();
  keepDraft("g5", "Walk after dinner", s4);
  const failing2 = saveNote("u", { goalId: "g5", date: D, sent: "Walk after dinner" }, s4);
  keepDraft("g5", "Stretch before bed", s4);
  inserts[3].fail();
  await failing2.catch(() => {});
  ok("and keeps what's been typed since, under the note that didn't save", s4.getItem(key("g5")) === "Walk after dinner\n\nStretch before bed", s4.getItem(key("g5")));

  // Two notes on their way for the same focus.
  const s5 = phone();
  const one = saveNote("u", { goalId: "g7", date: D, sent: "One" }, s5);
  const two = saveNote("u", { goalId: "g7", date: D, sent: "Two" }, s5);
  keepDraft("g7", "Two", s5);
  inserts[4].land();
  await one;
  ok("with two notes saving, the first landing doesn't let the second back into the box", readDraft({ id: "g7" }, s5) === "");
  inserts[5].land();
  await two;
  ok("and once both have landed nothing is left behind", s5.getItem(key("g7")) === null);
  stopHearing();
  const before = heard.length;
  const after = saveNote("u", { goalId: "g7", date: D, sent: "Three" }, phone());
  inserts[6].land();
  await after;
  ok("a closed sheet hears nothing", heard.length === before);
  delete globalThis.__focusSheetStandIns;

  // What an open sheet does with it.
  const list = { chain: [{ id: "w2" }, { id: "w1" }], notes: [{ id: "old", goal_id: "w1", created_at: "2026-10-28T13:00:00Z" }] };
  const landed = { id: "s9", goal_id: "w2", date: D, text: lunch, created_at: "2026-11-02T18:00:00Z" };
  ok("the saved note goes to the top of the list in a sheet that opened before it landed", withNote(list, landed).notes.map((n) => n.id).join() === "s9,old");
  ok("a list read after it saved doesn't get it twice", withNote(withNote(list, landed), landed).notes.length === 2);
  ok("a note from another focus leaves the list alone", withNote(list, { ...landed, goal_id: "w9" }) === list);
  ok("with no list yet there's nothing to add it to", withNote(undefined, landed) === undefined);
  ok("a box still holding just what was sent empties when it lands", draftAfterSave(lunch, lunch, true) === "");
  ok("typing added after Save stays when it lands", draftAfterSave(lunch + ". And water", lunch, true) === lunch + ". And water");
  ok("a box left empty gets the note back when it doesn't save", draftAfterSave("", lunch, false) === lunch && draftAfterSave("  ", lunch, false) === lunch);
  ok("newer typing is kept, with the note that didn't save above it", draftAfterSave("Stretch", lunch, false) === `${lunch}\n\nStretch`);
  ok("a box that already holds the unsaved note isn't doubled", draftAfterSave(`${lunch}\n\nStretch`, lunch, false) === `${lunch}\n\nStretch`);
  ok(
    "every sheet on screen hears a note land, and one with nothing loaded yet reads its list again",
    /onNoteLanded\(\(\{ goalId, sent, row \}\) =>/.test(sheetSrc) && /if \(shown\.current\) putBack\(row\);\s*else reload\(\);/.test(sheetSrc) && /mutate\(\(d\) => withNote\(d, note\)\)/.test(sheetSrc)
  );

  // The strip's titles on the narrowest iPhones, and the "…" with room to spare.
  const css = readFileSync(new URL("../src/styles/focus.css", import.meta.url), "utf8");
  const gap = Number(css.match(/--focus-gap: (\d+)px;/)?.[1]);
  const pad = Number(css.match(/\.focus-strip__row \{ margin: 0 -14px; padding: 2px (\d+)px 4px;/)?.[1]);
  const narrow = css.match(/@media \(max-width: (\d+)px\) \{[^}]*\.focus-strip__title \{ font-size: ([\d.]+)px; \}/);
  const cell375 = (375 - 2 * pad - 4 * gap) / 5;
  // At 10px, "Time developing artistic ability" fits three lines in a 67px cell, measured in the app's font.
  ok(
    "375-wide iPhones get 10px titles, which fit the longest real goal in three lines; 390 keeps 10.5px",
    Boolean(narrow) && Number(narrow[1]) >= 375 && Number(narrow[1]) < 390 && Number(narrow[2]) === 10 && cell375 >= 67,
    JSON.stringify([narrow?.[1], narrow?.[2], cell375])
  );
  const title = css.slice(css.indexOf(".focus-strip__title {"));
  const bleed = Number(title.match(/margin-inline: -(\d+)px;/)?.[1]);
  const padIn = Number(title.match(/padding-inline: (\d+)px;/)?.[1]);
  const wider = Number(title.match(/max-width: calc\(100% \+ (\d+)px\);/)?.[1]);
  // Chrome's clamped "…" was measured up to 3px past the end of a line.
  ok(
    "the title box reaches a pixel past where a clamped \"…\" can sit, and not into the next cell",
    bleed === padIn && wider === 2 * bleed && bleed >= 3 + 1 && bleed <= gap,
    JSON.stringify({ bleed, padIn, wider, gap })
  );
}

{
  console.log("\nthe watch's night stays as it saw it, and says it once, in one word");
  // Stop and I'm up, against a stand-in database: api.js is bundled with its
  // Supabase client swapped for a PostgREST client whose fetch answers here.
  const apiPath = fileURLToPath(new URL("../src/lib/api.js", import.meta.url));
  const apiBuilt = await esbuildBundle({
    entryPoints: [apiPath],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    logLevel: "silent",
    plugins: [
      {
        name: "stand-in client",
        setup(b) {
          b.onResolve({ filter: /^\.\/supabaseClient$/ }, (a) => (a.importer === apiPath ? { path: "client", namespace: "stand-in" } : undefined));
          b.onLoad({ filter: /.*/, namespace: "stand-in" }, () => ({
            contents: `import { PostgrestClient } from "@supabase/postgrest-js";
export const supabase = new PostgrestClient("https://hub.test/rest/v1", { fetch: (...a) => globalThis.__hubFetch(...a) });`,
            loader: "js",
            resolveDir: fileURLToPath(new URL("../src/lib", import.meta.url)),
          }));
        },
      },
    ],
  });
  const api = await import(`data:text/javascript;base64,${Buffer.from(apiBuilt.outputFiles[0].text).toString("base64")}`);
  const sent = [];
  let updated = [];
  globalThis.__hubFetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    sent.push({ url: decodeURIComponent(String(url)), method, body });
    const rows = method === "PATCH" ? updated : method === "POST" ? [{ id: "started", ...body }] : [];
    const one = (new Headers(init.headers).get("Accept") ?? "").includes("vnd.pgrst.object");
    return new Response(JSON.stringify(one ? rows[0] ?? null : rows), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const lastPatch = () => [...sent].reverse().find((s) => s.method === "PATCH");

  // 4:47 the watch ends Sleep at 4:41 and stamps it; at 4:58 he taps I'm up
  // on the page he opened at 4:45.
  updated = [];
  const late = await api.stopTimeEntry("sleep").then((v) => v, (err) => err);
  ok("a stop only ends a timer that's still running", /ended_at=is\.null/.test(lastPatch()?.url ?? ""), lastPatch()?.url);
  ok("one that had already ended (the watch's wake time) is left, and the stop says null, not an error", late === null, String(late));
  updated = [{ id: "sleep", category: "Sleep", tags: ["Sleep"], started_at: "2026-11-02T04:30:00Z", ended_at: "2026-11-02T11:58:00Z" }];
  ok("a stop that lands hands back the entry", (await api.stopTimeEntry("sleep"))?.id === "sleep");
  const at = "2026-11-02T05:10:00.000Z";
  await api.stopTimeEntry("prep", { endedBy: "overnight_fix", at });
  ok("the runaway fix still sets the time you give, running or not", !/ended_at=is\.null/.test(lastPatch()?.url ?? "") && lastPatch()?.body?.ended_at === at && lastPatch()?.body?.ended_by === "overnight_fix", JSON.stringify(lastPatch()));
  updated = [];
  const bed = await api.goToBed("u", "gone").then((v) => v, (err) => err);
  ok("Going to bed after its timer already stopped still starts Sleep", bed?.id === "started" && bed?.category === "Sleep", String(bed?.message ?? JSON.stringify(bed)));
  const switched = await api.switchTimer("u", "gone", { categories: ["Waste"] }).then((v) => v, (err) => err);
  ok("switching from a timer that already stopped has nothing to ask about", switched?.stopped === null && switched?.started?.category === "Waste", JSON.stringify(switched));
  delete globalThis.__hubFetch;
  const glanceSrc = readFileSync(new URL("../src/components/today/MinutesGlance.jsx", import.meta.url), "utf8");
  ok("the Minutes card's Stop takes a null as already stopped", /if \(stopped && needsFollowUp\(stopped\)\) setFollowUp\(stopped\);\s*\/\/ Today \(and anything else open\) reloads on this, once\.\s*announceChange\(\);/.test(glanceSrc));
  const checkinSrc = readFileSync(new URL("../src/components/today/MorningCheckin.jsx", import.meta.url), "utf8");
  ok("I'm up reloads the night whether or not its stop landed", /await stopTimeEntry\(running\.id\);\s*announceChange\(\);\s*await Promise\.all\(\[reload\(\), onChanged\?\.\(\)\]\);/.test(checkinSrc));

  // The check-in reads the night again when you come back to the app.
  ok("the check-in reads the night again when you come back to the app", /const onShow = \(\) => document\.visibilityState === "visible" && reload\(\);/.test(checkinSrc) && /document\.addEventListener\("visibilitychange", onShow\)/.test(checkinSrc) && /document\.removeEventListener\("visibilitychange", onShow\)/.test(checkinSrc));

  // Slept and Up under the minutes, unless the check-in on the page says them.
  const todaySrc = readFileSync(new URL("../src/pages/Today.jsx", import.meta.url), "utf8");
  ok("Today tells the Minutes card whether the check-in is up, by the test it mounts it with", /\{userId && data && !runaway && <MorningCheckin /.test(todaySrc) && /<MinutesGlance [^>]*checkinOnPage=\{Boolean\(userId && data && !runaway\)\}/.test(todaySrc));
  ok("with no check-in on the page (a runaway asked about instead), the row says Slept and Up", /if \(!loaded\) return isMorning\(\);\s*return checkinOnPage \? shown \?\? isMorning\(\) : false;/.test(glanceSrc) && /const checkinShowsNight = useNightInCheckin\(loaded, checkinOnPage\);/.test(glanceSrc));
  const sheetPath = fileURLToPath(new URL("../src/components/today/MorningCheckin.jsx", import.meta.url));
  const keep = /\/lib\/(honest|planDates|watch)$|^\.\/minutes$/;
  const checkinBuilt = await esbuildBundle({
    entryPoints: [sheetPath],
    bundle: true,
    write: false,
    format: "esm",
    jsx: "transform",
    logLevel: "silent",
    plugins: [
      {
        name: "stand-ins",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => (a.importer === sheetPath && !keep.test(a.path) ? { path: a.path, namespace: "stand-in" } : undefined));
          b.onLoad({ filter: /.*/, namespace: "stand-in" }, (a) => {
            const from = a.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const names = (checkinSrc.match(new RegExp(`^import \\{([^}]*)\\} from "${from}";$`, "m"))?.[1] ?? "").split(",").map((n) => n.trim()).filter(Boolean);
            return { contents: [...names.map((n) => `export const ${n} = () => undefined;`), "export default () => null;"].join("\n"), loader: "js" };
          });
        },
      },
    ],
  });
  const { nightParts } = await import(`data:text/javascript;base64,${Buffer.from(checkinBuilt.outputFiles[0].text).toString("base64")}`);
  const woke = "2026-11-02T11:41:00Z";
  const lights = "2026-11-02T04:40:00Z";
  ok("the one line says Up and the watch's sleep", nightParts({ woke_at: woke, lights_out_at: lights }, "6h 52m").join(" · ").match(/^Up \S+.* · slept 6h 52m$/) !== null, nightParts({ woke_at: woke, lights_out_at: lights }, "6h 52m").join(" · "));
  ok("without the watch, lights-out to wake", nightParts({ woke_at: woke, lights_out_at: lights }, null)[1]?.endsWith("of sleep"));
  ok("the watch's sleep alone still counts as the night", nightParts({ woke_at: null, lights_out_at: lights }, "6h 52m").join() === "slept 6h 52m");
  ok("a line with neither Up nor sleep in it doesn't count as showing the night", nightParts({ woke_at: null, lights_out_at: lights }, null).length === 0 && nightParts({ woke_at: null, lights_out_at: null, sleep_quality: 4 }, null).length === 0);
  ok("a done check-in reports the night only when its line has it", /done && !editing \? nightParts\(dayPlan, data\.watchSlept\)\.length > 0/.test(checkinSrc) && /const parts = nightParts\(plan, slept\);/.test(checkinSrc));

  // One word for the watch's sleep.
  const day = { date: "2026-11-02", asleep_min: 412, deep_min: 51, rem_min: 80, sleep_end: "2026-11-02T11:41:00Z", woke_at: "2026-11-02T11:41:00Z", resting_hr: 54 };
  const formLine = morningWatchLine(day);
  ok("the check-in's form says slept, the way the rest do", /^Your watch: slept 6h 52m · /.test(formLine ?? "") && !/asleep/i.test(formLine ?? ""), formLine);
  ok(
    "Slept everywhere the watch's sleep shows: the form, the one line, the Minutes row, the evening",
    formLine.includes(`slept ${watchSlept(day)}`) &&
      nightParts({ woke_at: null }, watchSlept(day)).join() === `slept ${watchSlept(day)}` &&
      minutesWatchParts(day, null, null).some((p) => p.label === "Slept" && p.value === watchSlept(day)) &&
      eveningWatchParts(day, []).some((p) => p.label === "Slept" && p.value === watchSlept(day))
  );

  // Something logged over the edge of the night isn't up in the night.
  const night = { start: new Date("2026-10-31T04:40:00Z"), end: new Date("2026-10-31T12:10:00Z"), asleep: 430, awake: 20, bedStart: null };
  const now = new Date("2026-10-31T15:00:00Z");
  const hand = { id: "h", category: "Sleep", tags: ["Sleep"], started_at: "2026-10-31T05:00:00Z", ended_at: "2026-10-31T11:40:00Z", is_nap: false, source: null, watch_fixed_at: null };
  // Reading 21:30-22:50; the watch has him asleep at 22:40 (as he read) to 6:10.
  const reading = { id: "r", category: "Reading", tags: ["Reading"], started_at: "2026-10-31T03:30:00Z", ended_at: "2026-10-31T04:50:00Z" };
  ok("reading over the moment you fell asleep isn't up in the night", !upInTheNight(night, [hand, reading], now.getTime()));
  const read = sleepAction(night, [hand, reading], now);
  ok("so the entry still grows, back to where the reading ended and on to when you woke", read.kind === "fix" && read.start === "2026-10-31T04:50:00.000Z" && read.end === "2026-10-31T12:10:00.000Z", JSON.stringify(read));
  const scripture = { id: "sc", category: "Scripture", tags: ["Scripture"], started_at: "2026-10-31T11:55:00Z", ended_at: "2026-10-31T12:30:00Z" };
  ok("nor is something you started before the watch thinks you woke", !upInTheNight(night, [hand, scripture], now.getTime()));
  const morning = sleepAction(night, [hand, scripture], now);
  ok("and the end grows only to where it started", morning.kind === "fix" && morning.start === "2026-10-31T04:40:00.000Z" && morning.end === "2026-10-31T11:55:00.000Z", JSON.stringify(morning));
  const inside = { id: "in", category: "Study", tags: ["Study"], started_at: "2026-10-31T08:00:00Z", ended_at: "2026-10-31T08:30:00Z" };
  ok("something logged well inside the night is up in the night", upInTheNight(night, [hand, inside], now.getTime()));
  const held = sleepAction(night, [{ ...hand, ended_at: "2026-10-31T07:50:00Z" }, inside], now);
  ok("and then the entry doesn't grow on either side", held.kind === "match" && held.id === "h", JSON.stringify(held));
  ok("20 minutes in from each edge is still the edge", !upInTheNight(night, [{ ...inside, started_at: "2026-10-31T05:00:00Z", ended_at: "2026-10-31T05:30:00Z" }], now.getTime()) && !upInTheNight(night, [{ ...inside, started_at: "2026-10-31T11:20:00Z", ended_at: "2026-10-31T11:50:00Z" }], now.getTime()));

  // A send in the middle of the night carries only part of it.
  const timer = { id: "t", category: "Sleep", tags: ["Sleep"], started_at: "2026-10-31T04:30:00Z", ended_at: null, is_nap: false, source: null, watch_fixed_at: null };
  const part = { start: new Date("2026-10-31T04:40:00Z"), end: new Date("2026-10-31T09:05:00Z"), asleep: 255, awake: 10, bedStart: null };
  const early = sleepAction(part, [timer], new Date("2026-10-31T09:20:00Z"));
  ok("a night that ended under 45 minutes ago doesn't end a running Sleep timer", early.kind === "skip" && early.why === "the night only just ended", JSON.stringify(early));
  const full = { start: new Date("2026-10-31T04:40:00Z"), end: new Date("2026-10-31T12:00:00Z"), asleep: 420, awake: 20, bedStart: null };
  ok("nor does the whole night sent the moment you're up", sleepAction(full, [timer], new Date("2026-10-31T12:10:00Z")).kind === "skip");
  const after = sleepAction(full, [timer], new Date("2026-10-31T12:45:00Z"));
  ok("45 minutes on, the next send ends it at the whole night's wake", after.kind === "end" && after.id === "t" && after.at === "2026-10-31T12:00:00.000Z" && after.start === "2026-10-31T04:40:00.000Z", JSON.stringify(after));

  // Putting a move back, when the watch ended a running timer.
  const raw0102 = readFileSync(new URL("../supabase/migrations/0102_watch_corrects.sql", import.meta.url), "utf8");
  ok("0102's put-back keeps the watch's end where you never gave one", /set started_at = hand_started_at,\n--\s+ended_at = coalesce\(hand_ended_at, ended_at\)\n--\s+where hand_started_at is not null;/.test(raw0102) && !/hand_ended_at is not null/.test(raw0102));
  const healthSrc = readFileSync(new URL("../supabase/functions/watch/health.js", import.meta.url), "utf8");
  const watchFn = readFileSync(new URL("../supabase/functions/watch/index.ts", import.meta.url), "utf8");
  ok("and the watch function says so where it explains putting back", /hand_ended_at stays empty/.test(healthSrc) && /0102_watch_corrects\.sql/.test(healthSrc) && /0102_watch_corrects\.sql/.test(watchFn.slice(0, watchFn.indexOf("import "))));
}


{
  console.log("\nevening checks (0103)");
  const C = (kind, pass = {}, extra = {}) => ({ id: `c-${kind}`, text: kind, kind, pass, ...extra });
  ok("an aim from before checks is a Yes/No that counts", (() => {
    const c = ckNorm({ id: "a", text: " Exercised " });
    return c.kind === "yn" && c.pass.on === "yes" && c.counts === true && c.text === "Exercised";
  })());
  ok("a note is reflection only unless you say", ckNorm({ text: "x", kind: "note" }).counts === false && ckNorm({ text: "x", kind: "note", counts: true, pass: { words: true } }).counts === true);
  ok("Yes/No: the passing answer is passed, the other not", ckMark(C("yn"), "yes") === 2 && ckMark(C("yn"), "no") === 0);
  ok("a No can be what passes (no caffeine)", ckMark(C("yn", { on: "no" }), "no") === 2 && ckMark(C("yn", { on: "no" }), "yes") === 0);
  ok("Some is always partly", ckMark(C("ysn"), "some") === 1 && ckMark(C("ysn", { on: "no" }), "some") === 1);
  ok("Some isn't an answer to a plain Yes/No", ckMark(C("yn"), "some") === null);
  ok("1 to 10: the bar passes, two under is partly, lower is not", ckMark(C("scale", { min: 7 }), 7) === 2 && ckMark(C("scale", { min: 7 }), 5) === 1 && ckMark(C("scale", { min: 7 }), 4) === 0);
  ok("a number at least: the amount passes, any is partly, none is not", ckMark(C("number", { min: 20 }), 25) === 2 && ckMark(C("number", { min: 20 }), 5) === 1 && ckMark(C("number", { min: 20 }), 0) === 0);
  ok("a number at most: under passes, up to half again over is partly", ckMark(C("number", { max: 2 }), 2) === 2 && ckMark(C("number", { max: 2 }), 3) === 1 && ckMark(C("number", { max: 2 }), 4) === 0);
  ok("minutes: the full amount passes, any time is partly", ckMark(C("minutes", { min: 30 }), 45) === 2 && ckMark(C("minutes", { min: 30 }), 10) === 1 && ckMark(C("minutes", { min: 30 }), 0) === 0);
  ok("minutes with no amount: any time passes", ckMark(C("minutes"), 1) === 2 && ckMark(C("minutes"), 0) === 0);
  ok("a time: by it passes, 15 minutes late is partly", ckMark(C("time", { by: "04:35" }), "04:32") === 2 && ckMark(C("time", { by: "04:35" }), "04:50") === 1 && ckMark(C("time", { by: "04:35" }), "05:30") === 0);
  ok("times read round the clock: 12:20 am is late for by 10:30 pm", ckMark(C("time", { by: "22:30" }), "00:20") === 0 && ckMark(C("time", { by: "22:30" }), "22:10") === 2 && ckMark(C("time", { by: "23:50" }), "00:02") === 1);
  ok("clockDiff is early negative, late positive", ckClock("04:30", "04:35") === -5 && ckClock("00:20", "22:30") === 110 && ckClock("21:00", "04:35") < 0);
  ok("a time with no 'by' never scores", ckMark(C("time"), "04:30") === null && !ckScores(C("time")));
  ok("pick one: a passing choice passes, the rest don't", ckMark(C("choice", { on: ["Home"] }, { options: ["Home", "Out"] }), "Home") === 2 && ckMark(C("choice", { on: ["Home"] }, { options: ["Home", "Out"] }), "Out") === 0);
  ok("a choice with nothing passing is reflection only", !ckScores(C("choice", { on: [] }, { options: ["A", "B"] })));
  ok("a passing choice that isn't one of the choices is dropped", ckNorm(C("choice", { on: ["Gone"] }, { options: ["A"] })).pass.on.length === 0);
  ok("a note that counts passes once written", ckMark({ text: "n", kind: "note", counts: true, pass: { words: true } }, "Saw it") === 2 && ckMark({ text: "n", kind: "note", counts: true, pass: { words: true } }, "  ") === null);
  ok("a blank answer is no answer", !ckAnswered(C("number"), null) && !ckAnswered(C("number"), "") && ckAnswered(C("number"), 0) && !ckAnswered(C("yn"), ""));

  const three = [C("yn"), C("scale", { min: 7 }), { id: "r", text: "Examen", kind: "note" }];
  ok("reflection-only checks never hold the arrow back", ckAll(three, ["yes", 8, null]) && ckLevel(three, ["yes", 8, null]) === 0);
  ok("every check that scores must be answered", ckLevel(three, ["yes", null, "words"]) === null);
  ok("the ring is the share passed", ckLevel([C("yn"), C("yn")], ["yes", "no"]) === 2 && ckLevel([C("ysn"), C("yn")], ["some", "yes"]) === 1);
  ok("nothing that scores, no ring", ckLevel([{ text: "n", kind: "note" }], ["x"]) === null && ckLevel([], []) === null);
  ok("a focus that counts toward it is one more check", ckLevel([C("yn")], ["yes"], [0]) === 2 && ckShare([C("yn")], ["no"], [1]) === 0.5);
  ok("a target with no checks of its own takes the focus's ring", ckLevel([], [], [ckShareOfLevel(1)]) === 1 && ckLevel([], [], [ckShareOfLevel(0)]) === 0);
  ok("each ring's share lands back in that ring", [0, 1, 2, 3, 4, 5].every((k) => ckLevelOfShare(ckShareOfLevel(k)) === k));
  ok("the old Yes/Some/No thresholds hold", ckLevelOfShare(0.75) === 1 && ckLevelOfShare(0.5) === 2 && ckLevelOfShare(0.25) === 3 && ckLevelOfShare(0.01) === 4 && ckLevelOfShare(0) === 5);

  ok("what passes reads plainly", ckPassText(C("scale", { min: 7 })) === "7 or more" && ckPassText(C("time", { by: "04:35" })) === "By 4:35 am" && ckPassText(C("yn", { on: "no" })) === "No passes" && ckPassText({ text: "n", kind: "note" }) === "Reflection only");
  ok("and so do answers", ckValueText(C("scale"), 8) === "8/10" && ckValueText(C("time"), "22:05") === "10:05 pm" && ckValueText(C("number", {}, { unit: "pages" }), 12) === "12 pages" && ckValueText(C("yn"), "yes") === "Yes");
  ok("midnight and noon read right", ckClockText("00:15") === "12:15 am" && ckClockText("12:00") === "12:00 pm");

  const entryRow = ckEntry(C("number", { min: 10 }, { unit: "pages" }), "12", " good ");
  ok("a saved answer keeps kind, value, mark, unit and line", entryRow.kind === "number" && entryRow.value === 12 && entryRow.v === 2 && entryRow.unit === "pages" && entryRow.line === "good" && entryRow.counts === true);
  ok("an old answer reads as the Yes/Some/No it was", ckLegacy({ v: 2 }) === "yes" && ckLegacy({ v: 1 }) === "some" && ckLegacy({ v: 0 }) === "no" && ckLegacy({ value: 7, v: 2 }) === 7);
  const read = answersOf({ answers: [{ aim: "a", text: "Ex", v: 1 }, { aim: "b", text: "Up by", kind: "time", value: "04:40", v: 1, line: "late" }, { focus_goal: "fg", text: "Win by win", level: 1, v: 1 }] });
  ok("a shot's answers read old and new alike", read[0].kind === "ysn" && read[0].value === "some" && read[1].value === "04:40" && read[1].line === "late" && read[2].kind === "focus" && read[2].level === 1);
  ok("and say what they were", answerText(read[0]) === "Some" && answerText(read[1]) === "4:40 am" && answerText(read[2]) === "Inner");

  const local = new Date(2026, 10, 2, 4, 32);
  ok("Up by fills from I'm up", ckAuto({ text: "Up", kind: "time", pass: { by: "04:35" }, auto: "wake" }, { dayPlan: { woke_at: local.toISOString() } }) === "04:32");
  ok("or from the night's sleep the time log has", ckWoke(null, [{ category: "Sleep", tags: ["Sleep"], ended_at: new Date(2026, 10, 2, 4, 50).toISOString() }, { category: "Sleep", tags: ["Sleep"], is_nap: true, ended_at: new Date(2026, 10, 2, 11, 0).toISOString() }]) === "04:50");
  ok("an afternoon nap isn't when you got up", ckWoke(null, [{ category: "Sleep", tags: ["Sleep"], ended_at: new Date(2026, 10, 2, 15, 0).toISOString() }]) === null);
  {
    // The evening's log can hold the night ahead (a sleep started tonight and
    // ended tomorrow morning): with the day given, only that morning counts.
    const nights = [
      { category: "Sleep", tags: ["Sleep"], ended_at: new Date(2026, 10, 2, 4, 40).toISOString() },
      { category: "Sleep", tags: ["Sleep"], ended_at: new Date(2026, 10, 3, 4, 31).toISOString() },
    ];
    ok("the day's own morning, not the next one", ckWoke(null, nights, "2026-11-02") === "04:40");
    ok("only the next morning logged: no wake time for this day", ckWoke(null, [nights[1]], "2026-11-02") === null);
    ok("with no day given, the latest morning still counts", ckWoke(null, nights) === "04:31");
    ok("autoValue passes the day on", ckAuto({ text: "Up", kind: "time", pass: { by: "04:35" }, auto: "wake" }, { entries: [nights[1]], date: "2026-11-02" }) === null);
    ok("and takes it from the day plan when it isn't given", ckAuto({ text: "Up", kind: "time", pass: { by: "04:35" }, auto: "wake" }, { entries: nights, dayPlan: { date: "2026-11-02" } }) === "04:40");
  }
  const drawFocus = { id: "f2", categories: ["Drawing"] };
  const drawLog = [{ tags: ["Drawing"], duration_minutes: 40 }];
  ok("minutes with a focus fill from the time log", ckAuto({ text: "Drew", kind: "minutes", focus_id: "f2" }, { focusesById: new Map([["f2", drawFocus]]), entries: drawLog, focusMinutes }) === 40);
  ok("nothing logged leaves it blank, never zero", ckAuto({ text: "Drew", kind: "minutes", focus_id: "f2" }, { focusesById: new Map([["f2", drawFocus]]), entries: [], focusMinutes }) === null);

  ok("a tap's ring comes from how far out it is", levelAtSpot(0, 0) === 0 && levelAtSpot(0, -20) === 1 && levelAtSpot(30, 30) === 2 && levelAtSpot(40, 40) === 3 && levelAtSpot(0, 79) === 4 && levelAtSpot(0, 90) === 5);
  ok("a tap past the miss band comes back onto it", Math.hypot(clampSpot(200, 0).x, clampSpot(200, 0).y) <= 92.01 && clampSpot(10, 5).x === 10);
  ok("a ring button's spot is in that ring", [0, 1, 2, 3, 4, 5].every((k) => levelAtSpot(ringSpot(k).x, ringSpot(k).y) === k));
  ok("1–10 keeps a 1–5 for every older reader", ckToFive(1) === 1 && ckToFive(2) === 1 && ckToFive(7) === 4 && ckToFive(10) === 5 && ckToFive(null) === null);
  ok("an older day's 1–5 shows on the 1–10", ckTenOf({ mood: 3 }, "mood") === 6 && ckTenOf({ mood: 3, mood_10: 5 }, "mood") === 5 && ckTenOf({}, "stress") === null);

  console.log("\narrows on the week's focus (0103)");
  ok("a focus's arrow is placed unless it lands by checks", fLandsBy({}) === "placed" && fLandsBy({ lands_by: "checks" }) === "checks");
  ok("an old check-in reads as moved or not", fCheckinLevel({ moved: true }) === 1 && fCheckinLevel({ moved: false }) === 5 && fCheckinLevel(true) === 1);
  ok("a new one by its ring", fCheckinLevel({ moved: true, level: 3 }) === 3 && fCheckinLevel({ moved: true, level: 0 }) === 0);
  const placedShot = checkinShot("g", "2026-11-02", { level: 2, spot_x: 10, spot_y: -38, note: "close" });
  ok("an arrow you placed sits where you put it", placedShot.x === 10 && placedShot.y === -38 && placedShot.level === 2 && placedShot.note === "close");
  ok("one landed by checks gets a steady spot in its ring", (() => {
    const s = checkinShot("g", "2026-11-02", { level: 2 });
    return JSON.stringify({ x: s.x, y: s.y }) === JSON.stringify(placement("g:2026-11-02", 2, null));
  })());
  const arrow = fPlaced({ x: 0, y: -22 }, "  pretty good ");
  ok("placing makes the ring from the spot and keeps a note", arrow.level === 1 && arrow.spot_y === -22 && arrow.note === "pretty good" && arrow.lands === "placed");
  ok("a placed spot past the band is pulled in", Math.hypot(fPlaced({ x: 0, y: 300 }).spot_x, fPlaced({ x: 0, y: 300 }).spot_y) <= 92.01 && fPlaced({ x: 0, y: 300 }).level === 5);
  const upBy = [{ id: "u", text: "Up by 4:35", kind: "time", pass: { by: "04:35" }, auto: "wake" }];
  const byChecks = fChecksArrow(upBy, [{ value: "04:30" }]);
  ok("a focus that lands by checks: up at 4:30 is a bullseye", byChecks.level === 0 && byChecks.lands === "checks" && byChecks.spot_x === null && byChecks.answers[0].value === "04:30");
  ok("and waits until its checks are answered", fChecksArrow(upBy, [{ value: null }]) === null);
  ok("its checks come in order, retired ones left out", fChecksFor("g", [{ goal_id: "g", id: "2", text: "b", position: 1 }, { goal_id: "g", id: "1", text: "a", position: 0 }, { goal_id: "g", id: "x", text: "x", retired_on: "2026-11-01" }, { goal_id: "h", id: "h", text: "h" }]).map((c) => c.id).join() === "1,2");
  ok("what a focus counts toward", fToward({ node_id: "n" })?.kind === "goal" && fToward({ quest_id: "q" })?.kind === "quest" && fToward({ lesson_id: "l" })?.id === "l" && fToward({}) === null);
  const weekGoals = [
    { id: "w1", title: "Win by win", node_id: "disc", position: 0 },
    { id: "w2", title: "Draw daily", node_id: "skill", position: 1 },
    { id: "w3", title: "Plugin hours", quest_id: "plugin", position: 2 },
  ];
  const weekIns = [
    { goal_id: "w1", date: "2026-11-02", moved: true, level: 1 },
    { goal_id: "w2", date: "2026-11-01", moved: true, level: 0 },
    { goal_id: "w3", date: "2026-11-02", moved: false, level: 5 },
  ];
  const disc = { kind: "goal", ref: { id: "disc" } };
  ok("a target picks up tonight's arrow from a focus that counts toward it", (() => {
    const l = fLinked(disc, weekGoals, weekIns, "2026-11-02");
    return l.length === 1 && l[0].goal.id === "w1" && l[0].level === 1;
  })());
  ok("but not another day's, nor another target's", fLinked({ kind: "goal", ref: { id: "skill" } }, weekGoals, weekIns, "2026-11-02").length === 0 && fLinked({ kind: "quest", ref: { id: "disc" } }, weekGoals, weekIns, "2026-11-02").length === 0);
  ok("a quest's focus counts toward the quest, miss and all", fLinked({ kind: "quest", ref: { id: "plugin" } }, weekGoals, weekIns, "2026-11-02")[0]?.level === 5);
  const tgt = { aims: [{ id: "a1", text: "Exercised" }] };
  const withFocus = shotFrom(tgt, [{ value: "yes" }], { linked: [{ goal: weekGoals[0], level: 1 }] });
  ok("the focus's arrow is saved in the shot, after the checks", withFocus.answers.length === 2 && withFocus.answers[1].focus_goal === "w1" && withFocus.answers[1].level === 1 && withFocus.level === 1);
  ok("and never holds the shot back", tonightLevel(tgt, [{ value: null }], [{ goal: weekGoals[0], level: 0 }]) === null);
  ok("a target of only a focus lands where the focus did", tonightLevel({ aims: [] }, [], [{ goal: weekGoals[0], level: 2 }]) === 2);

  const qs = quickShot({ aims: [{ id: "u", text: "Up by", kind: "time", pass: { by: "04:35" }, auto: "wake" }, { id: "d", text: "Drew", kind: "yn" }] }, 1, [{ value: "04:20" }, { value: null }], { reason: 2, how: "guess" });
  ok("the short evening's one tap sets the ring for the whole target", qs.level === 2 && qs.answers[0].whole && qs.answers[0].text === WHOLE && qs.answers[0].value === "some" && quickOf(qs) === 1);
  ok("and keeps what the day answered, without counting it or making the rest up", qs.answers.length === 2 && qs.answers[1].aim === "u" && qs.answers[1].counts === false);
  ok("a quick bullseye has no section; no tap, no shot", quickShot({ aims: [] }, 2, [], { reason: 1 }).reason === null && quickShot({ aims: [] }, null) === null && quickOf({ answers: [{ aim: "a", v: 2 }] }) === null);
  const sql = readFileSync(new URL("../supabase/migrations/0103_evening_checks.sql", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  ok("0103 only adds: nothing dropped, deleted or rewritten", !/\bdrop\b|\bdelete\s+from\b|\bupdate\s+public\.|\btruncate\b|\balter\s+column\b|\brename\b/i.test(sql));
  ok("0103 adds columns only with if not exists", (sql.match(/add column(?! if not exists)/g) ?? []).length === 0);
  ok("existing aims become Yes/No checks that count", /add column if not exists kind text not null default 'yn'/.test(sql) && /add column if not exists counts boolean not null default true/.test(sql));
  ok("a focus's checks are yours, on your own goal", /alter table public\.focus_checks enable row level security/.test(sql) && /g\.id = goal_id and g\.user_id = auth\.uid\(\)/.test(sql) && /revoke all on public\.focus_checks from anon/.test(sql));
  ok("a focus's quest and lesson must be yours", /as restrictive\s+for insert/.test(sql) && /as restrictive\s+for update/.test(sql) && (sql.match(/q\.user_id = auth\.uid\(\)/g) ?? []).length === 2);
  ok("a check-in's spot stays on the target", /spot_x \* spot_x \+ spot_y \* spot_y <= 97 \* 97/.test(sql));
  ok("the 1–10 feelings and the notes", ["mood_10", "stress_10"].every((c) => sql.includes(`add column if not exists ${c} smallint`)) && ["god_note", "mood_note", "stress_note"].every((c) => sql.includes(`add column if not exists ${c} text`)));
}


// ===== Review fixes, batch A =====
// Tonight's shots on each target: taken back when the ring goes, the day's
// answers never frozen, an edit made just before leaving kept, what can't
// be saved yet said plainly, and a removed choice dropped.
{
  console.log("\nreview fixes, batch A: tonight's shots");
  const M = await import("../src/lib/mark.js");
  const today = "2026-11-02";
  const shipIt = { id: "w1", title: "Ship settings" };
  const asRow = (shot) => ({ id: "row", target_id: "t1", date: today, loosed_at: null, ...shot, answers: shot.answers.map((a) => Object.fromEntries(Object.entries(a).reverse())) });

  // --- #1, #7, #13: a shot whose ring goes back to none is taken back --------
  const plugin = { key: "q1", kind: "quest", ref: { id: "q1" }, targetId: "t1", aims: [], shots: [], reasons: ["a", "b", "c", "d"] };
  const placed = { answers: [], line: "", quick: null, pick: null };
  const fedShot = M.shotChange(plugin, placed, null, { linked: [{ goal: shipIt, level: 1 }], today });
  ok("a target fed only by a focus saves the ring the focus landed", fedShot?.shot?.level === 1 && fedShot.shot.answers[0].focus_goal === "w1");
  const fedRow = asRow(fedShot.shot);
  ok("and saves nothing more while that arrow stays", M.shotChange(plugin, placed, fedRow, { linked: [{ goal: shipIt, level: 1 }], today }) === null);
  ok("taking the focus's arrow back takes the target's shot back too", M.shotChange(plugin, placed, fedRow, { linked: [], today })?.takeBack === true);
  const pages = { key: "g1", kind: "goal", ref: { id: "g1" }, targetId: "t1", shots: [], reasons: ["a", "b", "c", "d"], aims: [{ id: "p", text: "Pages read", kind: "number", pass: { min: 10 } }, { id: "x", text: "Exercised", kind: "yn" }] };
  const bull = M.shotChange(pages, { answers: [{ value: 12, line: "" }, { value: "yes", line: "" }], line: "" }, null, { today });
  const cleared = { answers: [{ value: null, line: "", day: false }, { value: "yes", line: "" }], line: "" };
  ok("so does clearing a typed answer it was landed by", bull?.shot?.level === 0 && M.shotChange(pages, cleared, asRow(bull.shot), { today })?.takeBack === true);
  ok("nothing saved, nothing to take back", M.shotChange(pages, cleared, null, { today }) === null);
  ok("an arrow already loosed stays where it landed", M.shotChange(pages, cleared, { ...asRow(bull.shot), loosed_at: "2026-11-02T22:00:00Z" }, { today }) === null);
  ok("and nothing is taken back before the week's been read: a focus may be what gives it its ring", M.shotChange(plugin, placed, fedRow, { linked: [], today, weekRead: false }) === null);
  const shotsSrc = readFileSync(new URL("../src/components/mark/TonightShots.jsx", import.meta.url), "utf8");
  ok(
    "the evening sends a ring that's gone through the same per-target chain, and takes the shot back there",
    /if \(level == null\) \{\s*persist\(key\);\s*return;\s*\}/.test(shotsSrc) &&
      /change\.takeBack/.test(shotsSrc) &&
      /await deleteTonightShot\(userId, was\.target_id \?\? t\.targetId, date\);\s*saved\.current\.delete\(key\);/.test(shotsSrc) &&
      /\(chains\.current\.get\(key\) \?\? Promise\.resolve\(\)\)\.then\(run\)/.test(shotsSrc)
  );
  const apiSrc = readFileSync(new URL("../src/lib/api.js", import.meta.url), "utf8");
  const delFrom = apiSrc.indexOf("export async function deleteTonightShot");
  ok("deleteTonightShot sits right after looseShots", delFrom > apiSrc.indexOf("export async function looseShots") && delFrom < apiSrc.indexOf("export async function readMarkLine"));
  const delSrc = apiSrc.slice(delFrom, apiSrc.indexOf("\n}\n", delFrom) + 2).replace(/^export /, "");
  const calls = [];
  const fakeDb = {
    from: (table) => {
      const q = { table, ops: [] };
      calls.push(q);
      const chain = {
        delete: () => (q.ops.push(["delete"]), chain),
        eq: (c, v) => (q.ops.push(["eq", c, v]), chain),
        is: (c, v) => (q.ops.push(["is", c, v]), chain),
        then: (res) => res({ error: null }),
      };
      return chain;
    },
  };
  const deleteTonightShot = new Function("supabase", `${delSrc}; return deleteTonightShot;`)(fakeDb);
  await deleteTonightShot("u1", "t1", today);
  await deleteTonightShot("u1", null, today);
  const ops = JSON.stringify(calls[0]?.ops);
  ok(
    "and deletes only that target's shot for the day, only while it's still in hand",
    calls.length === 1 && calls[0].table === "mark_shots" && ops === JSON.stringify([["delete"], ["eq", "user_id", "u1"], ["eq", "target_id", "t1"], ["eq", "date", today], ["is", "loosed_at", null]]),
    ops
  );

  // --- #3, #12: an answer the day filled in takes the day's newer one --------
  const drawing = { id: "f-draw", categories: ["Drawing"] };
  const byId = new Map([[drawing.id, drawing]]);
  const log = (mins) => [{ tags: ["Drawing"], duration_minutes: mins }];
  const drew = { key: "g2", kind: "goal", ref: { id: "g2" }, shots: [], reasons: ["a", "b", "c", "d"], tonight: null, aims: [{ id: "m", text: "Time drawing", kind: "minutes", pass: { min: 30 }, focus_id: "f-draw" }, { id: "k", text: "Kept it", kind: "yn" }] };
  const at6 = M.tonightDraft(drew, { focusesById: byId, entries: log(20) });
  const kept6 = M.localDraft(drew, at6, null);
  ok("the time log's minutes are kept on this phone marked as the day's", kept6.answers.m?.value === 20 && kept6.answers.m.day === true && !("k" in kept6.answers));
  const at10 = M.tonightDraft(drew, { focusesById: byId, entries: log(60), mine: kept6 });
  ok("so reopening later takes the day's newer number, not the one from six o'clock", at10.answers[0].value === 60 && at10.answers[0].day === true);
  at10.answers[1] = { value: "yes", line: "", day: false };
  ok("and the shot lands where the day really put it", M.tonightShot(drew, at10, { today })?.level === 0);
  const mineKept = M.localDraft(drew, { ...at6, answers: [{ value: 25, line: "", day: false }, at6.answers[1]] }, null);
  ok("a number he typed himself stays put however the log moves", M.tonightDraft(drew, { focusesById: byId, entries: log(60), mine: mineKept }).answers[0].value === 25);
  const savedDay = M.shotFrom(drew, [{ value: 20, line: "", day: true }, { value: "yes", line: "", day: false }]);
  ok("a saved shot marks the day's answer as the day's, and only that one", savedDay.answers[0].day === true && savedDay.answers[1].day === undefined);
  const fromSavedDay = M.startingAnswers({ ...drew, tonight: asRow(savedDay) }, { focusesById: byId, entries: log(60) });
  ok("and the day's newer answer wins over it, his own still his", fromSavedDay[0].value === 60 && fromSavedDay[0].day === true && fromSavedDay[1].value === "yes" && fromSavedDay[1].day === false);
  const savedMine = M.shotFrom(drew, [{ value: 20, line: "", day: false }, { value: "yes", line: "" }]);
  ok("a saved answer he gave himself is never replaced by the day's", M.startingAnswers({ ...drew, tonight: asRow(savedMine) }, { focusesById: byId, entries: log(60) })[0].value === 20);
  ok("the day with nothing now keeps the answer it gave", M.startingAnswers({ ...drew, tonight: asRow(savedDay) }, { focusesById: byId, entries: [] })[0].value === 20);
  const running = [{ value: 1, line: "", day: true }, { value: null, line: "", day: true }];
  const stopped = M.freshAnswers(drew, running, { focusesById: byId, entries: log(45) });
  ok("while the evening is open, a timer stopped since gives the day's answer its real minutes", stopped !== running && stopped[0].value === 45 && stopped[0].day === true && stopped[1] === running[1]);
  ok("and nothing new gives back the very same answers, so nothing saves again", M.freshAnswers(drew, stopped, { focusesById: byId, entries: log(45) }) === stopped);
  ok("one he gave himself is left alone", M.freshAnswers(drew, [{ value: 10, line: "", day: false }, running[1]], { focusesById: byId, entries: log(45) })[0].value === 10);
  ok(
    "the evening marks his own answers as his and takes the day's newer ones while it's open",
    /\{ \.\.\.a, value, day: false \}/.test(shotsSrc) && /freshAnswers\(t, x\.answers, \{ focusesById, entries, dayPlan, date \}\)/.test(shotsSrc) && /localDraft\(t, d, saved\.get\(t\.key\)\)/.test(shotsSrc)
  );

  // --- The quick card and the full card still agree, with no save loop -------
  const quickSaved = M.quickShot(drew, 1, [{ value: 20, line: "", day: true }, { value: null, line: "", day: true }], { reason: 0, how: "guess" });
  ok("a quick tap keeps the day's answer marked as the day's", quickSaved.answers[1].aim === "m" && quickSaved.answers[1].day === true && quickSaved.answers[1].counts === false);
  const fullOnQuick = M.tonightDraft({ ...drew, tonight: asRow(quickSaved) }, { focusesById: byId, entries: log(20) });
  ok("the full card opens on the quick card's tap, and re-making it saves nothing", fullOnQuick.quick === 1 && M.shotChange(drew, fullOnQuick, asRow(quickSaved), { today }) === null);
  const fullSaved = M.tonightShot(drew, { answers: [{ value: 20, line: "", day: true }, { value: "no", line: "", day: false }], line: "late", pick: { k: 1, how: "read" } }, { today });
  const quickOnFull = M.tonightDraft({ ...drew, tonight: asRow(fullSaved) }, { focusesById: byId, entries: log(20) });
  ok("the quick card opens on the full card's answers, and saves nothing until it's tapped", quickOnFull.quick === null && M.shotChange(drew, quickOnFull, asRow(fullSaved), { today }) === null);
  ok("a newer day's minutes save once, then rest", (() => {
    const moved = { ...quickOnFull, answers: M.freshAnswers(drew, quickOnFull.answers, { focusesById: byId, entries: log(50) }) };
    const once = M.shotChange(drew, moved, asRow(fullSaved), { today });
    return once?.shot?.answers[0].value === 50 && M.shotChange(drew, moved, asRow(once.shot), { today }) === null;
  })());

  // --- #4, #15: an edit made just before leaving isn't put back -------------
  const scripture = { key: "l1", kind: "lesson", ref: { id: "l1" }, shots: [], reasons: ["a", "b", "c", "d"], aims: [{ id: "s", text: "Minutes in scripture", kind: "minutes", pass: { min: 20 } }] };
  const s15 = asRow(M.shotFrom(scripture, [{ value: 15, line: "" }], { line: "rushed", reason: 0, how: "read" }));
  const typed30 = M.localDraft(scripture, { answers: [{ value: 30, line: "", day: false }], line: "slow and good" }, s15);
  ok("the draft remembers the saved shot it sits on, whatever order its keys come back in", typed30.base === M.shotKey(s15) && M.shotKey(asRow(s15)) === M.shotKey(s15) && M.shotKey(null) === null);
  const back30 = M.tonightDraft({ ...scripture, tonight: s15 }, { mine: typed30 });
  ok("so a 30 typed a moment before leaving wins over the 15 still saved", back30.answers[0].value === 30 && back30.line === "slow and good");
  ok("and the new line is read again, the saved one already was", back30.readFor === "rushed" && back30.pick.k === 0);
  const s20 = asRow(M.shotFrom(scripture, [{ value: 20, line: "" }]));
  ok("once the shot saved has moved on since (the desk finished it), the shot wins", M.tonightDraft({ ...scripture, tonight: s20 }, { mine: typed30 }).answers[0].value === 20);
  ok(
    "leaving the card settles what was waiting instead of dropping it, and the draft is written again once a save lands",
    /settleRef\.current\(key, \{ now: true \}\)/.test(shotsSrc) && /return \(\) => \{\s*alive\.current = false;/.test(shotsSrc) && (shotsSrc.match(/keepLocal\(\);/g) ?? []).length === 2
  );

  // --- #11: what can't be saved yet says so, and stays in the draft ----------
  const examen = { key: "l2", kind: "lesson", ref: { id: "l2" }, shots: [], tonight: null, reasons: ["a", "b", "c", "d"], aims: [{ id: "e", text: "The Examen", kind: "note" }] };
  const wrote = { answers: [{ value: "Where I saw God today", line: "", day: false }], line: "a long day", quick: null };
  ok("an Examen-only target has no shot to save it in", M.tonightShot(examen, wrote, { today }) === null);
  const examenKept = M.localDraft(examen, wrote, null);
  ok("so it's kept in the draft, and comes back next time", M.tonightDraft(examen, { mine: examenKept }).answers[0].value === "Where I saw God today" && M.tonightDraft(examen, { mine: examenKept }).line === "a long day");
  const alone = M.keptText(examen, wrote, { level: null, feeds: [] });
  ok("and the evening says plainly it isn't kept once the day is banked", /reflection only/.test(alone) && /isn't kept once you bank the day/.test(alone) && /on Targets/.test(alone), alone);
  const fedNotYet = M.keptText(examen, wrote, { level: null, feeds: [shipIt] });
  ok("one a focus feeds says what feeds its arrow, and keeps until it lands", /its arrow comes from Ship settings\./.test(fedNotYet) && /until that arrow lands, and isn't kept if you bank the day without it/.test(fedNotYet), fedNotYet);
  ok("once that arrow has landed it only says where the arrow came from", M.keptText(examen, wrote, { level: 1, feeds: [shipIt] }) === "These are all reflection only, so its arrow comes from Ship settings.");
  const half = { answers: [{ value: null, line: "only 4 pages", day: true }, { value: "yes", line: "", day: false }], line: "", quick: null };
  ok("a target still short of an answer says what it holds stays here until every check that counts is answered", /until every check that counts is answered/.test(M.keptText(pages, half, { level: null }) ?? ""));
  ok("but says nothing before anything's been given, or once it has its ring", M.keptText(pages, { answers: [{ value: null, line: "", day: true }, { value: null, line: "", day: true }], line: "" }, { level: null }) === null && M.keptText(pages, half, { level: 2 }) === null);
  ok("nor for what only the day filled in", M.keptText(drew, { answers: [{ value: 20, line: "", day: true }, { value: null, line: "", day: true }], line: "" }, { level: null }) === null);
  ok("a target fed only by a focus says the line waits on it", /until Ship settings lands its arrow, and isn't kept if you bank the day without it/.test(M.keptText(plugin, { answers: [], line: "good day" }, { level: null, feeds: [shipIt] }) ?? ""));
  const allSaid = [alone, fedNotYet, M.keptText(pages, half, { level: null }), M.keptText(plugin, { answers: [], line: "x" }, { level: null, feeds: [shipIt] })];
  ok("in plain words, no dashes", allSaid.every((s) => typeof s === "string" && !/[—–]/.test(s)));
  const markCss = readFileSync(new URL("../src/styles/mark.css", import.meta.url), "utf8");
  ok("the evening shows it by the boxes", /keptText\(t, d, \{ level, feeds: tFeeds \}\)/.test(shotsSrc) && /className="card-note mk-shot__kept"/.test(shotsSrc) && /\.mk-shot__kept \{/.test(markCss) && shotsSrc.indexOf("mk-shot__kept") < shotsSrc.indexOf("mk-shot__line"));

  // --- #16: a choice whose option was taken out starts blank -----------------
  const how = { aims: [{ id: "h", text: "How I met the evening", kind: "choice", options: ["Peaceful", "Rushed"], pass: { on: ["Peaceful"] } }] };
  const calm = { answers: [{ aim: "h", text: "How I met the evening", kind: "choice", value: "Calm", v: 2 }] };
  ok("a saved choice whose option has been taken out starts blank", M.startingAnswers({ ...how, tonight: calm }, {})[0].value === null);
  ok("one still there is kept", M.startingAnswers({ ...how, tonight: { answers: [{ ...calm.answers[0], value: "Rushed" }] } }, {})[0].value === "Rushed");
  ok("even on a choice that only asks", M.startingAnswers({ aims: [{ ...how.aims[0], pass: { on: [] } }], tonight: calm }, {})[0].value === null);

  {
    // Recheck of batch A: a cleared answer stays cleared, the week-unread
    // guard only where a focus could matter.
    const pages = { id: "p", text: "Pages", kind: "number", pass: { min: 10 } };
    const t1 = { aims: [pages], tonight: { answers: [{ aim: "p", text: "Pages", kind: "number", value: 12, v: 2 }] } };
    const cleared = M.localDraft(t1, { answers: [{ value: null, line: "", day: false }], line: "" }, t1.tonight);
    ok("a cleared answer is kept in the phone's draft", cleared.answers.p && cleared.answers.p.value === null && cleared.answers.p.day === false);
    ok("and reads back blank over the shot saved before", M.restoreAnswers(t1, [{ value: 12, line: "", day: false }], cleared.answers)[0].value === null);
    const was = { target_id: "T", level: 0, answers: t1.tonight.answers, loosed_at: null };
    ok("before the week is read, a target whose own check was cleared is still taken back", M.shotChange(t1, { answers: [{ value: null }], line: "" }, was, { weekRead: false })?.takeBack === true);
    ok("one with nothing of its own to finish waits for the week", M.shotChange({ aims: [] }, { answers: [], line: "" }, was, { weekRead: false }) === null);
  }
}

// (end of review fixes, batch A)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------


// ===== Review fixes, batch B =====
// What's typed on a focus tonight is kept until an arrow holds it (#6, #10,
// #14, #17, #18, #23), a checks-landed arrow whose save failed is tried
// again and says it isn't saved (#5), and a choice taken off a focus's
// check no longer reads as answered (#16, focus.js).
{
  console.log("\nreview fixes, batch B: a focus's arrow keeps what you typed");
  const F = await import("../src/lib/focus.js");
  const D = "2026-11-02";
  const store = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
  };
  const energy = { id: "e", goal_id: "g", text: "Energy on waking", kind: "scale", pass: { min: 7 } };
  const bed = { id: "b", goal_id: "g", text: "In bed by 9", kind: "time", pass: { by: "21:00" } };
  const up = { id: "u", goal_id: "g", text: "Up by 4:35", kind: "time", pass: { by: "04:35" }, auto: "wake" };
  const three = F.checksFor("g", [energy, bed, up]);

  // #16: a choice taken off the list starts blank, so no miss is saved for it.
  const met = { id: "m", goal_id: "g", text: "How I met the evening", kind: "choice", options: ["Peaceful", "Tense"], pass: { on: ["Peaceful"] } };
  const calmRow = { answers: [{ aim: "m", text: "How I met the evening", kind: "choice", value: "Calm", v: 2 }], level: 0, lands: "checks" };
  ok("#16 a saved choice that's been taken off the list starts blank", F.focusAnswers([met], calmRow)[0].value === null);
  ok("#16 so the arrow waits for an answer rather than landing a miss", F.landedArrow([met], F.focusAnswers([met], calmRow)) === null);
  ok("#16 a choice still on the list is kept", F.focusAnswers([met], { answers: [{ aim: "m", value: "Tense", v: 0 }] })[0].value === "Tense");

  // The draft, kept on this phone.
  const s1 = store();
  ok("a focus's draft is kept by day, one entry per focus", (() => {
    F.keepArrowDraft(D, "g", { mine: { e: { value: 7 } }, note: "Felt strong", at: 1 }, s1);
    F.keepArrowDraft(D, "h", { mine: {}, note: "other", at: 2 }, s1);
    const raw = JSON.parse(s1.getItem(F.arrowDraftKey(D)));
    return F.arrowDraftKey(D) === `hub.focus.draft.${D}` && raw.g.note === "Felt strong" && raw.h.note === "other" && F.readArrowDraft(D, "g", s1).mine.e.value === 7;
  })());
  ok("clearing one focus leaves the others, and the day's key goes once it's empty", (() => {
    F.keepArrowDraft(D, "g", null, s1);
    const kept = F.readArrowDraft(D, "g", s1) === null && F.readArrowDraft(D, "h", s1)?.note === "other";
    F.keepArrowDraft(D, "h", null, s1);
    return kept && s1.getItem(F.arrowDraftKey(D)) === null;
  })());
  ok("a broken draft, or no storage at all, gives nothing and never throws", (() => {
    const bad = store();
    bad.setItem(F.arrowDraftKey(D), "{not json");
    const boom = { getItem() { throw new Error("off"); }, setItem() { throw new Error("off"); }, removeItem() { throw new Error("off"); } };
    F.keepArrowDraft(D, "g", { note: "x", at: 1 }, boom);
    return F.readArrowDraft(D, "g", bad) === null && F.readArrowDraft(D, "g", boom) === null && F.readArrowDraft(D, "g", store()) === null;
  })());

  // What a draft gives back.
  const restored = F.restoreMine(three, { e: { value: 7, line: "Slept well for once" }, b: { value: null }, gone: { value: "yes" }, u: { value: "half past" } });
  ok("a draft's answers come back for checks still asked", restored.e.value === 7 && restored.e.line === "Slept well for once" && !("gone" in restored));
  ok("an answer you cleared stays cleared", "b" in restored && restored.b.value === null);
  ok("an answer that no longer fits its check is passed over", !("u" in restored));
  ok("a choice taken off the list is passed over, its line kept", (() => {
    const r = F.restoreMine([met], { m: { value: "Calm", line: "a quiet one" } });
    return !("value" in r.m) && r.m.line === "a quiet one";
  })());
  ok("a broken draft gives no answers", Object.keys(F.restoreMine(three, null)).length === 0 && Object.keys(F.restoreMine(three, [1, 2])).length === 0 && Object.keys(F.restoreMine(three, { e: "7" })).length === 0);

  // #17 / #14 / #6: two answers of three and a note, then Short and Full (or a reload).
  const s2 = store();
  const partial = { mine: { e: { value: 7, line: "Slept well for once" } }, note: "Felt strong all morning", at: Date.parse("2026-11-02T21:00:00Z") };
  F.keepArrowDraft(D, "g", partial, s2);
  const back = F.arrowStart(three, null, F.readArrowDraft(D, "g", s2));
  const backAnswers = F.focusAnswers(three, null, { auto: [null, null, "04:30"], mine: back.mine });
  ok("#17 half-answered checks and the note come back when the focus opens again", back.note === "Felt strong all morning" && backAnswers[0].value === 7 && backAnswers[0].line === "Slept well for once" && backAnswers[2].value === "04:30" && !back.drop);
  ok("#17 and still no arrow lands until the last check is answered", F.landedArrow(three, backAnswers, back.note) === null);
  ok("#14 with nothing typed there's no draft, and the saved note is where it starts", (() => {
    const st = F.arrowStart(three, { note: "saved", updated_at: "2026-11-02T20:00:00Z" }, null);
    return st.note === "saved" && Object.keys(st.mine).length === 0 && !st.drop;
  })());

  // Which wins: the draft or the saved arrow.
  const savedRow = (at, extra = {}) => ({ goal_id: "g", date: D, level: 1, note: "from the laptop", answers: [], lands: "checks", updated_at: at, ...extra });
  ok("a saved arrow older than the draft gives way to it", F.arrowStart(three, savedRow("2026-11-02T20:00:00Z"), partial).note === "Felt strong all morning");
  ok("a saved arrow newer than the draft wins, and the draft can go", (() => {
    const st = F.arrowStart(three, savedRow("2026-11-02T22:00:00Z"), partial);
    return st.note === "from the laptop" && Object.keys(st.mine).length === 0 && st.drop;
  })());
  ok("a draft the saved arrow already holds can go", (() => {
    const held = F.landedArrow(three, [{ value: 7, line: "Slept well for once" }, { value: "20:45" }, { value: "04:30", day: true }], "Felt strong all morning");
    const st = F.arrowStart(three, { ...held, updated_at: "2026-11-02T20:00:00Z" }, partial);
    return st.drop && st.note === "Felt strong all morning";
  })());
  ok("an arrow still on its way (no updated_at yet) never outranks the draft", F.arrowStart(three, savedRow(undefined), partial).note === "Felt strong all morning");

  // When a saved arrow holds the draft.
  const all = F.landedArrow(three, [{ value: 7, line: "Slept well for once" }, { value: "20:45" }, { value: "04:30", day: true }], "Felt strong all morning");
  ok("an arrow with every answer, line and the note holds the draft", F.draftHeld(three, partial, all));
  ok("one with a different note, answer or line doesn't", !F.draftHeld(three, partial, { ...all, note: "other" }) && !F.draftHeld(three, { ...partial, mine: { e: { value: 8 } } }, all) && !F.draftHeld(three, { ...partial, mine: { e: { value: 7, line: "new line" } } }, all));
  ok("no arrow holds a draft with something in it; an empty one is held by anything", !F.draftHeld(three, partial, null) && F.draftHeld(three, { mine: {}, note: "  ", at: 1 }, null) && F.draftHeld(three, null, null));
  ok("a draft's note is compared as it would be kept", F.draftHeld(three, { mine: {}, note: "  Felt strong all morning  " }, all));

  // Once an arrow saves.
  const s3 = store();
  F.keepArrowDraft(D, "g", partial, s3);
  F.settleArrowDraft(D, "g", three, all, s3);
  ok("an arrow that saves holding the draft clears it", F.readArrowDraft(D, "g", s3) === null);
  F.keepArrowDraft(D, "g", { ...partial, mine: { ...partial.mine, b: { value: "20:50" } } }, s3);
  F.settleArrowDraft(D, "g", three, all, s3, 5e12);
  ok("one that doesn't hold all of it (typed while it saved) keeps it, stamped newer than the save", F.readArrowDraft(D, "g", s3)?.at === 5e12 && F.readArrowDraft(D, "g", s3).mine.b.value === "20:50");

  // #18: a note typed before placing, and one left after taking the arrow back.
  const s4 = store();
  F.keepArrowDraft(D, "w", { mine: {}, note: "Held my temper twice", at: 10 }, s4);
  ok("#18 a note typed before an arrow is placed comes back with the focus", F.arrowStart([], null, F.readArrowDraft(D, "w", s4)).note === "Held my temper twice");
  F.settleArrowDraft(D, "w", [], null, s4, 20);
  ok("#18 taking the arrow back keeps the note on this phone, not just in the box", F.readArrowDraft(D, "w", s4)?.note === "Held my temper twice" && F.readArrowDraft(D, "w", s4).at === 20);
  F.settleArrowDraft(D, "w", [], F.placedArrow({ x: 0, y: -20 }, "Held my temper twice"), s4);
  ok("#18 placing the arrow saves the note with it and the draft goes", F.readArrowDraft(D, "w", s4) === null);

  // #10: a note on a focus whose checks aren't all answered goes onto the arrow already there.
  const landedRow = { goal_id: "g", date: D, moved: true, ...all, note: null, updated_at: "2026-11-02T20:00:00Z" };
  const withNote = F.arrowWithNote(landedRow, "  Rough night with the kids ");
  ok("#10 the arrow already there takes the note, just as it is otherwise", withNote.note === "Rough night with the kids" && withNote.level === landedRow.level && withNote.lands === "checks" && withNote.answers === landedRow.answers && !("updated_at" in withNote) && !("goal_id" in withNote));
  ok("#10 an old yes-or-no day keeps the ring it reads as", F.arrowWithNote({ moved: true }, "x").level === 1 && F.arrowWithNote({ moved: false }, "x").level === 5);
  ok("#10 with a check left unanswered, a new note is what's saved", F.arrowKey(F.arrowToSave(landedRow, null, "Rough night with the kids")) === F.arrowKey(withNote));
  ok("#10 and nothing is saved when the note hasn't changed, or there's no arrow yet", F.arrowToSave(landedRow, null, "  ") === null && F.arrowToSave({ ...landedRow, note: "same" }, null, " same ") === null && F.arrowToSave(null, null, "a note") === null);

  // #5: a checks-landed arrow whose save failed.
  const old = { ...landedRow, level: 3, answers: [], note: null };
  ok("#5 a ready arrow that isn't what's saved is saved", F.arrowToSave(old, all, all.note) === all && F.arrowToSave(null, all, all.note) === all);
  ok("#5 one that is, isn't, unless its last save failed", F.arrowToSave({ ...all, updated_at: "x" }, all, all.note) === null && F.arrowToSave(all, all, all.note, F.arrowKey(all)) === all);
  ok("#5 after a failed save the card says Not saved, even while the week still shows it", F.arrowNotSaved(all, { goal_id: "g", ...all }, { failed: F.arrowKey(all) }) && F.arrowNotSaved(all, old, { failed: F.arrowKey(all) }) && F.arrowNotSaved(all, null, { failed: F.arrowKey(all) }));
  ok("#5 or when the week holds another arrow with nothing on its way", F.arrowNotSaved(all, old) && F.arrowNotSaved(all, null));
  ok("#5 never while a save is waiting or on its way, nor once it's read back saved", !F.arrowNotSaved(all, old, { pending: true }) && !F.arrowNotSaved(all, { goal_id: "g", ...all }) && !F.arrowNotSaved(all, { ...all, updated_at: "2026-11-02T22:00:00Z" }, { failed: F.arrowKey(all) }) && !F.arrowNotSaved(null, old));

  // The card, read as source.
  const src = readFileSync(new URL("../src/components/focus/FocusArrows.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles/focus.css", import.meta.url), "utf8");
  ok("GoalArrow starts from the draft this phone kept", /useState\(\(\) => arrowStart\(checks, row, readArrowDraft\(date, goal\.id\)\)\)/.test(src) && /useState\(start\.note\)/.test(src) && /useState\(start\.mine\)/.test(src));
  ok("every answer, line and note is kept on this phone as it's typed", /setMine\(next\);\s*keep\(\);/.test(src) && /noteRef\.current = text;\s*keep\(\);/.test(src));
  ok("taking the arrow back keeps the note before the arrow goes", /cancel\(\);\s*keep\(\);\s*save\(null\);/.test(src));
  ok("each save clears the draft once it holds it, and remembers a failure", /if \(saved\) settleArrowDraft\(date, goal\.id, checksRef\.current, next\);\s*else if \(next\) setFailedKey\(arrowKey\(next\)\);/.test(src));
  ok("#5 flush with nothing waiting tries again", /if \(!job\) \{\s*retry\.current\?\.\(\);/.test(src) && /retry\.current =\s*mode === "checks"\s*\? saveChecks/.test(src));
  ok("#5 the card says Not saved, with a way to try again", /else if \(ready && unsaved\) words = "Not saved\.";/.test(src) && /focus-arrow__retry/.test(src) && /Try again/.test(src) && /\.focus-arrow__retry \{/.test(css));
  ok("#10 a note typed on a focus with an arrow saves whichever way it lands", /if \(rowRef\.current\) later\(mode === "placed" \? saveNote : saveChecks, NOTE_MS\);/.test(src));
  ok("#18 #23 a note with no arrow yet says plainly it isn't kept", src.includes("Place the arrow to keep this note.") && src.includes("Answer its checks to keep this note.") && /\.focus-arrow__keep \{/.test(css) && /\.focus-arrow__note-box \{ align-self: stretch;/.test(css));
  ok("the card's words have no em-dashes", !src.replace(/^\s*\/\/.*$/gm, "").includes("—"));
}

// (end of review fixes, batch B)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------


// ===== Review fixes, batch C =====
{
  console.log("\nreview fixes: the reflection's draft, Short and Full, saving checks twice, the check editor");
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  // A component's own helpers, built with what it imports swapped for
  // stand-ins, except the modules `keep` names (the FocusSheet pattern above).
  const helpersOf = async (rel, keep = null) => {
    const path = fileURLToPath(new URL(`../${rel}`, import.meta.url));
    const text = readFileSync(path, "utf8");
    const built = await esbuildBundle({
      entryPoints: [path],
      bundle: true,
      write: false,
      format: "esm",
      jsx: "transform",
      logLevel: "silent",
      plugins: [
        {
          name: "stand-ins",
          setup(b) {
            b.onResolve({ filter: /.*/ }, (a) => (a.importer === path && !(keep && keep.test(a.path)) ? { path: a.path, namespace: "stand-in" } : undefined));
            b.onLoad({ filter: /.*/, namespace: "stand-in" }, (a) => {
              const from = a.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const names = (text.match(new RegExp(`^import (?:\\w+, )?\\{([^}]*)\\} from "${from}";$`, "m"))?.[1] ?? "").split(",").map((n) => n.trim()).filter(Boolean);
              return { contents: [...names.map((n) => `export const ${n} = () => undefined;`), "export default () => null;"].join("\n"), loader: "js" };
            });
          },
        },
      ],
    });
    return import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
  };

  // --- #0 The reflection's draft and the notes below it -------------------------
  const { mergeDraft } = await helpersOf("src/components/day/ReflectionFlow.jsx");
  const blank = { godsHand: "", qSavior: "", qLearn: "", thoughts: "" };
  const typed = Date.parse("2026-11-02T22:00:30-07:00");
  const noteAt = Date.parse("2026-11-02T22:01:10-07:00");
  // Card 3 written without tapping Next; then a stress note autosaves and stamps the journal row.
  const kept = { ...blank, godsHand: "At dinner" };
  const draft = { answers: { ...kept, qLearn: "A whole paragraph" }, base: kept, at: typed };
  ok("a note saved after the reflection was typed doesn't throw the reflection's draft away", mergeDraft(kept, draft, noteAt).qLearn === "A whole paragraph" && mergeDraft(kept, draft, noteAt).godsHand === "At dinner");
  const failed = { answers: { ...blank, qSavior: "Kept on this phone" }, base: blank, at: typed };
  ok("nor words a failed save left on the phone, once a God note saves later", mergeDraft(blank, failed, noteAt).qSavior === "Kept on this phone");
  const elsewhere = { answers: { ...blank, godsHand: "Phone's old words", thoughts: "New here" }, base: { ...blank, godsHand: "Phone's old words" }, at: noteAt };
  const fromLaptop = mergeDraft({ ...blank, godsHand: "Rewritten on the laptop" }, elsewhere, typed);
  ok("an answer saved elsewhere since stands over one the draft never touched, however new the draft", fromLaptop.godsHand === "Rewritten on the laptop" && fromLaptop.thoughts === "New here", JSON.stringify(fromLaptop));
  ok("a box you cleared here stays cleared", mergeDraft({ ...blank, thoughts: "Old" }, { answers: { ...blank, thoughts: "" }, base: { ...blank, thoughts: "Old" }, at: typed }, noteAt).thoughts === "");
  const both = (at, mine, now) => mergeDraft({ ...blank, qLearn: now }, { answers: { ...blank, qLearn: mine }, base: blank, at }, Date.parse("2026-11-02T22:00:00-07:00")).qLearn;
  ok("both changed: the newer one, or the draft when it only adds to what's saved", both(typed, "Phone", "Laptop") === "Phone" && both(Date.parse("2026-11-02T21:00:00-07:00"), "Phone", "Laptop") === "Laptop" && both(Date.parse("2026-11-02T21:00:00-07:00"), "Laptop, and more", "Laptop") === "Laptop, and more");
  // A draft written before drafts said where they started: { answers, at }.
  const old = { answers: { godsHand: "Older words", qSavior: "", qLearn: "Only here", thoughts: "" }, at: typed };
  const fromOld = mergeDraft({ ...blank, godsHand: "Saved since", qSavior: "Saved too" }, old, noteAt);
  ok("an old draft still loads: what's only on the phone is kept, a newer saved answer stands, a blank never blanks one", fromOld.qLearn === "Only here" && fromOld.godsHand === "Saved since" && fromOld.qSavior === "Saved too", JSON.stringify(fromOld));
  ok("and where the old draft is newer, it wins as it did", mergeDraft({ ...blank, godsHand: "Saved" }, { ...old, at: noteAt }, typed).godsHand === "Older words");
  ok("no draft, or one that isn't one, starts from what's saved", mergeDraft(kept, null, 0) === kept && mergeDraft(kept, { answers: "x" }, 0) === kept && mergeDraft(kept, { answers: { qLearn: 5 } }, 0).qLearn === "");
  const flowSrc = read("src/components/day/ReflectionFlow.jsx");
  ok("the draft is written with what the Hub held, and again once a save moves that", /writeDraft\(userId, date, answers, saved\.current, typedAt\.current\)/.test(flowSrc) && /if \(same\(latest\.current, saved\.current\)\) clearDraft\(userId, date\);\s*else writeDraft\(userId, date, latest\.current, saved\.current, typedAt\.current\);/.test(flowSrc));
  ok("the journal row's updated_at alone no longer throws a draft away", !/draft\.at > savedAt\) return/.test(flowSrc) && /mergeDraft\(saved, draft, savedAt\)/.test(flowSrc));

  // --- #2, #4, #15 Switching Short and Full -----------------------------------------
  const evening = read("src/pages/Evening.jsx");
  const sw = evening.slice(evening.indexOf("const setShort = async"), evening.indexOf("// A win captured"));
  ok("switching waits for the focus arrows, then every other card being left, tonight's shots included", /await flushFocus\.current\?\.\(\);\s*await Promise\.all\(leaving\.map\(\(flush\) => flush\?\.\(\)\)\);/.test(sw) && /short \? \[flushShots\.current, flushShort\.current\] : \[flushShots\.current, flushTasks\.current, flushCheckin\.current\]/.test(sw), sw.slice(0, 400));
  ok("a save that fails keeps you on the card, and says so", !/allSettled/.test(sw) && sw.indexOf("saved = false") > 0 && sw.indexOf("if (!saved) {") < sw.indexOf("setShortState(v)") && /didn't save yet, so this stays open/.test(sw));
  ok("the other card opens only once the day is read again", sw.indexOf("await reload()") > sw.indexOf("Promise.all(leaving") && sw.indexOf("setShortState(v)") > sw.indexOf("await reload()") && /if \(!fresh\) \{/.test(sw));
  ok("one switch at a time, and the toggle says it's busy", /if \(v === short \|\| switchingRef\.current\) return;/.test(sw) && (evening.match(/disabled=\{switching\}/g) ?? []).length === 2);
  ok("the switch's words have no dashes in them", !/—|–/.test(sw.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")));

  // --- #8, #24, #9, #25 Saving checks twice, and a kept focus -----------------------
  const apiPath = fileURLToPath(new URL("../src/lib/api.js", import.meta.url));
  const apiBuilt = await esbuildBundle({
    entryPoints: [apiPath],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    logLevel: "silent",
    plugins: [
      {
        name: "stand-in client",
        setup(b) {
          b.onResolve({ filter: /^\.\/supabaseClient$/ }, (a) => (a.importer === apiPath ? { path: "client", namespace: "stand-in" } : undefined));
          b.onLoad({ filter: /.*/, namespace: "stand-in" }, () => ({
            contents: `import { PostgrestClient } from "@supabase/postgrest-js";
export const supabase = new PostgrestClient("https://hub.test/rest/v1", { fetch: (...a) => globalThis.__batchCFetch(...a) });`,
            loader: "js",
            resolveDir: fileURLToPath(new URL("../src/lib", import.meta.url)),
          }));
        },
      },
    ],
  });
  const api = await import(`data:text/javascript;base64,${Buffer.from(apiBuilt.outputFiles[0].text).toString("base64")}`);
  // A small database: the rows each table holds, filtered the way PostgREST does.
  let db = {};
  let next = 0;
  let failWhen = () => false;
  const sent = [];
  const matches = (row, [col, expr]) => {
    const [op, ...rest] = expr.split(".");
    const v = rest.join(".");
    if (op === "eq") return String(row[col]) === v;
    if (op === "is") return v === "null" ? row[col] == null : String(row[col]) === v;
    if (op === "in") return v.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(row[col]));
    return true;
  };
  globalThis.__batchCFetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").pop();
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    sent.push({ table, method, body });
    const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    if (failWhen({ table, method, body })) return json(500, { message: "dropped", code: "XX000" });
    const filters = [...url.searchParams].filter(([k]) => !["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k));
    const rows = (db[table] ??= []);
    const hit = rows.filter((r) => filters.every((f) => matches(r, f)));
    let out = [];
    if (method === "GET") out = [...hit].sort((x, y) => (x.position ?? 0) - (y.position ?? 0));
    else if (method === "POST") {
      out = (Array.isArray(body) ? body : [body]).map((r) => ({ id: `new${++next}`, retired_on: null, ...r }));
      rows.push(...out);
    } else if (method === "PATCH") {
      for (const r of hit) Object.assign(r, body);
      out = hit;
    } else if (method === "DELETE") {
      db[table] = rows.filter((r) => !hit.includes(r));
      out = hit;
    }
    const one = (new Headers(init.headers).get("Accept") ?? "").includes("vnd.pgrst.object");
    return json(200, one ? out[0] ?? null : out);
  };
  const check = (id, parent, text, position, more = {}) => ({ id, user_id: "u", ...parent, text, kind: "yn", options: [], pass: { on: "yes" }, unit: null, auto: null, counts: true, focus_id: null, position, retired_on: null, ...more });
  const live = (table, col, id) => (db[table] ?? []).filter((r) => r[col] === id && !r.retired_on).sort((x, y) => x.position - y.position);
  const says = (list) => JSON.stringify(list.map((r) => [r.text, r.position]));
  const pages = { id: null, text: "Pages read", kind: "number", options: [], pass: { min: 10 }, unit: "pages", auto: null, counts: true, focus_id: null };

  // FocusSettings: a new check above "Up by 4:35". The insert lands, then
  // moving "Up by" down doesn't (or Save's next step, the settings, fails).
  db = { focus_checks: [check("c1", { goal_id: "g1" }, "Up by 4:35", 0, { kind: "time", pass: { by: "04:35" }, auto: "wake" })] };
  let before = db.focus_checks.map((r) => ({ ...r }));
  let rows = [{ ...pages }, { ...before[0] }];
  failWhen = ({ table, method }) => table === "focus_checks" && method === "PATCH";
  const first = await api.saveFocusChecks("u", "g1", rows, before).then(() => null, (err) => err);
  ok("(a focus's first Save fails after its insert)", Boolean(first) && live("focus_checks", "goal_id", "g1").length === 2);
  failWhen = () => false;
  sent.length = 0;
  await api.saveFocusChecks("u", "g1", rows, before);
  ok("Save tapped again asks the new check once, in its place", says(live("focus_checks", "goal_id", "g1")) === '[["Pages read",0],["Up by 4:35",1]]', says(live("focus_checks", "goal_id", "g1")));
  ok("and inserts nothing the second time", !sent.some((s) => s.method === "POST"), JSON.stringify(sent.map((s) => s.method)));
  sent.length = 0;
  await api.saveFocusChecks("u", "g1", rows, before);
  ok("a third tap, after the checks all saved and the settings didn't, writes nothing new", says(live("focus_checks", "goal_id", "g1")) === '[["Pages read",0],["Up by 4:35",1]]' && !sent.some((s) => s.method === "POST" || s.method === "PATCH"), JSON.stringify(sent.map((s) => s.method)));
  // Two of the same new check in one Save, and one more added before the retry.
  db = { focus_checks: [] };
  rows = [{ ...pages }, { ...pages }];
  failWhen = ({ method }) => method === "PATCH";
  await api.saveFocusChecks("u", "g2", rows, []);
  rows = [{ ...pages }, { ...pages }, { ...pages, text: "Glasses of water", unit: null }];
  await api.saveFocusChecks("u", "g2", rows, []);
  ok("each copy you asked for is one row, and a check added since still goes in", says(live("focus_checks", "goal_id", "g2")) === '[["Pages read",0],["Pages read",1],["Glasses of water",2]]', says(live("focus_checks", "goal_id", "g2")));
  failWhen = () => false;
  // Taken off and added again in the same Save: the old one goes, the new one is in.
  db = { focus_checks: [check("c9", { goal_id: "g3" }, "Pages read", 0, { kind: "number", pass: { min: 10 }, unit: "pages" })] };
  await api.saveFocusChecks("u", "g3", [{ ...pages }], db.focus_checks.map((r) => ({ ...r })));
  ok("a check taken off and written again is one new row, not the old one kept", says(live("focus_checks", "goal_id", "g3")) === '[["Pages read",0]]' && live("focus_checks", "goal_id", "g3")[0].id !== "c9");
  // One you didn't touch, changed on another device while the sheet was open, is still left alone.
  db = { focus_checks: [check("c5", { goal_id: "g4" }, "Exercised", 0)] };
  before = db.focus_checks.map((r) => ({ ...r }));
  db.focus_checks[0].text = "Exercised 20 min";
  await api.saveFocusChecks("u", "g4", [{ ...before[0] }, { ...pages }], before);
  ok("a check you didn't touch here isn't written over", says(live("focus_checks", "goal_id", "g4")) === '[["Exercised 20 min",0],["Pages read",1]]', says(live("focus_checks", "goal_id", "g4")));
  // TargetSheet: the same, through the target's setup.
  db = { mark_targets: [{ id: "t1", user_id: "u", goal_id: "G", reasons: ["a", "b", "c", "d"] }], mark_aims: [check("a1", { target_id: "t1" }, "Exercised", 0)] };
  before = db.mark_aims.map((r) => ({ ...r }));
  const aims = [{ ...pages, text: "Prayed", kind: "yn", pass: { on: "yes" }, unit: null }, { ...before[0] }];
  failWhen = ({ table, method }) => table === "mark_aims" && method === "PATCH";
  await api.saveTargetSetup("u", { goal_id: "G" }, { reasons: ["a", "b", "c", "d"], aims }, before).catch(() => null);
  failWhen = () => false;
  await api.saveTargetSetup("u", { goal_id: "G" }, { reasons: ["a", "b", "c", "d"], aims }, before);
  ok("a target's Save tapped again after a failure asks each check once", says(live("mark_aims", "target_id", "t1")) === '[["Prayed",0],["Exercised",1]]', says(live("mark_aims", "target_id", "t1")));

  // Keep on Sunday: the goal lands, its checks don't.
  db = { focus_goals: [{ id: "last", user_id: "u", lands_by: "checks", quest_id: null, lesson_id: null }], focus_checks: [check("k1", { goal_id: "last" }, "Up by 4:35", 0)] };
  failWhen = ({ table, method }) => table === "focus_checks" && method === "POST";
  const kept1 = await api.addFocusGoal("u", { weekStart: "2026-11-02", title: "Up early", carriedFrom: "last" }).then(() => null, (err) => err);
  ok("a kept focus whose checks can't follow it isn't left half added", Boolean(kept1) && (db.focus_goals ?? []).length === 1 && db.focus_goals[0].id === "last", JSON.stringify(db.focus_goals));
  failWhen = () => false;
  const kept2 = await api.addFocusGoal("u", { weekStart: "2026-11-02", title: "Up early", carriedFrom: "last" });
  ok("so Keep tapped again makes the one copy, with its checks", db.focus_goals.length === 2 && live("focus_checks", "goal_id", kept2.id).length === 1 && kept2.lands_by === "checks");
  failWhen = ({ table, method }) => table === "focus_checks" || (table === "focus_goals" && method === "DELETE");
  const undoFailed = await api.addFocusGoal("u", { weekStart: "2026-11-02", title: "Again", carriedFrom: "last" }).then(() => null, (err) => err);
  ok("if taking it back fails too, the add still says it didn't go through", Boolean(undoFailed) && /dropped/.test(undoFailed?.message ?? ""));
  failWhen = () => false;
  delete globalThis.__batchCFetch;

  // --- #19, #21 The check editor ---------------------------------------------------------
  const E = await helpersOf("src/components/checks/CheckEditor.jsx", /\/lib\/checks$/);
  const editorSrc = read("src/components/checks/CheckEditor.jsx");
  const scale = { key: "k", id: "a", text: "Did I do my best to be present", kind: "scale", options: [], pass: { min: null }, unit: null, auto: null, counts: true, focus_id: null };
  ok("a cleared 1 to 10 box saves as 7, and 78 typed into it saves as 10", E.cleanRows([scale])[0].pass.min === 7 && E.cleanRows([{ ...scale, pass: { min: 78 } }])[0].pass.min === 10 && E.cleanRows([{ ...scale, pass: { min: 8 } }])[0].pass.min === 8);
  ok("the number boxes hold what you type, and nothing while empty", /value=\{r\.pass\.min \?\? ""\} placeholder="7" onChange=\{\(e\) => set\(\{ pass: \{ min: typed\(e\) \} \}\)\}/.test(editorSrc) && /const typed = \(e\) => \(e\.target\.value === "" \? null : Number\(e\.target\.value\)\);/.test(editorSrc) && !/\? 7 : Number|\? 0 : Number/.test(editorSrc));
  const num = { ...scale, text: "Pages read", kind: "number", pass: { min: null }, unit: "pages" };
  ok("a cleared count saves at its default, and an emptied at-most asks rather than flipping to at least", E.cleanRows([num])[0].pass.min === 1 && E.rowsProblem([num]) === null && /at most/.test(E.rowsProblem([{ ...num, pass: { max: null } }]) ?? "") && E.rowsProblem([{ ...num, pass: { max: 3 } }]) === null && E.rowsProblem([{ ...num, pass: { max: null }, counts: false }]) === null);
  ok("an emptied at-most box stays at most while you type", /const most = atMost\(r\);/.test(editorSrc) && /hasOwnProperty\.call\(r\.pass, "max"\)/.test(editorSrc));
  const yn = { ...scale, kind: "yn", pass: { on: "yes" } };
  const roundTrip = E.rekind(E.rekind(yn, "note"), "yn");
  ok("A few words and back counts again", E.rekind(yn, "note").counts === false && roundTrip.counts === true);
  ok("a check's own Reflection only stays as set when its kind changes", E.rekind({ ...yn, counts: false }, "scale").counts === false);
  const logged = { ...scale, kind: "minutes", pass: { min: 30 }, focus_id: "f-kids" };
  ok("a kind the time log can't answer drops the time log", E.rekind(logged, "scale").focus_id === null && E.rekind(logged, "number").focus_id === null && E.rekind(logged, "yn").focus_id === "f-kids");
  ok("and only a time keeps Fill from when I got up, a number its unit, a pick one its choices", E.rekind({ ...yn, kind: "time", auto: "wake" }, "yn").auto === null && E.rekind({ ...yn, kind: "time", auto: "wake" }, "time").auto === "wake" && E.cleanRows([E.rekind(num, "minutes")])[0].unit === null && E.cleanRows([E.rekind({ ...yn, kind: "choice", options: ["Calm", "Short"] }, "yn")])[0].options.length === 0);
  ok("trying another kind and coming back keeps the choices and the unit", E.rekind(E.rekind({ ...yn, kind: "choice", options: ["Calm", "Short"] }, "yn"), "choice").options.join() === "Calm,Short" && E.rekind(E.rekind(num, "minutes"), "number").unit === num.unit);
  ok("the kind picker goes through it", /onChange=\{\(e\) => set\(r\.key, \{ \.\.\.rekind\(r, e\.target\.value\), key: r\.key, id: r\.id \}\)\}/.test(editorSrc));

  // --- #20, #22 The editor's checkboxes inside a .field, and long words -------------------
  const checksCss = read("src/styles/checks.css");
  const rule = (sel) => checksCss.slice(checksCss.indexOf(sel), checksCss.indexOf("}", checksCss.indexOf(sel)));
  const box = rule('.ck-edit .ck-edit__toggle input[type="checkbox"] {');
  ok("the editor's checkbox outweighs .field input: its own size, no fill, beside its words", checksCss.includes('.ck-edit .ck-edit__toggle input[type="checkbox"] {') && /width: auto;/.test(box) && /background: none;/.test(box) && /padding: 0;/.test(box));
  ok("and its labels outweigh .field label", /\.ck-edit \.ck-edit__grid label,\s*\.ck-edit \.ck-edit__toggle \{ display: inline-flex;[^}]*margin: 0;/.test(checksCss));
  ok("a question that's one long link wraps instead of running off the card", /\.ck-row__text \{[^}]*overflow-wrap: anywhere;/.test(checksCss) && /\.ck-choices \.chip,\s*\.ck-edit__opts \.chip \{ white-space: normal; overflow-wrap: anywhere;/.test(checksCss));
}

// (end of review fixes, batch C)
// ---------------------------------------------------------------------------


// ===== Tonight's checks on each target (PR 2, part 1) =====
// Add this part's tests directly under the line above.
{
  console.log("\ntonight's checks on each target");
  // Imported here rather than up top, so this part's names stay in this part.
  const M = await import("../src/lib/mark.js");
  const at = (h, m) => new Date(2026, 10, 2, h, m).toISOString();
  const drawing = { id: "f-draw", name: "Drawing", categories: ["Drawing"] };
  const byId = new Map([[drawing.id, drawing]]);
  const logged = [
    { tags: ["Drawing"], duration_minutes: 25, ended_at: at(18, 25) },
    { tags: ["Drawing"], category: "Drawing", description: "Drawing", duration_minutes: 20, source: "watch", ended_at: at(19, 20) },
  ];
  const drew = { id: "m", text: "Time drawing", kind: "minutes", pass: { min: 30 }, focus_id: "f-draw" };
  const upBy = { id: "u", text: "Up by 4:35", kind: "time", pass: { by: "04:35" }, auto: "wake" };

  const hint = M.checkHint(drew, { focusesById: byId, entries: logged });
  ok("a check the time log answers says how much it saw, and what the watch did", hint.startsWith("Time log · 45m") && hint.includes(" · watch: "), hint);
  ok("and says so when the log has nothing", M.checkHint(drew, { focusesById: byId, entries: [] }) === "Not in your time log today");
  ok("Up by says it came from when you got up", M.checkHint(upBy, { dayPlan: { woke_at: at(4, 32) } }) === "From when you got up" && M.checkHint(upBy, { entries: [] }) === "No wake time in your log");
  ok("a check only you answer has no hint", M.checkHint({ id: "a", text: "Exercised", kind: "yn" }, { focusesById: byId, entries: logged }) === null);

  const T = {
    key: "g1",
    aims: [
      { id: "a", text: "Exercised", kind: "yn" },
      { id: "b", text: "Did I do my best to listen", kind: "scale", pass: { min: 7 } },
      { id: "c", text: "Pages", kind: "number", pass: { min: 10 }, unit: "pages" },
      { id: "d", text: "Where", kind: "choice", options: ["Home", "Out"], pass: { on: ["Home"] } },
      { id: "e", text: "Examen", kind: "note" },
    ],
  };
  const blank = T.aims.map(() => ({ value: null, line: "" }));
  const back = M.restoreAnswers(T, blank, { a: { value: "yes", line: "ran" }, b: { value: 6 }, c: { value: 12 }, d: { value: "Home" }, e: { value: "the walk" } });
  ok("a draft on this device fills tonight back in, a line and all", back.map((x) => x.value).join() === "yes,6,12,Home,the walk" && back[0].line === "ran");
  const misfit = M.restoreAnswers(T, blank, { a: { value: "some" }, b: { value: 11 }, c: { value: "lots" }, d: { value: "Gone" }, e: { value: 5 } });
  ok("anything in it that doesn't fit its check now is passed over", misfit.every((x) => x.value === null));
  ok("a draft of any other shape changes nothing", [null, "x", [1, 2], { a: "yes" }, { a: [1] }, { a: { value: { v: 2 } } }].every((m) => JSON.stringify(M.restoreAnswers(T, blank, m)) === JSON.stringify(blank)));
  ok("it's matched by check, not by place, so reordered checks keep their answers", M.restoreAnswers({ aims: [T.aims[2], T.aims[0]] }, [{ value: null, line: "" }, { value: null, line: "" }], { a: { value: "no" }, c: { value: 3 } }).map((x) => x.value).join() === "3,no");
  ok("a cleared answer falls back to what the day knows", M.restoreAnswers({ aims: [upBy] }, [{ value: "04:32", line: "" }], { u: { value: null, line: "" } })[0].value === "04:32");

  // What a draft looked like before checks had kinds: Yes/Some/No by place.
  const oldShape = { values: [2, 1, 0, 2, 2], line: "old line" };
  const fromOld = M.tonightDraft(T, { mine: oldShape });
  ok("an old-shaped draft never gets an answer in", fromOld.answers.every((x) => x.value === null) && fromOld.quick === null && fromOld.pick === null);
  const savedShot = { level: 2, reason: 1, reason_how: "read", note: "phone", answers: [{ aim: "a", text: "Exercised", kind: "yn", value: "yes", v: 2 }] };
  const fromSaved = M.tonightDraft({ ...T, tonight: savedShot }, { mine: { answers: { a: { value: "no" } }, line: "draft" } });
  ok("tonight's saved shot wins over a draft, with its section and its line already read", fromSaved.answers[0].value === "yes" && fromSaved.line === "phone" && fromSaved.pick.k === 1 && fromSaved.readFor === "phone");
  const fromTap = M.tonightDraft({ ...T, tonight: M.quickShot(T, 1, [], { reason: 0, how: "guess" }) });
  ok("a short evening's tap comes back as the tap", fromTap.quick === 1 && fromTap.pick.k === 0 && fromTap.readFor === null);

  const R = {
    aims: [
      { id: "a", text: "Exercised", kind: "yn" },
      { id: "n", text: "Drank caffeine", kind: "yn", pass: { on: "no" } },
      { id: "b", text: "Did I do my best to listen", kind: "scale", pass: { min: 7 } },
      { id: "e", text: "Examen", kind: "note" },
      upBy,
    ],
  };
  const win = { id: "w1", title: "Win by win" };
  const heard = M.readAnswers(R, [{ value: "yes" }, { value: "no" }, { value: 6 }, { value: "the walk" }, { value: null }], [{ goal: win, level: 1 }]);
  ok(
    "the line's reader hears each answer as it reads Yes, Some or No",
    heard.length === 4 &&
      heard[0].text === "Exercised" &&
      heard[0].v === 2 &&
      heard[1].text === "Drank caffeine (No)" &&
      heard[1].v === 2 &&
      heard[2].text === "Did I do my best to listen (6/10)" &&
      heard[2].v === 1 &&
      heard[3].text === "This week's focus, Win by win (inner)" &&
      heard[3].v === 1,
    JSON.stringify(heard)
  );
  ok("reflection-only and unanswered checks aren't sent", !heard.some((a) => a.text.startsWith("Examen") || a.text.startsWith("Up by")));
  // The reader's own filter (supabase/functions/mark/index.ts), as it stands.
  const readerKeeps = (list) =>
    list
      .slice(0, 8)
      .map((a) => ({ text: String(a?.text ?? "").slice(0, 120), v: Number(a?.v) }))
      .filter((a) => a.text && [0, 1, 2].includes(a.v));
  const many = { aims: Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, text: `${"A long way of asking it ".repeat(7)}${i}`, kind: "scale", pass: { min: 7 } })) };
  const loud = M.readAnswers(many, many.aims.map((_, i) => ({ value: (i % 10) + 1 })));
  ok("and what it's sent passes the reader untouched: eight at most, the answer kept inside 120 characters", loud.length === 8 && JSON.stringify(readerKeeps(loud)) === JSON.stringify(loud) && loud.every((a) => a.text.length <= 120 && /…\s\(\d+\/10\)$/.test(a.text)));
  const markFn = readFileSync(new URL("../supabase/functions/mark/index.ts", import.meta.url), "utf8");
  ok("the reader still takes { text, v } with v of 0, 1 or 2, so it needs no redeploy", /\.slice\(0, 8\)/.test(markFn) && /\[0, 1, 2\]\.includes\(a\.v\)/.test(markFn) && /String\(a\?\.text \?\? ""\)\.slice\(0, 120\)/.test(markFn));

  const S = { key: "g", kind: "goal", ref: { id: "g" }, shots: [], aims: [{ id: "a", text: "Exercised", kind: "yn" }, { id: "p", text: "Pages", kind: "number", pass: { min: 10 }, unit: "pages" }] };
  const mine = M.shotFrom(S, [{ value: "yes", line: "ran" }, { value: 9 }], { line: "good", reason: 1, how: "read" });
  const readBack = { id: "row", target_id: "t", date: "2026-11-02", loosed_at: null, note: "good", reason_how: "read", reason: 1, level: mine.level, answers: mine.answers.map((a) => Object.fromEntries(Object.entries(a).reverse())) };
  ok("a shot read back with its keys in another order is the same shot", mine.level === 1 && M.sameShot(readBack, mine));
  ok(
    "a different answer, line, section or ring is not",
    !M.sameShot(readBack, M.shotFrom(S, [{ value: "yes", line: "ran" }, { value: 8 }], { line: "good", reason: 1, how: "read" })) &&
      !M.sameShot(readBack, M.shotFrom(S, [{ value: "yes" }, { value: 9 }], { line: "good", reason: 1, how: "read" })) &&
      !M.sameShot(readBack, { ...mine, note: "better" }) &&
      !M.sameShot(readBack, { ...mine, reason: 2 }) &&
      !M.sameShot(readBack, { ...mine, level: 2 })
  );
  ok("nothing saved yet is never the same", !M.sameShot(null, mine) && !M.sameShot(mine, null));
  ok("where it lands reads plainly", M.landsText(0) === "All passed: a bullseye." && M.landsText(1) === "Lands in the inner ring." && M.landsText(4) === "Lands on the edge." && M.landsText(5) === "A miss this time." && M.landsText(null) === "");

  ok("the short evening's tap sets the ring, whatever the checks say", (() => {
    const r = M.tonightRing(S, { answers: [{ value: "yes" }, { value: 12 }], quick: 0 });
    return r.level === 5 && r.tap === 0 && r.label === null;
  })());
  ok("with no tap, checks all answered say so", M.tonightRing(S, { answers: [{ value: "yes" }, { value: 9 }] }).label === "Inner, from your checks");
  ok("a target fed only by a focus says which", M.tonightRing({ aims: [] }, { answers: [] }, [{ goal: win, level: 2 }]).label === "Middle, from Win by win");
  ok(
    "and nothing answered is no ring, never a made-up one",
    M.tonightRing(S, { answers: [{ value: "yes" }, { value: null }] }).level === null && M.tonightRing({ aims: [{ id: "e", text: "Examen", kind: "note" }] }, { answers: [{ value: "the walk" }] }).level === null
  );

  const full = M.tonightShot(S, { answers: [{ value: "no" }, { value: 12 }], line: "  tired  ", pick: null }, { linked: [{ goal: win, level: 0 }], today: "2026-11-02" });
  ok(
    "tonight's shot counts the focus as one more check, guesses a section with nothing to go on, and keeps the line",
    full.level === 2 && full.reason === 0 && full.reason_how === "guess" && full.note === "tired" && full.answers.length === 3 && full.answers[2].focus_goal === "w1"
  );
  const tapped = M.tonightShot(S, { answers: [{ value: "no" }, { value: null }], line: "written in the full evening", quick: 1, pick: { k: 2, how: "yours" } }, { today: "2026-11-02" });
  ok(
    "a short evening's tap keeps a line from the full one and the section you picked",
    tapped.level === 2 && tapped.note === "written in the full evening" && tapped.reason === 2 && tapped.reason_how === "yours" && M.quickOf(tapped) === 1 && tapped.answers.length === 2 && tapped.answers[1].counts === false
  );
  ok(
    "a bullseye has no section, and no tap with a check unanswered is no shot",
    M.tonightShot(S, { answers: [{ value: "yes" }, { value: 12 }], line: "", pick: { k: 3, how: "yours" } }).reason === null && M.tonightShot(S, { answers: [{ value: "yes" }, { value: null }], line: "" }) === null
  );

  // The Range's edits live in the Targets tab's shared hook now (PR 3).
  const ascentSrc = readFileSync(new URL("../src/components/targets/useLadder.jsx", import.meta.url), "utf8");
  const saveFrom = ascentSrc.slice(ascentSrc.indexOf("const saveTargetFrom"), ascentSrc.indexOf("saveTargetSetup(userId"));
  ok("taking out a check answered only tonight retires it: every shot counts, loosed or not", /data\?\.marks\?\.shots/.test(saveFrom) && !/t\.shots\.flatMap/.test(saveFrom));
  const shotsSrc = readFileSync(new URL("../src/components/mark/TonightShots.jsx", import.meta.url), "utf8");
  ok("tonight's draft has a key of its own, and the old one is only ever cleared", /hub\.mark\.checks\.\$\{date\}/.test(shotsSrc) && /removeItem\(`hub\.mark\.tonight\.\$\{date\}`\)/.test(shotsSrc) && !/getItem\(`hub\.mark\.tonight/.test(shotsSrc));
}

// (end of tonight's checks)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

// ===== Arrows on the week's focus (PR 2, part 2) =====
// Add this part's tests directly under the line above.
{
  console.log("\ntonight's arrow on each focus: placed, landed by its checks, and kept");
  const F = await import("../src/lib/focus.js");
  const D = "2026-11-02";

  // The week as it reads with arrows.
  ok("a week reads in arrows", F.arrowsLabel({ answeredDays: 3 }) === "3 arrows this week" && F.arrowsLabel({ answeredDays: 1 }) === "1 arrow this week" && F.arrowsLabel({ answeredDays: 0 }) === "No arrows yet" && F.arrowsLabel({}) === "No arrows yet");
  const weekRows = [
    { goal_id: "g", date: "2026-11-01", moved: true, level: 1 },
    { goal_id: "g", date: D, moved: true, level: 2, spot_x: 30, spot_y: 30 },
    { goal_id: "h", date: D, moved: false, level: 5 },
  ];
  const placed = F.putArrow(weekRows, "g", D, { level: 5, spot_x: 0, spot_y: 90, note: "off", answers: [], lands: "placed" });
  ok("placing again replaces that day's arrow, and only that day's", placed.length === 3 && placed.filter((c) => c.goal_id === "g" && c.date === D).length === 1 && placed.find((c) => c.goal_id === "h").level === 5 && placed.find((c) => c.date === "2026-11-01").level === 1);
  const moved = placed.find((c) => c.goal_id === "g" && c.date === D);
  ok("the row it puts in reads as the database keeps it, moved and all", moved.moved === false && moved.spot_y === 90 && moved.note === "off" && moved.lands === "placed");
  ok("an arrow on the face moved it", F.putArrow([], "g", D, { level: 4 })[0].moved === true && F.putArrow([], "g", D, { level: 0 })[0].moved === true);
  ok("taking it back leaves the day empty", F.putArrow(weekRows, "g", D, null).every((c) => !(c.goal_id === "g" && c.date === D)) && F.putArrow(weekRows, "g", D, null).length === 2);
  ok("a date with a time on it is still that day", F.putArrow([{ goal_id: "g", date: `${D}T00:00:00`, level: 1 }], "g", D, null).length === 0);
  ok("the week it was given is left alone", weekRows.length === 3 && weekRows[1].level === 2);

  // A read of the week while saves are still out.
  const fresh = [{ goal_id: "g", date: D, moved: true, level: 2, spot_x: 30, spot_y: 30 }];
  const over = F.withPending(fresh, [{ goalId: "g", date: D, arrow: { level: 0, spot_x: 1, spot_y: 1, lands: "placed" } }]);
  ok("a read that lands between two saves still shows the newest arrow", over.length === 1 && over[0].level === 0 && over[0].spot_x === 1);
  ok("an arrow taken back stays taken back while its delete is out", F.withPending(fresh, [{ goalId: "g", date: D, arrow: null }]).length === 0);
  ok("with nothing out, the read is the read", F.withPending(fresh, []) === fresh && F.withPending(undefined, []).length === 0);

  // Nothing to save when the saved arrow already is this one.
  const upBy = { id: "u", goal_id: "g", text: "Up by 4:35", kind: "time", pass: { by: "04:35" }, auto: "wake" };
  const drew = { id: "d", goal_id: "g", text: "Time drawing", kind: "minutes", pass: { min: 30 }, focus_id: "f" };
  const twoChecks = [upBy, drew];
  const landed = F.landedArrow(twoChecks, [{ value: "04:30", line: "", day: true }, { value: 40, line: "good", day: false }]);
  // The database hands jsonb back with its keys in its own order, and a real spot as a float.
  const fromDb = JSON.parse(JSON.stringify({ ...landed, goal_id: "g", date: D, moved: true, updated_at: "2026-11-02T20:00:00Z" }));
  fromDb.answers = fromDb.answers.map((a) => Object.fromEntries(Object.entries(a).reverse()));
  ok("a saved arrow read back is the same arrow, whatever order its keys come in", F.sameArrow(fromDb, landed) && F.arrowKey(fromDb) === F.arrowKey(landed));
  const spotRow = { level: 2, spot_x: 10.300000190734863, spot_y: -38, note: null, answers: [], lands: "placed" };
  ok("a spot read back as a float is the same spot", F.sameArrow(spotRow, F.placedArrow({ x: 10.3, y: -38 })));
  ok("a new note, a new spot or a new answer is something to save", !F.sameArrow(spotRow, F.placedArrow({ x: 10.3, y: -38 }, "close")) && !F.sameArrow(spotRow, F.placedArrow({ x: 12, y: -38 })) && !F.sameArrow(fromDb, F.landedArrow(twoChecks, [{ value: "04:30", day: true }, { value: 45, line: "good" }])));
  ok("an old yes-or-no day isn't a placed arrow yet", !F.sameArrow({ goal_id: "g", date: D, moved: true }, F.placedArrow({ x: 0, y: -22 })));
  ok("no arrow is no arrow", F.sameArrow(null, null) && !F.sameArrow(null, spotRow) && !F.sameArrow(spotRow, null) && F.arrowKey(null) === null);

  // Which checks this week's arrows answered.
  const answeredIns = [
    { goal_id: "g", date: "2026-11-01", answers: [{ aim: "u", v: 2 }, { aim: "d", v: 1 }] },
    { goal_id: "g", date: D, answers: [{ aim: "u", v: 2 }, { aim: null, text: "x" }] },
    { goal_id: "h", date: D, answers: [{ aim: "other", v: 2 }] },
    { goal_id: "g", date: "2026-10-31", moved: true },
  ];
  const ans = F.answeredChecks(answeredIns, "g");
  ok("a check this week's arrows answered is retired when it's taken off, not deleted", ans.has("u") && ans.has("d") && !ans.has("other") && ans.size === 2);
  ok("an old yes-or-no day answered none", F.answeredChecks([{ goal_id: "g", moved: true }], "g").size === 0 && F.answeredChecks(undefined, "g").size === 0);

  // What the settings sheet saves.
  ok("checks as they were are nothing to save", !F.checksChanged([{ ...upBy }, { ...drew }], twoChecks));
  ok("a check reworded, moved, added or taken off is", F.checksChanged([{ ...upBy, text: "Up by 4:30" }, drew], twoChecks) && F.checksChanged([drew, upBy], twoChecks) && F.checksChanged([upBy, drew, { text: "Read", kind: "yn" }], twoChecks) && F.checksChanged([upBy], twoChecks));
  ok("and so is a new bar to pass", F.checksChanged([{ ...upBy, pass: { by: "04:30" } }, drew], twoChecks));

  // Tonight's answers to a focus's checks.
  const none = F.focusAnswers(twoChecks, null, { auto: ["04:32", 50] });
  ok("with nothing saved, the day answers what it can, marked as the day's", none[0].value === "04:32" && none[0].day === true && none[1].value === 50 && none[1].day === true);
  ok("and what it can't starts blank", F.focusAnswers(twoChecks, null, { auto: [null, null] }).every((a) => a.value === null && a.day === false && a.line === ""));
  const savedRow = {
    answers: [
      { aim: "u", text: "Up by 4:35", kind: "time", value: "04:40", v: 1, line: "alarm", day: true },
      { aim: "d", text: "Time drawing", kind: "minutes", value: 20, v: 1 },
    ],
  };
  const later = F.focusAnswers(twoChecks, savedRow, { auto: ["04:40", 55] });
  ok("an answer the day gave takes the day's newer one: the log caught up since noon", F.focusAnswers([drew], { answers: [{ aim: "d", value: 20, v: 1, day: true }] }, { auto: [55] })[0].value === 55);
  ok("an answer you gave yourself stays put however the day changes", later[1].value === 20 && later[1].day === false);
  ok("a line kept with an answer stays with it", later[0].line === "alarm" && later[0].day === true);
  ok("the day's answer, saved, holds while the day can't be read", F.focusAnswers([upBy], { answers: [{ aim: "u", value: "04:40", v: 1, day: true }] }, { auto: [null] })[0].value === "04:40");
  const mine = F.focusAnswers(twoChecks, savedRow, { auto: ["04:40", 55], mine: { d: { value: 35 }, u: { line: "late night" } } });
  ok("what you answer tonight wins over both", mine[1].value === 35 && mine[1].day === false);
  ok("a line added to the day's answer leaves the answer the day's", mine[0].value === "04:40" && mine[0].day === true && mine[0].line === "late night");
  ok("clearing an answer clears it, even one the day could fill", F.focusAnswers([drew], null, { auto: [50], mine: { d: { value: null } } })[0].value === null);
  const yn = { id: "y", goal_id: "g", text: "Kept the Sabbath", kind: "yn", pass: { on: "yes" } };
  ok("an old Some on what is now a Yes/No starts blank", F.focusAnswers([yn], { answers: [{ aim: "y", v: 1 }] })[0].value === null && F.focusAnswers([yn], { answers: [{ aim: "y", v: 2 }] })[0].value === "yes");

  const tonight = F.landedArrow(twoChecks, none);
  ok("a morning up on time and the drawing logged lands a bullseye by itself", tonight.level === 0 && tonight.lands === "checks" && tonight.spot_x === null);
  ok("each answer the day filled in is kept as the day's", tonight.answers.every((a) => a.day === true) && tonight.answers[0].aim === "u");
  const own = F.landedArrow(twoChecks, [{ value: "04:50", day: false }, { value: 40, day: true }], " slept in ");
  ok("one you answered isn't, and the note goes with it", own.answers[0].day === undefined && own.answers[1].day === true && own.note === "slept in" && own.level === 1);
  ok("no arrow until every check that scores is answered", F.landedArrow(twoChecks, [{ value: "04:30", day: true }, { value: null }]) === null);
  ok("reflection-only checks never hold it back", F.landedArrow([upBy, { id: "e", text: "Examen", kind: "note" }], [{ value: "04:30" }, { value: null }])?.level === 0);

  // What a focus counts toward, by name.
  const view = {
    goals: [{ id: "n1", title: "Discipline" }],
    quests: [{ id: "q1", title: "Ship the plugin" }],
    lessons: [{ id: "l1", title: "Patience" }],
  };
  const choices = F.towardChoices(view);
  ok("the choices are the Mark's targets: lifetime goals, quests, lessons", choices.map((c) => c.key).join() === "goal:n1,quest:q1,lesson:l1" && choices[1].title === "Ship the plugin" && F.towardChoices(null).length === 0);
  ok("what a focus counts toward fits in a select and comes back out", F.towardKey({ quest_id: "q1" }) === "quest:q1" && F.towardKey({ node_id: "n1" }) === "goal:n1" && F.towardKey({}) === "" && F.parseToward("lesson:l1").kind === "lesson" && F.parseToward("lesson:l1").id === "l1" && F.parseToward("") === null && F.parseToward("nonsense") === null);
  ok("each choice's key is what towardKey would say", choices.every((c) => F.towardKey({ [c.kind === "goal" ? "node_id" : `${c.kind}_id`]: c.id }) === c.key));
  ok("its name, from the Ascent view", F.towardTitle({ quest_id: "q1" }, view) === "Ship the plugin" && F.towardTitle({ lesson_id: "l1" }, view) === "Patience" && F.towardTitle({ node_id: "n1" }, view) === "Discipline");
  ok("a quest since finished is still found by name in the rows", F.towardTitle({ quest_id: "q9" }, view, { quests: [{ id: "q9", title: "Old quest" }] }) === "Old quest");
  ok("standing alone, or not found, it has no name", F.towardTitle({}, view) === null && F.towardTitle({ node_id: "deep" }, view, {}) === null);
  ok("a quest's id is never taken for a goal's", F.towardTitle({ node_id: "q1" }, view) === null);

  // The parts on screen, read as source (they're components).
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  const arrowsSrc = read("../src/components/focus/FocusArrows.jsx");
  const hookSrc = read("../src/components/focus/useFocusWeek.js");
  const sheetSrc = read("../src/components/focus/FocusSheet.jsx");
  const stripSrc = read("../src/components/focus/FocusStrip.jsx");
  const settingsSrc = read("../src/components/focus/FocusSettings.jsx");
  const weekSrc = read("../src/components/focus/FocusWeek.jsx");
  ok("the evening card takes the props the evening hands it", /export default function FocusArrows\(\{ userId, date, entries, dayPlan, quick = false, flushRef \}\)/.test(arrowsSrc));
  ok("its flush saves what's waiting on every focus, then waits for every save", /for \(const flush of \[\.\.\.flushers\.current\]\) flush\(\);[\s\S]{0,400}const done = await settled\(\);\s*if \(done\.includes\(false\)\) throw/.test(arrowsSrc));
  ok("the card says what it's for", arrowsSrc.includes("This week's focus") && arrowsSrc.includes("Put the arrow where today landed, or let its checks land it."));
  ok("a placed arrow saves where you put it, with its note", /save\(placedArrow\(\{ x, y \}, noteRef\.current\)\)/.test(arrowsSrc) && /arrowRef\.current\(goal\.id, date, next\)\.then/.test(arrowsSrc) && /Take tonight's arrow back/.test(arrowsSrc));
  ok("an arrow landed by checks saves only when it's ready and new (or its last save failed)", /const next = arrowToSave\(rowRef\.current, readyRef\.current, noteRef\.current, failedRef\.current\);\s*if \(next\) save\(next\);/.test(arrowsSrc));
  ok("a waiting note or answer saves when the sheet or card goes", /useEffect\(\(\) => \(\) => flush\(\), \[flush\]\)/.test(arrowsSrc));
  ok("the short evening has no settings, no lines and no note", /onSettings=\{quick \? null :/.test(arrowsSrc) && /onLine=\{quick \? undefined :/.test(arrowsSrc) && /const noteBox = !quick &&/.test(arrowsSrc));
  ok("saves for one goal and day go in line, and only the newest announces", /\(chains\.current\.get\(key\) \?\? Promise\.resolve\(\)\)\.then\(run\)/.test(hookSrc) && /if \(last\) announceChange\(\);/.test(hookSrc));
  ok("a fresh read of the week keeps the arrows still on their way", /withPending\(d\.checkins, \[\.\.\.pending\.current\.values\(\)\]\)/.test(hookSrc));
  ok("a failed save reads the week again and says so", /reload\(\);\s*toast\.error\(err, "Couldn't save that arrow\."\);/.test(hookSrc));
  ok("the old yes-or-no still saves, as an arrow", /setFocusCheckin\(userId, goalId, date, moved\)/.test(hookSrc) && /level: moved \? 1 : 5/.test(hookSrc));
  ok("checks this week answered are retired, today", /answered: answeredChecks\(data\?\.checkins, goalId\), today: todayStr\(\)/.test(hookSrc));
  ok("a focus's sheet lands today's arrow instead of asking Moved it or Not today", !/Moved it today|Not today/.test(sheetSrc) && /<GoalArrow/.test(sheetSrc) && /onSettings=\{\(\) => setSettings\(true\)\}/.test(sheetSrc));
  ok("the sheet's imports stay one line each, the way its tests read them", sheetSrc.split("\n").filter((l) => l.startsWith("import ")).every((l) => l.endsWith(";")));
  ok("the strip speaks in arrows", !/moved it|not today/i.test(stripSrc.replace(/^\/\/.*$/gm, "")) && /arrowsLabel\(g\)/.test(stripSrc) && /fw=\{fw\}/.test(stripSrc));
  ok("settings only send what changed, checks before how it lands", /if \(how === "checks" && checksChanged\(checks, before\)\) await fw\.saveChecks/.test(settingsSrc) && settingsSrc.indexOf("fw.saveChecks") < settingsSrc.indexOf("fw.saveSettings"));
  ok("an old link that isn't one of the choices stays a choice", /keepLinked && <option value=\{linked\}>/.test(settingsSrc));
  ok("Week links a focus to the wheel without breaking the one-link rule", /\{ node_id: nodeId, quest_id: null, lesson_id: null \}/.test(weekSrc) && /<FocusSettings/.test(weekSrc));
  ok("Sunday's carry still leaves a quest or lesson link to addFocusGoal", /const row = await add\(title, goal\.node_id, goal\.id\);/.test(weekSrc));
  const css = read("../src/styles/focus.css");
  ok("what a focus counts toward gives up its end before it widens the card", /\.focus-arrow__toward \{ max-width: 100%; min-width: 0; overflow: hidden;/.test(css));
  ok("the strip's measurements are still the first the stylesheet has", css.indexOf("--focus-gap:") < css.indexOf(".focus-arrow") && (css.match(/repeat\(auto-fill, minmax\(/g) ?? []).length === 1 && (css.match(/-webkit-line-clamp: 2;/g) ?? []).length === 0);
}

// (end of arrows on the week's focus)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

// ===== Before you bank it (PR 2, part 3) =====
// Add this part's tests directly under the line above.
{
  console.log("\nbefore you bank it (0103)");
  const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

  // --- The push sees each focus's arrows -------------------------------------
  const focusAim = (checkins, weekFocus = [{ id: "w1", title: "Win by win", position: 0 }]) => aimForPrompt({ date: "2026-11-02", weekFocus, checkins });
  const rings = focusAim([
    { goal_id: "w1", date: "2026-11-02", moved: false, level: 5, note: null },
    { goal_id: "w1", date: "2026-11-01", moved: true, level: 1, note: "up at 4:40, one snooze" },
    { goal_id: "w1", date: "2026-10-31", moved: true, level: 0 },
  ]).this_weeks_focus[0];
  ok(
    "each focus's arrows by day, oldest first, ring and his line",
    JSON.stringify(rings.arrows_this_week) === JSON.stringify(["2026-10-31 bullseye", "2026-11-01 inner ring: up at 4:40, one snooze", "2026-11-02 missed"]),
    JSON.stringify(rings)
  );
  ok("and the moved and not days still count, from the rings", rings.days_moved === 2 && rings.days_not === 1);
  const old = focusAim([
    { goal_id: "w1", date: "2026-10-28", moved: true },
    { goal_id: "w1", date: "2026-10-29", moved: false, level: null },
  ]).this_weeks_focus[0];
  ok("a day from before the rings reads as moved or didn't move", JSON.stringify(old.arrows_this_week) === JSON.stringify(["2026-10-28 moved", "2026-10-29 didn't move"]) && old.days_moved === 1 && old.days_not === 1, JSON.stringify(old));
  ok("the ring wins over moved when a row has both", focusAim([{ goal_id: "w1", date: "2026-11-01", moved: true, level: 3 }]).this_weeks_focus[0].arrows_this_week[0] === "2026-11-01 outer ring");
  ok(
    "a check-in from outside the week, or another focus's, stays out",
    focusAim([
      { goal_id: "w1", date: "2026-10-20", moved: true, level: 0 },
      { goal_id: "other", date: "2026-11-01", moved: true, level: 0 },
    ]).this_weeks_focus[0].arrows_this_week === undefined
  );
  ok("a long line is cut, never the whole page", focusAim([{ goal_id: "w1", date: "2026-11-01", moved: true, level: 2, note: "x".repeat(400) }]).this_weeks_focus[0].arrows_this_week[0].length < 200);
  ok("a focus with no arrows yet still shows, with nothing made up", (() => {
    const f = focusAim([]).this_weeks_focus[0];
    return f.focus === "Win by win" && f.days_moved === 0 && f.days_not === 0 && !("arrows_this_week" in f);
  })());
  ok("the push never grades what he wrote about God", /never grade it/.test(PUSH_TONE) && /god_note/.test(PUSH_TONE) && /don't speak for God/i.test(PUSH_TONE));

  // --- What the AI is told about the new columns ------------------------------
  const askDoc = src("supabase/functions/ask/index.ts");
  const asstDoc = src("supabase/functions/assistant/index.ts");
  for (const [name, doc] of [
    ["Ask", askDoc],
    ["the assistant", asstDoc],
  ]) {
    ok(`${name}'s schema notes know the 1–10 feelings and the notes`, ["mood_10 smallint 1-10", "stress_10 smallint 1-10", "god_note text", "mood_note text", "stress_note text"].every((s) => doc.includes(s)));
    ok(`${name}'s schema notes say the 1–5 is derived since 2026-11-02`, /since 2026-11-02 they are derived from mood_10 and stress_10 \(half, rounded up\)|derived from the 1-10 \(half, rounded up\)/.test(doc));
    ok(`${name}'s schema notes know a check's kinds and what passes`, doc.includes("kind text 'yn'|'ysn'|'scale'|'number'|'minutes'|'time'|'choice'|'note'") && doc.includes("counts boolean") && doc.includes("auto 'wake'"));
    ok(`${name}'s schema notes know the focus's arrows and checks`, ["focus_checks(id, goal_id", "lands_by text 'placed'|'checks'", "quest_id uuid, lesson_id uuid", "level smallint, spot_x real, spot_y real, note text, answers jsonb"].every((s) => doc.includes(s)));
    ok(`${name}'s schema notes know the new shot answers`, /kind, value/.test(doc) && /line \(his/.test(doc) && /focus_goal/.test(doc) && /whole true/.test(doc));
    ok(`${name}'s schema notes say the old evening questions stopped`, /aren't asked (from|after) 2026-11-02/.test(doc));
  }
  ok("Ask's notes still know the older columns", ["mood smallint", "stress smallint", "stress_source", "off_plan_reason", "had_prompting", "sabbath_note", "fast_sunday"].every((s) => askDoc.includes(s)) && askDoc.includes("focus_notes(id, goal_id, date date, text text"));
  const evenings = asstDoc.slice(asstDoc.indexOf("async function recentEvenings"), asstDoc.indexOf("function dayForPrompt"));
  ok("the last week of evenings carries the notes and the 1–10 feelings", /god_note, mood_note, stress_note/.test(evenings) && /mood_10, stress_10/.test(evenings) && /mood_of_5/.test(evenings));
  ok("and still opens before 0103 is in", /r\.error \? journal\(EVENING_COLUMNS\) : r/.test(evenings) && /plans\.error \? \[\]/.test(evenings));
  const aim = asstDoc.slice(asstDoc.indexOf("async function aimDay"), asstDoc.indexOf("const WalkPromptSchema"));
  ok("the aim reads only this week's focus arrows, with their ring and line", /select\("goal_id, date, moved, level, note"\)/.test(aim) && /\.gte\("date", weekStart\)/.test(aim) && /\.lte\("date", date\)/.test(aim));

  // --- Before you bank it -------------------------------------------------------
  // The code without its comments, which still name what went.
  const code = (s) =>
    s
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
  const checkin = code(src("src/components/day/EveningCheckin.jsx"));
  ok("mood and stress save on 1–10 with the 1–5 beside them", /patchDayPlan\(userId, date, \{ mood_10: n, mood: toFive\(n\) \}\)/.test(checkin) && /patchDayPlan\(userId, date, \{ stress_10: n, stress: toFive\(n\) \}\)/.test(checkin));
  ok("and open where the day already sits on 1–10", /useFollow\(tenOf\(dayPlan, "mood"\)\)/.test(checkin) && /useFollow\(tenOf\(dayPlan, "stress"\)\)/.test(checkin));
  ok("each feeling has its note, and God has one", /\{ moodNote: t \}/.test(checkin) && /\{ stressNote: t \}/.test(checkin) && /\{ godNote: t \}/.test(checkin) && /journal\?\.god_note/.test(checkin) && checkin.includes("Any communication with God today?") && checkin.includes("What's behind it?"));
  ok("Fast Sunday is in the God card, on Sundays only", /\{sunday && \(\s*<div className="evening-god__sunday">/.test(checkin) && /fast_sunday: next/.test(checkin));
  ok("tomorrow's alarm is only asked tonight", /const tonight = date >= eveningDate\(\);/.test(checkin) && /\{tonight && \(/.test(checkin));
  const gone = ["stress_source", "off_plan_reason", "sabbath_note", "had_prompting", "logPrayer", "logExperience", "LeftUndone", "STRESS_SOURCES", "OFF_PLAN_REASONS", "Prayed"];
  ok("the chips, the prayer tap, the prompting and the Sabbath line are gone", gone.every((s) => !checkin.includes(s)), gone.filter((s) => checkin.includes(s)).join());
  ok("tapping what's chosen never takes it back", !/=== n \? null/.test(checkin) && !/alarm === a \? null/.test(checkin) && /if \(n === mood && !saves\.waiting\("mood"\)\) return;/.test(checkin));
  ok("saves go one at a time, so a tap while one saves still goes", /if \(loop\.current\) return loop\.current;/.test(checkin) && /wanted\.current\.set\(key, \{ run \}\)/.test(checkin));
  ok("a save that fails stays waiting and says so", /if \(wanted\.current\.get\(key\) === job\) failed\.add\(key\)/.test(checkin) && checkin.includes("Not saved, retry") && /useBackOnline\(retry, status\.failed > 0\)/.test(checkin));
  ok("flushing saves every note still typed, and fails loudly", /for \(const n of notes\.current\) n\.saveNow\(\);/.test(checkin) && /throw plainError\("A note or tap in Before you bank it didn't save\./.test(checkin));
  ok("the em dash stays out of what he reads", !/>[^<{]*—[^<{]*</.test(checkin) && !/placeholder="[^"]*—/.test(checkin));

  const short = code(src("src/components/day/ShortEvening.jsx"));
  ok("the short evening: mood on the slider, no note for it", /<Slider label="Mood"/.test(short) && !/moodNote/.test(short) && /mood_10: n, mood: toFive\(n\)/.test(short));
  ok("the God note in place of the Prayed tap", /\{ godNote: t \}/.test(short) && !/logPrayer|deletePrayer|Prayed/.test(short));
  ok("God's hand still finishes the reflection, and a blank never blanks it", /\{ godsHand: t, completed: true \}/.test(short) && /keepBlank: true/.test(short) && /flushRef\.current = async/.test(short));
  ok("and the alarm is only tonight's", /\{date >= eveningDate\(\) && \(/.test(short));

  // --- What got done --------------------------------------------------------------
  const tasksSrc = src("src/components/day/EveningTasks.jsx");
  const ticks = src("src/components/today/usePlanTicks.js");
  const blocks = src("src/components/today/PlanBlocks.jsx");
  ok("every task and quest pick for the day, examples left out", /usePlanTicks\(userId, date, \{ clearReason: true \}\)/.test(tasksSrc) && /filter\(\(t\) => !t\.is_example\)/.test(tasksSrc) && /planForToday\(/.test(tasksSrc));
  ok("an open task still asks why, with the old chips", /reasonChips\(pastReasons, 7, TASK_REASONS\)/.test(tasksSrc) && /fetchTaskReasons/.test(tasksSrc) && /onReason\(item\.id/.test(tasksSrc));
  ok("ticking a task done at night clears why it was left", /const sent = done \? \{ \.\.\.fields, left_reason: null \} : fields;/.test(ticks) && /updateTask\(item\.id, sent\)/.test(ticks));
  ok("Today's plan ticks the way it always has", /usePlanTicks\(userId, date\);/.test(blocks) && /toggleTask\(item\.id, done\)/.test(ticks) && !/clearReason/.test(blocks));
  ok("a reason waits for the row's tick, never races it", /ahead \? ahead\.catch\(\(\) => \{\}\)\.then\(run\) : run\(\)/.test(ticks));
  const night = planForToday({
    chunks: [
      { id: "m", start_time: "08:00:00", end_time: "10:00:00", title: "Morning" },
      { id: "s", start_time: "21:30:00", end_time: "04:30:00", title: "Sleep" },
    ],
    tasks: [
      { id: "a", title: "Inbox", time_chunk_id: "m", status: true },
      { id: "b", title: "Lay out clothes", time_chunk_id: "s", status: false },
      { id: "c", title: "Call the bank", time_chunk_id: null, status: false },
    ],
    nowMin: 2 * 24 * 60,
    date: "2026-11-02",
  });
  ok("in the evening every block is behind you, even one past midnight, and nothing hides", night.blocks.every((b) => b.state === "past") && night.total === 3 && night.done === 1 && night.loose.planned[0]?.id === "c");

  // --- The page --------------------------------------------------------------------
  const page = src("src/pages/Evening.jsx");
  const full = page.slice(page.indexOf(") : (\n        <div className={\"stack\""), page.indexOf("{volley &&"));
  const order = ["<WinsAndLosses", "<MinutesCard", "<WatchLine", "<CuratedCards", "<ReflectionFlow", "<FocusArrows", "<TonightShots", "<EveningTasks", "<EveningCheckin", "<CloseOut"].map((t) => full.indexOf(t));
  ok("the full evening goes in the order it's lived", order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), order.join());
  const quick = page.slice(page.indexOf(") : short ? ("), page.indexOf(") : (\n        <div className={\"stack\""));
  const qOrder = ["<WinsAndLosses", "<ShortEvening", "<FocusArrows", "<TonightShots", "<CloseOut"].map((t) => quick.indexOf(t));
  ok("and the short one too", qOrder.every((i, k) => i >= 0 && (k === 0 || i > qOrder[k - 1])) && /quick\s*\/>/.test(quick.slice(quick.indexOf("<FocusArrows"))), qOrder.join());
  ok("FocusDay is gone from the evening", !/FocusDay/.test(page));
  ok("the focus arrows and the shots get the day's plan", (page.match(/dayPlan=\{data\.dayPlan\}/g) ?? []).length >= 5 && (page.match(/<FocusArrows[^>]*flushRef=\{flushFocus\}/g) ?? []).length === 2);
  const before = page.slice(page.indexOf("const beforeBank"), page.indexOf("const a = data?.archive"));
  ok("banking saves the focus arrows before tonight's checks", before.indexOf("flushFocus") < before.indexOf("flushCheckin") && /onBefore=\{beforeBank\}/.test(page) && /onBefore=\{beforeShortBank\}/.test(page) && /flushShort\.current/.test(before));

  // --- The banked day -----------------------------------------------------------------
  const banked = src("src/components/day/BankedDayCard.jsx");
  const line = banked.slice(banked.indexOf("function DayInALine"), banked.indexOf("function TaskLine"));
  ok("the banked day shows mood and stress out of 10", /tenOf\(p, "mood"\)/.test(line) && /`mood \$\{mood\}\/10`/.test(line) && /`stress \$\{stress\}\/10/.test(line));
  ok("and the God note and a fast Sunday", /j\.god_note \? `With God: \$\{j\.god_note\}`/.test(line) && /fast Sunday/.test(line) && /<DayInALine plan=\{plan\} journal=\{journal\} \/>/.test(banked));
  ok("the older questions show only on days that have them", /p\.stress_source \?/.test(line) && /if \(p\.off_plan_reason\)/.test(line) && /p\.sabbath_note \?/.test(line));

  // --- The slider ------------------------------------------------------------------------
  const slider = src("src/components/ui/Slider.jsx");
  ok("the slider says what it is to a screen reader", /role="slider"/.test(slider) && /aria-valuemin=\{SLIDER_MIN\}/.test(slider) && /aria-valuemax=\{SLIDER_MAX\}/.test(slider) && /aria-valuenow=\{set \?\? undefined\}/.test(slider));
  ok("and takes the keys a slider takes", ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].every((k) => slider.includes(`"${k}"`)));
  ok("unset until the first touch, and says so", slider.includes('"Tap to set"') && /value == null \? null/.test(slider));
  ok("it saves once you lift your thumb, and a scroll isn't a pick", /function onPointerUp/.test(slider) && /settle\(n\)/.test(slider) && /onPointerCancel=\{onPointerCancel\}/.test(slider));
  const daily = src("src/styles/daily.css");
  const track = daily.slice(daily.indexOf(".slider__track {"), daily.indexOf("}", daily.indexOf(".slider__track {")));
  ok("the track is thumb-sized, keeps vertical scrolling, and fits a phone", /height: 44px/.test(track) && /touch-action: pan-y/.test(track) && /repeat\(10, minmax\(0, 1fr\)\)/.test(track));
}

// (end of before you bank it)
// ---------------------------------------------------------------------------


// ===== Targets tab (PR 3, part 1) =====
// Add this part's tests directly under the line above.
{
  console.log("\ntargets tab: the ladder, notes and quotes");
  const L = await import("../src/lib/ladder.js");
  const goals = [{ id: "g1", title: "Highly skilled" }, { id: "g2", title: "Highly in tune with God" }];
  const edges = [{ parent_id: "g1", child_id: "n1" }, { parent_id: "n1", child_id: "n2" }];
  const quests = [
    { id: "q1", title: "Build the best Premiere Pro plugin", status: "on", goal_id: "g1", position: 0 },
    { id: "q2", title: "Old quest", status: "done", goal_id: null, position: 1 },
    { id: "m1", title: "Quit caffeine", status: "on", lesson_id: "l1", goal_id: "g2", position: 2 },
  ];
  const lessons = [
    { id: "l1", title: "Stop drinking caffeine", status: "learning", goal_id: "g2", position: 0 },
    { id: "l2", title: "More integrity", status: "set_aside", goal_id: null, position: 1 },
  ];
  const focusGoals = [
    { id: "f1", title: "Win by win", week_start: "2026-10-18", carried_from: null, quest_id: "q1" },
    { id: "f2", title: "Win by win", week_start: "2026-10-25", carried_from: "f1", quest_id: "q1" },
    { id: "f3", title: "Win by win", week_start: "2026-11-01", carried_from: "f2", quest_id: "q1" },
    { id: "f4", title: "Up at 4:30", week_start: "2026-11-01", carried_from: null, node_id: "n2" },
  ];
  const data = { goals, edges, quests, lessons, focusGoals };
  const r = (ref) => L.resolveRef(ref, data);
  ok("the mission resolves", r("mission")?.kind === "mission" && r("mission").key === "mission");
  ok("a lifetime goal is itself", r("g1")?.kind === "goal" && r("g1").key === "g1");
  ok("a goal further down the wheel opens its lifetime goal", r("n2")?.kind === "goal" && r("n2").key === "g1");
  ok("a quest is itself, whatever its status", r("q1")?.kind === "quest" && r("q2")?.kind === "quest" && r("q2").key === "q2");
  ok("a lesson's mountain opens the lesson", r("m1")?.kind === "lesson" && r("m1").key === "l1");
  ok("a lesson by its id or lesson-<id>, set aside too", r("l1")?.key === "l1" && r("lesson-l1")?.key === "l1" && r("l2")?.kind === "lesson");
  ok("an old week's focus opens its newest week", r("f1")?.kind === "focus" && r("f1").key === "f3" && r("f3").key === "f3");
  ok("anything else is nothing", r("nope") === null && r("") === null && r("lesson-nope") === null && L.resolveRef("x", null) === null);
  ok("a loop in carried_from doesn't hang", L.newestInLine("a", [{ id: "a", carried_from: "b" }, { id: "b", carried_from: "a" }]) !== null);
  ok("the goal walk stops on a loop", L.rootGoalOf("x", goals, [{ parent_id: "y", child_id: "x" }, { parent_id: "x", child_id: "y" }]) === null);
  ok("a goal under two parents follows the one it's drawn under (its first edge)", L.rootGoalOf("k", goals, [{ parent_id: "g2", child_id: "k" }, { parent_id: "g1", child_id: "k" }]) === "g2");
  ok("a forked line goes to the later week", L.newestInLine("a", [{ id: "a" }, { id: "b", carried_from: "a", week_start: "2026-10-25" }, { id: "c", carried_from: "a", week_start: "2026-11-01" }]) === "c");

  ok("each kind names its column", JSON.stringify(["mission", "goal", "quest", "lesson", "focus"].map((kind) => L.refOf({ kind, id: "i" }))) ===
    JSON.stringify([{ mission: true }, { goal_id: "i" }, { quest_id: "i" }, { lesson_id: "i" }, { focus_goal_id: "i" }]));
  ok("no id, no ref", L.refOf({ kind: "quest", id: null }) === null && L.refOf(null) === null);
  ok("pages live under /targets", L.pathOf("mission") === "/targets/mission" && L.pathOf("quest", "q1") === "/targets/q1");

  const crumbs = (t) => L.crumbsFor(t, data).map((c) => c.label).join(" › ");
  ok("a quest's ladder line", crumbs({ kind: "quest", id: "q1" }) === "My mission › Skilled", crumbs({ kind: "quest", id: "q1" }));
  ok("a quest serving the mission", crumbs({ kind: "quest", id: "q2" }) === "My mission");
  ok("a focus toward a quest goes through it", crumbs({ kind: "focus", id: "f3" }) === "My mission › Skilled › Plugin", crumbs({ kind: "focus", id: "f3" }));
  ok("a focus toward a goal down the wheel finds its lifetime goal", crumbs({ kind: "focus", id: "f4" }) === "My mission › Skilled", crumbs({ kind: "focus", id: "f4" }));
  ok("the mission has none", L.crumbsFor({ kind: "mission" }, data).length === 0);

  const items = [
    { questId: "q1", done: false },
    { questId: "q1", done: true },
    { questId: "q1", heading: true, subs: [{ done: false }, { done: false }] },
    { questId: "m1", done: false },
  ];
  const pills = L.questPills({ quests, lessons, camps: [{ quest_id: "q1" }, { quest_id: "q1" }, { quest_id: "m1" }], items });
  ok("one pill per quest on and lesson learning", pills.map((p) => p.key).join() === "q1,l1", pills.map((p) => p.key).join());
  ok("a lesson's pill keys on the lesson and counts its mountain", pills[1].kind === "lesson" && pills[1].camps === 1 && pills[1].today === 1);
  ok("today counts what's still to do; a note counts what's under it", pills[0].today === 3 && pills[0].done === 1 && pills[0].camps === 2);
  ok("the pill's line", L.pillLine(pills[0]) === "2 camps · 3 today" && L.pillLine({ camps: 1, today: 0 }) === "1 camp" && L.pillLine({}) === "");

  ok("every kind has questions", ["mission", "goal", "quest", "lesson", "focus"].every((k) => L.REFLECT_PROMPTS[k].length >= 4));
  ok("questions go round", L.promptFor("focus", 4) === L.promptFor("focus", 0) && L.promptFor("focus", -1) === L.REFLECT_PROMPTS.focus.at(-1));
  ok("questions say nothing of what God expects", Object.values(L.REFLECT_PROMPTS).flat().every((q) => !/expect|should|ought|\bmust\b|worthy|\bsins?\b/i.test(q)));
  ok("no dashes in the questions", Object.values(L.REFLECT_PROMPTS).flat().every((q) => !/[–—]| -- /.test(q)));
  ok("the day's first question is steady", L.promptIndexFor("quest", "2026-11-02") === L.promptIndexFor("quest", "2026-11-02") && L.promptIndexFor("quest", "2026-11-02") < L.REFLECT_PROMPTS.quest.length);
  ok("a note is trimmed and kept to 4000", L.cleanTargetNote("  hi\r\nthere  ") === "hi\nthere" && L.cleanTargetNote("x".repeat(5000)).length === 4000);
  ok("drafts are kept per target", L.noteDraftKey({ kind: "quest", key: "q1" }) === "hub.target-note-draft.quest:q1");

  const shots = [{ id: "s1", date: "2026-11-01", note: "Held the line", loosed_at: "2026-11-02T04:00:00Z", answers: [{ aim: "a", text: "Up by 4:35", v: 2, line: "4:31" }, { aim: "b", text: "x", v: 1 }] }];
  const evening = L.eveningLines(shots);
  ok("the evening's lines come along, read only", evening.length === 2 && evening[1].prompt === "Up by 4:35" && evening.every((e) => e.source === "evening"));
  const tl = L.notesTimeline(
    {
      notes: [
        { id: "t1", kind: "reflection", prompt: "Why?", date: "2026-11-02", text: "Because", created_at: "2026-11-02T15:00:00Z" },
        { id: "t2", kind: "note", date: "2026-11-02", text: "Later", created_at: "2026-11-02T18:00:00Z" },
      ],
      focusNotes: [{ id: "fn", date: "2026-10-28", text: "From Today", created_at: "2026-10-28T12:00:00Z" }],
      evening,
    },
    "2026-11-02"
  );
  ok("the timeline is newest first, by day", tl.map((g) => g.label).join() === "Today,Yesterday,Wed, Oct 28" || tl.map((g) => g.date).join() === "2026-11-02,2026-11-01,2026-10-28", tl.map((g) => `${g.date}:${g.label}`).join());
  ok("and newest first within a day", tl[0].items.map((i) => i.id).join() === "t2,t1" && tl[0].items[1].kind === "reflection");

  const lib = [
    { id: "a", text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln", source: null, created_at: "2026-10-01", saved_at: null },
    { id: "b", text: "The natural man is an enemy to God.", author: "King Benjamin", source: "Mosiah 3:19", created_at: "2026-10-05", saved_at: "2026-10-06", rating: "applies", rated_at: "2026-10-06" },
    { id: "c", text: "Ce que l'on conçoit bien s'énonce clairement.", author: "Boileau", source: null, created_at: "2026-10-07", saved_at: null },
  ];
  ok("every word must match, in words, author or source", L.filterQuotes(lib, "want most").map((q) => q.id).join() === "a" && L.filterQuotes(lib, "mosiah enemy").map((q) => q.id).join() === "b");
  ok("accents don't matter", L.filterQuotes(lib, "concoit").map((q) => q.id).join() === "c");
  ok("an empty search finds nothing", L.filterQuotes(lib, "  ").length === 0);
  const secs = L.pickerSections(lib, { linkedIds: ["a"], pickIds: ["c"] });
  ok("the picker's sections, no quote twice", secs.map((s) => s.key).join() === "linked,board,picks" && secs.flatMap((s) => s.quotes.map((q) => q.id)).join() === "a,b,c", secs.map((s) => s.key).join());
  ok("own quotes search their excerpt and people", L.filterOwnQuotes([{ id: "n", title: "x", excerpt: "Ponder the path", shelf_people: ["David A. Bednar"] }], "bednar path").length === 1);
  const shelf = L.askShelfFor({ key: "q1abcdefgh" }, "Build the best Premiere Pro plugin", "my work");
  ok("finding new quotes asks the Board's shelf for this target", /^ask:[a-z0-9-]{1,80}$/.test(shelf.key) && shelf.facet === "ask" && shelf.hint.includes("my work") && shelf.label.length <= 80, shelf.key);

  // --- The tables (0104) -----------------------------------------------------
  const mig = readFileSync(new URL("../supabase/migrations/0104_target_notes_and_quotes.sql", import.meta.url), "utf8");
  const sql = mig.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  ok("0104 is purely additive", !/\b(drop|truncate|delete\s+from|update\s+public)\b/i.test(sql) && (sql.match(/alter\s+table/gi) ?? []).length === (sql.match(/alter table public\.\w+ enable row level security;/g) ?? []).length);
  ok("0104 has a rollback", /Rollback \(SQL Editor/.test(mig) && /drop table if exists public\.quote_links;/.test(mig) && /drop table if exists public\.target_notes;/.test(mig));
  ok("each note and link is on exactly one target", (sql.match(/num_nonnulls\(nullif\(mission, false\), goal_id, quest_id, lesson_id, focus_goal_id\) = 1/g) ?? []).length === 2);
  ok("each link is one quote", /num_nonnulls\(quote_id, note_id\) = 1/.test(sql) && /create unique index if not exists quote_links_once/.test(sql));
  ok("both tables are owned and closed to anon", ["target_notes", "quote_links"].every((t) => sql.includes(`alter table public.${t} enable row level security`) && sql.includes(`revoke all on public.${t} from anon, public`)));
  ok("the policies check every id they're given", ["nodes n where n.id = goal_id", "quests q where q.id = quest_id and q.user_id = auth.uid() and q.lesson_id is null", "lessons l where l.id = lesson_id", "focus_goals f where f.id = focus_goal_id"].every((x) => sql.split(x).length - 1 === 2) &&
    /quotes x where x\.id = quote_id/.test(sql) && /study_notes s where s\.id = note_id/.test(sql));
  ok("only a reflection carries a question", /constraint target_notes_prompt check \(kind = 'reflection' or prompt is null\)/.test(sql));
  ok("a removed target takes its notes and links with it", (sql.match(/on delete cascade/g) ?? []).length === 12 && !/on delete set null/.test(sql));

  const api = readFileSync(new URL("../src/lib/api.js", import.meta.url), "utf8");
  ok("linking twice isn't an error", /error\?\.code === "23505"\) return null/.test(api.slice(api.indexOf("export async function linkQuote"))));
  ok("the Targets functions sit outside the Mark's", api.indexOf("export async function fetchTargetNotes") < api.indexOf("export async function looseShots") || api.indexOf("export async function fetchTargetNotes") > api.indexOf("export async function readMarkLine"));
  for (const fn of ["ask", "assistant"]) {
    const doc = readFileSync(new URL(`../supabase/functions/${fn}/index.ts`, import.meta.url), "utf8");
    ok(`${fn}'s schema notes know target_notes and quote_links`, doc.includes("target_notes(id, mission boolean, goal_id uuid") && doc.includes("quote_links(id, quote_id uuid, note_id uuid"));
  }

  // --- Old addresses ----------------------------------------------------------
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  ok("the Targets routes", ['path="/targets"', 'path="/targets/mission"', 'path="/targets/:ref"', 'path="/targets/camp/:id"', 'path="/targets/plans"', 'path="/targets/plans/:id"'].every((p) => app.includes(p)));
  ok("every old Quests and Range address moves to Targets", ["/quests", "/quests/:key", "/ascent", "/ascent/:ref", "/ascent/camp/:id", "/ascent/plans", "/ascent/plans/:id"].every((p) => new RegExp(`path="${p}" element=\\{<MovedTo to="/targets`).test(app)));
  ok("and keeps the query and state", /<Navigate to=\{`\$\{path\}\$\{search\}\$\{hash\}`\} state=\{state\} replace \/>/.test(app));
}

// (end of targets tab, part 1)
// ---------------------------------------------------------------------------


// ===== Targets tab (PR 3, part 2) =====
// Add this part's tests directly under the line above.
{
  console.log("\ntargets tab: the overview, the tab and the links into it");
  const { existsSync } = await import("node:fs");
  const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

  // --- The tab ---------------------------------------------------------------
  const nav = src("components/NavBar.jsx");
  const listOf = (name) => {
    const from = nav.indexOf(`export const ${name} = [`);
    return from < 0 ? "" : nav.slice(from, nav.indexOf("];", from));
  };
  const tos = (list) => [...list.matchAll(/to: "([^"]*)"/g)].map((m) => m[1]);
  ok("Targets is the third tab, where Quests was", tos(listOf("NAV"))[2] === "/targets" && listOf("NAV").includes('{ to: "/targets", label: "Targets", Icon: Target }'), tos(listOf("NAV")).join());
  ok("no Quests tab, and the Range is out of More", !tos(listOf("NAV")).includes("/quests") && tos(listOf("MORE")).every((t) => !/^\/(ascent|quests)\b/.test(t)) && !/The Range/.test(nav));
  ok("the Range's old page is gone", !existsSync(new URL("../src/pages/Ascent.jsx", import.meta.url)));

  // Every link this part touches goes to its new address, and nothing it
  // shows still calls it the Range.
  const owned = [
    "pages/Targets.jsx",
    "components/targets/OverviewTiers.jsx",
    "components/targets/OverviewPatches.jsx",
    "components/targets/OverviewBow.jsx",
    "components/NavBar.jsx",
    "pages/Today.jsx",
    "components/mark/TonightShots.jsx",
    "components/today/PlanBlocks.jsx",
    "pages/Plans.jsx",
    "pages/Camp.jsx",
    "pages/Village.jsx",
    "components/focus/FocusSheet.jsx",
    "components/focus/FocusWeek.jsx",
    "components/focus/FocusSettings.jsx",
  ];
  const stale = owned.filter((p) => /["`]\/(quests|ascent)\b|The Range/.test(src(p)));
  ok("no old Quests or Range links left", stale.length === 0, stale.join());
  ok("the Mark's copy says Targets", /on Targets/.test(src("lib/mark.js")) && !/the Range/.test(src("lib/mark.js").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")));

  const today = src("pages/Today.jsx");
  const at = (s) => today.indexOf(s);
  ok("Today's quests row sits between the focus and the week", at("<FocusStrip") > 0 && at("<FocusStrip") < at("<QuestsRow userId={userId} date={date} />") && at("<QuestsRow") < at("<WeekStrip"));
  const shots = src("components/mark/TonightShots.jsx");
  ok("tonight's shots open Targets, and a target's history", shots.includes('<Link to="/targets" className="btn-link mk-tonight__range">') && shots.includes("<Link to={`/targets/${t.key}#history`}"));
  ok("a plan's quest opens its page", src("components/today/PlanBlocks.jsx").includes("<Link to={`/targets/${g.questId}`}"));
  const camp = src("pages/Camp.jsx");
  ok("a camp goes back to its own quest or lesson", /if \(data\?\.lesson\) return pathOf\("lesson", data\.lesson\.id\);/.test(camp) && /pathOf\("quest", data\.camp\.quest_id\) : "\/targets"/.test(camp) && camp.includes("`/targets/camp/${c.id}`"));
  const plans = src("pages/Plans.jsx");
  ok("plans live under Targets, and new camps open where they went", plans.includes('<Back to="/targets">Targets</Back>') && /mt\.lessonId \? pathOf\("lesson", mt\.lessonId\) : pathOf\("quest", questId\)\}#camps/.test(plans));
  const sheet = src("components/focus/FocusSheet.jsx");
  ok("a focus's sheet says what it counts toward, as a link that closes the sheet", /<Link to=\{pathOf\(toward\.kind, toward\.id\)\} className="ladder-toward" onClick=\{onClose\}>/.test(sheet) && /toward=\{null\}/.test(sheet));
  const week = src("components/focus/FocusWeek.jsx");
  ok("each focus on Week links what it counts toward", /pathOf\(g\.quest_id \? "quest" : "lesson", g\.quest_id \?\? g\.lesson_id\)/.test(week) && /pathOf\("goal", g\.node_id\)/.test(week));

  // --- The overview's own pieces, drawn ----------------------------------------
  // The pieces built with React, the router's Link as a plain <a> and the
  // drawings left out, then turned into HTML to see where each one goes.
  const { build } = await import("esbuild");
  const dir = fileURLToPath(new URL("../src/components/targets/", import.meta.url));
  const standIns = {
    "react-router-dom": 'import { createElement } from "react"; export const Link = ({ to, children, className, ...p }) => createElement("a", { href: to, className, "aria-label": p["aria-label"] }, children);',
    "lucide-react": "export const ChevronRight = () => null; export const ChevronDown = () => null;",
  };
  const built = await build({
    stdin: {
      contents: 'export * from "./OverviewTiers.jsx"; export * from "./OverviewPatches.jsx"; export { renderToStaticMarkup } from "react-dom/server"; export { createElement } from "react";',
      resolveDir: dir,
      loader: "jsx",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    logLevel: "silent",
    // React's server build asks for Node's own modules by require().
    banner: { js: `import { createRequire } from "node:module"; const require = createRequire(${JSON.stringify(import.meta.url)});` },
    plugins: [
      {
        name: "stand-ins",
        setup(b) {
          b.onResolve({ filter: /^(react-router-dom|lucide-react)$|\/(TargetFace|Gear)$/ }, (a) => ({ path: a.path, namespace: "stand-in" }));
          b.onLoad({ filter: /.*/, namespace: "stand-in" }, (a) => ({ contents: standIns[a.path] ?? "export default () => null;", loader: "jsx", resolveDir: dir }));
        },
      },
    ],
  });
  const O = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
  const html = (C, props) => O.renderToStaticMarkup(O.createElement(C, props));
  const hrefs = (h) => [...h.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  const M = await import("../src/lib/mark.js");
  const day = "2026-11-02";

  const t = { shots: [{ date: "2026-11-01", level: 0 }, { date: "2026-10-01", level: 0 }, { date: day, level: 2 }], today: { level: 2 } };
  ok("a small target's words count the bullseyes in its 30 days", O.markWords(t, day) === `1 bullseye in 30 days, today's arrow in the ${M.LEVELS[2].name.toLowerCase()} ring`, O.markWords(t, day));
  ok("and say how today's arrow landed", /a bullseye today$/.test(O.markWords({ ...t, today: { level: 0 } }, day)) && /today's arrow missed$/.test(O.markWords({ ...t, today: { level: M.LEVELS.length - 1 } }, day)) && /no arrow yet today$/.test(O.markWords({ ...t, today: null }, day)));
  ok("nothing yet is said plainly", O.markWords(null, day) === "no marks yet" && O.markWords(O.NO_MARKS, day) === "no marks yet");
  ok("a double dash in a focus's name doesn't break", O.keepDashes("Daily form--win by win") === "Daily form‑‑win by win" && O.keepDashes(null) === "");

  const empty = html(O.MissionCard, { mission: null, onWrite: () => {} });
  ok("no mission yet: a button to write it, no link", empty.includes("Write your mission") && !empty.includes("<a ") && empty.includes("ov-mission--empty"));
  const mission = html(O.MissionCard, { mission: { summit: "An exalted servant", statement: "To become an exalted servant of God" } });
  ok("the mission's card opens its page", hrefs(mission).join() === "/targets/mission" && mission.includes("An exalted servant") && mission.includes("ov-mission__creed"));

  const climbs = html(O.ClimbRows, {
    today: day,
    climbs: [
      { key: "q1", kind: "quest", title: "Build the plugin", camps: 2, today: 3, target: t },
      { key: "l1", kind: "lesson", title: "Stop drinking caffeine", camps: 1, today: 0, target: null },
    ],
  });
  ok("each quest and lesson opens its own page", hrefs(climbs).join() === "/targets/q1,/targets/l1", hrefs(climbs).join());
  ok("with what's waiting there", climbs.includes("Quest · 2 camps · 3 today") && climbs.includes(">Lesson · 1 camp<"));
  ok("and says it all to a screen reader", climbs.includes('aria-label="Stop drinking caffeine. Lesson from God, 1 camp. No marks yet."') && climbs.includes('aria-label="Build the plugin. Quest, 2 camps, 3 today. 1 bullseye in 30 days'));

  const faces = html(O.FaceRow, { week: true, label: "This week's focus", items: [{ key: "f1", to: "/targets/f1", label: "Up at 4:30", name: "Up at 4:30", answered: true }, { key: "f2", to: "/targets/f2", label: "Scripture", name: "Scripture" }] });
  ok("a row of small targets, each a link", hrefs(faces).join() === "/targets/f1,/targets/f2" && faces.includes("ov-faces--week") && (faces.match(/is-answered/g) ?? []).length === 1);

  const view = {
    patches: [{ id: "q3", title: "Finish the garage", finished_on: "2026-10-20" }, { id: "m2", lesson_id: "l5", title: "Patience", finished_on: "2026-10-25" }],
    learned: [{ id: "l2", title: "More integrity" }],
    setAside: [{ id: "q4", title: "Learn Spanish" }],
    lessonsAside: [{ id: "l3", title: "Patience with the kids" }],
  };
  const behind = html(O.BehindYou, { view });
  ok("behind you: each patch, lesson learned and thing set aside opens its page", hrefs(behind).join() === "/targets/q3,/targets/l5,/targets/l2,/targets/q4,/targets/l3", hrefs(behind).join());
  ok("a lesson's patch opens the lesson, never its mountain", !hrefs(behind).includes("/targets/m2"));
  ok("the fold says what's in it, and stays shut", behind.includes("2 patches · 1 learned · 2 set aside") && !/<details[^>]* open/.test(behind));
  ok("it opens by itself for a patch just earned", /<details[^>]* open=""/.test(html(O.BehindYou, { view, fresh: "q3" })));
  ok("nothing behind you, no fold", html(O.BehindYou, { view: { patches: [], learned: [], setAside: [], lessonsAside: [] } }) === "" && html(O.BehindYou, { view: null }) === "");

  // --- Copy and colour ----------------------------------------------------------
  const pageSrc = ["pages/Targets.jsx", "components/targets/OverviewTiers.jsx", "components/targets/OverviewPatches.jsx", "components/targets/OverviewBow.jsx"].map(src).join("\n");
  ok("no dashes in the overview's words", !/[–—]| -- /.test(pageSrc));
  ok("a new lesson's page opens once its camps are saved too", /onAdded: \(id\) => \{\s*afterSave\.current = pathOf\("lesson", id\);/.test(pageSrc) && /if \(to && alive\.current\) navigate\(to\);/.test(pageSrc));
  ok("a new quest's page opens as soon as it's added", /open\(\{ kind: "quest", quest: null, onAdded: \(id\) => navigate\(pathOf\("quest", id\)\) \}\)/.test(pageSrc));
  const css = src("styles/targets.css");
  const part2 = css.slice(css.indexOf("/* --- Part 2:"), css.indexOf("/* --- end of part 2 --- */"));
  const missionRules = [...part2.matchAll(/([^{}]*ov-mission[^{}]*)\{([^}]*)\}/g)].map((m) => m[2]);
  ok("the mission's card is white like the rest", missionRules.length > 0 && missionRules.every((r) => !/background:\s*var\(--ink\)/.test(r)));
}

// (end of targets tab, part 2)
// ---------------------------------------------------------------------------


// ===== Targets tab (PR 3, part 3) =====
// Add this part's tests directly under the line above.
{
  console.log("\ntargets tab: a target's page");
  const { existsSync, readdirSync } = await import("node:fs");
  const at = (p) => new URL(`../${p}`, import.meta.url);
  const read = (p) => readFileSync(at(p), "utf8");
  // A component's own helpers, with what it imports swapped for stand-ins
  // except the modules `keep` names (as in "Review fixes, batch C").
  const helpersOf = async (rel, keep = null) => {
    const path = fileURLToPath(at(rel));
    const text = readFileSync(path, "utf8");
    const built = await esbuildBundle({
      entryPoints: [path],
      bundle: true,
      write: false,
      format: "esm",
      jsx: "transform",
      logLevel: "silent",
      plugins: [
        {
          name: "stand-ins",
          setup(b) {
            b.onResolve({ filter: /.*/ }, (a) => (a.importer === path && !(keep && keep.test(a.path)) ? { path: a.path, namespace: "stand-in" } : undefined));
            b.onLoad({ filter: /.*/, namespace: "stand-in" }, (a) => {
              const from = a.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const names = (text.match(new RegExp(`^import (?:\\w+, )?\\{([^}]*)\\} from "${from}";$`, "m"))?.[1] ?? "").split(",").map((n) => n.trim()).filter(Boolean);
              return { contents: [...names.map((n) => `export const ${n} = () => undefined;`), "export default () => null;"].join("\n"), loader: "js" };
            });
          },
        },
      ],
    });
    return import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
  };

  // --- The Quests page moved into a quest's own page ---------------------------
  const body = read("src/components/targets/QuestBody.jsx");
  const camps = read("src/components/targets/QuestCamps.jsx");
  const page = read("src/pages/Target.jsx");
  ok("the Quests page is gone, and its pills with it", !existsSync(at("src/pages/Quests.jsx")) && !existsSync(at("src/components/quests/QuestMap.jsx")));
  const oldLink = /["'`]\/(quests|ascent)\b/;
  const questsDir = readdirSync(at("src/components/quests/")).filter((f) => f.endsWith(".jsx") || f.endsWith(".js"));
  const stale = [
    ["QuestBody", body],
    ["QuestCamps", camps],
    ["Target", page],
    ["TargetView", read("src/components/mark/TargetView.jsx")],
    ...questsDir.map((f) => [f, read(`src/components/quests/${f}`)]),
  ].filter(([, src]) => oldLink.test(src) || /from: "quests"/.test(src));
  ok("no link on a quest's page, its camps or its lists goes to /quests or /ascent", stale.length === 0, stale.map(([n]) => n).join(", "));
  ok("a quest's page has no notes box of its own any more (its notes are the target's)", !/saveNote|Notes on this/.test(body));
  ok("a quest's page never moves the address itself (a lesson's new mountain just reloads)", [...body.matchAll(/navigate\(([^)]*)\)/g)].every((m) => /\/village/.test(m[1])));
  ok("the quest's page has no header, pills or 'Start a quest' of its own", !/qs-head|QuestMap|Start a quest|NewQuest/.test(body));

  // The camps: always there, never behind a pill or a fold.
  ok("the camps are drawn on every quest's page, not inside a fold", /\n\s*<QuestCamps\b/.test(body) && !/<details/.test(camps) && /id="camps"/.test(camps) && /className="qs-camps"/.test(camps));
  ok("each camp goes to its own page under Targets, with no state trick", /to=\{`\/targets\/camp\/\$\{c\.id\}`\}/.test(camps) && !/<Link[^>]*\bstate=/.test(camps));
  ok("the flag at the next camp goes through the ladder (its ceremony and Undo)", /onReach=\{\(\) => ladder\?\.reachNext\(climb\)\}/.test(body) && /Mark the summit reached/.test(camps));
  ok("'Bring in a plan' goes to the plans under Targets", /to="\/targets\/plans"/.test(camps));

  // The order on a phone: the grid's cells in the source, as a phone stacks them.
  const order = ["<QuestCamps", 'className="qs-today"', 'className="qs-ongoing"', 'className="qs-clip"', "{quotes}", "{notes}", "qs-earlier", "{history}"];
  const spots = order.map((s) => body.indexOf(s));
  ok("a quest's page runs camps, Today, ongoing, clipboard, quotes, notes, earlier days, history", spots.every((n, i) => n > 0 && (i === 0 || n > spots[i - 1])), JSON.stringify(spots));
  const qcss = read("src/styles/quests.css");
  ok("the phone keeps that order: the grid only places its cells on a desk", !/grid-area:\s*(camps|today|ongoing|clip|side|rest|build)\b/.test(qcss.slice(0, qcss.indexOf("@media (min-width: 901px)"))));
  ok("on a desk the build heads the right rail, with the quotes and notes under it", /"camps build" "today side" "ongoing side"/.test(qcss));
  ok("the closed clipboard's button has a home in the camps' head", /clip=\{clipButton\}/.test(body) && /\{clip\}/.test(camps) && /CLIP_SHUT_KEY = "hub:clip-closed"/.test(body));

  // --- A focus's page -------------------------------------------------------------
  const focusSrc = read("src/components/targets/TargetFocus.jsx");
  ok("a focus's page knows this week's row by its week", /const thisWeek = row\.week_start === focusWeekOf\(today\)/.test(focusSrc));
  ok(
    "today's arrow shows only on this week's focus, and only once",
    (focusSrc.match(/<GoalArrow\b/g) ?? []).length === 1 && /\{thisWeek && \(\s*<div className="focus-sheet__arrow[^"]*">\s*<span className="eyebrow">Today's arrow<\/span>\s*<GoalArrow/.test(focusSrc)
  );
  ok("an earlier week's focus has no settings pencil", /const weekGoal = thisWeek \?/.test(page) && /onEdit: kind === "focus" && !info\.weekGoal \? null : edit/.test(page));

  // --- Notes ---------------------------------------------------------------------
  const sheetSrc = read("src/components/targets/NoteSheet.jsx");
  const N = await helpersOf("src/components/targets/NoteSheet.jsx", /lib\/ladder$/);
  ok("a focus's note takes 2000 characters, every other note and reflection 4000", N.noteLimit("focus", "note") === 2000 && N.noteLimit("focus", "reflect") === 4000 && N.noteLimit("quest", "note") === 4000 && N.FOCUS_NOTE_MAX === 2000);
  ok("the box's limit is where it saves", /maxLength=\{max\}/.test(sheetSrc) && /const max = noteLimit\(focusNote \? "focus" : kind, mode\)/.test(sheetSrc));
  const focusSheet = read("src/components/focus/FocusSheet.jsx");
  ok(
    "a focus's note keeps Today's draft (hub.focus-note-draft.<id>)",
    /import \{ readDraft, keepDraft \} from "\.\.\/focus\/FocusSheet";/.test(sheetSrc) && /`hub\.focus-note-draft\.\$\{goalId\}`/.test(focusSheet) && /readDraft\(focusGoal\)/.test(sheetSrc) && /keepDraft\(focusGoal\.id, text\)/.test(sheetSrc)
  );
  ok("a focus's note saves through Today's own save", /saveNote\(userId, \{ goalId: target\.id, date: today, sent: text \}\)/.test(read("src/components/targets/NotesSection.jsx")));

  const store = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
  };
  const key = "hub.target-note-draft.quest:q1:note";
  let s1 = store();
  N.keepNoteDraft(key, "Half a thought", s1);
  let threw = false;
  try {
    await N.sendNote({ key, sent: "Half a thought", save: () => Promise.reject(new Error("offline")), store: s1 });
  } catch {
    threw = true;
  }
  ok("a note that doesn't save keeps its draft, word for word", threw && N.readNoteDraft(key, s1) === "Half a thought");
  await N.sendNote({ key, sent: "Half a thought", save: () => Promise.resolve({ id: "n1" }), store: s1 });
  ok("a note that saved clears its draft", N.readNoteDraft(key, s1) === "");
  const s2 = store();
  N.keepNoteDraft(key, "Typed after Save", s2);
  await N.sendNote({ key, sent: "The words sent", save: () => Promise.resolve({ id: "n2" }), store: s2 });
  ok("words typed after Save stay, even once the note saved", N.readNoteDraft(key, s2) === "Typed after Save");
  N.keepNoteDraft(key, "   ", s2);
  ok("a blank box leaves no draft behind", !s2.m.has(key));
  const catchBlock = sheetSrc.slice(sheetSrc.indexOf("} catch {", sheetSrc.indexOf("async function save(")), sheetSrc.indexOf("const near ="));
  ok("the sheet stays open with the words when a save fails", /setProblem\("Couldn't save that\. Your words are still here\."\)/.test(catchBlock) && !/dropNoteDraft|removeItem|onClose|setText/.test(catchBlock));
  ok("Cancel keeps the draft (it only closes)", /onClick=\{onClose\}>\s*Cancel/.test(sheetSrc));
  ok("the drafts are kept per target and per kind of writing", /draftKey=\{`\$\{draftBase\}:\$\{sheet\}`\}/.test(read("src/components/targets/NotesSection.jsx")) && /const draftBase = noteDraftKey\(target\)/.test(read("src/components/targets/NotesSection.jsx")));

  // --- Quotes --------------------------------------------------------------------
  const linked = read("src/components/targets/LinkedQuotes.jsx");
  ok("Unlink takes off every week's link to that quote", /unlinkQuote\(link\.linkIds\)/.test(linked) && /relinkQuotes\(rows\)/.test(linked));
  ok("the quotes on a target go in QuoteCard's foot as Unlink", /extra=\{unlinkBtn\(l\)\}/.test(linked) && /className="qprint__save tg-unlink"/.test(linked));

  // --- The head ------------------------------------------------------------------
  const H = await helpersOf("src/components/targets/TargetHead.jsx", /lib\/mark$/);
  ok(
    "today's arrow on a target, in words",
    H.todayWords({ today: null }) === "No arrow yet today" &&
      H.todayWords({ today: { level: 0 } }) === "Bullseye tonight" &&
      H.todayWords({ today: { level: 2 } }) === "Middle ring tonight" &&
      H.todayWords({ today: { level: 5 } }) === "Missed tonight"
  );
  ok("there's always a way up: the ladder line starts at Targets", /<Link to="\/targets">Targets<\/Link>/.test(read("src/components/targets/TargetHead.jsx")));
  ok("a link to a target that's gone says so, with the way back", /That isn't one of your targets any more\./.test(page) && /Back to Targets/.test(page));
  ok("a link by another id moves to the target's own, keeping the rest", /navigate\(`\/targets\/\$\{key\}\$\{location\.search\}\$\{location\.hash\}`, \{ replace: true, state: location\.state \}\)/.test(page));
  const view = read("src/components/mark/TargetView.jsx");
  ok("TargetView drawn on a page has no back link, tabs or lines of its own", /\{!embedded && \(\s*<>\s*<header/.test(view) && /!embedded && noted\.length > 0/.test(view));

  // --- Copy ----------------------------------------------------------------------
  const mine = [
    "src/pages/Target.jsx",
    ...readdirSync(at("src/components/targets/"))
      .filter((f) => /^(Target|Quest|Notes|Note|Reflect|Quote|Linked|Build)/.test(f))
      .map((f) => `src/components/targets/${f}`),
    ...questsDir.map((f) => `src/components/quests/${f}`),
    "src/components/mark/TargetView.jsx",
  ];
  const dashed = mine.filter((p) => /[—–]|["'`>][^"'`<\n]* -- [^"'`<\n]*["'`<]/.test(read(p)));
  ok("no em or en dashes in a target's page", dashed.length === 0, dashed.join(", "));
  ok("no model's name on a target's page", mine.every((p) => !/\b(claude|gpt|openai|anthropic|gemini)\b/i.test(read(p))));
}

// (end of targets tab, part 3)
// ---------------------------------------------------------------------------


// ===== Targets tab (PR 3, part 4) =====
// Add this part's tests directly under the line above.
{
}

// (end of targets tab, part 4)

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
