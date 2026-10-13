import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles, ArrowUp, Plus, History, Trash2, Loader2, RotateCcw, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../components/ui/Feedback";
import { ChartResult } from "../components/AskClaude";
import { MarkdownNote } from "../lib/markdown";
import { askHub, deleteAskConversation, fetchAskConversation, fetchAskConversations } from "../lib/api";
import { STARTERS, answerParts, chartResult, stillWorking, unanswered } from "../lib/ask";
import { friendlyError } from "../lib/errors";
import { useLoad } from "../lib/useLoad";
import useIsMobile from "../lib/useIsMobile";
import "../styles/ask.css";
import "../styles/askhub.css";

// Ask: a conversation about your own record.
//
// You ask in your own words; the assistant looks things up in your tables
// (as many times as the question needs) and answers with words and charts.
// The answer is worked out and saved on the server, so it's there even if
// you leave the page mid-question: come back and it's waiting. While you
// watch, each step it takes shows as it happens.
//
// The conversation open on the page lives in the address (?c=<id>), so Back
// works and a link reopens it.

const POLL_MS = 4000;

export default function Ask() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const touch = useIsMobile();
  const [params, setParams] = useSearchParams();
  const openId = params.get("c");

  const past = useLoad(() => fetchAskConversations(user.id), [user.id]);
  const [showPast, setShowPast] = useState(false);

  const [convo, setConvo] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [live, setLive] = useState(null); // { question, steps } while a question asked here is out
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // The conversation in the address, read fresh whenever it changes.
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    if (!openId) {
      setConvo(null);
      return;
    }
    if (convo?.id === openId) return;
    fetchAskConversation(openId)
      .then((c) => !cancelled && setConvo(c))
      .catch((err) => !cancelled && setLoadError(err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  // An answer still being worked out from an earlier visit: look again
  // every few seconds until it lands.
  const waiting = !live && stillWorking(convo);
  useEffect(() => {
    if (!waiting || !convo) return;
    const t = setTimeout(async () => {
      try {
        const fresh = await fetchAskConversation(convo.id);
        if (fresh) setConvo(fresh);
        if (fresh && !stillWorking(fresh)) past.reload();
      } catch {
        // try again on the next round
      }
    }, POLL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, convo]);

  // New words at the bottom stay in view.
  const messageCount = convo?.messages?.length ?? 0;
  const stepCount = live?.steps.length ?? 0;
  useEffect(() => {
    if (messageCount || live) endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messageCount, stepCount, live]);

  async function send(text) {
    const question = String(text ?? draft).trim();
    if (!question || live) return;
    setDraft("");
    setError(null);
    setShowPast(false);
    setLive({ question, steps: [] });
    let id = convo?.id ?? null;
    try {
      await askHub({
        conversationId: id,
        question,
        onEvent: (event) => {
          if (event.type === "conversation" && !id) {
            id = event.id;
            setConvo({ id: event.id, title: event.title, messages: [], working_since: new Date().toISOString() });
            setParams({ c: event.id });
          }
          if (event.type === "step") setLive((l) => l && { ...l, steps: [...l.steps, event.text] });
        },
      });
    } catch (err) {
      setError(friendlyError(err, "Couldn't get an answer. Try again in a moment."));
    } finally {
      // The saved conversation is the record: read it back, answer and all.
      if (id) {
        try {
          const fresh = await fetchAskConversation(id);
          if (fresh) setConvo(fresh);
        } catch {
          // the page keeps what it has
        }
      }
      setLive(null);
      past.reload();
    }
  }

  function startOver() {
    if (live) return;
    setConvo(null);
    setError(null);
    setShowPast(false);
    setParams({});
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function remove(item) {
    const ok = await confirm({
      title: "Delete this conversation?",
      body: item.title,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAskConversation(item.id);
      if (convo?.id === item.id) startOver();
      past.reload();
    } catch (err) {
      setError(friendlyError(err, "Couldn't delete that."));
    }
  }

  const messages = convo?.messages ?? [];
  // While a question is out, the page shows it as asked; the saved copy
  // would show it twice.
  const shown = live && messages[messages.length - 1]?.role === "user" ? messages.slice(0, -1) : messages;
  const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.text;
  const empty = !convo && !live;

  return (
    <div className="page page--narrow askhub">
      <div className="page-head askhub__head">
        <div>
          <div className="eyebrow">Ask</div>
          <h1 className="page-title" style={{ marginTop: 3 }}>
            {convo?.title && !empty ? convo.title : "Ask about your life"}
          </h1>
          {empty && (
            <p className="page-sub">
              Anything in your Hub: time, habits, plans, reflections, notes, goals, money. It looks it up and answers, with
              charts when they help.
            </p>
          )}
        </div>
        <div className="row askhub__head-actions">
          <button
            type="button"
            className={"btn btn--sm" + (showPast ? " btn--accent" : "")}
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
          >
            <History size={14} />
            Past
          </button>
          {!empty && (
            <button type="button" className="btn btn--sm" onClick={startOver} disabled={Boolean(live)}>
              <Plus size={14} />
              New
            </button>
          )}
        </div>
      </div>

      {showPast && (
        <div className="card askhub-past">
          {past.loading && !past.data ? (
            <p className="empty">Loading…</p>
          ) : (past.data ?? []).length === 0 ? (
            <p className="empty">Nothing asked yet. Your conversations are kept here.</p>
          ) : (
            <ul className="askhub-past__list">
              {past.data.map((item) => (
                <li key={item.id} className={"askhub-past__item" + (item.id === convo?.id ? " is-open" : "")}>
                  <button
                    type="button"
                    className="askhub-past__open"
                    onClick={() => {
                      setShowPast(false);
                      setParams({ c: item.id });
                    }}
                  >
                    <span className="askhub-past__title">{item.title || "Untitled"}</span>
                    <span className="askhub-past__when">{whenLabel(item.updated_at)}</span>
                  </button>
                  <button type="button" className="btn-icon" onClick={() => remove(item)} aria-label="Delete this conversation" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loadError && (
        <div className="form-error" role="alert">
          {friendlyError(loadError, "Couldn't open that conversation.")}
        </div>
      )}

      {empty && (
        <div className="askhub-starters">
          {STARTERS.map((q) => (
            <button key={q} type="button" className="askhub-starter" onClick={() => send(q)}>
              <Sparkles size={13} aria-hidden="true" />
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="askhub-thread">
        {shown.map((m, i) =>
          m.role === "user" ? (
            <Question key={i} text={m.text} />
          ) : m.error ? (
            <div key={i} className="askhub-a askhub-a--error">
              <p>Couldn't answer that: {friendlyError(new Error(m.error), m.error)}</p>
            </div>
          ) : (
            <Answer key={i} message={m} />
          )
        )}

        {live && (
          <>
            <Question text={live.question} />
            <Working steps={live.steps} />
          </>
        )}

        {waiting && <Working steps={[]} resumed />}

        {!live && !waiting && unanswered(convo) && (
          <div className="askhub-a askhub-a--error">
            <p>This one didn't get an answer.</p>
            <button type="button" className="btn btn--sm" onClick={() => send(lastQuestion)}>
              <RotateCcw size={13} />
              Ask again
            </button>
          </div>
        )}

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="askhub-compose"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          ref={inputRef}
          className="askhub-compose__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={empty ? "Ask anything about your record…" : "Ask a follow-up…"}
          aria-label="Your question"
          rows={1}
          maxLength={4000}
          enterKeyHint="send"
          autoFocus={!touch && empty}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className="askhub-compose__send" disabled={!draft.trim() || Boolean(live)} aria-label="Ask" title="Ask">
          {live ? <Loader2 size={17} className="spin" /> : <ArrowUp size={18} strokeWidth={2.4} />}
        </button>
      </form>
    </div>
  );
}

function Question({ text }) {
  return (
    <div className="askhub-q">
      <p>{text}</p>
    </div>
  );
}

function Answer({ message }) {
  const parts = answerParts(message.text, message.charts);
  const steps = message.steps ?? [];
  return (
    <div className="askhub-a">
      {parts.map((part, i) =>
        part.kind === "text" ? (
          <div key={i} className="askhub-a__text">
            <MarkdownNote text={part.text} />
          </div>
        ) : (
          <div key={i} className="askhub-a__chart">
            <ChartResult result={chartResult(part.chart)} />
          </div>
        )
      )}
      {steps.length > 0 && (
        <details className="askhub-a__how">
          <summary>How I found this</summary>
          <ol>
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

// The steps as they happen: done ones ticked, the current one spinning.
function Working({ steps, resumed = false }) {
  return (
    <div className="askhub-working" role="status" aria-live="polite">
      {steps.length === 0 ? (
        <p className="askhub-working__step is-now">
          <Loader2 size={14} className="spin" />
          {resumed ? "Still working on this. It'll appear here when it's ready." : "Reading your question…"}
        </p>
      ) : (
        steps.map((s, i) => (
          <p key={i} className={"askhub-working__step" + (i === steps.length - 1 ? " is-now" : "")}>
            {i === steps.length - 1 ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            {s}
          </p>
        ))
      )}
    </div>
  );
}

// "Today", "Yesterday", "Mon", "Oct 2".
function whenLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
