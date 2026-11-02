import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Plus } from "lucide-react";
import { fetchQuestPills } from "../lib/api";
import { ladderOf, pathOf } from "../lib/ladder";
import { focusWeekOf, weekShots, arrowsLabel, checkinOn, checkinLevel } from "../lib/focus";
import { LEVELS } from "../lib/mark";
import { useLoad } from "../lib/useLoad";
import LoadError from "../components/ui/LoadError";
import TargetFace from "../components/mark/TargetFace";
import { useLadder, FRESH_PATCH_KEY } from "../components/targets/useLadder";
import { useScrollTop } from "../components/targets/useScrollTop";
import { MissionCard, FaceRow, ClimbRows, NO_MARKS, keepDashes, markWords } from "../components/targets/OverviewTiers";
import { BowCard } from "../components/targets/OverviewBow";
import { BehindYou } from "../components/targets/OverviewPatches";
import "../styles/ascent.css";
import "../styles/mark.css";
import "../styles/targets.css";

// Targets: the whole ladder on one page, biggest to smallest (Aaron,
// 2026-11-02: "all the targets up top from biggest to smallest: life
// mission, then lifetime goals, then Quests and lessons, then weekly
// focuses").
//
// The four tiers are kept small so they come close to fitting a phone's
// first screen: the mission's words, a small target for each lifetime goal
// (the top goals of the goal wheel, last 30 days of arrows), a row for each
// quest he's on and lesson he's learning (with its camps and what's on
// today's list there), and the week's focus as Today draws it. Every one of
// them is a tap from its own page (/targets/<its id>): the target, notes
// and reflections, linked quotes, and for a quest or lesson its camps,
// today's list and the clipboard.
//
// Under the ladder, the bow his bullseyes have earned, and what's behind
// him: patches for the mountains finished, lessons learned, and what was
// set aside, each still a tap from its page. Plans (bring in a plan for a
// quest's camps) is in the corner.

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
      <header className="ov-top">
        <div>
          <div className="eyebrow">My goals</div>
          <h1 className="page-title">Targets</h1>
        </div>
        <Link to="/targets/plans" className="btn btn--sm btn--on-page">
          <BookOpen size={14} />
          Plans
        </Link>
      </header>

      {error && <LoadError what="your targets" error={error} onRetry={reload} stale={Boolean(view)} />}
      {!view && !error && loading && <p className="empty">Loading…</p>}

      {tiers && (
        <div className="ov-body">
          <div className="ov-ladder">
            <MissionCard mission={tiers.mission} onWrite={() => open({ kind: "mission" })} />

            <section className="ov-tier" aria-labelledby="ov-goals-h">
              <div className="ov-tier__head">
                <h2 className="eyebrow" id="ov-goals-h">
                  Lifetime goals
                </h2>
                {tiers.goals.length > 0 && <span className="ov-note">Last 30 days</span>}
              </div>
              {tiers.goals.length > 0 ? (
                <FaceRow
                  label="Lifetime goals"
                  items={tiers.goals.map((g) => ({
                    key: g.key,
                    to: pathOf("goal", g.key),
                    title: g.title,
                    label: `${g.title}: ${markWords(g.target, today)}`,
                    name: g.target?.short ?? g.short,
                    gear: g.gear,
                    face: <TargetFace target={g.target ?? NO_MARKS} today={today} range="30" mini arrow />,
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

            <section className="ov-tier" aria-labelledby="ov-climbs-h">
              <div className="ov-tier__head">
                <h2 className="eyebrow" id="ov-climbs-h">
                  Quests and lessons
                </h2>
              </div>
              {climbs.length > 0 ? <ClimbRows climbs={climbs} today={today} /> : <p className="empty">The quests you're on and the lessons you're learning show here.</p>}
              <div className="ov-adds">
                <button type="button" className="btn btn--sm btn--on-page" onClick={newQuest}>
                  <Plus size={14} />
                  New quest
                </button>
                <button type="button" className="btn btn--sm btn--on-page" onClick={newLesson}>
                  <Plus size={14} />
                  New lesson
                </button>
              </div>
            </section>

            <FocusTier fw={focusWeek} today={today} />
          </div>

          <aside className="ov-side" aria-label="Your bow, and what's behind you">
            <BowCard bullseyes={range?.bullseyes ?? 0} />
            <BehindYou view={view} fresh={fresh} />
          </aside>
        </div>
      )}

      {overlay}
    </div>
  );
}

// --- This week's focus ------------------------------------------------------------

// The same small targets Today's strip draws, each a tap from its page here
// (Today's opens its sheet instead). Nothing while the week first loads.
function FocusTier({ fw, today }) {
  const weekStart = focusWeekOf(today);
  const { data, week, error, reload } = fw;
  if (!data && !error) return null;

  let body;
  if (!data) body = <LoadError what="this week's focus" error={error} onRetry={reload} />;
  else if (!week.length) {
    body = (
      <div className="ov-none">
        <span>No focus set for this week.</span>
        <Link to="/plan" className="btn-link btn-link--accent">
          Set them on Week
          <ArrowRight size={13} />
        </Link>
      </div>
    );
  } else {
    const shots = weekShots(data.goals, data.checkins, weekStart);
    body = (
      <FaceRow
        week
        label="This week's focus"
        items={week.map((g) => {
          const on = checkinOn(data.checkins, g.id, today);
          const todayWords = on ? LEVELS[checkinLevel(on)].name.toLowerCase() : "no arrow yet";
          return {
            key: g.id,
            to: pathOf("focus", g.id),
            title: g.title,
            label: `${g.title}. Today: ${todayWords}. ${arrowsLabel(g)}.`,
            name: keepDashes(g.title),
            answered: Boolean(on),
            face: <TargetFace target={{ shots: shots[g.id] ?? [], reasons: [] }} today={today} range="7" mini />,
          };
        })}
      />
    );
  }

  return (
    <section className="ov-tier" aria-labelledby="ov-focus-h">
      <div className="ov-tier__head">
        <h2 className="eyebrow" id="ov-focus-h">
          This week's focus
        </h2>
      </div>
      {body}
      {data && error && <LoadError what="this week's focus" error={error} onRetry={reload} stale />}
    </section>
  );
}
