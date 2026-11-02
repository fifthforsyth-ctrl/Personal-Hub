import { useEffect, useRef, useState } from "react";
import { PenLine, Check, ChevronLeft, ChevronRight, Sparkles, HandHeart } from "lucide-react";
import { saveJournalEntry, generateReflectionQuestions } from "../../lib/api";
import { friendlyError, plainError } from "../../lib/errors";

// The evening's four cards.
//
// 1. Where did you see God's hand today? Always asked, worded the same every
//    night, with a one-line nudge under it pointing at something in the day.
// 2. A question toward the Savior, and
// 3. a question about what today can teach you. Both are written fresh each
//    night from what you actually logged and what you wrote in recent
//    evenings, and kept on the journal row with your answer.
// 4. Anything else.
//
// They're asked one at a time rather than as a wall of boxes: a page of
// empty textareas gets skimmed, a single question gets answered.

const GODS_HAND = "Where did you see God's hand today?";
const ANYTHING_ELSE = "Anything else about today?";

// Used only when tonight's questions couldn't be written (no signal, the
// assistant down). Better a good general question than no reflection.
const FALLBACK = {
  savior: "Where did you feel closest to the Savior today, and where do you want to be closer tomorrow?",
  learn: "What did today teach you that you want to carry into tomorrow?",
};

const KEYS = ["godsHand", "qSavior", "qLearn", "thoughts"];

function cardsFor(journal) {
  return [
    {
      key: "godsHand",
      label: "God's hand",
      question: GODS_HAND,
      nudge: journal?.gods_hand_nudge,
      placeholder: "The small moments count. Especially the small ones.",
    },
    {
      key: "qSavior",
      label: "Toward the Savior",
      question: journal?.q_savior_prompt || FALLBACK.savior,
      placeholder: "Be specific about a moment, not a general grade.",
    },
    {
      key: "qLearn",
      label: "Learning from today",
      question: journal?.q_learn_prompt || FALLBACK.learn,
      placeholder: "What would you tell yourself tomorrow morning?",
    },
    {
      key: "thoughts",
      label: "Anything else",
      question: ANYTHING_ELSE,
      placeholder: "How the day actually went, in your own words.",
    },
  ];
}

// Every answer a journal row holds, in reading order, with the question it
// answered. Days reflected under the earlier five questions keep their
// labels and wording, so nothing written before this changes meaning.
export function answeredCards(journal) {
  if (!journal) return [];
  const rows = [
    { label: "God's hand", question: GODS_HAND, text: journal.gods_hand },
    { label: "Toward the Savior", question: journal.q_savior_prompt || FALLBACK.savior, text: journal.q_savior },
    { label: "Learning from today", question: journal.q_learn_prompt || FALLBACK.learn, text: journal.q_learn },
    {
      label: "Centered",
      question: "Where was I centered on God and Jesus Christ today — and where did I act as though I were on my own?",
      text: journal.q_christ,
    },
    { label: "Principles", question: "Did today's choices match the principles I say I hold?", text: journal.q_principles },
    {
      label: "Direction",
      question: "Was what I did today actually moving me toward what I'm trying to become, or only toward being busy?",
      text: journal.q_success,
    },
    { label: "Gratitude", question: "What am I grateful for, and where did I see God's hand today?", text: journal.gratitude },
    { label: "Anything else", question: ANYTHING_ELSE, text: journal.thoughts },
  ];
  return rows.filter((r) => (r.text ?? "").trim());
}

function toState(journal) {
  return {
    godsHand: journal?.gods_hand ?? "",
    qSavior: journal?.q_savior ?? "",
    qLearn: journal?.q_learn ?? "",
    thoughts: journal?.thoughts ?? "",
  };
}

const same = (a, b) => KEYS.every((k) => (a[k] ?? "") === (b[k] ?? ""));

