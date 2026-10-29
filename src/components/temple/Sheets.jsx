import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import Sheet from "../ascent/Sheet";
import { KIND, STAGES, TRIP_TYPES, fillTrip, fsUrl, plainReason, relLabel, tripItem } from "../../lib/temple";
import { todayStr, addDays } from "../../lib/planDates";
import { fmtShortDate } from "./format";

// --- Plan a trip ------------------------------------------------------------------

// Pick a type and the queue fills it to its limit. Nothing is reserved from
// here: approving saves the trip and puts it on Today, and the names that
// aren't yours yet are listed with links to reserve them in FamilySearch.
export function TripSheet({ view, type: startType, onClose, onSave }) {
  const [type, setType] = useState(startType || "seal");
  const [limit, setLimit] = useState(TRIP_TYPES[startType || "seal"].limit);
  const [dropped, setDropped] = useState(() => new Set());
  const [date, setDate] = useState(() => nextSaturday(todayStr()));
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fill = useMemo(() => fillTrip(view, type, limit), [view, type, limit]);
  const items = fill.items.filter((c) => !dropped.has(c.o.key));
  const toReserve = items.filter((c) => c.o.stage === "ready");
  const T = TRIP_TYPES[type];

  function pick(t) {
    setType(t);
    setLimit(TRIP_TYPES[t].limit);
    setDropped(new Set());
    setReviewing(false);
  }

  return (
    <Sheet title="Plan a trip" onClose={onClose}>
      <p className="muted" style={{ margin: "-6px 0 0", fontSize: 13.5 }}>
        The queue fills it to your limit: names you hold first, then names that finish a person, then closest relatives, then the oldest.
      </p>
      <div className="t-typepick">
        {Object.entries(TRIP_TYPES).map(([k, v]) => (
          <button key={k} type="button" aria-pressed={k === type} onClick={() => pick(k)}>
            <b>{v.name}</b>
            <span>{v.sub}</span>
          </button>
        ))}
      </div>
      {T.min && (
        <div className="row row--between" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 13.5 }}>
            <b>Sealings this trip</b> <span className="muted">({T.min} to {T.max})</span>
          </span>
          <span className="t-stepper">
            <button type="button" aria-label="Fewer" onClick={() => setLimit((n) => Math.max(T.min, n - 1))}>
              −
            </button>
            <span className="mono">{limit}</span>
            <button type="button" aria-label="More" onClick={() => setLimit((n) => Math.min(T.max, n + 1))}>
              +
            </button>
          </span>
        </div>
      )}
      <div className="card" style={{ padding: "4px 14px" }}>
        <div className="t-list">
          {items.length ? (
            items.map((c, i) => (
              <div key={c.o.key} className="t-item">
                <span className="mono muted" style={{ width: 16 }}>
                  {i + 1}
                </span>
                <div className="t-item__grow">
                  <div className="t-item__name">
                    {c.o.person.name}
                    {c.o.kind === "sts" ? ` + ${c.o.spouse_name}` : ""}
                  </div>
                  <div className="t-item__sub">
                    {KIND[c.o.kind]} · {c.o.person.lifespan}
                  </div>
                  <div className="t-why">
                    {c.why.map((w, j) => (
                      <span key={w} className={"t-pill" + (j === 0 ? (w === "Reserved by you" ? " t-pill--ink" : " t-pill--accent") : "")}>
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  aria-label={`Leave ${c.o.person.name} off this trip`}
                  onClick={() => setDropped((s) => new Set(s).add(c.o.key))}
                >
                  <X size={15} />
                </button>
              </div>
            ))
          ) : (
            <div className="t-item muted">Nothing is ready for this kind of trip yet.</div>
          )}
        </div>
      </div>
      {fill.more > 0 && <p className="t-note">{fill.more} more in line behind these.</p>}
      {fill.waiting.length > 0 && (
        <p className="t-note">
          Waiting on an earlier ordinance: {fill.waiting.map((c) => `${c.o.person.name} (after ${c.waits})`).join(", ")}.
        </p>
      )}
      {type !== "seal" && <p className="t-note">Women's names go to your helpers instead.</p>}

      <label className="field" style={{ marginTop: 14 }}>
        <span>Date</span>
        <input className="input" type="date" value={date} min={todayStr()} onChange={(e) => setDate(e.target.value)} />
      </label>

      {!reviewing ? (
        <button type="button" className="btn btn--accent btn--lg" disabled={!items.length || !date} onClick={() => setReviewing(true)}>
          Review and approve
        </button>
      ) : (
        <>
          <div className="t-hint" style={{ marginBottom: 10 }}>
            {toReserve.length ? (
              <>
                Reserve {toReserve.length === 1 ? "this one" : `these ${toReserve.length}`} in FamilySearch before you go:
                <div className="t-list" style={{ marginTop: 4 }}>
                  {toReserve.map((c) => (
                    <div key={c.o.key} className="t-item" style={{ padding: "6px 0" }}>
                      <span className="t-item__grow t-item__name">{c.o.person.name}</span>
                      <a className="t-fs" href={fsUrl(c.o.pid)} target="_blank" rel="noopener noreferrer">
                        {c.o.pid} ↗
                      </a>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              "You already hold every name on this trip."
            )}{" "}
            Approving saves the trip and puts it on Today. Nothing changes in FamilySearch.
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn--block" onClick={() => setReviewing(false)} disabled={saving}>
              Not yet
            </button>
            <button
              type="button"
              className="btn btn--accent btn--block"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                const ok = await onSave({ kind: type, planned_on: date, items: items.map((c) => tripItem(c.o)) });
                if (!ok) setSaving(false);
              }}
            >
              {saving ? "Saving…" : "Approve"}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function nextSaturday(today) {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, i);
    if (new Date(`${d}T12:00`).getDay() === 6) return d;
  }
  return addDays(today, 1);
}

// --- One person -------------------------------------------------------------------

export function PersonSheet({ view, pid, onClose }) {
  const p = view.byPid.get(pid) ?? view.done.find((d) => d.pid === pid);
  if (!p) return null;
  const ords = view.open.filter((o) => o.pid === pid);
  const done = view.done.find((d) => d.pid === pid);
  const stageName = (id) => STAGES.find((s) => s.id === id)?.name ?? id;

  return (
    <Sheet title={p.name} onClose={onClose}>
      <p className="muted" style={{ margin: "-8px 0 12px", fontSize: 13.5 }}>
        {[p.gen ? relLabel(p.gen) : null, p.lifespan, p.birth_place ? `born in ${p.birth_place}` : null].filter(Boolean).join(" · ")}
      </p>
      <div className="card" style={{ padding: "4px 14px" }}>
        <div className="t-list">
          {ords.length ? (
            ords.map((o) => (
              <div key={o.key} className={`t-item t-stage--${o.stage}`}>
                <i className="t-dot" />
                <div className="t-item__grow">
                  <div className="t-item__name t-item__name--wrap">
                    {KIND[o.kind]}
                    {o.spouse_name ? ` · ${o.spouse_name}` : ""}
                  </div>
                  <div className="t-item__sub">
                    {stageName(o.stage)}
                    {o.stage === "research" && o.reasons?.[0] ? ` · ${plainReason(o.reasons[0])}` : ""}
                    {o.stage === "others" && o.reserved_by ? ` · ${o.reserved_by}` : ""}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="t-item muted">
              {p.rollup_status === "COMPLETED" ? "All their work is done." : p.rollup_status === "LIVING" ? "Living." : "No open ordinances right now."}
            </div>
          )}
        </div>
      </div>
      {done && (
        <p className="t-note">
          You've done {done.ordinances.length === 1 ? "one ordinance" : `${done.ordinances.length} ordinances`} for {p.gender === "F" ? "her" : "him"}.
        </p>
      )}
      <a className="btn btn--accent btn--lg" style={{ marginTop: 14, textDecoration: "none" }} href={fsUrl(pid)} target="_blank" rel="noopener noreferrer">
        Open in FamilySearch ↗
      </a>
    </Sheet>
  );
}

// --- Permission (the 110-year rule) -------------------------------------------------

export function PermissionSheet({ person, current, onClose, onSave, onRemove }) {
  const [by, setBy] = useState(current?.granted_by ?? "");
  const [rel, setRel] = useState(current?.relationship ?? "");
  const [on, setOn] = useState(current?.granted_on ?? todayStr());
  const [note, setNote] = useState(current?.note ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <Sheet title="Log permission" onClose={onClose}>
      <p className="muted" style={{ margin: "-8px 0 12px", fontSize: 13.5 }}>
        {person.name} · {person.lifespan}. Born within 110 years, so the closest living relative has to say yes. Record it in FamilySearch too; the
        sealings move to Ready on the next snapshot.
      </p>
      <form
        className="t-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!by.trim()) return;
          setSaving(true);
          const ok = await onSave({ pid: person.pid, granted_by: by.trim(), relationship: rel.trim(), granted_on: on, note: note.trim() });
          if (!ok) setSaving(false);
        }}
      >
        <label className="field">
          <span>Who gave permission</span>
          <input className="input" value={by} onChange={(e) => setBy(e.target.value)} maxLength={120} required autoFocus />
        </label>
        <label className="field">
          <span>Their relationship</span>
          <input className="input" value={rel} onChange={(e) => setRel(e.target.value)} maxLength={80} placeholder="Spouse, child, sibling…" />
        </label>
        <label className="field">
          <span>Date</span>
          <input className="input" type="date" value={on} onChange={(e) => setOn(e.target.value)} required />
        </label>
        <label className="field">
          <span>Note</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </label>
        <button type="submit" className="btn btn--accent btn--lg" disabled={saving || !by.trim()}>
          {saving ? "Saving…" : "Save"}
        </button>
        {current && (
          <button type="button" className="btn-link btn-link--danger" style={{ marginTop: 12 }} onClick={onRemove} disabled={saving}>
            Remove this permission
          </button>
        )}
      </form>
    </Sheet>
  );
}

// --- A helper ------------------------------------------------------------------------

export function HelperSheet({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [perTrip, setPerTrip] = useState(5);
  const [saving, setSaving] = useState(false);

  return (
    <Sheet title="Add a helper" onClose={onClose}>
      <p className="muted" style={{ margin: "-8px 0 12px", fontSize: 13.5 }}>
        A woman in your family who takes women's baptisms, confirmations, initiatories and endowments.
      </p>
      <form
        className="t-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setSaving(true);
          const ok = await onSave({ name: name.trim(), note: note.trim(), per_trip: perTrip });
          if (!ok) setSaving(false);
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
        </label>
        <label className="field">
          <span>Names per trip</span>
          <input className="input" type="number" min={1} max={20} value={perTrip} onChange={(e) => setPerTrip(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
        </label>
        <label className="field">
          <span>Note</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Her temple, FamilySearch username…" />
        </label>
        <button type="submit" className="btn btn--accent btn--lg" disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Add"}
        </button>
      </form>
    </Sheet>
  );
}

// --- Sync from FamilySearch ----------------------------------------------------------

// The "Sync to Hub" bookmark. It's made here with its own key, dragged to
// the bookmarks bar once, and tapped on FamilySearch after any family
// history. A new one retires the old.
export function SyncSheet({ info, makeBookmark, onLoadFile, onClose }) {
  const [href, setHref] = useState(null);
  const [making, setMaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = useRef(null);

  // React warns about javascript: links, so the bookmark's address is set
  // on the element directly.
  useEffect(() => {
    if (href && link.current) link.current.setAttribute("href", href);
  }, [href]);

  return (
    <Sheet title="Sync from FamilySearch" onClose={onClose}>
      <p className="muted" style={{ margin: "-8px 0 12px", fontSize: 13.5 }}>
        A bookmark that reads your tree and ordinances from FamilySearch, signed in as you, and sends them here. It only reads; nothing in
        FamilySearch changes. Temple loads the newest sync whenever you open it.
      </p>
      {info && (
        <p className="muted" style={{ fontSize: 13 }}>
          Your bookmark was made {fmtShortDate(info.created_at.slice(0, 10), true)}
          {info.last_used_at ? ` and last synced ${fmtShortDate(info.last_used_at.slice(0, 10), true)}` : " and hasn't synced yet"}.
        </p>
      )}
      {!href ? (
        <button
          type="button"
          className="btn btn--accent btn--lg"
          disabled={making}
          onClick={async () => {
            setMaking(true);
            const h = await makeBookmark();
            setMaking(false);
            if (h) setHref(h);
          }}
        >
          {making ? "Making…" : info ? "Make a new bookmark" : "Make my sync bookmark"}
        </button>
      ) : (
        <>
          <ol className="t-steps">
            <li>
              On your computer, drag this button to your bookmarks bar:
              <div style={{ margin: "10px 0" }}>
                <a ref={link} className="btn btn--accent t-bookmark" onClick={(e) => e.preventDefault()} draggable="true">
                  Sync to Hub
                </a>
              </div>
            </li>
            <li>After you do family history, open familysearch.org (signed in) and tap Sync to Hub. It takes a minute or two and shows its progress in the corner.</li>
            <li>Open Temple here. It picks up the new sync on its own.</li>
          </ol>
          <button
            type="button"
            className="btn-link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(href);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied. Paste it as a bookmark's address." : "Can't drag? Copy it instead"}
          </button>
          {info && <p className="t-note">Your old bookmark stops working now; delete it from your bookmarks bar.</p>}
        </>
      )}
      <p className="t-note" style={{ marginTop: 16 }}>
        If the bookmark can't reach the Hub, it saves a file instead.{" "}
        <button type="button" className="btn-link" onClick={onLoadFile}>
          Load a snapshot file
        </button>
      </p>
    </Sheet>
  );
}
