import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronRight, Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchTemple,
  loadTempleSnapshot,
  addTempleTrip,
  updateTempleTrip,
  saveTemplePermission,
  deleteTemplePermission,
  addTempleHelper,
  deleteTempleHelper,
} from "../lib/api";
import {
  KIND,
  SHORT,
  STAGES,
  TRIP_TYPES,
  buildTemple,
  crowd as buildCrowd,
  fillTrip,
  fsUrl,
  helperNames,
  missingParents,
  nextTrip,
  parseSnapshot,
  permissionNames,
  plainReason,
  relLabel,
  researchGroups,
  tripProgress,
} from "../lib/temple";
import { todayStr } from "../lib/planDates";
import { useLoad } from "../lib/useLoad";
import { haptic } from "../lib/haptics";
import { useToast, useConfirm } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import Crowd from "../components/temple/Crowd";
import FanChart from "../components/temple/FanChart";
import Facts from "../components/temple/Facts";
import { TripSheet, PersonSheet, PermissionSheet, HelperSheet } from "../components/temple/Sheets";
import { fmtShortDate } from "../components/temple/format";
import "../styles/temple.css";

// Temple: doing as much temple work for your ancestors as you can.
//
// FamilySearch is the source of truth. The Hub holds the last snapshot of it
// (your pedigree, every open ordinance and the work you've finished), and on
// top of that only your own planning: trips, helpers and permissions. It
// never decides what's ready, never reserves a name and never edits the
// tree; a trip is finished when FamilySearch shows its names completed.
//
// Five views, each at its own address (/temple/<view>):
//   Next      the group of everyone you've done work for, your next trip,
//             and what the queue would fill after it
//   Queue     every open ordinance by stage
//   Research  records to fix, missing parents, and 110-year permissions
//   Family    your family in numbers, and nine generations as a fan
//   Helpers   women's names, which go to women in your family

const TABS = [
  ["next", "Next"],
  ["queue", "Queue"],
  ["research", "Research"],
  ["family", "Family"],
  ["helpers", "Helpers"],
];

