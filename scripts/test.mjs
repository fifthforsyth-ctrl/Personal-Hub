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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
