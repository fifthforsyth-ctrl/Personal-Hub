import { Suspense, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Flame } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { syncProfileTimezone } from "../lib/api";
import { Sidebar, TopBar, BottomTabs } from "./NavBar";
import { CaptureProvider } from "./CaptureSheet";
import { FeedbackProvider } from "./ui/Feedback";
import ErrorBoundary from "./ErrorBoundary";

// The tab or window title follows the page, so a desktop tab, the app
// switcher and browser history all say where you were.
const TITLES = [
  ["/evening", "Evening"],
  ["/overview", "Big picture"],
  ["/day", "Day"],
  ["/plan", "Week"],
  ["/study", "Board"],
  ["/work", "Work"],
  ["/money", "Money"],
  ["/ascent", "Ascent"],
  ["/quests", "Quests"],
  ["/village", "Village"],
  ["/dragons", "Dragons"],
  ["/tree", "Goal wheel"],
  ["/reflect", "Charts"],
  ["/spirit", "Promptings & prayer"],
  ["/links", "Goal links"],
];

function titleFor(pathname) {
  const hit = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return `${hit ? hit[1] : "Today"} · Personal Hub`;
}

// Both navigations are always mounted; CSS decides which one is real at this
// width. Keeping it in CSS rather than JS means no flash of the wrong chrome
// on first paint and no resize listener to keep in sync.
export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // The device's clock is the only place the zone is really known, and the
  // midnight job has no browser to ask — so it gets written down on every
  // load. Cheap, idempotent, and it follows you across time zones.
  useEffect(() => {
    if (user?.id) syncProfileTimezone(user.id);
  }, [user?.id]);

  useEffect(() => {
    document.title = titleFor(location.pathname);
  }, [location.pathname]);

  // While the saved session is read back: the mark, not a blank white page.
  if (loading) {
    return (
      <div className="boot" aria-label="Loading">
        <span className="brand-mark">
          <Flame size={16} strokeWidth={2.4} />
        </span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  // Feedback (toasts, undo, confirm) wraps everything, the capture sheet
  // included, so a win logged from the sheet can offer its own Undo.
  return (
    <FeedbackProvider>
      <CaptureProvider>
        <div className="shell">
          <Sidebar />
          <TopBar />
          <main className="main">
            <ErrorBoundary resetKey={location.pathname}>
              <Suspense fallback={<p className="empty page">Loading…</p>}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </main>
          <BottomTabs />
        </div>
      </CaptureProvider>
    </FeedbackProvider>
  );
}
