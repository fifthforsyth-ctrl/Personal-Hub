import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchVillage } from "../lib/api";
import { villageOf } from "../lib/village";
import { todayStr } from "../lib/planDates";
import { useLoad } from "../lib/useLoad";
import LoadError from "../components/ui/LoadError";
import { mountVillage } from "../village/engine";

// The village's old survey map, an ink-and-watercolour map in 3D: the builds
// on their plots, the soldiers his arrows train drilling in the plaza with
// the bow his bullseyes earned, everyone he has done temple work for walking
// its lanes, and the slider that replays it all from the first day. The
// painted village (/village) is the main view now; this stays for the
// soldiers, the villagers and the replay until the new map comes.
//
// It fills the whole screen like a map spread out on a desk, with its own
// close button; the drawing is src/village/engine.js. Choosing a build
// happens on the painted village, so the map's Choose a build and Build
// something else open /village?choose. /village/map?build=<id> opens on
// that build.
const PAPER = { position: "fixed", inset: 0, zIndex: 90, background: "#f2f1ee" };
const OVER = { position: "fixed", left: 16, right: 16, top: "calc(env(safe-area-inset-top, 0px) + 24px)", zIndex: 91, display: "grid", justifyItems: "center", gap: 12 };

export default function VillageMap() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const location = useLocation();
  const today = useMemo(() => todayStr(), []);
  const { data: raw, error, loading, reload } = useLoad(() => (userId ? fetchVillage(userId, today) : null), [userId, today]);
  const host = useRef(null);
  const open = useRef(new URLSearchParams(location.search).get("build"));
  const nav = useRef({ navigate, first: location.key === "default" });
  nav.current.navigate = navigate;

  useEffect(() => {
    if (!raw || !host.current) return undefined;
    const data = villageOf(raw, today);
    data.open = open.current;
    open.current = null;
    const v = mountVillage(host.current, data, {
      open: (path) => nav.current.navigate(path),
      // Back where you came from, or to the village when the map was the first page opened.
      close: () => (nav.current.first ? nav.current.navigate("/village", { replace: true }) : nav.current.navigate(-1)),
    });
    return () => v.destroy();
  }, [raw, today]);

  return (
    <>
      <div ref={host} style={PAPER} />
      {(error || (loading && !raw)) && (
        <div style={OVER}>
          {error ? <LoadError what="the village map" error={error} onRetry={reload} stale={Boolean(raw)} /> : <p className="empty">Loading the map…</p>}
          {!raw && (
            <button type="button" className="btn btn--sm" onClick={() => navigate("/village")}>
              Back to the village
            </button>
          )}
        </div>
      )}
    </>
  );
}
