import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Check, Loader2, Mic, PenLine, Plus, RotateCcw, Sparkles, Square, Trash2, Volume2, X } from "lucide-react";
import { deleteEveningEntry, fetchEveningEntries, generateReflectionQuestions, saveEveningEntry } from "../../lib/api";
import { mergeEntries, newEntry, questionsFrom, targetChoices, unsaved, TEXT_MAX } from "../../lib/eveningEntries";
import { appendWords, canRecord, playReply, recordUntilQuiet, sayAloud, stopReply, transcribeBlob, unlockAudio } from "../../lib/voice";
import { haptic } from "../../lib/haptics";
import { friendlyError, plainError } from "../../lib/errors";
import VoiceButton from "../ui/VoiceButton";
import { useConfirm } from "../ui/Feedback";
import { overlay } from "../ui/Overlay";

// The evening's writing (Aaron, 2026-11-28): "allow me to choose from any of
// my targets to write about, I don't have to do any or all of them. I can
// choose between those, a 'choose for me' that generates questions, or an
// 'I pick' and I can just keep adding journal entries. I can do as much or
// as little as I want."
//
// Writing about a target places an arrow on it, the entry as its note;
// emptying or removing the entry takes the arrow back.
//
// A big + (as on the Tasks home) starts a new entry; only then do you
// choose what it's about: Choose for me, I pick, or one of your targets.
// Each pick adds an entry: a box to write in (or speak into), and "Talk it
// through", where the Hub reads the entry's question aloud, listens, and
// writes down what you say. Entries save as you go; what's typed lives on
// the phone first, so a dropped signal never costs a word.
//
// `ladder` is ladderOf()'s targets (null while they load). `flushRef` is
// set to a function that saves everything still waiting (before banking);
// it throws when something didn't save. `onCount` hears how many entries
// have words.

const SAVE_AFTER_MS = 1200;

function draftKey(userId, date) {
  return `hub.evening-entries.${userId}.${date}`;
}
function readDraft(userId, date) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(userId, date)) ?? "null");
  } catch (err) {
    console.warn(err);
    return null;
  }
}
function writeDraft(userId, date, list) {
  try {
    const waiting = unsaved(list);
    if (waiting.length) localStorage.setItem(draftKey(userId, date), JSON.stringify(waiting));
    else localStorage.removeItem(draftKey(userId, date));
  } catch (err) {
    console.warn(err);
  }
}

