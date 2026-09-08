import { useState } from "react";
import { CuratedCard } from "../components/curator/CuratedCards";
import QuoteWall from "../components/study/QuoteWall";
import CaptureBar from "../components/study/CaptureBar";
import { KindFilter, KindChip } from "../components/study/KindChip";
import NoteReader from "../components/study/NoteReader";
import { DayCard } from "../components/DayCard";
import ReportCard from "../components/work/ReportCard";
import { reportToText } from "../lib/workReport";
import { NOTE_KINDS } from "../lib/noteKinds";

// A public, signed-out rendering of the new surfaces with sample data.
//
// It imports the real components rather than mocking them up, so what you see
// here is genuinely what the app draws — only the data is invented. Useful for
// looking at the design without a login, and for catching layout problems
// without having to manufacture real records first.

const IMG = (a, b) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/></svg>`
  )}`;

const NOW = new Date().toISOString();

const CARDS = [
  {
    id: "n1",
    note_kind: "motivation",
    title: "Nothing is so fatiguing as the eternal hanging on of an uncompleted task",
    body: "Nothing is so fatiguing as the eternal hanging on of an uncompleted task.",
    essence: "Nothing is so fatiguing as the eternal hanging on of an uncompleted task.",
    source_ref: "William James",
    image_path: IMG("#3a2118", "#0d0c10"),
    body_preview: "Nothing is so fatiguing as the eternal hanging on of an uncompleted task.",
    created_at: "2026-06-11T10:00:00Z",
    pinned: true,
  },
  {
    id: "n2",
    note_kind: "counsel",
    title: "Stop trying to be interesting and be interested",
    body: "President Hale told me to stop trying to be interesting and start being interested. He said most of what I think is awkwardness is just me thinking about myself.",
    essence: "Stop trying to be interesting. Be interested.",
    source_ref: "President Hale, zone conference",
    created_at: "2026-04-02T10:00:00Z",
  },
  {
    id: "n3",
    note_kind: "revelation",
    title: "The car wouldn't start and Brother Ahn pulled in behind me",
    body: "Battery died outside the chapel with forty minutes until the lesson. I said a short prayer, mostly frustrated. Brother Ahn pulled in behind me two minutes later with cables in his trunk — he had no reason to be there on a Tuesday.",
    essence: "The battery died and Brother Ahn pulled in behind me two minutes later, on a Tuesday, with cables.",
    image_path: IMG("#2a2030", "#0b0a10"),
    body_preview: "Battery died outside the chapel with forty minutes until the lesson.",
    created_at: "2026-03-18T10:00:00Z",
  },
  {
    id: "n4",
    note_kind: "insight",
    title: "The plan is not the point",
    body: "I keep grading days by whether I finished the plan. The plan is a guess I made yesterday about a day I hadn't lived yet.",
    essence: "The plan is a guess I made yesterday about a day I hadn't lived yet.",
    created_at: "2026-08-21T10:00:00Z",
  },
  {
    id: "n5",
    note_kind: "resolve",
    title: "Phone stays in the bag until after study",
    body: "Phone stays in the bag until after morning study. No exceptions for a week.",
    essence: "Phone stays in the bag until after morning study.",
    created_at: "2026-08-29T10:00:00Z",
  },
];

const ITEMS = [
  {
    id: "i1",
    slot: "home",
    position: 0,
    reason:
      "You've written about feeling behind three days running, and the same two tasks have rolled over four times — this is the one you kept about unfinished work being the thing that actually tires you.",
    score: null,
    note: CARDS[0],
  },
  {
    id: "i2",
    slot: "day",
    position: 0,
    reason:
      "Tuesday's reflection said you dreaded the doorstep conversations. President Hale said this to you in April about exactly that.",
    score: 9,
    note: CARDS[1],
  },
];

const NOTE = {
  id: "long",
  title: "Everyday Missionary — chapter 3",
  note_kind: "thought",
  body: `## What the work actually is

The work is not a program you run. It is the ordinary attention you already pay to people, pointed somewhere.

> [!insight] What I keep coming back to
> Most of what stops us is not **doctrinal difficulty**. It is the fear of being the strange one in the room.

- It is a fear about ourselves, not about them
- ==Nobody claps== — that is the hard part
- See [[Alma 32|the seed]] for where this started

The hardest part is that nobody claps. You will do this well for months and no one will notice, and the only evidence will be that somebody's life got quietly better.`,
};

const QUOTE = "the ordinary attention you already pay to people";
const START = NOTE.body.indexOf(QUOTE);

const HIGHLIGHTS = [
  { id: "h1", note_id: "long", quoted_text: QUOTE, start_offset: START, end_offset: START + QUOTE.length, child_note_id: "sub1" },
];