// What you type goes to the phone first and stays there until the Hub has it,
// so a dropped signal, a closed app or a failed save never costs you a word.
function draftKey(userId, date) {
  return `hub.reflection-draft.${userId}.${date}`;
}

function readDraft(userId, date) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(userId, date)) ?? "null");
  } catch (err) {
    console.warn(err);
    return null;
  }
}

// `base` is what the Hub held for each answer when the draft was written,
// and `at` when you last typed in it.
function writeDraft(userId, date, answers, base, at) {
  try {
    localStorage.setItem(draftKey(userId, date), JSON.stringify({ answers, base, at }));
  } catch (err) {
    console.warn(err);
  }
}

function clearDraft(userId, date) {
  try {
    localStorage.removeItem(draftKey(userId, date));
  } catch (err) {
    console.warn(err);
  }
}

// The draft laid over the saved answers, one answer at a time. The journal
// row's updated_at can't decide it: a mood or God note saved further down
// the evening stamps the same row, and that says nothing about the
// reflection. So the draft remembers what the Hub held for each answer when
// you typed it (`base`):
//
// - the Hub still holds that, so nothing has changed it since: your draft
//   is the newer word, even when it's a box you cleared on purpose.
// - you never touched it here and the Hub's has changed: the Hub's stands
//   (an older draft from this phone mustn't undo what you saved elsewhere).
// - both changed (another device saved over the same answer), or a draft
//   from before drafts said where they started: the draft wins when it
//   only adds to what's saved, when the saved box is empty, or when you
//   typed it after the row last changed. An empty draft box never blanks
//   a saved answer here.
export function mergeDraft(saved, draft, savedAt = 0) {
  if (!draft?.answers || typeof draft.answers !== "object") return saved;
  const base = draft.base && typeof draft.base === "object" ? draft.base : null;
  const out = { ...saved };
  for (const k of KEYS) {
    const mine = draft.answers[k];
    if (typeof mine !== "string") continue;
    const now = saved[k] ?? "";
    if (mine === now) continue;
    if (base) {
      const from = typeof base[k] === "string" ? base[k] : "";
      if (now === from) {
        out[k] = mine;
        continue;
      }
      if (mine === from) continue;
    }
    if (mine.trim() && (!now.trim() || mine.startsWith(now) || Number(draft.at) > savedAt)) out[k] = mine;
  }
  return out;
}

function startingAnswers(userId, date, journal) {
  const saved = toState(journal);
  const draft = readDraft(userId, date);
  const savedAt = journal?.updated_at ? Date.parse(journal.updated_at) || 0 : 0;
  return { answers: mergeDraft(saved, draft, savedAt), typedAt: Number(draft?.at) || Date.now() };
}

