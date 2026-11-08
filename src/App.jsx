import { lazy, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Today from "./pages/Today";
import { todayStr } from "./lib/planDates";

// Today is the page the phone opens to, so it ships in the first bundle.
// Everything else loads the first time you go there: the app starts with
// about 40% less to download and parse, and the service worker still caches
// every page for offline use after the first visit.
const Evening = lazy(() => import("./pages/Evening"));
const Day = lazy(() => import("./pages/Day"));
const Plan = lazy(() => import("./pages/Plan"));
const Study = lazy(() => import("./pages/Study"));
const Work = lazy(() => import("./pages/Work"));
const Money = lazy(() => import("./pages/Money"));
const Spirit = lazy(() => import("./pages/Spirit"));
const Tree = lazy(() => import("./pages/Tree"));
// Targets: the mission down to the week's focus, and a page for each.
const Targets = lazy(() => import("./pages/Targets"));
const Target = lazy(() => import("./pages/Target"));
const Camp = lazy(() => import("./pages/Camp"));
const Plans = lazy(() => import("./pages/Plans"));
const Ask = lazy(() => import("./pages/Ask"));
const Mirror = lazy(() => import("./pages/Mirror"));
const WatchPage = lazy(() => import("./pages/Watch"));
const Phone = lazy(() => import("./pages/Phone"));
const Temple = lazy(() => import("./pages/Temple"));
// Love: what two paired people share (0109_love.sql).
const Love = lazy(() => import("./pages/Love"));
// The builder: an AI on your own key that changes your own Hub (0110).
const Builder = lazy(() => import("./pages/Builder"));
// The village brings three.js with it, so it stays in its own bundle.
const Village = lazy(() => import("./pages/Village"));
// The old map's address opens the village itself, ?build= and all.
const ToVillage = () => <Navigate to={`/village${window.location.search}`} replace />;

// The Quests page and the Range became the Targets tab. Their old addresses
// (a bookmark, or the home-screen app reopening where it was) land on the
// same thing there, with the ?query and any state they carried.
function MovedTo({ to }) {
  const params = useParams();
  const { search, hash, state } = useLocation();
  const path = to.replace(/:(\w+)/g, (_, k) => encodeURIComponent(params[k] ?? ""));
  return <Navigate to={`${path}${search}${hash}`} state={state} replace />;
}

// Each target's page starts fresh: going from one target to another (a
// link up the ladder, the quests row) mustn't carry a draft, a search or an
// open sheet across to the wrong target. The page's own move to the
// target's address (from a lesson's mountain, an older week of a focus, a
// goal further down the wheel) is the same target, so the page keeps what
// it has loaded across it instead of loading it all again.
function TargetAt() {
  const { pathname } = useLocation();
  const at = useRef({ key: pathname, alias: null });
  if (pathname !== at.current.key && pathname !== at.current.alias) at.current = { key: pathname, alias: null };
  return (
    <Target
      key={at.current.key}
      onCanonical={(path) => {
        at.current.alias = path;
      }}
    />
  );
}

function RedirectToToday() {
  return <Navigate to={`/day/${todayStr()}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />

          <Route element={<ProtectedRoute />}>
            <Route index element={<Today />} />
            <Route path="/evening" element={<Evening />} />
            <Route path="/evening/:date" element={<Evening />} />
            <Route path="/day" element={<RedirectToToday />} />
            <Route path="/day/:date" element={<Day />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/plan/:view" element={<Plan />} />
            <Route path="/plan/:view/:date" element={<Plan />} />
            <Route path="/study" element={<Study />} />
            <Route path="/work" element={<Work />} />
            <Route path="/money" element={<Money />} />
            <Route path="/targets" element={<Targets />} />
            <Route path="/targets/mission" element={<TargetAt />} />
            <Route path="/targets/camp/:id" element={<Camp />} />
            <Route path="/targets/plans" element={<Plans />} />
            <Route path="/targets/plans/:id" element={<Plans />} />
            <Route path="/targets/:ref" element={<TargetAt />} />
            <Route path="/tree" element={<Tree />} />
            <Route path="/spirit" element={<Spirit />} />
            <Route path="/ask" element={<Ask />} />
            <Route path="/mirror" element={<Mirror />} />
            <Route path="/watch" element={<WatchPage />} />
            <Route path="/phone" element={<Phone />} />
            <Route path="/love" element={<Love />} />
            <Route path="/builder" element={<Builder />} />
            <Route path="/temple" element={<Temple />} />
            <Route path="/temple/:view" element={<Temple />} />
            <Route path="/village" element={<Village />} />
            <Route path="/village/map" element={<ToVillage />} />

            {/* Old addresses, kept so a bookmark lands somewhere sensible. */}
            <Route path="/quests" element={<MovedTo to="/targets" />} />
            <Route path="/quests/:key" element={<MovedTo to="/targets/:key" />} />
            <Route path="/ascent" element={<MovedTo to="/targets" />} />
            <Route path="/ascent/camp/:id" element={<MovedTo to="/targets/camp/:id" />} />
            <Route path="/ascent/plans" element={<MovedTo to="/targets/plans" />} />
            <Route path="/ascent/plans/:id" element={<MovedTo to="/targets/plans/:id" />} />
            <Route path="/ascent/:ref" element={<MovedTo to="/targets/:ref" />} />
            <Route path="/today" element={<Navigate to="/" replace />} />
            <Route path="/archive" element={<RedirectToToday />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
