import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Map as MapIcon, Target, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { addVillageProject, fetchVillage, updateVillageProject } from "../lib/api";
import { ARROWS_PER_SOLDIER, CATALOG, SIZES, bowFor, buildOf, seedFor, shortName, soldiersFor, villageOf } from "../lib/village";
import { TIERS } from "../lib/mark";
import { parseDateStr, todayStr } from "../lib/planDates";
import { countLine } from "../lib/questTasks";
import { useLoad } from "../lib/useLoad";
import { haptic } from "../lib/haptics";
import { useToast } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import Painting from "../village/Painting";
import "../styles/village.css";

// The village, painted: he chooses what to build from the catalog, and
// every task or camp step he finishes, on any quest or lesson, lays its
// pieces on it until it stands; then he chooses the next. The build going
// up is painted as it stands right now (src/village/paint.js), with
// today's pieces in orange and what's still to come in pencil, and every
// build that stands hangs below it. Under it: the soldiers his arrows
// train, the people he has done temple work for, and the old survey map
// (/village/map), where the soldiers drill and the replay runs.
//
// Three views, one page: the village; Choose a build (/village?choose, or
// ?choose=<kind> to point at one), which is Build something else while a
// build is going up; and one build (/village?build=<id>), with what laid
// it. The quests page links to all three. The data is shaped in
// src/lib/village.js.