const SUB = {
  id: "sub1",
  title: "Attention I already pay, pointed somewhere",
  note_kind: "insight",
  body: "This reframes the whole thing. I'm not being asked to become a different person on the doorstep — I'm being asked to aim something I already do.",
};

const WORK = {
  date: "2026-09-08",
  minutes: 440,
  tasks: [
    { id: "w1", title: "Wire up address validation on checkout", done: true },
    { id: "w2", title: "Fix the Safari layout bug from Friday", done: true },
    { id: "w3", title: "Payment retry logic", done: false, rolled: 2 },
  ],
  notes: [
    { id: "n1", kind: "did", body: "Helped Sam debug the staging deploy", minutes: 35 },
    { id: "n2", kind: "blocked", body: "Need the staging API key to test refunds" },
    { id: "n3", kind: "question", body: "Partial refunds — original card, or store credit?" },
  ],
  tomorrow: [{ title: "Finish payment retries" }, { title: "Start the reporting screen" }],
};

export default function Preview() {
  const [kind, setKind] = useState(null);
  const counts = new Map(NOTE_KINDS.map((k) => [k.key, CARDS.filter((c) => c.note_kind === k.key).length]));

  return (
    <div className="main">
      <div className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">Preview · sample data</div>
            <h1 className="page-title" style={{ marginTop: 3 }}>The new surfaces</h1>
            <p className="page-sub">
              Real components, invented records. Nothing here touches your account.
            </p>
          </div>
        </div>

        <div className="stack" style={{ gap: 30 }}>
          <Section label="Work · the card you screenshot" note="Fixed width, own background, hours and date up top.">
            <ReportCard work={WORK} />
          </Section>

          <Section label="Work · the text you paste" note="Same data, assembled — never written by a model.">
            <pre style={{ background: "var(--inset)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: 16, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", margin: 0 }}>
              {reportToText(WORK)}
            </pre>
          </Section>

          <Section label="Home · what the curator chose" note="The reason it was picked is the part you rate.">
            <CuratedCard item={ITEMS[0]} onScored={async () => {}} />
          </Section>

          <Section label="Day · already scored" note="Scores and your written reason feed the next night's run.">
            <CuratedCard item={ITEMS[1]} onScored={async () => {}} />
          </Section>

          <Section label="Study · recording something" note="No title field, no dialog. Type, tag, keep.">
            <CaptureBar onCapture={async () => {}} />
          </Section>

          <Section label="Study · the kinds" note="Seven, each labelled — colour is an aid, never the encoding.">
            <div className="card">
              <div style={{ marginBottom: 16 }}>
                <KindFilter counts={counts} active={kind} onChange={setKind} />
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {NOTE_KINDS.map((k) => (
                  <KindChip key={k.key} value={k.key} />
                ))}
              </div>
            </div>
          </Section>

          <Section label="Study · the wall" note="Pictures now show on the wall itself, not only when a card is chosen for the front page.">
            <QuoteWall notes={CARDS} onOpen={() => {}} onChanged={async () => {}} />
          </Section>

          <Section
            label="Study · highlight becomes a sub-note"
            note="Rendered as Obsidian markdown — callouts, lists, wikilinks. Select any line to keep it."
          >
            <div className="card">
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>{NOTE.title}</h2>
              <div className="row" style={{ gap: 8, marginBottom: 16 }}>
                <KindChip value="thought" />
                <span className="chip">Chapter 3</span>
              </div>
              <NoteReader
                note={NOTE}
                highlights={HIGHLIGHTS}
                childrenByHighlight={new Map([["sub1", SUB]])}
                onHighlight={() => {}}
                onCreateSubNote={() => {}}
                onDeleteHighlight={() => {}}
                onOpenNote={() => {}}
              />
            </div>
          </Section>

          <Section label="Plan · the day card, repeated" note="The same object at every scale — week, month, home.">
            <div className="week-grid">
              {["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"].map((d, i) => (
                <DayCard
                  key={d}
                  date={d}
                  banked={i < 2}
                  chunks={[
                    { id: `${d}-a`, title: "Study", start_time: "07:00", end_time: "09:00" },
                    { id: `${d}-b`, title: "Ministering", start_time: "10:00", end_time: "13:00" },
                  ]}
                  tasks={[
                    { id: `${d}-1`, title: "Alma 32", status: true, time_chunk_id: `${d}-a` },
                    { id: `${d}-2`, title: "Visit the Ahns", status: i % 2 === 0, time_chunk_id: `${d}-b` },
                  ]}
                  timeRows={[
                    { category: "Study", minutes: 120 },
                    { category: "Serve", minutes: 180 },
                    { category: "Meals", minutes: 60 },
                  ]}
                />
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ label, note, children }) {
  return (
    <section>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <p className="card-note" style={{ marginBottom: 12 }}>{note}</p>
      {children}
    </section>
  );
}
