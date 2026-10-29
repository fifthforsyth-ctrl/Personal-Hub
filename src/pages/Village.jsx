import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Crosshair, Pause, Play, Target, Users, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { addVillageProject, fetchVillage, updateVillageProject } from "../lib/api";
import { ARROWS_PER_SOLDIER, CATALOG, SIZES, bowFor, buildOf, seedFor, shortName, soldiersFor, villageOf } from "../lib/village";
import { TIERS, bowLine } from "../lib/mark";
import { addDays, parseDateStr, todayStr } from "../lib/planDates";
import { countLine } from "../lib/questTasks";
import { useLoad } from "../lib/useLoad";
import { haptic } from "../lib/haptics";
import { useToast } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import { thumbOf } from "../village/paint";
import { createWorld } from "../village/world";
import { MAX_SOLDIERS, MAX_VILLAGERS, linkOf, placeLabels, playSecs, spanOf, stateOn } from "../village/plots";
import "../styles/village.css";

// The village, in 3D: every build he has chosen stands on its plot round
// the plaza, in the kit's painterly style, and every task or camp step he
// finishes, on any quest or lesson, lays its next pieces on the one going
// up, and only what is laid shows: it is seen going up. The soldiers his
// arrows train drill in the plaza; the people he has done temple work for
// stand about the lanes. He turns it, comes close, taps a build to see what
// laid it, and replays it all from the first day.
//
// The world is src/village/world.js; this page is everything over it: the
// title and the close button, the labels over the builds, the dock with the
// build going up, the soldiers, the villagers and the replay, and the
// sheets (a build and what laid it, Choose a build, the soldiers, the
// villagers). Without WebGL it is a plain page with the same choices.
//
// Links: /village?build=<id> flies to a build and opens it; /village?choose
// opens Choose a build, and ?choose=<kind> points at one, drawn in pencil
// on its plot. The quests page links to all three.

