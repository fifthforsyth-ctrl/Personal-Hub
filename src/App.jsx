import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Home from "./pages/Home";
import Day from "./pages/Day";
import Plan from "./pages/Plan";
import Spirit from "./pages/Spirit";
import Tree from "./pages/Tree";
import Reflect from "./pages/Reflect";
import GoalLinks from "./pages/GoalLinks";
import { todayStr } from "./lib/planDates";

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
            <Route index element={<Home />} />
            <Route path="/day" element={<RedirectToToday />} />
            <Route path="/day/:date" element={<Day />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/tree" element={<Tree />} />
            <Route path="/reflect" element={<Reflect />} />
            <Route path="/spirit" element={<Spirit />} />
            <Route path="/links" element={<GoalLinks />} />

            {/* The old addresses. Today's capture is the home screen now, and
                the archive is the day card, so both land where their content
                actually moved rather than 404-ing a bookmark. */}
            <Route path="/today" element={<Navigate to="/" replace />} />
            <Route path="/archive" element={<RedirectToToday />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
