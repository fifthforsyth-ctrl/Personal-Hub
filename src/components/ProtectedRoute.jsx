import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Sidebar, TopBar, BottomTabs } from "./NavBar";

// Both navigations are always mounted; CSS decides which one is real at this
// width. Keeping it in CSS rather than JS means no flash of the wrong chrome
// on first paint and no resize listener to keep in sync.
export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="shell">
      <Sidebar />
      <TopBar />
      <main className="main">
        <Outlet />
      </main>
      <BottomTabs />
    </div>
  );
}