const day = (s) => (s ? parseDateStr(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const firstLine = (s) => {
  const t = String(s ?? "").trim().split("\n")[0];
  return t.length > 140 ? `${t.slice(0, 137)}…` : t;
};
const laidOn = (p, today) => p.items.filter((i) => i.laid === today).length;
// A build in a sentence: "the windmill", "the Title of Liberty", "Moroni's rampart".
const PROPER = { liberty: "the Title of Liberty", rampart: "Moroni's rampart" };
const the = (b) => PROPER[b.kind] ?? `the ${b.name.toLowerCase()}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// what laid a build, shown at a time
const ITEMS_SHOWN = 12;

export default function Village() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const today = useMemo(() => todayStr(), []);
  const { data: raw, error, loading, reload } = useLoad(() => (userId ? fetchVillage(userId, today) : null), [userId, today]);
  const village = useMemo(() => (raw ? villageOf(raw, today) : null), [raw, today]);

  const search = new URLSearchParams(location.search);
  const buildId = search.get("build");
  const opened = buildId && village ? village.projects.find((p) => p.id === buildId) : null;
  const view = search.has("choose") ? "choose" : buildId && (opened || !village) ? "build" : "main";

  // Opening a build or the catalog starts at its top; coming back puts the
  // village where it was.
  const homeScroll = useRef(0);
  useLayoutEffect(() => {
    const main = document.querySelector(".main");
    if (main) main.scrollTop = view === "main" ? homeScroll.current : 0;
    return () => {
      if (main && view === "main") homeScroll.current = main.scrollTop;
    };
  }, [view, buildId]);

  // Into a view from the village, and back out the same way; a view opened
  // from elsewhere (the quests) goes back out to the village itself.
  const go = (to) => navigate(to, { state: { inVillage: true } });
  const back = () => (location.state?.inVillage ? navigate(-1) : navigate("/village", { replace: true }));

  const going = village && village.current >= 0 ? village.projects[village.current] : null;

  // Choose a build: a new one on the next plot, or (while one is going up)
  // something else on its plot, keeping the tasks already laid. While it
  // saves, the catalog stays as it was asked from, so the reload (in which
  // the swapped build may already stand) doesn't change it under him.
  const [saving, setSaving] = useState(null);
  async function build(c) {
    const was = going;
    setSaving({ kind: c.kind, village, going: was });
    try {
      if (was) await updateVillageProject(was.id, { kind: c.kind, seed: seedFor(c.kind), need: c.need });
      else await addVillageProject(userId, { kind: c.kind, seed: seedFor(c.kind), plot: village.nextPlot, need: c.need, today });
      haptic("success");
      await reload();
      back();
      const laid = was ? was.done : village.waiting;
      toast.show(
        laid >= c.need
          ? `${c.name} it is, and it stands: the ${countLine(laid, "task", "tasks")} already finished built it.`
          : `${c.name} it is. Every task you finish lays its pieces here.`
      );
    } catch (err) {
      toast.error(err, "Couldn't save that build. Try again.");
      setSaving(null);
    }
  }
  // Out of the catalog, nothing is held any more.
  useEffect(() => {
    if (view !== "choose") setSaving(null);
  }, [view]);

  if (!village) {
    return (
      <div className="page vl">
        <Head />
        {error ? <LoadError what="your village" error={error} onRetry={reload} stale={false} /> : loading && <p className="empty">Loading the village…</p>}
      </div>
    );
  }

  // The build at the top of the village: the one going up, or the one that stood today.
  const last = village.projects[village.projects.length - 1];
  const now = going ?? (last && last.complete && last.finishedOn === today ? last : null);
  // The same picture, wherever it shows, is one painting.
  const slotOf = (p) => (p.id === now?.id ? "village:now" : `village:${p.id}`);

  if (view === "choose") {
    return (
      <Choose
        village={saving ? saving.village : village}
        going={saving ? saving.going : going}
        point={search.get("choose")}
        saving={saving?.kind ?? null}
        onBuild={build}
        onBack={back}
      />
    );
  }

  if (view === "build" && opened) {
    return (
      <Build
        p={opened}
        village={village}
        today={today}
        slot={slotOf(opened)}
        live={opened.id === now?.id}
        keep={opened.id === now?.id}
        onBack={back}
        onChoose={() => go("/village?choose")}
      />
    );
  }

  const standing = village.projects.filter((p) => p.complete).sort((a, b) => String(b.finishedOn).localeCompare(String(a.finishedOn)));
  return (
    <div className="page vl">
      <Head />
      {error && <LoadError what="your village" error={error} onRetry={reload} stale />}

      {now ? (
        <Now p={now} today={today} onOpen={() => go(`/village?build=${now.id}`)} onChoose={() => go("/village?choose")} />
      ) : (
        <Empty village={village} onChoose={() => go("/village?choose")} />
      )}

      <Strip village={village} />

      <section className="vl-section" aria-labelledby="vl-standing">
        <div className="vl-section__head">
          <h2 className="eyebrow" id="vl-standing">
            Standing
          </h2>
          {standing.length > 0 && <span className="vl-section__count">{countLine(standing.length, "build", "builds")}</span>}
        </div>
        {standing.length ? (
          <ul className="vl-stood">
            {standing.map((p) => (
              <Stood key={p.id} p={p} today={today} onOpen={() => go(`/village?build=${p.id}`)} />
            ))}
          </ul>
        ) : (
          <p className="vl-quiet">{going ? `Nothing stands yet. ${cap(the(going))} will be the first.` : "Nothing stands yet. Your first build will hang here once it does."}</p>
        )}
      </section>
    </div>
  );
}

function Head() {
  return (
    <header className="vl-head">
      <div className="vl-head__name">
        <div className="eyebrow">More · Village</div>
        <h1 className="page-title">Village</h1>
        <p className="page-sub">Every task you finish, on any quest or lesson, lays the next pieces.</p>
      </div>
    </header>
  );
}

// How far along: done before today in ink, today's in orange.
function Bar({ done, laid, need }) {
  const base = need ? (Math.max(0, done - laid) / need) * 100 : 0;
  const now = need ? (Math.min(laid, done) / need) * 100 : 0;
  return (
    <span className="vl-bar" aria-hidden="true">
      <i style={{ width: `${base}%` }} />
      <i className="vl-bar__today" style={{ width: `${now}%` }} />
    </span>
  );
}

function Count({ p, laid }) {
  return (
    <div className="vl-count">
      <b>{p.done}</b>
      <span>of {countLine(p.need, "task", "tasks")}</span>
      {laid > 0 && <em>+{laid} today</em>}
    </div>
  );
}

// What the colours in the painting mean.
function Legend({ laid }) {
  return (
    <p className="vl-legend">
      {laid > 0 && (
        <span>
          <i className="vl-legend__today" aria-hidden="true" />
          Laid today
        </span>
      )}
      <span>
        <i className="vl-legend__pencil" aria-hidden="true" />
        Still to come, in pencil
      </span>
    </p>
  );
}

function Tags({ c, extra = [] }) {
  const tags = [...(c.tag ? [[c.tag, c.tag === "New" ? "new" : ""]] : []), ...extra.map((t) => [t, ""])];
  if (!tags.length) return null;
  return (
    <span className="vl-tags">
      {tags.map(([t, kind]) => (
        <span key={t} className={`vl-tag${kind ? ` vl-tag--${kind}` : ""}`}>
          {t}
        </span>
      ))}
    </span>
  );
}

// --- The build going up ------------------------------------------------------------

function Now({ p, today, onOpen, onChoose }) {
  const laid = laidOn(p, today);
  const stands = p.complete;
  const c = buildOf(p.kind);
  return (
    <section className="card card--flush vl-now" aria-labelledby="vl-now-h">
      <button type="button" className="vl-now__pic" onClick={onOpen} aria-label={`What laid ${the(p)}`}>
        <Painting
          slot="village:now"
          kind={p.kind}
          done={p.done}
          need={p.need}
          laid={laid}
          live
          stands={stands}
          alt={`${cap(the(p))} as it stands, ${p.done} of ${p.need} tasks in.`}
        />
      </button>
      <div className="vl-now__text">
        <span className="eyebrow">{stands ? "Stands today" : "Building now"}</span>
        <h2 className="vl-name" id="vl-now-h">
          {p.name}
        </h2>
        <Tags c={c} />
        <p className="vl-line">{c.line}</p>
        <Count p={p} laid={laid} />
        <Bar done={p.done} laid={laid} need={p.need} />
        {stands ? (
          <p className="vl-left">Every piece is laid, and its people have moved in.</p>
        ) : (
          <>
            <p className="vl-left">{countLine(p.need - p.done, "more task", "more tasks")} and it stands.</p>
            <Legend laid={laid} />
          </>
        )}
        <div className="vl-actions">
          {stands ? (
            <button type="button" className="btn btn--sm btn--accent" onClick={onChoose}>
              Choose the next build
            </button>
          ) : (
            <button type="button" className="btn btn--sm btn--accent" onClick={onOpen}>
              What laid it
            </button>
          )}
          {!stands && (
            <button type="button" className="btn btn--sm" onClick={onChoose}>
              Build something else
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// Nothing going up: an empty staked plot, waiting for a choice.
function Empty({ village, onChoose }) {
  const waiting = village.waiting;
  return (
    <section className="card vl-empty" aria-labelledby="vl-empty-h">
      <span className="vl-plot" aria-hidden="true" />
      <div className="vl-empty__text">
        <span className="eyebrow">{village.projects.length ? "Nothing going up" : "Your village"}</span>
        <h2 className="vl-name" id="vl-empty-h">
          {village.projects.length ? "Choose your next build" : "Choose your first build"}
        </h2>
        <p className="vl-line">
          {waiting
            ? `${countLine(waiting, "finished task is", "finished tasks are")} waiting to lay the first pieces.`
            : "A forge, a watchtower, a citadel… every task you finish lays its pieces on it."}
        </p>
        <div className="vl-actions">
          <button type="button" className="btn btn--sm btn--accent" onClick={onChoose}>
            Choose a build
          </button>
        </div>
      </div>
    </section>
  );
}

// --- The soldiers, villagers and the map ---------------------------------------

// The stylesheet lays out four tiles (two by two on a phone) but the strip now has three, so they sit in one
// row of three where the strip is 520px wide or more and one under another where it is narrower, never with an
// empty slot or one tile left alone.
const STRIP_COLS = { gridTemplateColumns: "repeat(auto-fit, minmax(clamp(25%, (520px - 100%) * 999, 100%), 1fr))" };

function Strip({ village }) {
  const soldiers = soldiersFor(village.arrows.length);
  const bow = TIERS[bowFor(village.bullseyes.length)];
  const folk = village.villagers.length;
  return (
    <nav className="vl-strip" style={STRIP_COLS} aria-label="Who lives in the village">
      <Link to="/ascent" className="card vl-tile">
        <span className="vl-tile__label">
          <Target size={14} strokeWidth={2} aria-hidden="true" />
          Soldiers
        </span>
        <span className="vl-tile__n">
          <b>{soldiers}</b> {soldiers === 1 ? "soldier" : "soldiers"}
        </span>
        <span className="vl-tile__sub">{soldiers ? `Each with ${bow.name.toLowerCase()}` : `Every ${ARROWS_PER_SOLDIER} arrows trains one`}</span>
      </Link>
      <Link to="/temple" className="card vl-tile">
        <span className="vl-tile__label">
          <Users size={14} strokeWidth={2} aria-hidden="true" />
          Villagers
        </span>
        <span className="vl-tile__n">
          <b>{folk}</b> {folk === 1 ? "villager" : "villagers"}
        </span>
        <span className="vl-tile__sub">{folk ? "From your temple work" : "Temple work brings them"}</span>
      </Link>
      <Link to="/village/map" className="card vl-tile">
        <span className="vl-tile__label">
          <MapIcon size={14} strokeWidth={2} aria-hidden="true" />
          The map
        </span>
        <span className="vl-tile__n vl-tile__n--words">
          See the map <ChevronRight size={15} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="vl-tile__sub">The replay, day by day</span>
      </Link>
    </nav>
  );
}

// --- What stands ---------------------------------------------------------------------

function Stood({ p, today, onOpen }) {
  return (
    <li>
      <button type="button" className="card card--flush vl-card" onClick={onOpen}>
        <Painting
          slot={`village:${p.id}`}
          kind={p.kind}
          done={p.done}
          need={p.need}
          laid={laidOn(p, today)}
          keep={false}
          stands
          lazy
          alt={`${cap(the(p))}.`}
        />
        <span className="vl-card__text">
          <b className="vl-card__name">{p.name}</b>
          <span className="vl-card__meta">
            {p.finishedOn === today ? "Stood today" : `Stood ${day(p.finishedOn)}`} · {countLine(p.need, "task", "tasks")}
          </span>
        </span>
      </button>
    </li>
  );
}

// --- One build, and what laid it ---------------------------------------------------------

function Build({ p, village, today, slot, live, keep, onBack, onChoose }) {
  const c = buildOf(p.kind);
  const laid = laidOn(p, today);
  const going = village.current >= 0 && village.projects[village.current].id === p.id;
  const last = village.projects[village.projects.length - 1];
  const next = p.complete && village.current < 0 && last?.id === p.id;
  const [all, setAll] = useState(false);
  const items = [...p.items].reverse();
  const shown = all ? items : items.slice(0, ITEMS_SHOWN);
  const first = p.items[0]?.laid;
  return (
    <div className="page vl vl--one">
      <button type="button" className="btn-link vl-back" onClick={onBack}>
        <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
        Village
      </button>
      <div className="vl-one">
        <article className="card card--flush vl-build" aria-labelledby="vl-build-h">
          <Painting
            slot={slot}
            kind={p.kind}
            done={p.done}
            need={p.need}
            laid={laid}
            live={live}
            keep={keep}
            stands={p.complete}
            alt={`${cap(the(p))}${p.complete ? "" : `, ${p.done} of ${p.need} tasks in`}.`}
          />
          <div className="vl-build__text">
            <span className="eyebrow">{p.complete ? (p.finishedOn === today ? "Stands today" : `Standing since ${day(p.finishedOn)}`) : going ? "Building now" : "Waiting its turn"}</span>
            <h1 className="vl-name vl-name--big" id="vl-build-h">
              {p.name}
            </h1>
            <Tags c={c} />
            <p className="vl-line">{c.line}</p>
            <Count p={p} laid={laid} />
            <Bar done={p.done} laid={laid} need={p.need} />
            {p.complete ? (
              <p className="vl-left">
                Built from {countLine(p.need, "finished task", "finished tasks")}
                {first && first !== p.finishedOn ? `, ${day(first)} to ${day(p.finishedOn)}.` : "."}
              </p>
            ) : (
              <>
                <p className="vl-left">
                  {countLine(p.need - p.done, "more task", "more tasks")} and it stands. Every task you finish, on any quest or lesson, lays its next pieces here.
                </p>
                <Legend laid={laid} />
              </>
            )}
            <div className="vl-actions">
              {going && (
                <button type="button" className="btn btn--sm" onClick={onChoose}>
                  Build something else
                </button>
              )}
              {next && (
                <button type="button" className="btn btn--sm btn--accent" onClick={onChoose}>
                  Choose the next build
                </button>
              )}
              <Link to="/quests" className={`btn btn--sm${going || next ? "" : " btn--accent"}`}>
                Your quests
              </Link>
            </div>
          </div>
        </article>

        <section className="card vl-laid" aria-labelledby="vl-laid-h">
          <h2 className="card-title" id="vl-laid-h">
            What laid it
          </h2>
          {items.length ? (
            <>
              <ul className="vl-items">
                {shown.map((it) => (
                  <li key={`${it.src}:${it.id}`}>
                    <Link to={it.questId ? `/quests/${it.questId}` : "/quests"} className="vl-item">
                      <i className={it.laid === today ? "today" : ""} aria-hidden="true" />
                      <span>
                        <b>{it.text}</b>
                        <small>{[it.quest && shortName(it.quest), it.laid === today ? "today" : day(it.day)].filter(Boolean).join(" · ")}</small>
                        {it.note && <em>{firstLine(it.note)}</em>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {items.length > shown.length && (
                <button type="button" className="btn-link vl-more" onClick={() => setAll(true)}>
                  {countLine(items.length - shown.length, "earlier task", "earlier tasks")}
                </button>
              )}
            </>
          ) : (
            <p className="card-note">Nothing yet. Tick off a task on any quest and its pieces land here.</p>
          )}
        </section>
      </div>
    </div>
  );
}

// --- Choose a build ----------------------------------------------------------------------

function Choose({ village, going, point, saving, onBuild, onBack }) {
  const change = Boolean(going);
  const laid = change ? going.done : village.waiting;
  const have = new Set(village.projects.filter((p) => p.complete).map((p) => p.kind));
  // Build something else asks first, in place: it replaces what's going up.
  const [asking, setAsking] = useState(null);

  // ?choose=<kind> points at one.
  useEffect(() => {
    if (!point || !CATALOG.some((c) => c.kind === point)) return;
    document.getElementById(`vl-opt-${point}`)?.scrollIntoView({ block: "center" });
  }, [point]);

  return (
    <div className="page vl vl--choose">
      <button type="button" className="btn-link vl-back" onClick={onBack}>
        <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
        Village
      </button>
      <header className="vl-choose__head">
        <div className="eyebrow">{change ? "Build something else" : "Choose a build"}</div>
        <h1 className="page-title">{change ? "What will you build instead?" : village.projects.length ? "What will you build next?" : "What will you build first?"}</h1>
        <p className="page-sub">
          {change
            ? laid
              ? `The ${countLine(laid, "task", "tasks")} already laid on ${the(going)} carry over to the new build.`
              : `Nothing is laid on ${the(going)} yet, so nothing is lost.`
            : laid
              ? `${countLine(laid, "finished task is", "finished tasks are")} waiting, and they lay the first pieces the moment you choose.`
              : "Every task you finish, on any quest or lesson, lays its pieces on it until it stands. Then you choose the next."}
        </p>
      </header>

      {SIZES.map((s) => (
        <section key={s.key} className="vl-section" aria-labelledby={`vl-size-${s.key}`}>
          <div className="vl-section__head">
            <h2 className="eyebrow" id={`vl-size-${s.key}`}>
              {s.label}
            </h2>
            <span className="vl-section__count">{s.line}</span>
          </div>
          <ul className="vl-opts">
            {CATALOG.filter((c) => c.size === s.key).map((c) => {
              const now = change && c.kind === going.kind;
              const atOnce = !now && laid >= c.need;
              const extra = [now ? "Building now" : null, atOnce ? "Stands at once" : null, !now && have.has(c.kind) ? "You have one" : null].filter(Boolean);
              const busy = saving === c.kind;
              return (
                <li key={c.kind} id={`vl-opt-${c.kind}`} className={`card card--flush vl-opt${point === c.kind ? " vl-opt--pointed" : ""}`}>
                  <Painting kind={c.kind} stands lazy alt={`${cap(the(c))}, finished.`} className="vl-opt__pic" />
                  <div className="vl-opt__body">
                    <div className="vl-opt__head">
                      <h3 className="vl-opt__name">{c.name}</h3>
                      <span className="vl-need">{countLine(c.need, "task", "tasks")}</span>
                    </div>
                    <Tags c={c} extra={extra} />
                    <p className="vl-opt__line">{c.line}</p>
                  </div>
                  {now ? null : change && asking === c.kind ? (
                    <div className="vl-ask" role="group" aria-label={`Build ${the(c)} instead?`}>
                      <p>
                        Build {the(c)} instead of {the(going)}?
                        {laid > 0 && ` The ${countLine(laid, "task", "tasks")} on ${the(going)} carry over${atOnce ? ", so it stands at once" : ""}.`}
                      </p>
                      <div className="vl-ask__row">
                        <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setAsking(null)}>
                          Not now
                        </button>
                        <button type="button" className="btn btn--sm btn--accent" disabled={busy} onClick={() => onBuild(c)}>
                          {busy ? "Saving…" : "Yes, build it"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="vl-opt__foot">
                      <button type="button" className="btn btn--sm btn--accent" disabled={Boolean(saving)} onClick={() => (change ? setAsking(c.kind) : onBuild(c))}>
                        {busy ? "Saving…" : change ? "Build this instead" : "Build this"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
