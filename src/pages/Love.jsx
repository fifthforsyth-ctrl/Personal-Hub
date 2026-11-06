import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Heart, Plus, CalendarHeart, Lightbulb, Trophy, Bell, BellOff, Quote, Archive, Award, NotebookPen, MapPin, Clock, Send } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLoad } from "../lib/useLoad";
import {
  fetchLoveState,
  fetchLove,
  invitePartner,
  acceptInvite,
  declineInvite,
  endPair,
  saveMe,
  markAlertsRead,
  notifyLoveChanged,
  forgetPartner,
  leaderboard,
  handlesFrom,
  cleanHandle,
  deleteShare,
  RATINGS,
} from "../lib/love";
import { pushState, turnOnPush, turnOffPush, sendTestPush } from "../lib/push";
import { todayStr, fmtDayHeading, fmtTimeRange, fmtShortDate } from "../lib/planDates";
import { fmtMinutes } from "../lib/categories";
import { useToast, useConfirm } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import Comments, { ago } from "../components/love/Comments";
import DateSheet from "../components/love/DateSheet";
import ShareWithLove from "../components/love/ShareWithLove";
import "../styles/love.css";

// Love: the one place in the Hub two people share.
//
// Aaron and Zimira each keep their own Hub; this tab is where what they
// choose to share meets: journal answers that @mention the other, quotes
// sent to each other, dates (ideas, plans on both schedules, ratings and a
// leaderboard), banked days and achievements, with comments on all of it.
// Whatever one does, the other is told: a dot on the heart, and a phone
// notification where they've turned them on.

const VIEWS = [
  { key: "together", label: "Together" },
  { key: "dates", label: "Dates" },
  { key: "best", label: "Best dates" },
  { key: "settings", label: "Settings" },
];

export default function Love() {
  const { user } = useAuth();
  const userId = user?.id;
  const state = useLoad(() => (userId ? fetchLoveState(userId) : null), [userId]);

  if (state.error && !state.data) return <div className="page love"><LoadError what="the Love tab" error={state.error} onRetry={state.reload} /></div>;
  if (!state.data) return <div className="page love"><p className="muted">Loading…</p></div>;
  const s = state.data;

  if (!s.pair) return <Invite userId={userId} state={s} onChanged={() => { forgetPartner(); state.reload(); }} />;
  return <Pair userId={userId} s={s} reloadState={state.reload} />;
}

// ---------------------------------------------------------------------------
// Not paired yet: invite, or answer an invite.
// ---------------------------------------------------------------------------

