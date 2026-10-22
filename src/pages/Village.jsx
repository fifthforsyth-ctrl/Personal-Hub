import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchVillage, addVillageBuild, updateStep } from "../lib/api";
import { villageOf } from "../lib/village";
import { todayStr, toDateStr } from "../lib/planDates";
import { useLoad } from "../lib/useLoad";
import LoadError from "../components/ui/LoadError";
import { mountVillage } from "../village/engine";

// The village: every quest builds something on its own plot around the
// plaza, each camp builds one of its parts, and each step ticked lays a few
// bricks. Bullseyes on The Mark train soldiers who march in the plaza.
//
// It fills the whole screen like a map spread out on a desk, with its own
// close button; the drawing is src/village/engine.js and the data is shaped
// in src/lib/village.js. Ticking a step here is the same as ticking it in
// its camp. Building something (Generate project, then Build this) saves
// the choice and draws the village again with it standing.
const PAPER = { position: "fixed", inset: 0, zIndex: 90, background: "#f2f1ee" };
const OVER = { position: "fixed", left: 16, right: 16, top: "calc(env(safe-area-inset-top, 0px) + 24px)", zIndex: 91, display: "grid", justifyItems: "center", gap: 12 };

export default function Village() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const location = useLocation();
  const today = useMemo(() => todayStr(), []);
  const { data: raw, error, loading, reload } = useLoad(() => (userId ? fetchVillage(userId, today) : null), [userId, today]);
  const host = useRef(null);
  // The quest just built, so the redrawn village opens on it.
  const focus = useRef(null);
  const nav = useRef({ navigate, first: location.key === "default" });
  nav.current.navigate = navigate;

  useEffect(() => {
    if (!raw || !host.current) return undefined;
    const data = villageOf(raw, today, (ts) => toDateStr(new Date(ts)));
    data.focus = focus.current;
    focus.current = null;
    const v = mountVillage(host.current, data, {
      toggleStep: (st, doneOn) => updateStep(st.id, { done_on: doneOn }),
      build: async (b) => {
        await addVillageBuild(userId, b);
        focus.current = b.quest_id;
        reload();
      },
      open: (path) => nav.current.navigate(path),
      // Back where you came from, or to The Range when the village was the first page opened.
      close: () => (nav.current.first ? nav.current.navigate("/ascent") : nav.current.navigate(-1)),
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
            <button type="button" className="btn btn--sm" onClick={() => navigate("/ascent")}>
              Back to The Range
            </button>
          )}
        </div>
      )}
    </>
  );
}