export default function Temple() {
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayStr();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { view: tabParam } = useParams();
  const tab = TABS.some(([id]) => id === tabParam) ? tabParam : "next";

  const { data, error, loading, reload } = useLoad(() => (userId ? fetchTemple(userId) : null), [userId]);
  const view = useMemo(() => (data ? buildTemple(data) : null), [data]);
  const [sheet, setSheet] = useState(null); // { kind, ... }
  const close = useCallback(() => setSheet(null), []);

  // A trip whose names FamilySearch now shows finished is done. Only the
  // snapshot does this; nothing you tick here does.
  const marking = useRef(new Set());
  useEffect(() => {
    if (!view) return;
    for (const t of view.trips) {
      if (t.status !== "planned" || marking.current.has(t.id)) continue;
      if (!tripProgress(t, view).finished) continue;
      marking.current.add(t.id);
      updateTempleTrip(t.id, { status: "done" })
        .then(reload)
        .catch((err) => console.warn(err));
    }
  }, [view, reload]);

  async function write(fn, failure, done) {
    try {
      await fn();
    } catch (err) {
      toast.error(err, failure);
      return false;
    }
    setSheet(null);
    if (done) toast.show(done);
    await reload();
    return true;
  }

  const fileInput = useRef(null);
  const [importing, setImporting] = useState(false);
  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const snap = parseSnapshot(await file.text());
      const counts = await loadTempleSnapshot(userId, snap);
      haptic("win");
      toast.show(`Loaded ${counts.people} people, ${counts.open} open ordinances and ${counts.done} you've done.`);
      await reload();
    } catch (err) {
      toast.error(err, "Couldn't load that snapshot.");
    } finally {
      setImporting(false);
    }
  }

  const sync = view?.lastSync;
  const empty = view && !view.people.length;

  return (
    <div className="page page--narrow temple">
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onFile} />
      <div className="temple-head">
        <div>
          <div className="eyebrow">Family history</div>
          <h1 className="page-title" style={{ marginTop: 2 }}>
            Temple
          </h1>
        </div>
        {view && !empty && (
          <div className="temple-sync">
            {sync ? `From FamilySearch · ${fmtShortDate(sync.synced_at.slice(0, 10), true)}` : "From FamilySearch"}
            <br />
            <button type="button" className="btn-link" onClick={() => fileInput.current?.click()} disabled={importing}>
              {importing ? "Loading…" : "Load a newer snapshot"}
            </button>
          </div>
        )}
      </div>

      {error && <LoadError what="your temple work" error={error} onRetry={reload} stale={Boolean(data)} />}
      {loading && !data && <div className="card muted">Loading…</div>}

      {empty && (
        <div className="card t-empty">
          <h2>Bring in your family from FamilySearch</h2>
          <p>
            Load a snapshot file of your tree, your open ordinances and the work you've done. It's read from FamilySearch on your computer; nothing
            here ever changes FamilySearch.
          </p>
          <button type="button" className="btn btn--accent" onClick={() => fileInput.current?.click()} disabled={importing}>
            <Upload size={15} />
            {importing ? "Loading…" : "Load snapshot"}
          </button>
        </div>
      )}

      {view && !empty && (
        <>
          <div className="temple-tabs">
            <div className="seg" role="tablist" aria-label="Temple">
              {TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={"seg-btn" + (tab === id ? " active" : "")}
                  onClick={() => navigate(id === "next" ? "/temple" : `/temple/${id}`, { replace: true })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="temple-view">
            {tab === "next" && <NextView view={view} today={today} setSheet={setSheet} write={write} confirm={confirm} />}
            {tab === "queue" && <QueueView view={view} setSheet={setSheet} />}
            {tab === "research" && <ResearchView view={view} setSheet={setSheet} />}
            {tab === "family" && <FamilyView view={view} setSheet={setSheet} />}
            {tab === "helpers" && <HelpersView view={view} setSheet={setSheet} write={write} confirm={confirm} />}
          </div>
        </>
      )}

      {sheet?.kind === "trip" && (
        <TripSheet
          view={view}
          type={sheet.type}
          onClose={close}
          onSave={(trip) => write(() => addTempleTrip(userId, trip), "Couldn't save that trip.", `Trip saved for ${fmtShortDate(trip.planned_on)}. It's on Today.`)}
        />
      )}
      {sheet?.kind === "person" && <PersonSheet view={view} pid={sheet.pid} onClose={close} />}
      {sheet?.kind === "permission" && (
        <PermissionSheet
          person={sheet.person}
          current={view.permissions.get(sheet.person.pid)}
          onClose={close}
          onSave={(p) => write(() => saveTemplePermission(userId, p), "Couldn't save that permission.", "Permission logged.")}
          onRemove={() => write(() => deleteTemplePermission(userId, sheet.person.pid), "Couldn't remove that.", "Permission removed.")}
        />
      )}
      {sheet?.kind === "helper" && (
        <HelperSheet onClose={close} onSave={(h) => write(() => addTempleHelper(userId, h), "Couldn't add that helper.", `${h.name} added.`)} />
      )}
    </div>
  );
}

// --- Next ---------------------------------------------------------------------------