export default function EveningJournal({ userId, date, ladder, flushRef, onCount }) {
  const [entries, setEntries] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [focusLocal, setFocusLocal] = useState(null);
  const [asking, setAsking] = useState(false);
  // The + was tapped: choosing what the new entry is about.
  const [choosing, setChoosing] = useState(false);
  const [talkingLocal, setTalkingLocal] = useState(null);
  const latest = useRef([]);
  const chains = useRef(new Map());
  const timers = useRef(new Map());
  const questions = useRef([]);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const rows = await fetchEveningEntries(userId, date);
      const list = mergeEntries(rows, readDraft(userId, date));
      latest.current = list;
      setEntries(list);
    } catch (err) {
      // Still let him write: the draft on the phone is the starting point.
      setLoadError(friendlyError(err, "Couldn't read tonight's entries."));
      const list = mergeEntries([], readDraft(userId, date));
      latest.current = list;
      setEntries(list);
    }
  }, [userId, date]);

  useEffect(() => {
    if (userId) load();
  }, [userId, load]);

  const update = useCallback(
    (fn) => {
      setEntries((cur) => {
        const next = fn(cur ?? []);
        latest.current = next;
        writeDraft(userId, date, next);
        return next;
      });
    },
    [userId, date],
  );

  useEffect(() => {
    onCount?.((entries ?? []).filter((e) => e.text.trim()).length);
  }, [entries, onCount]);

  // One entry's saves go one after another, each sending what the entry
  // holds when it starts, so a slow save never lands over a newer one.
  const saveOne = useCallback(
    (local) => {
      clearTimeout(timers.current.get(local));
      timers.current.delete(local);
      const prev = chains.current.get(local) ?? Promise.resolve(true);
      const run = prev.then(async () => {
        const e = latest.current.find((x) => x.local === local);
        if (!e) return true;
        const words = e.text.trim();
        if (words === (e.saved ?? "").trim()) return true;
        setSavingIds((s) => new Set(s).add(local));
        try {
          if (!words) {
            // Emptied: an entry with nothing in it isn't kept.
            if (e.id) await deleteEveningEntry(e.id, e.arrowId);
            update((list) => list.map((x) => (x.local === local ? { ...x, id: null, arrowId: null, saved: "" } : x)));
          } else {
            const row = await saveEveningEntry(userId, date, { ...e, text: words.slice(0, TEXT_MAX) });
            update((list) => list.map((x) => (x.local === local ? { ...x, id: row.id, arrowId: row.arrow_id ?? null, saved: row.text } : x)));
          }
          setError(null);
          return true;
        } catch (err) {
          setError(`${friendlyError(err, "Couldn't save that.")} What you wrote is kept on this phone.`);
          return false;
        } finally {
          setSavingIds((s) => {
            const n = new Set(s);
            n.delete(local);
            return n;
          });
        }
      });
      chains.current.set(local, run);
      return run;
    },
    [userId, date, update],
  );

  const saveSoon = (local) => {
    clearTimeout(timers.current.get(local));
    timers.current.set(
      local,
      setTimeout(() => saveOne(local), SAVE_AFTER_MS),
    );
  };

  // Words left on this phone by a save that didn't go through are sent as
  // soon as the evening opens again.
  const opened = useRef(false);
  useEffect(() => {
    if (!entries || opened.current) return;
    opened.current = true;
    for (const e of unsaved(entries)) saveOne(e.local);
  }, [entries, saveOne]);

  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = async () => {
      const results = await Promise.all(unsaved(latest.current).map((e) => saveOne(e.local)));
      await Promise.all([...chains.current.values()]);
      if (results.includes(false)) throw plainError("An entry didn't save. It's kept on this phone; try again in a moment.");
      return latest.current.filter((e) => e.text.trim()).length;
    };
    return () => {
      flushRef.current = null;
    };
  }, [flushRef, saveOne]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => clearTimeout(id));
  }, []);

  const add = (entry) => {
    update((list) => [...list, { ...entry, position: list.length }]);
    setFocusLocal(entry.local);
    setChoosing(false);
    haptic("tap");
    requestAnimationFrame(() => document.getElementById(`ej-${entry.local}`)?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "start" }));
  };

  async function chooseForMe() {
    if (asking) return;
    setError(null);
    const asked = (latest.current ?? []).map((e) => e.prompt);
    let next = questions.current.find((q) => !asked.includes(q));
    if (!next) {
      setAsking(true);
      try {
        const q = await generateReflectionQuestions(date);
        questions.current = questionsFrom(q, asked);
        next = questions.current[0];
      } catch (err) {
        console.warn(err);
        setError(friendlyError(err, "Couldn't write a question just now. Try again, or write your own."));
      } finally {
        setAsking(false);
      }
    }
    if (next) {
      questions.current = questions.current.filter((q) => q !== next);
      add(newEntry("ask", { prompt: next }));
    }
  }

  async function remove(e) {
    if (e.text.trim() && !(await confirm({ title: "Remove this entry?", body: "What you wrote in it goes too.", confirmLabel: "Remove", danger: true })))
      return;
    clearTimeout(timers.current.get(e.local));
    try {
      await chains.current.get(e.local);
      if (e.id) await deleteEveningEntry(e.id, e.arrowId);
      update((list) => list.filter((x) => x.local !== e.local));
    } catch (err) {
      setError(friendlyError(err, "Couldn't remove that."));
    }
  }

  const choices = targetChoices(ladder);
  const groups = [];
  for (const c of choices) {
    const g = groups.find((x) => x.name === c.group);
    if (g) g.items.push(c);
    else groups.push({ name: c.group, items: [c] });
  }
  const written = new Set((entries ?? []).filter((e) => e.kind === "target").map((e) => e.targetKey));

  if (!entries) return <p className="empty">Reading tonight's entries…</p>;

  return (
    <div className="ej">
      {loadError && <div className="form-error">{loadError}</div>}

      {error && <div className="form-error">{error}</div>}

      {/* Like the Tasks home: a big + first, then the entries side by side,
          the newest beside the +, swiped left and right. */}
      <div className="ej-row" data-hscroll>
        <button type="button" className="ej-new" onClick={() => setChoosing(true)} aria-label="New entry">
          <Plus size={28} strokeWidth={2} aria-hidden="true" />
          <span>{entries.length ? "New entry" : "Add an entry"}</span>
        </button>
        {[...entries].reverse().map((e) => (
          <EntryCard
            key={e.local}
            entry={e}
            saving={savingIds.has(e.local)}
            autoFocus={focusLocal === e.local && talkingLocal !== e.local}
            talking={talkingLocal === e.local}
            onTalk={(on) => setTalkingLocal(on ? e.local : null)}
            onText={(text) => {
              update((list) => list.map((x) => (x.local === e.local ? { ...x, text } : x)));
              saveSoon(e.local);
            }}
            onSaveNow={() => saveOne(e.local)}
            onRemove={() => remove(e)}
          />
        ))}
      </div>

      {/* The choices pop up over the page, to scroll through and tap one. */}
      {choosing && overlay(
        <div className="sheet-backdrop ej-sheet" onClick={() => setChoosing(false)}>
          <section className="sheet ej-pick" role="dialog" aria-modal="true" aria-label="What's this entry about?" onClick={(e) => e.stopPropagation()}>
            <div className="ej-pick__top">
              <h2 className="ej-pick__h">What's this entry about?</h2>
              <button type="button" className="btn-icon" onClick={() => setChoosing(false)} aria-label="Cancel" title="Cancel">
                <X size={18} />
              </button>
            </div>
            <div className="ej-pick__ways">
              <button type="button" className="ej-way ej-way--ink" onClick={chooseForMe} disabled={asking}>
                {asking ? <Loader2 size={18} className="voice-spin" aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
                <span>{asking ? "Writing a question…" : "Choose for me"}</span>
              </button>
              <button type="button" className="ej-way" onClick={() => add(newEntry("free"))}>
                <PenLine size={18} aria-hidden="true" />
                <span>I pick</span>
              </button>
            </div>
            {choices.length > 0 && (
              <div className="ej-targets">
                {groups.map((g) => (
                  <div key={g.name} className="ej-targets__group">
                    <div className="eyebrow">{g.name}</div>
                    <div className="ej-targets__chips">
                      {g.items.map((c) => (
                        <button
                          key={`${c.kind}-${c.key}`}
                          type="button"
                          className={"ej-chip" + (written.has(c.key) ? " is-written" : "")}
                          onClick={() => add(newEntry("target", { choice: c }))}
                        >
                          {written.has(c.key) && <Check size={13} aria-hidden="true" />}
                          {c.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!ladder && <p className="muted ej-pick__note">Loading your targets…</p>}
          </section>
        </div>
      )}
    </div>
  );
}

// One entry: what it's about, its question, the box, and the ways to speak.
function EntryCard({ entry, saving, autoFocus, talking, onTalk, onText, onSaveNow, onRemove }) {
  const area = useRef(null);
  const textRef = useRef(entry.text);
  textRef.current = entry.text;

  // The box grows with what's written.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(120, el.scrollHeight)}px`;
  }, [entry.text]);

  const label = entry.topic || (entry.kind === "ask" ? "Chosen for you" : "Journal");
  const waiting = entry.text.trim() !== (entry.saved ?? "").trim();

  return (
    <article id={`ej-${entry.local}`} className={"card ej-entry ej-entry--" + entry.kind}>
      <header className="ej-entry__head">
        <span className="eyebrow">{label}</span>
        <span className="ej-entry__state" aria-live="polite">
          {saving ? "Saving…" : waiting ? "" : entry.id ? "Saved" : ""}
        </span>
        <button type="button" className="btn-icon ej-entry__remove" onClick={onRemove} aria-label={`Remove “${label}”`} title="Remove">
          <Trash2 size={15} />
        </button>
      </header>
      {entry.prompt && <p className="ej-entry__q">{entry.prompt}</p>}
      <textarea
        ref={area}
        className="textarea ej-entry__text"
        value={entry.text}
        maxLength={TEXT_MAX}
        onChange={(e) => onText(e.target.value)}
        onBlur={onSaveNow}
        placeholder={entry.kind === "free" ? "Write whatever's on your mind." : "Write as much or as little as you want."}
        aria-label={entry.prompt || label}
        autoFocus={autoFocus}
      />
      {talking ? (
        <TalkBar
          prompt={entry.prompt}
          onWords={(words) => {
            onText(appendWords(textRef.current, words));
          }}
          onDone={() => {
            onTalk(false);
            onSaveNow();
          }}
        />
      ) : (
        <div className="ej-entry__voice">
          <VoiceButton
            label="Speak"
            onAudio={async (blob) => {
              const words = await transcribeBlob(blob);
              if (!words) throw new Error("I didn't catch anything.");
              onText(appendWords(textRef.current, words));
            }}
          />
          {canRecord() && (
            <button
              type="button"
              className="voice-btn voice-btn--ghost"
              onClick={() => {
                unlockAudio();
                onTalk(true);
              }}
            >
              <AudioLines size={14} />
              <span>Talk it through</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}

// Talking it through: the Hub reads the question aloud (when there is one),
// listens, writes down what you said, and listens again until you say
// you're done or tap Done. Saying "that's it" or "done" ends it.
const ENOUGH = /^\s*(that's it|that's all|done|i'm done|nothing else|stop|end)[\s.!,]*$/i;

function TalkBar({ prompt, onWords, onDone }) {
  const [phase, setPhase] = useState("reading");
  const [problem, setProblem] = useState("");
  const [round, setRound] = useState(0);
  const recording = useRef(null);
  const heardOnce = useRef(false);

  useEffect(() => {
    let off = false;
    (async () => {
      setProblem("");
      try {
        if (prompt && round === 0) {
          setPhase("reading");
          const audio = await sayAloud(prompt);
          if (off) return;
          await playReply(audio);
          if (off) return;
        }
        setPhase("listening");
        haptic("tap");
        const take = recordUntilQuiet();
        recording.current = take;
        const blob = await take.done;
        recording.current = null;
        if (off) return;
        if (!blob) {
          setPhase("missed");
          return;
        }
        setPhase("writing");
        const words = await transcribeBlob(blob);
        if (off) return;
        if (!words) {
          setPhase("missed");
          setProblem("I didn't catch anything.");
          return;
        }
        if (ENOUGH.test(words)) {
          haptic("success");
          onDone();
          return;
        }
        heardOnce.current = true;
        onWords(words);
        haptic("success");
        setRound((n) => n + 1); // keep listening for more
      } catch (err) {
        if (off) return;
        recording.current = null;
        haptic("warning");
        setPhase("missed");
        setProblem(err?.name === "NotAllowedError" ? "The Hub needs the microphone. Allow it in Settings for this app." : err?.message || "That didn't work.");
      }
    })();
    return () => {
      off = true;
      recording.current?.cancel();
      recording.current = null;
      stopReply();
    };
    // Runs once per round; prompt and the callbacks don't change mid-talk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const text = {
    reading: "Reading the question…",
    listening: heardOnce.current
      ? "Still listening… say “that's it” or tap Done when you've said it all."
      : "Listening… it writes down what you say when you pause.",
    writing: "Writing it down…",
    missed: problem || "I didn't catch that.",
  }[phase];

  return (
    <div className={"talk-bar" + (phase === "listening" ? " talk-bar--on" : "")} role="status">
      <span className="talk-bar__icon">
        {phase === "reading" ? (
          <Volume2 size={16} />
        ) : phase === "listening" ? (
          <Mic size={16} />
        ) : phase === "writing" ? (
          <Loader2 size={16} className="voice-spin" />
        ) : (
          <RotateCcw size={16} />
        )}
      </span>
      <span className="talk-bar__text">{text}</span>
      <span className="row" style={{ gap: 6, marginLeft: "auto" }}>
        {phase === "missed" && (
          <button
            type="button"
            className="btn btn--sm btn--accent"
            onClick={() => {
              unlockAudio();
              setRound((n) => n + 1);
            }}
          >
            <Mic size={13} />
            Try again
          </button>
        )}
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => {
            if (phase === "listening" && recording.current) {
              // Send what's been said, then stop.
              const take = recording.current;
              recording.current = null;
              take.stop();
              take.done.then(async (blob) => {
                if (!blob) return;
                const words = await transcribeBlob(blob).catch(() => "");
                if (words && !ENOUGH.test(words)) onWords(words);
              });
            }
            onDone();
          }}
          aria-label="Done talking"
        >
          {phase === "listening" ? <Check size={13} /> : <Square size={12} />}
          Done
        </button>
      </span>
    </div>
  );
}