// `moments` are the times you noted God's hand during the day (from the
// Walk with God card), shown under the first question so tonight's answer
// can start from them.
//
// Mount this only once the day has loaded, keyed by the date: what it starts
// from is then the saved answers with this phone's draft laid over them
// (mergeDraft), and nothing that arrives later can wipe what's being typed.
export default function ReflectionFlow({ userId, date, journal, moments = [], onSaved, flushRef }) {
  const [opening] = useState(() => startingAnswers(userId, date, journal));
  const [answers, setAnswers] = useState(opening.answers);
  // When you last typed here, kept with the draft. Only your typing moves it.
  const typedAt = useRef(opening.typedAt);
  const [questions, setQuestions] = useState(null);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // What the database holds, as far as this page knows: only answers that
  // differ from it are sent, so an untouched empty box never blanks a saved one.
  const saved = useRef(toState(journal));
  const latest = useRef(answers);
  latest.current = answers;
  const queue = useRef(Promise.resolve(true));

  useEffect(() => {
    if (same(answers, saved.current)) clearDraft(userId, date);
    else writeDraft(userId, date, answers, saved.current, typedAt.current);
  }, [answers, userId, date]);

  // Before the evening switches to Short, or the day is banked: whatever is
  // typed on a card and not yet sent (no Next tapped) goes now, so it's on
  // the server before anything else can save over the journal. A save that
  // fails throws, which keeps the page where it is.
  const saveRef = useRef(null);
  saveRef.current = save;
  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = async () => {
      const ok = await saveRef.current?.();
      if (ok === false) throw plainError("Your reflection didn't save. It's kept on this phone; try again in a moment.");
    };
    return () => {
      flushRef.current = null;
    };
  }, [flushRef]);

  // Words left on this phone by a save that didn't go through are sent as
  // soon as the evening opens again.
  useEffect(() => {
    if (!same(latest.current, saved.current)) save();
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completed = Boolean(journal?.reflection_completed_at);
  const written = answeredCards(journal);
  const cards = cardsFor({ ...(journal ?? {}), ...(questions ?? {}) });
  const allEmpty = KEYS.every((k) => !(answers[k] ?? "").trim());

  async function start() {
    setStep(0);
    setNotice(null);
    // Tonight's questions are written the first time you start. If they
    // already exist on the row, they're kept: the question you were asked is
    // part of the record.
    if (!journal?.q_savior_prompt && !questions) {
      setPreparing(true);
      try {
        const q = await generateReflectionQuestions(date);
        setQuestions({ gods_hand_nudge: q.gods_hand_nudge, q_savior_prompt: q.savior_question, q_learn_prompt: q.learn_question });
      } catch (err) {
        console.warn(err);
        setNotice("Couldn't write tonight's questions, so these are general ones.");
      } finally {
        setPreparing(false);
      }
    }
    setRunning(true);
  }

  // Saves run one after another, each sending whatever has changed by the
  // time it starts, so a slow save can never land after a newer one.
  function save({ finish = false } = {}) {
    const run = queue.current.then(() => sendChanges(finish));
    queue.current = run;
    return run;
  }

  async function sendChanges(finish) {
    const changed = {};
    for (const k of KEYS) if (latest.current[k] !== saved.current[k]) changed[k] = latest.current[k];
    if (!finish && Object.keys(changed).length === 0) return true;
    setSaving(true);
    try {
      await saveJournalEntry(userId, date, { ...changed, completed: finish });
      saved.current = { ...saved.current, ...changed };
      // What's still only on the phone now starts from what just saved.
      if (same(latest.current, saved.current)) clearDraft(userId, date);
      else writeDraft(userId, date, latest.current, saved.current, typedAt.current);
      setError(null);
      return true;
    } catch (err) {
      setError(`${friendlyError(err, "Couldn't save that.")} What you wrote is kept on this phone.`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Leaving the cards (Finish, or Save & close) is the one time the page
  // around this reloads; Next only saves.
  async function close({ finish }) {
    if (closing) return;
    setClosing(true);
    const ok = await save({ finish });
    setClosing(false);
    if (!ok) return;
    setRunning(false);
    await onSaved?.();
  }

  // --- not started ---------------------------------------------------------
  if (!running) {
    return (
      <div className={"card" + (completed ? "" : " card--accent")}>
        <div className="card-head">
          <span className="card-title"><PenLine size={14} />Reflection</span>
          {completed && <span className="chip chip--accent"><Check size={12} />Done</span>}
        </div>

        {written.length > 0 ? (
          <>
            {written.map((c) => (
              <div key={c.label} style={{ marginBottom: 16 }}>
                <div className="eyebrow" style={{ marginBottom: 5 }}>{c.label}</div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6, fontFamily: "var(--font-serif)" }}>{c.question}</div>
                <div className="prose">{c.text}</div>
              </div>
            ))}
            <button className="btn" onClick={start} disabled={preparing}>
              <PenLine size={14} />
              {preparing ? "Writing tonight's questions…" : completed ? "Revisit the reflection" : "Continue reflecting"}
            </button>
          </>
        ) : (
          <>
            <p className="card-note" style={{ marginBottom: 14 }}>
              {completed
                ? "Finished without writing anything down."
                : "Four cards: where you saw God's hand, two questions written from your day tonight, and anything else."}
            </p>
            <button className={completed ? "btn" : "btn btn--accent"} onClick={start} disabled={preparing}>
              {completed ? <PenLine size={14} /> : <Sparkles size={15} />}
              {preparing ? "Writing tonight's questions…" : completed ? "Revisit the reflection" : "Start reflection"}
            </button>
          </>
        )}
        {!same(answers, saved.current) && (
          <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
            Some of what you wrote is only on this phone so far. It's waiting for you when you continue.
          </p>
        )}
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    );
  }

  // --- in progress ---------------------------------------------------------
  const card = cards[step];
  const isLast = step === cards.length - 1;

  return (
    <div className="card card--accent reflection-card">
      <div className="card-head">
        <span className="card-title"><PenLine size={14} />Reflection</span>
        <span className="mono faint" style={{ fontSize: 11.5 }}>
          {saving ? "Saving… · " : ""}
          {step + 1} / {cards.length}
        </span>
      </div>

      {/* Steps rather than a bar: you can see how many are left and jump
          back to one you want to change. */}
      <div className="reflection-steps">
        {cards.map((c, i) => (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              if (i !== step) save();
              setStep(i);
            }}
            title={c.label}
            aria-label={`${c.label}${i === step ? " (this card)" : ""}`}
            aria-current={i === step ? "step" : undefined}
            className={
              "reflection-step" +
              (i === step ? " reflection-step--here" : (answers[c.key] ?? "").trim() ? " reflection-step--done" : "")
            }
          />
        ))}
      </div>

      {notice && <p className="reflection-nudge" style={{ marginTop: 0 }}>{notice}</p>}

      <div className="eyebrow" style={{ marginBottom: 6 }}>{card.label}</div>
      <p className="question">{card.question}</p>
      {card.nudge && <p className="reflection-nudge">{card.nudge}</p>}

      {card.key === "godsHand" && moments.length > 0 && (
        <div className="moments">
          <div className="eyebrow" style={{ marginBottom: 6 }}><HandHeart size={11} style={{ verticalAlign: -1 }} /> You noted today</div>
          {moments.map((m) => (
            <div key={m.id} className="moment">{m.what_came}</div>
          ))}
        </div>
      )}

      <textarea
        key={card.key}
        className="textarea"
        value={answers[card.key]}
        onChange={(e) => {
          typedAt.current = Date.now();
          setAnswers((a) => ({ ...a, [card.key]: e.target.value }));
        }}
        placeholder={card.placeholder}
        aria-label={card.question}
        style={{ minHeight: 148, fontFamily: "var(--font-serif)", fontSize: 15 }}
        autoFocus
      />

      {error && (
        <div className="form-error row row--between" style={{ marginTop: 12, gap: 10, flexWrap: "wrap" }}>
          <span>{error}</span>
          <button type="button" className="btn btn--sm" onClick={() => save()} disabled={saving}>
            Try again
          </button>
        </div>
      )}

      <div className="row row--between" style={{ marginTop: 14, gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn--ghost" onClick={() => close({ finish: false })} disabled={closing}>
          Save &amp; close
        </button>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn"
            onClick={() => {
              save();
              setStep((s) => Math.max(0, s - 1));
            }}
            disabled={step === 0}
          >
            <ChevronLeft size={14} />
            Back
          </button>
          {isLast ? (
            <button className="btn btn--accent" onClick={() => close({ finish: !allEmpty })} disabled={closing}>
              <Check size={15} />
              {closing ? "Saving…" : allEmpty ? "Finish without writing" : "Finish reflection"}
            </button>
          ) : (
            <button
              className="btn btn--accent"
              onClick={() => {
                save();
                setStep((s) => s + 1);
              }}
            >
              Next
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
