import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, Plus } from "lucide-react";
import { fetchQuestPills } from "../lib/api";
import { ladderOf, pathOf } from "../lib/ladder";
import { focusWeekOf, checkinOn, dayState } from "../lib/focus";
import { arrowsOn, arrowWords, faceOf } from "../lib/arrows";
import { addDays, parseDateStr } from "../lib/planDates";
import { useLoad } from "../lib/useLoad";
import LoadError from "../components/ui/LoadError";
import TargetFace from "../components/mark/TargetFace";
import { useLadder, FRESH_PATCH_KEY } from "../components/targets/useLadder";
import { useScrollTop } from "../components/targets/useScrollTop";
import { MissionCard, FaceRow, ClimbRows, FocusRows, WeekLetters, keepDashes } from "../components/targets/OverviewTiers";
import { BowCard } from "../components/targets/OverviewBow";
import { BehindYou } from "../components/targets/OverviewPatches";
import FocusWeek from "../components/focus/FocusWeek";
import FocusSettings from "../components/focus/FocusSettings";
import TargetPopup, { placeTarget } from "../components/targets/TargetPopup";
import { useArrows } from "../components/targets/useArrows";
import { whoseWeek } from "../components/schedule/FocusLine";
import "../styles/ascent.css";
import "../styles/mark.css";
import "../styles/targets.css";

// Targets: the whole ladder on one page, biggest to smallest (Aaron,
// 2026-11-02: "all the targets up top from biggest to smallest: life
// mission, then lifetime goals, then Quests and lessons, then weekly
// focuses").
//
// Each tier is a card (Clean slate, 2026-11-23): the mission in black, a
// small target for each lifetime goal (the top goals of the goal wheel,
// last 30 days of arrows), a row for each quest he's on and lesson he's
// learning (with its camps and what's on today's list there), and the
// week's focus by name with the week's arrows as seven squares.
//
// A tap on any of them opens its pop-up (Aaron, 2026-11-28): place an arrow,
// add a note (which places one), or edit the target. Every arrow is a good
// one, placed by him whenever he does something toward it. The pop-up's
// address is /targets?t=<its id>, so every older link to a target's page
// opens it here.
//
// Under the ladder, the bow his bullseyes have earned, and what's behind
// him: patches for the mountains finished, lessons learned, and what was
// set aside, each still a tap from its page. Plans (bring in a plan for a
// quest's camps) sits with New quest and New lesson.

