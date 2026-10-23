import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { addVillageProject, fetchVillage, updateVillageProject } from "../lib/api";
import { villageOf } from "../lib/village";
import { todayStr } from "../lib/planDates";
import { useLoad } from "../lib/useLoad";
import LoadError from "../components/ui/LoadError";
import { mountVillage } from "../village/engine";

// The village: he chooses what to build from a catalog, and every task or
// camp step he finishes, on any quest or lesson, lays its bricks on it until
// it stands; then he chooses the next. Arrows loosed on The Mark train the
// soldiers in the plaza and his bullseyes upgrade their bows, and everyone
// he has done temple work for lives in its lanes.
//
// It fills the whole screen like a map spread out on a desk, with its own
// close button; the drawing is src/village/engine.js and the data is shaped
// in src/lib/village.js. Choosing a build (or Build something else) saves
// it and draws the village again with that build open. /village?choose
// opens Choose a build straight away, and /village?build=<id> opens that
// build (the quests page links to both).
const PAPER = { position: "fixed", inset: 0, zIndex: 90, background: "#f2f1ee" };
const OVER = { position: "fixed", left: 16, right: 16, top: "calc(env(safe-area-inset-top, 0px) + 24px)", zIndex: 91, display: "grid", justifyItems: "center", gap: 12 };

export default function Village() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const location = useLocation();
  const today = useMemo(() => todayStr(), []);
  const { data: raw, error, loading, reload } = useLoad(() => (userId ? fetchVillage(userId) : null), [userId]);
  const host = useRef(null);
  // The build just chosen, so the redrawn village opens on it.
  const focus = useRef(null);
  const search = new URLSearchParams(location.search);
  const choose = useRef(search.has("choose"));
  const open = useRef(search.get("build"));
  const nav = useRef({ navigate, first: location.key === "default" });
  nav.current.navigate = navigate;

  useEffect(() => {
    if (!raw || !host.current) return undefined;
    const data = villageOf(raw, today);
    data.focus = focus.current;
    data.choose = !focus.current && choose.current;
    data.open = open.current;
    focus.current = null;
    choose.current = false;
    open.current = null;
    const v = mountVillage(host.current, data, {
      build: async (b) => {
        const p = await addVillageProject(userId, { ...b, today });
        focus.current = p.id;
        reload();
      },
      change: async (id, fields) => {
        await updateVillageProject(id, fields);
        focus.current = id;
        reload();
      },
      open: (path) => nav.current.navigate(path),
      // Back where you came from, or to your quests when the village was the first page opened.
      close: () => (nav.current.first ? nav.current.navigate("/quests") : nav.current.navigate(-1)),
    });
    return () => v.destroy();
  }, [raw, today, userId, reload]);

  return (
    <>
      <div ref={host} style={PAPER} />
      {(error || (loading && !raw)) && (
        <div style={OVER}>
          {error ? (
            <LoadError what="your village" error={error} onRetry={reload} stale={Boolean(raw)} />
          ) : (
            <p className="empty">Loading the village…</p>
          )}
          {!raw && (
            <button type="button" className="btn btn--sm" onClick={() => navigate("/quests")}>
              Back to your quests
            </button>
          )}
        </div>
      )}
    </>
  );
}
