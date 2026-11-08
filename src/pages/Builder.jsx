import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Wand2, ArrowUp, Settings2, Loader2, Undo2, Check, ChevronDown, ChevronRight, KeyRound, Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../components/ui/Feedback";
import {
  applyBuilderQuest,
  builderChat,
  builderStatus,
  fetchBuilderChanges,
  removeBuilderKey,
  saveBuilderKey,
  undoBuilderChange,
} from "../lib/api";
import { PROVIDERS, proposalCounts } from "../../supabase/functions/builder/shape.js";
import { asTurns, loadChat, saveChat, countsLine } from "../lib/builder";
import { friendlyError } from "../lib/errors";
import { useLoad } from "../lib/useLoad";
import { todayStr } from "../lib/planDates";
import "../styles/builder.css";

// The builder: talk to an AI, on your own key, that changes your own Hub.
//
// It can only propose. A proposal shows as a card you can open and check;
// nothing is saved until you tap Apply, and each Apply is listed under
// Changes with an Undo. When it needs your choice it asks with bubbles you
// tap (or "Something else" to type your own).
//
// The conversation stays on this device for the session (sessionStorage),
// so leaving the page and coming back keeps it.

const STARTERS = ["Turn a task list into a quest", "What can you do?"];

export default function Builder() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const status = useLoad(() => builderStatus(), []);
  const changes = useLoad(() => fetchBuilderChanges(user.id), [user.id]);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState(() => loadChat(user.id));
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);

  const key = status.data?.key ?? null;
  const settingsOpen = showSettings || (!status.loading && !status.error && !key);

  useEffect(() => {
    saveChat(user.id, messages);
  }, [user.id, messages]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, working]);

  async function send(text) {
    const words = String(text ?? draft).trim();
    if (!words || working) return;
    if (!key) {
      setShowSettings(true);
      setError("Add your own AI key first.");
      return;
    }
    const next = [...messages.map((m) => (m.question ? { ...m, answered: true } : m)), { role: "user", text: words }];
    setMessages(next);
    setDraft("");
    setError(null);
    setWorking(true);
    try {
      const answer = await builderChat(asTurns(next));
      setMessages((m) => [...m, { role: "assistant", text: answer.reply, question: answer.question, proposal: answer.proposal }]);
    } catch (err) {
      if (err?.status === 400 && /AI settings/.test(err.message)) setShowSettings(true);
      setError(friendlyError(err, "The builder couldn't answer."));
    } finally {
      setWorking(false);
    }
  }

  function setMessage(i, fields) {
    setMessages((m) => m.map((x, j) => (j === i ? { ...x, ...fields } : x)));
  }

  async function apply(i) {
    const p = messages[i].proposal;
    setMessage(i, { applying: true });
    try {
      const done = await applyBuilderQuest(p, todayStr());
      setMessage(i, { applying: false, applied: { change_id: done.change_id, quest_id: done.quest_id } });
      changes.reload();
    } catch (err) {
      setMessage(i, { applying: false });
      setError(friendlyError(err, "Couldn't make that quest."));
    }
  }

  async function undo(changeId, summary, i = null) {
    try {
      let res = await undoBuilderChange(changeId, false);
      if (res?.ask) {
        const bits = [res.done ? `${res.done} done` : null, res.added ? `${res.added} added since` : null].filter(Boolean).join(" and ");
        const ok = await confirm({
          title: "Undo this quest?",
          body: `${summary}. It has steps ${bits}; undoing removes those too.`,
          confirmLabel: "Undo anyway",
          danger: true,
        });
        if (!ok) return;
        res = await undoBuilderChange(changeId, true);
      }
      if (i !== null) setMessage(i, { undone: true });
      else setMessages((m) => m.map((x) => (x.applied?.change_id === changeId ? { ...x, undone: true } : x)));
      changes.reload();
    } catch (err) {
      setError(friendlyError(err, "Couldn't undo that."));
    }
  }

  function startOver() {
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <div className="page page--narrow builder">
      <div className="page-head">
        <div>
          <h1 className="page-title">Builder</h1>
          <p className="page-sub">
            Change your Hub by talking to it. Nothing is saved until you tap Apply, and every change can be undone.
          </p>
        </div>
        <div className="builder__head-actions">
          {messages.length > 0 && (
            <button className="btn btn--sm btn--on-page" onClick={startOver}>
              <Plus size={14} /> New chat
            </button>
          )}
          <button
            className={"btn-icon btn-icon--bordered" + (settingsOpen ? " active" : "")}
            onClick={() => setShowSettings((v) => !v)}
            aria-label="AI settings"
            title="AI settings"
            aria-expanded={settingsOpen}
          >
            <Settings2 size={17} />
          </button>
        </div>
      </div>

      {settingsOpen && (
        <KeySettings
          status={status}
          onSaved={() => {
            status.reload();
            setShowSettings(false);
            setError(null);
          }}
          onRemoved={() => status.reload()}
          onClose={key ? () => setShowSettings(false) : null}
        />
      )}

      <section className="builder__chat" aria-label="Conversation">
        {messages.length === 0 && (
          <div className="builder__empty">
            <Wand2 size={22} />
            <p>Paste a long list of tasks and I'll turn it into a quest, sorted into camps and sections in your own words.</p>
            <div className="bubbles">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  className="bubble"
                  onClick={() => (s.startsWith("Turn") ? (setDraft("Turn these into a quest:\n"), inputRef.current?.focus()) : send(s))}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="msg msg--me">
              <div className="msg__body">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="msg msg--ai">
              {m.text && <div className="msg__body">{m.text}</div>}
              {m.proposal && (
                <ProposalCard
                  proposal={m.proposal}
                  state={m}
                  onApply={() => apply(i)}
                  onDismiss={() => setMessage(i, { dismissed: true })}
                  onUndo={() => undo(m.applied.change_id, `New quest: ${m.proposal.title}`, i)}
                />
              )}
              {m.question && (
                <div className="msg__question">
                  <p>{m.question.text}</p>
                  {!m.answered && i === messages.length - 1 && (
                    <div className="bubbles">
                      {m.question.options.map((o) => (
                        <button key={o} className="bubble" onClick={() => send(o)} disabled={working}>
                          {o}
                        </button>
                      ))}
                      <button className="bubble bubble--other" onClick={() => inputRef.current?.focus()} disabled={working}>
                        Something else
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ),
        )}

        {working && (
          <div className="msg msg--ai">
            <div className="msg__body msg__body--working">
              <Loader2 size={15} className="spin" /> Working on it… a long list can take a minute.
            </div>
          </div>
        )}
        {error && (
          <p className="builder__error" role="alert">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </section>

      {key && (
        <form
          className="builder__compose"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            ref={inputRef}
            className="textarea"
            rows={draft.split("\n").length > 3 ? 8 : 3}
            placeholder="Paste your tasks, or tell the builder what you want…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className="btn btn--accent builder__send" type="submit" disabled={working || !draft.trim()} aria-label="Send">
            <ArrowUp size={16} />
          </button>
        </form>
      )}

      <Changes changes={changes} onUndo={(c) => undo(c.id, c.summary)} />
    </div>
  );
}

function KeySettings({ status, onSaved, onRemoved, onClose }) {
  const confirm = useConfirm();
  const key = status.data?.key ?? null;
  const [editing, setEditing] = useState(!key);
  const [provider, setProvider] = useState(key?.provider ?? "anthropic");
  const [secret, setSecret] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!status.loading) setEditing(!key);
  }, [status.loading, key]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveBuilderKey({ provider, key: secret, model });
      setSecret("");
      onSaved();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save that key."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Remove your AI key?",
      body: "The builder stops working until you add one again.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeBuilderKey();
      onRemoved();
    } catch (err) {
      setError(friendlyError(err, "Couldn't remove it."));
    }
  }

  return (
    <section className="card builder__settings" aria-label="AI settings">
      <div className="card-head">
        <h2 className="card-title">
          <KeyRound size={16} /> Your AI key
        </h2>
        {onClose && (
          <button className="btn-icon" onClick={onClose} aria-label="Close" title="Close">
            <X size={16} />
          </button>
        )}
      </div>

      {status.loading ? (
        <p className="muted">Loading…</p>
      ) : status.error ? (
        <p className="builder__error">{friendlyError(status.error, "Couldn't load your AI settings.")}</p>
      ) : !editing && key ? (
        <div className="builder__key">
          <p>
            <strong>{PROVIDERS[key.provider]?.label ?? key.provider}</strong>, key ending <span className="mono">…{key.last4}</span>
            <br />
            <span className="muted">Model: {key.model}</span>
          </p>
          <div className="builder__key-actions">
            <button className="btn btn--sm" onClick={() => setEditing(true)}>
              Change
            </button>
            <button className="btn btn--sm btn--danger" onClick={remove}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={save}>
          <p className="card-note">
            The builder runs on your own key, so you choose the AI and pay it directly. Your key is checked, encrypted, and kept on the
            server. It never comes back to this device and the AI never sees it.
          </p>
          <div className="builder__providers" role="radiogroup" aria-label="Provider">
            {Object.entries(PROVIDERS).map(([id, p]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={provider === id}
                className={"bubble" + (provider === id ? " bubble--on" : "")}
                onClick={() => setProvider(id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>API key</span>
            <input
              className="input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={`${PROVIDERS[provider].keyHint}…`}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Model (optional)</span>
            <input
              className="input"
              autoComplete="off"
              spellCheck={false}
              placeholder={PROVIDERS[provider].model}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </label>
          {error && (
            <p className="builder__error" role="alert">
              {error}
            </p>
          )}
          <div className="builder__key-actions">
            <button className="btn btn--accent" type="submit" disabled={busy || secret.trim().length < 10}>
              {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Test and save
            </button>
            {key && (
              <button className="btn btn--ghost" type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

function ProposalCard({ proposal, state, onApply, onDismiss, onUndo }) {
  const [open, setOpen] = useState(false);
  const counts = proposalCounts(proposal);
  const done = state.applied && !state.undone;
  if (state.dismissed && !state.applied) return <p className="proposal__gone muted">Not made.</p>;

  return (
    <div className={"proposal card" + (done ? " proposal--done" : "")}>
      <div className="proposal__top">
        <span className="eyebrow">New quest</span>
        <h3 className="proposal__title">{proposal.title}</h3>
        <p className="proposal__counts">{countsLine(counts)}</p>
        {proposal.note && <p className="proposal__note">{proposal.note}</p>}
      </div>

      <button className="btn-link proposal__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {open ? "Hide" : "See"} every camp and step
      </button>

      {open && (
        <ol className="proposal__camps">
          {proposal.camps.map((c, ci) => (
            <li key={ci} className="proposal__camp">
              <strong>{c.title}</strong>
              {c.sections.map((s, si) => (
                <div key={si} className="proposal__section">
                  <div className="proposal__section-title">{s.title}</div>
                  <ul>
                    {s.steps.map((st, ti) => (
                      <li key={ti}>
                        {st.text}
                        {st.note && <div className="proposal__step-note">{st.note}</div>}
                        {st.subs?.length > 0 && (
                          <ul>
                            {st.subs.map((x, xi) => (
                              <li key={xi}>{x.text}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </li>
          ))}
        </ol>
      )}

      {proposal.duplicates?.length > 0 && <p className="proposal__dupes">Kept once: {proposal.duplicates.join(", ")}</p>}

      <div className="proposal__actions">
        {state.undone ? (
          <span className="muted">Undone.</span>
        ) : done ? (
          <>
            <span className="proposal__made">
              <Check size={15} /> Made
            </span>
            <Link className="btn btn--sm btn--accent" to={`/targets/${state.applied.quest_id}`}>
              Open quest
            </Link>
            <button className="btn btn--sm" onClick={onUndo}>
              <Undo2 size={14} /> Undo
            </button>
          </>
        ) : (
          <>
            <button className="btn btn--accent" onClick={onApply} disabled={state.applying}>
              {state.applying ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Apply
            </button>
            <button className="btn btn--ghost" onClick={onDismiss} disabled={state.applying}>
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Changes({ changes, onUndo }) {
  const list = changes.data ?? [];
  if (!list.length) return null;
  return (
    <section className="builder__changes" aria-label="Changes">
      <h2 className="eyebrow">Changes</h2>
      <ul>
        {list.map((c) => (
          <li key={c.id} className={c.undone_at ? "is-undone" : ""}>
            <div>
              <div className="builder__change-title">{c.summary}</div>
              <div className="faint">
                {new Date(c.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {c.made?.steps ? ` · ${c.made.camps} camps, ${c.made.steps} steps` : ""}
                {c.undone_at ? " · undone" : ""}
              </div>
            </div>
            {!c.undone_at && (
              <div className="builder__change-actions">
                {c.made?.quest_id && (
                  <Link className="btn-link" to={`/targets/${c.made.quest_id}`}>
                    Open
                  </Link>
                )}
                <button className="btn btn--sm" onClick={() => onUndo(c)}>
                  <Undo2 size={14} /> Undo
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