const day = (s) => (s ? parseDateStr(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const longDay = (s, year) => parseDateStr(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });
const monthYear = (s) => (s ? parseDateStr(s).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "");
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
// a desk: the cards stand in a column on the left, the village beside them
const WIDE = "(min-width: 900px)";

export default function Village() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const today = useMemo(() => todayStr(), []);
  const { data: raw, error, loading, reload } = useLoad(() => (userId ? fetchVillage(userId, today) : null), [userId, today]);
  const village = useMemo(() => (raw ? villageOf(raw, today) : null), [raw, today]);

  // Back where he came from, or to Today when the village was the first page
  // opened. The router numbers its history entries (0 is the first page of the
  // visit, and /village/map's redirect replaces it, so it stays first).
  const first = useRef((window.history.state?.idx ?? (location.key === "default" ? 0 : 1)) === 0);
  const close = () => (first.current ? navigate("/", { replace: true }) : navigate(-1));

  const [sheet, setSheet] = useState(null);
  const sheetNow = useRef(sheet);
  sheetNow.current = sheet;
  const [replayDay, setReplayDay] = useState(null);
  const [playing, setPlaying] = useState(false);
  const span = village ? spanOf(village) : 0;
  const shownDay = replayDay ?? span;
  const state = useMemo(() => (village ? stateOn(village, shownDay) : null), [village, shownDay]);
  const going = village && village.current >= 0 ? village.projects[village.current] : null;

  // ------------------------------------------------------------ the world
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const labelsRef = useRef(null);
  const tapRef = useRef(null);
  const [gen, setGen] = useState(0);
  const [gl, setGl] = useState("wait");
  const [phase, setPhase] = useState("kit");
  const [kitError, setKitError] = useState(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return undefined;
    setPhase("kit");
    // (the callbacks run later, once w is made)
    const w = createWorld(c, {
      onLabels: (list) => labelsRef.current?.(list),
      onTap: (t) => tapRef.current?.(t),
      onState: (s) => setPhase(s.phase),
      onError: (e) => {
        console.warn("The village couldn't load", e);
        setKitError(e);
        w?.dispose();
        if (worldRef.current === w) worldRef.current = null;
      },
      // The phone took the GPU back: start afresh, on a new canvas, once the page is seen again.
      onLost: () => {
        worldRef.current = null;
        const again = () => {
          if (document.hidden) return;
          document.removeEventListener("visibilitychange", again);
          setGen((g) => g + 1);
        };
        document.addEventListener("visibilitychange", again);
        again();
      },
    });
    if (!w) {
      setGl("off");
      return undefined;
    }
    setGl("on");
    worldRef.current = w;
    if (import.meta.env.DEV) window.__village = w;
    // started afresh (the phone took the GPU back) with a sheet open: back to what the sheet is about, once it is made
    const open = sheetNow.current;
    if (open?.type === "build") w.focus(open.id);
    else if (open?.type === "soldiers") w.focus("soldiers");
    return () => {
      w.dispose();
      if (worldRef.current === w) worldRef.current = null;
      if (import.meta.env.DEV && window.__village === w) delete window.__village;
    };
  }, [gen]);
  useEffect(() => {
    if (village) worldRef.current?.setVillage(village);
  }, [village, gen, gl]);
  useEffect(() => {
    worldRef.current?.setDay(replayDay);
  }, [replayDay, gen]);
  // Choose draws the build he points at in pencil on its plot; the one already going up is there as it is.
  const pick = sheet?.type === "choose" ? sheet.pick : null;
  const pickIsGoing = Boolean(pick && going && going.kind === pick);
  const previewKind = pick && !pickIsGoing ? pick : null;
  useEffect(() => {
    worldRef.current?.preview(previewKind);
  }, [previewKind, gen, gl]);
  useEffect(() => {
    if (pickIsGoing && going) worldRef.current?.focus(going.id);
  }, [pickIsGoing, going, gen]);

  // The part of the screen the cards leave free, so the world frames what it shows there.
  const topRef = useRef(null);
  const dockRef = useRef(null);
  const sheetRef = useRef(null);
  const [wide, setWide] = useState(() => window.matchMedia?.(WIDE).matches ?? false);
  useEffect(() => {
    const m = window.matchMedia?.(WIDE);
    if (!m) return undefined;
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  useLayoutEffect(() => {
    const measure = () => {
      const w = worldRef.current;
      if (!w) return;
      const H = window.innerHeight;
      const top = topRef.current ? topRef.current.getBoundingClientRect().bottom + 6 : 0;
      const s = sheetRef.current;
      const d = dockRef.current;
      if (wide) {
        const panel = s ?? d;
        w.setInsets({ top: s ? 0 : top, bottom: 0, left: panel ? panel.getBoundingClientRect().right + 12 : 0, right: 0 });
      } else {
        const bottom = s ? s.offsetHeight + 6 : d ? H - d.getBoundingClientRect().top + 6 : 0;
        w.setInsets({ top, bottom, left: 0, right: 0 });
      }
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    for (const el of [topRef.current, dockRef.current, sheetRef.current]) if (el && ro) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [sheet, gl, wide, village, replayDay, gen, phase]);

  // ------------------------------------------------------------ sheets and links
  const openBuild = (id) => {
    haptic("tap");
    setPlaying(false);
    setSheet({ type: "build", id });
    worldRef.current?.focus(id);
  };
  const openChoose = (pick = null) => {
    haptic("tap");
    setPlaying(false);
    setReplayDay(null);
    setSheet({ type: "choose", pick });
  };
  const openSheet = (type) => {
    haptic("tap");
    setPlaying(false);
    setSheet({ type });
    // the garrison drills in the plaza; the villagers stand about every lane
    if (type === "soldiers") worldRef.current?.focus("soldiers");
    else if (type === "villagers") worldRef.current?.fitAll();
  };
  const closeSheet = () => {
    // a build or the garrison was flown to for its sheet: back out to the whole town, the lens with it
    if (sheet?.type === "build" || sheet?.type === "soldiers") worldRef.current?.fitAll();
    setSheet(null);
    if (location.search) navigate({ pathname: location.pathname, search: "" }, { replace: true, state: location.state });
  };
  tapRef.current = (t) => {
    if (sheet) return;
    if (t.kind === "build") openBuild(t.id);
    else if (t.kind === "soldiers") openSheet("soldiers");
    else if (t.kind === "plot") {
      if (!going) openChoose();
      else toast.show(`The next plot waits until ${the(going)} stands.`);
    }
  };

  // /village?build=<id>, ?choose, ?choose=<kind>, each answered once
  const linked = useRef(null);
  useEffect(() => {
    if (!village || linked.current === location.search) return;
    linked.current = location.search;
    const l = linkOf(location.search);
    if (l.build) {
      const p = village.projects.find((x) => x.id === l.build);
      if (p) {
        setSheet({ type: "build", id: p.id });
        worldRef.current?.focus(p.id);
      }
    } else if (l.choose) {
      const kind = typeof l.choose === "string" && CATALOG.some((c) => c.kind === l.choose) ? l.choose : null;
      setSheet({ type: "choose", pick: kind });
    }
  }, [village, location.search]);

  // ------------------------------------------------------------ the replay
  // Play runs the village forward a day at a time, first day to today in 4 to 30 seconds.
  const fromDay = useRef(0);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useEffect(() => {
    if (!playing || !span) return undefined;
    let d = fromDay.current;
    setReplayDay(d);
    const t = setInterval(() => {
      d += 1;
      if (d >= span) {
        clearInterval(t);
        setPlaying(false);
        setReplayDay(null);
        toastRef.current.show("That's where it stands today.");
        return;
      }
      setReplayDay(d);
    }, (playSecs(span) * 1000) / span);
    return () => clearInterval(t);
  }, [playing, span]);
  const play = () => {
    haptic("tap");
    if (playing) {
      setPlaying(false);
      return;
    }
    fromDay.current = replayDay === null || replayDay >= span ? 0 : replayDay;
    setSheet(null);
    setPlaying(true);
  };

  // ------------------------------------------------------------ choosing a build
  // A new one on the next plot, or (while one is going up) something else on
  // its plot, keeping the tasks already laid. While it saves, the catalog
  // stays as it was asked from.
  const [saving, setSaving] = useState(null);
  async function build(c) {
    const was = going;
    setSaving({ kind: c.kind, village, going: was });
    try {
      if (was) await updateVillageProject(was.id, { kind: c.kind, seed: seedFor(c.kind), need: c.need });
      else await addVillageProject(userId, { kind: c.kind, seed: seedFor(c.kind), plot: village.nextPlot, need: c.need, today });
      haptic("success");
      // the pencil build on the plot becomes the build itself: it stays there until the saved one takes it over
      worldRef.current?.keepPreview();
      const fresh = await reload();
      closeSheet();
      const laid = was ? was.done : village.waiting;
      toast.show(
        laid >= c.need
          ? `${c.name} it is, and it stands: the ${countLine(laid, "task", "tasks")} already finished built it.`
          : `${c.name} it is. Every task you finish lays its pieces here.`
      );
      const now = fresh ? villageOf(fresh, today) : null;
      const made = was ? was.id : now?.projects.find((p) => p.plot === village.nextPlot)?.id;
      if (made) worldRef.current?.focus(made);
    } catch (err) {
      toast.error(err, "Couldn't save that build. Try again.");
    } finally {
      setSaving(null);
    }
  }

  // ------------------------------------------------------------ what shows
  const flat = gl === "off" || Boolean(kitError);
  const laying = village && !flat && (gl !== "on" || phase === "kit");
  // (the plain page has Choose on the page itself; its other sheets are the same)
  const sheetOpen = Boolean(sheet) && !(flat && sheet.type === "choose");
  const describe = village ? describeVillage(village, going) : "Your village, loading";

  return (
    <div className={`vg${sheetOpen ? " vg--sheet" : ""}${flat ? " vg--flat" : ""}`}>
      {gl !== "off" && !kitError && <canvas key={gen} ref={canvasRef} className="vg-canvas" tabIndex={0} role="img" aria-label={describe} />}
      {!flat && village && (
        <Labels
          apiRef={labelsRef}
          village={village}
          state={state}
          going={going}
          span={span}
          shownDay={shownDay}
          soldiers={sheet?.type === "soldiers"}
          onBuild={openBuild}
          onPlot={() => openChoose()}
        />
      )}

      <header ref={topRef} className="vg-top">
        <div className="card vg-title">
          <div className="eyebrow">More · Village</div>
          <h1 className="vg-title__h">Your village</h1>
        </div>
        <div className="vg-top__btns">
          {!flat && (
            <button
              type="button"
              className="vg-round"
              aria-label="Show the whole village"
              onClick={() => {
                haptic("tap");
                worldRef.current?.fitAll();
              }}
            >
              <Crosshair size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="vg-round" aria-label="Close the village" onClick={close}>
            <X size={19} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </header>

      {(!village || laying) && (
        <div className="vg-msg" role="status">
          {!village && error ? (
            <div className="card vg-msg__card">
              <LoadError what="your village" error={error} onRetry={reload} stale={false} />
            </div>
          ) : !village && !loading ? null : (
            <p>Laying out the village…</p>
          )}
        </div>
      )}
      {village && error && <LoadError className="vg-stale" what="your village" error={error} onRetry={reload} stale />}

      {village && flat && (
        <Flat
          village={village}
          today={today}
          going={going}
          noGL={gl === "off"}
          saving={saving}
          choose={sheet?.type === "choose" ? sheet : null}
          onOpen={openBuild}
          onSoldiers={() => openSheet("soldiers")}
          onVillagers={() => openSheet("villagers")}
          onBuild={build}
          onRetry={() => {
            setKitError(null);
            setGen((g) => g + 1);
          }}
        />
      )}

      {village && !flat && !sheetOpen && (
        <Dock
          ref={dockRef}
          village={village}
          state={state}
          going={going}
          today={today}
          span={span}
          replayDay={replayDay}
          playing={playing}
          onOpen={openBuild}
          onChoose={openChoose}
          onSoldiers={() => openSheet("soldiers")}
          onVillagers={() => openSheet("villagers")}
          onScrub={(d) => {
            setPlaying(false);
            setReplayDay(d >= span ? null : d);
          }}
          onPlay={play}
        />
      )}

      {sheetOpen && sheet.type === "build" && (
        <BuildSheet key={sheet.id} sheetRef={sheetRef} p={village.projects.find((x) => x.id === sheet.id)} village={village} today={today} onClose={closeSheet} onChoose={() => openChoose()} />
      )}
      {sheetOpen && !flat && sheet.type === "choose" && (
        <Sheet sheetRef={sheetRef} labelId="vg-choose-h" onClose={closeSheet} className="vg-sheet--choose">
          <ChooseList
            village={saving ? saving.village : village}
            going={saving ? saving.going : going}
            pick={sheet.pick}
            saving={saving?.kind ?? null}
            onPick={(kind) => {
              haptic("tap");
              setSheet({ type: "choose", pick: kind });
            }}
            onBuild={build}
          />
        </Sheet>
      )}
      {sheetOpen && sheet.type === "soldiers" && <SoldiersSheet sheetRef={sheetRef} village={village} onClose={closeSheet} />}
      {sheetOpen && sheet.type === "villagers" && <VillagersSheet sheetRef={sheetRef} village={village} onClose={closeSheet} />}
    </div>
  );
}

// What the canvas says to a screen reader.
function describeVillage(village, going) {
  const standing = village.projects.filter((p) => p.complete).length;
  const parts = [`Your village in 3D: ${countLine(standing, "build", "builds")} standing`];
  if (going) parts.push(`${the(going)} going up, ${going.done} of ${going.need} tasks`);
  parts.push(`${countLine(soldiersFor(village.arrows.length), "soldier", "soldiers")} and ${countLine(village.villagers.length, "villager", "villagers")}`);
  return `${parts.join(", ")}. Drag to turn it, pinch or scroll to come closer, tap a build to see what laid it. Arrow keys turn it, plus and minus zoom, 0 shows it all.`;
}

// --- The labels over the builds ------------------------------------------------------------

// The world says where each build is on the screen after every frame; each
// label shows only if it fits clear of the others and of the cards: the
// build going up first, then the next plot, then the nearest. While the
// soldiers' sheet is open, none covers the garrison.
function Labels({ apiRef, village, state, going, span, shownDay, soldiers, onBuild, onPlot }) {
  const [list, setList] = useState([]);
  const host = useRef(null);
  useEffect(() => {
    apiRef.current = setList;
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);
  const byId = useMemo(() => new Map(village.projects.map((p) => [p.id, p])), [village]);
  const st = useMemo(() => new Map((state?.builds ?? []).map((b) => [b.id, b])), [state]);
  const choosing = !going && shownDay === span;
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const kids = new Map([...el.children].map((c) => [c.dataset.id, c]));
    const top = document.querySelector(".vg-top")?.getBoundingClientRect().bottom ?? 0;
    const card = document.querySelector(".vg-sheet, .vg-dock")?.getBoundingClientRect();
    const wide = window.matchMedia?.(WIDE).matches;
    const rect = {
      left: wide && card ? card.right + 4 : 4,
      top: top + 2,
      right: el.clientWidth - 4,
      bottom: !wide && card ? card.top - 2 : el.clientHeight - 4,
    };
    const sized = list
      .filter((l) => kids.has(l.id))
      .map((l) => {
        const k = kids.get(l.id);
        const prio = l.kind === "preview" || l.id === state?.going ? 0 : l.kind === "plot" ? 1 : 2 + l.d / 10000;
        return { ...l, w: k.offsetWidth, h: k.offsetHeight + 7, prio };
      });
    const blocks = soldiers ? list.filter((l) => l.kind === "soldiers").map((l) => l.rect) : [];
    const shown = placeLabels(sized, rect, 4, blocks);
    for (const [id, k] of kids) k.classList.toggle("vg-label--hidden", !shown.has(id));
  });
  return (
    <div ref={host} className="vg-labels">
      {list.map((l) => {
        if (l.kind === "soldiers") return null;
        const style = { transform: `translate3d(${Math.round(l.x)}px, ${Math.round(l.y)}px, 0) translate(-50%, -100%)` };
        if (l.kind === "plot") {
          return choosing ? (
            <button key={l.id} data-id={l.id} type="button" className="vg-label vg-label--plot vg-label--hidden" style={style} onClick={onPlot}>
              + Choose a build
            </button>
          ) : (
            <span key={l.id} data-id={l.id} className="vg-label vg-label--quiet vg-label--hidden" style={style} aria-hidden="true">
              Next plot
            </span>
          );
        }
        if (l.kind === "preview") {
          return (
            <span key={l.id} data-id={l.id} className="vg-label vg-label--pencil vg-label--hidden" style={style} aria-hidden="true">
              In pencil
            </span>
          );
        }
        const p = byId.get(l.id);
        const b = st.get(l.id);
        if (!p || !b) return null;
        const up = b.exists && !b.complete;
        return (
          <button
            key={l.id}
            data-id={l.id}
            type="button"
            className={`vg-label vg-label--hidden${up ? " vg-label--going" : ""}`}
            style={style}
            onClick={() => onBuild(p.id)}
            aria-label={up ? `${p.name}, ${b.done} of ${b.need} tasks` : p.name}
          >
            <b>{p.name}</b>
            {up && (
              <span>
                {b.done} of {b.need}
              </span>
            )}
            {b.laid > 0 && <em>+{b.laid}</em>}
          </button>
        );
      })}
    </div>
  );
}

// --- Progress, as the painted page showed it ---------------------------------------------------------

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

function Count({ done, need, laid }) {
  return (
    <div className="vl-count">
      <b>{done}</b>
      <span>of {countLine(need, "task", "tasks")}</span>
      {laid > 0 && <em>+{laid} today</em>}
    </div>
  );
}

// --- The dock: the build going up, the soldiers and villagers, the replay --------------------------

const Dock = forwardRef(function Dock({ village, state, going, today, span, replayDay, playing, onOpen, onChoose, onSoldiers, onVillagers, onScrub, onPlay }, ref) {
  const replaying = replayDay !== null && replayDay < span;
  // while the slider is held or the replay runs, its date rides above it where the chips are (the card says the same counts)
  const [scrub, setScrub] = useState(false);
  const dated = scrub || playing;
  return (
    <div ref={ref} className="vg-dock">
      {replaying ? <ReplayCard village={village} state={state} d={replayDay} span={span} onToday={() => onScrub(span)} /> : <Now village={village} going={going} today={today} onOpen={onOpen} onChoose={onChoose} />}
      <div className={`vg-chips${dated ? " vg-chips--dated" : ""}`}>
        <SoldiersChip n={state.soldiers} tier={state.tier} onClick={onSoldiers} />
        <VillagersChip n={state.villagers} onClick={onVillagers} />
        {span > 0 && (village.projects.length > 0 || village.arrows.length > 0 || village.villagers.length > 0) && (
          <Replay village={village} span={span} replayDay={replayDay} playing={playing} scrub={scrub} setScrub={setScrub} onScrub={onScrub} onPlay={onPlay} />
        )}
      </div>
    </div>
  );
});

// The garrison in a chip: how many, and their bows once there are any.
function SoldiersChip({ n, tier, onClick }) {
  const t = TIERS[tier];
  return (
    <button type="button" className="vg-chip" onClick={onClick} aria-label={n ? `${countLine(n, "soldier", "soldiers")}, ${t.name.toLowerCase()}` : "No soldiers yet"}>
      <Target size={14} strokeWidth={2.2} aria-hidden="true" />
      {n ? (
        <>
          <b>{n}</b>
          <span>{n === 1 ? "soldier" : "soldiers"}</span>
          <small>{t.short}</small>
        </>
      ) : (
        <span>No soldiers yet</span>
      )}
    </button>
  );
}

function VillagersChip({ n, onClick }) {
  return (
    <button type="button" className="vg-chip" onClick={onClick} aria-label={n ? countLine(n, "villager", "villagers") : "No villagers yet"}>
      <Users size={14} strokeWidth={2.2} aria-hidden="true" />
      {n ? (
        <>
          <b>{n}</b>
          <span>{n === 1 ? "villager" : "villagers"}</span>
        </>
      ) : (
        <span>No villagers yet</span>
      )}
    </button>
  );
}

// The build going up, the one that stood today, or the empty plot waiting for a choice.
function Now({ village, going, today, onOpen, onChoose }) {
  const last = village.projects[village.projects.length - 1];
  const stood = !going && last && last.complete && last.finishedOn === today ? last : null;
  const p = going ?? stood;
  if (p) {
    const laid = laidOn(p, today);
    return (
      <section className="card vg-now" aria-labelledby="vg-now-h">
        <div className="vg-now__row">
          <div>
            <span className="eyebrow">{going ? "Building now" : "Stands today"}</span>
            <h2 className="vg-now__name" id="vg-now-h">
              {p.name}
            </h2>
          </div>
          <Count done={p.done} need={p.need} laid={laid} />
        </div>
        <Bar done={p.done} laid={laid} need={p.need} />
        <p className="vl-left">{going ? `${countLine(p.need - p.done, "more task", "more tasks")} and it stands.` : "Every piece is laid, and its people have moved in."}</p>
        <div className="vl-actions">
          {going ? (
            <>
              <button type="button" className="btn btn--sm btn--accent" onClick={() => onOpen(p.id)}>
                What laid it
              </button>
              <button type="button" className="btn btn--sm" onClick={() => onChoose()}>
                Build something else
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--sm btn--accent" onClick={() => onChoose()}>
                Choose the next build
              </button>
              <button type="button" className="btn btn--sm" onClick={() => onOpen(p.id)}>
                What laid it
              </button>
            </>
          )}
        </div>
      </section>
    );
  }
  const waiting = village.waiting;
  return (
    <section className="card vg-now" aria-labelledby="vg-now-h">
      <span className="eyebrow">{village.projects.length ? "Nothing going up" : "Your village"}</span>
      <h2 className="vg-now__name" id="vg-now-h">
        {village.projects.length ? "Choose your next build" : "Choose your first build"}
      </h2>
      <p className="vl-left">
        {waiting
          ? `${countLine(waiting, "finished task is", "finished tasks are")} waiting to lay the first pieces.`
          : "Every task you finish, on any quest or lesson, lays its pieces on it until it stands."}
      </p>
      <div className="vl-actions">
        <button type="button" className="btn btn--sm btn--accent" onClick={() => onChoose()}>
          Choose a build
        </button>
      </div>
    </section>
  );
}

// While the replay runs or the slider is off today: the day shown, and how the village stood.
function ReplayCard({ village, state, d, span, onToday }) {
  const date = addDays(village.day0, d);
  const going = village.projects.find((p) => p.id === state.going);
  const g = going && state.builds.find((b) => b.id === going.id);
  const standing = state.builds.filter((b) => b.complete).length;
  const bits = [
    g ? `${cap(the(going))}, ${g.done} of ${countLine(g.need, "task", "tasks")}${g.laid ? ` (+${g.laid} that day)` : ""}` : standing ? `${countLine(standing, "build", "builds")} standing` : "Nothing chosen yet",
    countLine(state.soldiers, "soldier", "soldiers"),
    countLine(state.villagers, "villager", "villagers"),
  ];
  return (
    <section className="card vg-now vg-now--replay" aria-live="polite">
      <span className="eyebrow">
        The replay · day {d + 1} of {span + 1}
      </span>
      <h2 className="vg-now__name">{longDay(date, span > 300)}</h2>
      <p className="vl-left">{bits.join(" · ")}</p>
      <div className="vl-actions">
        <button type="button" className="btn btn--sm" onClick={onToday}>
          Back to today
        </button>
      </div>
    </section>
  );
}

function Replay({ village, span, replayDay, playing, scrub, setScrub, onScrub, onPlay }) {
  const d = replayDay ?? span;
  const date = addDays(village.day0, d);
  return (
    <div className="vg-replay">
      <button type="button" className="vg-replay__play" onClick={onPlay} aria-label={playing ? "Pause the replay" : "Replay the village from the first day"}>
        {playing ? <Pause size={14} strokeWidth={2.4} aria-hidden="true" /> : <Play size={14} strokeWidth={2.4} aria-hidden="true" />}
      </button>
      <span className="vg-replay__track">
        <input
          type="range"
          min={0}
          max={span}
          step={1}
          value={d}
          aria-label="The day the village is shown on"
          aria-valuetext={d >= span ? "Today" : longDay(date, span > 300)}
          onChange={(e) => onScrub(Number(e.target.value))}
          onPointerDown={() => setScrub(true)}
          onPointerUp={() => setScrub(false)}
          onPointerCancel={() => setScrub(false)}
          onBlur={() => setScrub(false)}
        />
        {(scrub || playing) && (
          <span className="vg-replay__date" style={{ left: `${(d / span) * 100}%` }} aria-hidden="true">
            {d >= span ? "Today" : longDay(date, span > 300)}
          </span>
        )}
      </span>
    </div>
  );
}

// --- Sheets ------------------------------------------------------------------------------------

// One at a time, over the village: a dialog that keeps the focus in it, and
// closes with Escape, a tap outside it, or a swipe down on its top.
function Sheet({ sheetRef, labelId, onClose, className = "", children }) {
  const el = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [dy, setDy] = useState(0);
  const drag = useRef(null);
  const backDown = useRef(false);
  const setRef = (node) => {
    el.current = node;
    if (sheetRef) sheetRef.current = node;
  };
  useEffect(() => {
    const node = el.current;
    const before = document.activeElement;
    node?.focus({ preventScroll: true });
    const focusables = () => [...node.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) {
        e.preventDefault();
        return;
      }
      const a = f[0];
      const z = f[f.length - 1];
      // a button that went away (Not now, say) left the focus on the page: back into the sheet
      if (!node.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? z : a).focus();
      } else if (e.shiftKey && (document.activeElement === a || document.activeElement === node)) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (before && before.isConnected) before.focus?.({ preventScroll: true });
    };
  }, []);
  const down = (e) => {
    // the close button is in the same row, and keeps its own click
    if (e.target.closest("button")) return;
    drag.current = { y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (drag.current) setDy(Math.max(0, e.clientY - drag.current.y));
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    if (dy > 70) closeRef.current();
    else setDy(0);
  };
  return (
    <div className="vg-sheet-wrap">
      <div
        className="vg-sheet-back"
        // a tap that starts here: the click a phone sends after the tap that opened the sheet must not close it
        onPointerDown={() => {
          backDown.current = true;
        }}
        onClick={() => {
          if (backDown.current) closeRef.current();
          backDown.current = false;
        }}
        aria-hidden="true"
      />
      <section
        ref={setRef}
        className={`vg-sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        style={dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined}
      >
        {/* its own row, above what scrolls: the handle to swipe it down by, and the close button */}
        <div className="vg-sheet__head" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span className="vg-sheet__grab" aria-hidden="true" />
          <button type="button" className="btn-icon vg-sheet__close" onClick={() => closeRef.current()} aria-label="Close">
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        <div className="vg-sheet__body">{children}</div>
      </section>
    </div>
  );
}

// --- One build, and what laid it -----------------------------------------------------------------

function BuildSheet({ sheetRef, p, village, today, onClose, onChoose }) {
  if (!p) return null;
  const c = buildOf(p.kind);
  const laid = laidOn(p, today);
  const going = village.current >= 0 && village.projects[village.current].id === p.id;
  const last = village.projects[village.projects.length - 1];
  const next = p.complete && village.current < 0 && last?.id === p.id;
  const first = p.items[0]?.laid;
  return (
    <Sheet sheetRef={sheetRef} labelId="vg-build-h" onClose={onClose}>
      <span className="eyebrow">
        {p.complete ? (p.finishedOn === today ? "Stands today" : `Standing since ${day(p.finishedOn)}`) : going ? "Building now" : "Waiting its turn"} · Plot {p.plot + 1}
      </span>
      <h2 className="vg-sheet__title" id="vg-build-h">
        {p.name}
      </h2>
      <p className="vl-line">{c.line}</p>
      <Count done={p.done} need={p.need} laid={laid} />
      <Bar done={p.done} laid={laid} need={p.need} />
      {p.complete ? (
        <p className="vl-left">
          Built from {countLine(p.need, "finished task", "finished tasks")}
          {first && first !== p.finishedOn ? `, ${day(first)} to ${day(p.finishedOn)}.` : "."}
        </p>
      ) : (
        <p className="vl-left">{countLine(p.need - p.done, "more task", "more tasks")} and it stands. Every task you finish, on any quest or lesson, lays its next pieces here.</p>
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
      <Laid p={p} today={today} />
    </Sheet>
  );
}

// The tasks and camp steps that laid a build, newest first.
function Laid({ p, today }) {
  const [all, setAll] = useState(false);
  const items = [...p.items].reverse();
  const shown = all ? items : items.slice(0, ITEMS_SHOWN);
  return (
    <section className="vg-laid" aria-labelledby={`vg-laid-${p.id}`}>
      <h3 className="vg-sub" id={`vg-laid-${p.id}`}>
        What laid it
      </h3>
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
              Show earlier · {countLine(items.length - shown.length, "task", "tasks")}
            </button>
          )}
        </>
      ) : (
        <p className="card-note">Nothing yet. Tick off a task on any quest and its pieces land here.</p>
      )}
    </section>
  );
}

// --- Choose a build ----------------------------------------------------------------------------------

// The catalog by size, each with its finished picture. In the 3D village the
// one he taps is drawn in pencil on the plot it would take; `inline` is the
// plain page without WebGL.
function ChooseList({ village, going, pick, saving, onPick, onBuild, inline = false }) {
  const change = Boolean(going);
  const laid = change ? going.done : village.waiting;
  const have = new Set(village.projects.filter((p) => p.complete).map((p) => p.kind));
  // Build something else asks first, in place: it replaces what's going up.
  const [asking, setAsking] = useState(null);
  useEffect(() => {
    if (pick) document.getElementById(`vg-opt-${pick}`)?.scrollIntoView({ block: "nearest" });
  }, [pick]);
  useEffect(() => {
    if (asking) document.querySelector(`#vg-opt-${asking} .vl-ask`)?.scrollIntoView({ block: "nearest" });
  }, [asking]);
  return (
    <>
      <header className="vg-choose__head">
        <span className="eyebrow">{change ? "Build something else" : "Choose a build"}</span>
        <h2 className="vg-sheet__title" id="vg-choose-h">
          {change ? "What will you build instead?" : village.projects.length ? "What will you build next?" : "What will you build first?"}
        </h2>
        <p className="vg-sheet__sub">
          {change
            ? laid
              ? `The ${countLine(laid, "task", "tasks")} already laid on ${the(going)} carry over to the new build.`
              : `Nothing is laid on ${the(going)} yet, so nothing is lost.`
            : laid
              ? `${countLine(laid, "finished task is", "finished tasks are")} waiting, and they lay the first pieces the moment you choose.`
              : "Every task you finish, on any quest or lesson, lays its pieces on it until it stands. Then you choose the next."}
          {!inline && " Tap one to see it in pencil on its plot."}
        </p>
      </header>
      {SIZES.map((s) => (
        <section key={s.key} className="vg-size" aria-labelledby={`vg-size-${s.key}`}>
          <div className="vg-size__head">
            <h3 className="eyebrow" id={`vg-size-${s.key}`}>
              {s.label}
            </h3>
            <span>{s.line}</span>
          </div>
          <ul className="vg-opts">
            {CATALOG.filter((c) => c.size === s.key).map((c) => {
              const now = change && c.kind === going.kind;
              const atOnce = !now && laid >= c.need;
              const tags = [now ? "Building now" : null, atOnce ? "Stands at once" : null, !now && have.has(c.kind) ? "You have one" : null].filter(Boolean);
              const picked = pick === c.kind;
              const busy = saving === c.kind;
              return (
                <li key={c.kind} id={`vg-opt-${c.kind}`} className={`vg-opt${picked ? " vg-opt--picked" : ""}`}>
                  <button type="button" className="vg-opt__main" onClick={() => onPick(c.kind)} aria-pressed={picked} disabled={Boolean(saving)}>
                    <img src={thumbOf(c.kind)} alt="" loading="lazy" decoding="async" className="vg-opt__pic" />
                    <span className="vg-opt__body">
                      <span className="vg-opt__head">
                        <b className="vg-opt__name">{c.name}</b>
                        <span className="vl-need">{countLine(c.need, "task", "tasks")}</span>
                      </span>
                      {tags.length > 0 && (
                        <span className="vl-tags">
                          {tags.map((t) => (
                            <span key={t} className="vl-tag">
                              {t}
                            </span>
                          ))}
                        </span>
                      )}
                      <span className="vg-opt__line">{c.line}</span>
                    </span>
                  </button>
                  {picked && now && (
                    <div className="vg-opt__foot">
                      <p className="vg-opt__note">
                        Already going up{inline ? "" : " on its plot"}: {going.done} of {countLine(going.need, "task", "tasks")} laid.
                      </p>
                    </div>
                  )}
                  {picked && !now && (
                    <div className="vg-opt__foot">
                      {change && asking === c.kind ? (
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
                        <button type="button" className="btn btn--sm btn--accent" disabled={Boolean(saving)} onClick={() => (change ? setAsking(c.kind) : onBuild(c))}>
                          {busy ? "Saving…" : change ? "Build this instead" : `Build ${the(c)}`}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

// --- The soldiers and the villagers --------------------------------------------------------------------

function SoldiersSheet({ sheetRef, village, onClose }) {
  const arrows = village.arrows.length;
  const n = soldiersFor(arrows);
  const hits = village.bullseyes.length;
  const tier = TIERS[bowFor(hits)];
  const left = ARROWS_PER_SOLDIER - (arrows % ARROWS_PER_SOLDIER);
  return (
    <Sheet sheetRef={sheetRef} labelId="vg-sol-h" onClose={onClose}>
      <span className="eyebrow">The garrison · the plaza</span>
      <h2 className="vg-sheet__title" id="vg-sol-h">
        {n ? countLine(n, "soldier", "soldiers") : "No soldiers yet"}
      </h2>
      <p className="vl-tags">
        <span className="vl-tag">{countLine(arrows, "arrow", "arrows")} loosed</span>
        {n > 0 && <span className="vl-tag">{tier.short}</span>}
      </p>
      <p className="vg-sheet__text">
        Every {ARROWS_PER_SOLDIER} arrows trains one: each arrow you loose on The Mark counts. {countLine(left, "more arrow trains", "more arrows train")} {n ? "the next one" : "the first"}.
      </p>
      {n > MAX_SOLDIERS && <p className="vg-sheet__note">{MAX_SOLDIERS} drill in the plaza at a time.</p>}
      {n > 0 && <h3 className="vg-sub">Their bows: {tier.name.toLowerCase()}</h3>}
      {n > 0 && <p className="vg-sheet__text">{bowLine(hits)}</p>}
      {n > 0 && tier.verse && (
        <blockquote className="vg-verse">
          {tier.verse.text}
          <cite>{tier.verse.cite}</cite>
        </blockquote>
      )}
      <div className="vl-actions">
        <Link to="/ascent" className="btn btn--sm btn--accent">
          Open The Range
        </Link>
      </div>
    </Sheet>
  );
}

const FOLK_SHOWN = 60;

function VillagersSheet({ sheetRef, village, onClose }) {
  const [all, setAll] = useState(false);
  const folk = useMemo(() => [...village.villagers].sort((a, b) => String(b.first ?? "").localeCompare(String(a.first ?? "")) || String(a.name).localeCompare(String(b.name))), [village]);
  const shown = all ? folk : folk.slice(0, FOLK_SHOWN);
  return (
    <Sheet sheetRef={sheetRef} labelId="vg-folk-h" onClose={onClose}>
      <span className="eyebrow">From your temple work</span>
      <h2 className="vg-sheet__title" id="vg-folk-h">
        {countLine(folk.length, "villager", "villagers")}
      </h2>
      <p className="vg-sheet__text">Everyone you have done temple work for lives here. Each moved in on the day of their first ordinance.</p>
      {folk.length > MAX_VILLAGERS && <p className="vg-sheet__note">{MAX_VILLAGERS} stand about the lanes at a time.</p>}
      {folk.length ? (
        <ul className="vg-folk">
          {shown.map((v) => (
            <li key={v.pid}>
              <b>{v.name}</b>
              <small>{[v.lifespan, v.temple, v.first ? `came ${monthYear(v.first)}` : null].filter(Boolean).join(" · ")}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card-note">Nobody yet. The people you do temple work for move in here.</p>
      )}
      {folk.length > shown.length && (
        <button type="button" className="btn-link vl-more" onClick={() => setAll(true)}>
          Show all {folk.length}
        </button>
      )}
      <div className="vl-actions">
        <Link to="/temple" className="btn btn--sm btn--accent">
          Open the Temple
        </Link>
      </div>
    </Sheet>
  );
}

// --- Without WebGL: the same village as a plain page --------------------------------------------------

function Flat({ village, today, going, noGL, saving, choose, onOpen, onSoldiers, onVillagers, onBuild, onRetry }) {
  const [pick, setPick] = useState(null);
  // Choose (a ?choose link, or Build something else) is the list on this page: there, pointed at the build asked for
  const chooseRef = useRef(null);
  useEffect(() => {
    if (!choose) return;
    setPick(choose.pick ?? null);
    chooseRef.current?.scrollIntoView({ block: "start" });
  }, [choose]);
  const standing = village.projects.filter((p) => p.complete).sort((a, b) => String(b.finishedOn).localeCompare(String(a.finishedOn)));
  const p = going;
  const laid = p ? laidOn(p, today) : 0;
  return (
    <div className="vg-flat">
      <div className="vg-flat__in">
        <p className="vg-flat__note">
          {noGL ? "This screen can't draw the village in 3D, so here it is in pictures." : "The 3D village couldn't load, so here it is in pictures."}
          {!noGL && (
            <button type="button" className="btn-link btn-link--accent" onClick={onRetry}>
              Try again
            </button>
          )}
        </p>
        {p ? (
          <section className="card card--flush vg-flat__now" aria-labelledby="vg-flat-now">
            <img src={thumbOf(p.kind)} alt={`${cap(the(p))}, as it will stand.`} className="vg-flat__pic" />
            <div className="vg-flat__text">
              <span className="eyebrow">Building now</span>
              <h2 className="vg-now__name" id="vg-flat-now">
                {p.name}
              </h2>
              <p className="vl-line">{buildOf(p.kind).line}</p>
              <Count done={p.done} need={p.need} laid={laid} />
              <Bar done={p.done} laid={laid} need={p.need} />
              <p className="vl-left">{countLine(p.need - p.done, "more task", "more tasks")} and it stands.</p>
              <Laid p={p} today={today} />
            </div>
          </section>
        ) : (
          <section className="card vg-now" aria-labelledby="vg-flat-empty">
            <span className="eyebrow">{village.projects.length ? "Nothing going up" : "Your village"}</span>
            <h2 className="vg-now__name" id="vg-flat-empty">
              {village.projects.length ? "Choose your next build" : "Choose your first build"}
            </h2>
            <p className="vl-left">{village.waiting ? `${countLine(village.waiting, "finished task is", "finished tasks are")} waiting to lay the first pieces.` : "Choose one below."}</p>
          </section>
        )}
        <div className="vg-chips">
          <SoldiersChip n={soldiersFor(village.arrows.length)} tier={bowFor(village.bullseyes.length)} onClick={onSoldiers} />
          <VillagersChip n={village.villagers.length} onClick={onVillagers} />
        </div>
        <section className="vg-flat__sec" aria-labelledby="vg-flat-standing">
          <h2 className="eyebrow" id="vg-flat-standing">
            Standing
          </h2>
          {standing.length ? (
            <ul className="vg-stood">
              {standing.map((s) => (
                <li key={s.id} className="card card--flush">
                  <button type="button" className="vg-stood__btn" onClick={() => onOpen(s.id)}>
                    <img src={thumbOf(s.kind)} alt="" loading="lazy" className="vg-stood__pic" />
                    <span>
                      <b>{s.name}</b>
                      <small>
                        {s.finishedOn === today ? "Stood today" : `Stood ${day(s.finishedOn)}`} · {countLine(s.need, "task", "tasks")}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="card-note">{going ? `Nothing stands yet. ${cap(the(going))} will be the first.` : "Nothing stands yet."}</p>
          )}
        </section>
        <section ref={chooseRef} className="card vg-flat__choose">
          <ChooseList village={village} going={going} pick={pick} saving={saving?.kind ?? null} onPick={setPick} onBuild={onBuild} inline />
        </section>
      </div>
    </div>
  );
}