export default function Targets() {
  const navigate = useNavigate();
  // A new lesson's page opens once all of it is saved: its camps go on its
  // mountain after the lesson itself, and the page should open with them.
  const afterSave = useRef(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const ladder = useLadder({
    onSaved: () => {
      const to = afterSave.current;
      afterSave.current = null;
      if (to && alive.current) navigate(to);
    },
  });
  const { userId, today, view, range, error, loading, reload, focusWeek, open, overlay } = ladder;
  useScrollTop("targets");
  const arrows = useArrows(userId, today);

  // The target whose pop-up is open (?t=<its id>), and a week's focus's
  // settings opened from it.
  const [params, setParams] = useSearchParams();
  const ref = params.get("t");
  const target = useMemo(() => placeTarget(ref, ladder), [ref, ladder]);
  const [focusEdit, setFocusEdit] = useState(null);
  const openTarget = (key) => {
    const next = new URLSearchParams(params);
    next.set("t", key);
    setParams(next);
  };
  const closeTarget = () => {
    const next = new URLSearchParams(params);
    next.delete("t");
    setParams(next, { replace: true });
  };
  const on = (kind, key) => arrowsOn(arrows.list, kind, key);

  // A patch just earned on its quest's page: "Behind you" opens on it and
  // it springs in, this once.
  const [fresh] = useState(() => {
    try {
      return sessionStorage.getItem(FRESH_PATCH_KEY);
    } catch {
      return null;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.removeItem(FRESH_PATCH_KEY);
    } catch {
      // no storage, nothing waiting
    }
  }, []);

  // How many camps each quest and lesson has and what's on today's list
  // there. A tick or a line written elsewhere shows here too.
  const pills = useLoad(() => (userId ? fetchQuestPills(userId, today) : null), [userId, today]);
  const reloadPills = pills.reload;
  useEffect(() => {
    window.addEventListener("hub:changed", reloadPills);
    return () => window.removeEventListener("hub:changed", reloadPills);
  }, [reloadPills]);

  const tiers = useMemo(() => (view ? ladderOf({ view, range, pills: pills.data ?? [] }) : null), [view, range, pills.data]);

  // The camps are in the ladder's own read, so they show at once; what's on
  // today's list comes with the pills.
  const climbs = useMemo(() => {
    if (!tiers) return [];
    return tiers.climbs.map((c) => {
      const mountain = c.kind === "quest" ? view.quests.find((q) => q.id === c.key) : view.lessons.find((l) => l.id === c.key)?.mountain;
      return { ...c, camps: mountain?.state?.camps?.length ?? c.camps };
    });
  }, [tiers, view]);

  function newQuest() {
    afterSave.current = null;
    open({ kind: "quest", quest: null, onAdded: (id) => navigate(pathOf("quest", id)) });
  }

  function newLesson() {
    afterSave.current = null;
    open({
      kind: "lesson",
      lesson: null,
      onAdded: (id) => {
        afterSave.current = pathOf("lesson", id);
      },
    });
  }

  return (
    <div className="page ascent mark ov">
      <header className="hub-head ov-top">
        <h1 className="page-title">Targets</h1>
      </header>

      {error && <LoadError what="your targets" error={error} onRetry={reload} stale={Boolean(view)} />}
      {!view && !error && loading && <p className="empty">Loading…</p>}

      {tiers && (
        <div className="ov-body">
          <div className="ov-ladder">
            <MissionCard mission={tiers.mission} onWrite={() => open({ kind: "mission" })} onOpen={() => openTarget("mission")} />

            <section className="card ov-tier ov-card" aria-labelledby="ov-goals-h">
              <div className="ov-tier__head">
                <h2 className="ov-h" id="ov-goals-h">
                  Lifetime goals
                </h2>
                {tiers.goals.length > 0 && <span className="ov-note">Last 30 days</span>}
              </div>
              {tiers.goals.length > 0 ? (
                <FaceRow
                  label="Lifetime goals"
                  items={tiers.goals.map((g) => ({
                    key: g.key,
                    onOpen: () => openTarget(g.key),
                    title: g.title,
                    label: `${g.title}: ${arrowWords(on("goal", g.key), today)}`,
                    name: g.target?.short ?? g.short,
                    gear: g.gear,
                    face: <TargetFace target={faceOf(on("goal", g.key))} today={today} range="30" mini arrow />,
                  }))}
                />
              ) : (
                <div className="ov-none">
                  <span>Your lifetime goals are the top goals of your goal wheel. There aren't any yet.</span>
                  <Link to="/tree" className="btn-link btn-link--accent">
                    Open the goal wheel
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </section>

            <section className="card ov-tier ov-card ov-card--rows" aria-labelledby="ov-climbs-h">
              <div className="ov-tier__head">
                <h2 className="ov-h" id="ov-climbs-h">
                  Quests and lessons
                </h2>
              </div>
              {climbs.length > 0 ? <ClimbRows climbs={climbs} today={today} arrowsOf={(c) => on(c.kind, c.key)} onOpen={(c) => openTarget(c.key)} /> : <p className="ov-none">The quests you're on and the lessons you're learning show here.</p>}
              <div className="ov-adds">
                <button type="button" className="btn btn--sm" onClick={newQuest} aria-label="New quest">
                  <Plus size={15} />
                  Quest
                </button>
                <button type="button" className="btn btn--sm" onClick={newLesson} aria-label="New lesson">
                  <Plus size={15} />
                  Lesson
                </button>
                <Link to="/targets/plans" className="btn btn--sm">
                  <BookOpen size={15} />
                  Plans
                </Link>
              </div>
            </section>

            <FocusTier fw={focusWeek} today={today} arrows={arrows.list} onOpen={openTarget} />
          </div>

          <aside className="ov-side" aria-label="Your bow, and what's behind you">
            <BowCard bullseyes={range?.bullseyes ?? 0} />
            <BehindYou view={view} fresh={fresh} />
          </aside>
        </div>
      )}

      {target && <TargetPopup target={target} ladder={ladder} arrows={arrows} onClose={closeTarget} onFocusEdit={setFocusEdit} />}
      {focusEdit && (
        <FocusSettings
          userId={userId}
          goal={(focusWeek.week ?? []).find((g) => g.id === focusEdit.id) ?? focusEdit}
          date={today}
          fw={focusWeek}
          ascent={{ data: ladder.data, view, focuses: ladder.focuses, focusesById: ladder.focusesById, error, loading, reload }}
          onClose={() => setFocusEdit(null)}
        />
      )}
      {overlay}
    </div>
  );
}

// --- This week's focus ------------------------------------------------------------

// Each focus by its whole name with the week's arrows as seven squares,
// each a tap from its page here (Today's chip opens its sheet instead).
// Nothing while the week first loads.
//
// Setting them happens here too: "Edit" (or the Week tab's Edit, which comes
// here as ?focus=edit&week=<its Sunday>) opens the week's focus in place,
// with Sunday's review of last week, to add, change, keep or let go. From
// the Week tab that's the week it was showing, so next week's focus can be
// set ahead of time.

function FocusTier({ fw, today, arrows, onOpen }) {
  const weekStart = focusWeekOf(today);
  const { data, week, error, reload } = fw;
  const [params, setParams] = useSearchParams();
  const editing = params.get("focus") === "edit";
  const weekParam = params.get("week");
  const editWeek = editing && /^\d{4}-\d{2}-\d{2}$/.test(weekParam ?? "") ? focusWeekOf(weekParam) : weekStart;
  const tierRef = useRef(null);
  useEffect(() => {
    if (editing) tierRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [editing]);
  const setEditing = (on) => {
    const next = new URLSearchParams(params);
    if (on) next.set("focus", "edit");
    else {
      next.delete("focus");
      next.delete("week");
    }
    setParams(next, { replace: true });
  };
  if (!data && !error && !editing) return null;

  let body;
  if (editing) body = <FocusWeek anchorDate={editWeek === weekStart ? today : editWeek} />;
  else if (!data) body = <LoadError what="this week's focus" error={error} onRetry={reload} />;
  else if (!week.length) {
    body = (
      <div className="ov-none">
        <span>No focus set for this week.</span>
        <button type="button" className="btn-link btn-link--accent" onClick={() => setEditing(true)}>
          Set them
          <ArrowRight size={13} />
        </button>
      </div>
    );
  } else {
    body = (
      <FocusRows
        label="This week's focus"
        items={week.map((g) => {
          // A day he placed an arrow on it is a good day (black), whatever
          // the evening said.
          const placed = new Set(arrowsOn(arrows, "focus", g.id).map((a) => a.date));
          return {
            key: g.id,
            onOpen: () => onOpen(g.id),
            title: keepDashes(g.title),
            label: `${g.title}. ${arrowWords(arrowsOn(arrows, "focus", g.id), today, 7)}.`,
            days: Array.from({ length: 7 }, (_, i) => {
              const d = addDays(weekStart, i);
              return placed.has(d) ? "bull" : dayState(checkinOn(data.checkins, g.id, d), d, today);
            }),
          };
        })}
      />
    );
  }
  const showWeek = !editing && data && week?.length > 0;

  return (
    <section className={editing ? "ov-tier ov-tier--editing" : "card ov-tier ov-card" + (showWeek ? " ov-card--rows" : "")} aria-labelledby="ov-focus-h" ref={tierRef} style={{ scrollMarginTop: 80 }}>
      <div className="ov-tier__head">
        <h2 className="ov-h" id="ov-focus-h">
          {whoseWeek(editWeek, today)} focus
        </h2>
        {(editing || week?.length > 0) && (
          <button type="button" className={editing ? "btn btn--sm btn--accent ov-done" : "btn-link ov-edit"} onClick={() => setEditing(!editing)}>
            {editing ? "Done" : "Edit"}
          </button>
        )}
        {showWeek && <WeekLetters todayIndex={parseDateStr(today).getDay()} />}
      </div>
      {body}
      {!editing && data && error && <LoadError what="this week's focus" error={error} onRetry={reload} stale />}
    </section>
  );
}