function Fill({ n, max }) {
  return (
    <span className="t-fill" aria-label={`${n} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < n ? "on" : ""} />
      ))}
    </span>
  );
}

function Ring({ pct }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--inset)" strokeWidth="9" />
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--ink)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 42 42)" />
      <text x="42" y="47" textAnchor="middle" fontWeight="700" fontSize="16" fill="var(--text)" fontFamily="var(--font)">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

function NextView({ view, today, setSheet, write, confirm }) {
  const crowd = useMemo(() => buildCrowd(view.done), [view.done]);
  const trip = nextTrip(view.trips, today);
  const progress = trip ? tripProgress(trip, view) : null;
  const suggestion = useMemo(() => (trip ? null : fillTrip(view, "seal")), [view, trip]);
  const after = useMemo(() => ["seal", "bap", "ini", "end"].filter((t) => t !== (trip?.kind ?? "seal")).map((t) => ({ t, f: fillTrip(view, t) })), [view, trip]);
  const endBacklog = view.open.filter((o) => o.kind === "end" && (o.stage === "mine" || o.stage === "ready")).length;

  const have = new Set(view.done.map((d) => d.pid));
  const ghosts = [];
  for (const it of trip ? trip.items : suggestion.items.map((c) => ({ pid: c.o.pid, spouse: c.o.spouse_name, gender: c.o.person.gender }))) {
    const g = it.gender ?? view.byPid.get(it.pid)?.gender;
    if (!have.has(it.pid) && !ghosts.some((x) => x.key === it.pid)) ghosts.push({ key: it.pid, gender: g });
  }

  const pct = view.counts.deceased ? view.counts.completed / view.counts.deceased : 0;

  return (
    <>
      <Crowd crowd={crowd} ghosts={ghosts} />

      <section className="card">
        <div className="t-prog">
          <Ring pct={pct} />
          <div>
            <div className="t-big">
              {view.counts.completed}
              <span className="muted" style={{ fontSize: 18 }}>
                {" "}
                / {view.counts.deceased}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              ancestors with all their work done
            </div>
          </div>
        </div>
        <div className="t-stats">
          <div className="t-stat">
            <b>{view.counts.ready}</b>
            <span>Ready now</span>
          </div>
          <div className="t-stat">
            <b>{view.counts.mine}</b>
            <span>Reserved by you</span>
          </div>
          <div className="t-stat">
            <b>{view.counts.research}</b>
            <span>Need research</span>
          </div>
        </div>
      </section>

      {trip ? (
        <section className="card">
          <div className="trip-head">
            <div>
              <div className="eyebrow">Next trip</div>
              <h3>{TRIP_TYPES[trip.kind].name}</h3>
              <div className="muted" style={{ fontSize: 13 }}>
                {fmtShortDate(trip.planned_on)} · {TRIP_TYPES[trip.kind].sub}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <Fill n={trip.items.length} max={Math.max(trip.items.length, TRIP_TYPES[trip.kind].limit)} />
              <div className="mono muted" style={{ fontSize: 12, marginTop: 4 }}>
                {progress.left ? `${trip.items.length - progress.left} of ${trip.items.length} done` : `${trip.items.length} names`}
              </div>
            </div>
          </div>
          <div className="t-checks">
            <button
              type="button"
              className="t-check"
              aria-pressed={Boolean(trip.rechecked_on)}
              onClick={() => write(() => updateTempleTrip(trip.id, { rechecked_on: trip.rechecked_on ? null : today }), "Couldn't save that.")}
            >
              <span className="t-box">{trip.rechecked_on ? "✓" : ""}</span>
              <span>
                <b>Re-checked</b> <span className="muted">· the day before, in FamilySearch, so nothing someone else finished is on it</span>
              </span>
            </button>
            <button
              type="button"
              className="t-check"
              aria-pressed={trip.printed}
              onClick={() => write(() => updateTempleTrip(trip.id, { printed: !trip.printed }), "Couldn't save that.")}
            >
              <span className="t-box">{trip.printed ? "✓" : ""}</span>
              <span>
                <b>Cards printed</b> <span className="muted">· from FamilySearch</span>
              </span>
            </button>
          </div>
          <div className="t-list">
            {progress.items.map((it) => (
              <div key={`${it.pid}|${it.kind}|${it.spouse}`} className={"t-item" + (it.open ? "" : " t-struck")}>
                <div className="t-item__grow">
                  <div className="t-item__name">
                    {it.name}
                    {it.spouse ? ` + ${it.spouse}` : ""}
                  </div>
                  <div className="t-item__sub">
                    {it.lifespan ? `${it.lifespan} · ` : ""}
                    {KIND[it.kind]}
                    {!it.open && <span className="t-done-mark"> · completed</span>}
                  </div>
                </div>
                <a className="t-fs" href={fsUrl(it.pid)} target="_blank" rel="noopener noreferrer">
                  {it.pid} ↗
                </a>
              </div>
            ))}
          </div>
          <p className="t-note">It's marked done when FamilySearch shows every name completed.</p>
          <button
            type="button"
            className="btn-link btn-link--danger"
            style={{ marginTop: 8 }}
            onClick={async () => {
              if (!(await confirm({ title: "Cancel this trip?", body: "Its names go back in the queue.", confirmLabel: "Cancel trip" }))) return;
              write(() => updateTempleTrip(trip.id, { status: "cancelled" }), "Couldn't cancel that trip.", "Trip cancelled.");
            }}
          >
            Cancel this trip
          </button>
        </section>
      ) : (
        <section className="card">
          <div className="eyebrow">Next trip</div>
          <h3 style={{ margin: "2px 0 0", fontSize: 20 }}>Sealings</h3>
          <div className="muted" style={{ fontSize: 13 }}>
            Not planned yet. The queue would fill it with these:
          </div>
          <div className="t-list" style={{ marginTop: 6 }}>
            {suggestion.items.map((c) => (
              <button key={c.o.key} type="button" className="t-item" onClick={() => setSheet({ kind: "person", pid: c.o.pid })}>
                <div className="t-item__grow">
                  <div className="t-item__name">
                    {c.o.person.name}
                    {c.o.kind === "sts" ? ` + ${c.o.spouse_name}` : ""}
                  </div>
                  <div className="t-item__sub">
                    {c.o.person.lifespan} · {KIND[c.o.kind]}
                  </div>
                </div>
                <ChevronRight size={16} className="t-item__chev" />
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--accent btn--lg" style={{ marginTop: 12 }} onClick={() => setSheet({ kind: "trip", type: "seal" })}>
            Plan this trip
          </button>
        </section>
      )}

      <section className="card">
        <div className="row row--between">
          <div className="eyebrow">After that</div>
          <span className="muted" style={{ fontSize: 12.5 }}>
            Filled by your queue
          </span>
        </div>
        <div className="t-list" style={{ marginTop: 6 }}>
          {after.map(({ t, f }) => (
            <button key={t} type="button" className="t-item" onClick={() => setSheet({ kind: "trip", type: t })}>
              <div className="t-item__grow">
                <div className="t-item__name">{TRIP_TYPES[t].name}</div>
                <div className="t-item__sub">
                  {f.items.length ? f.items.map((c) => c.o.person.name).join(", ") : "Nothing ready yet"}
                  {f.waiting.length ? ` · ${f.waiting.length} waiting on an earlier ordinance` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Fill n={f.items.length} max={f.limit} />
                <div className="mono muted" style={{ fontSize: 12 }}>
                  {f.items.length} of {f.limit}
                </div>
              </div>
              <ChevronRight size={16} className="t-item__chev" />
            </button>
          ))}
        </div>
      </section>

      {endBacklog > 3 && (
        <div className="t-hint">
          <b>Endowments are the slow lane.</b> {endBacklog} are reserved or ready, and each session takes one. Plan an endowment trip next time you go
          for sealings.
        </div>
      )}

      <button type="button" className="btn btn--accent btn--lg" onClick={() => setSheet({ kind: "trip", type: "seal" })}>
        Plan a trip
      </button>
    </>
  );
}

// --- Queue ----------------------------------------------------------------------------

const FILTERS = [
  ["all", "All"],
  ["bap", "Baptism"],
  ["ini", "Initiatory"],
  ["end", "Endowment"],
  ["seal", "Sealings"],
];

function inFilter(o, f) {
  if (f === "all") return true;
  if (f === "bap") return o.kind === "bap" || o.kind === "con";
  if (f === "seal") return o.kind === "stp" || o.kind === "sts";
  return o.kind === f;
}

function QueueView({ view, setSheet }) {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState({ ready: true, mine: true });
  const items = view.open.filter((o) => inFilter(o, filter));

  return (
    <>
      <section className="card">
        <div className="row row--between">
          <div className="eyebrow">Open ordinances</div>
          <span className="mono" style={{ fontSize: 13 }}>
            {items.length}
          </span>
        </div>
        <div className="t-strip">
          {STAGES.map((s) => {
            const n = items.filter((o) => o.stage === s.id).length;
            return n ? <span key={s.id} className={`t-stage--${s.id}`} style={{ flex: n }} title={`${s.name}: ${n}`} /> : null;
          })}
        </div>
        <div className="t-legend">
          {STAGES.map((s) => (
            <span key={s.id} className={`t-stage--${s.id}`}>
              <i className="t-dot" />
              {s.name} {items.filter((o) => o.stage === s.id).length}
            </span>
          ))}
        </div>
      </section>
      <div className="t-chips">
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {STAGES.map((s) => {
        const list = items.filter((o) => o.stage === s.id).sort((a, b) => (a.person.gen ?? 99) - (b.person.gen ?? 99));
        if (!list.length) return null;
        const isOpen = Boolean(open[s.id]);
        return (
          <section key={s.id} className={`card t-stage--${s.id}`}>
            <button type="button" className="t-col-head" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}>
              <h4>
                <i className="t-dot" />
                {s.name}
              </h4>
              <span className="mono muted" style={{ fontSize: 13 }}>
                {list.length} {isOpen ? "▴" : "▾"}
              </span>
            </button>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              {s.note}
            </div>
            {isOpen && (
              <div className="t-list" style={{ marginTop: 6 }}>
                {list.map((o) => {
                  const hers = o.person.gender === "F" && ["bap", "con", "ini", "end"].includes(o.kind);
                  return (
                    <button key={o.key} type="button" className="t-item" onClick={() => setSheet({ kind: "person", pid: o.pid })}>
                      <div className="t-item__grow">
                        <div className="t-item__name">
                          {o.person.name}
                          {o.kind === "sts" && o.spouse_name ? <span style={{ fontWeight: 400, color: "var(--text-2)" }}> + {o.spouse_name}</span> : null}
                        </div>
                        <div className="t-item__sub">
                          {o.person.lifespan}
                          {o.person.gen ? ` · gen ${o.person.gen}` : ""}
                          {hers ? " · goes to a helper" : ""}
                        </div>
                      </div>
                      <span className={"t-code" + (hers ? " t-code--her" : "")}>{SHORT[o.kind]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}

// --- Research ----------------------------------------------------------------------------

function ResearchView({ view, setSheet }) {
  const groups = useMemo(() => researchGroups(view), [view]);
  const missing = useMemo(() => missingParents(view.people), [view.people]);
  const perms = permissionNames(view);

  return (
    <>
      <div className="t-hint">Nothing goes into your tree from here. Each fix is made in FamilySearch, and the next snapshot shows it.</div>
      {groups.length > 0 && (
        <section className="card">
          <div className="eyebrow">Fix a record</div>
          <div className="muted" style={{ fontSize: 13 }}>
            These hold back ordinances FamilySearch would otherwise release.
          </div>
          {groups.map((g) => (
            <div key={g.label} style={{ marginTop: 12 }}>
              <div className="row row--between">
                <b>{g.label}</b>
                <span className="mono muted" style={{ fontSize: 13 }}>
                  {g.people.length}
                </span>
              </div>
              <div className="t-list">
                {g.people.map((p) => (
                  <button key={p.pid} type="button" className="t-item" onClick={() => setSheet({ kind: "person", pid: p.pid })}>
                    <div className="t-item__grow">
                      <div className="t-item__name">{p.name}</div>
                      <div className="t-item__sub">
                        {p.lifespan}
                        {p.gen ? ` · gen ${p.gen}` : ""}
                      </div>
                    </div>
                    <ChevronRight size={16} className="t-item__chev" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      {missing.length > 0 && (
        <section className="card">
          <div className="row row--between">
            <div className="eyebrow">Find missing parents</div>
            <span className="mono muted" style={{ fontSize: 13 }}>
              {missing.length}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            Your direct line, generations 6 to 8. Each parent found can open new names.
          </div>
          <div className="t-list" style={{ marginTop: 6 }}>
            {missing.map(({ person: p, missing: m }) => (
              <button key={p.pid} type="button" className="t-item" onClick={() => setSheet({ kind: "person", pid: p.pid })}>
                <div className="t-item__grow">
                  <div className="t-item__name">{p.name}</div>
                  <div className="t-item__sub">
                    {p.lifespan} · gen {p.gen}
                    {p.birth_place ? ` · ${p.birth_place.split(",").pop().trim()}` : ""}
                  </div>
                </div>
                <span className="t-pill">{m === "both" ? "Both parents" : `No ${m}`}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {perms.length > 0 && (
        <section className="card">
          <div className="row row--between">
            <div className="eyebrow">Permissions · 110-year rule</div>
            <span className="mono muted" style={{ fontSize: 13 }}>
              {perms.length}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            Born within 110 years, so the closest living relative has to say yes. Log who gave it here and in FamilySearch.
          </div>
          <div className="t-list" style={{ marginTop: 6 }}>
            {perms.map((o) => {
              const g = view.permissions.get(o.pid);
              return (
                <div key={o.key} className="t-item">
                  <div className="t-item__grow">
                    <div className="t-item__name">{o.person.name}</div>
                    <div className="t-item__sub">
                      {KIND[o.kind]}
                      {o.spouse_name ? ` · ${o.spouse_name}` : ""}
                      {o.person.gen ? ` · ${relLabel(o.person.gen).toLowerCase()}` : ""}
                    </div>
                    {g && (
                      <div className="t-item__sub" style={{ color: "var(--good-text)" }}>
                        ✓ {g.granted_by}
                        {g.relationship ? ` (${g.relationship})` : ""}, {fmtShortDate(g.granted_on, true)}
                      </div>
                    )}
                  </div>
                  <button type="button" className={"t-pill " + (g ? "t-pill--good" : "t-pill--ink")} onClick={() => setSheet({ kind: "permission", person: o.person })}>
                    {g ? "Logged" : "Log"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

// --- Family -------------------------------------------------------------------------------

function FamilyView({ view, setSheet }) {
  const [sel, setSel] = useState(null);
  const picked = sel ? view.byPid.get(sel) : null;
  const unknownBehind = useMemo(() => missingParents(view.people).length, [view.people]);
  const crowd = useMemo(() => buildCrowd(view.done), [view.done]);
  const months = useMemo(() => byMonth(crowd.people), [crowd]);
  const maxMonth = Math.max(1, ...months.map((m) => m.n));
  const open = (pid) => setSheet({ kind: "person", pid });

  return (
    <>
      <Facts people={view.people} onPerson={open} />
      <section className="card">
        <div className="row row--between">
          <div className="eyebrow">Nine generations</div>
          <span className="muted" style={{ fontSize: 12.5 }}>
            Tap a wedge
          </span>
        </div>
        <FanChart people={view.people} selected={sel} onSelect={setSel} />
        <div className="t-legend" style={{ marginTop: 6 }}>
          <span><i className="t-swatch" style={{ background: "#2b2b2b" }} />Done</span>
          <span><i className="t-swatch" style={{ background: "var(--accent)" }} />Ready</span>
          <span><i className="t-swatch" style={{ background: "#f7b48a" }} />Reserved</span>
          <span><i className="t-swatch" style={{ background: "#9a968f" }} />Needs research</span>
          <span><i className="t-swatch" style={{ background: "#c9c5be" }} />Not available</span>
          <span><i className="t-swatch" style={{ background: "#e4e1db" }} />Living</span>
          <span><i className="t-swatch" style={{ border: "1px dashed var(--line-strong)" }} />Unknown</span>
        </div>
        <div style={{ marginTop: 12, minHeight: 44 }}>
          {picked ? (
            <button type="button" className="t-item" style={{ borderTop: 0, padding: 0 }} onClick={() => open(picked.pid)}>
              <div className="t-item__grow">
                <div className="t-item__name">{picked.name}</div>
                <div className="t-item__sub">
                  {picked.lifespan}
                  {picked.gen ? ` · gen ${picked.gen}` : ""}
                  {picked.birth_place ? ` · ${picked.birth_place}` : ""}
                </div>
              </div>
              <ChevronRight size={16} className="t-item__chev" />
            </button>
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>
              Dotted wedges are ancestors still unknown. {unknownBehind} of your generation 6 to 8 ancestors are missing a parent.
            </div>
          )}
        </div>
      </section>
      {months.length > 0 && (
        <section className="card">
          <div className="eyebrow">Your ordinances by month</div>
          <div className="t-month">
            {months.map((m) => (
              <div key={m.key} title={`${m.label}: ${m.n}`}>
                <span>{m.n || ""}</span>
                <b style={{ height: m.n ? Math.max(4, (m.n / maxMonth) * 56) : 2, background: m.n ? undefined : "var(--line)" }} />
                <span>{m.short}</span>
              </div>
            ))}
          </div>
          <p className="t-note">
            {crowd.ordinances} ordinances since {fmtShortDate(crowd.since, true)}. Most at {crowd.temples[0]?.[0]} ({crowd.temples[0]?.[1]}).
          </p>
        </section>
      )}
    </>
  );
}

// The last twelve months of your finished work, one bar each.
function byMonth(people) {
  const counts = new Map();
  for (const p of people) for (const o of p.ordinances) if (o.date) counts.set(o.date.slice(0, 7), (counts.get(o.date.slice(0, 7)) ?? 0) + 1);
  const keys = [...counts.keys()].sort();
  if (!keys.length) return [];
  const last = keys[keys.length - 1];
  const [y, m] = last.split("-").map(Number);
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      key,
      n: counts.get(key) ?? 0,
      short: d.toLocaleDateString("en-US", { month: "short" }).slice(0, 3),
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    });
  }
  return out;
}

// --- Helpers --------------------------------------------------------------------------------

function HelpersView({ view, setSheet, write, confirm }) {
  const { ready, later } = useMemo(() => helperNames(view), [view]);
  const person = (g) => (
    <button key={g.person.pid} type="button" className="t-item" onClick={() => setSheet({ kind: "person", pid: g.person.pid })}>
      <div className="t-item__grow">
        <div className="t-item__name">{g.person.name}</div>
        <div className="t-item__sub">
          {g.person.lifespan}
          {g.ords.some((o) => o.stage === "research") && g.ords[0].reasons?.[0] ? ` · ${plainReason(g.ords[0].reasons[0])}` : ""}
        </div>
      </div>
      <span className="t-code t-code--her">{g.ords.length} ORD</span>
    </button>
  );

  return (
    <>
      <div className="t-hint">You keep every sealing. Women's baptisms, confirmations, initiatories and endowments go to a woman in your family.</div>
      <section className="card">
        <div className="row row--between">
          <div className="eyebrow">Your helpers</div>
          <button type="button" className="t-pill t-pill--ink" onClick={() => setSheet({ kind: "helper" })}>
            + Add
          </button>
        </div>
        <div className="t-list" style={{ marginTop: 6 }}>
          {view.helpers.length ? (
            view.helpers.map((h) => (
              <div key={h.id} className="t-item">
                <div className="t-item__grow">
                  <div className="t-item__name">{h.name}</div>
                  <div className="t-item__sub">
                    {h.per_trip} per trip{h.note ? ` · ${h.note}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-link btn-link--danger"
                  onClick={async () => {
                    if (!(await confirm({ title: `Remove ${h.name}?`, confirmLabel: "Remove" }))) return;
                    write(() => deleteTempleHelper(h.id), "Couldn't remove that helper.", `${h.name} removed.`);
                  }}
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className="t-item muted">Add the women in your family who'll take women's names.</div>
          )}
        </div>
      </section>
      <section className="card">
        <div className="row row--between">
          <div className="eyebrow">Ready to hand off</div>
          <span className="mono muted" style={{ fontSize: 13 }}>
            {ready.length}
          </span>
        </div>
        {ready.length ? (
          <div className="t-list" style={{ marginTop: 6 }}>
            {ready.map(person)}
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            None right now.
          </div>
        )}
        {later.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginTop: 14 }}>
              Coming once research is done
            </div>
            <div className="t-list">{later.map(person)}</div>
          </>
        )}
      </section>
    </>
  );
}