function Invite({ userId, state, onChanged }) {
  const toast = useToast();
  const [f, setF] = useState({ email: "", theirName: "", theirHandles: "", myName: "", myHandles: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function send(e) {
    e.preventDefault();
    setErr(null);
    const theirHandles = handlesFrom(f.theirHandles || f.theirName);
    const myHandles = handlesFrom(f.myHandles || f.myName);
    if (!f.email.includes("@")) return setErr("Their email, the one they sign in to the Hub with.");
    if (!f.theirName.trim() || !f.myName.trim()) return setErr("Both names, please.");
    setBusy(true);
    try {
      await invitePartner({ email: f.email, myName: f.myName.trim(), theirName: f.theirName.trim(), myHandles, theirHandles });
      toast.show(`Invite sent. It's waiting on ${f.theirName.trim()}'s Love tab.`);
      onChanged();
    } catch (error) {
      setErr(error.message || "Couldn't send the invite.");
    } finally {
      setBusy(false);
    }
  }

  async function answer(pairId, yes) {
    setBusy(true);
    try {
      if (yes) await acceptInvite(pairId);
      else await declineInvite(pairId);
      onChanged();
    } catch (error) {
      toast.error(error, "Couldn't answer the invite.");
      setBusy(false);
    }
  }

  return (
    <div className="page page--narrow love">
      <div className="love-head">
        <span className="love-mark"><Heart size={18} fill="currentColor" /></span>
        <div>
          <div className="eyebrow">Love</div>
          <h1 className="page-title">A place for the two of you</h1>
        </div>
      </div>

      {state.invites.map((inv) => (
        <div key={inv.pair_id} className="card card--accent love-invite">
          <p>
            <b>{inv.from_name}</b> invited you to share a Love tab. You'd see each other's @mentions, quotes, dates and shares,
            and nothing else from each other's Hub.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn--accent" disabled={busy} onClick={() => answer(inv.pair_id, true)}>
              <Heart size={14} /> Accept
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => answer(inv.pair_id, false)}>
              Not now
            </button>
          </div>
        </div>
      ))}

      {state.sent ? (
        <div className="card love-invite">
          <p>
            Waiting for <b>{state.sent.invite_name}</b> to accept. When they sign in with <b>{state.sent.invite_email}</b> and open
            Love, the invite is there.
          </p>
          <button type="button" className="btn btn--sm" disabled={busy} onClick={() => answer(state.sent.id, false)}>
            Cancel the invite
          </button>
        </div>
      ) : (
        state.invites.length === 0 && (
          <form className="card love-invite-form" onSubmit={send}>
            <p className="muted">
              Invite the person you love. They need their own Hub account; only what either of you shares here is seen by the other.
            </p>
            <label className="field">
              <span>Their email (the one they sign in with)</span>
              <input className="input" type="email" value={f.email} onChange={set("email")} autoComplete="off" />
            </label>
            <div className="love-two">
              <label className="field">
                <span>Their name</span>
                <input className="input" value={f.theirName} onChange={set("theirName")} placeholder="Zimira" />
              </label>
              <label className="field">
                <span>Mention them as</span>
                <input className="input" value={f.theirHandles} onChange={set("theirHandles")} placeholder="@zimi, @zimira" />
              </label>
              <label className="field">
                <span>Your name</span>
                <input className="input" value={f.myName} onChange={set("myName")} placeholder="Aaron" />
              </label>
              <label className="field">
                <span>Mention you as</span>
                <input className="input" value={f.myHandles} onChange={set("myHandles")} placeholder="@aaron" />
              </label>
            </div>
            {err && <div className="form-error">{err}</div>}
            <button type="submit" className="btn btn--accent btn--block" disabled={busy}>
              <Send size={14} /> Send the invite
            </button>
          </form>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paired
// ---------------------------------------------------------------------------

function Pair({ userId, s, reloadState }) {
  const [params, setParams] = useSearchParams();
  const view = VIEWS.some((v) => v.key === params.get("view")) ? params.get("view") : "together";
  const pairId = s.pair.id;
  const partner = s.partner;
  const names = useMemo(() => ({ [userId]: s.me.name, [partner?.user_id]: partner?.name }), [userId, s.me.name, partner]);
  const { data, error, reload } = useLoad(() => fetchLove(pairId), [pairId]);
  const [sheet, setSheet] = useState(null); // { date } | { startAs }
  const [fresh, setFresh] = useState(() => new Set());

  // Keep up with the other person while the page is open.
  useEffect(() => {
    const again = () => document.visibilityState === "visible" && reload();
    const timer = setInterval(again, 45000);
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("focus", again);
    };
  }, [reload]);

  // What's new is shown as new this visit, and marked read.
  useEffect(() => {
    if (!data) return;
    const unread = data.alerts.filter((a) => !a.read_at);
    if (!unread.length) return;
    setFresh((old) => new Set([...old, ...unread.map((a) => `${a.subject_kind}:${a.subject_id}`)]));
    markAlertsRead(unread.map((a) => a.id)).catch((err) => console.warn(err));
  }, [data]);

  // A notification opens the thing it was about.
  const opened = useRef(null);
  useEffect(() => {
    const open = params.get("open");
    if (!open || !data || opened.current === open) return;
    opened.current = open;
    const [kind, id] = open.split(":");
    if (kind === "date") {
      const d = data.dates.find((x) => x.id === id);
      if (d) setSheet({ date: d });
    } else {
      requestAnimationFrame(() => document.getElementById(`love-${kind}-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
    const next = new URLSearchParams(params);
    next.delete("open");
    setParams(next, { replace: true });
  }, [params, data, setParams]);

  const go = (key) => setParams(key === "together" ? {} : { view: key }, { replace: true });
  const changed = () => {
    reload();
    notifyLoveChanged();
  };
  const sheetDate = sheet?.date ? data?.dates.find((d) => d.id === sheet.date.id) ?? sheet.date : null;

  return (
    <div className="page page--narrow love">
      <div className="love-head">
        <span className="love-mark"><Heart size={18} fill="currentColor" /></span>
        <div>
          <div className="eyebrow">Love</div>
          <h1 className="page-title">{s.me.name} &amp; {partner?.name}</h1>
        </div>
      </div>

      <div className="seg seg--block love-views" role="tablist">
        {VIEWS.map((v) => (
          <button key={v.key} type="button" role="tab" aria-selected={view === v.key} className={"seg-btn" + (view === v.key ? " active" : "")} onClick={() => go(v.key)}>
            {v.label}
          </button>
        ))}
      </div>

      {error && <LoadError what="what you share" error={error} onRetry={reload} stale={Boolean(data)} />}
      {!data && !error && <p className="muted">Loading…</p>}

      {data && view === "together" && (
        <Together userId={userId} pairId={pairId} names={names} partner={partner} me={s.me} data={data} fresh={fresh} onChanged={changed} openDate={(d) => setSheet({ date: d })} />
      )}
      {data && view === "dates" && (
        <Dates userId={userId} data={data} partner={partner} fresh={fresh} onOpen={(d) => setSheet({ date: d })} onNew={(startAs) => setSheet({ startAs })} />
      )}
      {data && view === "best" && <Best userId={userId} data={data} partner={partner} onOpen={(d) => setSheet({ date: d })} />}
      {view === "settings" && <Settings userId={userId} me={s.me} partner={partner} onChanged={() => { forgetPartner(); reloadState(); }} />}

      {sheet && (
        <DateSheet
          key={sheetDate?.id ?? sheet.startAs}
          pairId={pairId}
          userId={userId}
          names={names}
          partnerName={partner?.name}
          date={sheetDate}
          startAs={sheet.startAs}
          ratings={data?.ratings ?? []}
          comments={data?.comments ?? []}
          onClose={() => setSheet(null)}
          onChanged={changed}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Together: everything shared, newest first.
// ---------------------------------------------------------------------------

function Together({ userId, pairId, names, partner, me, data, fresh, onChanged, openDate }) {
  const today = todayStr();
  const items = useMemo(() => {
    const all = [
      ...data.mentions.map((m) => ({ kind: "mention", id: m.id, at: m.created_at, by: m.author, m })),
      ...data.quotes.map((q) => ({ kind: "quote", id: q.id, at: q.created_at, by: q.sender, q })),
      ...data.shares.map((x) => ({ kind: "share", id: x.id, at: x.created_at, by: x.author, x })),
    ];
    return all.sort((a, b) => b.at.localeCompare(a.at));
  }, [data]);

  const next = data.dates
    .filter((d) => d.status === "planned" && d.on_date >= today)
    .sort((a, b) => (a.on_date + (a.start_time ?? "")).localeCompare(b.on_date + (b.start_time ?? "")))[0];
  const toRate = data.dates.filter((d) => d.status === "done" && !data.ratings.some((r) => r.date_id === d.id && r.user_id === userId));
  const common = { pairId, userId, names, comments: data.comments, onChanged };

  return (
    <div className="love-feed">
      <div className="love-actions">
        <ShareWithLove kind="achievement" title="" label="Share a win" className="btn btn--on-page" />
      </div>
      {(next || toRate.length > 0) && (
        <div className="love-strip">
          {next && (
            <button type="button" className="card love-next" onClick={() => openDate(next)}>
              <CalendarHeart size={16} />
              <span>
                <span className="eyebrow">Next date</span>
                <b>{next.title}</b>
                <span className="muted">
                  {fmtDayHeading(next.on_date)}
                  {next.start_time ? ` · ${fmtTimeRange(next.start_time, next.end_time)}` : ""}
                </span>
              </span>
            </button>
          )}
          {toRate.slice(0, 3).map((d) => (
            <button key={d.id} type="button" className="card love-next love-next--rate" onClick={() => openDate(d)}>
              <Trophy size={16} />
              <span>
                <span className="eyebrow">Rate it</span>
                <b>{d.title}</b>
              </span>
            </button>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="card love-empty">
          <p>
            Nothing shared yet. Write <b>@{partner?.handles?.[0] ?? "name"}</b> in any evening journal answer and that answer comes here for{" "}
            {partner?.name}. Quotes have a <b>Send to {partner?.name}</b> button under Share, and banked days and achievements have{" "}
            <b>Share with {partner?.name}</b>.
          </p>
          <p className="muted">They write <b>@{me.handles?.[0] ?? "you"}</b> to reach you.</p>
        </div>
      )}

      {items.map((it) => {
        const isNew = fresh.has(`${it.kind}:${it.id}`);
        const who = it.by === userId ? "You" : names[it.by];
        if (it.kind === "mention") {
          return (
            <article key={it.id} id={`love-mention-${it.id}`} className={"card love-item" + (isNew ? " is-new" : "")}>
              <header className="love-item__head">
                <NotebookPen size={14} />
                <span><b>{who}</b> {it.by === userId ? `mentioned ${partner?.name}` : "mentioned you"} · {it.m.label}</span>
                <span className="love-item__when">{fmtShortDate(it.m.journal_date)}</span>
              </header>
              <p className="love-item__body">{it.m.body}</p>
              <Comments {...common} kind="mention" subjectId={it.id} />
            </article>
          );
        }
        if (it.kind === "quote") {
          return (
            <article key={it.id} id={`love-quote-${it.id}`} className={"card love-item love-item--quote" + (isNew ? " is-new" : "")}>
              <header className="love-item__head">
                <Quote size={14} />
                <span><b>{who}</b> sent {it.by === userId ? partner?.name : "you"} a quote</span>
                <span className="love-item__when">{ago(it.at)}</span>
              </header>
              {it.q.note && <p className="love-item__note">{it.q.note}</p>}
              <blockquote className="love-quote">
                {it.q.text}
                <cite>{it.q.author}{it.q.source ? `, ${it.q.source}` : ""}</cite>
              </blockquote>
              <Comments {...common} kind="quote" subjectId={it.id} />
            </article>
          );
        }
        return <ShareItem key={it.id} it={it} who={who} isNew={isNew} common={common} mine={it.by === userId} onChanged={onChanged} />;
      })}
    </div>
  );
}

function ShareItem({ it, who, isNew, common, mine, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const x = it.x;
  const p = x.payload ?? {};
  const banked = x.kind === "banked_day";

  async function remove() {
    if (!(await confirm({ title: "Take this share back?", body: "It comes off both your Love tabs, with its comments.", confirmLabel: "Take it back" }))) return;
    try {
      await deleteShare(x.id);
      onChanged();
    } catch (err) {
      toast.error(err, "Couldn't take it back.");
    }
  }

  return (
    <article id={`love-share-${x.id}`} className={"card love-item" + (isNew ? " is-new" : "")}>
      <header className="love-item__head">
        {banked ? <Archive size={14} /> : <Award size={14} />}
        <span><b>{who}</b> shared {banked ? "a banked day" : "an achievement"}</span>
        <span className="love-item__when">{ago(x.created_at)}</span>
      </header>
      <h3 className="love-item__title">{x.title}</h3>
      {x.body && <p className="love-item__body">{x.body}</p>}
      {banked && (
        <div className="love-day">
          {p.synopsis && <p className="love-day__synopsis">{p.synopsis}</p>}
          <div className="love-day__nums">
            {p.wins != null && <span><b>{p.wins}</b> wins</span>}
            {p.losses != null && <span><b>{p.losses}</b> losses</span>}
            {p.minutes != null && <span><b>{fmtMinutes(p.minutes)}</b> tracked</span>}
            {p.tasks_total ? <span><b>{p.tasks_done}/{p.tasks_total}</b> tasks</span> : null}
          </div>
          {p.win_labels?.length > 0 && (
            <div className="love-day__wins">
              {p.win_labels.map((w, i) => (
                <span key={i} className="chip">{w}</span>
              ))}
            </div>
          )}
        </div>
      )}
      <Comments {...common} kind="share" subjectId={x.id} />
      {mine && (
        <button type="button" className="btn-link love-item__undo" onClick={remove}>
          Take back
        </button>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

function DateRow({ d, onOpen, isNew, extra }) {
  return (
    <button type="button" className={"love-date" + (isNew ? " is-new" : "")} onClick={() => onOpen(d)}>
      <span className="love-date__title">{d.title}</span>
      <span className="love-date__meta">
        {d.on_date && (
          <span><Clock size={11} />{fmtShortDate(d.on_date)}{d.start_time ? ` · ${fmtTimeRange(d.start_time, d.end_time)}` : ""}</span>
        )}
        {d.place && <span><MapPin size={11} />{d.place}</span>}
        {extra}
      </span>
    </button>
  );
}

function Dates({ userId, data, partner, fresh, onOpen, onNew }) {
  const today = todayStr();
  const isNew = (d) => fresh.has(`date:${d.id}`);
  const byWhen = (a, b) => (a.on_date + (a.start_time ?? "")).localeCompare(b.on_date + (b.start_time ?? ""));
  const coming = data.dates.filter((d) => d.status === "planned" && d.on_date >= today).sort(byWhen);
  const past = data.dates.filter((d) => d.status === "planned" && d.on_date < today).sort(byWhen);
  const ideas = data.dates.filter((d) => d.status === "idea");
  const done = data.dates.filter((d) => d.status === "done").sort((a, b) => byWhen(b, a));
  const rated = (d, who) => data.ratings.some((r) => r.date_id === d.id && (who === "me" ? r.user_id === userId : r.user_id !== userId));

  return (
    <div className="love-dates">
      <div className="love-actions">
        <button type="button" className="btn btn--accent" onClick={() => onNew("planned")}>
          <CalendarHeart size={15} /> Plan a date
        </button>
        <button type="button" className="btn btn--on-page" onClick={() => onNew("idea")}>
          <Lightbulb size={15} /> Add an idea
        </button>
        <button type="button" className="btn btn--on-page" onClick={() => onNew("done")}>
          <Plus size={15} /> One we did
        </button>
      </div>

      {past.length > 0 && (
        <section className="card love-section">
          <div className="card-title">How did it go?</div>
          <p className="card-note">These were planned for days gone by. Open one and mark it done to rate it.</p>
          {past.map((d) => <DateRow key={d.id} d={d} onOpen={onOpen} isNew={isNew(d)} />)}
        </section>
      )}

      <section className="card love-section">
        <div className="card-title">Coming up</div>
        {coming.length === 0 ? <p className="muted love-none">Nothing planned yet.</p> : coming.map((d) => <DateRow key={d.id} d={d} onOpen={onOpen} isNew={isNew(d)} />)}
      </section>

      <section className="card love-section">
        <div className="card-title">Ideas</div>
        {ideas.length === 0 ? (
          <p className="muted love-none">Keep a list here, and plan one when the night comes.</p>
        ) : (
          ideas.map((d) => <DateRow key={d.id} d={d} onOpen={onOpen} isNew={isNew(d)} extra={<span className="love-date__by">{d.created_by === userId ? "yours" : partner?.name}</span>} />)
        )}
      </section>

      <section className="card love-section">
        <div className="card-title">Dates we did</div>
        {done.length === 0 ? (
          <p className="muted love-none">None yet.</p>
        ) : (
          done.map((d) => (
            <DateRow
              key={d.id}
              d={d}
              onOpen={onOpen}
              isNew={isNew(d)}
              extra={!rated(d, "me") ? <span className="love-date__tag">Rate it</span> : !rated(d, "them") ? <span className="love-date__by">waiting on {partner?.name}</span> : null}
            />
          ))
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Best dates: the leaderboard
// ---------------------------------------------------------------------------

function Best({ userId, data, partner, onOpen }) {
  const [by, setBy] = useState("overall");
  const rows = leaderboard(data.dates, data.ratings, by);
  const fmt = (v) => (v == null ? "–" : v % 1 === 0 ? String(v) : v.toFixed(1));

  return (
    <div className="love-best">
      <div className="love-measures" role="group" aria-label="Rank by">
        {[{ key: "overall", label: "Overall" }, ...RATINGS].map((m) => (
          <button key={m.key} type="button" className={"chip chip--tap" + (by === m.key ? " is-on" : "")} onClick={() => setBy(m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card love-empty">
          <p>Once you've done a date and rated it, it lands here. The board keeps every date you've rated, best first.</p>
        </div>
      ) : (
        <ol className="love-board">
          {rows.map((r, i) => {
            const mine = r.ratings.find((x) => x.user_id === userId);
            const theirs = r.ratings.find((x) => x.user_id !== userId);
            return (
              <li key={r.date.id}>
                <button type="button" className={"card love-rank" + (i < 3 ? ` love-rank--${i + 1}` : "")} onClick={() => onOpen(r.date)}>
                  <span className="love-rank__n">{i + 1}</span>
                  <span className="love-rank__what">
                    <b>{r.date.title}</b>
                    <span className="muted">
                      {r.date.on_date ? fmtShortDate(r.date.on_date) : ""}
                      {by === "overall"
                        ? ` · you ${mine ? fmt(avgOf(mine)) : "–"}, ${partner?.name} ${theirs ? fmt(avgOf(theirs)) : "–"}`
                        : ` · you ${fmt(mine?.[by])}, ${partner?.name} ${fmt(theirs?.[by])}`}
                    </span>
                  </span>
                  <span className="love-rank__score">{fmt(r.avg[by])}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function avgOf(r) {
  const vals = RATINGS.map(({ key }) => r[key]).filter((v) => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function Settings({ userId, me, partner, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [push, setPush] = useState(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(me.name);
  const [handles, setHandles] = useState((me.handles ?? []).map((h) => `@${h}`).join(", "));

  useEffect(() => {
    pushState().then(setPush).catch(() => setPush("unsupported"));
  }, []);

  async function togglePush() {
    setBusy(true);
    try {
      if (push === "on") {
        await turnOffPush();
        setPush("off");
      } else {
        setPush(await turnOnPush(userId));
      }
    } catch (err) {
      toast.error(err, "Couldn't change notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const r = await sendTestPush();
      toast.show(r.sent ? "Sent. It should show in a moment." : "No device here is set up for notifications yet.");
    } catch (err) {
      toast.error(err, "The test didn't go.");
    } finally {
      setBusy(false);
    }
  }

  async function saveName(e) {
    e.preventDefault();
    const hs = handlesFrom(handles);
    if (!name.trim()) return;
    try {
      await saveMe(name.trim(), hs);
      setHandles(hs.map((h) => `@${h}`).join(", "));
      toast.show("Saved");
      onChanged();
    } catch (err) {
      toast.error(err, "Couldn't save that.");
    }
  }

  async function end() {
    const ok = await confirm({
      title: "End the Love tab for both of you?",
      body: `${partner?.name} won't see your shares any more, and you won't see theirs. What was shared is kept, out of sight.`,
      confirmLabel: "End it",
    });
    if (!ok) return;
    try {
      await endPair();
      onChanged();
    } catch (err) {
      toast.error(err, "Couldn't end it.");
    }
  }

  return (
    <div className="love-settings">
      <section className="card love-section">
        <div className="card-title">{push === "on" ? <Bell size={15} /> : <BellOff size={15} />}Notifications on this device</div>
        {push === "needs-home-screen" && (
          <p className="card-note">
            On an iPhone they only come to the Hub on your Home Screen. In Safari, tap Share, then <b>Add to Home Screen</b>, open the Hub from
            there and come back here.
          </p>
        )}
        {push === "unsupported" && <p className="card-note">This browser can't show notifications. You'll still see a dot on the heart.</p>}
        {push === "denied" && (
          <p className="card-note">
            Notifications are blocked for the Hub. On an iPhone: Settings → Notifications → Personal Hub → Allow Notifications.
          </p>
        )}
        {(push === "on" || push === "off") && (
          <>
            <p className="card-note">
              {push === "on"
                ? `You'll get a notification when ${partner?.name} mentions you, sends a quote, plans or rates a date, comments or shares something.`
                : `Turn these on to hear about it when ${partner?.name} mentions you, sends a quote, plans or rates a date, comments or shares something.`}
            </p>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={"btn" + (push === "on" ? "" : " btn--accent")} onClick={togglePush} disabled={busy}>
                {push === "on" ? "Turn off here" : "Turn on notifications"}
              </button>
              {push === "on" && (
                <button type="button" className="btn btn--on-page" onClick={test} disabled={busy}>
                  Send me a test
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <section className="card love-section">
        <div className="card-title">Mentions</div>
        <p className="card-note">
          Write <b>@{partner?.handles?.[0] ?? "name"}</b>
          {partner?.handles?.length > 1 ? ` (or ${partner.handles.slice(1).map((h) => `@${h}`).join(", ")})` : ""} in any evening journal answer and
          that one answer is shared with {partner?.name}. Edit it and the shared copy follows; take the @ out and it's unshared. The rest of your
          journal stays yours.
        </p>
        <form onSubmit={saveName} className="love-two">
          <label className="field">
            <span>Your name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </label>
          <label className="field">
            <span>{partner?.name} mentions you as</span>
            <input className="input" value={handles} onChange={(e) => setHandles(e.target.value)} placeholder="@aaron" onBlur={(e) => setHandles(handlesFrom(e.target.value).map((h) => `@${cleanHandle(h)}`).join(", "))} />
          </label>
          <button type="submit" className="btn btn--sm">Save</button>
        </form>
      </section>

      <section className="love-end">
        <button type="button" className="btn-link btn-link--danger" onClick={end}>
          End the Love tab
        </button>
      </section>
    </div>
  );
}
