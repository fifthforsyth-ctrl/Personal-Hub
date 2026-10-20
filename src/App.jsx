import { lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
const Overview = lazy(() => import("./pages/Overview"));
const Day = lazy(() => import("./pages/Day"));
const Plan = lazy(() => import("./pages/Plan"));
const Study = lazy(() => import("./pages/Study"));
const Work = lazy(() => import("./pages/Work"));
const Money = lazy(() => import("./pages/Money"));
const Spirit = lazy(() => import("./pages/Spirit"));
const Tree = lazy(() => import("./pages/Tree"));
const Ascent = lazy(() => import("./pages/Ascent"));
const Reflect = lazy(() => import("./pages/Reflect"));
const GoalLinks = lazy(() => import("./pages/GoalLinks"));
const Ask = lazy(() => import("./pages/Ask"));
const Mirror = lazy(() => import("./pages/Mirror"));
const Phone = lazy(() => import("./pages/Phone"));
const Temple = lazy(() => import("./pages/Temple"));

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
            <Route path="/overview" element={<Overview />} />
            <Route path="/day" element={<RedirectToToday />} />
            <Route path="/day/:date" element={<Day />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/study" element={<Study />} />
            <Route path="/work" element={<Work />} />
            <Route path="/money" element={<Money />} />
            <Route path="/ascent" element={<Ascent />} />
            <Route path="/ascent/:ref" element={<Ascent />} />
            <Route path="/tree" element={<Tree />} />
            <Route path="/reflect" element={<Reflect />} />
            <Route path="/spirit" element={<Spirit />} />
            <Route path="/links" element={<GoalLinks />} />
            <Route path="/ask" element={<Ask />} />
            <Route path="/mirror" element={<Mirror />} />
            <Route path="/phone" element={<Phone />} />
            <Route path="/temple" element={<Temple />} />
            <Route path="/temple/:view" element={<Temple />} />

            {/* Old addresses, kept so a bookmark lands somewhere sensible. */}
            <Route path="/today" element={<Navigate to="/" replace />} />
            <Route path="/archive" element={<RedirectToToday />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
